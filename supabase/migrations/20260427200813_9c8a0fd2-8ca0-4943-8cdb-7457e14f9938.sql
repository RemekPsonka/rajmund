CREATE OR REPLACE FUNCTION public.enforce_ccp3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unfrozen_lots text[];
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'Closed' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'Closed' THEN RETURN NEW; END IF;

  WITH RECURSIVE pallet_lots AS (
    SELECT DISTINCT pl.source_batch_id AS lot_id
    FROM t_production_logs pl
    WHERE pl.handling_unit_id = NEW.id AND pl.source_batch_id IS NOT NULL
  ),
  lineage_chain AS (
    -- Każda partia na palecie jest "swoim własnym" punktem startu (depth=0)
    SELECT pl_lot.lot_id AS root_lot_id, pl_lot.lot_id AS lot_id, 0 AS depth
    FROM pallet_lots pl_lot

    UNION

    -- Rekurencyjnie wchodzimy w rodziców (parent_lot_id) tej partii
    SELECT lc.root_lot_id, ll.parent_lot_id, lc.depth + 1
    FROM t_lot_lineage ll
    JOIN lineage_chain lc ON ll.child_lot_id = lc.lot_id
    WHERE lc.depth < 10
  ),
  frozen_roots AS (
    -- Roots, których łańcuch zawiera FREEZING z ccp_passed=true
    SELECT DISTINCT lc.root_lot_id
    FROM lineage_chain lc
    JOIN t_lot_lineage ll ON ll.child_lot_id = lc.lot_id AND ll.event_type = 'FREEZING'
    WHERE EXISTS (
      SELECT 1 FROM t_production_logs pl_freeze
      WHERE pl_freeze.source_batch_id = ll.parent_lot_id
        AND pl_freeze.ccp_passed = true
    )
  )
  SELECT array_agg(DISTINCT b.internal_batch_number)
  INTO v_unfrozen_lots
  FROM pallet_lots pl_lot
  JOIN t_batches b ON b.id = pl_lot.lot_id
  WHERE pl_lot.lot_id NOT IN (SELECT root_lot_id FROM frozen_roots);

  IF v_unfrozen_lots IS NOT NULL AND array_length(v_unfrozen_lots, 1) > 0 THEN
    RAISE EXCEPTION 'CCP3_FAILED: paleta zawiera partie bez zatwierdzonego mrożenia w łańcuchu produkcji: %',
      array_to_string(v_unfrozen_lots, ', ');
  END IF;

  RETURN NEW;
END;
$$;