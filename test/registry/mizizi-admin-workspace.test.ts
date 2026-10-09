import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("MIZIZI Admin workspace", () => {
  const page = read("src/pages/admin/review/mizizi/page.tsx");
  const shell = read("src/pages/admin/AdminShell.tsx");
  const routes = read("src/router/config.tsx");
  const lazy = read("src/router/lazyAdmin.tsx");
  const search = read("src/data/adminSearchIndex.ts");
  const service = read("src/services/adminReviewCommandCenter.ts");
  const knowledge = read("docs/registry/REGISTRY_KNOWLEDGE_CONTRACT.md");

  it("gives MIZIZI a dedicated current-work surface", () => {
    expect(page).toContain("data-wk-mizizi-workspace");
    expect(page).toContain("Needs a decision");
    expect(page).toContain("Approved");
    expect(page).toContain("Credit issues");
    expect(page).toContain("Needs research");
    expect(page).toContain("All current work");
    expect(page).toContain("Record and Next");
  });

  it("uses plain decisions instead of raw implementation language", () => {
    for (const copy of [
      "Use clean slug",
      "Same recording",
      "Different recording",
      "Fix credits",
      "Need more evidence",
      "Which Track should remain?",
    ]) {
      expect(page).toContain(copy);
    }

    expect(page).not.toContain("Candidate payload");
    expect(page).not.toContain("Source payload");
    expect(page).not.toContain("Operational, not decorative");
    expect(page).not.toContain("Phase 3C.3");
    expect(page).not.toContain("—");
  });

  it("loads every current MIZIZI Track review before applying programme filters", () => {
    expect(page).toContain("loadCurrentProgrammeReviews");
    expect(page).toContain("offset,");
    expect(page).toContain("total = page.total");
    expect(page).toContain("offset += page.rows.length");
    expect(page).toContain("while (offset < total)");
    expect(page).toContain("reviews.set(review.id, review)");
  });

  it("reuses the existing reviewed decision authority", () => {
    expect(page).toContain("recordRegistryReviewDecision");
    expect(page).toContain("loadPublicMusicIdentityTrackReviewContext");
    expect(page).toContain("public_music_identity_true_duplicate");
    expect(page).toContain("public_music_identity_safe_slug_repair");
    expect(page).toContain("admin_mizizi_workspace");
  });

  it("adds contribution provenance as typed human review instead of a second mutation path", () => {
    expect(page).toContain("data-wk-mizizi-provenance-reviews");
    expect(page).toContain("Contribution provenance");
    expect(page).toContain("loadCurrentProvenanceReviews");
    expect(page).toContain("loadMusicProvenanceContributionReviewContext");
    expect(page).toContain("expectedProvenanceContextFingerprint");
    expect(page).toContain("Admit contribution");
    expect(page).toContain("Require fresh attestation");
    expect(page).toContain("Escalate integrity conflict");
    expect(page).toContain("Need more evidence");
    expect(page).toContain(
      "Only a human review can admit a canonical contribution.",
    );
    expect(page).toContain("rightsClaimInferred: false");

    expect(service).toContain("isMusicProvenanceContributionReview");
    expect(service).toContain(
      "admin_get_music_provenance_contribution_review_context_v1",
    );
    expect(service).toContain(
      "admin_record_music_provenance_contribution_review_decision_v1",
    );
    expect(service).toContain(
      "buildMusicProvenanceProjectionRefreshPlan",
    );
    expect(service).toContain(
      '"public_content_read"',
    );
    expect(service).toContain(
      '"person_music_credits"',
    );
    expect(service).toContain(
      '"artist_music"',
    );
    expect(service).toContain(
      '"seo_metadata"',
    );
    expect(service).toContain(
      '"prerender"',
    );
    expect(service).toContain(
      '"sitemap"',
    );
    expect(service).toContain(
      "dependencyFanout",
    );
    expect(page).toContain(
      "provenanceContext: context",
    );

    expect(page).not.toContain("Candidate payload");
    expect(page).not.toContain("Source payload");
    expect(page).not.toContain("—");
  });

  it("uses explicit Artist billing and contribution terminology", () => {
    expect(page).toContain(
      "Track Artist billing needs correction",
    );
    expect(page).toContain(
      "Track Artist billing needs attention",
    );
    expect(page).not.toContain(
      "Track credits need",
    );

    expect(knowledge).toContain(
      "Track Artist billing | `registry_track_artists`",
    );
    expect(knowledge).toContain(
      "Release Artist billing | `registry_release_artists`",
    );
    expect(knowledge).toContain(
      "Recording Contributions -> `registry_track_contributions`",
    );
    expect(knowledge).toContain(
      "Work Contributions -> `registry_work_contributions`",
    );
  });

  it("keeps the decision modal viewport-bound with pinned actions", () => {
    expect(page).toContain('from "@/components/design-system/primitives/Modal"');
    expect(page).toContain("<Modal");
    expect(page).toContain("footer={footer}");
    expect(page).not.toContain(
      'className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"',
    );
    expect(page).not.toContain('max-h-[calc(92vh-150px)]');
  });

  it("gives approved #1094 batch decisions a dedicated one-action view", () => {
    const exact = read("src/pages/admin/review/mizizi/issue1094.tsx");
    expect(page).toContain('get("task") === "1094-d1-d3"');
    expect(page).toContain("<Issue1094ExactDecisions />");
    expect(exact).toContain("data-wk-mizizi-1094-decisions");
    expect(exact).toContain("data-wk-1094-record-decisions");
    expect(exact).toContain("const checked = await load()");
    expect(exact).toContain("if (row.recorded) continue");
    expect(exact).toContain("recordRegistryReviewDecision({");
    expect(exact).toContain('decisionType: "public_music_identity_true_duplicate"');
    expect(exact).toContain("expectedTrackStateFingerprint: row.context.trackStateFingerprint");
    expect(exact).not.toContain("admin_apply_registry_track_duplicate_repair");
    expect(exact).not.toContain("—");
  });

  it("routes #1094 repaired decisions to the existing bounded duplicate authority", () => {
    const repair = read("src/pages/admin/review/mizizi/issue1094RepairGate.tsx");
    expect(page).toContain('task === "1094-repairs"');
    expect(page).toContain("<Issue1094RepairGate />");
    expect(repair).toContain("data-wk-1094-governed-repair-gate");
    expect(repair).toContain('admin_preview_registry_track_duplicate_repair');
    expect(repair).toContain('admin_apply_registry_track_duplicate_repair');
    expect(repair).toContain('reviewedHumanDecisionMatches === 1');
    expect(repair).toContain('value.confidenceBucket === "high"');
    expect(repair).toContain('value.blockers.length === 0');
    expect(repair).toContain("current = await preview(target)");
    expect(repair).toContain("destructive: true");
    expect(repair).toContain("p_allow_medium_confidence: false");
    expect(repair).toContain("DESIRE: blocked");
    expect(repair).not.toContain("admin_finalize_public_music_identity");
    expect(repair).not.toContain("service_role");
    expect(repair).not.toContain("—");
  });

  it("wires MIZIZI into Admin without replacing audit history", () => {
    expect(lazy).toContain("AdminMiziziWorkspacePage");
    expect(routes).toContain('{ path: "mizizi", element: <AdminMiziziWorkspacePage /> }');
    expect(shell).toContain('{ path: "/admin/review/mizizi", label: "MIZIZI"');
    expect(shell).toContain('{ path: "/admin/review/queue", label: "All Reviews"');
    expect(search).toContain('id: "mizizi"');
    expect(search).toContain('path: "/admin/review/mizizi"');
  });
});
