-- 1) Schema: parent nullable + child_handling_unit_id
ALTER TABLE public.t_lot_lineage ALTER COLUMN parent_lot_id DROP NOT NULL;
ALTER TABLE public.t_lot_lineage ALTER COLUMN child_lot_id DROP NOT NULL;
ALTER TABLE public.t_lot_lineage
  ADD COLUMN IF NOT EXISTS child_handling_unit_id uuid REFERENCES public.t_handling_units(id) ON DELETE CASCADE;

ALTER TABLE public.t_lot_lineage
  DROP CONSTRAINT IF EXISTS t_lot_lineage_child_target_chk;
ALTER TABLE public.t_lot_lineage
  ADD CONSTRAINT t_lot_lineage_child_target_chk
  CHECK (child_lot_id IS NOT NULL OR child_handling_unit_id IS NOT NULL);

-- 2) Trigger RECEIVING — dla nowych partii bez parent (PZ)
CREATE OR REPLACE FUNCTION public.create_receiving_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_batch_id IS NULL AND NEW.source_event_type IS NULL THEN
    INSERT INTO public.t_lot_lineage (
      parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, occurred_at
    ) VALUES (
      NULL, NEW.id, 'RECEIVING', NEW.initial_quantity, NULL, COALESCE(NEW.reception_date, NOW())
    );
    UPDATE public.t_batches SET source_event_type = 'RECEIVING' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receiving_lineage ON public.t_batches;
CREATE TRIGGER trg_receiving_lineage
AFTER INSERT ON public.t_batches
FOR EACH ROW EXECUTE FUNCTION public.create_receiving_lineage();

-- 3) Trigger AGGREGATION — gdy log produkcyjny dostaje handling_unit_id
CREATE OR REPLACE FUNCTION public.create_aggregation_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_batch uuid;
  v_qty numeric;
BEGIN
  IF NEW.handling_unit_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.handling_unit_id IS NOT DISTINCT FROM NEW.handling_unit_id THEN
    RETURN NEW;
  END IF;

  v_parent_batch := COALESCE(NEW.source_batch_id, NEW.output_batch_id);
  IF v_parent_batch IS NULL THEN RETURN NEW; END IF;

  v_qty := COALESCE(NEW.weight_net, NEW.weight_gross - COALESCE(NEW.weight_tare, 0), 0);
  IF v_qty <= 0 THEN RETURN NEW; END IF;

  -- Idempotencja: nie duplikuj
  IF EXISTS (
    SELECT 1 FROM public.t_lot_lineage
    WHERE parent_lot_id = v_parent_batch
      AND child_handling_unit_id = NEW.handling_unit_id
      AND event_type = 'AGGREGATION'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.t_lot_lineage (
    parent_lot_id, child_lot_id, child_handling_unit_id, event_type, qty_kg, process_ref_id, occurred_at
  ) VALUES (
    v_parent_batch, NULL, NEW.handling_unit_id, 'AGGREGATION', v_qty, NEW.production_order_id, NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aggregation_lineage ON public.t_production_logs;
CREATE TRIGGER trg_aggregation_lineage
AFTER INSERT OR UPDATE OF handling_unit_id ON public.t_production_logs
FOR EACH ROW EXECUTE FUNCTION public.create_aggregation_lineage();

-- 4) RPC: rozszerz get_lot_lineage o palety + RECEIVING root
CREATE OR REPLACE FUNCTION public.get_lot_lineage(lot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ancestors jsonb;
  v_descendants jsonb;
BEGIN
  -- ANCESTORS (rekursywnie w górę po parent_lot_id partii)
  WITH RECURSIVE ancestors AS (
    SELECT
      ll.id AS edge_id,
      ll.parent_lot_id AS lot_id,
      NULL::uuid AS handling_unit_id,
      ll.event_type,
      ll.qty_kg,
      ll.occurred_at,
      1 AS depth
    FROM public.t_lot_lineage ll
    WHERE ll.child_lot_id = get_lot_lineage.lot_id
    UNION ALL
    SELECT
      ll.id, ll.parent_lot_id, NULL::uuid, ll.event_type, ll.qty_kg, ll.occurred_at, a.depth + 1
    FROM public.t_lot_lineage ll
    JOIN ancestors a ON ll.child_lot_id = a.lot_id
    WHERE a.depth < 50 AND a.lot_id IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lot_id', COALESCE(a.lot_id::text, 'root'),
    'lot_code', CASE WHEN a.lot_id IS NULL THEN 'ŹRÓDŁO (Dostawa)' ELSE COALESCE(b.internal_batch_number, a.lot_id::text) END,
    'depth', a.depth,
    'event_type', a.event_type,
    'qty_kg', a.qty_kg,
    'occurred_at', a.occurred_at,
    'is_root', (a.lot_id IS NULL)
  ) ORDER BY a.depth, a.occurred_at), '[]'::jsonb)
  INTO v_ancestors
  FROM ancestors a
  LEFT JOIN public.t_batches b ON b.id = a.lot_id;

  -- DESCENDANTS (po child_lot_id w dół + bezpośrednie palety AGGREGATION)
  WITH RECURSIVE descendants AS (
    SELECT
      ll.id AS edge_id,
      ll.child_lot_id AS lot_id,
      ll.child_handling_unit_id AS handling_unit_id,
      ll.event_type,
      ll.qty_kg,
      ll.occurred_at,
      1 AS depth
    FROM public.t_lot_lineage ll
    WHERE ll.parent_lot_id = get_lot_lineage.lot_id
    UNION ALL
    SELECT
      ll.id, ll.child_lot_id, ll.child_handling_unit_id, ll.event_type, ll.qty_kg, ll.occurred_at, d.depth + 1
    FROM public.t_lot_lineage ll
    JOIN descendants d ON ll.parent_lot_id = d.lot_id
    WHERE d.depth < 50 AND d.lot_id IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lot_id', COALESCE(d.lot_id::text, d.handling_unit_id::text),
    'lot_code', CASE
      WHEN d.handling_unit_id IS NOT NULL THEN COALESCE('Paleta ' || hu.sscc_number, 'Paleta')
      ELSE COALESCE(b.internal_batch_number, d.lot_id::text)
    END,
    'depth', d.depth,
    'event_type', d.event_type,
    'qty_kg', d.qty_kg,
    'occurred_at', d.occurred_at,
    'is_pallet', (d.handling_unit_id IS NOT NULL),
    'handling_unit_id', d.handling_unit_id
  ) ORDER BY d.depth, d.occurred_at), '[]'::jsonb)
  INTO v_descendants
  FROM descendants d
  LEFT JOIN public.t_batches b ON b.id = d.lot_id
  LEFT JOIN public.t_handling_units hu ON hu.id = d.handling_unit_id;

  RETURN jsonb_build_object('ancestors', v_ancestors, 'descendants', v_descendants);
END;
$$;

-- 5) Backfill RECEIVING dla istniejących partii bez parent + bez source_event_type LUB z source_event_type='RECEIVING'
INSERT INTO public.t_lot_lineage (parent_lot_id, child_lot_id, event_type, qty_kg, occurred_at)
SELECT NULL, b.id, 'RECEIVING', b.initial_quantity, COALESCE(b.reception_date, b.created_at, NOW())
FROM public.t_batches b
WHERE b.parent_batch_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.t_lot_lineage ll
    WHERE ll.child_lot_id = b.id AND ll.event_type = 'RECEIVING'
  );

UPDATE public.t_batches
SET source_event_type = 'RECEIVING'
WHERE parent_batch_id IS NULL AND source_event_type IS NULL;

-- 6) Backfill AGGREGATION dla istniejących logów z handling_unit_id
INSERT INTO public.t_lot_lineage (parent_lot_id, child_handling_unit_id, event_type, qty_kg, process_ref_id, occurred_at)
SELECT
  COALESCE(pl.source_batch_id, pl.output_batch_id),
  pl.handling_unit_id,
  'AGGREGATION',
  COALESCE(pl.weight_net, pl.weight_gross - COALESCE(pl.weight_tare, 0), 0),
  pl.production_order_id,
  COALESCE(pl.created_at, NOW())
FROM public.t_production_logs pl
WHERE pl.handling_unit_id IS NOT NULL
  AND COALESCE(pl.source_batch_id, pl.output_batch_id) IS NOT NULL
  AND COALESCE(pl.weight_net, pl.weight_gross - COALESCE(pl.weight_tare, 0), 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.t_lot_lineage ll
    WHERE ll.parent_lot_id = COALESCE(pl.source_batch_id, pl.output_batch_id)
      AND ll.child_handling_unit_id = pl.handling_unit_id
      AND ll.event_type = 'AGGREGATION'
  );