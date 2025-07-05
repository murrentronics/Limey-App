export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
        Relationships: [
          {
            foreignKeyName: "comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "gift_transactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
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
        Relationships: [
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          category: string | null
          comment_count: number | null
          created_at: string
          description: string | null
          duration: number | null
          id: string
          is_featured: boolean | null
          is_trending: boolean | null
          like_count: number | null
          share_count: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string
          view_count: number | null
        }
        Insert: {
          category?: string | null
          comment_count?: number | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_featured?: boolean | null
          is_trending?: boolean | null
          like_count?: number | null
          share_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url: string
          view_count?: number | null
        }
        Update: {
          category?: string | null
          comment_count?: number | null
          created_at?: string
          description?: string | null
          duration?: number | null
          id?: string
          is_featured?: boolean | null
          is_trending?: boolean | null
          like_count?: number | null
          share_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
