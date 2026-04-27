## Sprint 3.2 — Krzywa temperatur w czasie rzeczywistym

### 1. Nowy plik `src/lib/mockHardware.ts`

Funkcja symulująca pomiar sondy temperatury — krzywa wykładnicza z `T0=4°C` asymptotycznie do `Ttarget=-22°C`. Domyślne `k=0.0008` (~50 min do CCP −18°C w czasie symulowanym = realnym). Komentarz w nagłówku tłumaczy parametry. **Demo override**: drugi eksport `mockFreezingTempAtFast` z `k=0.01` na potem (S3.3), nie używany teraz.

```ts
export function mockFreezingTempAt(
  elapsedSec: number,
  T0 = 4,
  Ttarget = -22,
  k = 0.0008
): number {
  const t = T0 + (Ttarget - T0) * (1 - Math.exp(-k * elapsedSec));
  return Math.round(t * 10) / 10;
}
```

### 2. Nowy hook `src/hooks/useFreezingTempStream.ts`

- `useQuery(['freezing-temp', productionLogId], …)` — `enabled: !!productionLogId`, fetch z `t_freezing_temp_log` (`id, recorded_at, core_temp_c, ambient_temp_c, source`) + `order('recorded_at', { ascending: true })`.
- `useEffect`: zakłada Supabase Realtime channel `freezing_temp:${productionLogId}` z `postgres_changes` filtrem `production_log_id=eq.${productionLogId}` na event `INSERT` → `queryClient.invalidateQueries`. Cleanup: `supabase.removeChannel(channel)`.
- Zwraca: `{ readings, isLoading, error }` z typem `FreezingTempReading[]`.

### 3. Auto-pomiar co 30s w `ShockFreezingTerminalPage.tsx`

Nowy `useEffect` zależny od `freezingItems` — dla każdego itemu o `status === 'freezing'` z `dbLogId` ustawia `setInterval(30_000)`:

```ts
const elapsed = (Date.now() - item.startedAt.getTime()) / 1000;
const mockTemp = mockFreezingTempAt(elapsed);
await supabase.from('t_freezing_temp_log').insert({
  production_log_id: item.dbLogId,
  core_temp_c: mockTemp,
  source: 'auto',
});
await updateLog.mutateAsync({
  id: item.dbLogId,
  latest_core_temp_c: mockTemp,
  silent: true,
});
setFreezingItems(prev => prev.map(i =>
  i.id === item.id ? { ...i, latestTempC: mockTemp } : i
));
```

Cleanup: `intervals.forEach(clearInterval)` w return useEffectu — automatycznie wywołane gdy item zniknie z listy aktywnych (po `handleCompleteFreezing` jego status idzie na `completed` i interval jest tworzony ponownie tylko dla `freezing`).

Klucz mapy intervalów: `dbLogId`. Diff oparty o listę aktywnych ID, żeby nie restartować intervalu przy każdym tikcie zegara/rerendererze.

### 4. Ręczny pomiar dorzuca wpis `source='manual'`

W `handleSaveTemperature` po `updateLog.mutateAsync(...)`:

```ts
await supabase.from('t_freezing_temp_log').insert({
  production_log_id: item.dbLogId,
  core_temp_c: value,
  source: 'manual',
});
```

Błędy INSERT logujemy do konsoli, nie przerywamy flowu (toast sukcesu już był).

### 5. Co świadomie zostawiamy poza sprintem

- **Wykres krzywej w UI** (Recharts) — to S3.3. `useFreezingTempStream` jest gotowy do wpięcia, ale jeszcze go nie konsumujemy w terminalu.
- **CCP1 na PZ w UI** (kolumny już są w DB z S3.1) — osobny prompt.
- **Hard-gate freezingu na bazie krzywej** (analiza min temp z całej historii) — S3.4.

### 6. Ryzyka / decyzje

- **Pierwszy auto-pomiar po 30s, nie natychmiast** — zgodnie z brzmieniem zadania (`setInterval` bez `setTimeout(0)` na start). Jeśli operator chce mieć wpis 0s = ręcznie kliknie zapis.
- **Brak optymistycznych aktualizacji UI** dla auto-pomiarów — Realtime channel + invalidate załatwią odświeżenie wykresu w S3.3.
- **`silent: true` na updateLog** — bez toastów, zgodnie z konwencją.
- **Pre-existing security warnings** (SECURITY DEFINER functions na `public`) z migracji S3.1 są pre-existing dla całego projektu (no-auth + RLS) — nie tykamy ich tutaj.

### Pliki

- **Nowe**: `src/lib/mockHardware.ts`, `src/hooks/useFreezingTempStream.ts`
- **Edycja**: `src/pages/production/ShockFreezingTerminalPage.tsx` (auto-interval useEffect + INSERT manual w `handleSaveTemperature`)
