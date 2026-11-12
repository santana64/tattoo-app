#!/usr/bin/env node
/* global __dirname */
// Runs after `expo export -p web` (see "build:web" in package.json):
//
//   1. Copies each dynamic route shell (dist/artist/[id].html …) to a
//      bracket-free path (dist/_dyn/artist.html) that vercel.json rewrites to,
//      so /artist/<id> opened directly or reloaded no longer returns 404.
//   2. Checks that the inline script Expo emits still matches the hash allowed
//      by the Content-Security-Policy in vercel.json. If Expo changes it, the
//      build fails here instead of shipping a site that cannot hydrate.
//   3. Writes one HTML file per public page — artist profiles, published photo
//      posts, published flashes and series with at least one published photo —
//      (dist/artist/<id>.html, dist/post/<id>.html, dist/flash/<id>.html,
//      dist/series/<id>.html) carrying that page's title, description and
//      image, so search engines and link previews (which do not run
//      JavaScript) see the real content. Vercel serves these files first
//      (cleanUrls) and only falls back to the /_dyn rewrite for ids that have
//      no file, e.g. content published after the build. The page body is
//      still rendered by the app once it loads.
//   4. Writes sitemap.xml (static pages + every generated page) and points
//      robots.txt at it.
//
// Supabase being unreachable never fails the build: the pages that could not
// be fetched are simply not generated and keep the generic shell.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DYNAMIC_ROUTES = ['artist', 'post', 'reels', 'flash', 'series', 'request', 'conversation', 'appointment'];
const STATIC_PAGES = ['', '/explore', '/welcome', '/legal/terms', '/legal/privacy-policy'];
const SITEMAP_TIMEOUT_MS = 8000;
const MAX_ARTISTS = 5000;
/** Newest first; keeps the build fast and the sitemap well under its 50,000 URL limit. */
const CAPS = { artists: MAX_ARTISTS, posts: 2000, flashes: 1000, series: 500 };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ARTIST_COLUMNS = 'id,blaze,city,bio,styles,cover_url,avatar_url,updated_at';
const POST_COLUMNS = 'id,media_url,media_type,embed_provider,title,caption,styles,body_zone,session_hours,is_healed,published_at,artist:artists!artist_id(blaze,city)';
const FLASH_COLUMNS = 'id,title,style,price,image_url,total_copies,sold_copies,updated_at,created_at,artist:artists!artist_id(blaze,city)';
const SERIES_COLUMNS = 'id,title,description,created_at,artist:artists!artist_id(blaze,city),posts!inner(media_url,published_at)';
const DESCRIPTION_MAX = 160;
// Same rule as isVideoMedia() in components/PostCard.tsx: such posts have no still image.
const VIDEO_URL = /\.(mp4|mov|m4v|webm|m3u8)(\?|#|$)|^https?:\/\/(www\.|m\.)?(tiktok\.com|instagram\.com)\//i;

function siteUrl() {
  return (process.env.EXPO_PUBLIC_SITE_URL || 'https://tattoo-app-4gmu.vercel.app').replace(/\/+$/, '');
}

function copyDynamicShells() {
  const target = path.join(DIST, '_dyn');
  fs.mkdirSync(target, { recursive: true });
  for (const route of DYNAMIC_ROUTES) {
    const source = path.join(DIST, route, '[id].html');
    if (!fs.existsSync(source)) throw new Error(`Missing export for dynamic route: ${route}/[id].html`);
    fs.copyFileSync(source, path.join(target, `${route}.html`));
  }
}

/** sha256 CSP sources of every inline <script> in an exported page. */
function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const match of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    hashes.add(`'sha256-${crypto.createHash('sha256').update(match[1], 'utf8').digest('base64')}'`);
  }
  return hashes;
}

function checkContentSecurityPolicy() {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const csp = (vercel.headers ?? [])
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value;
  if (!csp) throw new Error('vercel.json has no Content-Security-Policy header.');

  const pages = ['index.html', 'welcome.html', 'explore.html', path.join('artist', '[id].html')];
  const missing = new Set();
  for (const page of pages) {
    for (const hash of inlineScriptHashes(fs.readFileSync(path.join(DIST, page), 'utf8'))) {
      if (!csp.includes(hash)) missing.add(hash);
    }
  }
  if (missing.size) {
    throw new Error(
      `Inline scripts are not allowed by the Content-Security-Policy in vercel.json.\n` +
      `Add to script-src: ${[...missing].join(' ')}`,
    );
  }
}

// ── Data ─────────────────────────────────────────────────────────────────────

function supabaseEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null;
}

/** One public REST read. Never fails the build: returns [] on any problem. */
async function fetchRows(resource, query, label) {
  const env = supabaseEnv();
  if (!env) return [];
  try {
    const response = await fetch(`${env.url}/rest/v1/${resource}?${query}`, {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn(`postexport: ${label} not listed in the sitemap (${error.message}).`);
    return [];
  }
}

const isVideoUrl = (url) => typeof url !== 'string' || VIDEO_URL.test(url.trim());

/**
 * Keeps the rows that may get a page: well-formed ids only (they become file
 * names), still images only for posts, at least one piece for series, and
 * never more than the cap of that kind.
 */
function selectRows(kind, rows) {
  if (!Array.isArray(rows)) return [];
  const keep = rows.filter((row) => {
    if (!row || typeof row.id !== 'string' || !UUID_PATTERN.test(row.id)) return false;
    if (kind === 'posts') return row.media_type === 'photo' && !row.embed_provider && !isVideoUrl(row.media_url);
    if (kind === 'series') return Array.isArray(row.posts) && row.posts.length > 0;
    return true;
  });
  return keep.slice(0, CAPS[kind] ?? 0);
}

/** Public artist ids for the sitemap. Never fails the build: returns [] on any problem. */
async function fetchArtists() {
  if (!supabaseEnv()) {
    console.warn('postexport: Supabase env not set, sitemap lists static pages only.');
    return [];
  }
  const rows = await fetchRows('artists', `select=${ARTIST_COLUMNS}&order=updated_at.desc&limit=${CAPS.artists}`, 'artists');
  return selectRows('artists', rows);
}

/** Every public page that gets its own HTML file. Never throws. */
async function fetchPublicPages() {
  const [artists, posts, flashes, series] = await Promise.all([
    fetchArtists(),
    fetchRows('posts', `select=${POST_COLUMNS}&is_published=eq.true&media_type=eq.photo&embed_provider=is.null&order=published_at.desc.nullslast&limit=${CAPS.posts}`, 'posts'),
    fetchRows('flash_designs', `select=${FLASH_COLUMNS}&is_published=eq.true&order=created_at.desc&limit=${CAPS.flashes}`, 'flashes'),
    fetchRows(
      'artist_series',
      `select=${SERIES_COLUMNS}&posts.is_published=eq.true&posts.media_type=eq.photo&posts.order=published_at.desc.nullslast&posts.limit=1&order=created_at.desc&limit=${CAPS.series}`,
      'series',
    ),
  ]);
  return {
    artists,
    posts: selectRows('posts', posts),
    flashes: selectRows('flashes', flashes),
    series: selectRows('series', series),
  };
}

// ── Metadata ─────────────────────────────────────────────────────────────────

const htmlEscape = (value) => String(value).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

function shorten(text, max = DESCRIPTION_MAX) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30))}…`;
}

const styleLabel = (slug) => String(slug).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const text = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const httpsImage = (url) => (typeof url === 'string' && /^https:\/\//.test(url) && !isVideoUrl(url) ? url : null);
const fallbackImage = (base) => `${base}/og-image.png`;
const embeddedArtist = (row) => (row && row.artist && typeof row.artist === 'object' && !Array.isArray(row.artist) ? row.artist : {});

/** Title, description and image of an artist page: same wording as app/artist/[id].tsx. */
function artistMeta(artist, base) {
  const name = String(artist.blaze || 'Artiste').trim();
  const city = String(artist.city || '').trim();
  const styles = (Array.isArray(artist.styles) ? artist.styles : []).slice(0, 3).map(styleLabel).join(', ');
  const summary = `${name}, artiste tatoueur${city ? ` à ${city}` : ''}${styles ? ` (${styles})` : ''}.`;
  const bio = String(artist.bio || '').trim() || 'Découvrez son portfolio et envoyez-lui votre projet sur Inkr.';
  const image = [artist.cover_url, artist.avatar_url].find((url) => typeof url === 'string' && /^https:\/\//.test(url));
  return {
    title: `${name} — Tatoueur${city ? ` à ${city}` : ''} | Inkr`,
    description: shorten(`${summary} ${bio}`),
    url: `${base}/artist/${artist.id}`,
    image: image || fallbackImage(base),
    type: 'profile',
  };
}

/** The wall-label lines of a piece, as artworkLabel() in lib/studio.ts. */
function postLabelLines(post) {
  const lines = [];
  const styles = (Array.isArray(post.styles) ? post.styles : []).slice(0, 2).map(styleLabel).join(', ');
  if (styles) lines.push(styles);
  if (text(post.body_zone)) lines.push(text(post.body_zone));
  const hours = Number(post.session_hours);
  if (post.session_hours !== null && post.session_hours !== undefined && Number.isFinite(hours) && hours > 0) {
    lines.push(`${String(hours).replace('.', ',')} h de séance`);
  }
  if (post.is_healed === true) lines.push('Photographié cicatrisé');
  const year = post.published_at ? new Date(post.published_at).getFullYear() : NaN;
  if (!Number.isNaN(year)) lines.push(String(year));
  return lines;
}

/** Same wording as the <Seo> of app/post/[id].tsx. */
function postMeta(post, base) {
  const artist = embeddedArtist(post);
  const blaze = text(artist.blaze);
  const city = text(artist.city);
  const pieceTitle = text(post.title);
  const styles = (Array.isArray(post.styles) ? post.styles : []).slice(0, 3).map(styleLabel).join(' · ');
  const by = blaze ? `${blaze}${city ? `, ${city}` : ''}` : 'un artiste Inkr';
  const lead = text(post.caption) || postLabelLines(post).join(', ');
  return {
    title: `${pieceTitle ? `${pieceTitle} — ` : ''}Tatouage ${styles || 'réalisé'} par ${blaze || 'un artiste'} | Inkr`,
    description: shorten(`${lead ? `${lead} — ` : ''}Réalisation de ${by}. Découvrez son portfolio sur Inkr.`),
    url: `${base}/post/${post.id}`,
    image: httpsImage(post.media_url) || fallbackImage(base),
    type: 'article',
  };
}

/** "Pièce unique", "3 exemplaires restants", "Épuisé": as app/flash/[id].tsx. */
function flashAvailability(flash) {
  const total = Number(flash.total_copies) || 0;
  const left = Math.max(total - (Number(flash.sold_copies) || 0), 0);
  if (left === 0) return 'Épuisé';
  if (total === 1) return 'Pièce unique';
  return left === 1 ? '1 exemplaire restant' : `${left} exemplaires restants`;
}

/** Same wording as the <Seo> of app/flash/[id].tsx. */
function flashMeta(flash, base) {
  const artist = embeddedArtist(flash);
  const blaze = text(artist.blaze) || 'un artiste Inkr';
  const city = text(artist.city);
  const title = text(flash.title) || 'Flash';
  const price = Number(flash.price);
  const priceLabel = Number.isFinite(price) && price > 0 ? `${price.toLocaleString('fr-FR')} €` : null;
  const style = flash.style ? `${styleLabel(flash.style).toLowerCase()} ` : '';
  const facts = [priceLabel, flashAvailability(flash).toLowerCase()].filter(Boolean).join(', ');
  return {
    title: `${title} — Flash de ${blaze} | Inkr`,
    description: shorten(`Flash ${style}« ${title} » dessiné par ${blaze}${city ? `, ${city}` : ''} : ${facts}. Réservez-le sur Inkr.`),
    url: `${base}/flash/${flash.id}`,
    image: httpsImage(flash.image_url) || fallbackImage(base),
    type: 'article',
  };
}

/** Same wording as the <Seo> of app/series/[id].tsx. */
function seriesMeta(series, base) {
  const artist = embeddedArtist(series);
  const blaze = text(artist.blaze);
  const city = text(artist.city);
  const title = text(series.title) || 'Série';
  const first = Array.isArray(series.posts) ? series.posts[0] : null;
  const description = text(series.description)
    || `Série « ${title} » de ${blaze || 'un artiste Inkr'}${city ? `, tatoueur à ${city}` : ''}. Découvrez l’exposition sur Inkr.`;
  return {
    title: `${title} — ${blaze || 'Artiste Inkr'} | Inkr`,
    description: shorten(description),
    url: `${base}/series/${series.id}`,
    image: httpsImage(first && first.media_url) || fallbackImage(base),
    type: 'article',
  };
}

/**
 * Fills the head of a generic route shell with one page's metadata. These
 * pages are public by construction, so they are indexable even when the
 * generic shell is not. Throws when a tag is missing, so a change in the
 * exported markup is noticed.
 */
function renderMetaPage(shell, meta, label) {
  let html = shell;
  const replace = (pattern, value, tag) => {
    if (!pattern.test(html)) throw new Error(`${label} shell has no ${tag} tag to fill.`);
    html = html.replace(pattern, (_, before, after) => `${before}${htmlEscape(value)}${after}`);
  };
  const metaTag = (attr, key) => new RegExp(`(<meta data-rh="true" ${attr}="${key}" content=")[^"]*(")`);

  replace(/(<title data-rh="true">)[^<]*(<\/title>)/, meta.title, 'title');
  replace(metaTag('name', 'description'), meta.description, 'description');
  replace(metaTag('name', 'robots'), 'index, follow', 'robots');
  replace(/(<link data-rh="true" rel="canonical" href=")[^"]*(")/, meta.url, 'canonical');
  replace(metaTag('property', 'og:type'), meta.type, 'og:type');
  replace(metaTag('property', 'og:title'), meta.title, 'og:title');
  replace(metaTag('property', 'og:description'), meta.description, 'og:description');
  replace(metaTag('property', 'og:url'), meta.url, 'og:url');
  replace(metaTag('property', 'og:image'), meta.image, 'og:image');
  replace(metaTag('name', 'twitter:title'), meta.title, 'twitter:title');
  replace(metaTag('name', 'twitter:description'), meta.description, 'twitter:description');
  replace(metaTag('name', 'twitter:image'), meta.image, 'twitter:image');
  return html;
}

const renderArtistPage = (shell, artist, base) => renderMetaPage(shell, artistMeta(artist, base), 'Artist');
const renderPostPage = (shell, post, base) => renderMetaPage(shell, postMeta(post, base), 'Post');
const renderFlashPage = (shell, flash, base) => renderMetaPage(shell, flashMeta(flash, base), 'Flash');
const renderSeriesPage = (shell, series, base) => renderMetaPage(shell, seriesMeta(series, base), 'Series');

/** Writes dist/<route>/<id>.html next to the generic dist/<route>/[id].html shell. */
function writePages(route, rows, render, base) {
  if (!rows.length) return;
  const shell = fs.readFileSync(path.join(DIST, route, '[id].html'), 'utf8');
  for (const row of rows) {
    fs.writeFileSync(path.join(DIST, route, `${row.id}.html`), render(shell, row, base));
  }
}

// ── Sitemap ──────────────────────────────────────────────────────────────────

const xmlEscape = (value) => value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
const day = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined);

function buildSitemap(base, artists, { posts = [], flashes = [], series = [] } = {}) {
  const entries = STATIC_PAGES.map((page) => ({ loc: `${base}${page || '/'}` }));
  const add = (route, row, lastmod) => entries.push({ loc: `${base}/${route}/${encodeURIComponent(row.id)}`, lastmod: day(lastmod) });
  for (const artist of artists) add('artist', artist, artist.updated_at);
  for (const post of posts) add('post', post, post.published_at);
  for (const flash of flashes) add('flash', flash, flash.updated_at || flash.created_at);
  for (const item of series) {
    const latest = Array.isArray(item.posts) && item.posts[0] ? item.posts[0].published_at : null;
    add('series', item, latest || item.created_at);
  }
  const urls = entries.map(({ loc, lastmod }) =>
    `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function writeRobots(base) {
  const file = path.join(DIST, 'robots.txt');
  if (!fs.existsSync(file)) throw new Error('dist/robots.txt is missing (expected from public/robots.txt).');
  const robots = fs.readFileSync(file, 'utf8').replace(/^Sitemap:.*$/m, `Sitemap: ${base}/sitemap.xml`);
  fs.writeFileSync(file, robots);
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `expo export -p web` first.');
  copyDynamicShells();
  checkContentSecurityPolicy();
  const base = siteUrl();
  const { artists, posts, flashes, series } = await fetchPublicPages();
  writePages('artist', artists, renderArtistPage, base);
  writePages('post', posts, renderPostPage, base);
  writePages('flash', flashes, renderFlashPage, base);
  writePages('series', series, renderSeriesPage, base);
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(base, artists, { posts, flashes, series }));
  writeRobots(base);
  const generated = artists.length + posts.length + flashes.length + series.length;
  console.log(
    `postexport: ${DYNAMIC_ROUTES.length} dynamic shells, ${artists.length} artist / ${posts.length} post / ` +
    `${flashes.length} flash / ${series.length} series pages, sitemap with ${STATIC_PAGES.length + generated} URLs.`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`postexport failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CAPS,
  artistMeta, postMeta, flashMeta, seriesMeta,
  buildSitemap, fetchPublicPages, inlineScriptHashes, selectRows,
  renderArtistPage, renderPostPage, renderFlashPage, renderSeriesPage,
};
