-- Create table for production tasks/operations
CREATE TABLE public.t_production_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID NOT NULL REFERENCES public.t_production_orders(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    sequence_number INTEGER DEFAULT 1,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES public.t_employees(id),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.t_production_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow authenticated users to view production tasks"
ON public.t_production_tasks
FOR SELECT
USING (is_authenticated());

CREATE POLICY "Allow authenticated users to insert production tasks"
ON public.t_production_tasks
FOR INSERT
WITH CHECK (is_authenticated());

CREATE POLICY "Allow authenticated users to update production tasks"
ON public.t_production_tasks
FOR UPDATE
USING (is_authenticated());

CREATE POLICY "Allow authenticated users to delete production tasks"
ON public.t_production_tasks
FOR DELETE
USING (is_authenticated());

-- Index for faster queries
CREATE INDEX idx_production_tasks_order_id ON public.t_production_tasks(production_order_id);
CREATE INDEX idx_production_tasks_completed ON public.t_production_tasks(is_completed);