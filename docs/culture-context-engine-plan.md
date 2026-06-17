# Culture Context Engine Plan

## Decision

The feature is now called the **Culture Context Engine**.

It replaces the old public-facing idea behind `src/services/registryNlg.ts`. The job is not to describe registry rows. The job is to explain why a song, artist, release, label, genre, chart, place, or story is worth paying attention to.

Core user promise:

```text
WAKILISHA puts users on.
```

The engine turns structured WAKILISHA facts into short, useful, human context across public product surfaces.

## Voice

WAKILISHA copy should be fun, conversational, simple, warm, and culturally sharp.

Rules for public generated copy:

1. No em dashes.
2. No backend language.
3. No fake stats, fake bios, or fake streams.
4. No raw country codes on public pages.
5. No empty date output like `released in .`.
6. Say less when the data is thin.
7. Lead with why the thing matters, not what table it came from.

Core line:

```text
Your people are here.
```

## Banned public words and phrases

These should not appear in public Culture Context Engine output:

```text
registry
metadata
canonical
endpoint
cache
source provider
classified
catalogued
deterministic
relationship graph
data drawn from
recorded in the registry
chart appearances recorded
active period
label history
genres represented
key artists:
tagged:
```

Admin notes may use technical language only when the surface is explicitly internal.

## Architecture

Create the engine under:

```text
src/services/cultureContext/
```

Planned structure:

```text
src/services/cultureContext/
  index.ts
  types.ts
  normalize.ts
  facts.ts
  scoring.ts
  recipes/
    track.ts
    artist.ts
    release.ts
    label.ts
    genre.ts
    chart.ts
    search.ts
    seo.ts
    admin.ts
  guards.ts
  formatters.ts
  testFixtures.ts
```

The old `src/services/registryNlg.ts` should stay temporarily for compatibility, then be removed or converted into a thin deprecated wrapper after call sites move.

## Main API

```ts
buildCultureContext(input)
```

Input:

```ts
type CultureContextInput = {
  entityType:
    | "track"
    | "artist"
    | "release"
    | "label"
    | "genre"
    | "chart"
    | "searchResult";
  surface:
    | "heroIntro"
    | "cardBlurb"
    | "searchSnippet"
    | "seoDescription"
    | "chartNote"
    | "whyItMatters"
    | "startHere"
    | "adminQualityNote";
  data: unknown;
  options?: {
    tone?: "public" | "admin";
    maxLength?: "short" | "medium" | "long";
    includeStats?: boolean;
  };
};
```

Output:

```ts
type CultureContextOutput = {
  text: string;
  confidence: "high" | "medium" | "low";
  factsUsed: string[];
  warnings: string[];
  recipe: string;
  version: string;
};
```

## Release types

The engine must support albums, EPs, singles, mixtapes, compilations, soundtracks, live releases, deluxe editions, and unknown releases.

Albums, EPs, singles, and compilations must not share the same copy style.

### Album direction

Albums need body and world.

Example:

```text
Album Title is a 12-track album by Artist, released in 2024. Start here for the songs, chart moments, and release context around this era.
```

### EP direction

EPs need focus.

Example:

```text
EP Title is a focused 5-track project by Artist. Short, direct, and a good place to hear where the sound is heading.
```

### Single direction

Singles need movement.

Example:

```text
Single Title is a single by Artist, with release and chart context connected in WAKILISHA. One song, one moment, and a trail you can follow.
```

### Compilation direction

Compilations need many voices.

Example:

```text
Compilation Title brings multiple artists into one release, with tracks and connections gathered in WAKILISHA.
```

## Story selection

The engine should choose one lead angle instead of dumping all available facts.

For releases, choose in this order:

1. Strong chart context.
2. Strong standout track context.
3. Strong album or EP track count context.
4. Strong genre context.
5. Strong label context.
6. Thin release fallback.

For tracks, choose in this order:

1. Chart story.
2. Album or release placement.
3. Collaboration story.
4. Genre or country context.
5. Thin track fallback.

For artists, choose in this order:

1. Chart actor.
2. Catalog builder.
3. Collaborator.
4. Scene voice.
5. Thin artist fallback.

## Surfaces

The engine must generate different outputs by surface.

Core surfaces:

1. `heroIntro`
2. `cardBlurb`
3. `searchSnippet`
4. `seoDescription`
5. `chartNote`
6. `whyItMatters`
7. `startHere`
8. `adminQualityNote`

Do not reuse one generic paragraph everywhere.

## Where to use it

Use immediately:

1. Track detail hero.
2. Artist detail hero.
3. Release detail hero.
4. Release cards.
5. Track cards.
6. Artist cards.
7. Search snippets.
8. SEO descriptions.
9. Empty states.

Use next:

1. Chart weekly recaps.
2. Chart movement notes.
3. Genre page intros.
4. Label page intros.
5. Homepage `new in WAKILISHA` module.
6. Related discovery paths.

Use later:

1. Newsletters.
2. Social share text.
3. `Put me on` discovery mode.
4. Admin data quality notes.
5. Cultural trails.
6. Auto-generated guide starters.

## Caching plan

Generated context should be cached by:

```text
entityType
entityId
surface
recipeVersion
factsHash
```

Regenerate when entity facts, relationships, chart context, recipe version, or tone guard rules change.

## Step plan

### Step 1

Create `src/services/cultureContext/` with types, normalizers, formatters, tone guards, scoring helpers, and starter recipes. Keep `registryNlg.ts` untouched for compatibility.

### Step 2

Port track, artist, release, and label summaries into the new recipe structure, rewriting the copy fully.

### Step 3

Add release-type recipes for albums, EPs, singles, compilations, mixtapes, soundtracks, live releases, deluxe editions, and unknown releases.

### Step 4

Wire release detail pages and release cards first.

### Step 5

Wire track and artist detail pages.

### Step 6

Wire search snippets and SEO descriptions.

### Step 7

Add chart recaps, movement notes, genre intros, label intros, and homepage modules.

### Step 8

Remove or deprecate `registryNlg.ts` after all callers move.

## Acceptance criteria

The work is accepted when:

1. No public generated copy says `registry`.
2. No public generated copy uses em dashes.
3. Albums, EPs, singles, and compilations produce different context.
4. Multi-artist tracks show the correct artist names.
5. Missing dates do not create broken sentences.
6. Raw country codes are normalized.
7. Thin data produces short, honest copy.
8. Search results have useful snippets.
9. Release cards feel human.
10. Tests cover the main entity types and the tone guard.
11. Public copy sounds like WAKILISHA, not a database.
