import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
loadEnv();
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

console.log("=== Final E2E Audit ===\n");

// Test CCP3 hard gate
const { data: ccp3, error } = await sb.rpc("test_ccp3_gate");
if (error) console.log("✗ test_ccp3_gate error:", error.message);
else {
  const r = ccp3 as any;
  if (r.blocked) console.log(`✓ CCP3 hard gate BLOKUJE zamknięcie palety bez mrożenia: "${r.err}"`);
  else console.log(`✗ CCP3 NIE blokuje (CRITICAL!)`);
}

// Final happy E2E
console.log("\n--- Happy path summary ---");
await sb.rpc("cleanup_audit_data");
const { data: h } = await sb.rpc("audit_e2e_flow", { p_temp: 2 });
const hh = h as any;
console.log(`Lineage rows: ${hh.lineage_rows} | Complaints: ${hh.complaints_count} | SSCC: ${hh.sscc}`);

const { data: tree } = await sb.rpc("get_lot_lineage", { lot_id: hh.kebab_batch_id });
const t = tree as any;
console.log(`Drzewo LOT kebabu: ancestors=${t.ancestors.length}, descendants=${t.descendants.length}`);
t.ancestors.forEach((a: any) => console.log(`  ↑ ${a.lot_code} (${a.event_type}, ${a.qty_kg}kg)`));
t.descendants.forEach((d: any) => console.log(`  ↓ ${d.lot_code} (${d.event_type}, ${d.qty_kg}kg)`));
