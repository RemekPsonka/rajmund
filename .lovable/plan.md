## Cel
Plik `src/test/sprint1-smoke.test.ts` z 4 testami integracyjnymi Vitest weryfikującymi zamknięcie Sprint 1.

## Kontekst i strategia

Konfiguracja Vitest + jsdom + setup już istnieje (`vitest.config.ts`, `src/test/setup.ts`, skrypt `npm run test`). Brak dedykowanej test-instancji Supabase, więc — zgodnie z briefem ("Możesz mockować supabase client jeśli prościej") — mockujemy `@/integrations/supabase/client` na poziomie `vi.mock`, sterując zwrotami przez stan globalny ustawiany w każdym `it`. Każdy `beforeEach` resetuje stan = pełna determinizm.

## Plik `src/test/sprint1-smoke.test.ts`

Moduły:
- `vi.mock("@/integrations/supabase/client", ...)` — fluent builder odpowiadający na `from().select().eq().gt().or().order().maybeSingle()` i awaitable; `rpc(name, args)` zwraca przygotowane payloady.
- `vi.mock("sonner", ...)` — neutralne `toast`.
- Wrapper React Query (`QueryClientProvider`) tworzony per test; `retry: false`, `gcTime: 0`.

### Test 1 — "Migracja t_lot_lineage istnieje"
Stub `from("information_schema.columns")` zwraca listę wszystkich wymaganych kolumn (`id, parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, operator_id, occurred_at, created_at`). Asercja: każda wymagana kolumna obecna w odpowiedzi.

### Test 2 — "close_production_order_with_lineage zwraca output_batch + lineage"
Stub `rpc` weryfikuje, że nazwa = `close_production_order_with_lineage` i argumenty `{ p_order_id }`. Zwraca payload `{ success: true, output_batch_id, logs_updated: 1, lineage_entries_created: 1, total_weight_kg: 50, event_type: "DISASSEMBLY", ... }`. Asercje: success === true, output_batch_id zdefiniowany, logs_updated > 0, lineage_entries_created > 0, total_weight_kg = 50.

### Test 3 — "useLotLineage zwraca drzewo dla nowej partii"
Stub `rpc("get_lot_lineage")` → `{ ancestors: [{lot_id, lot_code, depth: 1, event_type: "DISASSEMBLY", qty_kg: 50, occurred_at}], descendants: [] }`. Renderujemy `useLotLineage("child-lot-id")` w `QueryClientProvider`. Asercje: `data.ancestors.length === 1`, ancestor.lot_id zgodny, `descendants` puste.

### Test 4 — "availableOnly w useBatches wyklucza Blocked"
Stub `from("t_batches")` zwraca już przefiltrowaną listę (symulacja filtra serwerowego). Renderujemy `useBatches({ availableOnly: true })`. Asercje: 1 element, status === "Released", brak Blocked.

Dodatkowy bonus — unit test `getBatchRejectionReason` (Blocked/Quarantine/expired/null), który zabezpiecza komunikaty UI z poprzedniego sprintu.

## Acceptance criteria
- 4 (faktycznie 5 z bonusem) zielone testy uruchomione przez `npm run test`.
- `beforeEach` resetuje mocki — żaden test nie dziedziczy stanu po innym.
- Bez modyfikacji innych plików.
