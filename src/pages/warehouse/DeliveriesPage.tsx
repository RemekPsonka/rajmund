import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, Eye, Check, Clock } from "lucide-react";
import { useWarehouseMovements, useApproveMovement, type DocumentStatus } from "@/hooks/useWarehouseMovements";
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
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const statusConfig: Record<DocumentStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  Draft: { label: "Szkic", variant: "secondary" },
  Approved: { label: "Zatwierdzony", variant: "default" },
  Cancelled: { label: "Anulowany", variant: "destructive" },
};

export default function DeliveriesPage() {
  const { data: movements, isLoading } = useWarehouseMovements("PZ");
  const approveMovement = useApproveMovement();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMovements = movements?.filter(
    (mov) =>
      mov.document_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mov.external_doc_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mov.contractor?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy HH:mm", { locale: pl });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Przyjęcia (PZ)</h1>
          <p className="text-muted-foreground">Lista dokumentów przyjęcia zewnętrznego</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/warehouse/deliveries/new">
            <Plus className="h-4 w-4" />
            Nowa dostawa
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Szukaj po numerze dokumentu lub dostawcy..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
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
      ) : filteredMovements?.length === 0 ? (
        <Card className="shadow-industrial">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Brak dokumentów PZ</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Nie znaleziono pasujących dokumentów" : "Utwórz pierwszą dostawę"}
            </p>
            {!searchQuery && (
              <Button asChild className="mt-4 gap-2">
                <Link to="/warehouse/deliveries/new">
                  <Plus className="h-4 w-4" />
                  Nowa dostawa
                </Link>
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
                  <TableHead>Nr dokumentu</TableHead>
                  <TableHead>HDI dostawcy</TableHead>
                  <TableHead>Dostawca</TableHead>
                  <TableHead>Magazyn</TableHead>
                  <TableHead>Data przyjęcia</TableHead>
                  <TableHead>Temp.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements?.map((movement) => {
                  const status = statusConfig[movement.status];
                  return (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-medium">
                          {movement.document_number}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.external_doc_number || "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {movement.contractor?.name || "—"}
                      </TableCell>
                      <TableCell>{movement.facility?.name || "—"}</TableCell>
                      <TableCell>{formatDate(movement.created_at)}</TableCell>
                      <TableCell>
                        {movement.reception_temp !== null
                          ? `${movement.reception_temp}°C`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {movement.status === "Draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => approveMovement.mutate(movement.id)}
                              disabled={approveMovement.isPending}
                            >
                              <Check className="h-3 w-3" />
                              Zatwierdź
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}