import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProductionOrderType = "Decomposition" | "Processing" | "Packing" | "Assembly" | "Freezing";
export type ProductionOrderStatus = "Open" | "Closed" | "Cancelled";
export type ProcessStage = "Decomposition" | "Massaging" | "Stacking" | "ShockFreezing" | "Palletization";

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
  recipe_id: string | null;
  machine_id: string | null;
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
  process_stage?: string;
  freezing_started_at?: string;
  freezing_completed_at?: string;
  freezing_duration_minutes?: number;
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

// Add input to order and update batch quantity
export function useCreateProductionInput() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ProductionInputFormData) => {
      // 1. Insert the production input
      const { data, error } = await supabase
        .from("t_production_inputs")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;

      // 2. Update the batch's current_quantity (decrement by consumed weight)
      const { data: batch } = await supabase
        .from("t_batches")
        .select("current_quantity")
        .eq("id", formData.batch_id)
        .single();
      
      if (batch) {
        const newQuantity = Math.max(0, batch.current_quantity - formData.weight);
        await supabase
          .from("t_batches")
          .update({ current_quantity: newQuantity })
          .eq("id", formData.batch_id);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-inputs", variables.production_order_id] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
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
      queryClient.invalidateQueries({ queryKey: ["freezing-logs"] });
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Update production log (e.g. complete freezing)
export function useUpdateProductionLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, silent: _silent, ...data }: {
      id: string;
      freezing_completed_at?: string;
      freezing_duration_minutes?: number;
      latest_core_temp_c?: number | null;
      ccp_passed?: boolean | null;
      silent?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from("t_production_logs")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["freezing-logs"] });
      if (!variables.silent) {
        toast.success("Log produkcji zaktualizowany");
      }
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Fetch active freezing logs (process_stage = 'ShockFreezing' and not completed)
export function useFreezingLogs(facilityId?: string) {
  return useQuery({
    queryKey: ["freezing-logs", facilityId],
    queryFn: async () => {
      let query = supabase
        .from("t_production_logs")
        .select(`
          *,
          product:t_products(name, sku, unit),
          production_order:t_production_orders(facility_id, order_number),
          source_batch:t_batches!t_production_logs_source_batch_id_fkey(internal_batch_number)
        `)
        .eq("process_stage", "ShockFreezing")
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by facility if provided
      let result = data || [];
      if (facilityId) {
        result = result.filter((log: any) => log.production_order?.facility_id === facilityId);
      }
      
      return result;
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

// Generic update production order (for recipe_id, machine_id, etc.)
export function useUpdateProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; recipe_id?: string; machine_id?: string }) => {
      const { data: result, error } = await supabase
        .from("t_production_orders")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Zlecenie zostało zaktualizowane");
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
      const { data, error } = await supabase.rpc("close_production_order_with_lineage", {
        p_order_id: orderId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["lot-lineage"] });
      // Sprint 2: Kebab Assembly musi natychmiast widzieć nową partię tumblowaną
      queryClient.invalidateQueries({ queryKey: ["processing-output-batches"] });
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["production-inputs"] });

      const result = data as {
        success: boolean;
        batches_created?: Array<{
          batch_id: string;
          batch_number: string;
          product_id: string;
          qty_kg: number;
        }>;
        lineage_entries_created?: number;
      };
      const batches = result?.batches_created ?? [];
      if (batches.length > 0) {
        const summary = batches
          .map((b) => `${b.batch_number} (${Number(b.qty_kg).toFixed(1)} kg)`)
          .join(", ");
        toast.success(
          `Zlecenie zamknięte. Utworzono ${batches.length} ${batches.length === 1 ? "partię" : "partii"}: ${summary}`
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
  const prefixMap: Record<ProductionOrderType, string> = {
    Decomposition: "ROZ",
    Processing: "PRZ",
    Packing: "PAK",
    Assembly: "SKL",
    Freezing: "MRZ",
  };
  const prefix = prefixMap[type] || "PRD";
  const random = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${prefix}/${date}/${random}`;
}

// Order type labels in Polish
export const ORDER_TYPE_LABELS: Record<ProductionOrderType, string> = {
  Decomposition: "Rozbiór",
  Processing: "Przetwórstwo",
  Packing: "Pakowanie",
  Assembly: "Składanie Kebaba",
  Freezing: "Mrożenie",
};

// Fetch output batches from closed Processing orders (for Assembly terminal)
export interface ProcessingOutputBatch {
  id: string;
  output_batch_id: string;
  production_order: {
    id: string;
    order_number: string;
    type: string;
    status: string;
    facility_id: string;
    company_id: string;
  };
  output_batch: {
    id: string;
    internal_batch_number: string;
    current_quantity: number;
    status: string;
    product: {
      id: string;
      name: string;
    };
  };
}

export function useProcessingOutputBatches() {
  return useQuery({
    queryKey: ["processing-output-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("t_production_logs")
        .select(`
          id,
          output_batch_id,
          production_order:t_production_orders!inner(
            id, order_number, type, status, facility_id, company_id
          ),
          output_batch:t_batches!t_production_logs_output_batch_id_fkey(
            id, internal_batch_number, current_quantity, status,
            product:t_products(id, name)
          )
        `)
        .not("output_batch_id", "is", null)
        .eq("production_order.type", "Processing")
        .eq("production_order.status", "Closed");

      if (error) throw error;
      
      // Filter to only include batches with available quantity
      const validBatches = (data || []).filter(
        (item: any) => item.output_batch && item.output_batch.current_quantity > 0 && item.output_batch.status === "Released"
      );
      
      return validBatches as ProcessingOutputBatch[];
    },
  });
}