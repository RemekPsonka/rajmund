## Cel
Hook `useLotLineage(lotId)` zwracający pełne drzewo genealogii partii (przodkowie + potomkowie) oparty na funkcji RPC w bazie.

## 1. Migracja SQL — funkcja `get_lot_lineage(lot_id uuid)`

`SECURITY DEFINER`, `STABLE`, `search_path = public`. Zwraca `jsonb` z dwoma kluczami: `ancestors` i `descendants`. Implementacja przez dwa rekurencyjne CTE na `t_lot_lineage` z limitem głębokości 50 (zabezpieczenie przed cyklem). Każdy element łączy się z `t_batches` po `internal_batch_number`, żeby wzbogacić wynik o `lot_code`.

Każdy element wyniku:
```json
{ "lot_id": "...", "lot_code": "...", "depth": 1, "event_type": "TUMBLING", "qty_kg": 100, "occurred_at": "..." }
```

Pusta lista → `[]` (przez `COALESCE`), więc partia bez rodziców/dzieci dostanie `{ ancestors: [], descendants: [] }`.

## 2. Hook `src/hooks/useLotLineage.ts`

- Named export `useLotLineage(lotId: string | null)`.
- Interfejsy `LineageNode` i `LotLineage` eksportowane z pliku.
- `useQuery` z TanStack Query: `queryKey: ['lot-lineage', lotId]`, `enabled: !!lotId`.
- W `queryFn` wywołanie `supabase.rpc('get_lot_lineage', { lot_id: lotId })`.
- Bez `any` — rzutowanie przez `as never` na argumencie RPC (typy Supabase nie znają jeszcze nowej funkcji do czasu regeneracji), wynik parsowany przez `Partial<LotLineage>` z fallbackami `?? []`.
- Brak side-effectów poza zapytaniem — domyślny cache TanStack Query.

## Acceptance criteria
- Wywołanie hooka zwraca `{ ancestors, descendants }`.
- Partia bez powiązań → oba pola to puste tablice.
- TypeScript bez błędów, brak `any`.
- Cache TanStack pod kluczem `['lot-lineage', lotId]`.

## Co NIE wchodzi w ten sprint
- Strona `/genealogia/:lotId` (renderowanie drzewa).
- Auto-zapis do `t_lot_lineage` przy zamknięciu zlecenia (oddzielny sprint).
