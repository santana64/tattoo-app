const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const requestId = '11111111-1111-4111-8111-111111111111';
const senderId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const row = { id: messageId, request_id: requestId, sender_id: senderId, content: 'Bonjour', message_type: 'text', metadata: null, is_read: false, created_at: '2026-11-13T10:00:00Z' };

function loadStore(insertResult, lookupResult = null, realtime = null) {
  const source = fs.readFileSync(require.resolve('../store/message-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const writes = [];
  const supabase = { from: (table) => {
    assert.equal(table, 'messages');
    return {
      insert: (value) => { writes.push(value); return { select: () => ({ single: async () => insertResult }) }; },
      select: () => ({ eq: () => ({
        maybeSingle: async () => ({ data: lookupResult, error: null }),
        order: async () => ({ data: [], error: null }),
      }) }),
    };
  }, channel: () => {
    const channel = {
      on: (_kind, _filter, callback) => { if (realtime) realtime.callback = callback; return channel; },
      subscribe: () => channel,
    };
    return channel;
  }, removeChannel: () => {} };
  const mod = { exports: {} };
  const stubs = {
    '@/lib/supabase': { supabase },
    'expo-crypto': { randomUUID: () => messageId },
  };
  new Function('require', 'module', 'exports', code)(
    (name) => Object.hasOwn(stubs, name) ? stubs[name] : require(name), mod, mod.exports,
  );
  return { store: mod.exports.useMessageStore, writes };
}

test('a sent message uses a stable client-generated id', async () => {
  const { store, writes } = loadStore({ data: row, error: null });
  assert.equal(await store.getState().sendMessage(requestId, senderId, 'Bonjour'), true);
  assert.equal(writes[0].id, messageId);
  assert.equal(store.getState().messagesByRequest[requestId].length, 1);
  assert.equal(store.getState().messagesByRequest[requestId][0].pending, undefined);
});

test('a lost response is reconciled by id, without duplicate bubbles', async () => {
  const { store } = loadStore({ data: null, error: { code: 'FETCH_ERROR' } }, row);
  assert.equal(await store.getState().sendMessage(requestId, senderId, 'Bonjour'), true);
  assert.deepEqual(store.getState().messagesByRequest[requestId].map((m) => m.id), [messageId]);
});

test('a failed send stays retryable with the same id', async () => {
  const { store, writes } = loadStore({ data: null, error: { code: 'FETCH_ERROR' } });
  assert.equal(await store.getState().sendMessage(requestId, senderId, 'Bonjour'), false);
  const failed = store.getState().messagesByRequest[requestId][0];
  assert.equal(failed.failed, true);
  assert.equal(await store.getState().retryMessage(requestId, failed.id), false);
  assert.deepEqual(writes.map((item) => item.id), [messageId, messageId]);
});

test('refreshing a thread keeps an unsent message available to retry', async () => {
  const { store } = loadStore({ data: null, error: { code: 'FETCH_ERROR' } });
  await store.getState().sendMessage(requestId, senderId, 'Bonjour');
  await store.getState().fetchMessages(requestId);
  assert.equal(store.getState().messagesByRequest[requestId][0].failed, true);
});

test('a realtime echo during an optimistic send does not add a second bubble', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const realtime = {};
  const { store } = loadStore(pending, null, realtime);
  store.getState().subscribeToRequest(requestId);
  const sending = store.getState().sendMessage(requestId, senderId, 'Bonjour');
  realtime.callback({ new: row });
  assert.equal(store.getState().messagesByRequest[requestId].length, 1);
  finish({ data: row, error: null });
  assert.equal(await sending, true);
  assert.deepEqual(store.getState().messagesByRequest[requestId].map((m) => m.id), [messageId]);
});
