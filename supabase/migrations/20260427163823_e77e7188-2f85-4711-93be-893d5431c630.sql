-- 1. Rozszerzenie t_batches o pola śledzenia rodzica
ALTER TABLE public.t_batches
  ADD COLUMN IF NOT EXISTS parent_batch_id uuid REFERENCES public.t_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_event_type text;

ALTER TABLE public.t_batches
  DROP CONSTRAINT IF EXISTS t_batches_source_event_type_check;

ALTER TABLE public.t_batches
  ADD CONSTRAINT t_batches_source_event_type_check
  CHECK (source_event_type IS NULL OR source_event_type IN (
    'RECEIVING','DISASSEMBLY','TUMBLING','ASSEMBLY','FREEZING','AGGREGATION'
  ));

CREATE INDEX IF NOT EXISTS idx_batches_parent ON public.t_batches(parent_batch_id);

-- 2. Tabela t_lot_lineage (graf rodzic-dziecko)
CREATE TABLE IF NOT EXISTS public.t_lot_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_lot_id uuid NOT NULL REFERENCES public.t_batches(id) ON DELETE RESTRICT,
  child_lot_id uuid NOT NULL REFERENCES public.t_batches(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  qty_kg numeric NOT NULL,
  process_ref_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  operator_id uuid REFERENCES public.t_employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT t_lot_lineage_event_type_check CHECK (event_type IN (
    'RECEIVING','DISASSEMBLY','TUMBLING','ASSEMBLY','FREEZING','AGGREGATION','SHIPPING'
  )),
  CONSTRAINT t_lot_lineage_qty_positive CHECK (qty_kg > 0),
  CONSTRAINT t_lot_lineage_no_self_ref CHECK (parent_lot_id <> child_lot_id)
);

-- 3. Indeksy
CREATE INDEX IF NOT EXISTS idx_lot_lineage_parent ON public.t_lot_lineage(parent_lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_lineage_child ON public.t_lot_lineage(child_lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_lineage_process ON public.t_lot_lineage(process_ref_id);

-- 4. RLS
ALTER TABLE public.t_lot_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lot lineage"
  ON public.t_lot_lineage FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "Global admins can do everything with lot lineage"
  ON public.t_lot_lineage FOR ALL
  USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Operators can manage lot lineage"
  ON public.t_lot_lineage FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.t_batches b
      JOIN public.t_products p ON p.id = b.product_id
      WHERE b.id = t_lot_lineage.child_lot_id
        AND public.has_company_access(auth.uid(), p.company_id)
    )
    AND (
      public.has_role(auth.uid(), 'facility_admin'::app_role)
      OR public.has_role(auth.uid(), 'operator'::app_role)
    )
  );

CREATE POLICY "Auth users can manage lot lineage"
  ON public.t_lot_lineage FOR ALL
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());