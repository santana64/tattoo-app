'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { encrypt, verify, decrypt } = require('../scripts/portable-qa-backup.cjs');
const { parseRemoteCounter, parseApkBadging, assessRemote, assessCandidate } = require('../scripts/ci/android-version-gate.cjs');
const PASS = 'only-a-fictional-test-passphrase-2026';

test('remote EAS JSON uses decimal strings and fails closed on missing counter', () => {
  assert.equal(parseRemoteCounter('{"versionCode":"100"}'), 100);
  assert.equal(parseRemoteCounter({ versionCode: 4 }), 4);
  for (const x of ['{}', '{"versionCode":"4x"}', '{"versionCode":null}', '{"versionCode":0}'])
    assert.throws(() => parseRemoteCounter(x), /versionCode/);
});
test('Android remote counter 1 is a HOLD against historical version 4', () => {
  assert.equal(assessRemote({ remoteCode: 1, historicalMax: 4, source: 'remote', autoIncrement: true }).pass, false);
  assert.equal(assessRemote({ remoteCode: 4, historicalMax: 4, source: 'remote', autoIncrement: true }).pass, true);
  assert.equal(assessRemote({ remoteCode: 5, historicalMax: 4, source: 'local', autoIncrement: true }).pass, false);
  assert.equal(assessRemote({ remoteCode: 5, historicalMax: 4, source: 'remote', autoIncrement: false }).pass, false);
});
test('only the expected Android package with versionCode above historical max passes', () => {
  assert.deepEqual(parseApkBadging("package: name='com.inkr.tattoo' versionCode='5' versionName='1.0.0'"), {
    packageName: 'com.inkr.tattoo', versionCode: 5,
  });
  for (const code of [1,4]) assert.equal(assessCandidate({ packageName: 'com.inkr.tattoo', versionCode: code, historicalMax: 4 }).pass, false);
  assert.equal(assessCandidate({ packageName: 'com.fake.inkr', versionCode: 5, historicalMax: 4 }).pass, false);
  assert.equal(assessCandidate({ packageName: 'com.inkr.tattoo', versionCode: 5, historicalMax: 4 }).pass, true);
});
async function fixture(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkr-portable-test-'));
  try {
    const source = path.join(dir, 'fictional.sql');
    const encrypted = path.join(dir, 'backup.inkrbak');
    const restored = path.join(dir, 'restored.sql');
    const body = Buffer.from('FICTIONAL TEST DATA\n' + 'something-test-only\n'.repeat(1000));
    await fs.writeFile(source, body);
    await fn({dir,source,encrypted,restored,body});
  } finally { await fs.rm(dir, { force:true, recursive:true }); }
}
test('portable backup encrypts and authenticates without exposing plaintext in archive', async () => {
  await fixture(async({source,encrypted,restored,body}) => {
    const saved = await encrypt(source, encrypted, PASS);
    assert.equal(saved.bytes, body.length);
    const archive = await fs.readFile(encrypted);
    assert.equal(archive.includes(Buffer.from('FICTIONAL TEST DATA')), false);
    await fs.unlink(source);
    assert.deepEqual(await verify(encrypted, PASS), saved);
    assert.deepEqual(await decrypt(encrypted, restored, PASS), saved);
    assert.deepEqual(await fs.readFile(restored), body);
  });
});
test('wrong passphrase and tampering reject recovery without publishing plaintext', async () => {
  await fixture(async({source,encrypted,restored}) => {
    await encrypt(source,encrypted,PASS);
    await assert.rejects(decrypt(encrypted,restored,'another-strong-fake-passphrase'), /authenticate|Unsupported state/i);
    await assert.rejects(fs.stat(restored), { code: 'ENOENT' });
    const file = await fs.readFile(encrypted);
    file[Math.floor(file.length/2)] ^= 1;
    await fs.writeFile(encrypted,file);
    await assert.rejects(verify(encrypted,PASS), /authenticate|Unsupported state/i);
    await assert.rejects(decrypt(encrypted,restored,PASS), /authenticate|Unsupported state/i);
    await assert.rejects(fs.stat(restored), { code: 'ENOENT' });
  });
});
test('backup never overwrites and refuses short passwords or empty source', async () => {
  await fixture(async({dir,source,encrypted,restored}) => {
    await assert.rejects(encrypt(source, encrypted, 'weak'), /at least 16/);
    await encrypt(source, encrypted, PASS);
    await assert.rejects(encrypt(source, encrypted, PASS), { code:'EEXIST' });
    await fs.writeFile(restored, 'existing');
    await assert.rejects(decrypt(encrypted,restored,PASS), { code:'EEXIST' });
    assert.equal(await fs.readFile(restored,'utf8'), 'existing');
    const empty = path.join(dir,'empty');
    await fs.writeFile(empty,'');
    await assert.rejects(encrypt(empty, path.join(dir,'empty.bak'), PASS), /non-empty/);
  });
});
