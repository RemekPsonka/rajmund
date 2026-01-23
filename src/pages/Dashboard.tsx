import {
  Building2,
  Factory,
  Users,
  TrendingUp,
  AlertCircle,
  Package,
  Truck,
  ClipboardList,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import { useEmployees } from "@/hooks/useEmployees";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { useAlerts } from "@/hooks/useAlerts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: facilities, isLoading: loadingFacilities } = useFacilities();
  const { data: employees, isLoading: loadingEmployees } = useEmployees();
  const { data: kpis, isLoading: loadingKPIs } = useDashboardKPIs();
  const { data: alertsData, isLoading: loadingAlerts } = useAlerts();

  const activeCompanies = companies?.filter((c) => c.is_active).length || 0;
  const activeEmployees = employees?.filter((e) => e.is_active).length || 0;
  const plantFacilities = facilities?.filter((f) => f.type === "Plant").length || 0;

  const stats = [
    {
      title: "Spółki",
      value: loadingCompanies ? "..." : companies?.length || 0,
      subtitle: `${activeCompanies} aktywnych`,
      icon: Building2,
      trend: "+2 w tym miesiącu",
    },
    {
      title: "Zakłady",
      value: loadingFacilities ? "..." : facilities?.length || 0,
      subtitle: `${plantFacilities} zakładów produkcyjnych`,
      icon: Factory,
      trend: "Wszystkie aktywne",
    },
    {
      title: "Pracownicy",
      value: loadingEmployees ? "..." : employees?.length || 0,
      subtitle: `${activeEmployees} aktywnych`,
      icon: Users,
      trend: "Na bieżąco",
    },
    {
      title: "Wydajność",
      value: "—",
      subtitle: "Brak danych",
      icon: TrendingUp,
      trend: "Wymaga MES",
    },
  ];

  const chartConfig = {
    kg: {
      label: "Produkcja (kg)",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pulpit</h1>
        <p className="text-muted-foreground">Przegląd systemu NARROW OPS</p>
      </div>

      {/* Operational KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-industrial">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produkcja dziś
            </CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingKPIs ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {kpis?.dailyProductionKg.toLocaleString("pl-PL")} kg
                </div>
                <p className="text-xs text-muted-foreground">Wyprodukowano dzisiaj</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card
          className="shadow-industrial cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate("/production/orders")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Otwarte zlecenia
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingKPIs ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.openOrdersCount || 0}</div>
                <p className="text-xs text-muted-foreground">Zleceń do realizacji</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card
          className="shadow-industrial cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate("/shipping")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wysyłki dziś
            </CardTitle>
            <Truck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingKPIs ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.todayShipmentsCount || 0}</div>
                <p className="text-xs text-muted-foreground">Do wysyłki</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card
          className={`shadow-industrial cursor-pointer hover:border-primary/50 transition-colors ${
            (kpis?.expiringBatchesCount || 0) > 0 ? "border-warning/50" : ""
          }`}
          onClick={() => navigate("/warehouse/batches")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Partie wygasające
            </CardTitle>
            <Package className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            {loadingKPIs ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {kpis?.expiringBatchesCount || 0}
                  {(kpis?.blockedBatchesCount || 0) > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      +{kpis?.blockedBatchesCount} zablok.
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">W ciągu 7 dni</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {!loadingAlerts && alertsData && alertsData.alerts.length > 0 && (
        <Card className="border-warning/50 bg-warning/5 shadow-industrial">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle className="text-base">
                Alerty ({alertsData.totalCount})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {alertsData.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 rounded-md p-3 bg-background cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => alert.link && navigate(alert.link)}
                >
                  <Badge
                    variant={
                      alert.severity === "critical"
                        ? "destructive"
                        : alert.severity === "warning"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {alert.count}
                  </Badge>
                  <div>
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Production Trend Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-industrial">
          <CardHeader>
            <CardTitle className="text-lg">Produkcja - ostatnie 7 dni</CardTitle>
            <CardDescription>Trend dzienny w kilogramach</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingKPIs ? (
              <Skeleton className="h-[200px] w-full" />
            ) : kpis?.weeklyProductionTrend && kpis.weeklyProductionTrend.some((d) => d.kg > 0) ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={kpis.weeklyProductionTrend}>
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={60} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="kg"
                    fill="var(--color-kg)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Brak danych produkcyjnych
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-industrial">
          <CardHeader>
            <CardTitle className="text-lg">Status systemu</CardTitle>
            <CardDescription>Moduły i integracje</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-sm">Core & IAM</span>
              </div>
              <span className="text-xs text-muted-foreground">Aktywny</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-sm">HR & Staffing</span>
              </div>
              <span className="text-xs text-muted-foreground">Aktywny</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-sm">WMS / MES</span>
              </div>
              <span className="text-xs text-muted-foreground">Aktywny</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-sm">Bridge (IoT/Subiekt)</span>
              </div>
              <span className="text-xs text-muted-foreground">Planowany</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-industrial">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              <p className="mt-1 text-xs text-primary">{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-industrial">
          <CardHeader>
            <CardTitle className="text-lg">Szybkie akcje</CardTitle>
            <CardDescription>Najczęściej używane funkcje</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a
              href="/companies"
              className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
            >
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Zarządzaj spółkami</p>
                <p className="text-sm text-muted-foreground">
                  Dodaj lub edytuj strukturę organizacyjną
                </p>
              </div>
            </a>
            <a
              href="/employees"
              className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Pracownicy</p>
                <p className="text-sm text-muted-foreground">
                  Generuj karty QR i zarządzaj danymi
                </p>
              </div>
            </a>
            <a
              href="/production/orders"
              className="flex items-center gap-3 rounded-md p-3 hover:bg-accent transition-colors"
            >
              <ClipboardList className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Zlecenia produkcyjne</p>
                <p className="text-sm text-muted-foreground">
                  Utwórz nowe zlecenie lub przejdź do terminala
                </p>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="border-muted bg-muted/10 shadow-industrial">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Informacja</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              System NARROW OPS jest w fazie rozwoju. Moduł Bridge (IoT/Subiekt GT) jest planowany
              do wdrożenia w kolejnych etapach. Aktualnie dostępne są funkcje zarządzania strukturą
              organizacyjną, magazynem, produkcją i logistyką.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
