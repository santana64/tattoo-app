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

    const proposals = [];
    for (const days of [7, 9]) {
      const request = (await one(
        "insert into public.tattoo_requests (client_id, artist_id, project_type, body_zone, size_category, color_preference, description, flexibility_level, status) values ($1,$2,'new','bras','m','black_grey','Test migration','open','accepted') returning id",
        [client, artist]
      )).id;
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
