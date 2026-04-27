CREATE OR REPLACE FUNCTION public.get_lot_lineage(lot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ancestors jsonb;
  v_descendants jsonb;
BEGIN
  WITH RECURSIVE ancestors AS (
    SELECT
      ll.parent_lot_id AS lot_id,
      ll.event_type,
      ll.qty_kg,
      ll.occurred_at,
      1 AS depth
    FROM public.t_lot_lineage ll
    WHERE ll.child_lot_id = get_lot_lineage.lot_id
    UNION ALL
    SELECT
      ll.parent_lot_id,
      ll.event_type,
      ll.qty_kg,
      ll.occurred_at,
      a.depth + 1
    FROM public.t_lot_lineage ll
    JOIN ancestors a ON ll.child_lot_id = a.lot_id
    WHERE a.depth < 50
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lot_id', a.lot_id,
    'lot_code', b.internal_batch_number,
    'depth', a.depth,
    'event_type', a.event_type,
    'qty_kg', a.qty_kg,
    'occurred_at', a.occurred_at
  ) ORDER BY a.depth, a.occurred_at), '[]'::jsonb)
  INTO v_ancestors
  FROM ancestors a
  LEFT JOIN public.t_batches b ON b.id = a.lot_id;

  WITH RECURSIVE descendants AS (
    SELECT
      ll.child_lot_id AS lot_id,
      ll.event_type,
      ll.qty_kg,
      ll.occurred_at,
      1 AS depth
    FROM public.t_lot_lineage ll
    WHERE ll.parent_lot_id = get_lot_lineage.lot_id
    UNION ALL
    SELECT
      ll.child_lot_id,
      ll.event_type,
      ll.qty_kg,
      ll.occurred_at,
      d.depth + 1
    FROM public.t_lot_lineage ll
    JOIN descendants d ON ll.parent_lot_id = d.lot_id
    WHERE d.depth < 50
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lot_id', d.lot_id,
    'lot_code', b.internal_batch_number,
    'depth', d.depth,
    'event_type', d.event_type,
    'qty_kg', d.qty_kg,
    'occurred_at', d.occurred_at
  ) ORDER BY d.depth, d.occurred_at), '[]'::jsonb)
  INTO v_descendants
  FROM descendants d
  LEFT JOIN public.t_batches b ON b.id = d.lot_id;

  RETURN jsonb_build_object(
    'ancestors', v_ancestors,
    'descendants', v_descendants
  );
END;
$$;