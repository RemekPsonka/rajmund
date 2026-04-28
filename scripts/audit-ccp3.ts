import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
loadEnv();
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

// Test CCP3: paleta z partią bez ShockFreezing/ccp_passed nie da się zamknąć
const { data: sim } = await sb.rpc("simulate_full_production_day");
const s = sim as any;
console.log("simulate company:", s.company_id);

// 1) próba zamknięcia palety, której partia źródłowa NIE ma freezing log z ccp_passed
// - tworzymy nową paletę z handling_unit + production_log dla raw_batch (bez freezing)
const facId = s.facility_id;
const compId = s.company_id;
const rawBatch = s.raw_batch_id;
const sscc = "001234567890123450";

// product_id raw — pobierzmy
const { data: rawB } = await sb.from("t_batches").select("product_id").eq("id", rawBatch).maybeSingle();
const rawProd = (rawB as any)?.product_id;

const { data: hu, error: huE } = await sb.from("t_handling_units").insert({
  company_id: compId, facility_id: facId, sscc_number: "099999999999999990",
  type: "Pallet", status: "Open"
}).select().single();
if (huE) { console.log("✗ insert HU:", huE.message); process.exit(1); }
console.log("✓ HU created:", (hu as any).id);

// stwórz pusty production order Stacking + log łączący raw_batch z paletą (BEZ freezing!)
const { data: po, error: poE } = await sb.from("t_production_orders").insert({
  company_id: compId, facility_id: facId, order_number: "PO-CCP3-TEST-"+Date.now(),
  type: "Decomposition", status: "Open"
}).select().single();
if (poE) { console.log("✗ insert PO:", poE.message); process.exit(1); }

const { data: pl, error: plE } = await sb.from("t_production_logs").insert({
  production_order_id: (po as any).id,
  source_batch_id: rawBatch,
  output_batch_id: rawBatch,
  product_id: rawProd,
  handling_unit_id: (hu as any).id,
  weight_gross: 100, weight_tare: 0,
  process_stage: "Stacking"
}).select().single();
if (plE) { console.log("✗ insert PL:", plE.message); process.exit(1); }
console.log("✓ PL created");

// teraz spróbuj zamknąć paletę
const { error: closeErr } = await sb.from("t_handling_units").update({ status: "Closed" }).eq("id", (hu as any).id);
if (closeErr) {
  console.log(`✓ CCP3 GATE działa: ${closeErr.message}`);
} else {
  console.log("✗ CCP3 GATE NIE zadziałał — paleta zamknięta bez freezing");
}

// cleanup
await sb.from("t_production_logs").delete().eq("id", (pl as any).id);
await sb.from("t_handling_units").delete().eq("id", (hu as any).id);
await sb.from("t_production_orders").delete().eq("id", (po as any).id);
