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
  DELETE FROM t_shipment_items WHERE shipment_id IN (SELECT id FROM t_shipments WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_shipments WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_production_kebab_variants WHERE production_log_id IN (SELECT id FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory')));
  DELETE FROM t_handling_units WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_production_inputs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_production_tasks WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_lot_lineage WHERE child_lot_id IN (SELECT b.id FROM t_batches b JOIN t_products p ON p.id=b.product_id WHERE p.company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_batches WHERE product_id IN (SELECT id FROM t_products WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_recipe_ingredients WHERE recipe_id IN (SELECT id FROM t_recipes WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_recipes WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_products WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_storage_locations WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'));
  DELETE FROM t_facilities WHERE company_id IN (SELECT id FROM t_companies WHERE name = 'Kebab Test Factory');
  DELETE FROM t_companies WHERE name = 'Kebab Test Factory';

  INSERT INTO t_companies (name, short_name, tax_id, is_active) VALUES ('Kebab Test Factory', 'KTF', 'PL1234567890', true) RETURNING id INTO v_company_id;
  INSERT INTO t_facilities (company_id, name, type) VALUES (v_company_id, 'Zakład Produkcyjny', 'Plant') RETURNING id INTO v_facility_id;
  INSERT INTO t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active) VALUES (v_facility_id, 'Magazyn Chłodniczy', 'chiller', -2, 4, true) RETURNING id INTO v_storage_location_id;

  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Ćwiartka kurczaka klasy A', 'SU-KURCZAK-001', 'RawMeat', 'kg') RETURNING id INTO v_raw_chicken_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Mięso z kurczaka (po rozbiorze)', 'PP-MIESO-001', 'SemiFinished', 'kg') RETURNING id INTO v_semi_meat_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Masa kebabowa masowana', 'PP-MASA-001', 'SemiFinished', 'kg') RETURNING id INTO v_semi_masa_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit, unit_target_weight_kg) VALUES (v_company_id, 'Kebab Drobiowy 15kg', 'KEB-DRB-15', 'FinishedGood', 'kg', 15) RETURNING id INTO v_finished_kebab_15_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Kości drobiowe', 'ODP-KOSCI-001', 'Waste', 'kg') RETURNING id INTO v_waste_bones_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id, 'Mix przypraw kebab', 'PRZ-MIX-001', 'Spice', 'kg') RETURNING id INTO v_spice_mix_id;

  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, is_active) VALUES (v_company_id, 'Receptura Masa Kebabowa', v_semi_meat_id, v_semi_masa_id, 110, true) RETURNING id INTO v_recipe_id;
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, amount_per_kg_base, unit) VALUES (v_recipe_id, v_spice_mix_id, 0.1, 0.1, 'kg');

  INSERT INTO t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id) VALUES (v_raw_chicken_id, 'BATCH-RAW-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 5000, 5000, NOW()::date, (NOW() + INTERVAL '14 days')::date, 'Released', v_storage_location_id) RETURNING id INTO v_raw_batch_id;

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date) VALUES (v_company_id, v_facility_id, 'ZP-DEC-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 'Decomposition', 'Closed', NOW()::date) RETURNING id INTO v_decomp_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_decomp_order_id, v_raw_batch_id, v_raw_chicken_id, 5000);
  UPDATE t_batches SET current_quantity = 0, status = 'Blocked' WHERE id = v_raw_batch_id;

  INSERT INTO t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id) VALUES (v_semi_meat_id, 'BATCH-MEAT-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 3000, 3000, NOW()::date, (NOW() + INTERVAL '7 days')::date, 'Released', v_storage_location_id) RETURNING id INTO v_meat_batch_id;
  INSERT INTO t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id) VALUES (v_waste_bones_id, 'BATCH-WASTE-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 1900, 1900, NOW()::date, (NOW() + INTERVAL '3 days')::date, 'Released', v_storage_location_id) RETURNING id INTO v_bones_batch_id;

  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_gross, weight_tare, process_stage) VALUES (v_decomp_order_id, v_meat_batch_id, v_semi_meat_id, 3000, 0, 'Rozbiór');
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_gross, weight_tare, process_stage) VALUES (v_decomp_order_id, v_bones_batch_id, v_waste_bones_id, 1900, 0, 'Rozbiór-Odpady');

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, recipe_id) VALUES (v_company_id, v_facility_id, 'ZP-TUM-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 'Processing', 'Closed', NOW()::date, v_recipe_id) RETURNING id INTO v_processing_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_processing_order_id, v_meat_batch_id, v_semi_meat_id, 3000);
  UPDATE t_batches SET current_quantity = 0, status = 'Blocked' WHERE id = v_meat_batch_id;

  INSERT INTO t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id) VALUES (v_semi_masa_id, 'BATCH-MASA-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 3300, 3300, NOW()::date, (NOW() + INTERVAL '5 days')::date, 'Released', v_storage_location_id) RETURNING id INTO v_masa_batch_id;
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_gross, weight_tare, process_stage, recipe_id) VALUES (v_processing_order_id, v_masa_batch_id, v_semi_masa_id, 3300, 0, 'Masowanie', v_recipe_id);

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date) VALUES (v_company_id, v_facility_id, 'ZP-ASM-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 'Assembly', 'Closed', NOW()::date) RETURNING id INTO v_assembly_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_assembly_order_id, v_masa_batch_id, v_semi_masa_id, 3300);
  UPDATE t_batches SET current_quantity = 0, status = 'Blocked' WHERE id = v_masa_batch_id;

  INSERT INTO t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id) VALUES (v_finished_kebab_15_id, 'BATCH-KEB-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 3300, 3300, NOW()::date, (NOW() + INTERVAL '90 days')::date, 'Released', v_storage_location_id) RETURNING id INTO v_kebab_batch_id;
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_gross, weight_tare, process_stage, packaging_count, packaging_type) VALUES (v_assembly_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3400, 100, 'Składanie', 220, 'Słupek 15kg') RETURNING id INTO v_assembly_log_id;
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight) VALUES (v_assembly_log_id, '15kg Standard', 15, 205, 3075), (v_assembly_log_id, '10kg Mały', 10, 5, 50), (v_assembly_log_id, '30kg Duży', 30, 5, 150);

  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date) VALUES (v_company_id, v_facility_id, 'ZP-FRZ-' || TO_CHAR(NOW(), 'YYMMDD') || '-001', 'Freezing', 'Closed', NOW()::date) RETURNING id INTO v_freezing_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight) VALUES (v_freezing_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300);
  INSERT INTO t_production_logs (production_order_id, source_batch_id, output_batch_id, product_id, weight_gross, weight_tare, process_stage, freezing_started_at, freezing_completed_at, freezing_duration_minutes) VALUES (v_freezing_order_id, v_kebab_batch_id, v_kebab_batch_id, v_finished_kebab_15_id, 3400, 100, 'Mrożenie szokowe', NOW() - INTERVAL '4 hours', NOW(), 240);

  FOR v_i IN 1..5 LOOP
    INSERT INTO t_handling_units (company_id, facility_id, sscc_number, type, status, total_net_weight, items_count, production_date, label_printed) VALUES (v_company_id, v_facility_id, '0059' || LPAD(v_i::text, 16, '0'), 'Pallet', 'Ready', 660, 44, NOW()::date, true) RETURNING id INTO v_pallet_id;
    v_pallet_ids := v_pallet_ids || v_pallet_id;
  END LOOP;

  INSERT INTO t_shipments (company_id, facility_id, shipment_number, status, dispatch_date, driver_name, truck_plates, total_net_weight, pallets_count) VALUES (v_company_id, v_facility_id, 'WZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Shipped', NOW()::date, 'Jan Kowalski', 'WA 12345', 3300, 5) RETURNING id INTO v_shipment_id;

  FOREACH v_pallet_id IN ARRAY v_pallet_ids LOOP
    INSERT INTO t_shipment_items (shipment_id, handling_unit_id, batch_id, product_id, quantity) VALUES (v_shipment_id, v_pallet_id, v_kebab_batch_id, v_finished_kebab_15_id, 44);
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'facility_id', v_facility_id,
    'raw_batch_id', v_raw_batch_id, 'raw_quantity_kg', 5000,
    'meat_batch_id', v_meat_batch_id, 'meat_quantity_kg', 3000,
    'masa_batch_id', v_masa_batch_id, 'masa_quantity_kg', 3300,
    'kebab_batch_id', v_kebab_batch_id, 'kebab_sticks_count', 215,
    'pallets_created', 5, 'pallet_ids', v_pallet_ids,
    'shipment_id', v_shipment_id, 'shipment_status', 'Shipped'
  );
  RETURN v_result;
END;
$function$;