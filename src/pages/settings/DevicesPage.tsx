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
import { Plus, Pencil, Trash2, Scale, MapPin } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import { useDevices, useCreateDevice, useUpdateDevice, DeviceType } from "@/hooks/useDevices";
import { toast } from "sonner";

const DEVICE_TYPES: { value: DeviceType; label: string; icon: typeof Scale }[] = [
  { value: "SCALE", label: "Waga", icon: Scale },
  { value: "STATION", label: "Stanowisko", icon: MapPin },
];

interface DeviceFormData {
  code: string;
  name: string;
  device_type: DeviceType;
}

export default function DevicesPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<{ id: string } & DeviceFormData | null>(null);
  const [formData, setFormData] = useState<DeviceFormData>({
    code: "",
    name: "",
    device_type: "SCALE",
  });

  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: facilities } = useFacilities();
  const { data: devices, isLoading: loadingDevices } = useDevices(selectedFacilityId || undefined);
  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();

  const filteredFacilities = facilities?.filter(
    (f) => !selectedCompanyId || f.company_id === selectedCompanyId
  );

  const handleOpenCreate = () => {
    setEditingDevice(null);
    setFormData({ code: "", name: "", device_type: "SCALE" });
    setDialogOpen(true);
  };

  const handleOpenEdit = (device: { id: string; code: string; name: string; device_type: DeviceType }) => {
    setEditingDevice(device);
    setFormData({
      code: device.code,
      name: device.name,
      device_type: device.device_type,
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
      if (editingDevice) {
        await updateDevice.mutateAsync({
          id: editingDevice.id,
          ...formData,
        });
      } else {
        await createDevice.mutateAsync({
          company_id: selectedCompanyId,
          facility_id: selectedFacilityId || undefined,
          ...formData,
        });
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await updateDevice.mutateAsync({ id, is_active: false });
    } catch (error) {
      // Error handled in hook
    }
  };

  const getDeviceTypeConfig = (type: DeviceType) => {
    return DEVICE_TYPES.find((t) => t.value === type) || DEVICE_TYPES[0];
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
        <h1 className="text-2xl font-bold">Urządzenia</h1>
        <Button onClick={handleOpenCreate} disabled={!selectedCompanyId}>
          <Plus className="h-4 w-4 mr-2" />
          Nowe urządzenie
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
              <Label>Zakład (opcjonalnie)</Label>
              <Select 
                value={selectedFacilityId || "all"} 
                onValueChange={(v) => setSelectedFacilityId(v === "all" ? "" : v)}
                disabled={!selectedCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie zakłady" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie zakłady</SelectItem>
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

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista urządzeń</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !devices?.length ? (
            <p className="text-muted-foreground text-center py-8">
              {selectedCompanyId
                ? "Brak urządzeń. Dodaj pierwsze urządzenie."
                : "Wybierz spółkę, aby zobaczyć urządzenia."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="w-[100px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const typeConfig = getDeviceTypeConfig(device.device_type);
                  const TypeIcon = typeConfig.icon;
                  return (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono">{device.code}</TableCell>
                      <TableCell>{device.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <TypeIcon className="h-3 w-3" />
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(device)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeactivate(device.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
              {editingDevice ? "Edytuj urządzenie" : "Nowe urządzenie"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kod *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="np. WAGA_01"
              />
            </div>
            <div className="space-y-2">
              <Label>Nazwa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="np. Waga przemysłowa #1"
              />
            </div>
            <div className="space-y-2">
              <Label>Typ urządzenia</Label>
              <Select
                value={formData.device_type}
                onValueChange={(v) => setFormData({ ...formData, device_type: v as DeviceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createDevice.isPending || updateDevice.isPending}
            >
              {editingDevice ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
