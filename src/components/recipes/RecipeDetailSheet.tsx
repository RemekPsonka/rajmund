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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";
import { Recipe, RecipeIngredient } from "@/hooks/useRecipes";
import { RecipeIngredientCalculator } from "./RecipeIngredientCalculator";
import { INDUSTRY_CATEGORIES, type Product } from "@/hooks/useProducts";

interface RecipeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  ingredients: RecipeIngredient[];
  products: Product[];
  onEdit: () => void;
}

export function RecipeDetailSheet({
  open,
  onOpenChange,
  recipe,
  ingredients,
  onEdit,
}: RecipeDetailSheetProps) {
  if (!recipe) return null;

  const getCategoryIcon = (productId: string) => {
    const cat = INDUSTRY_CATEGORIES.find(c => 
      ingredients.find(i => i.product_id === productId)
    );
    return cat?.icon || '📦';
  };

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
                <Label className="text-xs text-muted-foreground">Surowiec bazowy</Label>
                <p className="font-medium">🥩 {recipe.base_product.name}</p>
              </div>
            )}
            {recipe.product && (
              <div>
                <Label className="text-xs text-muted-foreground">Produkt wyjściowy</Label>
                <p className="font-medium">✅ {recipe.product.name}</p>
              </div>
            )}
            {recipe.target_yield_percent && (
              <div>
                <Label className="text-xs text-muted-foreground">Uzysk docelowy</Label>
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
              <Label className="text-xs text-muted-foreground">Instrukcje procesu</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                {recipe.process_instructions}
              </p>
            </div>
          )}

          <Separator />

          {/* Ingredients */}
          <div className="space-y-4">
            <h4 className="font-semibold">Składniki ({ingredients.length})</h4>

            {ingredients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Składnik</TableHead>
                    <TableHead className="text-right">Na kg bazy</TableHead>
                    <TableHead className="text-right">Na 100 kg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">
                        {ing.product?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(ing.amount_per_kg_base || ing.ratio).toFixed(3)} {ing.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {((ing.amount_per_kg_base || ing.ratio) * 100).toFixed(1)} {ing.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">Brak składników</p>
            )}
          </div>

          <Separator />

          {/* Calculator */}
          <RecipeIngredientCalculator
            ingredients={ingredients}
            targetYieldPercent={recipe.target_yield_percent}
            baseProductName={recipe.base_product?.name}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
