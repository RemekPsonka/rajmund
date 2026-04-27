ALTER TABLE public.t_recipe_ingredients
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'MEAT';

COMMENT ON COLUMN public.t_recipe_ingredients.role IS
  'Rola składnika w recepturze: MEAT | SPICE | WATER | OTHER. Wpływa na walidacje wsadu w Tumblerze.';

CREATE OR REPLACE FUNCTION public.validate_recipe_ingredient_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role NOT IN ('MEAT','SPICE','WATER','OTHER') THEN
    RAISE EXCEPTION 'Invalid recipe ingredient role: %. Allowed: MEAT, SPICE, WATER, OTHER', NEW.role;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_recipe_ingredient_role ON public.t_recipe_ingredients;
CREATE TRIGGER trg_validate_recipe_ingredient_role
  BEFORE INSERT OR UPDATE ON public.t_recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_ingredient_role();