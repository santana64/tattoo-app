/* global __dirname */
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
const {
  CAPS, artistMeta, postMeta, flashMeta, seriesMeta, buildSitemap, fetchPublicPages, inlineScriptHashes, selectRows,
  renderArtistPage, renderPostPage, renderFlashPage, renderSeriesPage,
} = require('../scripts/postexport-web.js');

test('public pages are indexable, personal ones are not', () => {
  for (const segments of [['(tabs)'], ['(tabs)', 'index'], ['(tabs)', 'explore'], ['(auth)', 'welcome'], ['artist', '[id]'], ['post', '[id]'], ['series', '[id]'], ['legal', 'terms']]) {
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
  const directive = (name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  // The two providers a reel may be embedded from, and the optional sign-in captcha.
  assert.equal(directive('frame-src'), 'frame-src https://www.tiktok.com https://www.instagram.com https://challenges.cloudflare.com');
  // Supabase, and the city lookup.
  assert.equal(directive('connect-src'), "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://photon.komoot.io");
  // Scripts: our own files, Expo's inline bootstrap by hash, the captcha loader. Nothing broader.
  assert.equal(directive('script-src'), `script-src 'self' ${hash} https://challenges.cloudflare.com`);
});

test('every dynamic route has a rewrite to a bracket-free shell', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  for (const route of ['artist', 'post', 'reels', 'flash', 'series', 'request', 'conversation', 'appointment']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'app', route, '[id].tsx')), route);
    const rewrite = vercel.rewrites.find((r) => r.source === `/${route}/:id`);
    assert.equal(rewrite?.destination, `/_dyn/${route}`);
  }
});

// The head the app exports for the generic artist route (components/Seo.tsx).
const ARTIST_SHELL = [
  '<html><head>',
  '<title data-rh="true">Profil d’artiste tatoueur — Inkr</title>',
  '<meta data-rh="true" name="description" content="generic"/>',
  '<meta data-rh="true" name="robots" content="noindex, nofollow"/>',
  '<link data-rh="true" rel="canonical" href="https://inkr.example/artist/[id]"/>',
  '<meta data-rh="true" property="og:type" content="website"/>',
  '<meta data-rh="true" property="og:title" content="generic"/>',
  '<meta data-rh="true" property="og:description" content="generic"/>',
  '<meta data-rh="true" property="og:url" content="https://inkr.example/artist/[id]"/>',
  '<meta data-rh="true" property="og:image" content="https://inkr.example/og-image.png"/>',
  '<meta data-rh="true" name="twitter:title" content="generic"/>',
  '<meta data-rh="true" name="twitter:description" content="generic"/>',
  '<meta data-rh="true" name="twitter:image" content="https://inkr.example/og-image.png"/>',
  '</head><body><div id="root">app</div></body></html>',
].join('');

test('an artist page carries that artist’s title, description and image', () => {
  const artist = {
    id: '11111111-2222-3333-4444-555555555555',
    blaze: 'Atelier Noir', city: 'Lyon', styles: ['blackwork', 'fine-line'],
    bio: 'Vingt ans de métier.', cover_url: 'https://cdn.example/cover.jpg', avatar_url: null,
  };
  const html = renderArtistPage(ARTIST_SHELL, artist, 'https://inkr.example');
  assert.ok(html.includes('<title data-rh="true">Atelier Noir — Tatoueur à Lyon | Inkr</title>'));
  assert.ok(html.includes('name="description" content="Atelier Noir, artiste tatoueur à Lyon (Blackwork, Fine line). Vingt ans de métier."'));
  assert.ok(html.includes('rel="canonical" href="https://inkr.example/artist/11111111-2222-3333-4444-555555555555"'));
  assert.ok(html.includes('property="og:image" content="https://cdn.example/cover.jpg"'));
  assert.ok(html.includes('property="og:type" content="profile"'));
  assert.ok(!html.includes('generic'));
  assert.ok(html.includes('<div id="root">app</div>'));
});

test('artist text cannot inject markup, and odd data falls back safely', () => {
  const hostile = {
    id: '11111111-2222-3333-4444-555555555555',
    blaze: '"><script>alert(1)</script>', city: 'Paris', bio: 'x'.repeat(500),
    cover_url: 'javascript:alert(1)', avatar_url: 'http://insecure.example/a.jpg', styles: null,
  };
  const html = renderArtistPage(ARTIST_SHELL, hostile, 'https://inkr.example');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('insecure.example'));
  const meta = artistMeta(hostile, 'https://inkr.example');
  assert.equal(meta.image, 'https://inkr.example/og-image.png');
  assert.ok(meta.description.length <= 160);
  assert.equal(artistMeta({ id: 'x' }, 'https://inkr.example').title, 'Artiste — Tatoueur | Inkr');
});

test('a changed export format fails loudly instead of shipping generic pages', () => {
  assert.throws(() => renderArtistPage('<html><head></head></html>', { id: 'x', blaze: 'A' }, 'https://inkr.example'), /no title tag/);
});

test('generated pages are indexable even when the generic shell is not', () => {
  const html = renderArtistPage(ARTIST_SHELL, { id: '11111111-2222-3333-4444-555555555555', blaze: 'A' }, 'https://inkr.example');
  assert.ok(html.includes('name="robots" content="index, follow"'));
  assert.ok(!html.includes('noindex'));
});

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BASE = 'https://inkr.example';

test('a post page carries its title, label and photo', () => {
  const post = {
    id: ID(1), media_url: 'https://cdn.example/rose.jpg', media_type: 'photo', embed_provider: null,
    title: 'Rose noire', caption: '', styles: ['blackwork', 'fine-line'], body_zone: 'Avant-bras',
    session_hours: 3.5, is_healed: true, published_at: '2026-10-02T10:00:00Z', artist: { blaze: 'Atelier Noir', city: 'Lyon' },
  };
  const meta = postMeta(post, BASE);
  assert.equal(meta.title, 'Rose noire — Tatouage Blackwork · Fine line par Atelier Noir | Inkr');
  assert.ok(meta.description.startsWith('Blackwork, Fine line, Avant-bras, 3,5 h de séance, Photographié cicatrisé, 2026 — Réalisation de Atelier Noir, Lyon.'));
  assert.ok(meta.description.length <= 160);
  assert.equal(meta.url, `${BASE}/post/${ID(1)}`);
  assert.equal(meta.image, 'https://cdn.example/rose.jpg');
  const html = renderPostPage(ARTIST_SHELL, post, BASE);
  assert.ok(html.includes('<title data-rh="true">Rose noire — Tatouage Blackwork · Fine line par Atelier Noir | Inkr</title>'));
  assert.ok(html.includes('property="og:type" content="article"'));
  assert.ok(html.includes(`rel="canonical" href="${BASE}/post/${ID(1)}"`));
  assert.ok(!html.includes('generic'));

  // A caption leads the description; no title and no artist fall back to neutral wording.
  const bare = postMeta({ id: ID(2), media_url: 'https://cdn.example/a.jpg', caption: 'Première séance.' }, BASE);
  assert.equal(bare.title, 'Tatouage réalisé par un artiste | Inkr');
  assert.equal(bare.description, 'Première séance. — Réalisation de un artiste Inkr. Découvrez son portfolio sur Inkr.');
});

test('a flash page carries its price, availability and drawing', () => {
  const flash = {
    id: ID(3), title: 'Hirondelle', style: 'old-school', price: 1200, image_url: 'https://cdn.example/f.png',
    total_copies: 3, sold_copies: 1, artist: { blaze: 'Mira', city: 'Nantes' },
  };
  const meta = flashMeta(flash, BASE);
  assert.equal(meta.title, 'Hirondelle — Flash de Mira | Inkr');
  assert.match(meta.description, /^Flash old school « Hirondelle » dessiné par Mira, Nantes : 1\s?200 €, 2 exemplaires restants\. Réservez-le sur Inkr\.$/);
  assert.equal(meta.image, 'https://cdn.example/f.png');
  assert.match(flashMeta({ ...flash, total_copies: 1, sold_copies: 0 }, BASE).description, /pièce unique/);
  assert.match(flashMeta({ ...flash, sold_copies: 3 }, BASE).description, /épuisé/);
  assert.equal(flashMeta({ id: ID(4) }, BASE).title, 'Flash — Flash de un artiste Inkr | Inkr');
  const html = renderFlashPage(ARTIST_SHELL, flash, BASE);
  assert.ok(html.includes(`property="og:url" content="${BASE}/flash/${ID(3)}"`));
  assert.ok(html.includes('name="robots" content="index, follow"'));
});

test('a series page carries the curator text and its first piece', () => {
  const series = {
    id: ID(5), title: 'Nocturnes', description: 'Sept pièces nées la nuit.', created_at: '2026-09-01T00:00:00Z',
    artist: { blaze: 'Atelier Noir', city: 'Lyon' }, posts: [{ media_url: 'https://cdn.example/n1.jpg', published_at: '2026-10-05T00:00:00Z' }],
  };
  const meta = seriesMeta(series, BASE);
  assert.equal(meta.title, 'Nocturnes — Atelier Noir | Inkr');
  assert.equal(meta.description, 'Sept pièces nées la nuit.');
  assert.equal(meta.image, 'https://cdn.example/n1.jpg');
  assert.equal(meta.url, `${BASE}/series/${ID(5)}`);
  const fallback = seriesMeta({ ...series, description: null }, BASE);
  assert.equal(fallback.description, 'Série « Nocturnes » de Atelier Noir, tatoueur à Lyon. Découvrez l’exposition sur Inkr.');
  assert.ok(renderSeriesPage(ARTIST_SHELL, series, BASE).includes('<title data-rh="true">Nocturnes — Atelier Noir | Inkr</title>'));
});

test('post, flash and series text cannot inject markup, and unsafe images fall back', () => {
  const evil = '"><script>alert(1)</script>';
  const pages = [
    renderPostPage(ARTIST_SHELL, { id: ID(6), title: evil, caption: evil, media_url: 'javascript:alert(1)', artist: { blaze: evil } }, BASE),
    renderFlashPage(ARTIST_SHELL, { id: ID(7), title: evil, style: evil, image_url: 'http://insecure.example/x.png', artist: { blaze: evil } }, BASE),
    renderSeriesPage(ARTIST_SHELL, { id: ID(8), title: evil, description: evil, artist: { city: evil }, posts: [{ media_url: 'https://cdn.example/clip.mp4' }] }, BASE),
  ];
  for (const html of pages) {
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('javascript:'));
    assert.ok(!html.includes('insecure.example'));
    assert.ok(!html.includes('clip.mp4'));
    assert.ok(html.includes(`property="og:image" content="${BASE}/og-image.png"`));
  }
  assert.ok(postMeta({ id: ID(9), caption: 'x'.repeat(600) }, BASE).description.length <= 160);
  assert.throws(() => renderPostPage('<html><head></head></html>', { id: ID(9) }, BASE), /Post shell has no title tag/);
});

test('only well-formed, still, non-empty content gets a page, within the caps', () => {
  const photo = (n, extra = {}) => ({ id: ID(n), media_type: 'photo', embed_provider: null, media_url: `https://cdn.example/${n}.jpg`, ...extra });
  const kept = selectRows('posts', [
    photo(1),
    photo(2, { media_type: 'video' }),
    photo(3, { embed_provider: 'tiktok' }),
    photo(4, { media_url: 'https://cdn.example/clip.MP4' }),
    photo(5, { media_url: 'https://www.instagram.com/reel/abc/' }),
    photo(6, { id: '../../etc/passwd' }),
    null,
  ]);
  assert.deepEqual(kept.map((p) => p.id), [ID(1)]);
  assert.deepEqual(selectRows('series', [{ id: ID(1), posts: [] }, { id: ID(2), posts: [{}] }, { id: ID(3) }]).map((s) => s.id), [ID(2)]);
  assert.deepEqual(selectRows('flashes', 'not an array'), []);

  assert.deepEqual(CAPS, { artists: 5000, posts: 2000, flashes: 1000, series: 500 });
  const many = Array.from({ length: 2600 }, (_, i) => photo(i + 1));
  assert.equal(selectRows('posts', many).length, 2000);
  assert.equal(selectRows('posts', many)[0].id, ID(1), 'the newest rows (first) are kept');
  assert.equal(selectRows('flashes', many).length, 1000);
  assert.equal(selectRows('series', many.map((p) => ({ ...p, posts: [{}] }))).length, 500);
});

test('the sitemap lists posts, flashes and series with their dates', () => {
  const xml = buildSitemap(BASE, [], {
    posts: [{ id: ID(1), published_at: '2026-10-02T10:00:00Z' }],
    flashes: [{ id: ID(2), created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-15T00:00:00Z' }],
    series: [{ id: ID(3), created_at: '2026-08-01T00:00:00Z', posts: [{ published_at: '2026-10-05T00:00:00Z' }] }, { id: ID(4), created_at: 'not a date' }],
  });
  assert.ok(xml.includes(`<loc>${BASE}/post/${ID(1)}</loc><lastmod>2026-10-02</lastmod>`));
  assert.ok(xml.includes(`<loc>${BASE}/flash/${ID(2)}</loc><lastmod>2026-09-15</lastmod>`));
  assert.ok(xml.includes(`<loc>${BASE}/series/${ID(3)}</loc><lastmod>2026-10-05</lastmod>`));
  assert.ok(xml.includes(`<loc>${BASE}/series/${ID(4)}</loc></url>`));
  // Without any data, the static pages are still listed.
  assert.equal((buildSitemap(BASE, []).match(/<url>/g) || []).length, 5);
});

test('missing configuration or an unreachable Supabase never breaks the build', async () => {
  const saved = { url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, fetch: globalThis.fetch, warn: console.warn };
  const empty = { artists: [], posts: [], flashes: [], series: [] };
  console.warn = () => {};
  try {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    globalThis.fetch = () => { throw new Error('must not be called'); };
    assert.deepEqual(await fetchPublicPages(), empty);

    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.example';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    globalThis.fetch = async () => { throw new Error('network down'); };
    assert.deepEqual(await fetchPublicPages(), empty);

    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => [] });
    assert.deepEqual(await fetchPublicPages(), empty);

    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ message: 'not a list' }) });
    assert.deepEqual(await fetchPublicPages(), empty);

    const queries = [];
    globalThis.fetch = async (url) => {
      queries.push(String(url));
      if (String(url).includes('/rest/v1/posts?')) {
        return { ok: true, status: 200, json: async () => [{ id: ID(1), media_type: 'photo', media_url: 'https://cdn.example/1.jpg' }] };
      }
      return { ok: true, status: 200, json: async () => [] };
    };
    const pages = await fetchPublicPages();
    assert.equal(pages.posts.length, 1);
    assert.ok(queries.some((q) => q.includes('/rest/v1/posts?') && q.includes('limit=2000') && q.includes('is_published=eq.true') && q.includes('media_type=eq.photo')));
    assert.ok(queries.some((q) => q.includes('/rest/v1/flash_designs?') && q.includes('limit=1000') && q.includes('is_published=eq.true')));
    assert.ok(queries.some((q) => q.includes('/rest/v1/artist_series?') && q.includes('limit=500') && q.includes('posts!inner')));
  } finally {
    if (saved.url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = saved.key;
    globalThis.fetch = saved.fetch;
    console.warn = saved.warn;
  }
});
