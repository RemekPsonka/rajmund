# Sprint: State Machine Badge w terminalach produkcyjnych

## Cel
Każdy z 4 terminali (Weighing, Tumbler, KebabAssembly, ShockFreezing) pokazuje operatorowi gdzie jest w procesie. Tumbler i Freezing dodatkowo pokazują timer w bieżącym stanie.

## Pliki do utworzenia

### 1. `src/lib/stateMachines.ts`
Jedno źródło prawdy dla 4 maszyn stanów (literal tuples → typed unions):

```ts
export const STATE_MACHINES = {
  weighing:  ['Pending','Tare_Read','Gross_Read','Confirmed','Transferred'],
  tumbling:  ['Idle','Loading','Loaded','Mixing','Resting','Done','Discharging','Closed'],
  assembly:  ['Setup','Producing','Quality_Check','Done','Labeled','Closed'],
  freezing:  ['Loading','Freezing','Stabilizing','Verified','Released'],
} as const;

export type WeighingState = typeof STATE_MACHINES.weighing[number];
export type TumblingState = typeof STATE_MACHINES.tumbling[number];
export type AssemblyState = typeof STATE_MACHINES.assembly[number];
export type FreezingState = typeof STATE_MACHINES.freezing[number];
```

Dodatkowo etykiety PL (system jest po polsku — patrz Core memory) jako mapa `STATE_LABELS_PL` per maszyna; badge renderuje labelkę PL, ale logika operuje na technicznych stanach.

### 2. `src/components/production/StateMachineBadge.tsx`
Reusable stepper. Props:
```ts
{
  states: readonly string[];
  current: string;
  labels?: Record<string, string>;   // opcjonalna mapa PL
  timer?: { stateStartedAt: number } // tylko dla Tumbler/Freezing
}
```

Render: poziomy rząd pillsów (flex, wrap), separator chevron między nimi.
- przeszłe: `bg-muted text-muted-foreground` + ikona `Check` (lucide)
- aktywny: `bg-primary text-primary-foreground` + opcjonalny timer "MM:SS" w pillu
- przyszłe: `bg-muted/40 text-muted-foreground/60`
- responsywne: na sm- ukrywamy ikony chevron, na xs- skracamy do "current / total" jako fallback

Timer: wewnętrzny `useEffect` z `setInterval(1000)` aktualizujący sformatowany string `mm:ss` (lub `hh:mm:ss` po godzinie) — czyści interwał w cleanup.

## Mapowanie UI → state per terminal

### Weighing (`WeighingTerminalPage.tsx`)
Derivacja stanu z istniejącego state'u komponentu:
- `Pending` — brak `selectedOrderId` lub brak `weighingEmployeeId`
- `Tare_Read` — operator + zlecenie, `containerCount > 0`, `weightGross == 0`
- `Gross_Read` — `weightGross > 0`, jeszcze nie zapisano
- `Confirmed` — po `createLog.isSuccess` (flag z mutacji albo po prostu `logs.length > 0` w bieżącej sesji)
- `Transferred` — gdy zlecenie ma `status='Closed'` (z bazy)

### Tumbler (`TumblerTerminalPage.tsx`)
Mapuję na istniejący `step` + dane:
- `Idle` — brak `selectedOrderId`
- `Loading` — `step === 'input'` i `inputItems.length > 0`
- `Loaded` — `step === 'processing'` (po Save inputs)
- `Mixing` — `step === 'output'` i brak logów wagowych (operator masuje)
- `Resting` — heurystyka: brak — pomijam pierwsza wersja zostawi tylko `Mixing → Done` (bo UI nie ma osobnego "rest"); dokumentuję w komentarzu, że Resting/Discharging to placeholdery przyszłej rozbudowy hardware
- `Done` — `step === 'output'` i `existingLogs.length > 0` (jest waga po-procesowa)
- `Closed` — order.status === 'Closed' (po RPC)

Timer: `stateStartedAt` jako `useState<number>(Date.now())` resetowany w `useEffect([currentState])`.

### KebabAssembly (`KebabAssemblyTerminalPage.tsx`)
- `Setup` — brak `selectedProduct` lub brak `selectedBatch` lub brak `verifiedEmployee`
- `Producing` — `canAssemble === true`, `assembledKebabs.length === 0`
- `Quality_Check` — `assembledKebabs.length > 0`, brak akcji "Zakończ"
- `Done` — po klikniecie "Zakończ partię" (lokalny flag) — jeśli nie istnieje, pomijam i mapuję tylko na Closed
- `Labeled` — gdy etykieta wydrukowana (jeśli flow istnieje; inaczej skip)
- `Closed` — order zamknięty

(Pierwsza iteracja: `Setup → Producing → Quality_Check → Closed`, pozostałe stany pozostają w definicji ale bez triggerów. To jest OK, bo akceptacja mówi "Każdy terminal ma własną logikę mapowania".)

### ShockFreezing (`ShockFreezingTerminalPage.tsx`)
- `Loading` — `canOperate === false` lub brak `freezingItems`
- `Freezing` — `activeCount > 0`
- `Stabilizing` — wszystkie `completed` (activeCount=0, completedCount>0) — czeka na weryfikację
- `Verified` — placeholder (na razie nieosiągalny bez UI weryfikacji)
- `Released` — placeholder

Timer: liczony od momentu wejścia w bieżący stan (lokalny `useState`).

## Edycje w terminalach (po jednym patchu na plik)

Każdy plik:
1. Import: `StateMachineBadge`, `STATE_MACHINES`, etykiety PL.
2. `useMemo` derive `currentState` z istniejącego state'u (zero nowych źródeł danych).
3. `useState<number>(Date.now())` + `useEffect([currentState], () => setStateStartedAt(Date.now()))` — tylko Tumbler i Freezing.
4. Render `<StateMachineBadge states={...} current={currentState} labels={...} timer={...} />` zaraz pod nagłówkiem terminala (nad istniejącą sekcją "Operator/Wybór zlecenia").

## Czego NIE robię
- Nie trzymam stanu w bazie (zgodnie z briefem) — wyłącznie derive z istniejącego UI state'u + statusu zlecenia z bazy przy wejściu (już ładowany przez hooki).
- Nie zmieniam istniejącej logiki `step` w TumblerTerminalPage — badge tylko czyta.
- Nie dodaję migracji.
- Nie tworzę testów jednostkowych (poza `tsc`).

## Plik do utworzenia / zmiany
- create `src/lib/stateMachines.ts`
- create `src/components/production/StateMachineBadge.tsx`
- edit `src/pages/production/WeighingTerminalPage.tsx`
- edit `src/pages/production/TumblerTerminalPage.tsx`
- edit `src/pages/production/KebabAssemblyTerminalPage.tsx`
- edit `src/pages/production/ShockFreezingTerminalPage.tsx`

## Test (acceptance)
1. `/production/tumbler` bez wybranego zlecenia → badge "Idle".
2. Wybór zlecenia + skan partii → "Loading" (timer rusza od 00:00).
3. Save inputs → "Loaded" (timer reset).
4. Setup receptury → "Mixing" (timer reset, leci).
5. Waga po-procesowa → "Done".
6. "ZAKOŃCZ PARTIĘ" → "Closed".
7. Analogicznie Weighing/Assembly/Freezing — przejścia per mapowanie wyżej.
8. `tsc` clean.
