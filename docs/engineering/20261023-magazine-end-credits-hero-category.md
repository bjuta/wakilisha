# Magazine end credits and homepage cover eyebrow — 23 October 2026

## Product decision
At the end of each published article, after the last Categories/Topics group and **before Community**, display the credited author identity (avatar initials, canonical author name, publication date) and an ellipsis. This is an additional end-of-read wayfinding/action affordance. Retain the opening mobile author row and the accepted desktop author rail, and keep the existing article hero composition untouched. Every credited name/avatar uses `ArticleAuthorIdentity` with the current `personPath` and `organizationPath`; never infer a Person from a text name.

The footer ellipsis reopens the **same** `CommunityActionSheet` instance as the existing article actions: same visibility, share, comment and governance contracts. No second share path, button, auth flow or Comment writer is introduced. The footer remains in the existing article paper, immediately after tags even when the article has no tags, and prior to the Community section.

For the responsive Magazine homepage hero, remove the descriptive suffix "Cover story" from the coloured eyebrow; show only the actual published `heroStory.section`. Reduce its type size from 11px to 10px and tracking from 0.18em to 0.14em on mobile and desktop. Preserve title, author, featured image, hero height and navigation scroll behavior.

## Verification and release boundary
- Protected source contract confirms both routes place `ArticleEndCredits` after tags and before `CommunitySection`, retain initial credits, link the actual credited identity, and route the footer ellipsis to the existing action sheet.
- Existing Critical Core, Critical Browser, and aggregate Critical must pass on exact PR head before merge.
- Frontend-only. No SQL, Supabase functions, auth/role permissions, article content authority or editorial mutation. No preview environment. Production activation remains canonical exact-merged-main Lightsail deployment using isolated checkout so WK100 worktree remains untouched.
