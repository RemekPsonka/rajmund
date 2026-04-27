import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type IndustryCategory = 
  | 'RawMeat'       // Mięso Surowe
  | 'Spice'         // Przyprawy
  | 'Additive'      // Dodatki (woda, białko)
  | 'Packaging'     // Opakowania
  | 'Casing'        // Osłonki
  | 'Waste'         // Odpad
  | 'SemiFinished'  // Półprodukt (masowane mięso)
  | 'FinishedGood'; // Wyrób gotowy

export const INDUSTRY_CATEGORIES: { value: IndustryCategory; label: string; icon: string }[] = [
  { value: 'RawMeat', label: 'Mięso Surowe', icon: '🥩' },
  { value: 'Spice', label: 'Przyprawa', icon: '🧂' },
  { value: 'Additive', label: 'Dodatek (woda, białko)', icon: '💧' },
  { value: 'SemiFinished', label: 'Półprodukt', icon: '🔄' },
  { value: 'Packaging', label: 'Opakowanie', icon: '📦' },
  { value: 'Casing', label: 'Osłonka', icon: '🌭' },
  { value: 'Waste', label: 'Odpad', icon: '🗑️' },
  { value: 'FinishedGood', label: 'Wyrób Gotowy', icon: '✅' },
];

export interface Product {
  id: string;
  company_id: string;
  name: string;
  sku: string | null;
  subiekt_id: string | null;
  unit: string;
  is_raw_material: boolean;
  industry_category: IndustryCategory | null;
  default_expiration_days: number | null;
  min_storage_temp: number | null;
  max_storage_temp: number | null;
  unit_target_weight_kg: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  company_id: string;
  name: string;
  sku?: string;
  unit?: string;
  is_raw_material?: boolean;
  industry_category?: IndustryCategory;
  default_expiration_days?: number;
  min_storage_temp?: number;
  max_storage_temp?: number;
  unit_target_weight_kg?: number;
}

export function useProducts(companyId?: string, industryCategory?: IndustryCategory) {
  return useQuery({
    queryKey: ["products", companyId, industryCategory],
    queryFn: async () => {
      let query = supabase.from("t_products").select("*").order("name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      if (industryCategory) {
        query = query.eq("industry_category", industryCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["products", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_products")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ProductFormData) => {
      const { data, error } = await supabase
        .from("t_products")
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produkt został dodany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: ProductFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("t_products")
        .update(formData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produkt został zaktualizowany");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("t_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produkt został usunięty");
    },
    onError: (error: Error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}