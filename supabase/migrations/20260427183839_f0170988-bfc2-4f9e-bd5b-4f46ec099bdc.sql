-- 1. Tabela historii pomiarów temperatury podczas mrożenia (krzywa)
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

-- 2. RLS dla t_freezing_temp_log
ALTER TABLE public.t_freezing_temp_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access for auth users"
  ON public.t_freezing_temp_log
  FOR ALL
  USING (is_authenticated())
  WITH CHECK (is_authenticated());

CREATE POLICY "Global admins can do everything with freezing temp log"
  ON public.t_freezing_temp_log
  FOR ALL
  USING (is_global_admin(auth.uid()));

CREATE POLICY "Users can view freezing temp log"
  ON public.t_freezing_temp_log
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.t_production_logs pl
    JOIN public.t_production_orders po ON po.id = pl.production_order_id
    WHERE pl.id = t_freezing_temp_log.production_log_id
      AND has_company_access(auth.uid(), po.company_id)
  ));

CREATE POLICY "Operators can insert freezing temp log"
  ON public.t_freezing_temp_log
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.t_production_logs pl
    JOIN public.t_production_orders po ON po.id = pl.production_order_id
    WHERE pl.id = t_freezing_temp_log.production_log_id
      AND has_facility_access(auth.uid(), po.facility_id)
      AND (
        has_role(auth.uid(), 'facility_admin'::app_role)
        OR has_role(auth.uid(), 'operator'::app_role)
      )
  ));

-- 3. Realtime publication
ALTER TABLE public.t_freezing_temp_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.t_freezing_temp_log;

-- 4. CCP1 na PZ — kolumny w t_warehouse_movements
ALTER TABLE public.t_warehouse_movements
  ADD COLUMN IF NOT EXISTS received_temp_c numeric;

ALTER TABLE public.t_warehouse_movements
  ADD COLUMN IF NOT EXISTS received_temp_method text
    CHECK (
      received_temp_method IS NULL
      OR received_temp_method IN ('VEHICLE_GAUGE','MANUAL_PROBE','BOTH')
    );

ALTER TABLE public.t_warehouse_movements
  ADD COLUMN IF NOT EXISTS ccp1_passed boolean
    GENERATED ALWAYS AS (
      received_temp_c IS NULL OR received_temp_c <= 4
    ) STORED;

-- 5. Konfiguracja kontrolna freezingu na poziomie production_log
ALTER TABLE public.t_production_logs
  ADD COLUMN IF NOT EXISTS target_core_temp_c numeric DEFAULT -18;

ALTER TABLE public.t_production_logs
  ADD COLUMN IF NOT EXISTS max_freezing_minutes int DEFAULT 240;