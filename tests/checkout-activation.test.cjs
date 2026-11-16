const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync(require.resolve('../lib/checkout-activation.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}

test('Checkout return refreshes until the webhook grants Premium', async () => {
  const { waitForCheckoutActivation } = load();
  let tier = 'normal';
  let refreshes = 0;
  let pauses = 0;
  const active = await waitForCheckoutActivation(
    'artist-user',
    async () => { refreshes++; if (refreshes === 3) tier = 'premium'; },
    () => ({ id: 'artist-user', artistTier: tier }),
    async () => { pauses++; },
    () => true,
  );
  assert.equal(active, true);
  assert.equal(refreshes, 3);
  assert.equal(pauses, 2);
});

test('Checkout return stops after a bounded number of checks without granting Premium', async () => {
  const { waitForCheckoutActivation } = load();
  let refreshes = 0;
  let pauses = 0;
  const active = await waitForCheckoutActivation(
    'artist-user',
    async () => { refreshes++; },
    () => ({ id: 'artist-user', artistTier: 'normal' }),
    async () => { pauses++; },
    () => true,
  );
  assert.equal(active, false);
  assert.equal(refreshes, 6);
  assert.equal(pauses, 5);
});

test('Checkout return cannot promote a different account after sign-out', async () => {
  const { waitForCheckoutActivation } = load();
  let user = { id: 'artist-user', artistTier: 'normal' };
  let refreshes = 0;
  const active = await waitForCheckoutActivation(
    'artist-user',
    async () => { refreshes++; user = { id: 'other-user', artistTier: 'premium' }; },
    () => user,
    async () => {},
    () => true,
  );
  assert.equal(active, false);
  assert.equal(refreshes, 1);
});

test('Checkout return stops when the screen closes during the wait', async () => {
  const { waitForCheckoutActivation } = load();
  let active = true;
  let refreshes = 0;
  const result = await waitForCheckoutActivation(
    'artist-user',
    async () => { refreshes++; },
    () => ({ id: 'artist-user', artistTier: 'normal' }),
    async () => { active = false; },
    () => active,
  );
  assert.equal(result, false);
  assert.equal(refreshes, 1);
});
