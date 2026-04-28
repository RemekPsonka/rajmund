## Cel

Stworzyć funkcję RPC `check_database_integrity()` weryfikującą zdrowie schematu bazy (triggery, FK, GENERATED columns, CHECK constraints) i wyświetlić wynik w `/dev-tools` jako sekcja **"Database health check"** z auto-uruchomieniem przy wejściu na stronę.

## Co sprawdzamy (lista oczekiwań)

### 1. Triggery (krytyczne dla integralności biznesowej)
Sprawdzamy obecność w `pg_trigger.tgname`:
- `trg_create_receiving_lineage` (t_batches) — auto lineage RECEIVING
- `trg_create_aggregation_lineage` (t_production_logs) — paleta ↔ batch
- `trg_create_ccp1_complaint` (t_warehouse_movements) — auto-reklamacja >+4°C
- `trg_ccp1_set_flag` (t_warehouse_movements)
- `trg_enforce_ccp3` (t_handling_units) — hard-gate mrożenia
- `trg_reduce_batch_on_input` (t_production_inputs) — pomniejszanie stanów
- `trg_update_handling_unit_totals` (t_production_logs)
- `trg_update_shipment_totals` (t_shipment_items)
- `trg_populate_shipment_item_batch` (t_shipment_items)
- `trg_mark_handling_unit_shipped` (t_shipment_items)
- `trg_validate_recipe_ingredient_role` (t_recipe_ingredients)

Dla każdego: `EXISTS w pg_trigger` + opcjonalnie `tgrelid` zgadza się z oczekiwaną tabelą.

### 2. Klucze obce (kluczowe relacje)
Sprawdzamy `pg_constraint contype='f'`:
- `t_production_orders.supervisor_id → t_employees.id` (naprawione w pętli #2; nie do `auth.users`)
- `t_lot_lineage.parent_lot_id → t_batches.id`
- `t_lot_lineage.child_lot_id → t_batches.id`
- `t_lot_lineage.child_handling_unit_id → t_handling_units.id`
- `t_production_logs.handling_unit_id → t_handling_units.id`
- `t_production_logs.source_batch_id → t_batches.id`
- `t_production_logs.output_batch_id → t_batches.id`
- `t_supplier_complaints.movement_id → t_warehouse_movements.id`
- `t_shipment_items.shipment_id → t_shipments.id`
- `t_shipment_items.handling_unit_id → t_handling_units.id`

### 3. GENERATED columns
`information_schema.columns.is_generated='ALWAYS'`:
- `t_warehouse_movements.ccp1_passed` (GENERATED — `received_temp_c <= 4`)
- `t_production_logs.weight_net` (jeśli jest GENERATED) — wykrywane dynamicznie

### 4. CHECK constraints
`pg_constraint contype='c'`:
- `t_production_logs_process_stage_check` (zawiera `Stacking`, `ShockFreezing`, `Freezing`)
- `t_handling_units` status check
- `t_batches_status_check`

## Schemat odpowiedzi RPC

```jsonc
{
  "ok": false,
  "summary": { "passed": 22, "failed": 2, "total": 24 },
  "checks": [
    {
      "category": "trigger",
      "name": "trg_enforce_ccp3",
      "expected": "t_handling_units",
      "ok": true,
      "detail": "OK"
    },
    {
      "category": "fk",
      "name": "t_production_orders.supervisor_id",
      "expected": "t_employees(id)",
      "ok": true,
      "detail": "references t_employees(id)"
    },
    {
      "category": "generated",
      "name": "t_warehouse_movements.ccp1_passed",
      "ok": true,
      "detail": "GENERATED ALWAYS"
    },
    {
      "category": "check",
      "name": "t_production_logs_process_stage_check",
      "ok": true,
      "detail": "contains: Stacking, ShockFreezing, Freezing"
    }
  ]
}
```

## Implementacja

### Krok 1 — migracja SQL
Nowa migracja tworzy `public.check_database_integrity() RETURNS jsonb`:
- `SECURITY DEFINER`, `SET search_path = public, pg_catalog`
- Buduje array `checks` przez `jsonb_build_array(...)` z 4 sekcji
- Każda sekcja używa `EXISTS` lub `LEFT JOIN` na `pg_trigger`/`pg_constraint`/`information_schema.columns`
- Liczy `passed/failed/total` na końcu

### Krok 2 — komponent React
`src/components/dev/DatabaseHealthCheck.tsx`:
- `useQuery` z `queryKey: ['db-health']`, wywołuje `supabase.rpc('check_database_integrity')`
- Auto-uruchomienie: query odpala się przy mount (`enabled: true` domyślnie)
- Layout identyczny do `DemoReadinessChecklist`:
  - Card z tytułem + Badge `passed/total` + przycisk "Sprawdź ponownie"
  - Lista grupowana po `category` (Triggery / Klucze obce / Generated / CHECK)
  - Każdy check: zielona/czerwona kropka + nazwa + `Collapsible` z `detail`
  - Kategoria zwija się gdy wszystkie OK; auto-rozwija gdy są błędy
- Toast `toast.error("Wykryto N problemów ze schematem")` jeśli `ok=false`

### Krok 3 — wpięcie do DevTools
`src/pages/dev/DevToolsPage.tsx`:
- Import `DatabaseHealthCheck`
- Renderuj zaraz pod `<DemoReadinessChecklist />` (linia 153)

### Krok 4 — TypeScript types
`src/integrations/supabase/types.ts` zostanie wygenerowane automatycznie po migracji (RPC `check_database_integrity` pojawi się w `Functions`).

## Pliki do utworzenia/edycji
1. `supabase/migrations/<timestamp>_check_database_integrity.sql` — nowa funkcja RPC
2. `src/components/dev/DatabaseHealthCheck.tsx` — nowy komponent
3. `src/pages/dev/DevToolsPage.tsx` — dodanie sekcji (1 import + 1 linia JSX)

## Kryteria akceptacji
- `/dev-tools` wyświetla sekcję "Database health check" z liczbą `passed/total`
- Auto-check przy mount (bez kliknięcia)
- Wszystkie 4 kategorie widoczne (Triggery, FK, Generated, CHECK)
- Klik w wiersz → szczegóły (`Collapsible`)
- Przycisk "Sprawdź ponownie" odświeża query
- Po obecnym stanie bazy (po pętli audytów #2) → wszystkie zielone

## Pamięć
Zaktualizuję `mem://index.md` o nowy wpis `[Database Health Check](mem://features/database-health-check)` z opisem RPC i jej zasięgu.
