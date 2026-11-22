const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('live staging auth audit fails closed without authorized credentials', () => {
  const script = path.join(__dirname, '..', 'scripts', 'staging-auth-readonly-audit.cjs');
  const env = { ...process.env };
  for (const name of [
    'INKR_QA_CLIENT_EMAIL','INKR_QA_CLIENT_PASSWORD',
    'INKR_QA_ARTIST_EMAIL','INKR_QA_ARTIST_PASSWORD',
  ]) delete env[name];
  const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /HOLD: missing locally authorized test-account credentials/);
  assert.doesNotMatch(result.stdout, /PASS_AUTHENTICATED_READONLY/);
});
