import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

import type { Recipe, RecipeFormData, RecipeIngredient } from "@/hooks/useRecipes";
import { INDUSTRY_CATEGORIES, type Product } from "@/hooks/useProducts";

interface LocalIngredient {
  id: string;
  product_id: string;
  product_name: string;
  industry_category: string | null;
  amount_per_kg_base: number;
  unit: string;
}

interface RecipeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  products: Product[];
  recipe?: Recipe | null;
  existingIngredients?: RecipeIngredient[];
  onSubmit: (data: RecipeFormData, ingredients: Omit<LocalIngredient, 'id' | 'product_name' | 'industry_category'>[]) => Promise<void>;
  isPending: boolean;
}

export function RecipeFormDialog({
  open,
  onOpenChange,
  companyId,
  products,
  recipe,
  existingIngredients,
  onSubmit,
  isPending,
}: RecipeFormDialogProps) {
  // Form state
  const [name, setName] = useState("");
  const [baseProductId, setBaseProductId] = useState("");
  const [productId, setProductId] = useState("");
  const [evaporationPercent, setEvaporationPercent] = useState("0");
  const [description, setDescription] = useState("");
  const [processInstructions, setProcessInstructions] = useState("");

  // Ingredients state
  const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
  const [newIngredientProductId, setNewIngredientProductId] = useState("");
  const [newIngredientAmount, setNewIngredientAmount] = useState("");

  // Filter products by category
  const rawMeatProducts = products.filter(p => p.industry_category === 'RawMeat');
  const finishedProducts = products.filter(p => p.industry_category === 'FinishedGood' || !p.is_raw_material);
  const ingredientProducts = products.filter(p => 
    p.industry_category === 'Spice' || 
    p.industry_category === 'Additive' ||
    p.industry_category === 'Casing'
  );

  // Calculate theoretical yield from ingredients (100% base + ingredients as %)
  const theoreticalYield = useMemo(() => {
    const ingredientsSum = ingredients.reduce(
      (sum, ing) => sum + (ing.amount_per_kg_base * 100), // Convert to percentage
      0
    );
    return 100 + ingredientsSum;
  }, [ingredients]);

  // Calculate real yield = theoretical - evaporation
  const realYield = useMemo(() => {
    const evap = parseFloat(evaporationPercent) || 0;
    return theoreticalYield * (1 - evap / 100);
  }, [theoreticalYield, evaporationPercent]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (recipe) {
        setName(recipe.name);
        setBaseProductId(recipe.base_product_id || "");
        setProductId(recipe.product_id || "");
        setEvaporationPercent(recipe.evaporation_percent?.toString() || "0");
        setDescription(recipe.description || "");
        setProcessInstructions(recipe.process_instructions || "");
        
        // Load existing ingredients
        if (existingIngredients) {
          setIngredients(existingIngredients.map(ing => ({
            id: ing.id,
            product_id: ing.product_id,
            product_name: ing.product?.name || "Nieznany",
            industry_category: products.find(p => p.id === ing.product_id)?.industry_category || null,
            amount_per_kg_base: ing.amount_per_kg_base || ing.ratio,
            unit: ing.unit,
          })));
        }
      } else {
        setName("");
        setBaseProductId("");
        setProductId("");
        setEvaporationPercent("0");
        setDescription("");
        setProcessInstructions("");
        setIngredients([]);
      }
      setNewIngredientProductId("");
      setNewIngredientAmount("");
    }
  }, [open, recipe, existingIngredients, products]);

  const handleAddIngredient = () => {
    if (!newIngredientProductId || !newIngredientAmount) {
      toast.error("Wybierz produkt i podaj ilość");
      return;
    }

    const product = products.find(p => p.id === newIngredientProductId);
    if (!product) return;

    // Check if already added
    if (ingredients.some(i => i.product_id === newIngredientProductId)) {
      toast.error("Ten składnik jest już dodany");
      return;
    }

    setIngredients(prev => [...prev, {
      id: crypto.randomUUID(),
      product_id: newIngredientProductId,
      product_name: product.name,
      industry_category: product.industry_category,
      amount_per_kg_base: parseFloat(newIngredientAmount),
      unit: product.unit,
    }]);

    setNewIngredientProductId("");
    setNewIngredientAmount("");
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(prev => prev.filter(i => i.id !== id));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nazwa receptury jest wymagana");
      return;
    }

    await onSubmit(
      {
        company_id: companyId,
        name: name.trim(),
        base_product_id: baseProductId || undefined,
        product_id: productId || undefined,
        target_yield_percent: realYield, // Save real yield
        evaporation_percent: parseFloat(evaporationPercent) || 0,
        description: description || undefined,
        process_instructions: processInstructions || undefined,
      },
      ingredients.map(i => ({
        product_id: i.product_id,
        amount_per_kg_base: i.amount_per_kg_base,
        unit: i.unit,
      }))
    );
    
    onOpenChange(false);
  };

  const getCategoryBadge = (category: string | null) => {
    const cat = INDUSTRY_CATEGORIES.find(c => c.value === category);
    if (!cat) return null;
    return <Badge variant="outline" className="text-xs">{cat.icon} {cat.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? "Edytuj recepturę" : "Nowa receptura"}</DialogTitle>
          <DialogDescription>
            Zdefiniuj składniki i proporcje dla procesu produkcyjnego
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nazwa receptury*</Label>
              <Input
                id="name"
                placeholder="Np. Kebab Classic Mix"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Surowiec bazowy (mięso)</Label>
                <Select value={baseProductId} onValueChange={setBaseProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz surowiec" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawMeatProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        🥩 {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Produkt wyjściowy</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz wyrób" />
                  </SelectTrigger>
                  <SelectContent>
                    {finishedProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        ✅ {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Yield Section */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
              {/* Theoretical Yield - read-only */}
              <div className="text-center">
                <Label className="text-xs text-muted-foreground">Uzysk teoretyczny</Label>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {theoreticalYield.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">z receptury</p>
              </div>

              {/* Evaporation - editable */}
              <div className="text-center">
                <Label className="text-xs">Odparowanie</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  value={evaporationPercent}
                  onChange={(e) => setEvaporationPercent(e.target.value)}
                  className="text-center w-24 mx-auto mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">%</p>
              </div>

              {/* Real Yield - read-only */}
              <div className="text-center">
                <Label className="text-xs text-muted-foreground">Uzysk realny</Label>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {realYield.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">po odparowaniu</p>
              </div>
            </div>
          </div>

          {/* Ingredients Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Składniki receptury</Label>
              <Badge variant="secondary">
                {ingredients.length} pozycji
              </Badge>
            </div>

            {/* Add Ingredient Row */}
            <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <Label className="text-xs">Składnik</Label>
                <Select value={newIngredientProductId} onValueChange={setNewIngredientProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz składnik" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredientProducts.map((p) => {
                      const cat = INDUSTRY_CATEGORIES.find(c => c.value === p.industry_category);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {cat?.icon || '📦'} {p.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label className="text-xs">Na 1 kg mięsa</Label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="0.020"
                  value={newIngredientAmount}
                  onChange={(e) => setNewIngredientAmount(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleAddIngredient}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Ingredients Table */}
            {ingredients.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Składnik</TableHead>
                    <TableHead>Kategoria</TableHead>
                    <TableHead className="text-right">Na kg bazy</TableHead>
                    <TableHead className="text-right">Na 100 kg</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.product_name}</TableCell>
                      <TableCell>{getCategoryBadge(ing.industry_category)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {ing.amount_per_kg_base.toFixed(3)} {ing.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {(ing.amount_per_kg_base * 100).toFixed(1)} {ing.unit}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveIngredient(ing.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Instructions */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                placeholder="Krótki opis receptury..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="instructions">Instrukcje procesu</Label>
              <Textarea
                id="instructions"
                placeholder="Np. Masować 40 min w temp. 2°C, następnie..."
                value={processInstructions}
                onChange={(e) => setProcessInstructions(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Zapisywanie..." : recipe ? "Zapisz zmiany" : "Utwórz recepturę"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
