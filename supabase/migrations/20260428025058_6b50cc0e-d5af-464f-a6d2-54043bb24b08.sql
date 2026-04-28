CREATE OR REPLACE FUNCTION public.test_ccp3_gate()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sim jsonb; v_company_id uuid; v_facility_id uuid;
  v_raw_batch_id uuid; v_raw_prod_id uuid;
  v_hu_id uuid; v_po_id uuid; v_pl_id uuid;
  v_blocked boolean := false; v_err text;
BEGIN
  v_sim := public.simulate_full_production_day();
  v_company_id := (v_sim->>'company_id')::uuid;
  v_facility_id := (v_sim->>'facility_id')::uuid;
  v_raw_batch_id := (v_sim->>'raw_batch_id')::uuid;
  SELECT product_id INTO v_raw_prod_id FROM t_batches WHERE id = v_raw_batch_id;

  INSERT INTO t_handling_units (company_id, facility_id, sscc_number, type, status)
    VALUES (v_company_id, v_facility_id, '099'||to_char(now(),'YYMMDDHH24MISS')||'9', 'Pallet', 'Open')
    RETURNING id INTO v_hu_id;

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status)
    VALUES (v_company_id, v_facility_id, 'CCP3-TEST-'||to_char(now(),'YYMMDDHH24MISS'), 'Decomposition', 'Open')
    RETURNING id INTO v_po_id;

  INSERT INTO t_production_logs (production_order_id, source_batch_id, output_batch_id, product_id,
    handling_unit_id, weight_gross, weight_tare, process_stage)
    VALUES (v_po_id, v_raw_batch_id, v_raw_batch_id, v_raw_prod_id, v_hu_id, 100, 0, 'Stacking')
    RETURNING id INTO v_pl_id;

  BEGIN
    UPDATE t_handling_units SET status='Closed' WHERE id = v_hu_id;
    v_blocked := false;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := true;
    v_err := SQLERRM;
  END;

  -- cleanup
  DELETE FROM t_lot_lineage WHERE child_handling_unit_id = v_hu_id;
  DELETE FROM t_production_logs WHERE id = v_pl_id;
  DELETE FROM t_handling_units WHERE id = v_hu_id;
  DELETE FROM t_production_orders WHERE id = v_po_id;

  RETURN jsonb_build_object('blocked', v_blocked, 'err', v_err);
END;
$$;