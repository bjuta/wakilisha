import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  analyzeChartIdentity,
  analyzeReleaseIdentity,
  analyzeTrackIdentity,
  MIZIZI_RULESET_VERSION,
  slugifyIdentity,
  stripFeatureCreditNoise,
  stripReleasePackagingSuffix,
} from "../../scripts/registry/agents/mizizi/core";

describe("MIZIZI Cultural Data Steward", () => {
  it("uses minimal route-safe slug grammar", () => {
    expect(
      slugifyIdentity("Chai & Maziwa"),
    ).toBe("chai-maziwa");

    expect(
      slugifyIdentity("  Ki Di'ng  "),
    ).toBe("ki-di-ng");
  });

  it("separates featured credits from Track identity", () => {
    const cleaned =
      stripFeatureCreditNoise(
        "FICHA WHITE (feat. Jovie Jovv, Shappaman & KXOBIE)",
      );

    expect(cleaned.coreTitle).toBe(
      "FICHA WHITE",
    );
    expect(
      slugifyIdentity(
        cleaned.coreTitle,
      ),
    ).toBe("ficha-white");
    expect(
      cleaned.removedFragments,
    ).toEqual([
      "(feat. Jovie Jovv, Shappaman & KXOBIE)",
    ]);
  });

  it("preserves version identity while removing featured credits", () => {
    const cleaned =
      stripFeatureCreditNoise(
        "Jipe Shughuli Nani (feat. BenaiA, OVR2) [Remix]",
      );

    expect(cleaned.coreTitle).toBe(
      "Jipe Shughuli Nani [Remix]",
    );
    expect(
      slugifyIdentity(
        cleaned.coreTitle,
      ),
    ).toBe(
      "jipe-shughuli-nani-remix",
    );
  });

  it("proposes a clean Track slug while observing title presentation noise", () => {
    const findings =
      analyzeTrackIdentity({
        id: "0672f196-59b6-4099-bb92-0ef41d37c78b",
        slug: "agent-mgumbe--ficha-white-feat-jovie-jovv-shappaman-kxobie",
        title:
          "FICHA WHITE (feat. Jovie Jovv, Shappaman & KXOBIE)",
        primaryArtistSlug:
          "agent-mgumbe",
        primaryArtistName:
          "Agent Mgumbe",
        featuredArtists: [
          {
            slug: "jovie-jovv",
            name: "Jovie Jovv",
          },
          {
            slug: "shappaman",
            name: "Shappaman",
          },
          {
            slug: "kxobie",
            name: "KXOBIE",
          },
        ],
      });

    const slugFinding =
      findings.find(
        (finding) =>
          finding.ruleId ===
          "track_slug_identity_noise",
      );
    const titleFinding =
      findings.find(
        (finding) =>
          finding.ruleId ===
          "track_title_credit_noise",
      );

    expect(slugFinding).toMatchObject({
      fieldName: "slug",
      proposedValue: "ficha-white",
      disposition:
        "auto_fix_candidate",
      severity: "high",
    });
    expect(
      slugFinding?.reason,
    ).toContain(
      "primary_artist_repeated_inside_slug",
    );
    expect(
      slugFinding?.reason,
    ).toContain(
      "feature_credit_marker_in_slug",
    );

    expect(titleFinding).toMatchObject({
      fieldName: "title",
      proposedValue: "FICHA WHITE",
      disposition: "observe",
    });
  });

  it("observes an unexplained slug mismatch without creating review work", () => {
    const findings =
      analyzeTrackIdentity({
        id: "track-review-1",
        slug: "song-legacy",
        title: "Song",
        primaryArtistSlug:
          "lead-artist",
        primaryArtistName:
          "Lead Artist",
        featuredArtists: [],
      });

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId:
          "track_slug_identity_mismatch",
        fieldName: "slug",
        proposedValue: "song",
        disposition: "observe",
        confidence: 0.6,
      }),
    ]);
    expect(
      findings.some(
        (finding) =>
          finding.disposition ===
          "auto_fix_candidate",
      ),
    ).toBe(false);
  });

  it("derives Release taxonomy from resolvable active Track count", () => {
    const single =
      analyzeReleaseIdentity({
        id: "release-single",
        slug: "one-song",
        title: "One Song",
        releaseType: "ep",
        activeTrackCount: 1,
      });

    expect(single).toContainEqual(
      expect.objectContaining({
        ruleId:
          "release_taxonomy_drift",
        fieldName: "release_type",
        currentValue: "ep",
        proposedValue: "single",
        disposition:
          "auto_fix_candidate",
        confidence: 1,
      }),
    );

    const ep =
      analyzeReleaseIdentity({
        id: "release-ep",
        slug: "project",
        title: "Project",
        releaseType: "album",
        activeTrackCount: 6,
      });

    expect(ep).toContainEqual(
      expect.objectContaining({
        ruleId:
          "release_taxonomy_drift",
        proposedValue: "ep",
      }),
    );

    const album =
      analyzeReleaseIdentity({
        id: "release-album",
        slug: "project-two",
        title: "Project Two",
        releaseType: "ep",
        activeTrackCount: 7,
      });

    expect(album).toContainEqual(
      expect.objectContaining({
        ruleId:
          "release_taxonomy_drift",
        proposedValue: "album",
      }),
    );
  });

  it("does not invent Release taxonomy when no active Track target resolves", () => {
    expect(
      analyzeReleaseIdentity({
        id: "release-unresolved",
        slug: "unresolved",
        title: "Unresolved",
        releaseType: "ep",
        activeTrackCount: 0,
      }),
    ).toEqual([]);
  });

  it("uses MIZIZI rule-set 1.1.0 for Release taxonomy authority", () => {
    expect(MIZIZI_RULESET_VERSION).toBe(
      "1.1.0",
    );
  });

  it("observes exact provider Release packaging without creating review work", () => {
    expect(
      stripReleasePackagingSuffix(
        "Balance - Single",
        "single",
      ),
    ).toEqual({
      coreTitle: "Balance",
      removedSuffix: "- Single",
    });

    const findings =
      analyzeReleaseIdentity({
        id: "release-1",
        slug: "balance-single",
        title: "Balance - Single",
        releaseType: "single",
      });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId:
            "release_title_provider_packaging",
          proposedValue: "Balance",
          disposition: "observe",
        }),
        expect.objectContaining({
          ruleId:
            "release_slug_provider_packaging",
          proposedValue: "balance",
          disposition: "observe",
        }),
      ]),
    );
  });

  it("does not strip cultural wording that merely contains a Release type", () => {
    expect(
      stripReleasePackagingSuffix(
        "Wanavokali: The Album",
        "album",
      ),
    ).toEqual({
      coreTitle:
        "Wanavokali: The Album",
      removedSuffix: "",
    });

    expect(
      analyzeReleaseIdentity({
        id: "release-2",
        slug: "wanavokali-the-album",
        title:
          "Wanavokali: The Album",
        releaseType: "album",
      }),
    ).toEqual([]);
  });

  it("treats a canonical Track ID as authority for chart Track slug drift", () => {
    const findings =
      analyzeChartIdentity({
        id: "chart-entry-1",
        trackSlug:
          "ficha-white-feat-jovie-jovv",
        artistSlug:
          "agent-mgumbe",
        canonicalTrackId:
          "0672f196-59b6-4099-bb92-0ef41d37c78b",
        canonicalTrackSlug:
          "ficha-white",
        canonicalPrimaryArtistSlug:
          "agent-mgumbe",
      });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId:
        "chart_track_slug_drift",
      proposedValue:
        "ficha-white",
      disposition:
        "auto_fix_candidate",
      confidence: 1,
    });
  });

  it("observes chart artist disagreement without creating review work", () => {
    const findings =
      analyzeChartIdentity({
        id: "chart-entry-2",
        trackSlug: "ficha-white",
        artistSlug:
          "agent-mgumbe-and-friends",
        canonicalTrackId:
          "0672f196-59b6-4099-bb92-0ef41d37c78b",
        canonicalTrackSlug:
          "ficha-white",
        canonicalPrimaryArtistSlug:
          "agent-mgumbe",
      });

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId:
          "chart_artist_slug_drift",
        proposedValue:
          "agent-mgumbe",
        disposition: "observe",
      }),
    ]);
  });

  it("produces deterministic finding fingerprints", () => {
    const input = {
      id: "track-1",
      slug:
        "song-feat-artist",
      title:
        "Song (feat. Artist)",
      primaryArtistSlug:
        "lead-artist",
      featuredArtists: [
        {
          slug: "artist",
          name: "Artist",
        },
      ],
    };

    const first =
      analyzeTrackIdentity(
        input,
      );
    const second =
      analyzeTrackIdentity(
        input,
      );

    expect(
      first.map(
        (finding) =>
          finding.fingerprint,
      ),
    ).toEqual(
      second.map(
        (finding) =>
          finding.fingerprint,
      ),
    );
  });

  it("binds live Registry Track writers to the shared identity rule", () => {
    const sharedRule =
      readFileSync(
        "supabase/functions/_shared/registry-track-identity.ts",
        "utf8",
      );
    const discography =
      readFileSync(
        "supabase/functions/ingest-artist-discography/index.ts",
        "utf8",
      );
    const enrichment =
      readFileSync(
        "supabase/functions/registry-enrichment-review/index.ts",
        "utf8",
      );
    const chartIngest =
      readFileSync(
        "supabase/functions/chart-ingest-api/index.ts",
        "utf8",
      );
    const scraper =
      readFileSync(
        "supabase/functions/scrape-artist-data/index.ts",
        "utf8",
      );

    expect(sharedRule).toContain(
      "canonicalTrackSlugCandidate",
    );
    expect(discography).toContain(
      'from "../_shared/registry-track-identity.ts"',
    );
    expect(discography).toContain(
      "canonicalTrackSlugCandidate",
    );
    expect(enrichment).toContain(
      'from "../_shared/registry-track-identity.ts"',
    );
    expect(enrichment).toContain(
      "findTrackByArtistAndSlug",
    );
    expect(enrichment).not.toContain(
      "scopedTrackSlug",
    );
    expect(chartIngest).toContain(
      'from "../_shared/registry-track-identity.ts"',
    );
    expect(chartIngest).toContain(
      "trackSlugCollisionInArtistScope",
    );
    expect(chartIngest).not.toContain(
      "uniqueTrackSlug",
    );
    expect(scraper).toContain(
      'from "../_shared/registry-track-identity.ts"',
    );
    expect(scraper).toContain(
      "resolveTrackInArtistScope",
    );
    expect(scraper).not.toContain(
      "artistScopedSlugPrefix",
    );
    expect(scraper).not.toContain(
      "seenTrackSlugs",
    );
  });

  it("seals reviewed Track Intake route identity in SQL", () => {
    const migration =
      readFileSync(
        "supabase/migrations/20260901114500_mizizi_track_identity_write_boundary.sql",
        "utf8",
      );
    const verifier =
      readFileSync(
        "scripts/control-plane/verify-mizizi-track-identity-write-boundary.sql",
        "utf8",
      );

    expect(migration).toContain(
      "v_slug := v_title_slug",
    );
    expect(migration).toContain(
      "v_featured_artist_names",
    );
    expect(migration).toContain(
      "artist_credit.credit_role = 'featured'",
    );
    expect(migration).toContain(
      "track_artist.is_primary is true",
    );
    expect(migration).not.toContain(
      "|| '--'\n    || v_title_slug",
    );
    expect(migration).not.toContain(
      "left(replace(v_track_id::text, '-', ''), 8)",
    );
    expect(verifier).toContain(
      "MIZIZI Track Intake write boundary is structurally sealed",
    );
  });

  it("routes production Track apply through the governed control plane", () => {
    const workflow =
      readFileSync(
        ".github/workflows/mizizi-track-production-control-plane.yml",
        "utf8",
      );
    const controlPlane =
      readFileSync(
        "scripts/control-plane/mizizi-track-production-control-plane.mjs",
        "utf8",
      );

    expect(workflow).toContain(
      "workflow_dispatch",
    );
    expect(workflow).toContain(
      "push:",
    );
    expect(workflow).toContain(
      ".github/mizizi-track-production-apply.json",
    );
    expect(workflow).toContain(
      "SUPABASE_ACCESS_TOKEN",
    );
    expect(controlPlane).toContain(
      "MIZIZI_TRACK_PRODUCTION_APPLY",
    );
    expect(workflow).toContain(
      "node scripts/control-plane/mizizi-track-production-control-plane.mjs",
    );
    expect(controlPlane).toContain(
      "options', '-c jit=true'",
    );
    expect(controlPlane).toContain(
      "supabase/.temp/pooler-url",
    );
    expect(controlPlane).toContain(
      "postgres.${PROJECT_REF}",
    );
    expect(controlPlane).not.toContain(
      "aws-0-",
    );
    expect(controlPlane).toContain(
      "role:'postgres'",
    );
    expect(controlPlane).toContain(
      "{user_id:userId,roles}",
    );
    expect(controlPlane).toContain(
      "/ssl-enforcement",
    );
    expect(controlPlane).toContain(
      "requestedConfig:{database:true}",
    );
    expect(controlPlane).toContain(
      "ACTIVE_HEALTHY",
    );
    expect(controlPlane).toContain(
      "reviewed production trigger",
    );
    expect(controlPlane).toContain(
      "queryViaLinkedCli",
    );
    expect(controlPlane).toContain(
      "production temporary access disabled at rest",
    );
    expect(controlPlane).toContain(
      "mappingChanged",
    );
    expect(controlPlane).toContain(
      "createJitPoolWithRetry",
    );
    expect(controlPlane).toContain(
      "EJITREQUESTFAILED",
    );
    expect(controlPlane).toContain(
      "JIT database session ready",
    );
    expect(controlPlane).toContain(
      "PRE_APPLY_BASELINE",
    );
    expect(controlPlane).toContain(
      "POST_APPLY_BASELINE",
    );
    expect(controlPlane).toContain(
      "accepted historical Track post-apply baseline detected",
    );
    expect(controlPlane).toContain(
      "POST-APPLY PREFLIGHT PASS",
    );
    expect(controlPlane).toContain(
      "refusing repeat production mutation",
    );
    expect(controlPlane).toContain(
      "registry_entity_type='track'",
    );
    expect(controlPlane).toContain(
      "EXPECTED_FINGERPRINT",
    );
    expect(controlPlane).toContain(
      "EXPECTED_BLOBS",
    );
    expect(controlPlane).toContain(
      "MIZIZI_EXPECTED_MAIN_SHA",
    );
    expect(controlPlane).toContain(
      "MIZIZI_TRACK_PRODUCTION_APPLY",
    );
    expect(controlPlane).toContain(
      "originalState",
    );
    expect(controlPlane).toContain(
      "originalRoles",
    );
    expect(controlPlane).not.toContain(
      "database password",
    );
    expect(controlPlane).not.toContain(
      "mizizi_production_runner_",
    );
  });

  it("keeps the runtime bounded, review-aware, and provenance-preserving", () => {
    const runner =
      readFileSync(
        "scripts/registry/agents/mizizi/run.ts",
        "utf8",
      );

    expect(runner).toContain(
      "MAX_SAMPLE_FINDINGS = 30",
    );
    expect(runner).not.toContain(
      "const allFindings",
    );
    expect(runner).not.toMatch(
      /\boffset\b/i,
    );
    expect(runner).toContain(
      "hashtextextended(",
    );
    expect(runner).toContain(
      "ta.is_primary is true",
    );
    expect(runner).toContain(
      "order by ta.artist_slug, t.id::text",
    );
    expect(runner).not.toContain(
      "order by ta.artist_slug, t.id\n",
    );
    expect(runner).toContain(
      "registry_review_items",
    );
    expect(runner).toContain(
      'finding.disposition ===\n          "observe"',
    );
    expect(runner).toContain(
      "observed_findings",
    );
    expect(runner).toContain(
      "registry_canonical_write_events",
    );
    expect(runner).toContain(
      "wk_slug_redirects",
    );
    expect(runner).toContain(
      "--confirm=MIZIZI_APPLY",
    );
    expect(runner).toContain(
      "pg_advisory_xact_lock(",
    );
    expect(runner).toContain(
      "repairCurrentTrackPointers",
    );
    expect(runner).toContain(
      "communityThreadOwnershipConflict",
    );
    expect(runner).toContain(
      "community_saves",
    );
    expect(runner).toContain(
      "community_threads",
    );
    expect(runner).toContain(
      "resolvable_active_track_count",
    );
    expect(runner).toContain(
      "applyReleaseTaxonomy",
    );
    expect(runner).toContain(
      "begin isolation level serializable",
    );
    expect(runner).toContain(
      "releaseTaxonomyFromActiveTrackCount",
    );
    expect(runner).toContain(
      "coalesce(\n            btrim(release_type),",
    );
    expect(runner).not.toContain(
      "community_activity",
    );
    expect(runner).not.toContain(
      "analytics_events",
    );
  });
});
