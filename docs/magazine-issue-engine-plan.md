# WAKILISHA Magazine Issue Engine Plan

Status: planned
Owner surface: public magazine issues, magazine archive, search, SEO, admin preview
Source file being replaced: `src/services/magazineNlg.ts`

## Core decision

`magazineNlg.ts` should not remain the long-term home for public issue copy.

The current system has useful structure, but it still thinks like a template. It chooses issue language from shallow section signals and issue-number variation instead of understanding what kind of issue the reader is opening.

The replacement is the **Magazine Issue Engine**.

Its job is simple:

> Turn a cluster of WAKILISHA stories into a real magazine issue with a point of view.

It should not explain the machinery. It should make the issue feel worth opening.

## What this engine must do

For every issue, the engine must answer:

1. What kind of issue is this?
2. What is the strongest door into it?
3. What tension holds the pieces together?
4. Where should the reader start?
5. What should we hide because it belongs to admin, not readers?

## New folder

```text
src/services/magazineIssueEngine/
  index.ts
  types.ts
  facts.ts
  scoring.ts
  guards.ts
  formatters.ts
  testFixtures.ts
  recipes/
    editorNote.ts
    cover.ts
    contents.ts
    featureFrame.ts
    signal.ts
    backMatter.ts
    card.ts
    search.ts
    seo.ts
    admin.ts
```

## Entry point

```ts
buildMagazineIssueExperience(issue)
```

The function should return a complete public and admin-safe package for an issue.

```ts
type MagazineIssueExperience = {
  issueNumber: number;
  archetype: IssueArchetype;
  mood: IssueMood;
  title: string;
  subtitle?: string;

  coverLine: string;
  editorNote: string;
  cardBlurb: string;
  archiveBlurb: string;
  searchSnippet: string;
  seoDescription: string;
  contentsIntro: string;
  readingPath: ReadingPathStep[];
  signalReading: string;
  backMatterLine: string;

  featureFrame: {
    layout: FeatureLayout;
    publicFieldNote: string;
    adminDesignNote: string;
  };

  warnings: string[];
  factsUsed: string[];
  version: string;
};
```

## Issue facts

The engine must derive facts before it writes copy.

```ts
type IssueFacts = {
  issueNumber: number;
  title: string;
  subtitle?: string;
  deck?: string;

  articleCount: number;
  coreCount: number;
  supportCount: number;
  excludedCount: number;

  dominantSection?: string;
  secondarySection?: string;
  sectionMix: Array<{ section: string; count: number }>;

  topArticle?: MagazineIssueArticle;
  leadArticles: MagazineIssueArticle[];

  hasStrongImage: boolean;
  hasStrongSound: boolean;
  hasStrongPlace: boolean;
  hasStrongArgument: boolean;
  hasStrongGuide: boolean;
  hasStrongReview: boolean;
  hasStrongMemory: boolean;
  hasStrongSystems: boolean;

  tension?: string;
  thinness: 'rich' | 'medium' | 'thin';
};
```

The missing piece is `tension`. Magazine issues need a central pull.

Examples:

```text
sound moving through the city
memory fighting disappearance
artists trying to own the system around them
records, rooms, and the scenes that held them
language, image, and the stories that refused to flatten
```

## Issue archetypes

Issue personality must be editorial, not based on issue number math.

```ts
type IssueArchetype =
  | 'listeningIssue'
  | 'sceneIssue'
  | 'recordReviewIssue'
  | 'fieldGuideIssue'
  | 'memoryIssue'
  | 'systemsIssue'
  | 'imageIssue'
  | 'argumentIssue'
  | 'mixedCultureIssue'
  | 'thinIssue';
```

Each archetype gets its own editor note, cover language, reading path, card blurb, search snippet, SEO description, and UI behavior.

## Archetype notes

### Listening issue

For songs, artists, releases, reviews, playlists, and sound-led stories.

Public posture:

```text
Start with the sound. The rest of the issue opens from there.
```

### Scene issue

For cities, venues, festivals, rooms, routes, and community movement.

Public posture:

```text
This issue has addresses. Rooms, routes, stages, and the people who made them matter.
```

### Memory issue

For books, language, oral culture, old stories, and archival recovery.

Public posture:

```text
This issue is quieter, but not softer. It is about what refuses to disappear.
```

### Systems issue

For platforms, rights, money, ownership, AI, funding, and policy.

Public posture:

```text
Culture is never just the beautiful part. Someone owns the platform. Someone writes the rules.
```

### Field guide issue

For guides, routes, places to go, what to notice, and cultural utility.

Public posture:

```text
Keep this one close. It is built for movement.
```

### Argument issue

For criticism, conflict, form, visualizers, public debate, and cultural friction.

Public posture:

```text
This issue has a raised eyebrow.
```

### Image issue

For photography, fashion, film, visual culture, design, and screen-led stories.

Public posture:

```text
Look first. Then read what the image is doing.
```

## Public surfaces

The engine must not generate one paragraph and paste it everywhere.

Surfaces:

```text
coverLine
editorNote
cardBlurb
archiveBlurb
searchSnippet
seoDescription
contentsIntro
readingPath
signalReading
backMatterLine
featureFrame.publicFieldNote
emptyState
adminQualityNote
```

## Public and admin separation

Never show internal design rationale to readers.

Use:

```ts
featureFrame: {
  publicFieldNote: string;
  adminDesignNote: string;
}
```

Public copy example:

```text
This feature carries the issue's main argument.
```

Admin note example:

```text
Use signal-board layout because archetype is systemsIssue and top stories cluster around rights, ownership, and platforms.
```

## MDX override rule

Markdown and MDX can be used for special editorial moments, but not as the engine.

Allowed:

```text
src/content/magazine/issues/issue-001/editor-note.mdx
src/content/magazine/issues/issue-001/cover-statement.mdx
src/content/magazine/issues/issue-001/back-matter.mdx
```

Rule:

```ts
if (issue.editorialOverrides?.editorNoteMdxPath) {
  use human-authored MDX;
} else {
  use generated editor note;
}
```

Use MDX for special issues, manifesto issues, annual issues, and hand-curated packages.

Do not create a static Markdown file for every generated issue.

## Public copy guard

Banned in public issue copy:

```text
generated
source window
magazine engine
canonical section
score
stale editorial signal
review-flagged
cover variant
field evidence
source range
route treatment
layout treatment
```

Also banned:

```text
em dashes
backend explanations
fake claims
same editor note across unrelated issue types
```

## Migration plan

1. Create `magazineIssueEngine` structure.
2. Keep the current public output contract at first to avoid UI breakage.
3. Derive `IssueFacts` before writing any copy.
4. Score issue archetypes from the article mix.
5. Rewrite editor notes from archetypes, not issue number math.
6. Split public field notes from admin design notes.
7. Add card, archive, search, SEO, and empty-state recipes.
8. Add MDX override support for special issues.
9. Wire magazine archive, issue detail, search, SEO, and admin preview.
10. Deprecate `src/services/magazineNlg.ts` once callers move.
11. Add snapshot tests.

## Acceptance criteria

The engine is done when:

1. No public issue copy says `generated`, `source window`, or `magazine engine`.
2. No public issue copy uses em dashes.
3. Issue 002 onward do not share the same editor-note body.
4. Listening, scene, memory, systems, guide, image, argument, and mixed issues have distinct voices.
5. Issue cards have useful blurbs, not title repeats.
6. Issue search results have useful snippets.
7. Issue SEO descriptions are unique.
8. Feature frames separate public copy from admin design notes.
9. Thin issues produce short, honest copy.
10. MDX overrides work for special issues.
11. Snapshot tests cover at least 8 issue archetypes.
12. The issue feels like a magazine object, not a generated bundle.

## Final principle

The engine decides what the issue is.

The UI performs that identity.

MDX overrides only when a human editor has something sharper to say.
