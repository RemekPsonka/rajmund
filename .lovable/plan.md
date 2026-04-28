
## Cel

Symulacja `simulate_full_production_day()` ma realnie odwzorowywać pełen łańcuch **PZ → Rozbiór → Masowanie → Składanie → Mrożenie → Paletyzacja → WZ** i zwracać dla każdego etapu szczegółowy raport widoczny w `/dev-tools`.

## Diagnoza obecnego stanu

1. **Brak PZ**. Funkcja od razu wstawia partię surowca do `t_batches`, omijając `t_warehouse_movements` + `t_warehouse_movement_items`. Trigger `trg_ccp1_set_flag` i lineage RECEIVING nie są ćwiczone w realnym scenariuszu.
2. **Niespójny kontrakt zwrotny**. RPC zwraca płaski JSON (`raw_batch_id`, `meat_batch_id`, …), a `DevToolsPage.tsx` oczekuje bogatej struktury (`summary.raw_input_kg`, `summary.decomposition.yield_percent`, `recipe`, `employees`, `traceability`, `products_by_category`, `orders_by_type`). Stąd `result.summary` jest `undefined` i renderowanie zostało wcześniej awaryjnie wyciszone strażnikiem.
3. **Brak kontraktora-dostawcy** i **brak pracowników** — nie ma więc QR kodów do logowania w terminalach po symulacji.
4. **Brak handling unit linkowanych z `production_log`** dla mrożenia (tj. paleta nie ma wpisanego `output_batch_id` z lineage AGGREGATION). Trigger `trg_create_aggregation_lineage` istnieje, ale nie jest wywoływany realnym INSERT-em w log z `handling_unit_id`.

## Zakres zmian

### A. Migracja SQL — przepisanie `simulate_full_production_day()`

Nowa wersja w jednej transakcji (cleanup + seed) wykonuje **realny** flow:

1. **Setup**: firma, zakład, lokacja chłodnicza, dostawca (`Ferma Drobiu ABC`, `is_supplier=true`), klient (`HoReCa SA`, `is_customer=true`), 3 pracowników z `qr_login_code` (`EMP-DEC-001`, `EMP-PRC-001`, `EMP-ASM-001`), 6 produktów (RawMeat / SemiFinished×2 / FinishedGood / Waste / Spice), receptura 110% z bazą `SemiFinished` + składnik (mix przypraw 0.1 kg/kg).
2. **PZ (przyjęcie towaru)**: INSERT do `t_warehouse_movements` (`type='PZ'`, `received_temp_c=2.5`, `received_temp_method='MANUAL_PROBE'`, `status='Approved'`, dostawca, kierowca, plates) + `t_warehouse_movement_items` (5000 kg ćwiartki). Następnie INSERT partii surowca do `t_batches` (trigger `trg_create_receiving_lineage` zaksięguje wpis lineage). `ccp1_passed` zostanie wyliczone przez kolumnę GENERATED.
3. **Zlecenie ROZ (Decomposition)** — Closed: input 5000 kg surowca, output partia mięsa 3000 kg + partia kości 1900 kg + skóra 100 kg. `t_production_logs` z `process_stage='Decomposition'`, `employee_id` = decomposition employee, `expected_weight=3000`, `deviation_*` policzone.
4. **Zlecenie TUM (Processing)** — Closed: input 3000 kg mięsa, recipe linked, output 3300 kg masy. Log z `process_stage='Massaging'`, deviation względem `target_yield_percent`.
5. **Zlecenie ASM (Assembly)** — Closed: input 3300 kg masy, output 3300 kg kebaba w 3 wariantach (10/15/20 kg). 3 wpisy `t_production_kebab_variants`. Razem ~205 słupków.
6. **Zlecenie FRZ (Freezing)** — Closed: log z `freezing_started_at = NOW() - 4h`, `freezing_completed_at = NOW()`, `freezing_duration_minutes=240`, `latest_core_temp_c=-22`, `target_core_temp_c=-18`, `process_stage='ShockFreezing'`, `ccp_passed=true`. Dodatkowo 3 odczyty do `t_freezing_temp_log` (start +4°C, środek -10°C, koniec -22°C).
7. **Paletyzacja (5 palet SSCC)**: każda paleta to `t_handling_units` z poprawnym SSCC mod10. Dla każdej palety INSERT do `t_production_logs` z `production_order_id=v_freezing_order_id`, `handling_unit_id=v_pallet_id`, `source_batch_id=v_kebab_batch_id`, `output_batch_id=v_kebab_batch_id`, `process_stage='Palletization'`. Trigger `trg_create_aggregation_lineage` zbuduje lineage paleta↔partia. CCP3 gate przepuści palety, bo `ccp_passed=true` na partii kebabu.
8. **WZ (Wysyłka)**: `t_shipments` (status `Shipped`, kierowca, plates, seal, temp -20°C, `dispatch_date=NOW()`) + 5 pozycji `t_shipment_items`.
9. **RETURN — bogaty JSON** zgodny z TS-ową strukturą `SimulationResult`:

```text
{
  success, message,
  summary: {
    raw_input_kg, 
    receiving: { document_number, supplier_name, ccp1_passed, temp_c },
    decomposition: { meat_kg, bones_kg, skin_kg, yield_percent },
    processing: { input_kg, output_kg, yield_percent },
    assembly: { kebab_10kg_count, kebab_15kg_count, kebab_20kg_count, total_kebabs, total_weight_kg },
    freezing: { items_frozen, duration_hours, temperature_celsius, ccp_passed },
    logistics: { pallets_created, shipment_status, shipment_number }
  },
  products_by_category: { RawMeat:1, SemiFinished:2, FinishedGood:1, Waste:1, Spice:1 },
  orders_by_type: { Decomposition:1, Processing:1, Assembly:1, Freezing:1 },
  recipe: { name, base_product, base_category, output_product, target_yield_percent },
  employees: {
    decomposition: { name, code },
    processing:    { name, code },
    assembly_freezing: { name, code }
  },
  traceability: {
    delivery_id, raw_batch_id, meat_batch_id, masa_batch_id, kebab_batch_id, shipment_id,
    pallet_ids: [...]
  }
}
```

### B. UI — `src/pages/dev/DevToolsPage.tsx`

- Rozszerzyć interfejs `SimulationResult.summary` o sekcję `receiving` (PZ).
- Dodać do panelu wyników kafel **„1. PZ — Przyjęcie towaru"** pokazujący: numer PZ, dostawcę, temperaturę odbioru, badge `CCP1 ✓`. 
- Pasek 5 kafelków zostaje (Surowiec / Rozbiór / Masowanie / Słupki / Palety) — po fixie kontraktu zacznie się renderować poprawnie.
- Dodać sekcję **„Genealogia (LOT lineage)"** wywołującą `get_lot_lineage(kebab_batch_id)` po sukcesie symulacji i pokazującą liczbę węzłów w drzewie (potwierdzenie że triggery RECEIVING i AGGREGATION zadziałały).
- Toast podsumowuje: „PZ → 4 zlecenia → 5 palet SSCC → WZ ✓".

### C. Smoke check

Po migracji, ręczny SQL test:

```sql
SELECT simulate_full_production_day();
SELECT (SELECT count(*) FROM t_warehouse_movements WHERE type='PZ') AS pz,
       (SELECT count(*) FROM t_lot_lineage WHERE event_type='RECEIVING') AS lin_recv,
       (SELECT count(*) FROM t_lot_lineage WHERE event_type='AGGREGATION') AS lin_agg,
       (SELECT count(*) FROM t_handling_units) AS pallets,
       (SELECT count(*) FROM t_shipments WHERE status='Shipped') AS shipments;
```

Oczekiwane: `pz=1, lin_recv≥1, lin_agg=5, pallets=5, shipments=1`. Jeśli któreś = 0 — natychmiastowa korekta SQL.

## Poza zakresem

- Brak zmian w schemacie tabel (tylko ciało funkcji).
- Brak zmian w terminalach MES, palecie, WZ — używamy istniejących tabel/triggerów.
- Brak zmian w polu „płeć" pracownika (zdjęte z roadmapy).
- Brak nowych testów Vitest — flow weryfikujemy realnym RPC + UI.

## Akceptacja

1. Po kliknięciu „🔴 SYMULUJ PEŁNY PRZEPŁYW" w `/dev-tools` widzimy w panelu wyników 7 sekcji z liczbami per-etap (PZ → WZ).
2. `/warehouse/deliveries` pokazuje 1 PZ od „Ferma Drobiu ABC" z CCP1 ✓.
3. `/genealogy` dla partii kebabu pokazuje drzewo: PZ → surowiec → mięso → masa → kebab → 5 palet.
4. `/shipping/shipments` pokazuje 1 WZ (Shipped) z 5 paletami.
5. Brak `TypeError` przy renderowaniu wyników (kontrakt zgodny z UI).
