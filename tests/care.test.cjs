// Pure logic of lib/care.ts and lib/ics.ts. Database rules are covered by
// tests/rls-security.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, supabase = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  const mod = { exports: {} };
  const stubRequire = (name) => (name === './supabase' ? { supabase } : require(name));
  new Function('require', 'module', 'exports', compiled)(stubRequire, mod, mod.exports);
  return mod.exports;
}
const care = load('care.ts');
const ics = load('ics.ts');

test('healed photo visibility requires a confirmed changed row', async () => {
  const withResponse = (response) => load('care.ts', {
    from(table) {
      assert.equal(table, 'healed_photos');
      return { update(values) {
        assert.deepEqual(values, { is_public: true });
        return { eq(column, id) {
          assert.equal(column, 'id');
          assert.equal(id, 'photo-1');
          return { select: () => ({ maybeSingle: async () => response }) };
        } };
      } };
    },
  });
  assert.equal(await withResponse({ data: null, error: null }).setHealedPhotoPublic('photo-1', true), false);
  assert.equal(await withResponse({ data: { id: 'photo-1' }, error: null }).setHealedPhotoPublic('photo-1', true), true);
});

test('booking settings mirror the database limits', () => {
  const ok = { sessionDurations: [120, 240], cancelNoticeHours: 48 };
  assert.equal(care.bookingSettingsError(ok), null);
  assert.ok(care.bookingSettingsError({ ...ok, sessionDurations: [] }));
  assert.ok(care.bookingSettingsError({ ...ok, sessionDurations: [45] }));
  assert.ok(care.bookingSettingsError({ ...ok, sessionDurations: [660] }));
  assert.ok(care.bookingSettingsError({ ...ok, cancelNoticeHours: 337 }));
  assert.ok(care.bookingSettingsError({ ...ok, cancelNoticeHours: -1 }));
  for (const d of care.DURATION_CHOICES) assert.equal(care.bookingSettingsError({ ...ok, sessionDurations: [d] }), null, String(d));
  for (const n of care.NOTICE_CHOICES) assert.equal(care.bookingSettingsError({ ...ok, cancelNoticeHours: n }), null, String(n));
});

test('durations and notices read naturally in French', () => {
  assert.equal(care.durationLabel(60), '1 h');
  assert.equal(care.durationLabel(90), '1 h 30');
  assert.equal(care.durationLabel(480), 'Journée (8 h)');
  assert.equal(care.noticeLabel(0), 'Sans délai');
  assert.equal(care.noticeLabel(24), '24 h');
  assert.equal(care.noticeLabel(72), '3 jours');
  assert.equal(care.noticeLabel(168), '1 semaine');
  assert.equal(care.noticeLabel(36), '36 h');
});

test('a geocoder answer is accepted only when it carries real coordinates', () => {
  const answer = { features: [{ geometry: { coordinates: [-73.5674, 45.5019] }, properties: { name: 'Montréal', country: 'Canada' } }] };
  assert.deepEqual(care.parseGeocodeResult(answer), { latitude: 45.5019, longitude: -73.5674, label: 'Montréal, Canada' });
  for (const bad of [null, {}, { features: [] }, { features: [{}] }, { features: [{ geometry: { coordinates: ['a', 'b'] } }] },
    { features: [{ geometry: { coordinates: [2.35] } }] }, { features: [{ geometry: { coordinates: [200, 95] } }] },
    { features: [{ geometry: { coordinates: [NaN, 45] } }] }]) {
    assert.equal(care.parseGeocodeResult(bad), null, JSON.stringify(bad));
  }
  assert.equal(care.formatDistance(0.04), 'à 100 m');
  assert.equal(care.formatDistance(0.84), 'à 800 m');
  assert.equal(care.formatDistance(12.4), 'à 12 km');
});

test('a client may cancel only before the notice period starts', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  assert.equal(care.canClientCancel('2026-11-14T10:00:00Z', 72, now), true, 'exactly at the limit');
  assert.equal(care.canClientCancel('2026-11-14T09:59:00Z', 72, now), false);
  assert.equal(care.canClientCancel('2026-11-11T11:00:00Z', 0, now), true);
  assert.equal(care.canClientCancel('2026-11-11T09:00:00Z', 0, now), false, 'a session already started');
});

test('stories are grouped per artist, oldest first inside, freshest artist first', () => {
  const story = (id, artist, created) => ({ id, artist_id: artist, created_at: created, artist: { id: artist, blaze: artist.toUpperCase(), avatar_url: null } });
  const groups = care.groupStories([
    story('a2', 'ana', '2026-11-11T09:00:00Z'), story('b1', 'bob', '2026-11-11T08:00:00Z'),
    story('a1', 'ana', '2026-11-11T07:00:00Z'), story('c1', 'cy', '2026-11-11T09:30:00Z'),
  ]);
  assert.deepEqual(groups.map((g) => g.artistId), ['cy', 'ana', 'bob']);
  assert.deepEqual(groups[1].stories.map((s) => s.id), ['a1', 'a2']);
  assert.equal(groups[1].blaze, 'ANA');
  assert.deepEqual(care.groupStories([]), []);
  const now = new Date('2026-11-11T10:00:00Z');
  assert.equal(care.storyAge('2026-11-11T09:59:40Z', now), 'à l’instant');
  assert.equal(care.storyAge('2026-11-11T09:48:00Z', now), 'il y a 12 min');
  assert.equal(care.storyAge('2026-11-11T07:00:00Z', now), 'il y a 3 h');
});

test('reaction counts follow the caller without waiting for the server', () => {
  const start = { fire: 2, clap: 1 };
  assert.deepEqual(care.applyReaction(start, null, 'fire'), { fire: 3, clap: 1 });
  assert.deepEqual(care.applyReaction(start, 'clap', 'fire'), { fire: 3 }, 'an emptied emoji disappears');
  assert.deepEqual(care.applyReaction(start, 'fire', null), { fire: 1, clap: 1 });
  assert.deepEqual(care.applyReaction(start, 'fire', 'fire'), start);
  assert.deepEqual(care.applyReaction({}, null, 'black_heart'), { black_heart: 1 });
  assert.deepEqual(start, { fire: 2, clap: 1 }, 'the input is not mutated');
  assert.equal(care.totalReactions(start), 3);
  assert.equal(care.totalReactions(undefined), 0);
  assert.equal(new Set(care.REACTIONS.map((r) => r.key)).size, 5);
});

test('calendar export follows RFC 5545: UTC dates, escaping, folding, CRLF', () => {
  assert.equal(ics.icsDate('2026-11-14T13:05:09Z'), '20261114T130509Z');
  assert.equal(ics.icsText('Dos; complet, suite\nligne \\ fin'), 'Dos\\; complet\\, suite\\nligne \\\\ fin');

  const long = 'DESCRIPTION:' + 'é'.repeat(100);
  const folded = ics.foldLine(long).split('\r\n');
  assert.ok(folded.length > 1);
  for (const [i, line] of folded.entries()) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line ${i} is ${Buffer.byteLength(line, 'utf8')} octets`);
    if (i > 0) assert.equal(line[0], ' ');
  }
  assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), long, 'unfolding gives the original back');
  assert.equal(ics.foldLine('SUMMARY:court'), 'SUMMARY:court');

  const calendar = ics.buildCalendar([
    { id: 'a1', start: '2026-11-14T13:00:00Z', end: '2026-11-14T16:00:00Z', title: 'Séance — Camille', description: 'Avant-bras', location: 'Paris' },
    { id: 'a2', start: '2026-11-15T09:00:00Z', end: '2026-11-15T11:00:00Z', title: 'À confirmer', tentative: true },
    { id: 'bad', start: '2026-11-15T11:00:00Z', end: '2026-11-15T09:00:00Z', title: 'Inversé' },
    { id: 'nan', start: 'nope', end: '2026-11-15T09:00:00Z', title: 'Invalide' },
  ], new Date('2026-11-11T10:00:00Z'));
  assert.ok(calendar.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(calendar), 'every line ends with CRLF');
  assert.equal(calendar.match(/BEGIN:VEVENT/g).length, 2, 'invalid events are left out');
  assert.ok(calendar.includes('UID:a1@inkr\r\nDTSTAMP:20261111T100000Z\r\nDTSTART:20261114T130000Z\r\nDTEND:20261114T160000Z'));
  assert.ok(calendar.includes('SUMMARY:Séance — Camille'));
  assert.ok(calendar.includes('STATUS:TENTATIVE'));
  assert.ok(calendar.includes('STATUS:CONFIRMED'));

  const url = new URL(ics.googleCalendarUrl({ id: 'a1', start: '2026-11-14T13:00:00Z', end: '2026-11-14T16:00:00Z', title: 'Séance & retouche', location: 'Paris' }));
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(url.searchParams.get('dates'), '20261114T130000Z/20261114T160000Z');
  assert.equal(url.searchParams.get('text'), 'Séance & retouche');
});
