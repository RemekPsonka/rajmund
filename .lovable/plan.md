# Plan: ostrzeżenie o niezakończonej pracy w terminalach MES (Sprint 2.6)

## Cel
Operator nie może przypadkiem stracić niezamkniętej partii — przy próbie wyjścia z terminala (sidebar / inne linki / zamknięcie tabu) pojawia się confirm, który NIE blokuje wyjścia, tylko ostrzega.

## Ograniczenie techniczne
Projekt używa klasycznego `BrowserRouter` (nie `createBrowserRouter`), więc `useBlocker` z react-router 6.4+ **nie zadziała**. Muszę użyć kombinacji:
- `beforeunload` — dla zamknięcia tabu / refresh / nawigacji poza appkę
- globalny capture-phase listener na klikach w `<a>` elementy (sidebar, linki w aplikacji) — przed obsługą routera, z `confirm()`. Jeżeli operator anuluje → `e.preventDefault()` + `e.stopPropagation()`.

To rozwiązanie sprawdzone, działa z dowolnym typem routera, nie wymaga refactoru `App.tsx`.

## Krok 1 — nowy hook `src/hooks/useUnsavedChangesWarning.ts`

```ts
useUnsavedChangesWarning(isDirty: boolean, message?: string): void
```

Logika:
1. `useEffect` zależny od `isDirty`. Jeśli `false` — zwolnij listenery i wyjdź.
2. Listener `beforeunload`:
   - `e.preventDefault()`
   - `e.returnValue = message` (przeglądarki ignorują custom text — pokażą natywny tekst, ale to OK)
3. Listener `click` w fazie capture na `document`:
   - znajdź najbliższy `<a href>` przodek targetu
   - jeśli to link wewnętrzny (host = window.location.host) i href ≠ aktualny pathname:
     - `if (!window.confirm(message)) { e.preventDefault(); e.stopPropagation(); }`
   - linki zewnętrzne pomijamy (obsługa przez `beforeunload`)
4. Cleanup obu listenerów.

Domyślny message:
> „Masz niezakończoną partię. Czy na pewno chcesz wyjść? Postęp zostanie utracony, zlecenie zostanie w bazie ze statusem Open."

## Krok 2 — integracja w 4 terminalach

Każdy terminal definiuje własną flagę `isDirty` opartą o lokalny state (przed pierwszym zapisem do DB lub między scan/close):

### `TumblerTerminalPage.tsx`
```ts
const isDirty = !!selectedOrderId && (
  inputItems.length > 0 ||
  step === "processing" ||
  step === "output" ||
  !!selectedRecipeId
);
useUnsavedChangesWarning(isDirty);
```

### `WeighingTerminalPage.tsx`
```ts
const isDirty = !!selectedOrderId && (
  weightGross > 0 ||
  !!selectedProductId ||
  !!weighingEmployeeId
);
useUnsavedChangesWarning(isDirty);
```

### `KebabAssemblyTerminalPage.tsx`
```ts
const isDirty = !!selectedBatch && (
  !!createdOrderId ||
  assembledKebabs.length > 0 ||
  !!verifiedEmployee
);
useUnsavedChangesWarning(isDirty);
```

### `ShockFreezingTerminalPage.tsx`
```ts
const isDirty = freezingItems.length > 0; // każda aktywna sesja mrożenia w UI
useUnsavedChangesWarning(isDirty);
```
(uwaga: dla freezingu sesje są persystowane w DB od Sprintu 2.5, więc warning informuje że odejście pozostawi zlecenia w stanie Open bez decyzji CCP — co jest faktem).

## Krok 3 — Acceptance test
1. Tumbler → wybierz zlecenie + zeskanuj partię → klik „Magazyn" w sidebarze → confirm.
2. Anuluj → zostajemy. OK → wychodzimy.
3. Refresh strony / zamknięcie tabu → natywny browser-confirm.
4. Brak partii / brak wybranego zlecenia → wyjście bez pytania (no-op).

## Pliki
- **created**: `src/hooks/useUnsavedChangesWarning.ts`
- **edited**: 4 strony terminali (1 import + 1-2 linie `isDirty` + 1 linia hook)

Brak migracji, brak nowych zależności, brak zmian w `App.tsx`.
