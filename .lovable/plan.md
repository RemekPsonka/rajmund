## Sprint 3 — Migracja: krzywa temperatur + CCP1 na PZ

Czysta migracja schematu. Bez zmian w UI/kodzie aplikacji w tym kroku.

### Plik

`supabase/migrations/<timestamp>_s3_freezing_curve_and_ccp1.sql`

### Zawartość migracji

**1. Nowa tabela `t_freezing_temp_log`** — historia pomiarów temperatury rdzenia podczas mrożenia (źródło danych dla wykresu krzywej).

```sql
CREATE TABLE public.t_freezing_temp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_log_id uuid NOT NULL
    REFERENCES public.t_production_logs(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  core_temp_c numeric NOT NULL,
  ambient_temp_c numeric,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','auto')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_freezing_temp_production_log
  ON public.t_freezing_temp_log(production_log_id, recorded_at DESC);
```

**2. RLS dla `t_freezing_temp_log`** — w stylu pozostałych tabel produkcyjnych (auth users + global_admin + operator/facility_admin via dostęp do company przez join na production_log → production_order):

```sql
ALTER TABLE public.t_freezing_temp_log ENABLE ROW LEVEL SECURITY;

-- SELECT: każdy zalogowany (parytet z t_production_logs „Access for auth users")
CREATE POLICY "Access for auth users" ON public.t_freezing_temp_log
  FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());

CREATE POLICY "Global admins can do everything with freezing temp log"
  ON public.t_freezing_temp_log FOR ALL
  USING (is_global_admin(auth.uid()));

CREATE POLICY "Users can view freezing temp log"
  ON public.t_freezing_temp_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.t_production_logs pl
    JOIN public.t_production_orders po ON po.id = pl.production_order_id
    WHERE pl.id = t_freezing_temp_log.production_log_id
      AND has_company_access(auth.uid(), po.company_id)
  ));

CREATE POLICY "Operators can insert freezing temp log"
  ON public.t_freezing_temp_log FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.t_production_logs pl
    JOIN public.t_production_orders po ON po.id = pl.production_order_id
    WHERE pl.id = t_freezing_temp_log.production_log_id
      AND has_facility_access(auth.uid(), po.facility_id)
      AND (has_role(auth.uid(),'facility_admin'::app_role)
        OR has_role(auth.uid(),'operator'::app_role))
  ));
```

**3. Realtime** — publikacja dla wykresu w S3.2/S3.3:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.t_freezing_temp_log;
ALTER TABLE public.t_freezing_temp_log REPLICA IDENTITY FULL;
```

**4. CCP1 na PZ — dodatkowe kolumny w `t_warehouse_movements`**:

```sql
ALTER TABLE public.t_warehouse_movements
  ADD COLUMN IF NOT EXISTS received_temp_c numeric;

ALTER TABLE public.t_warehouse_movements
  ADD COLUMN IF NOT EXISTS received_temp_method text
    CHECK (received_temp_method IS NULL
      OR received_temp_method IN ('VEHICLE_GAUGE','MANUAL_PROBE','BOTH'));

ALTER TABLE public.t_warehouse_movements
  ADD COLUMN IF NOT EXISTS ccp1_passed boolean
    GENERATED ALWAYS AS
      (received_temp_c IS NULL OR received_temp_c <= 4) STORED;
```

**5. Konfiguracja kontrolna freezingu w `t_production_logs`** (target/limit per LOT, S3 użyje do hard-gate'u):

```sql
ALTER TABLE public.t_production_logs
  ADD COLUMN IF NOT EXISTS target_core_temp_c numeric DEFAULT -18;

ALTER TABLE public.t_production_logs
  ADD COLUMN IF NOT EXISTS max_freezing_minutes int DEFAULT 240;
```

### Acceptance test (po migracji uruchamiam jako sanity check)

1. `INSERT` 5 wierszy `t_freezing_temp_log` dla istniejącego `production_log_id` z różnymi `recorded_at` → `SELECT ... ORDER BY recorded_at` zwraca chronologicznie.
2. `INSERT INTO t_warehouse_movements (..., received_temp_c=5)` → `ccp1_passed = false`.
3. `INSERT INTO t_warehouse_movements (..., received_temp_c=3)` → `ccp1_passed = true`.
4. `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='t_freezing_temp_log'` → zwraca wiersz.

### Co NIE wchodzi w ten sprint (świadomie)

- UI rejestracji pomiarów / wykres krzywej (S3.2/S3.3).
- Hard gate na PZ w UI (S3 dalej).
- Zmiany w `close_production_order_with_lineage` (CCP gate już jest w S2.5 na bazie `latest_core_temp_c`/`ccp_passed`; w S3 dorzucimy walidację względem `target_core_temp_c` jak będzie potrzebne).

### Potencjalne ryzyka

- `ALTER PUBLICATION supabase_realtime ADD TABLE` jest idempotentne tylko warunkowo — jeśli tabela już byłaby w publikacji, polecenie rzuca błąd. Tabela jest nowa, więc OK; nie owijamy w `DO $$`.
- `GENERATED ALWAYS ... STORED` na `ccp1_passed`: wszystkie istniejące wiersze `t_warehouse_movements` dostaną `received_temp_c=NULL` → `ccp1_passed=true`. To poprawne (brak danych ≠ fail).
