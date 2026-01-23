import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Contractor {
  id: string;
  company_id: string;
  name: string;
  tax_id: string | null;
  is_supplier: boolean;
  is_customer: boolean;
  is_logistics: boolean;
  vet_number: string | null;
  payment_term_days: number;
  contact_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContractorFormData {
  company_id: string;
  name: string;
  tax_id?: string;
  is_supplier?: boolean;
  is_customer?: boolean;
  is_logistics?: boolean;
  vet_number?: string;
  payment_term_days?: number;
}

export function useContractors(companyId?: string, options?: { suppliersOnly?: boolean }) {
  return useQuery({
    queryKey: ["contractors", companyId, options],
    queryFn: async () => {
      let query = supabase.from("t_contractors").select("*").order("name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      if (options?.suppliersOnly) {
        query = query.eq("is_supplier", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contractor[];
    },
  });
}

export function useContractor(id: string | undefined) {
  return useQuery({
    queryKey: ["contractors", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_contractors")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Contractor | null;
    },
    enabled: !!id,
  });
}

export function useCreateContractor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ContractorFormData) => {
      const { data, error } = await supabase
        .from("t_contractors")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast.success("Kontrahent został dodany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateContractor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: ContractorFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("t_contractors")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast.success("Kontrahent został zaktualizowany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}