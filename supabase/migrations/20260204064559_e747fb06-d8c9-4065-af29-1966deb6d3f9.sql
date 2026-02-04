DROP FUNCTION IF EXISTS public.simulate_full_production_day();

CREATE OR REPLACE FUNCTION public.simulate_full_production_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid; v_facility_id uuid; v_storage_location_id uuid;
  v_raw_chicken_id uuid; v_semi_meat_id uuid; v_semi_masa_id uuid;
  v_finished_kebab_15_id uuid; v_waste_bones_id uuid; v_spice_mix_id uuid;
  v_recipe_id uuid; v_raw_batch_id uuid; v_meat_batch_id uuid; v_masa_batch_id uuid; v_kebab_batch_id uuid; v_bones_batch_id uuid;
  v_decomp_order_id uuid; v_processing_order_id uuid; v_assembly_order_id uuid; v_freezing_order_id uuid;
  v_assembly_log_id uuid; v_pallet_ids uuid[] := ARRAY[]::uuid[]; v_pallet_id uuid; v_shipment_id uuid; v_result jsonb; v_i integer;
BEGIN
  -- CLEANUP
  DELETE FROM t_shipment_items WHERE shipment_id IN (SELECT id FROM t_shipments WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_shipments WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_production_kebab_variants WHERE production_log_id IN (SELECT id FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory')));
  DELETE FROM t_handling_units WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_production_inputs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_production_tasks WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_batches WHERE product_id IN (SELECT id FROM t_products WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_recipe_ingredients WHERE recipe_id IN (SELECT id FROM t_recipes WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_recipes WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_products WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_storage_locations WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_facilities WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_companies WHERE name = 'Kebab Test Factory';

  -- Base entities
  INSERT INTO t_companies (name, short_name, tax_id, is_active) VALUES ('Kebab Test Factory', 'KTF', 'PL1234567890', true) RETURNING id INTO v_company_id;
  INSERT INTO t_facilities (company_id, name, type) VALUES (v_company_id, 'Zakład Produkcyjny', 'Plant') RETURNING id INTO v_facility_id;
  INSERT INTO t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active) VALUES (v_facility_id, 'Magazyn Chłodniczy', 'chiller', -2, 4, true) RETURNING id INTO v_storage_location_id;

  -- Products (correct schema: unit instead of base_unit_id, no is_active)
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Ćwiartka kurczaka klasy A', 'SU-KURCZAK-001', 'RawMeat', 'kg') RETURNING id INTO v_raw_chicken_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Mięso z kurczaka (po rozbiorze)', 'PP-MIESO-001', 'SemiFinished', 'kg') RETURNING id INTO v_semi_meat_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Masa kebabowa masowana', 'PP-MASA-001', 'SemiFinished', 'kg') RETURNING id INTO v_semi_masa_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Kebab Drobiowy 15kg', 'KEB-DRB-15', 'FinishedGood', 'kg') RETURNING id INTO v_finished_kebab_15_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Kości drobiowe', 'ODP-KOSCI-001', 'Waste', 'kg') RETURNING id INTO v_waste_bones_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Mix przypraw kebab', 'PRZ-MIX-001', 'Spice', 'kg') RETURNING id INTO v_spice_mix_id;

  -- Recipe - FIXED: Added ratio column
  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, is_active) VALUES (v_company_id, 'Masa kebabowa standard', v_semi_meat_id, v_semi_masa_id, 110, true) RETURNING id INTO v_recipe_id;
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, amount_per_kg_base, unit) VALUES (v_recipe_id, v_spice_mix_id, 0.015, 0.015, 'kg');

  -- Batches & Production flow
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id) VALUES (v_raw_chicken_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/001', 5000, 5000, 'available', NOW()::date, (NOW() + INTERVAL '7 days')::date, v_storage_location_id) RETURNING id INTO v_raw_batch_id;
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date) VALUES (v_company_id, v_facility_id, 'ROZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Decomposition', 'Closed', NOW()::date) RETURNING id INTO v_decomp_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_decomp_order_id, v_raw_batch_id, v_raw_chicken_id, 5000);
  UPDATE t_batches SET current_quantity = 0, status = 'depleted' WHERE id = v_raw_batch_id;
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id) VALUES (v_semi_meat_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/002', 3000, 3000, 'available', NOW()::date, (NOW() + INTERVAL '5 days')::date, v_storage_location_id) RETURNING id INTO v_meat_batch_id;
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id) VALUES (v_waste_bones_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/003', 1900, 1900, 'available', NOW()::date, (NOW() + INTERVAL '1 day')::date, v_storage_location_id) RETURNING id INTO v_bones_batch_id;
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, weight_gross, process_stage) VALUES (v_decomp_order_id, v_meat_batch_id, v_semi_meat_id, 3000, 3000, 'Decomposition');
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, weight_gross, process_stage) VALUES (v_decomp_order_id, v_bones_batch_id, v_waste_bones_id, 1900, 1900, 'Decomposition');

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, recipe_id) VALUES (v_company_id, v_facility_id, 'PRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Processing', 'Closed', NOW()::date, v_recipe_id) RETURNING id INTO v_processing_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_processing_order_id, v_meat_batch_id, v_semi_meat_id, 3000);
  UPDATE t_batches SET current_quantity = 0, status = 'depleted' WHERE id = v_meat_batch_id;
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id) VALUES (v_semi_masa_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/004', 3300, 3300, 'available', NOW()::date, (NOW() + INTERVAL '3 days')::date, v_storage_location_id) RETURNING id INTO v_masa_batch_id;
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, weight_gross, process_stage, recipe_id) VALUES (v_processing_order_id, v_masa_batch_id, v_semi_masa_id, 3300, 3300, 'Massaging', v_recipe_id);

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date) VALUES (v_company_id, v_facility_id, 'SKL/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Assembly', 'Closed', NOW()::date) RETURNING id INTO v_assembly_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_assembly_order_id, v_masa_batch_id, v_semi_masa_id, 3300);
  UPDATE t_batches SET current_quantity = 0, status = 'depleted' WHERE id = v_masa_batch_id;
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id) VALUES (v_finished_kebab_15_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/005', 3300, 3300, 'available', NOW()::date, (NOW() + INTERVAL '90 days')::date, v_storage_location_id) RETURNING id INTO v_kebab_batch_id;
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, weight_gross, process_stage) VALUES (v_assembly_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300, 3300, 'Stacking') RETURNING id INTO v_assembly_log_id;
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight) VALUES (v_assembly_log_id, 'Kebab 10kg', 10, 30, 300), (v_assembly_log_id, 'Kebab 15kg', 15, 100, 1500), (v_assembly_log_id, 'Kebab 20kg', 20, 75, 1500);

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date) VALUES (v_company_id, v_facility_id, 'MRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Freezing', 'Closed', NOW()::date) RETURNING id INTO v_freezing_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_freezing_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300);
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, weight_gross, process_stage, freezing_started_at, freezing_completed_at, freezing_duration_minutes) VALUES (v_freezing_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300, 3300, 'ShockFreezing', NOW() - INTERVAL '4 hours', NOW(), 240);

  FOR v_i IN 1..5 LOOP
    INSERT INTO t_handling_units (company_id, facility_id, sscc_number, type, status, total_net_weight, items_count, production_date, label_printed) VALUES (v_company_id, v_facility_id, '00590123456789' || LPAD(v_i::text, 5, '0'), 'Pallet', 'Ready', 660, 41, NOW()::date, true) RETURNING id INTO v_pallet_id;
    v_pallet_ids := array_append(v_pallet_ids, v_pallet_id);
  END LOOP;

  INSERT INTO t_shipments (company_id, facility_id, shipment_number, status, dispatch_date, driver_name, truck_plates, total_net_weight, pallets_count) VALUES (v_company_id, v_facility_id, 'WZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'shipped', NOW()::date, 'Jan Kowalski', 'WA 12345', 3300, 5) RETURNING id INTO v_shipment_id;
  FOR v_i IN 1..5 LOOP
    INSERT INTO t_shipment_items (shipment_id, handling_unit_id, batch_id, product_id, quantity) VALUES (v_shipment_id, v_pallet_ids[v_i], v_kebab_batch_id, v_finished_kebab_15_id, 660);
  END LOOP;

  v_result := jsonb_build_object('success', true, 'message', 'Golden Path zakończony pomyślnie',
    'summary', jsonb_build_object('total_input_kg', 5000, 'decomposition_yield_pct', 60, 'processing_yield_pct', 110, 'meat_kg', 3000, 'waste_kg', 1900, 'masa_kg', 3300, 'finished_kg', 3300),
    'products_by_category', jsonb_build_object('RawMeat', 1, 'SemiFinished', 2, 'FinishedGood', 1, 'Waste', 1, 'Spice', 1),
    'orders_by_type', jsonb_build_object('Decomposition', 1, 'Processing', 1, 'Assembly', 1, 'Freezing', 1),
    'recipe', jsonb_build_object('name', 'Masa kebabowa standard', 'base', 'SemiFinished', 'output', 'SemiFinished', 'yield', 110),
    'kebab_variants', jsonb_build_object('10kg', 30, '15kg', 100, '20kg', 75, 'total_sticks', 205),
    'traceability', jsonb_build_object('raw_batch', TO_CHAR(NOW(), 'YYMMDD') || '/KTF/001', 'kebab_batch', TO_CHAR(NOW(), 'YYMMDD') || '/KTF/005'),
    'logistics', jsonb_build_object('pallets', 5, 'shipment', 'WZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'status', 'Shipped'));
  RETURN v_result;
END;
$function$;