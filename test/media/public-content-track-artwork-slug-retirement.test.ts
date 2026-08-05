import fs from "node:fs";
import { describe, expect, it } from "vitest";

const client = fs.readFileSync(
  "src/services/publicContent/client.ts",
  "utf8",
);

const blueprint = fs.readFileSync(
  "docs/engineering/phase-4a-m5e-retire-track-artwork-slug-lookup-implementation-blueprint.md",
  "utf8",
);

describe("Phase 4A Migration 5E track artwork slug retirement", () => {
  it("removes the direct compatibility-table lookup", () => {
    expect(client).not.toContain(
      "registry_media_assets",
    );

    expect(client).not.toContain(
      "RegistryMediaAsset",
    );

    expect(client).not.toContain(
      "getRegistryMediaBySlugs",
    );
  });

  it("removes obsolete slug selection helpers", () => {
    expect(client).not.toContain(
      "mediaCandidates",
    );

    expect(client).not.toContain(
      "preferMediaAsset",
    );

    expect(client).not.toContain(
      "mediaUrlFor",
    );

    expect(client).not.toContain(
      "mediaBySlug",
    );
  });

  it("preserves direct track artwork fields", () => {
    expect(client).toContain(
      'textValue(track, ["artwork_url", "cover_image_url", "image_url", "thumbnail_url"])',
    );

    expect(client).toContain(
      "artworkUrl: image(directArtwork, {",
    );
  });

  it("preserves generated artwork fallback", () => {
    expect(client).toContain(
      "generatedReleaseArtwork(title, artistStr)",
    );

    expect(client).toContain(
      'type: "track"',
    );
  });

  it("preserves tracklist presentation behavior", () => {
    expect(client).toContain(
      "trackNumber: relationship.position || index + 1",
    );

    expect(client).toContain(
      'previewUrl: textValue(track, ["preview_url"]) || undefined',
    );

    expect(client).toContain(
      'featuredArtists.join(", ")',
    );
  });

  it("records the live discovery and rollback boundary", () => {
    expect(blueprint).toContain(
      "1,943 exact live track-slug candidates",
    );

    expect(blueprint).toContain(
      "0 exact track-slug matches",
    );

    expect(blueprint).toContain(
      "direct artwork fields stored on the track row",
    );

    expect(blueprint).toContain(
      "No database row or storage object is changed.",
    );
  });
});
