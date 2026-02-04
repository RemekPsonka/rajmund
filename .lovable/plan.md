
## Plan: Naprawa błędu symulacji przepływu kebabowego

### Zidentyfikowany problem
Błąd w logach bazy danych:
```
null value in column "ratio" of relation "t_recipe_ingredients" violates not-null constraint
```

**Przyczyna:** W funkcji `simulate_full_production_day()` brakuje wartości `ratio` przy wstawianiu składnika receptury (linia 50):
```sql
INSERT INTO t_recipe_ingredients (recipe_id, product_id, amount_per_kg_base, unit) 
VALUES (v_recipe_id, v_spice_mix_id, 0.015, 'kg');
-- Brakuje: ratio!
```

### Schemat tabeli t_recipe_ingredients

| Kolumna | Typ | Nullable | Opis |
|---------|-----|----------|------|
| id | uuid | NO | Auto-generowany |
| recipe_id | uuid | NO | FK do receptury |
| product_id | uuid | NO | FK do produktu |
| **ratio** | numeric | **NO** | ⚠️ **WYMAGANE** |
| unit | text | YES | Domyślnie 'kg' |
| amount_per_kg_base | numeric | YES | Opcjonalne |

---

## Rozwiązanie

### Krok 1: Aktualizacja funkcji SQL symulacji

Zaktualizuję migrację z funkcją `simulate_full_production_day()` - dodając brakujący parametr `ratio`:

```sql
-- PRZED (błędne):
INSERT INTO t_recipe_ingredients (recipe_id, product_id, amount_per_kg_base, unit) 
VALUES (v_recipe_id, v_spice_mix_id, 0.015, 'kg');

-- PO (poprawne):
INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, amount_per_kg_base, unit) 
VALUES (v_recipe_id, v_spice_mix_id, 0.015, 0.015, 'kg');
```

Wartość `ratio` = `amount_per_kg_base` zgodnie z logiką aplikacji (patrz `useRecipes.ts` linia 172).

---

## Szczegóły techniczne

### Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| **Nowa migracja SQL** | Funkcja `simulate_full_production_day()` z dodanym `ratio` |

### SQL migracji

```sql
DROP FUNCTION IF EXISTS public.simulate_full_production_day();

CREATE OR REPLACE FUNCTION public.simulate_full_production_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
-- ... (cała funkcja jak poprzednio, ale z poprawionym INSERT)
  
  -- Recipe - POPRAWIONA LINIA
  INSERT INTO t_recipe_ingredients (recipe_id, product_id, ratio, amount_per_kg_base, unit) 
  VALUES (v_recipe_id, v_spice_mix_id, 0.015, 0.015, 'kg');

-- ... reszta funkcji bez zmian
$function$;
```

---

## Po naprawie

Symulacja będzie:
1. Tworzyć recepturę z prawidłowym składnikiem (ratio + amount_per_kg_base)
2. Wykonywać pełny przepływ: Surowiec → Rozbiór → Masowanie → Składanie → Mrożenie → Wysyłka
3. Generować 205 słupków kebab w wariantach 10kg/15kg/20kg
4. Tworzyć 5 palet SSCC ze statusem "Shipped"
