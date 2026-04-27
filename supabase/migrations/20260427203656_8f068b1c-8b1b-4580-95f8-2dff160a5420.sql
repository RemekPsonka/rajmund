CREATE OR REPLACE FUNCTION public.check_trigger_exists(trigger_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = trigger_name
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_trigger_exists(text) TO anon, authenticated;