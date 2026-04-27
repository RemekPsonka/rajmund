-- 1. Tabela reklamacji
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

-- 2. Trigger ustawiający ccp1_passed na podstawie temperatury
CREATE OR REPLACE FUNCTION public.enforce_ccp1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'PZ' AND NEW.received_temp_c IS NOT NULL THEN
    NEW.ccp1_passed := (NEW.received_temp_c <= 4);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ccp1_set_flag ON public.t_warehouse_movements;
CREATE TRIGGER trg_ccp1_set_flag
BEFORE INSERT OR UPDATE OF received_temp_c, type ON public.t_warehouse_movements
FOR EACH ROW EXECUTE FUNCTION public.enforce_ccp1();

-- 3. Trigger generujący auto-reklamację gdy temp > 4°C
CREATE OR REPLACE FUNCTION public.create_ccp1_complaint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

DROP TRIGGER IF EXISTS trg_ccp1_complaint ON public.t_warehouse_movements;
CREATE TRIGGER trg_ccp1_complaint
AFTER INSERT ON public.t_warehouse_movements
FOR EACH ROW EXECUTE FUNCTION public.create_ccp1_complaint();