-- Update CHECK CONSTRAINT to include SemiFinished category
ALTER TABLE t_products DROP CONSTRAINT IF EXISTS t_products_industry_category_check;

ALTER TABLE t_products ADD CONSTRAINT t_products_industry_category_check 
CHECK (industry_category = ANY (ARRAY[
  'RawMeat'::text, 
  'Spice'::text, 
  'Additive'::text, 
  'Packaging'::text, 
  'Casing'::text, 
  'Waste'::text, 
  'SemiFinished'::text,
  'FinishedGood'::text
]));