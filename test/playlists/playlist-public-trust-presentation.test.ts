import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

import {
  decodePublicPlaylist,
} from "@/services/playlists/playlistPublicModel";

const component =
  readFileSync(
    "src/components/design-system/trust/PublicTrustSummary.tsx",
    "utf8",
  );

const page =
  readFileSync(
    "src/pages/playlists/detail/page.tsx",
    "utf8",
  );

const decoded =
  decodePublicPlaylist({
    playlist_id:
      "playlist-1",
    resource_id:
      "playlist-resource-1",
    version_id:
      "version-4",
    version_number:
      4,
    slug:
      "trust-test",
    title:
      "Trust Test",
    description:
      "Test description",
    curator_label:
      "WAKILISHA",
    cover:
      null,
    item_count:
      1,
    tracks: [
      {
        playlist_item_resource_id:
          "placement-resource-5",
        playlist_item_id:
          "placement-5",
        position:
          5,
        title:
          "Test Track",
        artist_names: [
          "Test Artist",
        ],
        artists:
          [],
        release_title:
          null,
        artwork_url:
          null,
        duration_ms:
          null,
        notes:
          "Test note",
        match_status:
          "matched",
        registry:
          null,
        playback: {
          playable:
            false,
          engine:
            "unavailable",
          provider_key:
            null,
          provider_object_id:
            null,
          provider_url:
            null,
          embed_url:
            null,
          preview_url:
            null,
          fallback_preview_url:
            null,
          apple_music_catalog_id:
            null,
        },
      },
    ],
    provenance: {
      version_number:
        4,
      content_fingerprint:
        "fingerprint",
      source_authority_revision:
        12,
      published_at:
        "2026-08-09T15:30:00Z",
      first_published_at:
        "2026-08-01T10:00:00Z",
      published_by:
        "publisher-1",
      command_receipt_id:
        "receipt-1",
    },
    credits: [
      {
        resource_id:
          "playlist-resource-1",
        resource_kind:
          "playlist",
        display_order:
          1,
        is_primary:
          true,
        credit_id:
          "credit-1",
        role:
          "curator",
        role_label:
          "Curator",
        display_name:
          "Test Curator",
        note:
          "Curated the Playlist.",
        author_slug:
          "test-curator",
        username:
          null,
      },
    ],
    citations: [
      {
        resource_id:
          "placement-resource-5",
        resource_kind:
          "playlist_item",
        display_order:
          1,
        purpose:
          "supports",
        anchor_type:
          "whole_item",
        anchor: {},
        citation_id:
          "citation-1",
        public_label:
          "Artist interview",
        locator_type:
          "page",
        locator: {
          page:
            12,
        },
        source: {
          source_id:
            "source-1",
          source_version_id:
            "source-version-1",
          type:
            "interview",
          title:
            "Interview with Test Artist",
          creator:
            "WAKILISHA",
          publisher:
            null,
          url:
            "https://example.com/source",
          publication_date:
            "2026-07-20",
          credit_line:
            "Courtesy of Test Artist",
        },
      },
    ],
    corrections: [
      {
        id:
          "correction-1",
        resource_id:
          "placement-resource-5",
        resource_kind:
          "playlist_item",
        note:
          "Corrected the track credit.",
        published_at:
          "2026-08-08T12:00:00Z",
      },
    ],
  });

describe(
  "Phase 5B public Playlist Trust presentation",
  () => {
    it(
      "decodes immutable publication provenance",
      () => {
        expect(
          decoded?.provenance
            .versionNumber,
        )
          .toBe(
            4,
          );

        expect(
          decoded?.provenance
            .firstPublishedAt,
        )
          .toBe(
            "2026-08-01T10:00:00Z",
          );

        expect(
          decoded?.provenance
            .publishedAt,
        )
          .toBe(
            "2026-08-09T15:30:00Z",
          );
      },
    );

    it(
      "decodes governed public Credits",
      () => {
        expect(
          decoded?.credits,
        )
          .toHaveLength(
            1,
          );

        expect(
          decoded?.credits[0]
            ?.displayName,
        )
          .toBe(
            "Test Curator",
          );

        expect(
          decoded?.credits[0]
            ?.authorSlug,
        )
          .toBe(
            "test-curator",
          );
      },
    );

    it(
      "decodes governed Citations with nested Source identity",
      () => {
        expect(
          decoded?.citations,
        )
          .toHaveLength(
            1,
          );

        expect(
          decoded?.citations[0]
            ?.source.title,
        )
          .toBe(
            "Interview with Test Artist",
          );

        expect(
          decoded?.citations[0]
            ?.locator.page,
        )
          .toBe(
            12,
          );
      },
    );

    it(
      "decodes public Correction notes",
      () => {
        expect(
          decoded?.corrections,
        )
          .toHaveLength(
            1,
          );

        expect(
          decoded?.corrections[0]
            ?.note,
        )
          .toBe(
            "Corrected the track credit.",
          );
      },
    );

    it(
      "uses meaningful publication language rather than a generic update claim",
      () => {
        expect(component)
          .toContain(
            "Published",
          );

        expect(component)
          .toContain(
            "Current edition",
          );

        expect(component)
          .not.toContain(
            ">Updated<",
          );
      },
    );

    it(
      "keeps Sources compact behind an explicit disclosure",
      () => {
        expect(component)
          .toContain(
            "<details",
          );

        expect(component)
          .toContain(
            "Sources",
          );

        expect(component)
          .toContain(
            "source.locatorLabel",
          );
      },
    );

    it(
      "keeps mobile Source locators compact and dates human-readable",
      () => {
        expect(component)
          .toContain(
            "w-fit self-start shrink-0",
          );

        expect(component)
          .toContain(
            "formatPublicDate(\n                                                      source.publicationDate",
          );
      },
    );

    it(
      "keeps public Corrections immediately visible",
      () => {
        expect(component)
          .toContain(
            "Corrections",
          );

        expect(component)
          .toContain(
            "correction.note",
          );
      },
    );

    it(
      "maps Playlist Trust through stable Resource identities and canonical people routes",
      () => {
        expect(page)
          .toContain(
            "playlistItemResourceId ===",
          );

        expect(page)
          .toContain(
            "`/authors/${credit.authorSlug}`",
          );

        expect(page)
          .toContain(
            "`/u/${credit.username}`",
          );
      },
    );

    it(
      "renders shared public Trust before whole-Playlist Community",
      () => {
        const trustIndex =
          page.indexOf(
            "<PublicTrustSummary",
          );

        const communityIndex =
          page.indexOf(
            "<CommunitySection",
          );

        expect(
          trustIndex,
        )
          .toBeGreaterThan(
            -1,
          );

        expect(
          trustIndex,
        )
          .toBeLessThan(
            communityIndex,
          );
      },
    );
  },
);
