-- =========================================================
-- 1) Rozszerzenie check_database_integrity:
--    + severity per check
--    + nowa kategoria 'duplicates' (duplikaty triggerów)
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_database_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_checks jsonb := '[]'::jsonb;
  v_passed int := 0;
  v_failed int := 0;
  v_total int := 0;
  v_ok boolean;
  v_detail text;
  v_expected_table text;
  v_actual_table text;
  v_severity text;

  -- Triggery: name | table | severity
  v_triggers text[][] := ARRAY[
    ['trg_create_receiving_lineage',     't_batches',              'HIGH'],
    ['trg_create_aggregation_lineage',   't_production_logs',      'HIGH'],
    ['trg_create_ccp1_complaint',        't_warehouse_movements',  'CRITICAL'],
    ['trg_ccp1_set_flag',                't_warehouse_movements',  'CRITICAL'],
    ['trg_enforce_ccp3',                 't_handling_units',       'CRITICAL'],
    ['trg_reduce_batch_on_input',        't_production_inputs',    'HIGH'],
    ['trg_update_handling_unit_totals',  't_production_logs',      'HIGH'],
    ['trg_update_shipment_totals',       't_shipment_items',       'HIGH'],
    ['trg_populate_shipment_item_batch', 't_shipment_items',       'HIGH'],
    ['trg_mark_handling_unit_shipped',   't_shipment_items',       'HIGH'],
    ['trg_validate_recipe_ingredient_role', 't_recipe_ingredients','MEDIUM']
  ];

  -- FK: table | column | ref_table | ref_column | severity
  v_fks text[][] := ARRAY[
    ['t_production_orders', 'supervisor_id',         't_employees',          'id', 'CRITICAL'],
    ['t_lot_lineage',       'parent_lot_id',         't_batches',            'id', 'HIGH'],
    ['t_lot_lineage',       'child_lot_id',          't_batches',            'id', 'HIGH'],
    ['t_lot_lineage',       'child_handling_unit_id','t_handling_units',     'id', 'HIGH'],
    ['t_production_logs',   'handling_unit_id',      't_handling_units',     'id', 'HIGH'],
    ['t_production_logs',   'source_batch_id',       't_batches',            'id', 'HIGH'],
    ['t_production_logs',   'output_batch_id',       't_batches',            'id', 'HIGH'],
    ['t_supplier_complaints','movement_id',          't_warehouse_movements','id', 'HIGH'],
    ['t_shipment_items',    'shipment_id',           't_shipments',          'id', 'HIGH'],
    ['t_shipment_items',    'handling_unit_id',      't_handling_units',     'id', 'HIGH']
  ];

  -- GENERATED: table | column | severity
  v_gens text[][] := ARRAY[
    ['t_warehouse_movements', 'ccp1_passed', 'MEDIUM']
  ];

  -- CHECK: conname | required_token | severity
  v_checks_def text[][] := ARRAY[
    ['t_production_logs_process_stage_check', 'ShockFreezing', 'MEDIUM'],
    ['t_production_logs_process_stage_check', 'Stacking',      'MEDIUM'],
    ['t_production_logs_process_stage_check', 'Freezing',      'MEDIUM']
  ];

  i int;
  v_def text;
  v_dup_count int := 0;
  rec record;
BEGIN
  -- 1) TRIGGERY
  FOR i IN 1 .. array_length(v_triggers, 1) LOOP
    SELECT tgrelid::regclass::text INTO v_actual_table
    FROM pg_trigger
    WHERE tgname = v_triggers[i][1] AND NOT tgisinternal
    LIMIT 1;

    v_expected_table := v_triggers[i][2];
    v_severity := v_triggers[i][3];
    IF v_actual_table IS NULL THEN
      v_ok := false; v_detail := 'BRAK triggera w pg_trigger';
    ELSIF v_actual_table NOT LIKE '%' || v_expected_table THEN
      v_ok := false; v_detail := format('zły obiekt: %s (oczekiwany %s)', v_actual_table, v_expected_table);
    ELSE
      v_ok := true; v_detail := format('OK na %s', v_actual_table);
    END IF;

    v_checks := v_checks || jsonb_build_object(
      'category', 'trigger',
      'severity', v_severity,
      'name', v_triggers[i][1],
      'expected', v_expected_table,
      'ok', v_ok,
      'detail', v_detail
    );
    v_total := v_total + 1;
    IF v_ok THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; END IF;
  END LOOP;

  -- 2) DUPLIKATY TRIGGERÓW (CRITICAL)
  v_dup_count := 0;
  FOR rec IN
    SELECT
      c.relname AS tbl,
      p.proname AS fn,
      array_agg(t.tgname ORDER BY t.tgname) AS names,
      count(*) AS n
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc  p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND c.relnamespace = 'public'::regnamespace
    GROUP BY c.relname, p.proname
    HAVING count(*) > 1
  LOOP
    v_dup_count := v_dup_count + 1;
    v_checks := v_checks || jsonb_build_object(
      'category', 'duplicates',
      'severity', 'CRITICAL',
      'name', format('duplicate on %s calling %s', rec.tbl, rec.fn),
      'expected', '1 trigger per (table, function)',
      'ok', false,
      'detail', format('Found %s duplicates: %s', rec.n, array_to_string(rec.names, ', '))
    );
    v_total := v_total + 1;
    v_failed := v_failed + 1;
  END LOOP;

  -- Jeśli brak duplikatów → jeden zielony check (kategoria zawsze widoczna)
  IF v_dup_count = 0 THEN
    v_checks := v_checks || jsonb_build_object(
      'category', 'duplicates',
      'severity', 'CRITICAL',
      'name', 'no duplicate triggers',
      'expected', '0 duplicates',
      'ok', true,
      'detail', 'OK — brak duplikatów (table, function) w pg_trigger'
    );
    v_total := v_total + 1;
    v_passed := v_passed + 1;
  END IF;

  -- 3) FOREIGN KEYS
  FOR i IN 1 .. array_length(v_fks, 1) LOOP
    v_severity := v_fks[i][5];
    SELECT format('references %I(%I)', cl2.relname, att2.attname) INTO v_detail
    FROM pg_constraint c
    JOIN pg_class cl   ON cl.oid  = c.conrelid
    JOIN pg_class cl2  ON cl2.oid = c.confrelid
    JOIN pg_attribute att  ON att.attrelid  = c.conrelid  AND att.attnum  = c.conkey[1]
    JOIN pg_attribute att2 ON att2.attrelid = c.confrelid AND att2.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND cl.relname  = v_fks[i][1]
      AND att.attname = v_fks[i][2]
      AND cl2.relname = v_fks[i][3]
      AND att2.attname= v_fks[i][4]
    LIMIT 1;

    v_ok := v_detail IS NOT NULL;
    IF NOT v_ok THEN
      SELECT format('zły target: references %I(%I)', cl2.relname, att2.attname) INTO v_detail
      FROM pg_constraint c
      JOIN pg_class cl   ON cl.oid  = c.conrelid
      JOIN pg_class cl2  ON cl2.oid = c.confrelid
      JOIN pg_attribute att  ON att.attrelid  = c.conrelid  AND att.attnum  = c.conkey[1]
      JOIN pg_attribute att2 ON att2.attrelid = c.confrelid AND att2.attnum = c.confkey[1]
      WHERE c.contype = 'f'
        AND cl.relname  = v_fks[i][1]
        AND att.attname = v_fks[i][2]
      LIMIT 1;
      IF v_detail IS NULL THEN v_detail := 'BRAK klucza obcego'; END IF;
    END IF;

    v_checks := v_checks || jsonb_build_object(
      'category', 'fk',
      'severity', v_severity,
      'name', v_fks[i][1] || '.' || v_fks[i][2],
      'expected', v_fks[i][3] || '(' || v_fks[i][4] || ')',
      'ok', v_ok,
      'detail', v_detail
    );
    v_total := v_total + 1;
    IF v_ok THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; END IF;
    v_detail := NULL;
  END LOOP;

  -- 4) GENERATED COLUMNS
  FOR i IN 1 .. array_length(v_gens, 1) LOOP
    v_severity := v_gens[i][3];
    SELECT CASE WHEN is_generated = 'ALWAYS' THEN 'GENERATED ALWAYS' ELSE is_generated END
      INTO v_detail
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = v_gens[i][1]
      AND column_name  = v_gens[i][2]
    LIMIT 1;

    v_ok := v_detail = 'GENERATED ALWAYS';
    IF v_detail IS NULL THEN v_detail := 'BRAK kolumny'; END IF;

    v_checks := v_checks || jsonb_build_object(
      'category', 'generated',
      'severity', v_severity,
      'name', v_gens[i][1] || '.' || v_gens[i][2],
      'expected', 'GENERATED ALWAYS',
      'ok', v_ok,
      'detail', v_detail
    );
    v_total := v_total + 1;
    IF v_ok THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; END IF;
    v_detail := NULL;
  END LOOP;

  -- 5) CHECK CONSTRAINTS
  FOR i IN 1 .. array_length(v_checks_def, 1) LOOP
    v_severity := v_checks_def[i][3];
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    WHERE c.contype = 'c' AND c.conname = v_checks_def[i][1]
    LIMIT 1;

    IF v_def IS NULL THEN
      v_ok := false; v_detail := 'BRAK CHECK constraint';
    ELSIF position(v_checks_def[i][2] in v_def) > 0 THEN
      v_ok := true; v_detail := 'zawiera token: ' || v_checks_def[i][2];
    ELSE
      v_ok := false;
      v_detail := format('brak tokenu %s w definicji: %s', v_checks_def[i][2], v_def);
    END IF;

    v_checks := v_checks || jsonb_build_object(
      'category', 'check',
      'severity', v_severity,
      'name', v_checks_def[i][1] || ' ⊃ ' || v_checks_def[i][2],
      'expected', v_checks_def[i][2],
      'ok', v_ok,
      'detail', v_detail
    );
    v_total := v_total + 1;
    IF v_ok THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; END IF;
    v_def := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', v_failed = 0,
    'summary', jsonb_build_object('passed', v_passed, 'failed', v_failed, 'total', v_total),
    'checks', v_checks,
    'checked_at', now()
  );
END;
$function$;

-- =========================================================
-- 2) audit_e2e_flow: self-validation przez health check
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_e2e_flow(p_temp numeric DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid; v_facility_id uuid; v_loc_id uuid;
  v_supplier_id uuid; v_customer_id uuid;
  v_p_raw uuid; v_p_meat uuid; v_p_kebab uuid; v_recipe_id uuid;
  v_pz_id uuid; v_pz_number text;
  v_raw_batch_id uuid; v_meat_batch_id uuid; v_kebab_batch_id uuid;
  v_decomp_id uuid; v_assembly_id uuid; v_freeze_id uuid;
  v_freeze_log_id uuid; v_pallet_id uuid; v_sscc text;
  v_shipment_id uuid; v_shipment_number text;
  v_lineage_count int; v_complaint_count int;
  v_health jsonb;
BEGIN
  PERFORM public.cleanup_audit_data();
  INSERT INTO t_companies (name, short_name, tax_id, is_active) VALUES ('AUDIT KTF','AUDIT','PL-AUDIT-001',true) RETURNING id INTO v_company_id;
  INSERT INTO t_facilities (company_id,name,type) VALUES (v_company_id,'AUDIT Zakład','Plant') RETURNING id INTO v_facility_id;
  INSERT INTO t_storage_locations (facility_id,name,location_type,min_temp,max_temp,is_active) VALUES (v_facility_id,'Chłodnia','chiller',-2,4,true) RETURNING id INTO v_loc_id;
  INSERT INTO t_contractors (company_id,name,tax_id,is_supplier,vet_number) VALUES (v_company_id,'AUDIT Drobimex','PL-AUDIT-S1',true,'PL-VET-AUD') RETURNING id INTO v_supplier_id;
  INSERT INTO t_contractors (company_id,name,tax_id,is_customer) VALUES (v_company_id,'AUDIT Klient','PL-AUDIT-C1',true) RETURNING id INTO v_customer_id;
  INSERT INTO t_products (company_id,name,sku,industry_category,unit) VALUES (v_company_id,'AUDIT Filet','AUD-RAW','RawMeat','kg') RETURNING id INTO v_p_raw;
  INSERT INTO t_products (company_id,name,sku,industry_category,unit) VALUES (v_company_id,'AUDIT Mięso','AUD-MEAT','SemiFinished','kg') RETURNING id INTO v_p_meat;
  INSERT INTO t_products (company_id,name,sku,industry_category,unit,unit_target_weight_kg) VALUES (v_company_id,'AUDIT Kebab 5kg','AUD-KEB','FinishedGood','kg',5) RETURNING id INTO v_p_kebab;
  INSERT INTO t_recipes (company_id,name,base_product_id,product_id,target_yield_percent,is_active) VALUES (v_company_id,'AUDIT Receptura',v_p_meat,v_p_kebab,100,true) RETURNING id INTO v_recipe_id;
  INSERT INTO t_recipe_ingredients (recipe_id,product_id,ratio,role,unit) VALUES (v_recipe_id,v_p_meat,1.0,'MEAT','kg');

  v_pz_number := 'PZ/AUDIT/'||to_char(now(),'YYMMDDHH24MISS');
  INSERT INTO t_warehouse_movements (company_id,facility_id,document_number,type,contractor_id,received_temp_c,received_temp_method,status)
    VALUES (v_company_id,v_facility_id,v_pz_number,'PZ',v_supplier_id,p_temp,'MANUAL_PROBE','Approved') RETURNING id INTO v_pz_id;
  INSERT INTO t_batches (product_id,supplier_id,supplier_batch_number,internal_batch_number,initial_quantity,current_quantity,status,location_id,reception_date,expiration_date,production_date)
    VALUES (v_p_raw,v_supplier_id,'SUP-RAW-001',to_char(now(),'YYMMDDHH24MISS')||'/AUDIT/RAW',1000,1000,'Released',v_loc_id,now(),(now()+interval '14 days')::date,current_date) RETURNING id INTO v_raw_batch_id;
  INSERT INTO t_warehouse_movement_items (movement_id,product_id,batch_id,quantity) VALUES (v_pz_id,v_p_raw,v_raw_batch_id,1000);

  INSERT INTO t_production_orders (company_id,facility_id,order_number,type,status,production_date)
    VALUES (v_company_id,v_facility_id,'ZP-DEC-AUDIT-'||to_char(now(),'HH24MISS'),'Decomposition','Closed',current_date) RETURNING id INTO v_decomp_id;
  INSERT INTO t_production_inputs (production_order_id,batch_id,product_id,weight) VALUES (v_decomp_id,v_raw_batch_id,v_p_raw,1000);
  INSERT INTO t_batches (product_id,internal_batch_number,parent_batch_id,source_event_type,initial_quantity,current_quantity,status,location_id,production_date,expiration_date)
    VALUES (v_p_meat,to_char(now(),'YYMMDDHH24MISS')||'/AUDIT/MEAT',v_raw_batch_id,'DISASSEMBLY',700,700,'Released',v_loc_id,current_date,(now()+interval '7 days')::date) RETURNING id INTO v_meat_batch_id;
  INSERT INTO t_lot_lineage (parent_lot_id,child_lot_id,event_type,qty_kg,process_ref_id,occurred_at) VALUES (v_raw_batch_id,v_meat_batch_id,'DISASSEMBLY',700,v_decomp_id,now());
  INSERT INTO t_production_logs (production_order_id,source_batch_id,output_batch_id,product_id,weight_gross,weight_tare,process_stage)
    VALUES (v_decomp_id,v_raw_batch_id,v_meat_batch_id,v_p_meat,700,0,'Decomposition');

  INSERT INTO t_production_orders (company_id,facility_id,order_number,type,status,production_date,recipe_id)
    VALUES (v_company_id,v_facility_id,'ZP-ASM-AUDIT-'||to_char(now(),'HH24MISS'),'Assembly','Closed',current_date,v_recipe_id) RETURNING id INTO v_assembly_id;
  INSERT INTO t_production_inputs (production_order_id,batch_id,product_id,weight) VALUES (v_assembly_id,v_meat_batch_id,v_p_meat,700);
  INSERT INTO t_batches (product_id,internal_batch_number,parent_batch_id,source_event_type,initial_quantity,current_quantity,status,location_id,production_date,expiration_date)
    VALUES (v_p_kebab,to_char(now(),'YYMMDDHH24MISS')||'/AUDIT/KEB',v_meat_batch_id,'ASSEMBLY',700,700,'Released',v_loc_id,current_date,(current_date+interval '180 days')::date) RETURNING id INTO v_kebab_batch_id;
  INSERT INTO t_lot_lineage (parent_lot_id,child_lot_id,event_type,qty_kg,process_ref_id,occurred_at) VALUES (v_meat_batch_id,v_kebab_batch_id,'ASSEMBLY',700,v_assembly_id,now());

  INSERT INTO t_production_orders (company_id,facility_id,order_number,type,status,production_date)
    VALUES (v_company_id,v_facility_id,'ZP-FRZ-AUDIT-'||to_char(now(),'HH24MISS'),'Freezing','Closed',current_date) RETURNING id INTO v_freeze_id;
  INSERT INTO t_production_logs (production_order_id,source_batch_id,output_batch_id,product_id,weight_gross,weight_tare,process_stage,freezing_started_at,freezing_completed_at,freezing_duration_minutes,latest_core_temp_c,ccp_passed)
    VALUES (v_freeze_id,v_kebab_batch_id,v_kebab_batch_id,v_p_kebab,700,0,'ShockFreezing',now()-interval '4 hours',now(),240,-20,true) RETURNING id INTO v_freeze_log_id;

  v_sscc := public.generate_sscc_number(v_company_id);
  INSERT INTO t_handling_units (company_id,facility_id,sscc_number,type,status,production_date)
    VALUES (v_company_id,v_facility_id,v_sscc,'Pallet','Open',current_date) RETURNING id INTO v_pallet_id;
  INSERT INTO t_production_logs (production_order_id,source_batch_id,output_batch_id,product_id,handling_unit_id,weight_gross,weight_tare,process_stage)
    VALUES (v_freeze_id,v_kebab_batch_id,v_kebab_batch_id,v_p_kebab,v_pallet_id,700,0,'Stacking');
  UPDATE t_handling_units SET status='Closed' WHERE id=v_pallet_id;

  v_shipment_number := 'WZ/AUDIT/'||to_char(now(),'YYMMDDHH24MISS');
  INSERT INTO t_shipments (company_id,facility_id,shipment_number,customer_id,status,dispatch_date,driver_name,truck_plates,trailer_plates,seal_number,transport_temperature)
    VALUES (v_company_id,v_facility_id,v_shipment_number,v_customer_id,'Shipped',current_date,'Jan Audytowy','SK1234A','SK5678P','SEAL-AUD',-21) RETURNING id INTO v_shipment_id;
  INSERT INTO t_shipment_items (shipment_id,product_id,batch_id,handling_unit_id,quantity) VALUES (v_shipment_id,v_p_kebab,v_kebab_batch_id,v_pallet_id,700);

  SELECT count(*) INTO v_lineage_count FROM t_lot_lineage WHERE child_lot_id IN (v_meat_batch_id,v_kebab_batch_id) OR parent_lot_id=v_raw_batch_id OR child_handling_unit_id=v_pallet_id;
  SELECT count(*) INTO v_complaint_count FROM t_supplier_complaints WHERE movement_id=v_pz_id;

  -- Self-validation: każdy audyt E2E zawiera health check schematu
  v_health := public.check_database_integrity();

  RETURN jsonb_build_object(
    'success', true,
    'temp_c', p_temp,
    'company_id', v_company_id,
    'pz_id', v_pz_id,
    'raw_batch_id', v_raw_batch_id,
    'meat_batch_id', v_meat_batch_id,
    'kebab_batch_id', v_kebab_batch_id,
    'pallet_id', v_pallet_id,
    'sscc', v_sscc,
    'shipment_id', v_shipment_id,
    'lineage_rows', v_lineage_count,
    'complaints_count', v_complaint_count,
    'database_health', v_health
  );
END;
$$;