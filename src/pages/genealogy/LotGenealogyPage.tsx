import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, GitBranch, Package, ArrowUp, ArrowDown, Truck, Boxes } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useLotLineage, type LineageNode } from "@/hooks/useLotLineage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const EVENT_LABELS: Record<string, string> = {
  RECEIVING: "Przyjęcie",
  DISASSEMBLY: "Rozbiór",
  TUMBLING: "Masowanie",
  ASSEMBLY: "Składanie",
  FREEZING: "Mrożenie",
  AGGREGATION: "Agregacja",
  SHIPPING: "Wysyłka",
};

const EVENT_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  RECEIVING: "secondary",
  DISASSEMBLY: "default",
  TUMBLING: "default",
  ASSEMBLY: "default",
  FREEZING: "outline",
  AGGREGATION: "outline",
  SHIPPING: "destructive",
};

interface CurrentLot {
  id: string;
  internal_batch_number: string;
  initial_quantity: number;
  current_quantity: number;
  status: string;
  source_event_type: string | null;
  product: { name: string; sku: string | null } | null;
}

function useCurrentLot(lotId: string | undefined) {
  return useQuery({
    queryKey: ["batch-detail", lotId],
    enabled: !!lotId,
    queryFn: async (): Promise<CurrentLot | null> => {
      if (!lotId) return null;
      const { data, error } = await supabase
        .from("t_batches")
        .select(
          "id, internal_batch_number, initial_quantity, current_quantity, status, source_event_type, product:t_products(name, sku)",
        )
        .eq("id", lotId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CurrentLot | null;
    },
  });
}

function NodeRow({ node }: { node: LineageNode }) {
  const indent = (node.depth - 1) * 24;
  return (
    <div
      className="flex items-center gap-3 py-2 border-l-2 border-border pl-4 ml-2 hover:bg-muted/40 rounded-r transition-colors"
      style={{ marginLeft: indent }}
    >
      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
      <Link
        to={`/genealogia/${node.lot_id}`}
        className="font-mono text-sm font-medium text-primary hover:underline"
      >
        {node.lot_code ?? node.lot_id.slice(0, 8)}
      </Link>
      <Badge variant={EVENT_VARIANTS[node.event_type] ?? "outline"} className="text-xs">
        {EVENT_LABELS[node.event_type] ?? node.event_type}
      </Badge>
      <span className="text-sm text-muted-foreground">{Number(node.qty_kg).toFixed(2)} kg</span>
      <span className="text-xs text-muted-foreground ml-auto">
        {format(new Date(node.occurred_at), "dd MMM yyyy HH:mm", { locale: pl })}
      </span>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function LotGenealogyPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const lineage = useLotLineage(lotId ?? null);
  const current = useCurrentLot(lotId);

  useEffect(() => {
    if (lineage.error) {
      toast.error(`Błąd ładowania genealogii: ${(lineage.error as Error).message}`);
    }
  }, [lineage.error]);

  const lotCode = current.data?.internal_batch_number ?? lotId?.slice(0, 8) ?? "";

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/warehouse/batches">Magazyn</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/warehouse/batches">Partie</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Genealogia {lotCode}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Genealogia partii</h1>
            <p className="text-sm text-muted-foreground">
              Pełne drzewo rodzic-dziecko dla partii {lotCode}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/warehouse/batches">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Powrót do partii
          </Link>
        </Button>
      </div>

      <Card className="shadow-industrial">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowUp className="h-5 w-5 text-muted-foreground" />
            Rodzice (skąd pochodzi)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineage.isLoading ? (
            <SectionSkeleton />
          ) : lineage.data && lineage.data.ancestors.length > 0 ? (
            <div className="space-y-1">
              {lineage.data.ancestors.map((node, idx) => (
                <NodeRow key={`${node.lot_id}-${idx}`} node={node} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Brak rodziców (partia źródłowa, np. dostawa)
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-industrial border-primary/40 border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Ta partia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {current.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : current.data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Numer partii</p>
                <code className="text-sm font-medium bg-muted px-2 py-1 rounded">
                  {current.data.internal_batch_number}
                </code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Produkt</p>
                <p className="font-medium">{current.data.product?.name ?? "-"}</p>
                {current.data.product?.sku && (
                  <p className="text-xs text-muted-foreground">{current.data.product.sku}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ilość</p>
                <p className="font-medium">
                  {Number(current.data.current_quantity).toFixed(2)} /{" "}
                  {Number(current.data.initial_quantity).toFixed(2)} kg
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  <Badge variant="outline">{current.data.status}</Badge>
                  {current.data.source_event_type && (
                    <Badge
                      variant={EVENT_VARIANTS[current.data.source_event_type] ?? "outline"}
                      className="text-xs"
                    >
                      {EVENT_LABELS[current.data.source_event_type] ??
                        current.data.source_event_type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nie znaleziono partii.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-industrial">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowDown className="h-5 w-5 text-muted-foreground" />
            Dzieci (gdzie poszła)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineage.isLoading ? (
            <SectionSkeleton />
          ) : lineage.data && lineage.data.descendants.length > 0 ? (
            <div className="space-y-1">
              {lineage.data.descendants.map((node, idx) => (
                <NodeRow key={`${node.lot_id}-${idx}`} node={node} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Brak dzieci (partia jeszcze nie została użyta)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
