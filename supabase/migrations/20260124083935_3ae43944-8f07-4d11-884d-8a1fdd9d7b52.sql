-- Add recipe_id to production orders for MES integration
ALTER TABLE public.t_production_orders
ADD COLUMN recipe_id UUID REFERENCES public.t_recipes(id);

-- Create index for faster lookups
CREATE INDEX idx_production_orders_recipe_id ON public.t_production_orders(recipe_id);