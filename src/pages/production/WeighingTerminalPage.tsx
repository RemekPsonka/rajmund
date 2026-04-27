import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StateMachineBadge } from "@/components/production/StateMachineBadge";
import { STATE_MACHINES, type WeighingState } from "@/lib/stateMachines";
import {
  Users,
  Check,
  Scale,
  Package,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { mockScaleRead, sleep } from "@/lib/mockHardware";
import { TerminalHeader } from "@/components/production/TerminalHeader";
import { TerminalFooter } from "@/components/production/TerminalFooter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useProducts } from "@/hooks/useProducts";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useEmployees } from "@/hooks/useEmployees";
import { useDevices } from "@/hooks/useDevices";
import {
  useProductionOrders,
  useCreateProductionLog,
  useProductionLogs,
  useProductionInputs,
} from "@/hooks/useProductionOrders";
import { cn } from "@/lib/utils";

// Container types with standard weights
const CONTAINER_TYPES = [
  { code: "E2", name: "Pojemnik E2", weight: 2.0 },
  { code: "E1", name: "Pojemnik E1", weight: 1.5 },
  { code: "KOSZ", name: "Kosz plastikowy", weight: 3.0 },
  { code: "KARTON", name: "Karton", weight: 0.5 },
];

export default function WeighingTerminalPage() {
  const navigate = useNavigate();

  // Context state
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedScaleId, setSelectedScaleId] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<string>("");

  // Personnel state
  const [weighingEmployeeId, setWeighingEmployeeId] = useState<string>("");
  const [preparingEmployeeId, setPreparingEmployeeId] = useState<string>("");

  // Product & weighing state
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [containerType, setContainerType] = useState<string>("E2");
  const [containerCount, setContainerCount] = useState<number>(1);
  const [weightGross, setWeightGross] = useState<number>(0);
  const [isScaleReading, setIsScaleReading] = useState(false);

  // Queries
  const { data: orders } = useProductionOrders("Open");
  const { data: employees } = useEmployees();
  const { data: products } = useProducts();
  const { data: scales } = useDevices(undefined, "SCALE");
  const { data: stations } = useDevices(undefined, "STATION");
  const { data: logs } = useProductionLogs(selectedOrderId || undefined);
  const { data: inputs } = useProductionInputs(selectedOrderId || undefined);
  const createLog = useCreateProductionLog();

  // Filter products - only finished products (not raw materials)
  const finishedProducts = products?.filter((p) => !p.is_raw_material) || [];

  // Calculate weights
  const selectedContainer = CONTAINER_TYPES.find((c) => c.code === containerType);
  const totalTare = (selectedContainer?.weight || 0) * containerCount;
  const weightNet = Math.max(0, weightGross - totalTare);
  const weightPerContainer = containerCount > 0 ? weightNet / containerCount : 0;

  // Get the first active input batch for traceability
  const activeSourceBatchId = inputs && inputs.length > 0 ? inputs[0].batch_id : undefined;

  // Mock scale reading
  const readFromScale = async () => {
    setIsScaleReading(true);
    await sleep(800);
    // Bazowa waga ~12kg/pojemnik (typowy E2 z mięsem); jitter ±2% via mockScaleRead.
    const baseWeight = containerCount * 12 + containerCount * 1.5;
    setWeightGross(mockScaleRead(baseWeight));
    setIsScaleReading(false);
    toast.success("Odczyt z wagi pobrany");
  };

  // Submit weighing
  const handleSubmit = async () => {
    if (!selectedOrderId) {
      toast.error("Wybierz zlecenie produkcyjne");
      return;
    }
    if (!selectedProductId) {
      toast.error("Wybierz produkt");
      return;
    }
    if (!weighingEmployeeId) {
      toast.error("Wybierz pracownika wagowego");
      return;
    }
    if (weightGross <= 0) {
      toast.error("Pobierz odczyt z wagi");
      return;
    }

    try {
      await createLog.mutateAsync({
        production_order_id: selectedOrderId,
        employee_id: weighingEmployeeId,
        prepared_by_employee_id: preparingEmployeeId || undefined,
        product_id: selectedProductId,
        source_batch_id: activeSourceBatchId,
        weight_gross: weightGross,
        weight_tare: totalTare,
        packaging_type: containerType,
        packaging_count: containerCount,
        scale_device_id: selectedScaleId || undefined,
      });

      toast.success(`Zapisano: ${containerCount} poj. × ${weightPerContainer.toFixed(2)} kg = ${weightNet.toFixed(2)} kg`);

      // Reset for next weighing (keep context and employees)
      setWeightGross(0);
      setSelectedProductId("");
      setContainerCount(1);
    } catch {
      // Error handled by hook
    }
  };

  // Reset all
  const handleReset = () => {
    setWeightGross(0);
    setSelectedProductId("");
    setContainerCount(1);
    setWeighingEmployeeId("");
    setPreparingEmployeeId("");
  };

  const selectedOrder = orders?.find((o) => o.id === selectedOrderId);
  const todayLogsCount = logs?.length || 0;
  const todayTotalWeight = logs?.reduce((sum, log) => sum + log.weight_net, 0) || 0;

  // State-machine derive (UI-only, brak persystencji)
  const weighingState: WeighingState = useMemo(() => {
    if (selectedOrder?.status === "Closed") return "Transferred";
    if (!selectedOrderId || !weighingEmployeeId) return "Pending";
    if (weightGross > 0) return "Gross_Read";
    if (containerCount > 0) return "Tare_Read";
    return "Pending";
  }, [selectedOrder?.status, selectedOrderId, weighingEmployeeId, weightGross, containerCount]);

  // Get employee names for display
  const getEmployeeName = (id: string) => {
    const emp = employees?.find((e) => e.id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : "";
  };

  // Sprint 2.6 — ostrzeżenie przy próbie wyjścia z niezakończoną pracą
  const isDirty = !!selectedOrderId && (
    weightGross > 0 ||
    !!selectedProductId ||
    !!weighingEmployeeId ||
    !!preparingEmployeeId
  );
  useUnsavedChangesWarning(isDirty);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-[68px]">
      <TerminalHeader kind="weighing" title="Terminal Wagowy" icon={Scale} onBack={() => navigate("/")} />
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Terminal Wagowy</h1>
            <p className="text-sm text-muted-foreground">MES - Moduł Produkcji</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Dzisiaj</p>
            <p className="font-semibold">{todayLogsCount} ważeń • {todayTotalWeight.toFixed(1)} kg</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      {/* State Machine */}
      <div className="px-4 py-2 shrink-0 border-b">
        <StateMachineBadge states={STATE_MACHINES.weighing} current={weighingState} />
      </div>

      {/* Context Bar - Order, Scale, Station Selection */}
      <div className="bg-primary/5 border-b px-4 py-3 shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium shrink-0">Zlecenie:</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger className="w-[280px] h-10">
                <SelectValue placeholder="Wybierz zlecenie" />
              </SelectTrigger>
              <SelectContent>
                {orders?.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    <span className="font-medium">{order.order_number}</span>
                    <span className="text-muted-foreground ml-2">• {order.facility?.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium shrink-0">
              <Scale className="h-4 w-4 inline mr-1" />
              Waga:
            </Label>
            <Select value={selectedScaleId} onValueChange={setSelectedScaleId}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="Wybierz wagę" />
              </SelectTrigger>
              <SelectContent>
                {scales && scales.length > 0 ? (
                  scales.map((scale) => (
                    <SelectItem key={scale.id} value={scale.id}>
                      {scale.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="manual" disabled>
                    Brak wag w systemie
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium shrink-0">
              <Settings className="h-4 w-4 inline mr-1" />
              Stanowisko:
            </Label>
            <Select value={selectedStationId} onValueChange={setSelectedStationId}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="Opcjonalne" />
              </SelectTrigger>
              <SelectContent>
                {stations && stations.length > 0 ? (
                  stations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    Brak stanowisk
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedOrder && (
            <Badge variant="outline" className="text-sm px-3 py-1 ml-auto">
              {selectedOrder.type === "Decomposition" ? "Rozbiór" :
                selectedOrder.type === "Processing" ? "Przetwórstwo" : "Pakowanie"}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-auto">
        {/* Left Column - Personnel & Products */}
        <div className="space-y-4 lg:col-span-2">
          {/* Personnel Section */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  weighingEmployeeId ? "bg-success text-success-foreground" : "bg-muted"
                )}>
                  {weighingEmployeeId ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="font-semibold">Personel</h3>
                  <p className="text-sm text-muted-foreground">Wybierz pracowników</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Wagowy (kto waży) *</Label>
                  <Select value={weighingEmployeeId} onValueChange={setWeighingEmployeeId}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Wybierz pracownika" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.filter(e => e.is_active).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                          {emp.job_position && (
                            <span className="text-muted-foreground ml-2">• {emp.job_position}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rozbieracz (kto przygotował)</Label>
                  <Select 
                    value={preparingEmployeeId || "none"} 
                    onValueChange={(v) => setPreparingEmployeeId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Opcjonalne" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nie wybrano —</SelectItem>
                      {employees?.filter(e => e.is_active).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                          {emp.job_position && (
                            <span className="text-muted-foreground ml-2">• {emp.job_position}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Selection */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  selectedProductId ? "bg-success text-success-foreground" : "bg-muted"
                )}>
                  {selectedProductId ? <Check className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="font-semibold">Produkt</h3>
                  <p className="text-sm text-muted-foreground">Co ważymy?</p>
                </div>
              </div>

              {finishedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Brak produktów gotowych w kartotece</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {finishedProducts.map((product) => (
                    <Button
                      key={product.id}
                      variant={selectedProductId === product.id ? "default" : "outline"}
                      className={cn(
                        "h-16 text-sm font-medium flex-col gap-0.5 px-2",
                        selectedProductId === product.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <span className="line-clamp-2 text-center">{product.name}</span>
                      {product.sku && (
                        <span className="text-xs opacity-70">{product.sku}</span>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Scale & Containers */}
        <div className="space-y-4">
          {/* Containers Section */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3">Pojemniki</h4>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Typ pojemnika</Label>
                  <Select value={containerType} onValueChange={setContainerType}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTAINER_TYPES.map((ct) => (
                        <SelectItem key={ct.code} value={ct.code}>
                          {ct.name} ({ct.weight} kg)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ilość pojemników w słupku</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setContainerCount((c) => Math.max(1, c - 1))}
                      disabled={containerCount <= 1}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      className="h-10 text-center text-lg font-bold w-20"
                      value={containerCount}
                      onChange={(e) => setContainerCount(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setContainerCount((c) => Math.min(20, c + 1))}
                      disabled={containerCount >= 20}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tara łączna:</span>
                    <span className="font-mono font-medium">{totalTare.toFixed(2)} kg</span>
                  </div>
                  {weightNet > 0 && containerCount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Waga/pojemnik:</span>
                      <span className="font-mono font-medium">{weightPerContainer.toFixed(2)} kg</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scale Section */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3">Waga</h4>

              {/* Digital Display */}
              <div className="bg-foreground text-background rounded-lg p-4 mb-3 font-mono text-center">
                <div className="text-4xl font-bold tracking-wider">
                  {weightGross.toFixed(2)}
                </div>
                <div className="text-sm mt-1 opacity-70">kg brutto</div>
              </div>

              <Button
                className="w-full h-12 text-base mb-3"
                onClick={readFromScale}
                disabled={isScaleReading}
              >
                {isScaleReading ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Odczyt...
                  </>
                ) : (
                  <>
                    <Scale className="h-4 w-4 mr-2" />
                    POBIERZ Z WAGI
                  </>
                )}
              </Button>

              {/* Net Weight Display */}
              <div className="bg-success/10 border border-success/30 rounded-md p-3 text-center">
                <div className="text-sm text-muted-foreground mb-1">Netto</div>
                <div className="text-3xl font-bold text-success font-mono">
                  {weightNet.toFixed(2)} kg
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            className="w-full h-16 text-xl font-bold"
            size="lg"
            disabled={!selectedOrderId || !selectedProductId || !weighingEmployeeId || weightGross <= 0 || createLog.isPending}
            onClick={handleSubmit}
          >
            {createLog.isPending ? "ZAPISYWANIE..." : (
              <>
                <Check className="h-6 w-6 mr-2" />
                ZATWIERDŹ {containerCount} poj.
              </>
            )}
          </Button>

          {/* Recent Logs */}
          {logs && logs.length > 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">
                  Ostatnie ważenia
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {logs.slice(0, 8).map((log) => (
                    <div
                      key={log.id}
                      className="flex justify-between items-center text-sm py-1.5 border-b last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{log.product?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {log.packaging_count} poj. • {log.weighing_employee ? getEmployeeName(log.employee_id || "") : "—"}
                        </div>
                      </div>
                      <span className="font-mono font-medium ml-2 shrink-0">
                        {log.weight_net.toFixed(2)} kg
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <TerminalFooter operator={null} />
    </div>
  );
}
