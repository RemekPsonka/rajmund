## Plan naprawy krytycznego buga CCP1 przed Sprintem 4

### Co potwierdziłem
- `t_warehouse_movements.ccp1_passed` istnieje jako kolumna `GENERATED ALWAYS` wyliczana z `received_temp_c`.
- Aktualna funkcja `public.enforce_ccp1()` próbuje wykonać `NEW.ccp1_passed := ...`, co powoduje błąd przy INSERT/UPDATE.
- `public.create_ccp1_complaint()` nie ustawia `ccp1_passed`; tylko czyta `received_temp_c`, `received_temp_method`, `document_number` i tworzy wpis w `t_supplier_complaints`.
- Kolumna `received_temp_method` już istnieje w `t_warehouse_movements`, ale migrację przygotuję defensywnie z `ADD COLUMN IF NOT EXISTS` oraz kontrolą wartości.
- W schemacie jest kolumna `type`, nie `doc_type`; aplikacja używa `type: "PZ"`.

### Implementacja

1. **Nowa migracja hotfix CCP1**
   - Dodać plik migracji `supabase/migrations/<timestamp>_fix_ccp1_generated_column_trigger.sql`.
   - Defensywnie zapewnić kolumnę `received_temp_method`:
     ```sql
     ALTER TABLE public.t_warehouse_movements
       ADD COLUMN IF NOT EXISTS received_temp_method text
       CHECK (
         received_temp_method IS NULL
         OR received_temp_method IN ('VEHICLE_GAUGE','MANUAL_PROBE','BOTH')
       );
     ```
   - Nadpisać `public.enforce_ccp1()` tak, aby nie zapisywała do `ccp1_passed`:
     ```sql
     CREATE OR REPLACE FUNCTION public.enforce_ccp1()
     RETURNS trigger
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path = public
     AS $$
     BEGIN
       -- ccp1_passed jest kolumną GENERATED ALWAYS, więc nie wolno jej ustawiać w triggerze.
       -- Wartość liczy baza: received_temp_c IS NULL OR received_temp_c <= 4.
       RETURN NEW;
     END;
     $$;
     ```
   - Trigger `trg_ccp1_set_flag` zostawić aktywny, ale będzie wywoływał już bezpieczną funkcję no-op. Nie będzie ingerował w generated column.

2. **Weryfikacja `create_ccp1_complaint()`**
   - Nie zmieniać logiki auto-reklamacji, bo nie zapisuje `ccp1_passed`.
   - Zostawić warunek: `NEW.type = 'PZ' AND NEW.received_temp_c IS NOT NULL AND NEW.received_temp_c > 4`.
   - Payload nadal będzie zawierał `received_temp`, `threshold`, `method`, `pz_number`.

3. **Opcjonalna poprawka komentarza w UI**
   - W `src/pages/warehouse/NewDeliveryPage.tsx` zaktualizować komentarz przy tworzeniu PZ z „trigger CCP1 ustawi ccp1_passed” na informację, że `ccp1_passed` jest wyliczane przez bazę, a trigger AFTER tworzy reklamację. To usuwa mylący opis bez zmiany logiki aplikacji.

4. **Testy po wdrożeniu migracji**
   - Sprawdzić definicję funkcji `enforce_ccp1()` w bazie: brak `NEW.ccp1_passed`.
   - Sprawdzić, że `create_ccp1_complaint()` również nie zawiera zapisu do `ccp1_passed`.
   - Wykonać testy SQL z rzeczywistymi wymaganymi kolumnami tabeli:
     - INSERT PZ z `received_temp_c = 3` przechodzi, `ccp1_passed = true`, brak reklamacji.
     - INSERT PZ z `received_temp_c = 5` przechodzi, `ccp1_passed = false`, powstaje `t_supplier_complaints` z `complaint_type = 'CCP1_TEMPERATURE'` i severity `MEDIUM`.
   - Zweryfikować UI:
     - `/warehouse/deliveries/new`, temperatura 3°C: zapis bez reklamacji.
     - `/warehouse/deliveries/new`, temperatura 5°C: modal warning, „Przyjmij z reklamacją”, zapis + complaint.

### Kryterium sukcesu
Demo nie zatrzymuje się na PZ: baza sama liczy `ccp1_passed`, a trigger reklamacji działa tylko jako audit/auto-dokument dla temperatur > +4°C.