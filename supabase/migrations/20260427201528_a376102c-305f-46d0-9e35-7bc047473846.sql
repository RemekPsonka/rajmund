
ALTER TABLE public.t_production_logs DROP CONSTRAINT IF EXISTS t_production_logs_process_stage_check;

ALTER TABLE public.t_production_logs
  ADD CONSTRAINT t_production_logs_process_stage_check
  CHECK (process_stage = ANY (ARRAY[
    'Decomposition'::text,
    'Massaging'::text,
    'Stacking'::text,
    'Freezing'::text,
    'ShockFreezing'::text
  ]));

-- Backfill #1: stary alias 'Freezing' -> 'ShockFreezing'
UPDATE public.t_production_logs
SET process_stage = 'ShockFreezing'
WHERE process_stage = 'Freezing';

-- Backfill #2: logi z rozpoczętym/zakończonym mrożeniem bez ustawionego stage
UPDATE public.t_production_logs
SET process_stage = 'ShockFreezing'
WHERE process_stage IS NULL
  AND (freezing_started_at IS NOT NULL OR freezing_completed_at IS NOT NULL);
