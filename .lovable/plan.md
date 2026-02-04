

## Pełny Audyt Funkcji `simulate_full_production_day()` - Krok po Kroku

### Podsumowanie: Znaleziony błąd

```text
┌─────────────────────────────────────────────────────────────────┐
│ LINIA 95 - INSERT INTO t_shipments                              │
│                                                                 │
│   status: 'shipped'    ❌  BŁĄD - małe litery                   │
│   status: 'Shipped'    ✅  POPRAWNA wartość enum                │
│                                                                 │
│ Dozwolone wartości enum shipment_status:                        │
│   • 'Planning'                                                  │
│   • 'Loading'                                                   │
│   • 'Shipped'     ← wymagane S z wielkiej litery                │
│   • 'Delivered'                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Audyt Krok po Kroku - Wszystkie INSERT

#### 1. t_companies (linia 34) ✅ OK
```sql
INSERT INTO t_companies (name, short_name, tax_id, is_active) 
VALUES ('Kebab Test Factory', 'KTF', 'PL1234567890', true)
```
| Kolumna | Wartość | Typ w DB | Status |
|---------|---------|----------|--------|
| name | 'Kebab Test Factory' | text NOT NULL | ✅ |
| short_name | 'KTF' | text | ✅ |
| tax_id | 'PL1234567890' | text NOT NULL | ✅ |
| is_active | true | boolean | ✅ |

#### 2. t_facilities (linia 35) ✅ OK
```sql
INSERT INTO t_facilities (company_id, name, type) 
VALUES (v_company_id, 'Zakład Produkcyjny', 'Plant')
```
| Kolumna | Wartość | Typ w DB | Dozwolone | Status |
|---------|---------|----------|-----------|--------|
| type | 'Plant' | facility_type enum | Plant, Warehouse, Office, Store | ✅ |

#### 3. t_storage_locations (linia 36) ✅ OK
```sql
INSERT INTO t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active) 
VALUES (v_facility_id, 'Magazyn Chłodniczy', 'chiller', -2, 4, true)
```
| Kolumna | Wartość | Typ w DB | Status |
|---------|---------|----------|--------|
| location_type | 'chiller' | text NOT NULL | ✅ |

#### 4. t_products (linie 39-44) ✅ OK
```sql
INSERT INTO t_products (company_id, name, sku, industry_category, unit) 
VALUES (v_company_id, 'Ćwiartka kurczaka klasy A', 'SU-KURCZAK-001', 'RawMeat', 'kg')
```
| Kolumna | Wartości używane | Typ w DB | Status |
|---------|------------------|----------|--------|
| industry_category | RawMeat, SemiFinished, FinishedGood, Waste, Spice | text (nie enum) | ✅ |

#### 5. t_recipes (linia 47) ✅ OK
```sql
INSERT INTO t_recipes (company_id, name, base_product_id, product_id, target_yield_percent, is_active)
```
Wszystkie kolumny poprawne.

#### 6. t_recipe_ingredients (linia 48) ✅ OK
```sql
INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, amount_per_kg_base, unit)
```
Wszystkie kolumny poprawne.

#### 7. t_batches (linie 51-52, 58-59, 61-62, 71-72, 80-81) ✅ OK
```sql
INSERT INTO t_batches (..., status, ...) VALUES (..., 'Released', ...)
UPDATE t_batches SET current_quantity = 0, status = 'Blocked' WHERE ...
```
| Kolumna | Wartości używane | Enum batch_status | Status |
|---------|------------------|-------------------|--------|
| status | 'Released', 'Blocked' | Released, Blocked, Quarantine | ✅ |

#### 8. t_production_orders (linie 54, 67, 76, 86) ✅ OK
```sql
INSERT INTO t_production_orders (..., type, status, ...)
VALUES (..., 'Decomposition', 'Closed', ...)
```
| Kolumna | Wartości używane | Enum | Status |
|---------|------------------|------|--------|
| type | Decomposition, Processing, Assembly, Freezing | production_order_type | ✅ |
| status | Closed | production_order_status (Open, Closed, Cancelled) | ✅ |

#### 9. t_production_inputs (linie 55, 68, 77, 87) ✅ OK
```sql
INSERT INTO t_production_inputs (production_order_id, batch_id, product_id, weight)
```
Wszystkie kolumny poprawne.

#### 10. t_production_logs (linie 64-65, 74, 83, 88) ✅ OK
```sql
INSERT INTO t_production_logs (production_order_id, output_batch_id, product_id, 
                               weight_net, weight_gross, process_stage, ...)
```
| Kolumna | Typ w DB | Status |
|---------|----------|--------|
| process_stage | text (nie enum) | ✅ |

#### 11. t_production_kebab_variants (linia 84) ✅ OK
```sql
INSERT INTO t_production_kebab_variants (production_log_id, variant_name, variant_weight, quantity, total_weight)
```
Wszystkie kolumny poprawne.

#### 12. t_handling_units (linia 91) ✅ OK
```sql
INSERT INTO t_handling_units (company_id, facility_id, sscc_number, type, status, 
                              total_net_weight, items_count, production_date, label_printed)
VALUES (..., 'Pallet', 'Ready', ...)
```
| Kolumna | Wartość | Typ w DB | Status |
|---------|---------|----------|--------|
| type | 'Pallet' | text (domyślnie 'Pallet') | ✅ |
| status | 'Ready' | text (domyślnie 'Open') | ✅ |

#### 13. t_shipments (linia 95) ❌ BŁĄD
```sql
INSERT INTO t_shipments (company_id, facility_id, shipment_number, status, 
                         dispatch_date, driver_name, truck_plates, total_net_weight, pallets_count) 
VALUES (..., 'shipped', ...)  -- ❌ BŁĘDNE
```
| Kolumna | Wartość użyta | Enum shipment_status | Status |
|---------|---------------|----------------------|--------|
| status | `'shipped'` | Planning, Loading, **Shipped**, Delivered | ❌ BŁĄD |

**Wymaga: `'Shipped'` (z wielką literą S)**

#### 14. t_shipment_items (linie 97) ✅ OK
```sql
INSERT INTO t_shipment_items (shipment_id, handling_unit_id, batch_id, product_id, quantity)
```
Wszystkie kolumny poprawne.

---

### Podsumowanie Audytu

| # | Tabela | Linie | Status |
|---|--------|-------|--------|
| 1 | t_companies | 34 | ✅ OK |
| 2 | t_facilities | 35 | ✅ OK |
| 3 | t_storage_locations | 36 | ✅ OK |
| 4 | t_products | 39-44 | ✅ OK |
| 5 | t_recipes | 47 | ✅ OK |
| 6 | t_recipe_ingredients | 48 | ✅ OK |
| 7 | t_batches | 51-81 | ✅ OK |
| 8 | t_production_orders | 54-86 | ✅ OK |
| 9 | t_production_inputs | 55-87 | ✅ OK |
| 10 | t_production_logs | 64-88 | ✅ OK |
| 11 | t_production_kebab_variants | 84 | ✅ OK |
| 12 | t_handling_units | 91 | ✅ OK |
| 13 | t_shipments | 95 | ❌ BŁĄD - `'shipped'` → `'Shipped'` |
| 14 | t_shipment_items | 97 | ✅ OK |

---

### Rozwiązanie

Utworzę migrację SQL, która zmieni **jedynie linię 95** - wartość statusu z `'shipped'` na `'Shipped'`:

```sql
-- Linia 95 - BYŁO:
'shipped'

-- Linia 95 - BĘDZIE:
'Shipped'
```

### Pliki do utworzenia

| Plik | Opis |
|------|------|
| `supabase/migrations/[timestamp].sql` | Migracja z poprawioną funkcją simulate_full_production_day() |

### Weryfikacja po wdrożeniu

Po wdrożeniu migracji uruchom symulację ponownie. Powinna zakończyć się sukcesem z pełnym przepływem:

```text
Surowiec (5000kg) 
  → Rozbiór (3000kg mięso + 1900kg odpady)
    → Masowanie (3300kg masa)
      → Składanie (205 słupków)
        → Mrożenie szokowe
          → Wysyłka (5 palet, status: Shipped) ✅
```

