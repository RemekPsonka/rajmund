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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Pencil, Trash2, FlaskConical } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { useProducts } from "@/hooks/useProducts";
import {
  useRecipes,
  useRecipe,
  useRecipeIngredients,
  useSaveRecipeWithIngredients,
  useDeleteRecipe,
} from "@/hooks/useRecipes";
import { RecipeFormDialog } from "@/components/recipes/RecipeFormDialog";
import { RecipeDetailSheet } from "@/components/recipes/RecipeDetailSheet";

export default function RecipesPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: recipes, isLoading: loadingRecipes } = useRecipes(
    selectedCompanyId || undefined
  );
  const { data: products } = useProducts();
  const { data: selectedRecipe } = useRecipe(selectedRecipeId || undefined);
  const { data: ingredients } = useRecipeIngredients(
    selectedRecipeId || undefined
  );

  const saveRecipe = useSaveRecipeWithIngredients();
  const deleteRecipe = useDeleteRecipe();

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

  const handleOpenEdit = (recipeId?: string) => {
    if (recipeId) {
      setSelectedRecipeId(recipeId);
    }
    setEditMode(true);
    setDetailSheetOpen(false);
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (recipe: { id: string; name: string }) => {
    setRecipeToDelete(recipe);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (recipeToDelete) {
      deleteRecipe.mutate(recipeToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setRecipeToDelete(null);
        },
      });
    }
  };

  const handleFormSubmit = async (
    data: Parameters<typeof saveRecipe.mutateAsync>[0]['recipe'],
    ingredientsList: { product_id: string; amount_per_kg_base: number; unit: string }[]
  ) => {
    await saveRecipe.mutateAsync({
      recipe: data,
      ingredients: ingredientsList,
      existingRecipeId: editMode && selectedRecipeId ? selectedRecipeId : undefined,
    });
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
      {/* Header with title and company selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Receptury</h1>
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Spółka:</Label>
          <Select
            value={selectedCompanyId}
            onValueChange={setSelectedCompanyId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Wybierz spółkę" />
            </SelectTrigger>
            <SelectContent>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.short_name || company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Add Recipe Button */}
      {selectedCompanyId && (
        <Button onClick={handleOpenCreate} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Nowa receptura
        </Button>
      )}

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
            <EmptyState
              icon={FlaskConical}
              title={selectedCompanyId ? "Brak receptur" : "Wybierz spółkę"}
              description={
                selectedCompanyId
                  ? "Dodaj pierwszą recepturę, aby rozpocząć."
                  : "Wybierz spółkę z listy powyżej, aby zobaczyć receptury."
              }
              action={
                selectedCompanyId && (
                  <Button onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj recepturę
                  </Button>
                )
              }
            />
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
                          🥩 {recipe.base_product.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {recipe.product ? (
                        <Badge variant="outline">✅ {recipe.product.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {recipe.target_yield_percent != null ? (
                        recipe.target_yield_percent <= 0 ? (
                          <Badge variant="destructive" className="font-mono">
                            ⚠️ Błąd ({recipe.target_yield_percent}%)
                          </Badge>
                        ) : (
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            {recipe.target_yield_percent.toFixed(1)}%
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(recipe.id)}
                          title="Edytuj"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick({ id: recipe.id, name: recipe.name })}
                          title="Usuń"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
        existingIngredients={editMode ? ingredients : undefined}
        onSubmit={handleFormSubmit}
        isPending={saveRecipe.isPending}
      />

      {/* Detail Sheet */}
      <RecipeDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        recipe={selectedRecipe || null}
        ingredients={ingredients || []}
        products={companyProducts}
        onEdit={() => handleOpenEdit()}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć recepturę?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć recepturę <strong>{recipeToDelete?.name}</strong>?
              Ta operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
