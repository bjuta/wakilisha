import { describe, expect, it, vi } from "vitest";
import {
  loadHeadquartersQueueV2,
  projectHeadquartersQueueV2,
  HEADQUARTERS_QUEUE_PAGE_SIZE,
} from "../../src/services/miziziHeadquartersBrief";
import type { RegistryQueueFactV2, RegistryQueuePageV2 } from "../../src/services/miziziHeadquartersBrief";
import { readFileSync } from "node:fs";
import { selectOperatorReviewPageV1, selectReviewForInspectionV1 } from "../../src/services/operatorReviewSelection";

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
    expect(source).toContain("<WkTabs");
    expect(source).toContain("<WkSurface");
    expect(source).toContain("<WkButton");
    expect(source).toContain("<WkSearchField");
    expect(source).toContain("<WkSelect");
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
  it("uses WAKILISHA Inspector, not browser-native dialogs or autonomous decisions", () => {
    const source = readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx", "utf8");
    expect(source).toContain("<WkInspector");
    expect(source).toContain("selectReviewForInspectionV1");
    expect(source).toContain("Open Review Queue");
    expect(source).not.toMatch(/<dialog\b|<select\b|<input\b|<textarea\b/);
    expect(source).not.toContain("Approve Review");
  });
});
