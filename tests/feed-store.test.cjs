const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadStore(client) {
  const source = fs.readFileSync(require.resolve('../store/feed-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => name === '@/lib/supabase' ? { supabase: client } : require(name), mod, mod.exports,
  );
  return mod.exports.useFeedStore;
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
