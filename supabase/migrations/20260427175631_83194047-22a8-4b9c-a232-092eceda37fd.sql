ALTER TABLE public.t_production_logs
  ADD COLUMN IF NOT EXISTS latest_core_temp_c numeric,
  ADD COLUMN IF NOT EXISTS ccp_passed boolean;

COMMENT ON COLUMN public.t_production_logs.latest_core_temp_c IS
  'Ostatni odczyt temp. rdzenia (°C). Aktualizowany w trakcie mrożenia.';
COMMENT ON COLUMN public.t_production_logs.ccp_passed IS
  'Critical Control Point: TRUE jeśli przy zamknięciu temp <= -18°C, FALSE jeśli > -18°C, NULL jeśli mrożenie trwa.';