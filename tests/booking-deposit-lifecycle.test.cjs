const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS = path.join(__dirname, '..', 'supabase', 'migrations');
const STUB = [
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

test('full client and artist journey: request, appointment, optional deposit, notifications, cancellation', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
  const { btree_gist } = await import('@electric-sql/pglite/contrib/btree_gist');
  const db = new PGlite({ extensions: { uuid_ossp, pg_trgm, btree_gist } });
  const rows = async (query, params) => (await db.query(query, params)).rows;
  const one = async (query, params) => (await rows(query, params))[0];
  const as = async (uid, fn) => {
    const role = uid ? 'authenticated' : 'anon';
    await db.exec("select set_config('request.jwt.claim.sub', '" + (uid || '') + "', false);");
    await db.exec("select set_config('request.jwt.claim.role', '" + role + "', false);");
    await db.exec('set role ' + role + ';');
    try { return await fn(); }
    finally {
      await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false);");
    }
  };
  try {
    await db.exec(STUB);
    for (const file of fs.readdirSync(MIGRATIONS).filter((p) => p.endsWith('.sql')).sort()) {
      if (file === '005_p0_security.sql') await db.exec(STORAGE_SEED);
      await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    }
    const addUser = async (label) => (await one(
      'insert into auth.users (email) values ($1) returning id', [label + '@example.test'],
    )).id;
    const client = await addUser('journey-client');
    const artistUser = await addUser('journey-artist');
    const outsider = await addUser('journey-outsider');
    let artist;
    await as(artistUser, async () => {
      await db.query("update public.profiles set role='artist' where id=$1", [artistUser]);
      artist = (await one(
        "insert into public.artists (profile_id, blaze, city) values ($1,'QA Studio','Lyon') returning id",
        [artistUser],
      )).id;
    });
    let request;
    await as(client, async () => {
      request = (await one(
        "insert into public.tattoo_requests (client_id, artist_id, project_type, body_zone, size_category, color_preference, description, flexibility_level) values ($1,$2,'new','bras','m','black_grey','Essai de recette','open') returning id",
        [client, artist],
      )).id;
    });
    assert.equal((await one('select status from public.tattoo_requests where id=$1', [request])).status, 'submitted');
    await as(outsider, async () => {
      const forbidden = await db.query(
        "update public.tattoo_requests set status='accepted' where id=$1", [request],
      );
      assert.equal(forbidden.affectedRows, 0, 'RLS silently filters unauthorized UPDATE rows');
    });
    await as(artistUser, async () => {
      const accepted = await db.query(
        "update public.tattoo_requests set status='accepted', accepted_at=now() where id=$1 and status='submitted'",
        [request],
      );
      assert.equal(accepted.affectedRows, 1);
    });
    let appointment;
    await as(artistUser, async () => {
      appointment = (await one(
        "select (public.propose_appointment($1, now()+interval '10 days', now()+interval '10 days 2 hours')).id as id",
        [request],
      )).id;
    });
    await as(outsider, async () => {
      await assert.rejects(
        db.query('select public.respond_to_appointment($1,true)', [appointment]),
        /not_appointment_client/,
      );
    });
    await as(client, async () => {
      const status = (await one('select (public.respond_to_appointment($1,true)).status as status', [appointment])).status;
      assert.equal(status, 'confirmed');
    });
    assert.equal((await one('select status from public.tattoo_requests where id=$1', [request])).status, 'confirmed');

    const depositsFor = (uid) => as(uid, () => rows(
      'select appointment_id, status, amount_cents, method, external_url from public.appointment_deposit_requests',
    ));
    await as(client, async () => {
      await assert.rejects(
        db.query("select public.set_appointment_deposit_request($1,5000,'manual',null)", [appointment]),
        /deposit_not_artist/,
      );
    });
    await as(outsider, async () => {
      assert.equal((await depositsFor(outsider)).length, 0);
    });
    const countDepositNotices = async (type) => (
      await one("select count(*)::int as n from public.notifications where user_id=$1 and type=$2",
        [client, type])
    ).n;
    await as(artistUser, async () => {
      const initial = await one(
        "select (public.set_appointment_deposit_request($1,5000,'manual',null)).status as status",
        [appointment],
      );
      assert.equal(initial.status, 'requested');
      await db.query("select public.set_appointment_deposit_request($1,5000,'manual',null)", [appointment]);
    });
    assert.equal(await countDepositNotices('deposit_requested'), 1, 'idempotent duplicate notification');
    await as(artistUser, async () => {
      await db.query("select public.set_appointment_deposit_request($1,5000,'external','https://paypal.me/artist')", [appointment]);
    });
    assert.equal(await countDepositNotices('deposit_requested'), 2, 'changed deposit gets exactly one new notification');
    assert.equal((await depositsFor(client))[0].external_url, 'https://paypal.me/artist');
    assert.equal((await depositsFor(outsider)).length, 0);
    await as(client, async () => {
      await assert.rejects(db.query(
        "select public.finalize_appointment_deposit_request($1,'declared_received')", [appointment],
      ), /deposit_not_artist/);
    });
    await as(artistUser, async () => {
      assert.equal((await one(
        "select (public.finalize_appointment_deposit_request($1,'declared_received')).status as status",
        [appointment],
      )).status, 'declared_received');
      await db.query("select public.finalize_appointment_deposit_request($1,'declared_received')", [appointment]);
      await assert.rejects(db.query(
        "select public.set_appointment_deposit_request($1,6000,'manual',null)", [appointment],
      ), /deposit_already_finalized/);
    });
    assert.equal(await countDepositNotices('deposit_declared_received'), 1);
    const notified = await one(
      "select data from public.notifications where user_id=$1 and type='deposit_declared_received'",
      [client],
    );
    assert.equal(JSON.stringify(notified.data).includes('paypal.me'), false, 'notification must not carry the payment link');

    let second;
    await as(artistUser, async () => {
      second = (await one(
        "select (public.propose_appointment($1, now()+interval '20 days', now()+interval '20 days 2 hours')).id as id",
        [request],
      )).id;
    });
    await as(client, () => db.query('select public.respond_to_appointment($1,true)', [second]));
    await as(artistUser, () => db.query(
      "select public.set_appointment_deposit_request($1,2000,'external','https://buy.stripe.com/test_123')",
      [second],
    ));
    await as(client, async () => {
      assert.equal((await one(
        "select (public.cancel_appointment($1,'Essai de report',array[]::timestamptz[])).status as status",
        [second],
      )).status, 'canceled');
    });
    const cancelled = await one(
      'select status, external_url from public.appointment_deposit_requests where appointment_id=$1',
      [second],
    );
    assert.deepEqual(cancelled, { status: 'cancelled', external_url: null });
    assert.equal((await depositsFor(client)).length, 2);
    assert.equal((await depositsFor(outsider)).length, 0);
    assert.equal((await one('select count(*)::int as n from public.appointments')).n, 2);
  } finally {
    await db.close();
  }
});
