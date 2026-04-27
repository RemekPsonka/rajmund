## Cel
Atomowe zamykanie zlecenia produkcyjnego z utworzeniem partii wynikowej i zapisem genealogii w jednej transakcji PL/pgSQL.

## 1. Migracja — RPC `close_production_order_with_lineage(p_order_id uuid)`

`SECURITY DEFINER`, `search_path = public`. Cała logika w PL/pgSQL = jedna transakcja (PostgreSQL automatycznie cofa wszystko przy `RAISE EXCEPTION`).

Kroki:
1. Pobierz zlecenie; sprawdź `status = 'Open'` (inaczej `RAISE EXCEPTION`).
2. Zmapuj `order.type` → `event_type`:
   - `Decomposition` → `DISASSEMBLY`
   - `Processing` → `TUMBLING`
   - `Assembly` → `ASSEMBLY`
   - `Freezing` → `FREEZING`
   - `Packing` → `AGGREGATION`
3. `SELECT SUM(weight_net), COUNT(*)` z `t_production_logs` dla zlecenia. Jeśli brak logów lub suma ≤ 0 → exception.
4. `product_id` z pierwszego loga (po `created_at ASC`); `parent_batch_id` z `source_batch_id` tego loga, fallback do `batch_id` z pierwszego `t_production_inputs`.
5. Numer partii przez istniejącą `generate_batch_number(product_id)`.
6. Wybór `location_id` z `t_storage_locations` zakładu (preferuj `location_type='production'`); `expiration_date = CURRENT_DATE + COALESCE(default_expiration_days, 30)`.
7. `INSERT INTO t_batches` z `parent_batch_id`, `source_event_type`, `status='Released'`, `initial_quantity = current_quantity = SUM`.
8. `UPDATE t_production_logs SET output_batch_id = nowa` dla całego zlecenia.
9. Pętla po unikalnych `batch_id` z `t_production_inputs` (GROUP BY): wstaw wpis do `t_lot_lineage` (`parent_lot_id`, `child_lot_id=nowa`, `event_type`, `qty_kg=SUM(weight)`, `process_ref_id=order_id`, `occurred_at=NOW()`). Pomiń wpisy z `qty_kg <= 0` i z `batch_id = nowa partia`.
10. `UPDATE t_production_orders SET status='Closed', updated_at=NOW()`.
11. Zwróć `jsonb` z `success`, `order_id`, `output_batch_id`, `output_batch_number`, `total_weight_kg`, `logs_updated`, `inputs_processed`, `lineage_entries_created`, `event_type`.

## 2. Aktualizacja hooka `useCloseProductionOrder`

W `src/hooks/useProductionOrders.ts` (linie ~404–433):
- Zmień nazwę RPC na `close_production_order_with_lineage`.
- Zaktualizuj typ zwrotki (`output_batch_number`, `total_weight_kg`, …).
- Toast: "Zlecenie zamknięte. Partia wynikowa: {output_batch_number} ({total_weight_kg} kg)".
- Invalidate dodatkowo `["lot-lineage"]` (klucz z poprzedniego sprintu).

Reszta hooka, mutacja `useUpdateProductionOrder`, fetchery — bez zmian.

## Atomowość
PL/pgSQL automatycznie obejmuje całe ciało funkcji jedną transakcją. Każdy `RAISE EXCEPTION` lub błąd constraint cofa wszystkie wcześniejsze `INSERT/UPDATE` w funkcji. Brak potrzeby explicit `BEGIN/COMMIT`.

## Acceptance criteria
- Po zamknięciu zlecenia rozbioru: nowa partia w `t_batches` z `parent_batch_id` ustawionym na partię surowca i `source_event_type='DISASSEMBLY'`.
- Wszystkie `t_production_logs` zlecenia mają `output_batch_id = id nowej partii`.
- Wpisy w `t_lot_lineage` z `process_ref_id=order_id`, `event_type='DISASSEMBLY'`, `qty_kg` = waga inputu.
- Błąd w środku funkcji → ŻADEN zapis nie pozostaje (transakcja rollback).
- Frontend wywołuje tylko jedną RPC zamiast 4 mutacji.

## Co NIE wchodzi w sprint
- Stara funkcja `close_production_order_with_batches` zostaje (dla kompatybilności wstecznej) — może być usunięta w osobnym sprincie po weryfikacji.
- Strona `/genealogia/:lotId` (kolejny sprint).
