import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ShipmentStatus = "Planning" | "Loading" | "Shipped" | "Delivered";

export interface Shipment {
  id: string;
  company_id: string;
  facility_id: string;
  shipment_number: string;
  status: ShipmentStatus;
  customer_id: string | null;
  destination_address_json: Record<string, unknown>;
  carrier_id: string | null;
  driver_name: string | null;
  truck_plates: string | null;
  trailer_plates: string | null;
  transport_temperature: number | null;
  seal_number: string | null;
  linked_invoice_number: string | null;
  dispatch_date: string;
  delivered_date: string | null;
  total_net_weight: number;
  total_gross_weight: number;
  pallets_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customer?: { name: string; vet_number: string | null };
  carrier?: { name: string };
  facility?: { name: string; vet_approval_number: string | null };
  company?: { name: string; short_name: string | null; tax_id: string; main_address_json: Record<string, unknown> | null };
}

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  handling_unit_id: string | null;
  batch_id: string | null;
  product_id: string | null;
  quantity: number | null;
  verified_weight: number | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  // Joined
  handling_unit?: {
    sscc_number: string;
    total_net_weight: number;
    total_gross_weight: number;
    items_count: number;
  };
  batch?: { internal_batch_number: string };
  product?: { name: string; sku: string | null };
}

export interface PackagingTransaction {
  id: string;
  company_id: string;
  shipment_id: string | null;
  contractor_id: string;
  type: "Issued" | "Received";
  packaging_type: string;
  quantity: number;
  transaction_date: string;
  comments: string | null;
  created_by: string | null;
  created_at: string;
  // Joined
  contractor?: { name: string };
}

export interface ShipmentFormData {
  company_id: string;
  facility_id: string;
  customer_id?: string;
  carrier_id?: string;
  driver_name?: string;
  truck_plates?: string;
  trailer_plates?: string;
  transport_temperature?: number;
  seal_number?: string;
  dispatch_date?: string;
  destination_address_json?: Record<string, unknown>;
}

// Generate shipment number
export function generateShipmentNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `WZ/${year}/${month}/${random}`;
}

// Fetch shipments
export function useShipments(status?: ShipmentStatus, facilityId?: string) {
  return useQuery({
    queryKey: ["shipments", status, facilityId],
    queryFn: async () => {
      let query = supabase
        .from("t_shipments")
        .select(`
          *,
          customer:t_contractors!t_shipments_customer_id_fkey(name, vet_number),
          carrier:t_contractors!t_shipments_carrier_id_fkey(name),
          facility:t_facilities(name, vet_approval_number),
          company:t_companies(name, short_name, tax_id)
        `)
        .order("dispatch_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }
      if (facilityId) {
        query = query.eq("facility_id", facilityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Shipment[];
    },
  });
}

// Fetch single shipment
export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: ["shipments", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_shipments")
        .select(`
          *,
          customer:t_contractors!t_shipments_customer_id_fkey(name, vet_number),
          carrier:t_contractors!t_shipments_carrier_id_fkey(name),
          facility:t_facilities(name, vet_approval_number),
          company:t_companies(name, short_name, tax_id, main_address_json)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Shipment | null;
    },
    enabled: !!id,
  });
}

// Fetch shipment items with deep joins for HDI
export function useShipmentItems(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["shipment-items", shipmentId],
    queryFn: async () => {
      if (!shipmentId) return [];
      const { data, error } = await supabase
        .from("t_shipment_items")
        .select(`
          *,
          handling_unit:t_handling_units(sscc_number, total_net_weight, total_gross_weight, items_count),
          batch:t_batches(internal_batch_number),
          product:t_products(name, sku)
        `)
        .eq("shipment_id", shipmentId)
        .order("created_at");

      if (error) throw error;
      return data as ShipmentItem[];
    },
    enabled: !!shipmentId,
  });
}

// Fetch production logs for pallets (for HDI traceability)
export function useShipmentTraceability(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["shipment-traceability", shipmentId],
    queryFn: async () => {
      if (!shipmentId) return [];
      
      // Get all handling units in this shipment
      const { data: items } = await supabase
        .from("t_shipment_items")
        .select("handling_unit_id")
        .eq("shipment_id", shipmentId)
        .not("handling_unit_id", "is", null);
      
      if (!items || items.length === 0) return [];
      
      const handlingUnitIds = items.map(i => i.handling_unit_id).filter(Boolean);
      
      // Get all production logs for these pallets with batch info
      const { data: logs, error } = await supabase
        .from("t_production_logs")
        .select(`
          *,
          product:t_products(name, sku),
          source_batch:t_batches!t_production_logs_source_batch_id_fkey(
            internal_batch_number,
            production_date,
            expiration_date,
            supplier_batch_number
          ),
          output_batch:t_batches!t_production_logs_output_batch_id_fkey(
            internal_batch_number
          ),
          handling_unit:t_handling_units(sscc_number)
        `)
        .in("handling_unit_id", handlingUnitIds)
        .order("created_at");

      if (error) throw error;
      return logs || [];
    },
    enabled: !!shipmentId,
  });
}

// Fetch packaging transactions for a shipment
export function usePackagingTransactions(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["packaging-transactions", shipmentId],
    queryFn: async () => {
      if (!shipmentId) return [];
      const { data, error } = await supabase
        .from("t_packaging_transactions")
        .select(`
          *,
          contractor:t_contractors(name)
        `)
        .eq("shipment_id", shipmentId)
        .order("created_at");

      if (error) throw error;
      return data as PackagingTransaction[];
    },
    enabled: !!shipmentId,
  });
}

// Create shipment
export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ShipmentFormData) => {
      const shipmentNumber = generateShipmentNumber();
      const insertData = {
        company_id: data.company_id,
        facility_id: data.facility_id,
        customer_id: data.customer_id || null,
        carrier_id: data.carrier_id || null,
        driver_name: data.driver_name || null,
        truck_plates: data.truck_plates || null,
        trailer_plates: data.trailer_plates || null,
        transport_temperature: data.transport_temperature || null,
        seal_number: data.seal_number || null,
        dispatch_date: data.dispatch_date || new Date().toISOString().slice(0, 10),
        destination_address_json: data.destination_address_json || {},
        shipment_number: shipmentNumber,
        status: "Planning",
      };

      const { data: result, error } = await supabase
        .from("t_shipments")
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      toast.success("Utworzono wysyłkę");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Update shipment
export function useUpdateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, driver_name, truck_plates, trailer_plates, transport_temperature, seal_number, linked_invoice_number }: {
      id: string;
      status?: ShipmentStatus;
      driver_name?: string;
      truck_plates?: string;
      trailer_plates?: string;
      transport_temperature?: number;
      seal_number?: string;
      linked_invoice_number?: string;
    }) => {
      // Walidacja palet przy zmianie statusu na Shipped
      if (status === "Shipped") {
        const { data: items, error: itemsError } = await supabase
          .from("t_shipment_items")
          .select("handling_unit:t_handling_units(id, sscc_number, status, label_printed)")
          .eq("shipment_id", id);

        if (itemsError) throw itemsError;

        const errors: string[] = [];
        for (const item of items ?? []) {
          const hu = (item as any).handling_unit;
          if (!hu) continue;
          if (!hu.sscc_number) {
            errors.push(`• Paleta bez SSCC (id: ${hu.id?.slice(0, 8)}…)`);
          }
          if (hu.status !== "Closed") {
            errors.push(`• Paleta ${hu.sscc_number ?? "(brak SSCC)"}: status=${hu.status} (oczekiwane: Closed)`);
          }
          if (!hu.label_printed) {
            console.warn(`Paleta ${hu.sscc_number}: brak wydrukowanej etykiety`);
          }
        }

        if (errors.length > 0) {
          throw new Error(`Wysyłka niekompletna:\n${errors.join("\n")}`);
        }
      }

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (status !== undefined) updateData.status = status;
      if (driver_name !== undefined) updateData.driver_name = driver_name;
      if (truck_plates !== undefined) updateData.truck_plates = truck_plates;
      if (trailer_plates !== undefined) updateData.trailer_plates = trailer_plates;
      if (transport_temperature !== undefined) updateData.transport_temperature = transport_temperature;
      if (seal_number !== undefined) updateData.seal_number = seal_number;
      if (linked_invoice_number !== undefined) updateData.linked_invoice_number = linked_invoice_number;

      const { error } = await supabase
        .from("t_shipments")
        .update(updateData as never)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      toast.success("Zaktualizowano wysyłkę");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Add item to shipment (pallet or batch)
export function useAddShipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      shipment_id: string;
      handling_unit_id?: string;
      batch_id?: string;
      product_id?: string;
      quantity?: number;
    }) => {
      const { error } = await supabase
        .from("t_shipment_items")
        .insert(data);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-items", variables.shipment_id] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["available-pallets"] });
      toast.success("Dodano do wysyłki");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Remove item from shipment
export function useRemoveShipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shipmentId }: { id: string; shipmentId: string }) => {
      const { error } = await supabase
        .from("t_shipment_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return shipmentId;
    },
    onSuccess: (shipmentId) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-items", shipmentId] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["available-pallets"] });
      toast.success("Usunięto z wysyłki");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Add packaging transaction
export function useAddPackagingTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      company_id: string;
      shipment_id: string;
      contractor_id: string;
      type: "Issued" | "Received";
      packaging_type: string;
      quantity: number;
      comments?: string;
    }) => {
      const { error } = await supabase
        .from("t_packaging_transactions")
        .insert(data);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["packaging-transactions", variables.shipment_id] });
      toast.success("Zapisano opakowania");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Get available pallets for loading
export function useAvailablePallets(facilityId?: string) {
  return useQuery({
    queryKey: ["available-pallets", facilityId],
    queryFn: async () => {
      let query = supabase
        .from("t_handling_units")
        .select(`
          *,
          facility:t_facilities(name)
        `)
        .eq("status", "Closed")
        .order("created_at", { ascending: false });

      if (facilityId) {
        query = query.eq("facility_id", facilityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Find pallet by SSCC (for scanning)
export function useFindPalletBySSCC() {
  return useMutation({
    mutationFn: async (sscc: string) => {
      const { data, error } = await supabase
        .from("t_handling_units")
        .select("*")
        .eq("sscc_number", sscc)
        .eq("status", "Closed")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Nie znaleziono palety o podanym SSCC");
      return data;
    },
  });
}

// Verify item weight
export function useVerifyItemWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, shipmentId, verifiedWeight }: {
      itemId: string;
      shipmentId: string;
      verifiedWeight: number;
    }) => {
      const { error } = await supabase
        .from("t_shipment_items")
        .update({
          verified_weight: verifiedWeight,
          verified_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;
      return shipmentId;
    },
    onSuccess: (shipmentId) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-items", shipmentId] });
      toast.success("Zweryfikowano wagę");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
