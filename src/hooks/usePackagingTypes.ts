import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PackagingType {
  id: string;
  company_id: string;
  code: string;
  name: string;
  tare_weight: number;
  is_returnable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackagingTypeFormData {
  company_id: string;
  code: string;
  name: string;
  tare_weight?: number;
  is_returnable?: boolean;
}

export function usePackagingTypes(companyId?: string, onlyReturnable?: boolean) {
  return useQuery({
    queryKey: ["packaging-types", companyId, onlyReturnable],
    queryFn: async () => {
      let query = supabase
        .from("t_packaging_types")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      if (onlyReturnable) {
        query = query.eq("is_returnable", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PackagingType[];
    },
  });
}

export function useCreatePackagingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: PackagingTypeFormData) => {
      const { data, error } = await supabase
        .from("t_packaging_types")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-types"] });
      toast.success("Typ opakowania został dodany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdatePackagingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: Partial<PackagingTypeFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("t_packaging_types")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-types"] });
      toast.success("Typ opakowania został zaktualizowany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeletePackagingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("t_packaging_types")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-types"] });
      toast.success("Typ opakowania został usunięty");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
