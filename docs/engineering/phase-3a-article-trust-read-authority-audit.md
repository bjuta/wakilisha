# Phase 3A Article trust read authority audit

## Status

Authority locked after the identity, attachment, and command layers were applied and verified.

## Established boundary

Trust attachments belong to one immutable Article version.

The editor reads and mutates trust records against the Article resource current working version.

The public surface derives trust records from the Article resource current published version.

The public caller must not supply an arbitrary Article version identifier.

## Authenticated workspace read

The Article Workspace needs one bounded query for one Article version.

It must return:

- Article version identifier
- Citation revision
- Credit revision
- ordered Citation attachments
- ordered Credit attachments
- Source, Citation, Credit, contributor, governance, lifecycle, and public-safety state required by the editor

The caller must have Article edit authority for the parent resource or administrator authority.

The query must not expose unrelated trust records.

## Public read

Public delivery must begin from public Article identity and derive the current published Article version internally.

A public Citation requires:

- a public-safe Article-version attachment
- an active and public-safe Citation
- an active Source
- the exact current approved Source version
- public or public-redacted Source exposure

A public Credit requires:

- a public-safe Article-version attachment
- active public-safe Credit governance
- qualifying active public-safe external-contributor consent where applicable

Eligibility must be recalculated at read time.

## Public field minimisation

Public delivery must not expose:

- Source internal notes
- Citation editor notes
- private quotations
- private contributor data
- actor identifiers
- governance reasons
- revision-control metadata
- restricted or confidential Source metadata
- unpublished Article version identifiers

## Withdrawal

Withdrawn Sources must not appear as active public references.

Until a governed withdrawn-reference presentation is implemented, omission is the safe default.

Inactive, withdrawn, or non-public-safe Credits must not appear publicly.

## Permanent separations

Citation does not grant permission.

Credit does not determine payout.

Public-safe does not mean free to download, reproduce, train on, embed, redistribute, or commercialise.

## Frontend ownership

A dedicated Article trust service owns trust reads and command calls.

The canonical ArticleEditorWorkspace owns the trust panel.

Publishing Workspace and the old Institute surface must not become parallel trust authorities.

The public-content delivery path owns public trust delivery.

The browser must not read editorial trust tables directly.

## Required acceptance

Tests must prove:

- authorized workspace access
- unauthorized workspace denial
- published-version derivation
- no working-version leak
- no private-field leak
- withdrawn Source omission
- inactive Credit omission
- deterministic ordering
- independent Citation and Credit revisions
- empty arrays instead of null

PR 3B must not begin before Article trust adoption is complete.
