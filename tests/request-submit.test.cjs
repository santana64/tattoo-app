const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const clientId = '11111111-1111-4111-8111-111111111111';
const artistId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const payload = {
  artistId, projectType: 'new', bodyZone: 'Avant-bras', sizeCategory: 'm',
  budgetMin: 200, budgetMax: 400, colorPreference: 'black_grey',
  description: 'Une branche botanique fine', flexibilityLevel: 'open',
};

function loadStore(client) {
  const source = fs.readFileSync(require.resolve('../store/request-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const stubs = {
    '@/lib/supabase': { supabase: client },
    '@/lib/catalog': { isUuid: (value) => /^[0-9a-f-]{36}$/.test(value) },
    '@/lib/studio': { normalizePreferredSlots: (value) => value },
  };
  new Function('require', 'module', 'exports', code)(
    (name) => Object.hasOwn(stubs, name) ? stubs[name] : require(name), mod, mod.exports,
  );
  const store = mod.exports.useRequestStore;
  store.setState({ fetchRequests: async () => {} });
  return store;
}

function fakeClient(insertResult, existing = null) {
  const writes = [];
  const client = { from(table) {
    if (table === 'artists') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { booking_status: 'open' }, error: null }) }) }) };
    assert.equal(table, 'tattoo_requests');
    return {
      insert: (row) => { writes.push(row); return { select: () => ({ single: async () => insertResult }) }; },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
    };
  } };
  return { client, writes };
}

test('a submitted brief uses the stable client-generated request id', async () => {
  const { client, writes } = fakeClient({ data: { id: requestId }, error: null });
  const store = loadStore(client);
  const result = await store.getState().submitRequest(payload, clientId, requestId);
  assert.deepEqual(result, { id: requestId, error: null });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].id, requestId);
});

test('a retry after an ambiguous response finds only the same client and artist request', async () => {
  const duplicate = { data: null, error: { code: '23505', message: 'duplicate key' } };
  const existing = { id: requestId, client_id: clientId, artist_id: artistId };
  const { client } = fakeClient(duplicate, existing);
  const store = loadStore(client);
  assert.deepEqual(await store.getState().submitRequest(payload, clientId, requestId), { id: requestId, error: null });
  const other = fakeClient(duplicate, { ...existing, client_id: '44444444-4444-4444-8444-444444444444' });
  const otherStore = loadStore(other.client);
  const denied = await otherStore.getState().submitRequest(payload, clientId, requestId);
  assert.equal(denied.id, null);
});
