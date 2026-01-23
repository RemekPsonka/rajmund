-- PHASE 1: Seed storage locations for existing facilities
INSERT INTO public.t_storage_locations (facility_id, name, location_type, min_temp, max_temp, is_active)
SELECT 
  f.id,
  loc.name,
  loc.location_type,
  loc.min_temp,
  loc.max_temp,
  true
FROM public.t_facilities f
CROSS JOIN (
  VALUES 
    ('Chłodnia', 'chiller'::text, 0::numeric, 4::numeric),
    ('Mroźnia', 'freezer'::text, -22::numeric, -18::numeric),
    ('Szok', 'shock'::text, -40::numeric, -35::numeric),
    ('Hala produkcyjna', 'production'::text, 10::numeric, 15::numeric),
    ('Magazyn', 'storage'::text, 15::numeric, 20::numeric)
) AS loc(name, location_type, min_temp, max_temp)
ON CONFLICT DO NOTHING;

-- PHASE 2: Add verification columns to shipment items
ALTER TABLE public.t_shipment_items 
ADD COLUMN IF NOT EXISTS verified_weight NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);