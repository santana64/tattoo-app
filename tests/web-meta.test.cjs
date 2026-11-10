const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, requireStub = require) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(requireStub, mod, mod.exports);
  return mod.exports;
}

const site = loadTs('lib/site.ts');
const retry = loadTs('hooks/use-auto-retry.ts', (name) =>
  name === 'react-native' ? { Platform: { OS: 'web' } } : require(name));
const { buildSitemap, inlineScriptHashes } = require('../scripts/postexport-web.js');

test('public pages are indexable, personal ones are not', () => {
  for (const segments of [['(tabs)'], ['(tabs)', 'index'], ['(tabs)', 'explore'], ['(auth)', 'welcome'], ['artist', '[id]'], ['post', '[id]'], ['legal', 'terms']]) {
    assert.equal(site.pageMeta(segments).indexable, true, segments.join('/'));
  }
  for (const segments of [['(tabs)', 'messages'], ['(tabs)', 'profile'], ['settings', 'account'], ['conversation', '[id]'], ['request', 'new'], ['(auth)', 'sign-in'], ['(onboarding)', 'artist', 'step2'], ['unknown-route']]) {
    assert.equal(site.pageMeta(segments).indexable, false, segments.join('/'));
  }
});

test('every page gets a non-empty title and description', () => {
  for (const segments of [['(tabs)'], ['(tabs)', 'explore'], ['settings', 'index'], ['(onboarding)', 'client', 'step1'], ['nope']]) {
    const meta = site.pageMeta(segments);
    assert.ok(meta.title.trim().length > 0);
    assert.ok(meta.description.trim().length > 0);
  }
  assert.match(site.pageMeta(['(tabs)', 'explore']).title, /tatoueur/i);
  // Route names that collide with Object.prototype must not resolve to garbage.
  assert.equal(site.pageMeta(['constructor']).title, 'Inkr');
});

test('descriptions are trimmed on a word boundary and URLs are absolute', () => {
  const long = 'mot '.repeat(100);
  const short = site.toDescription(long);
  assert.ok(short.length <= 160);
  assert.ok(short.endsWith('…'));
  assert.equal(site.toDescription('  Deux   espaces\n ici '), 'Deux espaces ici');
  assert.equal(site.absoluteUrl('/explore'), `${site.SITE_URL}/explore`);
  assert.equal(site.absoluteUrl(''), site.SITE_URL);
});

test('automatic retries are bounded and grow', () => {
  const delays = [0, 1, 2].map(retry.retryDelay);
  assert.deepEqual(delays, [...retry.RETRY_DELAYS_MS]);
  assert.ok(delays[0] < delays[1] && delays[1] < delays[2]);
  assert.equal(retry.retryDelay(3), null);
  assert.equal(retry.retryDelay(-1), null);
});

test('the sitemap lists static pages and escaped artist URLs', () => {
  const xml = buildSitemap('https://inkr.example', [
    { id: 'a1b2', updated_at: '2026-11-01T10:00:00Z' },
    { id: 'x&y<z' },
  ]);
  assert.match(xml, /<loc>https:\/\/inkr\.example\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/inkr\.example\/artist\/a1b2<\/loc><lastmod>2026-11-01<\/lastmod>/);
  assert.match(xml, /artist\/x%26y%3Cz<\/loc>/);
  assert.ok(!xml.includes('x&y<z'));
});

test('the CSP in vercel.json allows the inline script Expo emits', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
  const [hash] = inlineScriptHashes('<script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script><script src="/a.js" defer></script>');
  assert.ok(csp.includes(hash));
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
  assert.match(csp, /frame-ancestors 'none'/);
});

test('every dynamic route has a rewrite to a bracket-free shell', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  for (const route of ['artist', 'post', 'request', 'conversation', 'appointment']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'app', route, '[id].tsx')), route);
    const rewrite = vercel.rewrites.find((r) => r.source === `/${route}/:id`);
    assert.equal(rewrite?.destination, `/_dyn/${route}`);
  }
});
