# INKR V5.1 — External verification follow-up, 17 November 2026

**Outcome:** the SQL and Storage backups can be restored locally; all 22 V5/V5.1 migrations replay cleanly on a faithful SQL clone and the same sequence can be rolled back within a transaction. **Production is still HOLD.**

## A. Supabase Storage physical-byte backup — PASS (isolated, same computer)

The live Storage metadata has **8 buckets**, of which **3 public buckets** currently hold the 3 physical objects: `avatars` (129,536 B), `covers` (46,198 B), and `posts-media` (224,033 B). All private buckets contain zero objects at the audited snapshot. The total is **399,767 bytes**.

The public files were downloaded using the official GET-only Storage object endpoint, validated against metadata length and JPEG signatures, and packaged with a manifest containing individual SHA-256 checksums. The ZIP was encrypted with Windows DPAPI CurrentUser to `%LOCALAPPDATA%\INKR-QA\backups\inkr-storage-20261117-152643.zip.dpapi` (380,774 encrypted bytes). The archive was decrypted, all three files reconstructed into a private local recovery directory, and **all three hashes and sizes matched**. The report remains private at `%LOCALAPPDATA%\INKR-QA\clone\storage-restore-result.json`; no personal assets are included in GitHub.

**Limitations:** This verifies the isolated disk restore, not a Supabase Storage API restore to a separate remote project. DPAPI ties the archive to the current Windows user/machine, so failure of this PC/account could make the backup inaccessible. An independent, portable, encrypted offsite copy is still required for full disaster-recovery certification. Storage files were not modified on the original project.

## B. SQL migration history reconciliation — source mapping PASS, production repair NOT EXECUTED

The **production** project `jxmefklkixzzdceeorcg` has **9 older entries** in its `supabase_migrations` ledger (versions `001`–`009`, historical schema names). The **staging** project `lsewxsdulunuuzmszegm` has **23 entries** with different timestamp-based versions. They map **1-to-1 to all 23 current SQL files** in `supabase/migrations`, including `001_initial.sql`. This mapping, file byte counts and SHA-256 checksums are recorded in `docs/PRODUCTION_MIGRATION_LEDGER_SNAPSHOT_20261117.json`; `tests/migration-ledger-snapshot.test.cjs` fails if a source file changes without a renewed audit.

On a copy restored from production, **all 22 SQL files after `001_initial.sql` ran successfully inside one transaction**; the initial schema was intentionally not reapplied. The existing **36 public tables, historical data, 7 Auth users and 3 Storage metadata records** were preserved. The clone gained the two planned new tables, for **38 public tables** after upgrade. All historical 36 tables matched production row counts and original-column content fingerprints.

**Critical migration-history distinction:** successfully applying SQL does **not** automatically reconcile the Supabase CLI migration ledger. Running `supabase db push` directly with the unmodified repository would mistake the production's `001`–`009` entries for this branch's unrelated `001`–`009` files. Likewise, `supabase migration repair --status applied` only changes records; it does not run schema changes. Neither action has been executed against production. A cutover must keep the original ledger as audit history, execute the audited incremental changes on a maintenance window with a fresh backup and a guarded plan, then reconcile/record the exact applied versions and compare the final schema before resuming traffic. This requires separate release approval.

## C. PostgreSQL rollback rehearsal — PASS, local transaction only

A **second, separate database** `inkr_rollback_test` was restored from the original encrypted SQL backup (2 appointments, 4 tattoo requests, 7 message templates). All 22 migrations were executed between an explicit `BEGIN` and `ROLLBACK` — **no COMMIT**. Afterwards, the database still had **36 historical public tables**, with **36/36 content fingerprints matching the original source**. No production changes or services were touched. Evidence remains privately in `%LOCALAPPDATA%\INKR-QA\clone\rollback-migration-status.json` and `rollback-content-fingerprints-result.json`.

This proves transactional SQL rollback for these scripts under test; it does **not** prove an end-to-end rollback after a committed production deployment, binary/app releases, Auth runtime changes or Storage API modifications.

## D. Android distribution audit — version collision confirmed, signature history incomplete

Expo EAS is configured with `cli.appVersionSource = "remote"`. A **read-only** `eas build:version:get --platform android --profile production --non-interactive --json` returned **`versionCode=1`** on 17 November 2026. The production EAS profile has `autoIncrement: true`. The EAS history contains **10 Android builds** with version `1.0.0 (4)`, of which 8 completed and 2 were cancelled. The 8 completed builds were previously not downloadable from EAS (three 404 responses, five absent artifact URLs). There is no credible evidence that these builds were installed or published in a store; that requires Play Console/manual distribution confirmation.

APK inspections on the authorized computer:
- Staging EAS APK: `com.inkr.tattoo`, `1.0.0 (1)`, `targetSdkVersion=36`, signing certificate SHA-256 `6dc3710d2573857e5ec954d5e8fb0ff778b3b2e51035e2b39d2419f318ab3ecf`.
- Local release APK: `com.inkr.tattoo`, `1.0.0 (1)`, signing certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (Android Debug certificate).
- These two local APKs have **different signatures**, so they cannot be treated as interchangeable in-place updates. The historical version `4` signing certificate is **not recoverable** from the current evidence.

A new production build based on remote counter `1` and `autoIncrement: true` could still produce a versionCode below historic `4`. Before a release, synchronize the remote EAS version baseline appropriately, produce a candidate code at least `5`, and demonstrate signature/distribution compatibility (or a tested forced-upgrade / legacy exclusion strategy). No remote version counter or signing credentials were changed in this audit. **G0 remains HOLD.**

## E. Real staging security checks — anonymous-denial PASS, client/artist real login PENDING

Supabase staging `lsewxsdulunuuzmszegm` has **4 confirmed Auth users**, including **1 artist profile** and 3 user profiles. No credentials for these accounts are available in the authorized QA worktree.

Direct HTTPS requests with the **public staging anon key** were made to the Data API. No session data or API secret was printed. Results:
- `appointments`, `tattoo_requests`, `notifications`: **HTTP 200, empty `[]`** for anon.
- `appointment_deposit_requests`: **HTTP 401** for anon.
- `artists`: **HTTP 200** with one public artist row.
- This establishes anonymous access restrictions and the public artist read path against actual staging services. It does **not** establish real signed-in client/artist permission handling, email recovery, push receipt, notifications, deposits lifecycle UI or browser/device flows.

Staging security advisors also flag several `SECURITY DEFINER` functions callable by anon and some extensions in `public`. These deserve a least-privilege review; they were not altered in this backup/migration audit.

## F. Evidence and next release gates

| Gate | Evidence now available | Still needed |
| --- | --- | --- |
| G0 | EAS history, current remote version, two local APKs and fingerprints | Historical signing/install evidence, Play Console/manual distribution, `versionCode >= 5` upgrade test |
| G1 | Restored SQL clone, 22 migrations, exact counts/hashes, 3 Storage objects restored locally | Independent portable backup, managed-Stack compatibility and safe migration-ledger cutover |
| G2 | DB lifecycle tests + actual anonymous HTTPS denials | Two real authorized staging logins and complete client/tattooist UI/API sequences |
| G3 | Existing automated checks | Device UX, iOS, accessibility, permissions, deep links, network failure |
| G4 | Transactional rollback of all 22 SQL migrations on a second clone | End-to-end rollback of committed deployment, Auth services and Storage |
| G5 | Evidence prepared | Independent, explicit owner approval for final production release |

**Release decision: HOLD.** No mutation to the production database, Supabase Storage objects, EAS remote version, store releases or protected release branches.

**Sources:** Supabase migration repair and backup/restore documentation; Expo EAS remote version-management documentation. Exact local audit evidence remains off GitHub.
