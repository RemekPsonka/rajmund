-- 1. Konfiguracja wstępna (rozszerzenia dla UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enum dla typów ról (zgodnie z best practices bezpieczeństwa)
CREATE TYPE public.app_role AS ENUM ('global_admin', 'facility_admin', 'operator', 'viewer');

-- 3. Enum dla typów lokalizacji
CREATE TYPE public.facility_type AS ENUM ('Plant', 'Warehouse', 'Office', 'Store');

-- 4. Enum dla typów kontraktów
CREATE TYPE public.contract_type AS ENUM ('B2B', 'UoP', 'Mandate', 'Other');

-- --- MODUŁ CORE: STRUKTURA ORGANIZACYJNA ---

-- 5. Tabela Spółek (Tenants)
CREATE TABLE public.t_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    short_name TEXT,
    tax_id TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    main_address_json JSONB DEFAULT '{}'::jsonb,
    logo_url TEXT
);

-- 6. Tabela Lokalizacji / Zakładów (Facilities)
CREATE TABLE public.t_facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    type public.facility_type NOT NULL DEFAULT 'Plant',
    vet_approval_number TEXT,
    geo_coordinates JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela Działów (Departments)
CREATE TABLE public.t_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.t_facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_production_line BOOLEAN DEFAULT FALSE,
    cost_center_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- MODUŁ HR & IAM: LUDZIE ---

-- 8. Tabela Użytkowników Systemu (powiązana z Auth)
CREATE TABLE public.t_app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    ui_theme TEXT DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. KLUCZOWA: Tabela Ról Użytkowników (osobna tabela dla bezpieczeństwa!)
CREATE TABLE public.t_user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    -- Opcjonalny scope: jeśli NULL = globalny dostęp, jeśli ustawiony = tylko ta firma
    company_id UUID REFERENCES public.t_companies(id) ON DELETE CASCADE,
    -- Opcjonalny scope do konkretnego zakładu
    facility_id UUID REFERENCES public.t_facilities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role, company_id, facility_id)
);

-- 10. Tabela Pracowników Operacyjnych (Produkcja - Logowanie QR)
CREATE TABLE public.t_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE RESTRICT,
    facility_id UUID REFERENCES public.t_facilities(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    job_position TEXT NOT NULL,
    qr_login_code TEXT UNIQUE NOT NULL,
    pin_code_hash TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    contract_type public.contract_type,
    hourly_rate DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Tabela Kontrahentów (Wspólna dla Dostawców i Odbiorców)
CREATE TABLE public.t_contractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    tax_id TEXT,
    is_supplier BOOLEAN DEFAULT FALSE,
    is_customer BOOLEAN DEFAULT FALSE,
    is_logistics BOOLEAN DEFAULT FALSE,
    vet_number TEXT,
    payment_term_days INTEGER DEFAULT 14,
    contact_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --- FUNKCJE POMOCNICZE DLA RLS ---

-- 12. Funkcja sprawdzająca czy użytkownik ma daną rolę (SECURITY DEFINER!)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.t_user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- 13. Funkcja sprawdzająca czy użytkownik jest Global Admin
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.t_user_roles
        WHERE user_id = _user_id AND role = 'global_admin' AND company_id IS NULL
    )
$$;

-- 14. Funkcja sprawdzająca dostęp do firmy
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.t_user_roles
        WHERE user_id = _user_id 
        AND (company_id IS NULL OR company_id = _company_id)
    )
$$;

-- 15. Funkcja sprawdzająca dostęp do zakładu
CREATE OR REPLACE FUNCTION public.has_facility_access(_user_id UUID, _facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.t_user_roles ur
        LEFT JOIN public.t_facilities f ON f.id = _facility_id
        WHERE ur.user_id = _user_id 
        AND (
            ur.company_id IS NULL 
            OR ur.company_id = f.company_id
            OR ur.facility_id = _facility_id
        )
    )
$$;

-- --- INDEKSY DLA WYDAJNOŚCI ---
CREATE INDEX idx_employees_qr ON public.t_employees(qr_login_code);
CREATE INDEX idx_employees_company ON public.t_employees(company_id);
CREATE INDEX idx_facilities_company ON public.t_facilities(company_id);
CREATE INDEX idx_contractors_tax_id ON public.t_contractors(tax_id);
CREATE INDEX idx_contractors_company ON public.t_contractors(company_id);
CREATE INDEX idx_departments_facility ON public.t_departments(facility_id);
CREATE INDEX idx_user_roles_user ON public.t_user_roles(user_id);
CREATE INDEX idx_user_roles_company ON public.t_user_roles(company_id);

-- --- ZABEZPIECZENIE RLS ---

-- Włączamy RLS na wszystkich tabelach
ALTER TABLE public.t_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_contractors ENABLE ROW LEVEL SECURITY;

-- Polityki dla t_companies
CREATE POLICY "Global admins can do everything with companies" ON public.t_companies
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view their assigned companies" ON public.t_companies
FOR SELECT USING (public.has_company_access(auth.uid(), id));

-- Polityki dla t_facilities
CREATE POLICY "Global admins can do everything with facilities" ON public.t_facilities
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view facilities in their companies" ON public.t_facilities
FOR SELECT USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage their facilities" ON public.t_facilities
FOR ALL USING (public.has_facility_access(auth.uid(), id));

-- Polityki dla t_departments
CREATE POLICY "Global admins can do everything with departments" ON public.t_departments
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view departments in their facilities" ON public.t_departments
FOR SELECT USING (public.has_facility_access(auth.uid(), facility_id));

-- Polityki dla t_app_users
CREATE POLICY "Users can view their own profile" ON public.t_app_users
FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.t_app_users
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Global admins can view all profiles" ON public.t_app_users
FOR SELECT USING (public.is_global_admin(auth.uid()));

-- Polityki dla t_user_roles (KRYTYCZNE - tylko admini mogą modyfikować role!)
CREATE POLICY "Global admins can manage all roles" ON public.t_user_roles
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view their own roles" ON public.t_user_roles
FOR SELECT USING (user_id = auth.uid());

-- Polityki dla t_employees
CREATE POLICY "Global admins can do everything with employees" ON public.t_employees
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view employees in their companies" ON public.t_employees
FOR SELECT USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage employees in their facilities" ON public.t_employees
FOR ALL USING (public.has_facility_access(auth.uid(), facility_id));

-- Polityki dla t_contractors
CREATE POLICY "Global admins can do everything with contractors" ON public.t_contractors
FOR ALL USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Users can view contractors in their companies" ON public.t_contractors
FOR SELECT USING (public.has_company_access(auth.uid(), company_id));

-- --- TRIGGER DLA updated_at ---
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.t_companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON public.t_facilities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.t_departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_users_updated_at BEFORE UPDATE ON public.t_app_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.t_employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contractors_updated_at BEFORE UPDATE ON public.t_contractors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --- TRIGGER DO AUTO-TWORZENIA PROFILU UŻYTKOWNIKA ---
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.t_app_users (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();