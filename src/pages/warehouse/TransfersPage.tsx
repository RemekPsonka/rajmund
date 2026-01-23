import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Search, 
  ArrowRightLeft,
  MoreHorizontal,
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useWarehouseMovements, useApproveMovement, type DocumentStatus } from "@/hooks/useWarehouseMovements";

const statusConfig: Record<DocumentStatus, { label: string; variant: "default" | "secondary" | "outline"; icon: typeof CheckCircle }> = {
  Draft: { label: "Szkic", variant: "secondary", icon: Clock },
  Approved: { label: "Zatwierdzony", variant: "default", icon: CheckCircle },
  Cancelled: { label: "Anulowany", variant: "outline", icon: Clock },
};

export default function TransfersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: movements, isLoading } = useWarehouseMovements("MM");
  const approveMovement = useApproveMovement();

  const filteredMovements = movements?.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      m.document_number.toLowerCase().includes(query) ||
      m.facility?.name?.toLowerCase().includes(query) ||
      m.notes?.toLowerCase().includes(query)
    );
  });

  const handleApprove = (id: string) => {
    approveMovement.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Przesunięcia Magazynowe (MM)</h1>
          <p className="text-muted-foreground">
            Dokumenty przesunięć między lokalizacjami
          </p>
        </div>
        <Button onClick={() => navigate("/warehouse/transfers/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nowe przesunięcie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Szukaj po numerze dokumentu, zakładzie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !filteredMovements?.length ? (
            <div className="text-center py-12">
              <ArrowRightLeft className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Brak przesunięć</h3>
              <p className="text-muted-foreground">
                Nie znaleziono dokumentów MM
              </p>
              <Button 
                className="mt-4" 
                onClick={() => navigate("/warehouse/transfers/new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Utwórz pierwsze przesunięcie
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr dokumentu</TableHead>
                  <TableHead>Zakład</TableHead>
                  <TableHead>Uwagi</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => {
                  const status = statusConfig[movement.status];
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="font-mono font-medium">
                        {movement.document_number}
                      </TableCell>
                      <TableCell>{movement.facility?.name || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {movement.notes || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(movement.created_at), "dd.MM.yyyy HH:mm", { locale: pl })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {movement.status === "Draft" && (
                              <DropdownMenuItem onClick={() => handleApprove(movement.id)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Zatwierdź
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
