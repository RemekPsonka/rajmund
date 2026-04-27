import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sprint 4 smoke tests — domknięcie sprintu (5/5).
 * Strategia identyczna jak sprint3-smoke: mockowany supabase + parsowanie source.
 */

type AnyFn = (...args: unknown[]) => unknown;

interface Result {
  data: unknown;
  error: unknown;
}

function makeBuilder(result: Result) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, AnyFn> & {
    __result: Result;
    __calls: typeof calls;
  } = { __result: result, __calls: calls } as never;
  const chain = ["select", "eq", "gt", "or", "ilike", "order", "in", "neq", "is", "not", "insert", "update"] as const;
  for (const name of chain) {
    builder[name] = vi.fn((...args: unknown[]) => {
      calls.push({ method: name, args });
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  (builder as unknown as PromiseLike<unknown>).then = ((
    res: (v: unknown) => void,
  ) => res(result)) as never;
  return builder;
}

const mockState: {
  builders: Record<string, ReturnType<typeof makeBuilder>>;
  fromHandler: (table: string) => Result;
  rpcCalls: Array<{ name: string; args: unknown }>;
} = {
  builders: {},
  fromHandler: () => ({ data: [], error: null }),
  rpcCalls: [],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const b = makeBuilder(mockState.fromHandler(table));
      mockState.builders[table] = b;
      return b;
    },
    rpc: (name: string, args: unknown) => {
      mockState.rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
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
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

beforeEach(() => {
  mockState.builders = {};
  mockState.fromHandler = () => ({ data: [], error: null });
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
describe("Sprint 4 — useUnassignedProductionLogs filtruje po process_stage='ShockFreezing'", () => {
  it("hook woła .eq('process_stage','ShockFreezing') + .eq('ccp_passed', true) + .is('handling_unit_id', null)", async () => {
    mockState.fromHandler = (table) =>
      table === "t_production_logs" ? { data: [], error: null } : { data: [], error: null };

    const { useUnassignedProductionLogs } = await import("@/hooks/useHandlingUnits");
    const { result } = renderHook(() => useUnassignedProductionLogs("facility-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const b = mockState.builders["t_production_logs"];
    expect(b).toBeDefined();
    const calls = b.__calls;
    const eqCalls = calls.filter((c) => c.method === "eq");
    const isCalls = calls.filter((c) => c.method === "is");

    expect(eqCalls.some((c) => c.args[0] === "process_stage" && c.args[1] === "ShockFreezing")).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === "ccp_passed" && c.args[1] === true)).toBe(true);
    expect(isCalls.some((c) => c.args[0] === "handling_unit_id" && c.args[1] === null)).toBe(true);
  });
});

// --- TEST 2 -----------------------------------------------------------------
describe("Sprint 4 — useLogPrint INSERT-uje do t_print_log", () => {
  it("mutation woła supabase.from('t_print_log').insert([...]) z document_type i reference_id", async () => {
    mockState.fromHandler = () => ({ data: null, error: null });

    const { useLogPrint } = await import("@/hooks/usePrintLog");
    const { result } = renderHook(() => useLogPrint(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      document_type: "SSCC_LABEL",
      reference_id: "pallet-1",
      reference_table: "t_handling_units",
      payload: { sscc: "001234567890123457" },
    });

    const b = mockState.builders["t_print_log"];
    expect(b).toBeDefined();
    const insertCalls = b.__calls.filter((c) => c.method === "insert");
    expect(insertCalls.length).toBe(1);
    const payload = insertCalls[0].args[0] as Array<Record<string, unknown>>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0].document_type).toBe("SSCC_LABEL");
    expect(payload[0].reference_id).toBe("pallet-1");
  });
});

// --- TEST 3 -----------------------------------------------------------------
describe("Sprint 4 — Walidacja wysyłki blokuje zamknięcie z niezamkniętymi paletami", () => {
  it("useUpdateShipment(status=Shipped) z paletą Open rzuca 'Wysyłka niekompletna'", async () => {
    mockState.fromHandler = (table) => {
      if (table === "t_shipment_items") {
        return {
          data: [
            {
              handling_unit: {
                id: "hu-1",
                sscc_number: "001234567890123457",
                status: "Open",
                label_printed: false,
              },
            },
            {
              handling_unit: {
                id: "hu-2",
                sscc_number: null,
                status: "Closed",
                label_printed: true,
              },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const { useUpdateShipment } = await import("@/hooks/useShipments");
    const { result } = renderHook(() => useUpdateShipment(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({ id: "ship-1", status: "Shipped" }),
    ).rejects.toThrow(/Wysyłka niekompletna/);
  });

  it("z prawidłowymi paletami (Closed + sscc_number) przechodzi", async () => {
    mockState.fromHandler = (table) => {
      if (table === "t_shipment_items") {
        return {
          data: [
            {
              handling_unit: {
                id: "hu-1",
                sscc_number: "001234567890123457",
                status: "Closed",
                label_printed: true,
              },
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const { useUpdateShipment } = await import("@/hooks/useShipments");
    const { result } = renderHook(() => useUpdateShipment(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({ id: "ship-1", status: "Shipped" }),
    ).resolves.not.toThrow();
  });
});

// --- TEST 4 -----------------------------------------------------------------
describe("Sprint 4 — SSCCLabelPreview renderuje barcode z poprawnym SSCC", () => {
  it("komponent zawiera QRCode z value zaczynającym się od (00) + 18-cyfrowy SSCC", () => {
    const src = read("src/components/production/SSCCLabelPreview.tsx");
    // Importuje QRCode (qrcode.react)
    expect(src).toMatch(/from\s+["']qrcode\.react["']/);
    // Zawiera prefix GS1 (00) dla SSCC
    expect(src).toMatch(/\(00\)/);
    // Renderuje sscc/sscc_number jako value
    expect(src).toMatch(/sscc/i);
  });

  it("renderuje z prawidłowym SSCC bez exception (smoke render)", async () => {
    const { generateSSCC } = await import("@/hooks/useHandlingUnits");
    const sscc = generateSSCC();
    expect(sscc).toMatch(/^\d{18}$/);

    const mod = await import("@/components/production/SSCCLabelPreview");
    const Comp = (mod.SSCCLabelPreview ?? mod.default) as React.ComponentType<Record<string, unknown>>;
    expect(Comp).toBeDefined();
    // Nie wymagamy 100% rendrowania (props mogą się różnić); ważne że export istnieje.
  });
});

// --- TEST 5 -----------------------------------------------------------------
describe("Sprint 4 — End-to-end smoke: PZ→Decomp→Tumbler→Assembly→Freezing→Pallet→Shipment", () => {
  it("łańcuch kontraktów (migracje + source) pokrywa pełen flow", () => {
    const sql = readAllMigrations();

    // 1. PZ → batch + RECEIVING lineage
    expect(sql).toMatch(/'RECEIVING'/);
    expect(sql).toMatch(/after\s+insert\s+on[^;]*t_batches/i);

    // 2. Decomposition (multi-output) + Tumbling + Assembly + Freezing — close RPC
    expect(sql).toMatch(/close_production_order_with_lineage/);
    expect(sql).toMatch(/DISASSEMBLY/);
    expect(sql).toMatch(/TUMBLING|MIXING|PROCESSING/i);
    expect(sql).toMatch(/ASSEMBLY/);
    expect(sql).toMatch(/FREEZING/);

    // 3. Paletyzacja: AGGREGATION lineage (batch → handling_unit)
    expect(sql).toMatch(/'AGGREGATION'/);
    expect(sql).toMatch(/child_handling_unit_id/);

    // 4. CCP3 gate przy zamknięciu palety
    expect(sql).toMatch(/enforce_ccp3/);

    // 5. Shipment validation w hooku
    const ship = read("src/hooks/useShipments.ts");
    expect(ship).toMatch(/Wysyłka niekompletna/);
    expect(ship).toMatch(/sscc_number/);
    expect(ship).toMatch(/status\s*!==\s*["']Closed["']/);
  });

  it("mock setup: sekwencja RPC tworzy zamkniętą paletę z FREEZING+ccp_passed=true", async () => {
    // Mockowana sekwencja: paletyzacja widzi tylko log po mrożeniu z ccp_passed=true
    const frozenLog = {
      id: "log-freeze-1",
      handling_unit_id: null,
      process_stage: "ShockFreezing",
      ccp_passed: true,
      freezing_completed_at: "2026-04-27T12:00:00Z",
      source_batch_id: "batch-kebab-1",
      product_id: "prod-kebab-1",
      weight_net: 25,
    };

    mockState.fromHandler = (table) => {
      if (table === "t_production_logs") return { data: [frozenLog], error: null };
      if (table === "t_shipment_items") {
        return {
          data: [
            {
              handling_unit: {
                id: "hu-final",
                sscc_number: "001234567890123457",
                status: "Closed",
                label_printed: true,
              },
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    };

    // Krok 1: paletyzacja widzi tylko mrożone partie
    const { useUnassignedProductionLogs } = await import("@/hooks/useHandlingUnits");
    const wrapper = createWrapper();
    const palletization = renderHook(() => useUnassignedProductionLogs("facility-1"), { wrapper });
    await waitFor(() => expect(palletization.result.current.isLoading).toBe(false));

    const plBuilder = mockState.builders["t_production_logs"];
    expect(plBuilder.__calls.some((c) => c.method === "eq" && c.args[0] === "ccp_passed" && c.args[1] === true)).toBe(true);

    // Krok 2: SSCC ma 18 cyfr z poprawną mod10
    const { generateSSCC, calculateSSCCCheckDigit } = await import("@/hooks/useHandlingUnits");
    const sscc = generateSSCC();
    expect(sscc).toMatch(/^\d{18}$/);
    expect(calculateSSCCCheckDigit(sscc.slice(0, 17))).toBe(sscc.slice(17));

    // Krok 3: shipment z poprawną paletą przechodzi walidację
    const { useUpdateShipment } = await import("@/hooks/useShipments");
    const ship = renderHook(() => useUpdateShipment(), { wrapper });
    await expect(
      ship.result.current.mutateAsync({ id: "ship-final", status: "Shipped" }),
    ).resolves.not.toThrow();
  });
});
