# INKR V5.1 — Production SQL clone and migration rehearsal

**Date:** 17 November 2026
**Verdict:** **PASS — isolated SQL recovery, migration replay and retained-column integrity. HOLD — production release.**

## Scope and safety

- Source: Supabase production project `jxmefklkixzzdceeorcg`, PostgreSQL **17.6**.
- A **read-only `pg_dump -Fc`** exported the `public`, `auth` and `storage` PostgreSQL schemas. The resulting archive was encrypted with Windows **DPAPI CurrentUser** and stored privately on the authorized computer under `%LOCALAPPDATA%\INKR-QA\backups`. File: `inkr-sql-20261117-115018.dump.dpapi` (**566,374 bytes encrypted**).
- The decrypted SQL archive was checked with `pg_restore --list` and restored **only on local PostgreSQL 17.12**, at `127.0.0.1:55439/inkr_restore_test`. Local database credentials are distinct from production. The local server is stopped between tests.
- The verification compared SQL aggregates and hashes, not actual private rows in a public report. **No database passwords, extracted data, Auth records or archive bytes were committed to GitHub.**
- No SQL migrations were executed against the production server. No PR was merged and no app was published.

## Restored SQL state — verified

| Item | Production read-only baseline | Local clone |
|---|---:|---:|
| Historical `public` tables | 36 | 36 before replay |
| `auth` SQL tables | 27 | 27 |
| `storage` SQL tables | 10 | 10 |
| Existing appointments | 2 | 2 |
| Tattoo requests | 4 | 4 |
| Message templates | 7 | 7 |
| Auth users | 7 | 7 |
| Storage object metadata rows | 3 | 3 |
| Storage bucket metadata rows | 8 | 8 |

The stable UTC fingerprint of appointment IDs, statuses and start/end times was identical between production and the restored clone: `a5139386f5dfd60a76965d7240d38160`.

## Migration rehearsal on the real restored schema

- The production `supabase_migrations` history contains **nine earlier migration versions** (`001` to `009`) that are **not the same sequence** as V5 staging.
- The repository's `001_initial.sql` was **not re-applied** to the already populated production clone.
- The **22 subsequent repository migration files** (`002_storage_policies.sql` through `20261116132500_pin_legacy_helper_search_path.sql`) were executed with **one PostgreSQL transaction** and `ON_ERROR_STOP=1`.
- Result: **PASS**. On the isolated copy, the transaction committed. `public` went from **36 to 38 tables**, retaining all historical tables and adding the expected V5.1 tables.
- All **36 historical public tables** matched production **exactly in row count** after replay.
- All **36 historical public tables** also matched **content MD5 fingerprints calculated over every original column** (with UTC normalization), after replay. New V5 columns are intentionally excluded from this comparison. This is evidence against accidental content loss in the preserved columns, not an adversarial collision-resistant integrity proof.
- The post-migration checks again matched the original appointments' UTC fingerprint and the counts of requests, templates, Auth users and Storage metadata.
- The newly created tables were not falsely counted as historical data. No existing table was removed.

## Authorization and SQL safety checks

The restored-and-migrated clone passed all checks:

- **38/38** public tables have Row Level Security enabled.
- `authenticated` retains SELECT on `appointments` but **has no direct INSERT/UPDATE/DELETE grants**.
- The historical permissive `appointments_manage_artist` policy is absent.
- `appointment_deposit_requests` exists, is protected by RLS and has no direct authenticated INSERT grant.
- The `respond_to_appointment(uuid,boolean)` RPC exists.
- A simulated unrelated user could **not** accept a proposed appointment.
- The legitimate client's simulated JWT claim could invoke the RPC and obtain **`confirmed`**.
- Both historical proposed appointments were already in the past. To test a valid future slot, one was moved temporarily inside a local **BEGIN/ROLLBACK** transaction. The rollback restored its original dates/status; the post-test fingerprint remained unchanged.

## Important qualifications — release remains HOLD

1. **Storage object bytes are NOT backed up.** Only SQL metadata exists in the dump; the three referenced objects remain to be exported, privately preserved, restored and integrity-tested. An offline copy encrypted only with Windows DPAPI is also **not portable to another computer/account** without a separate recovery mechanism.
2. A standard local PostgreSQL 17.12 clone is **not the entire Supabase managed stack**. Local stand-in SQL roles and PostgreSQL extensions permitted faithful DDL/DML testing, but do not reproduce managed Auth runtime, Storage API behavior, Realtime, Edge Functions, API-key configuration or all remote extensions.
3. The V5 file replay succeeded as SQL, but the **production and staging migration ledgers differ**. A release migration/version-history reconciliation is still needed before any production `supabase db push` or equivalent.
4. The client identity and outsider checks used **simulated JWT claims on the clone**, not live authenticated mobile sessions or real push/payment-provider callbacks. G2 remains HOLD.
5. Prior Android builds are still unretrievable through EAS; Google Play/App Store/manual distribution history, certificates and version numbering are not yet certified (G0 HOLD).
6. End-to-end disaster recovery including Storage files, a production-ready rollback, native devices, and separate owner release approval are still outstanding (G3–G5 HOLD).

**Release decision:** preserve all gates as **HOLD**. This result substantially strengthens the SQL migration evidence but is **not permission to alter production**.

## Private local evidence (not committed)

- `%LOCALAPPDATA%\INKR-QA\clone\restore-status.json`
- `%LOCALAPPDATA%\INKR-QA\clone\integrity-check.json`
- `%LOCALAPPDATA%\INKR-QA\clone\migration-replay-status.json`
- `%LOCALAPPDATA%\INKR-QA\clone\rls-check.json`
- `%LOCALAPPDATA%\INKR-QA\clone\post-migration-public-counts.json`
- `%LOCALAPPDATA%\INKR-QA\clone\content-fingerprints-result.json`
- `%LOCALAPPDATA%\INKR-QA\clone\legacy-rpc-test.log`
