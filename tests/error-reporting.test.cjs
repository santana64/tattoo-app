/* global __dirname */
// Pure logic of lib/error-reporting.ts: the noise filter, the route sanitiser,
// the admin grouping, and the wiring of the global handlers on web and native.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'error-reporting.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

/** A fresh module instance (its "installed once" flag included) with stubbed dependencies. */
function load({ os = 'web', version = '1.4.0' } = {}) {
  const reports = [];
  const stubs = {
    './care': { reportError: (error, context) => reports.push({ error, context }) },
    'react-native': { Platform: { OS: os } },
    'expo-constants': { __esModule: true, default: { expoConfig: version ? { version } : null } },
  };
  const mod = { exports: {} };
  const stubRequire = (name) => (name in stubs ? stubs[name] : require(name));
  new Function('require', 'module', 'exports', compiled)(stubRequire, mod, mod.exports);
  return { lib: mod.exports, reports };
}

const { lib } = load();

test('noise nobody can act on is not reported', () => {
  const { shouldReport } = lib;
  assert.equal(shouldReport(new Error('Cannot read properties of undefined (reading "id")'), false), true);
  assert.equal(shouldReport('plain string failure', false), true);
  assert.equal(shouldReport({ message: 'permission denied for table posts' }, false), true);

  for (const empty of [undefined, null, '', '   ', new Error(''), {}, { message: 42 }, 0]) {
    assert.equal(shouldReport(empty, false), false, `no message: ${String(empty)}`);
  }
  assert.equal(shouldReport(new Error('ResizeObserver loop limit exceeded'), false), false);
  assert.equal(shouldReport(new Error('ResizeObserver loop completed with undelivered notifications.'), false), false);
  assert.equal(shouldReport('Script error.', false), false);
  assert.equal(shouldReport('Script error', false), false);

  const abort = new Error('The operation was aborted.');
  abort.name = 'AbortError';
  assert.equal(shouldReport(abort, false), false);
  assert.equal(shouldReport({ name: 'AbortError', message: 'whatever' }, false), false);
  assert.equal(shouldReport(new Error('signal is aborted without reason'), false), false);
  assert.equal(shouldReport(new Error('The user aborted a request.'), false), false);
  assert.equal(shouldReport('AbortError: Fetch is aborted', false), false);
});

test('network failures are dropped only while offline', () => {
  const { shouldReport } = lib;
  for (const message of ['Failed to fetch', 'TypeError: Network request failed', 'NetworkError when attempting to fetch resource.', 'Load failed']) {
    assert.equal(shouldReport(new TypeError(message), true), false, `offline: ${message}`);
    // Online, the same message can be a CSP or CORS mistake worth seeing.
    assert.equal(shouldReport(new TypeError(message), false), true, `online: ${message}`);
  }
  assert.equal(shouldReport(new Error('undefined is not a function'), true), true, 'offline does not hide real bugs');
});

test('a reported route keeps its shape but not who or what was viewed', () => {
  const { sanitizeRoute } = lib;
  const uuid = '3f2a9c4e-1b7d-4e8a-9f00-1234567890ab';
  assert.equal(sanitizeRoute(`/artist/${uuid}`), '/artist/:id');
  assert.equal(sanitizeRoute(`/artist/${uuid.toUpperCase()}/reviews`), '/artist/:id/reviews');
  assert.equal(sanitizeRoute(`/conversation/${uuid}?draft=hello&email=a@b.fr#bottom`), '/conversation/:id');
  assert.equal(sanitizeRoute('/request/new?artistId=abc&flashId=def'), '/request/new');
  assert.equal(sanitizeRoute('/post/123456'), '/post/:id');
  assert.equal(sanitizeRoute('/reels/V1StGXR8_Z5jdHi6B-myT'), '/reels/:id');
  assert.equal(sanitizeRoute('/u/jane.doe%40example.com'), '/u/:id');
  assert.equal(sanitizeRoute('/settings/delete-account'), '/settings/delete-account');
  assert.equal(sanitizeRoute('/premium-guide'), '/premium-guide');
  assert.equal(sanitizeRoute('/legal/privacy-policy'), '/legal/privacy-policy');
  assert.equal(sanitizeRoute('/page/2'), '/page/2', 'short numbers are not ids');
  assert.equal(sanitizeRoute(`https://inkr.example/appointment/${uuid}?deposit=paid`), '/appointment/:id');
  assert.equal(sanitizeRoute(`inkr://appointment/${uuid}`), '/appointment/:id');
  assert.equal(sanitizeRoute(''), '/');
  assert.equal(sanitizeRoute('?next=/artist/1'), '/');
  assert.equal(sanitizeRoute('/%E0%A4%A'), '/%E0%A4%A', 'a malformed escape does not throw');
  assert.equal(sanitizeRoute(undefined), '/');
  assert.ok(sanitizeRoute('/a'.repeat(300)).length <= 200);
});

test('errors are grouped by message, the most recent group first', () => {
  const row = (id, message, createdAt, extra = {}) => ({
    id, message, created_at: createdAt, stack: null, route: '/', platform: 'web', app_version: '1.0.0', user_id: null, ...extra,
  });
  const groups = lib.groupClientErrors([
    row('1', 'TypeError: a', '2026-11-10T10:00:00Z'),
    row('2', 'TypeError: b', '2026-11-11T09:00:00Z', { platform: 'ios' }),
    row('3', 'TypeError: a', '2026-11-11T12:00:00Z', { platform: 'android', route: '/post/:id' }),
    row('4', 'TypeError: a', '2026-11-09T08:00:00Z', { platform: null }),
  ]);
  assert.deepEqual(groups.map((g) => [g.message, g.count]), [['TypeError: a', 3], ['TypeError: b', 1]]);
  assert.equal(groups[0].latest.id, '3');
  assert.equal(groups[0].firstSeen, '2026-11-09T08:00:00Z');
  assert.deepEqual(groups[0].platforms, ['web', 'android']);
  assert.deepEqual(lib.groupClientErrors([]), []);
});

test('a crash is reported with a clean route, the platform and the app version', () => {
  const { lib: fresh, reports } = load({ os: 'android', version: '2.3.1' });
  fresh.reportCrash(new Error('boom'), '/artist/3f2a9c4e-1b7d-4e8a-9f00-1234567890ab?tab=flash');
  assert.equal(reports.length, 1);
  assert.equal(reports[0].error.message, 'boom');
  assert.deepEqual(reports[0].context, { route: '/artist/:id', platform: 'android', appVersion: '2.3.1' });

  fresh.reportCrash(new Error('ResizeObserver loop limit exceeded'), '/');
  assert.equal(reports.length, 1, 'noise is filtered before reaching the database');

  // Plain rejections become real errors, without a stack invented here.
  fresh.reportCrash({ name: 'PostgrestError', message: 'JWT expired' }, '/');
  assert.ok(reports[1].error instanceof Error);
  assert.equal(reports[1].error.name, 'PostgrestError');
  assert.equal(reports[1].error.message, 'JWT expired');
  assert.equal(reports[1].error.stack, '');
});

test('nothing is reported in development', () => {
  const { lib: fresh, reports } = load();
  globalThis.__DEV__ = true;
  try {
    fresh.reportCrash(new Error('boom'), '/');
  } finally {
    delete globalThis.__DEV__;
  }
  assert.equal(reports.length, 0);
});

test('on native the previous global handler still runs after the report', () => {
  const { lib: fresh, reports } = load({ os: 'ios' });
  const calls = [];
  let handler = (error, isFatal) => calls.push(['previous', error.message, isFatal]);
  let tracker = null;
  globalThis.ErrorUtils = { getGlobalHandler: () => handler, setGlobalHandler: (h) => { handler = h; } };
  globalThis.HermesInternal = { enablePromiseRejectionTracker: (options) => { tracker = options; } };
  try {
    let route = '/post/123456';
    fresh.installErrorReporting(() => route);
    fresh.installErrorReporting(() => route); // installed once: the handler is not wrapped twice
    handler(new Error('native crash'), true);
    assert.deepEqual(calls, [['previous', 'native crash', true]]);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].context.route, '/post/:id');
    assert.equal(reports[0].context.platform, 'ios');

    route = '/saved';
    assert.equal(tracker.allRejections, true);
    tracker.onUnhandled(1, new Error('unhandled rejection'));
    assert.equal(reports[1].error.message, 'unhandled rejection');
    assert.equal(reports[1].context.route, '/saved');
  } finally {
    delete globalThis.ErrorUtils;
    delete globalThis.HermesInternal;
  }
});

test('on web, uncaught errors and unhandled rejections are reported', () => {
  const { lib: fresh, reports } = load({ os: 'web' });
  const listeners = {};
  globalThis.window = { addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); } };
  try {
    fresh.installErrorReporting(() => '/explore?q=dragon');
    fresh.installErrorReporting(() => '/explore');
    assert.equal(listeners.error.length, 1);
    assert.equal(listeners.unhandledrejection.length, 1);

    listeners.error[0]({ error: new Error('render failed'), message: 'Uncaught Error: render failed' });
    listeners.error[0]({ error: null, message: 'Script error.' });
    listeners.unhandledrejection[0]({ reason: new Error('promise failed') });
    assert.deepEqual(reports.map((r) => r.error.message), ['render failed', 'promise failed']);
    assert.equal(reports[0].context.route, '/explore');
  } finally {
    delete globalThis.window;
  }
});

test('static rendering without a window installs nothing and does not throw', () => {
  const { lib: fresh } = load({ os: 'web' });
  assert.equal(typeof globalThis.window, 'undefined');
  assert.doesNotThrow(() => fresh.installErrorReporting(() => '/'));
});
