-- --- MODUŁ MES: PRODUKCJA I ROZBIÓR ---

-- 1. Typ zlecenia produkcyjnego
CREATE TYPE public.production_order_type AS ENUM ('Decomposition', 'Processing', 'Packing');

-- 2. Status zlecenia
CREATE TYPE public.production_order_status AS ENUM ('Open', 'Closed', 'Cancelled');

-- 3. Zlecenia Produkcyjne (Nagłówki)
CREATE TABLE public.t_production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE RESTRICT,
    facility_id UUID NOT NULL REFERENCES public.t_facilities(id) ON DELETE RESTRICT,
    
    order_number TEXT NOT NULL,
    type public.production_order_type DEFAULT 'Decomposition',
    status public.production_order_status DEFAULT 'Open',
    
    production_date DATE DEFAULT CURRENT_DATE,
    supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Wsad do Produkcji (RW - Wydanie do rozbioru)
CREATE TABLE public.t_production_inputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID NOT NULL REFERENCES public.t_production_orders(id) ON DELETE CASCADE,
    
    batch_id UUID NOT NULL REFERENCES public.t_batches(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.t_products(id) ON DELETE RESTRICT,
    
    weight DECIMAL(10, 2) NOT NULL,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Wyniki Produkcji (PW - Logi z wag)
CREATE TABLE public.t_production_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID NOT NULL REFERENCES public.t_production_orders(id) ON DELETE CASCADE,
    
    employee_id UUID REFERENCES public.t_employees(id) ON DELETE SET NULL,
    
    product_id UUID NOT NULL REFERENCES public.t_products(id) ON DELETE RESTRICT,
    
    source_batch_id UUID REFERENCES public.t_batches(id) ON DELETE SET NULL,
    
    weight_gross DECIMAL(10, 2) NOT NULL,
    weight_tare DECIMAL(10, 2) DEFAULT 0,
    weight_net DECIMAL(10, 2) GENERATED ALWAYS AS (weight_gross - COALESCE(weight_tare, 0)) STORED,
    
    packaging_type TEXT DEFAULT 'E2',
    packaging_count INTEGER DEFAULT 1,
    
    scale_device_id TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- INDEKSY DLA WYDAJNOŚCI RAPORTOWANIA ---
CREATE INDEX idx_production_orders_company ON public.t_production_orders(company_id);
CREATE INDEX idx_production_orders_facility ON public.t_production_orders(facility_id);
CREATE INDEX idx_production_orders_date ON public.t_production_orders(production_date);
CREATE INDEX idx_production_orders_status ON public.t_production_orders(status);

CREATE INDEX idx_production_inputs_order ON public.t_production_inputs(production_order_id);
CREATE INDEX idx_production_inputs_batch ON public.t_production_inputs(batch_id);

CREATE INDEX idx_production_logs_order ON public.t_production_logs(production_order_id);
CREATE INDEX idx_production_logs_employee ON public.t_production_logs(employee_id);
CREATE INDEX idx_production_logs_source_batch ON public.t_production_logs(source_batch_id);
CREATE INDEX idx_production_logs_created ON public.t_production_logs(created_at);

-- --- ZABEZPIECZENIA RLS ---
ALTER TABLE public.t_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_production_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_production_logs ENABLE ROW LEVEL SECURITY;

-- Polityki dla t_production_orders
CREATE POLICY "Global admins can do everything with production orders" ON public.t_production_orders
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view production orders in their companies" ON public.t_production_orders
FOR SELECT USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage production orders" ON public.t_production_orders
FOR ALL USING (public.has_facility_access(auth.uid(), facility_id));

CREATE POLICY "Operators can manage production orders in their facilities" ON public.t_production_orders
FOR ALL USING (
    public.has_facility_access(auth.uid(), facility_id) 
    AND public.has_role(auth.uid(), 'operator')
);

-- Polityki dla t_production_inputs
CREATE POLICY "Global admins can do everything with production inputs" ON public.t_production_inputs
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view production inputs" ON public.t_production_inputs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.t_production_orders po 
        WHERE po.id = production_order_id 
        AND public.has_company_access(auth.uid(), po.company_id)
    )
);

CREATE POLICY "Operators can manage production inputs" ON public.t_production_inputs
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.t_production_orders po 
        WHERE po.id = production_order_id 
        AND public.has_facility_access(auth.uid(), po.facility_id)
    )
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- Polityki dla t_production_logs
CREATE POLICY "Global admins can do everything with production logs" ON public.t_production_logs
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view production logs" ON public.t_production_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.t_production_orders po 
        WHERE po.id = production_order_id 
        AND public.has_company_access(auth.uid(), po.company_id)
    )
);

CREATE POLICY "Operators can insert production logs" ON public.t_production_logs
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.t_production_orders po 
        WHERE po.id = production_order_id 
        AND public.has_facility_access(auth.uid(), po.facility_id)
    )
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- --- TRIGGERY ---
CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON public.t_production_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --- FUNKCJA GENEROWANIA NUMERU ZLECENIA ---
CREATE OR REPLACE FUNCTION public.generate_production_order_number(p_company_id UUID, p_type public.production_order_type)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date TEXT;
    v_prefix TEXT;
    v_count INTEGER;
    v_order_number TEXT;
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYY/MM/DD');
    
    v_prefix := CASE p_type
        WHEN 'Decomposition' THEN 'ROZ'
        WHEN 'Processing' THEN 'PRZ'
        WHEN 'Packing' THEN 'PAK'
        ELSE 'PROD'
    END;
    
    SELECT COUNT(*) + 1 INTO v_count 
    FROM public.t_production_orders 
    WHERE company_id = p_company_id 
    AND order_number LIKE v_prefix || '/' || v_date || '/%';
    
    v_order_number := v_prefix || '/' || v_date || '/' || LPAD(v_count::TEXT, 2, '0');
    
    RETURN v_order_number;
END;
$$;

-- --- FUNKCJA OBLICZAJĄCA UZYSK (YIELD) DLA ZLECENIA ---
CREATE OR REPLACE FUNCTION public.calculate_production_yield(p_order_id UUID)
RETURNS TABLE (
    total_input_weight DECIMAL(10,2),
    total_output_weight DECIMAL(10,2),
    yield_percentage DECIMAL(5,2),
    waste_percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_input DECIMAL(10,2);
    v_output DECIMAL(10,2);
BEGIN
    -- Suma wsadów
    SELECT COALESCE(SUM(weight), 0) INTO v_input
    FROM public.t_production_inputs
    WHERE production_order_id = p_order_id;
    
    -- Suma wyników (netto)
    SELECT COALESCE(SUM(weight_net), 0) INTO v_output
    FROM public.t_production_logs
    WHERE production_order_id = p_order_id;
    
    total_input_weight := v_input;
    total_output_weight := v_output;
    
    IF v_input > 0 THEN
        yield_percentage := ROUND((v_output / v_input) * 100, 2);
        waste_percentage := ROUND(100 - (v_output / v_input) * 100, 2);
    ELSE
        yield_percentage := 0;
        waste_percentage := 0;
    END IF;
    
    RETURN NEXT;
END;
$$;