import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, GitBranch, Package, ArrowUp, Boxes, Truck, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useLotLineage, type LineageNode } from "@/hooks/useLotLineage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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

interface PalletData {
  id: string;
  sscc_number: string;
  status: string | null;
  type: string | null;
  production_date: string | null;
  total_net_weight: number | null;
  total_gross_weight: number | null;
  items_count: number | null;
  created_at: string;
}

interface PalletBatch {
  log_id: string;
  source_batch_id: string | null;
  output_batch_id: string | null;
  weight_net: number | null;
  weight_gross: number;
  source_batch: {
    id: string;
    internal_batch_number: string;
    product: { name: string; sku: string | null } | null;
  } | null;
  output_batch: {
    id: string;
    internal_batch_number: string;
    product: { name: string; sku: string | null } | null;
  } | null;
}

function usePalletBySSCC(sscc: string | undefined) {
  return useQuery({
    queryKey: ["pallet-by-sscc", sscc],
    enabled: !!sscc,
    queryFn: async (): Promise<PalletData | null> => {
      if (!sscc) return null;
      const { data, error } = await supabase
        .from("t_handling_units")
        .select(
          "id, sscc_number, status, type, production_date, total_net_weight, total_gross_weight, items_count, created_at",
        )
        .eq("sscc_number", sscc)
        .maybeSingle();
      if (error) throw error;
      return data as PalletData | null;
    },
  });
}

function usePalletBatches(palletId: string | undefined) {
  return useQuery({
    queryKey: ["pallet-batches", palletId],
    enabled: !!palletId,
    queryFn: async (): Promise<PalletBatch[]> => {
      if (!palletId) return [];
      const { data, error } = await supabase
        .from("t_production_logs")
        .select(
          `id, source_batch_id, output_batch_id, weight_net, weight_gross,
           source_batch:t_batches!t_production_logs_source_batch_id_fkey(id, internal_batch_number, product:t_products(name, sku)),
           output_batch:t_batches!t_production_logs_output_batch_id_fkey(id, internal_batch_number, product:t_products(name, sku))`,
        )
        .eq("handling_unit_id", palletId);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        log_id: r.id,
        source_batch_id: r.source_batch_id,
        output_batch_id: r.output_batch_id,
        weight_net: r.weight_net,
        weight_gross: r.weight_gross,
        source_batch: r.source_batch,
        output_batch: r.output_batch,
      }));
    },
  });
}

function NodeRow({ node }: { node: LineageNode }) {
  const indent = Math.max(0, (node.depth - 1) * 24);
  const Icon = node.is_root ? Truck : node.is_pallet ? Boxes : Package;

  const content = (
    <span className="font-mono text-sm font-medium text-primary hover:underline">
      {node.lot_code ?? node.lot_id.slice(0, 8)}
    </span>
  );

  return (
    <div
      className="flex items-center gap-3 py-2 border-l-2 border-border pl-4 ml-2 hover:bg-muted/40 rounded-r transition-colors"
      style={{ marginLeft: indent }}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${
          node.is_root ? "text-blue-600" : node.is_pallet ? "text-amber-600" : "text-muted-foreground"
        }`}
      />
      {node.is_root || node.is_pallet ? (
        content
      ) : (
        <Link to={`/genealogia/${node.lot_id}`}>{content}</Link>
      )}
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

function BatchLineageCard({
  batch,
}: {
  batch: { id: string; internal_batch_number: string; product?: { name: string; sku: string | null } | null };
}) {
  const lineage = useLotLineage(batch.id);

  return (
    <Card className="shadow-industrial">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <Link to={`/genealogia/${batch.id}`} className="font-mono hover:underline">
              {batch.internal_batch_number}
            </Link>
            {batch.product && (
              <span className="text-sm text-muted-foreground font-normal">
                — {batch.product.name}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/genealogia/${batch.id}`}>
              <GitBranch className="h-4 w-4 mr-1" />
              Pełna genealogia
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
            Rodzice (skąd pochodzi)
          </h4>
          {lineage.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : lineage.data && lineage.data.ancestors.length > 0 ? (
            <div className="space-y-1">
              {lineage.data.ancestors.map((node, idx) => (
                <NodeRow key={`${node.lot_id}-${idx}`} node={node} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Brak rodziców (partia źródłowa).
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SSCCGenealogyPage() {
  const { sscc } = useParams<{ sscc: string }>();
  const pallet = usePalletBySSCC(sscc);
  const batches = usePalletBatches(pallet.data?.id);

  useEffect(() => {
    if (pallet.error) toast.error(`Błąd: ${(pallet.error as Error).message}`);
    if (batches.error) toast.error(`Błąd: ${(batches.error as Error).message}`);
  }, [pallet.error, batches.error]);

  // Unikalne partie źródłowe + wyjściowe na palecie
  const uniqueBatches = useMemo(() => {
    const map = new Map<string, { id: string; internal_batch_number: string; product?: any }>();
    (batches.data ?? []).forEach((b) => {
      if (b.output_batch) map.set(b.output_batch.id, b.output_batch);
      else if (b.source_batch) map.set(b.source_batch.id, b.source_batch);
    });
    return Array.from(map.values());
  }, [batches.data]);

  if (pallet.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!pallet.data) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/warehouse/batches">Magazyn</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Genealogia SSCC</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <EmptyState
          icon={Search}
          title="Nie znaleziono palety"
          description={`Brak palety o numerze SSCC: ${sscc ?? "-"}`}
          action={
            <Button asChild variant="outline">
              <Link to="/warehouse/batches">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Powrót do partii
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const p = pallet.data;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/warehouse/batches">Magazyn</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Genealogia palety {p.sscc_number}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Boxes className="h-6 w-6 text-amber-600" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Genealogia palety</h1>
            <p className="text-sm text-muted-foreground font-mono">SSCC: {p.sscc_number}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/warehouse/batches">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Powrót
          </Link>
        </Button>
      </div>

      <Card className="shadow-industrial border-amber-500/40 border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Boxes className="h-5 w-5 text-amber-600" />
            Paleta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">SSCC</p>
              <code className="text-sm font-medium bg-muted px-2 py-1 rounded">{p.sscc_number}</code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline">{p.status ?? "-"}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Typ</p>
              <p className="font-medium">{p.type ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data produkcji</p>
              <p className="font-medium">
                {p.production_date
                  ? format(new Date(p.production_date), "dd MMM yyyy", { locale: pl })
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Waga netto</p>
              <p className="font-medium">{Number(p.total_net_weight ?? 0).toFixed(3)} kg</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Waga brutto</p>
              <p className="font-medium">{Number(p.total_gross_weight ?? 0).toFixed(3)} kg</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sztuk</p>
              <p className="font-medium">{p.items_count ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Utworzono</p>
              <p className="font-medium">
                {format(new Date(p.created_at), "dd MMM yyyy HH:mm", { locale: pl })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-industrial">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Partie na palecie ({uniqueBatches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {batches.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : uniqueBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak partii powiązanych z tą paletą.</p>
          ) : (
            <div className="space-y-2">
              {uniqueBatches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 p-3 rounded border bg-muted/20"
                >
                  <Package className="h-4 w-4 text-primary" />
                  <code className="font-mono text-sm font-medium">{b.internal_batch_number}</code>
                  {b.product && (
                    <span className="text-sm text-muted-foreground">— {b.product.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          Drzewa genealogii partii
        </h2>
        {batches.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          uniqueBatches.map((b) => <BatchLineageCard key={b.id} batch={b} />)
        )}
      </div>
    </div>
  );
}
