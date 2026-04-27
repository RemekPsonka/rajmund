CREATE OR REPLACE FUNCTION public.close_production_order_with_lineage(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_event_type text;
  v_product RECORD;
  v_new_batch_id uuid;
  v_batch_number text;
  v_batches_created jsonb := '[]'::jsonb;
  v_lineage_count int := 0;
  v_input RECORD;
  v_first_parent_id uuid;
  v_default_expiration_days int;
  v_facility_location_id uuid;
  v_total_output_weight numeric;
BEGIN
  SELECT * INTO v_order FROM t_production_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;
  IF v_order.status != 'Open' THEN RAISE EXCEPTION 'Order is not open (status: %)', v_order.status; END IF;

  v_event_type := CASE v_order.type::text
    WHEN 'Decomposition' THEN 'DISASSEMBLY'
    WHEN 'Processing'    THEN 'TUMBLING'
    WHEN 'Assembly'      THEN 'ASSEMBLY'
    WHEN 'Freezing'      THEN 'FREEZING'
    WHEN 'Packing'       THEN 'AGGREGATION'
    ELSE 'AGGREGATION'
  END;

  SELECT batch_id INTO v_first_parent_id
  FROM t_production_inputs
  WHERE production_order_id = p_order_id AND batch_id IS NOT NULL
  ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_facility_location_id
  FROM t_storage_locations
  WHERE facility_id = v_order.facility_id AND is_active = true
  ORDER BY CASE WHEN location_type = 'production' THEN 1 ELSE 2 END
  LIMIT 1;

  SELECT SUM(COALESCE(weight_net, weight_gross - weight_tare, 0))
    INTO v_total_output_weight
  FROM t_production_logs
  WHERE production_order_id = p_order_id;

  FOR v_product IN
    SELECT
      product_id,
      SUM(COALESCE(weight_net, weight_gross - weight_tare, 0)) as total_weight_kg,
      COUNT(*) as log_count
    FROM t_production_logs
    WHERE production_order_id = p_order_id
    GROUP BY product_id
    HAVING SUM(COALESCE(weight_net, weight_gross - weight_tare, 0)) > 0
  LOOP
    v_batch_number := generate_batch_number(v_product.product_id);

    SELECT default_expiration_days INTO v_default_expiration_days
    FROM t_products WHERE id = v_product.product_id;

    INSERT INTO t_batches (
      product_id, internal_batch_number, initial_quantity, current_quantity,
      production_date, expiration_date, status, location_id,
      parent_batch_id, source_event_type
    ) VALUES (
      v_product.product_id, v_batch_number, v_product.total_weight_kg, v_product.total_weight_kg,
      CURRENT_DATE, CURRENT_DATE + COALESCE(v_default_expiration_days, 30),
      'Released', v_facility_location_id,
      v_first_parent_id, v_event_type
    )
    RETURNING id INTO v_new_batch_id;

    UPDATE t_production_logs
    SET output_batch_id = v_new_batch_id
    WHERE production_order_id = p_order_id
      AND product_id = v_product.product_id;

    FOR v_input IN
      SELECT batch_id, SUM(weight) AS total_weight
      FROM t_production_inputs
      WHERE production_order_id = p_order_id AND batch_id IS NOT NULL
      GROUP BY batch_id
    LOOP
      IF v_input.total_weight > 0 THEN
        INSERT INTO t_lot_lineage (
          parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, occurred_at
        ) VALUES (
          v_input.batch_id, v_new_batch_id, v_event_type,
          v_input.total_weight * (v_product.total_weight_kg / NULLIF(v_total_output_weight, 0)),
          p_order_id, NOW()
        );
        v_lineage_count := v_lineage_count + 1;
      END IF;
    END LOOP;

    v_batches_created := v_batches_created || jsonb_build_object(
      'batch_id', v_new_batch_id,
      'batch_number', v_batch_number,
      'product_id', v_product.product_id,
      'qty_kg', v_product.total_weight_kg
    );
  END LOOP;

  UPDATE t_production_orders
  SET status = 'Closed', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'batches_created', v_batches_created,
    'lineage_entries_created', v_lineage_count,
    'event_type', v_event_type
  );
END;
$$;