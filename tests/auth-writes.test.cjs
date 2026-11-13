const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadStore(write, cleared = [], authObserver = null) {
  const source = fs.readFileSync(require.resolve('../store/auth-store.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const client = {
    auth: {
      signOut: async () => ({ error: null }),
      onAuthStateChange: (callback) => {
        if (authObserver) authObserver.callback = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from(table) {
      assert.equal(table, 'profiles');
      return {
        update(values) {
          return {
            eq(column, id) {
              assert.equal(column, 'id');
              assert.equal(id, 'user');
              return { select: () => ({ maybeSingle: () => write(values) }) };
            },
          };
        },
      };
    },
  };
  const stubs = {
    '@/lib/supabase': { supabase: client },
    '@/lib/moderation': { fetchIsAdmin: async () => false },
    '@/lib/auth-errors': { authErrorMessage: () => 'Erreur de connexion' },
    'react-native': { Platform: { OS: 'web' } },
    '@/store/request-store': { useRequestStore: { getState: () => ({ resetPrivateRequests: () => cleared.push('requests') }) } },
    '@/store/message-store': { useMessageStore: { getState: () => ({ resetPrivateMessages: () => cleared.push('messages') }) } },
    '@/store/notification-store': { useNotificationStore: { getState: () => ({ resetPrivateNotifications: () => cleared.push('notifications') }) } },
    '@/store/saved-artists-store': { useSavedArtistsStore: { getState: () => ({ reset: () => cleared.push('saved') }) } },
    '@/store/follow-store': { useFollowStore: { getState: () => ({ reset: () => cleared.push('follows') }) } },
    '@/store/feed-store': { useFeedStore: { getState: () => ({ resetPersonalFeed: () => cleared.push('feed') }) } },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => stubs[name] ?? require(name), mod, mod.exports,
  );
  const store = mod.exports.useAuthStore;
  store.setState({
    session: { user: { id: 'user' } },
    user: { id: 'user', displayName: 'Avant', onboardingCompleted: false },
  });
  return store;
}

test('profile stays unchanged until the server confirms a row', async () => {
  let resolveWrite;
  const pending = new Promise((resolve) => { resolveWrite = resolve; });
  const store = loadStore(() => pending);
  const result = store.getState().updateProfile({ displayName: 'Après' });
  assert.equal(store.getState().user.displayName, 'Avant');
  resolveWrite({ data: null, error: null });
  assert.ok((await result).error);
  assert.equal(store.getState().user.displayName, 'Avant');
});

test('onboarding remains incomplete after a refused write', async () => {
  const store = loadStore(() => Promise.resolve({ data: null, error: { code: '42501', message: 'denied' } }));
  assert.ok((await store.getState().completeOnboarding()).error);
  assert.equal(store.getState().user.onboardingCompleted, false);
});

test('confirmed profile and onboarding writes update local state', async () => {
  const store = loadStore(() => Promise.resolve({ data: { id: 'user' }, error: null }));
  assert.equal((await store.getState().updateProfile({ displayName: 'Après' })).error, null);
  assert.equal(store.getState().user.displayName, 'Après');
  assert.equal((await store.getState().completeOnboarding()).error, null);
  assert.equal(store.getState().user.onboardingCompleted, true);
});

test('an old account response cannot overwrite a newly signed-in account', async () => {
  let resolveWrite;
  const pending = new Promise((resolve) => { resolveWrite = resolve; });
  const store = loadStore(() => pending);
  const oldWrite = store.getState().updateProfile({ displayName: 'Ancien' });
  store.setState({
    session: { user: { id: 'new-user' } },
    user: { id: 'new-user', displayName: 'Nouveau' },
  });
  resolveWrite({ data: { id: 'user' }, error: null });
  assert.ok((await oldWrite).error);
  assert.equal(store.getState().user.displayName, 'Nouveau');
});

test('sign-out clears private caches after the auth server confirms it', async () => {
  const cleared = [];
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), cleared);
  await store.getState().signOut();
  assert.deepEqual(cleared, ['requests', 'messages', 'notifications', 'saved', 'follows', 'feed']);
  assert.equal(store.getState().user, null);
});

test('an auth event switching accounts clears private caches before loading the next user', () => {
  const cleared = [];
  const authObserver = {};
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), cleared, authObserver);
  const stop = store.getState().initialize();
  authObserver.callback('SIGNED_IN', { user: { id: 'another-user' } });
  assert.deepEqual(cleared, ['requests', 'messages', 'notifications', 'saved', 'follows', 'feed']);
  assert.equal(store.getState().user, null);
  stop();
});
