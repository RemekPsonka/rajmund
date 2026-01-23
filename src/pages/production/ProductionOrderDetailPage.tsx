import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  ArrowLeft,
  Package,
  ClipboardList,
  Scale,
  CheckCircle2,
  Circle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Boxes,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  useProductionOrder, 
  useProductionInputs,
  useProductionLogs,
  useCloseProductionOrder 
} from "@/hooks/useProductionOrders";
import { useProductionTasks, useCompleteProductionTask } from "@/hooks/useProductionTasks";
import { ProductionInputsDrawer } from "@/components/production/ProductionInputsDrawer";

const orderTypeLabels: Record<string, string> = {
  Decomposition: "Rozbiór",
  Processing: "Przetwórstwo",
  Packing: "Pakowanie",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Open: "default",
  Closed: "secondary",
  Cancelled: "destructive",
};

export default function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inputsDrawerOpen, setInputsDrawerOpen] = useState(false);

  const { data: order, isLoading: loadingOrder } = useProductionOrder(id);
  const { data: inputs } = useProductionInputs(id);
  const { data: logs } = useProductionLogs(id);
  const { data: tasks } = useProductionTasks(id);
  const closeOrder = useCloseProductionOrder();
  const completeTask = useCompleteProductionTask();

  if (loadingOrder) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Nie znaleziono zlecenia</h2>
        <Button variant="link" onClick={() => navigate("/production/orders")}>
          Wróć do listy zleceń
        </Button>
      </div>
    );
  }

  // Calculate metrics
  const totalInputWeight = inputs?.reduce((sum, inp) => sum + inp.weight, 0) || 0;
  const totalOutputWeight = logs?.reduce((sum, log) => sum + (log.weight_net || 0), 0) || 0;
  const wasteWeight = totalInputWeight - totalOutputWeight;
  const yieldPercentage = totalInputWeight > 0 
    ? ((totalOutputWeight / totalInputWeight) * 100).toFixed(1) 
    : "0.0";
  const completedTasks = tasks?.filter((t) => t.is_completed).length || 0;
  const totalTasks = tasks?.length || 0;

  const handleToggleTask = async (taskId: string, isCompleted: boolean) => {
    await completeTask.mutateAsync({ taskId, isCompleted: !isCompleted });
  };

  const handleCloseOrder = async () => {
    await closeOrder.mutateAsync(order.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/production/orders")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {order.order_number}
            </h1>
            <p className="text-muted-foreground">
              {orderTypeLabels[order.type || "Decomposition"]} •{" "}
              {order.facility?.name} •{" "}
              {order.production_date
                ? format(new Date(order.production_date), "dd.MM.yyyy", { locale: pl })
                : "Brak daty"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusVariants[order.status || "Open"]}>
            {order.status === "Open" ? "Otwarte" : order.status === "Closed" ? "Zamknięte" : "Anulowane"}
          </Badge>
          {order.status === "Open" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Zamknij zlecenie</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Zamknąć zlecenie?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Po zamknięciu zlecenia zostaną automatycznie utworzone partie
                    wynikowe dla wszystkich zważonych produktów. Tej operacji nie
                    można cofnąć.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCloseOrder}>
                    Zamknij zlecenie
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wsad (RW)</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInputWeight.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">
              {inputs?.length || 0} pozycji
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wyjście (PW)</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOutputWeight.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">
              {logs?.length || 0} logów
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uzysk</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{yieldPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              wskaźnik wydajności
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ubytek</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wasteWeight.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">
              {totalInputWeight > 0
                ? ((wasteWeight / totalInputWeight) * 100).toFixed(1)
                : "0.0"}
              % odpadu
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Czynności</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedTasks}/{totalTasks}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalTasks > 0
                ? `${((completedTasks / totalTasks) * 100).toFixed(0)}% ukończone`
                : "brak czynności"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Wsad (RW)
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {inputs?.length || 0} pozycji • {totalInputWeight.toFixed(2)} kg
              </p>
            </div>
            {order.status === "Open" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputsDrawerOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Dodaj wsad
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!inputs?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Brak zarejestrowanego wsadu</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inputs.map((input) => (
                  <div
                    key={input.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {input.batch?.internal_batch_number || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {input.product?.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium">
                        {input.weight.toFixed(2)} kg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Czynności do wykonania
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {completedTasks}/{totalTasks} wykonane
            </p>
          </CardHeader>
          <CardContent>
            {!tasks?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Brak przypisanych czynności</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      task.is_completed ? "bg-muted/50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={task.is_completed}
                      onCheckedChange={() =>
                        handleToggleTask(task.id, task.is_completed)
                      }
                      disabled={order.status !== "Open"}
                    />
                    <div className="flex-1">
                      <div
                        className={`font-medium text-sm ${
                          task.is_completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.name}
                      </div>
                      {task.is_completed && task.completed_at && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(task.completed_at), "dd.MM.yyyy HH:mm", {
                            locale: pl,
                          })}
                          {task.employee &&
                            ` • ${task.employee.first_name} ${task.employee.last_name}`}
                        </div>
                      )}
                    </div>
                    {task.is_completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Production Logs Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Logi produkcyjne (PW)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {logs?.length || 0} pozycji • {totalOutputWeight.toFixed(2)} kg netto
            </p>
          </div>
          {order.status === "Open" && (
            <Button
              variant="outline"
              onClick={() => navigate(`/production/terminal?order=${order.id}`)}
            >
              <Scale className="h-4 w-4 mr-2" />
              Otwórz terminal wagowy
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!logs?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Scale className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Brak zarejestrowanych ważeń</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Czas</TableHead>
                  <TableHead>Pracownik</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Partia źródłowa</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 20).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {log.created_at
                        ? format(new Date(log.created_at), "HH:mm:ss", { locale: pl })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {log.weighing_employee
                        ? `${log.weighing_employee.first_name} ${log.weighing_employee.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell>{log.product?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.source_batch?.internal_batch_number || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {log.weight_gross.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {(log.weight_net || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {logs && logs.length > 20 && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Wyświetlono 20 z {logs.length} logów
            </div>
          )}
        </CardContent>
      </Card>

      {/* Output Batches Section */}
      {order.status === "Closed" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Partie wynikowe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Boxes className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Partie utworzone przy zamknięciu zlecenia</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notatki</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {order.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Inputs Drawer */}
      <ProductionInputsDrawer
        open={inputsDrawerOpen}
        onClose={() => setInputsDrawerOpen(false)}
        orderId={order.id}
      />
    </div>
  );
}
