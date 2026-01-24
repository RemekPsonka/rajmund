import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Eye, FlaskConical } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { useProducts } from "@/hooks/useProducts";
import {
  useRecipes,
  useRecipe,
  useRecipeIngredients,
  useCreateRecipe,
  useUpdateRecipe,
  useAddRecipeIngredient,
  useDeleteRecipeIngredient,
} from "@/hooks/useRecipes";
import { RecipeFormDialog } from "@/components/recipes/RecipeFormDialog";
import { RecipeDetailSheet } from "@/components/recipes/RecipeDetailSheet";

export default function RecipesPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: recipes, isLoading: loadingRecipes } = useRecipes(
    selectedCompanyId || undefined
  );
  const { data: products } = useProducts();
  const { data: selectedRecipe } = useRecipe(selectedRecipeId || undefined);
  const { data: ingredients } = useRecipeIngredients(
    selectedRecipeId || undefined
  );

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const addIngredient = useAddRecipeIngredient();
  const deleteIngredient = useDeleteRecipeIngredient();

  const companyProducts =
    products?.filter((p) => p.company_id === selectedCompanyId) || [];

  const handleOpenCreate = () => {
    setSelectedRecipeId(null);
    setEditMode(false);
    setFormDialogOpen(true);
  };

  const handleOpenDetail = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    setDetailSheetOpen(true);
  };

  const handleOpenEdit = () => {
    setEditMode(true);
    setDetailSheetOpen(false);
    setFormDialogOpen(true);
  };

  const handleFormSubmit = async (data: Parameters<typeof createRecipe.mutateAsync>[0]) => {
    if (editMode && selectedRecipeId) {
      await updateRecipe.mutateAsync({ id: selectedRecipeId, ...data });
    } else {
      await createRecipe.mutateAsync(data);
    }
  };

  const handleAddIngredient = async (data: {
    recipe_id: string;
    product_id: string;
    ratio: number;
    amount_per_kg_base?: number;
  }) => {
    await addIngredient.mutateAsync(data);
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!selectedRecipeId) return;
    await deleteIngredient.mutateAsync({ id, recipeId: selectedRecipeId });
  };

  if (loadingCompanies) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Receptury</h1>
        <Button onClick={handleOpenCreate} disabled={!selectedCompanyId}>
          <Plus className="h-4 w-4 mr-2" />
          Nowa receptura
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 max-w-sm">
            <Label>Spółka</Label>
            <Select
              value={selectedCompanyId}
              onValueChange={setSelectedCompanyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz spółkę" />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Recipes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Lista receptur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecipes ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !recipes?.length ? (
            <p className="text-muted-foreground text-center py-8">
              {selectedCompanyId
                ? "Brak receptur. Dodaj pierwszą recepturę."
                : "Wybierz spółkę, aby zobaczyć receptury."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Produkt bazowy</TableHead>
                  <TableHead>Produkt wyjściowy</TableHead>
                  <TableHead className="text-right">Uzysk</TableHead>
                  <TableHead className="w-[80px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>
                      {recipe.base_product ? (
                        <Badge variant="secondary">
                          {recipe.base_product.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {recipe.product ? (
                        <Badge variant="outline">{recipe.product.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {recipe.target_yield_percent
                        ? `${recipe.target_yield_percent}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDetail(recipe.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog (Create/Edit) */}
      <RecipeFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        companyId={selectedCompanyId}
        products={companyProducts}
        recipe={editMode ? selectedRecipe : null}
        onSubmit={handleFormSubmit}
        isPending={createRecipe.isPending || updateRecipe.isPending}
      />

      {/* Detail Sheet */}
      <RecipeDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        recipe={selectedRecipe || null}
        ingredients={ingredients || []}
        products={companyProducts}
        onEdit={handleOpenEdit}
        onAddIngredient={handleAddIngredient}
        onDeleteIngredient={handleDeleteIngredient}
        addPending={addIngredient.isPending}
      />
    </div>
  );
}
