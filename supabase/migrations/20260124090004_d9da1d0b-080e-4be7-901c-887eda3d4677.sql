-- Add SemiFinished to industry_category options (no constraint needed, it's text)
COMMENT ON COLUMN t_products.industry_category IS 'Industry category: RawMeat, Spice, Additive, Packaging, Casing, Waste, FinishedGood, SemiFinished';

-- Add Assembly and Freezing to production_order_type enum
ALTER TYPE production_order_type ADD VALUE IF NOT EXISTS 'Assembly';
ALTER TYPE production_order_type ADD VALUE IF NOT EXISTS 'Freezing';

-- Add new process stages to production logs (it's text, so just add comment)
COMMENT ON COLUMN t_production_logs.process_stage IS 'Process stage: Decomposition, Massaging, Stacking, ShockFreezing, Palletization';

-- Add freezing tracking fields to t_production_logs
ALTER TABLE t_production_logs 
ADD COLUMN IF NOT EXISTS freezing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS freezing_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS freezing_duration_minutes INTEGER;

-- Add target_weight to t_production_kebab_variants for tracking expected vs actual
ALTER TABLE t_production_kebab_variants
ADD COLUMN IF NOT EXISTS variant_name TEXT;