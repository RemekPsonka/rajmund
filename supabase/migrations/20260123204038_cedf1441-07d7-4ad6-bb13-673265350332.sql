-- Tabela typów opakowań z wagą tary
CREATE TABLE public.t_packaging_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    tare_weight NUMERIC(10,3) DEFAULT 0,
    is_returnable BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- Tabela jednostek miary
CREATE TABLE public.t_units_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- Tabela szablonów czynności produkcyjnych
CREATE TABLE public.t_task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE CASCADE,
    production_type TEXT NOT NULL,
    name TEXT NOT NULL,
    sequence_number INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_packaging_types_company ON public.t_packaging_types(company_id);
CREATE INDEX idx_units_of_measure_company ON public.t_units_of_measure(company_id);
CREATE INDEX idx_task_templates_company_type ON public.t_task_templates(company_id, production_type);

-- RLS dla t_packaging_types
ALTER TABLE public.t_packaging_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view packaging types" ON public.t_packaging_types
    FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Users can insert packaging types" ON public.t_packaging_types
    FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Users can update packaging types" ON public.t_packaging_types
    FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Users can delete packaging types" ON public.t_packaging_types
    FOR DELETE USING (public.is_authenticated());

-- RLS dla t_units_of_measure
ALTER TABLE public.t_units_of_measure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view units" ON public.t_units_of_measure
    FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Users can insert units" ON public.t_units_of_measure
    FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Users can update units" ON public.t_units_of_measure
    FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Users can delete units" ON public.t_units_of_measure
    FOR DELETE USING (public.is_authenticated());

-- RLS dla t_task_templates
ALTER TABLE public.t_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task templates" ON public.t_task_templates
    FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Users can insert task templates" ON public.t_task_templates
    FOR INSERT WITH CHECK (public.is_authenticated());

CREATE POLICY "Users can update task templates" ON public.t_task_templates
    FOR UPDATE USING (public.is_authenticated());

CREATE POLICY "Users can delete task templates" ON public.t_task_templates
    FOR DELETE USING (public.is_authenticated());

-- Triggery updated_at
CREATE TRIGGER update_packaging_types_updated_at
    BEFORE UPDATE ON public.t_packaging_types
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_of_measure_updated_at
    BEFORE UPDATE ON public.t_units_of_measure
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_templates_updated_at
    BEFORE UPDATE ON public.t_task_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dane początkowe dla typów opakowań (dla pierwszej firmy)
INSERT INTO public.t_packaging_types (company_id, code, name, tare_weight, is_returnable)
SELECT 
    c.id,
    v.code,
    v.name,
    v.tare_weight,
    v.is_returnable
FROM public.t_companies c
CROSS JOIN (VALUES
    ('E2', 'Pojemnik E2', 2.0, true),
    ('E1', 'Pojemnik E1', 1.5, true),
    ('H1', 'Pojemnik H1', 1.8, true),
    ('KOSZ', 'Kosz plastikowy', 3.0, true),
    ('KARTON', 'Karton', 0.5, false),
    ('POLIBLOK', 'Poliblok', 0.3, false),
    ('EUR', 'Paleta EUR', 25.0, true)
) AS v(code, name, tare_weight, is_returnable)
LIMIT 7;

-- Dane początkowe dla jednostek miary
INSERT INTO public.t_units_of_measure (company_id, code, name, symbol, is_default)
SELECT 
    c.id,
    v.code,
    v.name,
    v.symbol,
    v.is_default
FROM public.t_companies c
CROSS JOIN (VALUES
    ('kg', 'Kilogram', 'kg', true),
    ('szt', 'Sztuka', 'szt', false),
    ('l', 'Litr', 'l', false),
    ('opak', 'Opakowanie', 'opak', false),
    ('m', 'Metr', 'm', false)
) AS v(code, name, symbol, is_default)
LIMIT 5;

-- Dane początkowe dla szablonów czynności
INSERT INTO public.t_task_templates (company_id, production_type, name, sequence_number)
SELECT 
    c.id,
    v.production_type,
    v.name,
    v.sequence_number
FROM public.t_companies c
CROSS JOIN (VALUES
    ('Decomposition', 'Kontrola temperatury surowca', 1),
    ('Decomposition', 'Rozbiór wstępny', 2),
    ('Decomposition', 'Rozbiór szczegółowy', 3),
    ('Decomposition', 'Pakowanie', 4),
    ('Decomposition', 'Etykietowanie', 5),
    ('Decomposition', 'Kontrola jakości', 6),
    ('Processing', 'Przygotowanie wsadu', 1),
    ('Processing', 'Masowanie', 2),
    ('Processing', 'Kontrola temperatury', 3),
    ('Processing', 'Formowanie', 4),
    ('Processing', 'Mrożenie', 5),
    ('Processing', 'Pakowanie końcowe', 6),
    ('Packing', 'Przygotowanie materiałów', 1),
    ('Packing', 'Pakowanie jednostkowe', 2),
    ('Packing', 'Etykietowanie', 3),
    ('Packing', 'Kontrola wagi', 4),
    ('Packing', 'Paletyzacja', 5)
) AS v(production_type, name, sequence_number)
LIMIT 17;