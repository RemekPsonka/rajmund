import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { 
  Package, 
  Factory, 
  Truck, 
  ClipboardList, 
  AlertTriangle, 
  ArrowRight, 
  Warehouse,
  TrendingUp,
  Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { useAlerts } from "@/hooks/useAlerts";
import { 
  useStockTotals, 
  useProductionTodayTotal, 
  useTopProductsByStock, 
  useRecentMovements 
} from "@/hooks/useAnalyticsViews";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: alerts } = useAlerts();
  
  // Dane z widoków analitycznych
  const { data: stockTotals, isLoading: stockLoading } = useStockTotals();
  const { data: productionToday, isLoading: productionLoading } = useProductionTodayTotal();
  const { data: topProducts, isLoading: topProductsLoading } = useTopProductsByStock(5);
  const { data: recentMovements, isLoading: movementsLoading } = useRecentMovements(5);

  const quickActions = [
    { label: "Nowe przyjęcie (PZ)", path: "/warehouse/deliveries/new", icon: Package },
    { label: "Nowe zlecenie produkcyjne", path: "/production/orders", icon: Factory },
    { label: "Terminal wagowy", path: "/production/terminal", icon: Activity },
    { label: "Nowa wysyłka", path: "/shipping", icon: Truck },
  ];

  const getDocTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "PZ": return "default";
      case "WZ": return "secondary";
      case "MM": return "outline";
      case "RW": return "destructive";
      case "PW": return "default";
      default: return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Approved": return "default";
      case "Draft": return "secondary";
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Przegląd operacyjny systemu NARROW ERP
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {format(new Date(), "EEEE, d MMMM yyyy", { locale: pl })}
        </Badge>
      </div>

      {/* Główne KPI - 4 karty */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Stan Magazynowy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stan Magazynowy</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stockLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stockTotals?.totalWeight.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} kg
                </div>
                <p className="text-xs text-muted-foreground">
                  {stockTotals?.productsWithStock || 0} produktów • {stockTotals?.totalBatches || 0} partii
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Produkcja Dzisiaj */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produkcja Dzisiaj</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {productionLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {productionToday?.totalOutputKg.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} kg
                </div>
                <p className="text-xs text-muted-foreground">
                  {productionToday?.totalLogs || 0} operacji ważenia
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Otwarte Zlecenia */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Otwarte Zlecenia</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.openOrdersCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  zlecenia w trakcie realizacji
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Wysyłki Dzisiaj */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wysyłki Dzisiaj</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.todayShipmentsCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  zaplanowanych na dziś
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerty o partiach */}
      {alerts && alerts.criticalCount > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base">Wymagana uwaga</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-semibold text-destructive">{alerts.criticalCount}</span> partii wymaga pilnej uwagi
                </p>
                <p className="text-xs text-muted-foreground">
                  {alerts.totalCount} partii z alertami
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/warehouse/batches")}
              >
                Zobacz partie
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wykresy */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Trend produkcji 7 dni */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Produkcja - ostatnie 7 dni
            </CardTitle>
            <CardDescription>Dzienna wydajność produkcyjna (kg)</CardDescription>
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={kpis?.weeklyProductionTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString("pl-PL")} kg`, "Produkcja"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="kg" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 produktów */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top 5 produktów na magazynie
            </CardTitle>
            <CardDescription>Produkty z największym stanem (kg)</CardDescription>
          </CardHeader>
          <CardContent>
            {topProductsLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : topProducts && topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={topProducts}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis 
                    dataKey="product_name" 
                    type="category" 
                    width={100}
                    className="text-xs"
                    tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + "..." : value}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString("pl-PL")} kg`, "Stan"]}
                  />
                  <Bar 
                    dataKey="total_weight" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                Brak danych o stanach magazynowych
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ostatnie operacje WMS + Szybkie akcje */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Ostatnie operacje WMS */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Ostatnie operacje WMS
            </CardTitle>
            <CardDescription>5 ostatnich dokumentów magazynowych</CardDescription>
          </CardHeader>
          <CardContent>
            {movementsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentMovements && recentMovements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dokument</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Kontrahent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-medium">
                        {movement.document_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getDocTypeBadgeVariant(movement.type)}>
                          {movement.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.contractor_name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(movement.status)}>
                          {movement.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(new Date(movement.created_at), "d MMM HH:mm", { locale: pl })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                Brak operacji magazynowych
              </div>
            )}
          </CardContent>
        </Card>

        {/* Szybkie akcje */}
        <Card>
          <CardHeader>
            <CardTitle>Szybkie akcje</CardTitle>
            <CardDescription>Najczęstsze operacje</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Button
                key={action.path}
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(action.path)}
              >
                <action.icon className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Status systemu */}
      <Card>
        <CardHeader>
          <CardTitle>Status systemu</CardTitle>
          <CardDescription>Informacje o aktualnym stanie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Baza danych: Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Autoryzacja: Aktywna</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Sync: OK</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
