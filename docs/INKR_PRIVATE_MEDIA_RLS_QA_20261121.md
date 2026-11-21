# INKR staging — private media RLS evidence (21 Nov 2026)

Scope: Supabase staging `lsewxsdulunuuzmszegm` only. No production mutation, no signing-key retrieval, no JWT forgery, no private asset downloads.

## SQL / role-simulation results
- `storage.objects`: RLS enabled.
- `request-references`: private bucket (`public=false`), 4 staged objects, all four names map to an existing `tattoo_requests.id`.
- PostgreSQL transaction with `SET LOCAL ROLE authenticated` and a transaction-local `request.jwt.claim.sub` representing the **actual** client of the request: 4/4 objects visible.
- Same simulated RLS transaction as the **actual** artist's profile: 4/4 objects visible.
- Unrelated QA client identity: 0/4.
- Unrelated QA artist identity: 0/4.
- Synthetic unrelated identity: 0/4.
- `SET LOCAL ROLE anon`: 0/4.
- All role simulation transactions ended with `ROLLBACK` and did not change data.

These are SQL RLS results and **not proofs of independently authenticated HTTP requests** or signed Storage download URLs. The requirement for three separate real browser/device identities and the client–artist UI remains G2 HOLD.

## Remaining G2 acceptance criteria
1. Three independently authenticated sessions (request's client, receiving artist, unrelated account), with real Auth signed JWT.
2. Upload from client: 0, 1, 2 and exactly 3 private references, plus attempts at a fourth (rejected); verify object names / MIME / size limits.
3. Confirm that the owner client and recipient artist can access all three objects using the **actual** Storage API and that a third account / anonymous request receives a denial.
4. Verify signed URL expiry, permission checks after cancellation, cleanup of orphaned objects, and absence of JWTs/private URLs in public CI reports.
5. Verify client↔artist UI request creation, confirmation, conversation and deposit state end-to-end.
6. Clean up only the explicitly created staging QA test data and record post-test object counts.

No claims of full G2 GO can be made on these RLS-only tests.
