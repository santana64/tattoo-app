// Runs the real migrations in an embedded Postgres (PGlite) and checks, as the
// API roles, what migration 005 must forbid and what must keep working.
//
// Supabase itself is stubbed to the minimum the migrations rely on: the
// anon / authenticated roles with their default table privileges, auth.users,
// auth.uid(), auth.role(), storage.objects and storage.foldername().
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null,
    name text not null
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

  create publication supabase_realtime;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

// The permissive storage policies seed.sql created on real projects.
const LEGACY_SEED_POLICIES = `
  create policy "request_refs_owner" on storage.objects
    for all using (bucket_id = 'request-references' and auth.uid() is not null);
  create policy "verification_docs_owner" on storage.objects
    for all using (bucket_id = 'verification-docs' and auth.uid() is not null);
`;

const DENIED = /permission denied|row-level security|not_request_party/;

let db;
const ids = {};

/** Runs `fn` as an API caller: `uid` null means the public anon key. */
async function as(uid, fn) {
  const role = uid ? 'authenticated' : 'anon';
  await db.exec(`
    select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `);
  try {
    return await fn();
  } finally {
    await db.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `);
  }
}

const rows = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await rows(sql, params))[0];

async function createUser(name) {
  const user = await one(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${name}@example.test`, JSON.stringify({ full_name: name })],
  );
  return user.id;
}

before(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
  const { btree_gist } = await import('@electric-sql/pglite/contrib/btree_gist');

  db = new PGlite({ extensions: { uuid_ossp, pg_trgm, btree_gist } });
  await db.exec(SUPABASE_STUB);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.includes('005_p0_security.sql'));
  for (const file of files) {
    if (file === '005_p0_security.sql') await db.exec(LEGACY_SEED_POLICIES);
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  // These migrations claim to be idempotent: prove it.
  for (const file of ['005_p0_security.sql', '006_notifications_and_reviews.sql', '007_push_delivery.sql', '008_artist_search.sql']) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }

  ids.client = await createUser('client');
  ids.artistUser = await createUser('artist');
  ids.outsider = await createUser('outsider');

  // Same writes as the app: role selection, then the artist row.
  await as(ids.artistUser, async () => {
    await db.query(`update public.profiles set role = 'artist', onboarding_completed = false where id = $1`, [ids.artistUser]);
    ids.artist = (await one(
      `insert into public.artists (profile_id, blaze, city) values ($1, 'Atelier', 'Lyon') returning id`,
      [ids.artistUser],
    )).id;
    ids.post = (await one(
      `insert into public.posts (artist_id, media_url, caption, styles, is_published)
       values ($1, 'https://example.test/a.jpg', 'Dragon', '{japonais}', true) returning id`,
      [ids.artist],
    )).id;
  });

  await as(ids.client, async () => {
    ids.request = (await one(
      `insert into public.tattoo_requests
         (client_id, artist_id, project_type, body_zone, size_category, color_preference, description, flexibility_level)
       values ($1, $2, 'new', 'avant-bras', 'm', 'black_grey', 'Un dragon', 'open') returning id`,
      [ids.client, ids.artist],
    )).id;
    await db.query(
      `insert into public.messages (request_id, sender_id, content) values ($1, $2, 'Bonjour')`,
      [ids.request, ids.client],
    );
  });
});

after(async () => {
  await db?.close();
});

// ── profiles ─────────────────────────────────────────────────

test('e-mail addresses are not readable through the API', async () => {
  await as(null, async () => {
    await assert.rejects(db.query(`select email from public.profiles`), DENIED);
    await assert.rejects(db.query(`select * from public.profiles`), DENIED);
    const visible = await rows(`select id, display_name, role from public.profiles`);
    assert.equal(visible.length, 3);
  });
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(`select email from public.profiles where id = $1`, [ids.client]), DENIED);
    await assert.rejects(db.query(`select trust_score, is_banned from public.profiles`), DENIED);
  });
});

test('a user cannot unban themselves or raise their trust score', async () => {
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(`update public.profiles set is_banned = false where id = $1`, [ids.outsider]), DENIED);
    await assert.rejects(db.query(`update public.profiles set trust_score = 100 where id = $1`, [ids.outsider]), DENIED);
    await assert.rejects(db.query(`update public.profiles set email = 'x@example.test' where id = $1`, [ids.outsider]), DENIED);
  });
});

test('a user can still edit their own profile, and only theirs', async () => {
  await as(ids.outsider, async () => {
    const own = await db.query(`update public.profiles set display_name = 'Nouveau', city = 'Paris' where id = $1`, [ids.outsider]);
    assert.equal(own.affectedRows, 1);
    const other = await db.query(`update public.profiles set display_name = 'Pirate' where id = $1`, [ids.client]);
    assert.equal(other.affectedRows, 0);
  });
});

// ── artists ──────────────────────────────────────────────────

test('an artist cannot grant themselves Premium, verification or statistics', async () => {
  await as(ids.artistUser, async () => {
    for (const assignment of [
      `tier = 'premium'`,
      `is_verified = true`,
      `verification_status = 'approved'`,
      `stat_profile_views = 100000`,
      `stripe_subscription_status = 'active'`,
    ]) {
      await assert.rejects(db.query(`update public.artists set ${assignment} where id = $1`, [ids.artist]), DENIED, assignment);
    }
  });
  await as(ids.outsider, async () => {
    await assert.rejects(
      db.query(`insert into public.artists (profile_id, blaze, city, tier) values ($1, 'Faux', 'Nice', 'premium')`, [ids.outsider]),
      DENIED,
    );
  });
  assert.equal((await one(`select tier from public.artists where id = $1`, [ids.artist])).tier, 'normal');
});

test('Stripe identifiers are not readable through the API', async () => {
  for (const uid of [null, ids.outsider, ids.artistUser]) {
    await as(uid, async () => {
      await assert.rejects(db.query(`select stripe_customer_id from public.artists`), DENIED);
      await assert.rejects(db.query(`select stripe_subscription_id from public.artists`), DENIED);
    });
  }
});

test('an artist can still edit their public page, and only theirs', async () => {
  await as(ids.artistUser, async () => {
    const own = await db.query(
      `update public.artists set bio = 'Vingt ans de métier', booking_status = 'paused', min_budget = 150, show_min_budget = true where id = $1 and profile_id = $2`,
      [ids.artist, ids.artistUser],
    );
    assert.equal(own.affectedRows, 1);
  });
  await as(ids.outsider, async () => {
    const other = await db.query(`update public.artists set bio = 'Pirate' where id = $1`, [ids.artist]);
    assert.equal(other.affectedRows, 0);
  });
  await as(null, async () => {
    const page = await one(`select blaze, city, tier, is_verified, stat_posts from public.artists where id = $1`, [ids.artist]);
    assert.equal(page.blaze, 'Atelier');
    assert.equal(page.stat_posts, 1);
  });
});

// ── counters ─────────────────────────────────────────────────

test('a like from another user moves the counter, which nobody can write', async () => {
  const count = async () => (await one(`select likes_count from public.posts where id = $1`, [ids.post])).likes_count;
  await as(ids.client, () => db.query(`insert into public.post_likes (post_id, user_id) values ($1, $2)`, [ids.post, ids.client]));
  assert.equal(await count(), 1);
  await as(ids.client, () => db.query(`delete from public.post_likes where post_id = $1 and user_id = $2`, [ids.post, ids.client]));
  assert.equal(await count(), 0);
  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(`update public.posts set likes_count = 9999 where id = $1`, [ids.post]), DENIED);
    await assert.rejects(
      db.query(`insert into public.posts (artist_id, media_url, likes_count) values ($1, 'https://example.test/b.jpg', 9999)`, [ids.artist]),
      DENIED,
    );
  });
});

test('a request from a client moves the artist request counter', async () => {
  const artist = await one(`select stat_requests_month from public.artists where id = $1`, [ids.artist]);
  assert.equal(artist.stat_requests_month, 1);
});

// ── messages ─────────────────────────────────────────────────

test('only the recipient marks messages as read, through the function', async () => {
  const unread = async () => (await one(`select count(*)::int as n from public.messages where request_id = $1 and is_read is not true`, [ids.request])).n;

  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(`update public.messages set is_read = true where request_id = $1`, [ids.request]), DENIED);
  });
  await as(ids.client, async () => {
    await assert.rejects(db.query(`update public.messages set content = 'Réécrit' where request_id = $1`, [ids.request]), DENIED);
    // The sender does not flag their own message as read.
    assert.equal((await one(`select public.mark_messages_read($1) as n`, [ids.request])).n, 0);
  });
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(`select public.mark_messages_read($1)`, [ids.request]), DENIED);
  });
  await as(null, async () => {
    await assert.rejects(db.query(`select public.mark_messages_read($1)`, [ids.request]), DENIED);
  });
  assert.equal(await unread(), 1);

  await as(ids.artistUser, async () => {
    assert.equal((await one(`select public.mark_messages_read($1) as n`, [ids.request])).n, 1);
  });
  assert.equal(await unread(), 0);
});

// ── analytics ────────────────────────────────────────────────

test('analytics events are signed-in, self-attributed and de-duplicated', async () => {
  const view = (uid, source) => as(uid, () => db.query(
    `insert into public.artist_analytics_events (artist_id, event_type, source_user) values ($1, 'profile_view', $2)`,
    [ids.artist, source],
  ));
  const stats = async () => ({
    events: (await one(`select count(*)::int as n from public.artist_analytics_events where artist_id = $1`, [ids.artist])).n,
    views: (await one(`select stat_profile_views from public.artists where id = $1`, [ids.artist])).stat_profile_views,
  });

  await assert.rejects(view(null, null), DENIED);
  await assert.rejects(view(ids.outsider, ids.client), DENIED);
  await assert.rejects(view(ids.outsider, null), DENIED);
  assert.deepEqual(await stats(), { events: 0, views: 0 });

  await view(ids.client, ids.client);
  assert.deepEqual(await stats(), { events: 1, views: 1 });

  // Hammering the endpoint does not inflate the numbers.
  for (let i = 0; i < 5; i++) await view(ids.client, ids.client);
  assert.deepEqual(await stats(), { events: 1, views: 1 });

  // An artist's own visits do not count.
  await view(ids.artistUser, ids.artistUser);
  assert.deepEqual(await stats(), { events: 1, views: 1 });

  await view(ids.outsider, ids.outsider);
  assert.deepEqual(await stats(), { events: 2, views: 2 });
});

// ── storage ──────────────────────────────────────────────────

test('private files are only visible to their owner or the request parties', async () => {
  const refPath = `${ids.request}/ref_0.jpg`;
  const docPath = `${ids.artistUser}/id-card.jpg`;
  const visible = (uid, bucket) => as(uid, async () =>
    (await rows(`select name from storage.objects where bucket_id = $1`, [bucket])).length);

  await as(ids.client, () => db.query(`insert into storage.objects (bucket_id, name) values ('request-references', $1)`, [refPath]));
  await as(ids.artistUser, () => db.query(`insert into storage.objects (bucket_id, name) values ('verification-docs', $1)`, [docPath]));

  assert.equal(await visible(ids.client, 'request-references'), 1);
  assert.equal(await visible(ids.artistUser, 'request-references'), 1);
  assert.equal(await visible(ids.outsider, 'request-references'), 0);
  assert.equal(await visible(null, 'request-references'), 0);

  assert.equal(await visible(ids.artistUser, 'verification-docs'), 1);
  assert.equal(await visible(ids.client, 'verification-docs'), 0);
  assert.equal(await visible(ids.outsider, 'verification-docs'), 0);

  await as(ids.outsider, async () => {
    await assert.rejects(
      db.query(`insert into storage.objects (bucket_id, name) values ('request-references', $1)`, [`${ids.request}/evil.jpg`]),
      DENIED,
    );
    await assert.rejects(
      db.query(`insert into storage.objects (bucket_id, name) values ('verification-docs', $1)`, [`${ids.artistUser}/evil.jpg`]),
      DENIED,
    );
  });
});

// ── existing flows still work ────────────────────────────────

test('the artist can still answer a request and book it (migrations 003 and 004)', async () => {
  await as(ids.artistUser, async () => {
    const answered = await db.query(
      `update public.tattoo_requests set status = 'accepted', accepted_at = now() where id = $1 and status = 'submitted'`,
      [ids.request],
    );
    assert.equal(answered.affectedRows, 1);
    ids.appointment = (await one(
      `select (public.propose_appointment($1, now() + interval '1 second', now() + interval '2 hours')).id as id`,
      [ids.request],
    )).id;
  });
  await as(ids.client, async () => {
    const confirmed = await one(`select (public.respond_to_appointment($1, true)).status as status`, [ids.appointment]);
    assert.equal(confirmed.status, 'confirmed');
    // RLS hides the row from a client UPDATE: nothing changes.
    const forged = await db.query(`update public.tattoo_requests set status = 'completed' where id = $1`, [ids.request]);
    assert.equal(forged.affectedRows, 0);
  });
  assert.equal((await one(`select status from public.tattoo_requests where id = $1`, [ids.request])).status, 'confirmed');
});

// ── notifications ────────────────────────────────────────────

test('the database notifies the right person, once per conversation', async () => {
  const types = async (uid) => (await rows(
    `select type from public.notifications where user_id = $1 order by type`, [uid],
  )).map((n) => n.type);

  assert.deepEqual(await types(ids.artistUser), ['appointment_confirmed', 'new_message', 'new_request']);
  assert.deepEqual(await types(ids.client), ['accepted', 'appointment_proposed']);
  assert.deepEqual(await types(ids.outsider), []);

  // More messages in the same conversation do not stack unread notifications.
  await as(ids.client, async () => {
    for (const content of ['Encore moi', 'Et encore']) {
      await db.query(`insert into public.messages (request_id, sender_id, content) values ($1, $2, $3)`, [ids.request, ids.client, content]);
    }
  });
  assert.equal((await types(ids.artistUser)).filter((t) => t === 'new_message').length, 1);

  // The artist answers: the client gets one.
  await as(ids.artistUser, () => db.query(
    `insert into public.messages (request_id, sender_id, content) values ($1, $2, 'Bonjour !')`, [ids.request, ids.artistUser],
  ));
  const fromArtist = await one(
    `select body, data from public.notifications where user_id = $1 and type = 'new_message'`, [ids.client],
  );
  assert.match(fromArtist.body, /^Atelier /);
  assert.equal(fromArtist.data.request_id, ids.request);
});

test('users read and tick their own notifications but cannot write any', async () => {
  await as(ids.outsider, async () => {
    await assert.rejects(
      db.query(`insert into public.notifications (user_id, type, title, body) values ($1, 'system', 'Gagné', 'Cliquez ici')`, [ids.client]),
      DENIED,
    );
    await assert.rejects(
      db.query(`insert into public.notifications (user_id, type, title, body) values ($1, 'system', 'Gagné', 'Cliquez ici')`, [ids.outsider]),
      DENIED,
    );
    await assert.rejects(db.query(`select public.notify_user($1, 'system', 'Gagné', 'Cliquez ici', '{}'::jsonb)`, [ids.client]), DENIED);
    assert.equal((await rows(`select id from public.notifications`)).length, 0);
  });
  await as(ids.client, async () => {
    const mine = await rows(`select user_id from public.notifications`);
    assert.ok(mine.length > 0 && mine.every((n) => n.user_id === ids.client));
    await assert.rejects(db.query(`update public.notifications set title = 'Réécrit' where user_id = $1`, [ids.client]), DENIED);
    const ticked = await db.query(`update public.notifications set is_read = true where user_id = $1 and is_read is not true`, [ids.client]);
    assert.ok(ticked.affectedRows > 0);
  });
});

// ── artist search ────────────────────────────────────────────

test('artists are searched, filtered, sorted and paged in the database', async () => {
  // Three more artists next to the fixture ("Atelier", Lyon, paused, 150 € minimum).
  const extra = [
    { name: 'Encre Noire', city: 'Lyon', styles: ['blackwork', 'fine-line'], status: 'open', budget: 400, show: true, tier: 'premium', views: 10 },
    { name: 'Studio Réaliste', city: 'Paris', styles: ['realisme'], status: 'open', budget: 0, show: false, tier: 'normal', views: 50 },
    { name: 'Vieux Port', city: 'Marseille', styles: ['old-school'], status: 'closed', budget: 250, show: true, tier: 'normal', views: 5 },
  ];
  const created = [];
  for (const a of extra) {
    const uid = await createUser(`search-${created.length}`);
    await db.query(
      `insert into public.artists (profile_id, blaze, city, styles, booking_status, min_budget, show_min_budget, tier, stat_profile_views)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [uid, a.name, a.city, a.styles, a.status, a.budget, a.show, a.tier, a.views],
    );
    created.push(uid);
  }

  const search = (args = {}) => as(null, () => rows(
    `select blaze, total_count::int as total, open_count::int as open
     from public.search_artists($1, $2, $3, $4, $5, $6, $7)`,
    [args.query ?? null, args.style ?? null, args.availability ?? null, args.budgetMax ?? null,
      args.sort ?? 'relevance', args.limit ?? 24, args.offset ?? 0],
  ));
  const names = async (args) => (await search(args)).map((r) => r.blaze);

  // No filter: everyone, Premium first, then by profile views.
  const all = await search();
  assert.deepEqual(all.map((r) => r.blaze), ['Encre Noire', 'Studio Réaliste', 'Vieux Port', 'Atelier']);
  assert.equal(all[0].total, 4);
  assert.equal(all[0].open, 2);

  // Text: name, city and style, without caring about case or accents.
  assert.deepEqual(await names({ query: 'lyon' }), ['Encre Noire', 'Atelier']);
  assert.deepEqual(await names({ query: '  RÉALISTE ' }), ['Studio Réaliste']);
  assert.deepEqual(await names({ query: 'realisme' }), ['Studio Réaliste']);
  assert.deepEqual(await names({ query: 'Old School' }), ['Vieux Port']);
  assert.deepEqual(await names({ query: 'noire lyon' }), ['Encre Noire']);
  assert.deepEqual(await names({ query: 'introuvable' }), []);

  // LIKE wildcards typed by a user are plain characters.
  assert.deepEqual(await names({ query: '%' }), []);
  assert.deepEqual(await names({ query: '_' }), []);

  // Filters.
  assert.deepEqual(await names({ style: 'fine-line' }), ['Encre Noire']);
  assert.deepEqual(await names({ availability: 'open' }), ['Encre Noire', 'Studio Réaliste']);
  assert.deepEqual(await names({ availability: 'nonsense' }), ['Encre Noire', 'Studio Réaliste', 'Vieux Port', 'Atelier']);
  // A cap excludes artists who do not publish a minimum budget.
  assert.deepEqual(await names({ budgetMax: 300 }), ['Vieux Port', 'Atelier']);
  assert.deepEqual(await names({ query: 'lyon', budgetMax: 300, availability: 'paused' }), ['Atelier']);

  // Sorting.
  assert.deepEqual(await names({ sort: 'budget_asc' }), ['Atelier', 'Vieux Port', 'Encre Noire', 'Studio Réaliste']);
  assert.deepEqual((await names({ sort: 'open' })).slice(0, 2), ['Encre Noire', 'Studio Réaliste']);

  // Paging: stable order, no overlap, the total travels with every page.
  const first = await search({ limit: 3, offset: 0 });
  const second = await search({ limit: 3, offset: 3 });
  assert.deepEqual([...first, ...second].map((r) => r.blaze), all.map((r) => r.blaze));
  assert.ok(first.every((r) => r.total === 4) && second.every((r) => r.total === 4));
  assert.equal((await search({ limit: 100000 })).length, 4);
  assert.equal((await search({ limit: -5, offset: -5 })).length, 1);

  for (const uid of created) await db.query(`delete from auth.users where id = $1`, [uid]);
});

// ── push delivery ────────────────────────────────────────────

test('notifications are forwarded to send-push once configured, and never blocked by it', async () => {
  // Minimal stand-ins for pg_net and Vault, which only exist on hosted Supabase.
  await db.exec(`
    create schema net;
    create table net.calls (url text, body jsonb, headers jsonb);
    create function net.http_post(url text, body jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb)
      returns bigint language plpgsql as $$
      begin
        insert into net.calls values (url, body, headers);
        return 1;
      end $$;
    create schema vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
  `);
  const calls = () => rows(`select url, body, headers from net.calls`);
  const notify = (title) => db.query(
    `select public.notify_user($1, 'system', $2, 'Corps du message', '{"request_id":"r1"}'::jsonb)`, [ids.outsider, title],
  );
  const delivered = async (title) =>
    (await one(`select count(*)::int as n from public.notifications where user_id = $1 and title = $2`, [ids.outsider, title])).n;

  // Not configured: the notification exists, nothing is sent.
  await notify('Sans configuration');
  assert.equal(await delivered('Sans configuration'), 1);
  assert.equal((await calls()).length, 0);

  await db.exec(`
    insert into vault.decrypted_secrets values
      ('push_function_url', 'https://project.example/functions/v1/send-push'),
      ('push_service_role_key', 'service-role-secret');
  `);
  await notify('Avec configuration');
  const [call] = await calls();
  assert.equal(call.url, 'https://project.example/functions/v1/send-push');
  assert.equal(call.headers.Authorization, 'Bearer service-role-secret');
  assert.equal(call.body.userId, ids.outsider);
  assert.equal(call.body.title, 'Avec configuration');
  assert.equal(call.body.data.request_id, 'r1');
  assert.equal(call.body.data.type, 'system');

  // The secret is not reachable by API callers.
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(`select * from vault.decrypted_secrets`), DENIED);
  });

  // A broken push pipeline does not lose the notification.
  await db.exec(`
    create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb)
      returns bigint language plpgsql as $$ begin raise exception 'network down'; end $$;
  `);
  await notify('Push en panne');
  assert.equal(await delivered('Push en panne'), 1);

  await db.exec(`drop schema net cascade; drop schema vault cascade;`);
  await db.query(`delete from public.notifications where user_id = $1`, [ids.outsider]);
});

// ── account deletion (runs last: it removes the fixtures) ────

test('deleting an account removes its data instead of failing on foreign keys', async () => {
  // Owner-level fixtures: a finished session, its review, and a report.
  await db.query(`update public.appointments set status = 'completed' where id = $1`, [ids.appointment]);
  assert.equal(
    (await one(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'appointment_completed'`, [ids.client])).n,
    1,
  );

  // A review can only target the artist of the completed appointment.
  const otherArtist = (await one(
    `insert into public.artists (profile_id, blaze, city) values ($1, 'Autre', 'Nice') returning id`, [ids.outsider],
  )).id;
  await as(ids.client, async () => {
    await assert.rejects(
      db.query(
        `insert into public.reviews (appointment_id, artist_id, client_id, rating, comment) values ($1, $2, $3, 1, 'Faux avis')`,
        [ids.appointment, otherArtist, ids.client],
      ),
      DENIED,
    );
    await db.query(
      `insert into public.reviews (appointment_id, artist_id, client_id, rating, comment) values ($1, $2, $3, 5, 'Parfait')`,
      [ids.appointment, ids.artist, ids.client],
    );
  });
  await db.query(`delete from public.artists where id = $1`, [otherArtist]);
  await db.query(
    `insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'post', $2, 'spam')`,
    [ids.client, ids.post],
  );
  const count = async (table) => (await one(`select count(*)::int as n from public.${table}`)).n;

  // What auth.admin.deleteUser() does for the client.
  await db.query(`delete from auth.users where id = $1`, [ids.client]);
  assert.equal(await count('tattoo_requests'), 0);
  assert.equal(await count('messages'), 0);
  assert.equal(await count('appointments'), 0);
  assert.equal(await count('reviews'), 0);
  const report = await one(`select reporter_id from public.reports`);
  assert.equal(report.reporter_id, null);

  // And for an artist who still has an incoming request.
  await as(ids.outsider, () => db.query(
    `insert into public.tattoo_requests
       (client_id, artist_id, project_type, body_zone, size_category, color_preference, description, flexibility_level)
     values ($1, $2, 'new', 'dos', 'l', 'color', 'Une carpe', 'open')`,
    [ids.outsider, ids.artist],
  ));
  await db.query(`delete from auth.users where id = $1`, [ids.artistUser]);
  assert.equal(await count('artists'), 0);
  assert.equal(await count('posts'), 0);
  assert.equal(await count('tattoo_requests'), 0);
  assert.equal(await count('profiles'), 1);
});
