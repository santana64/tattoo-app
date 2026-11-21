const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLISHED = '11111111-1111-4111-8111-111111111111';
const DRAFT = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const OUTSIDER = '44444444-4444-4444-8444-444444444444';
const ARTIST = '55555555-5555-4555-8555-555555555555';

test('draft post reactions stay private in direct SQL and SECURITY DEFINER counts', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec([
      'create role anon nologin;',
      'create role authenticated nologin;',
      'create schema auth;',
      "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
      'create table public.profiles(id uuid primary key);',
      'create table public.artists(id uuid primary key, profile_id uuid not null);',
      'create table public.posts(id uuid primary key, artist_id uuid not null, is_published boolean);',
      'create table public.post_reactions(post_id uuid not null, user_id uuid not null, emoji text not null);',
      'alter table public.posts enable row level security;',
      'alter table public.post_reactions enable row level security;',
      'create policy posts_public on public.posts for select to anon, authenticated using (is_published is true);',
      'create policy posts_owner on public.posts for select to authenticated using (exists(select 1 from public.artists a where a.id=posts.artist_id and a.profile_id=auth.uid()));',
      'create policy reactions_select_all on public.post_reactions for select to anon, authenticated using (true);',
      'grant usage on schema public, auth to anon, authenticated;',
      'grant select on public.profiles, public.artists, public.posts, public.post_reactions to anon, authenticated;',
    ].join('\n'));
    await db.query('insert into public.profiles(id) values ($1),($2)', [OWNER, OUTSIDER]);
    await db.query('insert into public.artists(id,profile_id) values ($1,$2)', [ARTIST, OWNER]);
    await db.query('insert into public.posts(id,artist_id,is_published) values ($1,$3,true),($2,$3,false)', [PUBLISHED, DRAFT, ARTIST]);
    await db.query("insert into public.post_reactions(post_id,user_id,emoji) values ($1,$3,'fire'),($2,$3,'clap')", [PUBLISHED, DRAFT, OUTSIDER]);

    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261118075629_secure_post_reaction_visibility.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Safe to reapply.

    async function as(uid, fn) {
      const role = uid ? 'authenticated' : 'anon';
      await db.exec("select set_config('request.jwt.claim.sub', '" + (uid || '') + "', false); set role " + role + ';');
      try { await fn(); }
      finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
    }
    async function visible(postId) {
      const raw = await db.query('select count(*)::int as n from public.post_reactions where post_id=$1', [postId]);
      const rpc = await db.query('select coalesce(sum(total),0)::int as n from public.post_reaction_counts(array[$1::uuid])', [postId]);
      return { raw: raw.rows[0].n, rpc: rpc.rows[0].n };
    }
    await as(null, async () => {
      assert.deepEqual(await visible(PUBLISHED), { raw: 1, rpc: 1 });
      assert.deepEqual(await visible(DRAFT), { raw: 0, rpc: 0 });
    });
    await as(OUTSIDER, async () => {
      assert.deepEqual(await visible(PUBLISHED), { raw: 1, rpc: 1 });
      assert.deepEqual(await visible(DRAFT), { raw: 0, rpc: 0 });
    });
    await as(OWNER, async () => {
      assert.deepEqual(await visible(PUBLISHED), { raw: 1, rpc: 1 });
      assert.deepEqual(await visible(DRAFT), { raw: 1, rpc: 1 });
    });
  } finally {
    await db.close();
  }
});
