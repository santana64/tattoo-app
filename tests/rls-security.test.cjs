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

const DENIED = /permission denied|row-level security|not_request_party|not_admin/;

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
  for (const file of ['005_p0_security.sql', '006_notifications_and_reviews.sql', '007_push_delivery.sql', '008_artist_search.sql', '009_moderation.sql', '010_reels.sql', '011_studio.sql', '012_booking_care.sql']) {
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

test('portfolio previews are balanced per artist and exclude unpublished work', async () => {
  const secondUser = await createUser('preview-artist');
  let secondArtist;
  await as(secondUser, async () => {
    await db.query(`update public.profiles set role = 'artist' where id = $1`, [secondUser]);
    secondArtist = (await one(
      `insert into public.artists (profile_id, blaze, city) values ($1, 'Second atelier', 'Lyon') returning id`,
      [secondUser],
    )).id;
    await db.query(
      `insert into public.posts (artist_id, media_url, is_published)
       values ($1, 'https://example.test/second.jpg', true),
              ($1, 'https://example.test/draft.jpg', false)`,
      [secondArtist],
    );
  });
  await as(ids.artistUser, async () => {
    for (let i = 0; i < 8; i++) {
      await db.query(
        `insert into public.posts (artist_id, media_url, is_published, published_at)
         values ($1, $2, true, now() + ($3 || ' seconds')::interval)`,
        [ids.artist, `https://example.test/work-${i}.jpg`, i],
      );
    }
  });

  await as(null, async () => {
    const previews = await rows(
      `select * from public.artist_portfolio_previews($1::uuid[], 3)`,
      [[ids.artist, secondArtist]],
    );
    assert.equal(previews.filter((r) => r.artist_id === ids.artist).length, 3);
    assert.deepEqual(previews.filter((r) => r.artist_id === secondArtist).map((r) => r.media_url),
      ['https://example.test/second.jpg']);
    assert.equal(previews.some((r) => r.media_url.endsWith('/draft.jpg')), false);
  });
  await as(ids.artistUser, () => db.query(
    `delete from public.posts where artist_id = $1 and media_url like 'https://example.test/work-%'`,
    [ids.artist],
  ));
  await db.query(`delete from auth.users where id = $1`, [secondUser]);
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

// ── reels ────────────────────────────────────────────────────

test('reels: uploaded videos and genuine TikTok / Instagram links only', async () => {
  const CHECK = /violates check constraint/;
  const insert = (uid, values) => as(uid, () => db.query(
    `insert into public.posts (artist_id, media_url, media_type, embed_provider, thumbnail_url)
     values ($1, $2, $3, $4, $5) returning id`,
    [ids.artist, values.url, values.type ?? 'video', values.provider ?? null, values.thumbnail ?? null],
  ));

  // What the app sends for each kind of reel.
  await insert(ids.artistUser, { url: 'https://cdn.example/a/1.mp4', thumbnail: 'https://cdn.example/a/1.jpg' });
  await insert(ids.artistUser, { url: 'https://www.tiktok.com/@atelier.noir/video/7301234567890123456', provider: 'tiktok' });
  await insert(ids.artistUser, { url: 'https://www.instagram.com/reel/Cx1-AbC_d9Z/', provider: 'instagram' });

  // A linked reel must be a real video page of the named platform.
  for (const bad of [
    { url: 'https://evil.example/player', provider: 'tiktok' },
    { url: 'https://www.tiktok.com.evil.example/@a/video/7301234567890123456', provider: 'tiktok' },
    { url: 'https://www.tiktok.com/@a/video/7301234567890123456?x=1', provider: 'tiktok' },
    { url: 'https://www.tiktok.com/@a/video/7301234567890123456', provider: 'instagram' },
    { url: 'https://www.instagram.com/reel/Cx1-AbC_d9Z/', provider: 'tiktok' },
    { url: 'https://www.instagram.com/reel/Cx1-AbC_d9Z/embed', provider: 'instagram' },
    { url: 'https://www.youtube.com/watch?v=abc', provider: 'youtube' },
    { url: 'https://www.instagram.com/reel/Cx1-AbC_d9Z/', provider: 'instagram', type: 'photo' },
    { url: 'https://cdn.example/a/2.mp4', thumbnail: 'javascript:alert(1)' },
    { url: 'https://cdn.example/a/2.mp4', thumbnail: 'http://cdn.example/a/2.jpg' },
  ]) {
    await assert.rejects(insert(ids.artistUser, bad), CHECK, JSON.stringify(bad));
  }

  // Still only the artist who owns the page.
  await assert.rejects(
    insert(ids.client, { url: 'https://www.instagram.com/reel/Cx1-AbC_d9Z/', provider: 'instagram' }),
    DENIED,
  );

  // Visitors see them; the counters still cannot be forged.
  await as(null, async () => {
    const videos = await rows(`select embed_provider from public.posts where media_type = 'video' order by embed_provider nulls first`);
    assert.deepEqual(videos.map((v) => v.embed_provider), [null, 'instagram', 'tiktok']);
  });
  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(`update public.posts set likes_count = 500 where media_type = 'video'`), DENIED);
    const edited = await db.query(`update public.posts set thumbnail_url = 'https://cdn.example/a/new.jpg' where embed_provider is null and media_type = 'video'`);
    assert.equal(edited.affectedRows, 1);
  });

  const bucket = await one(`select allowed_mime_types from storage.buckets where id = 'posts-media'`);
  assert.ok(bucket.allowed_mime_types.includes('video/quicktime'));
  assert.ok(bucket.allowed_mime_types.includes('video/mp4'));

  await db.exec(`delete from public.posts where media_type = 'video';`);
  assert.equal((await one(`select stat_posts from public.artists where id = $1`, [ids.artist])).stat_posts, 1);
});

// ── moderation ───────────────────────────────────────────────

test('only administrators moderate, and nobody can make themselves one', async () => {
  for (const uid of [ids.client, ids.artistUser]) {
    await as(uid, async () => {
      await assert.rejects(db.query(`select is_admin from public.profiles`), DENIED);
      await assert.rejects(db.query(`update public.profiles set is_admin = true where id = $1`, [uid]), DENIED);
      await assert.rejects(db.query(`select * from public.admin_list_reports('pending')`), DENIED);
      await assert.rejects(db.query(`select * from public.admin_list_verifications()`), DENIED);
      await assert.rejects(db.query(`select public.admin_set_ban($1, true)`, [ids.outsider]), DENIED);
      await assert.rejects(db.query(`select public.admin_review_verification($1, true)`, [ids.artist]), DENIED);
      await assert.rejects(db.query(`select public.assert_admin()`), DENIED);
      assert.equal((await one(`select public.is_admin() as admin`)).admin, false);
    });
  }
  await as(null, async () => {
    await assert.rejects(db.query(`select public.is_admin()`), DENIED);
    await assert.rejects(db.query(`select * from public.admin_list_reports('pending')`), DENIED);
  });
});

test('an administrator handles reports, verification and bans end to end', async () => {
  await db.query(`update public.profiles set is_admin = true where id = $1`, [ids.outsider]);

  // A client reports the artist's post; the artist asks to be verified.
  await as(ids.client, () => db.query(
    `insert into public.reports (reporter_id, target_type, target_id, reason, description) values ($1, 'post', $2, 'inappropriate', 'Contenu choquant')`,
    [ids.client, ids.post],
  ));
  await as(ids.artistUser, async () => {
    assert.equal((await one(`select public.request_verification() as status`)).status, 'submitted');
    // Asking twice changes nothing.
    assert.equal((await one(`select public.request_verification() as status`)).status, 'submitted');
  });
  await as(ids.client, async () => {
    await assert.rejects(db.query(`select public.request_verification()`), /not_an_artist/);
  });

  await as(ids.outsider, async () => {
    assert.equal((await one(`select public.is_admin() as admin`)).admin, true);

    const [report] = await rows(`select * from public.admin_list_reports('pending')`);
    assert.equal(report.target_label, 'Publication de Atelier');
    assert.equal(report.target_excerpt, 'Dragon');
    assert.equal(report.reason, 'inappropriate');
    assert.equal(report.target_owner_id, ids.artistUser);
    assert.equal(report.target_owner_banned, false);

    const [pending] = await rows(`select * from public.admin_list_verifications()`);
    assert.equal(pending.artist_id, ids.artist);
    await db.query(`select public.admin_review_verification($1, true)`, [ids.artist]);
    await assert.rejects(db.query(`select public.admin_review_verification($1, true)`, [ids.artist]), /verification_not_pending/);
    assert.equal((await rows(`select * from public.admin_list_verifications()`)).length, 0);

    await assert.rejects(db.query(`select public.admin_resolve_report($1, 'nonsense')`, [report.id]), /invalid_status/);
    await db.query(`select public.admin_resolve_report($1, 'actioned', true, true, '  Retiré  ')`, [report.id]);
    assert.equal((await rows(`select * from public.admin_list_reports('pending')`)).length, 0);
    const [closed] = await rows(`select * from public.admin_list_reports('actioned')`);
    assert.equal(closed.resolution_note, 'Retiré');
    assert.equal(closed.target_owner_banned, true);

    // An administrator cannot be banned from the moderation screen.
    await assert.rejects(db.query(`select public.admin_set_ban($1, true)`, [ids.outsider]), /profile_not_found_or_admin/);
  });

  const artist = await one(`select is_verified, verification_status from public.artists where id = $1`, [ids.artist]);
  assert.deepEqual(artist, { is_verified: true, verification_status: 'approved' });
  assert.equal((await one(`select is_published from public.posts where id = $1`, [ids.post])).is_published, false);
  assert.equal(
    (await one(`select count(*)::int as n from public.notifications where user_id = $1 and title = 'Profil vérifié'`, [ids.artistUser])).n,
    1,
  );

  // The banned artist still reads their data but can no longer publish or write.
  await as(ids.artistUser, async () => {
    assert.equal((await one(`select public.is_banned() as banned`)).banned, true);
    assert.ok((await rows(`select id from public.tattoo_requests`)).length > 0);
    await assert.rejects(
      db.query(`insert into public.posts (artist_id, media_url) values ($1, 'https://example.test/c.jpg')`, [ids.artist]),
      DENIED,
    );
    await assert.rejects(
      db.query(`insert into public.messages (request_id, sender_id, content) values ($1, $2, 'Encore là')`, [ids.request, ids.artistUser]),
      DENIED,
    );
  });

  // Lifting the ban restores the account; leave the fixtures as they were.
  await as(ids.outsider, () => db.query(`select public.admin_set_ban($1, false)`, [ids.artistUser]));
  await as(ids.artistUser, async () => {
    const sent = await db.query(
      `insert into public.messages (request_id, sender_id, content) values ($1, $2, 'De retour')`, [ids.request, ids.artistUser],
    );
    assert.equal(sent.affectedRows, 1);
  });
  await db.exec(`delete from public.reports;`);
  await db.query(`update public.posts set is_published = true where id = $1`, [ids.post]);
  await db.query(`update public.artists set is_verified = false, verification_status = 'pending' where id = $1`, [ids.artist]);
  await db.query(`update public.profiles set is_admin = false where id = $1`, [ids.outsider]);
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

// ── studio: availability, follows, waitlist, flashes, series (migration 011) ──

test('free slots follow opening hours and skip booked or blocked time', async () => {
  const week = JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: '09:00', closes: '18:00' })));
  await as(ids.client, async () => {
    await assert.rejects(db.query(`select public.set_weekly_schedule($1::jsonb)`, [week]), /not_artist/);
  });
  await as(ids.artistUser, async () => {
    await assert.rejects(
      db.query(`select public.set_weekly_schedule('[{"day": 1, "opens": "10:00", "closes": "10:30"}]'::jsonb)`),
      /invalid_schedule/,
    );
    await assert.rejects(
      db.query(`select public.set_weekly_schedule('[{"day": 9, "opens": "10:00", "closes": "18:00"}]'::jsonb)`),
      /invalid_schedule/,
    );
    const saved = await rows(`select * from public.set_weekly_schedule($1::jsonb)`, [week]);
    await db.query(`update public.artists set booking_status = 'open' where id = $1`, [ids.artist]);
    assert.equal(saved.length, 7);
  });

  const slotsSql = `
    select starts_at, ends_at,
           extract(hour from starts_at at time zone 'Europe/Paris')::int as paris_hour,
           starts_at >= now() + interval '24 hours' as far_enough
    from public.artist_free_slots($1, 7, 120)`;
  const free = await as(null, () => rows(slotsSql, [ids.artist]));
  assert.ok(free.length > 20, 'a full week of opening hours yields slots');
  assert.ok(free.every((s) => s.far_enough), 'nothing inside the 24 hour notice');
  assert.ok(free.every((s) => s.paris_hour >= 9 && s.paris_hour <= 16), 'sessions fit inside 09:00-18:00, Paris time');

  // Blocking a period removes the slots that touch it.
  const first = free[0];
  await as(ids.artistUser, () => db.query(
    `insert into public.artist_availability (artist_id, starts_at, ends_at, is_blocked, label) values ($1, $2, $3, true, 'Convention')`,
    [ids.artist, first.starts_at, first.ends_at],
  ));
  const afterBlock = await as(null, () => rows(slotsSql, [ids.artist]));
  assert.ok(!afterBlock.some((s) => +s.starts_at === +first.starts_at), 'blocked slot is gone');
  assert.ok(afterBlock.length > 0);

  // So does a session on offer to a client.
  const later = afterBlock[afterBlock.length - 1];
  await as(ids.artistUser, () => db.query(`select public.propose_appointment($1, $2, $3)`, [ids.request, later.starts_at, later.ends_at]));
  const afterOffer = await as(null, () => rows(slotsSql, [ids.artist]));
  assert.ok(!afterOffer.some((s) => +s.starts_at === +later.starts_at), 'offered slot is gone');

  const stats = await as(null, () => one(`select * from public.artist_public_stats(array[$1]::uuid[])`, [ids.artist]));
  assert.ok(stats.next_slot, 'cards can show the next free slot');

  // A closed book offers nothing.
  await as(ids.artistUser, () => db.query(`update public.artists set booking_status = 'paused' where id = $1`, [ids.artist]));
  assert.equal((await as(null, () => rows(slotsSql, [ids.artist]))).length, 0);
  assert.equal((await as(null, () => one(`select next_slot from public.artist_public_stats(array[$1]::uuid[])`, [ids.artist]))).next_slot, null);
});

test('the waitlist is joined through the function and told once when the book reopens', async () => {
  await as(ids.client, async () => {
    await assert.rejects(
      db.query(`insert into public.artist_waitlist (artist_id, user_id) values ($1, $2)`, [ids.artist, ids.client]),
      DENIED,
    );
    await db.query(`select public.set_waitlist($1, true)`, [ids.artist]);
    await db.query(`select public.set_waitlist($1, true)`, [ids.artist]);
    assert.equal((await rows(`select status from public.artist_waitlist where artist_id = $1`, [ids.artist])).length, 1);
  });
  await as(null, async () => {
    await assert.rejects(db.query(`select public.set_waitlist($1, true)`, [ids.artist]), DENIED);
  });
  await as(ids.outsider, async () => {
    assert.equal((await rows(`select 1 from public.artist_waitlist`)).length, 0, 'another user waitlist entry is private');
  });

  const told = () => one(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'book_reopened'`, [ids.client]);
  await as(ids.artistUser, () => db.query(`update public.artists set booking_status = 'open' where id = $1`, [ids.artist]));
  assert.equal((await told()).n, 1);
  await as(ids.artistUser, async () => {
    await db.query(`update public.artists set booking_status = 'paused' where id = $1`, [ids.artist]);
    await db.query(`update public.artists set booking_status = 'open' where id = $1`, [ids.artist]);
  });
  assert.equal((await told()).n, 1, 'no second notification without joining again');
});

test('follows are private, self-attributed, counted, and notify both sides', async () => {
  const follow = `insert into public.artist_follows (follower_id, artist_id) values ($1, $2)`;
  await as(null, async () => {
    await assert.rejects(db.query(follow, [ids.client, ids.artist]), DENIED);
  });
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(follow, [ids.client, ids.artist]), DENIED);
  });
  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(follow, [ids.artistUser, ids.artist]), DENIED);
  });
  await as(ids.client, () => db.query(follow, [ids.client, ids.artist]));
  await as(ids.outsider, async () => {
    assert.equal((await rows(`select 1 from public.artist_follows`)).length, 0, 'who follows whom is private');
  });
  const followers = async () =>
    (await as(null, () => one(`select followers from public.artist_public_stats(array[$1]::uuid[])`, [ids.artist]))).followers;
  assert.equal(await followers(), 1);
  assert.equal((await one(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'new_follower'`, [ids.artistUser])).n, 1);

  // Publishing tells followers once; a draft does not, until it goes live.
  const posted = () => one(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'new_post'`, [ids.client]);
  let draft;
  await as(ids.artistUser, async () => {
    await db.query(`insert into public.posts (artist_id, media_url, is_published) values ($1, 'https://example.test/b.jpg', true)`, [ids.artist]);
    draft = (await one(`insert into public.posts (artist_id, media_url, is_published) values ($1, 'https://example.test/c.jpg', false) returning id`, [ids.artist])).id;
  });
  assert.equal((await posted()).n, 1);
  await as(ids.artistUser, async () => {
    await db.query(`update public.posts set is_published = true where id = $1`, [draft]);
    await db.query(`update public.posts set caption = 'Edit' where id = $1`, [draft]);
  });
  assert.equal((await posted()).n, 2);

  await as(ids.client, () => db.query(`delete from public.artist_follows where artist_id = $1`, [ids.artist]));
  assert.equal(await followers(), 0);
});

test('flashes are sold by their artist only and a flash request must be genuine', async () => {
  const flashSql = `insert into public.flash_designs (artist_id, title, style, price, image_url, is_published)
                    values ($1, $2, 'traditionnel', 180, 'https://example.test/flash.jpg', $3) returning id`;
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(flashSql, [ids.artist, 'Rose', true]), DENIED);
  });
  let flash; let hidden;
  await as(ids.artistUser, async () => {
    flash = (await one(flashSql, [ids.artist, 'Rose', true])).id;
    hidden = (await one(flashSql, [ids.artist, 'Dague', false])).id;
  });
  await as(null, async () => {
    const visible = await rows(`select id from public.flash_designs where artist_id = $1`, [ids.artist]);
    assert.deepEqual(visible.map((f) => f.id), [flash], 'drafts stay private');
  });
  assert.equal((await as(null, () => one(`select flash_count from public.artist_public_stats(array[$1]::uuid[])`, [ids.artist]))).flash_count, 1);

  const requestSql = `insert into public.tattoo_requests
      (client_id, artist_id, project_type, body_zone, size_category, color_preference, description, flexibility_level, flash_design_id, preferred_slots)
    values ($1, $2, 'new', 'bras', 's', 'black_grey', 'Le flash Rose', 'precise', $3, $4::timestamptz[])
    returning is_flash`;
  const soon = (n) => new Date(Date.now() + n * 86_400_000).toISOString();
  await as(ids.client, async () => {
    assert.equal((await one(requestSql, [ids.client, ids.artist, flash, [soon(3), soon(4)]])).is_flash, true);
    assert.equal((await one(requestSql, [ids.client, ids.artist, null, []])).is_flash, false);
    await assert.rejects(db.query(requestSql, [ids.client, ids.artist, hidden, []]), /flash_unavailable/);
    await assert.rejects(
      db.query(requestSql, [ids.client, ids.artist, null, [soon(1), soon(2), soon(3), soon(4)]]),
      /tattoo_requests_preferred_slots_max/,
    );
  });
  await as(ids.artistUser, () => db.query(`update public.flash_designs set sold_copies = 1 where id = $1`, [flash]));
  await as(ids.client, async () => {
    await assert.rejects(db.query(requestSql, [ids.client, ids.artist, flash, []]), /flash_unavailable/);
  });
});

test('a piece carries a label and joins only a series of its own artist', async () => {
  const otherUser = await createUser('second-artist');
  let otherSeries;
  await as(otherUser, async () => {
    await db.query(`update public.profiles set role = 'artist' where id = $1`, [otherUser]);
    const other = (await one(`insert into public.artists (profile_id, blaze, city) values ($1, 'Voisin', 'Nantes') returning id`, [otherUser])).id;
    otherSeries = (await one(`insert into public.artist_series (artist_id, title) values ($1, 'Botanique') returning id`, [other])).id;
    await assert.rejects(
      db.query(`insert into public.artist_series (artist_id, title) values ($1, 'Intrus')`, [ids.artist]),
      DENIED,
    );
  });
  await as(ids.artistUser, async () => {
    const series = (await one(`insert into public.artist_series (artist_id, title) values ($1, 'Cicatrises') returning id`, [ids.artist])).id;
    await db.query(
      `update public.posts set title = 'Dragon', body_zone = 'Avant-bras', session_hours = 4.5, is_healed = true, series_id = $2 where id = $1`,
      [ids.post, series],
    );
    await assert.rejects(db.query(`update public.posts set series_id = $2 where id = $1`, [ids.post, otherSeries]), /series_not_owned/);
    await assert.rejects(db.query(`update public.posts set session_hours = 0 where id = $1`, [ids.post]), /posts_label_check/);
  });
  const label = await as(null, () => one(`select title, body_zone, session_hours, is_healed from public.posts where id = $1`, [ids.post]));
  assert.equal(label.title, 'Dragon');
  assert.equal(Number(label.session_hours), 4.5);
  assert.equal(label.is_healed, true);
  await db.query(`delete from auth.users where id = $1`, [otherUser]);
});

// ── booking care, proximity, stories, healed photos, reactions (migration 012) ──

test('an artist sets time zone, session lengths and notice through the function only', async () => {
  const set = `select public.set_booking_settings($1, $2::int[], $3)`;
  await as(ids.client, async () => {
    await assert.rejects(db.query(set, ['Europe/Paris', [120], 48]), /not_artist/);
  });
  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(set, ['Mars/Olympus', [120], 48]), /invalid_timezone/);
    await assert.rejects(db.query(set, ['Europe/Paris', [45], 48]), /invalid_durations/);
    await assert.rejects(db.query(set, ['Europe/Paris', [], 48]), /invalid_durations/);
    await assert.rejects(db.query(set, ['Europe/Paris', [120], 400]), /invalid_notice/);
    await assert.rejects(db.query(`update public.artists set timezone = 'Asia/Tokyo' where id = $1`, [ids.artist]), DENIED);
    await assert.rejects(db.query(`update public.artists set cancel_notice_hours = 0 where id = $1`, [ids.artist]), DENIED);
    await db.query(set, ['America/Toronto', [240, 120, 240], 72]);
  });
  const saved = await as(null, () => one(
    `select timezone, session_durations, cancel_notice_hours from public.artists where id = $1`, [ids.artist],
  ));
  assert.equal(saved.timezone, 'America/Toronto');
  assert.deepEqual(saved.session_durations, [120, 240], 'sorted and de-duplicated');
  assert.equal(saved.cancel_notice_hours, 72);

  // Slots now follow the artist's own clock and shortest session…
  const hours = async (duration) => (await as(null, () => rows(
    `select extract(hour from starts_at at time zone 'America/Toronto')::int as h,
            (extract(epoch from ends_at - starts_at) / 60)::int as minutes
     from public.artist_free_slots($1, 7, $2)`, [ids.artist, duration],
  )));
  const shortest = await hours(null);
  assert.ok(shortest.length > 0);
  assert.ok(shortest.every((s) => s.h >= 9 && s.h <= 16 && s.minutes === 120), '09:00-18:00 Toronto time, two-hour sessions');
  // …and a long session only starts where it still fits before closing.
  const long = await hours(240);
  assert.ok(long.length > 0 && long.every((s) => s.h >= 9 && s.h <= 14 && s.minutes === 240));
});

test('artists are found by distance from coordinates rounded to about a kilometre', async () => {
  const locate = `select public.set_artist_location($1, $2)`;
  await as(ids.client, async () => {
    await assert.rejects(db.query(locate, [48.8566, 2.3522]), /not_artist/);
  });
  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(locate, [120, 2.35]), /invalid_location/);
    await assert.rejects(db.query(locate, [48.85, null]), /invalid_location/);
    await db.query(locate, [48.856614, 2.352222]);
  });
  const stored = await as(null, () => one(`select latitude, longitude from public.artists where id = $1`, [ids.artist]));
  assert.equal(stored.latitude, 48.86);
  assert.equal(stored.longitude, 2.35);

  const near = (lat, lng, radius) => as(null, () => rows(`select * from public.artists_nearby($1, $2, $3)`, [lat, lng, radius]));
  const fromVersailles = await near(48.8049, 2.1204, 50);
  assert.equal(fromVersailles.length, 1);
  assert.equal(fromVersailles[0].artist_id, ids.artist);
  assert.ok(Number(fromVersailles[0].distance_km) > 10 && Number(fromVersailles[0].distance_km) < 25);
  assert.equal((await near(45.764, 4.8357, 50)).length, 0, 'Lyon is not within 50 km of Paris');
  assert.equal((await near(45.764, 4.8357, 500)).length, 1);
  assert.equal((await near(999, 4.8357, 500)).length, 0, 'nonsense coordinates match nothing');
});

test('a client cancels or moves a session within the notice period, the artist at any time', async () => {
  const propose = (start, end) => as(ids.artistUser, async () => (await one(
    `select (public.propose_appointment($1, $2, $3)).id as id`, [ids.request, start, end],
  )).id);
  const accept = (id) => as(ids.client, () => db.query(`select public.respond_to_appointment($1, true)`, [id]));
  const at = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const cancel = `select (public.cancel_appointment($1, $2, $3::timestamptz[])).status as status`;
  const requestRow = () => one(`select status, preferred_slots from public.tattoo_requests where id = $1`, [ids.request]);
  const notified = async (user, type) =>
    (await one(`select count(*)::int as n from public.notifications where user_id = $1 and type = $2`, [user, type])).n;

  // Far enough ahead (notice is 72 h): the client may cancel.
  let appt = await propose(at(200), at(203));
  await accept(appt);
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(cancel, [appt, null, []]), /not_appointment_party/);
  });
  const canceledBefore = await notified(ids.artistUser, 'appointment_canceled');
  await as(ids.client, async () => {
    assert.equal((await one(cancel, [appt, '  Empêchement  ', []])).status, 'canceled');
    await assert.rejects(db.query(cancel, [appt, null, []]), /not_cancelable/);
  });
  const row = await one(`select canceled_by, cancel_reason from public.appointments where id = $1`, [appt]);
  assert.deepEqual(row, { canceled_by: 'client', cancel_reason: 'Empêchement' });
  assert.equal((await requestRow()).status, 'accepted', 'the request can be booked again');
  assert.equal(await notified(ids.artistUser, 'appointment_canceled'), canceledBefore + 1, 'told once, not twice');

  // Inside the notice: the client cannot, the artist can.
  appt = await propose(at(30), at(33));
  await accept(appt);
  await as(ids.client, async () => {
    await assert.rejects(db.query(cancel, [appt, null, []]), /notice_too_short/);
  });
  const clientTold = await notified(ids.client, 'appointment_canceled');
  await as(ids.artistUser, async () => {
    assert.equal((await one(cancel, [appt, null, []])).status, 'canceled');
  });
  assert.equal(await notified(ids.client, 'appointment_canceled'), clientTold + 1);

  // Asking for another date replaces the preferred slots.
  appt = await propose(at(300), at(303));
  await accept(appt);
  const wanted = [at(400), at(424), at(448), at(472)];
  await as(ids.client, () => db.query(cancel, [appt, null, wanted]));
  const moved = await requestRow();
  assert.equal(moved.status, 'accepted');
  assert.equal(moved.preferred_slots.length, 3, 'never more than three');
  assert.equal(await notified(ids.artistUser, 'appointment_reschedule'), 1);
});

test('both sides are reminded 48 h and 24 h before a session, once each', async () => {
  const at = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();
  let appt;
  await as(ids.artistUser, async () => {
    appt = (await one(`select (public.propose_appointment($1, $2, $3)).id as id`, [ids.request, at(30), at(33)])).id;
  });
  await as(ids.client, () => db.query(`select public.respond_to_appointment($1, true)`, [appt]));
  ids.reminded = appt;

  await as(ids.client, async () => {
    await assert.rejects(db.query(`select public.send_appointment_reminders()`), DENIED);
  });
  const reminders = (kind) => rows(
    `select user_id from public.notifications where type = 'appointment_reminder' and data->>'appointment_id' = $1 and data->>'kind' = $2`,
    [appt, kind],
  );
  assert.ok((await one(`select public.send_appointment_reminders() as n`)).n >= 1);
  assert.deepEqual((await reminders('48h')).map((r) => r.user_id).sort(), [ids.client, ids.artistUser].sort());
  assert.equal((await one(`select public.send_appointment_reminders() as n`)).n, 0, 'not sent twice');

  await db.query(`update public.appointments set starts_at = now() + interval '20 hours', ends_at = now() + interval '23 hours' where id = $1`, [appt]);
  assert.equal((await one(`select public.send_appointment_reminders() as n`)).n, 1);
  assert.equal((await reminders('24h')).length, 2);
  assert.equal((await one(`select public.send_appointment_reminders() as n`)).n, 0);
});

test('a story lasts 24 hours at most and each viewer counts once', async () => {
  const post = `insert into public.stories (artist_id, media_url, caption, expires_at) values ($1, 'https://example.test/s.jpg', 'Du jour', now() + $2::interval) returning id`;
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(post, [ids.artist, '24 hours']), DENIED);
  });
  let story;
  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(post, [ids.artist, '3 days']), DENIED);
    story = (await one(post, [ids.artist, '24 hours'])).id;
    await assert.rejects(db.query(`update public.stories set expires_at = now() + interval '30 days' where id = $1`, [story]), DENIED);
    await assert.rejects(db.query(`update public.stories set view_count = 9999 where id = $1`, [story]), DENIED);
  });
  assert.equal((await as(null, () => rows(`select id from public.stories where artist_id = $1`, [ids.artist]))).length, 1);

  await as(ids.client, async () => {
    await assert.rejects(db.query(`insert into public.story_views (story_id, viewer_id) values ($1, $2)`, [story, ids.client]), DENIED);
    await db.query(`select public.record_story_view($1)`, [story]);
    await db.query(`select public.record_story_view($1)`, [story]);
  });
  await as(ids.artistUser, () => db.query(`select public.record_story_view($1)`, [story]));
  assert.equal((await one(`select view_count from public.stories where id = $1`, [story])).view_count, 1);

  // An expired story disappears for visitors.
  await db.query(`update public.stories set expires_at = now() - interval '1 minute', created_at = now() - interval '1 day' where id = $1`, [story]);
  assert.equal((await as(null, () => rows(`select id from public.stories where artist_id = $1`, [ids.artist]))).length, 0);
});

test('a healed photo comes from the client of a finished session and is private until they say so', async () => {
  // Same effect as the artist closing the session.
  await db.query(`update public.appointments set status = 'completed' where id = $1`, [ids.appointment]);
  const send = `insert into public.healed_photos (appointment_id, artist_id, client_id, photo_url, note) values ($1, $2, $3, 'https://example.test/h.jpg', $4) returning id, artist_id, client_id`;
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(send, [ids.appointment, ids.artist, ids.outsider, null]), /not_completed_session/);
  });
  await as(ids.client, async () => {
    await assert.rejects(db.query(send, [ids.reminded, ids.artist, ids.client, null]), /not_completed_session/, 'the session must be finished');
  });
  let photo;
  await as(ids.client, async () => {
    // Forged parties are overwritten from the appointment.
    const saved = await one(send, [ids.appointment, null, ids.outsider, '  Six semaines après  ']);
    assert.equal(saved.artist_id, ids.artist);
    assert.equal(saved.client_id, ids.client);
    photo = saved.id;
  });
  const publicPhotos = () => as(null, () => rows(`select id from public.healed_photos where artist_id = $1`, [ids.artist]));
  assert.equal((await publicPhotos()).length, 0);
  assert.equal((await as(ids.artistUser, () => rows(`select id from public.healed_photos`))).length, 1, 'the artist sees it');
  await as(ids.artistUser, async () => {
    const forced = await db.query(`update public.healed_photos set is_public = true where id = $1`, [photo]);
    assert.equal(forced.affectedRows, 0, 'only the client decides to publish');
  });
  await as(ids.client, async () => {
    await assert.rejects(db.query(`update public.healed_photos set photo_url = 'https://evil.example/x.jpg' where id = $1`, [photo]), DENIED);
    await db.query(`update public.healed_photos set is_public = true where id = $1`, [photo]);
  });
  assert.equal((await publicPhotos()).length, 1);
  assert.equal((await one(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'healed_photo'`, [ids.artistUser])).n, 1);
});

test('reactions: one emoji per person and piece, from the fixed set', async () => {
  const react = `insert into public.post_reactions (post_id, user_id, emoji) values ($1, $2, $3)`;
  await as(null, async () => {
    await assert.rejects(db.query(react, [ids.post, ids.client, 'fire']), DENIED);
  });
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(react, [ids.post, ids.client, 'fire']), DENIED);
    await db.query(react, [ids.post, ids.outsider, 'fire']);
  });
  await as(ids.client, async () => {
    await assert.rejects(db.query(react, [ids.post, ids.client, 'pile_of_poo']), /post_reactions_emoji_check/);
    await db.query(react, [ids.post, ids.client, 'fire']);
    await assert.rejects(db.query(react, [ids.post, ids.client, 'clap']), /post_reactions_pkey/);
    await db.query(`update public.post_reactions set emoji = 'clap' where post_id = $1 and user_id = $2`, [ids.post, ids.client]);
    const stolen = await db.query(`update public.post_reactions set emoji = 'clap' where post_id = $1 and user_id = $2`, [ids.post, ids.outsider]);
    assert.equal(stolen.affectedRows, 0);
  });
  const counts = await as(null, () => rows(`select emoji, total from public.post_reaction_counts(array[$1]::uuid[]) order by emoji`, [ids.post]));
  assert.deepEqual(counts, [{ emoji: 'clap', total: 1 }, { emoji: 'fire', total: 1 }]);
  await as(ids.outsider, () => db.query(`delete from public.post_reactions where post_id = $1`, [ids.post]));
  assert.equal((await one(`select count(*)::int as n from public.post_reactions where post_id = $1`, [ids.post])).n, 1, 'only their own was removed');
});

test('anyone signed in can write to an artist: one thread, same inbox', async () => {
  const contact = `select public.contact_artist($1, $2) as id`;
  await as(null, async () => {
    await assert.rejects(db.query(contact, [ids.artist, 'Bonjour']), DENIED);
  });
  await as(ids.artistUser, async () => {
    await assert.rejects(db.query(contact, [ids.artist, 'Bonjour moi']), /artist_not_found/);
  });
  const announced = async () => (await one(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'new_request'`, [ids.artistUser])).n;
  const projectsBefore = await announced();
  let thread;
  await as(ids.outsider, async () => {
    await assert.rejects(db.query(contact, [ids.artist, ' ']), /invalid_message/);
    thread = (await one(contact, [ids.artist, 'Bonjour, faites-vous du lettrage ?'])).id;
    assert.equal((await one(contact, [ids.artist, 'Et en couleur ?'])).id, thread, 'the same thread is reused');
  });
  const request = await one(`select is_inquiry, client_id, status from public.tattoo_requests where id = $1`, [thread]);
  assert.deepEqual(request, { is_inquiry: true, client_id: ids.outsider, status: 'submitted' });
  assert.equal((await one(`select count(*)::int as n from public.messages where request_id = $1`, [thread])).n, 2);
  assert.equal(await announced(), projectsBefore, 'a question is not announced as a project');
  assert.ok((await one(`select count(*)::int as n from public.notifications where user_id = $1 and type = 'new_message' and data->>'request_id' = $2`, [ids.artistUser, thread])).n >= 1);
  // The artist answers in the ordinary conversation.
  await as(ids.artistUser, () => db.query(
    `insert into public.messages (request_id, sender_id, content) values ($1, $2, 'Oui, avec plaisir.')`, [thread, ids.artistUser],
  ));
  await as(ids.client, async () => {
    assert.equal((await rows(`select 1 from public.messages where request_id = $1`, [thread])).length, 0, 'private to the two of them');
  });
  await db.query(`delete from public.tattoo_requests where id = $1`, [thread]);
});

test('a crash report is accepted from anyone and read by administrators only', async () => {
  const report = `select public.report_client_error($1, $2, $3, $4, $5) as ok`;
  assert.equal((await as(null, () => one(report, ['TypeError: x is undefined', 'at Screen (app.js:1)', '/artist/1', 'web', '1.0.0']))).ok, true);
  assert.equal((await as(ids.client, () => one(report, ['x'.repeat(2000), null, null, null, null]))).ok, true);
  assert.equal((await as(null, () => one(report, ['   ', null, null, null, null]))).ok, false);
  const stored = await rows(`select user_id, length(message) as len from public.client_errors order by created_at`);
  assert.equal(stored.length, 2);
  assert.equal(stored[0].user_id, null);
  assert.equal(stored[1].user_id, ids.client);
  assert.equal(stored[1].len, 500, 'messages are capped');
  await as(ids.client, async () => {
    assert.equal((await rows(`select 1 from public.client_errors`)).length, 0);
    await assert.rejects(db.query(`insert into public.client_errors (message) values ('direct')`), DENIED);
  });
  await as(null, async () => {
    await assert.rejects(db.query(`select 1 from public.client_errors`), DENIED);
  });
  // The table refuses a flood.
  await db.query(`insert into public.client_errors (message) select 'flood' from generate_series(1, 60)`);
  assert.equal((await as(null, () => one(report, ['one more', null, null, null, null]))).ok, false);
});

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
