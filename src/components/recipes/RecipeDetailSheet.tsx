import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Recipe, RecipeIngredient } from "@/hooks/useRecipes";
import { RecipeIngredientCalculator } from "./RecipeIngredientCalculator";

interface Product {
  id: string;
  name: string;
  unit?: string | null;
}

interface RecipeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  ingredients: RecipeIngredient[];
  products: Product[];
  onEdit: () => void;
  onAddIngredient: (data: {
    recipe_id: string;
    product_id: string;
    ratio: number;
    amount_per_kg_base?: number;
  }) => Promise<void>;
  onDeleteIngredient: (id: string) => Promise<void>;
  addPending: boolean;
}

export function RecipeDetailSheet({
  open,
  onOpenChange,
  recipe,
  ingredients,
  products,
  onEdit,
  onAddIngredient,
  onDeleteIngredient,
  addPending,
}: RecipeDetailSheetProps) {
  const [ingredientProductId, setIngredientProductId] = useState("");
  const [ingredientRatio, setIngredientRatio] = useState("1");
  const [ingredientAmountPerKg, setIngredientAmountPerKg] = useState("");

  const handleAddIngredient = async () => {
    if (!recipe || !ingredientProductId) {
      toast.error("Wybierz produkt");
      return;
    }

    const ratio = parseFloat(ingredientRatio);
    if (isNaN(ratio) || ratio <= 0) {
      toast.error("Podaj poprawny współczynnik");
      return;
    }

    const amountPerKg = ingredientAmountPerKg
      ? parseFloat(ingredientAmountPerKg)
      : undefined;

    try {
      await onAddIngredient({
        recipe_id: recipe.id,
        product_id: ingredientProductId,
        ratio,
        amount_per_kg_base: amountPerKg,
      });
      setIngredientProductId("");
      setIngredientRatio("1");
      setIngredientAmountPerKg("");
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!recipe) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between pr-8">
            <SheetTitle>{recipe.name}</SheetTitle>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edytuj
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Recipe Info */}
          <div className="grid grid-cols-2 gap-4">
            {recipe.base_product && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Produkt bazowy
                </Label>
                <p className="font-medium">{recipe.base_product.name}</p>
              </div>
            )}
            {recipe.product && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Produkt wyjściowy
                </Label>
                <p className="font-medium">{recipe.product.name}</p>
              </div>
            )}
            {recipe.target_yield_percent && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Uzysk docelowy
                </Label>
                <Badge variant="outline">{recipe.target_yield_percent}%</Badge>
              </div>
            )}
          </div>

          {recipe.description && (
            <div>
              <Label className="text-xs text-muted-foreground">Opis</Label>
              <p className="text-sm">{recipe.description}</p>
            </div>
          )}

          {recipe.process_instructions && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Instrukcje procesu
              </Label>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                {recipe.process_instructions}
              </p>
            </div>
          )}

          <Separator />

          {/* Ingredients */}
          <div className="space-y-4">
            <h4 className="font-semibold">Składniki</h4>

            {ingredients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkt</TableHead>
                    <TableHead className="text-right">Współcz.</TableHead>
                    <TableHead className="text-right">Na kg bazy</TableHead>
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
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {ing.amount_per_kg_base
                          ? `${ing.amount_per_kg_base.toFixed(4)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteIngredient(ing.id)}
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
              <div className="grid grid-cols-4 gap-2">
                <Select
                  value={ingredientProductId || "none"}
                  onValueChange={(v) =>
                    setIngredientProductId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger className="col-span-2">
                    <SelectValue placeholder="Wybierz produkt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Wybierz —</SelectItem>
                    {products.map((product) => (
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
                  placeholder="Wsp."
                  title="Współczynnik"
                />
                <Button
                  size="icon"
                  onClick={handleAddIngredient}
                  disabled={addPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                <Label className="text-xs whitespace-nowrap">Na kg bazy:</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={ingredientAmountPerKg}
                  onChange={(e) => setIngredientAmountPerKg(e.target.value)}
                  placeholder="np. 0.020 (20g/kg)"
                  className="max-w-[180px]"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Calculator */}
          <RecipeIngredientCalculator
            ingredients={ingredients}
            targetYieldPercent={recipe.target_yield_percent}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
