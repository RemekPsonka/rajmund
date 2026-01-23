-- =====================================================
-- SEED DATA: Struktura firmy, produkty, kontrahenci
-- =====================================================

-- 1. Firma główna
INSERT INTO t_companies (id, name, short_name, tax_id, is_active, main_address_json)
VALUES (
  'a0000001-0000-0000-0000-000000000001'::uuid,
  'NARROW FOOD Sp. z o.o.',
  'NARROW',
  '1234567890',
  true,
  '{"street": "ul. Przemysłowa 15", "city": "Poznań", "postal_code": "60-001", "country": "PL"}'::jsonb
);

-- 2. Zakłady produkcyjne
INSERT INTO t_facilities (id, company_id, name, type, vet_approval_number)
VALUES 
  ('b0000001-0000-0000-0000-000000000001'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Zakład Poznań', 'Plant', 'PL-30-001-001'),
  ('b0000002-0000-0000-0000-000000000002'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Magazyn Główny', 'Warehouse', NULL);

-- 3. Produkty - surowce
INSERT INTO t_products (id, company_id, name, sku, is_raw_material, unit, min_storage_temp, max_storage_temp, default_expiration_days)
VALUES 
  ('c0000001-0000-0000-0000-000000000001'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Schab wieprzowy b/k', 'RAW-SCH-001', true, 'kg', 0, 4, 14),
  ('c0000002-0000-0000-0000-000000000002'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Karkówka wieprzowa b/k', 'RAW-KAR-001', true, 'kg', 0, 4, 14),
  ('c0000003-0000-0000-0000-000000000003'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Łopatka wieprzowa b/k', 'RAW-LOP-001', true, 'kg', 0, 4, 14),
  ('c0000004-0000-0000-0000-000000000004'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Sól peklująca', 'RAW-SOL-001', true, 'kg', NULL, NULL, 365);

-- 4. Produkty - wyroby gotowe
INSERT INTO t_products (id, company_id, name, sku, is_raw_material, unit, min_storage_temp, max_storage_temp, default_expiration_days)
VALUES 
  ('c0000011-0000-0000-0000-000000000011'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Schab peklowany', 'FIN-SCH-PEK', false, 'kg', 0, 4, 21),
  ('c0000012-0000-0000-0000-000000000012'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Karkówka peklowana', 'FIN-KAR-PEK', false, 'kg', 0, 4, 21),
  ('c0000013-0000-0000-0000-000000000013'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'Łopatka peklowana', 'FIN-LOP-PEK', false, 'kg', 0, 4, 21);

-- 5. Kontrahenci - dostawcy
INSERT INTO t_contractors (id, company_id, name, tax_id, is_supplier, is_customer, is_logistics, vet_number, payment_term_days)
VALUES 
  ('d0000001-0000-0000-0000-000000000001'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'MIĘSEX S.A.', '9876543210', true, false, false, 'PL-30-002-001', 30),
  ('d0000002-0000-0000-0000-000000000002'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'AGRO-FARM Sp. z o.o.', '5554443332', true, false, false, 'PL-30-003-001', 14);

-- 6. Kontrahenci - odbiorcy
INSERT INTO t_contractors (id, company_id, name, tax_id, is_supplier, is_customer, is_logistics, payment_term_days)
VALUES 
  ('d0000011-0000-0000-0000-000000000011'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'BIEDRONKA - Jeronimo Martins', '7791011223', false, true, false, 60),
  ('d0000012-0000-0000-0000-000000000012'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'LIDL Polska', '6661112223', false, true, false, 45);

-- 7. Kontrahenci - przewoźnicy
INSERT INTO t_contractors (id, company_id, name, tax_id, is_supplier, is_customer, is_logistics, payment_term_days)
VALUES 
  ('d0000021-0000-0000-0000-000000000021'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'TRANS-CHŁÓD Sp. z o.o.', '1112223334', false, false, true, 14);

-- 8. Pracownicy
INSERT INTO t_employees (id, company_id, facility_id, first_name, last_name, job_position, qr_login_code, is_active, contract_type)
VALUES 
  ('e0000001-0000-0000-0000-000000000001'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'b0000001-0000-0000-0000-000000000001'::uuid, 'Jan', 'Kowalski', 'Operator produkcji', 'EMP-JAN-001', true, 'UoP'),
  ('e0000002-0000-0000-0000-000000000002'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'b0000001-0000-0000-0000-000000000001'::uuid, 'Anna', 'Nowak', 'Operator ważenia', 'EMP-ANN-002', true, 'UoP'),
  ('e0000003-0000-0000-0000-000000000003'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'b0000001-0000-0000-0000-000000000001'::uuid, 'Piotr', 'Wiśniewski', 'Kierownik produkcji', 'EMP-PIO-003', true, 'UoP'),
  ('e0000004-0000-0000-0000-000000000004'::uuid, 'a0000001-0000-0000-0000-000000000001'::uuid, 'b0000002-0000-0000-0000-000000000002'::uuid, 'Maria', 'Zielińska', 'Magazynier', 'EMP-MAR-004', true, 'UoP');

-- 9. Partie surowców (stany magazynowe)
INSERT INTO t_batches (id, product_id, internal_batch_number, supplier_batch_number, supplier_id, initial_quantity, current_quantity, production_date, expiration_date, status, reception_date)
VALUES 
  ('f0000001-0000-0000-0000-000000000001'::uuid, 'c0000001-0000-0000-0000-000000000001'::uuid, 'BAT-2024-001', 'SUP-12345', 'd0000001-0000-0000-0000-000000000001'::uuid, 500, 450, CURRENT_DATE - 3, CURRENT_DATE + 11, 'Released', CURRENT_DATE - 3),
  ('f0000002-0000-0000-0000-000000000002'::uuid, 'c0000002-0000-0000-0000-000000000002'::uuid, 'BAT-2024-002', 'SUP-12346', 'd0000001-0000-0000-0000-000000000001'::uuid, 300, 280, CURRENT_DATE - 2, CURRENT_DATE + 12, 'Released', CURRENT_DATE - 2),
  ('f0000003-0000-0000-0000-000000000003'::uuid, 'c0000003-0000-0000-0000-000000000003'::uuid, 'BAT-2024-003', 'SUP-12347', 'd0000002-0000-0000-0000-000000000002'::uuid, 400, 400, CURRENT_DATE - 1, CURRENT_DATE + 13, 'Released', CURRENT_DATE - 1),
  ('f0000004-0000-0000-0000-000000000004'::uuid, 'c0000004-0000-0000-0000-000000000004'::uuid, 'BAT-2024-004', 'SOL-001', 'd0000002-0000-0000-0000-000000000002'::uuid, 100, 95, CURRENT_DATE - 30, CURRENT_DATE + 335, 'Released', CURRENT_DATE - 30);

-- 10. Funkcja do nadania roli global_admin
CREATE OR REPLACE FUNCTION public.make_user_global_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Znajdź użytkownika po emailu
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Utwórz profil jeśli nie istnieje
  INSERT INTO t_app_users (id, full_name)
  VALUES (target_user_id, user_email)
  ON CONFLICT (id) DO NOTHING;
  
  -- Nadaj rolę global_admin
  INSERT INTO t_user_roles (user_id, role, company_id)
  VALUES (target_user_id, 'global_admin'::app_role, 'a0000001-0000-0000-0000-000000000001'::uuid)
  ON CONFLICT DO NOTHING;
  
  -- Nadaj też dostęp do firmy jako facility_admin
  INSERT INTO t_user_roles (user_id, role, company_id, facility_id)
  VALUES 
    (target_user_id, 'facility_admin'::app_role, 'a0000001-0000-0000-0000-000000000001'::uuid, 'b0000001-0000-0000-0000-000000000001'::uuid),
    (target_user_id, 'facility_admin'::app_role, 'a0000001-0000-0000-0000-000000000001'::uuid, 'b0000002-0000-0000-0000-000000000002'::uuid)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'User % is now a global admin with full access', user_email;
END;
$$;

-- 11. Trigger do automatycznego tworzenia profilu użytkownika po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.t_app_users (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Usuń trigger jeśli istnieje i utwórz na nowo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();