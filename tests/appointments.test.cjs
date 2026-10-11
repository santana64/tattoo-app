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
