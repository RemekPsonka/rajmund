
-- Drop existing function
DROP FUNCTION IF EXISTS simulate_full_production_day();

-- Create comprehensive production simulation with SemiFinished logic
CREATE OR REPLACE FUNCTION simulate_full_production_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Company/Facility IDs
  v_company_id uuid;
  v_facility_id uuid;
  v_contractor_id uuid;
  
  -- Product IDs
  v_raw_chicken_id uuid;
  v_chicken_meat_id uuid;
  v_bones_id uuid;
  v_skin_id uuid;
  v_kebab_mass_id uuid;
  v_kebab_10kg_id uuid;
  v_kebab_15kg_id uuid;
  v_kebab_20kg_id uuid;
  v_spice_mix_id uuid;
  v_water_id uuid;
  v_protein_id uuid;
  
  -- Recipe ID
  v_recipe_id uuid;
  
  -- Batch IDs
  v_raw_batch_id uuid;
  v_meat_batch_id uuid;
  v_bones_batch_id uuid;
  v_masa_batch_id uuid;
  v_kebab_batch_id uuid;
  
  -- Order IDs
  v_decomp_order_id uuid;
  v_process_order_id uuid;
  v_assembly_order_id uuid;
  v_freezing_order_id uuid;
  
  -- Delivery/Shipment IDs
  v_delivery_id uuid;
  v_shipment_id uuid;
  
  -- Employee IDs
  v_employee1_id uuid;
  v_employee2_id uuid;
  v_employee3_id uuid;
  
  -- Production Log IDs
  v_decomp_log_id uuid;
  v_process_log_id uuid;
  v_assembly_log_id uuid;
  v_freezing_log_id uuid;
  
  -- Pallet IDs
  v_pallet_ids uuid[] := ARRAY[]::uuid[];
  v_pallet_id uuid;
  
  -- Quantities
  v_raw_input_kg numeric := 5000;
  v_meat_output_kg numeric := 3000;  -- 60% yield
  v_bones_output_kg numeric := 1800; -- 36% yield  
  v_skin_output_kg numeric := 200;   -- 4% yield
  v_masa_output_kg numeric := 3300;  -- 110% yield with additives
  
  -- Kebab variants
  v_kebab_10kg_count int := 30;
  v_kebab_15kg_count int := 100;
  v_kebab_20kg_count int := 75;
  v_total_kebabs int;
  
  -- Timestamps
  v_today date := CURRENT_DATE;
  v_now timestamp := NOW();
  
  -- Counters
  i int;
  
  -- Result
  v_result jsonb;
BEGIN
  -- ============================================
  -- STEP 0: CLEAN DATABASE
  -- ============================================
  DELETE FROM t_production_kebab_variants;
  DELETE FROM t_shipment_packaging;
  DELETE FROM t_shipment_items;
  DELETE FROM t_shipments;
  DELETE FROM t_handling_units;
  DELETE FROM t_production_logs;
  DELETE FROM t_production_inputs;
  DELETE FROM t_production_tasks;
  DELETE FROM t_production_orders;
  DELETE FROM t_warehouse_movements;
  DELETE FROM t_batches;
  DELETE FROM t_delivery_items;
  DELETE FROM t_deliveries;
  DELETE FROM t_recipe_ingredients;
  DELETE FROM t_recipes;
  DELETE FROM t_products;
  DELETE FROM t_storage_locations;
  DELETE FROM t_employees;
  DELETE FROM t_contractors;
  DELETE FROM t_facilities;
  DELETE FROM t_companies;
  
  -- ============================================
  -- STEP 1: CREATE BASE DATA
  -- ============================================
  
  -- Company
  INSERT INTO t_companies (name, tax_id, address, is_internal)
  VALUES ('Kebab Factory Sp. z o.o.', '1234567890', 'ul. Produkcyjna 1, 00-001 Warszawa', true)
  RETURNING id INTO v_company_id;
  
  -- Facility
  INSERT INTO t_facilities (company_id, name, address, type)
  VALUES (v_company_id, 'Zakład Produkcyjny Główny', 'ul. Produkcyjna 1, 00-001 Warszawa', 'Production')
  RETURNING id INTO v_facility_id;
  
  -- Contractor (supplier)
  INSERT INTO t_contractors (company_id, name, tax_id, type, address)
  VALUES (v_company_id, 'Ferma Drobiu ABC', '9876543210', 'Supplier', 'ul. Wiejska 10, 00-100 Grójec')
  RETURNING id INTO v_contractor_id;
  
  -- Storage locations
  INSERT INTO t_storage_locations (facility_id, name, type, temperature_min, temperature_max)
  VALUES 
    (v_facility_id, 'Chłodnia Surowców', 'Cold', 0, 4),
    (v_facility_id, 'Hala Rozbioru', 'Production', 10, 14),
    (v_facility_id, 'Hala Masowania', 'Production', 8, 12),
    (v_facility_id, 'Hala Składania', 'Production', 10, 14),
    (v_facility_id, 'Komora Szokowego Mrożenia', 'Freezer', -35, -30),
    (v_facility_id, 'Magazyn Wyrobów Gotowych', 'Freezer', -20, -18);
  
  -- Employees
  INSERT INTO t_employees (company_id, first_name, last_name, email, qr_login_code)
  VALUES 
    (v_company_id, 'Jan', 'Kowalski', 'jan.kowalski@kebab.pl', 'EMP001')
  RETURNING id INTO v_employee1_id;
  
  INSERT INTO t_employees (company_id, first_name, last_name, email, qr_login_code)
  VALUES 
    (v_company_id, 'Anna', 'Nowak', 'anna.nowak@kebab.pl', 'EMP002')
  RETURNING id INTO v_employee2_id;
  
  INSERT INTO t_employees (company_id, first_name, last_name, email, qr_login_code)
  VALUES 
    (v_company_id, 'Piotr', 'Wiśniewski', 'piotr.wisniewski@kebab.pl', 'EMP003')
  RETURNING id INTO v_employee3_id;

  -- ============================================
  -- STEP 2: CREATE PRODUCTS WITH PROPER CATEGORIES
  -- ============================================
  
  -- RawMeat: Input raw material
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'Ćwiartka kurczaka klasa A', 'SUR-001', 'kg', true, 'RawMeat', 5, 0, 4)
  RETURNING id INTO v_raw_chicken_id;
  
  -- SemiFinished: After decomposition
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'Mięso z kurczaka (po rozbiorze)', 'PP-001', 'kg', false, 'SemiFinished', 3, 0, 4)
  RETURNING id INTO v_chicken_meat_id;
  
  -- Waste products
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days)
  VALUES (v_company_id, 'Kości drobiowe', 'ODP-001', 'kg', false, 'Waste', 2)
  RETURNING id INTO v_bones_id;
  
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days)
  VALUES (v_company_id, 'Skóra drobiowa', 'ODP-002', 'kg', false, 'Waste', 2)
  RETURNING id INTO v_skin_id;
  
  -- SemiFinished: After processing (tumbling)
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'Masa kebabowa masowana', 'PP-002', 'kg', false, 'SemiFinished', 2, 0, 4)
  RETURNING id INTO v_kebab_mass_id;
  
  -- FinishedGood: Final products
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'Kebab Drobiowy 10kg', 'KEB-10', 'szt', false, 'FinishedGood', 180, -20, -18)
  RETURNING id INTO v_kebab_10kg_id;
  
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'Kebab Drobiowy 15kg', 'KEB-15', 'szt', false, 'FinishedGood', 180, -20, -18)
  RETURNING id INTO v_kebab_15kg_id;
  
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'Kebab Drobiowy 20kg', 'KEB-20', 'szt', false, 'FinishedGood', 180, -20, -18)
  RETURNING id INTO v_kebab_20kg_id;
  
  -- Spices
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days)
  VALUES (v_company_id, 'Mix przypraw kebab', 'PRZ-001', 'kg', true, 'Spice', 365)
  RETURNING id INTO v_spice_mix_id;
  
  -- Additives
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days)
  VALUES (v_company_id, 'Woda technologiczna', 'DOD-001', 'kg', true, 'Additive', 999)
  RETURNING id INTO v_water_id;
  
  INSERT INTO t_products (company_id, name, sku, unit, is_raw_material, industry_category, default_expiration_days)
  VALUES (v_company_id, 'Białko sojowe', 'DOD-002', 'kg', true, 'Additive', 180)
  RETURNING id INTO v_protein_id;

  -- ============================================
  -- STEP 3: CREATE RECIPE WITH SEMIFINISHED BASE
  -- ============================================
  
  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, evaporation_percent, process_instructions, description)
  VALUES (
    v_company_id, 
    'Masa kebabowa drobiowa standard', 
    v_chicken_meat_id,  -- BASE = SemiFinished (Mięso z kurczaka po rozbiorze)
    v_kebab_mass_id,    -- OUTPUT = SemiFinished (Masa kebabowa)
    110,                -- 110% yield (additives increase weight)
    0,
    '1. Załadować mięso do tumblera
2. Dodać przyprawy wg receptury
3. Dodać wodę technologiczną (8% wagi mięsa)
4. Dodać białko sojowe (0.5% wagi mięsa)
5. Masować przez 4 godziny w temp. 4°C
6. Kontrola jakości przed wyładunkiem',
    'Receptura standardowa na masę kebabową z mięsa drobiowego'
  )
  RETURNING id INTO v_recipe_id;
  
  -- Recipe ingredients (per 1kg of base meat)
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, amount_per_kg_base, unit)
  VALUES 
    (v_recipe_id, v_spice_mix_id, 0.015, 0.015, 'kg'),   -- 15g przypraw / kg mięsa
    (v_recipe_id, v_water_id, 0.08, 0.08, 'kg'),         -- 80g wody / kg mięsa
    (v_recipe_id, v_protein_id, 0.005, 0.005, 'kg');     -- 5g białka / kg mięsa

  -- ============================================
  -- STEP 4: DELIVERY (PZ) - Raw Material Receipt
  -- ============================================
  
  INSERT INTO t_deliveries (company_id, facility_id, contractor_id, document_number, delivery_date, status, notes)
  VALUES (v_company_id, v_facility_id, v_contractor_id, 'PZ/' || TO_CHAR(v_today, 'YYYY/MM') || '/001', v_today, 'Completed', 'Dostawa ćwiartek kurczaka klasa A')
  RETURNING id INTO v_delivery_id;
  
  -- Create raw material batch
  INSERT INTO t_batches (company_id, facility_id, product_id, internal_batch_number, supplier_batch_number, quantity, unit, production_date, expiry_date, status, source_document_type, source_document_id)
  VALUES (
    v_company_id, 
    v_facility_id, 
    v_raw_chicken_id, 
    TO_CHAR(v_today, 'YYMMDD') || '/FD/001',
    'LOT-FD-2025-001',
    v_raw_input_kg, 
    'kg', 
    v_today - 1, 
    v_today + 5,
    'Available',
    'delivery',
    v_delivery_id
  )
  RETURNING id INTO v_raw_batch_id;
  
  -- Delivery item
  INSERT INTO t_delivery_items (delivery_id, batch_id, product_id, quantity, unit)
  VALUES (v_delivery_id, v_raw_batch_id, v_raw_chicken_id, v_raw_input_kg, 'kg');

  -- ============================================
  -- STEP 5: DECOMPOSITION ORDER
  -- ============================================
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, notes)
  VALUES (v_company_id, v_facility_id, 'ROZ/' || TO_CHAR(v_today, 'YYYY/MM') || '/001', 'Decomposition', 'Closed', v_today, 'Rozbiór ćwiartek kurczaka - dzień 1')
  RETURNING id INTO v_decomp_order_id;
  
  -- Production input (RW)
  INSERT INTO t_production_inputs (order_id, batch_id, quantity, unit)
  VALUES (v_decomp_order_id, v_raw_batch_id, v_raw_input_kg, 'kg');
  
  -- Update raw batch quantity
  UPDATE t_batches SET quantity = 0 WHERE id = v_raw_batch_id;
  
  -- Production tasks for decomposition
  INSERT INTO t_production_tasks (order_id, name, is_completed, completed_at, completed_by)
  VALUES 
    (v_decomp_order_id, 'Kontrola temperatury surowca', true, v_now - interval '6 hours', v_employee1_id),
    (v_decomp_order_id, 'Weryfikacja partii wejściowej', true, v_now - interval '6 hours', v_employee1_id),
    (v_decomp_order_id, 'Kontrola jakości mięsa', true, v_now - interval '4 hours', v_employee2_id);
  
  -- Decomposition output log (PW) - creates meat batch
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, notes)
  VALUES (v_decomp_order_id, v_chicken_meat_id, v_meat_output_kg, v_meat_output_kg, 0, v_employee1_id, 'Decomposition', 'Mięso z kurczaka po rozbiorze')
  RETURNING id INTO v_decomp_log_id;
  
  -- Create meat batch (SemiFinished)
  INSERT INTO t_batches (company_id, facility_id, product_id, internal_batch_number, quantity, unit, production_date, expiry_date, status, source_document_type, source_document_id)
  VALUES (
    v_company_id, 
    v_facility_id, 
    v_chicken_meat_id, 
    TO_CHAR(v_today, 'YYMMDD') || '/PP/001',
    v_meat_output_kg, 
    'kg', 
    v_today, 
    v_today + 3,
    'Available',
    'production',
    v_decomp_order_id
  )
  RETURNING id INTO v_meat_batch_id;
  
  -- Create bones batch (Waste)
  INSERT INTO t_batches (company_id, facility_id, product_id, internal_batch_number, quantity, unit, production_date, expiry_date, status, source_document_type, source_document_id)
  VALUES (
    v_company_id, 
    v_facility_id, 
    v_bones_id, 
    TO_CHAR(v_today, 'YYMMDD') || '/ODP/001',
    v_bones_output_kg, 
    'kg', 
    v_today, 
    v_today + 2,
    'Available',
    'production',
    v_decomp_order_id
  )
  RETURNING id INTO v_bones_batch_id;
  
  -- Bones log
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, notes)
  VALUES (v_decomp_order_id, v_bones_id, v_bones_output_kg, v_bones_output_kg, 0, v_employee1_id, 'Decomposition', 'Kości z rozbioru');
  
  -- Skin log
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, notes)
  VALUES (v_decomp_order_id, v_skin_id, v_skin_output_kg, v_skin_output_kg, 0, v_employee1_id, 'Decomposition', 'Skóra z rozbioru');

  -- ============================================
  -- STEP 6: PROCESSING ORDER (Tumbling)
  -- ============================================
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, recipe_id, notes)
  VALUES (v_company_id, v_facility_id, 'PRZ/' || TO_CHAR(v_today, 'YYYY/MM') || '/001', 'Processing', 'Closed', v_today, v_recipe_id, 'Masowanie mięsa z kurczaka - tumbler T1')
  RETURNING id INTO v_process_order_id;
  
  -- Production input - meat batch
  INSERT INTO t_production_inputs (order_id, batch_id, quantity, unit)
  VALUES (v_process_order_id, v_meat_batch_id, v_meat_output_kg, 'kg');
  
  -- Update meat batch quantity
  UPDATE t_batches SET quantity = 0 WHERE id = v_meat_batch_id;
  
  -- Production tasks for processing
  INSERT INTO t_production_tasks (order_id, name, is_completed, completed_at, completed_by)
  VALUES 
    (v_process_order_id, 'Weryfikacja receptury', true, v_now - interval '3 hours', v_employee2_id),
    (v_process_order_id, 'Kontrola temperatury tumblera', true, v_now - interval '3 hours', v_employee2_id),
    (v_process_order_id, 'Dodanie przypraw wg receptury', true, v_now - interval '2.5 hours', v_employee2_id),
    (v_process_order_id, 'Kontrola czasu masowania (4h)', true, v_now - interval '30 minutes', v_employee2_id);
  
  -- Processing output log (PW) - creates masa batch
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, notes)
  VALUES (v_process_order_id, v_kebab_mass_id, v_masa_output_kg, v_masa_output_kg, 0, v_employee2_id, 'Massifying', 'Masa kebabowa po masowaniu 4h')
  RETURNING id INTO v_process_log_id;
  
  -- Create masa batch (SemiFinished)
  INSERT INTO t_batches (company_id, facility_id, product_id, internal_batch_number, quantity, unit, production_date, expiry_date, status, source_document_type, source_document_id)
  VALUES (
    v_company_id, 
    v_facility_id, 
    v_kebab_mass_id, 
    TO_CHAR(v_today, 'YYMMDD') || '/PP/002',
    v_masa_output_kg, 
    'kg', 
    v_today, 
    v_today + 2,
    'Available',
    'production',
    v_process_order_id
  )
  RETURNING id INTO v_masa_batch_id;

  -- ============================================
  -- STEP 7: ASSEMBLY ORDER (Stacking kebabs)
  -- ============================================
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, notes)
  VALUES (v_company_id, v_facility_id, 'SKL/' || TO_CHAR(v_today, 'YYYY/MM') || '/001', 'Assembly', 'Closed', v_today, 'Składanie słupków kebab 10/15/20kg')
  RETURNING id INTO v_assembly_order_id;
  
  -- Production input - masa batch
  INSERT INTO t_production_inputs (order_id, batch_id, quantity, unit)
  VALUES (v_assembly_order_id, v_masa_batch_id, v_masa_output_kg, 'kg');
  
  -- Update masa batch quantity
  UPDATE t_batches SET quantity = 0 WHERE id = v_masa_batch_id;
  
  -- Production tasks for assembly
  INSERT INTO t_production_tasks (order_id, name, is_completed, completed_at, completed_by)
  VALUES 
    (v_assembly_order_id, 'Przygotowanie stołu składania', true, v_now - interval '1 hour', v_employee3_id),
    (v_assembly_order_id, 'Kontrola wagi słupków', true, v_now - interval '30 minutes', v_employee3_id);
  
  -- Assembly output logs with kebab variants
  -- 10kg kebabs (30 pieces = 300kg)
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, notes)
  VALUES (v_assembly_order_id, v_kebab_10kg_id, 300, 300, 0, v_employee3_id, 'Stacking', 'Kebab 10kg x 30 szt')
  RETURNING id INTO v_assembly_log_id;
  
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight)
  VALUES (v_assembly_log_id, 'Kebab 10kg', 10, v_kebab_10kg_count, v_kebab_10kg_count * 10);
  
  -- 15kg kebabs (100 pieces = 1500kg)
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, notes)
  VALUES (v_assembly_order_id, v_kebab_15kg_id, 1500, 1500, 0, v_employee3_id, 'Stacking', 'Kebab 15kg x 100 szt')
  RETURNING id INTO v_assembly_log_id;
  
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight)
  VALUES (v_assembly_log_id, 'Kebab 15kg', 15, v_kebab_15kg_count, v_kebab_15kg_count * 15);
  
  -- 20kg kebabs (75 pieces = 1500kg)
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, notes)
  VALUES (v_assembly_order_id, v_kebab_20kg_id, 1500, 1500, 0, v_employee3_id, 'Stacking', 'Kebab 20kg x 75 szt')
  RETURNING id INTO v_assembly_log_id;
  
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight)
  VALUES (v_assembly_log_id, 'Kebab 20kg', 20, v_kebab_20kg_count, v_kebab_20kg_count * 20);
  
  -- Create kebab batches
  v_total_kebabs := v_kebab_10kg_count + v_kebab_15kg_count + v_kebab_20kg_count;
  
  INSERT INTO t_batches (company_id, facility_id, product_id, internal_batch_number, quantity, unit, production_date, expiry_date, status, source_document_type, source_document_id)
  VALUES (
    v_company_id, 
    v_facility_id, 
    v_kebab_15kg_id, 
    TO_CHAR(v_today, 'YYMMDD') || '/WG/001',
    v_total_kebabs, 
    'szt', 
    v_today, 
    v_today + 180,
    'Available',
    'production',
    v_assembly_order_id
  )
  RETURNING id INTO v_kebab_batch_id;

  -- ============================================
  -- STEP 8: FREEZING ORDER
  -- ============================================
  
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, notes)
  VALUES (v_company_id, v_facility_id, 'MRZ/' || TO_CHAR(v_today, 'YYYY/MM') || '/001', 'Freezing', 'Closed', v_today, 'Mrożenie szokowe słupków kebab -35°C')
  RETURNING id INTO v_freezing_order_id;
  
  -- Production tasks for freezing
  INSERT INTO t_production_tasks (order_id, name, is_completed, completed_at, completed_by)
  VALUES 
    (v_freezing_order_id, 'Załadunek do komory', true, v_now - interval '4 hours', v_employee3_id),
    (v_freezing_order_id, 'Kontrola temperatury komory (-35°C)', true, v_now - interval '3 hours', v_employee3_id),
    (v_freezing_order_id, 'Wyładunek po 4h mrożenia', true, v_now, v_employee3_id);
  
  -- Freezing log
  INSERT INTO t_production_logs (order_id, product_id, weight_gross, weight_net, tare, employee_id, process_stage, freezing_started_at, freezing_completed_at, notes)
  VALUES (v_freezing_order_id, v_kebab_15kg_id, 3300, 3300, 0, v_employee3_id, 'ShockFreezing', v_now - interval '4 hours', v_now, 'Mrożenie szokowe 205 słupków, 4h w -35°C')
  RETURNING id INTO v_freezing_log_id;

  -- ============================================
  -- STEP 9: PALLETIZATION
  -- ============================================
  
  -- Create 5 pallets with SSCC
  FOR i IN 1..5 LOOP
    INSERT INTO t_handling_units (company_id, facility_id, sscc, unit_type, status, created_by)
    VALUES (
      v_company_id, 
      v_facility_id, 
      '00590123456789' || LPAD(i::text, 5, '0'),
      'Pallet',
      'Ready',
      v_employee3_id
    )
    RETURNING id INTO v_pallet_id;
    
    v_pallet_ids := array_append(v_pallet_ids, v_pallet_id);
  END LOOP;

  -- ============================================
  -- STEP 10: SHIPMENT (WZ)
  -- ============================================
  
  INSERT INTO t_shipments (company_id, facility_id, contractor_id, shipment_number, status, planned_date, notes)
  VALUES (v_company_id, v_facility_id, v_contractor_id, 'WZ/' || TO_CHAR(v_today, 'YYYY/MM') || '/001', 'Shipped', v_today, 'Wysyłka kebabów mrożonych - 5 palet')
  RETURNING id INTO v_shipment_id;
  
  -- Add shipment items
  INSERT INTO t_shipment_items (shipment_id, handling_unit_id, batch_id, quantity, unit)
  SELECT 
    v_shipment_id,
    unnest(v_pallet_ids),
    v_kebab_batch_id,
    v_total_kebabs / 5,
    'szt';

  -- ============================================
  -- STEP 11: BUILD RESULT JSON
  -- ============================================
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Symulacja pełnego dnia produkcyjnego zakończona pomyślnie',
    'summary', jsonb_build_object(
      'raw_input_kg', v_raw_input_kg,
      'decomposition', jsonb_build_object(
        'meat_kg', v_meat_output_kg,
        'bones_kg', v_bones_output_kg,
        'skin_kg', v_skin_output_kg,
        'yield_percent', ROUND((v_meat_output_kg / v_raw_input_kg) * 100, 1)
      ),
      'processing', jsonb_build_object(
        'input_kg', v_meat_output_kg,
        'output_kg', v_masa_output_kg,
        'yield_percent', ROUND((v_masa_output_kg / v_meat_output_kg) * 100, 1)
      ),
      'assembly', jsonb_build_object(
        'kebab_10kg_count', v_kebab_10kg_count,
        'kebab_15kg_count', v_kebab_15kg_count,
        'kebab_20kg_count', v_kebab_20kg_count,
        'total_kebabs', v_total_kebabs,
        'total_weight_kg', v_kebab_10kg_count * 10 + v_kebab_15kg_count * 15 + v_kebab_20kg_count * 20
      ),
      'freezing', jsonb_build_object(
        'items_frozen', v_total_kebabs,
        'duration_hours', 4,
        'temperature_celsius', -35
      ),
      'logistics', jsonb_build_object(
        'pallets_created', 5,
        'shipment_status', 'Shipped'
      )
    ),
    'products_by_category', jsonb_build_object(
      'RawMeat', 1,
      'SemiFinished', 2,
      'FinishedGood', 3,
      'Waste', 2,
      'Spice', 1,
      'Additive', 2
    ),
    'orders_by_type', jsonb_build_object(
      'Decomposition', 1,
      'Processing', 1,
      'Assembly', 1,
      'Freezing', 1
    ),
    'traceability', jsonb_build_object(
      'delivery_id', v_delivery_id,
      'raw_batch_id', v_raw_batch_id,
      'meat_batch_id', v_meat_batch_id,
      'masa_batch_id', v_masa_batch_id,
      'kebab_batch_id', v_kebab_batch_id,
      'shipment_id', v_shipment_id
    ),
    'employees', jsonb_build_object(
      'decomposition', jsonb_build_object('name', 'Jan Kowalski', 'code', 'EMP001'),
      'processing', jsonb_build_object('name', 'Anna Nowak', 'code', 'EMP002'),
      'assembly_freezing', jsonb_build_object('name', 'Piotr Wiśniewski', 'code', 'EMP003')
    ),
    'recipe', jsonb_build_object(
      'name', 'Masa kebabowa drobiowa standard',
      'base_product', 'Mięso z kurczaka (po rozbiorze)',
      'base_category', 'SemiFinished',
      'output_product', 'Masa kebabowa masowana',
      'target_yield_percent', 110
    )
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Błąd symulacji: ' || SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;
