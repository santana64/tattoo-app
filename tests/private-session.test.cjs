const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(relativePath, stubs) {
  const source = fs.readFileSync(require.resolve(relativePath), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => Object.hasOwn(stubs, name) ? stubs[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

test('a late message fetch cannot restore another account’s conversation after reset', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: () => pending }) }) }), removeChannel: () => {} };
  const { useMessageStore } = load('../store/message-store.ts', { '@/lib/supabase': { supabase } });
  useMessageStore.setState({ messagesByRequest: { old: [{ id: 'private' }] } });
  const fetch = useMessageStore.getState().fetchMessages('old');
  useMessageStore.getState().resetPrivateMessages();
  finish({ data: [{ id: 'late', request_id: 'old', sender_id: 'former-user', content: 'private', message_type: 'text', created_at: '2026-11-13' }], error: null });
  await fetch;
  assert.deepEqual(useMessageStore.getState().messagesByRequest, {});
});

test('a late request fetch cannot restore another account’s inbox after reset', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: () => pending }) }) }) };
  const { useRequestStore } = load('../store/request-store.ts', {
    '@/lib/supabase': { supabase },
    '@/lib/catalog': { isUuid: () => true },
    '@/lib/studio': { normalizePreferredSlots: (value) => value },
  });
  useRequestStore.setState({ requests: [{ id: 'private' }] });
  const fetch = useRequestStore.getState().fetchRequests('former-user', 'user');
  useRequestStore.getState().resetPrivateRequests();
  finish({ data: [{ id: 'late' }], error: null });
  await fetch;
  assert.deepEqual(useRequestStore.getState().requests, []);
});

test('a late notification fetch cannot restore another account’s alerts after reset', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => pending }) }) }) }), removeChannel: () => {} };
  const { useNotificationStore } = load('../store/notification-store.ts', { '@/lib/supabase': { supabase } });
  useNotificationStore.setState({ notifications: [{ id: 'private' }] });
  const fetch = useNotificationStore.getState().fetch('former-user');
  useNotificationStore.getState().resetPrivateNotifications();
  finish({ data: [{ id: 'late', user_id: 'former-user', title: 'private' }] });
  await fetch;
  assert.deepEqual(useNotificationStore.getState().notifications, []);
});

test('a late like response cannot restore the former account’s personal feed state', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const supabase = { from: () => ({ insert: () => pending }) };
  const { useFeedStore } = load('../store/feed-store.ts', {
    '@/lib/supabase': { supabase },
    '@/store/follow-store': { useFollowStore: { getState: () => ({}) } },
  });
  useFeedStore.setState({ posts: [{ id: 'piece', isLiked: false, likesCount: 0 }] });
  const liking = useFeedStore.getState().toggleLike('piece', 'former-user');
  useFeedStore.getState().resetPersonalFeed();
  finish({ error: null });
  assert.equal(await liking, false);
  assert.deepEqual(useFeedStore.getState().posts, []);
  assert.equal(useFeedStore.getState().likedPostIds.size, 0);
});
