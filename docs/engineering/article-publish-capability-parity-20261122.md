# Article publication capability parity after approval

**Date:** 2026-11-22. **Source:** Production Article `album-review-alusa-continua`, latest approved v35 and manually saved v36, identical immutable content fingerprint `bbb9236269c454f4fa2e7c272d63997e1a53b99e6ed9d58e6bd7f420c259a00e`.

## Incident and exact authority mismatch

User screenshot showed "Approved for Publication" yet no Publish control. The frontend `ArticleEditorWorkspace` previously set `canPublish = isAdmin || (isOwner && userCanPublish)`. This is narrower than the actual Production SQL authorization `editorial.current_user_can_publish_article()`, which authorizes the database role `public.current_user_is_administrator()` **or** global `public.current_user_has_capability('publish_articles')`, with **no ownership restriction**. Publication RPC `public.publish_article_version` checks that function and the exact approved immutable version ID. The old UI also converted any denied publish permission into the misleading message "Verifying the exact approved Article version".

## Resolution

The editor now computes publish eligibility using the exact canonical global capability rule, excluding Institute mode as before. Article editing privileges and version-bound review checks remain unchanged. When publication is not available, the gate distinguishes actual permission denial, unsaved changes, and missing immutable-version evidence. Authorized users can publish a matching approved immutable version even after a no-op manual save; unauthorized users cannot bypass the backend.

## Exit and boundaries

Critical tests and build, browser checks, canonical production frontend Finish, then read-only postflight plus intentional owner/operator publication. No SQL, migration, Edge, Charts, role grant, Article content write or automatic publication in this repair. Preserve approved v35, saved v36 and existing lifecycle history.
