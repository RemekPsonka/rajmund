import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Jednorazowy auto-check zdrowia schematu bazy w trybie dev.
 * - W produkcji: nie robi nic.
 * - W dev: woła RPC check_database_integrity() raz po mount i loguje wynik
 *   do konsoli (console.log gdy ok, console.warn gdy są defekty).
 */
export function DevHealthCheck() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    supabase
      .rpc("check_database_integrity")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("⚠️ Database health check error:", error);
          return;
        }
        const result = data as
          | { ok?: boolean; summary?: { passed: number; failed: number; total: number } }
          | null;
        const summary = result?.summary;
        if (result && result.ok === false) {
          console.warn(
            "⚠️ Database health check FAILED:",
            summary,
            "— otwórz /dev-tools po szczegóły",
          );
        } else if (summary) {
          console.log("✓ Database health check:", summary);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

export default DevHealthCheck;
