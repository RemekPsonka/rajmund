import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
loadEnv();
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

async function run(label: string, fn: string, args: any = {}) {
  const t = Date.now();
  const { data, error } = await sb.rpc(fn as any, args);
  const ms = Date.now() - t;
  if (error) {
    console.log(`❌ ${label} (${fn}) — ${ms}ms — ${error.message}`);
    return null;
  }
  console.log(`✓ ${label} (${fn}) — ${ms}ms`);
  return data;
}

(async () => {
  console.log("=== SCENARIO 1: cleanup ===");
  await run("cleanup", "cleanup_audit_data");

  console.log("\n=== SCENARIO 2: happy path (temp +3°C) ===");
  const a1 = await run("audit_e2e_flow(+3)", "audit_e2e_flow", { p_temp: 3.0 });
  console.log(JSON.stringify(a1, null, 2));

  console.log("\n=== SCENARIO 3: CCP1 fail (temp +6°C) ===");
  await run("cleanup", "cleanup_audit_data");
  const a2 = await run("audit_e2e_flow(+6)", "audit_e2e_flow", { p_temp: 6.0 });
  console.log(JSON.stringify(a2, null, 2));

  console.log("\n=== SCENARIO 4: simulate_full_production_day (vanilla) ===");
  const a3 = await run("simulate", "simulate_full_production_day");
  console.log(JSON.stringify(a3, null, 2));

  console.log("\n=== SCENARIO 5: seed_minimal_demo ===");
  const a4 = await run("seed_minimal_demo", "seed_minimal_demo");
  console.log(JSON.stringify(a4, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
