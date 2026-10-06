import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROVIDER_IDENTITY_CONTRACT_VERSION,
  PROVIDER_KEYS_V1,
  compactProviderIdentityPart,
  isKnownProviderKey,
  normalizeIsrc,
  normalizeProviderKey,
  normalizeProviderObjectId,
  providerIdentityAlias,
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
