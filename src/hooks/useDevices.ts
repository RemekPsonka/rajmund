import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export type DeviceType = "SCALE" | "STATION";

export interface Device {
  id: string;
  company_id: string;
  facility_id: string | null;
  device_type: DeviceType;
  code: string;
  name: string;
  is_active: boolean;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceFormData {
  company_id: string;
  facility_id?: string;
  device_type: DeviceType;
  code: string;
  name: string;
  is_active?: boolean;
  metadata?: Json;
}

export function useDevices(facilityId?: string, deviceType?: DeviceType) {
  return useQuery({
    queryKey: ["devices", facilityId, deviceType],
    queryFn: async () => {
      let query = supabase
        .from("t_devices")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (facilityId) {
        query = query.eq("facility_id", facilityId);
      }

      if (deviceType) {
        query = query.eq("device_type", deviceType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Device[];
    },
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: DeviceFormData) => {
      const { data, error } = await supabase
        .from("t_devices")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Urządzenie zostało dodane");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: Partial<DeviceFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("t_devices")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Urządzenie zostało zaktualizowane");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
