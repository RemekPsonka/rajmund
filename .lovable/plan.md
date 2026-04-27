## Sprint 3.5 — Reklamacje dostawców + hard gate CCP1 na PZ

Cel: pomiar temperatury na PZ jest wymagany; przekroczenie +4 °C wymusza decyzję operatora i przy "Przyjmij z reklamacją" auto-generuje wpis w `t_supplier_complaints` (trigger DB). Kolumna `ccp1_passed` ustawiana razem z insertem.

### 1. Migracja DB

Plik: `supabase/migrations/<ts>_ccp1_complaints.sql`

a) **Tabela `t_supplier_complaints`** + indeksy + RLS (analogicznie do innych tabel: full access dla auth + global_admin policy).

```sql
CREATE TABLE public.t_supplier_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.t_contractors(id),
  movement_id uuid REFERENCES public.t_warehouse_movements(id) ON DELETE CASCADE,
  complaint_type text NOT NULL CHECK (complaint_type IN
    ('CCP1_TEMPERATURE','QUALITY','QUANTITY','DOCUMENTATION','OTHER')),
  severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN
    ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN
    ('NEW','ACKNOWLEDGED','RESOLVED','REJECTED')),
  payload jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.t_app_users(id)
);
CREATE INDEX idx_complaints_supplier ON public.t_supplier_complaints(supplier_id);
CREATE INDEX idx_complaints_status   ON public.t_supplier_complaints(status);

ALTER TABLE public.t_supplier_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access for auth users" ON public.t_supplier_complaints
  FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());
CREATE POLICY "Global admins can do everything with supplier complaints"
  ON public.t_supplier_complaints FOR ALL USING (is_global_admin(auth.uid()));
```

b) **Trigger `enforce_ccp1`** — adaptujemy do faktycznych nazw kolumn w `t_warehouse_movements`: `type` (nie `doc_type`) i `contractor_id` (nie `supplier_id`). Trigger przy temp > +4 °C wstawia reklamację; równolegle ustawia `ccp1_passed`.

```sql
CREATE OR REPLACE FUNCTION public.enforce_ccp1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'PZ' AND NEW.received_temp_c IS NOT NULL THEN
    -- ustaw ccp1_passed na podstawie pomiaru
    NEW.ccp1_passed := (NEW.received_temp_c <= 4);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ccp1_set_flag
BEFORE INSERT OR UPDATE OF received_temp_c, type ON public.t_warehouse_movements
FOR EACH ROW EXECUTE FUNCTION public.enforce_ccp1();

-- Osobny AFTER INSERT generujący reklamację (zgodnie ze specyfikacją)
CREATE OR REPLACE FUNCTION public.create_ccp1_complaint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'PZ' AND NEW.received_temp_c IS NOT NULL AND NEW.received_temp_c > 4 THEN
    INSERT INTO public.t_supplier_complaints (
      supplier_id, movement_id, complaint_type, severity, payload, notes
    ) VALUES (
      NEW.contractor_id,
      NEW.id,
      'CCP1_TEMPERATURE',
      CASE
        WHEN NEW.received_temp_c > 8 THEN 'CRITICAL'
        WHEN NEW.received_temp_c > 6 THEN 'HIGH'
        ELSE 'MEDIUM'
      END,
      jsonb_build_object(
        'received_temp', NEW.received_temp_c,
        'threshold', 4,
        'method', NEW.received_temp_method,
        'pz_number', NEW.document_number
      ),
      format('Auto-reklamacja CCP1: temperatura przyjęcia %s°C przekracza próg +4°C', NEW.received_temp_c)
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ccp1_complaint
AFTER INSERT ON public.t_warehouse_movements
FOR EACH ROW EXECUTE FUNCTION public.create_ccp1_complaint();
```

### 2. Hook `useWarehouseMovements`

`MovementFormData` rozszerzamy o `received_temp_c?: number` i `received_temp_method?: string`.

### 3. `NewDeliveryPage.tsx`

- **Schema Zod**: usuwamy `reception_temp` (lub mapujemy), dodajemy:
  - `received_temp_c`: `z.preprocess` → `z.number().min(-30).max(30)`, **wymagane** (komunikat: "Pomiar temperatury jest wymagany").
  - `received_temp_method`: `z.enum(['VEHICLE_GAUGE','MANUAL_PROBE','BOTH'])`.
- **UI** w Step 1 (zamiast/obok obecnego pola "Temperatura przyjęcia"):
  - Numeric input (h-12, step 0.1, min -30, max 30) z labelką PL.
  - Select z 3 opcjami: "Czujnik pojazdu", "Sonda ręczna", "Pomiar podwójny".
- **Logika submit (Krok 2 → "Zatwierdź PZ")**: przed `handleSubmit` sprawdzamy `step1Data.received_temp_c`. Jeśli > 4 → otwieramy `AlertDialog` z dwoma akcjami:
  - **Odrzuć dostawę** (`variant="destructive"`): zamyka dialog, `setItems([])`, `setStep1Data(null)`, `setStep(1)`, `step1Form.reset()`, toast info "Dostawa odrzucona — nie zapisano".
  - **Przyjmij z reklamacją**: zamyka dialog i wywołuje istniejący `handleSubmit()` (insert idzie z `received_temp_c` → trigger `BEFORE` ustawia `ccp1_passed=false`, trigger `AFTER` tworzy reklamację). Toast sukcesu pozostaje + dodatkowy info: "Wystawiono auto-reklamację CCP1".
- W `createMovement.mutateAsync(...)` przekazujemy `received_temp_c: step1Data.received_temp_c` i `received_temp_method: step1Data.received_temp_method`. Stare pole `reception_temp` zostawiamy jako zduplikowaną kopię dla wstecznej zgodności (lub usuwamy — nie używane gdzie indziej).

### 4. Strona `/warehouse/complaints` (P1)

- Plik `src/pages/warehouse/ComplaintsPage.tsx` + route w `src/App.tsx` + wpis w `AppSidebar.tsx` (sekcja Magazyn) i tytuł w `DashboardLayout.tsx`.
- Lista z `t_supplier_complaints` (join `t_contractors(name)`, `t_warehouse_movements(document_number)`). Filtry: status (Select), severity (Select). Tabela kolumn: Data, Dostawca, Typ, Severity (colored badge), Status (badge), PZ#, Akcje.
- Modal szczegółów (Dialog) z `payload` (temp, próg, metoda, pz_number) + `notes`.
- Akcje update statusu (mutacja UPDATE → wymagane: dodatkowa migracja UPDATE policy lub korzystamy z "Access for auth users" → już pokrywa). Po aktualizacji `resolved_at = now()`, `resolved_by = auth.uid()` dla RESOLVED/REJECTED.
- Hook `useSupplierComplaints` + `useUpdateComplaintStatus` w `src/hooks/useSupplierComplaints.ts`.
- `EmptyState` gdy brak wpisów.

### Acceptance / test
1. Step 1 bez temperatury → walidacja Zod blokuje przejście dalej.
2. Temp = 5 °C, submit z Step 2 → `AlertDialog` z dwoma akcjami.
3. "Odrzuć" → form clear, brak insertu (sprawdzane przez SQL).
4. "Przyjmij z reklamacją" → toast sukcesu, `SELECT * FROM t_supplier_complaints ORDER BY created_at DESC LIMIT 1` zwraca wpis `CCP1_TEMPERATURE / MEDIUM` z `payload.received_temp = 5`. `SELECT ccp1_passed FROM t_warehouse_movements WHERE id=...` = `false`.
5. Strona `/warehouse/complaints` listuje nowy wpis; akcja "Resolve" zmienia status na `RESOLVED` z `resolved_at`.
