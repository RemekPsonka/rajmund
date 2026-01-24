import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Recipe {
  id: string;
  company_id: string;
  product_id: string | null;
  base_product_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  target_yield_percent: number | null;
  evaporation_percent: number | null;
  process_instructions: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  product?: { name: string; sku: string | null } | null;
  base_product?: { name: string; sku: string | null } | null;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  product_id: string;
  ratio: number;
  unit: string;
  amount_per_kg_base: number | null;
  created_at: string;
  // Joined
  product?: { name: string; sku: string | null; unit: string };
}

export interface RecipeFormData {
  company_id: string;
  product_id?: string;
  base_product_id?: string;
  name: string;
  description?: string;
  target_yield_percent?: number;
  evaporation_percent?: number;
  process_instructions?: string;
}

export interface RecipeIngredientFormData {
  recipe_id: string;
  product_id: string;
  ratio: number;
  unit?: string;
  amount_per_kg_base?: number;
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
          product:t_products!product_id(name, sku),
          base_product:t_products!base_product_id(name, sku)
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
          product:t_products!product_id(name, sku),
          base_product:t_products!base_product_id(name, sku)
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
          product:t_products(name, sku, unit, industry_category)
        `)
        .eq("recipe_id", recipeId)
        .order("created_at");

      if (error) throw error;
      return data as RecipeIngredient[];
    },
    enabled: !!recipeId,
  });
}

// Save recipe with ingredients (create or update)
export function useSaveRecipeWithIngredients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipe,
      ingredients,
      existingRecipeId,
    }: {
      recipe: RecipeFormData;
      ingredients: { product_id: string; amount_per_kg_base: number; unit: string }[];
      existingRecipeId?: string;
    }) => {
      let recipeId = existingRecipeId;

      // Create or update recipe
      if (existingRecipeId) {
        const { error } = await supabase
          .from("t_recipes")
          .update(recipe)
          .eq("id", existingRecipeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("t_recipes")
          .insert(recipe)
          .select()
          .single();
        if (error) throw error;
        recipeId = data.id;
      }

      // Delete existing ingredients if updating
      if (existingRecipeId) {
        const { error } = await supabase
          .from("t_recipe_ingredients")
          .delete()
          .eq("recipe_id", existingRecipeId);
        if (error) throw error;
      }

      // Insert new ingredients
      if (ingredients.length > 0 && recipeId) {
        const ingredientData = ingredients.map((ing) => ({
          recipe_id: recipeId,
          product_id: ing.product_id,
          ratio: ing.amount_per_kg_base, // Keep ratio for backwards compatibility
          amount_per_kg_base: ing.amount_per_kg_base,
          unit: ing.unit,
        }));

        const { error } = await supabase
          .from("t_recipe_ingredients")
          .insert(ingredientData);
        if (error) throw error;
      }

      return recipeId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipe-ingredients"] });
      toast.success("Zapisano recepturę");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
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

// Update recipe
export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<RecipeFormData>) => {
      const { data: result, error } = await supabase
        .from("t_recipes")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Zaktualizowano recepturę");
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

// Delete recipe (soft delete - set is_active = false)
export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("t_recipes")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Usunięto recepturę");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });
}
