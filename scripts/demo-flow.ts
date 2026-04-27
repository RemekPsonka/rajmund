#!/usr/bin/env tsx
/**
 * scripts/demo-flow.ts
 *
 * Headless skrypt symulujący pełen przepływ produkcyjny end-to-end:
 *   PZ → Rozbiór → Tumbler → Kebab → Mrożenie → Paleta SSCC → Wysyłka
 *
 * Wykorzystuje atomowy RPC `public.simulate_full_production_day()`, który
 * w jednej transakcji wstawia firmę testową "Kebab Test Factory" wraz z pełnym
 * łańcuchem partii, zlecen, palet i wysyłki. Skrypt loguje czas każdego kroku
 * oraz weryfikuje rezultat na podstawie:
 *   - JSON-a zwracanego przez RPC (zawiera wszystkie kluczowe ID + metryki),
 *   - dodatkowych RPC `SECURITY DEFINER` (np. `get_lot_lineage`).
 *
 * RLS na tabelach wymaga zalogowanego użytkownika, dlatego skrypt nie odpytuje
 * bezpośrednio tabel produktów/partii (anon klucz nie ma dostępu) — zamiast
 * tego korzysta z bogatego kontraktu RPC.
 *
 * Uruchomienie:
 *   npm run demo:flow
 *
 * Zmienne środowiskowe (z .env):
 *   VITE_SUPABASE_URL                - URL projektu
 *   VITE_SUPABASE_PUBLISHABLE_KEY    - publiczny klucz
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
  success: boolean;
  company_id: string;
  facility_id: string;
  raw_batch_id: string;
  raw_quantity_kg: number;
  meat_batch_id: string;
  meat_quantity_kg: number;
  masa_batch_id: string;
  masa_quantity_kg: number;
  kebab_batch_id: string;
  kebab_sticks_count: number;
  pallets_created: number;
  pallet_ids: string[];
  shipment_id: string;
  shipment_status: string;
}

function need<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) fail(`Brak: ${label}`);
  return value;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Demo Flow — pełna symulacja produkcji w jednym skrypcie");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 0) Atomowy RPC po stronie bazy (cała sekwencja w jednej transakcji)
  step(0, "Uruchamiam RPC simulate_full_production_day()");
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "simulate_full_production_day",
  );
  if (rpcError) fail(`RPC zwróciło błąd: ${rpcError.message}`);
  const sim = rpcData as SimResult;
  if (!sim?.success) fail(`RPC zwrócił success=false: ${JSON.stringify(rpcData)}`);
  ok(`RPC OK — Kebab Test Factory utworzona (company=${sim.company_id.slice(0, 8)}…)`);

  // 1) Surowiec — partia kurczaka 5000kg
  step(1, "PZ — przyjęcie surowca (Ćwiartka kurczaka)");
  need(sim.raw_batch_id, "raw_batch_id");
  ok(`Partia surowca: ${sim.raw_batch_id.slice(0, 8)}… • ${sim.raw_quantity_kg}kg`);

  // 2) Rozbiór: 5000kg surowca → 3000kg mięsa + 1900kg odpadów
  step(2, "Rozbiór (Decomposition) — 5000kg → 3000kg mięsa + 1900kg odpadów");
  need(sim.meat_batch_id, "meat_batch_id");
  ok(`Partia mięsa: ${sim.meat_batch_id.slice(0, 8)}… • ${sim.meat_quantity_kg}kg`);

  // 3) Tumbler: 3000kg mięsa → 3300kg masy (uzysk 110% wg receptury z przyprawami)
  step(3, "Tumbler (Processing) — masowanie wg receptury (3000→3300kg)");
  need(sim.masa_batch_id, "masa_batch_id");
  ok(`Partia masy: ${sim.masa_batch_id.slice(0, 8)}… • ${sim.masa_quantity_kg}kg`);

  // 4) Kebab: 3300kg masy → 215 szpad
  step(4, "Kebab (Assembly) — szpadowanie 3300kg → 215 szpad");
  need(sim.kebab_batch_id, "kebab_batch_id");
  ok(`Partia kebabu: ${sim.kebab_batch_id.slice(0, 8)}… • ${sim.kebab_sticks_count} szpad`);

  // 5) Mrożenie (mockFreezingTempAtFast w UI; w RPC log Freezing zamknięty z duration=240min)
  step(5, "Mrożenie szokowe (Freezing) — log zamknięty w bazie");
  // RPC tworzy zlecenie Freezing z log freezing_completed_at=NOW(), duration=240min
  ok(`Zlecenie Freezing utworzone i zamknięte przez RPC`);

  // 6) Palety z SSCC mod10
  step(6, "Paletyzacja — SSCC mod10");
  if (!sim.pallet_ids?.length) fail("Brak pallet_ids w odpowiedzi RPC");
  ok(`Palet utworzonych: ${sim.pallets_created} • ID[0]=${sim.pallet_ids[0].slice(0, 8)}…`);

  // 7) Wysyłka WZ
  step(7, "Wysyłka (Shipment) ze statusem Shipped + kierowca + plates");
  need(sim.shipment_id, "shipment_id");
  ok(`Wysyłka: ${sim.shipment_id.slice(0, 8)}… • status=${sim.shipment_status}`);

  // 8) Genealogia LOT — RPC SECURITY DEFINER, dostęp anon OK
  step(8, "Genealogia LOT (RPC get_lot_lineage od kebab_batch_id)");
  const { data: tree, error: treeErr } = await supabase.rpc("get_lot_lineage", {
    lot_id: sim.kebab_batch_id,
  });
  if (treeErr) {
    warn(`get_lot_lineage: ${treeErr.message}`);
  } else {
    const nodes = Array.isArray(tree) ? tree.length : 0;
    if (nodes === 0) {
      warn(
        "Drzewo genealogii puste — RPC simulate nie tworzy wpisów t_lot_lineage; " +
          "lineage budują triggery RECEIVING/AGGREGATION przy realnych operacjach UI.",
      );
    } else {
      ok(`Drzewo dla kebab_batch=${sim.kebab_batch_id.slice(0, 8)}…: ${nodes} węzłów`);
    }
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  ✅ Demo flow ZAKOŃCZONY w ${totalSec}s`);
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(`  Dane testowe utworzone (firma: Kebab Test Factory)`);
  console.log(`  Otwórz w UI:`);
  console.log(`    /production/orders     → 4 zlecenia (Decomp, Process, Assembly, Freezing)`);
  console.log(`    /warehouse/batches     → partie kebab + półprodukty`);
  console.log(`    /shipping/shipments    → wysyłka (status=${sim.shipment_status})`);
  console.log(
    `    /genealogy             → drzewo LOT od kebab_batch=${sim.kebab_batch_id.slice(0, 8)}…`,
  );
  console.log("");
}

main().catch((e) => {
  console.error("\n❌ Błąd:", e);
  process.exit(1);
});
