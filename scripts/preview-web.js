#!/usr/bin/env node
// Serves the static web export (dist/) the way Vercel does, by applying the
// cleanUrls, rewrites and headers of vercel.json. Use it to check deep links
// and security headers before deploying:
//
//   npm run build:web && npm run preview:web
//
// No dependency, local use only.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4173;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

/** Vercel route source ("/artist/:id", "/(.*)") → anchored RegExp. */
function toRegExp(source) {
  const pattern = source
    .replace(/:[A-Za-z0-9_]+\*/g, '.*')
    .replace(/:[A-Za-z0-9_]+/g, '[^/]+');
  return new RegExp(`^${pattern}$`);
}

const rewrites = (config.rewrites ?? []).map((r) => ({ test: toRegExp(r.source), destination: r.destination }));
const headerRules = (config.headers ?? []).map((h) => ({ test: toRegExp(h.source), headers: h.headers }));

/** Resolves a URL path to a file inside dist/, or null. */
function resolveFile(urlPath) {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const base = path.join(DIST, safe);
  if (!base.startsWith(DIST)) return null;
  const candidates = [base];
  if (config.cleanUrls) candidates.push(`${base}.html`);
  candidates.push(path.join(base, 'index.html'));
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname;

  // Same order as Vercel: the filesystem first, then rewrites.
  let file = resolveFile(urlPath);
  if (!file) {
    const rewrite = rewrites.find((r) => r.test.test(urlPath));
    if (rewrite) file = resolveFile(rewrite.destination);
  }

  for (const rule of headerRules) {
    if (rule.test.test(urlPath)) for (const h of rule.headers) res.setHeader(h.key, h.value);
  }

  if (!file) {
    const notFound = path.join(DIST, '+not-found.html');
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Web export preview: http://localhost:${PORT}`);
});
