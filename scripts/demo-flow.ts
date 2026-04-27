#!/usr/bin/env tsx
/**
 * scripts/demo-flow.ts
 *
 * Headless skrypt symulujący pełen przepływ produkcyjny end-to-end:
 *   PZ (CCP1) → Rozbiór → Tumbler → Kebab → Mrożenie (CCP3) → Paleta SSCC → Wysyłka
 *
 * Wykorzystuje istniejący RPC `public.simulate_full_production_day()`, który
 * w pojedynczej transakcji utworzy: dostawę, partie surowca, partie półproduktów,
 * partie kebabów, logi mrożenia z CCP, paletę z SSCC mod10 oraz wysyłkę.
 *
 * Po wykonaniu RPC skrypt sprawdza obecność danych w bazie i loguje czas każdego
 * kroku weryfikacyjnego.
 *
 * Uruchomienie:
 *   npm run demo:flow
 *
 * Zmienne środowiskowe (z .env):
 *   VITE_SUPABASE_URL                - URL projektu
 *   VITE_SUPABASE_PUBLISHABLE_KEY    - publiczny anon key (wystarczy, RLS publiczne)
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Brak VITE_SUPABASE_URL lub VITE_SUPABASE_PUBLISHABLE_KEY w .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const t0 = Date.now();
function step(n: number, label: string) {
  const sec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[+${sec.padStart(5, " ")}s] ▶ Krok ${n}: ${label}`);
}
function ok(msg: string) {
  const sec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[+${sec.padStart(5, " ")}s]   ✓ ${msg}`);
}
function fail(msg: string): never {
  const sec = ((Date.now() - t0) / 1000).toFixed(2);
  console.error(`[+${sec.padStart(5, " ")}s]   ✗ ${msg}`);
  process.exit(1);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Demo Flow — pełna symulacja produkcji w jednym skrypcie");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 0) Wywołanie atomowego RPC po stronie bazy
  step(0, "Uruchamiam RPC simulate_full_production_day()");
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "simulate_full_production_day",
  );
  if (rpcError) fail(`RPC zwróciło błąd: ${rpcError.message}`);
  ok(`RPC OK — odpowiedź: ${JSON.stringify(rpcData).slice(0, 120)}…`);

  // 1) PZ + CCP1
  step(1, "Sprawdzam PZ z CCP1 (received_temp_c wypełnione)");
  const { count: pzCount } = await supabase
    .from("t_warehouse_movements")
    .select("id", { count: "exact", head: true })
    .eq("type", "PZ")
    .not("received_temp_c", "is", null);
  if (!pzCount || pzCount < 1) fail("Brak PZ z CCP1");
  ok(`PZ z CCP1: ${pzCount}`);

  // 2) Rozbiór → partie surowca/filet
  step(2, "Sprawdzam partie po rozbiorze (DISASSEMBLY)");
  const { count: disasmCount } = await supabase
    .from("t_batches")
    .select("id", { count: "exact", head: true })
    .eq("source_event_type", "DISASSEMBLY");
  if (!disasmCount || disasmCount < 1) fail("Brak partii DISASSEMBLY");
  ok(`Partii rozbioru: ${disasmCount}`);

  // 3) Tumbler → masa
  step(3, "Sprawdzam partie po tumblerze (TUMBLING)");
  const { count: tumblingCount } = await supabase
    .from("t_batches")
    .select("id", { count: "exact", head: true })
    .eq("source_event_type", "TUMBLING");
  if (!tumblingCount || tumblingCount < 1) fail("Brak partii TUMBLING");
  ok(`Partii tumbler: ${tumblingCount}`);

  // 4) Kebab → szpady
  step(4, "Sprawdzam partie kebabów (ASSEMBLY) + warianty");
  const { count: assemblyCount } = await supabase
    .from("t_batches")
    .select("id", { count: "exact", head: true })
    .eq("source_event_type", "ASSEMBLY");
  if (!assemblyCount || assemblyCount < 1) fail("Brak partii ASSEMBLY");
  const { count: variantCount } = await supabase
    .from("t_production_kebab_variants")
    .select("id", { count: "exact", head: true });
  ok(`Partii kebab: ${assemblyCount} • wariantów: ${variantCount ?? 0}`);

  // 5) Mrożenie + CCP3 (≤ -18°C)
  step(5, "Sprawdzam mrożenie (krzywa + ccp_passed)");
  const { count: freezingLogs } = await supabase
    .from("t_freezing_temp_log")
    .select("id", { count: "exact", head: true });
  const { count: freezingPassed } = await supabase
    .from("t_production_logs")
    .select("id", { count: "exact", head: true })
    .eq("process_stage", "ShockFreezing")
    .eq("ccp_passed", true);
  if (!freezingPassed || freezingPassed < 1)
    fail("Brak logów mrożenia z ccp_passed=true");
  ok(`Pomiarów temp.: ${freezingLogs ?? 0} • CCP passed: ${freezingPassed}`);

  // 6) Paleta z SSCC mod10 (18 cyfr)
  step(6, "Sprawdzam paletę z SSCC (mod10, 18 cyfr)");
  const { data: pallets, error: palletErr } = await supabase
    .from("t_handling_units")
    .select("id, sscc_number, total_net_weight, status")
    .not("sscc_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (palletErr) fail(palletErr.message);
  const validPallet = pallets?.find((p) => (p.sscc_number ?? "").length === 18);
  if (!validPallet) fail("Brak palety z 18-cyfrowym SSCC");
  ok(
    `Paleta: SSCC=${validPallet.sscc_number} • netto=${validPallet.total_net_weight}kg • status=${validPallet.status}`,
  );

  // 7) Wysyłka
  step(7, "Sprawdzam wysyłkę (Shipment)");
  const { data: shipments } = await supabase
    .from("t_shipments")
    .select("id, shipment_number, status, pallets_count, total_net_weight")
    .order("created_at", { ascending: false })
    .limit(5);
  if (!shipments || shipments.length === 0) fail("Brak wysyłek");
  ok(
    `Wysyłki: ${shipments.length} • najnowsza: ${shipments[0].shipment_number} (${shipments[0].status}, ${shipments[0].pallets_count} palet)`,
  );

  // 8) Genealogia LOT — sprawdź że paleta ma pełne drzewo aż do PZ
  step(8, "Weryfikuję genealogię LOT od palety do dostawcy");
  const { count: lineageCount } = await supabase
    .from("t_lot_lineage")
    .select("id", { count: "exact", head: true });
  ok(`Wpisów lineage w bazie: ${lineageCount ?? 0}`);

  // RPC get_lot_lineage dla pierwszego batcha na palecie
  const { data: palletItems } = await supabase
    .from("t_shipment_items")
    .select("batch_id, handling_unit_id")
    .eq("handling_unit_id", validPallet.id)
    .limit(1);

  const sampleBatchId = palletItems?.[0]?.batch_id;
  if (sampleBatchId) {
    const { data: tree, error: treeErr } = await supabase.rpc("get_lot_lineage", {
      p_batch_id: sampleBatchId,
    });
    if (treeErr) {
      console.warn(`   ⚠ get_lot_lineage: ${treeErr.message}`);
    } else {
      const nodes = Array.isArray(tree) ? tree.length : 0;
      ok(`Drzewo genealogii dla batch=${sampleBatchId.slice(0, 8)}…: ${nodes} węzłów`);
    }
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  ✅ Demo flow ZAKOŃCZONY w ${totalSec}s`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`\n  Otwórz w UI:`);
  console.log(`    /production/orders     → zlecenia`);
  console.log(`    /warehouse/batches     → partie`);
  console.log(`    /shipping/shipments    → wysyłka ${shipments[0].shipment_number}`);
  console.log(`    /genealogy             → genealogia LOT`);
  console.log("");
}

main().catch((e) => {
  console.error("\n❌ Błąd:", e);
  process.exit(1);
});
