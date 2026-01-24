import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockSummaryItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  company_id: string;
  batch_count: number;
  total_weight: number;
}

export interface ProductionTodayItem {
  facility_id: string;
  company_id: string;
  facility_name: string;
  logs_count: number;
  total_output_kg: number;
}

export interface RecentMovementItem {
  id: string;
  document_number: string;
  type: string;
  status: string;
  created_at: string;
  contractor_name: string | null;
  facility_name: string | null;
}

export function useStockSummary() {
  return useQuery({
    queryKey: ["stock-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_stock_summary")
        .select("*")
        .order("total_weight", { ascending: false });

      if (error) throw error;
      return data as StockSummaryItem[];
    },
  });
}

export function useProductionToday() {
  return useQuery({
    queryKey: ["production-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_production_today")
        .select("*");

      if (error) throw error;
      return data as ProductionTodayItem[];
    },
  });
}

export function useRecentMovements(limit: number = 5) {
  return useQuery({
    queryKey: ["recent-movements", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_recent_movements")
        .select("*")
        .limit(limit);

      if (error) throw error;
      return data as RecentMovementItem[];
    },
  });
}

// Agregaty dla Dashboard
export function useStockTotals() {
  return useQuery({
    queryKey: ["stock-totals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_stock_summary")
        .select("total_weight, batch_count");

      if (error) throw error;

      const totals = (data || []).reduce(
        (acc, item) => ({
          totalWeight: acc.totalWeight + Number(item.total_weight || 0),
          totalBatches: acc.totalBatches + Number(item.batch_count || 0),
          productsWithStock: acc.productsWithStock + (Number(item.total_weight) > 0 ? 1 : 0),
        }),
        { totalWeight: 0, totalBatches: 0, productsWithStock: 0 }
      );

      return totals;
    },
  });
}

export function useProductionTodayTotal() {
  return useQuery({
    queryKey: ["production-today-total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_production_today")
        .select("total_output_kg, logs_count");

      if (error) throw error;

      const totals = (data || []).reduce(
        (acc, item) => ({
          totalOutputKg: acc.totalOutputKg + Number(item.total_output_kg || 0),
          totalLogs: acc.totalLogs + Number(item.logs_count || 0),
        }),
        { totalOutputKg: 0, totalLogs: 0 }
      );

      return totals;
    },
  });
}

export function useTopProductsByStock(limit: number = 5) {
  return useQuery({
    queryKey: ["top-products-by-stock", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_stock_summary")
        .select("product_name, sku, total_weight")
        .gt("total_weight", 0)
        .order("total_weight", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as { product_name: string; sku: string | null; total_weight: number }[];
    },
  });
}
