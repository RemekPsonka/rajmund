import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Package, RotateCcw } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import {
  usePackagingTypes,
  useCreatePackagingType,
  useUpdatePackagingType,
  useDeletePackagingType,
} from "@/hooks/usePackagingTypes";
import { toast } from "sonner";

interface PackagingFormData {
  code: string;
  name: string;
  tare_weight: number;
  is_returnable: boolean;
}

export default function PackagingTypesPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string } & PackagingFormData | null>(null);
  const [formData, setFormData] = useState<PackagingFormData>({
    code: "",
    name: "",
    tare_weight: 0,
    is_returnable: false,
  });

  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: packagingTypes, isLoading: loadingTypes } = usePackagingTypes(selectedCompanyId || undefined);
  const createType = useCreatePackagingType();
  const updateType = useUpdatePackagingType();
  const deleteType = useDeletePackagingType();

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ code: "", name: "", tare_weight: 0, is_returnable: false });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: { id: string; code: string; name: string; tare_weight: number; is_returnable: boolean }) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      tare_weight: item.tare_weight,
      is_returnable: item.is_returnable,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      toast.error("Wypełnij wszystkie wymagane pola");
      return;
    }

    if (!selectedCompanyId) {
      toast.error("Wybierz spółkę");
      return;
    }

    try {
      if (editingItem) {
        await updateType.mutateAsync({
          id: editingItem.id,
          ...formData,
        });
      } else {
        await createType.mutateAsync({
          company_id: selectedCompanyId,
          ...formData,
        });
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteType.mutateAsync(id);
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
        <h1 className="text-2xl font-bold">Typy Opakowań</h1>
        <Button onClick={handleOpenCreate} disabled={!selectedCompanyId}>
          <Plus className="h-4 w-4 mr-2" />
          Nowy typ opakowania
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

      {/* Types Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lista typów opakowań
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTypes ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !packagingTypes?.length ? (
            <p className="text-muted-foreground text-center py-8">
              {selectedCompanyId
                ? "Brak typów opakowań. Dodaj pierwszy typ."
                : "Wybierz spółkę, aby zobaczyć typy opakowań."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead className="text-right">Tara (kg)</TableHead>
                  <TableHead>Zwrotne</TableHead>
                  <TableHead className="w-[100px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packagingTypes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.tare_weight.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {item.is_returnable ? (
                        <Badge variant="default" className="gap-1">
                          <RotateCcw className="h-3 w-3" />
                          Tak
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Nie</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edytuj typ opakowania" : "Nowy typ opakowania"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kod *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="np. E2"
              />
            </div>
            <div className="space-y-2">
              <Label>Nazwa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="np. Pojemnik E2"
              />
            </div>
            <div className="space-y-2">
              <Label>Waga tary (kg)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.tare_weight}
                onChange={(e) => setFormData({ ...formData, tare_weight: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Opakowanie zwrotne</Label>
              <Switch
                checked={formData.is_returnable}
                onCheckedChange={(checked) => setFormData({ ...formData, is_returnable: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createType.isPending || updateType.isPending}
            >
              {editingItem ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
