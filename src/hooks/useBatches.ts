import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BatchStatus = "Released" | "Blocked" | "Quarantine";

export interface Batch {
  id: string;
  product_id: string;
  internal_batch_number: string;
  supplier_batch_number: string | null;
  supplier_id: string | null;
  location_id: string | null;
  production_date: string | null;
  expiration_date: string | null;
  reception_date: string;
  initial_quantity: number;
  current_quantity: number;
  status: BatchStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  product?: {
    name: string;
    sku: string | null;
    unit: string;
  };
  supplier?: {
    name: string;
  };
  location?: {
    name: string;
    location_type: string;
  };
}

export interface BatchFormData {
  product_id: string;
  internal_batch_number: string;
  supplier_batch_number?: string;
  supplier_id?: string;
  production_date?: string;
  expiration_date?: string;
  initial_quantity: number;
  current_quantity: number;
  status?: BatchStatus;
}

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("t_batches")
        .select(`
          *,
          product:t_products(name, sku, unit),
          supplier:t_contractors(name),
          location:t_storage_locations(name, location_type)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Batch[];
    },
  });
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: ["batches", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_batches")
        .select(`
          *,
          product:t_products(name, sku, unit),
          supplier:t_contractors(name),
          location:t_storage_locations(name, location_type)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Batch | null;
    },
    enabled: !!id,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: BatchFormData) => {
      const { data, error } = await supabase
        .from("t_batches")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast.success("Partia została dodana");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateBatchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BatchStatus }) => {
      const { data, error } = await supabase
        .from("t_batches")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      toast.success("Status partii został zaktualizowany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Helper to generate internal batch number
export function generateInternalBatchNumber(
  supplierId: string,
  productIndex: number
): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const dateStr = `${year}${month}${day}`;
  const supplierShort = supplierId.slice(0, 4).toUpperCase();
  return `${dateStr}/${supplierShort}/${productIndex.toString().padStart(3, "0")}`;
}