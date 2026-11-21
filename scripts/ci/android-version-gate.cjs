'use strict';
// Offline, read-only INKR Android distribution gate.
// EAS remote source is authoritative: app.json alone is not a release version.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const PACKAGE = 'com.inkr.tattoo';

function parseRemoteCounter(input) {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  const raw = value?.versionCode ?? value?.android?.versionCode;
  // Official EAS CLI --json emits a decimal string, e.g. "100".
  const code = typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : raw;
  if (!Number.isSafeInteger(code) || code < 1) throw Error('Invalid Android versionCode in EAS JSON');
  return code;
}
function parseApkBadging(text) {
  const line = typeof text === 'string' && text.split(/\r?\n/).find(x => x.startsWith('package: '));
  if (!line) throw Error('No Android package metadata from aapt');
  const packageName = line.match(/\bname='([^']+)'/)?.[1];
  const code = line.match(/\bversionCode='(\d+)'/)?.[1];
  const versionCode = Number(code);
  if (!packageName || !Number.isSafeInteger(versionCode) || versionCode < 1) throw Error('Invalid aapt package or versionCode');
  return { packageName, versionCode };
}
function assessRemote({ remoteCode, historicalMax, autoIncrement, source }) {
  const errors = [];
  if (source !== 'remote') errors.push('Expected EAS appVersionSource=remote');
  if (autoIncrement !== true) errors.push('Expected production autoIncrement=true');
  if (!Number.isSafeInteger(historicalMax) || historicalMax < 1) errors.push('Historical baseline invalid');
  if (!Number.isSafeInteger(remoteCode) || remoteCode < historicalMax) {
    errors.push('EAS remote counter is below historical versionCode ' + historicalMax);
  }
  return { pass: errors.length === 0, errors };
}
function assessCandidate({ packageName, versionCode, historicalMax }) {
  const errors = [];
  if (packageName !== PACKAGE) errors.push('Incorrect Android package identifier');
  if (!Number.isSafeInteger(versionCode) || versionCode <= historicalMax) {
    errors.push('Candidate versionCode must strictly exceed historical versionCode ' + historicalMax);
  }
  return { pass: errors.length === 0, errors };
}
function main(args) {
  const [mode, evidenceFile, inputFile] = args;
  if (!['remote', 'apk'].includes(mode) || !evidenceFile || !inputFile) {
    throw Error('Usage: android-version-gate.cjs remote <release-evidence.json> <eas-version-get.json> | apk <release-evidence.json> <aapt-badging.txt>');
  }
  const manifest = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  const historicalMax = manifest?.gates?.G0?.max_historical_android_version_code;
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  if (app?.expo?.android?.package !== PACKAGE) throw Error('Unexpected application package');
  const input = fs.readFileSync(inputFile, 'utf8');
  const result = mode === 'remote' ? assessRemote({
    remoteCode: parseRemoteCounter(input), historicalMax,
    autoIncrement: eas?.build?.production?.autoIncrement,
    source: eas?.cli?.appVersionSource,
  }) : assessCandidate({ ...parseApkBadging(input), historicalMax });
  if (!result.pass) {
    for (const reason of result.errors) console.error('HOLD — ' + reason);
    return 1;
  }
  console.log(mode === 'remote'
    ? 'Preflight PASS only. Actual signed Android artifact, historic signing compatibility and distribution still HOLD.'
    : 'Candidate package/version PASS only. Signing compatibility and distribution still HOLD.');
  return 0;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (err) { console.error('HOLD — ' + err.message); process.exitCode = 1; }
}
module.exports = { parseRemoteCounter, parseApkBadging, assessRemote, assessCandidate, main };
