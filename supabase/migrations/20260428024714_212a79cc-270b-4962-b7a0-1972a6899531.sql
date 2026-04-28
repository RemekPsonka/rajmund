DROP FUNCTION IF EXISTS public.audit_e2e_flow(numeric);
CREATE OR REPLACE FUNCTION public.audit_e2e_flow(p_temp numeric DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid; v_facility_id uuid; v_loc_id uuid;
  v_supplier_id uuid; v_customer_id uuid;
  v_p_raw uuid; v_p_meat uuid; v_p_kebab uuid; v_recipe_id uuid;
  v_pz_id uuid; v_pz_number text;
  v_raw_batch_id uuid; v_meat_batch_id uuid; v_kebab_batch_id uuid;
  v_decomp_id uuid; v_assembly_id uuid; v_freeze_id uuid;
  v_freeze_log_id uuid; v_pallet_id uuid; v_sscc text;
  v_shipment_id uuid; v_shipment_number text;
  v_lineage_count int; v_complaint_count int;
BEGIN
  PERFORM public.cleanup_audit_data();
  INSERT INTO t_companies (name, short_name, tax_id, is_active) VALUES ('AUDIT KTF','AUDIT','PL-AUDIT-001',true) RETURNING id INTO v_company_id;
  INSERT INTO t_facilities (company_id,name,type) VALUES (v_company_id,'AUDIT Zakład','Plant') RETURNING id INTO v_facility_id;
  INSERT INTO t_storage_locations (facility_id,name,location_type,min_temp,max_temp,is_active) VALUES (v_facility_id,'Chłodnia','chiller',-2,4,true) RETURNING id INTO v_loc_id;
  INSERT INTO t_contractors (company_id,name,tax_id,is_supplier,vet_number) VALUES (v_company_id,'AUDIT Drobimex','PL-AUDIT-S1',true,'PL-VET-AUD') RETURNING id INTO v_supplier_id;
  INSERT INTO t_contractors (company_id,name,tax_id,is_customer) VALUES (v_company_id,'AUDIT Klient','PL-AUDIT-C1',true) RETURNING id INTO v_customer_id;
  INSERT INTO t_products (company_id,name,sku,industry_category,unit) VALUES (v_company_id,'AUDIT Filet','AUD-RAW','RawMeat','kg') RETURNING id INTO v_p_raw;
  INSERT INTO t_products (company_id,name,sku,industry_category,unit) VALUES (v_company_id,'AUDIT Mięso','AUD-MEAT','SemiFinished','kg') RETURNING id INTO v_p_meat;
  INSERT INTO t_products (company_id,name,sku,industry_category,unit,unit_target_weight_kg) VALUES (v_company_id,'AUDIT Kebab 5kg','AUD-KEB','FinishedGood','kg',5) RETURNING id INTO v_p_kebab;
  INSERT INTO t_recipes (company_id,name,base_product_id,product_id,target_yield_percent,is_active) VALUES (v_company_id,'AUDIT Receptura',v_p_meat,v_p_kebab,100,true) RETURNING id INTO v_recipe_id;
  INSERT INTO t_recipe_ingredients (recipe_id,product_id,ratio,role,unit) VALUES (v_recipe_id,v_p_meat,1.0,'MEAT','kg');

  v_pz_number := 'PZ/AUDIT/'||to_char(now(),'YYMMDDHH24MISS');
  INSERT INTO t_warehouse_movements (company_id,facility_id,document_number,type,contractor_id,received_temp_c,received_temp_method,status)
    VALUES (v_company_id,v_facility_id,v_pz_number,'PZ',v_supplier_id,p_temp,'MANUAL_PROBE','Approved') RETURNING id INTO v_pz_id;
  INSERT INTO t_batches (product_id,supplier_id,supplier_batch_number,internal_batch_number,initial_quantity,current_quantity,status,location_id,reception_date,expiration_date,production_date)
    VALUES (v_p_raw,v_supplier_id,'SUP-RAW-001',to_char(now(),'YYMMDDHH24MISS')||'/AUDIT/RAW',1000,1000,'Released',v_loc_id,now(),(now()+interval '14 days')::date,current_date) RETURNING id INTO v_raw_batch_id;
  INSERT INTO t_warehouse_movement_items (movement_id,product_id,batch_id,quantity) VALUES (v_pz_id,v_p_raw,v_raw_batch_id,1000);

  INSERT INTO t_production_orders (company_id,facility_id,order_number,type,status,production_date)
    VALUES (v_company_id,v_facility_id,'ZP-DEC-AUDIT-'||to_char(now(),'HH24MISS'),'Decomposition','Closed',current_date) RETURNING id INTO v_decomp_id;
  INSERT INTO t_production_inputs (production_order_id,batch_id,product_id,weight) VALUES (v_decomp_id,v_raw_batch_id,v_p_raw,1000);
  INSERT INTO t_batches (product_id,internal_batch_number,parent_batch_id,source_event_type,initial_quantity,current_quantity,status,location_id,production_date,expiration_date)
    VALUES (v_p_meat,to_char(now(),'YYMMDDHH24MISS')||'/AUDIT/MEAT',v_raw_batch_id,'DISASSEMBLY',700,700,'Released',v_loc_id,current_date,(now()+interval '7 days')::date) RETURNING id INTO v_meat_batch_id;
  INSERT INTO t_lot_lineage (parent_lot_id,child_lot_id,event_type,qty_kg,process_ref_id,occurred_at) VALUES (v_raw_batch_id,v_meat_batch_id,'DISASSEMBLY',700,v_decomp_id,now());
  INSERT INTO t_production_logs (production_order_id,source_batch_id,output_batch_id,product_id,weight_gross,weight_tare,process_stage)
    VALUES (v_decomp_id,v_raw_batch_id,v_meat_batch_id,v_p_meat,700,0,'Decomposition');

  INSERT INTO t_production_orders (company_id,facility_id,order_number,type,status,production_date,recipe_id)
    VALUES (v_company_id,v_facility_id,'ZP-ASM-AUDIT-'||to_char(now(),'HH24MISS'),'Assembly','Closed',current_date,v_recipe_id) RETURNING id INTO v_assembly_id;
  INSERT INTO t_production_inputs (production_order_id,batch_id,product_id,weight) VALUES (v_assembly_id,v_meat_batch_id,v_p_meat,700);
  INSERT INTO t_batches (product_id,internal_batch_number,parent_batch_id,source_event_type,initial_quantity,current_quantity,status,location_id,production_date,expiration_date)
    VALUES (v_p_kebab,to_char(now(),'YYMMDDHH24MISS')||'/AUDIT/KEB',v_meat_batch_id,'ASSEMBLY',700,700,'Released',v_loc_id,current_date,(current_date+interval '180 days')::date) RETURNING id INTO v_kebab_batch_id;
  INSERT INTO t_lot_lineage (parent_lot_id,child_lot_id,event_type,qty_kg,process_ref_id,occurred_at) VALUES (v_meat_batch_id,v_kebab_batch_id,'ASSEMBLY',700,v_assembly_id,now());

  INSERT INTO t_production_orders (company_id,facility_id,order_number,type,status,production_date)
    VALUES (v_company_id,v_facility_id,'ZP-FRZ-AUDIT-'||to_char(now(),'HH24MISS'),'Freezing','Closed',current_date) RETURNING id INTO v_freeze_id;
  INSERT INTO t_production_logs (production_order_id,source_batch_id,output_batch_id,product_id,weight_gross,weight_tare,process_stage,freezing_started_at,freezing_completed_at,freezing_duration_minutes,latest_core_temp_c,ccp_passed)
    VALUES (v_freeze_id,v_kebab_batch_id,v_kebab_batch_id,v_p_kebab,700,0,'ShockFreezing',now()-interval '4 hours',now(),240,-20,true) RETURNING id INTO v_freeze_log_id;

  v_sscc := public.generate_sscc_mod10();
  INSERT INTO t_handling_units (company_id,facility_id,sscc_number,type,status,production_date)
    VALUES (v_company_id,v_facility_id,v_sscc,'Pallet','Open',current_date) RETURNING id INTO v_pallet_id;
  INSERT INTO t_production_logs (production_order_id,source_batch_id,output_batch_id,product_id,handling_unit_id,weight_gross,weight_tare,process_stage)
    VALUES (v_freeze_id,v_kebab_batch_id,v_kebab_batch_id,v_p_kebab,v_pallet_id,700,0,'Stacking');
  UPDATE t_handling_units SET status='Closed' WHERE id=v_pallet_id;

  v_shipment_number := 'WZ/AUDIT/'||to_char(now(),'YYMMDDHH24MISS');
  INSERT INTO t_shipments (company_id,facility_id,shipment_number,customer_id,status,dispatch_date,driver_name,truck_plates,trailer_plates,seal_number,transport_temperature)
    VALUES (v_company_id,v_facility_id,v_shipment_number,v_customer_id,'Shipped',current_date,'Jan Audytowy','SK1234A','SK5678P','SEAL-AUD',-21) RETURNING id INTO v_shipment_id;
  INSERT INTO t_shipment_items (shipment_id,product_id,batch_id,handling_unit_id,quantity) VALUES (v_shipment_id,v_p_kebab,v_kebab_batch_id,v_pallet_id,700);

  SELECT count(*) INTO v_lineage_count FROM t_lot_lineage WHERE child_lot_id IN (v_meat_batch_id,v_kebab_batch_id) OR parent_lot_id=v_raw_batch_id OR child_handling_unit_id=v_pallet_id;
  SELECT count(*) INTO v_complaint_count FROM t_supplier_complaints WHERE movement_id=v_pz_id;

  RETURN jsonb_build_object(
    'success', true,
    'temp_c', p_temp,
    'company_id', v_company_id,
    'pz_id', v_pz_id,
    'raw_batch_id', v_raw_batch_id,
    'meat_batch_id', v_meat_batch_id,
    'kebab_batch_id', v_kebab_batch_id,
    'pallet_id', v_pallet_id,
    'sscc', v_sscc,
    'shipment_id', v_shipment_id,
    'lineage_rows', v_lineage_count,
    'complaints_count', v_complaint_count
  );
END;
$$;