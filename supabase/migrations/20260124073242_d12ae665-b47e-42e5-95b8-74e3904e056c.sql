-- Widok 1: Stany Magazynowe (produkty + suma kg z partii Released)
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.company_id,
  COUNT(b.id) as batch_count,
  COALESCE(SUM(b.current_quantity), 0) as total_weight
FROM t_products p
LEFT JOIN t_batches b ON p.id = b.product_id 
  AND b.status = 'Released' 
  AND b.current_quantity > 0
GROUP BY p.id, p.name, p.sku, p.company_id;

-- Widok 2: Dzisiejsza Produkcja per zakład
CREATE OR REPLACE VIEW v_production_today AS
SELECT 
  po.facility_id,
  po.company_id,
  f.name as facility_name,
  COUNT(DISTINCT pl.id) as logs_count,
  COALESCE(SUM(pl.weight_net), 0) as total_output_kg
FROM t_production_logs pl
JOIN t_production_orders po ON pl.production_order_id = po.id
JOIN t_facilities f ON po.facility_id = f.id
WHERE pl.created_at >= CURRENT_DATE
GROUP BY po.facility_id, po.company_id, f.name;

-- Widok 3: Ostatnie operacje WMS (dla tabeli na Dashboard)
CREATE OR REPLACE VIEW v_recent_movements AS
SELECT 
  m.id,
  m.document_number,
  m.type,
  m.status,
  m.created_at,
  c.name as contractor_name,
  f.name as facility_name
FROM t_warehouse_movements m
LEFT JOIN t_contractors c ON m.contractor_id = c.id
LEFT JOIN t_facilities f ON m.facility_id = f.id
ORDER BY m.created_at DESC
LIMIT 10;