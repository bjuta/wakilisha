import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("All Reviews v2: governed review desk", () => {
  const page = read("src/pages/admin/review/queue/page.tsx");
  const service = read("src/services/adminReviewCommandCenter.ts");
  const miziziCores = read("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx");
  const css = read("src/pages/admin/review/queue/review-desk.css");
  const presentation = read("src/pages/admin/review/queue/reviewDeskPresentation.ts");

  it("makes active Registry work the primary reading surface", () => {
    expect(page).toContain("data-wk-review-desk");
    expect(page).toContain("Registry Review Queue");
    expect(page).toContain("wk-review-desk-workspace");
    expect(page).toContain("data-wk-registry-review-panel");
    expect(page).toContain("Other Review Sources");
    expect(page).toContain("Import and Migration Workstreams");
    expect(page).toContain("onClick={() => navigate(\"/admin/review/mizizi\")}");
    expect(page).not.toContain("Operational, not decorative");
    expect(page).not.toContain("Phase 3C.3 adds quick decisions");
    expect(page).not.toContain('className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"');
    expect(page).not.toContain("Active review load");
  });

  it("does not advertise historical or unavailable staging metrics as resolved work", () => {
    expect(service).toContain('loadRegistryReviewItems({ status: "open", limit: 18 })');
    expect(service).toContain('if (error && table === "registry_review_items") throw error');
    expect(page).toContain("An unavailable staging count is not evidence that the work is complete.");
    expect(page).toContain("openTotal={data.totals.registryReviewItems}");
    expect(page).not.toContain('label="Staging needs review"');
    expect(page).not.toContain('label="Unknown/review fields"');
  });

  it("provides precise server filtering with latest-request wins, a bounded list, and no duplicate pages", () => {
    expect(page).toContain('status: "open"');
    expect(page).toContain("requestVersion.current");
    expect(page).toContain("if (version !== requestVersion.current) return;");
    expect(page).toContain('page.rows.filter(item => !current.some(other => other.id === item.id))');
    expect(page).toContain("loadRegistryReviewItems(toRegistryFilters(nextFilters, nextOffset))");
    expect(page).toContain("REGISTRY_PAGE_SIZE = 18");
    expect(page).toContain("aria-pressed={filters.status === option.value}");
    expect(page).toContain("reviewTypeLabel(type)");
    expect(page).toContain('<WkSearchField ariaLabel="Search Registry reviews"');
  });

  it("opens an ID-specific inline source preview before entering the existing decision writer", () => {
    expect(page).toContain('data-wk-review-record={row.id}');
    expect(page).toContain('aria-expanded={expanded}');
    expect(page).toContain('id={"review-preview-" + row.id}');
    expect(page).toContain("Review Evidence and Decide");
    expect(page).toContain("groupLoadedReviewRows(rows)");
    expect(page).toContain("singleReleaseIdentityIssue(row)");
    expect(page).toContain("groupableReviewIssue(row)");
    expect(page).toContain("Current Release Slug");
    expect(page).toContain("Proposed Release Slug");
    expect(page).toContain("Recorded Issue Title");
    expect(page).toContain("data-wk-review-issue-group={group.key}");
    expect(page).toContain("Each item below is a separate Registry review.");
    expect(page).toContain("group.items.slice(0, visibleIssueItems[group.key] ?? 6)");

    expect(page).toContain("Read Governed Record");
    expect(page).toContain('onClick={open && !needsReleaseGovernance ? onOpen : onRead}');
    expect(page).toContain("Inspect Release Evidence");
    expect(page).toContain("recordRegistryReviewDecision({");
    expect(page).toContain("loadPublicMusicIdentityTrackReviewContext(item.id)");
    expect(page).toContain("expectedTrackStateFingerprint");
    expect(page).toContain('if (item.status !== "open")');
  });

  it("separates historical record reading from the open-only decision route", () => {
    expect(page).toContain('new URLSearchParams(location.search).get("record")');
    expect(page).toContain('new URLSearchParams(location.search).get("review")');
    expect(page).toContain('loadRegistryReviewItems({ reviewId: linkedRecordId, limit: 1 })');
    expect(page).toContain('data-wk-registry-record-readonly');
    expect(page).toContain("This is a record inspection. It does not change Registry data.");
    expect(miziziCores).toContain('"record" : "review"');
    expect(page).toContain("That record is no longer available.");
    expect(page).not.toContain('recordRegistryReviewDecision({ item: selectedRecord');
  });

  it("keeps the design native to WAKILISHA and responsive", () => {
    expect(css).toContain("[data-wk-review-desk]");
    expect(css).toContain("var(--wk-text)");
    expect(css).toContain(".wk-review-record-detail");
    expect(css).toContain(".wk-review-record-facts");
    expect(css).toContain("@media(max-width:700px)");
    expect(css).toContain(".wk-review-issue-trigger");
    expect(css).toContain("padding-top:70px");
    expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
    expect(presentation).toContain("genericChartIssue");
    expect(presentation).toContain("sourceDisplay");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).not.toContain("!important");
    expect(css).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("blocks generic decisions on Single Release MIZIZI conflicts in both UI and service", () => {
    expect(service).toContain('export function requiresGovernedSingleReleaseReview(');
    expect(service).toContain('item.source_payload?.ruleId === "release_single_identity_conflict"');
    const writerStart = service.indexOf("export async function recordRegistryReviewDecision(");
    const guard = service.indexOf("if (requiresGovernedSingleReleaseReview(item))", writerStart);
    const legacyInsert = service.indexOf('supabase.from("registry_canonicalization_decisions").insert', writerStart);
    expect(guard).toBeGreaterThan(writerStart);
    expect(legacyInsert).toBeGreaterThan(guard);
    expect(service).toContain("The generic review writer cannot record or resolve it.");
    expect(page).toContain("if (requiresGovernedSingleReleaseReview(item))");
    expect(page).toContain("if (requiresGovernedSingleReleaseReview(selectedItem))");
    expect(page).toContain("setSelectedRecord(item);");
    expect(page).toContain("The generic decision form cannot resolve it.");
    expect(page).toContain("Release identity review");
    expect(page).toContain("Proposed Release Slug (Not Approved)");
    expect(page).toContain("Recorded Conflict Reasons");
    expect(page).toContain("This review stays open.");
  });

  it("reads the actual Release conflict reasons and styles the portalled modal", () => {
    expect(page).toContain("item.source_payload?.reasonCodes ?? programmeCandidate.reasonCodes");
    expect(page).toContain("Recorded Conflict Reasons");
    expect(page).toContain("reasonCodes.map(reason =>");
    expect(page).toContain("hasRecordedResolution");
    expect(page).toContain("Object.keys(item.resolution_payload).length > 0");
    expect(page).toContain("wk-review-record-meta-facts");
    expect(css).toContain("[data-wk-registry-record-readonly] .wk-review-record-facts");
    expect(css).toContain("[data-wk-registry-record-readonly] .wk-review-record-modal-head");
    expect(css).toContain("[data-wk-registry-record-readonly] .wk-release-reason-block");
    expect(css).toContain("@media(max-width:600px)");
  });

  it("labels revision authority when the Track already has a recorded human decision", () => {
    expect(page).toContain("hasRecordedTrackDecision");
    expect(page).toContain("A human decision is already recorded for this Track.");
    expect(page).toContain("Recording another decision will supersede it.");
    expect(page).toContain("Record Revised Decision");
    expect(page).toContain("{!publicMusicReview ? (");
    expect(page).not.toContain('label="Source artist text" value={artistText || "Missing"}');
  });

  it("reads exact canonical subjects in one bounded queue batch and keeps metadata subordinate", () => {
    expect(page).toContain("function useLoadedCanonicalTitles(");
    expect(page).toContain("const canonicalTitles = useLoadedCanonicalTitles(rows);");
    expect(page).toContain("canonicalTitle={canonicalTitles[row.id]}");
    expect(page).toContain('row.source_table === "registry_releases"');
    expect(page).toContain('row.source_table === "registry_tracks"');
    expect(page).toContain("sourceIds.slice(offset, offset + 100)");
    expect(page).toContain("const reviewedTitle = canonicalTitle ||");
    expect(page).toContain("Current slug: ");
    expect(page).toContain('summary="Review references"');
    expect(page).toContain("What needs review");
    expect(page).toContain("The generic decision form cannot resolve it.");
    expect(css).toContain(".wk-review-record-issue-summary");
  });

  it("never copies preset verification assertions into human decision notes", () => {
    expect(page).toContain('const setPreset = (decisionType: RegistryDecisionType) => {');
    expect(page).toContain('decisionType, notes: "", message: ""');
    expect(page).toContain('decisionType: value as RegistryDecisionType, notes: "", message: ""');
    expect(page).toContain('disabled={decision.submitting || !decision.notes.trim()}');
    expect(page).toContain('if (!notes) {');
    expect(page).not.toContain('setPreset("approve_primary_artist", "Verified');
    expect(page).not.toContain('setPreset("public_music_identity_true_duplicate", "Authoritative evidence');
  });

});
