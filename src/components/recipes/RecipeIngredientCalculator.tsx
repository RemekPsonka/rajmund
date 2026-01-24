import { useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecipeIngredient } from "@/hooks/useRecipes";
import { INDUSTRY_CATEGORIES } from "@/hooks/useProducts";

interface RecipeIngredientCalculatorProps {
  ingredients: RecipeIngredient[];
  targetYieldPercent?: number | null;
  evaporationPercent?: number | null;
  baseProductName?: string;
}

export function RecipeIngredientCalculator({
  ingredients,
  targetYieldPercent,
  evaporationPercent,
  baseProductName,
}: RecipeIngredientCalculatorProps) {
  const [baseWeight, setBaseWeight] = useState<string>("100");

  const baseWeightNum = parseFloat(baseWeight) || 0;

  if (ingredients.length === 0) {
    return null;
  }

  // Calculate amounts for each ingredient
  const calculateAmount = (ingredient: RecipeIngredient): number => {
    if (ingredient.amount_per_kg_base) {
      return baseWeightNum * ingredient.amount_per_kg_base;
    }
    return ingredient.ratio * baseWeightNum;
  };

  // Total additives
  const totalAdditives = ingredients.reduce((sum, ing) => sum + calculateAmount(ing), 0);

  // Theoretical output (base + additives)
  const theoreticalOutput = baseWeightNum + totalAdditives;

  // Calculate evaporation loss
  const evapLoss = theoreticalOutput * ((evaporationPercent || 0) / 100);

  // Real output after evaporation
  const realOutput = theoreticalOutput - evapLoss;

  const getCategoryBadge = (productCategory: string | undefined | null) => {
    if (!productCategory) return null;
    const cat = INDUSTRY_CATEGORIES.find(c => c.value === productCategory);
    if (!cat) return null;
    return (
      <Badge variant="outline" className="text-xs">
        {cat.icon}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-5 w-5" />
          Kalkulator składników
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base Weight Input */}
        <div className="flex items-end gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <Label htmlFor="base-weight" className="text-sm">
              Waga surowca bazowego {baseProductName && `(${baseProductName})`}
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="base-weight"
                type="number"
                step="0.1"
                min="0"
                className="w-32 text-lg font-mono"
                value={baseWeight}
                onChange={(e) => setBaseWeight(e.target.value)}
              />
              <span className="text-muted-foreground font-medium">kg</span>
            </div>
          </div>
        </div>

        {/* Ingredients Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Składnik</TableHead>
              <TableHead className="text-right">Na kg</TableHead>
              <TableHead className="text-right">Potrzeba</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((ingredient) => {
              const amount = calculateAmount(ingredient);
              // Try to find category from joined product
              const productData = ingredient.product as { name?: string; sku?: string | null; unit?: string; industry_category?: string } | undefined;
              const category = productData && 'industry_category' in productData ? productData.industry_category : null;
              
              return (
                <TableRow key={ingredient.id}>
                  <TableCell className="w-10">
                    {getCategoryBadge(category)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {ingredient.product?.name || "Nieznany"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {(ingredient.amount_per_kg_base || ingredient.ratio).toFixed(3)} {ingredient.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {amount.toFixed(2)} {ingredient.unit}
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
            <span className="font-mono font-medium">{baseWeightNum.toFixed(2)} kg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Suma dodatków:</span>
            <span className="font-mono font-medium">{totalAdditives.toFixed(2)} kg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Masa teoretyczna:</span>
            <span className="font-mono font-medium text-blue-600 dark:text-blue-400">{theoreticalOutput.toFixed(2)} kg</span>
          </div>
          {(evaporationPercent || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Odparowanie ({evaporationPercent?.toFixed(2)}%):</span>
              <span className="font-mono font-medium text-orange-600 dark:text-orange-400">-{evapLoss.toFixed(2)} kg</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Masa końcowa (realna):</span>
            <Badge variant="default" className="text-lg font-mono px-3 py-1">
              {realOutput.toFixed(2)} kg
            </Badge>
          </div>
          {targetYieldPercent && (
            <p className="text-xs text-muted-foreground text-right">
              (uzysk realny: {targetYieldPercent.toFixed(2)}%)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
