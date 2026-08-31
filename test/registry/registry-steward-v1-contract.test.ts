import {
  readFileSync,
} from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

function read(relativePath: string): string {
  return readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8",
  );
}

describe("Registry Steward V1 structural contract", () => {
  const migration = read(
    "supabase/migrations/20260831195500_registry_steward_v1_atomic_repairs.sql",
  );
  const agent = read(
    "supabase/functions/registry-steward/index.ts",
  );
  const discography = read(
    "supabase/functions/ingest-artist-discography/index.ts",
  );
  const charts = read(
    "supabase/functions/chart-ingest-api/index.ts",
  );
  const review = read(
    "supabase/functions/registry-enrichment-review/index.ts",
  );
  const scraper = read(
    "supabase/functions/scrape-artist-data/index.ts",
  );

  it("keeps automatic mutation service-owned and receipt-backed", () => {
    expect(migration).toContain(
      "registry_steward_apply_track_identity_repair",
    );
    expect(migration).toContain(
      "security definer",
    );
    expect(migration).toContain(
      "for update",
    );
    expect(migration).toContain(
      "registry_canonical_write_events",
    );
    expect(migration).toContain(
      "'registry-steward'",
    );
    expect(migration).toContain(
      "grant execute",
    );
    expect(migration).toContain(
      "to service_role",
    );
    expect(migration).toContain(
      "from public, anon, authenticated",
    );
  });

  it("preserves old public Track routes when a slug is repaired", () => {
    expect(migration).toContain(
      "wk_slug_redirects",
    );
    expect(migration).toContain(
      "'/tracks/' || primary_artist_slug || '/' || p_expected_slug",
    );
    expect(migration).toContain(
      "'/tracks/' || primary_artist_slug || '/' || p_new_slug",
    );
    expect(migration).toContain(
      "redirect_status",
    );
    expect(migration).toContain("308");
  });

  it("fails closed on same-Artist Track collisions instead of creating admin work or overwriting another object", () => {
    expect(migration).toContain(
      "same primary Artist scope",
    );
    expect(migration).toContain(
      "Automatic repair blocked",
    );
    expect(agent).toContain(
      "same_artist_slug_collision",
    );
    expect(agent).not.toContain(
      "registry_enrichment_suggestions",
    );
  });

  it("treats the Registry entity index as a derived read view rather than a second write authority", () => {
    expect(migration).not.toMatch(
      /update\s+public\.registry_entity_index/i,
    );
    expect(migration).toContain(
      "'derived_from_registry_tracks'",
    );
  });

  it("repairs canonical Chart presentation while preserving raw source payloads", () => {
    expect(migration).toContain(
      "registry_steward_sync_chart_batch",
    );
    expect(migration).toContain(
      "wk_chart_entries_v2",
    );
    expect(migration).toContain(
      "'raw_source_preserved_in', 'source_payload'",
    );
    expect(migration).not.toMatch(
      /update\s+public\.wk_chart_entries_v2[\s\S]*source_payload\s*=/i,
    );
  });

  it("uses one shared Track identity rule at the main ingestion boundaries", () => {
    for (const source of [
      discography,
      charts,
      review,
      scraper,
    ]) {
      expect(source).toContain(
        "canonicalizeIncomingTrackIdentity",
      );
    }
  });

  it("retires new Artist-prefixed Track slug creation from Registry canonicalization", () => {
    expect(review).not.toContain(
      "const scopedTrackSlug",
    );
    expect(review).not.toContain(
      "slug: scopedTrackSlug",
    );
  });

  it("keeps the repair agent bounded and explicitly auditable before mutation", () => {
    expect(agent).toContain(
      'action === "audit_tracks"',
    );
    expect(agent).toContain(
      'action === "apply_tracks"',
    );
    expect(agent).toContain(
      'action === "sync_charts"',
    );
    expect(agent).toContain(
      "boundedLimit",
    );
    expect(agent).toContain(
      "limit",
    );
    expect(agent).toContain(
      "afterId",
    );
  });
});
