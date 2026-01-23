-- 1. Create job positions table
CREATE TABLE public.t_job_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.t_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Enable RLS
ALTER TABLE public.t_job_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job positions
CREATE POLICY "Users can view job positions in their companies"
ON public.t_job_positions FOR SELECT
USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Facility admins can manage job positions"
ON public.t_job_positions FOR ALL
USING (has_company_access(auth.uid(), company_id) AND has_role(auth.uid(), 'facility_admin'::app_role));

CREATE POLICY "Global admins can do everything with job positions"
ON public.t_job_positions FOR ALL
USING (is_global_admin(auth.uid()));

-- 2. Create role permissions table
CREATE TABLE public.t_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  resource TEXT NOT NULL,
  can_create BOOLEAN DEFAULT false,
  can_read BOOLEAN DEFAULT true,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, resource)
);

-- Enable RLS
ALTER TABLE public.t_role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role permissions (read-only for most, admin can manage)
CREATE POLICY "Authenticated users can view permissions"
ON public.t_role_permissions FOR SELECT
USING (is_authenticated());

CREATE POLICY "Global admins can manage permissions"
ON public.t_role_permissions FOR ALL
USING (is_global_admin(auth.uid()));

-- 3. Insert default permissions
INSERT INTO public.t_role_permissions (role, resource, can_create, can_read, can_update, can_delete) VALUES
-- Global Admin - full access
('global_admin', 'companies', true, true, true, true),
('global_admin', 'facilities', true, true, true, true),
('global_admin', 'employees', true, true, true, true),
('global_admin', 'products', true, true, true, true),
('global_admin', 'batches', true, true, true, true),
('global_admin', 'production_orders', true, true, true, true),
('global_admin', 'shipments', true, true, true, true),
('global_admin', 'warehouse_movements', true, true, true, true),
('global_admin', 'users', true, true, true, true),
('global_admin', 'settings', true, true, true, true),

-- Facility Admin - manage within facility
('facility_admin', 'companies', false, true, false, false),
('facility_admin', 'facilities', false, true, true, false),
('facility_admin', 'employees', true, true, true, true),
('facility_admin', 'products', true, true, true, false),
('facility_admin', 'batches', true, true, true, false),
('facility_admin', 'production_orders', true, true, true, false),
('facility_admin', 'shipments', true, true, true, false),
('facility_admin', 'warehouse_movements', true, true, true, false),
('facility_admin', 'users', false, true, false, false),
('facility_admin', 'settings', false, true, true, false),

-- Operator - day-to-day operations
('operator', 'companies', false, true, false, false),
('operator', 'facilities', false, true, false, false),
('operator', 'employees', false, true, false, false),
('operator', 'products', false, true, false, false),
('operator', 'batches', true, true, true, false),
('operator', 'production_orders', false, true, true, false),
('operator', 'shipments', false, true, true, false),
('operator', 'warehouse_movements', true, true, true, false),
('operator', 'users', false, false, false, false),
('operator', 'settings', false, true, false, false),

-- Viewer - read-only
('viewer', 'companies', false, true, false, false),
('viewer', 'facilities', false, true, false, false),
('viewer', 'employees', false, true, false, false),
('viewer', 'products', false, true, false, false),
('viewer', 'batches', false, true, false, false),
('viewer', 'production_orders', false, true, false, false),
('viewer', 'shipments', false, true, false, false),
('viewer', 'warehouse_movements', false, true, false, false),
('viewer', 'users', false, false, false, false),
('viewer', 'settings', false, true, false, false);

-- 4. Add job_position_id to employees (optional - keep both for migration)
ALTER TABLE public.t_employees ADD COLUMN job_position_id UUID REFERENCES public.t_job_positions(id);

-- 5. Create function to check permissions
CREATE OR REPLACE FUNCTION public.check_permission(
  _user_id UUID,
  _resource TEXT,
  _action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_permission BOOLEAN := false;
BEGIN
  -- Check if user has any role with the required permission
  SELECT EXISTS (
    SELECT 1
    FROM public.t_user_roles ur
    JOIN public.t_role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.resource = _resource
      AND (
        (_action = 'create' AND rp.can_create = true) OR
        (_action = 'read' AND rp.can_read = true) OR
        (_action = 'update' AND rp.can_update = true) OR
        (_action = 'delete' AND rp.can_delete = true)
      )
  ) INTO _has_permission;
  
  RETURN _has_permission;
END;
$$;

-- 6. Migrate existing job positions to the new table
INSERT INTO public.t_job_positions (company_id, name, department)
SELECT DISTINCT e.company_id, e.job_position, 'Produkcja'
FROM public.t_employees e
WHERE e.job_position IS NOT NULL AND e.job_position != ''
ON CONFLICT (company_id, name) DO NOTHING;

-- 7. Update employees with job_position_id
UPDATE public.t_employees e
SET job_position_id = jp.id
FROM public.t_job_positions jp
WHERE e.company_id = jp.company_id AND e.job_position = jp.name;