import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ContractType = "B2B" | "UoP" | "Mandate" | "Other";

export interface Employee {
  id: string;
  company_id: string;
  facility_id: string | null;
  first_name: string;
  last_name: string;
  job_position: string;
  qr_login_code: string;
  pin_code_hash: string | null;
  is_active: boolean;
  contract_type: ContractType | null;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeFormData {
  company_id: string;
  facility_id?: string;
  first_name: string;
  last_name: string;
  job_position: string;
  qr_login_code: string;
  is_active?: boolean;
  contract_type?: ContractType;
  hourly_rate?: number;
}

export function useEmployees(facilityId?: string) {
  return useQuery({
    queryKey: ["employees", facilityId],
    queryFn: async () => {
      let query = supabase
        .from("t_employees")
        .select("*")
        .order("last_name")
        .order("first_name");

      if (facilityId && facilityId !== "all") {
        query = query.eq("facility_id", facilityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ["employees", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_employees")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: EmployeeFormData) => {
      const { data, error } = await supabase
        .from("t_employees")
        .insert(formData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Pracownik został dodany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: EmployeeFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("t_employees")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Dane pracownika zostały zaktualizowane");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("t_employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Pracownik został usunięty");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}