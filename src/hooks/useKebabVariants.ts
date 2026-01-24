import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const KEBAB_WEIGHT_VARIANTS = [5, 10, 15, 20, 25, 30] as const;
export type KebabWeightVariant = (typeof KEBAB_WEIGHT_VARIANTS)[number];

export interface KebabVariant {
  id: string;
  production_log_id: string;
  variant_name: string | null;
  variant_weight: number | null;
  quantity: number | null;
  total_weight: number | null;
  created_at: string;
}

export interface KebabVariantFormData {
  production_log_id: string;
  variant_name?: string;
  variant_weight: number;
  quantity: number;
  total_weight: number;
}

export function useKebabVariants(productionLogId?: string) {
  return useQuery({
    queryKey: ["kebab-variants", productionLogId],
    queryFn: async () => {
      if (!productionLogId) return [];
      
      const { data, error } = await supabase
        .from("t_production_kebab_variants")
        .select("*")
        .eq("production_log_id", productionLogId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as KebabVariant[];
    },
    enabled: !!productionLogId,
  });
}

export function useCreateKebabVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: KebabVariantFormData) => {
      const { data, error } = await supabase
        .from("t_production_kebab_variants")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kebab-variants", variables.production_log_id] });
      toast.success("Wariant kebaba zapisany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useCreateKebabVariants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variants: KebabVariantFormData[]) => {
      const { data, error } = await supabase
        .from("t_production_kebab_variants")
        .insert(variants)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kebab-variants"] });
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      toast.success("Warianty kebaba zapisane");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
