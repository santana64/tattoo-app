#!/usr/bin/env node
// Runs after `expo export -p web` (see "build:web" in package.json):
//
//   1. Copies each dynamic route shell (dist/artist/[id].html …) to a
//      bracket-free path (dist/_dyn/artist.html) that vercel.json rewrites to,
//      so /artist/<id> opened directly or reloaded no longer returns 404.
//   2. Checks that the inline script Expo emits still matches the hash allowed
//      by the Content-Security-Policy in vercel.json. If Expo changes it, the
//      build fails here instead of shipping a site that cannot hydrate.
//   3. Writes sitemap.xml (public pages + artist profiles) and points
//      robots.txt at it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DYNAMIC_ROUTES = ['artist', 'post', 'request', 'conversation', 'appointment'];
const STATIC_PAGES = ['', '/explore', '/welcome', '/legal/terms', '/legal/privacy-policy'];
const SITEMAP_TIMEOUT_MS = 8000;
const MAX_ARTISTS = 5000;

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

/** Public artist ids for the sitemap. Never fails the build: returns [] on any problem. */
async function fetchArtists() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('postexport: Supabase env not set, sitemap lists static pages only.');
    return [];
  }
  try {
    const response = await fetch(
      `${url.replace(/\/+$/, '')}/rest/v1/artists?select=id,updated_at&order=updated_at.desc&limit=${MAX_ARTISTS}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) ? rows.filter((row) => typeof row.id === 'string') : [];
  } catch (error) {
    console.warn(`postexport: artists not listed in the sitemap (${error.message}).`);
    return [];
  }
}

const xmlEscape = (value) => value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

function buildSitemap(base, artists) {
  const entries = STATIC_PAGES.map((page) => ({ loc: `${base}${page || '/'}` }));
  for (const artist of artists) {
    const lastmod = typeof artist.updated_at === 'string' ? artist.updated_at.slice(0, 10) : undefined;
    entries.push({ loc: `${base}/artist/${encodeURIComponent(artist.id)}`, lastmod });
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
  const artists = await fetchArtists();
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(base, artists));
  writeRobots(base);
  console.log(`postexport: ${DYNAMIC_ROUTES.length} dynamic shells, sitemap with ${STATIC_PAGES.length + artists.length} URLs.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`postexport failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { buildSitemap, inlineScriptHashes };
