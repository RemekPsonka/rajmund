import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Check,
  Scale,
  Package,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useProducts } from "@/hooks/useProducts";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useProductionOrders,
  useCreateProductionLog,
  useProductionLogs,
  useProductionInputs,
} from "@/hooks/useProductionOrders";
import { cn } from "@/lib/utils";

const TARE_E2 = 2.0; // Default tare for E2 container

export default function WeighingTerminalPage() {
  const navigate = useNavigate();

  // State
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [verifiedEmployee, setVerifiedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [weightGross, setWeightGross] = useState<number>(0);
  const [weightTare, setWeightTare] = useState<number>(TARE_E2);
  const [isScaleReading, setIsScaleReading] = useState(false);

  // Queries
  const { data: orders } = useProductionOrders("Open");
  const { data: employees } = useEmployees();
  const { data: products } = useProducts();
  const { data: logs } = useProductionLogs(selectedOrderId || undefined);
  const { data: inputs } = useProductionInputs(selectedOrderId || undefined);
  const createLog = useCreateProductionLog();

  // Filter products - only finished products (not raw materials)
  const finishedProducts = products?.filter((p) => !p.is_raw_material) || [];

  // Verify employee by QR code
  const verifyEmployee = useCallback(() => {
    if (!employeeCode.trim()) return;
    
    const employee = employees?.find(
      (e) => e.qr_login_code.toLowerCase() === employeeCode.toLowerCase()
    );

    if (employee) {
      setVerifiedEmployee({
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
      });
      toast.success(`Zalogowano: ${employee.first_name} ${employee.last_name}`);
    } else {
      toast.error("Nie znaleziono pracownika o podanym kodzie");
      setVerifiedEmployee(null);
    }
  }, [employeeCode, employees]);

  // Handle employee code input
  useEffect(() => {
    if (employeeCode.length >= 4) {
      const timer = setTimeout(verifyEmployee, 500);
      return () => clearTimeout(timer);
    }
  }, [employeeCode, verifyEmployee]);

  // Mock scale reading
  const readFromScale = () => {
    setIsScaleReading(true);
    setTimeout(() => {
      // Simulate weight between 12.00 and 15.00 kg
      const mockWeight = 12 + Math.random() * 3;
      setWeightGross(Math.round(mockWeight * 100) / 100);
      setIsScaleReading(false);
      toast.success("Odczyt z wagi pobrany");
    }, 800);
  };

  // Calculate net weight
  const weightNet = Math.max(0, weightGross - weightTare);

  // Get the first active input batch for traceability
  const activeSourceBatchId = inputs && inputs.length > 0 ? inputs[0].batch_id : undefined;

  // Submit weighing
  const handleSubmit = async () => {
    if (!selectedOrderId || !selectedProductId || weightGross <= 0) {
      toast.error("Uzupełnij wszystkie wymagane pola");
      return;
    }

    try {
      await createLog.mutateAsync({
        production_order_id: selectedOrderId,
        employee_id: verifiedEmployee?.id,
        product_id: selectedProductId,
        source_batch_id: activeSourceBatchId, // Link to input batch for traceability
        weight_gross: weightGross,
        weight_tare: weightTare,
        packaging_type: "E2",
        packaging_count: 1,
        scale_device_id: "TERMINAL_01",
      });

      toast.success(`Zapisano: ${weightNet.toFixed(2)} kg`);
      
      // Reset for next weighing (keep employee logged in)
      setWeightGross(0);
      setSelectedProductId("");
    } catch {
      // Error handled by hook
    }
  };

  // Reset all
  const handleReset = () => {
    setWeightGross(0);
    setSelectedProductId("");
    setEmployeeCode("");
    setVerifiedEmployee(null);
  };

  const selectedOrder = orders?.find((o) => o.id === selectedOrderId);
  const todayLogsCount = logs?.length || 0;
  const todayTotalWeight = logs?.reduce((sum, log) => sum + log.weight_net, 0) || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

      {/* Context Bar - Order Selection */}
      <div className="bg-primary/5 border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Zlecenie:</span>
          <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
            <SelectTrigger className="w-[400px] h-12 text-base">
              <SelectValue placeholder="Wybierz zlecenie produkcyjne" />
            </SelectTrigger>
            <SelectContent>
              {orders?.map((order) => (
                <SelectItem key={order.id} value={order.id} className="py-3">
                  <span className="font-medium">{order.order_number}</span>
                  <span className="text-muted-foreground ml-2">
                    • {order.facility?.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOrder && (
            <Badge variant="outline" className="text-base px-3 py-1">
              {selectedOrder.type === "Decomposition" ? "Rozbiór" : 
               selectedOrder.type === "Processing" ? "Przetwórstwo" : "Pakowanie"}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-auto">
        {/* Left Column - Employee & Products */}
        <div className="space-y-6 lg:col-span-2">
          {/* Step 1: Employee */}
          <Card className="shadow-industrial">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  verifiedEmployee ? "bg-success text-success-foreground" : "bg-muted"
                )}>
                  {verifiedEmployee ? <Check className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Krok 1: Kto waży?</h3>
                  <p className="text-sm text-muted-foreground">Zeskanuj kod QR pracownika</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-center">
                <Input
                  className="h-14 text-xl font-mono flex-1"
                  placeholder="Zeskanuj lub wpisz kod QR..."
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verifyEmployee()}
                />
                {verifiedEmployee && (
                  <div className="flex items-center gap-2 text-success">
                    <Check className="h-6 w-6" />
                    <span className="text-xl font-semibold">{verifiedEmployee.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Product Selection */}
          <Card className="shadow-industrial">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  selectedProductId ? "bg-success text-success-foreground" : "bg-muted"
                )}>
                  {selectedProductId ? <Check className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Krok 2: Co ważymy?</h3>
                  <p className="text-sm text-muted-foreground">Wybierz produkt</p>
                </div>
              </div>

              {finishedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Brak produktów gotowych w kartotece</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {finishedProducts.map((product) => (
                    <Button
                      key={product.id}
                      variant={selectedProductId === product.id ? "default" : "outline"}
                      className={cn(
                        "h-20 text-lg font-medium flex-col gap-1",
                        selectedProductId === product.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <span>{product.name}</span>
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

        {/* Right Column - Scale & Submit */}
        <div className="space-y-6">
          {/* Step 3: Weight */}
          <Card className="shadow-industrial">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  weightGross > 0 ? "bg-success text-success-foreground" : "bg-muted"
                )}>
                  {weightGross > 0 ? <Check className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Krok 3: Waga</h3>
                  <p className="text-sm text-muted-foreground">Pobierz odczyt z wagi</p>
                </div>
              </div>

              {/* Digital Display */}
              <div className="bg-foreground text-background rounded-lg p-6 mb-4 font-mono text-center">
                <div className="text-5xl font-bold tracking-wider">
                  {weightGross.toFixed(2)}
                </div>
                <div className="text-xl mt-1 opacity-70">kg brutto</div>
              </div>

              <Button
                className="w-full h-14 text-lg mb-4"
                onClick={readFromScale}
                disabled={isScaleReading}
              >
                {isScaleReading ? (
                  <>
                    <RotateCcw className="h-5 w-5 mr-2 animate-spin" />
                    Odczyt...
                  </>
                ) : (
                  <>
                    <Scale className="h-5 w-5 mr-2" />
                    POBIERZ Z WAGI
                  </>
                )}
              </Button>

              {/* Tare & Net */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Tara (E2)</label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-12 text-lg font-mono"
                    value={weightTare}
                    onChange={(e) => setWeightTare(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Netto</label>
                  <div className="h-12 bg-success/10 border border-success/30 rounded-md flex items-center justify-center text-2xl font-bold text-success font-mono">
                    {weightNet.toFixed(2)} kg
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Submit */}
          <Button
            className="w-full h-20 text-2xl font-bold"
            size="lg"
            disabled={!selectedOrderId || !selectedProductId || weightGross <= 0 || createLog.isPending}
            onClick={handleSubmit}
          >
            {createLog.isPending ? "ZAPISYWANIE..." : (
              <>
                <Check className="h-8 w-8 mr-3" />
                ZATWIERDŹ
              </>
            )}
          </Button>

          {/* Recent Logs */}
          {logs && logs.length > 0 && (
            <Card className="shadow-industrial">
              <CardContent className="p-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">
                  Ostatnie ważenia
                </h4>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {logs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex justify-between items-center text-sm py-1 border-b last:border-0"
                    >
                      <span>{log.product?.name}</span>
                      <span className="font-mono font-medium">
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
    </div>
  );
}