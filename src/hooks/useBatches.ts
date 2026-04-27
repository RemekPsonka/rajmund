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

export function useBatches(options?: { availableOnly?: boolean; includeBlocked?: boolean }) {
  const availableOnly = options?.availableOnly ?? false;
  const includeBlocked = options?.includeBlocked ?? false;

  return useQuery({
    queryKey: ["batches", availableOnly, includeBlocked],
    queryFn: async () => {
      let query = supabase
        .from("t_batches")
        .select(`
          *,
          product:t_products(name, sku, unit),
          supplier:t_contractors(name),
          location:t_storage_locations(name, location_type)
        `)
        .order("created_at", { ascending: false });

      // Filter to only available batches (Released, qty > 0, not expired).
      // includeBlocked === true wyłącza filtrowanie (np. dla widoków diagnostycznych).
      if (availableOnly && !includeBlocked) {
        const today = new Date().toISOString().split('T')[0];
        query = query
          .eq("status", "Released")
          .gt("current_quantity", 0)
          .or(`expiration_date.is.null,expiration_date.gte.${today}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Batch[];
    },
  });
}

/**
 * Sprawdza czy partia może być użyta w produkcji.
 * Zwraca tekst PL z powodem odrzucenia albo null jeśli partia jest OK.
 */
export function getBatchRejectionReason(
  batch: Pick<Batch, "status" | "current_quantity" | "expiration_date">
): string | null {
  if (batch.status === "Blocked") {
    return "Partia ZABLOKOWANA — nie można użyć w produkcji";
  }
  if (batch.status === "Quarantine") {
    return "Partia w KWARANTANNIE — wymaga zwolnienia QC";
  }
  if (batch.expiration_date) {
    const expiry = new Date(batch.expiration_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) {
      const formatted = expiry.toLocaleDateString("pl-PL");
      return `Partia PRZETERMINOWANA — data ważności minęła ${formatted}`;
    }
  }
  if (batch.current_quantity <= 0) {
    return "Partia nie ma dostępnej ilości";
  }
  return null;
}

/**
 * Pobiera partię po internal_batch_number (case-insensitive) z dowolnym statusem.
 * Używane w terminalach do generowania właściwego komunikatu odrzucenia.
 */
export async function lookupBatchByCode(code: string): Promise<Batch | null> {
  const { data, error } = await supabase
    .from("t_batches")
    .select(`
      *,
      product:t_products(name, sku, unit),
      supplier:t_contractors(name),
      location:t_storage_locations(name, location_type)
    `)
    .ilike("internal_batch_number", code.trim())
    .maybeSingle();

  if (error) throw error;
  return (data as Batch | null) ?? null;
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