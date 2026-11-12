const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'storage.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function storageHarness({ size = 1024, uploadError = null, listError = null } = {}) {
  const calls = [];
  const bucket = {
    upload: async (name, blob, options) => {
      calls.push({ action: 'upload', name, blob, options });
      return { data: { path: name }, error: uploadError };
    },
    list: async (folder) => {
      calls.push({ action: 'list', folder });
      return { data: [{ name: 'ref_0.jpg' }, { name: 'ref_1.jpg' }, { name: '.emptyFolderPlaceholder' }], error: listError };
    },
    createSignedUrl: async (name, expiresIn) => {
      calls.push({ action: 'sign', name, expiresIn });
      return { data: { signedUrl: `https://private.test/${name}?token=temporary` }, error: null };
    },
    getPublicUrl: () => { throw new Error('Private reference must not request a public URL'); },
  };
  const stubs = {
    'expo-image-picker': {},
    'expo-image-manipulator': {
      manipulateAsync: async () => ({ uri: 'compressed-image' }),
      SaveFormat: { JPEG: 'jpeg' },
    },
    './supabase': { supabase: { storage: { from: (name) => {
      assert.equal(name, 'request-references');
      return bucket;
    } } } },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', compiled)(
    (name) => stubs[name] ?? require(name), mod, mod.exports,
    async () => ({ blob: async () => ({ size }) }),
  );
  return { storage: mod.exports, calls };
}

test('references upload to a repeatable private path without a public URL', async () => {
  const { storage, calls } = storageHarness();
  const first = await storage.uploadReference('picked-image', 'request-123', 0);
  const retry = await storage.uploadReference('picked-image', 'request-123', 0);
  assert.deepEqual(first, { path: 'request-123/ref_0.jpg' });
  assert.deepEqual(retry, first);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.upsert, true);
  assert.equal(calls[0].options.contentType, 'image/jpeg');
});

test('oversized images stop before storage upload', async () => {
  const { storage, calls } = storageHarness({ size: 10 * 1024 * 1024 + 1 });
  await assert.rejects(storage.uploadReference('picked-image', 'request-123', 0), /10 Mo/);
  assert.equal(calls.length, 0);
});

test('request detail lists private files and signs only reference images', async () => {
  const { storage, calls } = storageHarness();
  const urls = await storage.signedRequestReferences('request-123');
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.includes('token=temporary')));
  assert.deepEqual(calls.filter((call) => call.action === 'sign').map((call) => call.name), [
    'request-123/ref_0.jpg', 'request-123/ref_1.jpg',
  ]);
  assert.ok(calls.filter((call) => call.action === 'sign').every((call) => call.expiresIn === 3600));
});

test('storage errors surface rather than claiming a successful attachment', async () => {
  const { storage } = storageHarness({ uploadError: new Error('upload refused'), listError: new Error('list refused') });
  await assert.rejects(storage.uploadReference('picked-image', 'request-123', 0), /upload refused/);
  await assert.rejects(storage.signedRequestReferences('request-123'), /list refused/);
});
