import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Recipe, RecipeFormData } from "@/hooks/useRecipes";

interface Product {
  id: string;
  name: string;
  is_raw_material?: boolean | null;
}

interface RecipeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  products: Product[];
  recipe?: Recipe | null;
  onSubmit: (data: RecipeFormData) => Promise<void>;
  isPending: boolean;
}

export function RecipeFormDialog({
  open,
  onOpenChange,
  companyId,
  products,
  recipe,
  onSubmit,
  isPending,
}: RecipeFormDialogProps) {
  const [formData, setFormData] = useState<Omit<RecipeFormData, "company_id">>({
    name: "",
    description: "",
    product_id: "",
    base_product_id: "",
    target_yield_percent: 100,
    process_instructions: "",
  });

  const isEdit = !!recipe;

  useEffect(() => {
    if (recipe) {
      setFormData({
        name: recipe.name,
        description: recipe.description || "",
        product_id: recipe.product_id || "",
        base_product_id: recipe.base_product_id || "",
        target_yield_percent: recipe.target_yield_percent || 100,
        process_instructions: recipe.process_instructions || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        product_id: "",
        base_product_id: "",
        target_yield_percent: 100,
        process_instructions: "",
      });
    }
  }, [recipe, open]);

  const rawMaterials = products.filter((p) => p.is_raw_material);
  const finishedProducts = products.filter((p) => !p.is_raw_material);

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Podaj nazwę receptury");
      return;
    }

    try {
      await onSubmit({
        company_id: companyId,
        name: formData.name,
        description: formData.description || undefined,
        product_id: formData.product_id || undefined,
        base_product_id: formData.base_product_id || undefined,
        target_yield_percent: formData.target_yield_percent || undefined,
        process_instructions: formData.process_instructions || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edytuj recepturę" : "Nowa receptura"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>Nazwa *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="np. Kebab classic"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Produkt bazowy (surowiec)</Label>
              <Select
                value={formData.base_product_id || "none"}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    base_product_id: v === "none" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz surowiec" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {rawMaterials.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Główny surowiec receptury (np. filet z kurczaka)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Produkt wyjściowy</Label>
              <Select
                value={formData.product_id || "none"}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    product_id: v === "none" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz produkt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {finishedProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Wyrób gotowy powstały z receptury
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Uzysk docelowy (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="200"
              value={formData.target_yield_percent || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  target_yield_percent: parseFloat(e.target.value) || undefined,
                })
              }
              placeholder="np. 120"
            />
            <p className="text-xs text-muted-foreground">
              Oczekiwany uzysk w % (np. 120% = 100kg mięsa + 20L wody = 120kg
              masy)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Opis</Label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Krótki opis receptury..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Instrukcje procesu</Label>
            <Textarea
              value={formData.process_instructions || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  process_instructions: e.target.value,
                })
              }
              placeholder="np. Masować 40 min w temp. 2°C, następnie schłodzić..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isEdit ? "Zapisz zmiany" : "Dodaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
