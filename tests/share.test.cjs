/* global __dirname */
// Pure logic of lib/share.ts: public URLs, the choice of a share mechanism
// and the outcome of each path (shared, copied, dismissed, failed).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, requireStub) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(requireStub, mod, mod.exports);
  return mod.exports;
}

const site = loadTs('lib/site.ts', require);
const share = loadTs('lib/share.ts', (name) => {
  if (name === 'react-native') return { Platform: { OS: 'web' }, Share: { share: async () => ({ action: 'sharedAction' }) } };
  if (name === './site') return site;
  return require(name);
});

const INPUT = { title: 'Rose noire par Atelier Noir', text: 'Une pièce cicatrisée.', url: `${site.SITE_URL}/post/abc` };

test('shared links are absolute URLs on the public site, never elsewhere', () => {
  assert.equal(share.absoluteUrl('/post/abc'), `${site.SITE_URL}/post/abc`);
  assert.equal(share.absoluteUrl('series/xyz'), `${site.SITE_URL}/series/xyz`);
  assert.equal(share.absoluteUrl(''), site.SITE_URL);
  assert.equal(share.absoluteUrl('/'), site.SITE_URL);
  assert.equal(share.absoluteUrl(`${site.SITE_URL}/flash/1`), `${site.SITE_URL}/flash/1`);
  for (const hostile of ['//evil.example/x', 'https://evil.example/x', '\\\\evil.example/x', 'HTTP://evil.example/x']) {
    const url = share.absoluteUrl(hostile);
    assert.ok(url.startsWith(`${site.SITE_URL}/`), `${hostile} → ${url}`);
    assert.equal(new URL(url).origin, new URL(site.SITE_URL).origin, url);
  }
});

test('the share mechanism follows what the device offers', () => {
  const caps = (over) => ({ platform: 'web', webShare: false, clipboard: false, legacyCopy: false, ...over });
  assert.equal(share.chooseShareStrategy(caps({ platform: 'ios' })), 'native-sheet');
  assert.equal(share.chooseShareStrategy(caps({ platform: 'android', webShare: true })), 'native-sheet');
  assert.equal(share.chooseShareStrategy(caps({ webShare: true, clipboard: true })), 'web-share');
  assert.equal(share.chooseShareStrategy(caps({ clipboard: true, legacyCopy: true })), 'clipboard');
  assert.equal(share.chooseShareStrategy(caps({ legacyCopy: true })), 'legacy-copy');
  assert.equal(share.chooseShareStrategy(caps({})), 'none');
});

test('capabilities are read from the environment, including canShare', () => {
  const nav = { share: async () => {}, canShare: () => false, clipboard: { writeText: async () => {} } };
  const caps = share.capabilitiesOf({ platform: 'web', navigator: nav }, INPUT);
  assert.deepEqual(caps, { platform: 'web', webShare: false, clipboard: true, legacyCopy: false });
  const throwing = share.capabilitiesOf({ platform: 'web', navigator: { share: async () => {}, canShare: () => { throw new Error('x'); } } }, INPUT);
  assert.equal(throwing.webShare, false);
});

test('closing a share sheet is a dismissal, not an error', () => {
  assert.equal(share.isShareCancellation({ name: 'AbortError', message: 'Share canceled' }), true);
  assert.equal(share.isShareCancellation(new Error('User did not share')), false);
  assert.equal(share.isShareCancellation(new Error('The user canceled the operation')), true);
  assert.equal(share.isShareCancellation(null), false);
  assert.equal(share.isShareCancellation('AbortError'), false);
});

test('Android gets the URL inside the message; iOS gets it separately', () => {
  assert.deepEqual(share.nativeShareContent('ios', INPUT), { title: INPUT.title, message: INPUT.text, url: INPUT.url });
  assert.deepEqual(share.nativeShareContent('android', INPUT), { title: INPUT.title, message: `${INPUT.text}\n${INPUT.url}` });
  assert.equal(share.nativeShareContent('android', { ...INPUT, text: '  ' }).message, `${INPUT.title}\n${INPUT.url}`);
  assert.deepEqual(share.webShareData({ ...INPUT, text: undefined }), { title: INPUT.title, url: INPUT.url });
});

test('web: the system share sheet, its cancellation, and the copy fallback', async () => {
  let shared = null;
  const ok = { platform: 'web', navigator: { share: async (data) => { shared = data; } } };
  assert.equal(await share.performShare(INPUT, ok), 'shared');
  assert.deepEqual(shared, { title: INPUT.title, text: INPUT.text, url: INPUT.url });

  const abort = Object.assign(new Error('Share canceled'), { name: 'AbortError' });
  assert.equal(await share.performShare(INPUT, { platform: 'web', navigator: { share: async () => { throw abort; } } }), 'dismissed');

  // Refused (e.g. outside a user gesture): falls back to copying the link.
  let copied = null;
  const refused = Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' });
  const env = { platform: 'web', navigator: { share: async () => { throw refused; }, clipboard: { writeText: async (t) => { copied = t; } } } };
  assert.equal(await share.performShare(INPUT, env), 'copied');
  assert.equal(copied, INPUT.url);
});

test('web: clipboard, then a hidden textarea, then failure', async () => {
  let copied = null;
  assert.equal(await share.performShare(INPUT, { platform: 'web', navigator: { clipboard: { writeText: async (t) => { copied = t; } } } }), 'copied');
  assert.equal(copied, INPUT.url);

  const appended = [];
  const removed = [];
  const fakeDocument = (result) => ({
    createElement: () => ({ value: '', style: {}, setAttribute() {}, select() {} }),
    body: { appendChild: (n) => appended.push(n), removeChild: (n) => removed.push(n) },
    execCommand: (command) => command === 'copy' && result,
  });
  const denied = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
  assert.equal(await share.performShare(INPUT, { platform: 'web', navigator: denied, document: fakeDocument(true) }), 'copied');
  assert.equal(appended[0].value, INPUT.url);
  assert.equal(removed.length, 1, 'the textarea is always removed');

  assert.equal(await share.performShare(INPUT, { platform: 'web', navigator: denied, document: fakeDocument(false) }), 'failed');
  assert.equal(removed.length, 2);
  assert.equal(await share.performShare(INPUT, { platform: 'web' }), 'failed');
});

test('native: shared, dismissed or failed', async () => {
  let received = null;
  const env = (impl) => ({ platform: 'ios', nativeShare: async (c) => { received = c; return impl(); } });
  assert.equal(await share.performShare(INPUT, env(() => ({ action: 'sharedAction' }))), 'shared');
  assert.equal(received.url, INPUT.url);
  assert.equal(await share.performShare(INPUT, env(() => ({ action: 'dismissedAction' }))), 'dismissed');
  assert.equal(await share.performShare(INPUT, env(() => { throw new Error('boom'); })), 'failed');
  assert.equal(await share.performShare(INPUT, { platform: 'android' }), 'failed');
});
