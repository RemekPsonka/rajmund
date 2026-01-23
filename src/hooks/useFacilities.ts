import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FacilityType = "Plant" | "Warehouse" | "Office" | "Store";

export interface Facility {
  id: string;
  company_id: string;
  name: string;
  type: FacilityType;
  vet_approval_number: string | null;
  geo_coordinates: { lat: number; lng: number } | null;
  created_at: string;
  updated_at: string;
}

export interface FacilityFormData {
  company_id: string;
  name: string;
  type: FacilityType;
  vet_approval_number?: string;
  geo_coordinates?: { lat: number; lng: number };
}

export function useFacilities(companyId?: string) {
  return useQuery({
    queryKey: ["facilities", companyId],
    queryFn: async () => {
      let query = supabase.from("t_facilities").select("*").order("name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Facility[];
    },
  });
}

export function useFacility(id: string | undefined) {
  return useQuery({
    queryKey: ["facilities", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_facilities")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Facility | null;
    },
    enabled: !!id,
  });
}

export function useCreateFacility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FacilityFormData) => {
      const { data, error } = await supabase
        .from("t_facilities")
        .insert(formData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      queryClient.invalidateQueries({ queryKey: ["facilities", variables.company_id] });
      toast.success("Zakład został dodany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateFacility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: FacilityFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("t_facilities")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      toast.success("Zakład został zaktualizowany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeleteFacility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("t_facilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      toast.success("Zakład został usunięty");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}