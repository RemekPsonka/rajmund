import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UnitOfMeasure {
  id: string;
  company_id: string;
  code: string;
  name: string;
  symbol: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitOfMeasureFormData {
  company_id: string;
  code: string;
  name: string;
  symbol: string;
  is_default?: boolean;
}

export function useUnitsOfMeasure(companyId?: string) {
  return useQuery({
    queryKey: ["units-of-measure", companyId],
    queryFn: async () => {
      let query = supabase
        .from("t_units_of_measure")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UnitOfMeasure[];
    },
  });
}

export function useCreateUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: UnitOfMeasureFormData) => {
      const { data, error } = await supabase
        .from("t_units_of_measure")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units-of-measure"] });
      toast.success("Jednostka miary została dodana");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: Partial<UnitOfMeasureFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("t_units_of_measure")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units-of-measure"] });
      toast.success("Jednostka miary została zaktualizowana");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeleteUnitOfMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("t_units_of_measure")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units-of-measure"] });
      toast.success("Jednostka miary została usunięta");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
