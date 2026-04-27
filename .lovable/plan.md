## Cel
Strona `/genealogia/:lotId` z drzewem rodzic-dziecko + przycisk genealogii w `BatchesPage`.

## 1. Nowa strona `src/pages/genealogy/LotGenealogyPage.tsx`

- `lotId` z `useParams`.
- `useLotLineage(lotId)` (z poprzedniego sprintu) + lokalne `useQuery(["batch-detail", lotId])` po `t_batches` (join z `t_products` po nazwę/SKU) na dane bieżącej partii.
- Toast (sonner) na error.
- Layout: Breadcrumb (Magazyn → Partie → Genealogia {kod}) + nagłówek z ikoną `GitBranch` + 3 sekcje w `Card`:
  1. **Rodzice (skąd pochodzi)** — ikona `ArrowUp`. Lista `ancestors`. Pusto → "Brak rodziców (partia źródłowa, np. dostawa)".
  2. **Ta partia** — `Card` z `border-2 border-primary/40`, grid 4 kolumny: numer partii (jako `<code>`), produkt + SKU, ilość current/initial, status + badge `source_event_type`.
  3. **Dzieci (gdzie poszła)** — ikona `ArrowDown`. Lista `descendants`. Pusto → "Brak dzieci (partia jeszcze nie została użyta)".
- Komponent `NodeRow`: indent `(depth-1)*24px` przez `marginLeft`, lewy `border-l-2 border-border` (efekt drzewa), `Package` ikonka, `lot_code` jako `<Link to={/genealogia/{lot_id}}>` (klikalne — nawigacja do innej genealogii), Badge `event_type` (mapowanie PL: DISASSEMBLY→Rozbiór, TUMBLING→Masowanie, ASSEMBLY→Składanie, FREEZING→Mrożenie, AGGREGATION→Agregacja, RECEIVING→Przyjęcie, SHIPPING→Wysyłka), `qty_kg` z 2 miejscami, data sformatowana `dd MMM yyyy HH:mm` przez `date-fns/locale/pl`.
- `isLoading` → `Skeleton` (3 wiersze w sekcji).

## 2. Route w `src/App.tsx`
- Import `LotGenealogyPage`.
- Wewnątrz `<Route element={<DashboardLayout />}>` dodać:
  `<Route path="/genealogia/:lotId" element={<LotGenealogyPage />} />`

## 3. Przycisk w `src/pages/warehouse/BatchesPage.tsx`
- Dodać `GitBranch` do importów z `lucide-react`.
- Dodać `Link` z `react-router-dom` (jeśli brak).
- W komórce akcji (linia ~322), PRZED `DropdownMenu`, dodać:
  ```tsx
  <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Genealogia">
    <Link to={`/genealogia/${batch.id}`}>
      <GitBranch className="h-4 w-4" />
    </Link>
  </Button>
  ```
  Owinąć obie akcje w `<div className="flex justify-end gap-1">`.

## 4. Sidebar
Bez zmian — zgodnie z założeniem.

## Acceptance criteria
- Klik ikony przy partii → `/genealogia/{id}`.
- 3 sekcje z drzewem (indent + lewa pionowa linia).
- Klikalne `lot_code` w węzłach → nawigacja do genealogii rodzica/dziecka.
- Breadcrumb: Magazyn → Partie → Genealogia {kod}.
- Pusta partia: "Brak rodziców (partia źródłowa, np. dostawa)".
- TypeScript bez błędów, brak `any`.
