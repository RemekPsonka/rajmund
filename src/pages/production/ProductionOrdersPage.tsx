import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  FileText,
  Play,
  CheckCircle,
  XCircle,
  Scale,
  MoreHorizontal,
  Package,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

import { Button } from "@/components/ui/button";
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  useProductionOrders,
  useUpdateProductionOrderStatus,
  useCloseProductionOrder,
  type ProductionOrderStatus,
  type ProductionOrderType,
} from "@/hooks/useProductionOrders";
import { ProductionOrderDialog } from "@/components/production/ProductionOrderDialog";
import { ProductionInputsDrawer } from "@/components/production/ProductionInputsDrawer";
import { ExportButton } from "@/components/ExportButton";

const statusConfig: Record<ProductionOrderStatus, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Play }> = {
  Open: { label: "Otwarte", variant: "default", icon: Play },
  Closed: { label: "Zamknięte", variant: "secondary", icon: CheckCircle },
  Cancelled: { label: "Anulowane", variant: "destructive", icon: XCircle },
};

const typeLabels: Record<ProductionOrderType, string> = {
  Decomposition: "Rozbiór",
  Processing: "Przetwórstwo",
  Packing: "Pakowanie",
  Assembly: "Składanie Kebaba",
  Freezing: "Mrożenie",
};

export default function ProductionOrdersPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<"all" | ProductionOrderStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputsDrawerOpen, setInputsDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders, isLoading } = useProductionOrders(
    statusFilter === "all" ? undefined : statusFilter
  );
  const updateStatus = useUpdateProductionOrderStatus();
  const closeOrder = useCloseProductionOrder();

  const filteredOrders = orders?.filter(
    (order) =>
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.facility?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenInputs = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderId(orderId);
    setInputsDrawerOpen(true);
  };

  const handleRowClick = (orderId: string) => {
    navigate(`/production/orders/${orderId}`);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: pl });
  };

  // Export data preparation
  const exportData = filteredOrders?.map((order) => ({
    order_number: order.order_number,
    type: typeLabels[order.type],
    facility_name: order.facility?.name || "",
    production_date: formatDate(order.production_date),
    status: statusConfig[order.status]?.label || order.status,
    notes: order.notes || "",
  })) || [];

  const exportColumns: { key: keyof typeof exportData[0]; header: string }[] = [
    { key: "order_number", header: "Nr zlecenia" },
    { key: "type", header: "Typ" },
    { key: "facility_name", header: "Zakład" },
    { key: "production_date", header: "Data produkcji" },
    { key: "status", header: "Status" },
    { key: "notes", header: "Notatki" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Zlecenia Produkcyjne</h1>
          <p className="text-muted-foreground">Zarządzanie zleceniami rozbioru i przetwórstwa</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={exportData}
            columns={exportColumns}
            filename={`zlecenia-${format(new Date(), "yyyy-MM-dd")}`}
            disabled={isLoading}
          />
          <Button variant="outline" asChild className="gap-2">
            <Link to="/production/terminal">
              <Scale className="h-4 w-4" />
              Terminal Wagowy
            </Link>
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nowe zlecenie
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Szukaj po numerze lub zakładzie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <TabsList>
            <TabsTrigger value="all">Wszystkie</TabsTrigger>
            <TabsTrigger value="Open">Otwarte</TabsTrigger>
            <TabsTrigger value="Closed">Zamknięte</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
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
      ) : filteredOrders?.length === 0 ? (
        <Card className="shadow-industrial">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Brak zleceń</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Nie znaleziono pasujących zleceń" : "Utwórz pierwsze zlecenie produkcyjne"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Nowe zlecenie
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-industrial">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr zlecenia</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Zakład</TableHead>
                  <TableHead>Data produkcji</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.map((order) => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;

                  return (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(order.id)}
                    >
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-medium">
                          {order.order_number}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[order.type]}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.facility?.name || "—"}
                      </TableCell>
                      <TableCell>{formatDate(order.production_date)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(order.id);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              Zobacz szczegóły
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleOpenInputs(order.id, e)}>
                              <Package className="mr-2 h-4 w-4" />
                              Zarządzaj wsadem (RW)
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()}>
                              <Link to={`/production/terminal?order=${order.id}`}>
                                <Scale className="mr-2 h-4 w-4" />
                                Otwórz terminal
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {order.status === "Open" && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeOrder.mutate(order.id);
                                }}
                                disabled={closeOrder.isPending}
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                {closeOrder.isPending ? "Zamykanie..." : "Zamknij zlecenie (+ partie)"}
                              </DropdownMenuItem>
                            )}
                            {order.status === "Closed" && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus.mutate({ id: order.id, status: "Open" });
                                }}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Otwórz ponownie
                              </DropdownMenuItem>
                            )}
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

      {/* Dialogs */}
      <ProductionOrderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <ProductionInputsDrawer
        open={inputsDrawerOpen}
        onClose={() => {
          setInputsDrawerOpen(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId}
      />
    </div>
  );
}
