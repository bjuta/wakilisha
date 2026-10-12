import { describe, expect, it, vi } from "vitest";
import {
  loadHeadquartersQueueV2,
  projectHeadquartersQueueV2,
  HEADQUARTERS_QUEUE_PAGE_SIZE,
} from "../../src/services/miziziHeadquartersBrief";
import type { RegistryQueueFactV2, RegistryQueuePageV2 } from "../../src/services/miziziHeadquartersBrief";
import { readFileSync } from "node:fs";
import { projectMiziziReviewRootsV1 } from "../../src/services/miziziReviewRoots";
import { selectOperatorReviewPageV1, selectReviewForInspectionV1 } from "../../src/services/operatorReviewSelection";
import { ISSUE_1094_CASES, projectIssue1094Brief, type Issue1094ReviewFact, type Issue1094DecisionFact } from "../../src/services/miziziIssue1094Brief";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => { throw new Error("Unexpected live database access in unit test"); } },
}));

const REVIEW: RegistryQueueFactV2 = {
  id: "09d0bc04-cf63-4c7a-aa91-eb21284a9dce",
  entity_type: "track", review_type: "mizizi_data_hygiene", status: "open",
  title: "Recording needs review", updated_at: "2026-10-10T08:30:00Z",
};
const UUID_B = "19d0bc04-cf63-4c7a-aa91-eb21284a9dce";
const UUID_C = "29d0bc04-cf63-4c7a-aa91-eb21284a9dce";
const UUID_D = "39d0bc04-cf63-4c7a-aa91-eb21284a9dce";
const DATE = "2026-10-10T10:00:00.000Z";
const mkPage = (rows: RegistryQueueFactV2[], total = rows.length, offset = 0): RegistryQueuePageV2 => ({
  rows, total, offset, limit: HEADQUARTERS_QUEUE_PAGE_SIZE,
});

describe("MIZIZI verified-case subject Field", () => {
  it("requires a search and only projects real authenticated MIZIZI reviews", () => {
    const source=readFileSync("src/services/miziziCaseField.ts","utf8");
    const field=readFileSync("src/pages/admin/review/mizizi/MiziziReviewField.tsx","utf8");
    expect(source).toContain('r.workstream==="mizizi_data_hygiene"');
    expect(source).toContain('.in("id",target.map(x=>x.id))');
    expect(source).toContain('"registry_track_artists"');
    expect(source).toContain('if(!q) return []');
    expect(field).toContain("loadMiziziCaseSubjects(queue)");
    expect(field).toContain("searchMiziziFieldHits(cases, search, filter)");
    expect(field).toContain("projectMiziziFieldFocus(cases, chosenKey, filter)");
    expect(field).toContain('canvas.addEventListener("wheel", wheel, { passive: false })');
    expect(field).toContain('onPointerDown={down} onPointerMove={move} onPointerUp={up}');
    expect(field).toContain('if (node?.kind === "artist" || node?.kind === "case") centerOn(node.key)');
    expect(field).toContain("chosen && nodesByKey.has(chosen)");
    expect(field).not.toContain("matches.some(h => h.key === chosen)");
    expect(field).toContain('aria-label="Selected Registry entity"');
    expect(field).toContain("relatedReviews.map(record =>");
    expect(field).toContain("credit.id === focused.artistId");
    expect(field).toContain('onInspect(record.reviewId)');
    expect(field).toContain('centerOn("artist:" + credit.id)');
    expect(field).not.toContain("M.CLIENTS");
  });
});

describe("Governed Decision Work follows the selected-job list/detail layout", () => {
  it("keeps decision writes behind the current evidence-loading modal", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/page.tsx", "utf8");
    expect(source).toContain('<WkSplitWorkspace data-wk-mizizi-decision-workspace>');
    expect(source).toContain('data-wk-mizizi-decision-pagination');
    expect(source).toContain('focusedDecision.review.title');
    expect(source).toContain("Recorded route comparison · Proposed, not applied");
    expect(source).toContain("onClick={() => void openReview(focusedDecision)}");
    expect(source).toContain('await loadDetail(item.review.id)');
    expect(source).toContain('await recordRegistryReviewDecision({');
    expect(source).not.toContain('onClick={() => void openReview(item)}');
  });
});

describe("Flat master/detail history and evidence workspaces", () => {
  it("uses one shared divider-based split with compact edge selectors", () => {
    const shell = readFileSync("src/components/data-viz/WkSplitWorkspace.tsx", "utf8");
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    expect(shell).toContain("lg:grid-cols-[360px_minmax(0,1fr)]");
    expect(shell).not.toContain("rounded-2xl");
    expect(source).toContain("<WkSplitWorkspace");
    expect(source).toContain('data-wk-edge-filters');
    expect(source).toContain('className="cores"');
    expect(source).toContain('className="core-pane"');
    expect(source).toContain('className="core-body"');
    expect(source).toContain('<RecordedLayer name="Current Value"');
    expect(source).toContain("They are not independent evidence groups.");
    expect(source).toContain('mode === "history"');
    expect(source).toContain("outbound-delivery ledger");
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/);
  });
});

describe("MIZIZI reference-inspired, live-data operational workspace", () => {
  it("keeps Brief, Field, Cores, History and governed Decision Work distinct", () => {
    const page = readFileSync("src/pages/admin/review/mizizi/page.tsx", "utf8");
    expect(page).toContain('useState<"brief" | "field" | "cores" | "history" | "decisions">("brief")');
    for (const label of ["Brief", "Field", "Cores", "History", "Decision Work"]) {
      expect(page).toContain(`label: "${label}"`);
    }
    expect(page).toContain('workspaceView === "decisions"');
    expect(page).toContain('view={workspaceView}');
    expect(page).toContain('onShowCases={() => setWorkspaceView("cores")}');
    expect(page).toContain("selectedId={selectedCaseId}");
    expect(page).toContain("data-wk-mizizi-decision-pagination");
    expect(page).toContain("visibleItems.slice(decisionPageStart, decisionPageStart + 15)");
    expect(page).toContain("pagedItems.map");
    expect(page).toContain("<WkSearchField");
    expect(page).toContain("<AriaTextArea");
    expect(page).toContain("<AriaTextField");
    expect(page).not.toMatch(/<(?:input|textarea|select)\b/);
  });

  it("uses the reference's useful interactions, not its fabricated data or visual language", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    expect(source).toContain('view === "brief"');
    expect(source).toContain('view === "field"');
    expect(source).toContain('view === "cores"');
    expect(source).toContain('view === "history"');
    expect(source).toContain("How long do you have?");
    expect(source).toContain("Five minutes");
    expect(source).toContain("Fifteen minutes");
    expect(source).toContain("An hour");
    expect(source).toContain("<MiziziEvidenceWorkbench");
    expect(source).toContain("Issue1094WorthKnowing revision={revision} onInspect={inspect}");
    expect(source).toContain("queue.recentOpen.slice(0, 4)");
    expect(source).toContain('<MiziziEvidenceWorkbench mode="history"');
    expect(source).toContain("Show Receipt");
    expect(source).toContain("View Evidence in Cores");
    expect(source).toContain("expandedReceipt === item.reviewId");
    expect(source).toContain("<WkSurface");
    expect(source).toContain("<MiziziReviewField");
    expect(source).toContain("<WkButton");
    expect(source).not.toMatch(/<select\b|<dialog\b|<input\b|<textarea\b/);
    expect(source).toContain("<MiziziReviewRoots queue={queue} onInspect={inspect} />");
    expect(source).toContain("queue.items");
    expect(source).toContain("queue.resolved.toLocaleString()");
    expect(source).toContain("queue.open.toLocaleString()");
    expect(source).not.toContain("Northline Audio");
  });

  it("requires a selected authorized case and never fabricates evidence or writes", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    expect(source).toContain('queue.items.some((item) => item.id === id)');
    expect(source).toContain('.from("registry_review_items")');
    expect(source).toContain('.eq("id", selected.id).single()');
    expect(source).toContain("Current evidence is unavailable or changed");
    expect(source).toContain("No new decision will be made here");
    expect(source).toContain("Open Governed Review");
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/);
    expect(source).not.toMatch(/#84C241|#E5AC43|#170F0A|M\.CLIENTS/);
  });
});

describe("Shared visual data primitives — source-aligned, not decorative", () => {
  it("renders status distribution and ranked workstreams from the existing Registry queue", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const rootsUi = readFileSync("src/pages/admin/review/mizizi/MiziziReviewRoots.tsx", "utf8");
    expect(source).toContain("<MiziziReviewRoots queue={queue} onInspect={inspect}");
    expect(source).toContain("<WkStatusDistribution");
    expect(source).toContain("<WkRankedBars");
    expect(rootsUi).toContain("projectMiziziReviewRootsV1(queue)");
    expect(rootsUi).toContain("recorded review");
    expect(rootsUi).toContain("data-wk-root-review={review.id}");
    expect(rootsUi).toContain("chooseReview(group.key, subject.name, review.id)");
    expect(rootsUi).toContain("selectedReviewId");
    expect(rootsUi).toContain('data-wk-root-selected={selectedReview.id}');
    expect(rootsUi).toContain("onInspect(selectedReview.id)");
    expect(rootsUi).toContain("Show more reviews");
    expect(rootsUi).not.toContain("Math.random");
    expect(rootsUi).not.toContain("<canvas");
    expect(source).toContain("queue.items");
    expect(source).toContain("queue.open.toLocaleString()");
    expect(source).toContain("queue.resolved.toLocaleString()");
    expect(source).toContain("queue.workstreams.filter(group => group.open > 0)");
    expect(source).toContain('panelClassName="mz-session-modal"');
    expect(source).toContain('aria-label="Focused review session"');
    expect(source).toContain("sessionItems.map((item, index)");
    expect(source).toContain("current.sourceStatus");
    expect(source).toContain("setSkipped(ids =>");
    expect(source).toContain("onInspect(id)");
    expect(source).not.toContain("Recorded: Three groups.");
    expect(rootsUi).toContain("snapshot, not a history of actions");
    const css = readFileSync("src/pages/admin/review/mizizi/mizizi-html.css", "utf8");
    expect(css).toContain(".mz-roots-tree");
    expect(css).toContain(".mz-field-artifact-trigger");
    expect(css).toContain(".mz-session-progress");
    expect(css).not.toContain("#growth");
    const fields = readFileSync("src/components/design-system/primitives/Field.tsx", "utf8");
    const foundation = readFileSync("src/design-system/wakilisha.elements.foundation.css", "utf8");
    expect(fields).toContain("data-wk-search-input");
    expect(fields).toContain("data-wk-password-input");
    expect(foundation).toContain("input.wk-input[data-wk-search-input]");
    expect(foundation).toContain("padding-inline-start:42px");
    expect(css).not.toContain("!important");
  });

  it("fails closed on bad metric arithmetic and remains accessible without colour", () => {
    const distribution = readFileSync("src/components/data-viz/WkStatusDistribution.tsx", "utf8");
    const ranked = readFileSync("src/components/data-viz/WkRankedBars.tsx", "utf8");
    expect(distribution).toContain("Number.isSafeInteger");
    expect(distribution).toContain("total !== expectedTotal");
    expect(distribution).toContain("aria-label={ariaLabel}");
    expect(distribution).toContain("className=\"sr-only\"");
    expect(distribution).toContain("data-wk-status-distribution");
    expect(ranked).toContain("Number.isSafeInteger");
    expect(ranked).toContain("data-wk-ranked-bars");
    expect(ranked).toContain('valueLabel = "items"');
    expect(distribution + ranked).not.toMatch(/#84C241|#E5AC43|#170F0A|M\.CLIENTS/);
  });
});


describe("MIZIZI objective Registry review roots", () => {
  const rows: RegistryQueueFactV2[] = [
    REVIEW,
    { ...REVIEW, id: UUID_B, status: "resolved", entity_type: "release" },
    { ...REVIEW, id: UUID_C, review_type: "chart_entry_missing_canonical_link",
      entity_type: "track", status: "open", title: "Missing Chart link" },
    { ...REVIEW, id: UUID_D, review_type: "future_specialist_queue",
      entity_type: "recording", status: "awaiting_evidence", title: "Unknown review state" },
  ];
  const queue = projectHeadquartersQueueV2([mkPage(rows)], DATE);

  it("plots only real review-to-workstream-to-subject membership with all states", () => {
    const roots = projectMiziziReviewRootsV1(queue);
    expect(roots.total).toBe(4);
    expect(roots.workstreams.map(x => x.key)).toEqual([
      "chart_entry_missing_canonical_link", "mizizi_data_hygiene", "future_specialist_queue",
    ]);
    const music = roots.workstreams.find(x => x.key === "mizizi_data_hygiene");
    if (!music) throw new Error("Missing recorded music review branch");
    expect(music).toMatchObject({ total: 2, open: 1, resolved: 1, other: 0 });
    expect(music.subjects.map(x => [x.name, x.reviews.length])).toEqual([
      ["release", 1], ["track", 1],
    ]);
    expect(music.subjects.flatMap(x => x.reviews.map(r => r.id)).sort())
      .toEqual([REVIEW.id, UUID_B].sort());
    expect(roots.workstreams.find(x => x.key === "future_specialist_queue")?.subjects[0].reviews[0].sourceStatus).toBe("awaiting_evidence");
    expect(roots.workstreams.flatMap(w => w.subjects.flatMap(x => x.reviews)).map(x => x.id).sort())
      .toEqual(rows.map(x => x.id).sort());
  });

  it("refuses duplicate, missing, relabelled or contradictory workstream membership", () => {
    expect(() => projectMiziziReviewRootsV1({ ...queue, open: queue.open + 1 })).toThrow();
    expect(() => projectMiziziReviewRootsV1({ ...queue, items: queue.items.slice(1) })).toThrow();
    expect(() => projectMiziziReviewRootsV1({
      ...queue, items: [queue.items[0], queue.items[0], ...queue.items.slice(2)],
    })).toThrow();
    expect(() => projectMiziziReviewRootsV1({
      ...queue, workstreams: [{ ...queue.workstreams[0], open: queue.workstreams[0].open + 1 }, ...queue.workstreams.slice(1)],
    })).toThrow();
    expect(() => projectMiziziReviewRootsV1({
      ...queue, items: queue.items.map((item, i) => i === 0 ?
        { ...item, subjectType: "unrecorded-bogus-subject" } : item),
    })).toThrow();
    expect(() => projectMiziziReviewRootsV1({
      ...queue, workstreams: queue.workstreams.slice(1),
    })).toThrow();
    expect(() => projectMiziziReviewRootsV1({
      ...queue, items: queue.items.map((item, i) => i === 0 ?
        { ...item, sourceStatus: "resolved" } : item),
    })).toThrow();
  });

  it("makes missing entity types explicitly Unclassified, not an invented entity", () => {
    const source = { ...REVIEW, entity_type: null };
    const result = projectHeadquartersQueueV2([mkPage([source])], DATE);
    expect(result.items[0].subjectType).toBe("Unclassified");
    expect(projectMiziziReviewRootsV1(result).workstreams[0].subjects[0].name)
      .toBe("Unclassified");
  });
});

describe("Headquarters complete Registry review inventory", () => {
  it("accounts for all 301 known review records in the accepted corpus shape", () => {
    const rows = Array.from({ length: 301 }, (_, i): RegistryQueueFactV2 => {
      const open = i < 225;
      const type = i < 149 || (i >= 225 && i < 300)
        ? "mizizi_data_hygiene"
        : i < 198 || i === 300
          ? "chart_entry_missing_canonical_link"
          : "chart_provisional_label_write";
      return {
        ...REVIEW,
        id: `09d0bc04-cf63-4c7a-aa91-${i.toString(16).padStart(12, "0")}`,
        status: open ? "open" : "resolved",
        review_type: type,
        entity_type: i < 109 ? "track" : i < 149 ? "release" : "track",
      };
    });
    const pages = [0, 100, 200, 300].map((offset) =>
      mkPage(rows.slice(offset, offset + 100), 301, offset));
    const result = projectHeadquartersQueueV2(pages, DATE);
    expect(result).toMatchObject({ total: 301, open: 225, resolved: 76, other: 0 });
    expect(result.items).toHaveLength(301);
    expect(result.workstreams.map(({ key, open }) => ({ key, open }))).toEqual([
      { key: "mizizi_data_hygiene", open: 149 },
      { key: "chart_entry_missing_canonical_link", open: 49 },
      { key: "chart_provisional_label_write", open: 27 },
    ]);
    expect(result.workstreams[0].subjects).toEqual([
      { label: "track", open: 109 }, { label: "release", open: 40 },
    ]);
  });

  it("includes every category rather than treating MIZIZI as the whole queue", () => {
    const result = projectHeadquartersQueueV2([mkPage([
      REVIEW,
      { ...REVIEW, id: UUID_B, review_type: "chart_entry_missing_canonical_link", title: "Chart link" },
      { ...REVIEW, id: UUID_C, review_type: "chart_provisional_label_write", status: "resolved" },
      { ...REVIEW, id: UUID_D, review_type: "new_specialist_review", status: "pending" },
    ])], DATE);
    expect(result).toMatchObject({ total: 4, open: 2, resolved: 1, other: 1 });
    expect(result.workstreams.map((g) => g.key)).toEqual(expect.arrayContaining([
      "mizizi_data_hygiene", "chart_entry_missing_canonical_link", "chart_provisional_label_write", "new_specialist_review",
    ]));
    expect(result.recentOpen).toHaveLength(2);
    expect(result.items.find((item) => item.id === UUID_D)?.sourceStatus).toBe("pending");
  });

  it("shows newest records ahead of older UUIDs", () => {
    const result = projectHeadquartersQueueV2([mkPage([
      { ...REVIEW, updated_at: "2026-10-08T08:30:00Z" },
      { ...REVIEW, id: UUID_B, updated_at: "2026-10-10T08:30:00Z" },
    ])], DATE);
    expect(result.recentOpen[0].id).toBe(UUID_B);
  });

  it("retains the actual Track and Release breakdown for each group", () => {
    const result = projectHeadquartersQueueV2([mkPage([
      REVIEW, { ...REVIEW, id: UUID_B, entity_type: "release" },
    ])], DATE);
    expect(result.workstreams[0].subjects).toEqual([
      { label: "release", open: 1 }, { label: "track", open: 1 },
    ]);
  });

  it("paginates the complete review inventory with no 100-row truncation", async () => {
    const rows = Array.from({ length: 101 }, (_, i): RegistryQueueFactV2 => ({
      ...REVIEW, id: `09d0bc04-cf63-4c7a-aa91-${i.toString(16).padStart(12, "0")}`,
    }));
    const reader = vi.fn(async ({ offset = 0 }: { offset?: number }) =>
      mkPage(rows.slice(offset, offset + HEADQUARTERS_QUEUE_PAGE_SIZE), rows.length, offset));
    const result = await loadHeadquartersQueueV2(reader);
    expect(result.open).toBe(101);
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it("rejects incomplete, duplicate, or contradictory pages", () => {
    expect(() => projectHeadquartersQueueV2([mkPage([REVIEW], 2)], DATE)).toThrow();
    expect(() => projectHeadquartersQueueV2([mkPage([REVIEW, REVIEW])], DATE)).toThrow();
    expect(() => projectHeadquartersQueueV2([mkPage([{ ...REVIEW, id: "invalid" }])], DATE)).toThrow();
  });

  it("rejects a moving or oversized inventory instead of concealing other work", async () => {
    const reader = vi.fn(async () => mkPage([], 5001));
    await expect(loadHeadquartersQueueV2(reader)).rejects.toThrow(/limit/);
  });

  it("never changes source rows or infers approved decisions", () => {
    const input = mkPage([REVIEW]);
    const before = JSON.stringify(input);
    const result = projectHeadquartersQueueV2([input], DATE);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.keys(result)).not.toContain("approved");
    expect(Object.keys(result)).not.toContain("cases");
  });

  it("uses the existing WAKILISHA custom UI components and keeps internal explanation out of copy", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const field = readFileSync("src/pages/admin/review/mizizi/MiziziReviewField.tsx", "utf8");
    const cores = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    expect(source).toContain("<WkSurface");
    expect(source).toContain("<WkButton");
    expect(source).toContain("<MiziziReviewField");
    expect(field).toContain("<WkSearchField");
    const page = readFileSync("src/pages/admin/review/mizizi/page.tsx", "utf8");
    const css = readFileSync("src/pages/admin/review/mizizi/mizizi-html.css", "utf8");
    expect(field).toContain("Reviewed recording or release");
    expect(field).toContain('className="field"');
    expect(field).toContain('id="fieldCanvas"');
    expect(field).toContain("buildGraph(cases)");
    expect(field).toContain("<WkGraphLegend");
    expect(field).toContain("<WkViewportControls");
    expect(field).toContain("Browse reviews as a list");
    expect(field).toContain("<WkDisclosure");
    expect(field).not.toMatch(/<(?:details|summary)\\b/);
    expect(field).toContain("prefers-reduced-motion: reduce");
    expect(field).toContain("readPalette(c)");
    expect(field).toContain("requestAnimationFrame(frame)");
    expect(field).not.toMatch(/#[0-9a-f]{6}/i);
    const legend = readFileSync("src/components/data-viz/WkGraphLegend.tsx", "utf8");
    expect(legend).toContain("export function WkGraphLegend");
    expect(legend).toContain("item.toggleable");
    expect(legend).toContain("aria-pressed={item.visible !== false}");
    expect(field).toContain("Credit links are not rights.");
    expect(page).toContain('import "./mizizi-html.css"');
    expect(page).toContain('className="mz-rootband"');
    expect(css).toContain("background:var(--wk-bg)");
    expect(css).toContain("color:var(--wk-text)");
    expect(css).toContain(".wk-mizizi-search .wk-input");
    expect(css).not.toContain("--soil-0");
    expect(css).not.toContain("!important");
    expect(css).not.toMatch(/#[0-9a-f]{6}/i);
    expect(css).not.toContain("[data-wk-mizizi-workspace] button{");
    expect(css).toContain("[data-wk-mizizi-workspace] .field");
    expect(css).not.toContain("Northline Audio");
    expect(cores).toContain("<WkSearchField");
    expect(cores).toContain('data-wk-edge-filters');
    expect(field + cores).not.toMatch(/<select\b|<input\b|<textarea\b/);
    expect(source).not.toMatch(/<select\b|<input\b|<textarea\b/);
    expect(source).not.toMatch(/DB02|SQL|migration|contract|canonical DML|verifier|schema|—/);
  });
});


describe("Headquarters review explorer", () => {
  const rows = Array.from({length: 61}, (_, i): RegistryQueueFactV2 => ({
    ...REVIEW,
    id: `09d0bc04-cf63-4c7a-aa91-${i.toString(16).padStart(12, "0")}`,
    review_type: i < 26 ? "mizizi_data_hygiene" : i < 51 ? "chart_entry_missing_canonical_link" : "new_workstream",
    status: i < 45 ? "open" : i < 55 ? "resolved" : "waiting",
    title: i === 24 ? "A special question" : `Review ${i}`,
  }));
  const pages = [0].map((offset) => mkPage(rows, rows.length, offset));
  const queue = projectHeadquartersQueueV2(pages, DATE);

  it("paginates every workstream rather than the eight recent previews", () => {
    const q = { status: "open" as const, workstream: "", search: "", page: 1 };
    expect(selectOperatorReviewPageV1(queue.items, q)).toMatchObject({ total: 45, start: 1, end: 20, totalPages: 3 });
    const finalPage = selectOperatorReviewPageV1(queue.items, {...q,page:3});
    expect(finalPage).toMatchObject({ total: 45, start: 41, end: 45 });
    expect(finalPage.items).toHaveLength(5);
  });

  it("filters by exact workstream and visible review text", () => {
    const q = { status: "open" as const, workstream: "mizizi_data_hygiene", search: "SPECIAL QUESTION", page: 1 };
    const out = selectOperatorReviewPageV1(queue.items, q);
    expect(out.total).toBe(1);
    expect(out.items[0].title).toBe("A special question");
  });

  it("finds an existing review by its exact reference without another database query", () => {
    const id = rows[24].id;
    const match = selectOperatorReviewPageV1(queue.items, {status:"all",workstream:"",search:id,page:1});
    expect(match.total).toBe(1);
    expect(match.items[0].id).toBe(id);
  });

  it("shows unknown categories and nonstandard statuses without losing rows", () => {
    const other = selectOperatorReviewPageV1(queue.items, {status:"other",workstream:"",search:"",page:1});
    expect(other.total).toBe(6);
    expect(other.items.every(item => item.sourceStatus === "waiting")).toBe(true);
    expect(selectOperatorReviewPageV1(queue.items, {status:"all",workstream:"",search:"",page:1}).total).toBe(61);
  });

  it("keeps selection immutable, bounds stale pages, and rejects malformed filters", () => {
    const old = JSON.stringify(queue.items);
    const result = selectOperatorReviewPageV1(queue.items, {status:"open",workstream:"",search:"",page:99});
    expect(result.currentPage).toBe(3);
    expect(JSON.stringify(queue.items)).toBe(old);
    expect(() => selectOperatorReviewPageV1(queue.items,{status:"open",workstream:"",search:"",page:0})).toThrow();
  });
});


describe("Headquarters in-place review inspection", () => {
  const candidate = {
    id: "9a0a6b71-b0aa-4654-ad6c-18e557195208",
    title: "A review", workstream: "mizizi_data_hygiene", workstreamLabel: "Music Identity and Credits",
    subjectType: "release", status: "open" as const, sourceStatus: "open", updatedAt: null,
  };
  it("selects an existing authorized snapshot row without a fresh ID lookup", () => {
    const result = selectReviewForInspectionV1([candidate], candidate.id);
    expect(result).toBe(candidate);
    expect(selectReviewForInspectionV1([candidate], null)).toBeNull();
  });
  it("closes after refresh when a review vanishes, and rejects malformed or unrelated IDs", () => {
    expect(selectReviewForInspectionV1([], candidate.id)).toBeNull();
    expect(selectReviewForInspectionV1([candidate], "1234")).toBeNull();
    expect(selectReviewForInspectionV1([candidate], "4d2d4ad9-271e-4862-822b-6395cf271918")).toBeNull();
  });
  it("keeps bounded sessions review-only with explicit skip and Done for Now", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    expect(source).toContain("function OperatorReviewSession(");
    expect(source).toContain('value: "5", title: "Five minutes"');
    expect(source).toContain('value: "15", title: "Fifteen minutes"');
    expect(source).toContain('value: "60", title: "An hour"');
    expect(source).toContain("Skip for Now");
    expect(source).toContain("Done for Now");
    expect(source).toContain('queue.items.filter((item) => item.status === "open")');
    expect(source).toContain("onInspect(nextReview.id)");
    expect(source).toContain("Skipping never records a decision.");
    expect(source).toContain("No changes saved");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("Approve Review");
  });

  it("opens only authorized reviews in custom Cores, never browser-native or automatic decisions", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const cores = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    expect(source).toContain('queue?.items.some((item) => item.id === id)');
    expect(source).toContain("onSelectedIdChange(id)");
    expect(source).toContain("onShowCases()");
    expect(source).toContain("<MiziziEvidenceWorkbench");
    expect(cores).toContain("<WkSplitWorkspace");
    expect(cores).toContain("Open Governed Review");
    expect(cores).toContain("No new decision will be made here");
    expect(source + cores).not.toMatch(/<dialog\b|<select\b|<input\b|<textarea\b/);
    expect(source + cores).not.toContain("Approve Review");
    expect(cores).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/);
  });
});

describe("Headquarters #1094 live receipt convergence", () => {
  const [desire, ficha, colors] = ISSUE_1094_CASES;
  const review = (target: typeof ISSUE_1094_CASES[number], status: string): Issue1094ReviewFact => ({
    id: target.reviewId,
    status,
    source_id: target.duplicateId,
    source_payload: { ruleId: "track_recording_identity_conflict", ruleVersion: "1.3.0" },
    resolution_payload: status === "resolved" ? {
      decisionId: target.decisionId,
      verifiedOperationId: target.operationId,
      canonicalTrackId: target.survivorId,
      sourceTrackId: target.duplicateId,
      finalizerAuthority: "admin_finalize_public_music_identity_track_review_v1",
    } : {},
  });
  const decision: Issue1094DecisionFact = {
    id: desire.decisionId,
    review_item_id: desire.reviewId,
    status: "recorded",
    decision_type: "public_music_identity_true_duplicate",
    after_payload: { canonicalTrackId: desire.survivorId },
  };
  const facts = () => [review(desire, "open"), review(ficha, "resolved"), review(colors, "resolved")];

  it("shows recorded human decision and open DESIRE blocker beside exact verified Ficha and Colors receipts", () => {
    const projected = projectIssue1094Brief(facts(), [decision]);
    expect(projected.map(({ key, status }) => [key, status])).toEqual([
      ["desire", "blocked"], ["ficha", "completed"], ["colors", "completed"],
    ]);
    expect(projected[0].summary).toMatch(/decision recorded.*review remains open.*Lilmaina/i);
    expect(projected[1].operationId).toBe(ficha.operationId);
    expect(projected[2].operationId).toBe(colors.operationId);
    expect(projected[1].summary).toContain("No repair needs repeating");
  });

  it("does not invent a DESIRE decision if the authenticated decision is absent or conflicting", () => {
    expect(projectIssue1094Brief(facts(), [])[0].status).toBe("unverified");
    expect(projectIssue1094Brief(facts(), [decision, decision])[0].status).toBe("unverified");
    expect(projectIssue1094Brief(facts(), [{ ...decision, after_payload: { canonicalTrackId: ficha.survivorId } }])[0].status).toBe("unverified");
    expect(projectIssue1094Brief(facts(), [{ ...decision, status: "pending" }])[0].status).toBe("unverified");
    expect(projectIssue1094Brief([review(desire, "resolved"), ...facts().slice(1)], [decision])[0].status).toBe("unverified");
  });

  it("refuses to claim resolution when operation, decision, source or authority changes", () => {
    const changed = facts();
    const wrongReceipt = {
      ...changed[1],
      resolution_payload: { ...changed[1].resolution_payload, verifiedOperationId: colors.operationId },
    };
    expect(projectIssue1094Brief([changed[0], wrongReceipt, changed[2]], [decision])[1].status).toBe("unverified");
    expect(projectIssue1094Brief([changed[0], { ...changed[1], source_id: desire.duplicateId }, changed[2]], [decision])[1].status).toBe("unverified");
    expect(projectIssue1094Brief([changed[0], { ...changed[1], status: "open" }, changed[2]], [decision])[1].status).toBe("unverified");
    expect(projectIssue1094Brief([changed[0], { ...changed[1], resolution_payload: { ...changed[1].resolution_payload, finalizerAuthority: "unknown" } }, changed[2]], [decision])[1].status).toBe("unverified");
  });

  it("never silently treats a missing or duplicate review as a verified completion", () => {
    expect(projectIssue1094Brief([review(desire, "open")], [decision]).map(({ status }) => status)).toEqual(["blocked", "unverified", "unverified"]);
    expect(() => projectIssue1094Brief([...facts(), review(desire, "open")], [decision])).toThrow(/Duplicate/);
  });

  it("uses one WAKILISHA Headquarters view with no new write authority or prototype numbers", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    const service = readFileSync("src/services/miziziIssue1094Brief.ts", "utf8");
    expect(source).toContain("Issue1094WorthKnowing revision={revision} onInspect={inspect}");
    expect(source).toContain("Inspect open review");
    expect(source).toContain("Decision recorded");
    expect(source).toContain("Verified complete");
    expect(source).not.toMatch(/<select\b|<input\b|<dialog\b/);
    expect(service).toContain('from("registry_review_items")');
    expect(service).toContain('from("registry_canonicalization_decisions")');
    expect(service).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });
});

describe("MIZIZI bounded media and zoned timestamp", () => {
  it("reads canonical artwork for visible source IDs, not title matches", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziEvidenceWorkbench.tsx", "utf8");
    expect(source).toContain('.select("id,title,entity_type,source_id,source_payload")');
    expect(source).toContain("review.subjectType === row.entity_type");
    expect(source).toContain("uuid(row.source_id)");
    expect(source).toContain('.select("id,artwork_url")');
    expect(source).toContain("<WkRecordingArtwork");
    expect(source).toContain("<WkZonedTimestamp");
  });
});
