import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Check,
  Scale,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Cog,
  Snowflake,
  ArrowRight,
  Play,
  ChefHat,
  CheckCircle2,
  Circle,
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
import { StateMachineBadge } from "@/components/production/StateMachineBadge";
import { STATE_MACHINES, type TumblingState } from "@/lib/stateMachines";

import { useProducts } from "@/hooks/useProducts";
import { useEmployees } from "@/hooks/useEmployees";
import { useBatches, lookupBatchByCode, getBatchRejectionReason } from "@/hooks/useBatches";
import {
  useProductionOrders,
  useCreateProductionInput,
  useCreateProductionLog,
  useProductionInputs,
  useProductionLogs,
  useUpdateProductionOrder,
  useCloseProductionOrder,
} from "@/hooks/useProductionOrders";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRecipes, useRecipeIngredients } from "@/hooks/useRecipes";
import { PROCESSING_DIRECTIONS, type ProcessingDirection } from "@/hooks/useStorageLocations";
import { cn } from "@/lib/utils";

const MACHINES = [
  { id: "MASOWNICA_1", name: "Masownica 1" },
  { id: "MASOWNICA_2", name: "Masownica 2" },
  { id: "MASOWNICA_3", name: "Masownica 3" },
];

const OUTPUT_DIRECTIONS = [
  { id: "MROZNIA", name: "Mroźnia", icon: Snowflake, color: "text-blue-500" },
  { id: "KEBAB", name: "Kebab / Pakowanie", icon: ArrowRight, color: "text-orange-500" },
];

const TARE_DEFAULT = 2.0;
const RECIPE_TOLERANCE_PERCENT = 5;

interface InputItem {
  id: string;
  batchNumber: string;
  productName: string;
  weight: number;
  direction: ProcessingDirection;
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
  
  // State - Input direction
  const [inputDirection, setInputDirection] = useState<ProcessingDirection>("SWIEZE");
  
  // State - Processing (Start procesu)
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [targetTotalKg, setTargetTotalKg] = useState<number>(100);
  
  // State - Output (Wyjście)
  const [selectedProductId, setSelectedProductId] = useState("");
  const [outputDirection, setOutputDirection] = useState<string>("MROZNIA");
  const [weightGross, setWeightGross] = useState(0);
  const [weightTare, setWeightTare] = useState(TARE_DEFAULT);
  const [isScaleReading, setIsScaleReading] = useState(false);
  
  // State - Step (3 steps now)
  const [step, setStep] = useState<"input" | "processing" | "output">("input");

  // Sprint 2: dialog potwierdzenia zakończenia partii tumblera
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // Queries
  const { data: orders } = useProductionOrders("Open");
  const processingOrders = orders?.filter(o => o.type === "Processing") || [];
  const { data: employees } = useEmployees();
  const { data: products } = useProducts();
  const { data: batches } = useBatches({ availableOnly: true });
  const { data: existingInputs } = useProductionInputs(selectedOrderId || undefined);
  const { data: existingLogs } = useProductionLogs(selectedOrderId || undefined);

  // Get company_id from selected order for recipes
  const selectedOrder = processingOrders.find(o => o.id === selectedOrderId);
  const { data: recipes } = useRecipes(selectedOrder?.company_id);
  const { data: recipeIngredients } = useRecipeIngredients(selectedRecipeId || undefined);
  
  const createInput = useCreateProductionInput();
  const createLog = useCreateProductionLog();
  const updateOrder = useUpdateProductionOrder();
  const closeOrder = useCloseProductionOrder();

  // Finished products for output
  const finishedProducts = products?.filter(p => !p.is_raw_material) || [];
  
  // Selected recipe details
  const selectedRecipe = recipes?.find(r => r.id === selectedRecipeId);
  
  // Total input weight (local + existing from DB)
  const totalInputWeight = useMemo(() => {
    const localWeight = inputItems.reduce((sum, item) => sum + item.weight, 0);
    const existingWeight = existingInputs?.reduce((sum, inp) => sum + Number(inp.weight), 0) || 0;
    return localWeight + existingWeight;
  }, [inputItems, existingInputs]);
  
  // Net weight
  const weightNet = Math.max(0, weightGross - weightTare);

  // ── State machine (UI-only). Mapowanie patrz plan; Resting/Discharging
  // pozostają w definicji, ale bez triggerów (placeholder przyszłej rozbudowy).
  const tumblingState: TumblingState = useMemo(() => {
    if (selectedOrder?.status === "Closed") return "Closed";
    if (!selectedOrderId) return "Idle";
    if (step === "output") {
      return (existingLogs && existingLogs.length > 0) ? "Done" : "Mixing";
    }
    if (step === "processing") return "Loaded";
    // step === 'input'
    return inputItems.length > 0 ? "Loading" : "Idle";
  }, [selectedOrder?.status, selectedOrderId, step, existingLogs, inputItems.length]);

  const [stateStartedAt, setStateStartedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    setStateStartedAt(Date.now());
  }, [tumblingState]);

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
  const handleBatchScan = useCallback(async () => {
    const code = batchScanCode.trim();
    if (!code) return;

    let batch = batches?.find(
      b => b.internal_batch_number.toLowerCase() === code.toLowerCase()
    );

    // Fallback lookup po wszystkich statusach by zwrócić właściwy komunikat odrzucenia
    if (!batch) {
      try {
        const found = await lookupBatchByCode(code);
        if (!found) {
          toast.error(`Nie znaleziono partii o numerze ${code}`);
          setBatchScanCode("");
          return;
        }
        const reason = getBatchRejectionReason(found);
        toast.error(reason ?? "Partia nie spełnia wymagań produkcyjnych");
        setBatchScanCode("");
        return;
      } catch (err) {
        toast.error(`Błąd wyszukiwania partii: ${(err as Error).message}`);
        setBatchScanCode("");
        return;
      }
    }

    const product = products?.find(p => p.id === batch.product_id);

    // Check if already added
    if (inputItems.some(item => item.batchId === batch!.id)) {
      toast.error("Ta partia jest już dodana");
      setBatchScanCode("");
      return;
    }

    setInputItems(prev => [...prev, {
      id: crypto.randomUUID(),
      batchNumber: batch!.internal_batch_number,
      productName: product?.name || "Nieznany",
      weight: batch!.current_quantity,
      batchId: batch!.id,
      productId: batch!.product_id,
      direction: inputDirection,
    }]);

    toast.success(`Dodano: ${batch.internal_batch_number}`);
    setBatchScanCode("");
  }, [batchScanCode, batches, products, inputItems, inputDirection]);


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

  // Save inputs (RW documents) - move to processing step
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
          direction: item.direction,
        });
      }
      
      toast.success("Zapisano wsad do zlecenia");
      setStep("processing");
    } catch {
      // Error handled by hook
    }
  };

  // Start process - save recipe and machine to order
  const handleStartProcess = async () => {
    if (!selectedOrderId || !selectedRecipeId) {
      toast.error("Wybierz recepturę");
      return;
    }

    try {
      await updateOrder.mutateAsync({
        id: selectedOrderId,
        recipe_id: selectedRecipeId,
        machine_id: selectedMachine || null,
      });
      
      toast.success("Proces rozpoczęty - przejdź do ważenia wyjścia");
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

      toast.success(`Zapisano: ${weightNet.toFixed(2)} kg → ${outputDirection === "MROZNIA" ? "Mroźnia" : "Kebab"}`);
      
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
    setSelectedRecipeId("");
    setStep("input");
    setBatchScanCode("");
  };

  // Sprint 2: warunki zakończenia partii tumblera
  const hasInputs = (existingInputs?.length ?? 0) > 0;
  const hasPostWeight = existingLogs?.some(l => Number(l.weight_gross) > 0) ?? false;
  // recipeCheck zdefiniowany niżej; tu deklarujemy placeholder typowo:
  // walidację zgodności z recepturą obliczamy w `recipeOk` pod useMemo recipeCheck.

  const handleConfirmFinish = () => {
    if (!selectedOrderId) return;
    closeOrder.mutate(selectedOrderId, {
      onSuccess: () => {
        // Reset stanu terminala — maszyna i pracownik zostają na kolejne zlecenie
        setInputItems([]);
        setBatchScanCode("");
        setSelectedRecipeId("");
        setSelectedOrderId("");
        setSelectedProductId("");
        setWeightGross(0);
        setStep("input");
        setConfirmCloseOpen(false);
      },
      onError: () => {
        // Toast obsłużony w hooku; zamykamy dialog, stan zachowujemy do retry
        setConfirmCloseOpen(false);
      },
    });
  };
  const recipeYieldInfo = useMemo(() => {
    if (!selectedRecipe) return null;
    
    const ingredientsTotal = recipeIngredients?.reduce((sum, ing) => sum + (ing.amount_per_kg_base || ing.ratio), 0) || 0;
    const theoretical = (1 + ingredientsTotal) * 100;
    const evaporation = selectedRecipe.evaporation_percent || 0;
    const realValue = theoretical * (1 - evaporation / 100);
    // Safeguard: never show negative yield
    const real = Math.max(0, realValue);
    const isInvalid = realValue <= 0;
    
    return {
      theoretical: theoretical.toFixed(1),
      evaporation,
      real: real.toFixed(1),
      isInvalid,
    };
  }, [selectedRecipe, recipeIngredients]);

  // Sprint: walidacja zgodności wsadu z recepturą (±5% per składnik)
  const recipeCheck = useMemo(() => {
    if (!selectedRecipeId || !recipeIngredients?.length) {
      return { active: false, ok: true, perIngredient: [] as Array<{
        id: string; name: string; role: string; required: number; actual: number; inTol: boolean;
      }> };
    }
    const sumRatio = recipeIngredients.reduce(
      (s, i) => s + (Number(i.amount_per_kg_base) || Number(i.ratio) || 0),
      0
    ) || 1;
    const perIngredient = recipeIngredients.map((ing) => {
      const raw = Number(ing.amount_per_kg_base) || Number(ing.ratio) || 0;
      const required = (targetTotalKg || 0) * (raw / sumRatio);
      const actual = inputItems
        .filter((it) => it.productId === ing.product_id)
        .reduce((s, it) => s + it.weight, 0);
      const tolerance = required * (RECIPE_TOLERANCE_PERCENT / 100);
      const inTol = required > 0 ? Math.abs(actual - required) <= tolerance : actual === 0;
      return {
        id: ing.id,
        name: ing.product?.name || "—",
        role: ing.role || "MEAT",
        required,
        actual,
        inTol,
      };
    });
    return { active: true, ok: perIngredient.every((p) => p.inTol), perIngredient };
  }, [selectedRecipeId, recipeIngredients, inputItems, targetTotalKg]);

  const recipeOk = !recipeCheck.active || recipeCheck.ok;
  const canFinish = hasInputs && hasPostWeight && recipeOk;
  const finishDisabledReason = !hasInputs
    ? "Brak wsadu — zeskanuj partię"
    : !hasPostWeight
      ? "Brak wagi po-procesowej — zaloguj wagę przed zamknięciem"
      : !recipeOk
        ? "Wsad niezgodny z recepturą — sprawdź składniki (±5%)"
        : null;

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

      {/* State Machine */}
      <div className="px-4 py-2 shrink-0 border-b">
        <StateMachineBadge
          states={STATE_MACHINES.tumbling}
          current={tumblingState}
          timer={{ stateStartedAt }}
        />
      </div>

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

      {/* Step Indicator - 3 steps now */}
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
            variant={step === "processing" ? "default" : "outline"}
            size="sm"
            onClick={() => setStep("processing")}
            disabled={inputItems.length === 0 && !existingInputs?.length}
          >
            2. Start procesu
          </Button>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={step === "output" ? "default" : "outline"}
            size="sm"
            onClick={() => setStep("output")}
            disabled={!selectedRecipeId && !selectedOrder?.recipe_id}
          >
            3. Wyjście (Output)
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
          <div className="space-y-6">
            {/* Recipe Selection - na samej górze, przed wyborem partii */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChefHat className="h-5 w-5" />
                  Receptura i cel produkcji
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!recipes || recipes.length === 0 ? (
                  <div className="flex items-start gap-3 rounded-md border border-warning bg-warning/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Brak zdefiniowanej receptury</p>
                      <p className="text-muted-foreground">
                        Możesz kontynuować w trybie ręcznym, ale system nie sprawdzi czy wszystko się zgadza.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-sm text-muted-foreground mb-2 block">Receptura</label>
                      <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Wybierz recepturę..." />
                        </SelectTrigger>
                        <SelectContent>
                          {recipes.map((recipe) => (
                            <SelectItem key={recipe.id} value={recipe.id}>
                              {recipe.name}
                              {recipe.product?.name && ` → ${recipe.product.name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Cel partii (kg)</label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="h-11 text-lg font-mono"
                        value={targetTotalKg || ""}
                        onChange={(e) => setTargetTotalKg(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                )}

                {/* Tabela składników: Wymagane / Aktualne / Status */}
                {recipeCheck.active && recipeCheck.perIngredient.length > 0 && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Składnik</TableHead>
                          <TableHead>Rola</TableHead>
                          <TableHead className="text-right">Wymagane (kg)</TableHead>
                          <TableHead className="text-right">Aktualne (kg)</TableHead>
                          <TableHead className="text-center w-20">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipeCheck.perIngredient.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{p.role}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{p.required.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{p.actual.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              {p.inTol ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-success/20">
                                  <Circle className="h-3 w-3 fill-success text-success" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-destructive/20">
                                  <Circle className="h-3 w-3 fill-destructive text-destructive" />
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                      Tolerancja ±{RECIPE_TOLERANCE_PERCENT}%. Zamknięcie partii zablokowane dopóki wszystkie składniki nie są w tolerancji.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

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
                <CardContent className="space-y-3">
                  {/* Direction Selection for Input */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Kierunek przetwórstwa</label>
                    <Select value={inputDirection} onValueChange={(v) => setInputDirection(v as ProcessingDirection)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROCESSING_DIRECTIONS.map((dir) => (
                          <SelectItem key={dir.value} value={dir.value}>
                            {dir.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
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
                        <TableHead>Kierunek</TableHead>
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
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {PROCESSING_DIRECTIONS.find(d => d.value === item.direction)?.label || item.direction}
                            </Badge>
                          </TableCell>
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
          </div>
        ) : step === "processing" ? (
          /* Step 2: Processing - Recipe Selection */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Input Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Podsumowanie wsadu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-4xl font-bold font-mono">{totalInputWeight.toFixed(1)}</p>
                  <p className="text-muted-foreground">kg surowca</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{inputItems.length + (existingInputs?.length || 0)} pozycji</p>
                </div>
              </CardContent>
            </Card>

            {/* Recipe Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChefHat className="h-5 w-5" />
                  Wybór receptury
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Wybierz recepturę..." />
                  </SelectTrigger>
                  <SelectContent>
                    {!recipes || recipes.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
                        Brak dostępnych receptur.
                        <br />
                        Utwórz receptury w Ustawienia → Receptury.
                      </div>
                    ) : (
                      recipes.map((recipe) => (
                        <SelectItem key={recipe.id} value={recipe.id}>
                          {recipe.name}
                          {recipe.product?.name && ` → ${recipe.product.name}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {/* Recipe Details */}
                {selectedRecipe && (
                  <div className="space-y-3 pt-2">
                    {/* Ingredients */}
                    {recipeIngredients && recipeIngredients.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm font-medium mb-2">Składniki receptury:</p>
                        <ul className="text-sm space-y-1">
                          {recipeIngredients.map((ing) => (
                            <li key={ing.id} className="flex justify-between">
                              <span>• {ing.product?.name || "Składnik"}</span>
                              <span className="font-mono text-muted-foreground">
                                {(ing.amount_per_kg_base || ing.ratio).toFixed(3)} {ing.unit || "kg/kg"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Yield info */}
                    {recipeYieldInfo && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/30 rounded p-2">
                          <p className="text-xs text-muted-foreground">Teoretyczny uzysk</p>
                          <p className="font-bold">{recipeYieldInfo.theoretical}%</p>
                        </div>
                        <div className="bg-muted/30 rounded p-2">
                          <p className="text-xs text-muted-foreground">Parowanie</p>
                          <p className="font-bold">{recipeYieldInfo.evaporation}%</p>
                        </div>
                        <div className={cn(
                          "rounded p-2 border",
                          recipeYieldInfo.isInvalid 
                            ? "bg-destructive/10 border-destructive/30" 
                            : "bg-success/10 border-success/30"
                        )}>
                          <p className="text-xs text-muted-foreground">Realny uzysk</p>
                          {recipeYieldInfo.isInvalid ? (
                            <p className="font-bold text-destructive">⚠️ Błąd</p>
                          ) : (
                            <p className="font-bold text-success">{recipeYieldInfo.real}%</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Process instructions */}
                    {selectedRecipe.process_instructions && (
                      <div className="text-sm text-muted-foreground border-t pt-3">
                        <p className="font-medium mb-1">Instrukcje procesu:</p>
                        <p>{selectedRecipe.process_instructions}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Start Process Button - Full Width */}
            <div className="lg:col-span-2">
              <Button
                className="w-full h-16 text-xl font-bold"
                size="lg"
                disabled={!selectedRecipeId || updateOrder.isPending}
                onClick={handleStartProcess}
              >
                {updateOrder.isPending ? (
                  "ZAPISYWANIE..."
                ) : (
                  <>
                    <Play className="h-6 w-6 mr-3" />
                    START PROCESU
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Step 3: Output (Wyjście) */
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
                {/* Show selected recipe */}
                {(selectedRecipe || selectedOrder?.recipe_id) && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Receptura:</p>
                    <Badge variant="secondary" className="mt-1">
                      <ChefHat className="h-3 w-3 mr-1" />
                      {selectedRecipe?.name || "Przypisana"}
                    </Badge>
                  </div>
                )}
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
                    {OUTPUT_DIRECTIONS.map((dir) => (
                      <Button
                        key={dir.id}
                        variant={outputDirection === dir.id ? "default" : "outline"}
                        className={cn(
                          "h-14",
                          outputDirection === dir.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setOutputDirection(dir.id)}
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

            {/* Sprint 2: Zakończ partię tumblera (zamknięcie zlecenia + emisja LOT) */}
            <div className="lg:col-span-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">
                      <Button
                        className="w-full h-20 text-xl"
                        variant="default"
                        disabled={!canFinish || closeOrder.isPending}
                        onClick={() => setConfirmCloseOpen(true)}
                      >
                        {closeOrder.isPending ? (
                          <>
                            <RotateCcw className="h-6 w-6 mr-3 animate-spin" />
                            ZAMYKAM ZLECENIE...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-6 w-6 mr-3" />
                            ZAKOŃCZ PARTIĘ
                          </>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {finishDisabledReason && (
                    <TooltipContent>{finishDisabledReason}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
      </main>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zakończyć partię tumblera?</AlertDialogTitle>
            <AlertDialogDescription>
              Zlecenie zostanie zamknięte i powstanie nowa partia mieszanki. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeOrder.isPending}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmFinish();
              }}
              disabled={closeOrder.isPending}
            >
              Tak, zakończ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
