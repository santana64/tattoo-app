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
          timezone: string;
          session_durations: number[];
          cancel_notice_hours: number;
          latitude: number | null;
          longitude: number | null;
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
      artist_weekly_schedule: {
        Row: {
          id: string;
          artist_id: string;
          day_of_week: number;
          opens_at: string;
          closes_at: string;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: { id?: string; artist_id: string; day_of_week: number; opens_at?: string; closes_at?: string; is_active?: boolean };
        Update: Partial<Database['public']['Tables']['artist_weekly_schedule']['Row']>;
        Relationships: [
          { foreignKeyName: 'artist_weekly_schedule_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      artist_follows: {
        Row: { follower_id: string; artist_id: string; created_at: string };
        Insert: { follower_id: string; artist_id: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['artist_follows']['Row']>;
        Relationships: [
          { foreignKeyName: 'artist_follows_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
          { foreignKeyName: 'artist_follows_follower_id_fkey'; columns: ['follower_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      artist_waitlist: {
        Row: {
          id: string;
          artist_id: string;
          user_id: string;
          status: 'active' | 'notified' | 'cancelled';
          created_at: string;
          notified_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: 'artist_waitlist_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      flash_designs: {
        Row: {
          id: string;
          artist_id: string;
          title: string;
          style: string;
          body_zone: string | null;
          price: number;
          deposit_percent: number;
          total_copies: number;
          sold_copies: number;
          image_url: string;
          is_color: boolean;
          estimated_duration: number | null;
          tags: string[];
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          artist_id: string;
          title: string;
          style: string;
          body_zone?: string | null;
          price: number;
          total_copies?: number;
          image_url: string;
          is_color?: boolean;
          estimated_duration?: number | null;
          tags?: string[];
          is_published?: boolean;
        };
        Update: Partial<Database['public']['Tables']['flash_designs']['Row']>;
        Relationships: [
          { foreignKeyName: 'flash_designs_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      guest_spots: {
        Row: {
          id: string;
          artist_id: string;
          artist_city: string | null;
          artist_country: string | null;
          host_city: string;
          host_studio: string;
          studio_address: string | null;
          date_from: string;
          date_to: string;
          styles: string[];
          slots_total: number;
          slots_booked: number;
          price_from: number;
          instagram_handle: string | null;
          cover_image_url: string;
          description: string;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          artist_id: string;
          artist_city?: string | null;
          host_city: string;
          host_studio: string;
          studio_address?: string | null;
          date_from: string;
          date_to: string;
          styles?: string[];
          slots_total?: number;
          price_from: number;
          cover_image_url: string;
          description: string;
          is_published?: boolean;
        };
        Update: Partial<Database['public']['Tables']['guest_spots']['Row']>;
        Relationships: [
          { foreignKeyName: 'guest_spots_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      stories: {
        Row: {
          id: string;
          artist_id: string;
          media_url: string;
          caption: string | null;
          view_count: number;
          expires_at: string;
          created_at: string;
        };
        Insert: { id?: string; artist_id: string; media_url: string; caption?: string | null; expires_at: string };
        Update: { caption?: string | null; expires_at?: string };
        Relationships: [
          { foreignKeyName: 'stories_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      healed_photos: {
        Row: {
          id: string;
          appointment_id: string;
          artist_id: string | null;
          client_id: string | null;
          photo_url: string;
          note: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: { id?: string; appointment_id: string; photo_url: string; note?: string | null; is_public?: boolean };
        Update: { is_public?: boolean; note?: string | null };
        Relationships: [
          { foreignKeyName: 'healed_photos_appointment_id_fkey'; columns: ['appointment_id']; isOneToOne: false; referencedRelation: 'appointments'; referencedColumns: ['id'] },
          { foreignKeyName: 'healed_photos_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
          { foreignKeyName: 'healed_photos_client_id_fkey'; columns: ['client_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      post_reactions: {
        Row: {
          post_id: string;
          user_id: string;
          emoji: 'fire' | 'heart_eyes' | 'clap' | 'mind_blown' | 'black_heart';
          created_at: string;
        };
        Insert: { post_id: string; user_id: string; emoji: 'fire' | 'heart_eyes' | 'clap' | 'mind_blown' | 'black_heart' };
        Update: { emoji?: 'fire' | 'heart_eyes' | 'clap' | 'mind_blown' | 'black_heart' };
        Relationships: [
          { foreignKeyName: 'post_reactions_post_id_fkey'; columns: ['post_id']; isOneToOne: false; referencedRelation: 'posts'; referencedColumns: ['id'] },
          { foreignKeyName: 'post_reactions_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      client_errors: {
        Row: {
          id: string;
          user_id: string | null;
          message: string;
          stack: string | null;
          route: string | null;
          platform: string | null;
          app_version: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      artist_series: {
        Row: {
          id: string;
          artist_id: string;
          title: string;
          description: string | null;
          position: number;
          created_at: string;
        };
        Insert: { id?: string; artist_id: string; title: string; description?: string | null; position?: number };
        Update: Partial<Database['public']['Tables']['artist_series']['Row']>;
        Relationships: [
          { foreignKeyName: 'artist_series_artist_id_fkey'; columns: ['artist_id']; isOneToOne: false; referencedRelation: 'artists'; referencedColumns: ['id'] },
        ];
      };
      posts: {
        Row: {
          id: string;
          artist_id: string;
          media_url: string;
          media_type: 'photo' | 'video';
          embed_provider: 'tiktok' | 'instagram' | null;
          thumbnail_url: string | null;
          title: string | null;
          body_zone: string | null;
          session_hours: number | null;
          is_healed: boolean;
          series_id: string | null;
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
          embed_provider?: 'tiktok' | 'instagram' | null;
          thumbnail_url?: string | null;
          title?: string | null;
          body_zone?: string | null;
          session_hours?: number | null;
          is_healed?: boolean;
          series_id?: string | null;
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
          preferred_slots: string[];
          is_flash: boolean;
          is_inquiry: boolean;
          flash_design_id: string | null;
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
          preferred_slots?: string[];
          flash_design_id?: string | null;
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
          canceled_by: 'client' | 'artist' | null;
          cancel_reason: string | null;
          reminded_48h_at: string | null;
          reminded_24h_at: string | null;
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
          reporter_id: string | null;
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
      set_booking_settings: {
        Args: { p_timezone: string; p_session_durations: number[]; p_cancel_notice_hours: number };
        Returns: undefined;
      };
      set_artist_location: {
        Args: { p_latitude: number | null; p_longitude: number | null };
        Returns: undefined;
      };
      artists_nearby: {
        Args: { p_latitude: number; p_longitude: number; p_radius_km?: number; p_limit?: number };
        Returns: { artist_id: string; distance_km: number }[];
      };
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason?: string | null; p_new_slots?: string[] };
        Returns: Database['public']['Tables']['appointments']['Row'];
      };
      record_story_view: {
        Args: { p_story_id: string };
        Returns: undefined;
      };
      post_reaction_counts: {
        Args: { p_post_ids: string[] };
        Returns: { post_id: string; emoji: 'fire' | 'heart_eyes' | 'clap' | 'mind_blown' | 'black_heart'; total: number }[];
      };
      contact_artist: {
        Args: { p_artist_id: string; p_message: string };
        Returns: string;
      };
      report_client_error: {
        Args: { p_message: string; p_stack?: string | null; p_route?: string | null; p_platform?: string | null; p_app_version?: string | null };
        Returns: boolean;
      };
      set_weekly_schedule: {
        Args: { p_days: { day: number; opens: string; closes: string }[] };
        Returns: Database['public']['Tables']['artist_weekly_schedule']['Row'][];
      };
      artist_free_slots: {
        Args: { p_artist_id: string; p_days?: number; p_duration_min?: number | null };
        Returns: { starts_at: string; ends_at: string }[];
      };
      artist_public_stats: {
        Args: { p_artist_ids: string[] };
        Returns: {
          artist_id: string;
          rating_avg: number | null;
          rating_count: number;
          followers: number;
          flash_count: number;
          next_slot: string | null;
        }[];
      };
      set_waitlist: {
        Args: { p_artist_id: string; p_join: boolean };
        Returns: boolean;
      };
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
      mark_messages_read: {
        Args: { p_request_id: string };
        Returns: number;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_banned: { Args: Record<string, never>; Returns: boolean };
      request_verification: { Args: Record<string, never>; Returns: string };
      admin_list_reports: {
        Args: { p_status?: string };
        Returns: {
          id: string;
          created_at: string | null;
          status: string;
          reason: 'spam' | 'inappropriate' | 'fake' | 'harassment' | 'other';
          description: string | null;
          target_type: 'post' | 'artist' | 'message' | 'review';
          target_id: string;
          reporter_name: string | null;
          target_label: string | null;
          target_excerpt: string | null;
          target_media_url: string | null;
          target_owner_id: string | null;
          target_owner_name: string | null;
          target_owner_banned: boolean;
          resolution_note: string | null;
        }[];
      };
      admin_resolve_report: {
        Args: { p_report_id: string; p_status: string; p_remove_content?: boolean; p_ban_owner?: boolean; p_note?: string | null };
        Returns: undefined;
      };
      admin_set_ban: { Args: { p_profile_id: string; p_banned: boolean }; Returns: undefined };
      admin_list_verifications: {
        Args: Record<string, never>;
        Returns: {
          artist_id: string;
          blaze: string;
          city: string;
          avatar_url: string | null;
          bio: string | null;
          stat_posts: number | null;
          submitted_at: string | null;
          account_created_at: string | null;
        }[];
      };
      admin_review_verification: { Args: { p_artist_id: string; p_approve: boolean }; Returns: undefined };
      search_artists: {
        Args: {
          p_query?: string | null;
          p_style?: string | null;
          p_availability?: string | null;
          p_budget_max?: number | null;
          p_sort?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: (Pick<
          Database['public']['Tables']['artists']['Row'],
          'id' | 'blaze' | 'city' | 'bio' | 'cover_url' | 'avatar_url' | 'styles' | 'specialties' | 'booking_status'
          | 'min_budget' | 'tier' | 'is_verified' | 'exclusions' | 'rules' | 'process' | 'show_min_budget'
          | 'stat_posts' | 'stat_profile_views' | 'stat_requests_month'
        > & { total_count: number; open_count: number })[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
