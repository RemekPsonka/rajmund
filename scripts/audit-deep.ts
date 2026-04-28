import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
loadEnv();
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

const tests: Array<[string, () => Promise<boolean | string>]> = [];
const T = (name: string, fn: () => Promise<boolean | string>) => tests.push([name, fn]);

// 1) Idempotencja seed_minimal_demo
T("seed_minimal_demo idempotent (2x)", async () => {
  const { data: a } = await sb.rpc("seed_minimal_demo");
  const { data: b } = await sb.rpc("seed_minimal_demo");
  return (a as any)?.success && (b as any)?.success;
});

// 2) Idempotencja audit_e2e_flow
T("audit_e2e_flow idempotent (2x +3°C)", async () => {
  const { data: a } = await sb.rpc("audit_e2e_flow", { p_temp: 3 });
  const { data: b } = await sb.rpc("audit_e2e_flow", { p_temp: 3 });
  return (a as any)?.success && (b as any)?.success;
});

// 3) get_lot_lineage zwraca dane po audit_e2e_flow
T("get_lot_lineage returns rows for kebab batch", async () => {
  const { data: r } = await sb.rpc("audit_e2e_flow", { p_temp: 3 });
  const kebabId = (r as any)?.kebab_batch_id;
  if (!kebabId) return "no kebab_batch_id";
  const { data: tree, error } = await sb.rpc("get_lot_lineage", { lot_id: kebabId });
  if (error) return error.message;
  const n = Array.isArray(tree) ? tree.length : 0;
  return n > 0 ? true : `empty tree (${n})`;
});

// 4) CCP1 trigger fires once per >+4°C reception
T("CCP1: temp +6°C generates EXACTLY 1 complaint", async () => {
  await sb.rpc("cleanup_audit_data");
  const { data: r } = await sb.rpc("audit_e2e_flow", { p_temp: 6 });
  return (r as any)?.complaints_count === 1 ? true : `got ${(r as any)?.complaints_count}`;
});

// 5) CCP1: +3°C produces 0 complaints
T("CCP1: temp +3°C generates 0 complaints", async () => {
  await sb.rpc("cleanup_audit_data");
  const { data: r } = await sb.rpc("audit_e2e_flow", { p_temp: 3 });
  return (r as any)?.complaints_count === 0 ? true : `got ${(r as any)?.complaints_count}`;
});

// 6) simulate_full_production_day produces shipped pallets
T("simulate produces 5 pallets + Shipped status", async () => {
  const { data: r } = await sb.rpc("simulate_full_production_day");
  const ok = (r as any)?.pallets_created === 5 && (r as any)?.shipment_status === "Shipped";
  return ok ? true : `pallets=${(r as any)?.pallets_created} status=${(r as any)?.shipment_status}`;
});

// 7) Cleanup faktycznie czyści
T("cleanup_demo_data leaves no DEMO_NARROW company", async () => {
  await sb.rpc("seed_minimal_demo");
  await sb.rpc("cleanup_demo_data");
  const { data, error } = await sb.from("t_companies").select("id").eq("short_name","DEMO_NARROW");
  if (error) return error.message;
  return (data?.length ?? 0) === 0 ? true : `${data?.length} demo rows still present`;
});

let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try {
    const r = await fn();
    if (r === true) { console.log(`✓ ${name}`); pass++; }
    else { console.log(`✗ ${name} → ${r}`); fail++; }
  } catch (e: any) {
    console.log(`✗ ${name} → THROW: ${e.message}`); fail++;
  }
}
console.log(`\n=== ${pass} passed / ${fail} failed (${tests.length} total) ===`);
process.exit(fail > 0 ? 1 : 0);
