# Phase 3A Article trust acceptance record

## Status

Acceptance is in progress.

This record captures the verified real-Article baseline after PR #530 and before Source withdrawal testing.

PR 3B remains blocked until every remaining acceptance item is completed and recorded.

## Acceptance Article

- Slug: `why-i-keep-postponing-my-hair-appointment`
- Working Article version: `b8a9b293-a54b-40d2-bd40-85115a8524ec`
- Working version number: 1
- Working version kind: Baseline

## Verified baseline

The production Article trust workspace has:

- two governed Sources
- two Article-version Citation attachments
- two governed Credits
- Citation revision 3
- Credit revision 3

The Source and Citation proof includes:

- one approved internal Source
- one approved public-reference Source
- one internal-only Citation using the `whole_source` locator
- one public-safe Citation using the `quotation` locator
- deterministic display order 0 and 1
- both Citations attached to the exact current approved Source versions
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
- does not expose Source internal notes
- does not expose Citation editor notes
- does not expose exact quotations
- does not expose Source version IDs
- does not expose Citation IDs
- does not expose private Credit identity or governance fields

Citation does not grant reuse permission.

Credit does not determine payment or payout rights.

## Completed acceptance items

- two real Sources
- two locator types
- one internal-only Citation
- one public-safe Citation
- two Credits
- one primary Author
- one non-author contribution
- one non-public Credit
- editor creation completeness for Sources, Citations, and Credits
- independent Citation and Credit revisions
- public payload minimisation
- no forbidden private-field exposure

## Remaining acceptance items

- explicit working-versus-published isolation proof
- Source withdrawal behavior
- Source restoration and fresh-review behavior
- Credit governance behavior
- final recorded Phase 3A closure

## Source withdrawal acceptance sequence

Use the public-reference Source.

1. Withdraw it with a real reason and `hide_public_reference`.
2. Verify the Source becomes withdrawn.
3. Verify its attached Citation remains in editorial history but becomes not publicly eligible.
4. Verify the public Article trust payload no longer contains the Source.
5. Restore the Source with a real reason.
6. Verify restoration produces Active, Changes Requested, Internal, with no current approved Source version.
7. Verify the Citation remains not publicly eligible after restoration.
8. Submit the exact working Source version for review.
9. Approve the exact submitted Source version for Public Reference.
10. Verify public eligibility returns without changing Citation or Credit revisions.

The lifecycle must be performed visibly through the Article Trust workspace. Production verification may observe and record the result, but must not fabricate or silently insert the lifecycle decisions.
