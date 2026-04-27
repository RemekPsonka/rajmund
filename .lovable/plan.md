## Sprint 3.3 — Wykres krzywej temperatury w terminalu mrożenia

### 1. Nowy komponent `src/components/production/FreezingTempChart.tsx`

**Props**: `{ productionLogId: string; targetTempC?: number /* -18 */; ambientLine?: boolean; title?: string }`

**Logika**:
- Konsumuje `useFreezingTempStream(productionLogId)` z S3.2 → `readings` rośnie automatycznie przez Realtime channel.
- `useMemo` mapuje pomiary na `{ ts, label: HH:MM, core, ambient, source }`.
- `last = data[data.length-1]`, `reachedTarget = last.core <= targetTempC`, `remaining = |last.core - targetTempC|`.
- `yDomain` auto-skalowane z paddingiem (min/max ± 2-3°C, zawsze obejmuje target).

**Render** (shadcn Card):
- **CardHeader** — flex split:
  - Lewo: tytuł `ThermometerSnowflake + "Krzywa temperatury rdzenia"`, podtytuł `Target ≤ -18°C (CCP) · N pomiarów`.
  - Prawo: duża cyfra `font-mono tabular-nums` `style={{fontSize: 48}}` z `last.core` + `Badge`:
    - Target osiągnięty → `bg-success text-success-foreground` „OSIĄGNIĘTO TARGET — można zakończyć mrożenie"
    - W trakcie → `bg-warning text-warning-foreground` „OZIĘBIANIE — pozostało {remaining}°C"
- **CardContent**:
  - `isLoading` → `Skeleton h-[300px] w-full`
  - `data.length === 0` → `EmptyState` z ikoną `ThermometerSnowflake`, tytuł „Oczekiwanie na pierwszy pomiar..."
  - W innym przypadku `ResponsiveContainer h=300` + `LineChart`:
    - `CartesianGrid` `hsl(var(--border))`
    - `XAxis dataKey="label"`, `YAxis domain={yDomain}`, ticki `hsl(var(--muted-foreground))`
    - `ReferenceLine y={targetTempC}` `stroke=hsl(var(--destructive))`, `strokeDasharray="5 5"`, label „Target -18°C"
    - `Line dataKey="core"` `stroke=hsl(var(--primary))` `strokeWidth=2`, `isAnimationActive={false}`
    - **Dot tylko dla ostatnich 3 pomiarów** (custom funkcja zwraca `<circle>` jeśli `index >= data.length-3`, w przeciwnym razie pusty `<g>`)
    - `activeDot={{ r: 6 }}` na hover
    - Opcjonalnie `Line dataKey="ambient"` (`ambientLine`) jako szara przerywana
  - **CustomTooltip**: pokazuje `HH:mm:ss`, „Rdzeń: X°C", opcjonalnie „Otoczenie", „Źródło: auto (sonda) / ręczny"

### 2. Wpięcie w `src/pages/production/ShockFreezingTerminalPage.tsx`

- Import `FreezingTempChart`.
- Wybierz **pierwszą aktywną sesję**: `const activeChartItem = freezingItems.find(i => i.status === "freezing" && i.dbLogId)`.
- Wstaw **powyżej** istniejącej karty z tabelą sesji (przed `<Card>` zawierającym `freezingItems.map`):
  ```tsx
  {activeChartItem?.dbLogId && (
    <FreezingTempChart productionLogId={activeChartItem.dbLogId} targetTempC={CCP_THRESHOLD_C} />
  )}
  ```
- Jeśli kilka aktywnych sesji — pokazujemy tylko pierwszą (selektor odkładamy na S3.4, demo nie potrzebuje).

### 3. Konwencje (potwierdzone w kodzie)

- Tokeny istnieją: `--primary`, `--destructive`, `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--border`, `--muted-foreground`, `--background`, `--popover`. Wszystko HSL przez `hsl(var(--…))`.
- shadcn primitives: `Card/CardHeader/CardTitle/CardContent`, `Badge`, `Skeleton`, `EmptyState`.
- Polish UI strings.
- Bez dark/light hardcode.

### 4. Co świadomie zostawiamy

- **Selektor sesji** gdy >1 aktywna — S3.4.
- **Eksport krzywej do PDF / raport CCP** — sprint dokumentacyjny.
- **Hard gate na bazie min temp z całej krzywej** (np. „target musi się utrzymać ≥ X minut") — S3.4.

### 5. Ryzyka

- `Realtime invalidate` powoduje refetch całej historii — przy długiej sesji (>1000 pomiarów) może puchnąć. Na demo i produkcję S3 nie problem (≤ 480 pomiarów / 4h przy interwale 30s). Optymalizacja przyrostowa (cache merge zamiast invalidate) odkładana.
- Custom `dot` w Recharts musi mieć stabilny `key` — używam `dot-${index}`.

### Pliki

- **Nowy**: `src/components/production/FreezingTempChart.tsx`
- **Edycja**: `src/pages/production/ShockFreezingTerminalPage.tsx` (import + warunkowe renderowanie wykresu nad tabelą)
