# Sprint: Mrożenie szokowe — persystencja + CCP

## Cel
Sesje mrożenia są persystowane w `t_production_logs`. Operator wpisuje temperaturę rdzenia, a CCP (≤ -18°C) decyduje o emisji LOT-u przy zamknięciu.

## Stan obecny vs. brief
- ✅ Start mrożenia → INSERT do `t_production_logs` z `freezing_started_at`, `source_batch_id`, `production_order_id` (już zrobione, działa).
- ✅ useEffect przywraca aktywne sesje przy mount (już zrobione).
- ❌ Brak pól `latest_core_temp_c` i `ccp_passed` w DB.
- ❌ Brak UI do "POBIERZ TEMPERATURĘ" (input per item).
- ❌ Zakończenie nie sprawdza CCP ani nie wywołuje `close_production_order_with_lineage`.

## Pliki

### 1. Migracja — nowe kolumny
```sql
ALTER TABLE public.t_production_logs
  ADD COLUMN IF NOT EXISTS latest_core_temp_c numeric,
  ADD COLUMN IF NOT EXISTS ccp_passed boolean;

COMMENT ON COLUMN public.t_production_logs.latest_core_temp_c IS
  'Ostatni odczyt temp. rdzenia (°C). Aktualizowany w trakcie mrożenia.';
COMMENT ON COLUMN public.t_production_logs.ccp_passed IS
  'Critical Control Point: TRUE jeśli przy zamknięciu temp ≤ -18°C, FALSE jeśli > -18°C, NULL jeśli mrożenie trwa.';
```

### 2. `src/hooks/useProductionOrders.ts`
- `useUpdateProductionLog` — rozszerzyć typ payload o `latest_core_temp_c?: number | null` i `ccp_passed?: boolean | null`. Drobne: usunąć obowiązkowy toast.success "Log produkcji zaktualizowany" (zalewa UI przy każdym pomiarze) — przenieść do callera lub uciszyć dla update'ów temp.

### 3. `src/pages/production/ShockFreezingTerminalPage.tsx`
- `FreezingItem` rozszerzyć o `latestTempC?: number | null`, `ccpPassed?: boolean | null`.
- Mapper z DB (useEffect ładujący `existingFreezingLogs`) — dopisać te dwa pola z loga.
- Nowy lokalny state `tempInputs: Record<itemId, string>` do drugiej kolumny inputu temperatury w wierszu tabeli.
- Nowa funkcja `handleSaveTemperature(itemId)`:
  - Walidacja: liczba między -50 a 30.
  - `updateLog.mutateAsync({ id: dbLogId, latest_core_temp_c: value })`.
  - Update local state itema.
  - Toast "Zapisano temperaturę: X°C".
- `handleCompleteFreezing` przerobić:
  - Wymaga `latestTempC != null` — toast jeśli brak.
  - `passed = latestTempC <= -18`.
  - `updateLog.mutateAsync({ id, freezing_completed_at, freezing_duration_minutes, ccp_passed: passed })`.
  - Jeśli `passed === true`: spróbuj `closeOrder.mutateAsync(productionOrderId)` (RPC `close_production_order_with_lineage`) — emituje LOT.
  - Jeśli `passed === false`: pozostaw zlecenie Open, dopisz notatkę do zlecenia (`notes += "\n[QC] Mrożenie #X: temp -15°C nie spełnia CCP -18°C"`), toast warning "Wymaga decyzji QC — zlecenie pozostaje otwarte".
- Tabela: dodać 2 kolumny:
  - **Temp. rdzenia (°C)**: input number + przycisk "Zapisz" (lub Enter). Pokaż ostatni zapisany odczyt poniżej.
  - **CCP**: badge "PASS"/"FAIL"/"—" (po zakończeniu). W trakcie mrożenia: kolor temp (niebieski jeśli ≤-18, czerwony jeśli > -18).
- Item w stanie `completed` z `ccpPassed===false` → wiersz z czerwoną ramką + badge "Wymaga QC".
- `production_order_id` musi być pamiętany na FreezingItem żeby móc go zamknąć (dziś nie jest — dodać `productionOrderId?: string` do interface i wypełniać przy create+load).

## Struktury UI tabeli (po zmianach)
| Status | Nr Partii | Produkt | Waga | Czas | **Temp** | **CCP** | Akcja |
|--------|-----------|---------|------|------|----------|---------|-------|

## Acceptance check
1. F5 nie czyści listy — ✅ (już działa, mapper teraz też czyta `latest_core_temp_c`).
2. Pola `freezing_started_at`, `latest_core_temp_c`, `freezing_completed_at`, `ccp_passed` widoczne w DB — ✅ po migracji.
3. Mrożenie z temp -15°C → ccp_passed=false, brak LOT-u, zlecenie Open z notatką — ✅.
4. Mrożenie z temp -20°C → ccp_passed=true, zlecenie Closed, LOT wyemitowany — ✅.

## Pliki dotknięte
- `supabase/migrations/<ts>_freezing_ccp_fields.sql` (nowy)
- `src/hooks/useProductionOrders.ts` (typ update)
- `src/pages/production/ShockFreezingTerminalPage.tsx` (UI + logika)

## Po sprincie
Update `mem://features/traceability-logic` o CCP gating LOT-u przy mrożeniu.
