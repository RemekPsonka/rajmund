import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

export interface DashboardKPIs {
  dailyProductionKg: number;
  expiringBatchesCount: number;
  openOrdersCount: number;
  todayShipmentsCount: number;
  blockedBatchesCount: number;
  weeklyProductionTrend: { date: string; kg: number }[];
}

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async (): Promise<DashboardKPIs> => {
      const today = startOfDay(new Date());
      const todayStr = format(today, "yyyy-MM-dd");
      const sevenDaysAgo = subDays(today, 7);
      const sevenDaysFromNow = format(subDays(today, -7), "yyyy-MM-dd");

      // Parallel queries for all KPIs
      const [
        dailyProductionResult,
        expiringBatchesResult,
        openOrdersResult,
        todayShipmentsResult,
        blockedBatchesResult,
        weeklyProductionResult,
      ] = await Promise.all([
        // Daily production (last 24h) - sum of weight_net from production logs
        supabase
          .from("t_production_logs")
          .select("weight_net")
          .gte("created_at", today.toISOString()),

        // Batches expiring within 7 days
        supabase
          .from("t_batches")
          .select("id", { count: "exact", head: true })
          .eq("status", "Released")
          .gt("current_quantity", 0)
          .lte("expiration_date", sevenDaysFromNow)
          .gte("expiration_date", todayStr),

        // Open production orders
        supabase
          .from("t_production_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "Open"),

        // Today's shipments (Planning or Loading)
        supabase
          .from("t_shipments")
          .select("id", { count: "exact", head: true })
          .eq("dispatch_date", todayStr)
          .in("status", ["Planning", "Loading"]),

        // Blocked/Quarantine batches
        supabase
          .from("t_batches")
          .select("id", { count: "exact", head: true })
          .in("status", ["Blocked", "Quarantine"])
          .gt("current_quantity", 0),

        // Weekly production trend - last 7 days
        supabase
          .from("t_production_logs")
          .select("weight_net, created_at")
          .gte("created_at", sevenDaysAgo.toISOString()),
      ]);

      // Calculate daily production
      const dailyProductionKg =
        dailyProductionResult.data?.reduce(
          (sum, log) => sum + (Number(log.weight_net) || 0),
          0
        ) || 0;

      // Process weekly trend data
      const weeklyMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), "yyyy-MM-dd");
        weeklyMap.set(date, 0);
      }

      weeklyProductionResult.data?.forEach((log) => {
        const date = format(new Date(log.created_at), "yyyy-MM-dd");
        if (weeklyMap.has(date)) {
          weeklyMap.set(date, (weeklyMap.get(date) || 0) + (Number(log.weight_net) || 0));
        }
      });

      const weeklyProductionTrend = Array.from(weeklyMap.entries()).map(
        ([date, kg]) => ({
          date: format(new Date(date), "dd.MM"),
          kg: Math.round(kg),
        })
      );

      return {
        dailyProductionKg: Math.round(dailyProductionKg),
        expiringBatchesCount: expiringBatchesResult.count || 0,
        openOrdersCount: openOrdersResult.count || 0,
        todayShipmentsCount: todayShipmentsResult.count || 0,
        blockedBatchesCount: blockedBatchesResult.count || 0,
        weeklyProductionTrend,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
