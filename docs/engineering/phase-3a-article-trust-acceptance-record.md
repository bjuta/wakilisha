# Phase 3A Article trust acceptance record

## Status

Acceptance is complete.

Article adoption, Source lifecycle acceptance, explicit working-versus-published isolation, visible Credit governance acceptance and final restoration are complete.

Phase 3A is closed.

PR 3B is unblocked and may proceed from this accepted baseline.

## Acceptance Article

- Slug: `why-i-keep-postponing-my-hair-appointment`
- Article id: `6d392db7-8a3f-4343-bdf0-58c314eef227`
- Resource id: `a65fc02d-255b-4676-9081-f4c09c0bbdd2`
- Published Article version: `b8a9b293-a54b-40d2-bd40-85115a8524ec`
- Historical isolation-marker version: `d9438917-2d5a-46c0-bf96-69a5b9501463`
- Current clean working version: `56f84a5b-309e-43bd-a676-883f39410a1b`
- Current Article status: Published
- Current resource gate: Public and Published

## Verified trust baseline

The published Article version has:

- two governed Sources
- two Article-version Citation attachments
- two governed Credits
- Citation revision 3
- Credit revision 3

The current clean working Article version has:

- zero Citations
- zero Credits
- Citation revision 1
- Credit revision 1

The Source and Citation proof includes:

- one approved internal Source
- one approved public-reference Source
- one internal-only Citation using the `whole_source` locator
- one public-safe Citation using the `quotation` locator
- deterministic display order 0 and 1
- both Citations attached to the exact approved Source versions
- the internal Citation remaining not publicly eligible
- the public Citation currently publicly eligible

The Credit proof includes:

- one public primary Author Credit for Muiruri Beautah
- one internal non-author Editor Credit for WAKILISHA
- the Credit revision remaining unchanged while Citation revision advanced independently

## Public minimisation proof

The server-owned public Article trust read:

- derives the published Article version internally
- exposes only currently eligible public trust records
- returns one public Source and one public Credit
- does not expose Source internal notes
- does not expose Citation editor notes
- does not expose exact quotations
- does not expose Source version IDs
- does not expose Citation IDs
- does not expose private Credit identity or governance fields

Citation does not grant reuse permission.

Credit does not determine payment or payout rights.

## Source lifecycle acceptance proof

The public-reference Source completed the full visible lifecycle sequence through the Article Trust workspace:

1. The Source was withdrawn with `hide_public_reference` and a real acceptance reason.
2. The Source became withdrawn.
3. Its Citation remained in editorial history but became not publicly eligible.
4. The public Article trust payload dropped to zero public Sources.
5. The Source was restored with a real acceptance reason.
6. Restoration produced Active, Changes Requested, Internal, with no current approved Source version.
7. The Citation remained not publicly eligible after restoration.
8. The exact restored working Source version was submitted for review.
9. The exact submitted version was approved for Public Reference.
10. Public eligibility returned without changing Citation or Credit revisions.

The current approved public Source version is:

`a5a46d44-98e3-477b-b0fd-52e60fee569a`

The Source is currently Active, Approved and Public, with no withdrawal timestamp.

## Working-versus-published isolation proof

A deliberate unpublished Article working version was created through the Article editor with this temporary Summary marker:

`Phase 3A working-versus-published isolation acceptance draft.`

The isolation save produced working version:

`d9438917-2d5a-46c0-bf96-69a5b9501463`

That save verified:

- the working pointer advanced
- the published pointer remained `b8a9b293-a54b-40d2-bd40-85115a8524ec`
- the active publication snapshot remained on the published version
- the marker appeared only in the working version
- working and published content fingerprints were different
- the new working trust bundle remained empty at Citation revision 1 and Credit revision 1
- the published trust bundle remained two Citations and two Credits at revisions 3 and 3
- public trust remained bound to the published version
- the accepted Article taxonomy was Opinion with Nairobi, Matatu Culture and Hawkers
- Nduthi Guys was deliberately removed
- Hawkers became one canonical active `post_tag`

The normal Save action initially exposed a publication-isolation defect. It forced Draft and changed the resource gate to Private and Draft even though the published pointer and active snapshot remained intact.

The defect was repaired through:

- PR #536, Preserve published Article during working saves
- migration `20260802202500_preserve_published_article_on_working_save.sql`
- PR #537, Reconcile published working-save schema
- frontend release `20260802193736-89920d4-rsync`

The repair established that a normal working-version save:

- advances only the working pointer
- preserves Article publication status
- preserves resource visibility and lifecycle state
- leaves publish, unpublish, schedule and archive transitions to dedicated commands

Only the affected Article status and resource gate were restored. No version pointer or publication snapshot was rewritten.

The marker was then removed through the repaired editor and saved as a second unpublished working version:

`56f84a5b-309e-43bd-a676-883f39410a1b`

Final cleanup verified:

- the Article remains Published
- the resource remains Public and Published
- the current working and published pointers remain distinct
- the published pointer and active snapshot remain `b8a9b293-a54b-40d2-bd40-85115a8524ec`
- the temporary marker is absent from current working, published and public snapshot content
- the historical marker version remains in durable version history
- the current working excerpt matches the published excerpt
- the accepted three Tags remain intact
- Hawkers reports one published Article
- working trust remains isolated
- published trust remains unchanged
- public trust returns one Source and one Credit

## Credit governance acceptance proof

The published-version Credit governance controls were delivered through:

- PR #539, Add Article Credit governance controls
- migration `20260802231000_article_trust_published_version_context.sql`
- frontend release `20260803085711-5aa2909c`
- PR #540, Reconcile Article Credit governance schema baseline

The visible Article Trust workspace established that:

- working-version Credits and published-version Credits are presented separately
- the current working version has zero Credits
- the published version has two Credits
- Muiruri Beautah is the primary Author Credit
- WAKILISHA is an internal Editor Credit
- governance state, public-safe status, reason and revision are visible
- Credit governance does not determine payment or payout rights

The first withdrawal attempt exposed a frontend validation defect. The form allowed `withdrawn` and public-safe to be submitted together.

The governed SQL command correctly rejected that invalid combination with:

`Only active Credits can be public-safe`

No production governance mutation was accepted by that failed attempt.

The frontend defect was repaired through:

- PR #541, Prevent invalid Credit governance states
- frontend release `20260803114102-45114c6b`

The repair established that:

- changing a Credit to Withdrawn or Archived clears public-safe
- public-safe is disabled for non-active Credits
- a reason remains required for withdrawal or archival
- the submitted command defensively sends public-safe as false for non-active states

The Muiruri Beautah Author Credit then completed the visible governance lifecycle.

Withdrawal used this reason:

`Acceptance test: temporarily withdrawn to verify public Credit eligibility controls.`

Withdrawal verified:

- governance state became Withdrawn
- public-safe became false
- governance revision advanced from 1 to 2
- the Author Credit became not publicly eligible
- the public Article trust payload dropped from one Credit to zero Credits
- both published Credit attachments remained intact
- the working version remained at zero Credits
- the public Source count remained one
- Article Credit revision remained 3

Restoration used this reason:

`Acceptance test: restored to active and public-safe after withdrawal verification.`

Restoration verified:

- governance state returned to Active
- public-safe returned to true
- governance revision advanced from 2 to 3
- the Author Credit became publicly eligible again
- the public Article trust payload returned to one Credit
- both published Credit attachments remained intact
- the working version remained at zero Credits
- the public Source count remained one
- Article Credit revision remained 3
- the WAKILISHA Editor Credit remained not publicly eligible

The final live Credit state is:

- Muiruri Beautah: Active, public-safe, publicly eligible, governance revision 3
- WAKILISHA: Active, not public-safe, not publicly eligible, governance revision 1

## Completed acceptance items

- two real Sources
- two locator types
- one internal-only Citation
- one public-safe Citation
- two Credits
- one primary Author
- one non-author contribution
- one non-public Credit
- editor creation completeness for Sources, Citations and Credits
- independent Citation and Credit revisions
- public payload minimisation
- no forbidden private-field exposure
- Source withdrawal behavior
- Source restoration and fresh-review behavior
- explicit working-versus-published isolation proof
- working-save publication isolation repair
- temporary acceptance-marker cleanup
- restoration of the affected public Article gate without pointer mutation
- visible working-version and published-version Credit separation
- visible governed Credit state and public-safe controls
- required withdrawal and archival reasons
- enforcement that only Active Credits can be public-safe
- Author Credit withdrawal and public-eligibility removal
- Author Credit restoration and public-eligibility return
- Credit governance revision advancing independently
- Article Credit revision remaining unchanged through governance mutations
- final restoration of the accepted public trust state

## Remaining acceptance items

None.

Phase 3A is complete.

PR 3B is unblocked.
