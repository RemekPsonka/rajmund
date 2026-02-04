import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  Truck,
  Package,
  FileText,
  Plus,
  Trash2,
  Printer,
  Scan,
  Check,
  AlertCircle,
  Edit,
  Save,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Separator } from "@/components/ui/separator";

import {
  useShipment,
  useShipmentItems,
  useShipmentTraceability,
  usePackagingTransactions,
  useUpdateShipment,
  useAddShipmentItem,
  useRemoveShipmentItem,
  useAddPackagingTransaction,
  useAvailablePallets,
  useFindPalletBySSCC,
  useVerifyItemWeight,
  type ShipmentStatus,
} from "@/hooks/useShipments";
import { useBatches } from "@/hooks/useBatches";

import { HDIDocument } from "@/components/shipping/documents/HDIDocument";
import { PackingListDocument } from "@/components/shipping/documents/PackingListDocument";
import { CMRDocument } from "@/components/shipping/documents/CMRDocument";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const PACKAGING_TYPES = ["E2", "H1", "Paleta EUR", "Kosz", "Karton"];

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State
  const [scanCode, setScanCode] = useState("");
  const [showAddPalletDialog, setShowAddPalletDialog] = useState(false);
  const [showPackagingDialog, setShowPackagingDialog] = useState(false);
  const [packagingType, setPackagingType] = useState("E2");
  const [packagingQty, setPackagingQty] = useState("0");
  const [isEditing, setIsEditing] = useState(false);
  const [editDriverName, setEditDriverName] = useState("");
  const [editTruckPlates, setEditTruckPlates] = useState("");
  const [editTrailerPlates, setEditTrailerPlates] = useState("");
  const [editTemperature, setEditTemperature] = useState("");
  const [editSealNumber, setEditSealNumber] = useState("");
  const [verifyingItemId, setVerifyingItemId] = useState<string | null>(null);
  const [verifyWeight, setVerifyWeight] = useState("");

  // Queries
  const { data: shipment, isLoading } = useShipment(id);
  const { data: items } = useShipmentItems(id);
  const { data: traceability } = useShipmentTraceability(id);
  const { data: packagingTransactions } = usePackagingTransactions(id);
  const { data: availablePallets } = useAvailablePallets(shipment?.facility_id);
  const { data: batches } = useBatches();

  // Mutations
  const updateShipment = useUpdateShipment();
  const addItem = useAddShipmentItem();
  const removeItem = useRemoveShipmentItem();
  const addPackaging = useAddPackagingTransaction();
  const findPallet = useFindPalletBySSCC();
  const verifyItem = useVerifyItemWeight();

  // Handlers
  const handleScan = useCallback(async () => {
    if (!scanCode.trim() || !id) return;

    try {
      const pallet = await findPallet.mutateAsync(scanCode.trim());
      await addItem.mutateAsync({
        shipment_id: id,
        handling_unit_id: pallet.id,
      });
      setScanCode("");
    } catch (error) {
      toast.error("Nie znaleziono palety lub jest już załadowana");
    }
  }, [scanCode, id, findPallet, addItem]);

  const handleAddPallet = async (palletId: string) => {
    if (!id) return;
    await addItem.mutateAsync({
      shipment_id: id,
      handling_unit_id: palletId,
    });
    setShowAddPalletDialog(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!id) return;
    await removeItem.mutateAsync({ id: itemId, shipmentId: id });
  };

  const handleAddPackaging = async () => {
    if (!id || !shipment?.customer_id) return;
    await addPackaging.mutateAsync({
      company_id: shipment.company_id,
      shipment_id: id,
      contractor_id: shipment.customer_id,
      type: "Issued",
      packaging_type: packagingType,
      quantity: parseInt(packagingQty) || 0,
    });
    setShowPackagingDialog(false);
    setPackagingQty("0");
  };

  const handleVerifyWeight = async (itemId: string) => {
    if (!id || !verifyWeight) return;
    const weight = parseFloat(verifyWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Podaj prawidłową wagę");
      return;
    }
    await verifyItem.mutateAsync({ itemId, shipmentId: id, verifiedWeight: weight });
    setVerifyingItemId(null);
    setVerifyWeight("");
  };

  const handleUpdateStatus = async (status: ShipmentStatus) => {
    if (!id) return;
    
    // Check if all items are verified before shipping
    if (status === "Shipped" && items && items.length > 0) {
      const unverifiedItems = items.filter(item => item.verified_weight === null);
      if (unverifiedItems.length > 0) {
        toast.error(`Zweryfikuj wagę wszystkich pozycji przed wysyłką (${unverifiedItems.length} niezweryfikowanych)`);
        return;
      }
    }
    
    await updateShipment.mutateAsync({ id, status });
  };

  const handleStartEditing = () => {
    if (!shipment) return;
    setEditDriverName(shipment.driver_name || "");
    setEditTruckPlates(shipment.truck_plates || "");
    setEditTrailerPlates(shipment.trailer_plates || "");
    setEditTemperature(shipment.transport_temperature?.toString() || "");
    setEditSealNumber(shipment.seal_number || "");
    setIsEditing(true);
  };

  const handleSaveEdits = async () => {
    if (!id) return;
    await updateShipment.mutateAsync({
      id,
      driver_name: editDriverName,
      truck_plates: editTruckPlates,
      trailer_plates: editTrailerPlates,
      transport_temperature: editTemperature ? parseFloat(editTemperature) : undefined,
      seal_number: editSealNumber,
    });
    setIsEditing(false);
  };

  // PDF Generation
  const generatePDF = async (type: "hdi" | "packing" | "cmr") => {
    if (!shipment) return;

    // CMR validation - require transport data
    if (type === "cmr") {
      const missingFields: string[] = [];
      if (!shipment.driver_name) missingFields.push("kierowca");
      if (!shipment.truck_plates) missingFields.push("nr rejestracyjny ciągnika");
      if (!shipment.customer_id) missingFields.push("odbiorca");
      
      if (missingFields.length > 0) {
        toast.error(`Uzupełnij dane transportu przed wygenerowaniem CMR: ${missingFields.join(", ")}`);
        return;
      }
    }

    let doc;
    const companyData = {
      name: shipment.company?.name || "",
      tax_id: shipment.company?.tax_id || "",
    };
    const facilityData = {
      name: shipment.facility?.name || "",
      vet_approval_number: shipment.facility?.vet_approval_number || null,
    };
    const customerData = shipment.customer
      ? { name: shipment.customer.name, vet_number: shipment.customer.vet_number }
      : null;
    const carrierData = shipment.carrier ? { name: shipment.carrier.name } : null;

    if (type === "hdi") {
      doc = (
        <HDIDocument
          shipment={shipment}
          company={companyData}
          facility={facilityData}
          customer={customerData}
          carrier={carrierData}
          traceability={traceability || []}
          totalNetWeight={shipment.total_net_weight}
          totalGrossWeight={shipment.total_gross_weight}
          palletsCount={shipment.pallets_count}
        />
      );
    } else if (type === "packing") {
      doc = (
        <PackingListDocument
          shipment={shipment}
          company={companyData}
          customer={customerData}
          items={items || []}
          totalNetWeight={shipment.total_net_weight}
          totalGrossWeight={shipment.total_gross_weight}
          palletsCount={shipment.pallets_count}
        />
      );
    } else {
      const goodsDescription = items
        ?.map((i) => i.handling_unit?.sscc_number || i.product?.name)
        .filter(Boolean)
        .join(", ") || "Produkty mięsne";

      // Extract address from company's main_address_json
      const companyAddress = shipment.company?.main_address_json as {
        street?: string;
        city?: string;
        postal_code?: string;
      } | null;
      const senderAddress = companyAddress 
        ? `${companyAddress.street || ""}, ${companyAddress.postal_code || ""} ${companyAddress.city || ""}`.trim()
        : "";

      doc = (
        <CMRDocument
          shipment={shipment}
          sender={{ 
            name: companyData.name, 
            address: senderAddress || facilityData.name,
            country: "Polska" 
          }}
          recipient={customerData}
          carrier={carrierData}
          goodsDescription={goodsDescription}
          totalNetWeight={shipment.total_net_weight}
          totalGrossWeight={shipment.total_gross_weight}
          palletsCount={shipment.pallets_count}
        />
      );
    }

    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Nie znaleziono wysyłki</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/shipping")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            {shipment.shipment_number}
          </h1>
          <p className="text-muted-foreground">
            {shipment.customer?.name || "Brak klienta"} •{" "}
            {format(new Date(shipment.dispatch_date), "dd MMMM yyyy", { locale: pl })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shipment.status === "Planning" && (
            <Button onClick={() => handleUpdateStatus("Loading")}>
              Rozpocznij załadunek
            </Button>
          )}
          {shipment.status === "Loading" && (
            <Button onClick={() => handleUpdateStatus("Shipped")}>
              Wyślij transport
            </Button>
          )}
          {shipment.status === "Shipped" && (
            <Button onClick={() => handleUpdateStatus("Delivered")}>
              Potwierdź dostawę
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{shipment.pallets_count}</div>
            <div className="text-sm text-muted-foreground">Palet</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold font-mono">
              {shipment.total_net_weight.toFixed(1)} kg
            </div>
            <div className="text-sm text-muted-foreground">Waga netto</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold font-mono">
              {shipment.total_gross_weight.toFixed(1)} kg
            </div>
            <div className="text-sm text-muted-foreground">Waga brutto</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {shipment.transport_temperature !== null
                ? `${shipment.transport_temperature}°C`
                : "-"}
            </div>
            <div className="text-sm text-muted-foreground">Temperatura</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="loading" className="space-y-4">
        <TabsList>
          <TabsTrigger value="loading">
            <Package className="h-4 w-4 mr-2" />
            Załadunek
          </TabsTrigger>
          <TabsTrigger value="transport">
            <Truck className="h-4 w-4 mr-2" />
            Dane transportu
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Dokumenty
          </TabsTrigger>
          <TabsTrigger value="packaging">
            <Package className="h-4 w-4 mr-2" />
            Opakowania
          </TabsTrigger>
        </TabsList>

        {/* Loading Tab */}
        <TabsContent value="loading" className="space-y-4">
          {/* Scan to Load */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Scan-to-Load
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  className="h-12 text-lg font-mono flex-1"
                  placeholder="Zeskanuj kod SSCC palety..."
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                />
                <Button className="h-12 px-6" onClick={handleScan}>
                  <Check className="h-5 w-5 mr-2" />
                  Dodaj
                </Button>
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => setShowAddPalletDialog(true)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Wybierz ręcznie
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Loaded Items */}
          <Card>
            <CardHeader>
              <CardTitle>Załadowane pozycje ({items?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {items?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak załadowanych pozycji</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lp.</TableHead>
                      <TableHead>Nr Palety / Partii</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right">Sztuk</TableHead>
                      <TableHead className="text-right">Waga dekl.</TableHead>
                      <TableHead className="text-right">Waga zweryfikowana</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map((item, idx) => {
                      const declaredWeight = item.handling_unit?.total_net_weight || item.quantity || 0;
                      const isVerified = item.verified_weight !== null;
                      const weightDiff = isVerified ? Math.abs(((item.verified_weight! - declaredWeight) / declaredWeight) * 100) : 0;
                      const hasDifference = isVerified && weightDiff > 2;
                      
                      return (
                        <TableRow key={item.id} className={hasDifference ? "bg-destructive/10" : ""}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-mono">
                            {item.handling_unit?.sscc_number ||
                              item.batch?.internal_batch_number ||
                              "-"}
                          </TableCell>
                          <TableCell>{item.product?.name || "Paleta"}</TableCell>
                          <TableCell className="text-right">
                            {item.handling_unit?.items_count || 1}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {declaredWeight.toFixed(2)} kg
                          </TableCell>
                          <TableCell className="text-right">
                            {verifyingItemId === item.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="w-24 h-8 text-right font-mono"
                                  placeholder="kg"
                                  value={verifyWeight}
                                  onChange={(e) => setVerifyWeight(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleVerifyWeight(item.id)}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleVerifyWeight(item.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : isVerified ? (
                              <span className={`font-mono ${hasDifference ? "text-destructive font-bold" : "text-green-600"}`}>
                                {item.verified_weight!.toFixed(2)} kg
                                {hasDifference && (
                                  <span className="ml-1 text-xs">
                                    ({weightDiff > 0 ? "+" : ""}{((item.verified_weight! - declaredWeight) / declaredWeight * 100).toFixed(1)}%)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                onClick={() => {
                                  setVerifyingItemId(item.id);
                                  setVerifyWeight(declaredWeight.toFixed(2));
                                }}
                              >
                                <Scale className="h-3 w-3 mr-1" />
                                Zweryfikuj
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>

        {/* Transport Tab */}
        <TabsContent value="transport">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Dane transportu</CardTitle>
                {isEditing ? (
                  <Button onClick={handleSaveEdits}>
                    <Save className="h-4 w-4 mr-2" />
                    Zapisz
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleStartEditing}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edytuj
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Kierowca</Label>
                    {isEditing ? (
                      <Input
                        value={editDriverName}
                        onChange={(e) => setEditDriverName(e.target.value)}
                      />
                    ) : (
                      <p className="font-medium">{shipment.driver_name || "-"}</p>
                    )}
                  </div>
                  <div>
                    <Label>Nr rej. ciągnika</Label>
                    {isEditing ? (
                      <Input
                        value={editTruckPlates}
                        onChange={(e) => setEditTruckPlates(e.target.value)}
                      />
                    ) : (
                      <p className="font-medium font-mono">
                        {shipment.truck_plates || "-"}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Nr rej. naczepy</Label>
                    {isEditing ? (
                      <Input
                        value={editTrailerPlates}
                        onChange={(e) => setEditTrailerPlates(e.target.value)}
                      />
                    ) : (
                      <p className="font-medium font-mono">
                        {shipment.trailer_plates || "-"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>Temperatura transportu</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.1"
                        value={editTemperature}
                        onChange={(e) => setEditTemperature(e.target.value)}
                      />
                    ) : (
                      <p className="font-medium">
                        {shipment.transport_temperature !== null
                          ? `${shipment.transport_temperature}°C`
                          : "-"}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Nr plomby</Label>
                    {isEditing ? (
                      <Input
                        value={editSealNumber}
                        onChange={(e) => setEditSealNumber(e.target.value)}
                      />
                    ) : (
                      <p className="font-medium">{shipment.seal_number || "-"}</p>
                    )}
                  </div>
                  <div>
                    <Label>Przewoźnik</Label>
                    <p className="font-medium">
                      {shipment.carrier?.name || "Transport własny"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Generuj dokumenty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-2 hover:border-primary transition-colors cursor-pointer"
                  onClick={() => generatePDF("hdi")}>
                  <CardContent className="pt-6 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <h3 className="font-semibold text-lg mb-2">HDI</h3>
                    <p className="text-sm text-muted-foreground">
                      Handlowy Dokument Identyfikacyjny ze śladowością
                    </p>
                    <Button className="mt-4" variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Generuj PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 hover:border-primary transition-colors cursor-pointer"
                  onClick={() => generatePDF("packing")}>
                  <CardContent className="pt-6 text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <h3 className="font-semibold text-lg mb-2">Packing List</h3>
                    <p className="text-sm text-muted-foreground">
                      Lista pakowa z wagami i numerami palet
                    </p>
                    <Button className="mt-4" variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Generuj PDF
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 hover:border-primary transition-colors cursor-pointer"
                  onClick={() => generatePDF("cmr")}>
                  <CardContent className="pt-6 text-center">
                    <Truck className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <h3 className="font-semibold text-lg mb-2">CMR</h3>
                    <p className="text-sm text-muted-foreground">
                      Międzynarodowy list przewozowy
                    </p>
                    <Button className="mt-4" variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Generuj PDF
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Packaging Tab */}
        <TabsContent value="packaging">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Protokół opakowań</CardTitle>
                <Button onClick={() => setShowPackagingDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj opakowania
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {packagingTransactions?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Brak zarejestrowanych opakowań</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rodzaj</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">Ilość</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packagingTransactions?.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Badge variant={t.type === "Issued" ? "default" : "secondary"}>
                            {t.type === "Issued" ? "Wydano" : "Odebrano"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{t.packaging_type}</TableCell>
                        <TableCell className="text-right font-mono">
                          {t.quantity}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(t.created_at), "dd.MM.yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Pallet Dialog */}
      <Dialog open={showAddPalletDialog} onOpenChange={setShowAddPalletDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wybierz paletę</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            {availablePallets?.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Brak dostępnych palet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SSCC</TableHead>
                    <TableHead className="text-right">Waga netto</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availablePallets?.map((pallet) => (
                    <TableRow key={pallet.id}>
                      <TableCell className="font-mono">{pallet.sscc_number}</TableCell>
                      <TableCell className="text-right">
                        {pallet.total_net_weight.toFixed(1)} kg
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleAddPallet(pallet.id)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Packaging Dialog */}
      <Dialog open={showPackagingDialog} onOpenChange={setShowPackagingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wydaj opakowania</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rodzaj opakowania</Label>
              <Select value={packagingType} onValueChange={setPackagingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGING_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ilość</Label>
              <Input
                type="number"
                value={packagingQty}
                onChange={(e) => setPackagingQty(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackagingDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAddPackaging}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
