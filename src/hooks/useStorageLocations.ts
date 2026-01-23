import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LocationType = "chiller" | "freezer" | "shock" | "production" | "storage";

export interface StorageLocation {
  id: string;
  facility_id: string;
  name: string;
  location_type: LocationType;
  min_temp: number | null;
  max_temp: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorageLocationFormData {
  facility_id: string;
  name: string;
  location_type: LocationType;
  min_temp?: number;
  max_temp?: number;
  is_active?: boolean;
}

export function useStorageLocations(facilityId?: string) {
  return useQuery({
    queryKey: ["storage-locations", facilityId],
    queryFn: async () => {
      let query = supabase
        .from("t_storage_locations")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (facilityId) {
        query = query.eq("facility_id", facilityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StorageLocation[];
    },
  });
}

export function useStorageLocation(id: string | undefined) {
  return useQuery({
    queryKey: ["storage-locations", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_storage_locations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as StorageLocation | null;
    },
    enabled: !!id,
  });
}

export function useCreateStorageLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: StorageLocationFormData) => {
      const { data, error } = await supabase
        .from("t_storage_locations")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["storage-locations"] });
      queryClient.invalidateQueries({ queryKey: ["storage-locations", variables.facility_id] });
      toast.success("Lokalizacja została dodana");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateStorageLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: { id: string } & Partial<StorageLocationFormData>) => {
      const { data, error } = await supabase
        .from("t_storage_locations")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-locations"] });
      toast.success("Lokalizacja została zaktualizowana");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Helper to get location type label in Polish
export function getLocationTypeLabel(type: LocationType): string {
  const labels: Record<LocationType, string> = {
    chiller: "Chłodnia",
    freezer: "Mroźnia",
    shock: "Szok (-40°C)",
    production: "Produkcja",
    storage: "Magazyn",
  };
  return labels[type] || type;
}

// Processing directions for production inputs
export const PROCESSING_DIRECTIONS = [
  { value: "SWIEZE", label: "Świeże (ścieżka A)" },
  { value: "MROZNIA", label: "Mroźnia (ścieżka B)" },
  { value: "KEBAB", label: "Kebab masowanie (ścieżka C)" },
] as const;

export type ProcessingDirection = typeof PROCESSING_DIRECTIONS[number]["value"];
