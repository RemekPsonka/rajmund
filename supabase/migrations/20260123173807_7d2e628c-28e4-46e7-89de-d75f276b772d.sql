-- --- MODUŁ TOWAROWY I MAGAZYNOWY (WMS) ---

-- 1. Tabela Produktów (Kartoteka Towarowa)
CREATE TABLE public.t_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE RESTRICT,
    
    name TEXT NOT NULL,
    sku TEXT,
    subiekt_id TEXT,
    unit TEXT DEFAULT 'kg',
    
    is_raw_material BOOLEAN DEFAULT TRUE,
    default_expiration_days INTEGER,
    min_storage_temp DECIMAL(4,1),
    max_storage_temp DECIMAL(4,1),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Typ statusu jakościowego dla partii
CREATE TYPE public.batch_status AS ENUM ('Released', 'Blocked', 'Quarantine');

-- 3. Typ dokumentu magazynowego
CREATE TYPE public.warehouse_doc_type AS ENUM ('PZ', 'WZ', 'MM', 'RW', 'PW');

-- 4. Typ statusu dokumentu
CREATE TYPE public.document_status AS ENUM ('Draft', 'Approved', 'Cancelled');

-- 5. Tabela Partii (TRACEABILITY - Serce systemu jakości!)
CREATE TABLE public.t_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.t_products(id) ON DELETE RESTRICT,
    
    internal_batch_number TEXT UNIQUE NOT NULL,
    
    supplier_batch_number TEXT,
    supplier_id UUID REFERENCES public.t_contractors(id) ON DELETE SET NULL,
    
    production_date DATE,
    expiration_date DATE,
    reception_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    initial_quantity DECIMAL(10, 2) NOT NULL,
    current_quantity DECIMAL(10, 2) NOT NULL,
    
    status public.batch_status DEFAULT 'Released',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Dokumenty Magazynowe (Nagłówki PZ/WZ)
CREATE TABLE public.t_warehouse_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE RESTRICT,
    
    document_number TEXT NOT NULL,
    type public.warehouse_doc_type DEFAULT 'PZ',
    
    contractor_id UUID REFERENCES public.t_contractors(id) ON DELETE SET NULL,
    facility_id UUID NOT NULL REFERENCES public.t_facilities(id) ON DELETE RESTRICT,
    
    external_doc_number TEXT,
    driver_name TEXT,
    car_plates TEXT,
    reception_temp DECIMAL(4,1),
    
    notes TEXT,
    status public.document_status DEFAULT 'Draft',
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Pozycje Dokumentu (Wiersze PZ)
CREATE TABLE public.t_warehouse_movement_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_id UUID NOT NULL REFERENCES public.t_warehouse_movements(id) ON DELETE CASCADE,
    
    product_id UUID NOT NULL REFERENCES public.t_products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES public.t_batches(id) ON DELETE SET NULL,
    
    quantity DECIMAL(10, 2) NOT NULL,
    pallets_count INTEGER DEFAULT 0,
    packaging_type TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- INDEKSY DLA WYDAJNOŚCI ---
CREATE INDEX idx_products_company ON public.t_products(company_id);
CREATE INDEX idx_products_sku ON public.t_products(sku);
CREATE INDEX idx_products_subiekt ON public.t_products(subiekt_id);

CREATE INDEX idx_batches_product ON public.t_batches(product_id);
CREATE INDEX idx_batches_internal_number ON public.t_batches(internal_batch_number);
CREATE INDEX idx_batches_supplier ON public.t_batches(supplier_id);
CREATE INDEX idx_batches_expiration ON public.t_batches(expiration_date);

CREATE INDEX idx_warehouse_movements_company ON public.t_warehouse_movements(company_id);
CREATE INDEX idx_warehouse_movements_facility ON public.t_warehouse_movements(facility_id);
CREATE INDEX idx_warehouse_movements_doc_number ON public.t_warehouse_movements(document_number);
CREATE INDEX idx_warehouse_movements_type ON public.t_warehouse_movements(type);

CREATE INDEX idx_movement_items_movement ON public.t_warehouse_movement_items(movement_id);
CREATE INDEX idx_movement_items_batch ON public.t_warehouse_movement_items(batch_id);

-- --- ZABEZPIECZENIA RLS ---

ALTER TABLE public.t_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_warehouse_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_warehouse_movement_items ENABLE ROW LEVEL SECURITY;

-- Polityki dla t_products
CREATE POLICY "Global admins can do everything with products" ON public.t_products
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view products in their companies" ON public.t_products
FOR SELECT USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage products in their companies" ON public.t_products
FOR ALL USING (public.has_company_access(auth.uid(), company_id) AND public.has_role(auth.uid(), 'facility_admin'));

-- Polityki dla t_batches (dostęp przez produkt -> firma)
CREATE POLICY "Global admins can do everything with batches" ON public.t_batches
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view batches for accessible products" ON public.t_batches
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.t_products p 
        WHERE p.id = product_id 
        AND public.has_company_access(auth.uid(), p.company_id)
    )
);

CREATE POLICY "Operators can manage batches" ON public.t_batches
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.t_products p 
        WHERE p.id = product_id 
        AND public.has_company_access(auth.uid(), p.company_id)
    )
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- Polityki dla t_warehouse_movements
CREATE POLICY "Global admins can do everything with movements" ON public.t_warehouse_movements
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view movements in their companies" ON public.t_warehouse_movements
FOR SELECT USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage movements in their facilities" ON public.t_warehouse_movements
FOR ALL USING (public.has_facility_access(auth.uid(), facility_id));

CREATE POLICY "Operators can manage movements in their facilities" ON public.t_warehouse_movements
FOR ALL USING (
    public.has_facility_access(auth.uid(), facility_id) 
    AND public.has_role(auth.uid(), 'operator')
);

-- Polityki dla t_warehouse_movement_items (dostęp przez nagłówek)
CREATE POLICY "Global admins can do everything with movement items" ON public.t_warehouse_movement_items
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view movement items" ON public.t_warehouse_movement_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.t_warehouse_movements m 
        WHERE m.id = movement_id 
        AND public.has_company_access(auth.uid(), m.company_id)
    )
);

CREATE POLICY "Operators can manage movement items" ON public.t_warehouse_movement_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.t_warehouse_movements m 
        WHERE m.id = movement_id 
        AND public.has_facility_access(auth.uid(), m.facility_id)
    )
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- --- TRIGGERY updated_at ---
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.t_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.t_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouse_movements_updated_at BEFORE UPDATE ON public.t_warehouse_movements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --- FUNKCJA GENEROWANIA NUMERU PARTII ---
CREATE OR REPLACE FUNCTION public.generate_batch_number(p_product_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date TEXT;
    v_sku TEXT;
    v_count INTEGER;
    v_batch_number TEXT;
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COALESCE(sku, 'XXX') INTO v_sku FROM public.t_products WHERE id = p_product_id;
    
    SELECT COUNT(*) + 1 INTO v_count 
    FROM public.t_batches 
    WHERE internal_batch_number LIKE v_date || '/' || v_sku || '/%';
    
    v_batch_number := v_date || '/' || v_sku || '/' || v_count;
    
    RETURN v_batch_number;
END;
$$;

-- --- FUNKCJA GENEROWANIA NUMERU DOKUMENTU ---
CREATE OR REPLACE FUNCTION public.generate_document_number(p_type public.warehouse_doc_type, p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year TEXT;
    v_month TEXT;
    v_count INTEGER;
    v_doc_number TEXT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_month := TO_CHAR(NOW(), 'MM');
    
    SELECT COUNT(*) + 1 INTO v_count 
    FROM public.t_warehouse_movements 
    WHERE company_id = p_company_id 
    AND type = p_type
    AND document_number LIKE p_type || '/' || v_year || '/' || v_month || '/%';
    
    v_doc_number := p_type || '/' || v_year || '/' || v_month || '/' || LPAD(v_count::TEXT, 3, '0');
    
    RETURN v_doc_number;
END;
$$;