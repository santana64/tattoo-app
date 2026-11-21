/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../lib/auth-storage.native.ts');
const source = readFileSync(filename, 'utf8');
function createAdapter(values = new Map()) {
  let failKey = null;
  const secureStore = {
    async getItemAsync(key) { return values.get(key) ?? null; },
    async setItemAsync(key, value) {
      if (key === failKey) throw new Error('Simulated SecureStore write failure');
      if (Buffer.byteLength(value, 'utf8') > 2048) throw new Error('SecureStore limit exceeded');
      values.set(key, value);
    },
    async deleteItemAsync(key) { values.delete(key); },
  };
  const compiled = new Module(filename, module);
  compiled.require = (name) => name === 'expo-secure-store' ? secureStore : require(name);
  compiled._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return { storage: compiled.exports.authStorage, values, fail: (key) => { failKey = key; } };
}
const KEY = 'sb-lsewxsdulunuuzmszegm-auth-token';

test('native SecureStore adapter round-trips a long Unicode session across module reinstantiation', async () => {
  const { storage, values } = createAdapter();
  const session = JSON.stringify({ access_token: 'x'.repeat(5200), user: { name: 'Élève 🎨', about: '日本語'.repeat(650) } });
  await storage.setItem(KEY, session);
  assert.equal(await storage.getItem(KEY), session);
  const restored = createAdapter(values).storage;
  assert.equal(await restored.getItem(KEY), session); // Cold-started module, same native Keychain.
  assert.ok(values.size > 2, 'session is stored as multiple small SecureStore records');
  for (const value of values.values()) assert.ok(Buffer.byteLength(value, 'utf8') <= 2048);
});

test('PKCE code verifier is persisted, replaced, and deleted with no leftover secrets', async () => {
  const { storage, values } = createAdapter();
  const key = `${KEY}-code-verifier`;
  await storage.setItem(key, 'long-verifier-a'.repeat(210));
  assert.equal(await storage.getItem(key), 'long-verifier-a'.repeat(210));
  await storage.setItem(key, 'short-verifier-b');
  assert.equal(await storage.getItem(key), 'short-verifier-b');
  await storage.removeItem(key);
  assert.equal(await storage.getItem(key), null);
  assert.equal(values.size, 0);
});

test('failed writes do not overwrite the previously committed native session', async () => {
  const { storage, values, fail } = createAdapter();
  await storage.setItem(KEY, 'first-session'.repeat(200));
  fail(`inkr.auth.${KEY}.b.1`);
  await assert.rejects(() => storage.setItem(KEY, 'new-session'.repeat(500)), /Simulated SecureStore/);
  assert.equal(await storage.getItem(KEY), 'first-session'.repeat(200));
  assert.ok(values.size > 0);
});

test('invalid or partial session entries never return credentials', async () => {
  const { storage, values } = createAdapter();
  await storage.setItem(KEY, 'test-session'.repeat(700));
  const manifestKey = `inkr.auth.${KEY}.manifest`;
  const manifest = JSON.parse(values.get(manifestKey));
  values.delete(`inkr.auth.${KEY}.${manifest.slot}.0`);
  assert.equal(await storage.getItem(KEY), null);
  await assert.rejects(() => storage.setItem('bad:key', 'test'), /Invalid authentication storage key/);
});

test('storage is actually wired into the Supabase client on both native and web', () => {
  const client = readFileSync(path.resolve(__dirname, '../lib/supabase.ts'), 'utf8');
  assert.match(client, /import\s+\{\s*authStorage\s*\}\s+from\s+['"]\.\/auth-storage['"]/);
  assert.match(client, /storage:\s*authStorage/);
  assert.match(client, /lock:\s*processLock/);
});

test('oversized values fail closed and preserve the previous session', async () => {
  const { storage } = createAdapter();
  await storage.setItem(KEY, 'session-saved');
  await assert.rejects(() => storage.setItem(KEY, 'x'.repeat(80000)), /exceeds secure storage capacity/);
  assert.equal(await storage.getItem(KEY), 'session-saved');
});
