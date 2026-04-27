import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type CheckResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; count: number; sample?: string; detail?: string }
  | { status: "fail"; count: number; detail?: string }
  | { status: "error"; detail: string };

interface CheckDef {
  id: number;
  name: string;
  hint: string;
  run: () => Promise<{ ok: boolean; count: number; sample?: string; detail?: string }>;
}

// Liczy rekordy bez ich pobierania (head + count: 'exact').
async function countWhere(
  table: string,
  build: (q: ReturnType<typeof supabase.from>["select"] extends infer S ? any : never) => any,
): Promise<{ ok: boolean; count: number; detail?: string }> {
  // @ts-expect-error — dynamic table name; nazwy są stałe i zgodne z typami.
  const base = supabase.from(table).select("id", { count: "exact", head: true });
  const q = build(base);
  const { count, error } = await q;
  if (error) return { ok: false, count: 0, detail: error.message };
  const c = count ?? 0;
  return { ok: c > 0, count: c };
}

const CHECKS: CheckDef[] = [
  {
    id: 1,
    name: "PZ z CCP1 działa",
    hint: "t_warehouse_movements: type='PZ' z received_temp_c",
    run: () =>
      countWhere("t_warehouse_movements", (q) =>
        q.eq("type", "PZ").not("received_temp_c", "is", null),
      ),
  },
  {
    id: 2,
    name: "Rozbiór emituje partie",
    hint: "t_batches: source_event_type='DISASSEMBLY'",
    run: () =>
      countWhere("t_batches", (q) => q.eq("source_event_type", "DISASSEMBLY")),
  },
  {
    id: 3,
    name: "Tumbler emituje LOT",
    hint: "t_batches: source_event_type='TUMBLING'",
    run: () =>
      countWhere("t_batches", (q) => q.eq("source_event_type", "TUMBLING")),
  },
  {
    id: 4,
    name: "Kebab emituje LOT",
    hint: "t_batches: source_event_type='ASSEMBLY'",
    run: () =>
      countWhere("t_batches", (q) => q.eq("source_event_type", "ASSEMBLY")),
  },
  {
    id: 5,
    name: "Mrożenie z krzywą + CCP3",
    hint: "t_freezing_temp_log + batch FREEZING + ccp_passed",
    run: async () => {
      const logs = await countWhere("t_freezing_temp_log", (q) => q);
      const batches = await countWhere("t_batches", (q) =>
        q.eq("source_event_type", "FREEZING"),
      );
      const ccp = await countWhere("t_production_logs", (q) =>
        q.eq("process_stage", "ShockFreezing").eq("ccp_passed", true),
      );
      const ok = logs.ok && batches.ok && ccp.ok;
      return {
        ok,
        count: ccp.count,
        detail: `pomiarów: ${logs.count} • partii FREEZING: ${batches.count} • logów CCP passed: ${ccp.count}`,
      };
    },
  },
  {
    id: 6,
    name: "Paleta z SSCC mod10 (18 cyfr)",
    hint: "t_handling_units: sscc_number length=18",
    run: async () => {
      const { data, error, count } = await supabase
        .from("t_handling_units")
        .select("sscc_number", { count: "exact" })
        .not("sscc_number", "is", null)
        .limit(50);
      if (error) return { ok: false, count: 0, detail: error.message };
      const valid = (data ?? []).filter((r) => (r.sscc_number ?? "").length === 18);
      return {
        ok: valid.length > 0,
        count: valid.length,
        sample: valid[0]?.sscc_number ?? undefined,
        detail: `palet z SSCC: ${count ?? 0} • z poprawną długością 18: ${valid.length}`,
      };
    },
  },
  {
    id: 7,
    name: "CCP3 trigger blokuje paletę bez mrożenia",
    hint: "pg_trigger: trg_enforce_ccp3",
    run: async () => {
      const { data, error } = await supabase.rpc("check_trigger_exists", {
        trigger_name: "trg_enforce_ccp3",
      });
      if (error) return { ok: false, count: 0, detail: error.message };
      return { ok: !!data, count: data ? 1 : 0, detail: data ? "trigger zainstalowany" : "brak triggera" };
    },
  },
  {
    id: 8,
    name: "Wysyłka z numerem dokumentu",
    hint: "t_shipments: shipment_number wypełniony",
    run: () =>
      countWhere("t_shipments", (q) => q.not("shipment_number", "is", null)),
  },
  {
    id: 9,
    name: "Genealogia drzewa działa",
    hint: "t_lot_lineage: jakikolwiek wpis",
    run: () => countWhere("t_lot_lineage", (q) => q),
  },
];

export function DemoReadinessChecklist() {
  const [results, setResults] = useState<Record<number, CheckResult>>({});
  const [running, setRunning] = useState(false);

  const runOne = useCallback(async (def: CheckDef) => {
    setResults((p) => ({ ...p, [def.id]: { status: "loading" } }));
    try {
      const r = await def.run();
      setResults((p) => ({
        ...p,
        [def.id]: r.ok
          ? { status: "ok", count: r.count, sample: r.sample, detail: r.detail }
          : { status: "fail", count: r.count, detail: r.detail },
      }));
    } catch (e) {
      setResults((p) => ({
        ...p,
        [def.id]: { status: "error", detail: e instanceof Error ? e.message : String(e) },
      }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    await Promise.all(CHECKS.map(runOne));
    setRunning(false);
  }, [runOne]);

  useEffect(() => {
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const okCount = CHECKS.filter((c) => results[c.id]?.status === "ok").length;
  const totalCount = CHECKS.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Demo readiness checklist
              <Badge variant={okCount === totalCount ? "default" : "secondary"}>
                {okCount}/{totalCount}
              </Badge>
            </CardTitle>
            <CardDescription>
              Auto-weryfikacja 9 kluczowych warunków gotowości środowiska demo.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runAll}
            disabled={running}
            className="shrink-0"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sprawdź wszystkie
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {CHECKS.map((def) => {
          const r = results[def.id] ?? { status: "idle" as const };
          const isOk = r.status === "ok";
          const isFail = r.status === "fail" || r.status === "error";
          const isLoading = r.status === "loading";
          return (
            <Collapsible key={def.id}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                  isOk && "border-green-500/40 bg-green-500/5",
                  isFail && "border-red-500/40 bg-red-500/5",
                )}
              >
                <span className="w-6 text-xs text-muted-foreground tabular-nums">#{def.id}</span>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                ) : isOk ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : isFail ? (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <span className="h-3 w-3 rounded-full bg-muted-foreground/40 shrink-0 ml-1" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{def.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{def.hint}</div>
                </div>
                {r.status === "ok" && (
                  <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">
                    {r.count} rek.
                  </Badge>
                )}
                {r.status === "fail" && (
                  <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-400">
                    brak
                  </Badge>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="ml-9 mt-1 mb-2 px-3 py-2 text-xs text-muted-foreground bg-muted/30 rounded-md font-mono whitespace-pre-wrap">
                  {r.status === "idle" && "Nie sprawdzono."}
                  {r.status === "loading" && "Sprawdzanie…"}
                  {r.status === "ok" && (r.detail ?? `Spełniony — ${r.count} rekord(ów).`)}
                  {r.status === "fail" && (r.detail ?? "Warunek niespełniony — brak danych.")}
                  {r.status === "error" && `Błąd: ${r.detail}`}
                  {r.status === "ok" && r.sample && `\nPróbka: ${r.sample}`}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default DemoReadinessChecklist;
