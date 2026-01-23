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

interface SimulationResult {
  success: boolean;
  message: string;
  summary: {
    company_id: string;
    facility_id: string;
    input_weight_kg: number;
    fillet_produced_kg: number;
    bones_produced_kg: number;
    technological_loss_kg: number;
    yield_decomposition_pct: number;
    kebab_produced_kg: number;
    kebab_blocks: number;
    pallets_created: number;
    shipment_status: string;
    bones_remaining_kg: number;
    kebab_remaining_kg: number;
  };
  employees: {
    jan_kowalski_id: string;
    adam_nowak_id: string;
    anna_zmiana_id: string;
  };
  test_codes: {
    qr_jan: string;
    qr_adam: string;
    qr_anna: string;
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
      toast.success("Symulacja zakończona pomyślnie!");
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
            Symulacja Pełnego Dnia Produkcji
          </CardTitle>
          <CardDescription>
            Scenariusz "Golden Path" - kompletny przepływ od przyjęcia surowca do
            wysyłki
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
                <li>• Dostawa od 2Mundos S.A.</li>
                <li>• 5000 kg Ćwiartki Kurczaka</li>
                <li>• Utworzenie partii surowca</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Scale className="h-4 w-4 text-orange-500" />
                2. MES - Rozbiór
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Zlecenie rozbioru (ROZ)</li>
                <li>• 3000 kg Filet (60% uzysk)</li>
                <li>• 1900 kg Kości (odpad)</li>
                <li>• 100 kg ubytek technologiczny</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Factory className="h-4 w-4 text-purple-500" />
                3. MES - Przetwórstwo
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Zlecenie kebab (PRZ)</li>
                <li>• 220 bloków Kebab 15kg</li>
                <li>• 3300 kg (przyrost masy)</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                4. Pracownicy testowi
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • <strong>Jan Kowalski</strong> - Operator (QR: QR_JAN)
                </li>
                <li>
                  • <strong>Adam Nowak</strong> - Trybowszczyk (QR: QR_ADAM)
                </li>
                <li>
                  • <strong>Anna Zmiana</strong> - Kierownik (QR: QR_ANNA)
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-red-500" />
                5. Logistyka - Wysyłka
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 4 palety (każda ~825 kg)</li>
                <li>• Wysyłka do Josef Schnabels GmbH</li>
                <li>• Transport: SK 44222</li>
                <li>• Status: Shipped</li>
              </ul>
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
                      🔴 SYMULUJ PEŁNY DZIEŃ PRODUKCJI
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
                    wypełni go danymi testowymi. Operacja jest nieodwracalna.
                    <br />
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
      {result && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Symulacja zakończona pomyślnie!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">
                  {result.summary.input_weight_kg.toLocaleString()} kg
                </p>
                <p className="text-sm text-muted-foreground">Surowiec wejściowy</p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {result.summary.yield_decomposition_pct}%
                </p>
                <p className="text-sm text-muted-foreground">Uzysk rozbioru</p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {result.summary.kebab_blocks}
                </p>
                <p className="text-sm text-muted-foreground">Bloków Kebab</p>
              </div>
              <div className="bg-background rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {result.summary.pallets_created}
                </p>
                <p className="text-sm text-muted-foreground">Palet wysłanych</p>
              </div>
            </div>

            {/* Stock Summary */}
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-semibold mb-3">Stan magazynowy po symulacji:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span>Kebab Czerwony:</span>
                  <Badge
                    variant={
                      result.summary.kebab_remaining_kg === 0
                        ? "secondary"
                        : "default"
                    }
                  >
                    {result.summary.kebab_remaining_kg} kg
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Kości (odpad):</span>
                  <Badge variant="outline">
                    {result.summary.bones_remaining_kg} kg
                  </Badge>
                </div>
              </div>
            </div>

            {/* Test Codes */}
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-semibold mb-3">Kody QR do testowania terminali:</h4>
              <div className="flex gap-4">
                <code className="bg-muted px-3 py-1 rounded text-sm">
                  {result.test_codes.qr_jan}
                </code>
                <code className="bg-muted px-3 py-1 rounded text-sm">
                  {result.test_codes.qr_adam}
                </code>
                <code className="bg-muted px-3 py-1 rounded text-sm">
                  {result.test_codes.qr_anna}
                </code>
              </div>
            </div>

            {/* Go to Dashboard */}
            <div className="flex justify-center pt-4">
              <Button size="lg" onClick={handleGoToDashboard}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Przejdź do Dashboardu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
