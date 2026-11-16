const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadStore(supabase) {
  const source = fs.readFileSync(require.resolve('../store/request-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const stubs = {
    '@/lib/supabase': { supabase },
    '@/lib/catalog': { isUuid: () => true },
    '@/lib/studio': { normalizePreferredSlots: (value) => value },
  };
  new Function('require', 'module', 'exports', code)(
    (name) => Object.hasOwn(stubs, name) ? stubs[name] : require(name), mod, mod.exports,
  );
  return mod.exports.useRequestStore;
}

test('a failed client refresh keeps the known requests and reports an error', async () => {
  const store = loadStore({ from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { code: 'NETWORK' } }) }) }) }) });
  store.setState({ requests: [{ id: 'existing' }] });
  await store.getState().fetchRequests('client', 'user');
  assert.deepEqual(store.getState().requests.map((request) => request.id), ['existing']);
  assert.match(store.getState().error, /Impossible de charger/);
  assert.equal(store.getState().isLoading, false);
});

test('artist lookup errors cannot masquerade as an empty inbox', async () => {
  const store = loadStore({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { code: 'NETWORK' } }) }) }) }) });
  store.setState({ requests: [{ id: 'existing' }] });
  await store.getState().fetchRequests('artist-user', 'artist');
  assert.deepEqual(store.getState().requests.map((request) => request.id), ['existing']);
  assert.match(store.getState().error, /Impossible de charger/);
});
