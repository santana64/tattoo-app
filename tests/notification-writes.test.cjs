const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadStore(answer, fetchAnswer = { data: [], error: null }) {
  const source = fs.readFileSync(require.resolve('../store/notification-store.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const supabase = { from: () => ({
    select: () => ({ eq: () => ({ order: () => ({ limit: async () => fetchAnswer }) }) }),
    update: () => ({ eq: () => ({
      eq: () => ({ select: async () => answer }),
      select: () => ({ maybeSingle: async () => answer }),
    }) }),
  }) };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => name === '@/lib/supabase' ? { supabase } : require(name), mod, mod.exports,
  );
  const store = mod.exports.useNotificationStore;
  store.setState({ notifications: [{ id: 'note', userId: 'user', isRead: false }], unreadCount: 1 });
  return store;
}

test('a refused read receipt keeps the notification unread', async () => {
  const store = loadStore({ data: null, error: { code: '42501' } });
  assert.equal(await store.getState().markRead('note'), false);
  assert.equal(store.getState().notifications[0].isRead, false);
  assert.equal(store.getState().unreadCount, 1);
});

test('a confirmed read receipt updates only after the server response', async () => {
  const store = loadStore({ data: { id: 'note' }, error: null });
  assert.equal(await store.getState().markRead('note'), true);
  assert.equal(store.getState().notifications[0].isRead, true);
  assert.equal(store.getState().unreadCount, 0);
});

test('a refused mark-all request leaves unread notifications visible', async () => {
  const store = loadStore({ data: null, error: { code: '42501' } });
  assert.equal(await store.getState().markAllRead('user'), false);
  assert.equal(store.getState().unreadCount, 1);
});

test('mark-all updates only the notification ids confirmed by the server', async () => {
  const store = loadStore({ data: [{ id: 'note' }], error: null });
  store.setState({ notifications: [
    { id: 'note', userId: 'user', isRead: false },
    { id: 'later', userId: 'user', isRead: false },
  ], unreadCount: 2 });
  assert.equal(await store.getState().markAllRead('user'), true);
  assert.equal(store.getState().notifications[0].isRead, true);
  assert.equal(store.getState().notifications[1].isRead, false);
  assert.equal(store.getState().unreadCount, 1);
});

test('a failed refresh preserves existing alerts and reports a loading error', async () => {
  const store = loadStore({ data: null, error: null }, { data: null, error: { code: 'NETWORK' } });
  await store.getState().fetch('user');
  assert.equal(store.getState().notifications.length, 1);
  assert.ok(store.getState().error);
});
