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
const existingBrief = {
  id: requestId, client_id: clientId, artist_id: artistId,
  project_type: payload.projectType, body_zone: payload.bodyZone, size_category: payload.sizeCategory,
  budget_min: payload.budgetMin, budget_max: payload.budgetMax, budget_unknown: false,
  color_preference: payload.colorPreference, style_preference: null,
  description: payload.description, flexibility_level: payload.flexibilityLevel,
  is_first_tattoo: false, flash_design_id: null,
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

function fakeClient(insertResult, existing = null, bookingStatus = 'open') {
  const writes = [];
  const client = { from(table) {
    if (table === 'artists') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { booking_status: bookingStatus }, error: null }) }) }) };
    assert.equal(table, 'tattoo_requests');
    return {
      insert: (row) => { writes.push(row); return { select: () => ({ single: async () => insertResult }) }; },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: Array.isArray(existing) ? existing.shift() : existing, error: null }) }) }),
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
  const duplicate = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "tattoo_requests_pkey"' } };
  const existing = existingBrief;
  const { client } = fakeClient(duplicate, [null, existing]);
  const store = loadStore(client);
  assert.deepEqual(await store.getState().submitRequest(payload, clientId, requestId), { id: requestId, error: null });
  const other = fakeClient(duplicate, [null, { ...existing, client_id: '44444444-4444-4444-8444-444444444444' }]);
  const otherStore = loadStore(other.client);
  const denied = await otherStore.getState().submitRequest(payload, clientId, requestId);
  assert.equal(denied.id, null);
});

test('another unique conflict is never mistaken for a previously sent request', async () => {
  const conflict = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "flash_bookings_single_copy"' } };
  const { client } = fakeClient(conflict);
  const store = loadStore(client);
  const result = await store.getState().submitRequest(payload, clientId, requestId);
  assert.equal(result.id, null);
});

test('a refused or uncertain send never exposes a database error to the client', async () => {
  for (const failure of [
    { code: '42501', message: 'new row violates row-level security policy' },
    { code: 'NETWORK', message: 'TypeError: fetch failed at internal host' },
  ]) {
    const { client } = fakeClient({ data: null, error: failure });
    const result = await loadStore(client).getState().submitRequest(payload, clientId, requestId);
    assert.equal(result.id, null);
    assert.match(result.error, /réessayez|Vérifiez/);
    assert.ok(!result.error.includes(failure.message));
  }
});

test('an existing request is recovered even if the artist stopped accepting new projects', async () => {
  const { client, writes } = fakeClient({ data: null, error: null }, existingBrief, 'closed');
  const result = await loadStore(client).getState().submitRequest(payload, clientId, requestId);
  assert.deepEqual(result, { id: requestId, error: null });
  assert.equal(writes.length, 0);
});

test('a different brief cannot silently reuse an earlier request id', async () => {
  const { client, writes } = fakeClient({ data: null, error: null }, existingBrief);
  const result = await loadStore(client).getState().submitRequest({ ...payload, description: 'Un autre projet' }, clientId, requestId);
  assert.equal(result.id, null);
  assert.match(result.error, /autre demande/);
  assert.equal(writes.length, 0);
});

test('a changed first tattoo answer cannot reuse an earlier request id', async () => {
  const { client } = fakeClient({ data: null, error: null }, existingBrief);
  const result = await loadStore(client).getState().submitRequest({ ...payload, isFirstTattoo: true }, clientId, requestId);
  assert.equal(result.id, null);
});

test('a late submit response cannot repopulate the previous account after sign-out', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { client, writes } = fakeClient(pending);
  const store = loadStore(client);
  const sending = store.getState().submitRequest(payload, clientId, requestId);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes.length, 1);
  store.getState().resetPrivateRequests();
  finish({ data: { id: requestId }, error: null });
  const result = await sending;
  assert.equal(result.id, null);
  assert.deepEqual(store.getState().requests, []);
});
