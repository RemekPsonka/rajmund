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
          product_id: string
          production_date: string | null
          reception_date: string | null
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
          product_id: string
          production_date?: string | null
          reception_date?: string | null
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
          product_id?: string
          production_date?: string | null
          reception_date?: string | null
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
            foreignKeyName: "t_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
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
            foreignKeyName: "t_production_inputs_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "t_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      t_production_logs: {
        Row: {
          created_at: string | null
          employee_id: string | null
          handling_unit_id: string | null
          id: string
          output_batch_id: string | null
          packaging_count: number | null
          packaging_type: string | null
          product_id: string
          production_order_id: string
          scale_device_id: string | null
          source_batch_id: string | null
          weight_gross: number
          weight_net: number | null
          weight_tare: number | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          handling_unit_id?: string | null
          id?: string
          output_batch_id?: string | null
          packaging_count?: number | null
          packaging_type?: string | null
          product_id: string
          production_order_id: string
          scale_device_id?: string | null
          source_batch_id?: string | null
          weight_gross: number
          weight_net?: number | null
          weight_tare?: number | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          handling_unit_id?: string | null
          id?: string
          output_batch_id?: string | null
          packaging_count?: number | null
          packaging_type?: string | null
          product_id?: string
          production_order_id?: string
          scale_device_id?: string | null
          source_batch_id?: string | null
          weight_gross?: number
          weight_net?: number | null
          weight_tare?: number | null
        }
        Relationships: [
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
            foreignKeyName: "t_production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "t_production_logs_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "t_production_orders"
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
        ]
      }
      t_products: {
        Row: {
          company_id: string
          created_at: string | null
          default_expiration_days: number | null
          id: string
          is_raw_material: boolean | null
          max_storage_temp: number | null
          min_storage_temp: number | null
          name: string
          sku: string | null
          subiekt_id: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          default_expiration_days?: number | null
          id?: string
          is_raw_material?: boolean | null
          max_storage_temp?: number | null
          min_storage_temp?: number | null
          name: string
          sku?: string | null
          subiekt_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          default_expiration_days?: number | null
          id?: string
          is_raw_material?: boolean | null
          max_storage_temp?: number | null
          min_storage_temp?: number | null
          name?: string
          sku?: string | null
          subiekt_id?: string | null
          unit?: string | null
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
          created_at: string | null
          id: string
          product_id: string
          ratio: number
          recipe_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          ratio: number
          recipe_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          ratio?: number
          recipe_id?: string
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
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
        ]
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
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          handling_unit_id?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          shipment_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          handling_unit_id?: string | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          shipment_id?: string
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
            foreignKeyName: "t_warehouse_movement_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "t_products"
            referencedColumns: ["id"]
          },
        ]
      }
      t_warehouse_movements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          car_plates: string | null
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
          reception_temp: number | null
          status: Database["public"]["Enums"]["document_status"] | null
          type: Database["public"]["Enums"]["warehouse_doc_type"] | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          car_plates?: string | null
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
          reception_temp?: number | null
          status?: Database["public"]["Enums"]["document_status"] | null
          type?: Database["public"]["Enums"]["warehouse_doc_type"] | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          car_plates?: string | null
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
      [_ in never]: never
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
      close_production_order_with_batches: {
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
      production_order_type: "Decomposition" | "Processing" | "Packing"
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
      production_order_type: ["Decomposition", "Processing", "Packing"],
      shipment_status: ["Planning", "Loading", "Shipped", "Delivered"],
      warehouse_doc_type: ["PZ", "WZ", "MM", "RW", "PW"],
    },
  },
} as const
