CREATE OR REPLACE FUNCTION public.enforce_ccp3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unfrozen_lots text[];
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'Closed' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'Closed' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT b.internal_batch_number)
  INTO v_unfrozen_lots
  FROM t_batches b
  WHERE b.id IN (
    SELECT DISTINCT pl.source_batch_id
    FROM t_production_logs pl
    WHERE pl.handling_unit_id = NEW.id
      AND pl.source_batch_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM t_production_logs pl2
    WHERE pl2.source_batch_id = b.id
      AND pl2.freezing_completed_at IS NOT NULL
      AND pl2.ccp_passed = true
  );

  IF v_unfrozen_lots IS NOT NULL AND array_length(v_unfrozen_lots, 1) > 0 THEN
    RAISE EXCEPTION 'CCP3_FAILED: paleta zawiera partie bez zatwierdzonego mrożenia: %',
      array_to_string(v_unfrozen_lots, ', ');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ccp3 ON public.t_handling_units;

CREATE TRIGGER trg_enforce_ccp3
BEFORE UPDATE ON public.t_handling_units
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ccp3();