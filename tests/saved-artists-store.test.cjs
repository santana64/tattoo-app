const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadStore(client) {
  const source = fs.readFileSync(require.resolve('../store/saved-artists-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => name === '@/lib/supabase' ? { supabase: client } : require(name), mod, mod.exports,
  );
  return mod.exports.useSavedArtistsStore;
}

function clientWith({ read = async () => ({ data: [], error: null }), write = async () => ({ data: [{ artist_id: 'artist' }], error: null }) } = {}) {
  return { from(table) {
    assert.equal(table, 'saved_artists');
    return {
      select: () => ({ eq: (_key, user) => read(user) }),
      insert: () => ({ select: () => ({ single: write }) }),
      delete: () => ({ eq: () => ({ eq: () => ({ select: write }) }) }),
    };
  } };
}

test('favorites load from the account, without prototype defaults', async () => {
  const store = loadStore(clientWith({ read: async () => ({ data: [{ artist_id: 'artist' }], error: null }) }));
  await store.getState().fetchSaved('user');
  assert.deepEqual([...store.getState().savedArtistIds], ['artist']);
  store.getState().reset();
  assert.equal(store.getState().savedArtistIds.size, 0);
  assert.equal(store.getState().ownerId, null);
});

test('a rejected save preserves the saved state and returns failure', async () => {
  const store = loadStore(clientWith({ write: async () => ({ data: null, error: { message: 'offline' } }) }));
  assert.equal(await store.getState().toggle('user', 'artist'), false);
  assert.equal(store.getState().savedArtistIds.size, 0);
  assert.ok(store.getState().error);
});

test('a persisted removal updates favorites and an anonymous action is rejected', async () => {
  const store = loadStore(clientWith({ read: async () => ({ data: [{ artist_id: 'artist' }], error: null }) }));
  assert.equal(await store.getState().toggle('user', 'artist'), true);
  assert.equal(store.getState().savedArtistIds.size, 0);
  assert.equal(await store.getState().toggle('', 'artist'), false);
});

test('a removal affecting zero rows keeps the artist saved', async () => {
  const store = loadStore(clientWith({
    read: async () => ({ data: [{ artist_id: 'artist' }], error: null }),
    write: async () => ({ data: [], error: null }),
  }));
  assert.equal(await store.getState().toggle('user', 'artist'), false);
  assert.equal(store.getState().savedArtistIds.has('artist'), true);
});

test('duplicate clicks wait for persistence and send only one mutation', async () => {
  let release, calls = 0;
  const response = new Promise(resolve => { release = resolve; });
  const store = loadStore(clientWith({ write: () => { calls++; return response; } }));
  await store.getState().fetchSaved('user');
  const first = store.getState().toggle('user', 'artist');
  const second = store.getState().toggle('user', 'artist');
  await Promise.resolve();
  assert.equal(store.getState().savedArtistIds.size, 0);
  release({ data: { artist_id: 'artist' }, error: null });
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(calls, 1);
  assert.equal(store.getState().savedArtistIds.has('artist'), true);
});

test('an old account response cannot overwrite a new account', async () => {
  let release;
  const oldResponse = new Promise(resolve => { release = resolve; });
  const store = loadStore(clientWith({ read: user => user === 'old' ? oldResponse : Promise.resolve({ data: [{ artist_id: 'new-artist' }], error: null }) }));
  const old = store.getState().fetchSaved('old');
  await store.getState().fetchSaved('new');
  release({ data: [{ artist_id: 'old-artist' }], error: null });
  await old;
  assert.equal(store.getState().ownerId, 'new');
  assert.deepEqual([...store.getState().savedArtistIds], ['new-artist']);
});

test('logout while a save is pending leaves no account data behind', async () => {
  let release;
  const response = new Promise(resolve => { release = resolve; });
  const store = loadStore(clientWith({ write: () => response }));
  await store.getState().fetchSaved('user');
  const pending = store.getState().toggle('user', 'artist');
  await Promise.resolve();
  store.getState().reset();
  release({ data: { artist_id: 'artist' }, error: null });
  assert.equal(await pending, false);
  assert.equal(store.getState().savedArtistIds.size, 0);
});
