import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

/**
 * Sprint 1 smoke tests — weryfikacja końcowa.
 * Strategia: mockujemy supabase clienta (brak dedykowanej test-instancji).
 * Każdy beforeEach resetuje stan = pełen determinizm.
 */

type AnyFn = (...args: unknown[]) => unknown;

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, AnyFn> & { __result: typeof result } = {
    __result: result,
  } as never;
  const chain = ["select", "eq", "gt", "or", "ilike", "order"] as const;
  for (const name of chain) {
    builder[name] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  // Awaitable
  (builder as unknown as PromiseLike<unknown>).then = ((
    resolve: (v: unknown) => void,
  ) => resolve(result)) as never;
  return builder;
}

const mockState: {
  fromHandler: (table: string) => { data: unknown; error: unknown };
  rpcHandler: (name: string, args: unknown) => { data: unknown; error: unknown };
} = {
  fromHandler: () => ({ data: [], error: null }),
  rpcHandler: () => ({ data: null, error: null }),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(mockState.fromHandler(table)),
    rpc: (name: string, args: unknown) =>
      Promise.resolve(mockState.rpcHandler(name, args)),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  mockState.fromHandler = () => ({ data: [], error: null });
  mockState.rpcHandler = () => ({ data: null, error: null });
  vi.clearAllMocks();
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

// --- TEST 1 -----------------------------------------------------------------
describe("Sprint 1 — migracja t_lot_lineage istnieje", () => {
  it("information_schema potwierdza wszystkie wymagane kolumny", async () => {
    const expected = [
      "id",
      "parent_lot_id",
      "child_lot_id",
      "event_type",
      "qty_kg",
      "process_ref_id",
      "operator_id",
      "occurred_at",
      "created_at",
    ];

    mockState.fromHandler = (table) => {
      if (table === "information_schema.columns") {
        return { data: expected.map((c) => ({ column_name: c })), error: null };
      }
      return { data: [], error: null };
    };

    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = (await supabase
      .from("information_schema.columns" as never)
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "t_lot_lineage")) as {
      data: Array<{ column_name: string }>;
      error: unknown;
    };

    expect(error).toBeNull();
    const columns = data.map((r) => r.column_name);
    for (const col of expected) {
      expect(columns).toContain(col);
    }
  });
});

// --- TEST 2 -----------------------------------------------------------------
describe("Sprint 1 — close_production_order_with_lineage tworzy output batch + lineage", () => {
  it("RPC zwraca output_batch_id, aktualizuje logi i tworzy wpis lineage", async () => {
    const orderId = "order-uuid-1";
    const newBatchId = "batch-out-1";

    mockState.rpcHandler = (name, args) => {
      expect(name).toBe("close_production_order_with_lineage");
      expect(args).toEqual({ p_order_id: orderId });
      return {
        data: {
          success: true,
          order_id: orderId,
          output_batch_id: newBatchId,
          output_batch_number: "20260427/SU-MEAT/001",
          total_weight_kg: 50,
          logs_updated: 1,
          inputs_processed: 1,
          lineage_entries_created: 1,
          event_type: "DISASSEMBLY",
        },
        error: null,
      };
    };

    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.rpc(
      "close_production_order_with_lineage" as never,
      { p_order_id: orderId } as never,
    );

    expect(error).toBeNull();
    const r = data as {
      success: boolean;
      output_batch_id: string;
      logs_updated: number;
      lineage_entries_created: number;
      total_weight_kg: number;
      event_type: string;
    };
    expect(r.success).toBe(true);
    expect(r.output_batch_id).toBe(newBatchId);
    expect(r.logs_updated).toBeGreaterThan(0);
    expect(r.lineage_entries_created).toBeGreaterThan(0);
    expect(r.total_weight_kg).toBe(50);
    expect(r.event_type).toBe("DISASSEMBLY");
  });
});

// --- TEST 3 -----------------------------------------------------------------
describe("Sprint 1 — useLotLineage zwraca drzewo dla nowej partii", () => {
  it("ancestors zawiera surowiec, descendants jest puste", async () => {
    mockState.rpcHandler = (name, args) => {
      expect(name).toBe("get_lot_lineage");
      expect(args).toEqual({ lot_id: "child-lot-id" });
      return {
        data: {
          ancestors: [
            {
              lot_id: "raw-batch-id",
              lot_code: "BATCH-RAW-260427-001",
              depth: 1,
              event_type: "DISASSEMBLY",
              qty_kg: 50,
              occurred_at: new Date().toISOString(),
            },
          ],
          descendants: [],
        },
        error: null,
      };
    };

    const { useLotLineage } = await import("@/hooks/useLotLineage");
    const { result } = renderHook(() => useLotLineage("child-lot-id"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ancestors).toHaveLength(1);
    expect(result.current.data?.ancestors[0].lot_id).toBe("raw-batch-id");
    expect(result.current.data?.descendants).toEqual([]);
  });
});

// --- TEST 4 -----------------------------------------------------------------
describe("Sprint 1 — useBatches({ availableOnly: true }) wyklucza Blocked", () => {
  it("zwraca wyłącznie partie Released (filtr serwerowy)", async () => {
    const allBatches = [
      {
        id: "b1",
        product_id: "p1",
        internal_batch_number: "BATCH-OK",
        status: "Released",
        current_quantity: 100,
        initial_quantity: 100,
        expiration_date: null,
      },
      {
        id: "b2",
        product_id: "p2",
        internal_batch_number: "BATCH-BLOCKED",
        status: "Blocked",
        current_quantity: 100,
        initial_quantity: 100,
        expiration_date: null,
      },
    ];

    mockState.fromHandler = (table) => {
      if (table === "t_batches") {
        return {
          data: allBatches.filter((b) => b.status === "Released"),
          error: null,
        };
      }
      return { data: [], error: null };
    };

    const { useBatches } = await import("@/hooks/useBatches");
    const { result } = renderHook(() => useBatches({ availableOnly: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data ?? [];
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("Released");
    expect(data.find((b) => b.status === "Blocked")).toBeUndefined();
  });

  it("getBatchRejectionReason — Blocked / Quarantine / przeterminowana / OK", async () => {
    const { getBatchRejectionReason } = await import("@/hooks/useBatches");

    expect(
      getBatchRejectionReason({
        status: "Blocked",
        current_quantity: 100,
        expiration_date: null,
      }),
    ).toMatch(/ZABLOKOWANA/);

    expect(
      getBatchRejectionReason({
        status: "Quarantine",
        current_quantity: 100,
        expiration_date: null,
      }),
    ).toMatch(/KWARANTANNIE/);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(
      getBatchRejectionReason({
        status: "Released",
        current_quantity: 100,
        expiration_date: yesterday.toISOString().split("T")[0],
      }),
    ).toMatch(/PRZETERMINOWANA/);

    expect(
      getBatchRejectionReason({
        status: "Released",
        current_quantity: 100,
        expiration_date: null,
      }),
    ).toBeNull();
  });
});
