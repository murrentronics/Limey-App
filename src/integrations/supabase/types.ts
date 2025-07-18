export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ad_views: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_views_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ad_description: string | null
          ad_image_url: string | null
          ad_title: string
          ad_video_url: string | null
          budget: number
          business_name: string
          cost_per_view: number
          created_at: string
          end_date: string
          id: string
          is_active: boolean | null
          start_date: string
          target_audience: string | null
          total_views: number | null
        }
        Insert: {
          ad_description?: string | null
          ad_image_url?: string | null
          ad_title: string
          ad_video_url?: string | null
          budget: number
          business_name: string
          cost_per_view: number
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean | null
          start_date: string
          target_audience?: string | null
          total_views?: number | null
        }
        Update: {
          ad_description?: string | null
          ad_image_url?: string | null
          ad_title?: string
          ad_video_url?: string | null
          budget?: number
          business_name?: string
          cost_per_view?: number
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
          target_audience?: string | null
          total_views?: number | null
        }
        Relationships: []
      }
      chat_deletions: {
        Row: {
          chat_id: string
          deleted_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          deleted_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          deleted_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_deletions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_deletions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          deleted_for_receiver: boolean | null
          deleted_for_sender: boolean | null
          id: string
          last_message: string | null
          receiver_id: string
          sender_id: string
          typing_receiver: boolean | null
          typing_sender: boolean | null
          unread_count_receiver: number | null
          unread_count_sender: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          id?: string
          last_message?: string | null
          receiver_id: string
          sender_id: string
          typing_receiver?: boolean | null
          typing_sender?: boolean | null
          unread_count_receiver?: number | null
          unread_count_sender?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          id?: string
          last_message?: string | null
          receiver_id?: string
          sender_id?: string
          typing_receiver?: boolean | null
          typing_sender?: boolean | null
          unread_count_receiver?: number | null
          unread_count_sender?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chats_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          created_at: string
          gift_id: string
          id: string
          quantity: number | null
          receiver_id: string
          sender_id: string
          total_amount: number
          video_id: string | null
        }
        Insert: {
          created_at?: string
          gift_id: string
          id?: string
          quantity?: number | null
          receiver_id: string
          sender_id: string
          total_amount: number
          video_id?: string | null
        }
        Update: {
          created_at?: string
          gift_id?: string
          id?: string
          quantity?: number | null
          receiver_id?: string
          sender_id?: string
          total_amount?: number
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string
          id: string
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url: string
          id?: string
          is_active?: boolean | null
          name: string
          price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          stream_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          stream_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          stream_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string
          created_at: string
          deleted_for_everyone: boolean | null
          deleted_for_receiver: boolean | null
          deleted_for_sender: boolean | null
          id: string
          is_read: boolean | null
          receiver_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          chat_id?: string | null
          content: string
          created_at?: string
          deleted_for_everyone?: boolean | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          id?: string
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          chat_id?: string | null
          content?: string
          created_at?: string
          deleted_for_everyone?: boolean | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          notification_type: string
          reference_id: string | null
          reference_type: string | null
          sender_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          notification_type: string
          reference_id?: string | null
          reference_type?: string | null
          sender_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          notification_type?: string
          reference_id?: string | null
          reference_type?: string | null
          sender_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          delete_at: string | null
          display_name: string | null
          follower_count: number | null
          following_count: number | null
          id: string
          is_creator: boolean | null
          is_verified: boolean | null
          likes_received: number | null
          location: string | null
          trini_credits: number | null
          updated_at: string
          user_id: string
          username: string
          video_count: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          delete_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          id?: string
          is_creator?: boolean | null
          is_verified?: boolean | null
          likes_received?: number | null
          location?: string | null
          trini_credits?: number | null
          updated_at?: string
          user_id: string
          username: string
          video_count?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          delete_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          id?: string
          is_creator?: boolean | null
          is_verified?: boolean | null
          likes_received?: number | null
          location?: string | null
          trini_credits?: number | null
          updated_at?: string
          user_id?: string
          username?: string
          video_count?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          status: string | null
          transaction_type: string
          ttpaypal_transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string | null
          transaction_type: string
          ttpaypal_transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string | null
          transaction_type?: string
          ttpaypal_transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          account_settings: Json | null
          content_preferences: Json | null
          created_at: string
          id: string
          language: string | null
          notification_settings: Json | null
          privacy_settings: Json | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_settings?: Json | null
          content_preferences?: Json | null
          created_at?: string
          id?: string
          language?: string | null
          notification_settings?: Json | null
          privacy_settings?: Json | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_settings?: Json | null
          content_preferences?: Json | null
          created_at?: string
          id?: string
          language?: string | null
          notification_settings?: Json | null
          privacy_settings?: Json | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      video_views: {
        Row: {
          creator_id: string
          id: string
          video_id: string
          viewed_at: string | null
          viewer_id: string
        }
        Insert: {
          creator_id: string
          id?: string
          video_id: string
          viewed_at?: string | null
          viewer_id: string
        }
        Update: {
          creator_id?: string
          id?: string
          video_id?: string
          viewed_at?: string | null
          viewer_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          avatar_url: string | null
          category: string | null
          comment_count: number | null
          created_at: string | null
          description: string | null
          duration: number | null
          id: string
          like_count: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
          username: string | null
          video_url: string
          view_count: number | null
        }
        Insert: {
          avatar_url?: string | null
          category?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          like_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          username?: string | null
          video_url: string
          view_count?: number | null
        }
        Update: {
          avatar_url?: string | null
          category?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          like_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          username?: string | null
          video_url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_active_users: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      decrement_comment_count: {
        Args: { video_id_input: string }
        Returns: undefined
      }
      decrement_like_count: {
        Args: { video_id_input: string }
        Returns: undefined
      }
      fix_existing_usernames: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_video_search_vector: {
        Args: { p_title: string; p_description: string; p_tags: string[] }
        Returns: unknown
      }
      get_all_posts: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: number
          title: string
          content: string
        }[]
      }
      get_genuine_view_count: {
        Args: { video_uuid: string }
        Returns: number
      }
      get_trending_videos: {
        Args:
          | { limit_count?: number }
          | { p_limit?: number; p_timeframe?: string }
        Returns: {
          video_id: string
          title: string
          thumbnail_url: string
          username: string
          user_avatar: string
          view_count: number
          like_count: number
          comment_count: number
          created_at: string
          trending_score: number
        }[]
      }
      get_user_feed: {
        Args: {
          p_user_id: string
          p_limit?: number
          p_offset?: number
          p_include_following_only?: boolean
        }
        Returns: {
          video_id: string
          title: string
          thumbnail_url: string
          video_url: string
          duration: number
          view_count: number
          like_count: number
          comment_count: number
          creator_id: string
          username: string
          avatar_url: string
          created_at: string
          is_following: boolean
          has_liked: boolean
          feed_score: number
        }[]
      }
      get_user_profile: {
        Args: { user_id: number }
        Returns: {
          id: number
          username: string
          email: string
        }[]
      }
      get_video_stats: {
        Args: { p_video_id: string }
        Returns: {
          video_id: string
          title: string
          view_count: number
          like_count: number
          comment_count: number
          share_count: number
          engagement_rate: number
          creator_name: string
          creator_id: string
          created_at: string
          recent_comments: Json
        }[]
      }
      increment_comment_count: {
        Args: { video_id_input: string }
        Returns: undefined
      }
      increment_like_count: {
        Args: { video_id_input: string }
        Returns: undefined
      }
      increment_video_count: {
        Args: { user_id: string }
        Returns: undefined
      }
      increment_video_view: {
        Args: { video_id_param: string }
        Returns: undefined
      }
      mark_chat_as_read: {
        Args: { chat_uuid: string; user_uuid: string }
        Returns: undefined
      }
      record_video_view: {
        Args: { video_uuid: string }
        Returns: undefined
      }
      search_posts: {
        Args: { keyword: string }
        Returns: {
          id: number
          title: string
          content: string
        }[]
      }
      search_videos: {
        Args: {
          p_query: string
          p_limit?: number
          p_offset?: number
          p_category?: string
          p_min_duration?: number
          p_max_duration?: number
        }
        Returns: {
          video_id: string
          title: string
          description: string
          thumbnail_url: string
          duration: number
          view_count: number
          like_count: number
          username: string
          user_avatar: string
          created_at: string
          search_rank: number
        }[]
      }
      soft_delete_chat: {
        Args: { chat_uuid: string; user_uuid: string }
        Returns: undefined
      }
      update_profile: {
        Args:
          | {
              p_user_id: string
              p_username?: string
              p_display_name?: string
              p_bio?: string
              p_avatar_url?: string
              p_location?: string
            }
          | {
              user_id_input: string
              username_input: string
              display_name_input: string
              bio_input: string
              avatar_url_input: string
            }
        Returns: undefined
      }
      update_user_profile: {
        Args: { user_id: number; new_username: string; new_email: string }
        Returns: undefined
      }
      validate_username: {
        Args: { username: string }
        Returns: boolean
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
