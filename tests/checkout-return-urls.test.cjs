const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../supabase/functions/_shared/checkout-return-urls.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', compiled)(mod, mod.exports);
const { resolveCheckoutReturnUrls } = mod.exports;

const allowed = (value) => {
  if (typeof value !== 'string') return false;
  try { return new URL(value).origin === 'https://preview.inkr.test'; }
  catch { return false; }
};
const bridge = (target) => `https://staging.inkr.test/functions/v1/payment-return?target=${encodeURIComponent(target)}`;

test('web checkout keeps validated URLs when both belong to the allowlisted app', () => {
  const urls = resolveCheckoutReturnUrls({
    successUrl: 'https://preview.inkr.test/settings/subscription?checkout=success',
    cancelUrl: 'https://preview.inkr.test/settings/subscription?checkout=cancel',
  }, allowed, bridge);
  assert.deepEqual(urls, {
    successUrl: 'https://preview.inkr.test/settings/subscription?checkout=success',
    cancelUrl: 'https://preview.inkr.test/settings/subscription?checkout=cancel',
  });
});

test('native checkout with no explicit URL retains the deep-link bridge', () => {
  const urls = resolveCheckoutReturnUrls({ period: 'monthly' }, allowed, bridge);
  assert.match(urls.successUrl, /target=settings%2Fsubscription%3Fcheckout%3Dsuccess/);
  assert.match(urls.cancelUrl, /target=settings%2Fsubscription%3Fcheckout%3Dcancelled/);
});

test('invalid web return URLs never silently fall back to native', () => {
  const validSuccess = 'https://preview.inkr.test/settings/subscription?checkout=success';
  const validCancel = 'https://preview.inkr.test/settings/subscription?checkout=cancel';
  const bad = [
    { successUrl: validSuccess },
    { cancelUrl: validCancel },
    { successUrl: 'https://evil.test/settings/subscription?checkout=success', cancelUrl: validCancel },
    { successUrl: 'http://127.0.0.1:4173/settings/subscription?checkout=success', cancelUrl: validCancel },
    { successUrl: 'https://preview.inkr.test/evil?checkout=success', cancelUrl: validCancel },
    { successUrl: 'https://preview.inkr.test/settings/subscription?checkout=success&next=evil', cancelUrl: validCancel },
    { successUrl: 'https://preview.inkr.test/settings/subscription?checkout=success#fragment', cancelUrl: validCancel },
    { successUrl: validCancel, cancelUrl: validSuccess },
    { successUrl: validSuccess, cancelUrl: 'inkr://settings/subscription?checkout=cancel' },
  ];
  for (const b of bad) assert.equal(resolveCheckoutReturnUrls(b, allowed, bridge), null, JSON.stringify(b));
});
