import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TaskTemplate {
  id: string;
  company_id: string;
  production_type: string;
  name: string;
  sequence_number: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateFormData {
  company_id: string;
  production_type: string;
  name: string;
  sequence_number?: number;
}

export function useTaskTemplates(companyId?: string, productionType?: string) {
  return useQuery({
    queryKey: ["task-templates", companyId, productionType],
    queryFn: async () => {
      let query = supabase
        .from("t_task_templates")
        .select("*")
        .eq("is_active", true)
        .order("sequence_number");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      if (productionType) {
        query = query.eq("production_type", productionType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TaskTemplate[];
    },
  });
}

export function useCreateTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: TaskTemplateFormData) => {
      const { data, error } = await supabase
        .from("t_task_templates")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Szablon czynności został dodany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: Partial<TaskTemplateFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("t_task_templates")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Szablon czynności został zaktualizowany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("t_task_templates")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Szablon czynności został usunięty");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
