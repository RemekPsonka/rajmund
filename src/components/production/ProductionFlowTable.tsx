import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Download, Search } from "lucide-react";
import type { ProductionFlowDetail } from "@/hooks/useProductionFlow";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface ProductionFlowTableProps {
  details: ProductionFlowDetail[];
  isLoading?: boolean;
}

type SortField = keyof ProductionFlowDetail;
type SortDirection = "asc" | "desc";

const ORDER_TYPE_LABELS: Record<string, string> = {
  Decomposition: "Rozbór",
  Processing: "Przetwórstwo",
  Packing: "Pakowanie",
  Assembly: "Składanie Kebaba",
  Freezing: "Mrożenie",
};

const ORDER_TYPE_COLORS: Record<string, string> = {
  Decomposition: "bg-blue-100 text-blue-800",
  Processing: "bg-purple-100 text-purple-800",
  Packing: "bg-green-100 text-green-800",
};

export function ProductionFlowTable({ details, isLoading }: ProductionFlowTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("productionDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredDetails = details.filter((detail) => {
    const searchLower = search.toLowerCase();
    return (
      detail.orderNumber.toLowerCase().includes(searchLower) ||
      detail.inputBatchNumber.toLowerCase().includes(searchLower) ||
      detail.inputProductName.toLowerCase().includes(searchLower) ||
      detail.outputProductName.toLowerCase().includes(searchLower) ||
      (detail.outputBatchNumber?.toLowerCase() || "").includes(searchLower)
    );
  });

  const sortedDetails = [...filteredDetails].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    const aStr = String(aValue || "");
    const bStr = String(bValue || "");
    return sortDirection === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  const exportToCSV = () => {
    const headers = [
      "Data",
      "Nr zlecenia",
      "Typ",
      "Partia wejściowa",
      "Produkt wejściowy",
      "Waga wejściowa (kg)",
      "Kierunek",
      "Produkt wyjściowy",
      "Waga wyjściowa (kg)",
      "Partia wyjściowa",
      "Uzysk (%)",
    ];

    const rows = sortedDetails.map((d) => [
      d.productionDate,
      d.orderNumber,
      ORDER_TYPE_LABELS[d.orderType] || d.orderType,
      d.inputBatchNumber,
      d.inputProductName,
      d.inputWeight,
      d.inputDirection || "",
      d.outputProductName,
      d.outputWeight,
      d.outputBatchNumber || "",
      d.yieldPercent,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `przepływ-produkcji-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Szczegóły przepływu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Szczegóły przepływu</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedDetails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Brak danych do wyświetlenia
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="productionDate">Data</SortableHeader>
                  <SortableHeader field="orderNumber">Zlecenie</SortableHeader>
                  <TableHead>Typ</TableHead>
                  <SortableHeader field="inputBatchNumber">Partia wejściowa</SortableHeader>
                  <SortableHeader field="inputProductName">Produkt wejściowy</SortableHeader>
                  <SortableHeader field="inputWeight">Wejście (kg)</SortableHeader>
                  <TableHead>Kierunek</TableHead>
                  <SortableHeader field="outputProductName">Produkt wyjściowy</SortableHeader>
                  <SortableHeader field="outputWeight">Wyjście (kg)</SortableHeader>
                  <SortableHeader field="yieldPercent">Uzysk</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDetails.map((detail, idx) => (
                  <TableRow key={`${detail.orderId}-${idx}`}>
                    <TableCell className="whitespace-nowrap">
                      {detail.productionDate
                        ? format(new Date(detail.productionDate), "d MMM yyyy", { locale: pl })
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {detail.orderNumber}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={ORDER_TYPE_COLORS[detail.orderType] || ""}
                      >
                        {ORDER_TYPE_LABELS[detail.orderType] || detail.orderType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {detail.inputBatchNumber}
                    </TableCell>
                    <TableCell>{detail.inputProductName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {detail.inputWeight.toLocaleString("pl-PL")}
                    </TableCell>
                    <TableCell>
                      {detail.inputDirection && (
                        <Badge variant="outline">{detail.inputDirection}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{detail.outputProductName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {detail.outputWeight.toLocaleString("pl-PL")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={detail.yieldPercent >= 100 ? "default" : "secondary"}
                        className={
                          detail.yieldPercent >= 100
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }
                      >
                        {detail.yieldPercent}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3 text-sm text-muted-foreground">
          Wyświetlono {sortedDetails.length} z {details.length} rekordów
        </div>
      </CardContent>
    </Card>
  );
}
