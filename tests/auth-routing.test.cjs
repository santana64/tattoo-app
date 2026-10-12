/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../lib/auth-routing.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { isPublicRoute, authRedirect } = compiled.exports;

test('visitors can discover artists and read legal documents', () => {
  for (const route of [[], ['(tabs)'], ['(tabs)', 'index'], ['(tabs)', 'explore'], ['artist', '[id]'], ['post', '[id]'], ['legal', 'terms'], ['legal', 'privacy-policy'], ['auth', 'callback']]) {
    assert.equal(isPublicRoute(route), true, route.join('/'));
    assert.equal(authRedirect(route, false, null), null);
  }
});
test('visitors cannot navigate to personal or mutation screens', () => {
  for (const route of [['(tabs)', 'inbox'], ['(tabs)', 'profile'], ['(tabs)', 'agenda'], ['request', 'new'], ['request', '[id]'], ['conversation', '[id]'], ['create'], ['settings', 'account'], ['(onboarding)', 'client', 'step1']]) {
    assert.equal(authRedirect(route, false, null), '/(auth)/sign-in');
  }
});
test('completed accounts leave auth screens but keep callback accessible', () => {
  const user = { role: 'user', onboardingCompleted: true };
  assert.equal(authRedirect(['(auth)', 'sign-in'], true, user), '/(tabs)');
  assert.equal(authRedirect(['auth', 'callback'], true, user), null);
});
test('incomplete accounts may browse and finish correct onboarding without a loop', () => {
  const user = { role: 'artist', onboardingCompleted: false };
  assert.equal(authRedirect(['artist', '[id]'], true, user), null);
  assert.equal(authRedirect(['request', 'new'], true, user), '/(onboarding)/artist/step1');
  assert.equal(authRedirect(['(onboarding)', 'artist', 'step2'], true, user), null);
});
test('missing profile cannot enter private areas and may recover on sign-in', () => {
  assert.equal(authRedirect(['(tabs)', 'inbox'], true, null), '/(auth)/sign-in');
  assert.equal(authRedirect(['(auth)', 'sign-in'], true, null), null);
});
test('a completed client can open role selection to become an artist', () => {
  const client = { role: 'user', onboardingCompleted: true };
  assert.equal(authRedirect(['(auth)', 'role-select'], true, client), null);
  // Other auth screens and client onboarding stay closed.
  assert.equal(authRedirect(['(auth)', 'sign-in'], true, client), '/(tabs)');
  assert.equal(authRedirect(['(onboarding)', 'client', 'step1'], true, client), '/(tabs)');
  // An existing artist has nothing to pick again.
  assert.equal(authRedirect(['(auth)', 'role-select'], true, { role: 'artist', onboardingCompleted: true }), '/(tabs)');
});
test('a brand-new account chooses client or artist before any onboarding', () => {
  const fresh = { role: 'user', onboardingCompleted: false };
  // Right after sign-up (auth screen) and on private screens: go to role selection.
  assert.equal(authRedirect(['(auth)', 'sign-in'], true, fresh), '/(auth)/role-select');
  assert.equal(authRedirect(['(tabs)', 'inbox'], true, fresh), '/(auth)/role-select');
  // Role selection itself and the client steps it leads to stay reachable.
  assert.equal(authRedirect(['(auth)', 'role-select'], true, fresh), null);
  assert.equal(authRedirect(['(onboarding)', 'client', 'step2'], true, fresh), null);
});
