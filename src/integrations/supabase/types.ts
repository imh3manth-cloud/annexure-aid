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
      app_settings: {
        Row: {
          created_at: string | null
          group_by_bo: boolean | null
          id: string
          last_serial: number | null
          threshold: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_by_bo?: boolean | null
          id?: string
          last_serial?: number | null
          threshold?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_by_bo?: boolean | null
          id?: string
          last_serial?: number | null
          threshold?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      despatch_records: {
        Row: {
          created_at: string | null
          despatch_date: string
          from_memo: number
          id: string
          memo_count: number
          post_number: string
          to_memo: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          despatch_date: string
          from_memo: number
          id?: string
          memo_count: number
          post_number: string
          to_memo: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          despatch_date?: string
          from_memo?: number
          id?: string
          memo_count?: number
          post_number?: string
          to_memo?: number
          user_id?: string
        }
        Relationships: []
      }
      hfti_transactions: {
        Row: {
          account: string
          amount: number
          bo_reference: string | null
          debit_credit: string
          id: string
          particulars: string | null
          source_file: string | null
          txn_date: string
          txn_id: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          account: string
          amount: number
          bo_reference?: string | null
          debit_credit: string
          id?: string
          particulars?: string | null
          source_file?: string | null
          txn_date: string
          txn_id: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          account?: string
          amount?: number
          bo_reference?: string | null
          debit_credit?: string
          id?: string
          particulars?: string | null
          source_file?: string | null
          txn_date?: string
          txn_id?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      last_balance_records: {
        Row: {
          account: string
          address: string | null
          balance: number | null
          balance_date: string | null
          bo_name: string | null
          id: string
          name: string
          scheme_type: string | null
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          account: string
          address?: string | null
          balance?: number | null
          balance_date?: string | null
          bo_name?: string | null
          id?: string
          name: string
          scheme_type?: string | null
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          account?: string
          address?: string | null
          balance?: number | null
          balance_date?: string | null
          bo_name?: string | null
          id?: string
          name?: string
          scheme_type?: string | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memos: {
        Row: {
          account: string
          address: string | null
          amount: number
          balance: number | null
          balance_date: string | null
          bo_code: string | null
          bo_name: string | null
          created_at: string | null
          id: string
          last_reminder_date: string | null
          memo_key: string
          memo_sent_date: string | null
          name: string | null
          printed: boolean | null
          remarks: string | null
          reminder_count: number | null
          reported_date: string | null
          serial: number
          status: string
          txn_date: string
          txn_id: string
          user_id: string
          verified_date: string | null
        }
        Insert: {
          account: string
          address?: string | null
          amount: number
          balance?: number | null
          balance_date?: string | null
          bo_code?: string | null
          bo_name?: string | null
          created_at?: string | null
          id?: string
          last_reminder_date?: string | null
          memo_key: string
          memo_sent_date?: string | null
          name?: string | null
          printed?: boolean | null
          remarks?: string | null
          reminder_count?: number | null
          reported_date?: string | null
          serial: number
          status?: string
          txn_date: string
          txn_id: string
          user_id: string
          verified_date?: string | null
        }
        Update: {
          account?: string
          address?: string | null
          amount?: number
          balance?: number | null
          balance_date?: string | null
          bo_code?: string | null
          bo_name?: string | null
          created_at?: string | null
          id?: string
          last_reminder_date?: string | null
          memo_key?: string
          memo_sent_date?: string | null
          name?: string | null
          printed?: boolean | null
          remarks?: string | null
          reminder_count?: number | null
          reported_date?: string | null
          serial?: number
          status?: string
          txn_date?: string
          txn_id?: string
          user_id?: string
          verified_date?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
