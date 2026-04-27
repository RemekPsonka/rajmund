import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FlaskConical,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  Package,
  Users,
  Truck,
  Factory,
  Scale,
  Snowflake,
  ChefHat,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { DemoReadinessChecklist } from "@/components/dev/DemoReadinessChecklist";

interface SimulationResult {
  success: boolean;
  message: string;
  summary: {
    raw_input_kg: number;
    decomposition: {
      meat_kg: number;
      bones_kg: number;
      skin_kg: number;
      yield_percent: number;
    };
    processing: {
      input_kg: number;
      output_kg: number;
      yield_percent: number;
    };
    assembly: {
      kebab_10kg_count: number;
      kebab_15kg_count: number;
      kebab_20kg_count: number;
      total_kebabs: number;
      total_weight_kg: number;
    };
    freezing: {
      items_frozen: number;
      duration_hours: number;
      temperature_celsius: number;
    };
    logistics: {
      pallets_created: number;
      shipment_status: string;
    };
  };
  products_by_category: Record<string, number>;
  orders_by_type: Record<string, number>;
  recipe: {
    name: string;
    base_product: string;
    base_category: string;
    output_product: string;
    target_yield_percent: number;
  };
  employees: {
    decomposition: { name: string; code: string };
    processing: { name: string; code: string };
    assembly_freezing: { name: string; code: string };
  };
  traceability: {
    delivery_id: string;
    raw_batch_id: string;
    meat_batch_id: string;
    masa_batch_id: string;
    kebab_batch_id: string;
    shipment_id: string;
  };
}

export default function DevToolsPage() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc("simulate_full_production_day");

      if (error) {
        throw error;
      }

      const simResult = data as unknown as SimulationResult;
      setResult(simResult);
      
      if (simResult.success) {
        toast.success("Symulacja zakończona pomyślnie!");
      } else {
        toast.error(`Błąd: ${simResult.message}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Nieznany błąd";
      toast.error(`Błąd symulacji: ${errorMessage}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate("/");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <FlaskConical className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">DEV TOOLS / SEEDING</h1>
            <p className="text-muted-foreground">
              Narzędzia deweloperskie do testowania systemu
            </p>
          </div>
        </div>
        <Badge variant="destructive" className="text-sm">
          ⚠️ TYLKO ŚRODOWISKO TESTOWE
        </Badge>
      </div>

      {/* Demo readiness — auto-weryfikacja 9 warunków */}
      <DemoReadinessChecklist />

      {/* Warning */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">
                UWAGA: Operacje na tej stronie usuwają wszystkie dane!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Te narzędzia są przeznaczone wyłącznie do testowania systemu na
                środowisku deweloperskim. Uruchomienie symulacji spowoduje
                całkowite wyczyszczenie bazy danych i wypełnienie jej danymi
                testowymi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Simulation Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Symulacja Pełnego Przepływu Kebabowego
          </CardTitle>
          <CardDescription>
            Scenariusz "Golden Path" - kompletny przepływ: Surowiec → Rozbiór → Masowanie → Składanie → Mrożenie → Wysyłka
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario Description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                1. WMS - Przyjęcie (PZ)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Dostawa od Ferma Drobiu ABC</li>
                <li>• <strong>5000 kg</strong> Ćwiartki kurczaka klasa A</li>
                <li>• Utworzenie partii surowca (RawMeat)</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Scale className="h-4 w-4 text-orange-500" />
                2. MES - Rozbiór (Decomposition)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Zlecenie rozbioru (ROZ)</li>
                <li>• <strong>3000 kg</strong> Mięso (SemiFinished) = 60%</li>
                <li>• 1800 kg Kości + 200 kg Skóra (Waste)</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-purple-500" />
                3. MES - Masowanie (Processing)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Tumbler 4h z przyprawami</li>
                <li>• Baza: <strong>SemiFinished</strong> (mięso)</li>
                <li>• <strong>3300 kg</strong> Masy kebabowej = 110%</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Factory className="h-4 w-4 text-green-500" />
                4. MES - Składanie (Assembly)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 30x Kebab <strong>10kg</strong> = 300 kg</li>
                <li>• 100x Kebab <strong>15kg</strong> = 1500 kg</li>
                <li>• 75x Kebab <strong>20kg</strong> = 1500 kg</li>
                <li>• <strong>205 słupków</strong> łącznie</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-cyan-500" />
                5. MES - Mrożenie szokowe
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Temperatura: <strong>-35°C</strong></li>
                <li>• Czas mrożenia: <strong>4 godziny</strong></li>
                <li>• 205 słupków mrożonych</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-red-500" />
                6. Logistyka - Wysyłka (WZ)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>5 palet</strong> SSCC</li>
                <li>• Status: Shipped</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-500" />
              Pracownicy testowi
            </h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">EMP001</Badge>
                <span>Jan Kowalski - Rozbiór</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">EMP002</Badge>
                <span>Anna Nowak - Masowanie</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">EMP003</Badge>
                <span>Piotr Wiśniewski - Składanie/Mrożenie</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Run Button */}
          <div className="flex justify-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="lg"
                  variant="destructive"
                  className="h-16 px-8 text-lg"
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Symulacja w toku...
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      🔴 SYMULUJ PEŁNY PRZEPŁYW KEBABOWY
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Potwierdzenie usunięcia danych
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Ta operacja <strong>USUNIE WSZYSTKIE DANE</strong> z systemu i
                    wypełni go danymi testowymi.
                    <br /><br />
                    <strong>Zostanie utworzone:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>11 produktów (RawMeat, SemiFinished, FinishedGood, Waste)</li>
                      <li>1 receptura z bazą SemiFinished</li>
                      <li>4 zlecenia produkcyjne</li>
                      <li>6+ partii z pełną traceability</li>
                    </ul>
                    <br />
                    Czy na pewno chcesz kontynuować?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRunSimulation}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Tak, uruchom symulację
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && result.success && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              ✅ Symulacja zakończona pomyślnie!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Grid - Phase Yields */}
            <div>
              <h4 className="font-semibold mb-3">📊 Podsumowanie przepływu produkcji</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {result.summary.raw_input_kg?.toLocaleString('pl-PL')} kg
                  </p>
                  <p className="text-xs text-muted-foreground">Surowiec wejściowy</p>
                </div>
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {result.summary.decomposition?.yield_percent}%
                  </p>
                  <p className="text-xs text-muted-foreground">Uzysk rozbioru</p>
                  <p className="text-xs text-muted-foreground">{result.summary.decomposition?.meat_kg} kg mięsa</p>
                </div>
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {result.summary.processing?.yield_percent}%
                  </p>
                  <p className="text-xs text-muted-foreground">Uzysk masowania</p>
                  <p className="text-xs text-muted-foreground">{result.summary.processing?.output_kg} kg masy</p>
                </div>
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {result.summary.assembly?.total_kebabs}
                  </p>
                  <p className="text-xs text-muted-foreground">Słupków kebab</p>
                  <p className="text-xs text-muted-foreground">{result.summary.assembly?.total_weight_kg} kg</p>
                </div>
                <div className="bg-background rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-600">
                    {result.summary.logistics?.pallets_created}
                  </p>
                  <p className="text-xs text-muted-foreground">Palet wysłanych</p>
                  <p className="text-xs text-muted-foreground">{result.summary.logistics?.shipment_status}</p>
                </div>
              </div>
            </div>

            {/* Kebab Variants */}
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-semibold mb-3">🍢 Warianty kebaba (składanie)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold">{result.summary.assembly?.kebab_10kg_count}</span>
                  <span className="text-sm text-muted-foreground">Kebab 10kg</span>
                  <Badge variant="secondary">{(result.summary.assembly?.kebab_10kg_count || 0) * 10} kg</Badge>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold">{result.summary.assembly?.kebab_15kg_count}</span>
                  <span className="text-sm text-muted-foreground">Kebab 15kg</span>
                  <Badge variant="secondary">{(result.summary.assembly?.kebab_15kg_count || 0) * 15} kg</Badge>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold">{result.summary.assembly?.kebab_20kg_count}</span>
                  <span className="text-sm text-muted-foreground">Kebab 20kg</span>
                  <Badge variant="secondary">{(result.summary.assembly?.kebab_20kg_count || 0) * 20} kg</Badge>
                </div>
              </div>
            </div>

            {/* Recipe Verification */}
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-semibold mb-3">📋 Weryfikacja receptury z SemiFinished</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nazwa receptury</p>
                  <p className="font-medium">{result.recipe?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Surowiec bazowy</p>
                  <p className="font-medium">{result.recipe?.base_product}</p>
                  <Badge variant="outline" className="mt-1">{result.recipe?.base_category}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Produkt wyjściowy</p>
                  <p className="font-medium">{result.recipe?.output_product}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Docelowy uzysk</p>
                  <p className="font-medium text-green-600">{result.recipe?.target_yield_percent}%</p>
                </div>
              </div>
            </div>

            {/* Products by Category */}
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-semibold mb-3">🏷️ Produkty wg kategorii</h4>
              <div className="flex flex-wrap gap-2">
                {result.products_by_category && Object.entries(result.products_by_category).map(([cat, count]) => (
                  <Badge key={cat} variant="outline">
                    {cat}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Orders by Type */}
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-semibold mb-3">📝 Zlecenia produkcyjne wg typu</h4>
              <div className="flex flex-wrap gap-2">
                {result.orders_by_type && Object.entries(result.orders_by_type).map(([type, count]) => (
                  <Badge key={type} variant="secondary">
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Employee Codes */}
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-semibold mb-3">👥 Kody QR do testowania terminali</h4>
              <div className="flex flex-wrap gap-4">
                {result.employees && Object.entries(result.employees).map(([role, emp]) => (
                  <div key={role} className="flex items-center gap-2">
                    <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                      {(emp as { code: string }).code}
                    </code>
                    <span className="text-sm text-muted-foreground">
                      {(emp as { name: string }).name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button size="lg" onClick={handleGoToDashboard}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/settings/recipes")}>
                <ChefHat className="h-4 w-4 mr-2" />
                Sprawdź Receptury
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/production/orders")}>
                <Factory className="h-4 w-4 mr-2" />
                Zlecenia Produkcyjne
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/production/analytics")}>
                <Scale className="h-4 w-4 mr-2" />
                Analityka Przepływu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Result */}
      {result && !result.success && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ❌ Błąd symulacji
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{result.message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
