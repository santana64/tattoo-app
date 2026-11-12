const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadStore(write) {
  const source = fs.readFileSync(require.resolve('../store/auth-store.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const client = {
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
