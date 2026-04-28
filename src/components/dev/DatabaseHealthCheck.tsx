import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  Database,
  KeyRound,
  Sparkles,
  ShieldCheck,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Category = "trigger" | "duplicates" | "fk" | "generated" | "check";
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface Check {
  category: Category;
  severity?: Severity;
  name: string;
  expected: string;
  ok: boolean;
  detail: string;
}

interface IntegrityResult {
  ok: boolean;
  summary: { passed: number; failed: number; total: number };
  checks: Check[];
  checked_at: string;
}

const CATEGORY_ORDER: Category[] = ["trigger", "duplicates", "fk", "generated", "check"];

const CATEGORY_META: Record<
  Category,
  { label: string; icon: typeof Database; description: string }
> = {
  trigger: {
    label: "Triggery",
    icon: Sparkles,
    description: "Triggery wymagane dla integralności biznesowej (CCP, lineage, agregaty).",
  },
  duplicates: {
    label: "Duplikaty triggerów",
    icon: Copy,
    description: "Wykrywa zduplikowane triggery wywołujące tę samą funkcję na tej samej tabeli.",
  },
  fk: {
    label: "Klucze obce",
    icon: KeyRound,
    description: "Relacje referencyjne między tabelami (FK).",
  },
  generated: {
    label: "Kolumny GENERATED",
    icon: Database,
    description: "Kolumny wyliczane automatycznie przez bazę.",
  },
  check: {
    label: "Ograniczenia CHECK",
    icon: ShieldCheck,
    description: "Walidacje na poziomie bazy (np. dozwolone wartości enum).",
  },
};

// Kolory kropki dla severity (gdy ok=false). Gdy ok=true → zielona.
const SEVERITY_DOT: Record<Severity, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-gray-400",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "krytyczny",
  HIGH: "wysoki",
  MEDIUM: "średni",
  LOW: "niski",
};

export function DatabaseHealthCheck() {
  const [hasNotified, setHasNotified] = useState(false);

  const query = useQuery<IntegrityResult>({
    queryKey: ["database-integrity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_database_integrity");
      if (error) throw error;
      return data as unknown as IntegrityResult;
    },
    staleTime: 60_000,
  });

  const grouped = useMemo(() => {
    const empty: Record<Category, Check[]> = {
      trigger: [],
      duplicates: [],
      fk: [],
      generated: [],
      check: [],
    };
    if (!query.data) return empty;
    for (const c of query.data.checks) {
      if (empty[c.category]) empty[c.category].push(c);
    }
    return empty;
  }, [query.data]);

  // Liczba CRITICAL fails (do bannera)
  const criticalFails = useMemo(() => {
    if (!query.data) return 0;
    return query.data.checks.filter(
      (c) => !c.ok && (c.severity ?? "MEDIUM") === "CRITICAL",
    ).length;
  }, [query.data]);

  // Auto-toast przy pierwszym wykryciu defektów
  useEffect(() => {
    if (!query.data || hasNotified) return;
    const failed = query.data.summary.failed;
    if (failed > 0) {
      toast.error(
        `Schemat bazy: ${failed} ${failed === 1 ? "problem" : "problemów"}` +
          (criticalFails > 0 ? ` (${criticalFails} krytyczne)` : ""),
        {
          description: "Sprawdź sekcję 'Database health check' w DevTools.",
        },
      );
      setHasNotified(true);
    }
  }, [query.data, hasNotified, criticalFails]);

  const summary = query.data?.summary;
  const totalOk = summary?.failed === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database health check
              {summary && (
                <Badge variant={totalOk ? "default" : "destructive"}>
                  {summary.passed}/{summary.total}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Auto-weryfikacja schematu: triggery, duplikaty, klucze obce, kolumny GENERATED i ograniczenia CHECK.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="shrink-0"
          >
            {query.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sprawdź ponownie
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sprawdzanie schematu bazy...
          </div>
        )}

        {query.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <strong className="text-destructive">Błąd:</strong>{" "}
            {(query.error as Error).message}
          </div>
        )}

        {/* CRITICAL banner */}
        {criticalFails > 0 && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-red-700 dark:text-red-300">
                Wykryto {criticalFails}{" "}
                {criticalFails === 1 ? "krytyczny problem" : "krytyczne problemy"} schematu bazy
              </div>
              <div className="text-red-700/80 dark:text-red-300/80 text-xs mt-0.5">
                Krytyczne defekty (CCP, FK, duplikaty) zagrażają integralności produkcji i traceability. Napraw przed dalszą pracą.
              </div>
            </div>
          </div>
        )}

        {query.data &&
          CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = grouped[cat];
            if (items.length === 0) return null;
            const okCount = items.filter((i) => i.ok).length;
            const allOk = okCount === items.length;
            const Icon = meta.icon;

            return (
              <Collapsible key={cat} defaultOpen={!allOk}>
                <div className="rounded-md border">
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 transition-colors",
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{meta.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {meta.description}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          allOk
                            ? "border-green-500/40 text-green-700 dark:text-green-400"
                            : "border-red-500/40 text-red-700 dark:text-red-400",
                        )}
                      >
                        {okCount}/{items.length}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t divide-y">
                      {items.map((c, idx) => {
                        const sev = (c.severity ?? "MEDIUM") as Severity;
                        return (
                          <Collapsible key={`${cat}-${idx}-${c.name}`}>
                            <div
                              className={cn(
                                "flex items-center gap-3 px-3 py-2",
                                !c.ok && "bg-red-500/5",
                              )}
                            >
                              {/* Kropka severity (lub zielony check gdy ok) */}
                              {c.ok ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              ) : (
                                <span
                                  className={cn(
                                    "h-3 w-3 rounded-full shrink-0 ring-2 ring-background",
                                    SEVERITY_DOT[sev],
                                  )}
                                  aria-label={`severity: ${SEVERITY_LABEL[sev]}`}
                                  title={`Severity: ${SEVERITY_LABEL[sev]}`}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-mono truncate flex items-center gap-2">
                                  {c.name}
                                  {!c.ok && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] uppercase tracking-wide"
                                    >
                                      {SEVERITY_LABEL[sev]}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  oczekiwane: {c.expected}
                                </div>
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent>
                              <div className="ml-10 mb-2 mr-3 px-3 py-2 text-xs text-muted-foreground bg-muted/30 rounded-md font-mono whitespace-pre-wrap">
                                {c.detail}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

        {query.data && (
          <div className="text-xs text-muted-foreground text-right">
            Ostatnio sprawdzono:{" "}
            {new Date(query.data.checked_at).toLocaleString("pl-PL")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DatabaseHealthCheck;
