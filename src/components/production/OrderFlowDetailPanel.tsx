import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  ArrowRight,
  Package,
  Truck,
  Factory,
  Link as LinkIcon,
  TrendingUp,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrderTraceabilityData } from "@/hooks/useOrderTraceability";

interface OrderFlowDetailPanelProps {
  data: OrderTraceabilityData | null;
  isLoading?: boolean;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  Decomposition: "Rozbór",
  Processing: "Przetwórstwo",
  Packing: "Pakowanie",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-500/10 text-blue-700 border-blue-200",
  Closed: "bg-green-500/10 text-green-700 border-green-200",
  Cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export function OrderFlowDetailPanel({
  data,
  isLoading,
}: OrderFlowDetailPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { order, sourceBatches, outputBatches, relatedOrders, summary } = data;

  // Group output batches by product for summary
  const outputByProduct = new Map<
    string,
    { productName: string; totalWeight: number; count: number }
  >();
  outputBatches.forEach((batch) => {
    const existing = outputByProduct.get(batch.productId);
    if (existing) {
      existing.totalWeight += batch.weightNet;
      existing.count += 1;
    } else {
      outputByProduct.set(batch.productId, {
        productName: batch.productName,
        totalWeight: batch.weightNet,
        count: 1,
      });
    }
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <Factory className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              Zlecenie: {order.orderNumber}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {ORDER_TYPE_LABELS[order.type || ""] || order.type}
            </Badge>
            <Badge
              variant="outline"
              className={ORDER_STATUS_COLORS[order.status || ""] || ""}
            >
              {order.status === "Open"
                ? "Otwarte"
                : order.status === "Closed"
                  ? "Zamknięte"
                  : order.status}
            </Badge>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {order.productionDate &&
            format(new Date(order.productionDate), "d MMMM yyyy", {
              locale: pl,
            })}{" "}
          • {order.facilityName}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">
              {summary.totalInputKg.toLocaleString("pl-PL", {
                maximumFractionDigits: 1,
              })}{" "}
              kg
            </div>
            <div className="text-xs text-muted-foreground">Wejście</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {summary.totalOutputKg.toLocaleString("pl-PL", {
                maximumFractionDigits: 1,
              })}{" "}
              kg
            </div>
            <div className="text-xs text-muted-foreground">Wyjście</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {summary.yieldPercent.toLocaleString("pl-PL", {
                maximumFractionDigits: 1,
              })}
              %
            </div>
            <div className="text-xs text-muted-foreground">Uzysk</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {summary.wasteKg.toLocaleString("pl-PL", {
                maximumFractionDigits: 1,
              })}{" "}
              kg
            </div>
            <div className="text-xs text-muted-foreground">Straty</div>
          </div>
        </div>

        <Separator />

        {/* Source Batches */}
        <div>
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-blue-600" />
            Źródła (partie wejściowe)
          </h4>
          {sourceBatches.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              Brak zarejestrowanych wejść
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partia</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Kierunek</TableHead>
                  <TableHead className="text-right">Waga</TableHead>
                  <TableHead>Dostawa (PZ)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceBatches.map((batch, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">
                      {batch.internalBatchNumber}
                    </TableCell>
                    <TableCell>{batch.productName}</TableCell>
                    <TableCell>
                      {batch.direction && (
                        <Badge variant="outline" className="text-xs">
                          {batch.direction}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {batch.weight.toLocaleString("pl-PL", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      kg
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {batch.deliveryDocumentNumber || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-center">
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
        </div>

        {/* Output Batches */}
        <div>
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-green-600" />
            Wyjścia (partie wynikowe)
          </h4>
          {outputBatches.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              Brak zarejestrowanych wyjść
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Partia wyjściowa</TableHead>
                  <TableHead>Opakowanie</TableHead>
                  <TableHead className="text-right">Waga netto</TableHead>
                  <TableHead className="text-right">Uzysk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outputBatches.map((batch, idx) => {
                  const yieldPct =
                    summary.totalInputKg > 0
                      ? (batch.weightNet / summary.totalInputKg) * 100
                      : 0;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {batch.productName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {batch.internalBatchNumber || "-"}
                      </TableCell>
                      <TableCell>
                        {batch.packagingCount && batch.packagingType ? (
                          <span className="text-sm">
                            {batch.packagingCount} × {batch.packagingType}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {batch.weightNet.toLocaleString("pl-PL", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        kg
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            yieldPct > 20
                              ? "bg-green-500/10 text-green-700"
                              : yieldPct > 5
                                ? "bg-yellow-500/10 text-yellow-700"
                                : "bg-muted text-muted-foreground"
                          }
                        >
                          {yieldPct.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Product Summary */}
        {outputByProduct.size > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                Podsumowanie produktów
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Array.from(outputByProduct.values()).map((product, idx) => {
                  const pct =
                    summary.totalInputKg > 0
                      ? (product.totalWeight / summary.totalInputKg) * 100
                      : 0;
                  return (
                    <div
                      key={idx}
                      className="bg-muted/30 rounded-lg p-3 border"
                    >
                      <div className="font-medium text-sm truncate">
                        {product.productName}
                      </div>
                      <div className="text-lg font-bold">
                        {product.totalWeight.toLocaleString("pl-PL", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        kg
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pct.toFixed(1)}% • {product.count} szt.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Related Orders */}
        {relatedOrders.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <LinkIcon className="h-4 w-4 text-purple-600" />
                Powiązane zlecenia
              </h4>
              <div className="space-y-2">
                {relatedOrders.map((related, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-sm bg-muted/30 rounded-lg p-2"
                  >
                    {related.relation === "uses_our_output" ? (
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-700 text-xs"
                      >
                        Używa naszej partii
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-700 text-xs"
                      >
                        Źródło dla nas
                      </Badge>
                    )}
                    <span className="font-mono">{related.orderNumber}</span>
                    <span className="text-muted-foreground">
                      ({ORDER_TYPE_LABELS[related.orderType] || related.orderType})
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span>{related.productName}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      ({related.batchNumber})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        {order.notes && (
          <>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <strong>Uwagi:</strong> {order.notes}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
