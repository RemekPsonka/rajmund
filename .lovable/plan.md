# Sprint: Walidacja receptury w Tumblerze

## Cel
Operator masowni widzi recepturę i jej składniki w czasie rzeczywistym; "ZAKOŃCZ PARTIĘ" wymaga zgodności wsadu z recepturą (±5% per składnik).

## Decyzje vs. brief

1. **Wybór receptury "przed wyborem partii"** — w briefie. Kontra: obecny flow Tumblera ma 3 stepy (input → processing → output), gdzie receptura jest wybierana w step 2. Przeniesienie na sam początek wymaga refactoru wszystkich 3 stepów, dodatkowo robocze: receptura często ZALEŻY od dostępnych partii surowca, nie odwrotnie. **Decyzja: dodaję selektor receptury jako nową sekcję NA SAMEJ GÓRZE step "input"** (nad logowaniem pracownika), co semantycznie spełnia "przed wyborem partii", a fizycznie nie wywraca flowa.
2. **`role` w `t_recipe_ingredients`** — brak w schemacie, dodaję migracją (text NOT NULL DEFAULT 'MEAT'). Wartości: `MEAT | SPICE | WATER | OTHER`. Domyślnie wszystkie istniejące → 'MEAT' (zgodnie z briefem).
3. **`stage` w `t_recipes`** — nie istnieje, brief pisze "jeśli mają jakieś pole stage" — pomijam filtr, lista pokazuje wszystkie aktywne receptury company.
4. **Tolerancja ±5%** — UI-side stała `RECIPE_TOLERANCE_PERCENT = 5`.
5. **Mapowanie partii → role** — partia ma produkt; produkt ma `industry_category`. W tabeli "Aktualne" sumuję `inputItems` po `role` składnika. **Mapowanie**: dla każdego `inputItem` szukam matchującego `recipe_ingredient` po `product_id` (1:1) i sumuję wagę; jeśli partia jest produktem spoza receptury — NIE liczy się jako żaden składnik (operator widzi to w toaście "Partia X nie jest składnikiem receptury"). Bez heurystyki "MEAT/SPICE/WATER" przy skanowaniu — to wynika z product_id składnika.
6. **`target_total_kg`** — nowy lokalny state w komponencie (Input number, default 100). Wymagana ilość per składnik = `target_total_kg * (ratio_normalized)`, gdzie ratio_normalized to `amount_per_kg_base / sum(amount_per_kg_base)` — bo brief wprost mówi "mięso 80%, przyprawa 5%, woda 15%" jako PROCENTY. Receptura w bazie trzyma to jako raw `amount_per_kg_base`, normalizujemy do 100% sumy.

## Pliki

### 1. `supabase/migrations/<timestamp>_add_role_to_recipe_ingredients.sql` (nowy)
```sql
ALTER TABLE public.t_recipe_ingredients
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'MEAT';

COMMENT ON COLUMN public.t_recipe_ingredients.role IS
  'Rola składnika w recepturze: MEAT | SPICE | WATER | OTHER. Wpływa na walidacje wsadu.';

-- Trigger walidujący wartości (CHECK constraint nie używamy zgodnie ze standardem projektu)
CREATE OR REPLACE FUNCTION public.validate_recipe_ingredient_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role NOT IN ('MEAT','SPICE','WATER','OTHER') THEN
    RAISE EXCEPTION 'Invalid recipe ingredient role: %', NEW.role;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_recipe_ingredient_role ON public.t_recipe_ingredients;
CREATE TRIGGER trg_validate_recipe_ingredient_role
  BEFORE INSERT OR UPDATE ON public.t_recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_ingredient_role();
```

### 2. `src/hooks/useRecipes.ts` (edit)
- `RecipeIngredient`: dodać `role: 'MEAT' | 'SPICE' | 'WATER' | 'OTHER'`.
- `useSaveRecipeWithIngredients`: rozszerzyć ingredient mapping o `role` (default 'MEAT' jeśli niepodane — żeby istniejące formularze receptur nie wybuchły).

### 3. `src/pages/production/TumblerTerminalPage.tsx` (edit)
- **Nowy state**: `targetTotalKg` (number, default 100).
- **Move state hoist**: `selectedRecipeId` już jest, używam go też w step "input".
- **Nowa sekcja na górze step="input"** — `Card` z:
  - `Select` receptur (lista z `recipes` filtrowane po `selectedOrder.company_id`).
  - `Input number` "Cel kg" (`targetTotalKg`).
  - Jeśli `recipes?.length === 0`: żółty alert "Brak zdefiniowanej receptury. Możesz kontynuować w trybie ręcznym, ale system nie sprawdzi zgodności."
  - Jeśli wybrana: tabela składników z 4 kolumnami: Nazwa | Wymagane | Aktualne | Status (zielona/czerwona kropka).
- **Logika walidacji** (`useMemo`):
  ```ts
  const recipeCheck = useMemo(() => {
    if (!selectedRecipeId || !recipeIngredients?.length) return { ok: true, perIngredient: [] };
    const sumRatio = recipeIngredients.reduce((s,i)=>s+(Number(i.amount_per_kg_base)||0),0) || 1;
    const perIngredient = recipeIngredients.map(ing => {
      const required = targetTotalKg * (Number(ing.amount_per_kg_base)||0) / sumRatio;
      const actual = inputItems
        .filter(it => it.productId === ing.product_id)
        .reduce((s,it)=>s+it.weight,0);
      const tol = required * (RECIPE_TOLERANCE_PERCENT/100);
      const inTol = Math.abs(actual - required) <= tol;
      return { ing, required, actual, inTol };
    });
    return { ok: perIngredient.every(p=>p.inTol), perIngredient };
  }, [selectedRecipeId, recipeIngredients, inputItems, targetTotalKg]);
  ```
- **Rozszerz `canFinish`**: `canFinish = hasInputs && hasPostWeight && recipeCheck.ok`. Jeśli `selectedRecipeId === ""` (manual mode) — `recipeCheck.ok = true` (pomijamy walidację, bo operator świadomie pracuje bez receptury — patrz alert).
- **`finishDisabledReason`**: dodaj wariant "Wsad niezgodny z recepturą — sprawdź składniki".
- **Bez zmian w istniejącym step 2 (`processing`)** — pozostaje jako podsumowanie/uzysk; selektor receptury tam nadal działa, ale jest zsynchronizowany przez `selectedRecipeId`.

## Acceptance check
1. Operator wchodzi w step "input" → widzi sekcję "Receptura" jako pierwszą kartę. ✅
2. Brak receptur → żółty alert. ✅
3. Wybór receptury 80%/15%/5% + target 100kg → tabela: Mięso wymag.=80, Przyprawa wymag.=5, Woda wymag.=15. Aktualne = 0. Statusy czerwone. ✅
4. Skanowanie partii sumuje się po `product_id` w kolumnie "Aktualne". 78/16/4.5 → wszystkie zielone. ✅
5. ZAKOŃCZ PARTIĘ disabled przy 50kg mięsa, enabled przy 78kg. ✅
6. Tooltip pokazuje powód blokady. ✅

## Pliki dotykane
- `supabase/migrations/<ts>_add_role_to_recipe_ingredients.sql` (nowy)
- `src/hooks/useRecipes.ts` (rozszerzenie typu + insert)
- `src/pages/production/TumblerTerminalPage.tsx` (nowa sekcja + walidacja)

## Po sprincie
Update `mem://features/mes-tumbler-workflow` o nowy guard receptury.
