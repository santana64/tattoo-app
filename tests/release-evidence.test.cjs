'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const base = require('../docs/RELEASE_EVIDENCE.json');
const { assessEvidence, REQUIRED_GATES } = require('../scripts/check-release-evidence.cjs');

const clone = () => JSON.parse(JSON.stringify(base));
const allGo = () => {
  const value = clone();
  for (const id of REQUIRED_GATES) {
    value.gates[id].status = 'GO';
    value.gates[id].evidence = ['docs/' + id + '_INDEPENDENT_EVIDENCE.md'];
  }
  const g0 = value.gates.G0;
  g0.play_console_reviewed = true;
  g0.app_store_reviewed = true;
  g0.manual_apk_distribution_reviewed = true;
  g0.web_release_reviewed = true;
  g0.legacy_client_resolution = 'legacy-exclusion-tested';
  g0.exclusion_tested_on_copy = true;
  g0.legacy_v4_ota_disabled_verified = true;
  g0.legacy_v4_signed_binary_delivery_verified = true;
  g0.legacy_v4_all_recipients_upgraded_verified = true;
  g0.legacy_v4_release_order_before_restrictive_migrations_verified = true;
  g0.legacy_v4_no_insecure_permission_fallback_verified = true;
  g0.candidate_android_version_code = 5;
  g0.eas_remote_android_version_code_at_audit = 4;
  g0.android_signing_compatibility_verified = true;
  Object.assign(value.gates.G1, {
    backup_verified: true,
    isolated_restore_verified: true,
    storage_offsite_portable_backup_verified: true,
    production_schema_drift_checked: true,
    data_integrity_preserved: true,
  });
  Object.assign(value.gates.G2, {
    authenticated_client_artist_tested: true,
    outsider_rls_tested: true,
    deposit_notification_flow_tested: true,
  });
  Object.assign(value.gates.G4, {
    rollback_rehearsed: true,
    storage_restore_verified: true,
  });
  value.gates.G5.owner_approval = true;
  value.gates.G5.approval_reference = 'Owner approval after review of G0-G4';
  return value;
};

test('release evidence is HOLD by default, including the 10 historical Android builds', () => {
  const result = assessEvidence(base);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((line) => line.startsWith('G0:')));
  assert.ok(result.blockers.some((line) => line.startsWith('G5:')));
  assert.equal(base.gates.G0.historical_android_builds, 10);
});

test('missing or unrelated production project fails closed', () => {
  assert.equal(assessEvidence(null).ready, false);
  const value = allGo();
  value.supabase_project_ref = 'lsewxsdulunuuzmszegm';
  assert.equal(assessEvidence(value).ready, false);
});

test('checkbox GO without evidence references is insufficient', () => {
  const value = allGo();
  value.gates.G2.evidence = [];
  assert.ok(assessEvidence(value).blockers.some((line) => line.includes('G2: no specific')));
});

test('historic shared 1.0.0 (4) cannot substitute for audited distribution', () => {
  const value = allGo();
  value.gates.G0.play_console_reviewed = false;
  value.gates.G0.legacy_client_resolution = 'unknown';
  const result = assessEvidence(value);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((line) => line.includes('play_console_reviewed')));
  assert.ok(result.blockers.some((line) => line.includes('legacy clients not')));
});

test('legacy exclusion must have been exercised on a copy', () => {
  const value = allGo();
  value.gates.G0.exclusion_tested_on_copy = false;
  assert.ok(assessEvidence(value).blockers.some((line) => line.includes('exclusion not demonstrated')));
});

test('G0 rejects a forced-update claim unless signed v5 delivery and v4 adoption are proven', () => {
  for (const field of [
    'legacy_v4_ota_disabled_verified',
    'legacy_v4_signed_binary_delivery_verified',
    'legacy_v4_all_recipients_upgraded_verified',
    'legacy_v4_release_order_before_restrictive_migrations_verified',
    'legacy_v4_no_insecure_permission_fallback_verified',
  ]) {
    const value = allGo();
    value.gates.G0[field] = false;
    assert.ok(assessEvidence(value).blockers.some((line) => line.includes(field)), field);
  }
});

test('G0 rejects no-legacy-installations claim without a distribution attestation', () => {
  const value = allGo();
  value.gates.G0.legacy_client_resolution = 'no-legacy-installations-attested';
  value.gates.G0.legacy_zero_installed_clients_attested = false;
  assert.ok(assessEvidence(value).blockers.some((line) => line.includes('absence of installed legacy clients')));
  value.gates.G0.legacy_zero_installed_clients_attested = true;
  assert.equal(assessEvidence(value).ready, true);
});

test('G0 cannot pass with an Android build number below the historical v4 baseline', () => {
  const value = allGo();
  value.gates.G0.candidate_android_version_code = 1;
  const result = assessEvidence(value);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((line) => line.includes('versionCode must exceed')));
  value.gates.G0.candidate_android_version_code = 4;
  assert.ok(assessEvidence(value).blockers.some((line) => line.includes('versionCode must exceed')));
});

test('G0 compatible-upgrade path requires an evidenced signing certificate match', () => {
  const value = allGo();
  value.gates.G0.legacy_client_resolution = 'legacy-compatibility-tested';
  value.gates.G0.compatibility_tested_on_copy = true;
  value.gates.G0.android_signing_compatibility_verified = false;
  assert.ok(assessEvidence(value).blockers.some((line) => line.includes('signing compatibility')));
  value.gates.G0.android_signing_compatibility_verified = true;
  assert.equal(assessEvidence(value).ready, true);
});

test('G1 requires a verified backup, isolated restore, drift review and data preservation', () => {
  for (const field of [
    'backup_verified', 'isolated_restore_verified',
    'storage_offsite_portable_backup_verified',
    'production_schema_drift_checked', 'data_integrity_preserved',
  ]) {
    const value = allGo();
    value.gates.G1[field] = false;
    assert.ok(assessEvidence(value).blockers.some((line) => line.includes('G1: ' + field)));
  }
});

test('G2 cannot pass on PGlite-only tests without authenticated multi-role evidence', () => {
  for (const field of [
    'authenticated_client_artist_tested', 'outsider_rls_tested',
    'deposit_notification_flow_tested',
  ]) {
    const value = allGo();
    value.gates.G2[field] = false;
    assert.ok(assessEvidence(value).blockers.some((line) => line.includes('G2: ' + field)));
  }
});

test('G4 requires rollback and Storage recovery exercises', () => {
  for (const field of ['rollback_rehearsed', 'storage_restore_verified']) {
    const value = allGo();
    value.gates.G4[field] = false;
    assert.ok(assessEvidence(value).blockers.some((line) => line.includes('G4: ' + field)));
  }
});

test('owner approval cannot be inferred from CI, evidence, or Stripe tests', () => {
  const value = allGo();
  value.gates.G5.owner_approval = false;
  assert.ok(assessEvidence(value).blockers.some((line) => line.includes('owner approval absent')));
});


test('G0 GO must reject stale remote EAS version even if candidate is claimed as 5', () => {
  const value = allGo();
  value.gates.G0.eas_remote_android_version_code_at_audit = 1;
  const result = assessEvidence(value);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((line) => line.includes('EAS remote Android version counter')));
});

test('G1 GO must reject machine-bound-only DPAPI backup without portable offsite proof', () => {
  const value = allGo();
  value.gates.G1.storage_offsite_portable_backup_verified = false;
  const result = assessEvidence(value);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((line) => line.includes('storage_offsite_portable_backup_verified')));
});

test('syntactically complete evidence can pass documentary validation only', () => {
  // This validates the parser, not the truth of any evidence or deployment safety.
  const value = allGo();
  assert.deepEqual(assessEvidence(value), { ready: true, blockers: [] });
});
