-- Add ON DELETE CASCADE to production_inputs foreign key
ALTER TABLE public.t_production_inputs 
DROP CONSTRAINT IF EXISTS t_production_inputs_production_order_id_fkey;

ALTER TABLE public.t_production_inputs 
ADD CONSTRAINT t_production_inputs_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES public.t_production_orders(id) 
ON DELETE CASCADE;