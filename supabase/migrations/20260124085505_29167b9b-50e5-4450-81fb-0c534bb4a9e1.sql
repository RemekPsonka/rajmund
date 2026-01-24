-- Add evaporation percent column to recipes table
ALTER TABLE t_recipes
ADD COLUMN evaporation_percent NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN t_recipes.evaporation_percent IS 
  'Procent odparowania podczas obróbki termicznej';