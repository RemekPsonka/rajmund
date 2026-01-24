import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Scan, Plus, Scale, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { useProductionOrders } from "@/hooks/useProductionOrders";
import { useEmployees } from "@/hooks/useEmployees";
import { useProducts, INDUSTRY_CATEGORIES } from "@/hooks/useProducts";
import { useBatches } from "@/hooks/useBatches";
import { useCreateProductionInput } from "@/hooks/useProductionOrders";
import { useCreateProductionLog } from "@/hooks/useProductionOrders";
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

  // Context selection
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [verifiedEmployee, setVerifiedEmployee] = useState<{ id: string; name: string } | null>(null);
  
  // Source batch (półprodukt - masowane mięso)
  const [sourceBatchCode, setSourceBatchCode] = useState("");
  const [sourceBatch, setSourceBatch] = useState<{ id: string; batchNumber: string; productName: string; productId: string } | null>(null);
  
  // Assembly
  const [selectedVariant, setSelectedVariant] = useState<number>(10);
  const [weightGross, setWeightGross] = useState("");
  const [assembledKebabs, setAssembledKebabs] = useState<AssembledKebab[]>([]);
  
  // Tare
  const [tareWeight, setTareWeight] = useState(TARE_DEFAULT.toString());

  // Data
  const { data: orders } = useProductionOrders("Open");
  const { data: employees } = useEmployees();
  const { data: products } = useProducts();
  const { data: batches } = useBatches();
  
  // Mutations
  const createInput = useCreateProductionInput();
  const createLog = useCreateProductionLog();
  const createVariants = useCreateKebabVariants();

  // Filter orders to Assembly type
  const assemblyOrders = useMemo(() => 
    orders?.filter(o => o.type === "Assembly") || [], 
    [orders]
  );

  // Filter batches to SemiFinished category
  const semiFinishedBatches = useMemo(() => {
    if (!batches || !products) return [];
    const semiFinishedProductIds = products
      .filter(p => p.industry_category === "SemiFinished")
      .map(p => p.id);
    return batches.filter(b => 
      semiFinishedProductIds.includes(b.product_id) && 
      b.status === "Released" &&
      b.current_quantity > 0
    );
  }, [batches, products]);

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

  // Scan source batch
  const handleScanBatch = () => {
    if (!sourceBatchCode.trim()) {
      toast.error("Wprowadź numer partii");
      return;
    }
    
    const batch = semiFinishedBatches.find(
      b => b.internal_batch_number.toLowerCase() === sourceBatchCode.trim().toLowerCase()
    );
    
    if (!batch) {
      toast.error("Partia nie znaleziona lub nie jest półproduktem");
      return;
    }
    
    const product = products?.find(p => p.id === batch.product_id);
    setSourceBatch({
      id: batch.id,
      batchNumber: batch.internal_batch_number,
      productName: product?.name || "Nieznany produkt",
      productId: batch.product_id,
    });
    toast.success(`Partia źródłowa: ${batch.internal_batch_number}`);
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
    if (!selectedOrderId) {
      toast.error("Wybierz zlecenie");
      return;
    }
    if (!verifiedEmployee) {
      toast.error("Zaloguj pracownika");
      return;
    }
    if (!sourceBatch) {
      toast.error("Zeskanuj partię źródłową");
      return;
    }
    if (assembledKebabs.length === 0) {
      toast.error("Dodaj przynajmniej jeden kebab");
      return;
    }

    try {
      // 1. Register source batch as input
      await createInput.mutateAsync({
        production_order_id: selectedOrderId,
        batch_id: sourceBatch.id,
        product_id: sourceBatch.productId,
        weight: totalAssembled,
        direction: "Assembly",
      });

      // 2. Create production log for the output
      const logResult = await createLog.mutateAsync({
        production_order_id: selectedOrderId,
        employee_id: verifiedEmployee.id,
        product_id: finishedProducts[0]?.id || sourceBatch.productId, // fallback
        source_batch_id: sourceBatch.id,
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
      setSourceBatch(null);
      setSourceBatchCode("");
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  // Check if ready to assemble
  const canAssemble = selectedOrderId && verifiedEmployee && sourceBatch;

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
          {/* Order Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Zlecenie Składania
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue placeholder="Wybierz zlecenie..." />
                </SelectTrigger>
                <SelectContent>
                  {assemblyOrders.map(order => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number} - {order.facility?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assemblyOrders.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Brak otwartych zleceń typu "Składanie"
                </p>
              )}
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

          {/* Source Batch */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Partia Źródłowa (Półprodukt)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sourceBatch ? (
                <div className="space-y-2">
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="font-medium">{sourceBatch.batchNumber}</p>
                    <p className="text-sm text-muted-foreground">{sourceBatch.productName}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSourceBatch(null);
                      setSourceBatchCode("");
                    }}
                  >
                    Zmień partię
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Zeskanuj partię masowanego mięsa"
                    value={sourceBatchCode}
                    onChange={(e) => setSourceBatchCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScanBatch()}
                    className="h-12"
                  />
                  <Button onClick={handleScanBatch} size="lg">
                    <Scan className="h-5 w-5" />
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
                    {assembledKebabs.map((kebab, idx) => (
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
