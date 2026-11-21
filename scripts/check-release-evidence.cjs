'use strict';

/**
 * INKR pre-production documentary gate.
 * Fail closed; this does NOT verify consoles, devices, RLS or backups.
 * It cannot authorize deployment or replace owner approval.
 */
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_GATES = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'];
const EXPECTED_PROJECT = 'jxmefklkixzzdceeorcg';
const RESOLUTIONS = new Set([
  'no-legacy-installations-attested',
  'legacy-compatibility-tested',
  'legacy-exclusion-tested',
]);

function assessEvidence(manifest) {
  const blockers = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ready: false, blockers: ['Manifest missing or not an object'] };
  }
  if (manifest.schema_version !== 1) blockers.push('Unsupported evidence schema');
  if (manifest.environment !== 'production' ||
      manifest.supabase_project_ref !== EXPECTED_PROJECT) {
    blockers.push('Wrong production environment or Supabase project');
  }

  const gates = manifest.gates;
  if (!gates || typeof gates !== 'object' || Array.isArray(gates)) {
    return { ready: false, blockers: [...blockers, 'G0-G5 evidence is missing'] };
  }

  for (const id of REQUIRED_GATES) {
    const gate = gates[id];
    if (!gate || gate.status !== 'GO') {
      blockers.push(id + ': HOLD or missing');
      continue;
    }
    if (!Array.isArray(gate.evidence) || !gate.evidence.length ||
        gate.evidence.some((ref) => typeof ref !== 'string' || !ref.trim())) {
      blockers.push(id + ': no specific evidence references');
    }
  }

  // The historic 1.0.0 (4) label does not identify source or installed clients.
  // Every branch of the G0 decision needs human-reviewed distribution evidence.
  const g0 = gates.G0;
  if (g0?.status === 'GO') {
    if (g0.historical_android_builds !== 10) {
      blockers.push('G0: reconcile the 10 historically recorded Android builds');
    }
    if (g0.max_historical_android_version_code !== 4) {
      blockers.push('G0: historical Android versionCode baseline is not reconciled');
    }
    if (!Number.isSafeInteger(g0.candidate_android_version_code) ||
        g0.candidate_android_version_code <= g0.max_historical_android_version_code) {
      blockers.push('G0: candidate Android versionCode must exceed every historical distributed build');
    }
    // EAS appVersionSource=remote: local app.json and a candidate claim alone
    // cannot authorize a release when the actual remote counter still lags.
    if (!Number.isSafeInteger(g0.eas_remote_android_version_code_at_audit) ||
        g0.eas_remote_android_version_code_at_audit < g0.max_historical_android_version_code) {
      blockers.push('G0: current EAS remote Android version counter has not been reconciled');
    }
    if (g0.legacy_client_resolution === 'legacy-compatibility-tested' &&
        g0.android_signing_compatibility_verified !== true) {
      blockers.push('G0: Android signing compatibility has not been demonstrated');
    }
    for (const field of [
      'eas_reviewed', 'play_console_reviewed', 'app_store_reviewed',
      'manual_apk_distribution_reviewed', 'web_release_reviewed',
    ]) {
      if (g0[field] !== true) blockers.push('G0: ' + field + ' not verified');
    }
    if (!RESOLUTIONS.has(g0.legacy_client_resolution)) {
      blockers.push('G0: legacy clients not attested, tested compatible, or safely excluded');
    }
    if (g0.legacy_client_resolution === 'legacy-exclusion-tested' &&
        g0.exclusion_tested_on_copy !== true) {
      blockers.push('G0: exclusion not demonstrated on a copy');
    }
    if (g0.legacy_client_resolution === 'legacy-compatibility-tested' &&
        g0.compatibility_tested_on_copy !== true) {
      blockers.push('G0: legacy compatibility not demonstrated on a copy');
    }
  }

  // A linked document alone cannot certify a backup, real-role QA or a
  // rollback. Keep these release gates fail-closed until the named evidence
  // has been independently inspected and attested.
  const verifiedOperations = {
    G1: ['backup_verified', 'isolated_restore_verified',
      'storage_offsite_portable_backup_verified',
      'production_schema_drift_checked', 'data_integrity_preserved'],
    G2: ['authenticated_client_artist_tested', 'outsider_rls_tested',
      'deposit_notification_flow_tested'],
    G4: ['rollback_rehearsed', 'storage_restore_verified'],
  };
  for (const [id, fields] of Object.entries(verifiedOperations)) {
    if (gates[id]?.status !== 'GO') continue;
    for (const field of fields) {
      if (gates[id][field] !== true) blockers.push(id + ': ' + field + ' not verified');
    }
  }

  const g5 = gates.G5;
  if (g5?.status === 'GO' &&
      (g5.owner_approval !== true ||
       typeof g5.approval_reference !== 'string' ||
       !g5.approval_reference.trim())) {
    blockers.push('G5: separate explicit owner approval absent');
  }
  return { ready: blockers.length === 0, blockers };
}

function main(filename = path.join(__dirname, '..', 'docs', 'RELEASE_EVIDENCE.json')) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    console.error('HOLD — unreadable release evidence:', error.message);
    return 1;
  }
  const result = assessEvidence(manifest);
  if (!result.ready) {
    console.error('HOLD — INKR V5 production readiness is not established:');
    for (const reason of result.blockers) console.error(' - ' + reason);
    return 1;
  }
  console.log('DOCUMENTARY GATES PASSED — independent checks and owner deployment approval still required.');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv[2]);
module.exports = { assessEvidence, main, REQUIRED_GATES };
