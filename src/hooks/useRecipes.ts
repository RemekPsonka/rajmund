import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Recipe {
  id: string;
  company_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  product?: { name: string; sku: string | null };
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  product_id: string;
  ratio: number;
  unit: string;
  created_at: string;
  // Joined
  product?: { name: string; sku: string | null; unit: string };
}

export interface RecipeFormData {
  company_id: string;
  product_id?: string;
  name: string;
  description?: string;
}

export interface RecipeIngredientFormData {
  recipe_id: string;
  product_id: string;
  ratio: number;
  unit?: string;
}

// Fetch recipes
export function useRecipes(companyId?: string) {
  return useQuery({
    queryKey: ["recipes", companyId],
    queryFn: async () => {
      let query = supabase
        .from("t_recipes")
        .select(`
          *,
          product:t_products(name, sku)
        `)
        .eq("is_active", true)
        .order("name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Recipe[];
    },
  });
}

// Fetch single recipe with ingredients
export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ["recipes", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("t_recipes")
        .select(`
          *,
          product:t_products(name, sku)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Recipe | null;
    },
    enabled: !!id,
  });
}

// Fetch recipe ingredients
export function useRecipeIngredients(recipeId: string | undefined) {
  return useQuery({
    queryKey: ["recipe-ingredients", recipeId],
    queryFn: async () => {
      if (!recipeId) return [];
      const { data, error } = await supabase
        .from("t_recipe_ingredients")
        .select(`
          *,
          product:t_products(name, sku, unit)
        `)
        .eq("recipe_id", recipeId)
        .order("created_at");

      if (error) throw error;
      return data as RecipeIngredient[];
    },
    enabled: !!recipeId,
  });
}

// Create recipe
export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RecipeFormData) => {
      const { data: result, error } = await supabase
        .from("t_recipes")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Utworzono recepturę");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Add ingredient to recipe
export function useAddRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RecipeIngredientFormData) => {
      const { error } = await supabase
        .from("t_recipe_ingredients")
        .insert(data);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recipe-ingredients", variables.recipe_id] });
      toast.success("Dodano składnik");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}

// Delete ingredient
export function useDeleteRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, recipeId }: { id: string; recipeId: string }) => {
      const { error } = await supabase
        .from("t_recipe_ingredients")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return recipeId;
    },
    onSuccess: (recipeId) => {
      queryClient.invalidateQueries({ queryKey: ["recipe-ingredients", recipeId] });
      toast.success("Usunięto składnik");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
