CREATE OR REPLACE FUNCTION public.cleanup_audit_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM t_companies WHERE name = 'AUDIT KTF';
  IF v_company_id IS NULL THEN RETURN; END IF;
  DELETE FROM t_shipment_items WHERE shipment_id IN (SELECT id FROM t_shipments WHERE company_id = v_company_id);
  DELETE FROM t_shipments WHERE company_id = v_company_id;
  DELETE FROM t_production_kebab_variants WHERE production_log_id IN (SELECT id FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id));
  DELETE FROM t_freezing_temp_log WHERE production_log_id IN (SELECT id FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id));
  DELETE FROM t_production_logs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id);
  DELETE FROM t_handling_units WHERE company_id = v_company_id;
  DELETE FROM t_production_inputs WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id);
  DELETE FROM t_production_tasks WHERE production_order_id IN (SELECT id FROM t_production_orders WHERE company_id = v_company_id);
  DELETE FROM t_production_orders WHERE company_id = v_company_id;
  DELETE FROM t_lot_lineage WHERE child_lot_id IN (SELECT b.id FROM t_batches b JOIN t_products p ON p.id = b.product_id WHERE p.company_id = v_company_id);
  DELETE FROM t_warehouse_movement_items WHERE movement_id IN (SELECT id FROM t_warehouse_movements WHERE company_id = v_company_id);
  DELETE FROM t_supplier_complaints WHERE movement_id IN (SELECT id FROM t_warehouse_movements WHERE company_id = v_company_id);
  DELETE FROM t_warehouse_movements WHERE company_id = v_company_id;
  DELETE FROM t_batches WHERE product_id IN (SELECT id FROM t_products WHERE company_id = v_company_id);
  DELETE FROM t_recipe_ingredients WHERE recipe_id IN (SELECT id FROM t_recipes WHERE company_id = v_company_id);
  DELETE FROM t_recipes WHERE company_id = v_company_id;
  DELETE FROM t_products WHERE company_id = v_company_id;
  DELETE FROM t_contractors WHERE company_id = v_company_id;
  DELETE FROM t_storage_locations WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id = v_company_id);
  DELETE FROM t_facilities WHERE company_id = v_company_id;
  DELETE FROM t_companies WHERE id = v_company_id;
END; $$;