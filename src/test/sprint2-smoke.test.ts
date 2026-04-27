import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sprint 2 smoke tests — domknięcie sprintu.
 * Strategia identyczna jak sprint1-smoke: mockujemy supabase clienta,
 * resetujemy stan w beforeEach. Testy weryfikują integralność kontraktów,
 * a nie pełnego runtime'u UI.
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

// --- TEST 1 -----------------------------------------------------------------
describe("Sprint 2 — Tumbler emituje LOT po ZAKOŃCZ PARTIĘ", () => {
  it("useCloseProductionOrder wywołuje RPC close_production_order_with_lineage i zwraca output_batch_id", async () => {
    const orderId = "order-tumbler-1";

    mockState.rpcHandler = (name) => {
      if (name === "close_production_order_with_lineage") {
        return {
          data: {
            success: true,
            order_id: orderId,
            output_batch_id: "batch-out-tumbler",
            output_batch_number: "260427/SU-TUMB/001",
            total_weight_kg: 100,
            logs_updated: 3,
            inputs_processed: 3,
            lineage_entries_created: 3,
            event_type: "PROCESSING",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const { useCloseProductionOrder } = await import("@/hooks/useProductionOrders");
    const { result } = renderHook(() => useCloseProductionOrder(), {
      wrapper: createWrapper(),
    });

    const response = await result.current.mutateAsync(orderId);

    expect(mockState.rpcCalls.some((c) => c.name === "close_production_order_with_lineage")).toBe(true);
    const call = mockState.rpcCalls.find((c) => c.name === "close_production_order_with_lineage")!;
    expect(call.args).toEqual({ p_order_id: orderId });

    const r = response as { success: boolean; output_batch_id: string };
    expect(r.success).toBe(true);
    expect(r.output_batch_id).toBe("batch-out-tumbler");

    // Tumbler page rzeczywiście wywołuje closeOrder przy ZAKOŃCZ PARTIĘ
    const tumblerSrc = read("src/pages/production/TumblerTerminalPage.tsx");
    expect(tumblerSrc).toMatch(/closeOrder\.mutate\(\s*selectedOrderId/);
    expect(tumblerSrc).toContain("ZAKOŃCZ PARTIĘ");
  });
});

// --- TEST 2 -----------------------------------------------------------------
describe("Sprint 2 — KebabAssembly nie ma hardcoded finishedProducts[0]", () => {
  it("plik nie zawiera antywzorca pierwszy-z-listy ani hardcoded productId", () => {
    const src = read("src/pages/production/KebabAssemblyTerminalPage.tsx");

    // Antywzorzec z briefu: brać po prostu pierwszy produkt z listy
    expect(src).not.toMatch(/finishedProducts\s*\[\s*0\s*\]/);
    expect(src).not.toMatch(/products\s*\[\s*0\s*\]\.id/);
    expect(src).not.toMatch(/kebabProducts\s*\[\s*0\s*\]/);

    // Pozytyw: produkt jest wybierany świadomie (state)
    expect(src).toMatch(/setSelectedProduct\(/);
  });
});

// --- TEST 3 -----------------------------------------------------------------
describe("Sprint 2 — Każdy terminal renderuje StateMachineBadge", () => {
  const terminals = [
    "src/pages/production/WeighingTerminalPage.tsx",
    "src/pages/production/TumblerTerminalPage.tsx",
    "src/pages/production/KebabAssemblyTerminalPage.tsx",
    "src/pages/production/ShockFreezingTerminalPage.tsx",
  ];

  it.each(terminals)("%s importuje i używa <StateMachineBadge>", (path) => {
    const src = read(path);
    expect(src).toMatch(
      /import\s*\{\s*StateMachineBadge\s*\}\s*from\s*["']@\/components\/production\/StateMachineBadge["']/,
    );
    expect(src).toMatch(/<StateMachineBadge[\s>]/);
  });
});

// --- TEST 4 -----------------------------------------------------------------
describe("Sprint 2 — ShockFreezing czyta in-progress logi przy mount", () => {
  it("useFreezingLogs filtruje t_production_logs po process_stage='ShockFreezing' i facility_id", async () => {
    const facilityId = "fac-1";
    const activeLogs = [
      {
        id: "log-1",
        process_stage: "ShockFreezing",
        freezing_started_at: new Date().toISOString(),
        freezing_completed_at: null,
        production_order: { facility_id: facilityId, order_number: "PO-001" },
        product: { name: "Kebab 10kg", sku: "K10", unit: "kg" },
        source_batch: { internal_batch_number: "260427/SU-MEAT/001" },
      },
      {
        id: "log-2",
        process_stage: "ShockFreezing",
        freezing_started_at: new Date().toISOString(),
        freezing_completed_at: null,
        production_order: { facility_id: "OTHER-FAC", order_number: "PO-002" },
        product: { name: "X", sku: "X", unit: "kg" },
        source_batch: { internal_batch_number: "B" },
      },
    ];

    mockState.fromHandler = (table) =>
      table === "t_production_logs" ? { data: activeLogs, error: null } : { data: [], error: null };

    const { useFreezingLogs } = await import("@/hooks/useProductionOrders");
    const { result } = renderHook(() => useFreezingLogs(facilityId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = (result.current.data ?? []) as typeof activeLogs;
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("log-1");
    expect(data[0].production_order.facility_id).toBe(facilityId);

    // ShockFreezing page faktycznie czyta useFreezingLogs przy mount
    const src = read("src/pages/production/ShockFreezingTerminalPage.tsx");
    expect(src).toMatch(/useFreezingLogs\s*\(/);
    expect(src).toMatch(/setFreezingItems/);
  });
});
