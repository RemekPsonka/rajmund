import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FreezingTempReading {
  id: string;
  recorded_at: string;
  core_temp_c: number;
  ambient_temp_c: number | null;
  source: "manual" | "auto";
}

/**
 * Strumień pomiarów temperatury dla pojedynczej sesji mrożenia.
 * - Pobiera historię z t_freezing_temp_log (chronologicznie).
 * - Subskrybuje Realtime channel na INSERT-y dla danego production_log_id
 *   i invaliduje cache, żeby UI/wykres odświeżał się natychmiast.
 */
export function useFreezingTempStream(productionLogId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["freezing-temp", productionLogId],
    enabled: !!productionLogId,
    queryFn: async (): Promise<FreezingTempReading[]> => {
      if (!productionLogId) return [];
      const { data, error } = await supabase
        .from("t_freezing_temp_log")
        .select("id, recorded_at, core_temp_c, ambient_temp_c, source")
        .eq("production_log_id", productionLogId)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FreezingTempReading[];
    },
  });

  useEffect(() => {
    if (!productionLogId) return;
    const channel = supabase
      .channel(`freezing_temp:${productionLogId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "t_freezing_temp_log",
          filter: `production_log_id=eq.${productionLogId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["freezing-temp", productionLogId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productionLogId, queryClient]);

  return {
    readings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
