-- =====================================================================
-- Demo seed: minimalny zestaw do prezentacji + cleanup
-- =====================================================================

CREATE OR REPLACE FUNCTION public.seed_minimal_demo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_facility_id uuid;
  v_supp_drobimex uuid;
  v_supp_indykpol uuid;
  v_supp_polfarmer uuid;
  v_prod_filet uuid;
  v_prod_udo uuid;
  v_prod_masa uuid;
  v_prod_kb_white uuid;
  v_prod_kb_red uuid;
  v_recipe_white uuid;
  v_recipe_red uuid;
  v_emp1 uuid; v_emp2 uuid; v_emp3 uuid; v_emp4 uuid;
  v_order_id uuid;
BEGIN
  -- Wyczyść poprzedni demo
  PERFORM public.cleanup_demo_data();

  -- 1. FIRMA + ZAKŁAD
  INSERT INTO t_companies (name, short_name, tax_id, is_active)
  VALUES ('NARROW Sp. z o.o.', 'DEMO_NARROW', 'DEMO-1234567890', true)
  RETURNING id INTO v_company_id;

  INSERT INTO t_facilities (company_id, name, type, vet_approval_number)
  VALUES (v_company_id, 'Myszków', 'Plant', 'DEMO-VET-001')
  RETURNING id INTO v_facility_id;

  -- 2. DOSTAWCY
  INSERT INTO t_contractors (company_id, name, tax_id, is_supplier, vet_number)
  VALUES (v_company_id, 'DEMO Drobimex', 'DEMO-DROB', true, 'PL-DEMO-1')
  RETURNING id INTO v_supp_drobimex;

  INSERT INTO t_contractors (company_id, name, tax_id, is_supplier, vet_number)
  VALUES (v_company_id, 'DEMO Indykpol', 'DEMO-INDY', true, 'PL-DEMO-2')
  RETURNING id INTO v_supp_indykpol;

  INSERT INTO t_contractors (company_id, name, tax_id, is_supplier)
  VALUES (v_company_id, 'DEMO PolfarmerPrzyprawy', 'DEMO-POLF', true)
  RETURNING id INTO v_supp_polfarmer;

  -- 3. PRODUKTY (5)
  INSERT INTO t_products (company_id, name, sku, unit, industry_category, is_raw_material, default_expiration_days)
  VALUES (v_company_id, 'DEMO Filet z piersi', 'DEMO-FIL', 'kg', 'RawMeat', true, 7)
  RETURNING id INTO v_prod_filet;

  INSERT INTO t_products (company_id, name, sku, unit, industry_category, is_raw_material, default_expiration_days)
  VALUES (v_company_id, 'DEMO Udo BK', 'DEMO-UDO', 'kg', 'RawMeat', true, 7)
  RETURNING id INTO v_prod_udo;

  INSERT INTO t_products (company_id, name, sku, unit, industry_category, is_raw_material, default_expiration_days)
  VALUES (v_company_id, 'DEMO Mieszanka kebab masa', 'DEMO-MASA', 'kg', 'SemiFinished', false, 3)
  RETURNING id INTO v_prod_masa;

  INSERT INTO t_products (company_id, name, sku, unit, industry_category, is_raw_material, default_expiration_days, unit_target_weight_kg, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'DEMO Kebab Biały 5kg', 'DEMO-KB-W5', 'szt', 'FinishedGood', false, 365, 5, -22, -18)
  RETURNING id INTO v_prod_kb_white;

  INSERT INTO t_products (company_id, name, sku, unit, industry_category, is_raw_material, default_expiration_days, unit_target_weight_kg, min_storage_temp, max_storage_temp)
  VALUES (v_company_id, 'DEMO Kebab Czerwony 10kg', 'DEMO-KB-R10', 'szt', 'FinishedGood', false, 365, 10, -22, -18)
  RETURNING id INTO v_prod_kb_red;

  -- 4. RECEPTURY (2) — base = SemiFinished (masa)
  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, evaporation_percent, is_active)
  VALUES (v_company_id, 'DEMO Kebab Biały', v_prod_masa, v_prod_kb_white, 100, 0, true)
  RETURNING id INTO v_recipe_white;

  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, role, unit)
  VALUES
    (v_recipe_white, v_prod_udo,       0.80, 'MEAT',    'kg'),
    (v_recipe_white, v_prod_masa,      0.05, 'SPICE',   'kg'),
    (v_recipe_white, v_prod_masa,      0.15, 'WATER',   'kg');

  INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, evaporation_percent, is_active)
  VALUES (v_company_id, 'DEMO Kebab Czerwony', v_prod_masa, v_prod_kb_red, 100, 0, true)
  RETURNING id INTO v_recipe_red;

  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, role, unit)
  VALUES
    (v_recipe_red, v_prod_filet, 0.80, 'MEAT',  'kg'),
    (v_recipe_red, v_prod_masa,  0.05, 'SPICE', 'kg'),
    (v_recipe_red, v_prod_masa,  0.15, 'WATER', 'kg');

  -- 5. PRACOWNICY (4) z QR
  INSERT INTO t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active)
  VALUES (v_company_id, v_facility_id, 'DEMO Anna',  'Nowak',     'Rampa',   'DEMO-EMP-RAMP',     true)
  RETURNING id INTO v_emp1;

  INSERT INTO t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active)
  VALUES (v_company_id, v_facility_id, 'DEMO Tomek', 'Kowalski',  'Rozbiór', 'DEMO-EMP-DECOMP',   true)
  RETURNING id INTO v_emp2;

  INSERT INTO t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active)
  VALUES (v_company_id, v_facility_id, 'DEMO Marek', 'Wójcik',    'Kebab',   'DEMO-EMP-KEBAB',    true)
  RETURNING id INTO v_emp3;

  INSERT INTO t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active)
  VALUES (v_company_id, v_facility_id, 'DEMO Kasia', 'Kowalik',   'Mrożenie','DEMO-EMP-FREEZE',   true)
  RETURNING id INTO v_emp4;

  -- 6. ZLECENIE PRODUKCYJNE (Decomposition, Open)
  INSERT INTO t_production_orders (company_id, facility_id, order_number, type, status, supervisor_id, production_date, notes)
  VALUES (v_company_id, v_facility_id, 'DEMO-ROZ-' || to_char(now(), 'YYMMDDHH24MI'),
          'Decomposition', 'Open', v_emp2, CURRENT_DATE,
          'Demo: rozbiór przygotowany do prezentacji')
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'facility_id', v_facility_id,
    'products_count', 5,
    'recipes_count', 2,
    'employees_count', 4,
    'suppliers_count', 3,
    'open_orders', 1,
    'order_id', v_order_id
  );
END;
$$;

-- =====================================================================
-- Cleanup: kasuje wszystko z prefixem DEMO_NARROW / DEMO-
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_deleted_orders int := 0;
  v_deleted_batches int := 0;
BEGIN
  SELECT id INTO v_company_id FROM t_companies WHERE short_name = 'DEMO_NARROW' LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Brak danych demo do wyczyszczenia');
  END IF;

  -- Kasuj rzeczy zależne, których nie obsłuży kaskada (lineage, logs, items)
  DELETE FROM t_freezing_temp_log
   WHERE production_log_id IN (
     SELECT pl.id FROM t_production_logs pl
     JOIN t_production_orders po ON po.id = pl.production_order_id
     WHERE po.company_id = v_company_id
   );

  DELETE FROM t_lot_lineage
   WHERE child_lot_id IN (SELECT id FROM t_batches b
     JOIN t_products p ON p.id = b.product_id WHERE p.company_id = v_company_id)
      OR parent_lot_id IN (SELECT id FROM t_batches b
     JOIN t_products p ON p.id = b.product_id WHERE p.company_id = v_company_id);

  DELETE FROM t_production_kebab_variants
   WHERE production_log_id IN (
     SELECT pl.id FROM t_production_logs pl
     JOIN t_production_orders po ON po.id = pl.production_order_id
     WHERE po.company_id = v_company_id
   );

  DELETE FROM t_production_logs
   WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id);

  DELETE FROM t_production_inputs
   WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id);

  DELETE FROM t_production_tasks
   WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id);

  DELETE FROM t_production_orders WHERE company_id = v_company_id
   RETURNING 1 INTO v_deleted_orders;

  DELETE FROM t_shipment_items
   WHERE shipment_id IN (SELECT id FROM t_shipments WHERE company_id = v_company_id);
  DELETE FROM t_shipments WHERE company_id = v_company_id;

  DELETE FROM t_handling_units WHERE company_id = v_company_id;

  DELETE FROM t_batches
   WHERE product_id IN (SELECT id FROM t_products WHERE company_id = v_company_id);

  DELETE FROM t_recipe_ingredients
   WHERE recipe_id IN (SELECT id FROM t_recipes WHERE company_id = v_company_id);
  DELETE FROM t_recipes WHERE company_id = v_company_id;

  DELETE FROM t_employees WHERE company_id = v_company_id;
  DELETE FROM t_products WHERE company_id = v_company_id;
  DELETE FROM t_contractors WHERE company_id = v_company_id;
  DELETE FROM t_storage_locations WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id = v_company_id);
  DELETE FROM t_departments WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id = v_company_id);
  DELETE FROM t_facilities WHERE company_id = v_company_id;
  DELETE FROM t_companies WHERE id = v_company_id;

  RETURN jsonb_build_object('success', true, 'deleted_company', v_company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_minimal_demo() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_demo_data() TO anon, authenticated;