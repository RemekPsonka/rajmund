-- Aktualizacja funkcji close_production_order_with_batches aby poprawnie tworzyła partie wynikowe
CREATE OR REPLACE FUNCTION public.close_production_order_with_batches(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order RECORD;
    v_product RECORD;
    v_batch_id UUID;
    v_batch_number TEXT;
    v_total_weight DECIMAL(10,2);
    v_created_batches JSONB := '[]'::JSONB;
    v_facility_location_id UUID;
BEGIN
    -- Pobierz zlecenie
    SELECT * INTO v_order FROM public.t_production_orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;
    
    IF v_order.status != 'Open' THEN
        RAISE EXCEPTION 'Order is not open: %', v_order.status;
    END IF;
    
    -- Pobierz domyślną lokalizację produkcji dla zakładu
    SELECT id INTO v_facility_location_id
    FROM public.t_storage_locations
    WHERE facility_id = v_order.facility_id
    AND location_type = 'production'
    LIMIT 1;
    
    -- Dla każdego unikalnego produktu w logach produkcyjnych
    FOR v_product IN 
        SELECT 
            pl.product_id,
            p.name as product_name,
            p.sku,
            p.default_expiration_days,
            p.min_storage_temp,
            p.max_storage_temp,
            SUM(pl.weight_net) as total_net_weight
        FROM public.t_production_logs pl
        JOIN public.t_products p ON p.id = pl.product_id
        WHERE pl.production_order_id = p_order_id
        GROUP BY pl.product_id, p.name, p.sku, p.default_expiration_days, p.min_storage_temp, p.max_storage_temp
    LOOP
        -- Generuj numer partii
        v_batch_number := TO_CHAR(NOW(), 'YYYYMMDD') || '/' || COALESCE(v_product.sku, 'XXX') || '/' || 
            LPAD((SELECT COUNT(*) + 1 FROM public.t_batches WHERE internal_batch_number LIKE TO_CHAR(NOW(), 'YYYYMMDD') || '/' || COALESCE(v_product.sku, 'XXX') || '/%')::TEXT, 3, '0');
        
        -- Wybierz lokalizację na podstawie temperatury produktu
        SELECT id INTO v_facility_location_id
        FROM public.t_storage_locations
        WHERE facility_id = v_order.facility_id
        AND is_active = true
        AND (
            (v_product.min_storage_temp IS NOT NULL AND min_temp <= v_product.min_storage_temp AND max_temp >= v_product.min_storage_temp)
            OR (v_product.max_storage_temp IS NOT NULL AND min_temp <= v_product.max_storage_temp)
            OR location_type = 'production'
        )
        ORDER BY 
            CASE WHEN v_product.min_storage_temp < 0 THEN 
                CASE WHEN location_type = 'freezer' THEN 1 ELSE 2 END
            ELSE 
                CASE WHEN location_type = 'chiller' THEN 1 ELSE 2 END
            END
        LIMIT 1;
        
        -- Utwórz partię wynikową
        INSERT INTO public.t_batches (
            product_id,
            internal_batch_number,
            initial_quantity,
            current_quantity,
            production_date,
            expiration_date,
            status,
            location_id
        ) VALUES (
            v_product.product_id,
            v_batch_number,
            v_product.total_net_weight,
            v_product.total_net_weight,
            CURRENT_DATE,
            CURRENT_DATE + COALESCE(v_product.default_expiration_days, 30),
            'Released',
            v_facility_location_id
        )
        RETURNING id INTO v_batch_id;
        
        -- KLUCZOWE: Zaktualizuj logi produkcyjne - przypisz partię wynikową
        UPDATE public.t_production_logs
        SET output_batch_id = v_batch_id
        WHERE production_order_id = p_order_id
        AND product_id = v_product.product_id;
        
        -- Dodaj do listy utworzonych partii
        v_created_batches := v_created_batches || jsonb_build_object(
            'batch_id', v_batch_id,
            'batch_number', v_batch_number,
            'product_name', v_product.product_name,
            'quantity', v_product.total_net_weight,
            'location_id', v_facility_location_id
        );
    END LOOP;
    
    -- Zamknij zlecenie
    UPDATE public.t_production_orders
    SET status = 'Closed', updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'created_batches', v_created_batches
    );
END;
$function$;

-- Trigger do automatycznego wypełniania batch_id w shipment_items na podstawie handling_unit
CREATE OR REPLACE FUNCTION public.populate_shipment_item_batch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_batch_id UUID;
BEGIN
    -- Jeśli handling_unit_id jest ustawione, znajdź główną partię
    IF NEW.handling_unit_id IS NOT NULL AND NEW.batch_id IS NULL THEN
        -- Pobierz najczęściej występującą partię wynikową z logów palety
        SELECT pl.output_batch_id INTO v_batch_id
        FROM public.t_production_logs pl
        WHERE pl.handling_unit_id = NEW.handling_unit_id
        AND pl.output_batch_id IS NOT NULL
        GROUP BY pl.output_batch_id
        ORDER BY COUNT(*) DESC
        LIMIT 1;
        
        IF v_batch_id IS NOT NULL THEN
            NEW.batch_id := v_batch_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Usuń stary trigger jeśli istnieje
DROP TRIGGER IF EXISTS trg_populate_shipment_batch ON public.t_shipment_items;

-- Utwórz trigger
CREATE TRIGGER trg_populate_shipment_batch
BEFORE INSERT ON public.t_shipment_items
FOR EACH ROW
EXECUTE FUNCTION public.populate_shipment_item_batch();

-- Aktualizacja symulacji aby wypełniała wszystkie pola traceability
CREATE OR REPLACE FUNCTION public.simulate_full_production_day()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_company_id UUID;
    v_facility_id UUID;
    v_employee_jan UUID;
    v_employee_adam UUID;
    v_employee_anna UUID;
    v_supplier_id UUID;
    v_customer_id UUID;
    v_carrier_id UUID;
    v_location_chiller UUID;
    v_location_freezer UUID;
    v_location_production UUID;
    v_product_raw_id UUID;
    v_product_fillet_id UUID;
    v_product_bones_id UUID;
    v_product_kebab_id UUID;
    v_product_e2_id UUID;
    v_recipe_id UUID;
    v_batch_input_id UUID;
    v_batch_fillet_id UUID;
    v_batch_bones_id UUID;
    v_batch_kebab_id UUID;
    v_order_rozbior_id UUID;
    v_order_kebab_id UUID;
    v_pz_movement_id UUID;
    v_pallet_1_id UUID;
    v_pallet_2_id UUID;
    v_pallet_3_id UUID;
    v_pallet_4_id UUID;
    v_shipment_id UUID;
    v_i INTEGER;
    v_log_id UUID;
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
    
    -- Company & Facility
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
    
    -- Employees
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
    
    INSERT INTO public.t_products (company_id, name, sku, unit, is_raw_material, default_expiration_days, min_storage_temp, max_storage_temp)
    VALUES (v_company_id, 'Filet z piersi', 'PP-001', 'kg', false, 5, 0, 4)
    RETURNING id INTO v_product_fillet_id;
    
    INSERT INTO public.t_products (company_id, name, sku, unit, is_raw_material, default_expiration_days, min_storage_temp, max_storage_temp)
    VALUES (v_company_id, 'Kości', 'ODP-001', 'kg', false, 3, 0, 4)
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
    
    -- WMS: PZ - Przyjęcie surowca
    INSERT INTO public.t_warehouse_movements (company_id, facility_id, type, document_number, contractor_id, external_doc_number, driver_name, car_plates, reception_temp, status)
    VALUES (v_company_id, v_facility_id, 'PZ', 'PZ/2026/01/001', v_supplier_id, 'HDI-2M-2026-001', 'Carlos Rodriguez', 'M 1234 ABC', 2.5, 'Approved')
    RETURNING id INTO v_pz_movement_id;
    
    -- Partia surowca z lokalizacją
    INSERT INTO public.t_batches (product_id, internal_batch_number, supplier_batch_number, supplier_id, initial_quantity, current_quantity, production_date, expiration_date, status, location_id)
    VALUES (v_product_raw_id, TO_CHAR(NOW(), 'YYYYMMDD') || '/SU-001/001', '2M-BATCH-2026-001', v_supplier_id, 5000, 5000, CURRENT_DATE - 1, CURRENT_DATE + 6, 'Released', v_location_chiller)
    RETURNING id INTO v_batch_input_id;
    
    INSERT INTO public.t_warehouse_movement_items (movement_id, product_id, batch_id, quantity)
    VALUES (v_pz_movement_id, v_product_raw_id, v_batch_input_id, 5000);
    
    INSERT INTO public.t_packaging_transactions (company_id, contractor_id, type, packaging_type, quantity, comments)
    VALUES (v_company_id, v_supplier_id, 'Received', 'Paleta EUR', 15, 'PZ/2026/01/001'), 
           (v_company_id, v_supplier_id, 'Received', 'E2', 100, 'PZ/2026/01/001');
    
    -- MES: Decomposition (Rozbór)
    INSERT INTO public.t_production_orders (company_id, facility_id, order_number, type, status, production_date, notes)
    VALUES (v_company_id, v_facility_id, 'ROZ/2026/01/23/01', 'Decomposition', 'Open', CURRENT_DATE, 'Nadzór: Anna Zmiana')
    RETURNING id INTO v_order_rozbior_id;
    
    -- RW: Wydanie surowca na produkcję
    INSERT INTO public.t_production_inputs (production_order_id, batch_id, product_id, weight, direction)
    VALUES (v_order_rozbior_id, v_batch_input_id, v_product_raw_id, 5000, 'SWIEZE');
    
    -- Zmniejsz stan partii surowca
    UPDATE public.t_batches SET current_quantity = 0 WHERE id = v_batch_input_id;
    
    -- Logi produkcyjne dla filetu (50 x 60kg netto = 3000kg)
    FOR v_i IN 1..50 LOOP
        INSERT INTO public.t_production_logs (production_order_id, employee_id, product_id, source_batch_id, weight_gross, weight_tare, weight_net, packaging_type, packaging_count, scale_device_id)
        VALUES (v_order_rozbior_id, v_employee_jan, v_product_fillet_id, v_batch_input_id, 62.0, 2.0, 60.0, 'E2', 1, 'SCALE_01');
    END LOOP;
    
    -- Logi produkcyjne dla kości (38 x 50kg netto = 1900kg)
    FOR v_i IN 1..38 LOOP
        INSERT INTO public.t_production_logs (production_order_id, employee_id, product_id, source_batch_id, weight_gross, weight_tare, weight_net, packaging_type, packaging_count, scale_device_id)
        VALUES (v_order_rozbior_id, v_employee_adam, v_product_bones_id, v_batch_input_id, 52.0, 2.0, 50.0, 'E2', 1, 'SCALE_02');
    END LOOP;
    
    -- Zamknij zlecenie rozbioru - to automatycznie utworzy partie wynikowe i przypisze output_batch_id
    PERFORM public.close_production_order_with_batches(v_order_rozbior_id);
    
    -- Pobierz ID utworzonych partii
    SELECT id INTO v_batch_fillet_id FROM public.t_batches WHERE product_id = v_product_fillet_id ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO v_batch_bones_id FROM public.t_batches WHERE product_id = v_product_bones_id ORDER BY created_at DESC LIMIT 1;
    
    -- MES: Processing (Przetwórstwo - Kebab)
    INSERT INTO public.t_production_orders (company_id, facility_id, order_number, type, status, production_date, machine_id)
    VALUES (v_company_id, v_facility_id, 'PRZ/2026/01/23/01', 'Processing', 'Open', CURRENT_DATE, 'MASOWNICA_1')
    RETURNING id INTO v_order_kebab_id;
    
    -- RW: Wydanie filetu na produkcję kebaba
    INSERT INTO public.t_production_inputs (production_order_id, batch_id, product_id, weight, direction)
    VALUES (v_order_kebab_id, v_batch_fillet_id, v_product_fillet_id, 3000, 'KEBAB');
    
    -- Zmniejsz stan partii filetu
    UPDATE public.t_batches SET current_quantity = 0 WHERE id = v_batch_fillet_id;
    
    -- Utwórz palety PRZED logami
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0001', 'Pallet', 'Open', CURRENT_DATE)
    RETURNING id INTO v_pallet_1_id;
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0002', 'Pallet', 'Open', CURRENT_DATE)
    RETURNING id INTO v_pallet_2_id;
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0003', 'Pallet', 'Open', CURRENT_DATE)
    RETURNING id INTO v_pallet_3_id;
    INSERT INTO public.t_handling_units (company_id, facility_id, sscc_number, type, status, production_date)
    VALUES (v_company_id, v_facility_id, '00' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || '0004', 'Pallet', 'Open', CURRENT_DATE)
    RETURNING id INTO v_pallet_4_id;
    
    -- Logi produkcyjne dla kebaba (220 x 15kg netto = 3300kg) - od razu przypisane do palet
    FOR v_i IN 1..220 LOOP
        INSERT INTO public.t_production_logs (
            production_order_id, employee_id, product_id, source_batch_id, 
            weight_gross, weight_tare, weight_net, packaging_type, packaging_count, scale_device_id,
            handling_unit_id
        )
        VALUES (
            v_order_kebab_id, v_employee_jan, v_product_kebab_id, v_batch_fillet_id, 
            15.5, 0.5, 15.0, 'Poliblok', 1, 'SCALE_03',
            CASE 
                WHEN v_i <= 55 THEN v_pallet_1_id 
                WHEN v_i <= 110 THEN v_pallet_2_id 
                WHEN v_i <= 165 THEN v_pallet_3_id 
                ELSE v_pallet_4_id 
            END
        );
    END LOOP;
    
    -- Zamknij zlecenie kebab - to utworzy partię wynikową i przypisze output_batch_id do wszystkich logów
    PERFORM public.close_production_order_with_batches(v_order_kebab_id);
    
    -- Pobierz ID partii kebab
    SELECT id INTO v_batch_kebab_id FROM public.t_batches WHERE product_id = v_product_kebab_id ORDER BY created_at DESC LIMIT 1;
    
    -- Zamknij palety
    UPDATE public.t_handling_units SET status = 'Closed' WHERE id IN (v_pallet_1_id, v_pallet_2_id, v_pallet_3_id, v_pallet_4_id);
    
    -- Shipment (WZ)
    INSERT INTO public.t_shipments (company_id, facility_id, shipment_number, status, customer_id, carrier_id, driver_name, truck_plates, trailer_plates, transport_temperature, dispatch_date)
    VALUES (v_company_id, v_facility_id, 'WZ/2026/01/001', 'Loading', v_customer_id, v_carrier_id, 'Hans Mueller', 'SK 44222', 'SK 44223', -18.0, CURRENT_DATE)
    RETURNING id INTO v_shipment_id;
    
    -- Dodaj palety do wysyłki z weryfikacją wagi (trigger automatycznie wypełni batch_id)
    INSERT INTO public.t_shipment_items (shipment_id, handling_unit_id, verified_weight, verified_at)
    VALUES 
        (v_shipment_id, v_pallet_1_id, 825.0, NOW()),
        (v_shipment_id, v_pallet_2_id, 825.0, NOW()),
        (v_shipment_id, v_pallet_3_id, 825.0, NOW()),
        (v_shipment_id, v_pallet_4_id, 825.0, NOW());
    
    -- Zmień status wysyłki na Shipped
    UPDATE public.t_shipments SET status = 'Shipped' WHERE id = v_shipment_id;
    
    -- Zmień status palet na Shipped
    UPDATE public.t_handling_units SET status = 'Shipped' WHERE id IN (v_pallet_1_id, v_pallet_2_id, v_pallet_3_id, v_pallet_4_id);
    
    -- Zmniejsz stan partii kebab (wysłano wszystko)
    UPDATE public.t_batches SET current_quantity = 0 WHERE id = v_batch_kebab_id;
    
    -- Opakowania wydane
    INSERT INTO public.t_packaging_transactions (company_id, shipment_id, contractor_id, type, packaging_type, quantity)
    VALUES (v_company_id, v_shipment_id, v_customer_id, 'Issued', 'Paleta EUR', 4), 
           (v_company_id, v_shipment_id, v_customer_id, 'Issued', 'Karton', 220);
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Symulacja zakończona pomyślnie - pełna traceability',
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
            'batches_with_output_link', 3,
            'shipment_items_with_batch', 4,
            'shipment_items_verified', 4
        ),
        'employees', jsonb_build_object(
            'jan_kowalski_id', v_employee_jan, 
            'adam_nowak_id', v_employee_adam, 
            'anna_zmiana_id', v_employee_anna
        ),
        'test_codes', jsonb_build_object(
            'qr_jan', 'QR_JAN', 
            'qr_adam', 'QR_ADAM', 
            'qr_anna', 'QR_ANNA'
        ),
        'storage_locations', jsonb_build_object(
            'chiller', v_location_chiller, 
            'freezer', v_location_freezer, 
            'production', v_location_production
        ),
        'traceability', jsonb_build_object(
            'input_batch_id', v_batch_input_id,
            'fillet_batch_id', v_batch_fillet_id,
            'bones_batch_id', v_batch_bones_id,
            'kebab_batch_id', v_batch_kebab_id,
            'shipment_id', v_shipment_id
        )
    );
END;
$function$;