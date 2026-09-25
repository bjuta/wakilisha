import { existsSync, readFileSync, readdirSync } from "node:fs";
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

  it("routes explicit feature-credit slug evidence gaps to human review without auto-mutation", () => {
    const findings =
      analyzeTrackIdentity({
        id: "track-credit-gap",
        slug:
          "confirmation-feat-mr-ree",
        title:
          "Confirmation (feat. Mr Ree)",
        primaryArtistSlug:
          "lead-artist",
        primaryArtistName:
          "Lead Artist",
        featuredArtists: [],
      });

    expect(findings).toContainEqual(
      expect.objectContaining({
        ruleId:
          "track_slug_credit_evidence_gap",
        ruleVersion: "1.3.0",
        fieldName: "slug",
        currentValue:
          "confirmation-feat-mr-ree",
        proposedValue:
          "confirmation",
        disposition: "review",
        confidence: 1,
      }),
    );

    expect(
      findings.some(
        (finding) =>
          finding.ruleId ===
            "track_slug_identity_noise" &&
          finding.disposition ===
            "auto_fix_candidate",
      ),
    ).toBe(false);
  });

  it("does not treat ordinary With, And, or X title language as feature-credit evidence", () => {
    for (const title of [
      "You And Me",
      "Dance With Me",
      "X Marks the Spot",
    ]) {
      const findings =
        analyzeTrackIdentity({
          id:
            "track-" +
            slugifyIdentity(title),
          slug:
            slugifyIdentity(title),
          title,
          primaryArtistSlug:
            "lead-artist",
          featuredArtists: [],
        });

      expect(
        findings.some(
          (finding) =>
            finding.ruleId ===
            "track_slug_credit_evidence_gap",
        ),
      ).toBe(false);
    }
  });

  it("requires human recording-identity review for same-Artist same-title peers even when ISRC differs", () => {
    const findings =
      analyzeTrackIdentity({
        id: "track-a",
        slug: "same-song",
        title: "Same Song",
        isrc: "KEAAA2600001",
        primaryArtistSlug:
          "same-artist",
        featuredArtists: [],
        recordingIdentityPeers: [
          {
            id: "track-b",
            slug: "same-song-2",
            title: "Same Song",
            isrc: "KEAAA2600002",
            sharedPrimaryArtistSlug:
              "same-artist",
          },
        ],
      });

    expect(findings).toContainEqual(
      expect.objectContaining({
        ruleId:
          "track_recording_identity_conflict",
        ruleVersion: "1.3.0",
        fieldName:
          "recording_identity",
        currentValue: "track-a",
        proposedValue:
          "human_review_required",
        disposition: "review",
      }),
    );

    const conflict =
      findings.find(
        (finding) =>
          finding.ruleId ===
          "track_recording_identity_conflict",
      );

    expect(
      conflict?.evidence,
    ).toMatchObject({
      isrc: "KEAAA2600001",
      identityPolicy:
        "different_isrc_is_evidence_not_automatic_distinct_recording_proof",
    });
  });

  it("keeps Public Music Identity Slice 2 review authority bounded to the narrow MIZIZI executor", () => {
    const migration = readFileSync(
      "supabase/migrations/20260924193138_public_music_identity_slice2_review_authority_v1.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-public-music-identity-slice2-review-authority.sql",
      "utf8",
    );
    const runner = readFileSync(
      "scripts/registry/agents/mizizi/run.ts",
      "utf8",
    );

    expect(migration).toContain(
      "queue_public_music_identity_review_v1",
    );
    expect(migration).toContain(
      "security definer",
    );
    expect(migration).toContain(
      "perform mizizi_private.assert_executor_v1()",
    );
    expect(migration).toContain(
      "p_rule_version <> '1.3.0'",
    );
    expect(migration).toContain(
      "track_slug_credit_evidence_gap",
    );
    expect(migration).toContain(
      "track_recording_identity_conflict",
    );
    expect(migration).toContain(
      "human_review_required",
    );
    expect(migration).toContain(
      "insert into public.registry_review_items",
    );
    expect(migration).toContain(
      "to mizizi_executor",
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
    expect(migration).not.toContain(
      "update public.registry_tracks",
    );
    expect(migration).not.toContain(
      "update public.registry_track_artists",
    );
    expect(migration).not.toContain(
      "insert into public.wk_slug_redirects",
    );
    expect(migration).not.toContain(
      "insert into public.registry_canonical_write_events",
    );

    expect(verifier).toContain(
      "PUBLIC_MUSIC_IDENTITY_SLICE2_REVIEW_AUTHORITY_PASS",
    );
    expect(verifier).toContain(
      "accepted MIZIZI 1.2.0 review broker semantics drifted",
    );
    expect(verifier).toContain(
      "Slice 2 review broker is exposed to application roles",
    );

    expect(runner).toContain(
      "queue_public_music_identity_review_v1",
    );
    expect(runner).toContain(
      'finding.ruleVersion === "1.3.0"',
    );
    expect(runner).toContain(
      "queue_registry_review_v1",
    );
  });

  it("seals the Slice 2 review-broker regex hotfix against double escaping", () => {
    const hotfix = readFileSync(
      "supabase/migrations/20260925050859_public_music_identity_slice2_review_broker_regex_fix.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-public-music-identity-slice2-review-broker-regex-fix.sql",
      "utf8",
    );

    expect(hotfix).toContain(
      "create or replace function mizizi_private.queue_public_music_identity_review_v1",
    );
    expect(hotfix).toContain(
      String.raw`$regex$\([^)]*\y(feat(uring)?|ft)\.?[[:space:]]+[^)]*\)$regex$`,
    );
    expect(hotfix).toContain(
      String.raw`$regex$[[:space:]]+(-|:)?[[:space:]]*\y(feat(uring)?|ft)\.?`,
    );
    expect(hotfix).not.toContain(
      String.raw`$regex$\\([^)]*\\y`,
    );
    expect(hotfix).toContain(
      "perform mizizi_private.assert_executor_v1()",
    );
    expect(hotfix).toContain(
      "to mizizi_executor",
    );
    expect(hotfix).not.toContain(
      "update public.registry_tracks",
    );
    expect(hotfix).not.toContain(
      "update public.registry_track_artists",
    );
    expect(hotfix).not.toContain(
      "insert into public.wk_slug_redirects",
    );
    expect(hotfix).not.toContain(
      "insert into public.registry_canonical_write_events",
    );

    expect(verifier).toContain(
      "44 conflict groups / 91 Tracks",
    );
    expect(verifier).toContain(
      "PUBLIC_MUSIC_IDENTITY_SLICE2_REVIEW_BROKER_REGEX_FIX_PASS",
    );
    expect(verifier).toContain(
      "corrected single-backslash feature regex is missing",
    );
    expect(verifier).toContain(
      "doubled-backslash feature regex remains in broker definition",
    );
  });

  it("keeps Slice 3 review materialization unable to enter canonical mutation paths", () => {
    const runner = readFileSync(
      "scripts/registry/agents/mizizi/run.ts",
      "utf8",
    );
    const packageJson = readFileSync(
      "package.json",
      "utf8",
    );
    const trackWorkflow = readFileSync(
      ".github/workflows/mizizi-track-production-control-plane.yml",
      "utf8",
    );
    const trackControlPlane = readFileSync(
      "scripts/control-plane/mizizi-track-production-control-plane.mjs",
      "utf8",
    );

    expect(runner).toContain(
      'type RunMode = "audit" | "review" | "apply";',
    );
    expect(runner).toContain(
      '["audit", "review", "apply"]',
    );
    expect(
      runner.match(
        /options\.mode === "review"/g,
      ),
    ).toHaveLength(5);
    expect(runner).toContain(
      "Review mode completed. No canonical Registry rows were changed.",
    );
    expect(packageJson).toContain(
      '"registry:mizizi:review": "tsx scripts/registry/agents/mizizi/run.ts --mode=review"',
    );

    const trackGuard =
      runner.indexOf(
        'options.mode === "review"',
        runner.indexOf(
          "async function scanTracks",
        ),
      );
    const trackApply =
      runner.indexOf(
        "await applyTrackSlug(",
        trackGuard,
      );
    expect(trackGuard).toBeGreaterThan(-1);
    expect(trackApply).toBeGreaterThan(trackGuard);

    const releaseGuard =
      runner.indexOf(
        'options.mode === "review"',
        runner.indexOf(
          "async function scanReleases",
        ),
      );
    const releaseApply =
      runner.indexOf(
        "await applyReleaseTaxonomy(",
        releaseGuard,
      );
    expect(releaseGuard).toBeGreaterThan(-1);
    expect(releaseApply).toBeGreaterThan(
      releaseGuard,
    );

    const chartGuard =
      runner.indexOf(
        'options.mode === "review"',
        runner.indexOf(
          "async function scanCharts",
        ),
      );
    const chartApply =
      runner.indexOf(
        "await applyChartSlug(",
        chartGuard,
      );
    expect(chartGuard).toBeGreaterThan(-1);
    expect(chartApply).toBeGreaterThan(
      chartGuard,
    );

    expect(trackWorkflow).toContain(
      ".github/mizizi-track-production-review.json",
    );
    expect(trackWorkflow).toContain(
      "Resolve reviewed Production intent",
    );
    expect(trackWorkflow).toContain(
      "MIZIZI_CONTROL_PLANE_MODE=review",
    );
    expect(trackControlPlane).toContain(
      "EXPECTED_REVIEW_INPUT_FINGERPRINT",
    );
    expect(trackControlPlane).toContain(
      "6d9fa72f13ce4a5d774a457552e3cd3824475fb8a651473d5999605a3dcc29fb",
    );
    expect(trackControlPlane).toContain(
      "mizizi_track_production_review",
    );
    expect(trackControlPlane).toContain(
      "MIZIZI_TRACK_PRODUCTION_REVIEW",
    );
    expect(trackControlPlane).toContain(
      "'registry:mizizi:review'",
    );
    expect(trackControlPlane).toContain(
      "open_mizizi_reviews",
    );
    expect(trackControlPlane).toContain(
      "credit_gap_reviews",
    );
    expect(trackControlPlane).toContain(
      "recording_identity_reviews",
    );
    expect(
      (
        trackControlPlane.match(
          /source_payload->>'ruleId'='track_slug_identity_noise'/g,
        ) || []
      ).length,
    ).toBeGreaterThanOrEqual(4);
    expect(trackControlPlane).toContain(
      "review materialization exact 12 + 91 = 103 with canonical delta zero",
    );
    expect(trackControlPlane).toContain(
      "MIZIZI PUBLIC MUSIC IDENTITY REVIEW MATERIALIZATION PASS",
    );

    const reviewCommand =
      trackControlPlane.indexOf(
        "'registry:mizizi:review'",
      );
    const historicalApplyCommand =
      trackControlPlane.indexOf(
        "'registry:mizizi:apply'",
      );
    expect(reviewCommand).toBeGreaterThan(-1);
    expect(
      historicalApplyCommand,
    ).toBeGreaterThan(reviewCommand);
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

  it("uses MIZIZI rule-set 1.2.0 for governed Release identity repair", () => {
    expect(MIZIZI_RULESET_VERSION).toBe(
      "1.2.0",
    );
  });

  it("observes Release title packaging while making packaged slugs governed repair candidates", () => {
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
          disposition:
            "auto_fix_candidate",
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

  it("does not auto-fix a packaged-looking slug without independent title packaging proof", () => {
    expect(
      analyzeReleaseIdentity({
        id: "release-ambiguous-packaging",
        slug: "enlightened-ep",
        title: "Enlightened EP",
        releaseType: "ep",
      }),
    ).toEqual([]);
  });

  it("keeps provider packaging cleanup independent from Registry taxonomy", () => {
    const findings =
      analyzeReleaseIdentity({
        id: "release-taxonomy-packaging-disagreement",
        slug: "project-single",
        title: "Project - Single",
        releaseType: "ep",
      });

    expect(findings).toContainEqual(
      expect.objectContaining({
        ruleId:
          "release_slug_provider_packaging",
        currentValue:
          "project-single",
        proposedValue:
          "project",
        disposition:
          "auto_fix_candidate",
      }),
    );
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

  it("converges chart runtime onto caller-JWT and governed Registry authority", () => {
    const adminRouter=readFileSync("supabase/functions/admin-router/index.ts","utf8");
    const adminRouterSpec=readFileSync("src/data/api-specs/admin-router.ts","utf8");
    const adminRouterOpenApi=readFileSync("docs/openapi/admin-router.yaml","utf8");
    const productionAdapter=readFileSync("src/services/chartsIngestion/productionAdapter.ts","utf8");
    const chartIngest=readFileSync("supabase/functions/chart-ingest-api/index.ts","utf8");
    const providerFetch=readFileSync("supabase/functions/chart-provider-fetch/index.ts","utf8");
    const migration=readFileSync("supabase/migrations/20260915122100_chart_runtime_caller_jwt_convergence_v1.sql","utf8");
    const manifest=JSON.parse(readFileSync("scripts/control-plane/registry-privileged-writer-manifest.json","utf8")) as {writers:Array<{id:string;executionAuthority:string;canonicalMutation:boolean}>};
    expect(chartIngest).toContain("SUPABASE_ANON_KEY"); expect(chartIngest).not.toContain("SUPABASE_SERVICE_ROLE_KEY"); expect(chartIngest).not.toContain("admin_settings_secrets"); expect(chartIngest).toContain("/functions/v1/chart-provider-fetch"); expect(chartIngest).toContain("chart_materialize_candidate_registry_v1"); expect(chartIngest).toContain("chart_admit_artist_origin_v1"); expect(chartIngest).toContain("chart_create_artist_origin_shell_v1"); expect(chartIngest).not.toContain("chart_set_artist_origin_for_charts");
    expect(providerFetch).toContain("SUPABASE_SERVICE_ROLE_KEY"); expect(providerFetch).toContain("admin_settings_secrets"); expect(providerFetch).toContain('required_capability: "manage_ingest"'); expect(providerFetch).not.toContain("registry_");
    expect(productionAdapter).toContain('supabase.functions.invoke("chart-ingest-api"');
    expect(adminRouter).toContain('sections:["registry","credentials","users","content"]');
    expect(adminRouter).not.toContain("const ACS:any="); expect(adminRouter).not.toContain("async function hCh("); expect(adminRouter).not.toContain('section==="charts"'); expect(adminRouter).not.toContain("return hCh(");
    expect(adminRouterSpec).not.toContain('"/charts"'); expect(adminRouterSpec).not.toContain('name: "Charts"');
    expect(adminRouterOpenApi).not.toContain("\n  /charts:"); expect(adminRouterOpenApi).not.toContain("name: Charts");
    expect(manifest.writers.find(w=>w.id==="chart-ingest-api")).toMatchObject({executionAuthority:"caller_jwt_rls_plus_typed_registry_operations",canonicalMutation:false});
    expect(migration).toContain("chart_get_entry_registry_identity_v1"); expect(migration).toContain("revoke all on function public.chart_set_artist_origin_for_charts"); expect(migration).not.toContain("wk_chart_editions_v2_publish_charts_insert_v1");
  });

  it("keeps MIZIZI post-apply control planes valid across later migrations", () => {
    const trackControlPlane=readFileSync("scripts/control-plane/mizizi-track-production-control-plane.mjs","utf8");
    const releaseControlPlane=readFileSync("scripts/control-plane/mizizi-release-production-control-plane.mjs","utf8");
    for(const controlPlane of [trackControlPlane,releaseControlPlane]){
      expect(controlPlane).toContain("postApplyDomainFieldsMatch");
      expect(controlPlane).toContain("postApplyLedgerAccepted");
      expect(controlPlane).toMatch(/actualCount\s*>=\s*minimumCount/);
      expect(controlPlane).toMatch(/actualHead\s*>=\s*minimumHead/);
    }
  });

  it("binds remaining live Registry Track writers and governed Discography to canonical identity authority", () => {
    const sharedRule =
      readFileSync(
        "supabase/functions/_shared/registry-track-identity.ts",
        "utf8",
      );
    const discographyEntrypoint =
      readFileSync(
        "supabase/functions/ingest-artist-discography/index.ts",
        "utf8",
      );
    const discographyAuthority =
      readFileSync(
        "supabase/migrations/20260916055145_registry_discography_review_authority_v1.sql",
        "utf8",
      );

    expect(sharedRule).toContain(
      "canonicalTrackSlugCandidate",
    );
    expect(discographyEntrypoint).toContain(
      'from "./governedHandler.ts"',
    );
    expect(discographyEntrypoint).not.toContain(
      "canonicalTrackSlugCandidate",
    );
    expect(discographyAuthority).toContain(
      "platform_private.registry_discography_resolve_track_v1(",
    );
    expect(discographyAuthority).toContain(
      "platform_private.registry_track_creation_slug_v1(",
    );
    expect(
      existsSync(
        "supabase/functions/registry-enrichment-review/index.ts",
      ),
    ).toBe(false);
    expect(
      existsSync(
        "supabase/functions/scrape-artist-data/index.ts",
      ),
    ).toBe(false);
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

  it("reconciles reviewed credits onto existing Tracks without exact-set deletion semantics", () => {
    const migration = read(
      "supabase/migrations/20260921143000_registry_track_intake_existing_track_credit_reconcile_authority_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-registry-track-intake-existing-track-credit-reconcile-authority.sql",
    );

    expect(migration).toContain(
      "'registry.track_artist_credit.reviewed_reconcile'",
    );
    expect(migration).toContain(
      "'reconcile_registry_track_reviewed_artist_credit'",
    );
    expect(migration).toContain(
      "'track_intake_review'",
    );
    expect(migration).toContain(
      "'INTERNAL_FACT'",
    );
    expect(migration).toContain(
      "'already_current'",
    );
    expect(migration).toContain(
      "track.status in ('draft','active')",
    );
    expect(migration).toContain(
      "metadata->>'source_credit_id'",
    );
    expect(migration).toContain(
      "'reconcile_reviewed_credit'",
    );
    expect(migration).not.toContain(
      "apple_music_ingest",
    );
    expect(migration).not.toContain(
      "delete from public.registry_track_artists",
    );
    expect(migration).not.toContain(
      "registry.track_artist_credit.admit",
    );
    expect(verifier).toContain(
      "REGISTRY_TRACK_INTAKE_EXISTING_TRACK_CREDIT_RECONCILE_AUTHORITY_PASS",
    );
  });


  it("admits one reviewed Release-primary Artist onto an existing Track without overwriting credits", () => {
    const migration = read(
      "supabase/migrations/20260925172710_public_music_identity_track_primary_from_release_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-public-music-identity-track-primary-from-release-v1.sql",
    );
    const inventoryVerifier = read(
      "scripts/control-plane/verify-registry-canonical-writer-inventory.sql",
    );
    const manifest = read(
      "scripts/control-plane/registry-privileged-writer-manifest.json",
    );

    expect(migration).toContain(
      "'registry.track_artist_credit.release_primary_reviewed_admit'",
    );
    expect(migration).toContain(
      "'admit_registry_track_primary_from_release_review'",
    );
    expect(migration).toContain(
      "'registry_release_primary_admin'",
    );
    expect(migration).toContain(
      "'release_primary_review'",
    );
    expect(migration).toContain(
      "'track_slug_identity_noise'",
    );
    expect(migration).toContain(
      "review.source_payload->>'ruleVersion'='1.1.0'",
    );
    expect(migration).not.toContain(
      "review.source_payload->>'ruleVersion'='1.2.0'",
    );
    expect(migration).toContain(
      "'track_slug_credit_evidence_gap'",
    );
    expect(migration).toContain(
      "review.source_payload->>'ruleVersion'='1.3.0'",
    );
    expect(migration).toContain(
      "registry_track_artist_credit_collision_state_v1",
    );
    expect(migration).toContain(
      "v_membership_count<>1",
    );
    expect(migration).toContain(
      "v_release_primary_count<>1",
    );
    expect(
      (migration.match(/and credit\.artist_id is not null/g) || []).length,
    ).toBeGreaterThanOrEqual(3);
    expect(migration).toContain(
      "v_track_primary_count=0",
    );
    expect(migration).toContain(
      "v_exact_current_count=1",
    );
    expect(migration).toContain(
      "'already_current'",
    );
    expect(migration).toContain(
      "registry_execution_target_set_fingerprint",
    );
    expect(migration).toContain(
      "v_operation.status<>'authorized'",
    );
    expect(migration).toContain(
      "pg_advisory_xact_lock",
    );
    expect(migration).toContain(
      "insert into public.registry_track_artists",
    );
    expect(migration).not.toContain(
      "update public.registry_track_artists",
    );
    expect(migration).not.toContain(
      "delete from public.registry_track_artists",
    );
    expect(migration).not.toContain(
      "'chart_admission'",
    );
    expect(migration).not.toContain(
      "'track_intake_review'",
    );
    expect(verifier).toContain(
      "PUBLIC_MUSIC_IDENTITY_TRACK_PRIMARY_FROM_RELEASE_V1_PASS",
    );
    expect(manifest).toContain(
      "admin-admit-registry-track-primary-from-release-v1",
    );
    expect(inventoryVerifier).toContain(
      "public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)",
    );
  });

  it("adds provider-neutral reviewed Release profile authority without creating Releases or Labels", () => {
    const migration = read(
      "supabase/migrations/20260921140000_registry_track_intake_release_reviewed_profile_authority_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-registry-track-intake-release-reviewed-profile-authority.sql",
    );

    expect(migration).toContain(
      "'registry.release.reviewed_profile.admit'",
    );
    expect(migration).toContain(
      "'admit_registry_release_reviewed_profile'",
    );
    expect(migration).toContain(
      "registry_track_intake_release_label_match_state_v1",
    );
    expect(migration).toContain(
      "'INTERNAL_FACT'",
    );
    expect(migration).toContain(
      "'label_name_observation'",
    );
    expect(migration).toContain(
      "'imprint_name'",
    );
    expect(migration).toContain(
      "'copyright_text'",
    );
    expect(migration).toContain(
      "'provider_genre'",
    );
    expect(migration).not.toContain(
      "apple_music_ingest",
    );
    expect(migration).not.toContain(
      "track_intake_enriched_at",
    );
    expect(migration).not.toContain(
      "insert into public.registry_releases",
    );
    expect(migration).not.toContain(
      "insert into public.registry_labels",
    );
    expect(verifier).toContain(
      "REGISTRY_TRACK_INTAKE_RELEASE_REVIEWED_PROFILE_AUTHORITY_PASS",
    );
  });

  it("adds provider-neutral reviewed Track profile authority without Apple-Music provenance", () => {
    const migration = read(
      "supabase/migrations/20260921133000_registry_track_intake_track_reviewed_profile_authority_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-registry-track-intake-track-reviewed-profile-authority.sql",
    );

    expect(migration).toContain(
      "'registry.track.reviewed_profile.admit'",
    );
    expect(migration).toContain(
      "'admit_registry_track_reviewed_profile'",
    );
    expect(migration).toContain(
      "'INTERNAL_FACT'",
    );
    expect(migration).toContain(
      "registry_subject_state_fingerprint",
    );
    expect(migration).toContain(
      "provider_genre",
    );
    expect(migration).toContain(
      "p_allow_overwrite",
    );
    expect(migration).toContain(
      "'track-profile-v1:'",
    );
    expect(migration).not.toContain(
      "'track-intake-track-profile-v1:'",
    );
    expect(migration).not.toContain(
      "apple_music_ingest",
    );
    expect(migration).not.toContain(
      "track_intake_enriched_at",
    );
    expect(verifier).toContain(
      "REGISTRY_TRACK_INTAKE_TRACK_REVIEWED_PROFILE_AUTHORITY_PASS",
    );
  });

  it("adds exact reviewed Track activation without merging it into identity creation", () => {
    const migration = read(
      "supabase/migrations/20260921130000_registry_track_intake_track_activation_authority_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-registry-track-intake-track-activation-authority.sql",
    );

    expect(migration).toContain(
      "'registry.track.activate'",
    );
    expect(migration).toContain(
      "'activate_registry_track'",
    );
    expect(migration).toContain(
      "registry_subject_state_fingerprint",
    );
    expect(migration).toContain(
      "registry_track_intake_activation_credit_state_v1",
    );
    expect(migration).toContain(
      "'from_status','draft'",
    );
    expect(migration).toContain(
      "'to_status','active'",
    );
    expect(migration).toContain(
      "set status='active'",
    );
    expect(migration).toContain(
      "errcode='23514'",
    );
    expect(verifier).toContain(
      "REGISTRY_TRACK_INTAKE_TRACK_ACTIVATION_AUTHORITY_PASS",
    );
  });


  it("finalizes Track Intake workflow only after governed child authority is exact", () => {
    const migration = read(
      "supabase/migrations/20260921150000_registry_track_intake_workflow_finalization_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-registry-track-intake-workflow-finalization.sql",
    );
    const intakePage = read(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );

    expect(migration).toContain(
      "'credit_id',credit.id",
    );
    expect(migration).toContain(
      "registry.track_artist_credit.reviewed_reconcile",
    );
    expect(migration).toContain(
      "registry.track.create",
    );
    expect(migration).toContain(
      "registry.track.activate",
    );
    expect(migration).toContain(
      "registry_track_provider_links",
    );
    expect(migration).toContain(
      "admin_finalize_registry_track_intake_v1",
    );
    expect(migration).toContain(
      "insert into public.provider_entity_links",
    );
    expect(migration).not.toContain(
      "insert into public.registry_tracks",
    );
    expect(migration).not.toContain(
      "update public.registry_tracks",
    );
    expect(migration).not.toContain(
      "insert into public.registry_track_artists",
    );
    expect(migration).not.toContain(
      "update public.registry_track_artists",
    );
    expect(migration).not.toContain(
      "update public.registry_releases",
    );
    expect(migration).not.toContain(
      "insert into public.registry_track_provider_links",
    );

    expect(verifier).toContain(
      "REGISTRY_TRACK_INTAKE_WORKFLOW_FINALIZATION_PASS",
    );

    expect(intakePage).toContain(
      "credit_id: string",
    );
    expect(intakePage).toContain(
      "admin_finalize_registry_track_intake_v1",
    );
  });

  it("installs Track Intake Track Create V2 behind the governed Track Intake caller", () => {
    const migration = read(
      "supabase/migrations/20260921120000_registry_track_intake_track_create_v2_foundation.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-registry-track-intake-track-create-v2-foundation.sql",
    );
    const intakePage = read(
      "src/pages/admin/registry/tracks/intake/page.tsx",
    );

    expect(migration).toContain(
      "'registry.track.create',\n  2,",
    );
    expect(migration).toContain(
      "registry_track_intake_admin",
    );
    expect(migration).toContain(
      "registry_track_creation_collision_state_v2",
    );
    expect(migration).toContain(
      "admin_create_registry_track_intake_identity_v1",
    );
    expect(migration).toContain(
      "'registry-track-create-v2'",
    );
    expect(migration).toContain(
      "errcode='23514'",
    );
    expect(migration).toContain(
      "'track_intake_review'",
    );
    expect(migration).toContain(
      "from public, anon, service_role;",
    );
    expect(migration).toContain(
      "'draft'",
    );
    expect(migration).not.toContain(
      "drop function public.admin_create_registry_track_from_intake_enriched",
    );
    expect(migration).not.toContain(
      "drop function public.admin_resolve_registry_track_intake_enriched",
    );

    expect(verifier).toContain(
      "REGISTRY_TRACK_INTAKE_TRACK_CREATE_V2_FOUNDATION_PASS",
    );
    expect(verifier).toContain(
      "Track Create V1 was disturbed by V2 foundation",
    );

    expect(intakePage).toContain(
      "admin_create_registry_track_intake_identity_v1",
    );
    expect(intakePage).toContain(
      "admin_reconcile_registry_track_intake_credit_v1",
    );
    expect(intakePage).toContain(
      "admin_admit_registry_track_intake_track_profile_v1",
    );
    expect(intakePage).toContain(
      "admin_admit_registry_track_intake_release_profile_v1",
    );
    expect(intakePage).toContain(
      "admin_admit_registry_track_provider_link_v1",
    );
    expect(intakePage).toContain(
      "admin_activate_registry_track_intake_v1",
    );
    expect(intakePage).toContain(
      "admin_finalize_registry_track_intake_v1",
    );
    expect(intakePage).not.toContain(
      "admin_create_registry_track_from_intake_enriched",
    );
    expect(intakePage).not.toContain(
      "admin_resolve_registry_track_intake_enriched",
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
      "resolveMiziziTransportRole",
    );
    expect(controlPlane).toContain(
      "databaseUrl(transportRole)",
    );
    expect(controlPlane).toContain(
      "mizizi_stage_c_narrow_executor_transport_v1",
    );
    expect(controlPlane).toContain(
      "return 'postgres'",
    );
    expect(controlPlane).toContain(
      "return 'mizizi_executor'",
    );
    expect(controlPlane).not.toContain(
      "aws-0-",
    );
    expect(controlPlane).toContain(
      "role:transportRole",
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
      "database session ready on attempt",
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

  it("retires public-content redirect writers and seals the historical redirect table", () => {
    const migrations =
      readdirSync(
        "supabase/migrations",
      ).filter(
        (name) =>
          name.endsWith(
            "_phase_9a3_public_redirect_writer_retirement.sql",
          ),
      );

    expect(migrations).toHaveLength(
      1,
    );

    const migration =
      readFileSync(
        "supabase/migrations/" +
          migrations[0],
        "utf8",
      );

    expect(migration).toContain(
      "save_article_versioned",
    );
    expect(migration).toContain(
      "apply_article_correction",
    );
    expect(migration).not.toContain(
      "insert into public.wk_slug_redirects",
    );
    expect(migration).toContain(
      "wk_slug_redirects_historical_read_only",
    );
    expect(migration).toContain(
      "reject_slug_redirect_mutation",
    );
  });

  it("keeps the runtime bounded, review-aware, and provenance-preserving", () => {
    const runner =
      readFileSync(
        "scripts/registry/agents/mizizi/run.ts",
        "utf8",
      );
    const stageBMigrations =
      readdirSync(
        "supabase/migrations",
      ).filter(
        (name) =>
          name.endsWith(
            "_mizizi_stage_b_broker_convergence_v1.sql",
          ),
      );

    expect(stageBMigrations).toHaveLength(1);

    const brokerMigration =
      readFileSync(
        "supabase/migrations/" +
          stageBMigrations[0],
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
    expect(runner).toMatch(
      /finding\.disposition\s*===\s*"observe"/,
    );
    expect(runner).toContain(
      "observed_findings",
    );
    expect(runner).toContain(
      "registry_canonical_write_events",
    );
    expect(runner).not.toContain(
      "insert into public.wk_slug_redirects",
    );
    expect(runner).not.toContain(
      "ensureRedirect(",
    );
    expect(runner).toContain(
      "loadReleaseSlugPlan",
    );
    expect(runner).toContain(
      "applyReleaseSlugPackaging",
    );
    expect(runner).not.toContain(
      "platform_private.send_system_message",
    );
    expect(runner).toContain(
      "send_operational_standup_v1",
    );
    expect(runner).toContain(
      "--confirm=MIZIZI_APPLY",
    );
    expect(runner).toContain(
      "issue_stewardship_execution_grant_v1",
    );
    expect(runner).toContain(
      "execute_stewardship_operation_v1",
    );
    expect(runner).toContain(
      "verify_stewardship_operation_v1",
    );
    expect(runner).toContain(
      "queue_registry_review_v1",
    );
    expect(runner).toContain(
      "resolvable_active_track_count",
    );
    expect(runner).toContain(
      "applyReleaseTaxonomy",
    );

    expect(runner).not.toContain(
      "pg_advisory_xact_lock(",
    );
    expect(runner).not.toContain(
      "repairCurrentTrackPointers",
    );
    expect(runner).not.toContain(
      "begin isolation level serializable",
    );

    expect(brokerMigration).toContain(
      "pg_advisory_xact_lock(",
    );
    expect(brokerMigration).toContain(
      "update public.registry_tracks",
    );
    expect(brokerMigration).toContain(
      "update public.registry_releases",
    );
    expect(brokerMigration).toContain(
      "update public.wk_chart_entries_v2",
    );
    expect(brokerMigration).toContain(
      "update public.community_saves",
    );
    expect(brokerMigration).toContain(
      "update public.community_threads",
    );
    expect(brokerMigration).toContain(
      "update public.audience_interests",
    );
    expect(brokerMigration).toContain(
      "update public.community_activity",
    );
    expect(brokerMigration).toContain(
      "update public.community_contributions",
    );
    expect(brokerMigration).toContain(
      "update public.community_notifications",
    );
    expect(brokerMigration).toContain(
      "update public.signal_os_content_opportunities",
    );
    expect(brokerMigration).toContain(
      "insert into public.registry_canonical_write_events",
    );
    expect(brokerMigration).toContain(
      "insert into platform_private.registry_operation_write_events",
    );
    expect(brokerMigration).toContain(
      "registry_subject_state_fingerprint",
    );
    expect(brokerMigration).toContain(
      "compare-and-set",
    );
    expect(brokerMigration).not.toContain(
      "insert into public.wk_slug_redirects",
    );

    expect(runner).not.toContain(
      "analytics_events",
    );
    expect(runner).not.toContain(
      "signal_os_entity_daily_metrics",
    );
    expect(runner).not.toContain(
      "signal_os_entity_signal_scores",
    );
    expect(runner).not.toContain(
      '"wk_slug_redirects",',
    );
  });
});

const read = (path: string) => readFileSync(path, "utf8");

describe("MIZIZI Slice 2 Gate A-final Registry authority convergence", () => {
  it("binds Artist intake to the signed-in caller JWT", () => {
    const page = read("src/pages/admin/registry/artists/intake/page.tsx");
    const config = read("supabase/config.toml");

    expect(page).toContain("supabase.auth.getSession()");
    expect(page).toContain("session?.access_token");
    expect(page).not.toContain("VITE_PUBLIC_SUPABASE_ANON_KEY");
    expect(config).toMatch(
      /\[functions\.artist-registry-intake\]\s*\nverify_jwt = true/,
    );
  });

  it("keeps the Artist intake Edge function out of canonical Artist DML", () => {
    const edge = read("supabase/functions/artist-registry-intake/index.ts");

    expect(edge).toContain("SUPABASE_ANON_KEY");
    expect(edge).toContain("current_user_has_capability");
    expect(edge).toContain("admin_review_registry_artist_intake_v1");
    expect(edge).toContain("admin_create_registry_artist_intake_shell_v1");
    expect(edge).toContain("admin_execute_registry_artist_origin_admission");
    expect(edge).toContain("admin_execute_registry_artist_enrichment_evidence_admission");
    expect(edge).toContain("admin_mark_registry_artist_intake_applied_v1");
    expect(edge).not.toMatch(/from\(["']registry_artists["']\)\s*\.\s*(insert|update|delete)/s);
    expect(edge).not.toContain("body.actor");
    expect(edge).not.toMatch(/const\s*\{[^}]*\bactor\b[^}]*\}\s*=\s*body/);
  });

  it("classifies Artist intake as an accepted governed Registry authority", () => {
    const manifest =
      JSON.parse(
        readFileSync(
          "scripts/control-plane/registry-privileged-writer-manifest.json",
          "utf8",
        ),
      ) as {
        writers: Array<{
          id: string;
          authentication: string;
          authorization: string;
          executionAuthority: string;
          targets: string[];
          riskClass: string;
          disposition: string;
          futureBoundary: string;
          miziziCallable: boolean;
          humanCallable: boolean;
          publicCallable: boolean;
          canonicalMutation: boolean;
          legacyDebt: boolean;
        }>;
      };

    const intake =
      manifest.writers.find(
        (writer) =>
          writer.id ===
          "artist-registry-intake",
      );

    expect(intake).toMatchObject({
      authentication: "request_bearer_user",
      authorization: "manage_registry",
      executionAuthority:
        "service_role_staging_and_reads_plus_caller_jwt_reviewed_registry_admissions",
      riskClass: "high",
      disposition: "keep",
      futureBoundary:
        "reviewed_artist_intake_typed_registry_admissions",
      miziziCallable: false,
      humanCallable: true,
      publicCallable: false,
      canonicalMutation: true,
      legacyDebt: false,
    });

    expect(intake?.targets).toEqual(
      expect.arrayContaining([
        "provider_intake_runs",
        "provider_intake_artist_staging",
        "registry_evidence_assertions",
        "registry_artists",
        "registry_canonical_write_events",
        "registry_operation_write_events",
        "registry_mutation_operations",
      ]),
    );
  });

  it("freezes reviewed CSV authority before canonical Artist mutation", () => {
    const migration = read(
      "supabase/migrations/20260916120000_registry_artist_intake_authority_v1.sql",
    );

    expect(migration).toContain("review_fingerprint");
    expect(migration).toContain("applied_registry_artist_id");
    expect(migration).toContain("registry_artist_intake_admin");
    expect(migration).toContain("registry.artist.create");
    expect(migration).toContain("csv_manual_upload");
    expect(migration).toContain("admin_create_registry_artist_intake_shell_v1");
  });

  it("replays deterministic Artist intake materialization before fresh collision discovery", () => {
    const migration = read(
      "supabase/migrations/20260916120300_registry_artist_intake_idempotent_replay_integrity_v1.sql",
    );

    const grantLookup = migration.indexOf("v_existing_grant");
    const collisionLookup = migration.indexOf(
      "registry_artist_creation_collision_state_v1",
    );

    expect(migration).toContain("artist-intake-create:");
    expect(migration).toContain("idempotent_replay");
    expect(migration).toContain("created',false");
    expect(grantLookup).toBeGreaterThan(-1);
    expect(collisionLookup).toBeGreaterThan(grantLookup);
  });

  it("keeps reviewed and applied Artist targets inside the active/draft boundary", () => {
    const migration = read(
      "supabase/migrations/20260916120400_registry_artist_intake_target_status_integrity_v1.sql",
    );

    expect(migration).toContain("artist.status in ('active','draft')");
    expect(migration).not.toContain("'needs_review'");
    expect(migration).toContain(
      "Artist intake target must be an active or draft Registry Artist.",
    );
    expect(migration).toContain(
      "Applied Artist intake result must resolve to an active or draft Registry Artist.",
    );
  });

  it("removes direct browser canonical Track mutation and preserves soft archive", () => {
    const track = read("src/pages/admin/registry/tracks/detail/page.tsx");
    const archiveClient = read("src/services/registry/admin/archiveClient.ts");
    const archiveAuthority = read(
      "supabase/migrations/20260916120200_registry_track_release_archive_authority_v1.sql",
    );

    expect(track).toContain("saveRegistryEntityPatch");
    expect(track).toContain("archiveRegistryTrack");
    expect(track).not.toContain("deleteRegistryEntity");
    expect(track).not.toMatch(/from\(["']registry_tracks["']\)\s*\.\s*update/s);
    expect(archiveClient).toContain("admin_archive_registry_music_entity_v1");
    expect(archiveAuthority).toContain("p_expected_updated_at");
    expect(archiveAuthority).toContain("status = 'archived'");
    expect(archiveAuthority).toContain("registry_audit_log");
    expect(archiveAuthority).toContain("registry_canonical_write_events");
    expect(archiveAuthority).not.toMatch(/delete\s+from\s+public\.registry_(tracks|releases)/i);
  });

  it("converges shared Admin Registry mutation onto bounded caller commands", () => {
    const adminRouter = read("supabase/functions/admin-router/index.ts");
    const client = read("src/services/registry/admin/client.ts");
    const artistsPage = read("src/pages/admin/registry/artists/page.tsx");
    const labelsPage = read("src/pages/admin/registry/labels/detail/page.tsx");
    const genresPage = read("src/pages/admin/registry/genres/detail/page.tsx");
    const migration = read(
      "supabase/migrations/20260920173000_admin_registry_profile_authority_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-admin-registry-profile-authority.sql",
    );

    expect(adminRouter).toContain("SUPABASE_ANON_KEY");
    expect(adminRouter).toContain("admin_patch_registry_artist_profile_v1");
    expect(adminRouter).toContain("admin_patch_registry_track_profile_v1");
    expect(adminRouter).toContain("admin_patch_registry_release_profile_v1");
    expect(adminRouter).toContain("admin_patch_registry_label_profile_v1");
    expect(adminRouter).toContain("admin_patch_registry_genre_profile_v1");
    expect(adminRouter).toContain("retired_registry_hard_delete");
    expect(adminRouter).not.toContain("admin_delete_registry_draft_artist_v1");
    expect(adminRouter).not.toMatch(
      /\.from\(\s*["']registry_(artists|tracks|releases|labels|genres)["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s,
    );

    expect(client).toContain("expectedUpdatedAt?: string");
    expect(client).toContain("payload._expected_updated_at = expectedUpdatedAt");
    expect(artistsPage).toContain("artist?.updated_at");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("current_user_has_capability('manage_registry')");
    expect(migration).toContain("registry_canonical_write_events");
    expect(artistsPage).toContain('{ status: "archived" }');
    expect(artistsPage).toContain("Archive");
    expect(artistsPage).not.toContain("deleteRegistryEntity");

    expect(labelsPage).toContain("admin_patch_registry_label_profile_v1");
    expect(labelsPage).not.toMatch(
      /from\(["']registry_labels["']\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s,
    );
    expect(genresPage).toContain("admin_patch_registry_genre_profile_v1");
    expect(genresPage).not.toMatch(
      /from\(["']registry_genres["']\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s,
    );
    expect(genresPage).toContain(
      "Genre hierarchy is read-only on this profile surface.",
    );
    expect(genresPage).not.toContain("patchDraft({ parent_genre_id");

    expect(verifier).toContain("ADMIN_REGISTRY_PROFILE_AUTHORITY_PASS");
  });

  it("converges generic Track provider-link writes onto exact Registry authority", () => {
    const client = read("src/services/registry/providerLinks.ts");
    const migration = read(
      "supabase/migrations/20260920201257_registry_track_provider_link_admin_authority_v1.sql",
    );
    const verifier = read(
      "scripts/control-plane/verify-registry-provider-link-admin-authority.sql",
    );
    const manifest = JSON.parse(
      read(
        "scripts/control-plane/registry-privileged-writer-manifest.json",
      ),
    ) as {
      writers: Array<{
        id: string;
        authentication: string;
        authorization: string;
        executionAuthority: string;
        disposition: string;
        futureBoundary: string;
        humanCallable: boolean;
        canonicalMutation: boolean;
      }>;
    };

    expect(client).toContain("admin_admit_registry_track_provider_link_v1");
    expect(client).not.toContain('"registry_upsert_track_provider_link"');

    expect(migration).toContain("registry_provider_link_admin");
    expect(migration).toContain("registry.track.provider_link.admit");
    expect(migration).toContain("INTERNAL_FACT");
    expect(migration).toContain("'trust_class',v_evidence.trust_class");
    expect(migration).toContain("required_user_capability_key");
    expect(migration).toContain("manage_registry");
    expect(migration).toContain("WK_STALE_PROVIDER_LINK");
    expect(migration).toContain("registry_operation_write_events");
    expect(migration).toContain("registry_canonical_write_events");
    expect(migration).toContain("verify_registry_provider_link_admin_v1");
    expect(migration).toContain(
      "revoke all on function\n  public.registry_upsert_track_provider_link",
    );

    expect(verifier).toContain(
      "REGISTRY_PROVIDER_LINK_ADMIN_AUTHORITY_PASS",
    );

    expect(
      manifest.writers.find(
        (writer) => writer.id === "registry-upsert-track-provider-link",
      ),
    ).toMatchObject({
      authentication: "owner_internal_only",
      authorization: "no_external_execute",
      disposition: "keep",
      futureBoundary:
        "owner_internal_provider_link_upsert_behind_typed_exact_operation",
      humanCallable: false,
      canonicalMutation: true,
    });

    expect(
      manifest.writers.find(
        (writer) =>
          writer.id === "admin-admit-registry-track-provider-link-v1",
      ),
    ).toMatchObject({
      authentication: "auth_uid",
      authorization: "manage_registry",
      disposition: "keep",
      futureBoundary:
        "typed_registry_provider_link_admission_for_registry_admin",
      humanCallable: true,
      canonicalMutation: true,
    });
  });

  it("converges Slice 3 stale Artist and Chart writers onto accepted primitives", () => {
    const artistAuthority = read(
      "supabase/migrations/20260921170000_registry_reviewed_artist_identity_composition_v1.sql",
    );
    const chartAuthority = read(
      "supabase/migrations/20260921171000_registry_chart_artist_resolution_rebase_v1.sql",
    );
    const aliasesPage = read(
      "src/pages/admin/registry/artist-aliases/page.tsx",
    );
    const chartPage = read(
      "src/pages/admin/charts/artist-resolution/page.tsx",
    );
    const artistVerifier = read(
      "scripts/control-plane/verify-artist-studio-registry-entry-convergence.sql",
    );
    const chartVerifier = read(
      "scripts/control-plane/verify-registry-chart-materialization-runtime.sql",
    );
    const inventoryVerifier = read(
      "scripts/control-plane/verify-registry-canonical-writer-inventory.sql",
    );
    const manifest = JSON.parse(
      read("scripts/control-plane/registry-privileged-writer-manifest.json"),
    ) as { writers: Array<Record<string, unknown>> };

    expect(artistAuthority).toContain("'registry.artist.create'");
    expect(artistAuthority).toContain(
      "execute_registry_reviewed_artist_identity_materialization_v1",
    );
    expect(artistAuthority).toContain(
      "execute_registry_artist_alias_state_v1",
    );
    expect(artistAuthority).not.toMatch(
      /community_admin_decide_artist_claim[\s\S]*insert\s+into\s+public\.registry_artists/i,
    );
    expect(artistAuthority).toContain(
      "coalesce(alias.status,'active')='active'",
    );
    expect(artistAuthority).not.toContain("manual_intake");

    expect(chartAuthority).toContain(
      "'registry.track_artist_credit.admit'",
    );
    expect(chartAuthority).toContain("chart_artist_resolution_review");
    expect(chartAuthority).not.toMatch(
      /admin_apply_chart_artist_resolution_decision[\s\S]*insert\s+into\s+public\.registry_track_artists/i,
    );
    expect(chartAuthority).toContain("status <> 'archived'");
    expect(chartAuthority).toContain("having count(*)=1");

    expect(aliasesPage).toContain("admin_set_registry_artist_alias_v1");
    expect(aliasesPage).not.toMatch(
      /from\(["']registry_artist_aliases["']\)\s*\.\s*delete\s*\(/s,
    );
    expect(chartPage).toContain("chart_get_entry_registry_identity_v1");
    expect(chartPage).not.toContain(
      "rows.map((row) => row.canonicalArtistId).filter(Boolean)",
    );

    expect(artistVerifier).toContain(
      "execute_registry_reviewed_artist_identity_materialization_v1",
    );
    expect(chartVerifier).toContain(
      "REGISTRY_CHART_ARTIST_RESOLUTION_REBASE_PASS",
    );
    expect(inventoryVerifier).toContain(
      "public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)",
    );

    expect(
      manifest.writers.find(
        (writer) => writer.id === "community-admin-decide-artist-claim",
      ),
    ).toMatchObject({
      disposition: "keep",
      futureBoundary:
        "reviewed_artist_identity_materialization_plus_claim_representation_semantics",
    });
    expect(
      manifest.writers.find(
        (writer) => writer.id === "admin-apply-chart-artist-resolution-decision",
      ),
    ).toMatchObject({
      disposition: "keep",
      futureBoundary:
        "chart_review_evidence_plus_typed_track_artist_credit_admission_fail_closed_on_conflict",
    });
    expect(
      manifest.writers.find(
        (writer) => writer.id === "admin-set-registry-artist-alias-v1",
      ),
    ).toMatchObject({
      disposition: "keep",
      canonicalMutation: true,
      humanCallable: true,
    });
  });

  it("removes direct browser canonical Release mutation while preserving precision, label, and soft archive", () => {
    const release = read("src/pages/admin/registry/releases/detail/page.tsx");
    const client = read("src/services/registry/admin/releaseDetailClient.ts");
    const migration = read(
      "supabase/migrations/20260916120100_registry_release_detail_admin_authority_v1.sql",
    );

    expect(release).toContain("saveRegistryReleaseDetail");
    expect(release).toContain("archiveRegistryRelease");
    expect(release).not.toContain("deleteRegistryEntity");
    expect(release).not.toMatch(/from\(["']registry_releases["']\)\s*\.\s*update/s);
    expect(client).toContain("admin_patch_registry_release_detail_v1");
    expect(client).toContain("p_release_date_precision");
    expect(client).toContain("p_label_id");
    expect(migration).toContain("p_expected_updated_at");
    expect(migration).toContain("release_date_precision");
    expect(migration).toContain("label_id");
    expect(migration).toContain("registry_canonical_write_events");
  });
});

describe("MIZIZI Slice 2 Gate B Pure Public Read", () => {
  const publicReadGateways = [
    "supabase/functions/public-content-read/index.ts",
  ];

  it("keeps wakilisha-public-api retired from repository authority", () => {
    expect(
      existsSync(
        "supabase/functions/wakilisha-public-api/index.ts",
      ),
    ).toBe(false);

    const manifest =
      JSON.parse(
        readFileSync(
          "scripts/control-plane/registry-privileged-writer-manifest.json",
          "utf8",
        ),
      ) as {
        writers: Array<{
          id: string;
        }>;
      };

    expect(
      manifest.writers.some(
        (writer) =>
          writer.id ===
          "wakilisha-public-api",
      ),
    ).toBe(false);
  });

  it("keeps public Registry reads free of direct canonical Registry DML", () => {
    const directRegistryMutation =
      /\.from\(\s*["']registry_[^"']+["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s;

    for (const path of publicReadGateways) {
      const source = read(path);

      expect(source).not.toMatch(
        directRegistryMutation,
      );
    }
  });

  it("classifies public-content-read as pure Registry read authority with no canonical mutator RPC path", () => {
    const manifest =
      JSON.parse(
        readFileSync(
          "scripts/control-plane/registry-privileged-writer-manifest.json",
          "utf8",
        ),
      ) as {
        writers: Array<{
          id: string;
          kind: string;
          entrypoint: string;
          disposition: string;
          futureBoundary: string;
          canonicalMutation: boolean;
          legacyDebt: boolean;
        }>;
      };

    const publicRead =
      manifest.writers.find(
        (writer) =>
          writer.id ===
          "public-content-read",
      );

    expect(publicRead).toMatchObject({
      disposition: "keep",
      futureBoundary: "pure_public_read",
      canonicalMutation: false,
      legacyDebt: false,
    });

    const canonicalMutatorNames =
      manifest.writers
        .filter(
          (writer) =>
            writer.kind ===
              "database_function" &&
            writer.canonicalMutation ===
              true,
        )
        .map((writer) => {
          const match =
            writer.entrypoint.match(
              /^(?:[^.]+\.)?([^.(]+)(?:\(|$)/,
            );
          return match?.[1] ?? "";
        })
        .filter(Boolean);

    const publicReadSource =
      readFileSync(
        "supabase/functions/public-content-read/index.ts",
        "utf8",
      );

    for (const functionName of canonicalMutatorNames) {
      expect(
        publicReadSource,
      ).not.toContain(
        `.rpc("${functionName}"`,
      );
      expect(
        publicReadSource,
      ).not.toContain(
        `.rpc('${functionName}'`,
      );
    }
  });

  it("keeps generated Release descriptions response-only", () => {
    for (const path of publicReadGateways) {
      const source = read(path);

      expect(source).toContain(
        'let description = release.description || ""',
      );
      expect(source).toContain(
        "description = desc;",
      );
      expect(source).not.toContain(
        '.update({ description })',
      );
    }
  });
});


describe("MIZIZI Slice 3 narrow executor Stage A foundation", () => {
  it("installs the future MIZIZI executor inertly before the later Stage C cutover", () => {
    const migrations = readdirSync("supabase/migrations").filter(
      (name) => name.endsWith("_mizizi_executor_foundation_v1.sql"),
    );

    expect(migrations).toHaveLength(1);

    const migration = read(
      "supabase/migrations/" + migrations[0],
    );

    expect(migration).toContain("create role mizizi_executor");
    expect(migration).toContain("nobypassrls");
    expect(migration).toContain("create schema mizizi_private");
    expect(migration).toContain("'mizizi_executor',");
    expect(migration).toContain("'disabled'");
    expect(migration).toContain("'registry.release_taxonomy.repair'");
    expect(migration).toContain("'registry.chart_track_slug.synchronize'");
    expect(migration).toContain("queue_registry_review_v1");
    expect(migration).toContain("finding_fingerprint_v1");
    expect(migration).toContain("track_slug_identity_noise");
    expect(migration).toContain("release_slug_provider_packaging");
    expect(migration).toContain("MIZIZI review target changed since analysis.");
    expect(migration).toContain("MIZIZI review fingerprint does not match deterministic finding identity.");
    expect(migration).toContain("review.source_payload->>'ruleId'=p_rule_id");
    expect(migration).toContain("limit 1");
    expect(migration).toContain("for update;");
    expect(migration).toContain("Stage A requires zero active MIZIZI standing grants");
    expect(migration).toContain("Stage A created active MIZIZI exact authority");

    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\.registry_/i,
    );
    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\.wk_chart_entries_v2/i,
    );
    expect(migration).not.toContain("set role mizizi_executor");

    expect(migration).toContain(
      "audited active MIZIZI postgres executor binding is missing",
    );
    expect(migration).toContain(
      "'mizizi_executor',\n  'disabled'",
    );
  });

  it("removes generic PUBLIC inheritance from browser bounded writers while preserving exact app roles", () => {
    const migrations = readdirSync("supabase/migrations").filter(
      (name) => name.endsWith("_mizizi_executor_foundation_v1.sql"),
    );
    const migration = read(
      "supabase/migrations/" + migrations[0],
    );

    expect(migration).toContain(
      "public.increment_share_count(text,text,text,text)",
    );
    expect(migration).toContain(
      "public.track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)",
    );
    expect(migration).toContain("from public;");
    expect(migration).toContain("to anon, authenticated, service_role;");
  });

  it("does not grant autonomous Track or Release slug rewrite authority", () => {
    const migrations = readdirSync("supabase/migrations").filter(
      (name) => name.endsWith("_mizizi_executor_foundation_v1.sql"),
    );
    const migration = read(
      "supabase/migrations/" + migrations[0],
    );

    expect(migration).not.toContain("registry.track_slug");
    expect(migration).not.toContain("registry.release_slug");
    expect(migration).toContain("queue_registry_review_v1");
  });
});


describe("MIZIZI Slice 3 legacy Registry maintenance RPC retirement", () => {
  const retiredFunctions = [
    "link_orphan_release_artists",
    "rebuild_discography_from_metadata",
    "split_multi_release_tracks",
  ];

  it("retires obsolete PUBLIC maintenance RPC authority at head without rewriting historical migrations", () => {
    const migrations =
      readdirSync(
        "supabase/migrations",
      ).filter(
        (name) =>
          name.endsWith(
            "_legacy_registry_maintenance_rpc_retirement.sql",
          ),
      );

    expect(migrations).toHaveLength(1);

    const retirementMigration =
      readFileSync(
        "supabase/migrations/" +
          migrations[0],
        "utf8",
      );

    const historicalReplay =
      readFileSync(
        "supabase/migrations/20260905090000_wakilisha_native_preview_acl_replay_parity.sql",
        "utf8",
      );

    const manifest =
      JSON.parse(
        readFileSync(
          "scripts/control-plane/registry-privileged-writer-manifest.json",
          "utf8",
        ),
      ) as {
        writers: Array<{
          id: string;
        }>;
      };

    for (const functionName of retiredFunctions) {
      expect(
        retirementMigration,
      ).toContain(
        `drop function public.${functionName}();`,
      );

      expect(
        historicalReplay,
      ).toContain(
        `('${functionName}()')`,
      );
    }

    expect(
      retirementMigration,
    ).not.toMatch(
      /drop\\s+function\\b[^;]*\\bcascade\\b/i,
    );

    expect(
      manifest.writers.some(
        (writer) =>
          writer.id ===
          "legacy-registry-maintenance-functions",
      ),
    ).toBe(false);
  });
});

describe("MIZIZI Slice 2 Gate C historical relationship authority receipt", () => {
  const migration = read(
    "docs/engineering/replay-baseline/retired-active-migrations/20260916182000_registry_relationship_authority_convergence_v1.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-mizizi-relationship-authority-convergence.sql",
  );

  it("maps the historical core-music shells onto exact typed Registry identity", () => {
    expect(migration).toContain(
      "efdf79dc-9280-406a-b6e3-f8672f6b783f",
    );
    expect(migration).toContain(
      "33b93023-0479-4feb-ade7-a1185f86cb23",
    );
    expect(migration).toContain(
      "208e0284-93b8-43fd-991e-b17ffa624c4b",
    );
    expect(migration).toContain(
      "e9a367d3-7cc4-4126-94ec-1e651dbe6ecf",
    );
    expect(migration).toContain(
      "canonical_source_table = 'registry_artists'",
    );
    expect(migration).toContain(
      "canonical_source_table = 'registry_tracks'",
    );
    expect(migration).toContain(
      "canonical_source_table = 'registry_releases'",
    );
  });

  it("preserves the two historical relationship UUIDs and evidence links in typed authority", () => {
    expect(migration).toContain(
      "8c03e889-3c3a-47f2-a776-9f8534191180",
    );
    expect(migration).toContain(
      "ea733423-2c3b-4d47-93ea-6af44b6577b3",
    );
    expect(verifier).toContain(
      "9e39f45d-10f4-45fc-af3e-9af17aa5e6a7",
    );
    expect(verifier).toContain(
      "164714b3-955d-4bfe-a456-c2a70a343685",
    );
    expect(migration).toContain(
      "legacy_cultural_relationship_migration",
    );
    expect(migration).toContain(
      "Gate C historical Siaka/Mtoto relationship drift",
    );
    expect(migration).toContain(
      "Gate C historical Mejja/Fik relationship drift",
    );
    expect(migration).toContain(
      "Gate C historical Siaka/Mtoto evidence drift",
    );
    expect(migration).toContain(
      "Gate C historical Mejja/Fik evidence drift",
    );
    expect(migration).toContain(
      "Gate C typed Siaka/Mtoto provenance drift",
    );
    expect(migration).toContain(
      "Gate C typed Mejja/Fik provenance drift",
    );
    expect(migration).toContain(
      "Gate C typed Siaka/Mtoto evidence provenance drift",
    );
    expect(migration).toContain(
      "Gate C typed Mejja/Fik evidence provenance drift",
    );
    expect(verifier).toContain(
      "source_kind = 'legacy_cultural_relationship_migration'",
    );
    expect(verifier).toContain(
      "e.review_status = 'reviewed'",
    );
    expect(verifier).toContain(
      "e.retrieval_status = 'default_retrieval'",
    );
    expect(migration).toContain(
      "insert into public.registry_relationship_evidence",
    );
    expect(migration).not.toContain(
      "delete from public.entity_relationships",
    );
    expect(migration).not.toContain(
      "delete from public.relationship_evidence",
    );
  });

  it("keeps typed public-safe promotion stricter than the legacy review projection", () => {
    expect(migration).toContain(
      "'legacy_public_safe', er.public_safe",
    );
    expect(migration).toContain(
      "review_status = 'approved'",
    );
    expect(migration).toContain(
      "public_safe = false",
    );
    expect(migration).not.toMatch(
      /update\s+public\.evidence_items[\s\S]*review_status\s*=\s*'approved'/i,
    );
  });

  it("mechanically freezes only core-music use of the legacy graph", () => {
    expect(migration).toContain(
      "reject_legacy_core_cultural_entity_mutation",
    );
    expect(migration).toContain(
      "reject_legacy_core_relationship_mutation",
    );
    expect(migration).toContain(
      "reject_legacy_core_relationship_evidence_mutation",
    );
    expect(migration).toContain(
      "('artist','track','release','label','genre')",
    );
    expect(migration).not.toMatch(
      /drop\s+table\s+(if\s+exists\s+)?public\.cultural_entities/i,
    );
    expect(migration).not.toMatch(
      /drop\s+table\s+(if\s+exists\s+)?public\.entity_relationships/i,
    );
    expect(migration).not.toMatch(
      /drop\s+table\s+(if\s+exists\s+)?public\.relationship_evidence/i,
    );
  });

  it("ships an independent deterministic Gate C verifier", () => {
    expect(verifier).toContain(
      "MIZIZI_RELATIONSHIP_AUTHORITY_CONVERGENCE_PASS",
    );
    expect(verifier).toContain(
      "trg_reject_legacy_core_cultural_entity_mutation",
    );
    expect(verifier).toContain(
      "trg_reject_legacy_core_relationship_mutation",
    );
    expect(verifier).toContain(
      "trg_reject_legacy_core_relationship_evidence_mutation",
    );
    expect(verifier).toContain(
      "metadata ->> 'legacy_public_safe' = 'true'",
    );
  });
});

describe("MIZIZI Slice 2 Gate D Identity + Projection Lineage", () => {
  const migration = read(
    "supabase/migrations/20260916210000_registry_identity_projection_lineage_v1.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-mizizi-identity-projection-lineage.sql",
  );

  it("models accepted identity transitions without turning aliases or archive status into lineage", () => {
    expect(migration).toContain("registry_identity_lineage");
    expect(migration).toContain("'merge'");
    expect(migration).toContain("'supersede'");
    expect(migration).toContain("'split'");
    expect(migration).toContain("'alias_replacement'");
    expect(migration).toContain("'retired'");
    expect(migration).toContain(
      "registry_identity_lineage_successor_cardinality_check",
    );
    expect(migration).not.toContain(
      "source_authority = 'registry_artist_aliases'",
    );
    expect(migration).not.toMatch(
      /where\s+status\s*=\s*'archived'[\s\S]*record_registry_identity_lineage_v1/i,
    );
  });

  it("backfills accepted merge, supersession, and split events while preserving repeated history", () => {
    expect(migration).toContain(
      "registry_artist_resolution_events",
    );
    expect(migration).toContain(
      "registry_track_resolution_events",
    );
    expect(migration).toContain(
      "registry_audit_log:artist_credit_decoupled",
    );
    expect(migration).toContain(
      "trg_capture_registry_artist_resolution_lineage_v1",
    );
    expect(migration).toContain(
      "trg_capture_registry_track_resolution_lineage_v1",
    );
    expect(migration).toContain(
      "trg_capture_registry_artist_split_lineage_v1",
    );
    expect(verifier).toMatch(
      /source_record_id\s*=\s*e\.id::text\s*\|\|\s*':'\s*\|\|\s*duplicate\.source_id::text/,
    );
  });

  it("resolves current, successor, split, retired, and unresolved identity without rewriting history", () => {
    expect(migration).toContain(
      "resolve_registry_identity_lineage_v1",
    );
    expect(migration).toContain("'current'");
    expect(migration).toContain("'successor'");
    expect(migration).toContain("'split'");
    expect(migration).toContain("'retired'");
    expect(migration).toContain("'unresolved'");
    expect(migration).toContain("'cycle'");
    expect(migration).toContain("'max_depth'");
    expect(migration).toContain(
      "missing_terminal_entity_ids",
    );
  });

  it("separates rebuildable chart identity projection from historical observation and provider evidence", () => {
    expect(migration).toContain(
      "registry_identity_projection_lineage",
    );
    expect(migration).toContain(
      "historical_observation_ref",
    );
    expect(migration).toContain(
      "provider_evidence_ref",
    );
    expect(migration).toContain(
      "canonical_state_fingerprint",
    );
    expect(migration).toContain(
      "projection_fingerprint",
    );
    expect(migration).toContain(
      "gate_d_backfill:wk_chart_entries_v2",
    );
    expect(migration).toContain(
      "trg_capture_wk_chart_identity_projection_update_v1",
    );
    expect(migration).not.toMatch(
      /update\s+public\.chart_ingest_raw_rows/i,
    );
    expect(migration).not.toMatch(
      /update\s+public\.provider_field_observations/i,
    );
    expect(migration).not.toMatch(
      /update\s+editorial\./i,
    );
  });

  it("keeps lineage append-only, denies client mutation, and ships an independent verifier", () => {
    expect(migration).toContain(
      "Registry lineage is append-only.",
    );
    expect(migration).toContain(
      "trg_registry_identity_lineage_append_only",
    );
    expect(migration).toContain(
      "trg_registry_identity_projection_lineage_append_only",
    );
    expect(migration).toContain(
      "revoke all on table public.registry_identity_lineage",
    );
    expect(migration).toContain(
      "revoke all on table public.registry_identity_projection_lineage",
    );
    expect(verifier).toContain(
      "MIZIZI_IDENTITY_PROJECTION_LINEAGE_PASS",
    );
    expect(verifier).toContain(
      "unresolved Mali Safi identity was fabricated",
    );
    expect(verifier).toContain(
      "ordinary Artist aliases were promoted into lineage",
    );
  });

  it("binds human-required Registry grants to shared review authority", () => {
    const migration = readFileSync(
      "supabase/migrations/20260916210001_registry_shared_review_authority_v1.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-mizizi-shared-review-authority.sql",
      "utf8",
    );

    expect(migration).toContain(
      "platform_private.registry_review_cases",
    );
    expect(migration).toContain(
      "platform_private.registry_review_events",
    );
    expect(migration).toContain(
      "platform_private.registry_review_case_status_v1",
    );
    expect(migration).toContain(
      "registry_execution_grant_target_review_seal",
    );
    expect(migration).toContain(
      "registry_execution_grants_review_authority_guard",
    );
    expect(migration).toContain(
      "requires_human_approval",
    );
    expect(migration).toContain(
      "'decision', 'supersede', 'reopen'",
    );
    expect(migration).toContain(
      "'approved', 'rejected', 'needs_more_evidence'",
    );
    expect(
      (migration.match(/for update;/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    expect(verifier).toContain(
      "review-case lifecycle is not serialized",
    );
    expect(migration).toContain(
      "event_sequence bigint generated always as identity",
    );
    expect(migration).toContain(
      "registry_review_events_sequence_key",
    );
    expect(migration).toContain(
      "order by review_event.event_sequence desc",
    );
    expect(migration).toContain(
      "order by decision_event.event_sequence desc",
    );
    expect(verifier).toContain(
      "deterministic review event ordering is missing",
    );
    expect(migration).not.toContain(
      "alter table public.review_decisions",
    );
    expect(migration).not.toContain(
      "alter table public.registry_review_items",
    );
    expect(verifier).toContain(
      "MIZIZI_SHARED_REVIEW_AUTHORITY_PASS",
    );
  });
});

describe("MIZIZI Slice 3 Candidate D1 Top Songs presentation authority", () => {
  const migration = read(
    "supabase/migrations/20260917121500_artist_top_song_presentation_authority_v1.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-mizizi-top-song-presentation-authority.sql",
  );
  const client = read(
    "src/services/registry/admin/topSongsClient.ts",
  );
  const panel = read(
    "src/pages/admin/registry/artists/detail/components/TopSongsPanel.tsx",
  );
  const artistPage = read(
    "src/pages/admin/registry/artists/detail/page.tsx",
  );
  const publicReaders = [
    "supabase/functions/public-content-read/index.ts",
  ];

  it("separates editorial Top Songs presentation from evidence-backed relationship truth", () => {
    expect(migration).toContain("artist_top_song_curations");
    expect(migration).toContain("artist_top_song_curation_migration_map");
    expect(migration).toContain("artist_top_song_curation_events");
    expect(migration).toContain("get_artist_top_songs_v1");
    expect(migration).toContain("admin_replace_artist_top_songs_v1");
    expect(migration).toContain("resolution_status");
    expect(migration).toContain("candidate_track_ids");
    expect(migration).not.toMatch(
      /(update|delete\s+from)\s+public\.registry_entity_relationships/i,
    );
  });

  it("moves the Admin Top Songs caller onto exact-set RPC authority", () => {
    expect(client).toContain("get_artist_top_songs_v1");
    expect(client).toContain("admin_replace_artist_top_songs_v1");
    expect(panel).toContain("loadAdminArtistTopSongs");
    expect(panel).toContain("replaceAdminArtistTopSongs");
    expect(panel).not.toContain("admin-registry-api/top-songs");
    expect(artistPage).toContain(
      "<TopSongsPanel artistId={artist.id}",
    );
  });

  it("keeps the surviving public Top Songs reader on presentation authority", () => {
    for (const path of publicReaders) {
      const source = read(path);
      expect(source).toContain("getTopSongsFromPresentationAuthority");
      expect(source).toContain('"get_artist_top_songs_v1"');
      expect(source).not.toContain("getTopSongsFromRelationships");
    }
  });

  it("keeps direct browser DML closed and unresolved legacy identity fail-closed", () => {
    expect(verifier).toContain("Browser direct Top Songs presentation DML grant detected");
    expect(verifier).toContain("needs_review");
    expect(verifier).toContain("candidate_track_ids");
    expect(migration).toContain("p_expected_fingerprint");
    expect(migration).toContain("40001");
    expect(migration).toContain("at most 20 Top Songs");
  });

  it("keeps Top Songs service-role authority behind the read RPC", () => {
    const repair = readFileSync(
      "supabase/migrations/20260917121600_artist_top_song_service_role_boundary_v1.sql",
      "utf8",
    );
    const verifier = readFileSync(
      "scripts/control-plane/verify-mizizi-top-song-presentation-authority.sql",
      "utf8",
    );

    for (const table of [
      "artist_top_song_curations",
      "artist_top_song_curation_migration_map",
      "artist_top_song_curation_events",
    ]) {
      expect(repair).toContain(
        `revoke all on table public.${table}`,
      );
      expect(verifier).toContain(
        `has_table_privilege('service_role', 'public.${table}', 'SELECT,INSERT,UPDATE,DELETE')`,
      );
    }

    expect(repair).toContain(
      "grant execute on function public.get_artist_top_songs_v1(uuid,text)",
    );
    expect(repair).toContain(
      "revoke all on function public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)",
    );
    expect(verifier).toContain(
      "not has_function_privilege('service_role', 'public.get_artist_top_songs_v1(uuid,text)', 'EXECUTE')",
    );
    expect(verifier).toContain(
      "has_function_privilege('service_role', 'public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)', 'EXECUTE')",
    );
    expect(verifier).toContain(
      "has_function_privilege('service_role', 'platform_private.artist_top_song_fingerprint_v1(uuid)', 'EXECUTE')",
    );
  });


  it("keeps retired admin-registry-api outside the active Registry control plane", () => {
    const manifest = JSON.parse(
      readFileSync(
        "scripts/control-plane/registry-privileged-writer-manifest.json",
        "utf8",
      ),
    ) as { writers: Array<{ id: string }> };
    const registryClient = readFileSync(
      "src/services/registry/admin/client.ts",
      "utf8",
    );
    const topSongsClient = readFileSync(
      "src/services/registry/admin/topSongsClient.ts",
      "utf8",
    );
    const topSongsPanel = readFileSync(
      "src/pages/admin/registry/artists/detail/components/TopSongsPanel.tsx",
      "utf8",
    );
    const config = readFileSync(
      "supabase/config.toml",
      "utf8",
    );

    expect(
      existsSync(
        "supabase/functions/admin-registry-api/index.ts",
      ),
    ).toBe(false);
    expect(
      manifest.writers.some(
        (writer) =>
          writer.id ===
          "admin-registry-api",
      ),
    ).toBe(false);
    expect(registryClient).toContain(
      "/functions/v1/admin-router/registry",
    );
    expect(registryClient).not.toContain(
      "/functions/v1/admin-registry-api",
    );
    expect(topSongsClient).toContain(
      "get_artist_top_songs_v1",
    );
    expect(topSongsClient).toContain(
      "admin_replace_artist_top_songs_v1",
    );
    expect(topSongsPanel).not.toContain(
      "admin-registry-api",
    );
    expect(config).not.toContain(
      "[functions.admin-registry-api]",
    );
  });

});

describe("MIZIZI Slice 3 Stage B typed broker convergence", () => {
  const migrations =
    readdirSync(
      "supabase/migrations",
    ).filter(
      (name) =>
        name.endsWith(
          "_mizizi_stage_b_broker_convergence_v1.sql",
        ),
    );

  it("installs all four exact stewardship operations inertly", () => {
    expect(migrations).toHaveLength(1);

    const migration = read(
      "supabase/migrations/" +
        migrations[0],
    );

    for (const operationKey of [
      "registry.track_slug.canonicalize",
      "registry.release_taxonomy.repair",
      "registry.release_slug.canonicalize",
      "registry.chart_track_slug.synchronize",
    ]) {
      expect(migration).toContain(
        `'${operationKey}'`,
      );
    }

    expect(migration).toContain(
      "issue_stewardship_execution_grant_v1",
    );
    expect(migration).toContain(
      "execute_stewardship_operation_v1",
    );
    expect(migration).toContain(
      "verify_stewardship_operation_v1",
    );
    expect(migration).toContain(
      "begin_registry_mutation_operation",
    );
    expect(migration).toContain(
      "registry_operation_write_events",
    );
    expect(migration).toContain(
      "queue_registry_review_v1",
    );
    expect(migration).toContain(
      "Stage B created active MIZIZI standing authority",
    );
    expect(migration).toContain(
      "Stage B created active MIZIZI exact authority",
    );
    expect(migration).toContain(
      "executor_key='postgres'",
    );
    expect(migration).toContain(
      "executor_key='mizizi_executor'",
    );

    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\.registry_/i,
    );
    expect(migration).not.toContain(
      "set role mizizi_executor",
    );
  });

  it("removes caller-side mutation DML from the MIZIZI runner", () => {
    const runnerSource = read(
      "scripts/registry/agents/mizizi/run.ts",
    );

    expect(runnerSource).toContain(
      "issue_stewardship_execution_grant_v1",
    );
    expect(runnerSource).toContain(
      "execute_stewardship_operation_v1",
    );
    expect(runnerSource).toContain(
      "verify_stewardship_operation_v1",
    );
    expect(runnerSource).toContain(
      "queue_registry_review_v1",
    );

    expect(runnerSource).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:registry_|wk_chart_entries_v2|community_|audience_interests|signal_os_content_opportunities)/i,
    );
    expect(runnerSource).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+platform_private\.(?:registry_execution_grants|registry_mutation_operations|registry_operation_write_events)/i,
    );
  });

  it("records that Stage B intentionally left transport cutover for Stage C", () => {
    const migration = read(
      "supabase/migrations/" +
        migrations[0],
    );

    expect(migration).toContain(
      "Stage B deliberately preserves the current JIT postgres transport",
    );
    expect(migration).toContain(
      "Transport cutover to mizizi_executor is Stage C",
    );
  });
});

describe("MIZIZI Slice 3 Stage C narrow executor transport", () => {
  const migrations =
    readdirSync(
      "supabase/migrations",
    ).filter(
      (name) =>
        name.endsWith(
          "_mizizi_stage_c_narrow_executor_transport_v1.sql",
        ),
    );

  it("cuts database authority to the narrow executor when the Stage C ledger is activated", () => {
    expect(migrations).toHaveLength(1);
    const migration = read(
      "supabase/migrations/" + migrations[0],
    );

    expect(migration).toContain("record_artist_origin_evidence_v1");
    expect(migration).toContain("issue_artist_origin_execution_grant_v1");
    expect(migration).toContain("execute_artist_origin_admission_v1");
    expect(migration).toContain("verify_artist_origin_admission_v1");
    expect(migration).toContain("send_operational_standup_v1");
    expect(migration).toContain("executor_key='postgres'");
    expect(migration).toContain("executor_key='mizizi_executor'");
    expect(migration).not.toMatch(
      /grant\s+usage\s+on\s+schema\s+platform_private\s+to\s+mizizi_executor/i,
    );
  });

  it("keeps runtime off platform_private and admin identity tables", () => {
    const runner = read(
      "scripts/registry/agents/mizizi/run.ts",
    );
    const artist = read(
      "scripts/registry/agents/mizizi/artist-origin-broker.ts",
    );

    expect(runner).toContain("send_operational_standup_v1");
    expect(runner).not.toContain("from public.user_role_assignments role");
    expect(runner).not.toContain("editorial.person_identity_links");
    expect(runner).not.toContain("platform_private.send_system_message");

    for (const wrapper of [
      "record_artist_origin_evidence_v1",
      "issue_artist_origin_execution_grant_v1",
      "execute_artist_origin_admission_v1",
      "verify_artist_origin_admission_v1",
    ]) {
      expect(artist).toContain(wrapper);
    }

    expect(artist).not.toContain("platform_private.record_registry_artist_origin_evidence");
    expect(artist).not.toContain("platform_private.issue_registry_artist_origin_execution_grant");
    expect(artist).not.toContain("platform_private.execute_registry_artist_origin_admission");
    expect(artist).not.toContain("platform_private.verify_registry_artist_origin_admission");
  });

  it("gates both production control planes on the exact Stage C ledger", () => {
    const track = read(
      "scripts/control-plane/mizizi-track-production-control-plane.mjs",
    );
    const release = read(
      "scripts/control-plane/mizizi-release-production-control-plane.mjs",
    );

    for (const source of [track,release]) {
      expect(source).toContain("mizizi_stage_c_narrow_executor_transport_v1");
      expect(source).toContain("resolveMiziziTransportRole");
      expect(source).toContain("Stage C ledger is present but dedicated executor binding is not exact");
      expect(source).toContain("Stage C ledger is absent but Stage B transport binding is not exact");
      expect(source).toContain("return 'mizizi_executor'");
      expect(source).toContain("return 'postgres'");
      expect(source).toContain("databaseUrl(transportRole)");
    }
  });

  it("closes live transport debt in the writer manifest", () => {
    const manifest = JSON.parse(
      read(
        "scripts/control-plane/registry-privileged-writer-manifest.json",
      ),
    ) as {
      writers: Array<{
        id: string;
        executionAuthority: string;
        disposition: string;
        futureBoundary: string;
        legacyDebt: boolean;
      }>;
    };

    expect(
      manifest.writers.find(
        (writer) => writer.id === "mizizi-agent-runner",
      ),
    ).toMatchObject({
      executionAuthority:
        "typed exact-grant stewardship broker over Stage-C-ledger-gated JIT transport with dedicated mizizi_executor after activation",
      disposition: "keep",
      futureBoundary:
        "stage_c_ledger_gated_dedicated_executor_cutover",
      legacyDebt: false,
    });

    expect(
      manifest.writers.find(
        (writer) => writer.id === "mizizi-artist-origin-broker",
      ),
    ).toMatchObject({
      executionAuthority:
        "typed one-Artist origin broker over Stage-C-ledger-gated JIT transport with dedicated mizizi_executor after activation",
      disposition: "keep",
      futureBoundary:
        "stage_c_ledger_gated_dedicated_executor_cutover",
      legacyDebt: false,
    });
  });
});


describe("MIZIZI Slice 3 Tranche B Track duplicate repair exact authority", () => {
  const migration = read(
    "supabase/migrations/20260922054353_registry_track_duplicate_repair_authority_v1.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-registry-track-duplicate-repair-authority.sql",
  );

  it("internalizes the mature engine without rewriting its domain algorithm", () => {
    expect(migration).toContain(
      "alter function public.admin_apply_registry_track_duplicate_repair",
    );
    expect(migration).toContain(
      "set schema platform_private",
    );
    expect(migration).toContain(
      "rename to apply_registry_track_duplicate_repair_engine_v1",
    );
    expect(migration).not.toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+platform_private\.apply_registry_track_duplicate_repair_engine_v1/i,
    );
    expect(migration).toContain(
      "Mature Registry Track duplicate repair engine contract was not preserved",
    );
    expect(migration).toContain(
      "ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7",
    );
    expect(verifier).toContain(
      "ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7",
    );
  });

  it("reuses shared review, exact-grant, journal and verifier primitives with kernel delta zero", () => {
    expect(migration).toContain(
      "'registry.track.duplicate_repair'",
    );
    expect(migration).toContain(
      "'repair_registry_track_duplicate'",
    );
    expect(migration).toContain(
      "'critical'",
    );
    expect(migration).toContain(
      "max_targets",
    );
    expect(migration).toContain(
      "registry_execution_target_set_fingerprint",
    );
    expect(migration).toContain(
      "begin_registry_mutation_operation",
    );
    expect(migration).toContain(
      "registry_operation_write_events",
    );
    expect(verifier).toContain(
      "registry_execution_grant_target_review_seal",
    );
    expect(verifier).toContain(
      "registry_execution_grants_review_authority_guard",
    );
    expect(migration).not.toContain(
      "create table platform_private.registry_review_",
    );
    expect(migration).not.toContain(
      "create table platform_private.registry_execution_grants",
    );
  });

  it("freezes related repair state and enforces bounded exact execution", () => {
    expect(migration).toContain(
      "registry_track_duplicate_repair_state_fingerprint_v1",
    );
    for (const relation of [
      "registry_tracks",
      "registry_track_provider_links",
      "registry_track_artists",
      "registry_release_tracks",
      "wk_chart_entries_v2",
    ]) {
      expect(migration).toContain(relation);
    }
    expect(migration).toContain(
      "WK_STALE_TRACK_DUPLICATE_REPAIR",
    );
    expect(migration).toContain(
      "Track duplicate repair exceeds the 16-Track exact target ceiling.",
    );
    expect(migration).toContain(
      "Track duplicate repair exceeds the 64-row exact operation ceiling.",
    );
    expect(migration).toContain(
      "Track duplicate repair exceeded its exact row budget.",
    );
    expect(migration).toContain(
      "v_target_fingerprint",
    );
    expect(migration).not.toContain(
      "repeat('0',64)",
    );
    expect(migration).not.toMatch(
      /update\s+platform_private\.registry_execution_grants\s+set\s+target_set_fingerprint/i,
    );
  });

  it("keeps the public product signature while removing direct engine authority", () => {
    expect(migration).toContain(
      "create function public.admin_apply_registry_track_duplicate_repair",
    );
    expect(migration).toContain(
      "record_registry_track_duplicate_repair_evidence_v1",
    );
    expect(migration).toContain(
      "issue_registry_track_duplicate_repair_grant_v1",
    );
    expect(migration).toContain(
      "execute_registry_track_duplicate_repair_v1",
    );
    expect(migration).toContain(
      "verify_registry_track_duplicate_repair_v1",
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role;",
    );
    expect(migration).toContain(
      "to authenticated;",
    );
    expect(verifier).toContain(
      "Private Track duplicate repair authority leaked client/service execution",
    );
  });

  it("preserves resolution-event and current identity-lineage postconditions independently", () => {
    expect(verifier).toContain(
      "REGISTRY_TRACK_DUPLICATE_REPAIR_AUTHORITY_PASS",
    );
    expect(verifier).toContain(
      "registry_track_resolution_events",
    );
    expect(verifier).toContain(
      "registry_identity_lineage",
    );
    expect(verifier).toContain(
      "Track duplicate repair supersession lineage coverage drifted",
    );
    expect(verifier).toContain(
      "canonical_track_has_ambiguous_current_primary_artist_credit",
    );
    expect(verifier).not.toContain(
      "canonical_artist_id is not null",
    );
  });

  it("classifies the surviving public command as converged exact authority", () => {
    const manifest = JSON.parse(
      readFileSync(
        "scripts/control-plane/registry-privileged-writer-manifest.json",
        "utf8",
      ),
    ) as {
      writers: Array<{
        id: string;
        executionAuthority: string;
        disposition: string;
        futureBoundary: string;
        legacyDebt: boolean;
      }>;
    };

    const writer = manifest.writers.find(
      (candidate) =>
        candidate.id ===
        "admin-apply-registry-track-duplicate-repair",
    );

    expect(writer).toBeDefined();
    expect(writer?.executionAuthority).toBe(
      "security_definer_reviewed_exact_grant_wrapper_over_private_mature_engine",
    );
    expect(writer?.disposition).toBe("keep");
    expect(writer?.futureBoundary).toBe(
      "reviewed_exact_track_duplicate_repair_v1",
    );
    expect(writer?.legacyDebt).toBe(false);
  });
});


describe("MIZIZI Slice 3 Tranche B remaining high-blast convergence", () => {
  const migration = read(
    "supabase/migrations/20260922100810_mizizi_slice3_tranche_b_high_blast_convergence_v1.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-mizizi-tranche-b-high-blast-authority.sql",
  );

  it("keeps one coherent Artist high-blast migration and preserves both mature engines byte-for-byte", () => {
    expect(migration).toContain(
      "alter function public.admin_decouple_registry_artist",
    );
    expect(migration).toContain(
      "rename to apply_registry_artist_decouple_engine_v1",
    );
    expect(migration).toContain(
      "alter function public.admin_safe_merge_registry_artists",
    );
    expect(migration).toContain(
      "rename to apply_registry_artist_merge_engine_v1",
    );
    expect(migration).not.toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+platform_private\.apply_registry_artist_(?:decouple|merge)_engine_v1/i,
    );

    for (const seal of [
      "bf2e8410e11af4207d064a800b7405045098ea0442742941a4fe5f55d026463e",
      "c5a595d6cd76da5df7d92d7e54449a270a3423cfffc8d8b0ce67eb85af3fd075",
    ]) {
      expect(migration).toContain(seal);
      expect(verifier).toContain(seal);
    }
  });

  it("adds only the earned pre-insertion target fingerprint primitive to the shared kernel", () => {
    expect(migration).toContain(
      "create function platform_private.registry_exact_target_set_fingerprint_v1",
    );
    expect(migration).toContain(
      "registry_execution_target_set_fingerprint(v_grant_id)",
    );
    expect(migration).toContain(
      "begin_registry_mutation_operation",
    );
    expect(migration).toContain(
      "registry_operation_write_events",
    );
    expect(migration).not.toContain(
      "create table platform_private.registry_execution_grants",
    );
    expect(migration).not.toContain(
      "create table platform_private.registry_review_",
    );
    expect(migration).not.toContain(
      "repeat('0',64)",
    );
    expect(migration).not.toMatch(
      /update\s+platform_private\.registry_execution_grants\s+set\s+target_set_fingerprint/i,
    );
  });

  it("freezes separate domain semantics over the shared exact-operation lifecycle", () => {
    for (const token of [
      "'registry.artist.decouple'",
      "'decouple_registry_artist'",
      "'registry.artist.merge'",
      "'merge_registry_artist'",
      "registry_artist_decouple_state_fingerprint_v1",
      "registry_artist_merge_state_fingerprint_v1",
      "record_registry_artist_decouple_evidence_v1",
      "record_registry_artist_merge_evidence_v1",
      "issue_registry_artist_decouple_grant_v1",
      "issue_registry_artist_merge_grant_v1",
      "execute_registry_artist_decouple_v1",
      "execute_registry_artist_merge_v1",
      "verify_registry_artist_decouple_v1",
      "verify_registry_artist_merge_v1",
    ]) {
      expect(migration).toContain(token);
    }

    expect(migration).toContain("max_targets=32");
    expect(migration).toContain("max_rows_ceiling=10000");
    expect(migration).toContain("max_targets=2");
    expect(migration).toContain("max_rows_ceiling=1024");
    expect(migration).toContain("WK_STALE_ARTIST_DECOUPLE");
    expect(migration).toContain("WK_STALE_ARTIST_MERGE");
  });

  it("preserves the reviewed decouple decision and safe-merge public product signatures", () => {
    expect(migration).toContain(
      "create or replace function public.admin_apply_artist_decouple_decision",
    );
    expect(migration).toContain(
      "create function public.admin_safe_merge_registry_artists",
    );
    expect(migration).toContain(
      "update public.registry_artist_decouple_decisions",
    );
    expect(migration).toContain(
      "to authenticated;",
    );

    expect(verifier).toContain(
      "Artist decouple public command grant boundary drifted",
    );
    expect(verifier).toContain(
      "Safe Artist merge public command grant boundary drifted",
    );
  });

  it("retires the old destructive manual merge road instead of wrapping it as a second merge mode", () => {
    expect(migration).toContain(
      "880f3fe1419b4ed9676ee0cbc14ca4b6193f0ef52475d25117df6a2325a151bd",
    );
    expect(migration).toContain(
      "drop function public.admin_merge_registry_artists(uuid,uuid,text,boolean)",
    );
    expect(verifier).toContain(
      "Old manual Artist merge executable authority still exists",
    );

    const manifest = JSON.parse(
      readFileSync(
        "scripts/control-plane/registry-privileged-writer-manifest.json",
        "utf8",
      ),
    ) as {
      writers: Array<{
        id: string;
        executionAuthority: string;
        disposition: string;
        futureBoundary: string;
        legacyDebt: boolean;
      }>;
    };

    expect(
      manifest.writers.find(
        (writer) => writer.id === "admin-merge-registry-artists",
      ),
    ).toBeUndefined();
    expect(
      manifest.writers.find(
        (writer) => writer.id === "admin-decouple-registry-artist",
      ),
    ).toBeUndefined();
  });

  it("classifies only the surviving reviewed product commands as high-blast writers", () => {
    const manifest = JSON.parse(
      readFileSync(
        "scripts/control-plane/registry-privileged-writer-manifest.json",
        "utf8",
      ),
    ) as {
      writers: Array<{
        id: string;
        executionAuthority: string;
        disposition: string;
        futureBoundary: string;
        legacyDebt: boolean;
      }>;
    };

    expect(
      manifest.writers.find(
        (writer) => writer.id === "admin-apply-artist-decouple-decision",
      ),
    ).toMatchObject({
      executionAuthority:
        "security_definer_reviewed_exact_grant_wrapper_over_private_mature_engine",
      disposition: "keep",
      futureBoundary: "reviewed_exact_artist_decouple_v1",
      legacyDebt: false,
    });

    expect(
      manifest.writers.find(
        (writer) => writer.id === "admin-safe-merge-registry-artists",
      ),
    ).toMatchObject({
      executionAuthority:
        "security_definer_reviewed_exact_grant_wrapper_over_private_mature_engine",
      disposition: "keep",
      futureBoundary: "reviewed_exact_artist_merge_v1",
      legacyDebt: false,
    });
  });

  it("keeps independent credit, projection, lineage, journal and zero-at-rest verification", () => {
    for (const token of [
      "MIZIZI_TRANCHE_B_HIGH_BLAST_AUTHORITY_PASS",
      "registry_track_artists",
      "registry_release_artists",
      "wk_chart_entries_v2",
      "registry_identity_lineage",
      "registry_operation_write_events",
      "Active Artist high-blast exact grant remains at rest",
      "Succeeded Artist high-blast operation lacks independent verifier PASS",
    ]) {
      expect(verifier).toContain(token);
    }
  });
});
