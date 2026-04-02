// Auto-generated Supabase types — run `supabase gen types typescript` to update
// Placeholder definitions that match our schema

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
          style_prefs: string[];
          onboarding_completed: boolean;
          trust_score: number;
          is_banned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string;
          display_name: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
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
          styles: string[];
          specialties: string[];
          booking_status: 'open' | 'paused' | 'closed';
          min_budget: number;
          tier: 'normal' | 'premium';
          is_verified: boolean;
          exclusions: string[];
          rules: string | null;
          process: string | null;
          visual_preset: string;
          show_availability: boolean;
          show_stats: boolean;
          show_min_budget: boolean;
          sections_config: Json;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_subscription_status: string | null;
          stat_posts: number;
          stat_profile_views: number;
          stat_requests_month: number;
          verification_status: 'pending' | 'submitted' | 'approved' | 'rejected';
          verification_submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['artists']['Row']> & {
          profile_id: string;
          blaze: string;
          city: string;
        };
        Update: Partial<Database['public']['Tables']['artists']['Row']>;
      };
      posts: {
        Row: {
          id: string;
          artist_id: string;
          media_url: string;
          media_type: 'photo' | 'video';
          caption: string | null;
          styles: string[];
          likes_count: number;
          views_count: number;
          is_published: boolean;
          published_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['posts']['Row']> & {
          artist_id: string;
          media_url: string;
        };
        Update: Partial<Database['public']['Tables']['posts']['Row']>;
      };
      post_likes: {
        Row: { post_id: string; user_id: string; created_at: string };
        Insert: { post_id: string; user_id: string };
        Update: never;
      };
      saved_artists: {
        Row: { user_id: string; artist_id: string; created_at: string };
        Insert: { user_id: string; artist_id: string };
        Update: never;
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
          budget_unknown: boolean;
          color_preference: 'black_grey' | 'color' | 'artist_choice';
          style_preference: string | null;
          description: string;
          flexibility_level: 'precise' | 'open' | 'full_trust';
          is_first_tattoo: boolean;
          status: 'submitted' | 'accepted' | 'declined' | 'clarification_needed' | 'confirmed' | 'completed' | 'archived';
          decline_reason: string | null;
          artist_notes: string | null;
          submitted_at: string;
          accepted_at: string | null;
          confirmed_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tattoo_requests']['Row']> & {
          artist_id: string;
          project_type: 'new' | 'cover_up' | 'touch_up' | 'extension';
          body_zone: string;
          size_category: 'xs' | 's' | 'm' | 'l' | 'xl';
          color_preference: 'black_grey' | 'color' | 'artist_choice';
          description: string;
          flexibility_level: 'precise' | 'open' | 'full_trust';
        };
        Update: Partial<Database['public']['Tables']['tattoo_requests']['Row']>;
      };
      messages: {
        Row: {
          id: string;
          request_id: string;
          sender_id: string | null;
          content: string;
          message_type: 'text' | 'system' | 'slot_proposal' | 'appointment_confirmed' | 'image';
          metadata: Json | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['messages']['Row']> & {
          request_id: string;
          content: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Row']>;
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
          deposit_paid: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['appointments']['Row']> & {
          request_id: string;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<Database['public']['Tables']['appointments']['Row']>;
      };
      reviews: {
        Row: {
          id: string;
          appointment_id: string;
          artist_id: string;
          client_id: string;
          rating: number;
          comment: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['reviews']['Row']> & {
          appointment_id: string;
          artist_id: string;
          client_id: string;
          rating: number;
        };
        Update: Partial<Database['public']['Tables']['reviews']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          data: Json | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & {
          user_id: string;
          type: string;
          title: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      push_tokens: {
        Row: { id: string; user_id: string; token: string; platform: string | null; created_at: string; updated_at: string };
        Insert: { user_id: string; token: string; platform?: string };
        Update: Partial<Database['public']['Tables']['push_tokens']['Row']>;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: 'post' | 'artist' | 'message' | 'review';
          target_id: string;
          reason: 'spam' | 'inappropriate' | 'fake' | 'harassment' | 'other';
          description: string | null;
          status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reports']['Row'], 'id' | 'status' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['reports']['Row']>;
      };
      artist_faq: {
        Row: { id: string; artist_id: string; question: string; answer: string; position: number; created_at: string };
        Insert: Omit<Database['public']['Tables']['artist_faq']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['artist_faq']['Row']>;
      };
      artist_analytics_events: {
        Row: { id: string; artist_id: string; event_type: 'profile_view' | 'post_view' | 'request_sent'; source_user: string | null; metadata: Json | null; created_at: string };
        Insert: Omit<Database['public']['Tables']['artist_analytics_events']['Row'], 'id' | 'created_at'>;
        Update: never;
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
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']> & { artist_id: string };
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
      };
      request_references: {
        Row: { id: string; request_id: string; url: string; created_at: string };
        Insert: { request_id: string; url: string };
        Update: never;
      };
      artist_availability: {
        Row: { id: string; artist_id: string; starts_at: string; ends_at: string; is_blocked: boolean; label: string | null; created_at: string };
        Insert: Omit<Database['public']['Tables']['artist_availability']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['artist_availability']['Row']>;
      };
    };
    Enums: Record<string, never>;
    Functions: Record<string, never>;
  };
}
