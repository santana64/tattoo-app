const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = require('../docs/PRODUCTION_MIGRATION_LEDGER_SNAPSHOT_20261117.json');
const migrations = path.join(root, 'supabase', 'migrations');

test('stage migration ledger maps one-to-one to audited local files', () => {
  assert.equal(manifest.production_project_ref, 'jxmefklkixzzdceeorcg');
  assert.equal(manifest.staging_project_ref, 'lsewxsdulunuuzmszegm');
  assert.equal(manifest.production_existing_migrations.length, 9);
  assert.equal(manifest.staging_existing_migrations_count, 23);
  assert.equal(manifest.local_migration_files_count, 23);
  assert.equal(manifest.production_clone_replayed_files, 22);
  assert.equal(manifest.source_to_staging_map.length, 23);
  const actualFiles = fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort();
  const mappedFiles = manifest.source_to_staging_map.map((entry) => entry.source_file).sort();
  assert.deepEqual(mappedFiles, actualFiles, 'every local migration must be mapped once');
  const seen = new Set();
  for (const entry of manifest.source_to_staging_map) {
    assert.match(entry.stage_version, /^\d{14}$/);
    assert.ok(!seen.has(entry.stage_version), 'duplicate staging migration version');
    seen.add(entry.stage_version);
    assert.match(entry.source_sha256, /^[a-f0-9]{64}$/);
    // Compare canonical LF bytes: Git checkouts can be CRLF on Windows but
    // are LF on GitHub Actions Linux. This audit fingerprints SQL semantics,
    // not the platform-dependent checkout representation.
    const canonical = Buffer.from(
      fs.readFileSync(path.join(migrations, entry.source_file), 'utf8').replace(/\r\n/g, '\n'),
      'utf8',
    );
    assert.equal(crypto.createHash('sha256').update(canonical).digest('hex'), entry.source_sha256,
      'SQL content changed since staging/source audit: ' + entry.source_file);
    assert.equal(canonical.length, entry.bytes);
  }
  assert.equal(manifest.source_to_staging_map[0].source_file, '001_initial.sql');
});

test('production historical ledger is incompatible with blind db push', () => {
  const prodVersions = manifest.production_existing_migrations.map((entry) => entry.version);
  assert.deepEqual(prodVersions, ['001','002','003','004','005','006','007','008','009']);
  assert.equal(manifest.production_deployment_authorized, false);
  assert.equal(manifest.production_history_repaired, false);
});
