## Sprint 3.4 — Hard gate CCP3 dla paletyzacji

Cel: niemożliwe do obejścia (na poziomie bazy) zamknięcie palety zawierającej partie bez zatwierdzonego mrożenia.

### 1. Migracja SQL — funkcja + trigger

Plik: `supabase/migrations/<timestamp>_ccp3_enforce.sql`

```sql
CREATE OR REPLACE FUNCTION public.enforce_ccp3()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unfrozen_lots text[];
BEGIN
  -- Idempotentnie: jeśli już była Closed, nie blokujemy kolejnych UPDATE
  IF TG_OP = 'UPDATE' AND OLD.status = 'Closed' THEN
    RETURN NEW;
  END IF;

  -- Trigger interesuje nas tylko gdy nowy status = 'Closed'
  IF NEW.status IS DISTINCT FROM 'Closed' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT b.internal_batch_number)
  INTO v_unfrozen_lots
  FROM t_batches b
  WHERE b.id IN (
    SELECT DISTINCT pl.source_batch_id
    FROM t_production_logs pl
    WHERE pl.handling_unit_id = NEW.id
      AND pl.source_batch_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM t_production_logs pl2
    WHERE pl2.source_batch_id = b.id
      AND pl2.freezing_completed_at IS NOT NULL
      AND pl2.ccp_passed = true
  );

  IF v_unfrozen_lots IS NOT NULL AND array_length(v_unfrozen_lots, 1) > 0 THEN
    RAISE EXCEPTION 'CCP3_FAILED: paleta zawiera partie bez zatwierdzonego mrożenia: %',
      array_to_string(v_unfrozen_lots, ', ');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_ccp3
BEFORE UPDATE ON public.t_handling_units
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ccp3();
```

### 2. Frontend — czytelny komunikat błędu

Plik: `src/hooks/useHandlingUnits.ts`, mutacja `useUpdateHandlingUnitStatus` (linie ~163–165).

Zamiana ogólnego `onError` na rozpoznawanie kodu `CCP3_FAILED`:

```ts
onError: (error: Error) => {
  if (error?.message?.includes('CCP3_FAILED')) {
    const lots = error.message.split(': ').pop();
    toast.error(
      `Paleta zawiera partie bez zatwierdzonego mrożenia (${lots}). ` +
      `Sprawdź sesje mrożenia w terminalu mrożenia przed zamknięciem palety.`
    );
  } else {
    toast.error(`Błąd zamykania palety: ${error.message}`);
  }
},
```

`PalletizationPage.handleClosePallet` już łapie błąd i nie pokazuje sukcesu — bez zmian. Toast sukcesu z hooka usuniemy (lub zostawimy — strona już ma swój `toast.success`); zostawiam logikę bez zmiany (toast hooka pojawi się tylko przy faktycznym sukcesie, czyli gdy gate przepuści).

### Acceptance / test
1. Partia bez mrożenia → drag na paletę → "Zamknij paletę" → toast PL z listą lotów.
2. Po wykonaniu mrożenia (-20°C, ccp_passed=true) → ponowne zamknięcie przechodzi.
3. Próba ręcznego `UPDATE t_handling_units SET status='Closed' ...` w SQL editor również rzuca wyjątek — gate jest w bazie.
4. Zamknięta już paleta (OLD.status='Closed') może być dalej UPDATE'owana (np. label_printed) bez blokady.
