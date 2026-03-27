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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      custom_albums: {
        Row: {
          artist: string
          cover_url: string | null
          created_at: string
          id: string
          title: string
          user_id: string
          year: number | null
        }
        Insert: {
          artist: string
          cover_url?: string | null
          created_at?: string
          id?: string
          title: string
          user_id: string
          year?: number | null
        }
        Update: {
          artist?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          title?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      custom_radio_stations: {
        Row: {
          cover_url: string | null
          created_at: string
          genre: string | null
          id: string
          name: string
          stream_url: string | null
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          name: string
          stream_url?: string | null
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          name?: string
          stream_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      custom_songs: {
        Row: {
          album: string | null
          artist: string
          cover_url: string | null
          created_at: string
          duration: number
          id: string
          stream_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          album?: string | null
          artist: string
          cover_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          stream_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          album?: string | null
          artist?: string
          cover_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          stream_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      home_config: {
        Row: {
          id: string
          sections: Json
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          sections?: Json
          updated_at?: string
          updated_by: string
        }
        Update: {
          id?: string
          sections?: Json
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      liked_songs: {
        Row: {
          album: string | null
          artist: string
          cover_url: string | null
          created_at: string
          duration: number
          id: string
          song_id: string
          stream_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          album?: string | null
          artist: string
          cover_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          song_id: string
          stream_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          album?: string | null
          artist?: string
          cover_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          song_id?: string
          stream_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      playlist_songs: {
        Row: {
          album: string | null
          artist: string
          cover_url: string | null
          created_at: string
          duration: number
          id: string
          playlist_id: string
          position: number
          song_id: string
          stream_url: string | null
          title: string
        }
        Insert: {
          album?: string | null
          artist: string
          cover_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          playlist_id: string
          position?: number
          song_id: string
          stream_url?: string | null
          title: string
        }
        Update: {
          album?: string | null
          artist?: string
          cover_url?: string | null
          created_at?: string
          duration?: number
          id?: string
          playlist_id?: string
          position?: number
          song_id?: string
          stream_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recently_played: {
        Row: {
          album: string | null
          artist: string
          cover_url: string | null
          duration: number
          id: string
          played_at: string
          song_id: string
          stream_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          album?: string | null
          artist: string
          cover_url?: string | null
          duration?: number
          id?: string
          played_at?: string
          song_id: string
          stream_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          album?: string | null
          artist?: string
          cover_url?: string | null
          duration?: number
          id?: string
          played_at?: string
          song_id?: string
          stream_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      resolve_logs: {
        Row: {
          artist_corrected: boolean
          created_at: string
          id: string
          original_artist: string
          original_title: string
          resolved_artist: string | null
          resolved_title: string | null
          song_id: string
          source: string
          stream_url: string
          title_corrected: boolean
        }
        Insert: {
          artist_corrected?: boolean
          created_at?: string
          id?: string
          original_artist: string
          original_title: string
          resolved_artist?: string | null
          resolved_title?: string | null
          song_id: string
          source?: string
          stream_url?: string
          title_corrected?: boolean
        }
        Update: {
          artist_corrected?: boolean
          created_at?: string
          id?: string
          original_artist?: string
          original_title?: string
          resolved_artist?: string | null
          resolved_title?: string | null
          song_id?: string
          source?: string
          stream_url?: string
          title_corrected?: boolean
        }
        Relationships: []
      }
      search_history: {
        Row: {
          id: string
          query: string
          searched_at: string
          user_id: string
        }
        Insert: {
          id?: string
          query: string
          searched_at?: string
          user_id: string
        }
        Update: {
          id?: string
          query?: string
          searched_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          session_date: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          session_date?: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          session_date?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      owns_playlist: {
        Args: { _playlist_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
