-- Drop and recreate the function with fixed cleanup order
DROP FUNCTION IF EXISTS simulate_full_production_day();

CREATE OR REPLACE FUNCTION simulate_full_production_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_waste_skin_id uuid;
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
  -- CLEANUP - CORRECT ORDER (children first!)
  -- ============================================
  
  -- 1. First delete shipment items (references shipments and handling_units)
  DELETE FROM t_shipment_items WHERE shipment_id IN (
    SELECT id FROM t_shipments WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  -- 2. Delete shipments
  DELETE FROM t_shipments WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  -- 3. Delete kebab variants (references production_logs)
  DELETE FROM t_production_kebab_variants WHERE production_log_id IN (
    SELECT id FROM t_production_logs WHERE order_id IN (
      SELECT id FROM t_production_orders WHERE company_id IN (
        SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
      )
    )
  );
  
  -- 4. Delete handling units (references batches)
  DELETE FROM t_handling_units WHERE batch_id IN (
    SELECT id FROM t_batches WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  -- 5. Delete production logs (references orders and batches)
  DELETE FROM t_production_logs WHERE order_id IN (
    SELECT id FROM t_production_orders WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  -- 6. Delete production inputs (references orders and batches)
  DELETE FROM t_production_inputs WHERE order_id IN (
    SELECT id FROM t_production_orders WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  -- 7. Delete production tasks (references orders)
  DELETE FROM t_production_tasks WHERE order_id IN (
    SELECT id FROM t_production_orders WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  -- 8. Delete production orders
  DELETE FROM t_production_orders WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  -- 9. Delete batches (after all references removed)
  DELETE FROM t_batches WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  -- 10. Delete recipe ingredients (references recipes and products)
  DELETE FROM t_recipe_ingredients WHERE recipe_id IN (
    SELECT id FROM t_recipes WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  -- 11. Delete recipes
  DELETE FROM t_recipes WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  -- 12. Delete products
  DELETE FROM t_products WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  -- 13. Delete storage locations (references facilities)
  DELETE FROM t_storage_locations WHERE facility_id IN (
    SELECT id FROM t_facilities WHERE company_id IN (
      SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
    )
  );
  
  -- 14. Delete facilities
  DELETE FROM t_facilities WHERE company_id IN (
    SELECT id FROM t_companies WHERE name = 'Kebab Test Factory'
  );
  
  -- 15. Finally delete the company
  DELETE FROM t_companies WHERE name = 'Kebab Test Factory';

  -- ============================================
  -- CREATE BASE ENTITIES
  -- ============================================
  
  -- Get or create UoM
  SELECT id INTO v_uom_kg_id FROM t_units_of_measure WHERE symbol = 'kg' LIMIT 1;
  IF v_uom_kg_id IS NULL THEN
    INSERT INTO t_units_of_measure (name, symbol, type)
    VALUES ('Kilogram', 'kg', 'Weight')
    RETURNING id INTO v_uom_kg_id;
  END IF;
  
  -- Create company
  INSERT INTO t_companies (name, type, tax_id, address, city, postal_code, country)
  VALUES ('Kebab Test Factory', 'Internal', 'PL1234567890', 'ul. Testowa 1', 'Warszawa', '00-001', 'PL')
  RETURNING id INTO v_company_id;
  
  -- Create facility
  INSERT INTO t_facilities (company_id, name, type, address, city, postal_code, country)
  VALUES (v_company_id, 'Zakład Produkcyjny Kebab', 'Production', 'ul. Produkcyjna 10', 'Warszawa', '00-002', 'PL')
  RETURNING id INTO v_facility_id;
  
  -- Create storage location
  INSERT INTO t_storage_locations (facility_id, name, type, temperature_min, temperature_max)
  VALUES (v_facility_id, 'Magazyn Chłodniczy', 'Cold Storage', -2, 4)
  RETURNING id INTO v_storage_location_id;

  -- ============================================
  -- CREATE PRODUCTS WITH PROPER CATEGORIES
  -- ============================================
  
  -- RawMeat: Ćwiartka kurczaka
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Ćwiartka kurczaka klasy A', 'SU-KURCZAK-001', 'RawMeat', v_uom_kg_id, true)
  RETURNING id INTO v_raw_chicken_id;
  
  -- SemiFinished: Mięso z kurczaka (po rozbiorze)
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Mięso z kurczaka (po rozbiorze)', 'PP-MIESO-001', 'SemiFinished', v_uom_kg_id, true)
  RETURNING id INTO v_semi_meat_id;
  
  -- SemiFinished: Masa kebabowa masowana
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Masa kebabowa masowana', 'PP-MASA-001', 'SemiFinished', v_uom_kg_id, true)
  RETURNING id INTO v_semi_masa_id;
  
  -- FinishedGood: Kebab variants
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kebab Drobiowy 10kg', 'KEB-DRB-10', 'FinishedGood', v_uom_kg_id, true)
  RETURNING id INTO v_finished_kebab_10_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kebab Drobiowy 15kg', 'KEB-DRB-15', 'FinishedGood', v_uom_kg_id, true)
  RETURNING id INTO v_finished_kebab_15_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kebab Drobiowy 20kg', 'KEB-DRB-20', 'FinishedGood', v_uom_kg_id, true)
  RETURNING id INTO v_finished_kebab_20_id;
  
  -- Waste
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Kości drobiowe', 'ODP-KOSCI-001', 'Waste', v_uom_kg_id, true)
  RETURNING id INTO v_waste_bones_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Skóra drobiowa', 'ODP-SKORA-001', 'Waste', v_uom_kg_id, true)
  RETURNING id INTO v_waste_skin_id;
  
  -- Spice
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Mix przypraw kebab', 'PRZ-MIX-001', 'Spice', v_uom_kg_id, true)
  RETURNING id INTO v_spice_mix_id;
  
  -- Additives
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Woda technologiczna', 'DOD-WODA-001', 'Additive', v_uom_kg_id, true)
  RETURNING id INTO v_additive_water_id;
  
  INSERT INTO t_products (company_id, name, sku, industry_category, base_unit_id, is_active)
  VALUES (v_company_id, 'Białko sojowe', 'DOD-BIALKO-001', 'Additive', v_uom_kg_id, true)
  RETURNING id INTO v_additive_protein_id;

  -- ============================================
  -- CREATE RECIPE WITH SEMIFINISHED BASE
  -- ============================================
  
  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, evaporation_percent, description, is_active)
  VALUES (
    v_company_id, 
    'Masa kebabowa standard', 
    v_semi_meat_id,  -- BASE = SemiFinished (Mięso z kurczaka)
    v_semi_masa_id,  -- OUTPUT = SemiFinished (Masa kebabowa)
    110,             -- 110% yield (added water + ingredients)
    0,               -- No evaporation
    'Receptura masy kebabowej z mięsa drobiowego po rozbiorze',
    true
  )
  RETURNING id INTO v_recipe_id;
  
  -- Recipe ingredients (per kg of base)
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, amount_per_kg_base, unit)
  VALUES 
    (v_recipe_id, v_spice_mix_id, 0.015, 'kg'),      -- 15g przypraw / kg mięsa
    (v_recipe_id, v_additive_water_id, 0.080, 'kg'), -- 80g wody / kg mięsa
    (v_recipe_id, v_additive_protein_id, 0.005, 'kg'); -- 5g białka / kg mięsa

  -- ============================================
  -- STAGE 1: RAW MATERIAL DELIVERY (PZ)
  -- ============================================
  
  INSERT INTO t_batches (
    company_id, product_id, internal_batch_number, supplier_batch_number,
    quantity, initial_quantity, status, production_date, expiry_date,
    storage_location_id, document_type
  )
  VALUES (
    v_company_id, v_raw_chicken_id, 
    TO_CHAR(NOW(), 'YYMMDD') || '/KTF/001',
    'SUP-2024-12345',
    5000, 5000, 'Available', 
    NOW() - INTERVAL '1 day', 
    NOW() + INTERVAL '7 days',
    v_storage_location_id, 'PZ'
  )
  RETURNING id INTO v_raw_batch_id;

  -- ============================================
  -- STAGE 2: DECOMPOSITION (RawMeat -> SemiFinished + Waste)
  -- ============================================
  
  -- Create decomposition order
  INSERT INTO t_production_orders (
    company_id, order_number, type, status, planned_date, 
    recipe_id, planned_quantity, notes
  )
  VALUES (
    v_company_id, 'ROZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
    'Decomposition', 'Closed', NOW(),
    NULL, 5000, 'Rozbiór ćwiartek kurczaka - test Golden Path'
  )
  RETURNING id INTO v_decomp_order_id;
  
  -- Input: 5000kg raw chicken
  INSERT INTO t_production_inputs (order_id, batch_id, quantity, notes)
  VALUES (v_decomp_order_id, v_raw_batch_id, 5000, 'Pełna partia surowca');
  
  -- Update raw batch (consumed)
  UPDATE t_batches SET quantity = 0, status = 'Depleted' WHERE id = v_raw_batch_id;
  
  -- Output batch: 3000kg meat (60% yield)
  INSERT INTO t_batches (
    company_id, product_id, internal_batch_number,
    quantity, initial_quantity, status, production_date, expiry_date,
    storage_location_id, document_type, source_order_id
  )
  VALUES (
    v_company_id, v_semi_meat_id,
    TO_CHAR(NOW(), 'YYMMDD') || '/KTF/002',
    3000, 3000, 'Available',
    NOW(), NOW() + INTERVAL '5 days',
    v_storage_location_id, 'PW', v_decomp_order_id
  )
  RETURNING id INTO v_meat_batch_id;
  
  -- Output batch: 1900kg bones (waste)
  INSERT INTO t_batches (
    company_id, product_id, internal_batch_number,
    quantity, initial_quantity, status, production_date, expiry_date,
    storage_location_id, document_type, source_order_id
  )
  VALUES (
    v_company_id, v_waste_bones_id,
    TO_CHAR(NOW(), 'YYMMDD') || '/KTF/003',
    1900, 1900, 'Available',
    NOW(), NOW() + INTERVAL '1 day',
    v_storage_location_id, 'PW', v_decomp_order_id
  )
  RETURNING id INTO v_bones_batch_id;
  
  -- Production log for decomposition
  INSERT INTO t_production_logs (
    order_id, batch_id, product_id, quantity, 
    log_type, process_stage, notes, logged_at
  )
  VALUES (
    v_decomp_order_id, v_meat_batch_id, v_semi_meat_id, 3000,
    'Output', 'Decomposition', 'Mięso z kurczaka - uzysk 60%', NOW()
  )
  RETURNING id INTO v_decomp_log_id;
  
  -- Waste log
  INSERT INTO t_production_logs (
    order_id, batch_id, product_id, quantity, 
    log_type, process_stage, notes, logged_at
  )
  VALUES (
    v_decomp_order_id, v_bones_batch_id, v_waste_bones_id, 1900,
    'Waste', 'Decomposition', 'Kości + skóra - odpady', NOW()
  );

  -- ============================================
  -- STAGE 3: PROCESSING/MASSIFYING (SemiFinished + Recipe -> SemiFinished Masa)
  -- ============================================
  
  -- Create processing order
  INSERT INTO t_production_orders (
    company_id, order_number, type, status, planned_date,
    recipe_id, planned_quantity, notes
  )
  VALUES (
    v_company_id, 'PRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
    'Processing', 'Closed', NOW(),
    v_recipe_id, 3000, 'Masowanie mięsa z recepturą - test Golden Path'
  )
  RETURNING id INTO v_processing_order_id;
  
  -- Input: 3000kg meat
  INSERT INTO t_production_inputs (order_id, batch_id, quantity, notes)
  VALUES (v_processing_order_id, v_meat_batch_id, 3000, 'Mięso z rozbioru');
  
  -- Update meat batch (consumed)
  UPDATE t_batches SET quantity = 0, status = 'Depleted' WHERE id = v_meat_batch_id;
  
  -- Output batch: 3300kg masa (110% yield with ingredients)
  INSERT INTO t_batches (
    company_id, product_id, internal_batch_number,
    quantity, initial_quantity, status, production_date, expiry_date,
    storage_location_id, document_type, source_order_id
  )
  VALUES (
    v_company_id, v_semi_masa_id,
    TO_CHAR(NOW(), 'YYMMDD') || '/KTF/004',
    3300, 3300, 'Available',
    NOW(), NOW() + INTERVAL '3 days',
    v_storage_location_id, 'PW', v_processing_order_id
  )
  RETURNING id INTO v_masa_batch_id;
  
  -- Production log for processing
  INSERT INTO t_production_logs (
    order_id, batch_id, product_id, quantity,
    log_type, process_stage, notes, logged_at,
    theoretical_weight, deviation_kg, deviation_percent
  )
  VALUES (
    v_processing_order_id, v_masa_batch_id, v_semi_masa_id, 3300,
    'Output', 'Massifying', 'Masa kebabowa - uzysk 110%', NOW(),
    3300, 0, 0
  )
  RETURNING id INTO v_processing_log_id;

  -- ============================================
  -- STAGE 4: ASSEMBLY (Masa -> Kebab sticks 10/15/20kg)
  -- ============================================
  
  -- Create assembly order
  INSERT INTO t_production_orders (
    company_id, order_number, type, status, planned_date,
    recipe_id, planned_quantity, notes
  )
  VALUES (
    v_company_id, 'SKL/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
    'Assembly', 'Closed', NOW(),
    NULL, 3300, 'Składanie słupków kebab - test Golden Path'
  )
  RETURNING id INTO v_assembly_order_id;
  
  -- Input: 3300kg masa
  INSERT INTO t_production_inputs (order_id, batch_id, quantity, notes)
  VALUES (v_assembly_order_id, v_masa_batch_id, 3300, 'Masa kebabowa do składania');
  
  -- Update masa batch (consumed)
  UPDATE t_batches SET quantity = 0, status = 'Depleted' WHERE id = v_masa_batch_id;
  
  -- Output batch: Kebab sticks
  INSERT INTO t_batches (
    company_id, product_id, internal_batch_number,
    quantity, initial_quantity, status, production_date, expiry_date,
    storage_location_id, document_type, source_order_id
  )
  VALUES (
    v_company_id, v_finished_kebab_15_id,
    TO_CHAR(NOW(), 'YYMMDD') || '/KTF/005',
    3300, 3300, 'Available',
    NOW(), NOW() + INTERVAL '90 days',
    v_storage_location_id, 'PW', v_assembly_order_id
  )
  RETURNING id INTO v_kebab_batch_id;
  
  -- Production log for assembly
  INSERT INTO t_production_logs (
    order_id, batch_id, product_id, quantity,
    log_type, process_stage, notes, logged_at
  )
  VALUES (
    v_assembly_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 3300,
    'Output', 'Stacking', 'Słupki kebab złożone', NOW()
  )
  RETURNING id INTO v_assembly_log_id;
  
  -- Insert kebab variants (10kg: 30 szt, 15kg: 100 szt, 20kg: 75 szt = 3300kg)
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight)
  VALUES 
    (v_assembly_log_id, 'Kebab 10kg', 10, 30, 300),
    (v_assembly_log_id, 'Kebab 15kg', 15, 100, 1500),
    (v_assembly_log_id, 'Kebab 20kg', 20, 75, 1500);

  -- ============================================
  -- STAGE 5: SHOCK FREEZING
  -- ============================================
  
  -- Create freezing order
  INSERT INTO t_production_orders (
    company_id, order_number, type, status, planned_date,
    recipe_id, planned_quantity, notes
  )
  VALUES (
    v_company_id, 'MRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
    'Freezing', 'Closed', NOW(),
    NULL, 205, 'Mrożenie szokowe 205 słupków - test Golden Path'
  )
  RETURNING id INTO v_freezing_order_id;
  
  -- Input: kebab batch
  INSERT INTO t_production_inputs (order_id, batch_id, quantity, notes)
  VALUES (v_freezing_order_id, v_kebab_batch_id, 205, '205 słupków do mrożenia');
  
  -- Production log for freezing (with timing)
  INSERT INTO t_production_logs (
    order_id, batch_id, product_id, quantity,
    log_type, process_stage, notes, logged_at,
    freezing_started_at, freezing_completed_at
  )
  VALUES (
    v_freezing_order_id, v_kebab_batch_id, v_finished_kebab_15_id, 205,
    'Output', 'ShockFreezing', 'Mrożenie szokowe zakończone (-35°C, 4h)', NOW(),
    NOW() - INTERVAL '4 hours', NOW()
  )
  RETURNING id INTO v_freezing_log_id;

  -- ============================================
  -- STAGE 6: PALLETIZATION (5 pallets SSCC)
  -- ============================================
  
  FOR v_i IN 1..5 LOOP
    INSERT INTO t_handling_units (
      sscc, unit_type, batch_id, quantity, 
      status, created_at
    )
    VALUES (
      '00590123456789' || LPAD(v_i::text, 5, '0'),
      'Pallet', v_kebab_batch_id, 
      CASE WHEN v_i <= 4 THEN 41 ELSE 41 END, -- ~41 sticks per pallet
      'Ready', NOW()
    )
    RETURNING id INTO v_pallet_id;
    
    v_pallet_ids := array_append(v_pallet_ids, v_pallet_id);
  END LOOP;

  -- ============================================
  -- STAGE 7: SHIPMENT (WZ)
  -- ============================================
  
  -- Create shipment
  INSERT INTO t_shipments (
    company_id, shipment_number, type, status,
    planned_date, carrier_name, vehicle_plate, notes
  )
  VALUES (
    v_company_id, 'WZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
    'Outbound', 'Shipped',
    NOW(), 'Trans-Kebab Sp. z o.o.', 'WA 12345', 
    'Wysyłka testowa Golden Path - 5 palet kebab'
  )
  RETURNING id INTO v_shipment_id;
  
  -- Add pallets to shipment
  FOR v_i IN 1..5 LOOP
    INSERT INTO t_shipment_items (shipment_id, handling_unit_id, quantity)
    VALUES (v_shipment_id, v_pallet_ids[v_i], 41);
  END LOOP;

  -- ============================================
  -- BUILD RESULT JSON
  -- ============================================
  
  v_result := jsonb_build_object(
    'success', true,
    'test_date', NOW(),
    'company', jsonb_build_object(
      'id', v_company_id,
      'name', 'Kebab Test Factory'
    ),
    'products_created', jsonb_build_object(
      'RawMeat', 1,
      'SemiFinished', 2,
      'FinishedGood', 3,
      'Waste', 2,
      'Spice', 1,
      'Additive', 2,
      'total', 11
    ),
    'recipe', jsonb_build_object(
      'id', v_recipe_id,
      'name', 'Masa kebabowa standard',
      'base_product', 'Mięso z kurczaka (SemiFinished)',
      'output_product', 'Masa kebabowa masowana (SemiFinished)',
      'yield_percent', 110,
      'ingredients_count', 3
    ),
    'production_flow', jsonb_build_object(
      'stage_1_decomposition', jsonb_build_object(
        'order_id', v_decomp_order_id,
        'order_number', 'ROZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
        'input_kg', 5000,
        'output_meat_kg', 3000,
        'output_waste_kg', 1900,
        'yield_percent', 60
      ),
      'stage_2_processing', jsonb_build_object(
        'order_id', v_processing_order_id,
        'order_number', 'PRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
        'input_kg', 3000,
        'output_kg', 3300,
        'yield_percent', 110,
        'recipe_used', 'Masa kebabowa standard'
      ),
      'stage_3_assembly', jsonb_build_object(
        'order_id', v_assembly_order_id,
        'order_number', 'SKL/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
        'input_kg', 3300,
        'kebab_variants', jsonb_build_object(
          '10kg', jsonb_build_object('quantity', 30, 'total_kg', 300),
          '15kg', jsonb_build_object('quantity', 100, 'total_kg', 1500),
          '20kg', jsonb_build_object('quantity', 75, 'total_kg', 1500)
        ),
        'total_sticks', 205
      ),
      'stage_4_freezing', jsonb_build_object(
        'order_id', v_freezing_order_id,
        'order_number', 'MRZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
        'sticks_frozen', 205,
        'duration_hours', 4,
        'temperature_celsius', -35
      )
    ),
    'logistics', jsonb_build_object(
      'pallets_created', 5,
      'sscc_codes', ARRAY[
        '005901234567890001',
        '005901234567890002',
        '005901234567890003',
        '005901234567890004',
        '005901234567890005'
      ],
      'shipment_id', v_shipment_id,
      'shipment_number', 'WZ/' || TO_CHAR(NOW(), 'YYMMDD') || '/001',
      'shipment_status', 'Shipped'
    ),
    'traceability', jsonb_build_object(
      'raw_batch_id', v_raw_batch_id,
      'meat_batch_id', v_meat_batch_id,
      'masa_batch_id', v_masa_batch_id,
      'kebab_batch_id', v_kebab_batch_id,
      'bones_batch_id', v_bones_batch_id
    ),
    'analytics_summary', jsonb_build_object(
      'total_input_kg', 5000,
      'total_finished_kg', 3300,
      'total_waste_kg', 1900,
      'overall_yield_percent', 66,
      'orders_by_type', jsonb_build_object(
        'Decomposition', 1,
        'Processing', 1,
        'Assembly', 1,
        'Freezing', 1
      )
    )
  );
  
  RETURN v_result;
END;
$$;