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
      customers: {
        Row: {
          address: string | null
          approx_purchase_date: string | null
          company_name: string | null
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          project_name: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approx_purchase_date?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          project_name?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approx_purchase_date?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          project_name?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pins: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          pin: string | null
          pin_hash: string
          role: string
          signature_image: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          pin?: string | null
          pin_hash?: string
          role?: string
          signature_image?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          pin?: string | null
          pin_hash?: string
          role?: string
          signature_image?: string | null
        }
        Relationships: []
      }
      pin_login_attempts: {
        Row: {
          attempt_key: string
          failed_attempts: number
          locked_until: string | null
          window_started_at: string
        }
        Insert: {
          attempt_key: string
          failed_attempts?: number
          locked_until?: string | null
          window_started_at?: string
        }
        Update: {
          attempt_key?: string
          failed_attempts?: number
          locked_until?: string | null
          window_started_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          dealer_price: number
          description: string | null
          id: string
          name: string
          project_price: number
          sku: string | null
          unit: string | null
          updated_at: string
          user_price: number
        }
        Insert: {
          created_at?: string
          dealer_price?: number
          description?: string | null
          id?: string
          name: string
          project_price?: number
          sku?: string | null
          unit?: string | null
          updated_at?: string
          user_price?: number
        }
        Update: {
          created_at?: string
          dealer_price?: number
          description?: string | null
          id?: string
          name?: string
          project_price?: number
          sku?: string | null
          unit?: string | null
          updated_at?: string
          user_price?: number
        }
        Relationships: []
      }
      quote_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          id: string
          quote_id: string
          requested_at: string
          requested_by: string | null
          status: string
          telegram_chat_id: number | null
          telegram_message_id: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          quote_id: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          quote_id?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_approvals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_name: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount_total: number
          grand_total: number
          id: string
          items: Json
          note: string | null
          quote_number: string
          subtotal: number
          system_name: string
          total: number
          vat_rate: number
          vat_total: number
        }
        Insert: {
          company_name: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          items?: Json
          note?: string | null
          quote_number?: string
          subtotal?: number
          system_name: string
          total?: number
          vat_rate?: number
          vat_total?: number
        }
        Update: {
          company_name?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          items?: Json
          note?: string | null
          quote_number?: string
          subtotal?: number
          system_name?: string
          total?: number
          vat_rate?: number
          vat_total?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      register_pin: {
        Args: {
          input_first_name: string
          input_id: string
          input_last_name: string
          input_pin: string
          input_role: string
          input_signature_image?: string | null
        }
        Returns: string
      }
      update_pin: {
        Args: {
          input_first_name?: string | null
          input_id: string
          input_last_name?: string | null
          input_pin?: string | null
          input_signature_image?: string | null
          replace_signature?: boolean
        }
        Returns: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          signature_image: string | null
        }[]
      }
      verify_pin: {
        Args: {
          input_pin: string
        }
        Returns: {
          first_name: string | null
          id: string
          last_name: string | null
          role: string | null
          signature_image: string | null
        }[]
      }
      pin_login_retry_after: {
        Args: { input_attempt_key: string }
        Returns: number
      }
      record_pin_login_failure: {
        Args: { input_attempt_key: string }
        Returns: number
      }
      clear_pin_login_failures: {
        Args: { input_attempt_key: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
