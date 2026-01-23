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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "global_admin" | "facility_admin" | "operator" | "viewer"
      contract_type: "B2B" | "UoP" | "Mandate" | "Other"
      facility_type: "Plant" | "Warehouse" | "Office" | "Store"
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
      contract_type: ["B2B", "UoP", "Mandate", "Other"],
      facility_type: ["Plant", "Warehouse", "Office", "Store"],
    },
  },
} as const
