CREATE OR REPLACE FUNCTION public.check_database_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_checks jsonb := '[]'::jsonb;
  v_passed int := 0;
  v_failed int := 0;
  v_total int := 0;
  v_ok boolean;
  v_detail text;
  v_expected_table text;
  v_actual_table text;

  -- Lista oczekiwanych triggerów: tgname → expected_table
  v_triggers text[][] := ARRAY[
    ['trg_create_receiving_lineage',     't_batches'],
    ['trg_create_aggregation_lineage',   't_production_logs'],
    ['trg_create_ccp1_complaint',        't_warehouse_movements'],
    ['trg_ccp1_set_flag',                't_warehouse_movements'],
    ['trg_enforce_ccp3',                 't_handling_units'],
    ['trg_reduce_batch_on_input',        't_production_inputs'],
    ['trg_update_handling_unit_totals',  't_production_logs'],
    ['trg_update_shipment_totals',       't_shipment_items'],
    ['trg_populate_shipment_item_batch', 't_shipment_items'],
    ['trg_mark_handling_unit_shipped',   't_shipment_items'],
    ['trg_validate_recipe_ingredient_role', 't_recipe_ingredients']
  ];

  -- Lista oczekiwanych FK: table.column → ref_table(ref_column)
  v_fks text[][] := ARRAY[
    ['t_production_orders', 'supervisor_id',       't_employees',          'id'],
    ['t_lot_lineage',       'parent_lot_id',       't_batches',            'id'],
    ['t_lot_lineage',       'child_lot_id',        't_batches',            'id'],
    ['t_lot_lineage',       'child_handling_unit_id','t_handling_units',   'id'],
    ['t_production_logs',   'handling_unit_id',    't_handling_units',     'id'],
    ['t_production_logs',   'source_batch_id',     't_batches',            'id'],
    ['t_production_logs',   'output_batch_id',     't_batches',            'id'],
    ['t_supplier_complaints','movement_id',        't_warehouse_movements','id'],
    ['t_shipment_items',    'shipment_id',         't_shipments',          'id'],
    ['t_shipment_items',    'handling_unit_id',    't_handling_units',     'id']
  ];

  -- Lista oczekiwanych GENERATED columns: table.column
  v_gens text[][] := ARRAY[
    ['t_warehouse_movements', 'ccp1_passed']
  ];

  -- Lista oczekiwanych CHECK: conname → required_token (substring który MUSI być w definicji)
  v_checks_def text[][] := ARRAY[
    ['t_production_logs_process_stage_check', 'ShockFreezing'],
    ['t_production_logs_process_stage_check', 'Stacking'],
    ['t_production_logs_process_stage_check', 'Freezing']
  ];

  i int;
  v_def text;
BEGIN
  -- 1) TRIGGERY
  FOR i IN 1 .. array_length(v_triggers, 1) LOOP
    SELECT tgrelid::regclass::text INTO v_actual_table
    FROM pg_trigger
    WHERE tgname = v_triggers[i][1] AND NOT tgisinternal
    LIMIT 1;

    v_expected_table := v_triggers[i][2];
    IF v_actual_table IS NULL THEN
      v_ok := false; v_detail := 'BRAK triggera w pg_trigger';
    ELSIF v_actual_table NOT LIKE '%' || v_expected_table THEN
      v_ok := false; v_detail := format('zły obiekt: %s (oczekiwany %s)', v_actual_table, v_expected_table);
    ELSE
      v_ok := true; v_detail := format('OK na %s', v_actual_table);
    END IF;

    v_checks := v_checks || jsonb_build_object(
      'category', 'trigger',
      'name', v_triggers[i][1],
      'expected', v_expected_table,
      'ok', v_ok,
      'detail', v_detail
    );
    v_total := v_total + 1;
    IF v_ok THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; END IF;
  END LOOP;

  -- 2) FOREIGN KEYS
  FOR i IN 1 .. array_length(v_fks, 1) LOOP
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
      -- sprawdź czy w ogóle jest jakiś FK na tej kolumnie (zły target)
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
      'name', v_fks[i][1] || '.' || v_fks[i][2],
      'expected', v_fks[i][3] || '(' || v_fks[i][4] || ')',
      'ok', v_ok,
      'detail', v_detail
    );
    v_total := v_total + 1;
    IF v_ok THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; END IF;
    v_detail := NULL;
  END LOOP;

  -- 3) GENERATED COLUMNS
  FOR i IN 1 .. array_length(v_gens, 1) LOOP
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
      'name', v_gens[i][1] || '.' || v_gens[i][2],
      'expected', 'GENERATED ALWAYS',
      'ok', v_ok,
      'detail', v_detail
    );
    v_total := v_total + 1;
    IF v_ok THEN v_passed := v_passed + 1; ELSE v_failed := v_failed + 1; END IF;
    v_detail := NULL;
  END LOOP;

  -- 4) CHECK CONSTRAINTS (sprawdzamy czy w pg_get_constraintdef występuje wymagany token)
  FOR i IN 1 .. array_length(v_checks_def, 1) LOOP
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
$$;