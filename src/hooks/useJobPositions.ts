import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JobPosition {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobPositionFormData {
  company_id: string;
  name: string;
  description?: string;
  department?: string;
  is_active?: boolean;
}

export function useJobPositions(companyId?: string) {
  return useQuery({
    queryKey: ["job-positions", companyId],
    queryFn: async () => {
      let query = supabase
        .from("t_job_positions")
        .select("*")
        .order("department")
        .order("name");

      if (companyId && companyId !== "all") {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobPosition[];
    },
  });
}

export function useJobPosition(id: string | undefined) {
  return useQuery({
    queryKey: ["job-positions", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_job_positions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as JobPosition | null;
    },
    enabled: !!id,
  });
}

export function useCreateJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: JobPositionFormData) => {
      const { data, error } = await supabase
        .from("t_job_positions")
        .insert(formData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      toast.success("Stanowisko zostało dodane");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: JobPositionFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("t_job_positions")
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      toast.success("Stanowisko zostało zaktualizowane");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeleteJobPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("t_job_positions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-positions"] });
      toast.success("Stanowisko zostało usunięte");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
