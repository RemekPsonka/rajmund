# Sprint 2 — Tumbler: przycisk "Zakończ partię" + spięcie z Kebab Assembly

## Stan obecny (zweryfikowany)
- `useCloseProductionOrder` istnieje (src/hooks/useProductionOrders.ts:404), wywołuje RPC `close_production_order_with_lineage`, pokazuje toast w żądanym formacie, invaliduje `production-orders`, `batches`, `lot-lineage`.
- **Brakuje invalidacji** `processing-output-batches` (faktyczny queryKey użyty w `useProcessingOutputBatches`/Kebab Assembly — brief mówił `processing-outputs`, ale w kodzie jest `processing-output-batches`).
- `useProductionLogs(orderId)` istnieje (linia 172) — zwraca logi z `weight_gross`.
- `useProductionInputs(orderId)` istnieje i jest już używany w TumblerTerminalPage (`existingInputs`).
- Tumbler step "output" ma jeden przycisk "ZATWIERDŹ" zapisujący pojedynczy log; nie ma akcji zamykania zlecenia.

## Zmiana 1 — `src/hooks/useProductionOrders.ts`
W `useCloseProductionOrder.onSuccess` dodać:
```ts
queryClient.invalidateQueries({ queryKey: ["processing-output-batches"] });
queryClient.invalidateQueries({ queryKey: ["production-logs"] });
queryClient.invalidateQueries({ queryKey: ["production-inputs"] });
```
(reszta bez zmian — toast i pozostałe invalidacje już są)

## Zmiana 2 — `src/pages/production/TumblerTerminalPage.tsx`

### Importy (do istniejącego bloku)
- Z `@/hooks/useProductionOrders`: dodać `useProductionLogs`, `useCloseProductionOrder`.
- Nowe komponenty shadcn:
  - `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` z `@/components/ui/alert-dialog`
  - `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` z `@/components/ui/tooltip`
- Ikona `CheckCircle2` z `lucide-react`.

### Nowy stan
```ts
const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
```

### Nowe hooki w komponencie
```ts
const { data: existingLogs } = useProductionLogs(selectedOrderId || undefined);
const closeOrder = useCloseProductionOrder();
```

### Logika włączenia przycisku
```ts
const hasInputs = (existingInputs?.length ?? 0) > 0;
const hasPostWeight = existingLogs?.some(l => Number(l.weight_gross) > 0) ?? false;
const canFinish = hasInputs && hasPostWeight;
const finishDisabledReason = !hasInputs
  ? "Brak wsadu — zeskanuj partię"
  : !hasPostWeight
    ? "Brak wagi po-procesowej — zaloguj wagę przed zamknięciem"
    : null;
```

### Handler
```ts
const handleConfirmFinish = () => {
  if (!selectedOrderId) return;
  closeOrder.mutate(selectedOrderId, {
    onSuccess: () => {
      setInputItems([]);
      setBatchScanCode("");
      setSelectedRecipeId("");
      setSelectedOrderId("");
      setSelectedProductId("");
      setWeightGross(0);
      setStep("input");
      setConfirmCloseOpen(false);
    },
    onError: () => {
      // toast obsłużony przez hook; dialog zamykamy, stan zachowujemy
      setConfirmCloseOpen(false);
    },
  });
};
```
(Brief wymienia `setPostWeights([])` i `setSelectedRecipe(null)` — w obecnym kodzie nie ma takich stanów; mapuję na realne odpowiedniki: `setSelectedRecipeId("")` i lokalny reset wagi/produktu. `selectedMachine` i `verifiedEmployee` celowo zostają, żeby operator nie musiał logować się ponownie do następnego zlecenia.)

### UI — gdzie wstawić przycisk
W kroku "output" (sekcja `lg:col-span-3` grid), nad lub pod kartą "Skala & Submit" dodać pełnowidthowy blok:
```tsx
<div className="lg:col-span-3">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">
          <Button
            className="w-full h-20 text-xl"
            variant="default"
            disabled={!canFinish || closeOrder.isPending}
            onClick={() => setConfirmCloseOpen(true)}
          >
            {closeOrder.isPending ? (
              <><RotateCcw className="h-6 w-6 mr-3 animate-spin" />ZAMYKAM ZLECENIE...</>
            ) : (
              <><CheckCircle2 className="h-6 w-6 mr-3" />ZAKOŃCZ PARTIĘ</>
            )}
          </Button>
        </span>
      </TooltipTrigger>
      {finishDisabledReason && (
        <TooltipContent>{finishDisabledReason}</TooltipContent>
      )}
    </Tooltip>
  </TooltipProvider>
</div>

<AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Zakończyć partię tumblera?</AlertDialogTitle>
      <AlertDialogDescription>
        Zlecenie zostanie zamknięte i powstanie nowa partia mieszanki. Tej operacji nie da się cofnąć.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={closeOrder.isPending}>Anuluj</AlertDialogCancel>
      <AlertDialogAction
        onClick={(e) => { e.preventDefault(); handleConfirmFinish(); }}
        disabled={closeOrder.isPending}
      >
        Tak, zakończ
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

`AlertDialog` można renderować na końcu komponentu (poza siatką step'ów), żeby działał niezależnie od kroku.

## Co NIE jest zmieniane
- Brak nowej RPC, brak nowego hooka.
- Toast po sukcesie obsługuje wyłącznie `useCloseProductionOrder`.
- `useProductionInputs`, `useProductionLogs`, filtr `availableOnly` w `useBatches` — bez zmian.
- `selectedMachine` i `verifiedEmployee` zachowane przy resecie (poprawa UX dla tej samej zmiany pracownika/maszyny).

## Acceptance check (manualny po wdrożeniu)
1. Tumbler bez wsadu → przycisk disabled, tooltip "Brak wsadu…".
2. Wsad dodany, brak logu → tooltip "Brak wagi po-procesowej…".
3. Wsad + log → przycisk aktywny → dialog → "Tak, zakończ" → toast "Zlecenie zamknięte. Partia wynikowa: …".
4. `/warehouse/batches` — nowa partia Released, source_event_type='TUMBLING'.
5. `/genealogia/{id}` — Rodzice z badge TUMBLING.
6. `/production/assembly` — nowa partia w dropdownie wsadów (dzięki invalidacji `processing-output-batches`).
7. Tumbler po sukcesie: pusty stan kroku "input", maszyna i pracownik zachowane.
