-- === MODULE: PROCESSING & PACKING ===

-- 15. Recipes Table (Technology/Formulation)
CREATE TABLE public.t_recipes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id),
    product_id UUID REFERENCES public.t_products(id), -- Final product (e.g., "Kebab Czerwony")
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Recipe Ingredients
CREATE TABLE public.t_recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES public.t_recipes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.t_products(id), -- Ingredient
    ratio DECIMAL(10, 4) NOT NULL, -- Amount per 1 kg of finished product
    unit TEXT DEFAULT 'kg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Handling Units (Pallets / SSCC) - Key for shipping
CREATE TABLE public.t_handling_units (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id),
    facility_id UUID NOT NULL REFERENCES public.t_facilities(id),
    
    sscc_number TEXT UNIQUE NOT NULL,
    
    type TEXT DEFAULT 'Pallet' CHECK (type IN ('Pallet', 'Container', 'Box')),
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Shipped')),
    
    total_net_weight DECIMAL(10, 2) DEFAULT 0,
    total_gross_weight DECIMAL(10, 2) DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    
    label_printed BOOLEAN DEFAULT FALSE,
    production_date DATE DEFAULT CURRENT_DATE,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. Add handling_unit_id to production_logs
ALTER TABLE public.t_production_logs 
ADD COLUMN IF NOT EXISTS handling_unit_id UUID REFERENCES public.t_handling_units(id);

-- 19. Add machine_id to production_orders (for tumbler/masownica)
ALTER TABLE public.t_production_orders 
ADD COLUMN IF NOT EXISTS machine_id TEXT;

-- === RLS POLICIES ===

ALTER TABLE public.t_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_handling_units ENABLE ROW LEVEL SECURITY;

-- Recipes RLS
CREATE POLICY "Global admins can do everything with recipes"
ON public.t_recipes FOR ALL
USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view recipes in their companies"
ON public.t_recipes FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage recipes"
ON public.t_recipes FOR ALL
USING (
    public.has_company_access(auth.uid(), company_id) 
    AND public.has_role(auth.uid(), 'facility_admin')
);

-- Recipe Ingredients RLS
CREATE POLICY "Global admins can do everything with recipe ingredients"
ON public.t_recipe_ingredients FOR ALL
USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view recipe ingredients"
ON public.t_recipe_ingredients FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.t_recipes r 
        WHERE r.id = t_recipe_ingredients.recipe_id 
        AND public.has_company_access(auth.uid(), r.company_id)
    )
);

CREATE POLICY "Facility admins can manage recipe ingredients"
ON public.t_recipe_ingredients FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.t_recipes r 
        WHERE r.id = t_recipe_ingredients.recipe_id 
        AND public.has_company_access(auth.uid(), r.company_id)
    )
    AND public.has_role(auth.uid(), 'facility_admin')
);

-- Handling Units RLS
CREATE POLICY "Global admins can do everything with handling units"
ON public.t_handling_units FOR ALL
USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view handling units in their companies"
ON public.t_handling_units FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Operators can manage handling units"
ON public.t_handling_units FOR ALL
USING (
    public.has_facility_access(auth.uid(), facility_id) 
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- === HELPER FUNCTIONS ===

-- Generate SSCC number (simplified version)
CREATE OR REPLACE FUNCTION public.generate_sscc_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date TEXT;
    v_random TEXT;
    v_sscc TEXT;
BEGIN
    v_date := TO_CHAR(NOW(), 'YYMMDDHH24MI');
    v_random := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    v_sscc := '00' || v_date || v_random;
    RETURN v_sscc;
END;
$$;

-- Update handling unit totals (trigger function)
CREATE OR REPLACE FUNCTION public.update_handling_unit_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.handling_unit_id IS NOT NULL THEN
        UPDATE public.t_handling_units
        SET 
            total_net_weight = (
                SELECT COALESCE(SUM(weight_net), 0) 
                FROM public.t_production_logs 
                WHERE handling_unit_id = NEW.handling_unit_id
            ),
            total_gross_weight = (
                SELECT COALESCE(SUM(weight_gross), 0) 
                FROM public.t_production_logs 
                WHERE handling_unit_id = NEW.handling_unit_id
            ),
            items_count = (
                SELECT COUNT(*) 
                FROM public.t_production_logs 
                WHERE handling_unit_id = NEW.handling_unit_id
            ),
            updated_at = NOW()
        WHERE id = NEW.handling_unit_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger to auto-update handling unit totals
CREATE TRIGGER trg_update_handling_unit_totals
AFTER INSERT OR UPDATE ON public.t_production_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_handling_unit_totals();

-- === INDEXES ===
CREATE INDEX idx_recipes_company ON public.t_recipes(company_id);
CREATE INDEX idx_recipes_product ON public.t_recipes(product_id);
CREATE INDEX idx_recipe_ingredients_recipe ON public.t_recipe_ingredients(recipe_id);
CREATE INDEX idx_handling_units_company ON public.t_handling_units(company_id);
CREATE INDEX idx_handling_units_facility ON public.t_handling_units(facility_id);
CREATE INDEX idx_handling_units_status ON public.t_handling_units(status);
CREATE INDEX idx_production_logs_handling_unit ON public.t_production_logs(handling_unit_id);