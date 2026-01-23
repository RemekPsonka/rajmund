import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export interface Alert {
  id: string;
  type: "expired" | "expiring" | "blocked" | "quarantine";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  count: number;
  link?: string;
}

export interface AlertsSummary {
  alerts: Alert[];
  totalCount: number;
  criticalCount: number;
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async (): Promise<AlertsSummary> => {
      const today = format(new Date(), "yyyy-MM-dd");
      const sevenDaysFromNow = format(subDays(new Date(), -7), "yyyy-MM-dd");

      const [expiredResult, expiringResult, blockedResult, quarantineResult] =
        await Promise.all([
          // Expired batches (past expiration date, still has quantity)
          supabase
            .from("t_batches")
            .select("id", { count: "exact", head: true })
            .lt("expiration_date", today)
            .gt("current_quantity", 0)
            .eq("status", "Released"),

          // Expiring within 7 days
          supabase
            .from("t_batches")
            .select("id", { count: "exact", head: true })
            .gte("expiration_date", today)
            .lte("expiration_date", sevenDaysFromNow)
            .gt("current_quantity", 0)
            .eq("status", "Released"),

          // Blocked batches
          supabase
            .from("t_batches")
            .select("id", { count: "exact", head: true })
            .eq("status", "Blocked")
            .gt("current_quantity", 0),

          // Quarantine batches
          supabase
            .from("t_batches")
            .select("id", { count: "exact", head: true })
            .eq("status", "Quarantine")
            .gt("current_quantity", 0),
        ]);

      const alerts: Alert[] = [];

      const expiredCount = expiredResult.count || 0;
      if (expiredCount > 0) {
        alerts.push({
          id: "expired",
          type: "expired",
          severity: "critical",
          title: "Partie przeterminowane",
          description: `${expiredCount} partii wymaga natychmiastowej uwagi`,
          count: expiredCount,
          link: "/warehouse/batches",
        });
      }

      const expiringCount = expiringResult.count || 0;
      if (expiringCount > 0) {
        alerts.push({
          id: "expiring",
          type: "expiring",
          severity: "warning",
          title: "Partie kończące ważność",
          description: `${expiringCount} partii wygasa w ciągu 7 dni`,
          count: expiringCount,
          link: "/warehouse/batches",
        });
      }

      const blockedCount = blockedResult.count || 0;
      if (blockedCount > 0) {
        alerts.push({
          id: "blocked",
          type: "blocked",
          severity: "warning",
          title: "Partie zablokowane",
          description: `${blockedCount} partii zablokowanych`,
          count: blockedCount,
          link: "/warehouse/batches",
        });
      }

      const quarantineCount = quarantineResult.count || 0;
      if (quarantineCount > 0) {
        alerts.push({
          id: "quarantine",
          type: "quarantine",
          severity: "info",
          title: "Partie w kwarantannie",
          description: `${quarantineCount} partii w kwarantannie`,
          count: quarantineCount,
          link: "/warehouse/batches",
        });
      }

      const totalCount = alerts.reduce((sum, a) => sum + a.count, 0);
      const criticalCount = alerts
        .filter((a) => a.severity === "critical")
        .reduce((sum, a) => sum + a.count, 0);

      return { alerts, totalCount, criticalCount };
    },
    refetchInterval: 60000,
  });
}
