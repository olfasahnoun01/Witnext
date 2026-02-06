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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          created_at: string
          id: number
          location: string | null
          matricule_fiscale: string | null
          nom: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_date: string
          doc_number: string
          id: number
          items: Json
          third_party_address: string | null
          third_party_name: string | null
          third_party_tax_id: string | null
          total_amount: number | null
          transport_ref: string | null
          type: string
          updated_at: string
          validity: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number: string
          id?: number
          items?: Json
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          transport_ref?: string | null
          type: string
          updated_at?: string
          validity?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number?: string
          id?: number
          items?: Json
          third_party_address?: string | null
          third_party_name?: string | null
          third_party_tax_id?: string | null
          total_amount?: number | null
          transport_ref?: string | null
          type?: string
          updated_at?: string
          validity?: string | null
        }
        Relationships: []
      }
      fournisseurs: {
        Row: {
          created_at: string
          id: number
          location: string | null
          matricule_fiscale: string | null
          nom: string
          phone: string | null
          specialite: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom: string
          phone?: string | null
          specialite: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          location?: string | null
          matricule_fiscale?: string | null
          nom?: string
          phone?: string | null
          specialite?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          client_description: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          id: number
          items: Json
          status: string
          total_amount: number
        }
        Insert: {
          client_description?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          id?: number
          items: Json
          status?: string
          total_amount?: number
        }
        Update: {
          client_description?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          id?: number
          items?: Json
          status?: string
          total_amount?: number
        }
        Relationships: []
      }
      product_group_fournisseurs: {
        Row: {
          created_at: string
          fournisseur_name: string
          id: number
          prix_ttc: number
          product_group_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fournisseur_name: string
          id?: number
          prix_ttc?: number
          product_group_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fournisseur_name?: string
          id?: number
          prix_ttc?: number
          product_group_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_group_fournisseurs_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          base_sku: string | null
          category: string
          created_at: string
          fournisseur: string | null
          id: number
          image: string | null
          min_stock: number
          name: string
          updated_at: string
        }
        Insert: {
          base_sku?: string | null
          category: string
          created_at?: string
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name: string
          updated_at?: string
        }
        Update: {
          base_sku?: string | null
          category?: string
          created_at?: string
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          color: string | null
          created_at: string
          fournisseur: string | null
          id: number
          image: string | null
          min_stock: number
          name: string
          price: number
          prix_ttc: number | null
          product_group_id: number | null
          quantity: number
          remise: number | null
          size: string | null
          sku: string
          updated_at: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name: string
          price?: number
          prix_ttc?: number | null
          product_group_id?: number | null
          quantity?: number
          remise?: number | null
          size?: string | null
          sku: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          fournisseur?: string | null
          id?: number
          image?: string | null
          min_stock?: number
          name?: string
          price?: number
          prix_ttc?: number | null
          product_group_id?: number | null
          quantity?: number
          remise?: number | null
          size?: string | null
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_email: string
          user_id: string
          user_role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_email: string
          user_id: string
          user_role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_email?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          date: string
          id: number
          note: string | null
          product_id: number
          product_name: string
          quantity: number
          type: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: number
          note?: string | null
          product_id: number
          product_name: string
          quantity: number
          type: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          note?: string | null
          product_id?: number
          product_name?: string
          quantity?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          email: string | null
          id: string
          is_online: boolean
          last_seen: string
          role: string | null
          user_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string
          role?: string | null
          user_id: string
        }
        Update: {
          email?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string
          role?: string | null
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
