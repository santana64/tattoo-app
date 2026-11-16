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

test('owner approval cannot be inferred from CI, evidence, or Stripe tests', () => {
  const value = allGo();
  value.gates.G5.owner_approval = false;
  assert.ok(assessEvidence(value).blockers.some((line) => line.includes('owner approval absent')));
});

test('syntactically complete evidence can pass documentary validation only', () => {
  // This validates the parser, not the truth of any evidence or deployment safety.
  const value = allGo();
  assert.deepEqual(assessEvidence(value), { ready: true, blockers: [] });
});
