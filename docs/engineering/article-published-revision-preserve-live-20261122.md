# Published Article working revisions — preserve live publication

**Incident:** Published `album-review-alusa-continua` at immutable published Version v37, with saved working Version v39. On 22 November 2026 Review displayed `review authority unavailable`, despite an authenticated editor wanting to alter the actual published Article.

## Contract

The immutable active public Article snapshot and Resource current published pointer continue to serve readers while authorized editors create another working version. The Review screen displays the live version number, current working version, an **Edit Article** action, and **Submit Updated Article for Review** when a newer working revision is saved.

The shared `deriveArticleEditorialGate` admits published revisions only when a newer working-version proof exists (or a dirty working version with source proof), never based solely on `wp_status`. Exact active submitted version/fingerprint authority is mandatory before approval. Existing draft, pending and scheduled logic stays separate.

## SQL-owned transition safety

One migration updates the existing three RPCs `submit_article_for_review`, `approve_article_version`, and `request_article_changes`, preserving the prior canonical writers/ACL/capability checks. Each locks Article and Resource, checks that the current published pointer resolves to exactly one active Article snapshot, and refuses an inconsistent public state.

For a published Article:
- Submission requires a saved newer working version, preserves `wk_articles.wp_status='publish'`, Resource `lifecycle_state='published'`, `visibility='public'`, and the existing published pointer and public snapshot. Only the submitted review pointer/event advances.
- Approval requires the current exact submitted Version and the latest submitted lifecycle event, preserves the active published state, and creates a distinct approved version. Existing reviewer permissions apply.
- Request Changes requires the exact live revision submission and the mandatory decision note, returns only the working revision for correction, preserving the prior public Article and its history.
- **Only the established `publish_article_version` RPC** promotes the newly approved Version to a fresh immutable active public snapshot; it must not be called automatically by Save/Submit/Approve.

Nonpublished drafts continue through the existing pending/approved lifecycle. Scheduled Articles are not eligible for this new route. All SQL replaces are guarded by the verified pre-migration source definitions; unexpected schema drift stops the migration. No HTML rewrite or publication occurs from this change alone.

## Acceptance

Protected unit/DOM tests cover the observed live v37 vs working v39 case, missing proof, exact v41 submitted reviewer authority, v42 approved update, nonpublished behavior and actual published Review CTA. Protected SQL contract tests verify all three writers retain published visibility and do not mutate the active snapshot or current published pointer.

Deploy order: approved migration through the established governed database path **before** frontend activation, then exact-merged-main frontend release. On a controlled, explicitly approved test Article, check live public snapshot/version identity before and after Save → Submit → Request Changes → Resubmit → Approve → Publish, with independent read-only state and actual public HTML checks. Do not mutate the user's live Alusa Article as a test fixture.

**Remaining separate gate:** WAKILISHA's static SEO snapshot publication/withdrawal refresh must follow the accepted governed artifact workflow; automatically refreshing SEO on every Article publication remains tracked under issue #1377. Public body content and static bot HTML are separate contracts until that lifecycle is complete.
