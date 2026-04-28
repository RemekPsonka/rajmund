
DO $$
DECLARE
  v_narrow uuid := '585e72fb-27f2-452d-8cdb-b80eb31016ad';
  v_facility uuid;
  v_loc_pz uuid; v_loc_prod uuid; v_loc_freezer uuid; v_loc_ship uuid;
  v_emp_supervisor uuid; v_emp_op1 uuid; v_emp_op2 uuid;
  p_udko uuid; p_mieso uuid; p_skora uuid; p_kosci uuid;
  p_spice uuid; p_water uuid; p_masa uuid; p_keb15 uuid;
  p_paleta uuid; p_sztyca uuid;
  c_drobimex uuid; c_kebmaster uuid; c_transkebab uuid;
  r_kebab uuid;
  b_udko uuid; b_mieso uuid; b_skora uuid; b_kosci uuid; b_spice uuid; b_water uuid;
  b_masa uuid; b_kebab uuid;
  o_dec uuid; o_prz uuid; o_asm uuid; o_frz uuid;
  pl_frz uuid; hu_paleta uuid;
  pz_id uuid; wz_waste uuid; wz_kebab uuid;
BEGIN
  DELETE FROM t_print_log;
  DELETE FROM t_packaging_transactions;
  DELETE FROM t_shipment_items;
  DELETE FROM t_shipments;
  DELETE FROM t_freezing_temp_log;
  DELETE FROM t_production_kebab_variants;
  DELETE FROM t_production_logs;
  DELETE FROM t_production_inputs;
  DELETE FROM t_production_tasks;
  DELETE FROM t_production_orders;
  DELETE FROM t_lot_lineage;
  DELETE FROM t_handling_units;
  DELETE FROM t_warehouse_movement_items;
  DELETE FROM t_warehouse_movements;
  DELETE FROM t_supplier_complaints;
  DELETE FROM t_batches;
  DELETE FROM t_recipe_ingredients;
  DELETE FROM t_recipes;
  DELETE FROM t_products;
  DELETE FROM t_contractors;
  DELETE FROM t_devices WHERE company_id <> v_narrow;
  DELETE FROM t_user_roles WHERE company_id IS NOT NULL AND company_id <> v_narrow;
  DELETE FROM t_employees WHERE company_id <> v_narrow;
  DELETE FROM t_job_positions WHERE company_id <> v_narrow;
  DELETE FROM t_task_templates WHERE company_id <> v_narrow;
  DELETE FROM t_units_of_measure WHERE company_id <> v_narrow;
  DELETE FROM t_packaging_types WHERE company_id <> v_narrow;
  DELETE FROM t_storage_locations WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id <> v_narrow);
  DELETE FROM t_departments WHERE facility_id IN (SELECT id FROM t_facilities WHERE company_id <> v_narrow);
  DELETE FROM t_facilities WHERE company_id <> v_narrow;
  DELETE FROM t_companies WHERE id <> v_narrow;

  SELECT id INTO v_facility FROM t_facilities WHERE company_id=v_narrow LIMIT 1;
  SELECT id INTO v_loc_pz FROM t_storage_locations WHERE facility_id=v_facility AND location_type='chiller' LIMIT 1;
  SELECT id INTO v_loc_prod FROM t_storage_locations WHERE facility_id=v_facility AND location_type='production' LIMIT 1;
  SELECT id INTO v_loc_freezer FROM t_storage_locations WHERE facility_id=v_facility AND (location_type='freezer' OR location_type='shock') LIMIT 1;
  SELECT id INTO v_loc_ship FROM t_storage_locations WHERE facility_id=v_facility AND location_type='storage' LIMIT 1;
  IF v_loc_pz IS NULL THEN INSERT INTO t_storage_locations(facility_id,name,location_type,min_temp,max_temp) VALUES (v_facility,'Chłodnia Przyjęć','chiller',0,4) RETURNING id INTO v_loc_pz; END IF;
  IF v_loc_prod IS NULL THEN INSERT INTO t_storage_locations(facility_id,name,location_type,min_temp,max_temp) VALUES (v_facility,'Hala Produkcyjna','production',2,12) RETURNING id INTO v_loc_prod; END IF;
  IF v_loc_freezer IS NULL THEN INSERT INTO t_storage_locations(facility_id,name,location_type,min_temp,max_temp) VALUES (v_facility,'Mroźnia','freezer',-25,-18) RETURNING id INTO v_loc_freezer; END IF;
  IF v_loc_ship IS NULL THEN INSERT INTO t_storage_locations(facility_id,name,location_type) VALUES (v_facility,'Strefa Wysyłki','storage') RETURNING id INTO v_loc_ship; END IF;

  SELECT id INTO v_emp_supervisor FROM t_employees WHERE company_id=v_narrow ORDER BY created_at LIMIT 1;
  SELECT id INTO v_emp_op1 FROM t_employees WHERE company_id=v_narrow ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO v_emp_op2 FROM t_employees WHERE company_id=v_narrow ORDER BY created_at OFFSET 2 LIMIT 1;
  IF v_emp_op1 IS NULL THEN v_emp_op1 := v_emp_supervisor; END IF;
  IF v_emp_op2 IS NULL THEN v_emp_op2 := v_emp_supervisor; END IF;

  INSERT INTO t_contractors(company_id,name,tax_id,is_supplier,vet_number,payment_term_days) VALUES (v_narrow,'Drobimex Sp. z o.o.','5860007103',true,'PL-30090301-WE',30) RETURNING id INTO c_drobimex;
  INSERT INTO t_contractors(company_id,name,tax_id,is_customer,payment_term_days) VALUES (v_narrow,'Hurtownia Kebab Master','7891234567',true,21) RETURNING id INTO c_kebmaster;
  INSERT INTO t_contractors(company_id,name,tax_id,is_logistics,payment_term_days) VALUES (v_narrow,'Trans-Kebab Kowalski','9876543210',true,14) RETURNING id INTO c_transkebab;

  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material,min_storage_temp,max_storage_temp,default_expiration_days) VALUES (v_narrow,'Udko z kurczaka z kością','RAW-UDKO','RawMeat','kg',true,0,4,7) RETURNING id INTO p_udko;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material,min_storage_temp,max_storage_temp,default_expiration_days) VALUES (v_narrow,'Mięso z udka (po rozbiorze)','SEMI-MIESO','SemiFinished','kg',false,0,4,3) RETURNING id INTO p_mieso;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material) VALUES (v_narrow,'Skóra z kurczaka','WST-SKORA','Waste','kg',false) RETURNING id INTO p_skora;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material) VALUES (v_narrow,'Kości drobiowe','WST-KOSCI','Waste','kg',false) RETURNING id INTO p_kosci;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material,default_expiration_days) VALUES (v_narrow,'Mix przypraw kebab czerwony','SPC-MIX','Spice','kg',true,365) RETURNING id INTO p_spice;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material) VALUES (v_narrow,'Woda technologiczna','ADD-WODA','Additive','kg',true) RETURNING id INTO p_water;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material,min_storage_temp,max_storage_temp,default_expiration_days) VALUES (v_narrow,'Masa kebabowa masowana','SEMI-MASA','SemiFinished','kg',false,0,4,2) RETURNING id INTO p_masa;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material,unit_target_weight_kg,min_storage_temp,max_storage_temp,default_expiration_days) VALUES (v_narrow,'Kebab Czerwony 15kg','FIN-KEB-15','FinishedGood','szt',false,15,-25,-18,180) RETURNING id INTO p_keb15;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material) VALUES (v_narrow,'Paleta EUR','PKG-EUR','Packaging','szt',true) RETURNING id INTO p_paleta;
  INSERT INTO t_products(company_id,name,sku,industry_category,unit,is_raw_material) VALUES (v_narrow,'Sztyca kebabowa','PKG-SZT','Packaging','szt',true) RETURNING id INTO p_sztyca;

  INSERT INTO t_recipes(company_id,name,description,product_id,base_product_id,evaporation_percent,target_yield_percent,is_active) VALUES (v_narrow,'Kebab Czerwony Standard','Mięso 85% + przyprawy 5% + woda 10%, ewaporacja 3%',p_keb15,p_masa,3,97,true) RETURNING id INTO r_kebab;
  INSERT INTO t_recipe_ingredients(recipe_id,product_id,role,ratio,unit) VALUES (r_kebab,p_mieso,'MEAT',0.85,'kg'),(r_kebab,p_spice,'SPICE',0.05,'kg'),(r_kebab,p_water,'WATER',0.10,'kg');

  INSERT INTO t_warehouse_movements(company_id,facility_id,type,document_number,contractor_id,status,received_temp_c,notes)
    VALUES (v_narrow,v_facility,'PZ','PZ/2026/04/28/001',c_drobimex,'Approved',2.5,'Dostawa udek - +2.5°C OK') RETURNING id INTO pz_id;
  INSERT INTO t_batches(product_id,internal_batch_number,supplier_batch_number,supplier_id,production_date,expiration_date,reception_date,status,initial_quantity,current_quantity,location_id,source_event_type)
    VALUES (p_udko,'260428/DROBIMEX/RAW-UDKO','DRB-260428-A1',c_drobimex,CURRENT_DATE,CURRENT_DATE+7,now()-interval '6 hours','Released',1000,0,v_loc_pz,'RECEIVING') RETURNING id INTO b_udko;
  INSERT INTO t_warehouse_movement_items(movement_id,product_id,batch_id,quantity) VALUES (pz_id,p_udko,b_udko,1000);

  INSERT INTO t_production_orders(company_id,facility_id,order_number,type,status,production_date,supervisor_id,notes) VALUES (v_narrow,v_facility,'ROZ/2026/04/28/001','Decomposition','Closed',CURRENT_DATE,v_emp_supervisor,'Rozbiór 1000 kg udek') RETURNING id INTO o_dec;
  INSERT INTO t_production_inputs(production_order_id,batch_id,product_id,weight,direction) VALUES (o_dec,b_udko,p_udko,1000,'IN');
  INSERT INTO t_batches(product_id,internal_batch_number,production_date,expiration_date,status,initial_quantity,current_quantity,location_id,parent_batch_id,source_event_type) VALUES (p_mieso,'260428/NARROW/SEMI-MIESO',CURRENT_DATE,CURRENT_DATE+3,'Released',700,0,v_loc_prod,b_udko,'DISASSEMBLY') RETURNING id INTO b_mieso;
  INSERT INTO t_batches(product_id,internal_batch_number,production_date,expiration_date,status,initial_quantity,current_quantity,location_id,parent_batch_id,source_event_type) VALUES (p_skora,'260428/NARROW/WST-SKORA',CURRENT_DATE,CURRENT_DATE+5,'Released',200,200,v_loc_pz,b_udko,'DISASSEMBLY') RETURNING id INTO b_skora;
  INSERT INTO t_batches(product_id,internal_batch_number,production_date,expiration_date,status,initial_quantity,current_quantity,location_id,parent_batch_id,source_event_type) VALUES (p_kosci,'260428/NARROW/WST-KOSCI',CURRENT_DATE,CURRENT_DATE+5,'Released',100,100,v_loc_pz,b_udko,'DISASSEMBLY') RETURNING id INTO b_kosci;
  INSERT INTO t_production_logs(production_order_id,product_id,source_batch_id,output_batch_id,employee_id,weight_gross,weight_tare,packaging_count,packaging_type,process_stage) VALUES
    (o_dec,p_mieso,b_udko,b_mieso,v_emp_op1,700,0,1,'BULK','Decomposition'),
    (o_dec,p_skora,b_udko,b_skora,v_emp_op1,200,0,1,'BULK','Decomposition'),
    (o_dec,p_kosci,b_udko,b_kosci,v_emp_op1,100,0,1,'BULK','Decomposition');

  INSERT INTO t_production_orders(company_id,facility_id,order_number,type,status,production_date,supervisor_id,recipe_id) VALUES (v_narrow,v_facility,'PRZ/2026/04/28/001','Processing','Closed',CURRENT_DATE,v_emp_supervisor,r_kebab) RETURNING id INTO o_prz;
  INSERT INTO t_batches(product_id,internal_batch_number,production_date,expiration_date,status,initial_quantity,current_quantity,location_id,source_event_type) VALUES (p_spice,'260428/NARROW/SPC-MIX',CURRENT_DATE,CURRENT_DATE+365,'Released',35,0,v_loc_prod,'RECEIVING') RETURNING id INTO b_spice;
  INSERT INTO t_batches(product_id,internal_batch_number,production_date,status,initial_quantity,current_quantity,location_id,source_event_type) VALUES (p_water,'260428/NARROW/ADD-WODA',CURRENT_DATE,'Released',70,0,v_loc_prod,'RECEIVING') RETURNING id INTO b_water;
  INSERT INTO t_production_inputs(production_order_id,batch_id,product_id,weight,direction) VALUES (o_prz,b_mieso,p_mieso,700,'IN'),(o_prz,b_spice,p_spice,35,'IN'),(o_prz,b_water,p_water,70,'IN');
  INSERT INTO t_batches(product_id,internal_batch_number,production_date,expiration_date,status,initial_quantity,current_quantity,location_id,parent_batch_id,source_event_type) VALUES (p_masa,'260428/NARROW/SEMI-MASA',CURRENT_DATE,CURRENT_DATE+2,'Released',781,0,v_loc_prod,b_mieso,'TUMBLING') RETURNING id INTO b_masa;
  INSERT INTO t_production_logs(production_order_id,product_id,source_batch_id,output_batch_id,employee_id,recipe_id,weight_gross,weight_tare,packaging_count,packaging_type,process_stage,expected_weight) VALUES (o_prz,p_masa,b_mieso,b_masa,v_emp_op2,r_kebab,781,0,1,'BULK','Massaging',781);
  UPDATE t_batches SET current_quantity=0 WHERE id=b_mieso;

  INSERT INTO t_production_orders(company_id,facility_id,order_number,type,status,production_date,supervisor_id,recipe_id) VALUES (v_narrow,v_facility,'SKL/2026/04/28/001','Assembly','Closed',CURRENT_DATE,v_emp_supervisor,r_kebab) RETURNING id INTO o_asm;
  INSERT INTO t_production_inputs(production_order_id,batch_id,product_id,weight,direction) VALUES (o_asm,b_masa,p_masa,781,'IN');
  INSERT INTO t_batches(product_id,internal_batch_number,production_date,expiration_date,status,initial_quantity,current_quantity,location_id,parent_batch_id,source_event_type) VALUES (p_keb15,'260428/NARROW/FIN-KEB-15',CURRENT_DATE,CURRENT_DATE+180,'Released',780,780,v_loc_prod,b_masa,'ASSEMBLY') RETURNING id INTO b_kebab;
  INSERT INTO t_production_logs(production_order_id,product_id,source_batch_id,output_batch_id,employee_id,recipe_id,weight_gross,weight_tare,packaging_count,packaging_type,process_stage) VALUES (o_asm,p_keb15,b_masa,b_kebab,v_emp_op1,r_kebab,780,0,52,'STICK','Stacking');
  INSERT INTO t_production_kebab_variants(production_log_id,variant_name,quantity,variant_weight,total_weight) SELECT id, 'Kebab 15kg', 52, 15, 780 FROM t_production_logs WHERE production_order_id=o_asm;
  UPDATE t_batches SET current_quantity=0 WHERE id=b_masa;

  INSERT INTO t_production_orders(company_id,facility_id,order_number,type,status,production_date,supervisor_id) VALUES (v_narrow,v_facility,'MRZ/2026/04/28/001','Freezing','Closed',CURRENT_DATE,v_emp_supervisor) RETURNING id INTO o_frz;
  INSERT INTO t_production_inputs(production_order_id,batch_id,product_id,weight,direction) VALUES (o_frz,b_kebab,p_keb15,780,'IN');
  INSERT INTO t_production_logs(production_order_id,product_id,source_batch_id,output_batch_id,employee_id,weight_gross,weight_tare,packaging_count,packaging_type,process_stage,target_core_temp_c,latest_core_temp_c,ccp_passed,freezing_started_at,freezing_completed_at,max_freezing_minutes) VALUES (o_frz,p_keb15,b_kebab,b_kebab,v_emp_op2,780,0,52,'STICK','ShockFreezing',-18,-19.2,true,now()-interval '3 hours',now()-interval '30 minutes',240) RETURNING id INTO pl_frz;
  INSERT INTO t_freezing_temp_log(production_log_id,recorded_at,core_temp_c,ambient_temp_c,source) VALUES
    (pl_frz, now()-interval '3 hours', 5.0, -28, 'manual'),
    (pl_frz, now()-interval '2.5 hours', -2.0, -30, 'manual'),
    (pl_frz, now()-interval '2 hours', -8.0, -32, 'manual'),
    (pl_frz, now()-interval '1.5 hours', -13.0, -33, 'manual'),
    (pl_frz, now()-interval '1 hour', -16.5, -34, 'manual'),
    (pl_frz, now()-interval '30 minutes', -19.2, -34, 'manual');
  UPDATE t_batches SET location_id=v_loc_freezer WHERE id=b_kebab;

  INSERT INTO t_handling_units(company_id,facility_id,sscc_number,type,status,total_net_weight,total_gross_weight,items_count,production_date,label_printed) VALUES (v_narrow,v_facility,'003590000000000017','Pallet','Closed',780,805,52,CURRENT_DATE,true) RETURNING id INTO hu_paleta;
  INSERT INTO t_lot_lineage(parent_lot_id,child_handling_unit_id,event_type,qty_kg,occurred_at,operator_id) VALUES (b_kebab, hu_paleta, 'AGGREGATION', 780, now()-interval '20 minutes', v_emp_op1);

  INSERT INTO t_warehouse_movements(company_id,facility_id,type,document_number,contractor_id,status,notes) VALUES (v_narrow,v_facility,'WZ','WZ/2026/04/28/001',c_kebmaster,'Approved','Sprzedaż uboczna') RETURNING id INTO wz_waste;
  INSERT INTO t_warehouse_movement_items(movement_id,product_id,batch_id,quantity) VALUES (wz_waste,p_skora,b_skora,200),(wz_waste,p_kosci,b_kosci,100);
  UPDATE t_batches SET current_quantity=0 WHERE id IN (b_skora,b_kosci);
  INSERT INTO t_shipments(company_id,facility_id,shipment_number,status,customer_id,carrier_id,dispatch_date,driver_name,truck_plates,trailer_plates,seal_number,total_net_weight,total_gross_weight,pallets_count) VALUES (v_narrow,v_facility,'WZ/2026/04/28/001','Shipped',c_kebmaster,c_transkebab,CURRENT_DATE,'Jan Kowalczyk','SK12345','SK67890','SEAL-001',300,300,0);

  INSERT INTO t_shipments(company_id,facility_id,shipment_number,status,customer_id,carrier_id,dispatch_date,driver_name,truck_plates,trailer_plates,total_net_weight,total_gross_weight,pallets_count,destination_address_json)
    VALUES (v_narrow,v_facility,'WZ/2026/04/28/002','Planning',c_kebmaster,c_transkebab,CURRENT_DATE,'Adam Nowak','SK99999','SK88888',780,805,1,jsonb_build_object('street','ul. Mroźna 12','city','Katowice','postal','40-001','country','PL')) RETURNING id INTO wz_kebab;
  INSERT INTO t_shipment_items(shipment_id,product_id,batch_id,handling_unit_id,quantity) VALUES (wz_kebab,p_keb15,b_kebab,hu_paleta,780);

  RAISE NOTICE 'OK';
END $$;
