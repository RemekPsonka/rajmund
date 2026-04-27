#!/usr/bin/env tsx
/**
 * scripts/demo-flow.ts
 *
 * Headless skrypt symulujący pełen przepływ produkcyjny end-to-end:
 *   PZ (CCP1) → Rozbiór → Tumbler → Kebab → Mrożenie (CCP3) → Paleta SSCC → Wysyłka
 *
 * Wykorzystuje atomowy RPC `public.simulate_full_production_day()`, który w
 * jednej transakcji wstawia firmę testową, partie surowca/półproduktów/kebabów,
 * zlecenia produkcyjne, palety z SSCC oraz wysyłkę. Następnie skrypt mierzy
 * czas i weryfikuje każdy krok osobnym zapytaniem, logując wyniki w konsoli.
 *
 * Uruchomienie:
 *   npm run demo:flow
 *
 * Zmienne środowiskowe (z .env):
 *   VITE_SUPABASE_URL                - URL projektu
 *   VITE_SUPABASE_PUBLISHABLE_KEY    - publiczny klucz (RLS jest publiczne)
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
function warn(msg: string) {
  const sec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[+${sec.padStart(5, " ")}s]   ⚠ ${msg}`);
}
function fail(msg: string): never {
  const sec = ((Date.now() - t0) / 1000).toFixed(2);
  console.error(`[+${sec.padStart(5, " ")}s]   ✗ ${msg}`);
  process.exit(1);
}

interface SimResult {
  success?: boolean;
  company_id?: string;
  pallet_ids?: string[];
  shipment_id?: string;
  kebab_batch_id?: string;
  [k: string]: unknown;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Demo Flow — pełna symulacja produkcji w jednym skrypcie");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 0) Atomowy RPC — wszystko po stronie bazy w jednej transakcji
  step(0, "Uruchamiam RPC simulate_full_production_day()");
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "simulate_full_production_day",
  );
  if (rpcError) fail(`RPC zwróciło błąd: ${rpcError.message}`);
  const sim = (rpcData ?? {}) as SimResult;
  ok(
    `RPC OK — company=${sim.company_id?.slice(0, 8)}…, palet=${sim.pallet_ids?.length ?? 0}, shipment=${sim.shipment_id?.slice(0, 8)}…`,
  );

  const companyId = sim.company_id;
  if (!companyId) fail("RPC nie zwróciło company_id");

  // 1) Surowiec i partie
  step(1, "Sprawdzam partie surowca (RawMeat)");
  const { data: rawProducts } = await supabase
    .from("t_products")
    .select("id")
    .eq("company_id", companyId)
    .eq("industry_category", "RawMeat");
  const rawIds = (rawProducts ?? []).map((p) => p.id);
  const { count: rawBatches } = await supabase
    .from("t_batches")
    .select("id", { count: "exact", head: true })
    .in("product_id", rawIds.length ? rawIds : ["00000000-0000-0000-0000-000000000000"]);
  if (!rawBatches || rawBatches < 1) fail("Brak partii surowca");
  ok(`Partii surowca: ${rawBatches}`);

  // 2) Rozbiór → półprodukty
  step(2, "Sprawdzam zlecenie rozbioru (Decomposition) i wynikowe półprodukty");
  const { count: decompOrders } = await supabase
    .from("t_production_orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("type", "Decomposition");
  if (!decompOrders) fail("Brak zlecenia Decomposition");
  ok(`Zleceń rozbioru: ${decompOrders}`);

  // 3) Tumbler → masa
  step(3, "Sprawdzam zlecenie tumblera (Processing) z recepturą");
  const { data: tumblerOrders } = await supabase
    .from("t_production_orders")
    .select("id, recipe_id, status")
    .eq("company_id", companyId)
    .eq("type", "Processing");
  if (!tumblerOrders?.length) fail("Brak zlecenia Processing");
  ok(
    `Zleceń tumblera: ${tumblerOrders.length} • z recepturą: ${tumblerOrders.filter((o) => o.recipe_id).length}`,
  );

  // 4) Kebab → szpady (warianty)
  step(4, "Sprawdzam zlecenie kebabu (Assembly) i warianty szpad");
  const { data: assemblyOrders } = await supabase
    .from("t_production_orders")
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "Assembly");
  if (!assemblyOrders?.length) fail("Brak zlecenia Assembly");
  const assemblyIds = assemblyOrders.map((o) => o.id);
  const { data: assemblyLogs } = await supabase
    .from("t_production_logs")
    .select("id")
    .in("production_order_id", assemblyIds);
  const logIds = (assemblyLogs ?? []).map((l) => l.id);
  const { data: variants } = await supabase
    .from("t_production_kebab_variants")
    .select("variant_name, variant_weight, quantity, total_weight")
    .in("production_log_id", logIds);
  if (!variants?.length) fail("Brak wariantów kebabów");
  const totalSticks = variants.reduce((s, v) => s + (v.quantity ?? 0), 0);
  const totalKg = variants.reduce((s, v) => s + Number(v.total_weight ?? 0), 0);
  ok(`Wariantów: ${variants.length} • szpad łącznie: ${totalSticks} • masa: ${totalKg}kg`);

  // 5) Mrożenie
  step(5, "Sprawdzam zlecenie mrożenia (Freezing) i log mrożenia");
  const { data: freezingOrders } = await supabase
    .from("t_production_orders")
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "Freezing");
  if (!freezingOrders?.length) fail("Brak zlecenia Freezing");
  const fIds = freezingOrders.map((o) => o.id);
  const { data: freezingLogs } = await supabase
    .from("t_production_logs")
    .select("freezing_duration_minutes, ccp_passed, latest_core_temp_c")
    .in("production_order_id", fIds);
  if (!freezingLogs?.length) fail("Brak logów mrożenia");
  const passed = freezingLogs.filter((l) => l.ccp_passed === true).length;
  ok(
    `Logów mrożenia: ${freezingLogs.length} • CCP passed: ${passed} • śr. czas: ${
      freezingLogs[0]?.freezing_duration_minutes ?? "—"
    } min`,
  );
  if (passed === 0) {
    warn("Logi mrożenia nie mają ccp_passed=true (CCP3 weryfikuje terminal mrożenia w UI)");
  }

  // 6) Paleta z SSCC
  step(6, "Sprawdzam paletę z SSCC");
  const palletIds = sim.pallet_ids ?? [];
  if (!palletIds.length) fail("RPC nie zwróciło pallet_ids");
  const { data: pallets } = await supabase
    .from("t_handling_units")
    .select("id, sscc_number, total_net_weight, status, items_count")
    .in("id", palletIds);
  if (!pallets?.length) fail("Brak palet w bazie");
  const sscc = pallets[0].sscc_number ?? "";
  ok(
    `Palet: ${pallets.length} • SSCC[0]=${sscc} (${sscc.length} cyfr) • netto=${pallets[0].total_net_weight}kg • status=${pallets[0].status}`,
  );

  // 7) Wysyłka
  step(7, "Sprawdzam wysyłkę");
  const shipmentId = sim.shipment_id;
  if (!shipmentId) fail("RPC nie zwróciło shipment_id");
  const { data: shipment } = await supabase
    .from("t_shipments")
    .select("shipment_number, status, pallets_count, total_net_weight, driver_name, truck_plates")
    .eq("id", shipmentId)
    .single();
  if (!shipment) fail("Wysyłka nieznaleziona");
  ok(
    `Wysyłka: ${shipment.shipment_number} (${shipment.status}) • palet=${shipment.pallets_count} • netto=${shipment.total_net_weight}kg • kierowca=${shipment.driver_name} (${shipment.truck_plates})`,
  );
  const { count: shipmentItems } = await supabase
    .from("t_shipment_items")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId);
  ok(`Pozycji wysyłki: ${shipmentItems}`);

  // 8) Genealogia
  step(8, "Sprawdzam genealogię LOT (RPC get_lot_lineage)");
  const kebabBatchId = sim.kebab_batch_id;
  if (kebabBatchId) {
    const { data: tree, error: treeErr } = await supabase.rpc("get_lot_lineage", {
      p_batch_id: kebabBatchId,
    });
    if (treeErr) {
      warn(`get_lot_lineage: ${treeErr.message}`);
    } else {
      const nodes = Array.isArray(tree) ? tree.length : 0;
      ok(`Drzewo dla kebab_batch=${kebabBatchId.slice(0, 8)}…: ${nodes} węzłów`);
    }
  }
  const { count: lineageCount } = await supabase
    .from("t_lot_lineage")
    .select("id", { count: "exact", head: true });
  ok(`Wpisów lineage łącznie w bazie: ${lineageCount ?? 0}`);

  const totalSec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  ✅ Demo flow ZAKOŃCZONY w ${totalSec}s`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`\n  Dane testowe utworzone (firma: Kebab Test Factory)`);
  console.log(`  Otwórz w UI:`);
  console.log(`    /production/orders     → zlecenia (Decomp/Process/Assembly/Freezing)`);
  console.log(`    /warehouse/batches     → partie kebab + półprodukty`);
  console.log(`    /shipping/shipments    → wysyłka ${shipment.shipment_number}`);
  console.log(`    /genealogy             → drzewo LOT (kebab_batch=${kebabBatchId?.slice(0, 8)}…)`);
  console.log("");
}

main().catch((e) => {
  console.error("\n❌ Błąd:", e);
  process.exit(1);
});
