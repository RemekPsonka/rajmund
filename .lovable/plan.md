## Cel
Dodać schemat śledzenia rodzic-dziecko między partiami (`t_lot_lineage`) oraz rozszerzyć `t_batches` o pola `parent_batch_id` i `source_event_type`. To fundament pod późniejsze: (1) auto-tworzenie partii wynikowej przy zamknięciu zlecenia oraz (2) widok `/genealogia/:lotId`.

Ten plan obejmuje TYLKO migrację SQL (krok 1 sprintu). Auto-tworzenie partii wynikowej i strona genealogii zostaną zrobione w kolejnych krokach.

## Migracja SQL

Nowy plik: `supabase/migrations/<timestamp>_add_lot_lineage.sql`

### 1. Rozszerzenie `t_batches`
- `parent_batch_id uuid REFERENCES t_batches(id) ON DELETE SET NULL` — bezpośredni rodzic (dla prostych przypadków 1:1, np. RECEIVING→QC release).
- `source_event_type text` z CHECK IN (`RECEIVING`, `DISASSEMBLY`, `TUMBLING`, `ASSEMBLY`, `FREEZING`, `AGGREGATION`).
- Indeks na `parent_batch_id`.

### 2. Nowa tabela `t_lot_lineage` (graf many-to-many)
Kolumny zgodnie ze specyfikacją:
- `id uuid PK default gen_random_uuid()`
- `parent_lot_id uuid NOT NULL REFERENCES t_batches(id) ON DELETE RESTRICT`
- `child_lot_id uuid NOT NULL REFERENCES t_batches(id) ON DELETE RESTRICT`
- `event_type text NOT NULL` z CHECK IN (`RECEIVING`, `DISASSEMBLY`, `TUMBLING`, `ASSEMBLY`, `FREEZING`, `AGGREGATION`, `SHIPPING`)
- `qty_kg numeric NOT NULL CHECK (qty_kg > 0)`
- `process_ref_id uuid` (luźna referencja na `t_production_orders.id`, bez FK żeby pomieścić różne typy procesów — shipments, warehouse movements)
- `occurred_at timestamptz NOT NULL DEFAULT now()`
- `operator_id uuid REFERENCES t_employees(id) ON DELETE SET NULL`
- Dodatkowy CHECK: `parent_lot_id <> child_lot_id` (zabezpieczenie przed pętlą self-reference).

### 3. Indeksy
- `idx_lot_lineage_parent` na `parent_lot_id`
- `idx_lot_lineage_child` na `child_lot_id`
- `idx_lot_lineage_process` na `process_ref_id` (przyda się przy odpytywaniu „co wyprodukowało zlecenie X")
- `idx_batches_parent` na `t_batches(parent_batch_id)`

### 4. RLS
Włączyć RLS na `t_lot_lineage` i dodać polityki spójne z `t_batches`:
- `SELECT` — każdy zalogowany (`is_authenticated()`), zgodnie z konwencją tabel produkcyjnych.
- `ALL` — `is_global_admin(auth.uid())`.
- `INSERT/UPDATE/DELETE` — operatorzy/facility admins mający dostęp do firmy partii dziecka (przez `t_products` → `t_companies`).

## Acceptance criteria (po migracji)
- Migracja przechodzi bez błędów.
- INSERT z dwoma istniejącymi `batch_id` + `qty_kg=10` + `event_type='TUMBLING'` przechodzi.
- INSERT z `qty_kg=0` → błąd CHECK.
- INSERT z `event_type='XYZ'` → błąd CHECK.
- INSERT z `parent_lot_id = child_lot_id` → błąd CHECK.

## Co NIE jest częścią tego sprintu
- Modyfikacja `close_production_order_with_batches()` żeby zapisywała wpisy do `t_lot_lineage`.
- Strona `/genealogia/:lotId` z drzewem.
- Hook `useLotLineage`.

Te kroki proponuję jako kolejne sprinty po zatwierdzeniu i przetestowaniu migracji.
