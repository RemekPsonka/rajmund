import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PrintDocumentType =
  | "SSCC_LABEL"
  | "UNIT_LABEL"
  | "CMR"
  | "HDI"
  | "PACKING_LIST"
  | "WZ"
  | "SUPPLIER_COMPLAINT";

export interface PrintLogEntry {
  id: string;
  document_type: PrintDocumentType;
  reference_id: string | null;
  reference_table: string | null;
  printed_at: string;
  printed_by: string | null;
  payload: Record<string, unknown> | null;
}

export interface LogPrintInput {
  document_type: PrintDocumentType;
  reference_id?: string;
  reference_table?: string;
  printed_by?: string;
  payload?: Record<string, unknown>;
}

/**
 * Wpisuje pojedynczy wydruk do rejestru audytowego t_print_log.
 * Używane wszędzie gdzie operator klika "DRUKUJ" (etykieta SSCC, CMR, WZ, itp.).
 */
export function useLogPrint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LogPrintInput) => {
      const { error } = await supabase.from("t_print_log").insert([data]);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["print-history", vars.reference_id],
      });
      queryClient.invalidateQueries({ queryKey: ["print-history-batch"] });
    },
  });
}

/**
 * Historia wydruków dla pojedynczego obiektu (np. paleta, wysyłka).
 * Sortowanie: najnowsze pierwsze.
 */
export function usePrintHistory(referenceId: string | null) {
  return useQuery({
    queryKey: ["print-history", referenceId],
    enabled: !!referenceId,
    queryFn: async (): Promise<PrintLogEntry[]> => {
      if (!referenceId) return [];
      const { data, error } = await supabase
        .from("t_print_log")
        .select("*")
        .eq("reference_id", referenceId)
        .order("printed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrintLogEntry[];
    },
  });
}

/**
 * Bulk: dla listy reference_id zwraca mapę { reference_id -> ostatni printed_at }.
 * Używane na liście palet żeby pokazać kolumnę "Ostatni wydruk" bez N zapytań.
 */
export function useLastPrintForReferences(referenceIds: string[]) {
  const stableKey = [...referenceIds].sort().join(",");
  return useQuery({
    queryKey: ["print-history-batch", stableKey],
    enabled: referenceIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      if (referenceIds.length === 0) return {};
      const { data, error } = await supabase
        .from("t_print_log")
        .select("reference_id, printed_at")
        .in("reference_id", referenceIds)
        .order("printed_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { reference_id: string | null; printed_at: string }[]) {
        if (row.reference_id && !map[row.reference_id]) {
          map[row.reference_id] = row.printed_at;
        }
      }
      return map;
    },
  });
}
