const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(env = {}) {
  const source = fs.readFileSync(require.resolve('../lib/auth-errors.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  const previous = process.env.EXPO_PUBLIC_AUTH_PROVIDERS;
  if ('EXPO_PUBLIC_AUTH_PROVIDERS' in env) process.env.EXPO_PUBLIC_AUTH_PROVIDERS = env.EXPO_PUBLIC_AUTH_PROVIDERS;
  else delete process.env.EXPO_PUBLIC_AUTH_PROVIDERS;
  new Function('require', 'module', 'exports', code)(require, mod, mod.exports);
  return { mod: mod.exports, restore: () => { if (previous === undefined) delete process.env.EXPO_PUBLIC_AUTH_PROVIDERS; else process.env.EXPO_PUBLIC_AUTH_PROVIDERS = previous; } };
}

test('no error yields null', () => {
  const { mod } = load();
  assert.equal(mod.authErrorMessage(null), null);
});

test('Supabase email rate limit is translated by code and by message', () => {
  const { mod } = load();
  const byCode = mod.authErrorMessage({ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 });
  const byMessage = mod.authErrorMessage({ message: 'email rate limit exceeded' });
  assert.match(byCode, /Trop d’e-mails/);
  assert.equal(byMessage, byCode);
});

test('disabled provider and PKCE mismatch get actionable French messages', () => {
  const { mod } = load();
  assert.match(mod.authErrorMessage({ message: 'Unsupported provider: provider is not enabled' }), /pas disponible/);
  assert.match(mod.authErrorMessage({ message: 'invalid request: both auth code and code verifier should be non-empty' }), /navigateur/);
});

test('unknown errors never leak raw English text', () => {
  const { mod } = load();
  const out = mod.authErrorMessage({ message: 'Some internal stack trace' });
  assert.doesNotMatch(out, /stack trace/);
});

test('OAuth providers are hidden unless explicitly enabled', () => {
  let { mod, restore } = load();
  assert.equal(mod.enabledOAuthProviders().size, 0);
  restore();
  ({ mod, restore } = load({ EXPO_PUBLIC_AUTH_PROVIDERS: ' Google, apple, facebook ' }));
  assert.deepEqual([...mod.enabledOAuthProviders()].sort(), ['apple', 'google']);
  restore();
});
