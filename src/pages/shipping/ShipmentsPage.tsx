import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Truck,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import { useContractors } from "@/hooks/useContractors";
import {
  useShipments,
  useCreateShipment,
  type ShipmentStatus,
} from "@/hooks/useShipments";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ExportButton } from "@/components/ExportButton";

const statusConfig: Record<ShipmentStatus, { label: string; icon: React.ElementType; color: string }> = {
  Planning: { label: "Planowanie", icon: Clock, color: "bg-blue-100 text-blue-700" },
  Loading: { label: "Załadunek", icon: Loader2, color: "bg-yellow-100 text-yellow-700" },
  Shipped: { label: "W drodze", icon: Truck, color: "bg-purple-100 text-purple-700" },
  Delivered: { label: "Dostarczono", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
};

export default function ShipmentsPage() {
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "all">("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  
  // Form state
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formFacilityId, setFormFacilityId] = useState("");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formCarrierId, setFormCarrierId] = useState("");
  const [formDriverName, setFormDriverName] = useState("");
  const [formTruckPlates, setFormTruckPlates] = useState("");
  const [formTrailerPlates, setFormTrailerPlates] = useState("");
  const [formTemperature, setFormTemperature] = useState("-18");
  const [formDispatchDate, setFormDispatchDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Queries
  const { data: shipments, isLoading } = useShipments(
    statusFilter === "all" ? undefined : statusFilter
  );
  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();
  const { data: contractors } = useContractors(formCompanyId || undefined);
  
  const createShipment = useCreateShipment();

  // Filter facilities by company
  const filteredFacilities = facilities?.filter(
    (f) => f.company_id === formCompanyId
  ) || [];

  // Filter contractors
  const customers = contractors?.filter((c) => c.is_customer) || [];
  const carriers = contractors?.filter((c) => c.is_logistics) || [];

  // Filter shipments by search
  const filteredShipments = shipments?.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.shipment_number.toLowerCase().includes(query) ||
      s.customer?.name?.toLowerCase().includes(query) ||
      s.driver_name?.toLowerCase().includes(query)
    );
  });

  const handleCreateShipment = async () => {
    if (!formCompanyId || !formFacilityId) return;

    await createShipment.mutateAsync({
      company_id: formCompanyId,
      facility_id: formFacilityId,
      customer_id: formCustomerId || undefined,
      carrier_id: formCarrierId || undefined,
      driver_name: formDriverName || undefined,
      truck_plates: formTruckPlates || undefined,
      trailer_plates: formTrailerPlates || undefined,
      transport_temperature: formTemperature ? parseFloat(formTemperature) : undefined,
      dispatch_date: formDispatchDate,
    });

    setShowNewDialog(false);
    resetForm();
  };

  const resetForm = () => {
    setFormCompanyId("");
    setFormFacilityId("");
    setFormCustomerId("");
    setFormCarrierId("");
    setFormDriverName("");
    setFormTruckPlates("");
    setFormTrailerPlates("");
    setFormTemperature("-18");
    setFormDispatchDate(new Date().toISOString().slice(0, 10));
  };

  // Export data preparation
  const exportData = filteredShipments?.map((shipment) => ({
    shipment_number: shipment.shipment_number,
    dispatch_date: format(new Date(shipment.dispatch_date), "dd.MM.yyyy", { locale: pl }),
    customer_name: shipment.customer?.name || "",
    driver_name: shipment.driver_name || "",
    truck_plates: shipment.truck_plates || "",
    trailer_plates: shipment.trailer_plates || "",
    total_net_weight: `${shipment.total_net_weight.toFixed(1)} kg`,
    pallets_count: String(shipment.pallets_count),
    status: statusConfig[shipment.status]?.label || shipment.status,
  })) || [];

  const exportColumns: { key: keyof typeof exportData[0]; header: string }[] = [
    { key: "shipment_number", header: "Nr wysyłki" },
    { key: "dispatch_date", header: "Data" },
    { key: "customer_name", header: "Klient" },
    { key: "driver_name", header: "Kierowca" },
    { key: "truck_plates", header: "Nr rej. ciągnika" },
    { key: "trailer_plates", header: "Nr rej. naczepy" },
    { key: "total_net_weight", header: "Waga netto" },
    { key: "pallets_count", header: "Palety" },
    { key: "status", header: "Status" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wysyłki (WZ)</h1>
          <p className="text-muted-foreground">
            Zarządzaj transportami i dokumentami wysyłkowymi
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={exportData}
            columns={exportColumns}
            filename={`wysylki-${format(new Date(), "yyyy-MM-dd")}`}
            disabled={isLoading}
          />
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nowa wysyłka
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(Object.keys(statusConfig) as ShipmentStatus[]).map((status) => {
          const config = statusConfig[status];
          const count = shipments?.filter((s) => s.status === status).length || 0;
          return (
            <Card
              key={status}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter(status)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                  </div>
                  <config.icon className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po numerze, kliencie, kierowcy..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ShipmentStatus | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                {(Object.keys(statusConfig) as ShipmentStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusConfig[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Ładowanie...
            </div>
          ) : filteredShipments?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Brak wysyłek</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr wysyłki</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Kierowca</TableHead>
                  <TableHead>Tablice</TableHead>
                  <TableHead className="text-right">Waga netto</TableHead>
                  <TableHead className="text-right">Palety</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments?.map((shipment) => {
                  const config = statusConfig[shipment.status];
                  return (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-medium font-mono">
                        {shipment.shipment_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(shipment.dispatch_date), "dd.MM.yyyy", {
                          locale: pl,
                        })}
                      </TableCell>
                      <TableCell>{shipment.customer?.name || "-"}</TableCell>
                      <TableCell>{shipment.driver_name || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {shipment.truck_plates || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {shipment.total_net_weight.toFixed(1)} kg
                      </TableCell>
                      <TableCell className="text-right">
                        {shipment.pallets_count}
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>{config.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/shipping/${shipment.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Shipment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Nowa wysyłka
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Company & Facility */}
            <div className="space-y-2">
              <Label>Spółka*</Label>
              <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz spółkę" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.short_name || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Zakład*</Label>
              <Select
                value={formFacilityId}
                onValueChange={setFormFacilityId}
                disabled={!formCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz zakład" />
                </SelectTrigger>
                <SelectContent>
                  {filteredFacilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <Label>Odbiorca (Klient)</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz klienta" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Carrier */}
            <div className="space-y-2">
              <Label>Przewoźnik</Label>
              <Select value={formCarrierId} onValueChange={setFormCarrierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Transport własny" />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dispatch Date */}
            <div className="space-y-2">
              <Label>Data wysyłki</Label>
              <Input
                type="date"
                value={formDispatchDate}
                onChange={(e) => setFormDispatchDate(e.target.value)}
              />
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <Label>Temperatura transportu (°C)</Label>
              <Input
                type="number"
                step="0.1"
                value={formTemperature}
                onChange={(e) => setFormTemperature(e.target.value)}
              />
            </div>

            {/* Driver */}
            <div className="space-y-2">
              <Label>Kierowca</Label>
              <Input
                placeholder="Imię i nazwisko"
                value={formDriverName}
                onChange={(e) => setFormDriverName(e.target.value)}
              />
            </div>

            {/* Truck Plates */}
            <div className="space-y-2">
              <Label>Nr rej. ciągnika</Label>
              <Input
                placeholder="np. WPI 12345"
                value={formTruckPlates}
                onChange={(e) => setFormTruckPlates(e.target.value)}
              />
            </div>

            {/* Trailer Plates */}
            <div className="space-y-2 col-span-2">
              <Label>Nr rej. naczepy</Label>
              <Input
                placeholder="np. WPI 54321"
                value={formTrailerPlates}
                onChange={(e) => setFormTrailerPlates(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleCreateShipment}
              disabled={!formCompanyId || !formFacilityId || createShipment.isPending}
            >
              {createShipment.isPending ? "Tworzenie..." : "Utwórz wysyłkę"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
