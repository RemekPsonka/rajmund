import { useState, useRef, useMemo } from "react";
import { Search, Layers, AlertCircle, CheckCircle, Clock, MoreHorizontal, Printer, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useBatches, useUpdateBatchStatus, type BatchStatus, type Batch } from "@/hooks/useBatches";
import { useCompanies } from "@/hooks/useCompanies";
import { useStorageLocations } from "@/hooks/useStorageLocations";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { BatchLabel } from "@/components/warehouse/BatchLabel";
import { ExportButton } from "@/components/ExportButton";

const statusConfig: Record<BatchStatus, { label: string; variant: "default" | "destructive" | "secondary"; icon: typeof CheckCircle }> = {
  Released: { label: "Zwolniona", variant: "default", icon: CheckCircle },
  Blocked: { label: "Zablokowana", variant: "destructive", icon: AlertCircle },
  Quarantine: { label: "Kwarantanna", variant: "secondary", icon: Clock },
};

const LOCATION_TYPE_COLORS: Record<string, string> = {
  chiller: "bg-blue-500",
  freezer: "bg-purple-500",
  shock: "bg-red-500",
  production: "bg-green-500",
  storage: "bg-gray-500",
};

const ITEMS_PER_PAGE = 50;

export default function BatchesPage() {
  const { data: batches, isLoading } = useBatches();
  const { data: companies } = useCompanies();
  const { data: locations } = useStorageLocations();
  const updateStatus = useUpdateBatchStatus();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const labelRef = useRef<HTMLDivElement>(null);

  const filteredBatches = useMemo(() => {
    return batches?.filter((batch) => {
      const matchesSearch =
        batch.internal_batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.supplier_batch_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.product?.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLocation = 
        locationFilter === "all" ||
        (locationFilter === "none" && !batch.location_id) ||
        batch.location_id === locationFilter;

      return matchesSearch && matchesLocation;
    });
  }, [batches, searchQuery, locationFilter]);

  // Pagination
  const totalPages = Math.ceil((filteredBatches?.length || 0) / ITEMS_PER_PAGE);
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBatches?.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBatches, currentPage]);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleLocationFilterChange = (value: string) => {
    setLocationFilter(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (batchId: string, newStatus: BatchStatus) => {
    updateStatus.mutate({ id: batchId, status: newStatus });
  };

  const handlePrintLabel = (batch: Batch) => {
    setSelectedBatch(batch);
    setLabelDialogOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: pl });
  };

  const isExpiringSoon = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 3 && daysUntilExpiry > 0;
  };

  const isExpired = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  // Get company name for label
  const getCompanyName = () => {
    return companies?.[0]?.name || "NARROW Sp. z o.o.";
  };

  // Prepare export data
  const exportData = filteredBatches?.map((batch) => ({
    internal_batch_number: batch.internal_batch_number,
    product_name: batch.product?.name || "",
    product_sku: batch.product?.sku || "",
    location_name: batch.location?.name || "",
    supplier_batch_number: batch.supplier_batch_number || "",
    production_date: batch.production_date ? formatDate(batch.production_date) : "",
    expiration_date: batch.expiration_date ? formatDate(batch.expiration_date) : "",
    current_quantity: `${batch.current_quantity.toFixed(2)} ${batch.product?.unit || "kg"}`,
    status: statusConfig[batch.status]?.label || batch.status,
    supplier_name: batch.supplier?.name || "",
  })) || [];

  const exportColumns: { key: keyof typeof exportData[0]; header: string }[] = [
    { key: "internal_batch_number", header: "Nr partii wewn." },
    { key: "product_name", header: "Produkt" },
    { key: "product_sku", header: "SKU" },
    { key: "location_name", header: "Lokalizacja" },
    { key: "supplier_batch_number", header: "Nr partii dostawcy" },
    { key: "supplier_name", header: "Dostawca" },
    { key: "production_date", header: "Data uboju" },
    { key: "expiration_date", header: "Data ważności" },
    { key: "current_quantity", header: "Ilość" },
    { key: "status", header: "Status" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Ewidencja Partii</h1>
          <p className="text-muted-foreground">
            Traceability - śledzenie partii towaru na magazynie
          </p>
        </div>
        <ExportButton
          data={exportData}
          columns={exportColumns}
          filename={`partie-${format(new Date(), "yyyy-MM-dd")}`}
          disabled={isLoading}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Szukaj po numerze partii lub produkcie..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={locationFilter} onValueChange={handleLocationFilterChange}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtruj lokalizację" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie lokalizacje</SelectItem>
            <SelectItem value="none">Bez lokalizacji</SelectItem>
            {locations?.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${LOCATION_TYPE_COLORS[loc.location_type] || "bg-gray-500"}`} />
                  {loc.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filteredBatches && filteredBatches.length > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            Wyświetlono {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredBatches.length)} z {filteredBatches.length}
          </span>
        )}
      </div>

      {/* Batches Table */}
      {isLoading ? (
        <Card className="shadow-industrial">
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredBatches?.length === 0 ? (
        <Card className="shadow-industrial">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Brak partii</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "Nie znaleziono pasujących partii"
                : "Partie zostaną utworzone przy przyjęciu towaru (PZ)"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-industrial">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr partii wewnętrzny</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Lokalizacja</TableHead>
                  <TableHead>Nr partii dostawcy</TableHead>
                  <TableHead>Data uboju</TableHead>
                  <TableHead>Data ważności</TableHead>
                  <TableHead className="text-right">Ilość</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBatches?.map((batch) => {
                  const status = statusConfig[batch.status];
                  const StatusIcon = status.icon;
                  const expired = isExpired(batch.expiration_date);
                  const expiringSoon = isExpiringSoon(batch.expiration_date);

                  return (
                    <TableRow key={batch.id} className={expired ? "bg-destructive/5" : expiringSoon ? "bg-warning/5" : ""}>
                      <TableCell>
                        <code className="text-sm font-medium bg-muted px-2 py-1 rounded">
                          {batch.internal_batch_number}
                        </code>
                      </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{batch.product?.name}</p>
                            {batch.product?.sku && (
                              <p className="text-xs text-muted-foreground">{batch.product.sku}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {batch.location ? (
                            <Badge variant="outline" className="gap-1">
                              <div className={`h-2 w-2 rounded-full ${LOCATION_TYPE_COLORS[batch.location.location_type] || "bg-gray-500"}`} />
                              {batch.location.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {batch.supplier_batch_number || "—"}
                        </TableCell>
                      <TableCell>{formatDate(batch.production_date)}</TableCell>
                      <TableCell>
                        <span className={expired ? "text-destructive font-medium" : expiringSoon ? "text-warning font-medium" : ""}>
                          {formatDate(batch.expiration_date)}
                          {expired && " (przeterminowana)"}
                          {expiringSoon && " (kończy się)"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {batch.current_quantity.toFixed(2)} {batch.product?.unit}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePrintLabel(batch)}>
                                <Printer className="mr-2 h-4 w-4" />
                                Drukuj etykietę QR
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(batch.id, "Released")}
                                disabled={batch.status === "Released"}
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-success" />
                                Zwolnij
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(batch.id, "Quarantine")}
                                disabled={batch.status === "Quarantine"}
                              >
                                <Clock className="mr-2 h-4 w-4 text-warning" />
                                Kwarantanna
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(batch.id, "Blocked")}
                                disabled={batch.status === "Blocked"}
                                className="text-destructive focus:text-destructive"
                              >
                                <AlertCircle className="mr-2 h-4 w-4" />
                                Zablokuj
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Poprzednia
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-10"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Następna
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Label Print Dialog */}
        <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
          <DialogContent className="max-w-fit">
            <DialogHeader>
              <DialogTitle>Podgląd etykiety partii</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4">
              {selectedBatch && (
                <BatchLabel
                  ref={labelRef}
                  companyName={getCompanyName()}
                  internalBatchNumber={selectedBatch.internal_batch_number}
                  productName={selectedBatch.product?.name || "Nieznany produkt"}
                  productSku={selectedBatch.product?.sku}
                  quantity={selectedBatch.current_quantity}
                  unit={selectedBatch.product?.unit || "kg"}
                  productionDate={selectedBatch.production_date}
                  expirationDate={selectedBatch.expiration_date}
                  supplierBatchNumber={selectedBatch.supplier_batch_number}
                  supplierName={selectedBatch.supplier?.name}
                />
              )}
              <Button onClick={handlePrint} className="w-full">
                <Printer className="mr-2 h-4 w-4" />
                Drukuj
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }