import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), "utf8");
}

const gateway = read(
  "supabase/functions/public-content-read/index.ts",
);
const publicClient = read(
  "src/services/publicContent/client.ts",
);
const labelSearch = read(
  "src/hooks/useLabelSearchData.ts",
);
const mlinziRunner = read(
  "scripts/registry/mlinzi-registry-steward.ts",
);

describe("canonical cultural public projection", () => {
  it("keeps raw chart evidence immutable while projecting active Registry identity", () => {
    expect(gateway).toContain(
      'select("id, slug, title, artwork_url")',
    );
    expect(gateway).toContain(
      '.eq("status", "active")',
    );
    expect(gateway).toContain(
      "__publicTrackSlug",
    );
    expect(gateway).toContain(
      "__publicTrackTitle",
    );
    expect(gateway).toContain(
      "__publicArtworkUrl",
    );
    expect(gateway).toContain(
      "resolvePublicChartEntryIdentity",
    );
    expect(gateway).not.toContain(
      'update public.wk_chart_entries_v2',
    );
    expect(gateway).not.toContain(
      'delete from public.wk_chart_entries_v2',
    );
  });

  it("prefers canonical Registry display names over raw chart or credit spellings", () => {
    expect(gateway).toContain(
      'name: resolved?.name || displayName',
    );
    expect(gateway).toContain(
      "item.artistNames.join",
    );
  });

  it("keeps public Release counts and Label counts multi-track only", () => {
    expect(gateway).toContain(
      "fetchActiveReleaseTrackCounts",
    );
    expect(gateway).toContain(
      "(publicReleaseTrackCounts.get(releaseId) || 0) <= 1",
    );
    expect(gateway).toContain(
      "(releaseTrackCounts.get(String(release.id)) || 0) > 1",
    );
    expect(publicClient).toContain(
      "resolvePublicMultiTrackReleaseIds",
    );
    expect(publicClient).toContain(
      "if (!publicReleaseIds.has(String(r.id))) continue;",
    );
  });

  it("makes Search consume the canonical public Label projection instead of rebuilding counts from raw provider Releases", () => {
    expect(labelSearch).toContain(
      'import { listLabels } from "@/services/publicContent/client";',
    );
    expect(labelSearch).not.toContain(
      '.from("registry_releases")',
    );
    expect(labelSearch).not.toContain(
      'meta.record_label',
    );
  });

  it("holds the advisory lock on one dedicated database session for the entire Mlinzi run", () => {
    expect(mlinziRunner).toContain(
      "const lockClient = await pool.connect();",
    );
    expect(mlinziRunner).toContain(
      "acquireAgentLock(lockClient)",
    );
    expect(mlinziRunner).toContain(
      "releaseAgentLock(lockClient)",
    );
    expect(mlinziRunner).toContain(
      "lockClient.release();",
    );
  });

  it("keeps changed runtime copy free of forbidden dash punctuation", () => {
    for (const source of [
      gateway,
      publicClient,
      labelSearch,
      mlinziRunner,
    ]) {
      expect(source).not.toContain("—");
    }
  });
});
