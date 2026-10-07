import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_IDENTITY_CONTRACT_VERSION,
  PROVIDER_KEYS_V1,
  compactProviderIdentityPart,
  isKnownProviderKey,
  normalizeIsrc,
  normalizeUpc,
  normalizeProviderKey,
  normalizeProviderObjectId,
  providerIdentityAlias,
  resolveArtistIdentityV1,
  resolveReleaseIdentityV1,
  resolveTrackIdentityV1,
} from "../../supabase/functions/_shared/provider-identity.ts";

describe("Provider Identity resolver kernel", () => {
  it("freezes a provider-neutral vocabulary without claiming every adapter exists", () => {
    expect(PROVIDER_IDENTITY_CONTRACT_VERSION).toBe("provider-identity-v1");
    expect(PROVIDER_KEYS_V1).toEqual(
      expect.arrayContaining([
        "apple_music",
        "spotify",
        "youtube",
        "audiomack",
        "boomplay",
        "mdundo",
        "soundcloud",
        "deezer",
        "tidal",
        "amazon_music",
        "shazam",
        "tiktok",
        "meta_music",
      ]),
    );

    expect(normalizeProviderKey("Apple Music")).toBe("apple_music");
    expect(normalizeProviderKey("AppleMusic")).toBe("apple_music");
    expect(normalizeProviderKey("YouTube Music")).toBe("youtube");
    expect(normalizeProviderKey("AmazonMusic")).toBe("amazon_music");
    expect(normalizeProviderKey("Future Provider")).toBe("future_provider");
    expect(isKnownProviderKey("YouTube Music")).toBe(true);
    expect(isKnownProviderKey("Future Provider")).toBe(false);
  });

  it("keeps canonical provider object IDs distinct from compatibility aliases", () => {
    expect(normalizeProviderObjectId("  AbC-1/X  ")).toBe("AbC-1/X");
    expect(compactProviderIdentityPart("  AbC-1/X  ")).toBe("abc-1-x");
    expect(providerIdentityAlias("Spotify", "  AbC-1/X  ")).toBe(
      "provider:spotify:abc-1-x",
    );
    expect(normalizeIsrc(" ke-ab1-23-00001 ")).toBe("KEAB12300001");
  });

  it("resolves one accepted provider binding as existing canonical authority", () => {
    const result = resolveTrackIdentityV1({
      providerIdsJson: { spotify: ["SPOT-1"] },
      providerBindingsByKey: new Map([
        [
          "spotify:spot-1",
          {
            trackId: "track-a",
            confidence: 0.98,
            method: "source_import",
          },
        ],
      ]),
    });

    expect(result.state).toBe("resolved_existing_authority");
    expect(result.canonicalTrackId).toBe("track-a");
    expect(result.matchMethod).toBe("provider_id");
    expect(result.confidence).toBe(98);
    expect(result.reasons).toContain("evidence:provider:spotify:spot-1");
  });

  it("nominates one exact ISRC match as a deterministic candidate", () => {
    const result = resolveTrackIdentityV1({
      isrc: "KE-ABC-26-00001",
      trackIdsByIsrc: new Map([
        ["KEABC2600001", new Set(["track-a"])],
      ]),
    });

    expect(result.state).toBe("deterministic_candidate");
    expect(result.canonicalTrackId).toBe("track-a");
    expect(result.matchMethod).toBe("isrc");
    expect(result.confidence).toBe(100);
    expect(result.reasons).toContain("evidence:isrc:KEABC2600001");
  });

  it("deduplicates provider and ISRC evidence that point to the same Track", () => {
    const result = resolveTrackIdentityV1({
      isrc: "KE-ABC-26-00001",
      providerIdsJson: { apple_music: ["12345"] },
      trackIdsByIsrc: new Map([
        ["KEABC2600001", ["track-a"]],
      ]),
      providerBindingsByKey: new Map([
        [
          "apple_music:12345",
          {
            trackId: "track-a",
            confidence: 0.91,
            method: "exact_title_artist",
          },
        ],
      ]),
    });

    expect(result.state).toBe("resolved_existing_authority");
    expect(result.canonicalTrackId).toBe("track-a");
    expect(result.candidateTrackIds).toEqual(["track-a"]);
    expect(result.matchMethod).toBe("isrc");
    expect(result.authorityClasses).toEqual(["isrc", "provider_binding"]);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "evidence:isrc:KEABC2600001",
        "evidence:provider:apple_music:12345",
        "candidate_track:track-a",
      ]),
    );
  });

  it("fails closed when strong evidence points to different Tracks", () => {
    const result = resolveTrackIdentityV1({
      isrc: "KE-ABC-26-00001",
      providerIdsJson: { spotify: ["SPOT-1"] },
      trackIdsByIsrc: new Map([
        ["KEABC2600001", ["track-a"]],
      ]),
      providerBindingsByKey: new Map([
        [
          "spotify:spot-1",
          {
            trackId: "track-b",
            confidence: 1,
            method: "source_import",
          },
        ],
      ]),
    });

    expect(result.state).toBe("quarantined_conflict");
    expect(result.canonicalTrackId).toBeNull();
    expect(result.candidateTrackIds).toEqual(["track-a", "track-b"]);
  });

  it("keeps absence of strong evidence unresolved", () => {
    const result = resolveTrackIdentityV1({
      isrc: "KE-ABC-26-00001",
      providerIdsJson: { youtube: ["video-1"] },
    });

    expect(result.state).toBe("unresolved");
    expect(result.canonicalTrackId).toBeNull();
    expect(result.matchMethod).toBe("no_match");
    expect(result.reasons).toEqual([
      "No exact Registry Track match from ISRC or matched provider identity.",
    ]);
  });

  it("follows one accepted successor without rewriting source evidence", () => {
    const result = resolveTrackIdentityV1({
      providerIdsJson: { youtube: ["video-1"] },
      providerBindingsByKey: new Map([
        [
          "youtube:video-1",
          {
            trackId: "track-old",
            confidence: 1,
            method: "source_import",
          },
        ],
      ]),
      lineageByTrackId: new Map([
        [
          "track-old",
          {
            status: "successor",
            currentTrackIds: ["track-current"],
          },
        ],
      ]),
    });

    expect(result.state).toBe("resolved_existing_authority");
    expect(result.sourceTrackIds).toEqual(["track-old"]);
    expect(result.candidateTrackIds).toEqual(["track-current"]);
    expect(result.canonicalTrackId).toBe("track-current");
    expect(result.reasons).toContain("lineage:track-old->track-current");
  });

  it("quarantines split lineage and marks retired lineage as superseded", () => {
    const split = resolveTrackIdentityV1({
      providerIdsJson: { youtube: ["video-1"] },
      providerBindingsByKey: new Map([
        [
          "youtube:video-1",
          {
            trackId: "track-old",
            confidence: 1,
          },
        ],
      ]),
      lineageByTrackId: new Map([
        [
          "track-old",
          {
            status: "split",
            currentTrackIds: ["track-a", "track-b"],
          },
        ],
      ]),
    });

    expect(split.state).toBe("quarantined_conflict");
    expect(split.canonicalTrackId).toBeNull();

    const retired = resolveTrackIdentityV1({
      providerIdsJson: { youtube: ["video-2"] },
      providerBindingsByKey: new Map([
        [
          "youtube:video-2",
          {
            trackId: "track-retired",
            confidence: 1,
          },
        ],
      ]),
      lineageByTrackId: new Map([
        [
          "track-retired",
          {
            status: "retired",
            currentTrackIds: [],
          },
        ],
      ]),
    });

    expect(retired.state).toBe("superseded_external_reference");
    expect(retired.canonicalTrackId).toBeNull();
  });

  it("normalizes canonical UPC/EAN shape without inventing identifier validity", () => {
    expect(normalizeUpc(" 7033-2563-4881 ")).toBe("703325634881");
    expect(normalizeUpc("12345678")).toBe("12345678");
    expect(normalizeUpc("12345678901234")).toBe("12345678901234");
    expect(normalizeUpc("1234")).toBe("");
    expect(normalizeUpc("UPC-123456789012")).toBe("");
  });

  it("resolves one exact Release provider identity as existing authority", () => {
    const result = resolveReleaseIdentityV1({
      providerIdsJson: { apple_music: ["1868931341"] },
      releaseIdsByProviderKey: new Map([
        ["apple_music:1868931341", ["release-a"]],
      ]),
    });

    expect(result.state).toBe("resolved_existing_authority");
    expect(result.canonicalReleaseId).toBe("release-a");
    expect(result.matchMethod).toBe("provider_id");
    expect(result.reasons).toContain(
      "evidence:provider:apple_music:1868931341",
    );
  });

  it("nominates one exact UPC Release match as a deterministic candidate", () => {
    const result = resolveReleaseIdentityV1({
      upc: "7033-2563-4881",
      releaseIdsByUpc: new Map([
        ["703325634881", ["release-a"]],
      ]),
    });

    expect(result.state).toBe("deterministic_candidate");
    expect(result.canonicalReleaseId).toBe("release-a");
    expect(result.matchMethod).toBe("upc");
    expect(result.reasons).toContain("evidence:upc:703325634881");
  });

  it("deduplicates provider and UPC Release evidence that agree", () => {
    const result = resolveReleaseIdentityV1({
      providerIdsJson: { apple_music: ["1868931341"] },
      upc: "703325634881",
      releaseIdsByProviderKey: new Map([
        ["apple_music:1868931341", ["release-a"]],
      ]),
      releaseIdsByUpc: new Map([
        ["703325634881", ["release-a"]],
      ]),
    });

    expect(result.state).toBe("resolved_existing_authority");
    expect(result.canonicalReleaseId).toBe("release-a");
    expect(result.candidateReleaseIds).toEqual(["release-a"]);
    expect(result.authorityClasses).toEqual(["provider_identity", "upc"]);
  });

  it("fails closed for duplicated or conflicting strong Release evidence", () => {
    const duplicated = resolveReleaseIdentityV1({
      providerIdsJson: { apple_music: ["1868931341"] },
      releaseIdsByProviderKey: new Map([
        ["apple_music:1868931341", ["release-a", "release-b"]],
      ]),
    });

    expect(duplicated.state).toBe("quarantined_conflict");
    expect(duplicated.canonicalReleaseId).toBeNull();
    expect(duplicated.candidateReleaseIds).toEqual([
      "release-a",
      "release-b",
    ]);

    const disagree = resolveReleaseIdentityV1({
      providerIdsJson: { apple_music: ["1868931341"] },
      upc: "703325634881",
      releaseIdsByProviderKey: new Map([
        ["apple_music:1868931341", ["release-a"]],
      ]),
      releaseIdsByUpc: new Map([
        ["703325634881", ["release-b"]],
      ]),
    });

    expect(disagree.state).toBe("quarantined_conflict");
    expect(disagree.canonicalReleaseId).toBeNull();
  });

  it("follows Release lineage and fails closed on split lineage", () => {
    const successor = resolveReleaseIdentityV1({
      providerIdsJson: { apple_music: ["old-album"] },
      releaseIdsByProviderKey: new Map([
        ["apple_music:old-album", ["release-old"]],
      ]),
      lineageByReleaseId: new Map([
        [
          "release-old",
          {
            status: "successor",
            currentReleaseIds: ["release-current"],
          },
        ],
      ]),
    });

    expect(successor.state).toBe("resolved_existing_authority");
    expect(successor.sourceReleaseIds).toEqual(["release-old"]);
    expect(successor.canonicalReleaseId).toBe("release-current");

    const split = resolveReleaseIdentityV1({
      upc: "703325634881",
      releaseIdsByUpc: new Map([
        ["703325634881", ["release-old"]],
      ]),
      lineageByReleaseId: new Map([
        [
          "release-old",
          {
            status: "split",
            currentReleaseIds: ["release-a", "release-b"],
          },
        ],
      ]),
    });

    expect(split.state).toBe("quarantined_conflict");
    expect(split.canonicalReleaseId).toBeNull();
  });

  it("keeps Release title/slug similarity outside canonical resolution", () => {
    const result = resolveReleaseIdentityV1({});

    expect(result.state).toBe("unresolved");
    expect(result.canonicalReleaseId).toBeNull();
    expect(result.reasons).toEqual([
      "No exact Registry Release match from UPC/EAN or provider identity.",
    ]);
  });

  it("resolves one exact Artist provider identity as existing authority", () => {
    const result = resolveArtistIdentityV1({
      providerIdsJson: { apple_music: ["artist-apple-1"] },
      artistIdsByProviderKey: new Map([
        ["apple_music:artist-apple-1", ["artist-a"]],
      ]),
    });

    expect(result.state).toBe("resolved_existing_authority");
    expect(result.canonicalArtistId).toBe("artist-a");
    expect(result.matchMethod).toBe("provider_id");
    expect(result.confidence).toBe(100);
    expect(result.reasons).toContain(
      "evidence:provider:apple_music:artist-apple-1",
    );
  });

  it("deduplicates cross-provider Artist evidence that agrees", () => {
    const result = resolveArtistIdentityV1({
      providerIdsJson: {
        apple_music: ["artist-apple-1"],
        spotify: ["artist-spotify-1"],
      },
      artistIdsByProviderKey: new Map([
        ["apple_music:artist-apple-1", ["artist-a"]],
        ["spotify:artist-spotify-1", ["artist-a"]],
      ]),
    });

    expect(result.state).toBe("resolved_existing_authority");
    expect(result.canonicalArtistId).toBe("artist-a");
    expect(result.candidateArtistIds).toEqual(["artist-a"]);
    expect(result.authorityClasses).toEqual(["provider_identity"]);
  });

  it("fails closed for duplicated or conflicting strong Artist evidence", () => {
    const duplicated = resolveArtistIdentityV1({
      providerIdsJson: { apple_music: ["artist-apple-1"] },
      artistIdsByProviderKey: new Map([
        ["apple_music:artist-apple-1", ["artist-a", "artist-b"]],
      ]),
    });

    expect(duplicated.state).toBe("quarantined_conflict");
    expect(duplicated.canonicalArtistId).toBeNull();
    expect(duplicated.candidateArtistIds).toEqual([
      "artist-a",
      "artist-b",
    ]);

    const disagree = resolveArtistIdentityV1({
      providerIdsJson: {
        apple_music: ["artist-apple-1"],
        spotify: ["artist-spotify-1"],
      },
      artistIdsByProviderKey: new Map([
        ["apple_music:artist-apple-1", ["artist-a"]],
        ["spotify:artist-spotify-1", ["artist-b"]],
      ]),
    });

    expect(disagree.state).toBe("quarantined_conflict");
    expect(disagree.canonicalArtistId).toBeNull();
  });

  it("follows Artist lineage and fails closed on split lineage", () => {
    const successor = resolveArtistIdentityV1({
      providerIdsJson: { apple_music: ["artist-old"] },
      artistIdsByProviderKey: new Map([
        ["apple_music:artist-old", ["artist-source"]],
      ]),
      lineageByArtistId: new Map([
        [
          "artist-source",
          {
            status: "successor",
            currentArtistIds: ["artist-current"],
          },
        ],
      ]),
    });

    expect(successor.state).toBe("resolved_existing_authority");
    expect(successor.sourceArtistIds).toEqual(["artist-source"]);
    expect(successor.canonicalArtistId).toBe("artist-current");

    const split = resolveArtistIdentityV1({
      providerIdsJson: { apple_music: ["artist-old"] },
      artistIdsByProviderKey: new Map([
        ["apple_music:artist-old", ["artist-source"]],
      ]),
      lineageByArtistId: new Map([
        [
          "artist-source",
          {
            status: "split",
            currentArtistIds: ["artist-a", "artist-b"],
          },
        ],
      ]),
    });

    expect(split.state).toBe("quarantined_conflict");
    expect(split.canonicalArtistId).toBeNull();
  });

  it("keeps Artist name or alias evidence outside provider identity resolution", () => {
    const result = resolveArtistIdentityV1({});

    expect(result.state).toBe("unresolved");
    expect(result.canonicalArtistId).toBeNull();
    expect(result.reasons).toEqual([
      "No exact Registry Artist match from provider identity.",
    ]);
  });

  it("is the canonical exact-match kernel consumed by chart ingest", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/functions/chart-ingest-api/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain('resolveTrackIdentityV1');
    expect(source).toContain('from "../_shared/provider-identity.ts"');
    expect(source).toContain('trackIdsByIsrc,');
    expect(source).toContain('providerBindingsByKey: providerLinkByAlias');

    // Exact-match normalization is owned by the shared primitive now.
    expect(source).not.toMatch(/function normalizeProviderKey\s*\(/);
    expect(source).not.toMatch(/function normalizeIsrc\s*\(/);
    expect(source).not.toMatch(/function compactIdentityPart\s*\(/);
  });

  it("preserves chart-ingest exact-match compatibility states", () => {
    const noMatch = resolveTrackIdentityV1({
      isrc: "KE-ABC-26-00001",
      providerIdsJson: { youtube: ["video-1"] },
    });
    expect(noMatch).toMatchObject({
      state: "unresolved",
      canonicalTrackId: null,
      matchMethod: "no_match",
      confidence: 0,
    });

    const exact = resolveTrackIdentityV1({
      isrc: "KE-ABC-26-00001",
      trackIdsByIsrc: new Map([
        ["KEABC2600001", ["track-a"]],
      ]),
    });
    expect(exact).toMatchObject({
      state: "deterministic_candidate",
      canonicalTrackId: "track-a",
      matchMethod: "isrc",
      confidence: 100,
    });

    const conflict = resolveTrackIdentityV1({
      isrc: "KE-ABC-26-00001",
      providerIdsJson: { spotify: ["SPOT-1"] },
      trackIdsByIsrc: new Map([
        ["KEABC2600001", ["track-a"]],
      ]),
      providerBindingsByKey: new Map([
        ["spotify:spot-1", { trackId: "track-b", confidence: 1 }],
      ]),
    });
    expect(conflict).toMatchObject({
      state: "quarantined_conflict",
      canonicalTrackId: null,
      candidateTrackIds: ["track-a", "track-b"],
    });
  });

  it("contains no database client or canonical mutation road", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/functions/_shared/provider-identity.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("createClient");
    expect(source).not.toMatch(/\.from\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
    expect(source).not.toMatch(/insert\s+into\s+public\.registry_/i);
    expect(source).not.toMatch(/update\s+public\.registry_/i);
    expect(source).not.toMatch(/delete\s+from\s+public\.registry_/i);
  });
});
