import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProductionTask {
  id: string;
  production_order_id: string;
  name: string;
  sequence_number: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  // Joined
  employee?: { first_name: string; last_name: string };
}

export interface CreateTaskData {
  production_order_id: string;
  name: string;
  sequence_number?: number;
}

// Predefined tasks by production type
export const PREDEFINED_TASKS: Record<string, string[]> = {
  Decomposition: [
    "Kontrola temperatury surowca",
    "Rozbiór wstępny",
    "Rozbiór szczegółowy",
    "Pakowanie próżniowe",
    "Etykietowanie",
    "Kontrola jakości końcowa",
  ],
  Processing: [
    "Kontrola temperatury surowca",
    "Przygotowanie solanki/marynaty",
    "Masowanie/tumbling",
    "Pakowanie próżniowe",
    "Etykietowanie",
    "Kontrola jakości końcowa",
  ],
  Packing: [
    "Przygotowanie opakowań",
    "Pakowanie jednostkowe",
    "Pakowanie zbiorcze",
    "Etykietowanie",
    "Paletyzacja",
    "Kontrola jakości końcowa",
  ],
};

export function useProductionTasks(orderId: string | undefined) {
  return useQuery({
    queryKey: ["production-tasks", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from("t_production_tasks")
        .select(`
          *,
          employee:t_employees!completed_by(first_name, last_name)
        `)
        .eq("production_order_id", orderId)
        .order("sequence_number", { ascending: true });

      if (error) throw error;
      return data as ProductionTask[];
    },
    enabled: !!orderId,
  });
}

export function useCreateProductionTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: CreateTaskData[]) => {
      if (tasks.length === 0) return [];
      
      const { data, error } = await supabase
        .from("t_production_tasks")
        .insert(tasks.map((t, idx) => ({
          ...t,
          sequence_number: t.sequence_number ?? idx + 1,
        })))
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ["production-tasks", variables[0].production_order_id] 
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`Błąd tworzenia czynności: ${error.message}`);
    },
  });
}

export function useCompleteProductionTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      taskId, 
      isCompleted, 
      employeeId 
    }: { 
      taskId: string; 
      isCompleted: boolean; 
      employeeId?: string;
    }) => {
      const { data, error } = await supabase
        .from("t_production_tasks")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          completed_by: isCompleted ? employeeId : null,
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ["production-tasks", data.production_order_id] 
      });
      toast.success(data.is_completed ? "Czynność wykonana" : "Czynność odznaczona");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeleteProductionTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("t_production_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
    },
    onError: (error: Error) => {
      toast.error(`Błąd usuwania: ${error.message}`);
    },
  });
}
