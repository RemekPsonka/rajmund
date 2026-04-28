
-- patch: t_freezing_temp_log.source must be 'manual' or 'auto'
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='simulate_full_production_day';
  v_def := replace(v_def, '''simulation''', '''auto''');
  EXECUTE v_def;
END $$;
