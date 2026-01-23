-- Naprawa funkcji symulacji - poprawne wartości contract_type
CREATE OR REPLACE FUNCTION public.simulate_full_production_day()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    -- IDs
    v_company_id UUID;
    v_facility_id UUID;
    v_employee_jan UUID;
    v_employee_adam UUID;
    v_employee_anna UUID;
    v_supplier_id UUID;
    v_customer_id UUID;
    v_carrier_id UUID;
    -- Storage Locations
    v_location_chiller UUID;
    v_location_freezer UUID;
    v_location_production UUID;
    -- Products
    v_product_raw_id UUID;
    v_product_fillet_id UUID;
    v_product_bones_id UUID;
    v_product_kebab_id UUID;
    v_product_e2_id UUID;
    -- Recipe
    v_recipe_id UUID;
    -- Batches
    v_batch_input_id UUID;
    v_batch_fillet_id UUID;
    v_batch_bones_id UUID;
    v_batch_kebab_id UUID;
    -- Production Orders
    v_order_rozbior_id UUID;
    v_order_kebab_id UUID;
    -- Warehouse Movement
    v_pz_movement_id UUID;
    -- Handling Units (Pallets)
    v_pallet_1_id UUID;
    v_pallet_2_id UUID;
    v_pallet_3_id UUID;
    v_pallet_4_id UUID;
    -- Shipment
    v_shipment_id UUID;
    -- Counters
    v_i INTEGER;
BEGIN
    SET LOCAL row_security = OFF;

    -- CLEANUP
    DELETE FROM public.t_packaging_transactions;
    DELETE FROM public.t_shipment_items;
    DELETE FROM public.t_shipments;
    DELETE FROM public.t_handling_units;
    DELETE FROM public.t_production_logs;
    DELETE FROM public.t_production_inputs;
    DELETE FROM public.t_production_orders;
    DELETE FROM public.t_warehouse_movement_items;
    DELETE FROM public.t_warehouse_movements;
    DELETE FROM public.t_batches;
    DELETE FROM public.t_recipe_ingredients;
    DELETE FROM public.t_recipes;
    DELETE FROM public.t_products;
    DELETE FROM public.t_employees;
    DELETE FROM public.t_departments;
    DELETE FROM public.t_contractors;
    DELETE FROM public.t_storage_locations;
    DELETE FROM public.t_facilities;
    DELETE FROM public.t_companies;
    
    -- SETUP: Company & Facility
    INSERT INTO public.t_companies (name, short_name, tax_id)
    VALUES ('Narrow Sp. z o.o.', 'NARROW', '1234567890')
    RETURNING id INTO v_company_id;
    
    INSERT INTO public.t_facilities (company_id, name, type, vet_approval_number)
    VALUES (v_company_id, 'Zakład Myszków', 'Plant', 'PL24094301WE')
    RETURNING id INTO v_facility_id;
    
    -- Storage Locations
    INSERT INTO public.t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active)
    VALUES (v_facility_id, 'Chłodnia Przyjęć', 'chiller', 0, 4, true)
    RETURNING id INTO v_location_chiller;
    
    INSERT INTO public.t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active)
    VALUES (v_facility_id, 'Mroźnia Wyrobów', 'freezer', -22, -18, true)
    RETURNING id INTO v_location_freezer;
    
    INSERT INTO public.t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active)
    VALUES (v_facility_id, 'Hala Produkcyjna', 'production', 8, 12, true)
    RETURNING id INTO v_location_production;
    
    -- Employees (używamy UoP zamiast Employment!)
    INSERT INTO public.t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, contract_type)
    VALUES (v_company_id, v_facility_id, 'Jan', 'Kowalski', 'Operator Wagi', 'QR_JAN', 'UoP')
    RETURNING id INTO v_employee_jan;
    
    INSERT INTO public.t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, contract_type)
    VALUES (v_company_id, v_facility_id, 'Adam', 'Nowak', 'Trybowszczyk', 'QR_ADAM', 'UoP')
    RETURNING id INTO v_employee_adam;
    
    INSERT INTO public.t_employees (company_id, facility_id, first_name, last_name, job_position, qr_login_code, contract_type)
    VALUES (v_company_id, v_facility_id, 'Anna', 'Zmiana', 'Kierownik Zmiany', 'QR_ANNA', 'UoP')
    RETURNING id INTO v_employee_anna;
    
    -- Contractors
    INSERT INTO public.t_contractors (company_id, name, tax_id, is_supplier, vet_number)
    VALUES (v_company_id, '2Mundos S.A.', '5223135900', true, 'ES12345678')
    RETURNING id INTO v_supplier_id;
    
    INSERT INTO public.t_contractors (company_id, name, is_customer, vet_number)
    VALUES (v_company_id, 'Josef Schnabels GmbH', true, 'DE987654321')
    RETURNING id INTO v_customer_id;
    
    INSERT INTO public.t_contractors (company_id, name, is_logistics)
    VALUES (v_company_id, 'Trans-Europa Sp. z o.o.', true)
    RETURNING id INTO v_carrier_id;
    
    -- Products
    INSERT INTO public.t_products (company_id, name, sku, unit, is_raw_material, default_expiration_days, min_storage_temp, max_storage_temp)
    VALUES (v_company_id, 'Ćwiartka Kurczaka A', 'SU-001', 'kg', true, 7, 0, 4)
    RETURNING id INTO v_product_raw_id;
    
    INSERT INTO public.t_products (company_id, name, sku, unit, is_raw_material, default_expiration_days)
    VALUES (v_company_id, 'Filet z piersi', 'PP-001', 'kg', false, 5)
    RETURNING id INTO v_product_fillet_id;
    
    INSERT INTO public.t_products (company_id, name, sku, unit, is_raw_material, default_expiration_days)
    VALUES (v_company_id, 'Kości', 'ODP-001', 'kg', false, 3)
    RETURNING id INTO v_product_bones_id;
    
    INSERT INTO public.t_products (company_id, name, sku, unit, is_raw_material, default_expiration_days, min_storage_temp, max_storage_temp)
    VALUES (v_company_id, 'Kebab Czerwony 15kg', 'KEB-RED', 'kg', false, 180, -20, -18)
    RETURNING id INTO v_product_kebab_id;
    
    INSERT INTO public.t_products (company_id, name, sku, unit, is_raw_material)
    VALUES (v_company_id, 'Pojemnik E2', 'OPK-E2', 'szt', false)
    RETURNING id INTO v_product_e2_id;
    
    -- Recipe
    INSERT INTO public.t_recipes (company_id, product_id, name, description)
    VALUES (v_company_id, v_product_kebab_id, 'Kebab Standard', 'Receptura: 90% Filet + 10% woda/przyprawy')
    RETURNING id INTO v_recipe_id;
    
    INSERT INTO public.t_recipe_ingredients (recipe_id, product_id, ratio, unit)
    VALUES (v_recipe_id, v_product_fillet_id, 0.90, 'kg');
    
    -- WMS: Goods Receipt (PZ)
    INSERT INTO public.t_warehouse_movements (
        company_id, facility_id, type, document_number, 
        contractor_id, external_doc_number, driver_name, car_plates,
        reception_temp, status
    )
    VALUES (
        v_company_id, v_facility_id, 'PZ', 'PZ/2026/01/001',
        v_supplier_id, 'HDI-2M-2026-001', 'Carlos Rodriguez', 'M 1234 ABC',
        2.5, 'Approved'
    )
    RETURNING id INTO v_pz_movement_id;
    
    -- Input batch with location
    INSERT INTO public.t_batches (
        product_id, internal_batch_number, supplier_batch_number, supplier_id,
        initial_quantity, current_quantity, 
        production_date, expiration_date, status, location_id
    )
    VALUES (
        v_product_raw_id, TO_CHAR(NOW(), 'YYYYMMDD') || '/SU-001/001',
        '2M-BATCH-2026-001', v_supplier_id,
        5000, 5000, CURRENT_DATE - 1, CURRENT_DATE + 6, 'Released', v_location_chiller
    )
    RETURNING id INTO v_batch_input_id;
    
    INSERT INTO public.t_warehouse_movement_items (movement_id, product_id, batch_id, quantity)
    VALUES (v_pz_movement_id, v_product_raw_id, v_batch_input_id, 5000);
    
    -- Packaging received from driver
    INSERT INTO public.t_packaging_transactions (company_id, contractor_id, type, packaging_type, quantity, comments)
    VALUES 
        (v_company_id, v_supplier_id, 'Received', 'Paleta EUR', 15, 'PZ/2026/01/001'),
        (v_company_id, v_supplier_id, 'Received', 'E2', 100, 'PZ/2026/01/001');
    
    -- MES: Decomposition Order
    INSERT INTO public.t_production_orders (company_id, facility_id, order_number, type, status, production_date, supervisor_id)
    VALUES (v_company_id, v_facility_id, 'ROZ/2026/01/23/01', 'Decomposition', 'Open', CURRENT_DATE, v_employee_anna)
    RETURNING id INTO v_order_rozbior_id;
    
    -- Production input with direction
    INSERT INTO public.t_production_inputs (production_order_id, batch_id, product_id, weight, created_by, direction)
    VALUES (v_order_rozbior_id, v_batch_input_id, v_product_raw_id, 5000, v_employee_jan, 'SWIEZE');
    
    UPDATE public.t_batches SET current_quantity = 0 WHERE id = v_batch_input_id;
    
    -- Fillet batch with location
    INSERT INTO public.t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_product_fillet_id, TO_CHAR(NOW(), 'YYYYMMDD') || '/PP-001/001', 3000, 3000, CURRENT_DATE, CURRENT_DATE + 4, 'Released', v_location_chiller)
    RETURNING id INTO v_batch_fillet_id;
    
    -- Production logs: Fillet (50x60kg = 3000kg)
    FOR v_i IN 1..50 LOOP
        INSERT INTO public.t_production_logs (production_order_id, employee_id, product_id, source_batch_id, weight_gross, weight_tare, packaging_type, packaging_count, scale_device_id)
        VALUES (v_order_rozbior_id, v_employee_jan, v_product_fillet_id, v_batch_input_id, 62.0, 2.0, 'E2', 1, 'SCALE_01');
    END LOOP;
    
    -- Production logs: Bones (38x50kg = 1900kg)
    FOR v_i IN 1..38 LOOP
        INSERT INTO public.t_production_logs (production_order_id, employee_id, product_id, source_batch_id, weight_gross, weight_tare, packaging_type, packaging_count, scale_device_id)
        VALUES (v_order_rozbior_id, v_employee_adam, v_product_bones_id, v_batch_input_id, 52.0, 2.0, 'E2', 1, 'SCALE_02');
    END LOOP;
    
    -- Bones batch with location
    INSERT INTO public.t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_product_bones_id, TO_CHAR(NOW(), 'YYYYMMDD') || '/ODP-001/001', 1900, 1900, CURRENT_DATE, CURRENT_DATE + 2, 'Released', v_location_chiller)
    RETURNING id INTO v_batch_bones_id;
    
    UPDATE public.t_production_orders SET status = 'Closed' WHERE id = v_order_rozbior_id;
    
    -- MES: Processing Order (Kebab)
    INSERT INTO public.t_production_orders (company_id, facility_id, order_number, type, status, production_date, machine_id)
    VALUES (v_company_id, v_facility_id, 'PRZ/2026/01/23/01', 'Processing', 'Open', CURRENT_DATE, 'MASOWNICA_1')
    RETURNING id INTO v_order_kebab_id;
    
    INSERT INTO public.t_production_inputs (production_order_id, batch_id, product_id, weight, created_by, direction)
    VALUES (v_order_kebab_id, v_batch_fillet_id, v_product_fillet_id, 3000, v_employee_jan, 'KEBAB');
    
    UPDATE public.t_batches SET current_quantity = 0 WHERE id = v_batch_fillet_id;
    
    -- Kebab batch with location (freezer)
    INSERT INTO public.t_batches (product_id, internal_batch_number, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_product_kebab_id, TO_CHAR(NOW(), 'YYYYMMDD') || '/KEB-RED/001', 3300, 3300, CURRENT_DATE, CURRENT_DATE + 179, 'Released', v_location_freezer)
    RETURNING id INTO v_batch_kebab_id;
    
    -- Production logs: Kebab (220x15kg = 3300kg)
    FOR v_i IN 1..220 LOOP
        INSERT INTO public.t_production_logs (production_order_id, employee_id, product_id, source_batch_id, weight_gross, weight_tare, packaging_type, packaging_count, scale_device_id)
        VALUES (v_order_kebab_id, v_employee_jan, v_product_kebab_id, v_batch_fillet_id, 15.5, 0.5, 'Poliblok', 1, 'SCALE_03');
    END LOOP;
    
    UPDATE public.t_production_orders SET status = 'Closed' WHERE id = v_order_kebab_id;
    
    -- LOGISTICS: Pallets
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0001', 'Pallet', 'Closed', CURRENT_DATE)
    RETURNING id INTO v_pallet_1_id;
    
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0002', 'Pallet', 'Closed', CURRENT_DATE)
    RETURNING id INTO v_pallet_2_id;
    
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0003', 'Pallet', 'Closed', CURRENT_DATE)
    RETURNING id INTO v_pallet_3_id;
    
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0004', 'Pallet', 'Closed', CURRENT_DATE)
    RETURNING id INTO v_pallet_4_id;
    
    -- Assign logs to pallets
    WITH numbered_logs AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
        FROM public.t_production_logs
        WHERE production_order_id = v_order_kebab_id AND product_id = v_product_kebab_id
    )
    UPDATE public.t_production_logs pl
    SET handling_unit_id = CASE 
        WHEN nl.rn <= 55 THEN v_pallet_1_id
        WHEN nl.rn <= 110 THEN v_pallet_2_id
        WHEN nl.rn <= 165 THEN v_pallet_3_id
        ELSE v_pallet_4_id
    END
    FROM numbered_logs nl WHERE pl.id = nl.id;
    
    UPDATE public.t_batches SET current_quantity = 0 WHERE id = v_batch_kebab_id;
    
    -- Shipment
    INSERT INTO public.t_shipments (company_id, facility_id, shipment_number, status, customer_id, carrier_id, driver_name, truck_plates, trailer_plates, transport_temperature, dispatch_date)
    VALUES (v_company_id, v_facility_id, 'WZ/2026/01/001', 'Shipped', v_customer_id, v_carrier_id, 'Hans Mueller', 'SK 44222', 'SK 44223', -18.0, CURRENT_DATE)
    RETURNING id INTO v_shipment_id;
    
    INSERT INTO public.t_shipment_items (shipment_id, handling_unit_id)
    VALUES (v_shipment_id, v_pallet_1_id), (v_shipment_id, v_pallet_2_id), (v_shipment_id, v_pallet_3_id), (v_shipment_id, v_pallet_4_id);
    
    UPDATE public.t_handling_units SET status = 'Shipped' WHERE id IN (v_pallet_1_id, v_pallet_2_id, v_pallet_3_id, v_pallet_4_id);
    
    -- Packaging issued to customer
    INSERT INTO public.t_packaging_transactions (company_id, shipment_id, contractor_id, type, packaging_type, quantity)
    VALUES (v_company_id, v_shipment_id, v_customer_id, 'Issued', 'Paleta EUR', 4), (v_company_id, v_shipment_id, v_customer_id, 'Issued', 'Karton', 220);
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Symulacja zakończona pomyślnie',
        'summary', jsonb_build_object(
            'company_id', v_company_id,
            'facility_id', v_facility_id,
            'input_weight_kg', 5000,
            'fillet_produced_kg', 3000,
            'bones_produced_kg', 1900,
            'technological_loss_kg', 100,
            'yield_decomposition_pct', 60,
            'kebab_produced_kg', 3300,
            'kebab_blocks', 220,
            'pallets_created', 4,
            'shipment_status', 'Shipped',
            'bones_remaining_kg', 1900,
            'kebab_remaining_kg', 0,
            'chiller_location_id', v_location_chiller,
            'freezer_location_id', v_location_freezer,
            'batches_with_location', 4,
            'packaging_received', 2,
            'packaging_issued', 2
        ),
        'employees', jsonb_build_object(
            'jan_kowalski_id', v_employee_jan,
            'adam_nowak_id', v_employee_adam,
            'anna_zmiana_id', v_employee_anna
        ),
        'test_codes', jsonb_build_object('qr_jan', 'QR_JAN', 'qr_adam', 'QR_ADAM', 'qr_anna', 'QR_ANNA'),
        'storage_locations', jsonb_build_object('chiller', v_location_chiller, 'freezer', v_location_freezer, 'production', v_location_production)
    );
END;
$function$;