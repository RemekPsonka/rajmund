# Sprint — Selektor produktu docelowego w Kebab Assembly

## Stan zastany
- `KebabAssemblyTerminalPage.tsx:195` — hardcode `outputProductId = finishedProducts[0]?.id`. Jeśli więcej niż jeden FinishedGood w bazie, każda partia trafia na pierwszy produkt z listy. Krytyczny błąd dla multi-SKU.
- `useProducts()` w `src/hooks/useProducts.ts` — brak filtra po kategorii.
- W `t_products` istnieje już kolumna `industry_category text` z wartościami enum-like (`'FinishedGood'`, `'RawMeat'`, `'SemiFinished'`, `'Spice'`, `'Waste'`, `'Packaging'`, `'Casing'`, `'Additive'`). Symulator (`simulate_full_production_day`) tworzy kebab jako `industry_category='FinishedGood'`.
- Brak kolumn `unit_target_weight_kg` ani `product_category` w `t_products`.

## Decyzje (odchyłka od briefu — uzasadnienie)

1. **Nie dodaję `product_category`** — w `t_products.industry_category` istnieje już taksonomia produktów (8 wartości, pamięć `industry-product-categories`). Dodawanie równoległej kolumny `product_category text CHECK IN (...)` wymagałoby zmapowania wszystkich istniejących wpisów, dwóch źródeł prawdy o kategorii i przepisania listy produktów. Zamiast tego filtruję `industry_category = 'FinishedGood'` (jedyna kategoria semantycznie odpowiadająca "kebab gotowy do złożenia w słupek"). Operator nazywa je w UI "produktem kebabowym", w bazie pozostaje `FinishedGood`.
2. **Dodaję `unit_target_weight_kg numeric NULL`** w `t_products` migracją. Bez tego nie da się powiązać produktu z wagą docelową szpady. Default brak (NULL) → fallback do obecnego `KEBAB_WEIGHT_VARIANTS`.

## Zmiany

### 1. Migracja SQL
Plik: `supabase/migrations/<ts>_add_unit_target_weight_to_products.sql`
```sql
ALTER TABLE public.t_products
  ADD COLUMN IF NOT EXISTS unit_target_weight_kg numeric NULL;

COMMENT ON COLUMN public.t_products.unit_target_weight_kg IS
  'Domyślna waga jednostkowa wyrobu (np. szpady kebabu) w kg. Używana jako preset w terminalu składania.';
```

### 2. `src/hooks/useProducts.ts`
- Rozszerzyć `Product` o `unit_target_weight_kg: number | null`.
- Rozszerzyć `ProductFormData` o `unit_target_weight_kg?: number`.
- `useProducts` przyjmuje opcjonalny drugi argument: `useProducts(companyId?: string, industryCategory?: IndustryCategory)` — gdy podany, dorzuca `.eq('industry_category', industryCategory)` do query, queryKey rozszerzony o `industryCategory`.

### 3. `src/pages/production/KebabAssemblyTerminalPage.tsx`

**Nowy stan:**
```ts
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
```

**Nowy hook:**
```ts
const { data: kebabProducts, isLoading: isLoadingProducts } =
  useProducts(undefined, 'FinishedGood');
```

**Usunięcia:**
- `useMemo finishedProducts` (oparte na `industry_category === "FinishedGood"`).
- Linia 195: `const outputProductId = finishedProducts[0]?.id || …` → użyć `selectedProduct.id` (gwarantowane non-null bo `canAssemble` to wymusza).

**Nowa sekcja UI — selektor produktu** (renderowana PRZED `if (!selectedBatch)` flow, jako pierwszy gate):

```tsx
// Gate 1: brak produktów kebabowych w bazie
if (!isLoadingProducts && (!kebabProducts || kebabProducts.length === 0)) {
  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Brak produktów kebabowych
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Nie zdefiniowano żadnego produktu z kategorią "Wyrób gotowy" (kebab).
            Dodaj produkt w Ustawieniach przed rozpoczęciem składania.
          </p>
          <Button onClick={() => navigate('/products')} className="w-full">
            Przejdź do Produktów
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Gate 2: produkt nie wybrany
if (!selectedProduct) {
  return (
    <div className="min-h-screen bg-background p-4">
      <header>...</header>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Wybierz produkt do składania</CardTitle>
          <CardDescription>
            Wybierz wariant kebabu, który będzie produkowany w tej sesji.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={(id) => setSelectedProduct(kebabProducts.find(p => p.id === id) ?? null)}>
            <SelectTrigger className="h-14 text-lg">
              <SelectValue placeholder="-- wybierz produkt kebabowy --" />
            </SelectTrigger>
            <SelectContent>
              {kebabProducts.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.unit_target_weight_kg ? `(${p.unit_target_weight_kg} kg/szpada)` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
```

Po wybraniu — wszystko działa jak dotychczas, ale:
- **Domyślny wariant wagi**: `useEffect(() => { if (selectedProduct?.unit_target_weight_kg) setSelectedVariant(selectedProduct.unit_target_weight_kg); }, [selectedProduct])`.
- **Tytuł sekcji "Ważenie Słupka"** → `Składanie kebabu — {selectedProduct.name}`.
- **Header** dostaje badge z nazwą produktu i przycisk "Zmień produkt" (reset `selectedProduct`, `selectedBatch`, `assembledKebabs`).
- **`product_id` w logach** → `selectedProduct.id` (zamiast `finishedProducts[0]?.id`).
- **LOT prefix**: dziś numerację partii wynikowej generuje `close_production_order_with_lineage` przez `generate_batch_number(product_id)`, która używa `t_products.sku`. Wybór produktu → inny SKU → automatycznie inny prefix LOT. Brak dodatkowej zmiany w RPC.

**`canAssemble` rozszerzone:**
```ts
const canAssemble = !!(selectedProduct && selectedBatch && createdOrderId && verifiedEmployee);
```

**Reset po `handleSaveAll`:**
```ts
setAssembledKebabs([]);
setSelectedBatch(null);
setCreatedOrderId(null);
// selectedProduct ZOSTAJE — operator zwykle składa kilka partii tego samego SKU pod rząd
```
("Zmień produkt" w headerze dla zmiany SKU.)

## Acceptance check
1. `/production/assembly` z 0 FinishedGood → blocker z linkiem do `/products`. ✅
2. ≥1 FinishedGood, brak wyboru → ekran z Selectem, reszta UI niedostępna. ✅
3. Wybór produktu → odblokowuje pełny flow (wybór partii → pracownik → ważenie). ✅
4. 2 partie z różnymi SKU → różne `product_id` w `t_batches` (i różne prefiksy LOT przez `generate_batch_number`). ✅
5. Brak `finishedProducts[0]` w pliku. ✅

## Pliki dotykane
- `supabase/migrations/<ts>_add_unit_target_weight_to_products.sql` (nowy)
- `src/hooks/useProducts.ts` (rozszerzenie)
- `src/pages/production/KebabAssemblyTerminalPage.tsx` (przepisanie nagłówka i `outputProductId`)
