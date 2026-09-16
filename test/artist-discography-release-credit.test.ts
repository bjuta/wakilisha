import {
  describe,
  expect,
  it,
} from "vitest";

import {
  albumArtistCreditIncludesArtist,
  resolveReleaseArtistCredit,
} from "../supabase/functions/ingest-artist-discography/releaseArtistCredit.ts";
import {
  freezeReviewedDiscographyPlan,
  type DiscographyProviderObservation,
} from "../supabase/functions/ingest-artist-discography/governedPlan.ts";

const CURRENT_ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ARTIST_ID = "22222222-2222-4222-8222-222222222222";

function providerObservation(): DiscographyProviderObservation {
  return {
    provider: "apple_music",
    storefront: "ke",
    acquired_at: "2026-09-16T05:00:00.000Z",
    artist: {
      id: CURRENT_ARTIST_ID,
      slug: "matata",
      display_name: "Matata",
    },
    albums: [
      {
        apple_music_id: "apple-album-1",
        title: "Test Album",
        album_artist_name: "Matata",
        release_type: "album",
        release_date: "2026-01-01",
        upc: "123456789012",
        record_label: "Test Label",
        genre_names: ["Afropop"],
        artwork_url: "https://example.test/artwork.jpg",
        apple_music_url: "https://music.apple.com/album/apple-album-1",
        related_artists: [],
        tracks: [
          {
            apple_music_id: "apple-track-1",
            title: "Test Track",
            artist_name: "Matata",
            duration_ms: 180000,
            track_number: 1,
            disc_number: 1,
            isrc: "KEXXX2600001",
            artwork_url: "https://example.test/track.jpg",
            explicit: false,
            preview_url: null,
            genre_names: ["Afropop"],
          },
        ],
      },
    ],
    failed_album_ids: [],
  };
}

describe("artist discography release credits", () => {
  it("matches the current Artist by exact multi-Artist credit token", () => {
    expect(
      albumArtistCreditIncludesArtist(
        "Matata & DJames",
        "Matata",
      ),
    ).toBe(true);

    expect(
      albumArtistCreditIncludesArtist(
        "Matata & DJames",
        "DJames",
      ),
    ).toBe(true);
  });

  it("does not use substring matching for the current Artist", () => {
    expect(
      albumArtistCreditIncludesArtist(
        "The Matata Band",
        "Matata",
      ),
    ).toBe(false);
  });

  it("keeps the ingested current Artist primary when Apple credits them", () => {
    expect(
      resolveReleaseArtistCredit(
        "current_artist",
        true,
      ),
    ).toEqual({
      role: "primary_artist",
      is_primary: true,
      is_featured: false,
    });
  });

  it("keeps an ingested current Artist featured when Apple does not credit them as primary", () => {
    expect(
      resolveReleaseArtistCredit(
        "current_artist",
        false,
      ),
    ).toEqual({
      role: "featured_artist",
      is_primary: false,
      is_featured: true,
    });
  });

  it("keeps discovered Apple relationship Artists featured by default", () => {
    expect(
      resolveReleaseArtistCredit(
        "discovered_album_artist",
      ),
    ).toEqual({
      role: "featured_artist",
      is_primary: false,
      is_featured: true,
    });
  });

  it("preserves explicit admin-selected co-primary Artists", () => {
    expect(
      resolveReleaseArtistCredit(
        "explicit_additional_primary",
      ),
    ).toEqual({
      role: "primary_artist",
      is_primary: true,
      is_featured: false,
    });
  });
});

describe("reviewed discography plan freezing", () => {
  it("binds the exact Artist and immutable provider album snapshot", () => {
    const observation = providerObservation();
    const plan = freezeReviewedDiscographyPlan({
      exact_artist_id: CURRENT_ARTIST_ID,
      provider_source_payload_fingerprint: "a".repeat(64),
      observation,
      selections: [
        {
          apple_music_id: "apple-album-1",
          action: "canonicalize",
          additional_primary_artists: [
            {
              artist_id: OTHER_ARTIST_ID,
              artist_slug: "djames",
              artist_name: "DJames",
            },
            {
              artist_id: OTHER_ARTIST_ID,
              artist_slug: "djames",
              artist_name: "DJames",
            },
          ],
        },
      ],
    });

    expect(plan.artist_id).toBe(CURRENT_ARTIST_ID);
    expect(plan.provider_source_payload_fingerprint).toBe("a".repeat(64));
    expect(plan.selected_albums).toHaveLength(1);
    expect(plan.selected_albums[0].provider_album).toEqual(observation.albums[0]);
    expect(plan.selected_albums[0].additional_primary_artists).toEqual([
      {
        artist_id: OTHER_ARTIST_ID,
        artist_slug: "djames",
        artist_name: "DJames",
      },
    ]);
  });

  it("rejects a provider observation bound to another Artist", () => {
    const observation = providerObservation();
    observation.artist.id = OTHER_ARTIST_ID;

    expect(() => freezeReviewedDiscographyPlan({
      exact_artist_id: CURRENT_ARTIST_ID,
      provider_source_payload_fingerprint: "b".repeat(64),
      observation,
      selections: [
        { apple_music_id: "apple-album-1", action: "merge" },
      ],
    })).toThrow("Provider observation is bound to a different Artist.");
  });

  it("rejects a browser-selected album absent from the provider observation", () => {
    expect(() => freezeReviewedDiscographyPlan({
      exact_artist_id: CURRENT_ARTIST_ID,
      provider_source_payload_fingerprint: "c".repeat(64),
      observation: providerObservation(),
      selections: [
        { apple_music_id: "invented-album", action: "canonicalize" },
      ],
    })).toThrow("was not present in the immutable provider observation");
  });

  it("rejects a reviewed plan with no canonical action", () => {
    expect(() => freezeReviewedDiscographyPlan({
      exact_artist_id: CURRENT_ARTIST_ID,
      provider_source_payload_fingerprint: "d".repeat(64),
      observation: providerObservation(),
      selections: [
        { apple_music_id: "apple-album-1", action: "ignore" },
      ],
    })).toThrow("has no albums selected for canonical action");
  });

  it("rejects inconsistent canonical identity for the same co-primary Artist", () => {
    expect(() => freezeReviewedDiscographyPlan({
      exact_artist_id: CURRENT_ARTIST_ID,
      provider_source_payload_fingerprint: "e".repeat(64),
      observation: providerObservation(),
      selections: [
        {
          apple_music_id: "apple-album-1",
          action: "merge",
          additional_primary_artists: [
            {
              artist_id: OTHER_ARTIST_ID,
              artist_slug: "djames",
              artist_name: "DJames",
            },
            {
              artist_id: OTHER_ARTIST_ID,
              artist_slug: "different-slug",
              artist_name: "DJames",
            },
          ],
        },
      ],
    })).toThrow("identity is inconsistent inside one reviewed plan");
  });
});
