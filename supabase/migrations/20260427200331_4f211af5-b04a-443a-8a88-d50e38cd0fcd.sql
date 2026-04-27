-- Hotfix CCP1: enforce_ccp1 nie może zapisywać do generated column ccp1_passed.
-- Trigger BEFORE pozostaje (jako bezpieczny no-op), AFTER trigger generujący auto-reklamację
-- nadal działa. ccp1_passed jest wyliczane przez bazę: received_temp_c IS NULL OR received_temp_c <= 4.

-- Defensywnie: upewnij się, że kolumna received_temp_method istnieje z poprawnym CHECK.
ALTER TABLE public.t_warehouse_movements
  ADD COLUMN IF NOT EXISTS received_temp_method text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 't_warehouse_movements_received_temp_method_check'
  ) THEN
    ALTER TABLE public.t_warehouse_movements
      ADD CONSTRAINT t_warehouse_movements_received_temp_method_check
      CHECK (
        received_temp_method IS NULL
        OR received_temp_method IN ('VEHICLE_GAUGE','MANUAL_PROBE','BOTH')
      );
  END IF;
END $$;

-- Naprawa funkcji enforce_ccp1: usuwamy zapis do ccp1_passed (kolumna GENERATED ALWAYS).
CREATE OR REPLACE FUNCTION public.enforce_ccp1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ccp1_passed jest kolumną GENERATED ALWAYS AS STORED (received_temp_c IS NULL OR received_temp_c <= 4),
  -- więc nie wolno jej ustawiać w triggerze. Funkcja zostawiona jako no-op,
  -- a trigger trg_ccp1_set_flag pozostaje aktywny dla spójności audytowej.
  RETURN NEW;
END;
$$;