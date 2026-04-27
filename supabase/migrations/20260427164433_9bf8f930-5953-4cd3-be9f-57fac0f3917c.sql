CREATE OR REPLACE FUNCTION public.close_production_order_with_lineage(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_total_weight numeric := 0;
  v_product_id uuid;
  v_first_log RECORD;
  v_event_type text;
  v_batch_number text;
  v_new_batch_id uuid;
  v_first_parent_id uuid;
  v_logs_count integer;
  v_inputs_count integer := 0;
  v_lineage_count integer := 0;
  v_input RECORD;
  v_facility_location_id uuid;
  v_default_expiration_days integer;
BEGIN
  SELECT * INTO v_order FROM public.t_production_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  IF v_order.status::text <> 'Open' THEN
    RAISE EXCEPTION 'Order is not open (status: %)', v_order.status;
  END IF;

  v_event_type := CASE v_order.type::text
    WHEN 'Decomposition' THEN 'DISASSEMBLY'
    WHEN 'Processing'    THEN 'TUMBLING'
    WHEN 'Assembly'      THEN 'ASSEMBLY'
    WHEN 'Freezing'      THEN 'FREEZING'
    WHEN 'Packing'       THEN 'AGGREGATION'
    ELSE 'AGGREGATION'
  END;

  SELECT COALESCE(SUM(weight_net), 0), COUNT(*)
    INTO v_total_weight, v_logs_count
  FROM public.t_production_logs
  WHERE production_order_id = p_order_id;

  IF v_logs_count = 0 OR v_total_weight <= 0 THEN
    RAISE EXCEPTION 'No production logs with positive weight for order %', p_order_id;
  END IF;

  SELECT * INTO v_first_log
  FROM public.t_production_logs
  WHERE production_order_id = p_order_id
  ORDER BY created_at ASC
  LIMIT 1;

  v_product_id := v_first_log.product_id;
  v_first_parent_id := v_first_log.source_batch_id;

  IF v_first_parent_id IS NULL THEN
    SELECT batch_id INTO v_first_parent_id
    FROM public.t_production_inputs
    WHERE production_order_id = p_order_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  v_batch_number := public.generate_batch_number(v_product_id);

  SELECT default_expiration_days INTO v_default_expiration_days
  FROM public.t_products WHERE id = v_product_id;

  SELECT id INTO v_facility_location_id
  FROM public.t_storage_locations
  WHERE facility_id = v_order.facility_id AND is_active = true
  ORDER BY CASE WHEN location_type = 'production' THEN 1 ELSE 2 END
  LIMIT 1;

  INSERT INTO public.t_batches (
    product_id, internal_batch_number, initial_quantity, current_quantity,
    production_date, expiration_date, status, location_id,
    parent_batch_id, source_event_type
  ) VALUES (
    v_product_id, v_batch_number, v_total_weight, v_total_weight,
    CURRENT_DATE, CURRENT_DATE + COALESCE(v_default_expiration_days, 30),
    'Released', v_facility_location_id,
    v_first_parent_id, v_event_type
  )
  RETURNING id INTO v_new_batch_id;

  UPDATE public.t_production_logs
  SET output_batch_id = v_new_batch_id
  WHERE production_order_id = p_order_id;

  FOR v_input IN
    SELECT batch_id, SUM(weight) AS total_weight
    FROM public.t_production_inputs
    WHERE production_order_id = p_order_id
      AND batch_id IS NOT NULL
      AND batch_id <> v_new_batch_id
    GROUP BY batch_id
  LOOP
    v_inputs_count := v_inputs_count + 1;
    IF v_input.total_weight > 0 THEN
      INSERT INTO public.t_lot_lineage (
        parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, occurred_at
      ) VALUES (
        v_input.batch_id, v_new_batch_id, v_event_type, v_input.total_weight, p_order_id, NOW()
      );
      v_lineage_count := v_lineage_count + 1;
    END IF;
  END LOOP;

  UPDATE public.t_production_orders
  SET status = 'Closed', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'output_batch_id', v_new_batch_id,
    'output_batch_number', v_batch_number,
    'total_weight_kg', v_total_weight,
    'logs_updated', v_logs_count,
    'inputs_processed', v_inputs_count,
    'lineage_entries_created', v_lineage_count,
    'event_type', v_event_type
  );
END;
$$;