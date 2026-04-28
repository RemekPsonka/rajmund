import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
loadEnv();
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);
const r = await sb.rpc("seed_minimal_demo");
console.log(JSON.stringify(r, null, 2));
