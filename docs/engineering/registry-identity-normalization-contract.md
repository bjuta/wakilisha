# WAKILISHA Registry Identity Normalization Contract

Date: 14 September 2026

Status: **DESIGN AUTHORITY — V1**

Programme context: MIZIZI Slice 2 governance primitive convergence

First proving consumer: #939 Registry materialization primitive family

## 1. Purpose

The Registry needs one durable identity-normalization contract that can be reused by Artist, Track, Release and future canonical identity operations.

Existing code contains several incompatible normalizers, including simple `trim().toLowerCase()`, ASCII-oriented slug functions, chart-specific punctuation folding and provider-specific cleanup. New governance primitives must not perpetuate those inconsistencies merely because they are historical.

This contract therefore separates three different concerns that legacy code often collapses:

1. **canonical normalized text** — a faithful, deterministic normalized representation stored/compared as canonical identity text;
2. **identity comparison key** — a deliberately broader ambiguity-detection key used to surface possible collisions;
3. **external identifier canonicalization** — strict canonical forms for identifiers such as ISRC and UPC.

The broader comparison key is never canonical truth and never an automatic merge instruction.

## 2. Governing rule

> Normalize representation aggressively enough to make equivalent technical spellings comparable, but never normalize cultural identity so aggressively that distinct entities are silently merged.

Normalization may reject or route to review.

Normalization must not guess.

## 3. Canonical normalized text V1

Function family target:

`platform_private.registry_identity_normalize_text_v1(text)`

Behavior:

1. reject null/empty input at operation-specific validation boundaries;
2. trim leading/trailing whitespace;
3. apply Unicode **NFKC** normalization;
4. lowercase using PostgreSQL's deterministic text lowering in the database environment;
5. collapse all runs of Unicode whitespace to one ASCII space;
6. trim again;
7. preserve letters, digits, diacritics, apostrophes, punctuation and culturally meaningful symbols.

Examples:

- `"  Café   del Mar "` → `"café del mar"`
- full-width `"ＡＢＣ 123"` → `"abc 123"`
- `"K’naan"` remains distinct in canonical normalized text from a spelling that uses different punctuation until comparison-key evaluation;
- `"Beyoncé"` remains `"beyoncé"`, not `"beyonce"`.

This value is suitable for canonical `normalized_name` / `normalized_title` fields for newly materialized entities where the live schema already carries those fields.

## 4. Identity comparison key V1

Function family target:

`platform_private.registry_identity_comparison_key_v1(text)`

Behavior:

1. begin from Unicode NFKC + lowercase;
2. replace runs of characters outside Unicode alphanumeric classes with one ASCII space;
3. collapse whitespace;
4. trim.

Examples:

- `"K’naan"` → `"k naan"`
- `"K'naan"` → `"k naan"`
- `"Café—del Mar"` → `"café del mar"`
- full-width technical forms converge through NFKC.

The comparison key intentionally preserves diacritics in V1. `"Beyoncé"` and `"Beyonce"` therefore remain separate comparison keys. Diacritic-insensitive retrieval may be added later as a **candidate-search** aid, but it must not become automatic identity equivalence without explicit evidence.

### Critical semantic rule

A comparison-key collision means:

**"automatic creation is ambiguous; reconcile or review"**

It does **not** mean:

**"these rows are the same entity."**

The key is therefore allowed to have many collisions in the historical Registry.

The 14 September 2026 Production audit found, under the proposed V1 comparison rule:

- Artists: 16 collision keys / 32 rows, maximum bucket 2;
- Tracks by title alone: 197 collision keys / 440 rows, maximum bucket 10;
- Releases by title alone: 3 collision keys / 6 rows, maximum bucket 2.

This proves comparison keys cannot be globally unique identity keys.

## 5. Slug policy

Slugs are routing/public identity aids, not cultural identity proof.

Creation V1 uses deterministic slug derivation from the canonical identity plan. Random suffix fallback is forbidden in governed automatic creation.

If a deterministic slug is occupied by another canonical entity, automatic creation stops for reconciliation rather than silently appending randomness.

Existing historical slugs are not rewritten by this contract.

## 6. Artist identity collision policy

Artist Create V1 binds and checks all of:

- future Artist UUID;
- canonical display name;
- canonical normalized text;
- identity comparison key;
- deterministic slug;
- current exact collisions by UUID and slug;
- current candidate collisions by normalized text and comparison key.

Any candidate collision makes automatic creation review-bound.

No first-match selection is allowed.

## 7. Track identity collision policy

Track title alone is not identity.

Track Create V1 binds:

- future Track UUID;
- canonical title;
- canonical normalized title;
- title comparison key;
- deterministic slug;
- optional canonical ISRC;
- exact canonical identity Artist UUID;
- current collision set.

Automatic Track creation rejects when:

- canonical ISRC collides with an existing Track;
- deterministic slug collides;
- the same title comparison key is already associated with the same exact canonical Artist and identity cannot be proven distinct;
- the collision state changes after grant issuance.

A same-title Track by a different Artist is not automatically a collision merely because the title comparison key matches.

Track↔Artist credit remains a separate canonical fact even though Artist identity is part of Track creation's collision evidence.

## 8. Release identity collision policy

Release title alone is not identity.

Release Create V1 binds:

- future Release UUID;
- canonical title;
- canonical normalized title;
- title comparison key;
- deterministic slug;
- optional canonical UPC;
- exact canonical identity Artist UUID when UPC is absent or policy requires it;
- current collision set.

Automatic Release creation rejects when:

- canonical UPC collides with an existing Release;
- deterministic slug collides;
- without UPC, the same title comparison key already exists for the same exact canonical Artist and identity cannot be proven distinct;
- collision state changes after grant issuance.

The Release↔Artist credit remains a separate canonical fact.

## 9. ISRC canonicalization V1

Function family target:

`platform_private.registry_identity_canonical_isrc_v1(text)`

Input may contain technical separators or whitespace.

Canonicalization:

1. trim;
2. uppercase;
3. remove spaces and hyphens used only as presentation separators;
4. validate canonical shape `^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$`;
5. return the 12-character canonical identifier.

Invalid identifiers reject; they do not become arbitrary text.

Production baseline at design freeze: all 2,101 non-null Registry Track ISRCs are already 12-character canonical-shape values with no spaces/hyphens.

## 10. UPC canonicalization V1

Function family target:

`platform_private.registry_identity_canonical_upc_v1(text)`

Canonicalization:

1. trim;
2. remove spaces and hyphens used only as presentation separators;
3. preserve all digits including leading zeros;
4. require digits only after separator removal;
5. require V1 length 8–14 digits;
6. return canonical digit string.

Invalid identifiers reject.

Production baseline at design freeze: all 840 non-null Registry Release UPC values are already digits-only, length 12–14, with no spaces/hyphens.

The current Registry schema does **not** uniquely constrain UPC. Governed Release creation must therefore perform its own exact UPC collision check under lock.

## 11. Storage compatibility

This contract does not rewrite historical `normalized_name` / `normalized_title` values as part of #939.

New V1 materialization writes the new canonical normalized text contract for newly created identities.

Collision checks must consider both:

- existing stored canonical fields needed for compatibility;
- freshly computed V1 canonical/comparison keys from canonical display/title values.

This lets new primitives become robust immediately without pretending historical normalization is already homogeneous.

A later dedicated normalization-convergence project may backfill canonical keys only after collision review and public-identity impact analysis.

## 12. Database implementation rules

Normalization authority lives in private deterministic database helpers rather than being duplicated in Edge Function TypeScript.

Public/product callers submit evidence-bound source strings. The database derives the canonical normalized representation and collision key used by the plan/executor.

The helpers must be deterministic and side-effect free.

The implementation may use PostgreSQL's immutable Unicode `normalize(text, form)` facility. It must not introduce mutable dictionary-dependent normalization as canonical identity behavior.

## 13. Evidence and audit

Evidence assertions retain the original observed source value as well as the canonicalized identity plan.

This preserves the distinction between:

- what a source actually said;
- how WAKILISHA normalized that representation technically;
- what canonical identity decision was made.

Normalization is therefore auditable and reversible at the reasoning layer even though the canonical row stores normalized identity fields.

## 14. Versioning

These functions and rules are explicitly V1.

A future improved normalizer must use a new ruleset/version when its output can change identity collision behavior.

Existing exact grants and plan fingerprints remain bound to the normalization ruleset used when they were issued.

No silently changing helper semantics under an old ruleset.

## 15. Relationship to chart normalization

Chart scoring/ingestion normalization remains useful for chart matching and methodology.

It is not automatically the Registry identity normalization authority.

Chart may produce evidence using its own methodology, but Registry materialization recomputes canonical identity normalization under this contract before grant issuance and again before execution.

That separation prevents chart-methodology changes from silently changing canonical Registry identity semantics.