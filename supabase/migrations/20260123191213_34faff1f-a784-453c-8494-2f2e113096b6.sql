-- PHASE 1: Add processing direction to production inputs
ALTER TABLE public.t_production_inputs 
ADD COLUMN direction TEXT;

-- PHASE 2: Create storage locations table
CREATE TABLE public.t_storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.t_facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('chiller', 'freezer', 'shock', 'production', 'storage')),
  min_temp NUMERIC,
  max_temp NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.t_storage_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for storage locations
CREATE POLICY "Access for auth users" ON public.t_storage_locations
FOR ALL USING (is_authenticated()) WITH CHECK (is_authenticated());

CREATE POLICY "Global admins can do everything with storage locations" ON public.t_storage_locations
FOR ALL USING (is_global_admin(auth.uid()));

CREATE POLICY "Facility admins can manage storage locations" ON public.t_storage_locations
FOR ALL USING (has_facility_access(auth.uid(), facility_id));

CREATE POLICY "Users can view storage locations in their facilities" ON public.t_storage_locations
FOR SELECT USING (has_facility_access(auth.uid(), facility_id));

-- Add location_id to batches for tracking physical location
ALTER TABLE public.t_batches 
ADD COLUMN location_id UUID REFERENCES public.t_storage_locations(id);

-- Create index for faster lookups
CREATE INDEX idx_batches_location ON public.t_batches(location_id);
CREATE INDEX idx_storage_locations_facility ON public.t_storage_locations(facility_id);