import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Package,
  ArrowLeft,
  Printer,
  Check,
  Lock,
  Truck,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import {
  useHandlingUnits,
  useCreateHandlingUnit,
  useUpdateHandlingUnitStatus,
  useMarkLabelPrinted,
  usePalletContents,
  useUnassignedProductionLogs,
  useAssignLogToHandlingUnit,
  type HandlingUnit,
} from "@/hooks/useHandlingUnits";
import { PalletLabel } from "@/components/production/PalletLabel";
import { cn } from "@/lib/utils";

const TARGET_PALLET_WEIGHT = 900; // kg

export default function PalletizationPage() {
  const navigate = useNavigate();
  
  // Context
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  
  // State
  const [selectedPallet, setSelectedPallet] = useState<HandlingUnit | null>(null);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showAddItemsDialog, setShowAddItemsDialog] = useState(false);
  
  const labelRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();
  const { data: pallets } = useHandlingUnits(undefined, selectedFacilityId || undefined);
  const { data: palletContents } = usePalletContents(selectedPallet?.id);
  const { data: unassignedLogs } = useUnassignedProductionLogs(selectedFacilityId || undefined);
  
  // Mutations
  const createPallet = useCreateHandlingUnit();
  const updateStatus = useUpdateHandlingUnitStatus();
  const markLabelPrinted = useMarkLabelPrinted();
  const assignLog = useAssignLogToHandlingUnit();

  // Filter facilities by company
  const filteredFacilities = facilities?.filter(f => f.company_id === selectedCompanyId) || [];
  
  // Open and closed pallets
  const openPallets = pallets?.filter(p => p.status === "Open") || [];
  const closedPallets = pallets?.filter(p => p.status === "Closed") || [];

  // Create new pallet
  const handleCreatePallet = async () => {
    if (!selectedCompanyId || !selectedFacilityId) {
      toast.error("Wybierz spółkę i zakład");
      return;
    }

    try {
      const result = await createPallet.mutateAsync({
        company_id: selectedCompanyId,
        facility_id: selectedFacilityId,
        type: "Pallet",
      });
      
      setSelectedPallet(result as HandlingUnit);
    } catch {
      // Error handled by hook
    }
  };

  // Close pallet
  const handleClosePallet = async () => {
    if (!selectedPallet) return;
    
    try {
      await updateStatus.mutateAsync({
        id: selectedPallet.id,
        status: "Closed",
      });
      setSelectedPallet(null);
      toast.success("Paleta zamknięta");
    } catch {
      // Error handled
    }
  };

  // Add item to pallet
  const handleAddItem = async (logId: string) => {
    if (!selectedPallet) return;
    
    try {
      await assignLog.mutateAsync({
        logId,
        handlingUnitId: selectedPallet.id,
      });
    } catch {
      // Error handled
    }
  };

  // Print label
  const handlePrintLabel = () => {
    setShowLabelDialog(true);
    if (selectedPallet) {
      markLabelPrinted.mutate(selectedPallet.id);
    }
  };

  // Calculate progress percentage
  const progressPercent = selectedPallet 
    ? Math.min(100, (selectedPallet.total_net_weight / TARGET_PALLET_WEIGHT) * 100)
    : 0;

  // Prepare product summary for label
  const productSummary = palletContents?.reduce((acc, log) => {
    const existing = acc.find(p => p.name === log.product?.name);
    if (existing) {
      existing.weight += log.weight_net;
      existing.count += 1;
    } else {
      acc.push({
        name: log.product?.name || "Nieznany",
        weight: log.weight_net,
        count: 1,
      });
    }
    return acc;
  }, [] as { name: string; weight: number; count: number }[]) || [];

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);
  const selectedFacility = facilities?.find(f => f.id === selectedFacilityId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/production/orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Paletyzacja</h1>
              <p className="text-sm text-muted-foreground">MES - Pakowanie i Wysyłka</p>
            </div>
          </div>
        </div>
      </header>

      {/* Context Bar */}
      <div className="bg-primary/5 border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Spółka:</span>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Wybierz spółkę" />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.short_name || company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Zakład:</span>
            <Select 
              value={selectedFacilityId} 
              onValueChange={setSelectedFacilityId}
              disabled={!selectedCompanyId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Wybierz zakład" />
              </SelectTrigger>
              <SelectContent>
                {filteredFacilities.map((facility) => (
                  <SelectItem key={facility.id} value={facility.id}>
                    {facility.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="ml-auto"
            onClick={handleCreatePallet}
            disabled={!selectedCompanyId || !selectedFacilityId || createPallet.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nowa Paleta
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-auto">
        {!selectedCompanyId || !selectedFacilityId ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Wybierz spółkę i zakład aby rozpocząć</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Open Pallets */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Otwarte palety ({openPallets.length})
              </h2>
              
              {openPallets.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>Brak otwartych palet</p>
                    <Button className="mt-4" onClick={handleCreatePallet}>
                      <Plus className="h-4 w-4 mr-2" />
                      Utwórz pierwszą
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {openPallets.map((pallet) => (
                    <Card
                      key={pallet.id}
                      className={cn(
                        "cursor-pointer transition-all",
                        selectedPallet?.id === pallet.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedPallet(pallet)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-medium">{pallet.sscc_number}</span>
                          <Badge variant="outline">{pallet.items_count} szt.</Badge>
                        </div>
                        <Progress 
                          value={(pallet.total_net_weight / TARGET_PALLET_WEIGHT) * 100} 
                          className="h-2"
                        />
                        <div className="flex justify-between mt-1 text-sm text-muted-foreground">
                          <span>{pallet.total_net_weight.toFixed(1)} kg</span>
                          <span>{TARGET_PALLET_WEIGHT} kg</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Closed Pallets */}
              {closedPallets.length > 0 && (
                <>
                  <h2 className="font-semibold text-lg flex items-center gap-2 mt-6">
                    <Lock className="h-5 w-5" />
                    Zamknięte ({closedPallets.length})
                  </h2>
                  <div className="space-y-2">
                    {closedPallets.slice(0, 5).map((pallet) => (
                      <Card key={pallet.id} className="opacity-60">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm">{pallet.sscc_number}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{pallet.total_net_weight.toFixed(1)} kg</span>
                              {pallet.label_printed && <Printer className="h-4 w-4 text-success" />}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Center: Selected Pallet Details */}
            <div className="lg:col-span-2">
              {selectedPallet ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Paleta: {selectedPallet.sscc_number}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowAddItemsDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Dodaj towar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handlePrintLabel}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Drukuj etykietę
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleClosePallet}
                          disabled={selectedPallet.items_count === 0}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Zamknij
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Weight Progress */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Postęp pakowania</span>
                        <span className="font-mono font-bold text-lg">
                          {selectedPallet.total_net_weight.toFixed(1)} / {TARGET_PALLET_WEIGHT} kg
                        </span>
                      </div>
                      <Progress 
                        value={progressPercent}
                        className={cn(
                          "h-6",
                          progressPercent >= 90 && progressPercent < 100 && "[&>div]:bg-success",
                          progressPercent >= 100 && "[&>div]:bg-warning"
                        )}
                      />
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>{selectedPallet.items_count} pozycji</span>
                        <span>
                          {progressPercent >= 90 && progressPercent < 100 && (
                            <span className="text-success">✓ Paleta gotowa do zamknięcia</span>
                          )}
                          {progressPercent >= 100 && (
                            <span className="text-warning">⚠ Przekroczono wagę docelową</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Contents Table */}
                    {palletContents && palletContents.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produkt</TableHead>
                            <TableHead>Pracownik</TableHead>
                            <TableHead className="text-right">Waga netto</TableHead>
                            <TableHead className="text-right">Godzina</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {palletContents.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{log.product?.name}</p>
                                  {log.product?.sku && (
                                    <p className="text-xs text-muted-foreground">{log.product.sku}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {log.employee 
                                  ? `${log.employee.first_name} ${log.employee.last_name}`
                                  : "-"
                                }
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {log.weight_net.toFixed(2)} kg
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {new Date(log.created_at).toLocaleTimeString("pl-PL", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Paleta jest pusta</p>
                        <Button className="mt-4" onClick={() => setShowAddItemsDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Dodaj pierwszy towar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Wybierz paletę z listy lub utwórz nową</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Items Dialog */}
      <Dialog open={showAddItemsDialog} onOpenChange={setShowAddItemsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dodaj towar do palety</DialogTitle>
          </DialogHeader>
          
          {unassignedLogs && unassignedLogs.length > 0 ? (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkt</TableHead>
                    <TableHead className="text-right">Waga netto</TableHead>
                    <TableHead className="text-right">Godzina</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.product?.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {log.weight_net.toFixed(2)} kg
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleAddItem(log.id)}
                          disabled={assignLog.isPending}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Brak nieprzypisanych towarów do dodania</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Label Preview Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent className="max-w-fit">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Podgląd etykiety</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4 mr-2" />
                Drukuj
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPallet && (
            <div className="flex justify-center p-4 bg-gray-100 rounded-lg">
              <PalletLabel
                ref={labelRef}
                companyName={selectedCompany?.name || ""}
                ssccNumber={selectedPallet.sscc_number}
                productSummary={productSummary}
                totalNetWeight={selectedPallet.total_net_weight}
                totalGrossWeight={selectedPallet.total_gross_weight}
                productionDate={selectedPallet.production_date}
                facilityName={selectedFacility?.name}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
