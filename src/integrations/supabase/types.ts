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
      chat_conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string
          startup_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          startup_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          startup_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: string[]
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachments?: string[]
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachments?: string[]
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          message: string
          reporter_id: string
          startup_id: string
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message: string
          reporter_id: string
          startup_id: string
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message?: string
          reporter_id?: string
          startup_id?: string
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          startup_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          startup_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          startup_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          platform: string | null
          reminder_dispatched: boolean
          scheduled_at: string
          startup_id: string
          status: string
          stream_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          platform?: string | null
          reminder_dispatched?: boolean
          scheduled_at: string
          startup_id: string
          status?: string
          stream_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          platform?: string | null
          reminder_dispatched?: boolean
          scheduled_at?: string
          startup_id?: string
          status?: string
          stream_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_reminders: {
        Row: {
          created_at: string
          id: string
          live_event_id: string
          notified: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_event_id: string
          notified?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_event_id?: string
          notified?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reminders_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      product_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          product_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          product_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_likes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_views: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          availability: Database["public"]["Enums"]["product_availability"]
          category: string | null
          created_at: string
          currency: string
          delegation: string | null
          delivery_available: boolean
          delivery_fee: number | null
          description: string | null
          discount_percentage: number | null
          id: string
          images: string[]
          in_stock: boolean
          is_eco: boolean
          last_stock_check: string | null
          name: string
          price: number | null
          startup_id: string
          startup_slug: string | null
          updated_at: string
          video_url: string | null
          videos: string[]
        }
        Insert: {
          availability?: Database["public"]["Enums"]["product_availability"]
          category?: string | null
          created_at?: string
          currency?: string
          delegation?: string | null
          delivery_available?: boolean
          delivery_fee?: number | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          images?: string[]
          in_stock?: boolean
          is_eco?: boolean
          last_stock_check?: string | null
          name: string
          price?: number | null
          startup_id: string
          startup_slug?: string | null
          updated_at?: string
          video_url?: string | null
          videos?: string[]
        }
        Update: {
          availability?: Database["public"]["Enums"]["product_availability"]
          category?: string | null
          created_at?: string
          currency?: string
          delegation?: string | null
          delivery_available?: boolean
          delivery_fee?: number | null
          description?: string | null
          discount_percentage?: number | null
          id?: string
          images?: string[]
          in_stock?: boolean
          is_eco?: boolean
          last_stock_check?: string | null
          name?: string
          price?: number | null
          startup_id?: string
          startup_slug?: string | null
          updated_at?: string
          video_url?: string | null
          videos?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "products_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          must_change_password: boolean
          preferred_categories: string[] | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id: string
          must_change_password?: boolean
          preferred_categories?: string[] | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          must_change_password?: boolean
          preferred_categories?: string[] | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_clicks: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          startup_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          startup_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          startup_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_clicks_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_confirmations: {
        Row: {
          created_at: string
          id: string
          product_id: string
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          startup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          startup_id?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          photo_url: string | null
          product_id: string | null
          rating: number
          startup_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          product_id?: string | null
          rating: number
          startup_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          product_id?: string | null
          rating?: number
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_applications: {
        Row: {
          admin_notes: string | null
          applicant_id: string
          brand_name: string
          categories: string[]
          category: string
          city: string
          created_at: string
          creator_story: string | null
          description: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          proof_photos: string[]
          proof_video_url: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          tiktok_url: string | null
          whatsapp_number: string
        }
        Insert: {
          admin_notes?: string | null
          applicant_id: string
          brand_name: string
          categories?: string[]
          category: string
          city: string
          created_at?: string
          creator_story?: string | null
          description: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          proof_photos?: string[]
          proof_video_url?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tiktok_url?: string | null
          whatsapp_number: string
        }
        Update: {
          admin_notes?: string | null
          applicant_id?: string
          brand_name?: string
          categories?: string[]
          category?: string
          city?: string
          created_at?: string
          creator_story?: string | null
          description?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          proof_photos?: string[]
          proof_video_url?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tiktok_url?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
      startup_supporters: {
        Row: {
          created_at: string
          id: string
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          startup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          startup_id?: string
          user_id?: string
        }
        Relationships: []
      }
      startups: {
        Row: {
          badge: Database["public"]["Enums"]["startup_badge"]
          categories: string[]
          category: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          creator_story: string | null
          delegation: string | null
          description: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_live: boolean
          last_post_at: string | null
          likes_count: number
          live_started_at: string | null
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          status: Database["public"]["Enums"]["startup_status"]
          supporters_count: number
          tagline: string | null
          tiktok_url: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          badge?: Database["public"]["Enums"]["startup_badge"]
          categories?: string[]
          category?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          creator_story?: string | null
          delegation?: string | null
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_live?: boolean
          last_post_at?: string | null
          likes_count?: number
          live_started_at?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          status?: Database["public"]["Enums"]["startup_status"]
          supporters_count?: number
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          badge?: Database["public"]["Enums"]["startup_badge"]
          categories?: string[]
          category?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          creator_story?: string | null
          delegation?: string | null
          description?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_live?: boolean
          last_post_at?: string | null
          likes_count?: number
          live_started_at?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["startup_status"]
          supporters_count?: number
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      stories: {
        Row: {
          background: string | null
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string | null
          startup_id: string
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type: string
          media_url?: string | null
          startup_id: string
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
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
      get_platform_stats: { Args: never; Returns: Json }
      get_product_stats: { Args: { _product_id: string }; Returns: Json }
      get_startup_stats: { Args: { _startup_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "startup" | "client"
      application_status: "pending" | "approved" | "rejected"
      complaint_status: "pending" | "reviewing" | "resolved" | "rejected"
      product_availability: "in_stock" | "arriving" | "out_of_stock"
      startup_badge: "new" | "verified" | "certified"
      startup_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "startup", "client"],
      application_status: ["pending", "approved", "rejected"],
      complaint_status: ["pending", "reviewing", "resolved", "rejected"],
      product_availability: ["in_stock", "arriving", "out_of_stock"],
      startup_badge: ["new", "verified", "certified"],
      startup_status: ["pending", "approved", "rejected"],
    },
  },
} as const
