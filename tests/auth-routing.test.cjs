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
