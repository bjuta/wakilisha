import { describe, expect, it } from "vitest";

import {
  canonicalTrackSlugCandidate,
} from "../supabase/functions/_shared/registry-track-identity.ts";
import {
  resolveScopedTrackIdentity,
  type ScopedTrackIdentityMaps,
} from "../supabase/functions/ingest-artist-discography/trackIdentity.ts";

function createMaps(): ScopedTrackIdentityMaps {
  return {
    existingTrackByIsrc: new Map<string, string>(),
    existingTrackByArtistAndSlug: new Map<string, string>(),
    existingTrackIdToSlug: new Map<string, string>(),
  };
}

function createSequentialIdFactory(): () => string {
  let nextId = 1;

  return () => {
    const id = `track-${nextId}`;
    nextId += 1;
    return id;
  };
}

describe("canonical Track slug candidate", () => {
  it("keeps structurally proven feature credits out of Track route identity", () => {
    expect(
      canonicalTrackSlugCandidate(
        "FICHA WHITE (feat. Jovie Jovv, Shappaman & KXOBIE)",
        {
          featuredArtistNames: [
            "Jovie Jovv",
            "Shappaman",
            "KXOBIE",
          ],
        },
      ),
    ).toBe("ficha-white");

    expect(
      canonicalTrackSlugCandidate(
        "Song ft. Artist B",
        {
          featuredArtistNames: [
            "Artist B",
          ],
        },
      ),
    ).toBe("song");
  });

  it("does not infer feature-credit structure from title text alone", () => {
    expect(
      canonicalTrackSlugCandidate(
        "Song ft. Artist B",
      ),
    ).toBe("song-ft-artist-b");

    expect(
      canonicalTrackSlugCandidate(
        "Road to Ft. Lauderdale",
        {
          featuredArtistNames: [
            "Someone Else",
          ],
        },
      ),
    ).toBe(
      "road-to-ft-lauderdale",
    );
  });

  it("preserves culturally meaningful version wording", () => {
    expect(
      canonicalTrackSlugCandidate(
        "Song (Remix)",
      ),
    ).toBe("song-remix");
  });
});

describe("resolveScopedTrackIdentity", () => {
  it("reuses a track staged earlier for the same artist and title", () => {
    const maps = createMaps();
    const createTrackId = createSequentialIdFactory();

    const first = resolveScopedTrackIdentity({
      artistSlug: "bensoul",
      rawTrackSlug: "plumber",
      trackIsrc: null,
      createTrackId,
      ...maps,
    });

    const second = resolveScopedTrackIdentity({
      artistSlug: "bensoul",
      rawTrackSlug: "plumber",
      trackIsrc: null,
      createTrackId,
      ...maps,
    });

    expect(first).toEqual({
      trackId: "track-1",
      trackSlug: "plumber",
      created: true,
    });

    expect(second).toEqual({
      trackId: "track-1",
      trackSlug: "plumber",
      created: false,
    });

    expect(maps.existingTrackIdToSlug.size).toBe(1);
  });

  it("allows different artists to share the same clean slug", () => {
    const maps = createMaps();
    const createTrackId = createSequentialIdFactory();

    const first = resolveScopedTrackIdentity({
      artistSlug: "artist-one",
      rawTrackSlug: "legendary",
      trackIsrc: null,
      createTrackId,
      ...maps,
    });

    const second = resolveScopedTrackIdentity({
      artistSlug: "artist-two",
      rawTrackSlug: "legendary",
      trackIsrc: null,
      createTrackId,
      ...maps,
    });

    expect(first.trackId).toBe("track-1");
    expect(second.trackId).toBe("track-2");
    expect(first.trackSlug).toBe("legendary");
    expect(second.trackSlug).toBe("legendary");
    expect(maps.existingTrackByArtistAndSlug.size).toBe(2);
  });

  it("caches an ISRC match for a later title-only appearance", () => {
    const maps = createMaps();
    const createTrackId = createSequentialIdFactory();

    maps.existingTrackByIsrc.set(
      "KEAAA2600001",
      "existing-track",
    );

    maps.existingTrackIdToSlug.set(
      "existing-track",
      "canonical-title",
    );

    const byIsrc = resolveScopedTrackIdentity({
      artistSlug: "artist-one",
      rawTrackSlug: "alternate-title",
      trackIsrc: "KEAAA2600001",
      createTrackId,
      ...maps,
    });

    const byScopedTitle = resolveScopedTrackIdentity({
      artistSlug: "artist-one",
      rawTrackSlug: "alternate-title",
      trackIsrc: null,
      createTrackId,
      ...maps,
    });

    expect(byIsrc).toEqual({
      trackId: "existing-track",
      trackSlug: "canonical-title",
      created: false,
    });

    expect(byScopedTitle).toEqual(byIsrc);
  });
});
