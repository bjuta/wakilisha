# Track Lyrics Review and Provenance Closure Record

Status: CLOSED

Closure date: 24 August 2026

Production merged main: `77cecd892c63c76ac79921eeb02278ab2b231d30`

Production migration head: `20260824061359`

Production migration count at closure: `49`

## Purpose

This record closes the governed Track Lyrics review/provenance milestone and the visual-acceptance correction that followed its first production deployment.

The milestone is not merely merged. Database authority, frontend deployment, browser acceptance, and cleanup are complete.

## Authority shipped

PR #697, `Converge Lyrics review provenance and editorial decisions`, established:

- governed Track Lyrics contribution review
- immutable original listener submission
- separate editable WAKILISHA revision
- explicit accept-as-submitted and accept-with-revision decisions
- reviewer notes and durable contribution history
- structural contributor attribution through accepted versions and public reads
- retirement of the generic `lyrics_correction` write path for new Lyrics work
- shared `EditorialDecisionWorkspace` semantics across Articles, Playlists, Audio, and Lyrics
- canonical Audio Review decision integration
- shared Admin record header/action behavior
- public Lyrics attribution on Track and full-player surfaces
- Lyrics admin authority aligned with Audio editorial capabilities

Production migration:

`20260824061359_track_lyrics_review_provenance.sql`

Migration SHA-256:

`9acad5097a532f3d773d5692ab465bfc2c695f7de6646c75dc17ae3e69e72515`

Permanent verifier:

`scripts/control-plane/verify-track-lyrics-review-provenance.sql`

The migration was preview-replayed, promoted to production, and independently verified.

Production advanced to 49 migrations / head `20260824061359` with zero pending repository migrations.

## First production visual acceptance

Authenticated production acceptance proved:

- Inbox-first Lyrics review
- pending contribution discoverability without knowing the Track first
- artist-aware Track search
- immutable original submission beside a separate WAKILISHA revision
- responsive before/after diff
- distinct `Accept as submitted` and `Accept WAKILISHA revision` modes
- publication remains conceptually separate from contribution acceptance
- contribution and Lyrics-version History surfaces are available

That acceptance exposed two frontend-only defects:

1. pending-review Tracks were not guaranteed to appear before ordinary Library search matches
2. History labeled submitted contributions as contribution decisions

Visual acceptance therefore remained open.

## Visual-acceptance correction

PR #698, `Fix Lyrics visual acceptance gaps`, closed those defects.

Accepted correction:

- pending-review Tracks are stably promoted above ordinary search results while preserving governed RPC relevance order within each priority group
- History separates `Contributions` from completed `Review decisions`
- submitted rows remain contribution history but do not count as decisions
- the publication marker is labeled truthfully as `Current published versions`

Protected CI run #580 passed on the final PR head.

PR #698 merged into production main `77cecd892c63c76ac79921eeb02278ab2b231d30`.

## Final production acceptance

After exact merged-main deployment, authenticated browser acceptance proved:

- search `valle` places pending `Valle` ahead of ordinary matching Tracks
- search `matata` still promotes pending `Valle` over ordinary Matata results
- History shows `1 Contributions`
- History shows `0 Review decisions`
- History shows `0 Immutable versions`
- History shows `0 Current published versions`
- the section is titled `Contribution history`
- the still-unreviewed `Valle` contribution remains visibly `SUBMITTED`

The real pending contribution was not mutated merely to prove UI acceptance.

## Deployment closure

Final production deployment proved:

- exact merged main: `77cecd892c63c76ac79921eeb02278ab2b231d30`
- full `npm run build`: PASS
- exact live file parity: PASS
- Lightsail origin: PASS
- public production: PASS
- `/`, `/audio`, `/search`, and `/admin/content/lyrics`: HTTP 200
- final production SQL dry run: zero pending
- production SQL mutation during the frontend correction: none

## Cleanup closure

After visual acceptance:

- disposable Supabase preview was deleted and independently verified absent
- merged Lyrics remote branches were removed
- matching local Lyrics branches were removed
- temporary deployment stages were removed
- temporary Lyrics deployment/proof/preview worktrees were removed
- intentional production rollback backups were retained
- Nginx remained healthy
- live `/admin/content/lyrics` remained HTTP 200

## Exit decision

The Track Lyrics review/provenance milestone is closed.

Future Lyrics work may extend the accepted authority and shared primitives, but it must not reopen this milestone administratively unless a regression invalidates the closure proof.

## Deployment classification

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: No
- production runtime change needed: No
