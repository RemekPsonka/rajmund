export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      t_app_users: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          ui_theme: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          ui_theme?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          ui_theme?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      t_batches: {
        Row: {
          created_at: string | null
          current_quantity: number
          expiration_date: string | null
          id: string
          initial_quantity: number
          internal_batch_number: string
          location_id: string | null
          parent_batch_id: string | null
          product_id: string
          production_date: string | null
          reception_date: string | null
          source_event_type: string | null
          status: Database["public"]["Enums"]["batch_status"] | null
          supplier_batch_number: string | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_quantity: number
          expiration_date?: string | null
          id?: string
          initial_quantity: number
          internal_batch_number: string
          location_id?: string | null
          parent_batch_id?: string | null
          product_id: string
          production_date?: string | null
          reception_date?: string | null
          source_event_type?: string | null
          status?: Database["public"]["Enums"]["batch_status"] | null
          supplier_batch_number?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_quantity?: number
          expiration_date?: string | null
          id?: string
          initial_quantity?: number
          internal_batch_number?: string
          location_id?: string | null
          parent_batch_id?: string | null
          product_id?: string
          production_date?: string | null
          reception_date?: string | null
          source_event_type?: string | null
          status?: Database["public"]["Enums"]["batch_status"] | null
          supplier_batch_number?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "t_storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "t_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "t_contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      t_companies: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          main_address_json: Json | null
          name: string
          short_name: string | null
          tax_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          main_address_json?: Json | null
          name: string
          short_name?: string | null
          tax_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          main_address_json?: Json | null
          name?: string
          short_name?: string | null
          tax_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      t_contractors: {
        Row: {
          company_id: string
          contact_json: Json | null
          created_at: string | null
          id: string
          is_customer: boolean | null
          is_logistics: boolean | null
          is_supplier: boolean | null
          name: string
          payment_term_days: number | null
          tax_id: string | null
          updated_at: string | null
          vet_number: string | null
        }
        Insert: {
          company_id: string
          contact_json?: Json | null
          created_at?: string | null
          id?: string
          is_customer?: boolean | null
          is_logistics?: boolean | null
          is_supplier?: boolean | null
          name: string
          payment_term_days?: number | null
          tax_id?: string | null
          updated_at?: string | null
          vet_number?: string | null
        }
        Update: {
          company_id?: string
          contact_json?: Json | null
          created_at?: string | null
          id?: string
          is_customer?: boolean | null
          is_logistics?: boolean | null
          is_supplier?: boolean | null
          name?: string
          payment_term_days?: number | null
          tax_id?: string | null
          updated_at?: string | null
          vet_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_contractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      t_departments: {
        Row: {
          cost_center_code: string | null
          created_at: string | null
          facility_id: string
          id: string
          is_production_line: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          cost_center_code?: string | null
          created_at?: string | null
          facility_id: string
          id?: string
          is_production_line?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          cost_center_code?: string | null
          created_at?: string | null
          facility_id?: string
          id?: string
          is_production_line?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_departments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      t_devices: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          device_type: string
          facility_id: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          device_type: string
          facility_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          device_type?: string
          facility_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_devices_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      t_employees: {
        Row: {
          company_id: string
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          created_at: string | null
          facility_id: string | null
          first_name: string
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          job_position: string
          job_position_id: string | null
          last_name: string
          pin_code_hash: string | null
          qr_login_code: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string | null
          facility_id?: string | null
          first_name: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          job_position: string
          job_position_id?: string | null
          last_name: string
          pin_code_hash?: string | null
          qr_login_code: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string | null
          facility_id?: string | null
          first_name?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          job_position?: string
          job_position_id?: string | null
          last_name?: string
          pin_code_hash?: string | null
          qr_login_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_employees_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_employees_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "t_job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      t_facilities: {
        Row: {
          company_id: string
          created_at: string | null
          geo_coordinates: Json | null
          id: string
          name: string
          type: Database["public"]["Enums"]["facility_type"]
          updated_at: string | null
          vet_approval_number: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          geo_coordinates?: Json | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["facility_type"]
          updated_at?: string | null
          vet_approval_number?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          geo_coordinates?: Json | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["facility_type"]
          updated_at?: string | null
          vet_approval_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_facilities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      t_freezing_temp_log: {
        Row: {
          ambient_temp_c: number | null
          core_temp_c: number
          created_at: string
          id: string
          production_log_id: string
          recorded_at: string
          source: string
        }
        Insert: {
          ambient_temp_c?: number | null
          core_temp_c: number
          created_at?: string
          id?: string
          production_log_id: string
          recorded_at?: string
          source?: string
        }
        Update: {
          ambient_temp_c?: number | null
          core_temp_c?: number
          created_at?: string
          id?: string
          production_log_id?: string
          recorded_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_freezing_temp_log_production_log_id_fkey"
            columns: ["production_log_id"]
            isOneToOne: false
            referencedRelation: "t_production_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      t_handling_units: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          facility_id: string
          id: string
          items_count: number | null
          label_printed: boolean | null
          production_date: string | null
          sscc_number: string
          status: string | null
          total_gross_weight: number | null
          total_net_weight: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          facility_id: string
          id?: string
          items_count?: number | null
          label_printed?: boolean | null
          production_date?: string | null
          sscc_number: string
          status?: string | null
          total_gross_weight?: number | null
          total_net_weight?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          facility_id?: string
          id?: string
          items_count?: number | null
          label_printed?: boolean | null
          production_date?: string | null
          sscc_number?: string
          status?: string | null
          total_gross_weight?: number | null
          total_net_weight?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_handling_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_handling_units_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      t_job_positions: {
        Row: {
          company_id: string
          created_at: string | null
          department: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_job_positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      t_lot_lineage: {
        Row: {
          child_handling_unit_id: string | null
          child_lot_id: string | null
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          operator_id: string | null
          parent_lot_id: string | null
          process_ref_id: string | null
          qty_kg: number
        }
        Insert: {
          child_handling_unit_id?: string | null
          child_lot_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          operator_id?: string | null
          parent_lot_id?: string | null
          process_ref_id?: string | null
          qty_kg: number
        }
        Update: {
          child_handling_unit_id?: string | null
          child_lot_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          operator_id?: string | null
          parent_lot_id?: string | null
          process_ref_id?: string | null
          qty_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_lot_lineage_child_handling_unit_id_fkey"
            columns: ["child_handling_unit_id"]
            isOneToOne: false
            referencedRelation: "t_handling_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_lot_lineage_child_lot_id_fkey"
            columns: ["child_lot_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_lot_lineage_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "t_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_lot_lineage_parent_lot_id_fkey"
            columns: ["parent_lot_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      t_packaging_transactions: {
        Row: {
          comments: string | null
          company_id: string
          contractor_id: string
          created_at: string | null
          created_by: string | null
          id: string
          packaging_type: string
          quantity: number
          shipment_id: string | null
          transaction_date: string | null
          type: Database["public"]["Enums"]["packaging_transaction_type"]
        }
        Insert: {
          comments?: string | null
          company_id: string
          contractor_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          packaging_type: string
          quantity: number
          shipment_id?: string | null
          transaction_date?: string | null
          type: Database["public"]["Enums"]["packaging_transaction_type"]
        }
        Update: {
          comments?: string | null
          company_id?: string
          contractor_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          packaging_type?: string
          quantity?: number
          shipment_id?: string | null
          transaction_date?: string | null
          type?: Database["public"]["Enums"]["packaging_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "t_packaging_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_packaging_transactions_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "t_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_packaging_transactions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "t_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      t_packaging_types: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_returnable: boolean | null
          name: string
          tare_weight: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_returnable?: boolean | null
          name: string
          tare_weight?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_returnable?: boolean | null
          name?: string
          tare_weight?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_packaging_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      t_production_inputs: {
        Row: {
          batch_id: string
          created_at: string | null
          created_by: string | null
          direction: string | null
          id: string
          product_id: string
          production_order_id: string
          weight: number
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          id?: string
          product_id: string
          production_order_id: string
          weight: number
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          id?: string
          product_id?: string
          production_order_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_production_inputs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_inputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_inputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "t_production_inputs_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "t_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      t_production_kebab_variants: {
        Row: {
          created_at: string | null
          id: string
          production_log_id: string | null
          quantity: number | null
          total_weight: number | null
          variant_name: string | null
          variant_weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          production_log_id?: string | null
          quantity?: number | null
          total_weight?: number | null
          variant_name?: string | null
          variant_weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          production_log_id?: string | null
          quantity?: number | null
          total_weight?: number | null
          variant_name?: string | null
          variant_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_production_kebab_variants_production_log_id_fkey"
            columns: ["production_log_id"]
            isOneToOne: false
            referencedRelation: "t_production_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      t_production_logs: {
        Row: {
          ccp_passed: boolean | null
          created_at: string | null
          deviation_kg: number | null
          deviation_percent: number | null
          employee_id: string | null
          expected_weight: number | null
          freezing_completed_at: string | null
          freezing_duration_minutes: number | null
          freezing_started_at: string | null
          handling_unit_id: string | null
          id: string
          latest_core_temp_c: number | null
          max_freezing_minutes: number | null
          output_batch_id: string | null
          packaging_count: number | null
          packaging_type: string | null
          prepared_by_employee_id: string | null
          process_stage: string | null
          product_id: string
          production_order_id: string
          recipe_id: string | null
          scale_device_id: string | null
          source_batch_id: string | null
          target_core_temp_c: number | null
          weight_gross: number
          weight_net: number | null
          weight_tare: number | null
        }
        Insert: {
          ccp_passed?: boolean | null
          created_at?: string | null
          deviation_kg?: number | null
          deviation_percent?: number | null
          employee_id?: string | null
          expected_weight?: number | null
          freezing_completed_at?: string | null
          freezing_duration_minutes?: number | null
          freezing_started_at?: string | null
          handling_unit_id?: string | null
          id?: string
          latest_core_temp_c?: number | null
          max_freezing_minutes?: number | null
          output_batch_id?: string | null
          packaging_count?: number | null
          packaging_type?: string | null
          prepared_by_employee_id?: string | null
          process_stage?: string | null
          product_id: string
          production_order_id: string
          recipe_id?: string | null
          scale_device_id?: string | null
          source_batch_id?: string | null
          target_core_temp_c?: number | null
          weight_gross: number
          weight_net?: number | null
          weight_tare?: number | null
        }
        Update: {
          ccp_passed?: boolean | null
          created_at?: string | null
          deviation_kg?: number | null
          deviation_percent?: number | null
          employee_id?: string | null
          expected_weight?: number | null
          freezing_completed_at?: string | null
          freezing_duration_minutes?: number | null
          freezing_started_at?: string | null
          handling_unit_id?: string | null
          id?: string
          latest_core_temp_c?: number | null
          max_freezing_minutes?: number | null
          output_batch_id?: string | null
          packaging_count?: number | null
          packaging_type?: string | null
          prepared_by_employee_id?: string | null
          process_stage?: string | null
          product_id?: string
          production_order_id?: string
          recipe_id?: string | null
          scale_device_id?: string | null
          source_batch_id?: string | null
          target_core_temp_c?: number | null
          weight_gross?: number
          weight_net?: number | null
          weight_tare?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_production_logs_scale_device"
            columns: ["scale_device_id"]
            isOneToOne: false
            referencedRelation: "t_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "t_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_handling_unit_id_fkey"
            columns: ["handling_unit_id"]
            isOneToOne: false
            referencedRelation: "t_handling_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_output_batch_id_fkey"
            columns: ["output_batch_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_prepared_by_employee_id_fkey"
            columns: ["prepared_by_employee_id"]
            isOneToOne: false
            referencedRelation: "t_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "t_production_logs_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "t_production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "t_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      t_production_orders: {
        Row: {
          company_id: string
          created_at: string | null
          facility_id: string
          id: string
          machine_id: string | null
          notes: string | null
          order_number: string
          production_date: string | null
          recipe_id: string | null
          status: Database["public"]["Enums"]["production_order_status"] | null
          supervisor_id: string | null
          type: Database["public"]["Enums"]["production_order_type"] | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          facility_id: string
          id?: string
          machine_id?: string | null
          notes?: string | null
          order_number: string
          production_date?: string | null
          recipe_id?: string | null
          status?: Database["public"]["Enums"]["production_order_status"] | null
          supervisor_id?: string | null
          type?: Database["public"]["Enums"]["production_order_type"] | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          facility_id?: string
          id?: string
          machine_id?: string | null
          notes?: string | null
          order_number?: string
          production_date?: string | null
          recipe_id?: string | null
          status?: Database["public"]["Enums"]["production_order_status"] | null
          supervisor_id?: string | null
          type?: Database["public"]["Enums"]["production_order_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_orders_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_orders_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "t_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      t_production_tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          name: string
          notes: string | null
          production_order_id: string
          sequence_number: number | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          name: string
          notes?: string | null
          production_order_id: string
          sequence_number?: number | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          name?: string
          notes?: string | null
          production_order_id?: string
          sequence_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_production_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "t_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_tasks_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "t_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      t_products: {
        Row: {
          company_id: string
          created_at: string | null
          default_expiration_days: number | null
          id: string
          industry_category: string | null
          is_raw_material: boolean | null
          max_storage_temp: number | null
          min_storage_temp: number | null
          name: string
          sku: string | null
          subiekt_id: string | null
          unit: string | null
          unit_target_weight_kg: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          default_expiration_days?: number | null
          id?: string
          industry_category?: string | null
          is_raw_material?: boolean | null
          max_storage_temp?: number | null
          min_storage_temp?: number | null
          name: string
          sku?: string | null
          subiekt_id?: string | null
          unit?: string | null
          unit_target_weight_kg?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          default_expiration_days?: number | null
          id?: string
          industry_category?: string | null
          is_raw_material?: boolean | null
          max_storage_temp?: number | null
          min_storage_temp?: number | null
          name?: string
          sku?: string | null
          subiekt_id?: string | null
          unit?: string | null
          unit_target_weight_kg?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      t_recipe_ingredients: {
        Row: {
          amount_per_kg_base: number | null
          created_at: string | null
          id: string
          product_id: string
          ratio: number
          recipe_id: string
          role: string
          unit: string | null
        }
        Insert: {
          amount_per_kg_base?: number | null
          created_at?: string | null
          id?: string
          product_id: string
          ratio: number
          recipe_id: string
          role?: string
          unit?: string | null
        }
        Update: {
          amount_per_kg_base?: number | null
          created_at?: string | null
          id?: string
          product_id?: string
          ratio?: number
          recipe_id?: string
          role?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_recipe_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recipe_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "t_recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "t_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      t_recipes: {
        Row: {
          base_product_id: string | null
          company_id: string
          created_at: string | null
          description: string | null
          evaporation_percent: number | null
          id: string
          is_active: boolean | null
          name: string
          process_instructions: string | null
          product_id: string | null
          target_yield_percent: number | null
          updated_at: string | null
        }
        Insert: {
          base_product_id?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          evaporation_percent?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          process_instructions?: string | null
          product_id?: string | null
          target_yield_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          base_product_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          evaporation_percent?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          process_instructions?: string | null
          product_id?: string | null
          target_yield_percent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_recipes_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recipes_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "t_recipes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
        ]
      }
      t_role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_read: boolean | null
          can_update: boolean | null
          created_at: string | null
          id: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      t_shipment_items: {
        Row: {
          batch_id: string | null
          created_at: string | null
          handling_unit_id: string | null
          id: string
          product_id: string | null
          quantity: number | null
          shipment_id: string
          verified_at: string | null
          verified_by: string | null
          verified_weight: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          handling_unit_id?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          shipment_id: string
          verified_at?: string | null
          verified_by?: string | null
          verified_weight?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          handling_unit_id?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          shipment_id?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_shipment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_shipment_items_handling_unit_id_fkey"
            columns: ["handling_unit_id"]
            isOneToOne: false
            referencedRelation: "t_handling_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_shipment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_shipment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "t_shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "t_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      t_shipments: {
        Row: {
          carrier_id: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivered_date: string | null
          destination_address_json: Json | null
          dispatch_date: string | null
          driver_name: string | null
          facility_id: string
          id: string
          linked_invoice_number: string | null
          pallets_count: number | null
          seal_number: string | null
          shipment_number: string
          status: Database["public"]["Enums"]["shipment_status"] | null
          total_gross_weight: number | null
          total_net_weight: number | null
          trailer_plates: string | null
          transport_temperature: number | null
          truck_plates: string | null
          updated_at: string | null
        }
        Insert: {
          carrier_id?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_date?: string | null
          destination_address_json?: Json | null
          dispatch_date?: string | null
          driver_name?: string | null
          facility_id: string
          id?: string
          linked_invoice_number?: string | null
          pallets_count?: number | null
          seal_number?: string | null
          shipment_number: string
          status?: Database["public"]["Enums"]["shipment_status"] | null
          total_gross_weight?: number | null
          total_net_weight?: number | null
          trailer_plates?: string | null
          transport_temperature?: number | null
          truck_plates?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_date?: string | null
          destination_address_json?: Json | null
          dispatch_date?: string | null
          driver_name?: string | null
          facility_id?: string
          id?: string
          linked_invoice_number?: string | null
          pallets_count?: number | null
          seal_number?: string | null
          shipment_number?: string
          status?: Database["public"]["Enums"]["shipment_status"] | null
          total_gross_weight?: number | null
          total_net_weight?: number | null
          trailer_plates?: string | null
          transport_temperature?: number | null
          truck_plates?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "t_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_shipments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "t_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_shipments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      t_storage_locations: {
        Row: {
          created_at: string | null
          facility_id: string
          id: string
          is_active: boolean | null
          location_type: string
          max_temp: number | null
          min_temp: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          facility_id: string
          id?: string
          is_active?: boolean | null
          location_type: string
          max_temp?: number | null
          min_temp?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          facility_id?: string
          id?: string
          is_active?: boolean | null
          location_type?: string
          max_temp?: number | null
          min_temp?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_storage_locations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      t_supplier_complaints: {
        Row: {
          complaint_type: string
          created_at: string | null
          id: string
          movement_id: string | null
          notes: string | null
          payload: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          supplier_id: string | null
        }
        Insert: {
          complaint_type: string
          created_at?: string | null
          id?: string
          movement_id?: string | null
          notes?: string | null
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
        }
        Update: {
          complaint_type?: string
          created_at?: string | null
          id?: string
          movement_id?: string | null
          notes?: string | null
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_supplier_complaints_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "t_warehouse_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_supplier_complaints_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "v_recent_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_supplier_complaints_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "t_app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_supplier_complaints_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "t_contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      t_task_templates: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          production_type: string
          sequence_number: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          production_type: string
          sequence_number?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          production_type?: string
          sequence_number?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_task_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      t_units_of_measure: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          symbol: string
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          symbol: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          symbol?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_units_of_measure_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      t_user_roles: {
        Row: {
          company_id: string | null
          created_at: string | null
          facility_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          facility_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          facility_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "t_user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_user_roles_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      t_warehouse_movement_items: {
        Row: {
          batch_id: string | null
          created_at: string | null
          id: string
          movement_id: string
          packaging_type: string | null
          pallets_count: number | null
          product_id: string
          quantity: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          id?: string
          movement_id: string
          packaging_type?: string | null
          pallets_count?: number | null
          product_id: string
          quantity: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          id?: string
          movement_id?: string
          packaging_type?: string | null
          pallets_count?: number | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "t_warehouse_movement_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "t_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_warehouse_movement_items_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "t_warehouse_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_warehouse_movement_items_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "v_recent_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_warehouse_movement_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_warehouse_movement_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_summary"
            referencedColumns: ["product_id"]
          },
        ]
      }
      t_warehouse_movements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          car_plates: string | null
          ccp1_passed: boolean | null
          company_id: string
          contractor_id: string | null
          created_at: string | null
          created_by: string | null
          document_number: string
          driver_name: string | null
          external_doc_number: string | null
          facility_id: string
          id: string
          notes: string | null
          received_temp_c: number | null
          received_temp_method: string | null
          reception_temp: number | null
          status: Database["public"]["Enums"]["document_status"] | null
          type: Database["public"]["Enums"]["warehouse_doc_type"] | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          car_plates?: string | null
          ccp1_passed?: boolean | null
          company_id: string
          contractor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          document_number: string
          driver_name?: string | null
          external_doc_number?: string | null
          facility_id: string
          id?: string
          notes?: string | null
          received_temp_c?: number | null
          received_temp_method?: string | null
          reception_temp?: number | null
          status?: Database["public"]["Enums"]["document_status"] | null
          type?: Database["public"]["Enums"]["warehouse_doc_type"] | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          car_plates?: string | null
          ccp1_passed?: boolean | null
          company_id?: string
          contractor_id?: string | null
          created_at?: string | null
          created_by?: string | null
          document_number?: string
          driver_name?: string | null
          external_doc_number?: string | null
          facility_id?: string
          id?: string
          notes?: string | null
          received_temp_c?: number | null
          received_temp_method?: string | null
          reception_temp?: number | null
          status?: Database["public"]["Enums"]["document_status"] | null
          type?: Database["public"]["Enums"]["warehouse_doc_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "t_warehouse_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_warehouse_movements_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "t_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_warehouse_movements_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_production_today: {
        Row: {
          company_id: string | null
          facility_id: string | null
          facility_name: string | null
          logs_count: number | null
          total_output_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_orders_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "t_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recent_movements: {
        Row: {
          contractor_name: string | null
          created_at: string | null
          document_number: string | null
          facility_name: string | null
          id: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          type: Database["public"]["Enums"]["warehouse_doc_type"] | null
        }
        Relationships: []
      }
      v_stock_summary: {
        Row: {
          batch_count: number | null
          company_id: string | null
          product_id: string | null
          product_name: string | null
          sku: string | null
          total_weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "t_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "t_companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_production_yield: {
        Args: { p_order_id: string }
        Returns: {
          total_input_weight: number
          total_output_weight: number
          waste_percentage: number
          yield_percentage: number
        }[]
      }
      check_permission: {
        Args: { _action: string; _resource: string; _user_id: string }
        Returns: boolean
      }
      close_production_order_with_batches: {
        Args: { p_order_id: string }
        Returns: Json
      }
      close_production_order_with_lineage: {
        Args: { p_order_id: string }
        Returns: Json
      }
      generate_batch_number: { Args: { p_product_id: string }; Returns: string }
      generate_document_number: {
        Args: {
          p_company_id: string
          p_type: Database["public"]["Enums"]["warehouse_doc_type"]
        }
        Returns: string
      }
      generate_production_order_number: {
        Args: {
          p_company_id: string
          p_type: Database["public"]["Enums"]["production_order_type"]
        }
        Returns: string
      }
      generate_shipment_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_sscc_number: { Args: { p_company_id: string }; Returns: string }
      get_lot_lineage: { Args: { lot_id: string }; Returns: Json }
      get_packaging_balance: {
        Args: { p_contractor_id: string; p_packaging_type: string }
        Returns: number
      }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_facility_access: {
        Args: { _facility_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
      make_user_global_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      simulate_full_production_day: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "global_admin" | "facility_admin" | "operator" | "viewer"
      batch_status: "Released" | "Blocked" | "Quarantine"
      contract_type: "B2B" | "UoP" | "Mandate" | "Other"
      document_status: "Draft" | "Approved" | "Cancelled"
      facility_type: "Plant" | "Warehouse" | "Office" | "Store"
      packaging_transaction_type: "Issued" | "Received"
      production_order_status: "Open" | "Closed" | "Cancelled"
      production_order_type:
        | "Decomposition"
        | "Processing"
        | "Packing"
        | "Assembly"
        | "Freezing"
      shipment_status: "Planning" | "Loading" | "Shipped" | "Delivered"
      warehouse_doc_type: "PZ" | "WZ" | "MM" | "RW" | "PW"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["global_admin", "facility_admin", "operator", "viewer"],
      batch_status: ["Released", "Blocked", "Quarantine"],
      contract_type: ["B2B", "UoP", "Mandate", "Other"],
      document_status: ["Draft", "Approved", "Cancelled"],
      facility_type: ["Plant", "Warehouse", "Office", "Store"],
      packaging_transaction_type: ["Issued", "Received"],
      production_order_status: ["Open", "Closed", "Cancelled"],
      production_order_type: [
        "Decomposition",
        "Processing",
        "Packing",
        "Assembly",
        "Freezing",
      ],
      shipment_status: ["Planning", "Loading", "Shipped", "Delivered"],
      warehouse_doc_type: ["PZ", "WZ", "MM", "RW", "PW"],
    },
  },
} as const
