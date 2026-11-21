const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync(require.resolve('../lib/appointments.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => (name === './supabase' ? { supabase: {} } : require(name)), mod, mod.exports,
  );
  return mod.exports;
}
const lib = load();

test('upcoming days start today at local midnight and are consecutive', () => {
  const days = lib.upcomingDays(3, new Date(2026, 9, 31, 22, 15));
  assert.deepEqual(days.map((d) => [d.getMonth(), d.getDate(), d.getHours()]), [[9, 31, 0], [10, 1, 0], [10, 2, 0]]);
});

test('day times cover the working range in steps', () => {
  const times = lib.dayTimes(9, 10, 30);
  assert.deepEqual(times, ['09:00', '09:30', '10:00']);
});

test('a slot combines day, time and duration', () => {
  const now = new Date(2026, 9, 11, 12, 0);
  const slot = lib.buildSlot(new Date(2026, 9, 18), '14:30', 180, now);
  assert.equal(slot.start.getHours(), 14);
  assert.equal(slot.start.getMinutes(), 30);
  assert.equal(slot.end.getTime() - slot.start.getTime(), 180 * 60_000);
});

test('slots in the past or without duration are rejected', () => {
  const now = new Date(2026, 9, 11, 12, 0);
  assert.equal(lib.buildSlot(new Date(2026, 9, 11), '11:30', 60, now), null);
  assert.equal(lib.buildSlot(new Date(2026, 9, 12), '11:30', 0, now), null);
});

test('durations read naturally', () => {
  assert.equal(lib.formatDuration(120), '2 h');
  assert.equal(lib.formatDuration(90), '1 h 30');
});

test('server errors map to French messages, overlap included', () => {
  assert.match(lib.appointmentErrorMessage({ message: 'slot_taken' }), /chevauche/);
  assert.match(lib.appointmentErrorMessage({ code: '23P01', message: 'conflicting key value violates exclusion constraint "appointments_no_overlap"' }), /chevauche/);
  assert.match(lib.appointmentErrorMessage({ code: 'PGRST202', message: 'Could not find the function' }), /pas encore activée/);
  assert.equal(lib.appointmentErrorMessage(null), null);
  assert.doesNotMatch(lib.appointmentErrorMessage({ message: 'internal boom' }), /boom/);
});

test('malformed slot strings cannot roll into a different day or hour', () => {
  const day = new Date(2027, 3, 12);
  const now = new Date(2027, 3, 11);
  for (const time of ['24:00', '25:61', '10:60', '09:99', '9:30', '09:3', '-1:30', '', '12:30:00', '12\n30', ' 12:30 ', 'NaN:00']) {
    assert.equal(lib.buildSlot(day, time, 120, now), null, JSON.stringify(time));
  }
  for (const duration of [0, -1, 1.5, Number.NaN, Infinity, -Infinity, 601, Number.MAX_SAFE_INTEGER]) {
    assert.equal(lib.buildSlot(day, '13:30', duration, now), null, String(duration));
  }
  assert.equal(lib.buildSlot(new Date(NaN), '12:00', 120, now), null);
  assert.equal(lib.buildSlot(day, '12:00', 120, new Date(NaN)), null);
});

test('day generation rejects invalid counts and steps without hanging', () => {
  for (const bad of [0, -1, Infinity, -Infinity, NaN, 1.5, 1441]) {
    assert.deepEqual(lib.dayTimes(9, 20, bad), [], String(bad));
  }
  for (const inputs of [[-1, 20, 30], [9, 24, 30], [21, 20, 30], [9.5, 20, 30], [0, Infinity, 30]]) {
    assert.deepEqual(lib.dayTimes(...inputs), [], JSON.stringify(inputs));
  }
  for (const count of [-1, 1.5, Infinity, NaN, 367]) {
    assert.deepEqual(lib.upcomingDays(count), [], String(count));
  }
  assert.equal(lib.upcomingDays(366, new Date(2027, 0, 1)).length, 366);
});

test('valid slots always have finite bounded start/end timestamps', () => {
  const day = new Date(2027, 3, 12);
  const now = new Date(2027, 3, 11);
  for (const time of lib.dayTimes(0, 23, 15)) {
    for (const duration of [1, 15, 30, 60, 90, 120, 180, 240, 480, 600]) {
      const slot = lib.buildSlot(day, time, duration, now);
      assert.ok(slot, time + '/' + duration);
      assert.equal(slot.end.getTime() - slot.start.getTime(), duration * 60_000);
      assert.equal(slot.start.getHours(), Number(time.slice(0, 2)));
      assert.equal(slot.start.getMinutes(), Number(time.slice(3, 5)));
    }
  }
});

test('the nonexistent spring-forward hour is not silently moved', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Paris';
    const day = new Date(2026, 2, 29);
    assert.equal(new Date(2026, 2, 29, 2, 30).getHours(), 3, 'DST precondition');
    assert.equal(lib.buildSlot(day, '02:30', 60, new Date(2026, 2, 28)), null);
    assert.ok(lib.buildSlot(day, '03:30', 60, new Date(2026, 2, 28)));
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
