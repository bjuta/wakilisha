# Phase 3A Article trust read implementation blueprint

## Package

Add Article trust reads, the Article Workspace trust panel, and safe public Article presentation.

Do not add research commerce, licences, entitlements, metering, payments, payouts, corrections, or universal cross-resource commands.

## Migration

Create one migration with two bounded read contracts.

### Workspace function

```sql
public.get_article_version_trust_workspace(
  p_article_version_id uuid
) returns jsonb
```

Requirements:

- SECURITY DEFINER
- fixed search path
- Article edit or administrator authorization
- authenticated and service-role execution only
- no public or anon execution
- Citation and Credit revisions returned independently
- deterministic ordering
- empty arrays for empty families
- no unrelated trust records
- no mutation except accepted revision-row initialization

Conceptual result:

```json
{
  "article_version_id": "uuid",
  "citation_revision": 1,
  "credit_revision": 1,
  "citations": [],
  "credits": []
}
```

### Public function

```sql
public.public_get_article_trust(
  p_article_slug text
) returns jsonb
```

The final identifier may be the existing public resource identity if that matches the public-content gateway better.

Requirements:

- derive current_published_version_id internally
- never accept an arbitrary Article version from an anonymous caller
- recalculate public eligibility at read time
- deterministic ordering
- empty arrays when nothing is eligible
- no private or internal fields
- server-owned execution unless the existing public gateway requires direct anon RPC

Conceptual result:

```json
{
  "sources": [],
  "credits": []
}
```

No editorial trust table receives anonymous select access.

## Verifier

Add:

```text
scripts/control-plane/verify-phase-3a-article-trust-read-authority.sql
```

Verify exact signatures, security mode, fixed search paths, grants, revocations, authorization, published-version derivation, deterministic ordering, empty arrays, public eligibility, prohibited-field omission, and no anonymous trust-table reads.

## Frontend service

Add:

```text
src/services/articles/articleTrustService.ts
```

It owns workspace loading, all existing trust command RPC calls, payload normalization, independent revisions, and concurrency errors.

React components must not call trust RPCs directly.

## Article Workspace

Add:

```text
src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx
```

Mount it in ArticleEditorWorkspace after the current working Article version is known.

The panel provides:

- Sources and Citations
- Credits
- ordered attachments
- public-safe eligibility explanations
- one primary author
- refresh after concurrency conflict
- explicit current Article version context

Changing the working version invalidates and reloads the trust bundle.

Citation saves use only the expected Citation revision.

Credit saves use only the expected Credit revision.

## Public Article

Extend PublicArticleDetail with:

```ts
type PublicArticleTrust = {
  sources: PublicArticleSource[];
  credits: PublicArticleCredit[];
};
```

The public-content gateway populates this from the server-owned public trust read.

Render restrained Sources and governed Credits sections.

Use governed primary-author Credit where valid.

Keep the current byline as fallback until governed Credits exist.

Do not imply reuse permission or payment rights.

## Tests

Add tests for:

- service mapping
- independent revisions
- working-version reload
- no direct RPC calls from React
- public payload mapping
- private-field omission
- no working-version leak
- withdrawn Source omission
- inactive Credit omission
- deterministic ordering
- governed author precedence
- legacy byline fallback
- anonymous trust-table denial

## Sequence

1. Migration and verifier
2. Migration PR
3. Production apply
4. Schema regeneration and schema-sync PR
5. Article trust service
6. Article Workspace panel
7. Public-content gateway integration
8. Public presentation
9. Real Article acceptance proof
10. Phase 3A closure

Do not combine production migration application with frontend deployment.

## Acceptance proof

Use one real Article with:

- two Sources
- two locator types
- one internal-only Citation
- one public-safe Citation
- two Credits
- one primary author
- one non-author contribution
- one non-public Credit

Prove editor completeness, public minimisation, working-versus-published isolation, Source withdrawal behaviour, Credit governance behaviour, independent revisions, and no private-data exposure.

PR 3B must not begin before this proof is recorded.
