# Plan: Sprint 2 smoke tests + zamknięcie sprintu

## Cel
Dostarczyć `src/test/sprint2-smoke.test.ts` z 4 testami weryfikującymi domknięcie Sprintu 2, uruchomić go i zamknąć sprint.

## Strategia
Identyczna jak `sprint1-smoke.test.ts` (już w repo): mock supabase clienta + `renderHook` z `@testing-library/react`, fabryka `makeBuilder` na łańcuchowy query builder, deterministyczny `beforeEach`. Setup vitest/jsdom już istnieje (`vitest.config.ts`, `src/test/setup.ts`, deps w `package.json`) — nic nie trzeba dodawać.

## 4 testy

### 1. „Tumbler emituje LOT po ZAKOŃCZ PARTIĘ" (e2e symulowany)
- `renderHook(useCloseProductionOrder)` + `mutateAsync(orderId)`.
- Mock RPC `close_production_order_with_lineage` zwraca `{success, output_batch_id, output_batch_number, lineage_entries_created, event_type:"PROCESSING"}`.
- Asercje: RPC został wywołany z `{ p_order_id: orderId }`, response zawiera `output_batch_id`.
- Dodatkowo grep po `TumblerTerminalPage.tsx`: zawiera `closeOrder.mutate(selectedOrderId` oraz tekst „ZAKOŃCZ PARTIĘ" — gwarancja, że UI faktycznie spina hook z buttonem.

### 2. „KebabAssembly nie ma hardcoded `finishedProducts[0]`" (grep)
- `readFileSync` na `KebabAssemblyTerminalPage.tsx`.
- Negatywne matche: `finishedProducts[0]`, `products[0].id`, `kebabProducts[0]`.
- Pozytyw: zawiera `setSelectedProduct(` (świadomy wybór).

### 3. „Each terminal renders StateMachineBadge"
- `it.each` po 4 ścieżkach: Weighing/Tumbler/KebabAssembly/ShockFreezing.
- Każdy plik MUSI mieć import z `@/components/production/StateMachineBadge` oraz JSX `<StateMachineBadge`.

### 4. „ShockFreezing reads existing in-progress logs on mount"
- `renderHook(useFreezingLogs(facilityId))` z mockiem `t_production_logs` zwracającym 2 logi (jeden z facility=fac-1, drugi z innego).
- Asercje: hook filtruje po facility_id po stronie klienta → 1 wynik, `process_stage="ShockFreezing"`.
- Grep po `ShockFreezingTerminalPage.tsx`: zawiera `useFreezingLogs(` oraz `setFreezingItems` — gwarancja, że page hydratuje state na mount.

## Uruchomienie i domknięcie
1. `bunx vitest run src/test/sprint2-smoke.test.ts` — wszystkie 4 zielone.
2. `bunx vitest run` — pełny suite zielony (sprint1 + sprint2 + example).
3. Update `mem://index.md` + dopisek w `mem://project/modules-roadmap` o domknięciu Sprintu 2 (LOT lineage, recipe validation, CCP gate, state machines, unsaved-warning).
4. Krótkie podsumowanie dla operatora.

## Pliki
- **created**: `src/test/sprint2-smoke.test.ts`
- **edited (memory)**: `mem://index.md` z notką „Sprint 2 zamknięty"

Brak migracji, brak nowych zależności, brak zmian w kodzie aplikacyjnym.
