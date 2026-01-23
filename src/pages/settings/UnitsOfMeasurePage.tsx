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
import { Plus, Pencil, Trash2, Ruler } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import {
  useUnitsOfMeasure,
  useCreateUnitOfMeasure,
  useUpdateUnitOfMeasure,
  useDeleteUnitOfMeasure,
} from "@/hooks/useUnitsOfMeasure";
import { toast } from "sonner";

interface UnitFormData {
  code: string;
  name: string;
  symbol: string;
  is_default: boolean;
}

export default function UnitsOfMeasurePage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string } & UnitFormData | null>(null);
  const [formData, setFormData] = useState<UnitFormData>({
    code: "",
    name: "",
    symbol: "",
    is_default: false,
  });

  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: units, isLoading: loadingUnits } = useUnitsOfMeasure(selectedCompanyId || undefined);
  const createUnit = useCreateUnitOfMeasure();
  const updateUnit = useUpdateUnitOfMeasure();
  const deleteUnit = useDeleteUnitOfMeasure();

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ code: "", name: "", symbol: "", is_default: false });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: { id: string; code: string; name: string; symbol: string; is_default: boolean }) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      symbol: item.symbol,
      is_default: item.is_default,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name || !formData.symbol) {
      toast.error("Wypełnij wszystkie wymagane pola");
      return;
    }

    if (!selectedCompanyId) {
      toast.error("Wybierz spółkę");
      return;
    }

    try {
      if (editingItem) {
        await updateUnit.mutateAsync({
          id: editingItem.id,
          ...formData,
        });
      } else {
        await createUnit.mutateAsync({
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
      await deleteUnit.mutateAsync(id);
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
        <h1 className="text-2xl font-bold">Jednostki Miary</h1>
        <Button onClick={handleOpenCreate} disabled={!selectedCompanyId}>
          <Plus className="h-4 w-4 mr-2" />
          Nowa jednostka
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

      {/* Units Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Lista jednostek miary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUnits ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !units?.length ? (
            <p className="text-muted-foreground text-center py-8">
              {selectedCompanyId
                ? "Brak jednostek miary. Dodaj pierwszą jednostkę."
                : "Wybierz spółkę, aby zobaczyć jednostki miary."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Domyślna</TableHead>
                  <TableHead className="w-[100px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="font-mono">{item.symbol}</TableCell>
                    <TableCell>
                      {item.is_default ? (
                        <Badge variant="default">Domyślna</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
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
              {editingItem ? "Edytuj jednostkę miary" : "Nowa jednostka miary"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kod *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="np. kg"
              />
            </div>
            <div className="space-y-2">
              <Label>Nazwa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="np. Kilogram"
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol *</Label>
              <Input
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="np. kg"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Jednostka domyślna</Label>
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createUnit.isPending || updateUnit.isPending}
            >
              {editingItem ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
