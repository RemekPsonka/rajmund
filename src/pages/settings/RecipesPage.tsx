import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Eye, FlaskConical, Trash2 } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { useProducts } from "@/hooks/useProducts";
import {
  useRecipes,
  useRecipe,
  useRecipeIngredients,
  useCreateRecipe,
  useAddRecipeIngredient,
  useDeleteRecipeIngredient,
  RecipeFormData,
} from "@/hooks/useRecipes";
import { toast } from "sonner";

export default function RecipesPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<RecipeFormData, "company_id">>({
    name: "",
    description: "",
    product_id: "",
  });

  // Ingredient form
  const [ingredientProductId, setIngredientProductId] = useState("");
  const [ingredientRatio, setIngredientRatio] = useState("1");

  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: recipes, isLoading: loadingRecipes } = useRecipes(selectedCompanyId || undefined);
  const { data: products } = useProducts();
  const { data: selectedRecipe } = useRecipe(selectedRecipeId || undefined);
  const { data: ingredients } = useRecipeIngredients(selectedRecipeId || undefined);
  
  const createRecipe = useCreateRecipe();
  const addIngredient = useAddRecipeIngredient();
  const deleteIngredient = useDeleteRecipeIngredient();

  const companyProducts = products?.filter((p) => p.company_id === selectedCompanyId);

  const handleOpenCreate = () => {
    setFormData({ name: "", description: "", product_id: "" });
    setDialogOpen(true);
  };

  const handleOpenDetail = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    setDetailSheetOpen(true);
  };

  const handleSubmitRecipe = async () => {
    if (!formData.name) {
      toast.error("Podaj nazwę receptury");
      return;
    }

    if (!selectedCompanyId) {
      toast.error("Wybierz spółkę");
      return;
    }

    try {
      await createRecipe.mutateAsync({
        company_id: selectedCompanyId,
        name: formData.name,
        description: formData.description || undefined,
        product_id: formData.product_id || undefined,
      });
      setDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleAddIngredient = async () => {
    if (!selectedRecipeId || !ingredientProductId) {
      toast.error("Wybierz produkt");
      return;
    }

    const ratio = parseFloat(ingredientRatio);
    if (isNaN(ratio) || ratio <= 0) {
      toast.error("Podaj poprawny współczynnik");
      return;
    }

    try {
      await addIngredient.mutateAsync({
        recipe_id: selectedRecipeId,
        product_id: ingredientProductId,
        ratio,
      });
      setIngredientProductId("");
      setIngredientRatio("1");
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!selectedRecipeId) return;
    try {
      await deleteIngredient.mutateAsync({ id, recipeId: selectedRecipeId });
    } catch (error) {
      // Error handled in hook
    }
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
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
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
                  <TableHead>Produkt wyjściowy</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead className="w-[80px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>
                      {recipe.product ? (
                        <Badge variant="outline">
                          {recipe.product.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[300px] truncate">
                      {recipe.description || "—"}
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

      {/* Create Recipe Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa receptura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nazwa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="np. Kebab classic"
              />
            </div>
            <div className="space-y-2">
              <Label>Produkt wyjściowy (opcjonalnie)</Label>
              <Select
                value={formData.product_id || "none"}
                onValueChange={(v) => setFormData({ ...formData, product_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz produkt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {companyProducts?.filter(p => !p.is_raw_material).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opis receptury..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSubmitRecipe} disabled={createRecipe.isPending}>
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipe Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedRecipe?.name || "Szczegóły receptury"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {selectedRecipe?.description && (
              <p className="text-muted-foreground">{selectedRecipe.description}</p>
            )}

            {selectedRecipe?.product && (
              <div>
                <Label className="text-xs text-muted-foreground">Produkt wyjściowy</Label>
                <p className="font-medium">{selectedRecipe.product.name}</p>
              </div>
            )}

            {/* Ingredients */}
            <div className="space-y-4">
              <h4 className="font-semibold">Składniki</h4>
              
              {ingredients?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right">Współczynnik</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.map((ing) => (
                      <TableRow key={ing.id}>
                        <TableCell>{ing.product?.name || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {ing.ratio.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteIngredient(ing.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">Brak składników</p>
              )}

              {/* Add Ingredient Form */}
              <div className="border-t pt-4 space-y-3">
                <Label>Dodaj składnik</Label>
                <div className="flex gap-2">
                  <Select value={ingredientProductId || "none"} onValueChange={(v) => setIngredientProductId(v === "none" ? "" : v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Wybierz produkt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Wybierz —</SelectItem>
                      {companyProducts?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ingredientRatio}
                    onChange={(e) => setIngredientRatio(e.target.value)}
                    className="w-24"
                    placeholder="Wsp."
                  />
                  <Button
                    size="icon"
                    onClick={handleAddIngredient}
                    disabled={addIngredient.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
