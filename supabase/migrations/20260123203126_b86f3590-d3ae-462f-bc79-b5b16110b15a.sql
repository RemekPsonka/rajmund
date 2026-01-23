-- Tabela urządzeń (wagi, stanowiska)
CREATE TABLE public.t_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES public.t_facilities(id) ON DELETE SET NULL,
    
    device_type TEXT NOT NULL CHECK (device_type IN ('SCALE', 'STATION')),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_devices_company ON public.t_devices(company_id);
CREATE INDEX idx_devices_facility ON public.t_devices(facility_id);
CREATE INDEX idx_devices_type ON public.t_devices(device_type);

-- RLS
ALTER TABLE public.t_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view devices" ON public.t_devices
    FOR SELECT USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage devices" ON public.t_devices
    FOR ALL USING (public.has_company_access(auth.uid(), company_id));

-- Trigger updated_at
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON public.t_devices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Dodaj kolumnę prepared_by_employee_id do t_production_logs
ALTER TABLE public.t_production_logs 
ADD COLUMN prepared_by_employee_id UUID REFERENCES public.t_employees(id);

-- Zmień scale_device_id na referencję do t_devices (jeśli istnieje jako TEXT)
-- Najpierw sprawdź czy kolumna istnieje i zmień typ
ALTER TABLE public.t_production_logs 
ALTER COLUMN scale_device_id TYPE UUID USING NULL;

ALTER TABLE public.t_production_logs 
ADD CONSTRAINT fk_production_logs_scale_device 
FOREIGN KEY (scale_device_id) REFERENCES public.t_devices(id);