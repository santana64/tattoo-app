/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../store/auth-store.ts');

function load(platform, response = { data: { url: 'https://staging.supabase.co/auth/v1/authorize?provider=google' }, error: null }, rejectOpen = false) {
  const calls = [];
  const fakeCreate = (factory) => {
    let state;
    const get = () => state;
    const set = (x) => { state = { ...state, ...(typeof x === 'function' ? x(state) : x) }; };
    state = factory(set, get);
    return { getState: () => state, setState: set };
  };
  const mocks = {
    zustand: { create: fakeCreate },
    'react-native': { Platform: { OS: platform } },
    '@/lib/supabase': { supabase: { auth: {
      signInWithOAuth: async (options) => { calls.push({ kind: 'authorize', options }); return response; },
    } } },
    '@/lib/auth-errors': { authErrorMessage: (error) => error ? 'Authentication refused' : null },
    '@/lib/moderation': { fetchIsAdmin: async () => false },
    'expo-linking': { openURL: async (url) => { calls.push({ kind: 'browser', url }); if (rejectOpen) throw new Error('No handler'); } },
    '@/store/request-store': {}, '@/store/message-store': {}, '@/store/notification-store': {},
    '@/store/saved-artists-store': {}, '@/store/follow-store': {}, '@/store/feed-store': {},
  };
  const m = new Module(filename, module);
  m.require = (name) => mocks[name] ?? require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return { store: m.exports.useAuthStore, calls };
}

test('native Google OAuth launches the returned authorize URL and uses a deep-link PKCE callback', async () => {
  const { store, calls } = load('android');
  const result = await store.getState().signInWithGoogle();
  assert.deepEqual(result, { error: null });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.provider, 'google');
  assert.equal(calls[0].options.options.skipBrowserRedirect, true);
  assert.equal(calls[0].options.options.redirectTo, 'inkr://auth/callback');
  assert.equal(calls[1].kind, 'browser');
  assert.equal(calls[1].url, 'https://staging.supabase.co/auth/v1/authorize?provider=google');
});

test('web Google OAuth lets Supabase handle redirects and never opens a second browser', async () => {
  global.window = { location: { origin: 'https://staging-preview.vercel.app' } };
  try {
    const { store, calls } = load('web');
    assert.deepEqual(await store.getState().signInWithGoogle(), { error: null });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.options.redirectTo, 'https://staging-preview.vercel.app/auth/callback');
    assert.equal(calls[0].options.options.skipBrowserRedirect, undefined);
  } finally { delete global.window; }
});

test('native Google OAuth reports disabled providers, missing URLs and browser failures', async () => {
  let q = load('ios', { data: { url: '' }, error: { message: 'provider disabled' } });
  assert.match((await q.store.getState().signInWithGoogle()).error, /Authentication refused/);
  assert.equal(q.calls.length, 1);
  q = load('ios', { data: { url: '' }, error: null });
  assert.match((await q.store.getState().signInWithGoogle()).error, /pas fourni/);
  assert.equal(q.calls.length, 1);
  q = load('ios', undefined, true);
  assert.match((await q.store.getState().signInWithGoogle()).error, /Impossible d’ouvrir/);
  assert.equal(q.calls.length, 2);
});
