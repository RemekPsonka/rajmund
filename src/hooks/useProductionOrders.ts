import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProductionOrderType = "Decomposition" | "Processing" | "Packing";
export type ProductionOrderStatus = "Open" | "Closed" | "Cancelled";

export interface ProductionOrder {
  id: string;
  company_id: string;
  facility_id: string;
  order_number: string;
  type: ProductionOrderType;
  status: ProductionOrderStatus;
  production_date: string;
  supervisor_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  facility?: { name: string };
  company?: { name: string; short_name: string | null };
}

export interface ProductionInput {
  id: string;
  production_order_id: string;
  batch_id: string;
  product_id: string;
  weight: number;
  direction: string | null;
  created_by: string | null;
  created_at: string;
  // Joined
  batch?: { internal_batch_number: string };
  product?: { name: string; sku: string | null; unit: string };
}

export interface ProductionLog {
  id: string;
  production_order_id: string;
  employee_id: string | null;
  prepared_by_employee_id: string | null;
  product_id: string;
  source_batch_id: string | null;
  output_batch_id: string | null;
  weight_gross: number;
  weight_tare: number;
  weight_net: number;
  packaging_type: string;
  packaging_count: number;
  scale_device_id: string | null;
  created_at: string;
  // Joined
  weighing_employee?: { first_name: string; last_name: string };
  preparing_employee?: { first_name: string; last_name: string };
  product?: { name: string; sku: string | null; unit: string };
  source_batch?: { internal_batch_number: string };
  output_batch?: { internal_batch_number: string };
}

export interface ProductionOrderFormData {
  company_id: string;
  facility_id: string;
  order_number: string;
  type: ProductionOrderType;
  production_date?: string;
  notes?: string;
}

export interface ProductionInputFormData {
  production_order_id: string;
  batch_id: string;
  product_id: string;
  weight: number;
  direction?: string;
}

export interface ProductionLogFormData {
  production_order_id: string;
  employee_id?: string;
  prepared_by_employee_id?: string;
  product_id: string;
  source_batch_id?: string;
  weight_gross: number;
  weight_tare?: number;
  packaging_type?: string;
  packaging_count?: number;
  scale_device_id?: string;
}

// Fetch production orders
export function useProductionOrders(status?: ProductionOrderStatus) {
  return useQuery({
    queryKey: ["production-orders", status],
    queryFn: async () => {
      let query = supabase
        .from("t_production_orders")
        .select(`
          *,
          facility:t_facilities(name),
          company:t_companies(name, short_name)
        `)
        .order("production_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductionOrder[];
    },
  });
}

// Fetch single order with inputs and logs
export function useProductionOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["production-orders", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_production_orders")
        .select(`
          *,
          facility:t_facilities(name),
          company:t_companies(name, short_name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as ProductionOrder | null;
    },
    enabled: !!id,
  });
}

// Fetch inputs for an order
export function useProductionInputs(orderId: string | undefined) {
  return useQuery({
    queryKey: ["production-inputs", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("t_production_inputs")
        .select(`
          *,
          batch:t_batches(internal_batch_number),
          product:t_products(name, sku, unit)
        `)
        .eq("production_order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProductionInput[];
    },
    enabled: !!orderId,
  });
}

// Fetch logs for an order
export function useProductionLogs(orderId: string | undefined) {
  return useQuery({
    queryKey: ["production-logs", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("t_production_logs")
        .select(`
          *,
          weighing_employee:t_employees!t_production_logs_employee_id_fkey(first_name, last_name),
          preparing_employee:t_employees!t_production_logs_prepared_by_employee_id_fkey(first_name, last_name),
          product:t_products(name, sku, unit),
          source_batch:t_batches!t_production_logs_source_batch_id_fkey(internal_batch_number),
          output_batch:t_batches!t_production_logs_output_batch_id_fkey(internal_batch_number)
        `)
        .eq("production_order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProductionLog[];
    },
    enabled: !!orderId,
  });
}

// Create production order
export function useCreateProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ProductionOrderFormData) => {
      const { data, error } = await supabase
        .from("t_production_orders")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Zlecenie zostało utworzone");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Add input to order
export function useCreateProductionInput() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ProductionInputFormData) => {
      const { data, error } = await supabase
        .from("t_production_inputs")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-inputs", variables.production_order_id] });
      toast.success("Wsad został dodany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Create production log (weighing)
export function useCreateProductionLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ProductionLogFormData) => {
      const { data, error } = await supabase
        .from("t_production_logs")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-logs", variables.production_order_id] });
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Update order status
export function useUpdateProductionOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProductionOrderStatus }) => {
      const { data, error } = await supabase
        .from("t_production_orders")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Status zlecenia został zmieniony");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Close production order and create output batches
export function useCloseProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc("close_production_order_with_batches", {
        p_order_id: orderId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      
      const result = data as { success: boolean; created_batches: { batch_number: string; product_name: string; quantity: number }[] };
      if (result.created_batches && result.created_batches.length > 0) {
        toast.success(
          `Zlecenie zamknięte. Utworzono ${result.created_batches.length} partii wynikowych.`
        );
      } else {
        toast.success("Zlecenie zamknięte.");
      }
    },
    onError: (error: Error) => {
      toast.error(`Błąd zamykania zlecenia: ${error.message}`);
    },
  });
}

// Generate order number helper
export function generateOrderNumber(type: ProductionOrderType): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "/");
  const prefix = type === "Decomposition" ? "ROZ" : type === "Processing" ? "PRZ" : "PAK";
  const random = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${prefix}/${date}/${random}`;
}