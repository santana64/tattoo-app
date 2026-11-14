const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync(require.resolve('../supabase/functions/_shared/payment-return.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}

test('payment return permits only subscription success and cancellation routes', () => {
  const { paymentReturnDeepLink } = load();
  assert.equal(paymentReturnDeepLink('settings/subscription?checkout=success'), 'inkr://settings/subscription?checkout=success');
  assert.equal(paymentReturnDeepLink('settings/subscription?checkout=cancelled'), 'inkr://settings/subscription?checkout=cancelled');
  for (const target of [null, '', 'https://attacker.invalid', '//attacker.invalid', 'settings/subscription?checkout=success&next=evil', 'settings/delete-account']) {
    assert.equal(paymentReturnDeepLink(target), 'inkr://settings/subscription');
  }
});
