-- === MODULE: LOGISTICS & SHIPPING ===

-- Create shipment status enum
CREATE TYPE public.shipment_status AS ENUM ('Planning', 'Loading', 'Shipped', 'Delivered');

-- Create packaging transaction type enum
CREATE TYPE public.packaging_transaction_type AS ENUM ('Issued', 'Received');

-- 20. Shipments (WZ Header)
CREATE TABLE public.t_shipments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id),
    facility_id UUID NOT NULL REFERENCES public.t_facilities(id),
    
    shipment_number TEXT NOT NULL,
    status shipment_status DEFAULT 'Planning',
    
    -- Customer
    customer_id UUID REFERENCES public.t_contractors(id),
    destination_address_json JSONB DEFAULT '{}'::jsonb,
    
    -- Transport (CMR/HDI data)
    carrier_id UUID REFERENCES public.t_contractors(id),
    driver_name TEXT,
    truck_plates TEXT,
    trailer_plates TEXT,
    transport_temperature DECIMAL(4,1),
    seal_number TEXT,
    
    -- Financials
    linked_invoice_number TEXT,
    
    -- Dates
    dispatch_date DATE DEFAULT CURRENT_DATE,
    delivered_date DATE,
    
    -- Totals (calculated)
    total_net_weight DECIMAL(10,2) DEFAULT 0,
    total_gross_weight DECIMAL(10,2) DEFAULT 0,
    pallets_count INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 21. Shipment Items
CREATE TABLE public.t_shipment_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES public.t_shipments(id) ON DELETE CASCADE,
    
    -- Option A: Load entire pallet
    handling_unit_id UUID REFERENCES public.t_handling_units(id),
    
    -- Option B: Load loose items (fresh meat)
    batch_id UUID REFERENCES public.t_batches(id),
    product_id UUID REFERENCES public.t_products(id),
    quantity DECIMAL(10, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 22. Packaging Transactions (Pallet Economy)
CREATE TABLE public.t_packaging_transactions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id),
    shipment_id UUID REFERENCES public.t_shipments(id),
    contractor_id UUID NOT NULL REFERENCES public.t_contractors(id),
    
    type packaging_transaction_type NOT NULL,
    packaging_type TEXT NOT NULL, -- E2, H1, Kosz, Paleta EUR
    quantity INTEGER NOT NULL,
    
    transaction_date DATE DEFAULT CURRENT_DATE,
    comments TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- === RLS POLICIES ===

ALTER TABLE public.t_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_packaging_transactions ENABLE ROW LEVEL SECURITY;

-- Shipments RLS
CREATE POLICY "Global admins can do everything with shipments"
ON public.t_shipments FOR ALL
USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view shipments in their companies"
ON public.t_shipments FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage shipments"
ON public.t_shipments FOR ALL
USING (
    public.has_facility_access(auth.uid(), facility_id)
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- Shipment Items RLS
CREATE POLICY "Global admins can do everything with shipment items"
ON public.t_shipment_items FOR ALL
USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view shipment items"
ON public.t_shipment_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.t_shipments s
        WHERE s.id = t_shipment_items.shipment_id
        AND public.has_company_access(auth.uid(), s.company_id)
    )
);

CREATE POLICY "Operators can manage shipment items"
ON public.t_shipment_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.t_shipments s
        WHERE s.id = t_shipment_items.shipment_id
        AND public.has_facility_access(auth.uid(), s.facility_id)
    )
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- Packaging Transactions RLS
CREATE POLICY "Global admins can do everything with packaging transactions"
ON public.t_packaging_transactions FOR ALL
USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view packaging transactions"
ON public.t_packaging_transactions FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Operators can manage packaging transactions"
ON public.t_packaging_transactions FOR ALL
USING (
    public.has_company_access(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'facility_admin') OR public.has_role(auth.uid(), 'operator'))
);

-- === HELPER FUNCTIONS ===

-- Generate shipment number
CREATE OR REPLACE FUNCTION public.generate_shipment_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year TEXT;
    v_month TEXT;
    v_count INTEGER;
    v_number TEXT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_month := TO_CHAR(NOW(), 'MM');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM public.t_shipments
    WHERE company_id = p_company_id
    AND shipment_number LIKE 'WZ/' || v_year || '/' || v_month || '/%';
    
    v_number := 'WZ/' || v_year || '/' || v_month || '/' || LPAD(v_count::TEXT, 3, '0');
    RETURN v_number;
END;
$$;

-- Calculate packaging balance for a contractor
CREATE OR REPLACE FUNCTION public.get_packaging_balance(p_contractor_id UUID, p_packaging_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_issued INTEGER;
    v_received INTEGER;
BEGIN
    SELECT COALESCE(SUM(quantity), 0) INTO v_issued
    FROM public.t_packaging_transactions
    WHERE contractor_id = p_contractor_id
    AND packaging_type = p_packaging_type
    AND type = 'Issued';
    
    SELECT COALESCE(SUM(quantity), 0) INTO v_received
    FROM public.t_packaging_transactions
    WHERE contractor_id = p_contractor_id
    AND packaging_type = p_packaging_type
    AND type = 'Received';
    
    -- Positive = contractor owes us, Negative = we owe contractor
    RETURN v_issued - v_received;
END;
$$;

-- Trigger to update shipment totals when items change
CREATE OR REPLACE FUNCTION public.update_shipment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shipment_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_shipment_id := OLD.shipment_id;
    ELSE
        v_shipment_id := NEW.shipment_id;
    END IF;
    
    UPDATE public.t_shipments
    SET 
        total_net_weight = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN si.handling_unit_id IS NOT NULL THEN hu.total_net_weight
                    ELSE si.quantity
                END
            ), 0)
            FROM public.t_shipment_items si
            LEFT JOIN public.t_handling_units hu ON hu.id = si.handling_unit_id
            WHERE si.shipment_id = v_shipment_id
        ),
        total_gross_weight = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN si.handling_unit_id IS NOT NULL THEN hu.total_gross_weight
                    ELSE si.quantity
                END
            ), 0)
            FROM public.t_shipment_items si
            LEFT JOIN public.t_handling_units hu ON hu.id = si.handling_unit_id
            WHERE si.shipment_id = v_shipment_id
        ),
        pallets_count = (
            SELECT COUNT(*) 
            FROM public.t_shipment_items
            WHERE shipment_id = v_shipment_id
            AND handling_unit_id IS NOT NULL
        ),
        updated_at = NOW()
    WHERE id = v_shipment_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_shipment_totals
AFTER INSERT OR UPDATE OR DELETE ON public.t_shipment_items
FOR EACH ROW
EXECUTE FUNCTION public.update_shipment_totals();

-- Update handling unit status when added to shipment
CREATE OR REPLACE FUNCTION public.mark_handling_unit_shipped()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.handling_unit_id IS NOT NULL THEN
        UPDATE public.t_handling_units
        SET status = 'Shipped', updated_at = NOW()
        WHERE id = NEW.handling_unit_id
        AND status = 'Closed';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_handling_unit_shipped
AFTER INSERT ON public.t_shipment_items
FOR EACH ROW
EXECUTE FUNCTION public.mark_handling_unit_shipped();

-- === INDEXES ===
CREATE INDEX idx_shipments_company ON public.t_shipments(company_id);
CREATE INDEX idx_shipments_facility ON public.t_shipments(facility_id);
CREATE INDEX idx_shipments_status ON public.t_shipments(status);
CREATE INDEX idx_shipments_customer ON public.t_shipments(customer_id);
CREATE INDEX idx_shipments_dispatch_date ON public.t_shipments(dispatch_date);
CREATE INDEX idx_shipment_items_shipment ON public.t_shipment_items(shipment_id);
CREATE INDEX idx_shipment_items_handling_unit ON public.t_shipment_items(handling_unit_id);
CREATE INDEX idx_packaging_transactions_contractor ON public.t_packaging_transactions(contractor_id);
CREATE INDEX idx_packaging_transactions_shipment ON public.t_packaging_transactions(shipment_id);