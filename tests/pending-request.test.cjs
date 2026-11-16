const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadModule(storage) {
  const source = fs.readFileSync(require.resolve('../lib/pending-request.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const secure = {
    getItemAsync: async (key) => storage.getItem(key),
    setItemAsync: async (key, value) => storage.setItem(key, value),
    deleteItemAsync: async (key) => storage.removeItem(key),
  };
  new Function('require', 'module', 'exports', 'localStorage', code)(
    (name) => name === 'react-native' ? { Platform: { OS: 'web' } } : name === 'expo-secure-store' ? secure : require(name),
    mod, mod.exports, storage,
  );
  return mod.exports;
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

const scope = {
  userId: '11111111-1111-4111-8111-111111111111',
  artistId: '22222222-2222-4222-8222-222222222222',
  flashId: null,
};
const requestId = '33333333-3333-4333-8333-333333333333';

test('the pending id survives reopening but stores no brief text or image URI', async () => {
  const storage = memoryStorage();
  const first = loadModule(storage);
  await first.savePendingRequest(scope, requestId);
  const second = loadModule(storage);
  assert.equal(await second.loadPendingRequest(scope), requestId);
  const persisted = [...storage.values.values()].join(' ');
  assert.ok(!persisted.includes('description'));
  assert.ok(!persisted.includes('file://'));
});

test('another user or artist cannot pick up the pending id', async () => {
  const storage = memoryStorage();
  const pending = loadModule(storage);
  await pending.savePendingRequest(scope, requestId);
  assert.equal(await pending.loadPendingRequest({ ...scope, userId: '44444444-4444-4444-8444-444444444444' }), null);
  assert.equal(await pending.loadPendingRequest({ ...scope, artistId: '55555555-5555-4555-8555-555555555555' }), null);
  await pending.clearPendingRequest(scope);
  assert.equal(await pending.loadPendingRequest(scope), null);
});

test('an expired or corrupted marker does not block a new project', async () => {
  const storage = memoryStorage();
  const pending = loadModule(storage);
  const original = Date.now;
  try {
    Date.now = () => 1_000_000;
    await pending.savePendingRequest(scope, requestId);
    Date.now = () => 1_000_000 + 31 * 86400_000;
    assert.equal(await pending.loadPendingRequest(scope), null);
    await pending.savePendingRequest(scope, requestId);
    const key = [...storage.values.keys()][0];
    storage.setItem(key, '{broken');
    assert.equal(await pending.loadPendingRequest(scope), null);
  } finally {
    Date.now = original;
  }
});
