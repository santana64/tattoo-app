const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(relativePath, response, onUpdate = null) {
  const source = fs.readFileSync(require.resolve(relativePath), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let target;
  const chain = {
    eq: () => chain,
    select: () => ({ maybeSingle: async () => response }),
    then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
  };
  const supabase = { from: (table) => { target = table; return {
    delete: () => ({ eq: () => chain }),
    update: (values) => { onUpdate?.(values); return { eq: () => chain }; },
  }; } };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => name === './supabase' ? { supabase } : require(name), mod, mod.exports,
  );
  return { exports: mod.exports, table: () => target };
}

for (const [modulePath, method, table] of [
  ['../lib/care.ts', 'deleteStory', 'stories'],
  ['../lib/studio.ts', 'deleteGuestSpot', 'guest_spots'],
]) {
  test(`${method} only succeeds when the server confirms a removed row`, async () => {
    for (const [response, expected] of [
      [{ data: null, error: null }, false],
      [{ data: null, error: { code: '42501' } }, false],
      [{ data: { id: 'deleted-id' }, error: null }, true],
    ]) {
      const loaded = load(modulePath, response);
      assert.equal(await loaded.exports[method]('deleted-id'), expected);
      assert.equal(loaded.table(), table);
    }
  });
}

test('archiving a flash preserves linked historical requests and confirms the affected row', async () => {
  for (const [response, expected] of [
    [{ data: null, error: null }, false],
    [{ data: null, error: { code: '42501' } }, false],
    [{ data: { id: 'flash-id' }, error: null }, true],
  ]) {
    let patch;
    const loaded = load('../lib/studio.ts', response, (values) => { patch = values; });
    assert.equal(await loaded.exports.archiveFlash('flash-id'), expected);
    assert.equal(loaded.table(), 'flash_designs');
    assert.deepEqual(patch, { is_published: false });
  }
});
