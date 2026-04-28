## Cel

Wzmocnić istniejący `check_database_integrity()` o 4 rozszerzenia chroniące przed regresjami wykrytymi w Audit Loop #2: duplikaty triggerów, severity per check, self-validation w `audit_e2e_flow`, oraz auto-check w trybie dev przy starcie aplikacji.

## Stan obecny (zweryfikowany)

- `check_database_integrity()` istnieje (v1) — sprawdza 25 oczekiwań w 4 kategoriach (trigger/fk/generated/check), bez severity i bez detekcji duplikatów.
- `src/components/dev/DatabaseHealthCheck.tsx` + wpięcie w `/dev-tools` działa.
- `audit_e2e_flow(p_temp)` istnieje, ale nie wywołuje health check.
- `App.tsx` nie ma auto-check w dev mode.

## Co dokładnie zostanie zrobione

### 1. Migracja SQL — rozszerzenie `check_database_integrity()`

Dodać do każdego elementu wynikowej tablicy `checks` pole `severity` (CRITICAL | HIGH | MEDIUM | LOW) wg mapowania:

- **CRITICAL**: triggery CCP (`trg_ccp1_set_flag`, `trg_create_ccp1_complaint`, `trg_enforce_ccp3`), FK `t_production_orders.supervisor_id → t_employees`, kategoria `duplicates`.
- **HIGH**: triggery lineage (`trg_create_receiving_lineage`, `trg_create_aggregation_lineage`), totals (`trg_update_handling_unit_totals`, `trg_update_shipment_totals`), `trg_reduce_batch_on_input`, `trg_populate_shipment_item_batch`, `trg_mark_handling_unit_shipped`, FK lineage/lot/handling_unit.
- **MEDIUM**: GENERATED columns, CHECK constraints, `trg_validate_recipe_ingredient_role`.
- **LOW**: zarezerwowane (na razie nieużywane, ale pole obecne dla forward-compat).

Dodać **5. kategorię `duplicates`**:

```sql
WITH dups AS (
  SELECT c.relname AS tbl, p.proname AS fn, array_agg(t.tgname) AS names, count(*) AS n
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc  p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
  GROUP BY c.relname, p.proname
  HAVING count(*) > 1
)
```

Każdy znaleziony duplikat → check `ok=false`, `severity='CRITICAL'`, `name='duplicate on <tbl> calling <fn>'`, `detail='Found N duplicates: <names>'`. Jeśli brak duplikatów → jeden zielony check `'no duplicate triggers'` (żeby UI zawsze pokazywało stan kategorii).

### 2. Migracja SQL — self-validation w `audit_e2e_flow`

Na końcu funkcji `audit_e2e_flow(p_temp)`, przed `RETURN`:

```sql
v_health := public.check_database_integrity();
-- doklej do final jsonb_build_object:
'database_health', v_health
```

Bez zmiany sygnatury — dodatkowe pole w zwracanym JSON.

### 3. Komponent `DatabaseHealthCheck.tsx` — rozszerzenia UI

- **Czerwony banner u góry** z liczbą CRITICAL fails (jeśli > 0) — szybka detekcja katastrofy.
- **Kropki severity** w wierszach: `CRITICAL=red`, `HIGH=orange`, `MEDIUM=amber`, `LOW=gray`. Zielona kropka gdy `ok=true` niezależnie od severity.
- Nowa sekcja **"Duplikaty triggerów"** w grupowaniu po kategorii (renderer już iteruje po `category` — wystarczy dorzucić tłumaczenie etykiety).
- **Auto-collapse** kategorii kiedy 100% checków ok.
- **Toast.error** przy załadowaniu z `ok=false` z liczbą failów (już zapewne jest — zweryfikować i upewnić się że pokazuje severity breakdown).
- Zachować przycisk "Sprawdź ponownie" + relative time ostatniego sprawdzenia.

### 4. `App.tsx` — `<DevHealthCheck />` w dev mode

Dodać mały komponent inline (lub w `src/components/dev/DevHealthCheck.tsx`):

```tsx
function DevHealthCheck() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    supabase.rpc('check_database_integrity').then(({ data, error }) => {
      if (error) { console.error('DB health check error:', error); return; }
      const s = (data as any)?.summary;
      if (!(data as any)?.ok) {
        console.warn('⚠️ Database health check failed:', s, '— open /dev-tools');
      } else {
        console.log('✓ Database health check:', s);
      }
    });
  }, []);
  return null;
}
```

Zamontować w `App.tsx` raz, zaraz po `<TooltipProvider>`. Jednorazowy fire-and-forget — nie wpływa na render.

## Szczegóły techniczne

- Migracja SQL: jedna nowa migracja zastępująca `check_database_integrity()` (CREATE OR REPLACE) i `audit_e2e_flow()` (CREATE OR REPLACE — bez DROP, sygnatura niezmieniona).
- Wszystkie checki budowane przez `jsonb_agg` z UNION dla brakujących kategorii (gwarancja zwrotu wpisu nawet przy zerowym wyniku).
- Severity mapowanie wytrzyma rozbudowę — kolejne triggery dorzucamy do tej samej VALUES tabeli.
- UI: brak nowych zależności, używamy istniejących `Card`, `Collapsible`, `Badge` (shadcn).
- Brak nowych RLS — RPC są SECURITY DEFINER, dostępne anon (publiczny system).

## Acceptance criteria

1. `SELECT public.check_database_integrity()` zwraca jsonb z `summary {passed, failed, total}` i każdym checkiem zawierającym `severity`.
2. Wszystkie checki w aktualnej bazie (po Loop #2) → zielone, w tym kategoria `duplicates` (1 zielony check „no duplicate triggers").
3. `SELECT public.audit_e2e_flow(2.0)` zwraca pole `database_health` z pełnym wynikiem.
4. `/dev-tools` pokazuje kategorie z kolorowymi kropkami severity, banner CRITICAL ukryty (bo wszystko zielone).
5. W trybie dev konsola na starcie pokazuje `✓ Database health check: { passed: 26, failed: 0, total: 26 }`.

## Test regresji ręczny

- `DROP TRIGGER trg_enforce_ccp3 ON t_handling_units` → refetch → 1 czerwony check (CRITICAL), banner widoczny, console.warn w dev.
- `CREATE TRIGGER trg_dup_ccp3 BEFORE UPDATE ON t_handling_units FOR EACH ROW EXECUTE FUNCTION enforce_ccp3()` → refetch → kategoria `duplicates` pokazuje 1 czerwony.
- `SELECT public.audit_e2e_flow(2.0)` → `database_health.ok = false` propaguje się przez audit.
