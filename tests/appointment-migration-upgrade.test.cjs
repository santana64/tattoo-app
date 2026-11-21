const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Replays the SQL migration on a database with two existing proposed sessions.
// This proves data and RPC behavior in PGlite, not compatibility of distributed
// old clients or safety of changing the live Supabase project.
const MIGRATIONS = path.join(__dirname, '..', 'supabase', 'migrations');
const LOCKDOWN = '20261114164541_appointment_rpc_only.sql';

const SUPABASE_STUB = [
  'create role anon nologin;',
  'create role authenticated nologin;',
  'create role service_role nologin bypassrls;',
  'create schema auth;',
  "create table auth.users (id uuid primary key default gen_random_uuid(), email text not null, raw_user_meta_data jsonb default '{}'::jsonb);",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
  "create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;",
  'create schema storage;',
  'create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);',
  'create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);',
  'alter table storage.objects enable row level security;',
  "create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;",
  'create publication supabase_realtime;',
  'grant usage on schema public, auth, storage to anon, authenticated, service_role;',
  'grant all on storage.objects to anon, authenticated, service_role;',
  'alter default privileges in schema public grant all on tables to anon, authenticated, service_role;',
  'alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;',
].join('\n');

const STORAGE_SEED = [
  "create policy request_refs_owner on storage.objects for all using (bucket_id = 'request-references' and auth.uid() is not null);",
  "create policy verification_docs_owner on storage.objects for all using (bucket_id = 'verification-docs' and auth.uid() is not null);",
].join('\n');

test('migration preserves two existing proposals, closes direct writes and retains client acceptance RPC', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
  const { btree_gist } = await import('@electric-sql/pglite/contrib/btree_gist');
  const db = new PGlite({ extensions: { uuid_ossp, pg_trgm, btree_gist } });

  const sql = async (query, params) => (await db.query(query, params)).rows;
  const one = async (query, params) => (await sql(query, params))[0];
  const as = async (uid, action) => {
    const role = uid ? 'authenticated' : 'anon';
    await db.exec("select set_config('request.jwt.claim.sub', '" + (uid || '') + "', false);");
    await db.exec("select set_config('request.jwt.claim.role', '" + role + "', false);");
    await db.exec('set role ' + role);
    try {
      return await action();
    } finally {
      await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false);");
    }
  };

  try {
    await db.exec(SUPABASE_STUB);
    const migrations = fs.readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql')).sort();
    assert.ok(migrations.includes(LOCKDOWN), 'the restrictive migration must exist');
    for (const file of migrations) {
      if (file === LOCKDOWN) break;
      if (file === '005_p0_security.sql') await db.exec(STORAGE_SEED);
      await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    }

    // Reproduce selected historical schema additions confirmed by read-only
    // catalog inspection of the live project. These are absent from fresh
    // staging migrations and must survive an additive upgrade.
    await db.exec([
      "alter table public.artists add column gallery_layout text not null default 'hero_grid';",
      "alter table public.artists add column hero_variant text not null default 'cover_dominant';",
      "alter table public.artists add column cta_variant text not null default 'book';",
      "alter table public.artists add column tagline text;",
      "alter table public.artists add column pinned_post_id uuid references public.posts(id) on delete set null;",
      "alter table public.artists add column section_order text[] not null default array['gallery','bio','rules','process','faq'];",
      "alter table public.artists add constraint chk_gallery_layout check (gallery_layout in ('hero_grid','editorial','dense'));",
      "alter table public.artists add constraint chk_hero_variant check (hero_variant in ('cover_dominant','compact','minimal'));",
      "alter table public.artists add constraint chk_cta_variant check (cta_variant in ('book','flash','contact','custom'));",
      "alter table public.profiles add column deletion_requested_at timestamptz;",
      "alter table public.tattoo_requests add column availability_hint text;",
      "alter table public.tattoo_requests add constraint tattoo_requests_availability_hint_check check (availability_hint in ('this_month','next_3_months','next_6_months','flexible'));",
      "alter table public.tattoo_requests alter column artist_id drop not null;",
      "alter table public.reviews alter column client_id drop not null;",
    ].join('\n'));
    await db.exec(fs.readFileSync(
      path.join(__dirname, 'fixtures', 'production-only-tables.sql'), 'utf8',
    ));

    const beforeGrants = await one(
      "select has_table_privilege('authenticated','public.appointments','UPDATE') as may_update"
    );
    assert.equal(beforeGrants.may_update, true, 'the old app had direct UPDATE permission');

    const addUser = async (name) =>
      (await one("insert into auth.users (email) values ($1) returning id", [name + '@example.test'])).id;
    const client = await addUser('legacy-client');
    const artistUser = await addUser('legacy-artist');
    const outsider = await addUser('legacy-outsider');
    const artist = (await one(
      "insert into public.artists (profile_id, blaze, city) values ($1,'Upgrade QA','Lyon') returning id",
      [artistUser]
    )).id;
    await db.query(
      "update public.artists set gallery_layout='editorial', hero_variant='compact', cta_variant='contact', tagline='QA only' where id=$1",
      [artist],
    );
    for (let i = 0; i < 7; i++) {
      await db.query(
        "insert into public.message_templates(artist_id,title,body,sort_order) values ($1,$2,$3,$4)",
        [artist, 'Template ' + i, 'Synthetic text only', i],
      );
    }

    const proposals = [];
    for (const days of [7, 9]) {
      const request = (await one(
        "insert into public.tattoo_requests (client_id, artist_id, project_type, body_zone, size_category, color_preference, description, flexibility_level, status) values ($1,$2,'new','bras','m','black_grey','Test migration','open','accepted') returning id",
        [client, artist]
      )).id;
      await db.query(
        "update public.tattoo_requests set availability_hint='flexible' where id=$1",
        [request],
      );
      const starts = new Date(Date.now() + days * 86_400_000).toISOString();
      const ends = new Date(Date.now() + days * 86_400_000 + 2 * 3_600_000).toISOString();
      const appt = (await one(
        "insert into public.appointments (request_id, artist_id, client_id, starts_at, ends_at, body_zone, status) values ($1,$2,$3,$4,$5,'bras','proposed') returning id",
        [request, artist, client, starts, ends]
      )).id;
      proposals.push({ appt, request });
    }

    const initial = await sql('select id, status, request_id from public.appointments order by id');
    assert.equal(initial.length, 2);
    assert.ok(initial.every((row) => row.status === 'proposed'));

    await db.exec(fs.readFileSync(path.join(MIGRATIONS, LOCKDOWN), 'utf8'));
    for (const file of migrations.filter((name) => name > LOCKDOWN)) {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    }
    // All subsequent V5/V5.1 migrations must preserve historical data and
    // old columns. This is a partial production-schema overlay, not a dump.
    const extras = await one(
      "select gallery_layout, hero_variant, cta_variant, tagline from public.artists where id=$1",
      [artist],
    );
    assert.deepEqual(extras, {
      gallery_layout: 'editorial', hero_variant: 'compact', cta_variant: 'contact', tagline: 'QA only',
    });
    assert.equal((await one("select count(*)::int as n from public.message_templates")).n, 7);
    const legacyTables = [
      'artist_reviews', 'deposits', 'flash_bookings', 'healed_photo_reminders',
      'message_templates', 'notification_preferences', 'open_slots',
    ];
    const survivingTables = (await sql(
      "select tablename from pg_tables where schemaname='public' and tablename=any($1::text[]) order by tablename",
      [legacyTables],
    )).map((r) => r.tablename);
    assert.deepEqual(survivingTables, [...legacyTables].sort());
    const historicalSchema = await one(`
      select
        (select count(*)::int from information_schema.columns
         where table_schema='public' and table_name=any($1::text[])) as columns,
        (select count(*)::int from pg_constraint
         where conrelid in (select oid from pg_class where relnamespace='public'::regnamespace
           and relname=any($1::text[]))) as constraints,
        (select count(*)::int from pg_policies
         where schemaname='public' and tablename=any($1::text[])) as policies,
        (select count(*)::int from pg_indexes
         where schemaname='public' and tablename=any($1::text[])
           and indexname not in (select conname from pg_constraint)) as extra_indexes
    `, [legacyTables]);
    assert.ok(historicalSchema.columns >= 80, 'historical columns must survive');
    assert.ok(historicalSchema.constraints >= 37, 'historical constraints must survive');
    assert.ok(historicalSchema.policies >= 22, 'historical RLS policies must survive');
    assert.ok(historicalSchema.extra_indexes >= 9, 'historical indexes must survive');
    for (const proposal of proposals) {
      assert.equal((await one(
        'select availability_hint from public.tattoo_requests where id=$1', [proposal.request],
      )).availability_hint, 'flexible');
    }
    const after = await sql('select id, status, request_id from public.appointments order by id');
    assert.deepEqual(after, initial, 'no existing appointment may be deleted or rewritten');

    const grants = await one("select has_table_privilege('authenticated','public.appointments','INSERT') as i, has_table_privilege('authenticated','public.appointments','UPDATE') as u, has_table_privilege('authenticated','public.appointments','DELETE') as d");
    assert.deepEqual(grants, { i: false, u: false, d: false });
    assert.equal((await one("select count(*)::int as n from pg_policies where schemaname='public' and tablename='appointments' and policyname='appointments_manage_artist'")).n, 0);

    await as(artistUser, async () => {
      await assert.rejects(db.query("update public.appointments set status='confirmed' where id=$1", [proposals[0].appt]), /permission denied/);
      await assert.rejects(db.query("select public.respond_to_appointment($1,true)", [proposals[0].appt]), /not_appointment_client/);
    });
    await as(outsider, async () => {
      await assert.rejects(db.query("select public.respond_to_appointment($1,true)", [proposals[0].appt]), /not_appointment_client/);
    });

    const accepted = await as(client, () =>
      one('select (public.respond_to_appointment($1,true)).status as status', [proposals[0].appt])
    );
    assert.equal(accepted.status, 'confirmed');
    assert.equal((await one('select status from public.appointments where id=$1', [proposals[1].appt])).status, 'proposed', 'the second existing proposal remains pending');
    assert.equal((await one('select count(*)::int as n from public.appointments')).n, 2);
  } finally {
    await db.close();
  }
});
