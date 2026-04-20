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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      certified_materia_medica: {
        Row: {
          artg_verified: boolean
          aust_l_number: string | null
          category: string
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          import_external_id: string | null
          import_source: string | null
          import_status: string
          price: number
          product_name: string
          safety_guardrails: Json
          source_authority: string | null
          stock_status: boolean
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          artg_verified?: boolean
          aust_l_number?: string | null
          category: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          import_external_id?: string | null
          import_source?: string | null
          import_status?: string
          price?: number
          product_name: string
          safety_guardrails?: Json
          source_authority?: string | null
          stock_status?: boolean
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          artg_verified?: boolean
          aust_l_number?: string | null
          category?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          import_external_id?: string | null
          import_source?: string | null
          import_status?: string
          price?: number
          product_name?: string
          safety_guardrails?: Json
          source_authority?: string | null
          stock_status?: boolean
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: []
      }
      consult_messages: {
        Row: {
          anon_token_hash: string | null
          consult_id: string
          content: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["message_role"]
        }
        Insert: {
          anon_token_hash?: string | null
          consult_id: string
          content: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["message_role"]
        }
        Update: {
          anon_token_hash?: string | null
          consult_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
        }
        Relationships: [
          {
            foreignKeyName: "consult_messages_consult_id_fkey"
            columns: ["consult_id"]
            isOneToOne: false
            referencedRelation: "consults"
            referencedColumns: ["id"]
          },
        ]
      }
      consults: {
        Row: {
          anon_token_hash: string | null
          created_at: string
          id: string
          intake: Json
          status: Database["public"]["Enums"]["consult_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anon_token_hash?: string | null
          created_at?: string
          id?: string
          intake?: Json
          status?: Database["public"]["Enums"]["consult_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anon_token_hash?: string | null
          created_at?: string
          id?: string
          intake?: Json
          status?: Database["public"]["Enums"]["consult_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      prescription_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          id: string
          prescription_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          prescription_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_audit_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          attached_products: Json
          attached_protocols: Json
          claimed_at: string | null
          claimed_by: string | null
          consult_id: string
          created_at: string
          draft: Json
          final: Json | null
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["prescription_status"]
          updated_at: string
        }
        Insert: {
          attached_products?: Json
          attached_protocols?: Json
          claimed_at?: string | null
          claimed_by?: string | null
          consult_id: string
          created_at?: string
          draft: Json
          final?: Json | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
        }
        Update: {
          attached_products?: Json
          attached_protocols?: Json
          claimed_at?: string | null
          claimed_by?: string | null
          consult_id?: string
          created_at?: string
          draft?: Json
          final?: Json | null
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_consult_id_fkey"
            columns: ["consult_id"]
            isOneToOne: false
            referencedRelation: "consults"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          consult_id: string | null
          created_at: string
          has_unlocked_education: boolean
          id: string
          purchased_medications: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          consult_id?: string | null
          created_at?: string
          has_unlocked_education?: boolean
          id?: string
          purchased_medications?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          consult_id?: string | null
          created_at?: string
          has_unlocked_education?: boolean
          id?: string
          purchased_medications?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wisdom_protocols: {
        Row: {
          artg_relevant: boolean
          contraindications: string[]
          created_at: string
          element: string | null
          evidence_level: string
          expected_outcome: string | null
          id: string
          indications: string[]
          modality: string
          name: string
          name_native: string | null
          protocol_steps: Json
          source_id: string
          updated_at: string
        }
        Insert: {
          artg_relevant?: boolean
          contraindications?: string[]
          created_at?: string
          element?: string | null
          evidence_level?: string
          expected_outcome?: string | null
          id?: string
          indications?: string[]
          modality: string
          name: string
          name_native?: string | null
          protocol_steps?: Json
          source_id: string
          updated_at?: string
        }
        Update: {
          artg_relevant?: boolean
          contraindications?: string[]
          created_at?: string
          element?: string | null
          evidence_level?: string
          expected_outcome?: string | null
          id?: string
          indications?: string[]
          modality?: string
          name?: string
          name_native?: string | null
          protocol_steps?: Json
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wisdom_protocols_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "wisdom_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      wisdom_sources: {
        Row: {
          authority_url: string | null
          bibliography: Json
          created_at: string
          id: string
          name: string
          notes: string | null
          practitioner_count: number | null
          tradition: string | null
          updated_at: string
        }
        Insert: {
          authority_url?: string | null
          bibliography?: Json
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          practitioner_count?: number | null
          tradition?: string | null
          updated_at?: string
        }
        Update: {
          authority_url?: string | null
          bibliography?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          practitioner_count?: number | null
          tradition?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "expert" | "admin"
      consult_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "escalated"
      message_role: "user" | "assistant" | "system"
      prescription_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "escalated"
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
      app_role: ["user", "expert", "admin"],
      consult_status: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "escalated",
      ],
      message_role: ["user", "assistant", "system"],
      prescription_status: [
        "pending_review",
        "approved",
        "rejected",
        "escalated",
      ],
    },
  },
} as const
