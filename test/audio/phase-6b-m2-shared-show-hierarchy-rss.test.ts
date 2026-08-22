import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodePublicShow,
  decodePublicShowEpisode,
} from "../../src/services/shows/showPublicModel";
import { renderShowAudioRss } from "../../supabase/functions/audio-public-delivery/rss";

const migration = readFileSync(
  "supabase/migrations/20260822131500_phase_6b_m2_shared_show_hierarchy_rss.sql",
  "utf8",
);
const canonicalMigration = readFileSync(
  "supabase/migrations/20260822131600_phase_6b_m2_audio_canonical_show_paths.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-phase-6b-m2-shared-show-hierarchy-rss.sql",
  "utf8",
);
const m1Verifier = readFileSync(
  "scripts/control-plane/verify-phase-6b-m1-public-audio-read-route.sql",
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
const audioService = readFileSync(
  "src/services/audio/audioPublicService.ts",
  "utf8",
);
const showIdentity = readFileSync(
  "src/services/shows/showIdentity.ts",
  "utf8",
);
const showPage = readFileSync(
  "src/pages/shows/detail/page.tsx",
  "utf8",
);
const episodePage = readFileSync(
  "src/pages/shows/episode/page.tsx",
  "utf8",
);
const listeningSurface = readFileSync(
  "src/components/audio/PublicAudioListeningSurface.tsx",
  "utf8",
);

const audio = {
  publication_id: "11111111-1111-4111-8111-111111111111",
  resource_id: "12111111-1111-4111-8111-111111111111",
  version_id: "22222222-2222-4222-8222-222222222222",
  version_number: 3,
  publication_kind: "episode",
  canonical_path: "/shows/the-show/episode-one",
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

const episodePayload = {
  episode: {
    resource_id: "55555555-5555-4555-8555-555555555555",
    show_resource_id: "33333333-3333-4333-8333-333333333333",
    slug: "episode-one",
    canonical_path: "/shows/the-show/episode-one",
    title: "Episode One & More",
    summary: "A <public> episode.",
    episode_number: 1,
  },
  audio,
};

const showPayload = {
  show: {
    resource_id: "33333333-3333-4333-8333-333333333333",
    slug: "the-show",
    title: "The Show & Friends",
    description: "A <public> Show.",
    canonical_path: "/shows/the-show",
    feed_path: "/shows/the-show/feed.xml",
    episode_count: 1,
  },
  seasons: [audio.season],
  episodes: [episodePayload],
};

describe("Phase 6B M2 shared Show hierarchy and Audio RSS", () => {
  it("creates shared Show and Show Episode identity without pretending Season is shared", () => {
    expect(migration).toContain("'show',");
    expect(migration).toContain("'show_episode',");
    expect(migration).toContain("create table editorial.shows");
    expect(migration).toContain("create table editorial.show_episodes");
    expect(migration).toContain("editorial.audio_show_shared_links");
    expect(migration).toContain("editorial.audio_episode_shared_links");
    expect(migration).not.toContain("create table editorial.show_seasons");
    expect(migration).not.toContain("'show_season',");
    expect(migration).not.toContain("video.shows");
    expect(migration).not.toContain("video.publications");
  });

  it("keeps Show and Episode cultural identity outside the Audio publication authority", () => {
    const show = decodePublicShow(showPayload);
    const episode = decodePublicShowEpisode(episodePayload);

    expect(show?.show.canonicalPath).toBe("/shows/the-show");
    expect(show?.show.feedPath).toBe("/shows/the-show/feed.xml");
    expect(show?.episodes[0]?.episode.canonicalPath).toBe(
      "/shows/the-show/episode-one",
    );
    expect(episode?.episode.canonicalPath).toBe(
      "/shows/the-show/episode-one",
    );
    expect(episode?.audio.publicationKind).toBe("episode");
    expect(episode?.audio.canonicalPath).toBe(
      "/shows/the-show/episode-one",
    );
  });

  it("never repeats Episode type inside an already-scoped Show URL", () => {
    expect(showIdentity).toContain("`/shows/${showSlug}/${episodeSlug}`");
    expect(showIdentity).not.toContain("/episodes/");
    expect(config).toContain('path: "/shows/:showSlug"');
    expect(config).toContain('path: "/shows/:showSlug/:episodeSlug"');
    expect(config).not.toContain("/shows/:showSlug/episodes/");
    expect(config).not.toContain("/audio/shows/");
    expect(migration).not.toContain("/audio/shows/");
    expect(canonicalMigration).not.toContain("/audio/shows/");
    expect(canonicalMigration).not.toContain("/episodes/");
    expect(verifier).toContain("Rejected Audio-bucket or redundant Episode URL grammar returned.");
  });

  it("makes the plain Audio browser route and public RPC canonical identity Standalone-aware", () => {
    expect(config.match(/path: "\/audio\/:slug"/g)).toHaveLength(1);
    expect(audioService).toContain("getPublicStandaloneAudio");
    expect(audioService).toContain('publication.publicationKind !== "standalone"');
    expect(audioService).toContain('`/audio/${publication.slug}`');
    expect(audioService).not.toContain("get_public_show_episode");

    expect(canonicalMigration).toContain(
      "alter function public.get_public_audio_publication(text)",
    );
    expect(canonicalMigration).toContain("rename to get_public_audio_publication_m1");
    expect(canonicalMigration).toContain("public.get_public_audio_publication_m1(p_slug)");
    expect(canonicalMigration).toContain("v_publication_kind = 'standalone'");
    expect(canonicalMigration).toContain("v_publication_kind <> 'episode'");
    expect(canonicalMigration).toContain("'/audio/' || (v_payload ->> 'slug')");
    expect(canonicalMigration).toContain(
      "'/shows/' || v_show.slug || '/' || v_episode.slug",
    );
    expect(canonicalMigration).toContain("editorial.audio_episode_shared_links");
    expect(m1Verifier).toContain("public.get_public_audio_publication_m1(text)");
    expect(m1Verifier).toContain("M2 internal Audio safety core leaked direct API execution.");
  });

  it("reuses exact M1 Audio safety for Show Episode and enclosure delivery", () => {
    expect(migration).toContain("public.get_public_audio_publication(");
    expect(migration).toContain("public.get_public_show_episode(");
    expect(migration).toContain("'audio', v_audio");
    expect(migration).toContain("public.get_public_audio_enclosure(");
    expect(verifier).toContain("Private Audio schema usage leaked to API roles.");
    expect(verifier).toContain("public.get_public_audio_publication");
    expect(canonicalMigration).toContain("get_public_audio_publication_m1");
    expect(canonicalMigration).not.toContain("audio.assert_publishable_version_media");
  });

  it("renders deterministic RSS from shared Episode links and stable Audio enclosure identity", () => {
    const xml = renderShowAudioRss(showPayload);

    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("<title>The Show &amp; Friends</title>");
    expect(xml).toContain(
      "<link>https://wakilisha.africa/shows/the-show/episode-one</link>",
    );
    expect(xml).toContain(
      "<guid isPermaLink=\"false\">urn:uuid:11111111-1111-4111-8111-111111111111</guid>",
    );
    expect(xml).toContain(
      "enclosure url=\"https://wakilisha.africa/audio/enclosures/11111111-1111-4111-8111-111111111111.mp3\"",
    );
    expect(xml).not.toContain("/episodes/");
    expect(xml).not.toContain("/audio/shows/");
    expect(xml).not.toContain(
      "https://media.wakilisha.africa/derivatives/audio/episode-one.mp3\" length=",
    );
    expect(xml).toContain("<itunes:duration>1:05</itunes:duration>");
    expect(xml).toContain("<itunes:season>1</itunes:season>");
    expect(xml).toContain("<itunes:episode>1</itunes:episode>");
  });

  it("keeps transport anonymous and authority-free", () => {
    expect(edge).toContain("SUPABASE_ANON_KEY");
    expect(edge).not.toContain("SERVICE_ROLE");
    expect(edge).toContain('"get_public_show"');
    expect(edge).toContain('"get_public_audio_enclosure"');
    expect(edge).toContain("function etagMatches");
    expect(edge).toContain('candidate.replace(/^W\\//i, "") === expected');
    expect(edge).toContain('etagMatches(request.headers.get("if-none-match"), etag)');
    expect(edge).toContain("307");
    expect(nginx).toContain("/audio/enclosures/");
    expect(nginx).toContain("^/shows/");
    expect(nginx).toContain("feed\\.xml");
    expect(nginx).not.toContain("/audio/shows/");
  });

  it("keeps Show playback in the existing global Player and Audio rendition adapter", () => {
    expect(lazyPublic).toContain('import("../pages/shows/detail/page")');
    expect(lazyPublic).toContain('import("../pages/shows/episode/page")');
    expect(showPage).toContain("usePlayer");
    expect(showPage).toContain("publicAudioPlayerItem(item.audio)");
    expect(showPage).toContain("playTrack(playerItem, playerItems");
    expect(episodePage).toContain("PublicAudioListeningSurface");
    expect(listeningSurface).toContain("usePlayer");
    expect(listeningSurface).not.toContain("<audio");
    expect(listeningSurface).not.toContain("MediaTransport");
    expect(listeningSurface).not.toContain("MediaTimeline");
  });

  it("keeps permanent verifiers read-only", () => {
    for (const source of [verifier, m1Verifier]) {
      const lower = source.toLowerCase();
      for (const forbidden of [
        "insert into ",
        "update ",
        "delete from ",
        "create table ",
        "alter table ",
        "drop table ",
        "create or replace function ",
      ]) {
        expect(lower).not.toContain(forbidden);
      }
    }
    expect(verifier).toContain("PASS: Phase 6B M2");
    expect(m1Verifier).toContain("PASS: Phase 6B M1 public Audio");
  });
});
