import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Snowflake, User, Scan, Play, Square, Clock, ThermometerSnowflake, AlertTriangle, Save } from "lucide-react";
import { TerminalHeader } from "@/components/production/TerminalHeader";
import { TerminalFooter } from "@/components/production/TerminalFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

import { useProductionOrders, useCreateProductionLog, useUpdateProductionLog, useFreezingLogs, generateOrderNumber, useCreateProductionOrder, useCloseProductionOrder } from "@/hooks/useProductionOrders";
import { supabase } from "@/integrations/supabase/client";
import { mockFreezingTempAt, mockFreezingTempAtFast } from "@/lib/mockHardware";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FreezingTempChart } from "@/components/production/FreezingTempChart";
import { useEmployees } from "@/hooks/useEmployees";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import { useBatches, lookupBatchByCode, getBatchRejectionReason } from "@/hooks/useBatches";
import { useProducts } from "@/hooks/useProducts";
import { StateMachineBadge } from "@/components/production/StateMachineBadge";
import { STATE_MACHINES, type FreezingState } from "@/lib/stateMachines";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";

const FREEZING_CHAMBERS = [
  { id: "chamber-1", name: "Komora 1 (-35°C)" },
  { id: "chamber-2", name: "Komora 2 (-35°C)" },
  { id: "chamber-3", name: "Komora 3 (-40°C)" },
];

const CCP_THRESHOLD_C = -18;

interface FreezingItem {
  id: string;
  batchNumber: string;
  productName: string;
  weight: number;
  startedAt: Date;
  status: "freezing" | "completed";
  dbLogId?: string;
  productionOrderId?: string;
  latestTempC?: number | null;
  ccpPassed?: boolean | null;
}

export default function ShockFreezingTerminalPage() {
  const navigate = useNavigate();

  // Context
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [selectedChamber, setSelectedChamber] = useState<string>("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [verifiedEmployee, setVerifiedEmployee] = useState<{ id: string; name: string } | null>(null);

  // Scanning
  const [scanCode, setScanCode] = useState("");
  
  // Items in freezing (local state synced with DB)
  const [freezingItems, setFreezingItems] = useState<FreezingItem[]>([]);

  // Data
  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();
  const { data: employees } = useEmployees();
  const { data: orders } = useProductionOrders("Open");
  const { data: batches } = useBatches({ availableOnly: true });
  const { data: products } = useProducts();
  const { data: existingFreezingLogs, refetch: refetchFreezingLogs } = useFreezingLogs(selectedFacilityId);
  
  // Mutations
  const createLog = useCreateProductionLog();
  const updateLog = useUpdateProductionLog();
  const createOrder = useCreateProductionOrder();
  const closeOrder = useCloseProductionOrder();

  // Local input state for temperature reading per item
  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});

  // Load existing freezing logs from DB when facility changes
  useEffect(() => {
    if (existingFreezingLogs && existingFreezingLogs.length > 0) {
      const dbItems: FreezingItem[] = existingFreezingLogs
        .filter((log: any) => !log.freezing_completed_at) // Only active freezing
        .map((log: any) => ({
          id: log.id,
          batchNumber: log.source_batch?.internal_batch_number || "N/A",
          productName: log.product?.name || "Nieznany",
          weight: log.weight_net || log.weight_gross,
          startedAt: new Date(log.freezing_started_at || log.created_at),
          status: "freezing" as const,
          dbLogId: log.id,
          productionOrderId: log.production_order_id,
          latestTempC: log.latest_core_temp_c ?? null,
          ccpPassed: log.ccp_passed ?? null,
        }));
      
      // Merge with local items (avoid duplicates)
      setFreezingItems(prev => {
        const existingIds = new Set(prev.map(i => i.dbLogId).filter(Boolean));
        const newDbItems = dbItems.filter(i => !existingIds.has(i.dbLogId));
        return [...prev.filter(i => !i.dbLogId), ...newDbItems, ...dbItems.filter(i => existingIds.has(i.dbLogId))];
      });
    }
  }, [existingFreezingLogs]);

  // Filter facilities by selected company
  const filteredFacilities = useMemo(() => 
    facilities?.filter(f => f.company_id === selectedCompanyId) || [],
    [facilities, selectedCompanyId]
  );

  // Filter freezing orders by selected facility
  const freezingOrders = useMemo(() => 
    orders?.filter(o => o.type === "Freezing" && o.facility_id === selectedFacilityId) || [],
    [orders, selectedFacilityId]
  );

  // Verify employee
  const verifyEmployee = () => {
    if (!employeeCode.trim()) {
      toast.error("Wprowadź kod pracownika");
      return;
    }
    const emp = employees?.find(e => e.qr_login_code === employeeCode.trim());
    if (emp) {
      setVerifiedEmployee({ id: emp.id, name: `${emp.first_name} ${emp.last_name}` });
      toast.success(`Zalogowano: ${emp.first_name} ${emp.last_name}`);
    } else {
      toast.error("Nie znaleziono pracownika");
    }
  };

  // Start freezing for scanned item
  const handleStartFreezing = async () => {
    if (!scanCode.trim()) {
      toast.error("Zeskanuj produkt");
      return;
    }
    if (!selectedChamber) {
      toast.error("Wybierz komorę mrożenia");
      return;
    }
    if (!verifiedEmployee) {
      toast.error("Zaloguj pracownika");
      return;
    }
    if (!selectedCompanyId || !selectedFacilityId) {
      toast.error("Wybierz spółkę i zakład");
      return;
    }

    // Find batch by scanned code (only available batches in cache)
    const code = scanCode.trim();
    let batch = batches?.find(b => b.internal_batch_number.toLowerCase() === code.toLowerCase());
    if (!batch) {
      try {
        const found = await lookupBatchByCode(code);
        if (!found) {
          toast.error(`Nie znaleziono partii o numerze ${code}`);
          return;
        }
        toast.error(getBatchRejectionReason(found) ?? "Partia nie spełnia wymagań produkcyjnych");
        return;
      } catch (err) {
        toast.error(`Błąd wyszukiwania partii: ${(err as Error).message}`);
        return;
      }
    }

    const product = products?.find(p => p.id === batch.product_id);

    try {
      // Find or create a Freezing order for today
      let freezingOrder = freezingOrders.find(o => o.status === "Open");
      
      if (!freezingOrder) {
        // Create new freezing order
        const orderNumber = generateOrderNumber("Freezing");
        const result = await createOrder.mutateAsync({
          company_id: selectedCompanyId,
          facility_id: selectedFacilityId,
          order_number: orderNumber,
          type: "Freezing",
          notes: `Mrożenie szokowe - ${selectedChamber}`,
        });
        freezingOrder = result;
      }

      // Create production log with freezing data
      const now = new Date().toISOString();
      const logResult = await createLog.mutateAsync({
        production_order_id: freezingOrder.id,
        employee_id: verifiedEmployee.id,
        product_id: batch.product_id,
        source_batch_id: batch.id,
        weight_gross: batch.current_quantity,
        process_stage: "ShockFreezing",
        freezing_started_at: now,
      });

      // Add to local state
      const newItem: FreezingItem = {
        id: logResult.id,
        batchNumber: batch.internal_batch_number,
        productName: product?.name || "Nieznany",
        weight: batch.current_quantity,
        startedAt: new Date(),
        status: "freezing",
        dbLogId: logResult.id,
        productionOrderId: freezingOrder.id,
        latestTempC: null,
        ccpPassed: null,
      };

      setFreezingItems(prev => [...prev, newItem]);
      setScanCode("");
      
      toast.success(`Rozpoczęto mrożenie: ${batch.internal_batch_number}`);
    } catch (error) {
      console.error("Freezing start error:", error);
    }
  };

  // === Auto-pomiar temperatury co 30s dla aktywnych sesji mrożenia ===
  // Krzywa wykładnicza z mockHardware imituje sondę. Wpisy idą do
  // t_freezing_temp_log (source='auto') + odświeżają latest_core_temp_c
  // na production_log. Cleanup przy zakończeniu mrożenia / odmontowaniu.
  const activeFreezingKey = useMemo(
    () => freezingItems
      .filter(i => i.status === "freezing" && i.dbLogId)
      .map(i => `${i.dbLogId}:${i.startedAt.getTime()}`)
      .join("|"),
    [freezingItems]
  );

  useEffect(() => {
    const active = freezingItems.filter(
      i => i.status === "freezing" && i.dbLogId
    );
    if (active.length === 0) return;

    const intervals: ReturnType<typeof setInterval>[] = [];

    active.forEach(item => {
      const dbLogId = item.dbLogId!;
      const startedAtMs = item.startedAt.getTime();
      const id = setInterval(async () => {
        const elapsedSec = (Date.now() - startedAtMs) / 1000;
        const mockTemp = mockFreezingTempAt(elapsedSec);
        try {
          const { error: insertErr } = await supabase
            .from("t_freezing_temp_log")
            .insert({
              production_log_id: dbLogId,
              core_temp_c: mockTemp,
              source: "auto",
            });
          if (insertErr) {
            console.error("Auto temp log insert error:", insertErr);
            return;
          }
          await updateLog.mutateAsync({
            id: dbLogId,
            latest_core_temp_c: mockTemp,
            silent: true,
          });
          setFreezingItems(prev =>
            prev.map(i =>
              i.dbLogId === dbLogId ? { ...i, latestTempC: mockTemp } : i
            )
          );
        } catch (err) {
          console.error("Auto temp poll failed:", err);
        }
      }, 30_000);
      intervals.push(id);
    });

    return () => {
      intervals.forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFreezingKey]);

  // Save temperature reading for an active freezing item
  const handleSaveTemperature = async (itemId: string) => {
    const item = freezingItems.find(i => i.id === itemId);
    if (!item || !item.dbLogId) return;

    const raw = (tempInputs[itemId] ?? "").trim().replace(",", ".");
    const value = Number(raw);
    if (raw === "" || Number.isNaN(value)) {
      toast.error("Wprowadź poprawną wartość temperatury");
      return;
    }
    if (value < -50 || value > 30) {
      toast.error("Temperatura poza zakresem (-50 do 30°C)");
      return;
    }

    try {
      await updateLog.mutateAsync({
        id: item.dbLogId,
        latest_core_temp_c: value,
        silent: true,
      });
      // Dorzuć wpis do historii pomiarów (krzywa)
      const { error: insertErr } = await supabase
        .from("t_freezing_temp_log")
        .insert({
          production_log_id: item.dbLogId,
          core_temp_c: value,
          source: "manual",
        });
      if (insertErr) console.error("Insert manual temp log error:", insertErr);

      setFreezingItems(prev =>
        prev.map(i => i.id === itemId ? { ...i, latestTempC: value } : i)
      );
      setTempInputs(prev => ({ ...prev, [itemId]: "" }));
      toast.success(`Zapisano temp.: ${value}°C`);
    } catch (error) {
      console.error("Save temperature error:", error);
    }
  };

  // Complete freezing — CCP gate decides whether to emit LOT
  const handleCompleteFreezing = async (itemId: string) => {
    const item = freezingItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.latestTempC == null) {
      toast.error("Najpierw wpisz temperaturę rdzenia");
      return;
    }

    const duration = Math.round((Date.now() - item.startedAt.getTime()) / 60000);
    const now = new Date().toISOString();
    const passed = item.latestTempC <= CCP_THRESHOLD_C;

    try {
      if (item.dbLogId) {
        await updateLog.mutateAsync({
          id: item.dbLogId,
          freezing_completed_at: now,
          freezing_duration_minutes: duration,
          ccp_passed: passed,
          silent: true,
        });
      }

      if (passed && item.productionOrderId) {
        // Emit LOT via lineage RPC
        try {
          await closeOrder.mutateAsync(item.productionOrderId);
          toast.success(`Mrożenie zakończone — LOT wyemitowany (${item.batchNumber})`);
        } catch (e) {
          // close RPC może wymagać innych warunków — pokaż błąd ale nie wycofuj zamknięcia loga
          console.error("Close order failed:", e);
          toast.warning(`Mrożenie zamknięte, ale nie udało się wyemitować LOT-u: ${(e as Error).message}`);
        }
      } else if (!passed && item.productionOrderId) {
        // Append note to order, leave Open for QC
        try {
          const { data: order } = await supabase
            .from("t_production_orders")
            .select("notes")
            .eq("id", item.productionOrderId)
            .single();
          const stamp = `[QC ${format(new Date(), "yyyy-MM-dd HH:mm")}] Mrożenie ${item.batchNumber}: temp ${item.latestTempC}°C nie spełnia CCP (${CCP_THRESHOLD_C}°C)`;
          const newNotes = order?.notes ? `${order.notes}\n${stamp}` : stamp;
          await supabase
            .from("t_production_orders")
            .update({ notes: newNotes })
            .eq("id", item.productionOrderId);
        } catch (e) {
          console.error("Note append failed:", e);
        }
        toast.warning(`Wymaga decyzji QC — temp ${item.latestTempC}°C > ${CCP_THRESHOLD_C}°C. Zlecenie pozostaje otwarte.`);
      }

      setFreezingItems(prev =>
        prev.map(i =>
          i.id === itemId
            ? { ...i, status: "completed" as const, ccpPassed: passed }
            : i
        )
      );
      refetchFreezingLogs();
    } catch (error) {
      console.error("Freezing complete error:", error);
    }
  };

  // Get duration string
  const getDuration = (startedAt: Date) => {
    const minutes = Math.round((Date.now() - startedAt.getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  // Calculate totals
  const activeCount = freezingItems.filter(i => i.status === "freezing").length;
  const completedCount = freezingItems.filter(i => i.status === "completed").length;
  const totalWeight = freezingItems.reduce((sum, i) => sum + i.weight, 0);

  // Check if ready
  const canOperate = selectedCompanyId && selectedFacilityId && selectedChamber && verifiedEmployee;

  // State machine (UI-only). Verified/Released — placeholdery (brak akcji weryfikacji w UI).
  const freezingState: FreezingState = useMemo(() => {
    if (!canOperate || freezingItems.length === 0) return "Loading";
    if (activeCount > 0) return "Freezing";
    if (completedCount > 0) return "Stabilizing";
    return "Loading";
  }, [canOperate, freezingItems.length, activeCount, completedCount]);

  const [stateStartedAt, setStateStartedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    setStateStartedAt(Date.now());
  }, [freezingState]);

  // Sprint 2.6 — ostrzeżenie: aktywne sesje mrożenia w UI = niezakończona praca
  const isDirty = freezingItems.length > 0;
  useUnsavedChangesWarning(isDirty);

  return (
    <div className="min-h-screen bg-background pb-[68px]">
      <TerminalHeader kind="freezing" title="Mrożenie szokowe — CCP" icon={Snowflake} onBack={() => navigate(-1)} />
      <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Snowflake className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mrożenie Szokowe</h1>
            <p className="text-muted-foreground">Terminal kontroli procesu mrożenia</p>
          </div>
        </div>
      </div>

      {/* State Machine */}
      <div className="mb-4">
        <StateMachineBadge
          states={STATE_MACHINES.freezing}
          current={freezingState}
          timer={{ stateStartedAt }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Context */}
        <div className="space-y-4">
          {/* Company Selection */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Spółka</label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Wybierz spółkę" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.short_name || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Zakład</label>
                <Select 
                  value={selectedFacilityId} 
                  onValueChange={setSelectedFacilityId}
                  disabled={!selectedCompanyId}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Wybierz zakład" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFacilities.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Komora mrożenia</label>
                <Select value={selectedChamber} onValueChange={setSelectedChamber}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Wybierz komorę" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREEZING_CHAMBERS.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <ThermometerSnowflake className="h-4 w-4 text-blue-500" />
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Employee */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Pracownik
              </CardTitle>
            </CardHeader>
            <CardContent>
              {verifiedEmployee ? (
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                  <span className="font-medium">{verifiedEmployee.name}</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setVerifiedEmployee(null);
                      setEmployeeCode("");
                    }}
                  >
                    Zmień
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Kod pracownika"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verifyEmployee()}
                    className="h-12"
                  />
                  <Button onClick={verifyEmployee} size="lg">
                    <User className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">{activeCount}</p>
                  <p className="text-sm text-muted-foreground">W mrożeniu</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{completedCount}</p>
                  <p className="text-sm text-muted-foreground">Zakończone</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-2xl font-bold">{totalWeight.toFixed(1)} kg</p>
                <p className="text-sm text-muted-foreground">Łączna waga</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center - Scanning & Action */}
        <div className="lg:col-span-3 space-y-4">
          {/* Scan Input */}
          <Card className={!canOperate ? "opacity-50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Skanowanie Produktu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Zeskanuj kod partii lub produktu"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStartFreezing()}
                  className="h-14 text-xl"
                  disabled={!canOperate}
                />
                <Button 
                  onClick={handleStartFreezing}
                  className="h-14 px-8"
                  disabled={!canOperate || !scanCode.trim()}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Rozpocznij Mrożenie
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live Temperature Curve (first active session) */}
          {(() => {
            const activeChartItem = freezingItems.find(
              i => i.status === "freezing" && i.dbLogId
            );
            return activeChartItem?.dbLogId ? (
              <FreezingTempChart
                productionLogId={activeChartItem.dbLogId}
                targetTempC={CCP_THRESHOLD_C}
              />
            ) : null;
          })()}

          {/* Freezing Items Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Produkty w Mrożeniu
              </CardTitle>
            </CardHeader>
            <CardContent>
              {freezingItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Snowflake className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Brak produktów w mrożeniu</p>
                  <p className="text-sm">Zeskanuj produkt, aby rozpocząć proces</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Nr Partii</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right">Waga</TableHead>
                      <TableHead>Czas</TableHead>
                      <TableHead>Temp. rdzenia (°C)</TableHead>
                      <TableHead className="text-center">CCP</TableHead>
                      <TableHead className="text-right">Akcja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freezingItems.map(item => {
                      const isFailed = item.status === "completed" && item.ccpPassed === false;
                      const tempColor =
                        item.latestTempC == null
                          ? "text-muted-foreground"
                          : item.latestTempC <= CCP_THRESHOLD_C
                            ? "text-blue-500"
                            : "text-destructive";
                      return (
                      <TableRow key={item.id} className={isFailed ? "border-l-4 border-destructive bg-destructive/5" : ""}>
                        <TableCell>
                          {isFailed ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Wymaga QC
                            </Badge>
                          ) : (
                            <Badge
                              variant={item.status === "freezing" ? "default" : "secondary"}
                              className={item.status === "freezing" ? "bg-blue-500" : ""}
                            >
                              {item.status === "freezing" ? (
                                <><Snowflake className="h-3 w-3 mr-1 animate-pulse" /> Mrożenie</>
                              ) : (
                                "Zakończone"
                              )}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{item.batchNumber}</TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.weight.toFixed(2)} kg
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {getDuration(item.startedAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.status === "freezing" ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1 items-center">
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="np. -20"
                                  className="h-9 w-24 font-mono"
                                  value={tempInputs[item.id] ?? ""}
                                  onChange={(e) => setTempInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  onKeyDown={(e) => e.key === "Enter" && handleSaveTemperature(item.id)}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSaveTemperature(item.id)}
                                  disabled={updateLog.isPending}
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                              </div>
                              {item.latestTempC != null && (
                                <span className={`text-xs font-mono ${tempColor}`}>
                                  ostatnio: {item.latestTempC}°C
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={`font-mono ${tempColor}`}>
                              {item.latestTempC != null ? `${item.latestTempC}°C` : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.status === "completed" ? (
                            item.ccpPassed === true ? (
                              <Badge className="bg-success text-success-foreground">PASS</Badge>
                            ) : item.ccpPassed === false ? (
                              <Badge variant="destructive">FAIL</Badge>
                            ) : (
                              <Badge variant="outline">—</Badge>
                            )
                          ) : (
                            <Badge variant="outline">—</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === "freezing" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCompleteFreezing(item.id)}
                              disabled={item.latestTempC == null}
                              title={item.latestTempC == null ? "Najpierw wpisz temperaturę" : ""}
                            >
                              <Square className="h-4 w-4 mr-1" />
                              Zakończ
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
      <TerminalFooter operator={null} />
    </div>
  );
}
