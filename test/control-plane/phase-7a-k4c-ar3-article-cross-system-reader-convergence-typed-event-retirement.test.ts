import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readCandidate(): string {
  const migrationDir = path.resolve("supabase/migrations");
  const matches = fs
    .readdirSync(migrationDir)
    .filter((name) =>
      name.endsWith(
        "_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement.sql",
      ),
    );

  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(migrationDir, matches[0]), "utf8");
}

function functionBody(source: string, name: string): string {
  const lower = source.toLowerCase();
  const needle = `create or replace function ${name.toLowerCase()}`;
  const start = lower.indexOf(needle);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("$function$;", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + "$function$;".length);
}

const migration = readCandidate();
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k4c-ar3-article-cross-system-reader-convergence-typed-event-retirement.sql",
  ),
  "utf8",
);

describe("Phase 7A K4C-AR3 Article reader convergence", () => {
  it("pins the exact two accepted AR2-era typed readers", () => {
    expect(migration).toContain("3bdd9467a857da7a8f6373a50e237295");
    expect(migration).toContain("f89b6060e68ae2e1154f689a741dc831");
  });

  it("keeps the typed table physically present and pins production plus no-data preview history", () => {
    expect(migration).toContain("editorial.article_lifecycle_events");
    expect(migration).toContain("dd7ac00209d19f3f369fb0d9b3e1e6a1");
    expect(migration).toContain("d41d8cd98f00b204e9800998ecf8427e");
    expect(verifier).toContain("dd7ac00209d19f3f369fb0d9b3e1e6a1");
    expect(verifier).toContain("d41d8cd98f00b204e9800998ecf8427e");
    expect(migration).not.toMatch(
      /drop\s+table\s+(if\s+exists\s+)?editorial\.article_lifecycle_events/i,
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+editorial\.article_lifecycle_events/i,
    );
    expect(migration).not.toMatch(
      /update\s+editorial\.article_lifecycle_events/i,
    );
    expect(migration).not.toMatch(
      /insert\s+into\s+editorial\.article_lifecycle_events/i,
    );
  });

  it("moves Corrections publication proof to shared lifecycle history only", () => {
    const body = functionBody(
      migration,
      "editorial.correction_article_publication_proof",
    );

    expect(body).toContain("editorial.resource_lifecycle_events");
    expect(body).not.toContain("editorial.article_lifecycle_events");
    expect(body).toContain("published_version.id");
    expect(body).toContain("snapshot.is_active");
    expect(body).toContain("editorial.article_snapshot_fingerprint");
    expect(body).toContain("lifecycle_event.action =");
    expect(body).toContain("'published'");
  });

  it("moves Publishing state derivation to shared lifecycle history only", () => {
    const body = functionBody(
      migration,
      "editorial.derive_publishing_editorial_state",
    );

    expect(body).toContain("editorial.resource_lifecycle_events");
    expect(body).not.toContain("editorial.article_lifecycle_events");
    expect(body).toContain("'changes_requested'");
    expect(body).toContain("current_published_version_id");
    expect(body).toContain("current_approved_version_id");
    expect(body).toContain("current_submitted_version_id");
    expect(body).toContain("return 'draft'");
  });

  it("preserves Publishing security-definer metadata and controlled search path", () => {
    const body = functionBody(
      migration,
      "editorial.derive_publishing_editorial_state",
    );

    expect(body).toContain("security definer");
    expect(body).toContain(
      "set search_path to\n  'pg_catalog',\n  'editorial'",
    );
    expect(migration).toContain(
      "grant execute\non function editorial.derive_publishing_editorial_state(uuid)\nto authenticated, service_role;",
    );
    expect(migration).toContain(
      "revoke execute\non function editorial.derive_publishing_editorial_state(uuid)\nfrom public, anon;",
    );
  });

  it("preserves Corrections proof execution as service-role only", () => {
    expect(migration).toContain(
      "revoke execute\non function editorial.correction_article_publication_proof(uuid)\nfrom public, anon, authenticated, service_role;",
    );
    expect(migration).toContain(
      "grant execute\non function editorial.correction_article_publication_proof(uuid)\nto service_role;",
    );
  });

  it("pins all five downstream Corrections callers instead of rewriting them", () => {
    for (const hash of [
      "9fcaaee0694f103fc7b64e9f3b01549f",
      "ffa4fbba0c8cb7a19f015a39d3864adf",
      "933345920e74c08a217d4c02d00271ec",
      "f4495500ba9e1ecd6a7b95c8769d3e8d",
      "9bd8f5d6b14da2c98bb95b46f8e482c6",
    ]) {
      expect(migration).toContain(hash);
      expect(verifier).toContain(hash);
    }
  });

  it("pins AR1 review authority through AR3", () => {
    for (const hash of [
      "539bf98f189212294b8e1ce65d97e00e",
      "0421228df4bf205da2f663cc14c41e80",
      "707058aadc9c53746bfcaaa62d893f7f",
      "d92af169eeb9e48e65e4c749cf9e6403",
      "f5c977c58e87556e18f0fd07573dabe3",
    ]) {
      expect(verifier).toContain(hash);
    }
  });

  it("pins AR2 publication and command authority through AR3", () => {
    for (const hash of [
      "b2d6c14458a6a1b9824565c715237ef9",
      "c7a5df4d7de4d740fb680f4dc52dfc46",
      "12311085f7d61e044468e6c6cabbfd9e",
      "e4904cf58a152dffe23345c9c077ece3",
      "e5575e7ac122b98128e341898a0052c7",
      "82d29071e92b4e09825c76f1b2b6a883",
      "26320c4bf9c707e36912a0cea7bda82c",
      "4a1a1912f298d05ad96c70969efd54d8",
    ]) {
      expect(verifier).toContain(hash);
    }
  });

  it("requires the full typed dependency scan to reach zero", () => {
    expect(migration).toContain(
      "left live typed Article lifecycle dependencies",
    );
    expect(verifier).toContain(
      "remaining_live_typed_article_dependency_count",
    );
    expect(verifier).toContain(
      "PHASE_7A_K4C_AR3_ARTICLE_CROSS_SYSTEM_READER_CONVERGENCE_TYPED_EVENT_RETIREMENT_PASS",
    );
  });

  it("rejects hidden view, materialized-view, or RLS-policy dependencies", () => {
    for (const token of [
      "information_schema.views",
      "pg_matviews",
      "pg_policies",
    ]) {
      expect(migration).toContain(token);
      expect(verifier).toContain(token);
    }
  });

  it("keeps the historical typed table inaccessible to app roles", () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(verifier).toContain(`'${role}'`);
    }
    expect(verifier).toContain(
      "'editorial.article_lifecycle_events'",
    );
    expect(verifier).toContain("'INSERT,UPDATE,DELETE'");
  });

  it("keeps the shared lifecycle helper byte-pinned", () => {
    expect(migration).toContain("d84d503da70733c010a93025bca7cda7");
    expect(verifier).toContain("d84d503da70733c010a93025bca7cda7");
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+editorial\.append_resource_lifecycle_event/i,
    );
  });

  it("keeps Playlist, Audio, and Video convergence ratchets closed", () => {
    expect(verifier).toContain("playlist_resources");
    expect(verifier).toContain("audio_publication_resources");
    expect(verifier).toContain("video.publication_review_events");
    expect(verifier).toContain("video.publication_lifecycle_events");
  });
});
