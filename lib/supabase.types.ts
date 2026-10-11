// Maintained against supabase/migrations/001_initial.sql.
// Regenerate with supabase gen types typescript when a local database is available.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          avatar_url: string | null;
          role: 'user' | 'artist';
          city: string | null;
          style_prefs: string[] | null;
          onboarding_completed: boolean | null;
          trust_score: number | null;
          is_banned: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          display_name: string;
          email: string;
          avatar_url?: string | null;
          role?: 'user' | 'artist';
          city?: string | null;
          style_prefs?: string[] | null;
          onboarding_completed?: boolean | null;
          trust_score?: number | null;
          is_banned?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [
        ];
      };
      artists: {
        Row: {
          id: string;
          profile_id: string;
          blaze: string;
          city: string;
          bio: string | null;
          cover_url: string | null;
          avatar_url: string | null;
          styles: string[] | null;
          specialties: string[] | null;
          booking_status: 'open' | 'paused' | 'closed';
          min_budget: number | null;
          tier: 'normal' | 'premium';
          is_verified: boolean | null;
          exclusions: string[] | null;
          rules: string | null;
          process: string | null;
          visual_preset: string | null;
          show_availability: boolean | null;
          show_stats: boolean | null;
          show_min_budget: boolean | null;
          sections_config: Json | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_subscription_status: string | null;
          stat_posts: number | null;
          stat_profile_views: number | null;
          stat_requests_month: number | null;
          verification_status: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
          verification_submitted_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          blaze: string;
          city: string;
          bio?: string | null;
          cover_url?: string | null;
          avatar_url?: string | null;
          styles?: string[] | null;
          specialties?: string[] | null;
          booking_status?: 'open' | 'paused' | 'closed';
          min_budget?: number | null;
          tier?: 'normal' | 'premium';
          is_verified?: boolean | null;
          exclusions?: string[] | null;
          rules?: string | null;
          process?: string | null;
          visual_preset?: string | null;
          show_availability?: boolean | null;
          show_stats?: boolean | null;
          show_min_budget?: boolean | null;
          sections_config?: Json | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_status?: string | null;
          stat_posts?: number | null;
          stat_profile_views?: number | null;
          stat_requests_month?: number | null;
          verification_status?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
          verification_submitted_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['artists']['Row']>;
        Relationships: [
          { foreignKeyName: 'artists_profile_id_fkey'; columns: ['profile_id']; isOneToOne: true; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      artist_faq: {
        Row: {
          id: string;
          artist_id: string;
          question: string;
          answer: string;
          position: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          artist_id: string;
          question: string;
          answer: string;
          position?: number;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['artist_faq']['Row']>;
        Relationships: [
          { foreignKeyName: 'artist_faq_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      posts: {
        Row: {
          id: string;
          artist_id: string;
          media_url: string;
          media_type: 'photo' | 'video';
          caption: string | null;
          styles: string[] | null;
          likes_count: number | null;
          views_count: number | null;
          is_published: boolean | null;
          published_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          artist_id: string;
          media_url: string;
          media_type?: 'photo' | 'video';
          caption?: string | null;
          styles?: string[] | null;
          likes_count?: number | null;
          views_count?: number | null;
          is_published?: boolean | null;
          published_at?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['posts']['Row']>;
        Relationships: [
          { foreignKeyName: 'posts_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      post_likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string | null;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['post_likes']['Row']>;
        Relationships: [
          { foreignKeyName: 'post_likes_post_id_fkey'; columns: ['post_id']; isOneToOne: false; referencedRelation: 'posts'; referencedColumns: ['id'] },
          { foreignKeyName: 'post_likes_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      saved_artists: {
        Row: {
          user_id: string;
          artist_id: string;
          created_at: string | null;
        };
        Insert: {
          user_id: string;
          artist_id: string;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['saved_artists']['Row']>;
        Relationships: [
          { foreignKeyName: 'saved_artists_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'saved_artists_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      saved_posts: {
        Row: {
          user_id: string;
          post_id: string;
          created_at: string | null;
        };
        Insert: {
          user_id: string;
          post_id: string;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['saved_posts']['Row']>;
        Relationships: [
          { foreignKeyName: 'saved_posts_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'saved_posts_post_id_fkey'; columns: ['post_id']; isOneToOne: false; referencedRelation: 'posts'; referencedColumns: ['id'] },
        ];
      };
      tattoo_requests: {
        Row: {
          id: string;
          client_id: string | null;
          artist_id: string;
          project_type: 'new' | 'cover_up' | 'touch_up' | 'extension';
          body_zone: string;
          size_category: 'xs' | 's' | 'm' | 'l' | 'xl';
          budget_min: number | null;
          budget_max: number | null;
          budget_unknown: boolean | null;
          color_preference: 'black_grey' | 'color' | 'artist_choice';
          style_preference: string | null;
          description: string;
          flexibility_level: 'precise' | 'open' | 'full_trust';
          is_first_tattoo: boolean | null;
          status: 'submitted' | 'accepted' | 'declined' | 'clarification_needed' | 'confirmed' | 'completed' | 'archived';
          decline_reason: string | null;
          artist_notes: string | null;
          submitted_at: string | null;
          accepted_at: string | null;
          confirmed_at: string | null;
          completed_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          artist_id: string;
          project_type: 'new' | 'cover_up' | 'touch_up' | 'extension';
          body_zone: string;
          size_category: 'xs' | 's' | 'm' | 'l' | 'xl';
          budget_min?: number | null;
          budget_max?: number | null;
          budget_unknown?: boolean | null;
          color_preference: 'black_grey' | 'color' | 'artist_choice';
          style_preference?: string | null;
          description: string;
          flexibility_level: 'precise' | 'open' | 'full_trust';
          is_first_tattoo?: boolean | null;
          status?: 'submitted' | 'accepted' | 'declined' | 'clarification_needed' | 'confirmed' | 'completed' | 'archived';
          decline_reason?: string | null;
          artist_notes?: string | null;
          submitted_at?: string | null;
          accepted_at?: string | null;
          confirmed_at?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tattoo_requests']['Row']>;
        Relationships: [
          { foreignKeyName: 'tattoo_requests_client_id_fkey'; columns: ['client_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'tattoo_requests_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      request_references: {
        Row: {
          id: string;
          request_id: string;
          url: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          url: string;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['request_references']['Row']>;
        Relationships: [
          { foreignKeyName: 'request_references_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'tattoo_requests'; referencedColumns: ['id'] },
        ];
      };
      messages: {
        Row: {
          id: string;
          request_id: string;
          sender_id: string | null;
          content: string;
          message_type: 'text' | 'system' | 'slot_proposal' | 'appointment_confirmed' | 'image';
          metadata: Json | null;
          is_read: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          sender_id?: string | null;
          content: string;
          message_type?: 'text' | 'system' | 'slot_proposal' | 'appointment_confirmed' | 'image';
          metadata?: Json | null;
          is_read?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
        Relationships: [
          { foreignKeyName: 'messages_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'tattoo_requests'; referencedColumns: ['id'] },
          { foreignKeyName: 'messages_sender_id_fkey'; columns: ['sender_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      appointments: {
        Row: {
          id: string;
          request_id: string;
          artist_id: string | null;
          client_id: string | null;
          starts_at: string;
          ends_at: string;
          status: 'proposed' | 'confirmed' | 'completed' | 'canceled';
          body_zone: string | null;
          notes: string | null;
          deposit_paid: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          artist_id?: string | null;
          client_id?: string | null;
          starts_at: string;
          ends_at: string;
          status?: 'proposed' | 'confirmed' | 'completed' | 'canceled';
          body_zone?: string | null;
          notes?: string | null;
          deposit_paid?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['appointments']['Row']>;
        Relationships: [
          { foreignKeyName: 'appointments_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'tattoo_requests'; referencedColumns: ['id'] },
          { foreignKeyName: 'appointments_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
          { foreignKeyName: 'appointments_client_id_fkey'; columns: ['client_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      artist_availability: {
        Row: {
          id: string;
          artist_id: string;
          starts_at: string;
          ends_at: string;
          is_blocked: boolean | null;
          label: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          artist_id: string;
          starts_at: string;
          ends_at: string;
          is_blocked?: boolean | null;
          label?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['artist_availability']['Row']>;
        Relationships: [
          { foreignKeyName: 'artist_availability_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      reviews: {
        Row: {
          id: string;
          appointment_id: string;
          artist_id: string;
          client_id: string;
          rating: number;
          comment: string | null;
          is_public: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          artist_id: string;
          client_id: string;
          rating: number;
          comment?: string | null;
          is_public?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['reviews']['Row']>;
        Relationships: [
          { foreignKeyName: 'reviews_appointment_id_fkey'; columns: ['appointment_id']; isOneToOne: true; referencedRelation: 'appointments'; referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_client_id_fkey'; columns: ['client_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          data: Json | null;
          is_read: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          data?: Json | null;
          is_read?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [
          { foreignKeyName: 'notifications_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform?: 'ios' | 'android' | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['push_tokens']['Row']>;
        Relationships: [
          { foreignKeyName: 'push_tokens_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: 'post' | 'artist' | 'message' | 'review';
          target_id: string;
          reason: 'spam' | 'inappropriate' | 'fake' | 'harassment' | 'other';
          description: string | null;
          status: 'pending' | 'reviewed' | 'dismissed' | 'actioned' | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: 'post' | 'artist' | 'message' | 'review';
          target_id: string;
          reason: 'spam' | 'inappropriate' | 'fake' | 'harassment' | 'other';
          description?: string | null;
          status?: 'pending' | 'reviewed' | 'dismissed' | 'actioned' | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['reports']['Row']>;
        Relationships: [
          { foreignKeyName: 'reports_reporter_id_fkey'; columns: ['reporter_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      artist_analytics_events: {
        Row: {
          id: string;
          artist_id: string;
          event_type: 'profile_view' | 'post_view' | 'request_sent';
          source_user: string | null;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          artist_id: string;
          event_type: 'profile_view' | 'post_view' | 'request_sent';
          source_user?: string | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['artist_analytics_events']['Row']>;
        Relationships: [
          { foreignKeyName: 'artist_analytics_events_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
          { foreignKeyName: 'artist_analytics_events_source_user_fkey'; columns: ['source_user']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          artist_id: string;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          tier: 'normal' | 'premium' | null;
          status: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          artist_id: string;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          tier?: 'normal' | 'premium' | null;
          status?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Relationships: [
          { foreignKeyName: 'subscriptions_artist_id_fkey'; columns: ['artist_id']; isOneToOne: true; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      propose_appointment: {
        Args: { p_request_id: string; p_starts_at: string; p_ends_at: string; p_notes?: string | null };
        Returns: Database['public']['Tables']['appointments']['Row'];
      };
      respond_to_appointment: {
        Args: { p_appointment_id: string; p_accept: boolean };
        Returns: Database['public']['Tables']['appointments']['Row'];
      };
      complete_appointment: {
        Args: { p_appointment_id: string };
        Returns: Database['public']['Tables']['appointments']['Row'];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
