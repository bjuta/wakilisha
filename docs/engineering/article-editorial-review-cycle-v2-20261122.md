# Article Editorial Review Cycle v2: permanent state authority

**Date:** 2026-11-22. **Issue:** #1425. **Scope:** shared Article authoring/editorial frontend only.

## Observed Production failure

Article `album-review-alusa-continua` submitted immutable v30, approved immutable v31, then saved a different working body as v32 while `public.wk_articles.wp_status` remained `pending`. Old source gate treated `pending` as an unreviewed submission, hid Resubmit, hid Approve (latest event already approved), and blocked Publish because latest version number no longer equalled approved version. The Review tab still showed the old submitted v30. No data corruption was found and no Production Article mutation occurred during diagnosis.

## One version-bound decision model

`deriveArticleEditorialGate` is the pure, tested authority used by **all** Article editor control surfaces, including the Review decision workspace, inline Publish panel, and header. The SQL-owned immutable lifecycle events/Version fingerprints remain authoritative; the frontend does not manually update `wp_status` or Resource pointers.

- **Draft** (no submission): Submit for Review.
- **Latest submitted version matches working content:** Await a decision; authorized reviewer may approve/request changes for the exact current submitted UUID. No duplicate submission button.
- **Newer saved/unsaved working content after submission:** Resubmit the working version; an outdated reviewed submission is not offered for accidental approval.
- **Latest approved version matches working content:** Publish the governed approved snapshot. `wp_status=pending` does not revoke an existing immutable approval.
- **Newer working content differs from an approval:** Preserve the approved historical version and show Resubmit Current Version for Review. No publication of unreviewed working content and no reapproval of the old submitted snapshot.
- **No-op save creating a different version number with unchanged fingerprint:** Approval remains valid because the content is unchanged.
- **Missing version authority or stale review target:** fail closed with explicit Review Verification Required, not a guessed approval.
- **Published/scheduled Articles:** Keep the existing separate publication lifecycle; no accidental resubmission against an already live resource.

Every submission calls the **existing** authorized `submit_article_for_review` RPC with optimistic draft-version (CAS) expectation. A new immutable submitted Version and Resource review event then support a new exact-version approval, and only then publication. The existing backend's `publish_article_version` checks the current canonical approved version ID and does not publish an arbitrary working draft.

## Scope and proofs

No new table, migration, RLS, Edge Function, route, Charts or bulk Article rewrite. This avoids bypassing established server permission controls. The frontend now obtains both latest submitted and latest approved fingerprints from the existing version-list RPC and never equates a pending status to active pending review by itself. Unit and jsdom component tests cover the real v30 -> v31 -> v32 deadlock, new v33 submission -> v34 approval, no-op saves, superseded submissions, unavailable authority, permissions and visible Review CTA.

Protected CI and canonical Production frontend Finish are separate acceptance gates. Real authenticated Production retest must read back submitted, approved and published pointers for the exact Article, preserving its editorial history. Do not publish user content automatically.
