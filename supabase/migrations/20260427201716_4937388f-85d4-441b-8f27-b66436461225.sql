
CREATE TABLE public.t_print_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN (
    'SSCC_LABEL','UNIT_LABEL','CMR','HDI','PACKING_LIST','WZ','SUPPLIER_COMPLAINT'
  )),
  reference_id uuid,
  reference_table text,
  printed_at timestamptz NOT NULL DEFAULT now(),
  printed_by uuid,
  payload jsonb
);

CREATE INDEX idx_print_log_reference ON public.t_print_log(reference_table, reference_id);
CREATE INDEX idx_print_log_printed_at ON public.t_print_log(printed_at DESC);

ALTER TABLE public.t_print_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view print log"
  ON public.t_print_log FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Auth users can insert print log"
  ON public.t_print_log FOR INSERT
  WITH CHECK (is_authenticated());
