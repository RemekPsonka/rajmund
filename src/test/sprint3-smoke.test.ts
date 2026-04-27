import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sprint 3 + 3.6 smoke tests — domknięcie sprintu (8/8).
 * Strategia: mockujemy supabase clienta + parsujemy migracje/source jako
 * kontrakt. Nie odpalamy realnego Postgresa.
 */

type AnyFn = (...args: unknown[]) => unknown;

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, AnyFn> & { __result: typeof result } = {
    __result: result,
  } as never;
  const chain = ["select", "eq", "gt", "or", "ilike", "order", "in", "neq"] as const;
  for (const name of chain) {
    builder[name] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  (builder as unknown as PromiseLike<unknown>).then = ((
    resolve: (v: unknown) => void,
  ) => resolve(result)) as never;
  return builder;
}

const mockState: {
  fromHandler: (table: string) => { data: unknown; error: unknown };
  rpcHandler: (name: string, args: unknown) => { data: unknown; error: unknown };
  rpcCalls: Array<{ name: string; args: unknown }>;
} = {
  fromHandler: () => ({ data: [], error: null }),
  rpcHandler: () => ({ data: null, error: null }),
  rpcCalls: [],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(mockState.fromHandler(table)),
    rpc: (name: string, args: unknown) => {
      mockState.rpcCalls.push({ name, args });
      return Promise.resolve(mockState.rpcHandler(name, args));
    },
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: function () {
        return this;
      },
    }),
    removeChannel: () => {},
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

beforeEach(() => {
  mockState.fromHandler = () => ({ data: [], error: null });
  mockState.rpcHandler = () => ({ data: null, error: null });
  mockState.rpcCalls = [];
  vi.clearAllMocks();
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

const ROOT = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

function readAllMigrations(): string {
  const dir = resolve(ROOT, "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(resolve(dir, f), "utf8"))
    .join("\n");
}

// --- TEST 1 -----------------------------------------------------------------
describe("Sprint 3 — t_freezing_temp_log istnieje z wymaganymi kolumnami", () => {
  it("migracje zawierają CREATE TABLE t_freezing_temp_log z core_temp_c, recorded_at, production_log_id, source", () => {
    const sql = readAllMigrations();
    expect(sql).toMatch(/create\s+table[^;]*t_freezing_temp_log/i);
    expect(sql).toMatch(/production_log_id/);
    expect(sql).toMatch(/core_temp_c/);
    expect(sql).toMatch(/recorded_at/);
    expect(sql).toMatch(/\bsource\b/);
  });
});

// --- TEST 2 -----------------------------------------------------------------
describe("Sprint 3 — Trigger CCP1 (computed) tworzy reklamację dla temp >+4°C", () => {
  it("migracje definiują trigger/funkcję na t_warehouse_movements liczącą ccp1_passed i wstawiającą t_supplier_complaints", () => {
    const sql = readAllMigrations();
    // ccp1_passed jest wyliczana w triggerze, nie ustawiana ręcznie
    expect(sql).toMatch(/ccp1_passed/);
    // Trigger AFTER INSERT na ruchu PZ tworzy reklamację
    expect(sql).toMatch(/t_supplier_complaints/);
    expect(sql).toMatch(/insert\s+into[^;]*t_supplier_complaints/i);
    // Próg temperatury +4°C dla CCP1
    expect(sql).toMatch(/[>]\s*4(\.0+)?\b|temp[^;]*4\b/i);
  });
});

// --- TEST 3 -----------------------------------------------------------------
describe("Sprint 3 — Generator SSCC zwraca 18 cyfr z poprawną cyfrą kontrolną", () => {
  it("generateSSCC zwraca 18 znaków numerycznych i mod10 ostatniej pozycji się zgadza", async () => {
    const { generateSSCC, calculateSSCCCheckDigit } = await import(
      "@/hooks/useHandlingUnits"
    );
    for (let i = 0; i < 25; i++) {
      const sscc = generateSSCC();
      expect(sscc).toMatch(/^\d{18}$/);
      expect(calculateSSCCCheckDigit(sscc.slice(0, 17))).toBe(sscc.slice(17));
    }
  });
});

// --- TEST 4 -----------------------------------------------------------------
describe("Sprint 3 — Decomposition close RPC tworzy N partii dla N produktów", () => {
  it("RPC close_production_order_with_lineage grupuje logi po product_id (Decomposition multi-output)", () => {
    const sql = readAllMigrations();
    // Migracja S3 (20260427200601) refaktoruje DISASSEMBLY na pętlę po product_id
    expect(sql).toMatch(/close_production_order_with_lineage/);
    // Pętla po dystynktnych product_id w logach
    expect(sql).toMatch(/group\s+by[^;]*product_id|distinct[^;]*product_id|for\s+\w+\s+in[^;]*product_id/i);
    // DISASSEMBLY/Decomposition obsługiwane
    expect(sql).toMatch(/DISASSEMBLY|Decomposition/);
  });
});

// --- TEST 5 -----------------------------------------------------------------
describe("Sprint 3 — KebabAssembly handleSaveAll wywołuje closeOrder", () => {
  it("KebabAssemblyTerminalPage importuje useCloseProductionOrder i woła closeOrder w handleSaveAll", () => {
    const src = read("src/pages/production/KebabAssemblyTerminalPage.tsx");
    expect(src).toMatch(/useCloseProductionOrder/);
    expect(src).toMatch(/const\s+closeOrder\s*=\s*useCloseProductionOrder\s*\(\s*\)/);
    // closeOrder.mutateAsync musi być wywołane (nie tylko zadeklarowane)
    expect(src).toMatch(/closeOrder\.mutateAsync\s*\(/);
    // handleSaveAll istnieje
    expect(src).toMatch(/const\s+handleSaveAll\s*=\s*async/);
  });
});

// --- TEST 6 -----------------------------------------------------------------
describe("Sprint 3 — Trigger CCP3 blokuje paletę z niemrożonymi partiami", () => {
  it("enforce_ccp3 jest rekurencyjny po t_lot_lineage i wymaga FREEZING + ccp_passed=true", () => {
    const sql = readAllMigrations();
    expect(sql).toMatch(/enforce_ccp3/);
    // Rekurencyjny CTE po linii rodowej
    expect(sql).toMatch(/with\s+recursive[\s\S]*t_lot_lineage/i);
    // FREEZING event_type w łańcuchu
    expect(sql).toMatch(/FREEZING/);
    // ccp_passed = true
    expect(sql).toMatch(/ccp_passed\s*=\s*true/i);
    // Komunikat błędu CCP3_FAILED
    expect(sql).toMatch(/CCP3_FAILED/);
  });
});

// --- TEST 7 -----------------------------------------------------------------
describe("Sprint 3 — Trigger receiving_lineage tworzy entry RECEIVING przy nowej partii PZ", () => {
  it("trigger AFTER INSERT na t_batches wstawia entry z event_type='RECEIVING' i parent_lot_id=NULL", () => {
    const sql = readAllMigrations();
    // Funkcja/trigger receiving_lineage istnieje
    expect(sql).toMatch(/receiving_lineage|RECEIVING/);
    // Trigger AFTER INSERT na t_batches
    expect(sql).toMatch(/after\s+insert\s+on[^;]*t_batches/i);
    // Wstawia do t_lot_lineage
    expect(sql).toMatch(/insert\s+into[^;]*t_lot_lineage/i);
    // event_type RECEIVING
    expect(sql).toMatch(/'RECEIVING'/);
    // parent_lot_id może być NULL (drop NOT NULL)
    expect(sql).toMatch(/parent_lot_id[^;]*drop\s+not\s+null|alter[^;]*parent_lot_id/i);
  });
});

// --- TEST 8 -----------------------------------------------------------------
describe("Sprint 3 — useFreezingTempStream zwraca readings posortowane chronologicznie", () => {
  it("query orderuje po recorded_at ASC i zwraca readings", async () => {
    const readings = [
      { id: "r1", recorded_at: "2026-04-27T10:00:00Z", core_temp_c: -5, ambient_temp_c: -20, source: "manual" },
      { id: "r2", recorded_at: "2026-04-27T10:00:30Z", core_temp_c: -10, ambient_temp_c: -22, source: "auto" },
      { id: "r3", recorded_at: "2026-04-27T10:01:00Z", core_temp_c: -18, ambient_temp_c: -25, source: "auto" },
    ];

    let capturedOrderArgs: unknown[] | null = null;
    mockState.fromHandler = (table) => {
      if (table !== "t_freezing_temp_log") return { data: [], error: null };
      return { data: readings, error: null };
    };

    // Override builder to capture .order(...) args
    const realFrom = (await import("@/integrations/supabase/client")).supabase.from;
    const spy = vi.spyOn(
      (await import("@/integrations/supabase/client")).supabase,
      "from",
    );
    spy.mockImplementation(((table: string) => {
      const b = (realFrom as unknown as (t: string) => unknown)(table) as Record<string, AnyFn>;
      const origOrder = b.order;
      b.order = vi.fn((...args: unknown[]) => {
        capturedOrderArgs = args;
        return (origOrder as AnyFn)(...args);
      });
      return b as never;
    }) as never);

    const { useFreezingTempStream } = await import("@/hooks/useFreezingTempStream");
    const { result } = renderHook(() => useFreezingTempStream("log-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.readings.length).toBe(3));
    expect(result.current.readings[0].id).toBe("r1");
    expect(result.current.readings[2].id).toBe("r3");
    expect(capturedOrderArgs).not.toBeNull();
    expect(capturedOrderArgs![0]).toBe("recorded_at");
    expect((capturedOrderArgs![1] as { ascending: boolean }).ascending).toBe(true);

    spy.mockRestore();
  });
});
