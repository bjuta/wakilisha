import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodePublicAudioShow } from "../../src/services/audio/audioShowPublicModel";
import { renderAudioShowRss } from "../../supabase/functions/audio-public-delivery/rss";

const migration = readFileSync(
  "supabase/migrations/20260822125000_phase_6b_m2_show_episode_rss.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6b-m2-show-episode-rss.sql",
  "utf8",
);
const edge = readFileSync(
  "supabase/functions/audio-public-delivery/index.ts",
  "utf8",
);
const nginx = readFileSync(
  "ops/nginx/audio-public-delivery.conf.template",
  "utf8",
);
const config = readFileSync("src/router/config.tsx", "utf8");
const lazyPublic = readFileSync("src/router/lazyPublic.tsx", "utf8");
const showPage = readFileSync("src/pages/audio/show/page.tsx", "utf8");

const episode = {
  publication_id: "11111111-1111-4111-8111-111111111111",
  resource_id: "11111111-1111-4111-8111-111111111111",
  version_id: "22222222-2222-4222-8222-222222222222",
  version_number: 3,
  publication_kind: "episode",
  canonical_path: "/audio/episode-one",
  slug: "episode-one",
  title: "Episode One & More",
  summary: "A <public> episode.",
  episode_number: 1,
  show: {
    id: "33333333-3333-4333-8333-333333333333",
    resource_id: "33333333-3333-4333-8333-333333333333",
    slug: "the-show",
    title: "The Show",
    description: "A Show",
  },
  season: {
    id: "44444444-4444-4444-8444-444444444444",
    resource_id: "44444444-4444-4444-8444-444444444444",
    season_number: 1,
    title: "Season One",
    description: null,
  },
  delivery: {
    url: "https://media.wakilisha.africa/derivatives/audio/episode-one.mp3",
    mime_type: "audio/mpeg",
    byte_size: 1024,
    sha256: "a".repeat(64),
    duration_seconds: 65,
    waveform_url: null,
  },
  transcript: null,
  chapters: [],
  feed: {
    guid: "urn:uuid:11111111-1111-4111-8111-111111111111",
    enclosure_url: "https://wakilisha.africa/audio/enclosures/11111111-1111-4111-8111-111111111111.mp3",
  },
  provenance: {
    version_number: 3,
    first_published_at: "2026-08-22T10:00:00Z",
    published_at: "2026-08-22T10:00:00Z",
  },
  credits: [],
  citations: [],
};

const showPayload = {
  show: {
    id: "33333333-3333-4333-8333-333333333333",
    resource_id: "33333333-3333-4333-8333-333333333333",
    slug: "the-show",
    title: "The Show & Friends",
    description: "A <public> Show.",
    canonical_path: "/audio/shows/the-show",
    feed_path: "/audio/shows/the-show/feed.xml",
    episode_count: 1,
  },
  seasons: [episode.season],
  episodes: [episode],
};

describe("Phase 6B M2 Show, Episode, and RSS contract", () => {
  it("keeps Episode identity canonical at the existing public Audio route", () => {
    const decoded = decodePublicAudioShow(showPayload);
    expect(decoded).not.toBeNull();
    expect(decoded?.show.canonicalPath).toBe("/audio/shows/the-show");
    expect(decoded?.show.feedPath).toBe("/audio/shows/the-show/feed.xml");
    expect(decoded?.episodes[0]?.canonicalPath).toBe("/audio/episode-one");
    expect(decoded?.episodes[0]?.canonicalPath).not.toContain("/shows/");
  });

  it("renders deterministic RSS from the stable GUID and enclosure identity", () => {
    const xml = renderAudioShowRss(showPayload);

    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("<title>The Show &amp; Friends</title>");
    expect(xml).toContain("A &lt;public&gt; Show.");
    expect(xml).toContain(
      "<guid isPermaLink=\"false\">urn:uuid:11111111-1111-4111-8111-111111111111</guid>",
    );
    expect(xml).toContain(
      "enclosure url=\"https://wakilisha.africa/audio/enclosures/11111111-1111-4111-8111-111111111111.mp3\"",
    );
    expect(xml).not.toContain(
      "https://media.wakilisha.africa/derivatives/audio/episode-one.mp3\" length=",
    );
    expect(xml).toContain("<itunes:duration>1:05</itunes:duration>");
    expect(xml).toContain("<itunes:season>1</itunes:season>");
    expect(xml).toContain("<itunes:episode>1</itunes:episode>");
  });

  it("promotes only typed active Show and Season containers when an Episode publishes", () => {
    expect(migration).toContain(
      "audio.ensure_published_episode_parent_visibility",
    );
    expect(migration).toContain(
      "new.publication_kind <> 'episode'",
    );
    expect(migration).toContain(
      "new.status <> 'published'",
    );
    expect(migration).toContain(
      "resource_row.lifecycle_state = 'active'",
    );
    expect(migration).toContain("visibility = 'public'");
    expect(migration).not.toContain("lifecycle_state = 'published',\n    visibility = 'public'");
  });

  it("reuses the exact M1 resolver for Show episodes and enclosure delivery", () => {
    const uses = migration.match(/public\.get_public_audio_publication/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("publication.publication_kind = 'episode'");
    expect(migration).toContain("binding.current_published_version_id is not null");
    expect(migration).not.toContain("'metadata', v_show.metadata");
    expect(verifier).toContain("private Audio schema usage leaked");
  });

  it("keeps the Edge transport anonymous and authority-free", () => {
    expect(edge).toContain("SUPABASE_ANON_KEY");
    expect(edge).not.toContain("SERVICE_ROLE");
    expect(edge).toContain('"get_public_audio_show"');
    expect(edge).toContain('"get_public_audio_enclosure"');
    expect(edge).toContain("307");
    expect(edge).toContain("https://media.wakilisha.africa/derivatives/");
  });

  it("owns the branded RSS and enclosure routes in the Nginx contract", () => {
    expect(nginx).toContain("/audio/enclosures/");
    expect(nginx).toContain("/audio/shows/");
    expect(nginx).toContain("feed\\.xml");
    expect(nginx).toContain("audio-public-delivery?kind=enclosure");
    expect(nginx).toContain("audio-public-delivery?kind=rss");
  });

  it("adds one lazy Show route without creating a second Episode route", () => {
    expect(lazyPublic).toContain(
      'import("../pages/audio/show/page")',
    );
    expect(config).toContain('path: "/audio/shows/:showSlug"');
    expect(config.match(/path: "\/audio\/:slug"/g)).toHaveLength(1);
    expect(config).not.toContain("/audio/shows/:showSlug/:episodeSlug");
  });

  it("keeps Show playback in the existing global player", () => {
    expect(showPage).toContain("usePlayer");
    expect(showPage).toContain("publicAudioPlayerItem");
    expect(showPage).toContain("playTrack(item, playerItems");
    expect(showPage).not.toContain("<audio");
    expect(showPage).not.toContain("MediaTransport");
    expect(showPage).not.toContain("MediaTimeline");
  });
});
