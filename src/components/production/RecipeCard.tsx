import { useMemo } from "react";
import { FileText, Check, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Recipe, RecipeIngredient } from "@/hooks/useRecipes";
import { INDUSTRY_CATEGORIES } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  inputWeight: number; // kg of base material from input
  className?: string;
}

export function RecipeCard({ recipe, ingredients, inputWeight, className }: RecipeCardProps) {
  // Calculate required amounts for each ingredient
  const calculatedIngredients = useMemo(() => {
    return ingredients.map((ing) => {
      const requiredAmount = inputWeight * (ing.amount_per_kg_base || ing.ratio);
      return {
        ...ing,
        requiredAmount,
      };
    });
  }, [ingredients, inputWeight]);

  // Total additives weight
  const totalAdditives = calculatedIngredients.reduce(
    (sum, ing) => sum + ing.requiredAmount,
    0
  );

  // Expected output based on yield
  const expectedOutput = recipe.target_yield_percent
    ? (inputWeight * recipe.target_yield_percent) / 100
    : inputWeight + totalAdditives;

  const getCategoryIcon = (productCategory: string | undefined | null) => {
    if (!productCategory) return '📦';
    const cat = INDUSTRY_CATEGORIES.find(c => c.value === productCategory);
    return cat?.icon || '📦';
  };

  if (ingredients.length === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {recipe.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Brak zdefiniowanych składników w recepturze.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-primary/5 border-primary/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            {recipe.name}
          </CardTitle>
          {recipe.target_yield_percent && (
            <Badge variant="secondary">
              Uzysk: {recipe.target_yield_percent}%
            </Badge>
          )}
        </div>
        {recipe.process_instructions && (
          <p className="text-sm text-muted-foreground mt-1">
            {recipe.process_instructions}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Weight Display */}
        <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
          <span className="text-sm font-medium">Wsad bazowy:</span>
          <span className="text-2xl font-bold font-mono">{inputWeight.toFixed(1)} kg</span>
        </div>

        {/* Ingredients Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Składnik</TableHead>
              <TableHead className="text-right">Na kg</TableHead>
              <TableHead className="text-right">Potrzeba</TableHead>
              <TableHead className="w-16 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calculatedIngredients.map((ing) => {
              const productData = ing.product as { name?: string; industry_category?: string } | undefined;
              const category = productData && 'industry_category' in productData ? productData.industry_category : null;
              const icon = getCategoryIcon(category);

              return (
                <TableRow key={ing.id}>
                  <TableCell className="font-medium">
                    <span className="mr-2">{icon}</span>
                    {ing.product?.name || "Nieznany"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {(ing.amount_per_kg_base || ing.ratio).toFixed(3)} {ing.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {ing.requiredAmount.toFixed(2)} {ing.unit}
                  </TableCell>
                  <TableCell className="text-center">
                    <Clock className="h-4 w-4 text-muted-foreground inline" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Surowiec bazowy:</span>
            <span className="font-mono">{inputWeight.toFixed(2)} kg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Suma dodatków:</span>
            <span className="font-mono">{totalAdditives.toFixed(2)} kg</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Przewidywana masa końcowa:</span>
            <Badge className="text-lg font-mono px-3 py-1">
              {expectedOutput.toFixed(2)} kg
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
