## Cel
Terminale produkcyjne pokazują tylko partie `Released` z dostępną ilością i nieprzeterminowane. Skan partii odrzuconej (Blocked/Quarantine/expired) generuje czerwony toast z konkretnym powodem.

## Stan obecny (po analizie kodu)

- `useBatches({ availableOnly: true })` już istnieje w `src/hooks/useBatches.ts` i poprawnie filtruje: `status='Released' AND current_quantity > 0 AND (expiration_date IS NULL OR expiration_date >= today)`.
- `TumblerTerminalPage` i `ShockFreezingTerminalPage` już używają `useBatches({ availableOnly: true })`. Skan kodu przez `batches?.find(...)` więc partie odrzucone i tak nie zostaną znalezione, ale komunikat to generyczne "Nie znaleziono partii" — operator nie wie czemu.
- `KebabAssemblyTerminalPage` NIE używa `useBatches` — wybiera partie z `useQuery` po wyjściach zamkniętych zleceń Processing (już z definicji nie pokaże Blocked, bo źródłem są partie wynikowe MES). Bez zmian.
- `WeighingTerminalPage` NIE wybiera partii (operator tylko waży wsad zarejestrowany wcześniej). Bez zmian.
- `ProductionInputsDrawer` używa `useBatches()` bez filtra + ręcznego `b.status === "Released" && b.current_quantity > 0` — pomija check daty ważności i nie respektuje wspólnej logiki.
- `ProductionOrderDialog` używa `useBatches()` bez filtra (selekcja inputów przy tworzeniu zlecenia) — wymaga przepięcia.
- `BatchesPage` używa `useBatches()` bez argumentu → widzi wszystkie statusy. Bez zmian.

## Zadania

### 1. `src/hooks/useBatches.ts` — rozszerzenie

- Dodać opcjonalny `includeBlocked?: boolean` (domyślnie `false`). Semantyka: gdy `availableOnly && includeBlocked` → BEZ filtra (przydatne dla widoków diagnostycznych); gdy `availableOnly && !includeBlocked` → istniejący filtr Released+qty>0+nie expired. Brak `availableOnly` → wszystko (zachowanie BatchesPage bez zmian).
- Wyeksportować helper `getBatchRejectionReason(batch)` zwracający string PL z powodem odrzucenia lub `null`:
  - `Blocked` → `"Partia ZABLOKOWANA — nie można użyć w produkcji"`
  - `Quarantine` → `"Partia w KWARANTANNIE — wymaga zwolnienia QC"`
  - `expiration_date < today` → `"Partia PRZETERMINOWANA — data ważności minęła <DD.MM.YYYY>"`
  - `current_quantity <= 0` → `"Partia nie ma dostępnej ilości"`
  - inaczej `null`.
- Wyeksportować async helper `lookupBatchByCode(code)` — `select * from t_batches where internal_batch_number ilike code` (case-insensitive, wszystkie statusy). Używany w terminalach do produkcji właściwego komunikatu gdy zeskanowana partia nie istnieje na liście dostępnych.

### 2. Terminale skanujące — zamiana komunikatu "Nie znaleziono partii"

Wzór: jeśli `batches?.find(...)` zwróci `undefined`, wykonaj `lookupBatchByCode(scanCode)`:
- jeżeli zwróci partię → `toast.error(getBatchRejectionReason(batch) ?? "Partia nie spełnia wymagań")`,
- jeżeli `null` → `toast.error("Nie znaleziono partii o numerze {code}")`.

Pliki:
- `src/pages/production/TumblerTerminalPage.tsx` — funkcja `handleBatchScan` (~linie 168–222). Zamienić blok `if (!batch) { toast.error("Nie znaleziono partii"); ... }` na lookup z odpowiednim komunikatem. Usunąć duplikat sprawdzeń `current_quantity <= 0` i `expiration_date` (już zapewnia filtr `availableOnly`, a pozostały lookup wyłapie sytuacje gdy DB zmienił się między ładowaniem a skanem).
- `src/pages/production/ShockFreezingTerminalPage.tsx` — funkcja `handleStartFreezing` (~linie 150–155). Ten sam wzorzec.

### 3. `src/components/production/ProductionInputsDrawer.tsx`

- Zmienić `useBatches()` → `useBatches({ availableOnly: true })`.
- Usunąć ręczny `availableBatches = batches?.filter(...)` — używać bezpośrednio `batches` w `<SelectItem>`.

### 4. `src/components/production/ProductionOrderDialog.tsx`

- Zmienić `useBatches()` → `useBatches({ availableOnly: true })` aby selekcja partii do nowego zlecenia także respektowała filtr.

### 5. BatchesPage — bez zmian

Nadal `useBatches()` bez argumentu = wszystkie statusy widoczne.

## Acceptance criteria

- Dropdown w `ProductionInputsDrawer` i `ProductionOrderDialog` pokazuje wyłącznie partie Released z `current_quantity > 0` i nieprzeterminowane.
- Skan kodu zablokowanej partii w Tumbler/ShockFreezing → czerwony toast `"Partia ZABLOKOWANA — nie można użyć w produkcji"`, partia nie zostaje dodana.
- Skan kodu w kwarantannie → `"Partia w KWARANTANNIE — wymaga zwolnienia QC"`.
- Skan kodu z minioną datą → `"Partia PRZETERMINOWANA — data ważności minęła DD.MM.YYYY"`.
- `BatchesPage` nadal pokazuje wszystkie statusy.

## Uwagi techniczne

- `lookupBatchByCode` wykonuje 1 zapytanie tylko gdy lookup po cache się nie udał — bez wpływu na wydajność happy-path.
- Filtr `expiration_date.gte.today` w istniejącym hooku jest poprawny (data >= dziś, czyli ważne także w dniu wygaśnięcia). Helper `getBatchRejectionReason` używa `< today` co jest spójne (dziś = nadal ważne).
