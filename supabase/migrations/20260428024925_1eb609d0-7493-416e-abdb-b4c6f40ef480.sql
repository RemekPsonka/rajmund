-- Drop duplicate triggers (bezpieczne — IF EXISTS)
DROP TRIGGER IF EXISTS trg_receiving_lineage ON public.t_batches;
DROP TRIGGER IF EXISTS update_batches_updated_at ON public.t_batches;
DROP TRIGGER IF EXISTS trg_reduce_batch_quantity ON public.t_production_inputs;
DROP TRIGGER IF EXISTS trg_aggregation_lineage ON public.t_production_logs;
DROP TRIGGER IF EXISTS trg_populate_shipment_batch ON public.t_shipment_items;
DROP TRIGGER IF EXISTS trg_ccp1_complaint ON public.t_warehouse_movements;
DROP TRIGGER IF EXISTS update_warehouse_movements_updated_at ON public.t_warehouse_movements;
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.t_companies;
DROP TRIGGER IF EXISTS update_contractors_updated_at ON public.t_contractors;
DROP TRIGGER IF EXISTS update_facilities_updated_at ON public.t_facilities;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.t_products;
DROP TRIGGER IF EXISTS update_production_orders_updated_at ON public.t_production_orders;

-- Repoint supervisor_id FK from auth.users to t_employees
ALTER TABLE public.t_production_orders
  DROP CONSTRAINT IF EXISTS t_production_orders_supervisor_id_fkey;
ALTER TABLE public.t_production_orders
  ADD CONSTRAINT t_production_orders_supervisor_id_fkey
  FOREIGN KEY (supervisor_id) REFERENCES public.t_employees(id) ON DELETE SET NULL;