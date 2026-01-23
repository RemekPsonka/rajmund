import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Check,
  Scale,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  Plus,
  Trash2,
  Cog,
  Snowflake,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

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

import { useProducts } from "@/hooks/useProducts";
import { useEmployees } from "@/hooks/useEmployees";
import { useBatches } from "@/hooks/useBatches";
import {
  useProductionOrders,
  useCreateProductionInput,
  useCreateProductionLog,
  useProductionInputs,
} from "@/hooks/useProductionOrders";
import { cn } from "@/lib/utils";

const MACHINES = [
  { id: "MASOWNICA_1", name: "Masownica 1" },
  { id: "MASOWNICA_2", name: "Masownica 2" },
  { id: "MASOWNICA_3", name: "Masownica 3" },
];

const DIRECTIONS = [
  { id: "freezer", name: "Mroźnia", icon: Snowflake, color: "text-blue-500" },
  { id: "kebab", name: "Kebab / Pakowanie", icon: ArrowRight, color: "text-orange-500" },
];

const TARE_DEFAULT = 2.0;

interface InputItem {
  id: string;
  batchNumber: string;
  productName: string;
  weight: number;
  batchId: string;
  productId: string;
}

export default function TumblerTerminalPage() {
  const navigate = useNavigate();

  // State - Context
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  
  // State - Employee
  const [employeeCode, setEmployeeCode] = useState("");
  const [verifiedEmployee, setVerifiedEmployee] = useState<{ id: string; name: string } | null>(null);
  
  // State - Input (Wsad)
  const [batchScanCode, setBatchScanCode] = useState("");
  const [inputItems, setInputItems] = useState<InputItem[]>([]);
  
  // State - Output (Wyjście)
  const [selectedProductId, setSelectedProductId] = useState("");
  const [direction, setDirection] = useState<string>("freezer");
  const [weightGross, setWeightGross] = useState(0);
  const [weightTare, setWeightTare] = useState(TARE_DEFAULT);
  const [isScaleReading, setIsScaleReading] = useState(false);
  
  // State - Step
  const [step, setStep] = useState<"input" | "output">("input");

  // Queries
  const { data: orders } = useProductionOrders("Open");
  const processingOrders = orders?.filter(o => o.type === "Processing") || [];
  const { data: employees } = useEmployees();
  const { data: products } = useProducts();
  const { data: batches } = useBatches();
  const { data: existingInputs } = useProductionInputs(selectedOrderId || undefined);
  
  const createInput = useCreateProductionInput();
  const createLog = useCreateProductionLog();

  // Finished products for output
  const finishedProducts = products?.filter(p => !p.is_raw_material) || [];
  
  // Total input weight
  const totalInputWeight = useMemo(() => 
    inputItems.reduce((sum, item) => sum + item.weight, 0),
    [inputItems]
  );
  
  // Net weight
  const weightNet = Math.max(0, weightGross - weightTare);

  // Verify employee
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
      toast.error("Nie znaleziono pracownika");
      setVerifiedEmployee(null);
    }
  }, [employeeCode, employees]);

  useEffect(() => {
    if (employeeCode.length >= 4) {
      const timer = setTimeout(verifyEmployee, 500);
      return () => clearTimeout(timer);
    }
  }, [employeeCode, verifyEmployee]);

  // Scan batch for input
  const handleBatchScan = useCallback(() => {
    if (!batchScanCode.trim()) return;
    
    const batch = batches?.find(
      b => b.internal_batch_number.toLowerCase() === batchScanCode.toLowerCase()
    );

    if (batch) {
      const product = products?.find(p => p.id === batch.product_id);
      
      // Check if already added
      if (inputItems.some(item => item.batchId === batch.id)) {
        toast.error("Ta partia jest już dodana");
        setBatchScanCode("");
        return;
      }

      setInputItems(prev => [...prev, {
        id: crypto.randomUUID(),
        batchNumber: batch.internal_batch_number,
        productName: product?.name || "Nieznany",
        weight: batch.current_quantity,
        batchId: batch.id,
        productId: batch.product_id,
      }]);
      
      toast.success(`Dodano: ${batch.internal_batch_number}`);
      setBatchScanCode("");
    } else {
      toast.error("Nie znaleziono partii");
    }
  }, [batchScanCode, batches, products, inputItems]);

  // Remove input item
  const handleRemoveItem = (id: string) => {
    setInputItems(prev => prev.filter(item => item.id !== id));
  };

  // Read from scale (mock)
  const readFromScale = () => {
    setIsScaleReading(true);
    setTimeout(() => {
      // Simulate weight - approximately 80-95% of input (tumbling yield)
      const baseWeight = totalInputWeight * (0.80 + Math.random() * 0.15);
      setWeightGross(Math.round(baseWeight * 100) / 100);
      setIsScaleReading(false);
      toast.success("Odczyt z wagi pobrany");
    }, 800);
  };

  // Save inputs (RW documents)
  const handleSaveInputs = async () => {
    if (!selectedOrderId || inputItems.length === 0) {
      toast.error("Dodaj co najmniej jeden wsad");
      return;
    }

    try {
      for (const item of inputItems) {
        await createInput.mutateAsync({
          production_order_id: selectedOrderId,
          batch_id: item.batchId,
          product_id: item.productId,
          weight: item.weight,
        });
      }
      
      toast.success("Zapisano wsad do zlecenia");
      setStep("output");
    } catch {
      // Error handled by hook
    }
  };

  // Save output (PW document)
  const handleSaveOutput = async () => {
    if (!selectedOrderId || !selectedProductId || weightGross <= 0) {
      toast.error("Uzupełnij wszystkie pola");
      return;
    }

    try {
      await createLog.mutateAsync({
        production_order_id: selectedOrderId,
        employee_id: verifiedEmployee?.id,
        product_id: selectedProductId,
        weight_gross: weightGross,
        weight_tare: weightTare,
        packaging_type: "Poliblok",
        packaging_count: 1,
        scale_device_id: selectedMachine,
      });

      toast.success(`Zapisano: ${weightNet.toFixed(2)} kg → ${direction === "freezer" ? "Mroźnia" : "Kebab"}`);
      
      // Reset for next batch
      setWeightGross(0);
      setSelectedProductId("");
    } catch {
      // Error handled by hook
    }
  };

  // Reset all
  const handleReset = () => {
    setInputItems([]);
    setWeightGross(0);
    setSelectedProductId("");
    setStep("input");
    setBatchScanCode("");
  };

  const selectedOrder = processingOrders.find(o => o.id === selectedOrderId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/production/orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Cog className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Terminal Masowni</h1>
              <p className="text-sm text-muted-foreground">MES - Przetwórstwo</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {verifiedEmployee && (
            <Badge variant="secondary" className="text-base px-3 py-1">
              <User className="h-4 w-4 mr-2" />
              {verifiedEmployee.name}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      {/* Context Bar */}
      <div className="bg-primary/5 border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Zlecenie:</span>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger className="w-[350px] h-10">
                <SelectValue placeholder="Wybierz zlecenie przetwórstwa" />
              </SelectTrigger>
              <SelectContent>
                {processingOrders.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
                    Brak otwartych zleceń przetwórstwa.
                    <br />
                    Utwórz zlecenie typu "Przetwórstwo" w module Zlecenia.
                  </div>
                ) : (
                  processingOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number} • {order.facility?.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Maszyna:</span>
            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="Wybierz maszynę" />
              </SelectTrigger>
              <SelectContent>
                {MACHINES.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrder && (
            <Badge variant="outline" className="ml-auto">
              Przetwórstwo
            </Badge>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant={step === "input" ? "default" : "outline"}
            size="sm"
            onClick={() => setStep("input")}
          >
            1. Wsad (Input)
          </Button>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={step === "output" ? "default" : "outline"}
            size="sm"
            onClick={() => setStep("output")}
            disabled={inputItems.length === 0}
          >
            2. Wyjście (Output)
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-auto">
        {!selectedOrderId || !selectedMachine ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Wybierz zlecenie i maszynę aby rozpocząć</p>
            </div>
          </div>
        ) : step === "input" ? (
          /* Step 1: Input (Wsad) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Employee + Scan */}
            <div className="space-y-4">
              {/* Employee Login */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-5 w-5" />
                    Pracownik
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      className="h-12 text-lg font-mono flex-1"
                      placeholder="Zeskanuj kod QR pracownika..."
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && verifyEmployee()}
                    />
                    {verifiedEmployee && (
                      <div className="flex items-center text-success px-3">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Batch Scanning */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="h-5 w-5" />
                    Skanuj pojemniki wsadu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      className="h-14 text-xl font-mono flex-1"
                      placeholder="Skanuj numer partii..."
                      value={batchScanCode}
                      onChange={(e) => setBatchScanCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleBatchScan()}
                    />
                    <Button size="lg" className="h-14 px-6" onClick={handleBatchScan}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Input Items Table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Wsad do masownicy</CardTitle>
                  <Badge variant="secondary" className="text-lg px-3">
                    Σ {totalInputWeight.toFixed(1)} kg
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {inputItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Zeskanuj pojemniki aby dodać wsad</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partia</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead className="text-right">Waga</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inputItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {item.batchNumber}
                          </TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {item.weight.toFixed(2)} kg
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {inputItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      className="w-full h-14 text-lg"
                      onClick={handleSaveInputs}
                      disabled={createInput.isPending}
                    >
                      {createInput.isPending ? "Zapisywanie..." : (
                        <>
                          <Check className="h-5 w-5 mr-2" />
                          Potwierdź wsad i przejdź dalej
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Step 2: Output (Wyjście) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Podsumowanie wsadu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold font-mono">{totalInputWeight.toFixed(1)}</p>
                  <p className="text-muted-foreground">kg surowca</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{inputItems.length} pozycji</p>
                  {existingInputs && existingInputs.length > 0 && (
                    <p className="mt-2">Zarejestrowane wsady: {existingInputs.length}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Product & Direction */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Wyrób i kierunek</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Selection */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Wyrób gotowy</label>
                  <div className="grid grid-cols-2 gap-2">
                    {finishedProducts.slice(0, 6).map((product) => (
                      <Button
                        key={product.id}
                        variant={selectedProductId === product.id ? "default" : "outline"}
                        className={cn(
                          "h-16 text-sm",
                          selectedProductId === product.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedProductId(product.id)}
                      >
                        {product.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Direction Selection */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Kierunek</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DIRECTIONS.map((dir) => (
                      <Button
                        key={dir.id}
                        variant={direction === dir.id ? "default" : "outline"}
                        className={cn(
                          "h-14",
                          direction === dir.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setDirection(dir.id)}
                      >
                        <dir.icon className={cn("h-5 w-5 mr-2", dir.color)} />
                        {dir.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scale & Submit */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Waga wyjściowa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Digital Display */}
                <div className="bg-foreground text-background rounded-lg p-4 font-mono text-center">
                  <div className="text-4xl font-bold tracking-wider">
                    {weightGross.toFixed(2)}
                  </div>
                  <div className="text-sm opacity-70">kg brutto</div>
                </div>

                <Button
                  className="w-full h-12"
                  onClick={readFromScale}
                  disabled={isScaleReading}
                >
                  {isScaleReading ? (
                    <RotateCcw className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Scale className="h-5 w-5 mr-2" />
                  )}
                  POBIERZ Z WAGI
                </Button>

                {/* Tare & Net */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Tara</label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-10 font-mono"
                      value={weightTare}
                      onChange={(e) => setWeightTare(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Netto</label>
                    <div className="h-10 bg-success/10 border border-success/30 rounded-md flex items-center justify-center text-lg font-bold text-success font-mono">
                      {weightNet.toFixed(2)} kg
                    </div>
                  </div>
                </div>

                {/* Yield indicator */}
                {totalInputWeight > 0 && weightNet > 0 && (
                  <div className="text-center text-sm">
                    <span className="text-muted-foreground">Uzysk: </span>
                    <span className={cn(
                      "font-bold",
                      (weightNet / totalInputWeight * 100) > 85 ? "text-success" : "text-warning"
                    )}>
                      {((weightNet / totalInputWeight) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}

                {/* Submit */}
                <Button
                  className="w-full h-16 text-xl font-bold"
                  size="lg"
                  disabled={!selectedProductId || weightGross <= 0 || createLog.isPending}
                  onClick={handleSaveOutput}
                >
                  {createLog.isPending ? "ZAPISYWANIE..." : (
                    <>
                      <Check className="h-6 w-6 mr-2" />
                      ZATWIERDŹ
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
