import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WarehouseDocType = "PZ" | "WZ" | "MM" | "RW" | "PW";
export type DocumentStatus = "Draft" | "Approved" | "Cancelled";

export interface WarehouseMovement {
  id: string;
  company_id: string;
  document_number: string;
  type: WarehouseDocType;
  contractor_id: string | null;
  facility_id: string;
  external_doc_number: string | null;
  driver_name: string | null;
  car_plates: string | null;
  reception_temp: number | null;
  notes: string | null;
  status: DocumentStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contractor?: { name: string };
  facility?: { name: string };
  items?: WarehouseMovementItem[];
}

export interface WarehouseMovementItem {
  id: string;
  movement_id: string;
  product_id: string;
  batch_id: string | null;
  quantity: number;
  pallets_count: number;
  packaging_type: string | null;
  created_at: string;
  // Joined
  product?: { name: string; sku: string | null; unit: string };
  batch?: { internal_batch_number: string };
}

export interface MovementFormData {
  company_id: string;
  document_number: string;
  type: WarehouseDocType;
  contractor_id?: string;
  facility_id: string;
  external_doc_number?: string;
  driver_name?: string;
  car_plates?: string;
  reception_temp?: number;
  notes?: string;
}

export interface MovementItemFormData {
  movement_id: string;
  product_id: string;
  batch_id?: string;
  quantity: number;
  pallets_count?: number;
  packaging_type?: string;
}

export function useWarehouseMovements(type?: WarehouseDocType) {
  return useQuery({
    queryKey: ["warehouse-movements", type],
    queryFn: async () => {
      let query = supabase
        .from("t_warehouse_movements")
        .select(`
          *,
          contractor:t_contractors(name),
          facility:t_facilities(name)
        `)
        .order("created_at", { ascending: false });

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WarehouseMovement[];
    },
  });
}

export function useWarehouseMovement(id: string | undefined) {
  return useQuery({
    queryKey: ["warehouse-movements", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_warehouse_movements")
        .select(`
          *,
          contractor:t_contractors(name),
          facility:t_facilities(name),
          items:t_warehouse_movement_items(
            *,
            product:t_products(name, sku, unit),
            batch:t_batches(internal_batch_number)
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as WarehouseMovement | null;
    },
    enabled: !!id,
  });
}

export function useCreateWarehouseMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: MovementFormData) => {
      const { data, error } = await supabase
        .from("t_warehouse_movements")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-movements"] });
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useCreateMovementItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: MovementItemFormData) => {
      const { data, error } = await supabase
        .from("t_warehouse_movement_items")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-movements"] });
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useApproveMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("t_warehouse_movements")
        .update({ 
          status: "Approved" as DocumentStatus,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-movements"] });
      toast.success("Dokument został zatwierdzony");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Helper to generate document number
export function generateDocumentNumber(type: WarehouseDocType): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${type}/${year}/${month}/${random}`;
}