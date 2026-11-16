const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadDeposits(supabase = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/deposits.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => name === './supabase' ? { supabase } : require(name), module, module.exports,
  );
  return module.exports;
}

test('deposit amount parsing is exact and bounded, not floating-point rounding', () => {
  const d = loadDeposits();
  assert.equal(d.eurosToCents('50'), 5000);
  assert.equal(d.eurosToCents('1,05'), 105);
  assert.equal(d.eurosToCents('10000'), 1_000_000);
  for (const bad of ['0', '-5', '0,99', '1.005', '10000,01', 'NaN', '1e4', '1,2,3', '']) {
    assert.equal(d.eurosToCents(bad), null, bad);
  }
});

test('external deposit links reject spoofed providers and insecure protocols', () => {
  const d = loadDeposits();
  assert.equal(d.approvedExternalDepositUrl('https://paypal.me/artist'), 'https://paypal.me/artist');
  assert.equal(d.approvedExternalDepositUrl('https://buy.stripe.com/test_123'), 'https://buy.stripe.com/test_123');
  for (const bad of [
    'http://paypal.me/artist', 'https://paypal.me.evil.test/artist',
    'https://paypal.me@evil.test/p', 'https://evil.test/paypal.me',
    'javascript:alert(1)', 'https://paypal.me/', 'https://localhost/pay',
    'https://paypal.me:444/artist', 'https://paypal.me/artist\\@evil.test',
  ]) assert.equal(d.approvedExternalDepositUrl(bad), null, bad);
});

test('unknown service errors are redacted; unavailable migrations are explicit', () => {
  const d = loadDeposits();
  assert.match(d.depositError({ message: 'deposit_not_artist' }), /tatoueur/);
  assert.match(d.depositError({ code: 'PGRST205', message: 'internal' }), /pas encore disponible/);
  assert.doesNotMatch(d.depositError({ message: 'secret backend exception' }), /secret/);
  assert.equal(d.depositError(null), null);
});

test('RPC wrapper submits only the artist-controlled fields and does not invent success', async () => {
  const calls = [];
  const d = loadDeposits({
    rpc: async (name, args) => { calls.push({ name, args }); return { data: null, error: { message: 'deposit_not_artist' } }; },
  });
  const result = await d.requestDeposit('appointment-1', 5000, 'external', 'https://paypal.me/artist');
  assert.equal(result.data, null);
  assert.match(result.error, /tatoueur/);
  assert.deepEqual(calls, [{
    name: 'set_appointment_deposit_request',
    args: {
      p_appointment_id: 'appointment-1', p_amount_cents: 5000,
      p_method: 'external', p_external_url: 'https://paypal.me/artist',
    },
  }]);
});

test('SQL enforces per-artist ownership, RLS, link allowlist and cancellation', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const as = async (user, fn) => {
    await db.exec("select set_config('request.jwt.claim.sub', '" + (user || '') + "', false);");
    await db.exec('set role ' + (user ? 'authenticated' : 'anon') + ';');
    try { return await fn(); }
    finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
  };
  const client = '11111111-1111-4111-8111-111111111111';
  const artistUser = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  const artist = '44444444-4444-4444-8444-444444444444';
  const appt = '55555555-5555-4555-8555-555555555555';
  const appt2 = '66666666-6666-4666-8666-666666666666';
  const appt3 = '77777777-7777-4777-8777-777777777777';
  try {
    await db.exec([
      'create role anon nologin;', 'create role authenticated nologin;',
      'create schema auth;',
      "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
      'create table public.profiles (id uuid primary key, is_banned boolean not null default false);',
      "create function public.is_banned() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select is_banned from public.profiles where id = auth.uid()), false); $$;", 
      'create table public.artists (id uuid primary key, profile_id uuid not null references public.profiles(id));',
      'create table public.appointments (id uuid primary key, artist_id uuid references public.artists(id), client_id uuid references public.profiles(id), status text not null, starts_at timestamptz not null);',
      'grant usage on schema public, auth to authenticated, anon;',
      'grant select on public.artists to authenticated;',
      'grant select on public.appointments to authenticated;',
    ].join('\n'));
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261116081339_optional_external_deposits.sql'), 'utf8');
    await db.exec(migration);
    await db.exec([
      'create table public.notifications (user_id uuid not null, type text not null, title text not null, body text, data jsonb);',
      "create function public.notify_user(p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb) returns void language plpgsql security definer set search_path = '' as $$ begin insert into public.notifications (user_id,type,title,body,data) values (p_user_id,p_type,p_title,p_body,p_data); end; $$;",
    ].join('\n'));
    const notifyMigration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261116102000_deposit_notifications.sql'), 'utf8');
    await db.exec(notifyMigration);
    const banMigration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261116111500_deposit_banned_artist_guard.sql'), 'utf8');
    await db.exec(banMigration);
    const indexMigration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261116131500_deposit_client_fk_index.sql'), 'utf8');
    await db.exec(indexMigration);
    const clientIndex = await one("select indexname from pg_indexes where schemaname = 'public' and tablename = 'appointment_deposit_requests' and indexname = 'appointment_deposit_requests_client_idx'");
    assert.equal(clientIndex?.indexname, 'appointment_deposit_requests_client_idx');
    for (const id of [client, artistUser, outsider]) {
      await db.query('insert into public.profiles(id) values ($1)', [id]);
    }
    await db.query('insert into public.artists(id, profile_id) values ($1, $2)', [artist, artistUser]);
    for (const id of [appt, appt2, appt3]) {
      await db.query("insert into public.appointments(id, artist_id, client_id, status, starts_at) values ($1,$2,$3,'confirmed',now()+interval '7 days')", [id, artist, client]);
    }

    // A client or another authenticated person may neither request nor declare receipt.
    await as(client, async () => {
      await assert.rejects(db.query("select public.set_appointment_deposit_request($1,5000,'manual',null)", [appt]), /deposit_not_artist/);
    });
    await as(outsider, async () => {
      await assert.rejects(db.query("select public.set_appointment_deposit_request($1,5000,'manual',null)", [appt]), /deposit_not_artist/);
    });
    await as(artistUser, async () => {
      await assert.rejects(db.query("select public.set_appointment_deposit_request($1,5000,'external','https://paypal.me.evil.test/p')", [appt]), /deposit_unapproved_payment_provider/);
      await assert.rejects(db.query("select public.set_appointment_deposit_request($1,5000,'external','http://paypal.me/p')", [appt]), /deposit_invalid_payment_link/);
      const row = await one("select (public.set_appointment_deposit_request($1,5000,'external','https://paypal.me/artist')).status as status", [appt]);
      assert.equal(row.status, 'requested');
      // An unchanged replay must not send another notification.
      await one("select (public.set_appointment_deposit_request($1,5000,'external','https://paypal.me/artist')).status as status", [appt]);
    });

    const notices = (await db.query('select type,data from public.notifications order by type')).rows;
    assert.equal(notices.length, 1, 'new deposit creates one client notification');
    assert.equal(notices[0].type, 'deposit_requested');
    assert.equal(notices[0].data.appointment_id, appt);
    assert.equal(JSON.stringify(notices[0]).includes('paypal.me'), false, 'never copy payment URLs to notifications');
    await as(outsider, async () => {
      assert.equal((await db.query('select * from public.appointment_deposit_requests')).rows.length, 0);
    });
    await as(client, async () => {
      assert.equal((await db.query('select * from public.appointment_deposit_requests')).rows.length, 1);
      await assert.rejects(db.query("update public.appointment_deposit_requests set status='declared_received'"), /permission denied/);
      await assert.rejects(db.query("select public.finalize_appointment_deposit_request($1,'declared_received')", [appt]), /deposit_not_artist/);
    });
    await as(artistUser, async () => {
      const row = await one("select (public.finalize_appointment_deposit_request($1,'declared_received')).status as status", [appt]);
      assert.equal(row.status, 'declared_received');
      await assert.rejects(db.query("select public.set_appointment_deposit_request($1,3000,'manual',null)", [appt]), /deposit_already_finalized/);
      await one("select (public.set_appointment_deposit_request($1,2000,'external','https://buy.stripe.com/test_123')).status as status", [appt2]);
    });
    const receiptNotices = (await db.query("select type,body from public.notifications where type='deposit_declared_received'")).rows;
    assert.equal(receiptNotices.length, 1);
    assert.match(receiptNotices[0].body, /pas vérifié/);
    await db.query("update public.appointments set status='canceled' where id=$1", [appt2]);
    const cancelled = await one('select status,external_url from public.appointment_deposit_requests where appointment_id=$1', [appt2]);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.external_url, null);
    assert.equal((await db.query("select count(*)::int as n from public.notifications")).rows[0].n, 3,
      'cancellation does not send duplicate deposit alerts');
    await db.query('update public.profiles set is_banned = true where id=$1', [artistUser]);
    await as(artistUser, async () => {
      await assert.rejects(db.query("select public.set_appointment_deposit_request($1,5000,'manual',null)", [appt3]), /deposit_account_banned/);
      await assert.rejects(db.query("select public.finalize_appointment_deposit_request($1,'waived')", [appt]), /deposit_account_banned/);
    });
  } finally {
    await db.close();
  }
});
