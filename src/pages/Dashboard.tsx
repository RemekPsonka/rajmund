import { Building2, Factory, Users, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import { useEmployees } from "@/hooks/useEmployees";

export default function Dashboard() {
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: facilities, isLoading: loadingFacilities } = useFacilities();
  const { data: employees, isLoading: loadingEmployees } = useEmployees();

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pulpit</h1>
        <p className="text-muted-foreground">Przegląd systemu NARROW OPS</p>
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
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-sm">Bridge (IoT/Subiekt)</span>
              </div>
              <span className="text-xs text-muted-foreground">Planowany</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-sm">WMS / MES</span>
              </div>
              <span className="text-xs text-muted-foreground">Nieaktywny</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-warning/50 bg-warning/5 shadow-industrial">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <CardTitle className="text-base">Informacja</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            System NARROW OPS jest w fazie rozwoju. Moduły WMS, MES i Bridge są planowane do
            wdrożenia w kolejnych etapach. Aktualnie dostępne są funkcje zarządzania strukturą
            organizacyjną i pracownikami.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}