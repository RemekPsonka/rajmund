import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LineageNode {
  lot_id: string;
  lot_code: string;
  depth: number;
  event_type: string;
  qty_kg: number;
  occurred_at: string;
  is_root?: boolean;
  is_pallet?: boolean;
  handling_unit_id?: string | null;
}

export interface LotLineage {
  ancestors: LineageNode[];
  descendants: LineageNode[];
}

export function useLotLineage(lotId: string | null) {
  return useQuery({
    queryKey: ["lot-lineage", lotId],
    queryFn: async (): Promise<LotLineage> => {
      if (!lotId) {
        return { ancestors: [], descendants: [] };
      }

      const { data, error } = await supabase.rpc(
        "get_lot_lineage" as never,
        { lot_id: lotId } as never,
      );

      if (error) throw error;

      const result = (data ?? {}) as Partial<LotLineage>;
      return {
        ancestors: result.ancestors ?? [],
        descendants: result.descendants ?? [],
      };
    },
    enabled: !!lotId,
  });
}
