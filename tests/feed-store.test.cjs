const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

/** `followed`: artist ids the signed-in user follows; null makes the follow list fail to load. */
function loadStore(client, followed = []) {
  const source = fs.readFileSync(require.resolve('../store/feed-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const followState = {
    followedIds: new Set(followed ?? []),
    fetchFollowed: async () => followed !== null,
  };
  const stubs = {
    '@/lib/supabase': { supabase: client },
    '@/store/follow-store': { useFollowStore: { getState: () => followState } },
  };
  new Function('require', 'module', 'exports', code)(
    (name) => (Object.hasOwn(stubs, name) ? stubs[name] : require(name)), mod, mod.exports,
  );
  return mod.exports.useFeedStore;
}

/** A chainable query that records its filters and resolves to `result`. */
function recordingQuery(result, calls) {
  const query = {
    select() { return query; },
    eq(column, value) { calls.push(['eq', column, value]); return query; },
    in(column, values) { calls.push(['in', column, [...values]]); return query; },
    gt() { return query; },
    gte() { return query; },
    lt() { return query; },
    order() { return query; },
    limit() { return query; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
}

test('a refused like does not display a success or change the count', async () => {
  const store = loadStore({ from: () => ({ insert: async () => ({ error: { message: 'offline' } }) }) });
  store.setState({ posts: [{ id: 'post', likesCount: 4, isLiked: false }] });
  const result = await store.getState().toggleLike('post', 'user');
  assert.equal(result, false);
  assert.equal(store.getState().posts[0].likesCount, 4);
  assert.equal(store.getState().likedPostIds.has('post'), false);
});

test('repeated clicks during persistence add only one like', async () => {
  let release;
  const response = new Promise((resolve) => { release = resolve; });
  const store = loadStore({ from: () => ({ insert: () => response }) });
  store.setState({ posts: [{ id: 'post', likesCount: 4, isLiked: false }] });
  const first = store.getState().toggleLike('post', 'user');
  const second = store.getState().toggleLike('post', 'user');
  release({ error: null });
  await Promise.all([first, second]);
  assert.equal(store.getState().posts[0].likesCount, 5);
  assert.equal(store.getState().likedPostIds.has('post'), true);
});

test('network failure is distinguishable from an empty feed', async () => {
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, limit: async () => ({ error: { message: 'offline' } }) };
  const store = loadStore({ from: () => query });
  await store.getState().fetchFeed();
  assert.equal(store.getState().isLoading, false);
  assert.ok(store.getState().error);
});

test('the following feed only asks for posts of followed artists', async () => {
  const calls = [];
  const store = loadStore({ from: () => recordingQuery({ data: [], error: null }, calls) }, ['artist-b', 'artist-a']);
  await store.getState().fetchFeed('user', 'following');
  const filter = calls.find((c) => c[0] === 'in');
  assert.ok(filter, 'the query is filtered by artist');
  assert.equal(filter[1], 'artist_id');
  assert.deepEqual([...filter[2]].sort(), ['artist-a', 'artist-b']);
  assert.equal(store.getState().scope, 'following');
  assert.equal(store.getState().error, null);
});

test('following nobody shows an empty feed without querying posts', async () => {
  let queried = false;
  const store = loadStore({ from: () => { queried = true; return recordingQuery({ data: [], error: null }, []); } }, []);
  store.setState({ posts: [{ id: 'old', likesCount: 1, isLiked: false }] });
  await store.getState().fetchFeed('user', 'following');
  assert.equal(queried, false);
  assert.deepEqual(store.getState().posts, []);
  assert.equal(store.getState().hasMore, false);
  assert.equal(store.getState().isLoading, false);
  assert.equal(store.getState().followingKey, '');
});

test('a follow list that fails to load is an error, not an empty feed', async () => {
  const store = loadStore({ from: () => recordingQuery({ data: [], error: null }, []) }, null);
  await store.getState().fetchFeed('user', 'following');
  assert.ok(store.getState().error);
  assert.equal(store.getState().isLoading, false);
});
