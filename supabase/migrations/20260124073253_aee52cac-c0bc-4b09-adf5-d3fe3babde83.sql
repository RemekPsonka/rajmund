-- Napraw widoki - ustaw SECURITY INVOKER (bezpieczniejsze - używa uprawnień wywołującego)
ALTER VIEW v_stock_summary SET (security_invoker = on);
ALTER VIEW v_production_today SET (security_invoker = on);
ALTER VIEW v_recent_movements SET (security_invoker = on);