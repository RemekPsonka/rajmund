import { useState } from "react";
import { Plus, Edit2, Trash2, MapPin, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import {
  useStorageLocations,
  useCreateStorageLocation,
  useUpdateStorageLocation,
  getLocationTypeLabel,
  LocationType,
} from "@/hooks/useStorageLocations";

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: "chiller", label: "Chłodnia" },
  { value: "freezer", label: "Mroźnia" },
  { value: "shock", label: "Szok (-40°C)" },
  { value: "production", label: "Produkcja" },
  { value: "storage", label: "Magazyn" },
];

const TYPE_COLORS: Record<LocationType, string> = {
  chiller: "bg-blue-500",
  freezer: "bg-purple-500",
  shock: "bg-red-500",
  production: "bg-green-500",
  storage: "bg-gray-500",
};

interface LocationFormData {
  name: string;
  location_type: LocationType;
  min_temp?: number;
  max_temp?: number;
}

export default function StorageLocationsPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [formData, setFormData] = useState<LocationFormData>({
    name: "",
    location_type: "chiller",
  });

  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data: facilities, isLoading: facilitiesLoading } = useFacilities();
  const { data: locations, isLoading: locationsLoading } = useStorageLocations(
    selectedFacilityId || undefined
  );

  const createLocation = useCreateStorageLocation();
  const updateLocation = useUpdateStorageLocation();

  const filteredFacilities = selectedCompanyId
    ? facilities?.filter((f) => f.company_id === selectedCompanyId)
    : facilities;

  const handleOpenCreate = () => {
    setEditingLocation(null);
    setFormData({ name: "", location_type: "chiller" });
    setDialogOpen(true);
  };

  const handleOpenEdit = (location: {
    id: string;
    name: string;
    location_type: string;
    min_temp: number | null;
    max_temp: number | null;
  }) => {
    setEditingLocation(location.id);
    setFormData({
      name: location.name,
      location_type: location.location_type as LocationType,
      min_temp: location.min_temp ?? undefined,
      max_temp: location.max_temp ?? undefined,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !selectedFacilityId) {
      return;
    }

    if (editingLocation) {
      await updateLocation.mutateAsync({
        id: editingLocation,
        name: formData.name,
        location_type: formData.location_type,
        min_temp: formData.min_temp,
        max_temp: formData.max_temp,
      });
    } else {
      await createLocation.mutateAsync({
        facility_id: selectedFacilityId,
        name: formData.name,
        location_type: formData.location_type,
        min_temp: formData.min_temp,
        max_temp: formData.max_temp,
      });
    }

    setDialogOpen(false);
    setFormData({ name: "", location_type: "chiller" });
    setEditingLocation(null);
  };

  const handleDeactivate = async (id: string) => {
    await updateLocation.mutateAsync({ id, is_active: false });
  };

  const isLoading = companiesLoading || facilitiesLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lokalizacje magazynowe</h1>
          <p className="text-muted-foreground">
            Zarządzaj lokalizacjami przechowywania w zakładach
          </p>
        </div>
        <Button onClick={handleOpenCreate} disabled={!selectedFacilityId}>
          <Plus className="mr-2 h-4 w-4" />
          Nowa lokalizacja
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Spółka</Label>
              <Select
                value={selectedCompanyId || "all"}
                onValueChange={(value) => {
                  setSelectedCompanyId(value === "all" ? "" : value);
                  setSelectedFacilityId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie spółki" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.short_name || company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zakład</Label>
              <Select
                value={selectedFacilityId || "all"}
                onValueChange={(value) => setSelectedFacilityId(value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz zakład" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {filteredFacilities?.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading || locationsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !locations?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {selectedFacilityId
                  ? "Brak lokalizacji w tym zakładzie"
                  : "Wybierz zakład, aby zobaczyć lokalizacje"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Zakres temp.</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            TYPE_COLORS[location.location_type as LocationType] ||
                            "bg-gray-500"
                          }`}
                        />
                        {location.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getLocationTypeLabel(location.location_type as LocationType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {location.min_temp != null || location.max_temp != null ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Thermometer className="h-4 w-4 text-muted-foreground" />
                          {location.min_temp ?? "-"}°C / {location.max_temp ?? "-"}°C
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(location)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeactivate(location.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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
              {editingLocation ? "Edytuj lokalizację" : "Nowa lokalizacja"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nazwa</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="np. Chłodnia 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Typ lokalizacji</Label>
              <Select
                value={formData.location_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, location_type: value as LocationType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min. temp. (°C)</Label>
                <Input
                  type="number"
                  value={formData.min_temp ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_temp: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="-18"
                />
              </div>
              <div className="space-y-2">
                <Label>Max. temp. (°C)</Label>
                <Input
                  type="number"
                  value={formData.max_temp ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_temp: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="4"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.name ||
                createLocation.isPending ||
                updateLocation.isPending
              }
            >
              {editingLocation ? "Zapisz" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
