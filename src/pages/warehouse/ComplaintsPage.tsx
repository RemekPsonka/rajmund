import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Eye, Check, X, ShieldCheck, FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useSupplierComplaints,
  useUpdateComplaintStatus,
  type ComplaintSeverity,
  type ComplaintStatus,
  type SupplierComplaint,
} from "@/hooks/useSupplierComplaints";

const SEVERITY_LABEL: Record<ComplaintSeverity, string> = {
  LOW: "Niska",
  MEDIUM: "Średnia",
  HIGH: "Wysoka",
  CRITICAL: "Krytyczna",
};

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  NEW: "Nowa",
  ACKNOWLEDGED: "Przyjęta",
  RESOLVED: "Rozwiązana",
  REJECTED: "Odrzucona",
};

const COMPLAINT_TYPE_LABEL: Record<string, string> = {
  CCP1_TEMPERATURE: "CCP1 — temperatura",
  QUALITY: "Jakość",
  QUANTITY: "Ilość",
  DOCUMENTATION: "Dokumenty",
  OTHER: "Inne",
};

function severityClass(s: ComplaintSeverity): string {
  switch (s) {
    case "CRITICAL":
      return "bg-destructive text-destructive-foreground";
    case "HIGH":
      return "bg-destructive/80 text-destructive-foreground";
    case "MEDIUM":
      return "bg-warning text-warning-foreground";
    case "LOW":
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusClass(s: ComplaintStatus): string {
  switch (s) {
    case "NEW":
      return "border-destructive text-destructive";
    case "ACKNOWLEDGED":
      return "border-warning text-warning";
    case "RESOLVED":
      return "border-success text-success";
    case "REJECTED":
      return "border-muted-foreground text-muted-foreground";
  }
}

export default function ComplaintsPage() {
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "ALL">("ALL");
  const [severityFilter, setSeverityFilter] = useState<ComplaintSeverity | "ALL">("ALL");
  const [selected, setSelected] = useState<SupplierComplaint | null>(null);

  const { data: complaints, isLoading } = useSupplierComplaints({
    status: statusFilter,
    severity: severityFilter,
  });
  const updateStatus = useUpdateComplaintStatus();

  const handleAction = async (status: ComplaintStatus) => {
    if (!selected) return;
    try {
      await updateStatus.mutateAsync({ id: selected.id, status });
      setSelected(null);
    } catch {
      // toast w hooku
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileWarning className="h-6 w-6 text-destructive" />
          Reklamacje dostawców
        </h1>
        <p className="text-muted-foreground">
          Auto-reklamacje CCP1 oraz reklamacje rejestrowane ręcznie
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as ComplaintStatus | "ALL")}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Wszystkie</SelectItem>
                  <SelectItem value="NEW">Nowe</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Przyjęte</SelectItem>
                  <SelectItem value="RESOLVED">Rozwiązane</SelectItem>
                  <SelectItem value="REJECTED">Odrzucone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Waga problemu</label>
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v as ComplaintSeverity | "ALL")}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Wszystkie</SelectItem>
                  <SelectItem value="LOW">Niska</SelectItem>
                  <SelectItem value="MEDIUM">Średnia</SelectItem>
                  <SelectItem value="HIGH">Wysoka</SelectItem>
                  <SelectItem value="CRITICAL">Krytyczna</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista reklamacji ({complaints?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Ładowanie…</div>
          ) : !complaints || complaints.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ShieldCheck}
                title="Brak reklamacji"
                description="Wszystkie dostawy są w normie. Reklamacje pojawią się tutaj automatycznie po naruszeniu CCP1 lub gdy dodasz je ręcznie."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Dostawca</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Waga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PZ</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      {format(new Date(c.created_at), "dd.MM.yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.supplier?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {COMPLAINT_TYPE_LABEL[c.complaint_type] ?? c.complaint_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={severityClass(c.severity)}>
                        {SEVERITY_LABEL[c.severity]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass(c.status)}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {c.movement?.document_number ?? "—"}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(c)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Szczegóły
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Szczegóły reklamacji
            </DialogTitle>
            <DialogDescription>
              {selected?.supplier?.name} •{" "}
              {selected &&
                COMPLAINT_TYPE_LABEL[selected.complaint_type]}{" "}
              •{" "}
              {selected && format(new Date(selected.created_at), "dd.MM.yyyy HH:mm")}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={severityClass(selected.severity)}>
                  Waga: {SEVERITY_LABEL[selected.severity]}
                </Badge>
                <Badge variant="outline" className={statusClass(selected.status)}>
                  Status: {STATUS_LABEL[selected.status]}
                </Badge>
                {selected.movement?.document_number && (
                  <Badge variant="outline">
                    PZ: {selected.movement.document_number}
                  </Badge>
                )}
              </div>

              {selected.notes && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  {selected.notes}
                </div>
              )}

              {selected.payload && (
                <div>
                  <div className="text-sm font-medium mb-2">Dane pomiaru</div>
                  <div className="grid gap-2 text-sm">
                    {Object.entries(selected.payload).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between rounded border bg-background px-3 py-2"
                      >
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono font-medium">
                          {String(v ?? "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.resolved_at && (
                <div className="text-xs text-muted-foreground">
                  Rozstrzygnięto:{" "}
                  {format(new Date(selected.resolved_at), "dd.MM.yyyy HH:mm")}
                </div>
              )}

              {selected.status !== "RESOLVED" && selected.status !== "REJECTED" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {selected.status === "NEW" && (
                    <Button
                      variant="outline"
                      onClick={() => handleAction("ACKNOWLEDGED")}
                      disabled={updateStatus.isPending}
                      className="gap-1"
                    >
                      <Eye className="h-4 w-4" /> Przyjmij
                    </Button>
                  )}
                  <Button
                    onClick={() => handleAction("RESOLVED")}
                    disabled={updateStatus.isPending}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" /> Rozwiąż
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction("REJECTED")}
                    disabled={updateStatus.isPending}
                    className="gap-1"
                  >
                    <X className="h-4 w-4" /> Odrzuć
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
