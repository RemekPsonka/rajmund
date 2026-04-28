## Czyszczenie + realny seed testowy + audyt e2e

Decyzja: **Narrow Sp. z o.o. / Zakład Myszków** zostaje, **pełen scenariusz domknięty** w seedzie.

### Krok 1 — Czyszczenie danych biznesowych (migracja DB)

Funkcja `cleanup_all_business_data()` + jej wywołanie. Kasujemy w kolejności FK:

```text
t_print_log, t_packaging_transactions
t_shipment_items → t_shipments
t_freezing_temp_log
t_production_kebab_variants → t_production_logs → t_production_inputs → t_production_orders
t_lot_lineage
t_handling_units
t_warehouse_movement_items → t_warehouse_movements
t_supplier_complaints
t_batches
t_recipe_ingredients → t_recipes
t_products
t_contractors
t_packaging_types, t_units_of_measure (wyczyść też — bo seedujemy świeże)
t_devices (wagi/skanery przeseedujemy)
```

Co **zostaje nietknięte**:
- `t_companies` — kasujemy `Kebab Test Factory` i `AUDIT KTF`, zostaje **Narrow Sp. z o.o.**
- `t_facilities` (Zakład Myszków), `t_storage_locations` (4 magazyny), `t_employees` (Jan/Adam/Anna)
- `t_departments`, `t_job_positions`, `t_task_templates`, `t_user_roles`, `t_role_permissions`, `t_app_users`

### Krok 2 — Seed realistycznych danych testowych

Funkcja `seed_kebab_test_data()` populuje firmę Narrow:

**Kontrahenci (4)**
- Drobimex Sp. z o.o. (dostawca, vet PL-30090301-WE)
- Indykpol S.A. (dostawca rezerwowy)
- Hurtownia Kebab Master (klient hurtowy)
- Trans-Kebab Kowalski (przewoźnik)

**Produkty (10) — z poprawnymi `industry_category` i SKU**
| Nazwa | Kategoria | SKU | unit_target_weight_kg |
|---|---|---|---|
| Udko z kurczaka z kością | RawMeat | RAW-UDKO | — |
| Mięso z udka (po rozbiorze) | SemiFinished | SEMI-MIESO | — |
| Skóra z kurczaka | Waste | WST-SKORA | — |
| Kości drobiowe | Waste | WST-KOSCI | — |
| Mix przypraw kebab | Spice | SPC-MIX | — |
| Woda technologiczna | Additive | ADD-WODA | — |
| Masa kebabowa masowana | SemiFinished | SEMI-MASA | — |
| Kebab Czerwony 15kg | FinishedGood | FIN-KEB-15 | 15 |
| Pojemnik E2 | Packaging | PKG-E2 | — |
| Sztyca kebabowa | Packaging | PKG-SZT | — |

**Receptura `Kebab Czerwony Standard`** (poprawna semantycznie)
- product_id → Kebab Czerwony 15kg, base_product_id → Masa kebabowa
- evaporation_percent = **3** (realne, NIE 110)
- Składniki (ratio = udział w masie wsadu):
  - Mięso z udka: ratio 0.85, role MEAT
  - Mix przypraw kebab: ratio 0.05, role SPICE
  - Woda technologiczna: ratio 0.10, role WATER

**Magazyny — uzupełnienie**
- Dodaję brakującą `Strefa wysyłki` (location_type='shipping') w Myszkowie

**Wagi i drukarki (`t_devices`)**
- Waga magazynowa WGM-01 (bramka PZ)
- Waga produkcyjna WGP-01 (rozbiór/masownia)
- Waga paletowa WGP-02 (paletyzacja)
- Drukarka etykiet DRK-01

**Opakowania (`t_packaging_types`)**
- Pojemnik E2 (tara 2.0 kg, zwrotny)
- Paleta EUR (tara 25 kg, zwrotny)
- Karton 15kg (tara 0.4 kg, jednorazowy)

### Krok 3 — Pełen scenariusz domknięty (RPC `seed_full_kebab_scenario()`)

Symuluje rzeczywisty dzień produkcyjny:

```text
1. PZ/2026/04/28/001 — Drobimex dostarcza 1 000 kg Udka, temp +2°C
   → batch RAW-UDKO 1000 kg (status Released, location: Chłodnia Przyjęć)
   → trigger RECEIVING tworzy lineage root

2. ZP-DEC/2026/001 (Decomposition, Closed)
   wsad: 1000 kg Udko →
   wyjścia: 700 kg Mięso z udka, 200 kg Skóra, 100 kg Kości
   → 3 batches potomne, 3 lineage entries DISASSEMBLY

3. Skóra + Kości → szybkie WZ-bezpośrednie (sprzedaż uboczna)
   WZ/2026/04/28/001 do Hurtownia Kebab Master
   2 batches → 2 shipment_items, status Shipped

4. ZP-PRZ/2026/001 (Processing/Tumbler, Closed)
   wsad: 700 kg Mięso + 35 kg Mix + 70 kg Woda = 805 kg
   evaporation 3% → 781 kg Masa kebabowa
   recipe_id przypisany, output_batch_id ustawiony
   → 1 batch SEMI-MASA 781 kg

5. ZP-ASM/2026/001 (Assembly, Closed)
   wsad: 781 kg Masa →
   52 sztyc po 15 kg = 780 kg Kebab Czerwony 15kg (1 kg odpad/strata)
   → batch FIN-KEB-15 780 kg, kebab_variants 52×15kg

6. ZP-FRZ/2026/001 (ShockFreezing, Closed)
   1 production_log z process_stage='ShockFreezing'
   freezing_started_at = -3h, completed = -30min
   latest_core_temp_c = -19.2, ccp_passed = TRUE
   target_core_temp_c = -18, freezing_duration_minutes = 150
   → 6 wpisów w t_freezing_temp_log (co 30 min, od +5°C do -19°C)

7. Paleta SSCC (status Closed)
   1 paleta EUR z 4 batchami × 195 kg = 780 kg
   sscc_number wygenerowany Mod10
   trigger CCP3 sprawdza ccp_passed=TRUE → przepuszcza
   trigger AGGREGATION wpisuje lineage batch→paleta

8. WZ/2026/04/28/002 (status Planning) — OTWARTE do dokończenia
   1 paleta 780 kg → Hurtownia Kebab Master
   carrier: Trans-Kebab Kowalski
   trailer_plates, driver_name wypełnione
   pallets_count, total_net_weight zsumowane przez trigger
   ← TUTAJ użytkownik klika 'Wyślij' w UI żeby zobaczyć finalizację
```

### Krok 4 — Naprawy ujawnione w poprzednim audycie (od razu w tej samej migracji)

Te z poprzedniego planu, które są niezależne od czyszczenia danych:

- `TerminalFooter` — przekazać `operator={verifiedEmployee?.name ?? null}` w `TumblerTerminalPage`
- `TumblerTerminalPage` step 3 — `{(inputItems.length + (existingInputs?.length || 0))} pozycji`
- `tumblingState` "Done" wymaga `existingLogs?.some(l => l.output_batch_id)`
- `useCreateProductionLog` — auto-set `process_stage='Tumbling'` jeśli nie podano
- `finishedProducts` w masownicy — filtr `industry_category === 'SemiFinished'`
- `t_recipes` CHECK `evaporation_percent BETWEEN 0 AND 50`

### Krok 5 — Audit e2e

Po czyszczeniu i seedzie:

1. `SELECT public.audit_e2e_flow();` → musi zwrócić `success: true`, `database_health.summary.passed = total`
2. Manualne zapytania weryfikujące **sumy się zgadzają**:
   ```sql
   -- Bilans Udka: 1000 in → 700+200+100 = 1000 out (0 strat)
   -- Bilans Mięsa: 700 in → 781 masy (+105 dodatków -3% ewap = 781) ✓
   -- Bilans Masy: 781 in → 780 kebab (1 strata, akceptowalne)
   -- Lineage: 4 poziomy (Udko→Mięso→Masa→Kebab→Paleta)
   -- Stock: Udko=0, Mięso=0, Masa=0, Kebab pallet=Released, Skóra+Kości=0 (wysłane)
   -- Shipment: WZ#001 Shipped (300kg), WZ#002 Planning (780kg)
   ```
3. Wynik audytu zapisany do `mem://audits/e2e-flow-2026-04-28-loop3.md` z bilansami sum

### Sekcja techniczna — pliki

- `supabase/migrations/...` — `cleanup_all_business_data()`, `seed_kebab_test_data()`, `seed_full_kebab_scenario()`, CHECK na evaporation, drobne triggery (jeśli WZ totals nie mają triggera) + wywołania
- `src/pages/production/TumblerTerminalPage.tsx` — naprawy step 3, footer, finishedProducts filter
- `src/hooks/useProductionOrders.ts` — auto process_stage
- `mem://audits/e2e-flow-2026-04-28-loop3.md` — wynik

### Czego NIE robię

- Nie ruszam: schematu auth/RLS, employees, magazynów, firmy Narrow, departments
- Nie kasuję firmy `Kebab Test Factory` jeśli ma jakieś referencje (sprawdzam — nie ma, kasuje się czysto). To samo `AUDIT KTF`.

**Rezultat oczekiwany**: po wykonaniu — czysta firma Narrow z 10 produktami, 4 kontrahentami, 1 receptą `Kebab Czerwony Standard`, 6 pełnymi zleceniami produkcyjnymi domkniętymi, 1 paletą zamkniętą gotową do wysyłki, 1 otwartym WZ #002 do dokończenia ręcznego. Sumy bilansują się 1:1, lineage pokrywa pełen łańcuch, audit_e2e_flow zwraca 9/9 + database_health 26/26. Możesz wejść w preview, otworzyć `/warehouse/shipments` i kliknąć finalizację WZ #002 żeby zobaczyć finał, albo `/production/tumbler` z czystymi danymi i odpalić nowy cykl od zera.