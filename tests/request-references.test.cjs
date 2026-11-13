const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'storage.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function storageHarness({ size = 1024, uploadError = null, listError = null, insertError = null, removeError = null, removeWithoutDelete = false } = {}) {
  const calls = [];
  const rows = new Set();
  const files = new Set(['ref_0.jpg', 'ref_1.jpg', 'ref_7.jpg', '.emptyFolderPlaceholder']);
  const bucket = {
    upload: async (name, blob, options) => {
      calls.push({ action: 'upload', name, blob, options });
      return { data: { path: name }, error: uploadError };
    },
    list: async (folder) => {
      calls.push({ action: 'list', folder });
      return { data: [...files].map((name) => ({ name })), error: listError };
    },
    createSignedUrl: async (name, expiresIn) => {
      calls.push({ action: 'sign', name, expiresIn });
      return { data: { signedUrl: `https://private.test/${name}?token=temporary` }, error: null };
    },
    remove: async (paths) => {
      calls.push({ action: 'remove', paths });
      if (!removeError && !removeWithoutDelete) paths.forEach((path) => files.delete(path.split('/').at(-1)));
      return { data: paths, error: removeError };
    },
    getPublicUrl: () => { throw new Error('Private reference must not request a public URL'); },
  };
  const stubs = {
    'expo-image-picker': {},
    'expo-image-manipulator': {
      manipulateAsync: async () => ({ uri: 'compressed-image' }),
      SaveFormat: { JPEG: 'jpeg' },
    },
    './supabase': { supabase: { from: (table) => {
      assert.equal(table, 'request_references');
      return {
        select: () => ({ eq: () => ({ eq: (_, value) => ({ maybeSingle: async () => ({ data: rows.has(value) ? { id: 'existing' } : null, error: null }) }) }) }),
        insert: async ({ url }) => { calls.push({ action: 'insert-row', url }); if (!insertError) rows.add(url); return { error: insertError }; },
        delete: () => ({ eq: () => ({ eq: async (_, value) => { calls.push({ action: 'delete-row', value }); rows.delete(value); return { error: null }; } }) }),
      };
    }, storage: { from: (name) => {
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

test('only three reference slots can be uploaded', async () => {
  const { storage, calls } = storageHarness();
  await assert.rejects(storage.uploadReference('picked-image', 'request-123', 3), /Emplacement/);
  await assert.rejects(storage.uploadReference('picked-image', 'request-123', -1), /Emplacement/);
  assert.equal(calls.length, 0);
});

test('request detail lists private files and signs only reference images', async () => {
  const { storage, calls } = storageHarness();
  const urls = await storage.signedRequestReferences('request-123');
  assert.equal(urls.length, 2);
  assert.ok(urls.every((item) => item.url.includes('token=temporary') && item.path.startsWith('request-123/')));
  assert.deepEqual(calls.filter((call) => call.action === 'sign').map((call) => call.name), [
    'request-123/ref_0.jpg', 'request-123/ref_1.jpg',
  ]);
  assert.ok(calls.filter((call) => call.action === 'sign').every((call) => call.expiresIn === 300));
});

test('metadata registration is repeatable for a private path', async () => {
  const { storage, calls } = storageHarness();
  await storage.saveReferenceMetadata('request-123', 'request-123/ref_0.jpg');
  await storage.saveReferenceMetadata('request-123', 'request-123/ref_0.jpg');
  assert.equal(calls.filter((call) => call.action === 'insert-row').length, 1);
});

test('an unrelated metadata conflict is reported instead of being treated as a retry', async () => {
  const conflict = { code: '23505', message: 'duplicate key value violates unique constraint "other_index"' };
  const { storage } = storageHarness({ insertError: conflict });
  await assert.rejects(storage.saveReferenceMetadata('request-123', 'request-123/ref_0.jpg'), (error) => error === conflict);
});

test('attaching a reference uploads first, then records its private path', async () => {
  const { storage, calls } = storageHarness();
  await storage.attachReference('picked-image', 'request-123', 2);
  assert.deepEqual(calls.filter((call) => ['upload', 'insert-row'].includes(call.action)).map((call) => call.action), ['upload', 'insert-row']);
  assert.equal(calls.find((call) => call.action === 'insert-row').url, 'request-123/ref_2.jpg');
});

test('client removal clears the object and its historical metadata row', async () => {
  const { storage, calls } = storageHarness();
  await storage.removeReference('request-123', 'request-123/ref_0.jpg');
  assert.deepEqual(calls.filter((call) => call.action === 'remove')[0].paths, ['request-123/ref_0.jpg']);
  assert.equal(calls.filter((call) => call.action === 'delete-row').length, 1);
  assert.deepEqual(calls.filter((call) => ['remove', 'list', 'delete-row'].includes(call.action)).map((call) => call.action), ['remove', 'list', 'delete-row']);
});

test('an interrupted deletion can be retried against the remaining private object', async () => {
  const failure = new Error('storage unavailable');
  const { storage, calls } = storageHarness({ removeError: failure });
  await assert.rejects(storage.removeReference('request-123', 'request-123/ref_0.jpg'), /storage unavailable/);
  await assert.rejects(storage.removeReference('request-123', 'request-123/ref_0.jpg'), /storage unavailable/);
  assert.equal(calls.filter((call) => call.action === 'remove').length, 2);
  assert.equal(calls.filter((call) => call.action === 'delete-row').length, 0);
});

test('a removal that reports success but leaves the object keeps historical metadata', async () => {
  const { storage, calls } = storageHarness({ removeWithoutDelete: true });
  await assert.rejects(storage.removeReference('request-123', 'request-123/ref_0.jpg'), /encore présente/);
  assert.equal(calls.filter((call) => call.action === 'delete-row').length, 0);
});

test('storage errors surface rather than claiming a successful attachment', async () => {
  const { storage } = storageHarness({ uploadError: new Error('upload refused'), listError: new Error('list refused') });
  await assert.rejects(storage.uploadReference('picked-image', 'request-123', 0), /upload refused/);
  await assert.rejects(storage.signedRequestReferences('request-123'), /list refused/);
});
