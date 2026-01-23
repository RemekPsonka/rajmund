import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Scale, AlertTriangle, FileCheck, Layers } from "lucide-react";
import type { ProductionFlowSummary } from "@/hooks/useProductionFlow";

interface ProductionFlowKPIsProps {
  summary: ProductionFlowSummary;
  isLoading?: boolean;
}

export function ProductionFlowKPIs({ summary, isLoading }: ProductionFlowKPIsProps) {
  const kpis = [
    {
      title: "Surowiec (wejście)",
      value: summary.totalInputKg,
      format: (v: number) => `${v.toLocaleString('pl-PL')} kg`,
      icon: ArrowDown,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Produkt (wyjście)",
      value: summary.totalOutputKg,
      format: (v: number) => `${v.toLocaleString('pl-PL')} kg`,
      icon: ArrowUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Uzysk całkowity",
      value: summary.yieldPercent,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: Scale,
      color: summary.yieldPercent >= 100 ? "text-green-600" : "text-amber-600",
      bgColor: summary.yieldPercent >= 100 ? "bg-green-50" : "bg-amber-50",
    },
    {
      title: "Ubytek technologiczny",
      value: summary.wasteKg,
      format: (v: number) => `${v.toLocaleString('pl-PL')} kg`,
      icon: AlertTriangle,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      title: "Zamknięte zlecenia",
      value: summary.ordersCount,
      format: (v: number) => v.toString(),
      icon: FileCheck,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Partie utworzone",
      value: summary.batchesCreated,
      format: (v: number) => v.toString(),
      icon: Layers,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  {kpi.title}
                </p>
                <p className="text-2xl font-bold tracking-tight">
                  {kpi.format(kpi.value)}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
