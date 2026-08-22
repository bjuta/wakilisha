# Phase 6B M2: Show, Episode, and RSS Foundation

## Milestone outcome

Phase 6B M2 turns the M1 public Audio publication contract into a podcast-shaped public product without creating a second Audio authority.

This milestone adds:

- one public Show route at `/audio/shows/:showSlug`;
- the existing `/audio/:slug` route as the only canonical Episode route;
- one public Show RPC that returns only currently public-safe published Episodes;
- one stable public enclosure RPC over the immutable Phase 6A feed identity;
- one public `audio-public-delivery` Edge transport adapter for RSS XML and enclosure redirects;
- one governed Nginx include contract for branded WAKILISHA RSS and enclosure URLs;
- one publication invariant that makes the parent Show and optional Season publicly addressable when an Episode publishes.

It does not add scheduling, public Audio search, Corrections UX, a second uploader, a second transcript system, a second Trust model, or a second player.

## Authority audit

### Existing authority reused

Phase 6A already owns:

- `audio.shows` and `audio.seasons` container identity;
- `audio.publications` Episode and Standalone identity;
- globally unique Audio publication slugs;
- exact immutable Audio publication versions;
- Review and publish lifecycle;
- immutable `audio.publication_feed_identities`;
- stable GUID `urn:uuid:<publication-id>`;
- stable enclosure URL `https://wakilisha.africa/audio/enclosures/<publication-id>.mp3`;
- immutable publication snapshots bound to exact Media delivery bytes.

Phase 6B M1 already owns:

- `public.get_public_audio_publication(text)`;
- exact current published-version projection;
- current Media public-safety revalidation;
- version-bound Chapters and Transcript;
- public-safe Credits and Citations;
- canonical Episode/Standalone route `/audio/:slug`;
- persistent global WAKILISHA Player integration.

M2 reuses all of those contracts.

## Publication authority gap found by M2

Normal Admin Audio creation makes Shows, Seasons, and Episodes `internal` Resources.

`publish_audio_publication_version(...)` promotes the exact published Episode Resource to `published/public`, but it does not promote the parent Show or Season visibility. M1 therefore correctly suppresses Show/Season context for a normally-created published Episode.

This is an authority gap, not a frontend bug.

M2 adds the database invariant `audio.ensure_published_episode_parent_visibility()` on successful Episode publication:

- the typed parent Show Resource must exist and remain `active`;
- the Show visibility becomes `public`;
- the optional typed Season must belong to the same Show and remain `active`;
- the Season visibility becomes `public`;
- Show and Season do not gain a second Review or publication lifecycle.

Container visibility is therefore derived from a legitimately published child Episode.

## Canonical URL contract

Episode publication slugs are globally unique in `audio.publications`.

M2 therefore does not introduce `/audio/shows/:showSlug/:episodeSlug` or another Episode identity.

Canonical public paths are:

- Show: `/audio/shows/:showSlug`
- Episode or Standalone Audio: `/audio/:slug`
- RSS: `/audio/shows/:showSlug/feed.xml`
- stable enclosure: `/audio/enclosures/:publicationId.mp3`

The Show page links to the canonical Episode route.

## Public Show read contract

`public.get_public_audio_show(text)` is `STABLE SECURITY DEFINER`, callable by `anon` and `authenticated`, with no direct Audio schema grants.

A Show resolves only when:

- its typed Resource is `active/public`;
- at least one current published Episode belongs to the Show;
- each Episode independently resolves through `public.get_public_audio_publication(...)`.

The Show resolver does not rebuild Media, Trust, Review, Transcript, or feed-snapshot logic. If M1 makes an Episode unavailable because current Media safety changes, M2 also omits it.

The Show projection returns:

- public Show header and canonical/feed paths;
- only public Seasons referenced by currently resolvable Episodes;
- full M1 Episode public projections in deterministic published order.

Raw Show metadata and moving Review pointers are not public.

## Stable enclosure contract

`public.get_public_audio_enclosure(uuid)` resolves the current public-safe source behind the immutable Phase 6A enclosure identity.

It calls the M1 publication resolver rather than reading private feed/snapshot tables directly.

The public transport adapter returns an HTTP redirect from the stable branded enclosure URL to the exact WAKILISHA Media derivative currently represented by the public publication projection.

Audio bytes remain in canonical Media storage. M2 does not copy MP3 files into the frontend or create a second storage system.

## RSS transport

`supabase/functions/audio-public-delivery` is a transport adapter, not an authority service.

It uses `SUPABASE_ANON_KEY`, never the service-role key.

Supported transport operations:

- `kind=rss&show=<slug>` renders RSS 2.0 from `get_public_audio_show`;
- `kind=enclosure&id=<publication-id>` resolves `get_public_audio_enclosure` and returns a stable redirect.

RSS item identity uses:

- the canonical `/audio/:slug` Episode link;
- immutable GUID from Phase 6A;
- immutable branded enclosure URL from Phase 6A;
- exact enclosure byte size and MIME type from the M1 public projection;
- publication snapshot time for deterministic ordering and feed dates.

The renderer XML-escapes public text and emits deterministic output for the same public projection.

## Branded delivery routes

`ops/nginx/audio-public-delivery.conf.template` is the reviewed server routing contract.

At production deployment it is rendered with the exact Supabase project ref and included in the existing WAKILISHA HTTPS server block so:

- `/audio/shows/:showSlug/feed.xml` proxies to the public RSS transport;
- `/audio/enclosures/:publicationId.mp3` proxies to the public enclosure transport.

The Edge Function remains publicly callable without JWT, but it still reads Audio only through anonymous RPC grants.

## Player and primitive impact

M2 does not promote `editorial.media-transport` or `editorial.media-timeline`. Those remain Admin Audio editorial candidates.

The reusable residue inside the public Audio domain is `src/services/audio/audioPlayerAdapter.ts`, which maps the canonical public Audio projection to the existing `PlayerMediaItem` contract. It is not registered as a cross-domain primitive.

The Show page and Episode page both use the existing persistent Player. No second `<audio>` engine is introduced.

## Preview acceptance required before PR

A disposable preview must prove the whole migration baseline first, then M2 must prove with governed fixtures that:

1. an internal Show and optional Season remain non-public before an Episode is published;
2. a draft/submitted/approved Episode never appears in the Show projection;
3. publishing the exact approved Episode promotes only the typed parent container visibility;
4. `get_public_audio_show` returns the exact published Episode and canonical `/audio/:slug` path;
5. RSS uses the immutable GUID and branded enclosure URL;
6. the stable enclosure RPC resolves the exact immutable Media source;
7. Media public-safety revocation removes the Episode from Show/RSS/enclosure delivery;
8. restoring Media safety restores the same canonical Episode/GUID/enclosure identity;
9. the Edge Function succeeds using anon authority on preview;
10. fixture rollback leaves zero residue.

The permanent verifier must pass independently after candidate application.

## Explicitly deferred

- Audio scheduling and embargo UI;
- public Corrections interaction and transcript correction product;
- public Audio directory/search;
- whole-site Audio SEO/prerender indexing;
- podcast platform submission metadata beyond a valid WAKILISHA RSS foundation;
- Phase 9 incremental indexing/cache architecture.
