import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("All Reviews v2: governed review desk", () => {
  const page = read("src/pages/admin/review/queue/page.tsx");
  const service = read("src/services/adminReviewCommandCenter.ts");
  const miziziCores = read("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx");
  const css = read("src/pages/admin/review/queue/review-desk.css");

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
    expect(page).toContain("Read Governed Record");
    expect(page).toContain('onClick={open ? onOpen : onRead}');
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
    expect(page).toContain("This is a record inspection. It does not offer a new decision");
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
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).not.toContain("!important");
    expect(css).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
