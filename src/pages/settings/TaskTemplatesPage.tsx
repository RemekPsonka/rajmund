import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, ListChecks, ArrowUp, ArrowDown } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import {
  useTaskTemplates,
  useCreateTaskTemplate,
  useUpdateTaskTemplate,
  useDeleteTaskTemplate,
} from "@/hooks/useTaskTemplates";
import { toast } from "sonner";

const PRODUCTION_TYPES = [
  { value: "Decomposition", label: "Rozbiór" },
  { value: "Processing", label: "Przetwórstwo" },
  { value: "Packing", label: "Pakowanie" },
];

interface TaskFormData {
  name: string;
  production_type: string;
  sequence_number: number;
}

export default function TaskTemplatesPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("Decomposition");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string } & TaskFormData | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    name: "",
    production_type: "Decomposition",
    sequence_number: 1,
  });

  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: templates, isLoading: loadingTemplates } = useTaskTemplates(
    selectedCompanyId || undefined,
    selectedType
  );
  const createTemplate = useCreateTaskTemplate();
  const updateTemplate = useUpdateTaskTemplate();
  const deleteTemplate = useDeleteTaskTemplate();

  const handleOpenCreate = () => {
    const nextSequence = (templates?.length || 0) + 1;
    setEditingItem(null);
    setFormData({ name: "", production_type: selectedType, sequence_number: nextSequence });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: { id: string; name: string; production_type: string; sequence_number: number }) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      production_type: item.production_type,
      sequence_number: item.sequence_number,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Podaj nazwę czynności");
      return;
    }

    if (!selectedCompanyId) {
      toast.error("Wybierz spółkę");
      return;
    }

    try {
      if (editingItem) {
        await updateTemplate.mutateAsync({
          id: editingItem.id,
          ...formData,
        });
      } else {
        await createTemplate.mutateAsync({
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
      await deleteTemplate.mutateAsync(id);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleMoveUp = async (item: { id: string; sequence_number: number }) => {
    if (item.sequence_number <= 1) return;
    try {
      await updateTemplate.mutateAsync({
        id: item.id,
        sequence_number: item.sequence_number - 1,
      });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleMoveDown = async (item: { id: string; sequence_number: number }) => {
    try {
      await updateTemplate.mutateAsync({
        id: item.id,
        sequence_number: item.sequence_number + 1,
      });
    } catch (error) {
      // Error handled in hook
    }
  };

  const getTypeLabel = (type: string) => {
    return PRODUCTION_TYPES.find((t) => t.value === type)?.label || type;
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
        <h1 className="text-2xl font-bold">Szablony Czynności Produkcyjnych</h1>
        <Button onClick={handleOpenCreate} disabled={!selectedCompanyId}>
          <Plus className="h-4 w-4 mr-2" />
          Nowa czynność
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Typ zlecenia</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Czynności dla: {getTypeLabel(selectedType)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTemplates ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !templates?.length ? (
            <p className="text-muted-foreground text-center py-8">
              {selectedCompanyId
                ? "Brak szablonów czynności dla tego typu zlecenia."
                : "Wybierz spółkę, aby zobaczyć szablony."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Nr</TableHead>
                  <TableHead>Nazwa czynności</TableHead>
                  <TableHead className="w-[150px]">Kolejność</TableHead>
                  <TableHead className="w-[100px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline">{item.sequence_number}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveUp(item)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveDown(item)}
                          disabled={index === templates.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
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
              {editingItem ? "Edytuj czynność" : "Nowa czynność"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nazwa czynności *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="np. Kontrola temperatury surowca"
              />
            </div>
            <div className="space-y-2">
              <Label>Typ zlecenia</Label>
              <Select
                value={formData.production_type}
                onValueChange={(v) => setFormData({ ...formData, production_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Numer kolejności</Label>
              <Input
                type="number"
                min="1"
                value={formData.sequence_number}
                onChange={(e) => setFormData({ ...formData, sequence_number: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createTemplate.isPending || updateTemplate.isPending}
            >
              {editingItem ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
