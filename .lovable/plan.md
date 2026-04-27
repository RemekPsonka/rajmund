# Sprint 1 — Live Smoke Test (opcja C, hybryda)

Pomijamy: `git tag` (zrobisz sam), tworzenie nowej dostawy (użyjemy istniejących partii surowca z seeda `simulate_full_production_day`).

## Etapy

### 1. Pre-check (SQL, ~5s)
- `SELECT id, internal_batch_number, current_quantity, status FROM t_batches WHERE status='Released' AND current_quantity >= 80 ORDER BY created_at DESC LIMIT 5` — wybór jednej partii surowca (RawMeat) do testu.
- Zapisuję `batch_id` + numer.

### 2. Utworzenie zlecenia Decomposition (UI)
- Nawigacja: `/production/orders`
- Klik "Nowe zlecenie" → typ Decomposition, dodaj input z partii z kroku 1 (80 kg)
- Asercja: zlecenie widoczne na liście, status Open

### 3. Logowanie ważenia 60 kg (UI)
- Nawigacja: `/production/terminal`
- Login QR pracownika (z seeda) → wybór zlecenia → waga 60 kg (weight_net)
- Asercja: `t_production_logs` ma nowy rekord (sprawdzam SQL)

### 4. Zamknięcie zlecenia (UI)
- Wróć do zlecenia → "Zamknij zlecenie"
- Asercja: toast `Zlecenie zamknięte. Partia wynikowa: {numer} (60 kg)`
- Screenshot toast

### 5. Weryfikacja output batch + lineage (SQL)
- `SELECT id, internal_batch_number, current_quantity, status FROM t_batches WHERE source_event_type='DISASSEMBLY' ORDER BY created_at DESC LIMIT 1` — nowa partia 60 kg, Released
- `SELECT * FROM t_lot_lineage WHERE child_lot_id={new_batch} OR parent_lot_id={new_batch}` — wpis lineage 80 kg DISASSEMBLY

### 6. Genealogia w UI
- Nawigacja: `/warehouse/batches` → klik GitBranch przy nowej partii
- `/genealogia/{id}`: sekcja Rodzice = partia surowca (DISASSEMBLY, 80 kg), Dzieci = puste
- Screenshot

### 7. Test Blocked w Tumbler (UI)
- SQL: `UPDATE t_batches SET status='Blocked' WHERE id={raw_batch_id}` (przez `useUpdateBatchStatus` z UI batches lub bezpośrednim SQL — szybciej SQL przez migrację, ale tu wystarczy zmiana w UI: BatchesPage → zmień status)
- Nawigacja: `/production/tumbler`
- Wpisz/zeskanuj numer zablokowanej partii
- Asercja: czerwony toast `Partia ZABLOKOWANA — nie można użyć w produkcji`
- Screenshot

### 8. Cleanup
- SQL: przywrócenie statusu partii surowca na Released (żeby seed nie był skażony)

## Deliverable
Po przejściu wszystkich kroków raport z 3 screenshotami (toast zamknięcia, genealogia, toast Blocked) + krótkie podsumowanie. Jeśli któryś krok padnie — stop, raport co działa, co nie.

## Uwagi
- Browser tools mogą zawodzić na drag&drop / skanowaniu QR — jeśli login QR pracownika nie zadziała, użyję bezpośrednio API (`supabase.from('t_production_logs').insert`) i przejdę do kroku 4.
- Wszystkie zmiany danych w bazie testowej są odwracalne (cleanup w kroku 8).
