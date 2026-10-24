# Article media captions: bound ownership (24 October 2026)

## Why this was needed

The Charisma article's saved draft contains one image with `data-caption`, followed immediately by a plain `<p>` repeating the exact caption. The editor rendered that duplicate paragraph as editable body text. Public typography inherited the Article prose scale and the image and caption appeared disconnected. This was confirmed read-only against the saved `wk_articles.content_html` document; the database has not been modified by this slice.

## Canonical contract

- A selected image exposes an Article-local **Caption** action using Image Details. It changes the document node and leaves the shared Media Library asset untouched. The older **Edit** action remains available for Media Library metadata.
- Captions belong to the media element. The authored image node persists `data-caption` and serializes a single semantic `figure > img + figcaption`. The figcaption is noneditable as body text; writers use Image Details to change the caption.
- Normalization has two explicit paths. The **editor** receives an image atom with `data-caption`; the **reader** receives a semantic figure. Neither path writes to the database merely by opening a draft.
- Only a plain, immediately adjacent paragraph whose **entire content exactly equals** the caption is removed as a known import duplicate. Unrelated paragraphs, partial matches, and prose further away are preserved.
- Authored inline caption values outrank Media Library defaults. Running public injection twice must remain idempotent.
- Provider video embeds that already carry explicit `data-caption` or `figcaption` are rendered as one video card + attached figcaption. Captions are not player subtitles or VTT cue data. Ordinary nearby paragraphs are never guessed to be captions.
- Desktop and mobile Article surfaces share the same media CSS and renderer. Captions are small, left aligned, muted, and connected to the visual rather than inheriting running prose.

## Review and exit gates

Read-only source inspection and functional jsdom/TipTap tests are required before merging. Exact-head Critical Core, Critical Browser and aggregate CI must pass. Verify both themes and mobile/desktop Article/Editor captures, image edit and save/reopen, video caption grouping, no duplicate adjacent caption, and that original prose survives. Avoid global CSS workarounds, bulk SQL rewrites and editor code forks.

Scope boundary: video playback subtitle tracks and the governed Video Studio caption editor are separate systems and must remain unchanged. Legacy plain captions with no media metadata or explicit figure relationship cannot be safely reclassified automatically. Only correctly bound captions are normalized.
