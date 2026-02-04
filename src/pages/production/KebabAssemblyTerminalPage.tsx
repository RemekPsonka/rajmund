import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Scan, Plus, Scale, Trash2, Package, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

import { 
  useProcessingOutputBatches, 
  useCreateProductionOrder, 
  generateOrderNumber,
  useCreateProductionInput,
  useCreateProductionLog,
  ProcessingOutputBatch
} from "@/hooks/useProductionOrders";
import { useEmployees } from "@/hooks/useEmployees";
import { useProducts } from "@/hooks/useProducts";
import { useFacilities } from "@/hooks/useFacilities";
import { useCompanies } from "@/hooks/useCompanies";
import { KEBAB_WEIGHT_VARIANTS, useCreateKebabVariants } from "@/hooks/useKebabVariants";
import { cn } from "@/lib/utils";

interface AssembledKebab {
  id: string;
  variantWeight: number;
  actualWeight: number;
  quantity: number;
}

const TARE_DEFAULT = 2.4;

export default function KebabAssemblyTerminalPage() {
  const navigate = useNavigate();

  // Selected batch from Processing output
  const [selectedBatch, setSelectedBatch] = useState<ProcessingOutputBatch | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  
  // Employee
  const [employeeCode, setEmployeeCode] = useState("");
  const [verifiedEmployee, setVerifiedEmployee] = useState<{ id: string; name: string } | null>(null);
  
  // Assembly
  const [selectedVariant, setSelectedVariant] = useState<number>(10);
  const [weightGross, setWeightGross] = useState("");
  const [assembledKebabs, setAssembledKebabs] = useState<AssembledKebab[]>([]);
  
  // Tare
  const [tareWeight, setTareWeight] = useState(TARE_DEFAULT.toString());

  // Data - get output batches from closed Processing orders
  const { data: processingOutputs, isLoading: isLoadingBatches } = useProcessingOutputBatches();
  const { data: employees } = useEmployees();
  const { data: products } = useProducts();
  const { data: facilities } = useFacilities();
  const { data: companies } = useCompanies();
  
  // Mutations
  const createOrder = useCreateProductionOrder();
  const createInput = useCreateProductionInput();
  const createLog = useCreateProductionLog();
  const createVariants = useCreateKebabVariants();

  // Get finished goods products (kebab variants)
  const finishedProducts = useMemo(() => 
    products?.filter(p => p.industry_category === "FinishedGood") || [],
    [products]
  );

  // Calculate totals
  const totalAssembled = assembledKebabs.reduce((sum, k) => sum + k.actualWeight, 0);
  const totalCount = assembledKebabs.reduce((sum, k) => sum + k.quantity, 0);

  // Verify employee by QR code
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

  // Select batch and auto-create Assembly order
  const handleSelectBatch = async (batch: ProcessingOutputBatch) => {
    if (!batch.production_order.facility_id || !batch.production_order.company_id) {
      toast.error("Brak danych zakładu dla tej partii");
      return;
    }

    try {
      // Auto-create Assembly order
      const orderNumber = generateOrderNumber("Assembly");
      const result = await createOrder.mutateAsync({
        company_id: batch.production_order.company_id,
        facility_id: batch.production_order.facility_id,
        order_number: orderNumber,
        type: "Assembly",
        notes: `Składanie z partii ${batch.output_batch.internal_batch_number}`,
      });
      
      setSelectedBatch(batch);
      setCreatedOrderId(result.id);
      toast.success(`Utworzono zlecenie ${orderNumber}`);
    } catch (error) {
      console.error("Create order error:", error);
      toast.error("Błąd tworzenia zlecenia");
    }
  };

  // Read from scale (simulated)
  const readFromScale = () => {
    const simulatedWeight = selectedVariant + (Math.random() * 0.5 - 0.25);
    setWeightGross(simulatedWeight.toFixed(2));
    toast.info(`Odczyt z wagi: ${simulatedWeight.toFixed(2)} kg`);
  };

  // Add kebab to list
  const handleAddKebab = () => {
    const gross = parseFloat(weightGross);
    const tare = parseFloat(tareWeight) || TARE_DEFAULT;
    
    if (isNaN(gross) || gross <= tare) {
      toast.error("Nieprawidłowa waga");
      return;
    }
    
    const netWeight = gross - tare;
    
    setAssembledKebabs(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        variantWeight: selectedVariant,
        actualWeight: netWeight,
        quantity: 1,
      },
    ]);
    
    setWeightGross("");
    toast.success(`Dodano kebab ${selectedVariant}kg (${netWeight.toFixed(2)} kg netto)`);
  };

  // Remove kebab from list
  const handleRemoveKebab = (id: string) => {
    setAssembledKebabs(prev => prev.filter(k => k.id !== id));
  };

  // Save all assembled kebabs
  const handleSaveAll = async () => {
    if (!createdOrderId) {
      toast.error("Brak zlecenia");
      return;
    }
    if (!verifiedEmployee) {
      toast.error("Zaloguj pracownika");
      return;
    }
    if (!selectedBatch) {
      toast.error("Brak partii źródłowej");
      return;
    }
    if (assembledKebabs.length === 0) {
      toast.error("Dodaj przynajmniej jeden kebab");
      return;
    }

    try {
      // 1. Register source batch as input
      await createInput.mutateAsync({
        production_order_id: createdOrderId,
        batch_id: selectedBatch.output_batch.id,
        product_id: selectedBatch.output_batch.product.id,
        weight: totalAssembled,
        direction: "Assembly",
      });

      // 2. Create production log for the output - safely get product_id
      const outputProductId = finishedProducts[0]?.id || selectedBatch.output_batch.product.id;
      if (!outputProductId) {
        toast.error("Brak produktu docelowego - dodaj produkt typu 'Finished Good'");
        return;
      }

      const logResult = await createLog.mutateAsync({
        production_order_id: createdOrderId,
        employee_id: verifiedEmployee.id,
        product_id: outputProductId,
        source_batch_id: selectedBatch.output_batch.id,
        weight_gross: totalAssembled + parseFloat(tareWeight) * totalCount,
        weight_tare: parseFloat(tareWeight) * totalCount,
        packaging_type: "Kebab",
        packaging_count: totalCount,
      });

      // 3. Create kebab variants
      const variantRecords = assembledKebabs.map(k => ({
        production_log_id: logResult.id,
        variant_name: `Kebab ${k.variantWeight}kg`,
        variant_weight: k.variantWeight,
        quantity: k.quantity,
        total_weight: k.actualWeight,
      }));

      await createVariants.mutateAsync(variantRecords);

      toast.success(`Zapisano ${totalCount} sztuk kebaba (${totalAssembled.toFixed(2)} kg)`);
      
      // Reset
      setAssembledKebabs([]);
      setSelectedBatch(null);
      setCreatedOrderId(null);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  // Check if ready to assemble
  const canAssemble = selectedBatch && createdOrderId && verifiedEmployee;

  // Render batch selection if no batch selected
  if (!selectedBatch) {
    return (
      <div className="min-h-screen bg-background p-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Terminal Składania Kebaba</h1>
            <p className="text-muted-foreground">Wybierz partię z zakończonego masowania</p>
          </div>
        </div>

        {/* Batch Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Dostępne Partie do Składania
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBatches ? (
              <p className="text-muted-foreground text-center py-8">Ładowanie partii...</p>
            ) : processingOutputs && processingOutputs.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {processingOutputs.map((batch) => (
                  <Card 
                    key={batch.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleSelectBatch(batch)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="secondary" className="font-mono">
                          {batch.output_batch.internal_batch_number}
                        </Badge>
                        <CheckCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="font-medium">{batch.output_batch.product.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Dostępne: <span className="font-mono">{batch.output_batch.current_quantity.toFixed(2)} kg</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Ze zlecenia: {batch.production_order.order_number}
                      </p>
                      <Button 
                        className="w-full mt-3" 
                        disabled={createOrder.isPending}
                      >
                        {createOrder.isPending ? "Tworzenie..." : "Wybierz do składania"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Brak partii do składania</p>
                <p className="text-muted-foreground mt-1">
                  Zakończ zlecenie masowania, aby partie były widoczne tutaj.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Terminal Składania Kebaba</h1>
          <p className="text-muted-foreground">Produkcja słupków z masowanego mięsa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Context */}
        <div className="space-y-4">
          {/* Selected Batch Info */}
          <Card className="border-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Partia Źródłowa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Badge variant="secondary" className="font-mono mb-2">
                  {selectedBatch.output_batch.internal_batch_number}
                </Badge>
                <p className="font-medium">{selectedBatch.output_batch.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  Dostępne: {selectedBatch.output_batch.current_quantity.toFixed(2)} kg
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSelectedBatch(null);
                  setCreatedOrderId(null);
                  setAssembledKebabs([]);
                }}
              >
                Zmień partię
              </Button>
            </CardContent>
          </Card>

          {/* Employee Login */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Pracownik
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
                    placeholder="Zeskanuj QR lub wpisz kod"
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
        </div>

        {/* Center Column - Assembly */}
        <div className="space-y-4">
          <Card className={cn(!canAssemble && "opacity-50")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Ważenie Słupka
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Variant Selection */}
              <div>
                <Label className="text-sm text-muted-foreground">Wariant (kg)</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {KEBAB_WEIGHT_VARIANTS.map(weight => (
                    <Button
                      key={weight}
                      variant={selectedVariant === weight ? "default" : "outline"}
                      className="h-14 text-xl font-bold"
                      onClick={() => setSelectedVariant(weight)}
                      disabled={!canAssemble}
                    >
                      {weight} kg
                    </Button>
                  ))}
                </div>
              </div>

              {/* Weight Input */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Waga brutto (kg)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={weightGross}
                      onChange={(e) => setWeightGross(e.target.value)}
                      className="h-14 text-2xl text-center font-mono"
                      disabled={!canAssemble}
                    />
                    <Button 
                      onClick={readFromScale} 
                      size="lg"
                      disabled={!canAssemble}
                    >
                      <Scale className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Tara (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={tareWeight}
                    onChange={(e) => setTareWeight(e.target.value)}
                    className="h-14 text-2xl text-center font-mono mt-1"
                    disabled={!canAssemble}
                  />
                </div>
              </div>

              {/* Net weight display */}
              {weightGross && (
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Waga netto</p>
                  <p className="text-3xl font-bold">
                    {(parseFloat(weightGross) - parseFloat(tareWeight || "0")).toFixed(2)} kg
                  </p>
                </div>
              )}

              {/* Add Button */}
              <Button
                onClick={handleAddKebab}
                className="w-full h-14 text-lg"
                disabled={!canAssemble || !weightGross}
              >
                <Plus className="h-5 w-5 mr-2" />
                Dodaj Słupek {selectedVariant}kg
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - List */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Złożone Słupki</CardTitle>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {totalCount} szt. / {totalAssembled.toFixed(2)} kg
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {assembledKebabs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Brak złożonych słupków
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wariant</TableHead>
                      <TableHead className="text-right">Waga netto</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assembledKebabs.map((kebab) => (
                      <TableRow key={kebab.id}>
                        <TableCell>
                          <Badge variant="outline">{kebab.variantWeight} kg</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {kebab.actualWeight.toFixed(2)} kg
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveKebab(kebab.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Summary by variant */}
          {assembledKebabs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Podsumowanie Wariantów</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {KEBAB_WEIGHT_VARIANTS.map(variant => {
                    const variantKebabs = assembledKebabs.filter(k => k.variantWeight === variant);
                    if (variantKebabs.length === 0) return null;
                    const totalWeight = variantKebabs.reduce((sum, k) => sum + k.actualWeight, 0);
                    return (
                      <div key={variant} className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">{variant} kg</p>
                        <p className="text-sm text-muted-foreground">
                          {variantKebabs.length} szt. ({totalWeight.toFixed(2)} kg)
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSaveAll}
            className="w-full h-16 text-xl"
            disabled={assembledKebabs.length === 0 || createLog.isPending || createVariants.isPending}
          >
            {createLog.isPending || createVariants.isPending 
              ? "Zapisywanie..." 
              : `ZATWIERDŹ (${totalCount} szt.)`
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
