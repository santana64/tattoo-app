-- Schema-only fixture from production pg_catalog, observed 2026-11-16.
-- Only seven legacy public tables absent from the isolated V5 staging schema.
-- Contains NO user rows, email addresses, passwords or payment secrets.
-- This fixture intentionally omits production-only trigger functions, grants and Storage.
-- This is NOT a restorable database backup and MUST NOT be run against production.

create table public."artist_reviews" (
  "id" uuid default gen_random_uuid() not null,
  "appointment_id" uuid,
  "artist_id" uuid not null,
  "client_id" uuid,
  "rating" integer not null,
  "text" text,
  "photo_url" text,
  "is_public" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."deposits" (
  "id" uuid default gen_random_uuid() not null,
  "appointment_id" uuid not null,
  "amount_cents" integer not null,
  "currency" text default 'eur'::text not null,
  "status" text default 'requested'::text not null,
  "stripe_session_id" text,
  "stripe_payment_intent_id" text,
  "checkout_url" text,
  "created_at" timestamp with time zone default now(),
  "paid_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now()
);

create table public."flash_bookings" (
  "id" uuid default gen_random_uuid() not null,
  "flash_design_id" uuid not null,
  "artist_id" uuid not null,
  "client_id" uuid,
  "status" text default 'pending_deposit'::text not null,
  "deposit_amount_cents" integer not null,
  "currency" text default 'eur'::text not null,
  "stripe_session_id" text,
  "stripe_payment_intent_id" text,
  "checkout_url" text,
  "paid_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."healed_photo_reminders" (
  "appointment_id" uuid not null,
  "artist_id" uuid,
  "client_id" uuid,
  "due_at" timestamp with time zone not null,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table public."message_templates" (
  "id" uuid default gen_random_uuid() not null,
  "artist_id" uuid not null,
  "title" text not null,
  "body" text not null,
  "category" text,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."notification_preferences" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "push_enabled" boolean default true not null,
  "messages_enabled" boolean default true not null,
  "request_updates_enabled" boolean default true not null,
  "appointment_reminders_enabled" boolean default true not null,
  "deposit_updates_enabled" boolean default true not null,
  "marketing_enabled" boolean default false not null,
  "email_messages_enabled" boolean default false not null,
  "email_request_updates_enabled" boolean default true not null,
  "email_appointment_reminders_enabled" boolean default true not null,
  "email_marketing_enabled" boolean default true not null,
  "daily_digest_enabled" boolean default false not null,
  "quiet_hours_enabled" boolean default false not null,
  "quiet_hours_start" text,
  "quiet_hours_end" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."open_slots" (
  "id" uuid default gen_random_uuid() not null,
  "artist_id" uuid not null,
  "starts_at" timestamp with time zone not null,
  "ends_at" timestamp with time zone not null,
  "title" text,
  "style" text,
  "description" text,
  "price" integer,
  "status" text default 'available'::text not null,
  "booked_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table public."artist_reviews" add constraint "artist_reviews_pkey" PRIMARY KEY (id);
alter table public."deposits" add constraint "deposits_pkey" PRIMARY KEY (id);
alter table public."flash_bookings" add constraint "flash_bookings_pkey" PRIMARY KEY (id);
alter table public."healed_photo_reminders" add constraint "healed_photo_reminders_pkey" PRIMARY KEY (appointment_id);
alter table public."message_templates" add constraint "message_templates_pkey" PRIMARY KEY (id);
alter table public."notification_preferences" add constraint "notification_preferences_pkey" PRIMARY KEY (id);
alter table public."open_slots" add constraint "open_slots_pkey" PRIMARY KEY (id);
alter table public."flash_bookings" add constraint "flash_bookings_stripe_session_id_key" UNIQUE (stripe_session_id);
alter table public."notification_preferences" add constraint "notification_preferences_user_id_key" UNIQUE (user_id);
alter table public."artist_reviews" add constraint "artist_reviews_rating_check" CHECK (rating >= 1 AND rating <= 5);
alter table public."deposits" add constraint "deposits_amount_cents_check" CHECK (amount_cents > 0);
alter table public."deposits" add constraint "deposits_status_check" CHECK (status = ANY (ARRAY['requested'::text, 'pending_payment'::text, 'paid'::text, 'cancelled'::text, 'refunded'::text]));
alter table public."flash_bookings" add constraint "flash_bookings_deposit_amount_cents_check" CHECK (deposit_amount_cents > 0);
alter table public."flash_bookings" add constraint "flash_bookings_status_check" CHECK (status = ANY (ARRAY['pending_deposit'::text, 'confirmed'::text, 'cancelled'::text, 'expired'::text, 'refunded'::text]));
alter table public."message_templates" add constraint "message_templates_body_max" CHECK (char_length(body) <= 2000);
alter table public."message_templates" add constraint "message_templates_body_not_blank" CHECK (length(TRIM(BOTH FROM body)) > 0);
alter table public."message_templates" add constraint "message_templates_title_max" CHECK (char_length(title) <= 80);
alter table public."message_templates" add constraint "message_templates_title_not_blank" CHECK (length(TRIM(BOTH FROM title)) > 0);
alter table public."notification_preferences" add constraint "notification_preferences_quiet_end_format" CHECK (quiet_hours_end IS NULL OR quiet_hours_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text);
alter table public."notification_preferences" add constraint "notification_preferences_quiet_start_format" CHECK (quiet_hours_start IS NULL OR quiet_hours_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text);
alter table public."open_slots" add constraint "open_slots_price_check" CHECK (price IS NULL OR price > 0);
alter table public."open_slots" add constraint "open_slots_status_check" CHECK (status = ANY (ARRAY['available'::text, 'booked'::text, 'cancelled'::text]));
alter table public."open_slots" add constraint "open_slots_valid_range" CHECK (ends_at > starts_at);
alter table public."artist_reviews" add constraint "artist_reviews_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
alter table public."artist_reviews" add constraint "artist_reviews_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
alter table public."artist_reviews" add constraint "artist_reviews_client_id_fkey" FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."deposits" add constraint "deposits_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
alter table public."flash_bookings" add constraint "flash_bookings_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
alter table public."flash_bookings" add constraint "flash_bookings_client_id_fkey" FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."flash_bookings" add constraint "flash_bookings_flash_design_id_fkey" FOREIGN KEY (flash_design_id) REFERENCES flash_designs(id) ON DELETE CASCADE;
alter table public."healed_photo_reminders" add constraint "healed_photo_reminders_appointment_id_fkey" FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
alter table public."healed_photo_reminders" add constraint "healed_photo_reminders_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
alter table public."healed_photo_reminders" add constraint "healed_photo_reminders_client_id_fkey" FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."message_templates" add constraint "message_templates_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
alter table public."notification_preferences" add constraint "notification_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."open_slots" add constraint "open_slots_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
alter table public."open_slots" add constraint "open_slots_booked_by_fkey" FOREIGN KEY (booked_by) REFERENCES profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX artist_reviews_one_per_appointment ON public.artist_reviews USING btree (appointment_id) WHERE (appointment_id IS NOT NULL);
CREATE INDEX idx_artist_reviews_artist_public ON public.artist_reviews USING btree (artist_id, is_public, created_at DESC);
CREATE UNIQUE INDEX deposits_one_active_per_appointment ON public.deposits USING btree (appointment_id) WHERE (status = ANY (ARRAY['pending_payment'::text, 'paid'::text]));
CREATE UNIQUE INDEX flash_bookings_one_active_per_client_design ON public.flash_bookings USING btree (flash_design_id, client_id) WHERE (status = ANY (ARRAY['pending_deposit'::text, 'confirmed'::text]));
CREATE INDEX idx_flash_bookings_artist ON public.flash_bookings USING btree (artist_id, created_at DESC);
CREATE INDEX idx_flash_bookings_client ON public.flash_bookings USING btree (client_id, created_at DESC);
CREATE INDEX idx_message_templates_artist_active ON public.message_templates USING btree (artist_id, is_active, sort_order, created_at);
CREATE INDEX idx_open_slots_artist ON public.open_slots USING btree (artist_id, starts_at);
CREATE INDEX idx_open_slots_market ON public.open_slots USING btree (status, starts_at);
alter table public."artist_reviews" enable row level security;
alter table public."deposits" enable row level security;
alter table public."flash_bookings" enable row level security;
alter table public."healed_photo_reminders" enable row level security;
alter table public."message_templates" enable row level security;
alter table public."notification_preferences" enable row level security;
alter table public."open_slots" enable row level security;
create policy "artist_reviews_insert_client" on public."artist_reviews" for INSERT to PUBLIC with check (((client_id = auth.uid()) AND ((appointment_id IS NULL) OR (appointment_id IN ( SELECT appointments.id
   FROM appointments
  WHERE ((appointments.client_id = auth.uid()) AND (appointments.status = 'completed'::text)))))));
create policy "artist_reviews_select_public" on public."artist_reviews" for SELECT to PUBLIC using (((is_public = true) OR (client_id = auth.uid()) OR (artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid())))));
create policy "artist_reviews_update_client" on public."artist_reviews" for UPDATE to PUBLIC using ((client_id = auth.uid())) with check ((client_id = auth.uid()));
create policy "deposits_insert_artist" on public."deposits" for INSERT to PUBLIC with check ((appointment_id IN ( SELECT appointments.id
   FROM appointments
  WHERE (appointments.artist_id IN ( SELECT artists.id
           FROM artists
          WHERE (artists.profile_id = auth.uid()))))));
create policy "deposits_select_parties" on public."deposits" for SELECT to PUBLIC using ((appointment_id IN ( SELECT appointments.id
   FROM appointments
  WHERE ((appointments.client_id = auth.uid()) OR (appointments.artist_id IN ( SELECT artists.id
           FROM artists
          WHERE (artists.profile_id = auth.uid())))))));
create policy "deposits_update_artist" on public."deposits" for UPDATE to PUBLIC using ((appointment_id IN ( SELECT appointments.id
   FROM appointments
  WHERE (appointments.artist_id IN ( SELECT artists.id
           FROM artists
          WHERE (artists.profile_id = auth.uid()))))));
create policy "flash_bookings_insert_client" on public."flash_bookings" for INSERT to PUBLIC with check ((client_id = auth.uid()));
create policy "flash_bookings_select_parties" on public."flash_bookings" for SELECT to PUBLIC using (((client_id = auth.uid()) OR (artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid())))));
create policy "flash_bookings_update_parties" on public."flash_bookings" for UPDATE to PUBLIC using (((client_id = auth.uid()) OR (artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid())))));
create policy "healed_photo_reminders_select_own" on public."healed_photo_reminders" for SELECT to PUBLIC using (((client_id = auth.uid()) OR (artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid())))));
create policy "message_templates_delete_own" on public."message_templates" for DELETE to PUBLIC using ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid()))));
create policy "message_templates_insert_own" on public."message_templates" for INSERT to PUBLIC with check ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid()))));
create policy "message_templates_select_own" on public."message_templates" for SELECT to PUBLIC using ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid()))));
create policy "message_templates_update_own" on public."message_templates" for UPDATE to PUBLIC using ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid())))) with check ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid()))));
create policy "notification_preferences_delete_own" on public."notification_preferences" for DELETE to PUBLIC using ((user_id = auth.uid()));
create policy "notification_preferences_insert_own" on public."notification_preferences" for INSERT to PUBLIC with check ((user_id = auth.uid()));
create policy "notification_preferences_select_own" on public."notification_preferences" for SELECT to PUBLIC using ((user_id = auth.uid()));
create policy "notification_preferences_update_own" on public."notification_preferences" for UPDATE to PUBLIC using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "open_slots_delete_own" on public."open_slots" for DELETE to PUBLIC using ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid()))));
create policy "open_slots_insert_own" on public."open_slots" for INSERT to PUBLIC with check ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid()))));
create policy "open_slots_select_available" on public."open_slots" for SELECT to PUBLIC using (((status = 'available'::text) OR (booked_by = auth.uid()) OR (artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid())))));
create policy "open_slots_update_own" on public."open_slots" for UPDATE to PUBLIC using ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid())))) with check ((artist_id IN ( SELECT artists.id
   FROM artists
  WHERE (artists.profile_id = auth.uid()))));
