const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const src = fs.readFileSync(require.resolve('../supabase/functions/_shared/http.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function load(projectUrl, origins = '') {
  const mod = { exports: {} };
  const Deno = { env: { get: (key) =>
    key === 'SUPABASE_URL' ? projectUrl :
    key === 'ALLOWED_ORIGINS' ? origins : undefined } };
  new Function('module', 'exports', 'Deno', 'URL', 'TextEncoder', js)(
    mod, mod.exports, Deno, URL, TextEncoder,
  );
  return mod.exports;
}

const preview = 'https://tattoo-app-4gmu-po0g25qat-santana64s-projects.vercel.app';
const deploymentPreview = 'https://tattoo-pirq8ggyg-santana64s-projects.vercel.app';
const stagingUrl = 'https://lsewxsdulunuuzmszegm.supabase.co';
const productionUrl = 'https://jxmefklkixzzdceeorcg.supabase.co';
const req = (origin) => ({ headers: { get: (name) => name === 'Origin' ? origin : null } });

test('staging QA accepts only the exact Vercel project/team preview origin', () => {
  const http = load(stagingUrl);
  assert.equal(http.isAllowedWebOrigin(preview), true);
  assert.equal(http.isAllowedWebOrigin(deploymentPreview), true);
  assert.equal(http.corsHeaders(req(deploymentPreview))['Access-Control-Allow-Origin'], deploymentPreview);
  assert.equal(http.isAllowedReturnUrl(deploymentPreview + '/settings/subscription?checkout=success'), true);
  assert.equal(http.corsHeaders(req(preview))['Access-Control-Allow-Origin'], preview);
  assert.equal(http.isAllowedReturnUrl(preview + '/settings/subscription?checkout=success'), true);
  for (const origin of [
    'https://evil.vercel.app',
    'https://tattoo-evilattacker-santana64s-projects.vercel.app',
    'https://tattoo-pirq8ggyg-santana64s-projects.vercel.app.evil.test',
    'http://tattoo-pirq8ggyg-santana64s-projects.vercel.app',
    'https://tattoo-pirq8ggyg-attacker-projects.vercel.app',
    'https://tattoo-pirq8ggyg-santana64s-projects.vercel.app:8443',
    'https://tattoo-app-4gmu-abc-other-team.vercel.app',
    'https://tattoo-app-4gmu-abc-santana64s-projects.vercel.app.evil.test',
    'http://tattoo-app-4gmu-po0g25qat-santana64s-projects.vercel.app',
  ]) {
    assert.equal(http.isAllowedWebOrigin(origin), false, origin);
    assert.equal(http.corsHeaders(req(origin))['Access-Control-Allow-Origin'], undefined);
  }
});

test('preview exception cannot authorize a production checkout', () => {
  const http = load(productionUrl);
  assert.equal(http.isAllowedWebOrigin(preview), false);
  assert.equal(http.isAllowedWebOrigin(deploymentPreview), false);
  assert.equal(http.isAllowedReturnUrl(deploymentPreview + '/settings/subscription?checkout=success'), false);
  assert.equal(http.isAllowedReturnUrl(preview + '/settings/subscription?checkout=success'), false);
  assert.equal(http.corsHeaders(req(preview))['Access-Control-Allow-Origin'], undefined);
});

test('explicit ALLOWED_ORIGINS remain functional without broad wildcards', () => {
  const host = 'https://inkr.example';
  const http = load(productionUrl, host + ',https://another.inkr.example');
  assert.equal(http.isAllowedWebOrigin(host), true);
  assert.equal(http.corsHeaders(req(host))['Access-Control-Allow-Origin'], host);
  assert.equal(http.isAllowedWebOrigin('https://inkr.example.attacker.test'), false);
});
