import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type HandlingUnitType = "Pallet" | "Container" | "Box";
export type HandlingUnitStatus = "Open" | "Closed" | "Shipped";

export interface HandlingUnit {
  id: string;
  company_id: string;
  facility_id: string;
  sscc_number: string;
  type: HandlingUnitType;
  status: HandlingUnitStatus;
  total_net_weight: number;
  total_gross_weight: number;
  items_count: number;
  label_printed: boolean;
  production_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  facility?: { name: string };
  company?: { name: string; short_name: string | null };
}

export interface HandlingUnitFormData {
  company_id: string;
  facility_id: string;
  type?: HandlingUnitType;
}

// Generate SSCC number
export function generateSSCC(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `00${year}${month}${day}${hour}${min}${random}`;
}

// Fetch handling units
export function useHandlingUnits(status?: HandlingUnitStatus, facilityId?: string) {
  return useQuery({
    queryKey: ["handling-units", status, facilityId],
    queryFn: async () => {
      let query = supabase
        .from("t_handling_units")
        .select(`
          *,
          facility:t_facilities(name),
          company:t_companies(name, short_name)
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }
      if (facilityId) {
        query = query.eq("facility_id", facilityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as HandlingUnit[];
    },
  });
}

// Fetch single handling unit
export function useHandlingUnit(id: string | undefined) {
  return useQuery({
    queryKey: ["handling-units", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_handling_units")
        .select(`
          *,
          facility:t_facilities(name),
          company:t_companies(name, short_name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as HandlingUnit | null;
    },
    enabled: !!id,
  });
}

// Create handling unit
export function useCreateHandlingUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: HandlingUnitFormData) => {
      const sscc = generateSSCC();
      const { data: result, error } = await supabase
        .from("t_handling_units")
        .insert({
          company_id: data.company_id,
          facility_id: data.facility_id,
          sscc_number: sscc,
          type: data.type || "Pallet",
          status: "Open",
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handling-units"] });
      toast.success("Utworzono nową paletę");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Update handling unit status
export function useUpdateHandlingUnitStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: HandlingUnitStatus }) => {
      const { error } = await supabase
        .from("t_handling_units")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handling-units"] });
      toast.success("Zaktualizowano status palety");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Mark label as printed
export function useMarkLabelPrinted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("t_handling_units")
        .update({ label_printed: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handling-units"] });
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Add production log to handling unit
export function useAssignLogToHandlingUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, handlingUnitId }: { logId: string; handlingUnitId: string }) => {
      const { error } = await supabase
        .from("t_production_logs")
        .update({ handling_unit_id: handlingUnitId })
        .eq("id", logId);

      if (error) throw error;
    },
    onSuccess: (_, { handlingUnitId }) => {
      queryClient.invalidateQueries({ queryKey: ["handling-units"] });
      queryClient.invalidateQueries({ queryKey: ["pallet-contents", handlingUnitId] });
      toast.success("Dodano do palety");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Get contents of a pallet
export function usePalletContents(palletId: string | undefined) {
  return useQuery({
    queryKey: ["pallet-contents", palletId],
    queryFn: async () => {
      if (!palletId) return [];
      const { data, error } = await supabase
        .from("t_production_logs")
        .select(`
          *,
          product:t_products(name, sku, unit),
          weighing_employee:t_employees!t_production_logs_employee_id_fkey(first_name, last_name),
          preparing_employee:t_employees!t_production_logs_prepared_by_employee_id_fkey(first_name, last_name),
          source_batch:t_batches!t_production_logs_source_batch_id_fkey(internal_batch_number),
          output_batch:t_batches!t_production_logs_output_batch_id_fkey(internal_batch_number)
        `)
        .eq("handling_unit_id", palletId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!palletId,
  });
}

// Get unassigned production logs (for adding to pallets)
export function useUnassignedProductionLogs(facilityId?: string) {
  return useQuery({
    queryKey: ["unassigned-logs", facilityId],
    queryFn: async () => {
      let query = supabase
        .from("t_production_logs")
        .select(`
          *,
          product:t_products(name, sku, unit, company_id),
          production_order:t_production_orders(facility_id, facility:t_facilities(name)),
          source_batch:t_batches!t_production_logs_source_batch_id_fkey(internal_batch_number)
        `)
        .is("handling_unit_id", null)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by facility if needed
      if (facilityId) {
        return data?.filter(log => log.production_order?.facility_id === facilityId) || [];
      }
      return data || [];
    },
  });
}
