import { useState } from "react";
import { Plus, Search, Briefcase, Pencil, Trash2, Filter } from "lucide-react";
import {
  useJobPositions,
  useCreateJobPosition,
  useUpdateJobPosition,
  useDeleteJobPosition,
  type JobPosition,
} from "@/hooks/useJobPositions";
import { useCompanies } from "@/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const DEPARTMENTS = [
  "Produkcja",
  "Magazyn",
  "Administracja",
  "Logistyka",
  "Jakość",
  "Utrzymanie ruchu",
  "Inne",
];

export default function JobPositionsPage() {
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
  const [positionToDelete, setPositionToDelete] = useState<JobPosition | null>(null);

  // Form state
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: positions, isLoading } = useJobPositions(companyFilter);
  const { data: companies } = useCompanies();
  const createPosition = useCreateJobPosition();
  const updatePosition = useUpdateJobPosition();
  const deletePosition = useDeleteJobPosition();

  const filteredPositions = positions?.filter(
    (pos) =>
      pos.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pos.department?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleOpenDialog = (position?: JobPosition) => {
    if (position) {
      setEditingPosition(position);
      setFormCompanyId(position.company_id);
      setFormName(position.name);
      setFormDescription(position.description || "");
      setFormDepartment(position.department || "");
      setFormIsActive(position.is_active);
    } else {
      setEditingPosition(null);
      setFormCompanyId(companies?.[0]?.id || "");
      setFormName("");
      setFormDescription("");
      setFormDepartment("");
      setFormIsActive(true);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPosition(null);
  };

  const handleSubmit = async () => {
    const data = {
      company_id: formCompanyId,
      name: formName,
      description: formDescription || undefined,
      department: formDepartment || undefined,
      is_active: formIsActive,
    };

    if (editingPosition) {
      await updatePosition.mutateAsync({ id: editingPosition.id, ...data });
    } else {
      await createPosition.mutateAsync(data);
    }
    handleCloseDialog();
  };

  const handleDelete = async () => {
    if (positionToDelete) {
      await deletePosition.mutateAsync(positionToDelete.id);
      setDeleteDialogOpen(false);
      setPositionToDelete(null);
    }
  };

  const getCompanyName = (companyId: string) => {
    return companies?.find((c) => c.id === companyId)?.name || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Stanowiska pracy</h1>
          <p className="text-muted-foreground">Zarządzaj słownikiem stanowisk</p>
        </div>
        <Button className="gap-2" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4" />
          Dodaj stanowisko
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie lub dziale..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtruj po firmie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie firmy</SelectItem>
            {companies?.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card className="shadow-industrial">
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredPositions?.length === 0 ? (
        <Card className="shadow-industrial">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Brak stanowisk</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Nie znaleziono pasujących wyników" : "Dodaj pierwsze stanowisko"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Dodaj stanowisko
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-industrial">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Dział</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPositions?.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.name}</TableCell>
                    <TableCell>
                      {position.department ? (
                        <Badge variant="outline">{position.department}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getCompanyName(position.company_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={position.is_active ? "default" : "secondary"}>
                        {position.is_active ? "Aktywne" : "Nieaktywne"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(position)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPositionToDelete(position);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPosition ? "Edytuj stanowisko" : "Nowe stanowisko"}
            </DialogTitle>
            <DialogDescription>
              {editingPosition
                ? "Zmień dane stanowiska pracy"
                : "Dodaj nowe stanowisko do słownika"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Firma *</Label>
              <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz firmę" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nazwa stanowiska *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="np. Trybowszczyk"
              />
            </div>

            <div className="space-y-2">
              <Label>Dział</Label>
              <Select value={formDepartment || "__none__"} onValueChange={(v) => setFormDepartment(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz dział" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Brak działu</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Opcjonalny opis stanowiska..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Aktywne</Label>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formCompanyId ||
                !formName ||
                createPosition.isPending ||
                updatePosition.isPending
              }
            >
              {editingPosition ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć stanowisko?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć stanowisko "{positionToDelete?.name}"? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
