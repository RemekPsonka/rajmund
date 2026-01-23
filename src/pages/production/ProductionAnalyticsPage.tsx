import { useState } from "react";
import { GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductionFlowFilters } from "@/components/production/ProductionFlowFilters";
import { ProductionFlowKPIs } from "@/components/production/ProductionFlowKPIs";
import { ProductionFlowChart } from "@/components/production/ProductionFlowChart";
import { ProductionFlowTable } from "@/components/production/ProductionFlowTable";
import {
  useProductionFlow,
  useProductionFlowDetails,
  type FlowFilters,
} from "@/hooks/useProductionFlow";

export default function ProductionAnalyticsPage() {
  const [filters, setFilters] = useState<FlowFilters>({});

  const {
    data: flowData,
    isLoading: isLoadingFlow,
    refetch: refetchFlow,
  } = useProductionFlow(filters);

  const {
    data: details,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useProductionFlowDetails(filters);

  const handleRefresh = () => {
    refetchFlow();
    refetchDetails();
  };

  const emptySummary = {
    totalInputKg: 0,
    totalOutputKg: 0,
    yieldPercent: 0,
    wasteKg: 0,
    ordersCount: 0,
    batchesCreated: 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <GitBranch className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analiza przepływu produkcji</h1>
            <p className="text-muted-foreground">
              Śledzenie materiałów od wejścia (PZ) do wyjścia (WZ)
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Odśwież
        </Button>
      </div>

      {/* Filters */}
      <ProductionFlowFilters filters={filters} onFiltersChange={setFilters} />

      {/* KPIs */}
      <ProductionFlowKPIs
        summary={flowData?.summary || emptySummary}
        isLoading={isLoadingFlow}
      />

      {/* Sankey Chart */}
      <ProductionFlowChart
        nodes={flowData?.nodes || []}
        links={flowData?.links || []}
        isLoading={isLoadingFlow}
      />

      {/* Detail Table */}
      <ProductionFlowTable
        details={details || []}
        isLoading={isLoadingDetails}
      />
    </div>
  );
}
