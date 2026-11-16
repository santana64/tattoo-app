const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadStore(write, cleared = [], authObserver = null, artistWrite = null, deleteInvoke = null, signedOut = []) {
  const source = fs.readFileSync(require.resolve('../store/auth-store.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const client = {
    auth: {
      signOut: async () => { signedOut.push('sign-out'); return { error: null }; },
      onAuthStateChange: (callback) => {
        if (authObserver) authObserver.callback = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    functions: {
      invoke: (fn, options) => {
        assert.equal(fn, 'delete-account');
        assert.equal(options.method, 'POST');
        return deleteInvoke ? deleteInvoke() : Promise.resolve({ data: null, error: null });
      },
    },
    from(table) {
      if (table === 'artists' && artistWrite) return {
        update(values) {
          let checks = 0;
          const chain = {
            eq() { checks++; return chain; },
            select() {
              assert.equal(checks, 2);
              return { maybeSingle: () => artistWrite(values) };
            },
          };
          return chain;
        },
      };
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

test('role selection waits for a changed row and rejects a silent denial', async () => {
  const store = loadStore(() => Promise.resolve({ data: null, error: null }));
  store.setState({ user: { id: 'user', role: 'user', onboardingCompleted: true } });
  await assert.rejects(store.getState().setRole('artist'), /Rôle non enregistré/);
  assert.equal(store.getState().user.role, 'user');
  assert.equal(store.getState().user.onboardingCompleted, true);
});

test('role selection does not update the next account after a delayed response', async () => {
  let confirm;
  const pending = new Promise((resolve) => { confirm = resolve; });
  const store = loadStore(() => pending);
  store.setState({ user: { id: 'user', role: 'user', onboardingCompleted: true } });
  const oldWrite = store.getState().setRole('artist');
  store.setState({ session: { user: { id: 'new-user' } }, user: { id: 'new-user', role: 'user' } });
  confirm({ data: { id: 'user' }, error: null });
  await assert.rejects(oldWrite, /session a changé/);
  assert.equal(store.getState().user.role, 'user');
});

test('artist settings remain unchanged when RLS updates zero rows', async () => {
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), [], null,
    () => Promise.resolve({ data: null, error: null }));
  store.setState({ user: { id: 'user', artistId: 'artist-1', artistBlaze: 'Avant' } });
  assert.ok((await store.getState().saveArtist({ blaze: 'Après' })).error);
  assert.equal(store.getState().user.artistBlaze, 'Avant');
});

test('artist settings update after the server confirms the row', async () => {
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), [], null,
    () => Promise.resolve({ data: { id: 'artist-1' }, error: null }));
  store.setState({ user: { id: 'user', artistId: 'artist-1', artistBlaze: 'Avant' } });
  assert.equal((await store.getState().saveArtist({ blaze: 'Après' })).error, null);
  assert.equal(store.getState().user.artistBlaze, 'Après');
});

test('an old artist write cannot overwrite the next account', async () => {
  let confirm;
  const pending = new Promise((resolve) => { confirm = resolve; });
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), [], null, () => pending);
  store.setState({ user: { id: 'user', artistId: 'artist-1', artistBlaze: 'Avant' } });
  const oldWrite = store.getState().saveArtist({ blaze: 'Après' });
  store.setState({ session: { user: { id: 'new-user' } }, user: { id: 'new-user', artistBlaze: 'Nouveau' } });
  confirm({ data: { id: 'artist-1' }, error: null });
  assert.ok((await oldWrite).error);
  assert.equal(store.getState().user.artistBlaze, 'Nouveau');
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

test('late account deletion does not sign out a different account', async () => {
  let resolveDeletion;
  const pending = new Promise((resolve) => { resolveDeletion = resolve; });
  const cleared = [];
  const signedOut = [];
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), cleared, null, null,
    () => pending, signedOut);
  const deletion = store.getState().deleteAccount();
  store.setState({
    session: { user: { id: 'another-user' } },
    user: { id: 'another-user', displayName: 'Nouvel utilisateur' },
    isAuthenticated: true,
  });
  resolveDeletion({ data: { deleted: true }, error: null });
  const result = await deletion;
  assert.match(result.error, /session a changé/);
  assert.equal(store.getState().session.user.id, 'another-user');
  assert.equal(store.getState().user.displayName, 'Nouvel utilisateur');
  assert.deepEqual(cleared, []);
  assert.deepEqual(signedOut, []);
});

test('ambiguous deletion response does not promise an intact account', async () => {
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), [], null, null,
    () => Promise.resolve({ data: null, error: { message: 'network interruption' } }));
  const result = await store.getState().deleteAccount();
  assert.match(result.error, /n’a pas pu être confirmée/);
  assert.doesNotMatch(result.error, /compte est intact/);
  assert.equal(store.getState().session.user.id, 'user');
});

test('confirmed deletion of same account clears its private session', async () => {
  const cleared = [];
  const signedOut = [];
  const store = loadStore(() => Promise.resolve({ data: null, error: null }), cleared, null, null,
    () => Promise.resolve({ data: { deleted: true }, error: null }), signedOut);
  const result = await store.getState().deleteAccount();
  assert.equal(result.error, null);
  assert.deepEqual(signedOut, ['sign-out']);
  assert.deepEqual(cleared, ['requests', 'messages', 'notifications', 'saved', 'follows', 'feed']);
  assert.equal(store.getState().session, null);
});
