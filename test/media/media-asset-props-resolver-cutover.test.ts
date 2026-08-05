import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  "src/utils/mediaAssetProps.ts",
  "utf8",
);

const enrichment = fs.readFileSync(
  "src/services/entityMediaEnrichment.ts",
  "utf8",
);

const generatedTypes = fs.readFileSync(
  "src/types/database.types.ts",
  "utf8",
);

const blueprint = fs.readFileSync(
  "docs/engineering/phase-4a-m5c-shared-media-read-cutover-implementation-blueprint.md",
  "utf8",
);

describe("Phase 4A Migration 5C shared Media read cutover", () => {
  it("uses the generated governed Media adapter type", () => {
    expect(source).toContain(
      'import type { Database } from "@/types/database.types";',
    );

    expect(source).toContain(
      'Database["public"]["Functions"]["resolve_legacy_media_asset_lite_batch"]["Returns"][number]',
    );

    expect(generatedTypes).toContain(
      "resolve_legacy_media_asset_lite_batch",
    );
  });

  it("routes URL and ID batches through the governed RPC", () => {
    expect(source).toContain(
      '"resolve_legacy_media_asset_lite_batch"',
    );

    expect(source).toContain(
      "{ p_urls: chunk }",
    );

    expect(source).toContain(
      "{ p_asset_ids: chunk }",
    );

    expect(source).not.toContain(
      '.from("registry_media_assets")',
    );
  });

  it("keeps the shared public enrichment path", () => {
    expect(enrichment).toContain(
      'from "@/utils/mediaAssetProps"',
    );

    expect(enrichment).toContain(
      "batchGetMediaAssetsByUrl",
    );

    expect(enrichment).not.toContain(
      '.from("registry_media_assets")',
    );
  });

  it("makes the React hook reuse the governed URL batch", () => {
    expect(source).toContain(
      "void batchGetMediaAssetsByUrl([url])",
    );

    expect(source).not.toContain(
      ".maybeSingle()",
    );
  });

  it("preserves presentation fallback and both caches", () => {
    expect(source).toContain(
      "src: asset?.url || fallback.src",
    );

    expect(source).toContain(
      "const urlCache = new Map<string, MediaAssetLite | null>();",
    );

    expect(source).toContain(
      "const idCache = new Map<string, MediaAssetLite | null>();",
    );

    expect(source).toContain(
      "urlCache.set(u, asset)",
    );

    expect(source).toContain(
      "idCache.set(row.id, row)",
    );
  });

  it("keeps the cutover narrow and reversible", () => {
    expect(blueprint).toContain(
      "Media Library admin reads",
    );

    expect(blueprint).toContain(
      "image editing or Lightsail overwrite behavior",
    );

    expect(blueprint).toContain(
      "The compatibility table remains available as the rollback path.",
    );

    expect(blueprint).toContain(
      "frontend deployment: required only after PR review and merge",
    );
  });
});
