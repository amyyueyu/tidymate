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
      badges: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          points_required: number | null
          rooms_required: number | null
          streak_required: number | null
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          points_required?: number | null
          rooms_required?: number | null
          streak_required?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          points_required?: number | null
          rooms_required?: number | null
          streak_required?: number | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          points: number
          room_id: string
          sort_order: number
          status: string
          time_estimate_minutes: number
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          room_id: string
          sort_order?: number
          status?: string
          time_estimate_minutes?: number
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          room_id?: string
          sort_order?: number
          status?: string
          time_estimate_minutes?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_level: number
          current_streak: number
          display_name: string | null
          id: string
          last_activity_date: string | null
          longest_streak: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          current_streak?: number
          display_name?: string | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_level?: number
          current_streak?: number
          display_name?: string | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          call_count: number
          created_at: string
          id: string
          key: string
          window_start: string
        }
        Insert: {
          call_count?: number
          created_at?: string
          id?: string
          key: string
          window_start?: string
        }
        Update: {
          call_count?: number
          created_at?: string
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          after_image_url: string | null
          before_image_url: string
          completed_at: string | null
          completed_challenges: number
          created_at: string
          id: string
          intent: string
          name: string
          status: string
          total_challenges: number
          user_id: string
        }
        Insert: {
          after_image_url?: string | null
          before_image_url: string
          completed_at?: string | null
          completed_challenges?: number
          created_at?: string
          id?: string
          intent: string
          name?: string
          status?: string
          total_challenges?: number
          user_id: string
        }
        Update: {
          after_image_url?: string | null
          before_image_url?: string
          completed_at?: string | null
          completed_challenges?: number
          created_at?: string
          id?: string
          intent?: string
          name?: string
          status?: string
          total_challenges?: number
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_rate_limit: {
        Args: { p_key: string; p_max_calls: number; p_window_seconds: number }
        Returns: boolean
      }
      complete_challenge_add_points: {
        Args: { p_challenge_id: string }
        Returns: undefined
      }
      get_daily_activity: { Args: { p_days?: number }; Returns: Json }
      get_platform_stats: { Args: never; Returns: Json }
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
