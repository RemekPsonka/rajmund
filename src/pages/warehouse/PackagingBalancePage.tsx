import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Plus
} from "lucide-react";
import { PackagingTransactionDialog } from "@/components/packaging/PackagingTransactionDialog";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useContractors } from "@/hooks/useContractors";
import { usePackagingBalances, usePackagingTransactions } from "@/hooks/usePackaging";
import { ExportButton } from "@/components/ExportButton";

const PACKAGING_TYPES = ["E2", "H1", "Paleta EUR", "Kosz", "Karton"];

export default function PackagingBalancePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContractor, setSelectedContractor] = useState<{ id: string; name: string } | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

  const { data: contractors, isLoading: loadingContractors } = useContractors();
  const { data: balances, isLoading: loadingBalances } = usePackagingBalances();
  const { data: transactions } = usePackagingTransactions(selectedContractor?.id);

  // Filter contractors with any packaging balance
  const contractorsWithBalance = contractors?.filter(c => 
    c.is_customer || c.is_logistics || c.is_supplier
  );

  const filteredContractors = contractorsWithBalance?.filter((c) => {
    const query = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(query);
  });

  const getBalance = (contractorId: string, packagingType: string): number => {
    const key = `${contractorId}-${packagingType}`;
    return balances?.[key] || 0;
  };

  const getTotalBalance = (contractorId: string): number => {
    return PACKAGING_TYPES.reduce((sum, type) => sum + getBalance(contractorId, type), 0);
  };

  const handleShowHistory = (contractor: { id: string; name: string }) => {
    setSelectedContractor(contractor);
    setHistoryDialogOpen(true);
  };

  const isLoading = loadingContractors || loadingBalances;

  // Export data
  const exportData = filteredContractors?.map((c) => ({
    name: c.name,
    type: [c.is_supplier && "Dostawca", c.is_customer && "Odbiorca", c.is_logistics && "Logistyka"].filter(Boolean).join(", "),
    e2: String(getBalance(c.id, "E2")),
    h1: String(getBalance(c.id, "H1")),
    paleta_eur: String(getBalance(c.id, "Paleta EUR")),
    kosz: String(getBalance(c.id, "Kosz")),
    karton: String(getBalance(c.id, "Karton")),
    suma: String(getTotalBalance(c.id)),
  })) || [];

  const exportColumns: { key: keyof typeof exportData[0]; header: string }[] = [
    { key: "name", header: "Kontrahent" },
    { key: "type", header: "Typ" },
    { key: "e2", header: "E2" },
    { key: "h1", header: "H1" },
    { key: "paleta_eur", header: "Paleta EUR" },
    { key: "kosz", header: "Kosz" },
    { key: "karton", header: "Karton" },
    { key: "suma", header: "Suma" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saldo Opakowań Zwrotnych</h1>
          <p className="text-muted-foreground">
            Rozliczenia pojemników E2, palet i innych opakowań z kontrahentami
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={exportData}
            columns={exportColumns}
            filename={`saldo-opakowan-${format(new Date(), "yyyy-MM-dd")}`}
            disabled={isLoading}
          />
          <Button onClick={() => setTransactionDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nowa transakcja
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pojemniki E2</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.entries(balances || {})
                .filter(([key]) => key.endsWith("-E2"))
                .reduce((sum, [, val]) => sum + val, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Łączne saldo u kontrahentów
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Palety EUR</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.entries(balances || {})
                .filter(([key]) => key.endsWith("-Paleta EUR"))
                .reduce((sum, [, val]) => sum + val, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Łączne saldo u kontrahentów
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kontrahenci z saldem</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredContractors?.filter(c => getTotalBalance(c.id) !== 0).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Aktywne rozliczenia
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Szukaj kontrahenta..."
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
          ) : !filteredContractors?.length ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Brak kontrahentów</h3>
              <p className="text-muted-foreground">
                Nie znaleziono kontrahentów do rozliczenia opakowań
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kontrahent</TableHead>
                  {PACKAGING_TYPES.map(type => (
                    <TableHead key={type} className="text-center">{type}</TableHead>
                  ))}
                  <TableHead className="text-center">Suma</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContractors.map((contractor) => {
                  const total = getTotalBalance(contractor.id);
                  
                  return (
                    <TableRow key={contractor.id}>
                      <TableCell className="font-medium">
                        {contractor.name}
                        <div className="flex gap-1 mt-1">
                          {contractor.is_supplier && (
                            <Badge variant="outline" className="text-xs">Dostawca</Badge>
                          )}
                          {contractor.is_customer && (
                            <Badge variant="outline" className="text-xs">Odbiorca</Badge>
                          )}
                          {contractor.is_logistics && (
                            <Badge variant="outline" className="text-xs">Logistyka</Badge>
                          )}
                        </div>
                      </TableCell>
                      {PACKAGING_TYPES.map(type => {
                        const balance = getBalance(contractor.id, type);
                        return (
                          <TableCell key={type} className="text-center">
                            {balance === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : balance > 0 ? (
                              <Badge variant="default" className="bg-green-600">
                                <TrendingUp className="mr-1 h-3 w-3" />
                                +{balance}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <TrendingDown className="mr-1 h-3 w-3" />
                                {balance}
                              </Badge>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {total === 0 ? (
                          <Badge variant="secondary">
                            <Minus className="mr-1 h-3 w-3" />
                            0
                          </Badge>
                        ) : total > 0 ? (
                          <Badge className="bg-green-600 text-white">+{total}</Badge>
                        ) : (
                          <Badge variant="destructive">{total}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowHistory({ id: contractor.id, name: contractor.name })}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Historia opakowań: {selectedContractor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            {!transactions?.length ? (
              <p className="text-center py-8 text-muted-foreground">
                Brak transakcji dla tego kontrahenta
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Opakowanie</TableHead>
                    <TableHead className="text-right">Ilość</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {format(new Date(tx.created_at), "dd.MM.yyyy", { locale: pl })}
                      </TableCell>
                      <TableCell>
                        {tx.type === "Issued" ? (
                          <Badge variant="outline">Wydano</Badge>
                        ) : (
                          <Badge variant="secondary">Przyjęto</Badge>
                        )}
                      </TableCell>
                      <TableCell>{tx.packaging_type}</TableCell>
                      <TableCell className="text-right font-mono">
                        {tx.type === "Issued" ? "+" : "-"}{tx.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <PackagingTransactionDialog
        open={transactionDialogOpen}
        onClose={() => setTransactionDialogOpen(false)}
      />
    </div>
  );
}
