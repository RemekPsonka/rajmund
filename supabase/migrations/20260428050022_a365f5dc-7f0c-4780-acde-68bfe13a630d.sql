
CREATE OR REPLACE FUNCTION public.simulate_full_production_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid; v_facility_id uuid; v_storage_location_id uuid;
  v_supplier_id uuid; v_customer_id uuid;
  v_emp_dec uuid; v_emp_prc uuid; v_emp_asm uuid;
  v_raw_chicken_id uuid; v_semi_meat_id uuid; v_semi_masa_id uuid;
  v_finished_kebab_id uuid; v_waste_bones_id uuid; v_waste_skin_id uuid; v_spice_mix_id uuid;
  v_recipe_id uuid;
  v_pz_id uuid; v_pz_number text;
  v_raw_batch_id uuid; v_meat_batch_id uuid; v_bones_batch_id uuid; v_skin_batch_id uuid;
  v_masa_batch_id uuid; v_kebab_batch_id uuid;
  v_decomp_order_id uuid; v_processing_order_id uuid; v_assembly_order_id uuid; v_freezing_order_id uuid;
  v_assembly_log_id uuid; v_freezing_log_id uuid;
  v_pallet_ids uuid[] := ARRAY[]::uuid[]; v_pallet_id uuid;
  v_shipment_id uuid; v_shipment_number text;
  v_i integer;
  v_pz_temp numeric := 2.5;
  v_kebab_per_pallet integer := 41; -- 5 palet × 41 słupków ≈ 205
  v_result jsonb;
BEGIN
  -- ================== CLEANUP ==================
  DELETE FROM t_shipment_items WHERE shipment_id IN (SELECT id FROM t_shipments WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_shipments WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_production_kebab_variants WHERE production_log_id IN (SELECT id FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory')));
  -- najpierw odpinamy palety od logów żeby trigger CCP3 nie wybuchł przy DELETE
  UPDATE t_handling_units SET status='Open' WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_freezing_temp_log WHERE production_log_id IN (SELECT id FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory')));
  DELETE FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_handling_units WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_production_inputs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_production_tasks WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_lot_lineage WHERE child_lot_id IN (SELECT b.id FROM t_batches b JOIN t_products p ON p.id=b.product_id WHERE p.company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'))
                          OR parent_lot_id IN (SELECT b.id FROM t_batches b JOIN t_products p ON p.id=b.product_id WHERE p.company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_production_orders WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_warehouse_movement_items WHERE movement_id IN (SELECT id FROM t_warehouse_movements WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_supplier_complaints WHERE movement_id IN (SELECT id FROM t_warehouse_movements WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_warehouse_movements WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_batches WHERE product_id IN (SELECT id FROM t_products WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_recipe_ingredients WHERE recipe_id IN (SELECT id FROM t_recipes WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_recipes WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_products WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_employees WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_contractors WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_storage_locations WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory'));
  DELETE FROM t_facilities WHERE company_id IN (SELECT id FROM t_companies WHERE name='Kebab Test Factory');
  DELETE FROM t_companies WHERE name='Kebab Test Factory';

  -- ================== SETUP ==================
  INSERT INTO t_companies (name, short_name, tax_id, is_active) VALUES ('Kebab Test Factory','KTF','PL1234567890',true) RETURNING id INTO v_company_id;
  INSERT INTO t_facilities (company_id, name, type) VALUES (v_company_id,'Zakład Produkcyjny','Plant') RETURNING id INTO v_facility_id;
  INSERT INTO t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active) VALUES (v_facility_id,'Magazyn Chłodniczy','chiller',-2,4,true) RETURNING id INTO v_storage_location_id;

  INSERT INTO t_contractors (company_id, name, tax_id, is_supplier, vet_number) VALUES (v_company_id,'Ferma Drobiu ABC','PL9876543210',true,'PL12345678') RETURNING id INTO v_supplier_id;
  INSERT INTO t_contractors (company_id, name, tax_id, is_customer) VALUES (v_company_id,'HoReCa Dystrybucja SA','PL5555555555',true) RETURNING id INTO v_customer_id;

  INSERT INTO t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active)
    VALUES (v_company_id,v_facility_id,'Jan','Kowalski','Rozbieracz','EMP-DEC-001',true) RETURNING id INTO v_emp_dec;
  INSERT INTO t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active)
    VALUES (v_company_id,v_facility_id,'Anna','Nowak','Operator Tumbler','EMP-PRC-001',true) RETURNING id INTO v_emp_prc;
  INSERT INTO t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active)
    VALUES (v_company_id,v_facility_id,'Piotr','Wiśniewski','Operator Składania/Mrożenia','EMP-ASM-001',true) RETURNING id INTO v_emp_asm;

  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id,'Ćwiartka kurczaka klasy A','SU-KURCZAK-001','RawMeat','kg') RETURNING id INTO v_raw_chicken_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id,'Mięso z kurczaka (po rozbiorze)','PP-MIESO-001','SemiFinished','kg') RETURNING id INTO v_semi_meat_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id,'Masa kebabowa masowana','PP-MASA-001','SemiFinished','kg') RETURNING id INTO v_semi_masa_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit, unit_target_weight_kg) VALUES (v_company_id,'Kebab Drobiowy 15kg','KEB-DRB-15','FinishedGood','kg',15) RETURNING id INTO v_finished_kebab_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id,'Kości drobiowe','ODP-KOSCI-001','Waste','kg') RETURNING id INTO v_waste_bones_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id,'Skóra drobiowa','ODP-SKORA-001','Waste','kg') RETURNING id INTO v_waste_skin_id;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit) VALUES (v_company_id,'Mix przypraw kebab','PRZ-MIX-001','Spice','kg') RETURNING id INTO v_spice_mix_id;

  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, is_active)
    VALUES (v_company_id,'Receptura Masa Kebabowa',v_semi_meat_id,v_semi_masa_id,110,true) RETURNING id INTO v_recipe_id;
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, amount_per_kg_base, unit, role)
    VALUES (v_recipe_id,v_spice_mix_id,0.1,0.1,'kg','SPICE');

  -- ================== 1. PZ — Przyjęcie towaru ==================
  v_pz_number := 'PZ/' || TO_CHAR(NOW(),'YYMMDD') || '/001';
  INSERT INTO t_warehouse_movements (company_id, facility_id, document_number, type, contractor_id, status,
    driver_name, car_plates, received_temp_c, received_temp_method, notes, approved_at)
    VALUES (v_company_id, v_facility_id, v_pz_number, 'PZ', v_supplier_id, 'Approved',
      'Marek Dostawca','LU 88888', v_pz_temp, 'MANUAL_PROBE','Dostawa testowa — symulacja', NOW())
    RETURNING id INTO v_pz_id;

  INSERT INTO t_warehouse_movement_items (movement_id, product_id, quantity, packaging_type)
    VALUES (v_pz_id, v_raw_chicken_id, 5000, 'E2');

  -- Partia surowca (trigger trg_create_receiving_lineage utworzy wpis lineage RECEIVING)
  INSERT INTO t_batches (product_id, internal_batch_number, supplier_id, supplier_batch_number,
    initial_quantity, current_quantity, production_date, expiration_date, status, location_id, reception_date)
    VALUES (v_raw_chicken_id, TO_CHAR(NOW(),'YYMMDD') || '/FERMA-ABC/001', v_supplier_id, 'EXT-2026-001',
      5000, 5000, NOW()::date, (NOW()+INTERVAL '14 days')::date, 'Released', v_storage_location_id, NOW())
    RETURNING id INTO v_raw_batch_id;

  -- ================== 2. ZP-DEC — Rozbiór ==================
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, supervisor_id)
    VALUES (v_company_id, v_facility_id,'ZP-DEC-' || TO_CHAR(NOW(),'YYMMDD') || '-001','Decomposition','Closed',NOW()::date, v_emp_dec)
    RETURNING id INTO v_decomp_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight)
    VALUES (v_decomp_order_id, v_raw_batch_id, v_raw_chicken_id, 5000);
  UPDATE t_batches SET current_quantity=0, status='Blocked' WHERE id=v_raw_batch_id;

  INSERT INTO t_batches (product_id, internal_batch_number, parent_batch_id, source_event_type, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_semi_meat_id, TO_CHAR(NOW(),'YYMMDD') || '/KTF/MIESO-001', v_raw_batch_id,'PRODUCTION',3000,3000,NOW()::date,(NOW()+INTERVAL '7 days')::date,'Released',v_storage_location_id)
    RETURNING id INTO v_meat_batch_id;
  INSERT INTO t_batches (product_id, internal_batch_number, parent_batch_id, source_event_type, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_waste_bones_id, TO_CHAR(NOW(),'YYMMDD') || '/KTF/KOSCI-001', v_raw_batch_id,'PRODUCTION',1900,1900,NOW()::date,(NOW()+INTERVAL '3 days')::date,'Released',v_storage_location_id)
    RETURNING id INTO v_bones_batch_id;
  INSERT INTO t_batches (product_id, internal_batch_number, parent_batch_id, source_event_type, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_waste_skin_id, TO_CHAR(NOW(),'YYMMDD') || '/KTF/SKORA-001', v_raw_batch_id,'PRODUCTION',100,100,NOW()::date,(NOW()+INTERVAL '3 days')::date,'Released',v_storage_location_id)
    RETURNING id INTO v_skin_batch_id;

  INSERT INTO t_production_logs (production_order_id, employee_id, source_batch_id, output_batch_id, product_id, weight_gross, weight_tare, expected_weight, process_stage)
    VALUES (v_decomp_order_id, v_emp_dec, v_raw_batch_id, v_meat_batch_id, v_semi_meat_id, 3000, 0, 3000, 'Decomposition');
  INSERT INTO t_production_logs (production_order_id, employee_id, source_batch_id, output_batch_id, product_id, weight_gross, weight_tare, process_stage)
    VALUES (v_decomp_order_id, v_emp_dec, v_raw_batch_id, v_bones_batch_id, v_waste_bones_id, 1900, 0, 'Decomposition');
  INSERT INTO t_production_logs (production_order_id, employee_id, source_batch_id, output_batch_id, product_id, weight_gross, weight_tare, process_stage)
    VALUES (v_decomp_order_id, v_emp_dec, v_raw_batch_id, v_skin_batch_id, v_waste_skin_id, 100, 0, 'Decomposition');

  -- Lineage manualna dla rozbioru (parent=raw → child=mięso/kości/skóra)
  INSERT INTO t_lot_lineage (parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, operator_id) VALUES
    (v_raw_batch_id, v_meat_batch_id,  'PRODUCTION', 3000, v_decomp_order_id, v_emp_dec),
    (v_raw_batch_id, v_bones_batch_id, 'PRODUCTION', 1900, v_decomp_order_id, v_emp_dec),
    (v_raw_batch_id, v_skin_batch_id,  'PRODUCTION', 100,  v_decomp_order_id, v_emp_dec);

  -- ================== 3. ZP-TUM — Masowanie ==================
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, recipe_id, supervisor_id)
    VALUES (v_company_id, v_facility_id,'ZP-TUM-' || TO_CHAR(NOW(),'YYMMDD') || '-001','Processing','Closed',NOW()::date,v_recipe_id,v_emp_prc)
    RETURNING id INTO v_processing_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight)
    VALUES (v_processing_order_id, v_meat_batch_id, v_semi_meat_id, 3000);
  UPDATE t_batches SET current_quantity=0, status='Blocked' WHERE id=v_meat_batch_id;

  INSERT INTO t_batches (product_id, internal_batch_number, parent_batch_id, source_event_type, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_semi_masa_id, TO_CHAR(NOW(),'YYMMDD') || '/KTF/MASA-001', v_meat_batch_id,'PRODUCTION',3300,3300,NOW()::date,(NOW()+INTERVAL '5 days')::date,'Released',v_storage_location_id)
    RETURNING id INTO v_masa_batch_id;
  INSERT INTO t_production_logs (production_order_id, employee_id, source_batch_id, output_batch_id, product_id, weight_gross, weight_tare, expected_weight, process_stage, recipe_id)
    VALUES (v_processing_order_id, v_emp_prc, v_meat_batch_id, v_masa_batch_id, v_semi_masa_id, 3300, 0, 3300, 'Massaging', v_recipe_id);
  INSERT INTO t_lot_lineage (parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, operator_id)
    VALUES (v_meat_batch_id, v_masa_batch_id, 'PRODUCTION', 3300, v_processing_order_id, v_emp_prc);

  -- ================== 4. ZP-ASM — Składanie kebabów ==================
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, supervisor_id)
    VALUES (v_company_id, v_facility_id,'ZP-ASM-' || TO_CHAR(NOW(),'YYMMDD') || '-001','Assembly','Closed',NOW()::date,v_emp_asm)
    RETURNING id INTO v_assembly_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight)
    VALUES (v_assembly_order_id, v_masa_batch_id, v_semi_masa_id, 3300);
  UPDATE t_batches SET current_quantity=0, status='Blocked' WHERE id=v_masa_batch_id;

  -- 30×10kg + 100×15kg + 75×20kg = 300+1500+1500 = 3300 kg, 205 słupków
  INSERT INTO t_batches (product_id, internal_batch_number, parent_batch_id, source_event_type, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_finished_kebab_id, TO_CHAR(NOW(),'YYMMDD') || '/KTF/KEBAB-001', v_masa_batch_id,'PRODUCTION',3300,3300,NOW()::date,(NOW()+INTERVAL '90 days')::date,'Released',v_storage_location_id)
    RETURNING id INTO v_kebab_batch_id;
  INSERT INTO t_production_logs (production_order_id, employee_id, source_batch_id, output_batch_id, product_id, weight_gross, weight_tare, expected_weight, process_stage, packaging_count, packaging_type)
    VALUES (v_assembly_order_id, v_emp_asm, v_masa_batch_id, v_kebab_batch_id, v_finished_kebab_id, 3400, 100, 3300, 'Stacking', 205, 'Słupek')
    RETURNING id INTO v_assembly_log_id;
  INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight) VALUES
    (v_assembly_log_id,'Kebab 10kg',10,30,300),
    (v_assembly_log_id,'Kebab 15kg',15,100,1500),
    (v_assembly_log_id,'Kebab 20kg',20,75,1500);
  INSERT INTO t_lot_lineage (parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, operator_id)
    VALUES (v_masa_batch_id, v_kebab_batch_id, 'PRODUCTION', 3300, v_assembly_order_id, v_emp_asm);

  -- ================== 5. ZP-FRZ — Mrożenie szokowe ==================
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, supervisor_id)
    VALUES (v_company_id, v_facility_id,'ZP-FRZ-' || TO_CHAR(NOW(),'YYMMDD') || '-001','Freezing','Closed',NOW()::date,v_emp_asm)
    RETURNING id INTO v_freezing_order_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight)
    VALUES (v_freezing_order_id, v_kebab_batch_id, v_finished_kebab_id, 3300);

  -- Główny log mrożenia (bez handling_unit_id) — to on dostarcza ccp_passed dla CCP3 gate
  INSERT INTO t_production_logs (production_order_id, employee_id, source_batch_id, output_batch_id, product_id,
    weight_gross, weight_tare, process_stage,
    freezing_started_at, freezing_completed_at, freezing_duration_minutes,
    latest_core_temp_c, target_core_temp_c, ccp_passed)
    VALUES (v_freezing_order_id, v_emp_asm, v_kebab_batch_id, v_kebab_batch_id, v_finished_kebab_id,
      3400, 100, 'ShockFreezing',
      NOW() - INTERVAL '4 hours', NOW(), 240,
      -22, -18, true)
    RETURNING id INTO v_freezing_log_id;

  -- Trzy odczyty temperatury rdzenia (krzywa wykładnicza)
  INSERT INTO t_freezing_temp_log (production_log_id, recorded_at, core_temp_c, ambient_temp_c, source) VALUES
    (v_freezing_log_id, NOW() - INTERVAL '4 hours', 4,    -35, 'simulation'),
    (v_freezing_log_id, NOW() - INTERVAL '2 hours', -10,  -35, 'simulation'),
    (v_freezing_log_id, NOW(),                     -22,  -35, 'simulation');

  -- ================== 6. Paletyzacja (5 palet SSCC) ==================
  -- 205 słupków / 5 palet = 41 sztuk/paleta. Net 3300/5 = 660 kg/paleta
  FOR v_i IN 1..5 LOOP
    INSERT INTO t_handling_units (company_id, facility_id, sscc_number, type, status,
      total_net_weight, total_gross_weight, items_count, production_date, label_printed)
      VALUES (v_company_id, v_facility_id,
        '0059' || LPAD(v_i::text, 16, '0'),
        'Pallet','Open', 660, 685, v_kebab_per_pallet, NOW()::date, true)
      RETURNING id INTO v_pallet_id;

    -- Log mrożenia per paleta z handling_unit_id → trigger AGGREGATION zbuduje lineage paleta↔kebab_batch
    INSERT INTO t_production_logs (production_order_id, employee_id, source_batch_id, output_batch_id, product_id,
      handling_unit_id, weight_gross, weight_tare, process_stage,
      freezing_started_at, freezing_completed_at, freezing_duration_minutes,
      latest_core_temp_c, target_core_temp_c, ccp_passed)
      VALUES (v_freezing_order_id, v_emp_asm, v_kebab_batch_id, v_kebab_batch_id, v_finished_kebab_id,
        v_pallet_id, 685, 25, 'ShockFreezing',
        NOW() - INTERVAL '4 hours', NOW(), 240, -22, -18, true);

    -- Zamknięcie palety (CCP3 gate przepuści, bo łańcuch ma frozen log)
    UPDATE t_handling_units SET status='Closed' WHERE id=v_pallet_id;

    v_pallet_ids := v_pallet_ids || v_pallet_id;
  END LOOP;

  -- ================== 7. WZ — Wysyłka ==================
  v_shipment_number := 'WZ/' || TO_CHAR(NOW(),'YYMMDD') || '/001';
  INSERT INTO t_shipments (company_id, facility_id, shipment_number, status, dispatch_date,
    customer_id, driver_name, truck_plates, trailer_plates, seal_number, transport_temperature,
    total_net_weight, pallets_count)
    VALUES (v_company_id, v_facility_id, v_shipment_number, 'Shipped', NOW()::date,
      v_customer_id, 'Jan Kierowca', 'WA 12345', 'WA 99999X', 'PL-SEAL-2026-001', -20,
      3300, 5)
    RETURNING id INTO v_shipment_id;

  FOREACH v_pallet_id IN ARRAY v_pallet_ids LOOP
    INSERT INTO t_shipment_items (shipment_id, handling_unit_id, batch_id, product_id, quantity)
      VALUES (v_shipment_id, v_pallet_id, v_kebab_batch_id, v_finished_kebab_id, v_kebab_per_pallet);
    UPDATE t_handling_units SET status='Shipped' WHERE id=v_pallet_id;
  END LOOP;

  -- ================== RESULT JSON ==================
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Symulacja PZ → Rozbiór → Masowanie → Składanie → Mrożenie → Paletyzacja → WZ zakończona',
    'summary', jsonb_build_object(
      'raw_input_kg', 5000,
      'receiving', jsonb_build_object(
        'document_number', v_pz_number,
        'supplier_name', 'Ferma Drobiu ABC',
        'temp_c', v_pz_temp,
        'ccp1_passed', (v_pz_temp <= 4)
      ),
      'decomposition', jsonb_build_object(
        'meat_kg', 3000, 'bones_kg', 1900, 'skin_kg', 100,
        'yield_percent', round(3000.0/5000*100, 1)
      ),
      'processing', jsonb_build_object(
        'input_kg', 3000, 'output_kg', 3300,
        'yield_percent', round(3300.0/3000*100, 1)
      ),
      'assembly', jsonb_build_object(
        'kebab_10kg_count', 30, 'kebab_15kg_count', 100, 'kebab_20kg_count', 75,
        'total_kebabs', 205, 'total_weight_kg', 3300
      ),
      'freezing', jsonb_build_object(
        'items_frozen', 205, 'duration_hours', 4, 'temperature_celsius', -22,
        'ccp_passed', true
      ),
      'logistics', jsonb_build_object(
        'pallets_created', 5,
        'shipment_status', 'Shipped',
        'shipment_number', v_shipment_number
      )
    ),
    'products_by_category', jsonb_build_object(
      'RawMeat', 1, 'SemiFinished', 2, 'FinishedGood', 1, 'Waste', 2, 'Spice', 1
    ),
    'orders_by_type', jsonb_build_object(
      'Decomposition', 1, 'Processing', 1, 'Assembly', 1, 'Freezing', 1
    ),
    'recipe', jsonb_build_object(
      'name', 'Receptura Masa Kebabowa',
      'base_product', 'Mięso z kurczaka (po rozbiorze)',
      'base_category', 'SemiFinished',
      'output_product', 'Masa kebabowa masowana',
      'target_yield_percent', 110
    ),
    'employees', jsonb_build_object(
      'decomposition', jsonb_build_object('name','Jan Kowalski','code','EMP-DEC-001'),
      'processing',    jsonb_build_object('name','Anna Nowak','code','EMP-PRC-001'),
      'assembly_freezing', jsonb_build_object('name','Piotr Wiśniewski','code','EMP-ASM-001')
    ),
    'traceability', jsonb_build_object(
      'delivery_id',    v_pz_id,
      'raw_batch_id',   v_raw_batch_id,
      'meat_batch_id',  v_meat_batch_id,
      'masa_batch_id',  v_masa_batch_id,
      'kebab_batch_id', v_kebab_batch_id,
      'shipment_id',    v_shipment_id,
      'pallet_ids',     to_jsonb(v_pallet_ids)
    )
  );
  RETURN v_result;
END;
$function$;
