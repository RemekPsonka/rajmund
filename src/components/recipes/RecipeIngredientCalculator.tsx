import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import { RecipeIngredient } from "@/hooks/useRecipes";

interface RecipeIngredientCalculatorProps {
  ingredients: RecipeIngredient[];
  targetYieldPercent?: number | null;
}

export function RecipeIngredientCalculator({
  ingredients,
  targetYieldPercent,
}: RecipeIngredientCalculatorProps) {
  const [baseWeight, setBaseWeight] = useState<string>("100");

  const baseWeightNum = parseFloat(baseWeight) || 0;

  const calculateAmount = (ingredient: RecipeIngredient): number => {
    // If amount_per_kg_base is set, use it (grams per kg of base)
    if (ingredient.amount_per_kg_base) {
      return baseWeightNum * ingredient.amount_per_kg_base;
    }
    // Otherwise use ratio
    return baseWeightNum * ingredient.ratio;
  };

  const totalIngredients = ingredients.reduce(
    (sum, ing) => sum + calculateAmount(ing),
    0
  );

  const expectedOutput =
    targetYieldPercent && targetYieldPercent > 0
      ? (baseWeightNum * targetYieldPercent) / 100
      : baseWeightNum + totalIngredients;

  if (!ingredients.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" />
          Kalkulator składników
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Waga bazowa surowca (kg)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={baseWeight}
            onChange={(e) => setBaseWeight(e.target.value)}
            className="max-w-[200px]"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Składnik</TableHead>
              <TableHead className="text-right">Współczynnik</TableHead>
              <TableHead className="text-right">Ilość</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((ing) => {
              const amount = calculateAmount(ing);
              const unit = ing.product?.unit || "kg";
              return (
                <TableRow key={ing.id}>
                  <TableCell>{ing.product?.name || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {ing.amount_per_kg_base
                      ? `${ing.amount_per_kg_base.toFixed(4)} /kg`
                      : `×${ing.ratio.toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {amount.toFixed(2)} {unit}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Surowiec bazowy:</span>
            <span className="font-mono font-medium">{baseWeightNum.toFixed(2)} kg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Suma dodatków:</span>
            <span className="font-mono font-medium">{totalIngredients.toFixed(2)} kg</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Przewidywana masa końcowa:</span>
            <Badge variant="secondary" className="font-mono text-base">
              {expectedOutput.toFixed(2)} kg
            </Badge>
          </div>
          {targetYieldPercent && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Uzysk docelowy:</span>
              <span>{targetYieldPercent}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
