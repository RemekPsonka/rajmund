
-- Drop and recreate with CORRECT schema
DROP FUNCTION IF EXISTS public.simulate_full_production_day();

CREATE OR REPLACE FUNCTION public.simulate_full_production_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_facility_id uuid;
  v_storage_location_id uuid;
  
  -- Products
  v_raw_chicken_id uuid;
  v_semi_meat_id uuid;
  v_semi_masa_id uuid;
  v_finished_kebab_10_id uuid;
  v_finished_kebab_15_id uuid;
  v_finished_kebab_20_id uuid;
  v_waste_bones_id uuid;
  v_spice_mix_id uuid;
  v_additive_water_id uuid;
  v_additive_protein_id uuid;
  
  -- Recipe
  v_recipe_id uuid;
  
  -- Batches
  v_raw_batch_id uuid;
  v_meat_batch_id uuid;
  v_masa_batch_id uuid;
  v_kebab_batch_id uuid;
  v_bones_batch_id uuid;
  
  -- Orders
  v_decomp_order_id uuid;
  v_processing_order_id uuid;
  v_assembly_order_id uuid;
  v_freezing_order_id uuid;
  
  -- Logs
  v_decomp_log_id uuid;
  v_processing_log_id uuid;
  v_assembly_log_id uuid;
  v_freezing_log_id uuid;
  
  -- Handling units
  v_pallet_ids uuid[] := ARRAY[]::uuid[];
  v_pallet_id uuid;
  
  -- Shipment
  v_shipment_id uuid;
  
  -- Result
  v_result jsonb;
  
  -- UoM
  v_uom_kg_id uuid;
  
  -- Counters
  v_i integer;
BEGIN
  -- ============================================
  -- CLEANUP
  -- ============================================
  
  DELETE FROM t_shipment_items WHERE shipment_id IN (
    SELECT id FROM t_shipments WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  DELETE FROM t_shipments WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  DELETE FROM t_production_kebab_variants WHERE production_log_id IN (
    SELECT id FROM t_production_logs WHERE production_order_id IN (
      SELECT id FROM t_production_orders WHERE company_id IN (
        SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
      )
    )
  );
  
  DELETE FROM t_handling_units WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  DELETE FROM t_production_logs WHERE production_order_id IN (
    SELECT id FROM t_production_orders WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  DELETE FROM t_production_inputs WHERE production_order_id IN (
    SELECT id FROM t_production_orders WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  DELETE FROM t_production_tasks WHERE production_order_id IN (
    SELECT id FROM t_production_orders WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  DELETE FROM t_production_orders WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  DELETE FROM t_batches WHERE product_id IN (
    SELECT id FROM t_products WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  DELETE FROM t_recipe_ingredients WHERE recipe_id IN (
    SELECT id FROM t_recipes WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  DELETE FROM t_recipes WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  DELETE FROM t_products WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  DELETE FROM t_storage_locations WHERE facility_id IN (
    SELECT id FROM t_facilities WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  DELETE FROM t_facilities WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  DELETE FROM t_companies WHERE name = 'Kebab Test Factory';

  -- ============================================
  -- CREATE BASE ENTITIES (correct schema)
  -- ============================================
  
  SELECT id INTO v_uom_kg_id FROM t_units_of_measure WHERE symbol = 'kg' LIMIT 1;
  IF v_uom_kg_id IS NULL THEN
    INSERT INTO t_units_of_measure (name, symbol, type)
    VALUES ('Kilogram', 'kg', 'Weight')
    RETURNING id INTO v_uom_kg_id;
  END IF;
  
  -- t_companies: id, name, short_name, tax_id, is_active, main_address_json
  INSERT INTO t_companies (name, short_name, tax_id, is_active, main_address_json)
  VALUES (
    'Kebab Test Factory', 
    'KTF', 
    'PL1234567890', 
    true,
    '{"street": "ul. Testowa 1", "city": "Warszawa", "postal_code": "00-001", "country": "PL"}'::jsonb
  )
  RETURNING id INTO v_company_id;
  
  -- t_facilities: id, company_id, name, type (enum), vet_approval_number
  INSERT INTO t_facilities (company_id, name, type, vet_approval_number)
  VALUES (v_company_id, 'Zakład Produkcyjny Kebab', 'Production', 'PL12345678')
  RETURNING id INTO v_facility_id;
  
  -- t_storage_locations: id, facility_id, name, location_type, min_temp, max_temp
  INSERT INTO t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active)
  VALUES (v_facility_id, 'Magazyn Chłodniczy', 'chiller', -2, 4, true)
  RETURNING id INTO v_storage_location_id;

  -- ============================================
  -- CREATE PRODUCTS
  -- ============================================
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Ćwiartka kurczaka klasy A', 'SU-KURCZAK-001', 'RawMeat', v_uom_kg_id, true)
  RETURNING id INTO v_raw_chicken_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Mięso z kurczaka (po rozbiorze)', 'PP-MIESO-001', 'SemiFinished', v_uom_kg_id, true)
  RETURNING id INTO v_semi_meat_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Masa kebabowa masowana', 'PP-MASA-001', 'SemiFinished', v_uom_kg_id, true)
  RETURNING id INTO v_semi_masa_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kebab Drobiowy 10kg', 'KEB-DRB-10', 'FinishedGood', v_uom_kg_id, true)
  RETURNING id INTO v_finished_kebab_10_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kebab Drobiowy 15kg', 'KEB-DRB-15', 'FinishedGood', v_uom_kg_id, true)
  RETURNING id INTO v_finished_kebab_15_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kebab Drobiowy 20kg', 'KEB-DRB-20', 'FinishedGood', v_uom_kg_id, true)
  RETURNING id INTO v_finished_kebab_20_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kości drobiowe', 'ODP-KOSCI-001', 'Waste', v_uom_kg_id, true)
  RETURNING id INTO v_waste_bones_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Mix przypraw kebab', 'PRZ-MIX-001', 'Spice', v_uom_kg_id, true)
  RETURNING id INTO v_spice_mix_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Woda technologiczna', 'DOD-WODA-001', 'Additive', v_uom_kg_id, true)
  RETURNING id INTO v_additive_water_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Białko sojowe', 'DOD-BIALKO-001', 'Additive', v_uom_kg_id, true)
  RETURNING id INTO v_additive_protein_id;

  -- ============================================
  -- CREATE RECIPE
  -- ============================================
  
  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, evaporation_percent, description, is_active)
  VALUES (
    v_company_id, 
    'Masa kebabowa standard', 
    v_semi_meat_id,
    v_semi_masa_id,
    110,
    0,
    'Receptura masy kebabowej z mięsa drobiowego po rozbiorze',
    true
  )
  RETURNING id INTO v_recipe_id;
  
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, amount_per_kg_base, unit)
  VALUES 
    (v_recipe_id, v_spice_mix_id, 0.015, 'kg'),
    (v_recipe_id, v_additive_water_id, 0.080, 'kg'),
    (v_recipe_id, v_additive_protein_id, 0.005, 'kg');

  -- ============================================
  -- STAGE 1: RAW MATERIAL DELIVERY
  -- ============================================
  
  INSERT INTO t_batches (
    product_id, internal_batch_number, supplier_batch_number,
    current_quantity, initial_quantity, status, production_date, expiration_date,
    location_id
  )
  VALUES (
    v_raw_chicken_id, 
    TO_CHAR(NOW(), 'YYMMDD') || '/KTF/001',
    'SUP-2024-12345',
    5000, 5000, 'available', 
    (NOW() - INTERVAL '1 day')::date, 
    (NOW() + INTERVAL '7 days')::date,
    v_storage_location_id
  )
  RETURNING id INTO v_raw_batch_id;

  -- ============================================
  -- STAGE 2: DECOMPOSITION
  -- ============================================
  
  INSERT INTO t_production_orders (
    company_id, facility_id, order_number, type, status, production_date, notes
  )
  VALUES (
    v_company_id, v_facility_id, 'ROZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
    'Decomposition', 'Closed', NOW()::date, 'Rozbiór ćwiartek kurczaka - Golden Path'
  )
  RETURNING id INTO v_decomp_order_id;
  
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight, direction)
  VALUES (v_decomp_order_id, v_raw_batch_id, v_raw_chicken_id, 5000, 'input');
  
  UPDATE t_batches SET current_quantity = 0, status = 'depleted' WHERE id = v_raw_batch_id;
  
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id)
  VALUES (v_semi_meat_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/002', 3000, 3000, 'available', NOW()::date, (NOW() + INTERVAL '5 days')::date, v_storage_location_id)
  RETURNING id INTO v_meat_batch_id;
  
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id)
  VALUES (v_waste_bones_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/003', 1900, 1900, 'available', NOW()::date, (NOW() + INTERVAL '1 day')::date, v_storage_location_id)
  RETURNING id INTO v_bones_batch_id;
  
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, process_stage, created_at)
  VALUES (v_decomp_order_id, v_meat_batch_id, v_semi_meat_id, 3000, 'Decomposition', NOW())
  RETURNING id INTO v_decomp_log_id;
  
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, process_stage, created_at)
  VALUES (v_decomp_order_id, v_bones_batch_id, v_waste_bones_id, 1900, 'Decomposition', NOW());

  -- ============================================
  -- STAGE 3: PROCESSING
  -- ============================================
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, recipe_id, notes)
  VALUES (v_company_id, v_facility_id, 'PRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Processing', 'Closed', NOW()::date, v_recipe_id, 'Masowanie mięsa - Golden Path')
  RETURNING id INTO v_processing_order_id;
  
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight, direction)
  VALUES (v_processing_order_id, v_meat_batch_id, v_semi_meat_id, 3000, 'input');
  
  UPDATE t_batches SET current_quantity = 0, status = 'depleted' WHERE id = v_meat_batch_id;
  
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id)
  VALUES (v_semi_masa_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/004', 3300, 3300, 'available', NOW()::date, (NOW() + INTERVAL '3 days')::date, v_storage_location_id)
  RETURNING id INTO v_masa_batch_id;
  
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, process_stage, created_at, recipe_id, expected_weight, deviation_kg, deviation_percent)
  VALUES (v_processing_order_id, v_masa_batch_id, v_semi_masa_id, 3300, 'Massaging', NOW(), v_recipe_id, 3300, 0, 0)
  RETURNING id INTO v_processing_log_id;

  -- ============================================
  -- STAGE 4: ASSEMBLY
  -- ============================================
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, notes)
  VALUES (v_company_id, v_facility_id, 'SKL/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Assembly', 'Closed', NOW()::date, 'Składanie słupków - Golden Path')
  RETURNING id INTO v_assembly_order_id;
  
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight, direction)
  VALUES (v_assembly_order_id, v_masa_batch_id, v_semi_masa_id, 3300, 'input');
  
  UPDATE t_batches SET current_quantity = 0, status = 'depleted' WHERE id = v_masa_batch_id;
  
  INSERT INTO t_batches (product_id, internal_batch_number, current_quantity, initial_quantity, status, production_date, expiration_date, location_id)
  VALUES (v_finished_kebab_15_id, TO_CHAR(NOW(), 'YYMMDD') || '/KTF/005', 3300, 3300, 'available', NOW()::date, (NOW() + INTERVAL '90 days')::date, v_storage_location_id)
  RETURNING id INTO v_kebab_batch_id;
  
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, process_stage, created_at)
  VALUES (v_assembly_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300, 'Stacking', NOW())
  RETURNING id INTO v_assembly_log_id;
  
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight)
  VALUES 
    (v_assembly_log_id, 'Kebab 10kg', 10, 30, 300),
    (v_assembly_log_id, 'Kebab 15kg', 15, 100, 1500),
    (v_assembly_log_id, 'Kebab 20kg', 20, 75, 1500);

  -- ============================================
  -- STAGE 5: SHOCK FREEZING
  -- ============================================
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, notes)
  VALUES (v_company_id, v_facility_id, 'MRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'Freezing', 'Closed', NOW()::date, 'Mrożenie szokowe - Golden Path')
  RETURNING id INTO v_freezing_order_id;
  
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight, direction)
  VALUES (v_freezing_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300, 'input');
  
  INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, weight_net, process_stage, created_at, freezing_started_at, freezing_completed_at, freezing_duration_minutes)
  VALUES (v_freezing_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300, 'ShockFreezing', NOW(), NOW() - INTERVAL '4 hours', NOW(), 240)
  RETURNING id INTO v_freezing_log_id;

  -- ============================================
  -- STAGE 6: PALLETIZATION
  -- ============================================
  
  FOR v_i IN 1..5 LOOP
    INSERT INTO t_handling_units (company_id, facility_id, sscc_number, type, status, total_net_weight, items_count, production_date, label_printed, created_at)
    VALUES (v_company_id, v_facility_id, '00590123456789' || LPAD(v_i::text, 5, '0'), 'Pallet', 'Ready', 660, 41, NOW()::date, true, NOW())
    RETURNING id INTO v_pallet_id;
    v_pallet_ids := array_append(v_pallet_ids, v_pallet_id);
  END LOOP;

  -- ============================================
  -- STAGE 7: SHIPMENT
  -- ============================================
  
  INSERT INTO t_shipments (company_id, facility_id, shipment_number, status, dispatch_date, driver_name, truck_plates, total_net_weight, pallets_count)
  VALUES (v_company_id, v_facility_id, 'WZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001', 'shipped', NOW()::date, 'Jan Kowalski', 'WA 12345', 3300, 5)
  RETURNING id INTO v_shipment_id;
  
  FOR v_i IN 1..5 LOOP
    INSERT INTO t_shipment_items (shipment_id, handling_unit_id, batch_id, product_id, quantity)
    VALUES (v_shipment_id, v_pallet_ids[v_i], v_kebab_batch_id, v_finished_kebab_15_id, 660);
  END LOOP;

  -- ============================================
  -- RESULT
  -- ============================================
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Symulacja Golden Path zakończona pomyślnie',
    'test_date', NOW(),
    'summary', jsonb_build_object(
      'total_input_kg', 5000,
      'decomposition_yield_pct', 60,
      'processing_yield_pct', 110,
      'meat_produced_kg', 3000,
      'waste_kg', 1900,
      'masa_produced_kg', 3300,
      'finished_goods_kg', 3300,
      'overall_yield_pct', 66
    ),
    'products_by_category', jsonb_build_object(
      'RawMeat', 1,
      'SemiFinished', 2,
      'FinishedGood', 3,
      'Waste', 1,
      'Spice', 1,
      'Additive', 2,
      'total', 10
    ),
    'orders_by_type', jsonb_build_object(
      'Decomposition', 1,
      'Processing', 1,
      'Assembly', 1,
      'Freezing', 1,
      'total', 4
    ),
    'recipe', jsonb_build_object(
      'id', v_recipe_id,
      'name', 'Masa kebabowa standard',
      'base_product', 'Mięso z kurczaka (SemiFinished)',
      'output_product', 'Masa kebabowa masowana (SemiFinished)',
      'yield_percent', 110,
      'ingredients_count', 3
    ),
    'kebab_variants', jsonb_build_object(
      'Kebab_10kg', jsonb_build_object('quantity', 30, 'total_kg', 300),
      'Kebab_15kg', jsonb_build_object('quantity', 100, 'total_kg', 1500),
      'Kebab_20kg', jsonb_build_object('quantity', 75, 'total_kg', 1500),
      'total_sticks', 205,
      'total_kg', 3300
    ),
    'traceability', jsonb_build_object(
      'raw_batch_id', v_raw_batch_id,
      'meat_batch_id', v_meat_batch_id,
      'masa_batch_id', v_masa_batch_id,
      'kebab_batch_id', v_kebab_batch_id,
      'bones_batch_id', v_bones_batch_id,
      'raw_batch_number', TO_CHAR(NOW(), 'YYMMDD') || '/KTF/001',
      'kebab_batch_number', TO_CHAR(NOW(), 'YYMMDD') || '/KTF/005'
    ),
    'logistics', jsonb_build_object(
      'pallets_created', 5,
      'shipment_id', v_shipment_id,
      'shipment_number', 'WZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
      'shipment_status', 'Shipped'
    )
  );
  
  RETURN v_result;
END;
$function$;
