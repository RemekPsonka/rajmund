-- 1. Rozbudowa Produktów o Kategorie Branżowe
ALTER TABLE public.t_products 
ADD COLUMN IF NOT EXISTS industry_category TEXT CHECK (industry_category IN (
    'RawMeat',       -- Mięso Surowe (Ćwiartka, Filet)
    'Spice',         -- Przyprawy (Proszki)
    'Additive',      -- Dodatki (Woda, Solanki, Białko)
    'Packaging',     -- Folia, Karton, Tuleja
    'Casing',        -- Osłonki
    'Waste',         -- Odpad (Kości, Skóry - jeśli nie handlowe)
    'FinishedGood'   -- Gotowy Kebab/Mrożonka
));

-- 2. Zaawansowane Receptury (Technologia)
ALTER TABLE public.t_recipes 
ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES public.t_products(id),
ADD COLUMN IF NOT EXISTS target_yield_percent DECIMAL(5,2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS process_instructions TEXT;

-- 3. Składniki Receptury (Precyzja)
ALTER TABLE public.t_recipe_ingredients 
ADD COLUMN IF NOT EXISTS amount_per_kg_base DECIMAL(10, 4);

-- 4. Kontrola Produkcji (Odchylenia)
-- Używamy (weight_gross - weight_tare) zamiast weight_net, bo weight_net jest już GENERATED
ALTER TABLE public.t_production_logs 
ADD COLUMN IF NOT EXISTS process_stage TEXT CHECK (process_stage IN ('Decomposition', 'Massaging', 'Stacking', 'Freezing')),
ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES public.t_recipes(id),
ADD COLUMN IF NOT EXISTS expected_weight DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS deviation_kg DECIMAL(10, 2) GENERATED ALWAYS AS (
  (weight_gross - COALESCE(weight_tare, 0)) - expected_weight
) STORED,
ADD COLUMN IF NOT EXISTS deviation_percent DECIMAL(5, 2) GENERATED ALWAYS AS (
  CASE WHEN expected_weight > 0 THEN (((weight_gross - COALESCE(weight_tare, 0)) - expected_weight) / expected_weight) * 100 ELSE 0 END
) STORED;

-- 5. Warianty Kebaba (Słupki 5kg, 10kg...)
CREATE TABLE IF NOT EXISTS public.t_production_kebab_variants (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    production_log_id UUID REFERENCES public.t_production_logs(id) ON DELETE CASCADE,
    variant_weight DECIMAL(5,2),
    quantity INTEGER,
    total_weight DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS dla nowej tabeli
ALTER TABLE public.t_production_kebab_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view kebab variants"
ON public.t_production_kebab_variants
FOR SELECT
USING (is_authenticated());

CREATE POLICY "Users can manage kebab variants"
ON public.t_production_kebab_variants
FOR ALL
USING (is_authenticated())
WITH CHECK (is_authenticated());

-- Komentarze
COMMENT ON COLUMN public.t_products.industry_category IS 'Kategoria branżowa: RawMeat, Spice, Additive, Packaging, Casing, Waste, FinishedGood';
COMMENT ON COLUMN public.t_recipes.base_product_id IS 'Główny surowiec receptury (np. Filet do kebaba)';
COMMENT ON COLUMN public.t_recipes.target_yield_percent IS 'Oczekiwany uzysk np. 120% = 100kg mięsa + 20l wody = 120kg';
COMMENT ON COLUMN public.t_recipe_ingredients.amount_per_kg_base IS 'Ilość składnika na 1kg surowca bazowego (np. 0.020 = 20g/kg)';
COMMENT ON COLUMN public.t_production_logs.deviation_kg IS 'Odchylenie od normy w kg (wyliczane automatycznie)';
COMMENT ON COLUMN public.t_production_logs.deviation_percent IS 'Odchylenie od normy w % (wyliczane automatycznie)';