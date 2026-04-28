-- =========================================================
-- 1) PODŁĄCZENIE BRAKUJĄCYCH TRIGGERÓW (idempotentnie)
-- =========================================================

-- Receiving lineage: po insert nowej partii bez parenta
DROP TRIGGER IF EXISTS trg_create_receiving_lineage ON public.t_batches;
CREATE TRIGGER trg_create_receiving_lineage
AFTER INSERT ON public.t_batches
FOR EACH ROW EXECUTE FUNCTION public.create_receiving_lineage();

-- Aggregation lineage: po wpisie production_log z handling_unit_id
DROP TRIGGER IF EXISTS trg_create_aggregation_lineage ON public.t_production_logs;
CREATE TRIGGER trg_create_aggregation_lineage
AFTER INSERT OR UPDATE ON public.t_production_logs
FOR EACH ROW EXECUTE FUNCTION public.create_aggregation_lineage();

-- CCP1: auto-reklamacja dostawcy gdy temperatura przyjęcia > +4°C
DROP TRIGGER IF EXISTS trg_create_ccp1_complaint ON public.t_warehouse_movements;
CREATE TRIGGER trg_create_ccp1_complaint
AFTER INSERT ON public.t_warehouse_movements
FOR EACH ROW EXECUTE FUNCTION public.create_ccp1_complaint();

-- CCP3 gate: blokada zamknięcia palety gdy ścieżka nie ma FREEZING z ccp_passed
DROP TRIGGER IF EXISTS trg_enforce_ccp3 ON public.t_handling_units;
CREATE TRIGGER trg_enforce_ccp3
BEFORE UPDATE ON public.t_handling_units
FOR EACH ROW EXECUTE FUNCTION public.enforce_ccp3();

-- Pomocnicze: sumowanie palet i wysyłek, redukcja stanów partii
DROP TRIGGER IF EXISTS trg_update_handling_unit_totals ON public.t_production_logs;
CREATE TRIGGER trg_update_handling_unit_totals
AFTER INSERT OR UPDATE OR DELETE ON public.t_production_logs
FOR EACH ROW EXECUTE FUNCTION public.update_handling_unit_totals();

DROP TRIGGER IF EXISTS trg_update_shipment_totals ON public.t_shipment_items;
CREATE TRIGGER trg_update_shipment_totals
AFTER INSERT OR UPDATE OR DELETE ON public.t_shipment_items
FOR EACH ROW EXECUTE FUNCTION public.update_shipment_totals();

DROP TRIGGER IF EXISTS trg_populate_shipment_item_batch ON public.t_shipment_items;
CREATE TRIGGER trg_populate_shipment_item_batch
BEFORE INSERT ON public.t_shipment_items
FOR EACH ROW EXECUTE FUNCTION public.populate_shipment_item_batch();

DROP TRIGGER IF EXISTS trg_mark_handling_unit_shipped ON public.t_shipment_items;
CREATE TRIGGER trg_mark_handling_unit_shipped
AFTER INSERT ON public.t_shipment_items
FOR EACH ROW EXECUTE FUNCTION public.mark_handling_unit_shipped();

DROP TRIGGER IF EXISTS trg_reduce_batch_quantity ON public.t_production_inputs;
CREATE TRIGGER trg_reduce_batch_quantity
AFTER INSERT ON public.t_production_inputs
FOR EACH ROW EXECUTE FUNCTION public.reduce_batch_quantity_on_input();

DROP TRIGGER IF EXISTS trg_validate_recipe_ingredient_role ON public.t_recipe_ingredients;
CREATE TRIGGER trg_validate_recipe_ingredient_role
BEFORE INSERT OR UPDATE ON public.t_recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_ingredient_role();

-- updated_at na kluczowych tabelach
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      't_companies','t_facilities','t_contractors','t_products','t_recipes',
      't_batches','t_production_orders','t_handling_units','t_shipments',
      't_warehouse_movements'
    ]) AS tbl
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_updated_at ON public.%I;', r.tbl, r.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      r.tbl, r.tbl
    );
  END LOOP;
END $$;

-- =========================================================
-- 2) FUNKCJA CZYSZCZENIA AUDYTU
-- =========================================================
CREATE OR REPLACE FUNCTION public.cleanup_audit_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM t_companies WHERE name = 'AUDIT KTF';
  IF v_company_id IS NULL THEN RETURN; END IF;

  DELETE FROM t_shipment_items WHERE shipment_id IN (SELECT id FROM t_shipments WHERE company_id = v_company_id);
  DELETE FROM t_shipments WHERE company_id = v_company_id;
  DELETE FROM t_production_kebab_variants WHERE production_log_id IN (
    SELECT id FROM t_production_logs WHERE production_order_id IN (
      SELECT id FROM t_production_orders WHERE company_id = v_company_id
    )
  );
  DELETE FROM t_handling_units WHERE company_id = v_company_id;
  DELETE FROM t_production_logs WHERE production_order_id IN (
    SELECT id FROM t_production_orders WHERE company_id = v_company_id
  );
  DELETE FROM t_production_inputs WHERE production_order_id IN (
    SELECT id FROM t_production_orders WHERE company_id = v_company_id
  );
  DELETE FROM t_production_tasks WHERE production_order_id IN (
    SELECT id FROM t_production_orders WHERE company_id = v_company_id
  );
  DELETE FROM t_production_orders WHERE company_id = v_company_id;
  DELETE FROM t_lot_lineage WHERE child_lot_id IN (
    SELECT b.id FROM t_batches b JOIN t_products p ON p.id = b.product_id WHERE p.company_id = v_company_id
  );
  DELETE FROM t_warehouse_movement_items WHERE movement_id IN (
    SELECT id FROM t_warehouse_movements WHERE company_id = v_company_id
  );
  DELETE FROM t_supplier_complaints WHERE movement_id IN (
    SELECT id FROM t_warehouse_movements WHERE company_id = v_company_id
  );
  DELETE FROM t_warehouse_movements WHERE company_id = v_company_id;
  DELETE FROM t_batches WHERE product_id IN (SELECT id FROM t_products WHERE company_id = v_company_id);
  DELETE FROM t_recipe_ingredients WHERE recipe_id IN (SELECT id FROM t_recipes WHERE company_id = v_company_id);
  DELETE FROM t_recipes WHERE company_id = v_company_id;
  DELETE FROM t_products WHERE company_id = v_company_id;
  DELETE FROM t_contractors WHERE company_id = v_company_id;
  DELETE FROM t_storage_locations WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id = v_company_id);
  DELETE FROM t_facilities WHERE company_id = v_company_id;
  DELETE FROM t_companies WHERE id = v_company_id;
END;
$$;

-- =========================================================
-- 3) GŁÓWNA FUNKCJA AUDYTU E2E
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_e2e_flow(p_received_temp_c numeric DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid; v_facility_id uuid; v_loc_id uuid;
  v_supplier_id uuid; v_customer_id uuid;
  v_p_raw uuid; v_p_meat uuid; v_p_kebab uuid;
  v_recipe_id uuid;
  v_pz_id uuid; v_pz_number text;
  v_raw_batch_id uuid; v_meat_batch_id uuid; v_kebab_batch_id uuid;
  v_decomp_id uuid; v_assembly_id uuid; v_freeze_id uuid;
  v_assembly_log_id uuid; v_freeze_log_id uuid;
  v_pallet_id uuid; v_sscc text;
  v_shipment_id uuid; v_shipment_number text;
  v_lineage_count int; v_complaint_count int;
BEGIN
  PERFORM public.cleanup_audit_data();

  -- struktura organizacyjna
  INSERT INTO t_companies (name, short_name, tax_id, is_active)
    VALUES ('AUDIT KTF', 'AUDIT', 'PL-AUDIT-001', true) RETURNING id INTO v_company_id;
  INSERT INTO t_facilities (company_id, name, type)
    VALUES (v_company_id, 'AUDIT Zakład', 'Plant') RETURNING id INTO v_facility_id;
  INSERT INTO t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active)
    VALUES (v_facility_id, 'Chłodnia', 'chiller', -2, 4, true) RETURNING id INTO v_loc_id;

  -- kontrahenci
  INSERT INTO t_contractors (company_id, name, tax_id, is_supplier, vet_number)
    VALUES (v_company_id, 'AUDIT Drobimex', 'PL-AUDIT-S1', true, 'PL-VET-AUD') RETURNING id INTO v_supplier_id;
  INSERT INTO t_contractors (company_id, name, tax_id, is_customer)
    VALUES (v_company_id, 'AUDIT Klient', 'PL-AUDIT-C1', true) RETURNING id INTO v_customer_id;

  -- produkty
  INSERT INTO t_products (company_id, name, sku, industry_category, unit)
    VALUES (v_company_id, 'AUDIT Filet', 'AUD-RAW', 'RawMeat', 'kg') RETURNING id INTO v_p_raw;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit)
    VALUES (v_company_id, 'AUDIT Mięso', 'AUD-MEAT', 'SemiFinished', 'kg') RETURNING id INTO v_p_meat;
  INSERT INTO t_products (company_id, name, sku, industry_category, unit, unit_target_weight_kg)
    VALUES (v_company_id, 'AUDIT Kebab 5kg', 'AUD-KEB', 'FinishedGood', 'kg', 5) RETURNING id INTO v_p_kebab;

  -- receptura (musi mieć poprawne role: MEAT/SPICE/WATER/OTHER — trigger walidujący)
  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, is_active)
    VALUES (v_company_id, 'AUDIT Receptura', v_p_meat, v_p_kebab, 100, true) RETURNING id INTO v_recipe_id;
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, role, unit)
    VALUES (v_recipe_id, v_p_meat, 1.0, 'MEAT', 'kg');

  -- ===== ETAP 1: PZ z CCP1 =====
  v_pz_number := 'PZ/AUDIT/' || to_char(now(),'YYMMDDHH24MISS');
  INSERT INTO t_warehouse_movements
    (company_id, facility_id, document_number, type, contractor_id, received_temp_c, received_temp_method, status)
  VALUES
    (v_company_id, v_facility_id, v_pz_number, 'PZ', v_supplier_id, p_received_temp_c, 'IR_PROBE', 'Approved')
  RETURNING id INTO v_pz_id;

  -- partia surowca (trigger create_receiving_lineage doda RECEIVING)
  INSERT INTO t_batches (product_id, supplier_id, supplier_batch_number, internal_batch_number,
                         initial_quantity, current_quantity, status, location_id, reception_date,
                         expiration_date, production_date)
  VALUES (v_p_raw, v_supplier_id, 'SUP-RAW-001',
          to_char(now(),'YYMMDD') || '/AUDIT/RAW',
          1000, 1000, 'Released', v_loc_id, now(),
          (now() + interval '14 days')::date, current_date)
  RETURNING id INTO v_raw_batch_id;

  INSERT INTO t_warehouse_movement_items (movement_id, product_id, batch_id, quantity)
    VALUES (v_pz_id, v_p_raw, v_raw_batch_id, 1000);

  -- ===== ETAP 2: ROZBIÓR =====
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, 'ZP-DEC-AUDIT', 'Decomposition', 'Closed', current_date)
    RETURNING id INTO v_decomp_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight)
    VALUES (v_decomp_id, v_raw_batch_id, v_p_raw, 1000);
  INSERT INTO t_batches (product_id, internal_batch_number, parent_batch_id, source_event_type,
                         initial_quantity, current_quantity, status, location_id, production_date,
                         expiration_date)
    VALUES (v_p_meat, to_char(now(),'YYMMDD')||'/AUDIT/MEAT', v_raw_batch_id, 'DECOMPOSITION',
            700, 700, 'Released', v_loc_id, current_date, (now()+interval '7 days')::date)
    RETURNING id INTO v_meat_batch_id;
  INSERT INTO t_lot_lineage (parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, occurred_at)
    VALUES (v_raw_batch_id, v_meat_batch_id, 'DECOMPOSITION', 700, v_decomp_id, now());
  INSERT INTO t_production_logs (production_order_id, source_batch_id, output_batch_id, product_id,
                                 weight_gross, weight_tare, weight_net, process_stage)
    VALUES (v_decomp_id, v_raw_batch_id, v_meat_batch_id, v_p_meat, 700, 0, 700, 'Decomposition');

  -- ===== ETAP 3: KEBAB ASSEMBLY =====
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date, recipe_id)
    VALUES (v_company_id, v_facility_id, 'ZP-ASM-AUDIT', 'Assembly', 'Closed', current_date, v_recipe_id)
    RETURNING id INTO v_assembly_id;
  INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight)
    VALUES (v_assembly_id, v_meat_batch_id, v_p_meat, 700);
  INSERT INTO t_batches (product_id, internal_batch_number, parent_batch_id, source_event_type,
                         initial_quantity, current_quantity, status, location_id, production_date,
                         expiration_date)
    VALUES (v_p_kebab, to_char(now(),'YYMMDD')||'/AUDIT/KEB', v_meat_batch_id, 'ASSEMBLY',
            700, 700, 'Released', v_loc_id, current_date, (now()+interval '180 days')::date)
    RETURNING id INTO v_kebab_batch_id;
  INSERT INTO t_lot_lineage (parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, occurred_at)
    VALUES (v_meat_batch_id, v_kebab_batch_id, 'ASSEMBLY', 700, v_assembly_id, now());
  INSERT INTO t_production_logs (production_order_id, source_batch_id, output_batch_id, product_id,
                                 weight_gross, weight_tare, weight_net, process_stage,
                                 packaging_type, packaging_count, recipe_id)
    VALUES (v_assembly_id, v_meat_batch_id, v_kebab_batch_id, v_p_kebab,
            700, 0, 700, 'Assembly', 'Słupek 5kg', 140, v_recipe_id)
    RETURNING id INTO v_assembly_log_id;

  -- ===== ETAP 4: MROŻENIE z CCP3 (ccp_passed=true!) =====
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, 'ZP-FRZ-AUDIT', 'Freezing', 'Closed', current_date)
    RETURNING id INTO v_freeze_id;
  INSERT INTO t_production_logs (production_order_id, source_batch_id, output_batch_id, product_id,
                                 weight_gross, weight_tare, weight_net, process_stage,
                                 freezing_started_at, freezing_completed_at, freezing_duration_minutes,
                                 latest_core_temp_c, target_core_temp_c, ccp_passed)
    VALUES (v_freeze_id, v_kebab_batch_id, v_kebab_batch_id, v_p_kebab,
            700, 0, 700, 'ShockFreezing',
            now() - interval '4 hours', now(), 240,
            -20.0, -18.0, true)
    RETURNING id INTO v_freeze_log_id;
  INSERT INTO t_lot_lineage (parent_lot_id, child_lot_id, event_type, qty_kg, process_ref_id, occurred_at)
    VALUES (v_kebab_batch_id, v_kebab_batch_id, 'FREEZING', 700, v_freeze_id, now());
  INSERT INTO t_freezing_temp_log (production_log_id, recorded_at, core_temp_c, ambient_temp_c, source)
    VALUES (v_freeze_log_id, now(), -20.0, -28.0, 'manual');

  -- ===== ETAP 5: PALETA z SSCC (Open) =====
  v_sscc := public.generate_sscc_number(v_company_id);
  INSERT INTO t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, v_sscc, 'Pallet', 'Open', current_date)
    RETURNING id INTO v_pallet_id;

  -- przypisanie production_log freezingowego do palety (trigger AGGREGATION dopisze lineage)
  UPDATE t_production_logs SET handling_unit_id = v_pallet_id WHERE id = v_freeze_log_id;

  -- zamknięcie palety (CCP3 trigger powinien przepuścić bo ccp_passed=true)
  UPDATE t_handling_units SET status = 'Closed' WHERE id = v_pallet_id;

  -- ===== ETAP 6: WZ =====
  v_shipment_number := 'WZ/AUDIT/' || to_char(now(),'YYMMDDHH24MISS');
  INSERT INTO t_shipments (company_id, facility_id, shipment_number, customer_id, status,
                           dispatch_date, driver_name, truck_plates)
    VALUES (v_company_id, v_facility_id, v_shipment_number, v_customer_id, 'Shipped',
            current_date, 'Audyt Kierowca', 'WA AUDIT')
    RETURNING id INTO v_shipment_id;
  INSERT INTO t_shipment_items (shipment_id, handling_unit_id, product_id, quantity)
    VALUES (v_shipment_id, v_pallet_id, v_p_kebab, 700);

  -- raport końcowy
  SELECT count(*) INTO v_lineage_count FROM t_lot_lineage
    WHERE child_lot_id IN (v_raw_batch_id, v_meat_batch_id, v_kebab_batch_id)
       OR child_handling_unit_id = v_pallet_id;
  SELECT count(*) INTO v_complaint_count FROM t_supplier_complaints WHERE movement_id = v_pz_id;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'facility_id', v_facility_id,
    'pz_id', v_pz_id, 'pz_number', v_pz_number,
    'received_temp_c', p_received_temp_c,
    'raw_batch_id', v_raw_batch_id,
    'meat_batch_id', v_meat_batch_id,
    'kebab_batch_id', v_kebab_batch_id,
    'pallet_id', v_pallet_id, 'sscc', v_sscc,
    'shipment_id', v_shipment_id, 'shipment_number', v_shipment_number,
    'lineage_count', v_lineage_count,
    'complaint_count', v_complaint_count
  );
END;
$$;