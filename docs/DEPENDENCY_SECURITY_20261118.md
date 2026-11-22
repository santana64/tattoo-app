# INKR V5.1 — Dependency security review (2026-11-18)

## Scope

- Source: PR #3 branch `codex/inkr-v5-1-optional-deposits`, starting at `7ea419d`.
- Environment: staging only. Production is on **HOLD**.
- Command: `npm audit --json`, plus `npm audit --omit=dev --json`.
- Lockfile changes are deliberately limited to security overrides of two indirect dependencies. No Expo SDK / React Native major upgrade.

## Results

| Npm advisory severity | All dependencies (before → after) | `--omit=dev` (before → after) |
| --- | ---: | ---: |
| Critical | 2 → 0 | 2 → 0 |
| High | 46 → 46 | 44 → 44 |
| Moderate | 19 → 19 | 14 → 14 |
| Low | 1 → 1 | 1 → 1 |
| Total | 68 → 66 | 61 → 59 |

Fixed in the lockfile via root `overrides`:
- `shell-quote`: `1.8.3` → `1.12.0`
- `tar`: `7.5.13` → `7.5.23`

The audit count is a count of reported vulnerable dependency entries, **not** of proven remotely exploitable defects. `--omit=dev` is an npm install/audit scope, not a precise inventory of code shipped in the browser or an exploitability proof.

## Compatibility and release policy

An unscoped `npm audit fix` was evaluated on an isolated working tree but discarded. It attempted to add transitive `expo-router@58.0.32` and `react-native@0.88.1` in the Expo 54 / React Native 0.81 dependency tree. Those incompatible peer dependencies are not part of this change.

GitHub CI now runs `npm audit --omit=dev --audit-level=critical` after `npm ci`, so a newly introduced critical advisory fails the check. The remaining high/moderate findings are **not waived or resolved** by this gate; they require risk triage, remediation planning, and a separately tested SDK upgrade.

## Verification

- `npm ci`: passed on Windows / Node 22
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm test`: 234/234 passed
- Web export: run with CI's non-routable placeholder Supabase URL/key; do not use production credentials
- Before production: GitHub Actions pipeline, preview bundle isolation, review of high-severity dependencies, and the independent G0–G5 release gates must all be evaluated.

Never run `npm audit fix --force` in the production release branch without a separately reviewed Expo/RN upgrade and native regression suite.
