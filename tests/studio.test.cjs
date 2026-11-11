// Pure logic of lib/studio.ts: opening-hours validation, slot grouping,
// preferred slots, public numbers and the artwork label. Database rules are
// covered by tests/rls-security.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'studio.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
const stubRequire = (name) => (name === './supabase' ? { supabase: {} } : require(name));
new Function('require', 'module', 'exports', compiled)(stubRequire, mod, mod.exports);
const studio = mod.exports;

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

test('opening hours need a valid day and at least one hour, like the database', () => {
  assert.equal(studio.scheduleError([{ day: 1, opens: '10:00', closes: '19:00' }, { day: 0, opens: '09:00', closes: '10:00' }]), null);
  assert.equal(studio.scheduleError([]), null, 'an entirely closed week is allowed');
  assert.match(studio.scheduleError([{ day: 2, opens: '10:00', closes: '10:30' }]), /Mardi/);
  assert.match(studio.scheduleError([{ day: 2, opens: '19:00', closes: '10:00' }]), /Mardi/);
  assert.ok(studio.scheduleError([{ day: 7, opens: '10:00', closes: '19:00' }]));
  assert.ok(studio.scheduleError([{ day: 1.5, opens: '10:00', closes: '19:00' }]));
  assert.ok(studio.scheduleError([{ day: 1, opens: '10h', closes: '19:00' }]));
  assert.ok(studio.scheduleError([{ day: 3, opens: '10:00', closes: '19:00' }, { day: 3, opens: '11:00', closes: '18:00' }]), 'no duplicate day');
});

test('the week is listed Monday first and covers every day once', () => {
  assert.deepEqual([...studio.WEEK_ORDER], [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(new Set(studio.WEEK_ORDER).size, 7);
  assert.equal(studio.DAY_NAMES[0], 'Dimanche');
  assert.equal(studio.DAY_NAMES[new Date(2026, 10, 11).getDay()], 'Mercredi');
});

test('slots are grouped by local day in chronological order', () => {
  const slot = (d, h) => ({ start: at(2026, 11, d, h), end: at(2026, 11, d, h + 2) });
  const days = studio.groupSlotsByDay([slot(14, 15), slot(13, 9), slot(14, 9), slot(13, 23)]);
  assert.deepEqual(days.map((d) => d.key), ['2026-11-13', '2026-11-14']);
  assert.deepEqual(days[0].slots.map((s) => s.start.getHours()), [9, 23]);
  assert.deepEqual(days[1].slots.map((s) => s.start.getHours()), [9, 15]);
  assert.equal(days[0].date.getHours(), 0);
  assert.deepEqual(studio.groupSlotsByDay([]), []);
});

test('a request keeps at most three future, distinct slots, soonest first', () => {
  const now = at(2026, 11, 11, 12);
  const a = at(2026, 11, 20, 10);
  const b = at(2026, 11, 15, 14);
  const c = at(2026, 11, 18, 9);
  const d = at(2026, 11, 25, 9);
  const out = studio.normalizePreferredSlots([a, b.toISOString(), c, d, a, at(2026, 11, 10, 9), 'not a date'], now);
  assert.deepEqual(out, [b, c, a].map((x) => x.toISOString()));
  assert.deepEqual(studio.normalizePreferredSlots([], now), []);
  assert.deepEqual(studio.normalizePreferredSlots([now], now), [], 'now itself is not in the future');
});

test('the next free slot reads naturally', () => {
  const now = at(2026, 11, 11, 22);
  assert.equal(studio.formatNextSlot(null, now), null);
  assert.equal(studio.formatNextSlot('nope', now), null);
  assert.equal(studio.formatNextSlot(at(2026, 11, 11, 23), now), 'aujourd’hui');
  assert.equal(studio.formatNextSlot(at(2026, 11, 12, 9), now), 'demain', 'tomorrow by calendar day, not by 24 hours');
  assert.match(studio.formatNextSlot(at(2026, 11, 19, 9), now), /19/);
});

test('ratings and counts use French formatting', () => {
  assert.equal(studio.formatRating(4.8), '4,8');
  assert.equal(studio.formatRating(5), '5,0');
  assert.equal(studio.formatCount(0), '0');
  assert.equal(studio.formatCount(999), '999');
  assert.equal(studio.formatCount(1000), '1 k');
  assert.equal(studio.formatCount(1250), '1,3 k');
  assert.equal(studio.formatCount(12400), '12 k');
});

test('public reviews never show a full name', () => {
  assert.equal(studio.firstNameOnly('Camille Durand'), 'Camille D.');
  assert.equal(studio.firstNameOnly('  Camille   de la Tour '), 'Camille T.');
  assert.equal(studio.firstNameOnly('Camille'), 'Camille');
  assert.equal(studio.firstNameOnly(''), 'Client');
  assert.equal(studio.firstNameOnly(null), 'Client');
});

test('a flash needs an image, a title, a style, a price and 1 to 50 copies', () => {
  const ok = { imageUrl: 'https://x/y.jpg', title: 'Rose', style: 'traditionnel', price: 180, totalCopies: 1, isColor: false };
  assert.equal(studio.flashInputError(ok), null);
  assert.ok(studio.flashInputError({ ...ok, imageUrl: '' }));
  assert.ok(studio.flashInputError({ ...ok, title: '   ' }));
  assert.ok(studio.flashInputError({ ...ok, style: '' }));
  assert.ok(studio.flashInputError({ ...ok, price: 0 }));
  assert.ok(studio.flashInputError({ ...ok, price: 99.5 }));
  assert.ok(studio.flashInputError({ ...ok, totalCopies: 0 }));
  assert.ok(studio.flashInputError({ ...ok, totalCopies: 51 }));
  assert.equal(studio.flashCopiesLeft({ total_copies: 3, sold_copies: 1 }), 2);
  assert.equal(studio.flashCopiesLeft({ total_copies: 1, sold_copies: 4 }), 0);
});

test('a guest spot needs a place, coherent future dates, a price and an image', () => {
  const now = at(2026, 11, 11, 12);
  const ok = {
    hostCity: 'Lyon', hostStudio: 'Atelier Noir', dateFrom: at(2026, 12, 1), dateTo: at(2026, 12, 4),
    priceFrom: 150, description: 'Flashs et petits projets.', coverImageUrl: 'https://x/y.jpg', slotsTotal: 4,
  };
  assert.equal(studio.guestSpotInputError(ok, now), null);
  assert.equal(studio.guestSpotInputError({ ...ok, dateFrom: at(2026, 11, 11), dateTo: at(2026, 11, 11) }, now), null, 'today still counts');
  assert.ok(studio.guestSpotInputError({ ...ok, hostCity: ' ' }, now));
  assert.ok(studio.guestSpotInputError({ ...ok, dateTo: at(2026, 11, 30) }, now));
  assert.ok(studio.guestSpotInputError({ ...ok, dateFrom: at(2026, 11, 1), dateTo: at(2026, 11, 3) }, now));
  assert.ok(studio.guestSpotInputError({ ...ok, priceFrom: 0 }, now));
  assert.ok(studio.guestSpotInputError({ ...ok, coverImageUrl: '' }, now));
  assert.ok(studio.guestSpotInputError({ ...ok, slotsTotal: 0 }, now));
});

test('guest dates collapse the month when both ends share it', () => {
  assert.match(studio.formatGuestDates('2026-03-12', '2026-03-16'), /^12 – 16 mars$/);
  assert.match(studio.formatGuestDates('2026-02-28', '2026-03-03'), /^28 févr\. – 3 mars$/);
  assert.match(studio.formatGuestDates('2026-03-12', '2026-03-12'), /^12 mars$/);
});

test('the artwork label lists what is known and nothing else', () => {
  const styleLabel = (id) => ({ japonais: 'Japonais', realisme: 'Réalisme' }[id] ?? id);
  const full = studio.artworkLabel({
    title: ' Dragon d’eau ', caption: 'x', styles: ['japonais', 'realisme', 'autre'], body_zone: 'Avant-bras',
    session_hours: 4.5, is_healed: true, published_at: '2026-06-02T10:00:00Z',
  }, styleLabel);
  assert.equal(full.title, 'Dragon d’eau');
  assert.deepEqual(full.lines, ['Japonais, Réalisme', 'Avant-bras', '4,5 h de séance', 'Photographié cicatrisé', '2026']);

  const bare = studio.artworkLabel({ title: null, caption: null, styles: null, body_zone: null, session_hours: null, is_healed: false, published_at: null });
  assert.equal(bare.title, 'Sans titre');
  assert.deepEqual(bare.lines, []);
});
