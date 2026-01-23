-- RATUNKOWY SKRYPT RLS (Otwiera dostęp dla zalogowanych)

-- 1. Funkcja pomocnicza is_authenticated()
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.role() = 'authenticated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Nadanie uprawnień masowo (dla tabel z prefiksem t_)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 't_%'
    LOOP
        -- Włącz RLS (na wszelki wypadek)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Usuń stare polityki "Access for auth users" (żeby nie było konfliktów)
        EXECUTE format('DROP POLICY IF EXISTS "Access for auth users" ON public.%I;', tbl);
        
        -- Dodaj nową politykę "ALL ALLOWED" dla zalogowanych
        EXECUTE format('CREATE POLICY "Access for auth users" ON public.%I FOR ALL USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());', tbl);
    END LOOP;
END $$;