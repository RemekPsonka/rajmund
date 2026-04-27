ALTER TABLE public.t_products
  ADD COLUMN IF NOT EXISTS unit_target_weight_kg numeric NULL;

COMMENT ON COLUMN public.t_products.unit_target_weight_kg IS
  'Domyślna waga jednostkowa wyrobu (np. szpady kebabu) w kg. Używana jako preset w terminalu składania.';