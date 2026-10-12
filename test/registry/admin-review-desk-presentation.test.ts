import { describe, expect, it } from "vitest";
import type { RegistryReviewItemRow } from "@/services/adminReviewCommandCenter";
import {
  chartIssueHeading,
  genericChartIssue,
  groupLoadedReviewRows,
  sourceDisplay,
} from "@/pages/admin/review/queue/reviewDeskPresentation";

const table = "wkcharts_track_label_missing_reference_queue";
const title = "Chart provisional label from " + table;

function row(id: string, changes: Partial<RegistryReviewItemRow> = {}): RegistryReviewItemRow {
  return {
    id,
    review_key: "phase4a6:" + table + ":label:" + id,
    entity_type: "label",
    entity_id: null,
    review_type: "chart_provisional_label_write",
    priority: "normal",
    status: "open",
    title,
    summary: "Chart-observed track references a missing label. Create or match a provisional registry label.",
    source_table: table,
    source_id: id,
    source_payload: {},
    candidate_payload: { evidence: {} },
    resolution_payload: null,
    created_at: null,
    updated_at: null,
    ...changes,
  };
}

describe("All Reviews: source-honest, issue-first presentation", () => {
  it("groups repeated chart fallback titles for display but preserves every immutable review", () => {
    const ids = [
      "aaaabbbbccccddddeeeeffff00001111",
      "bbbbccccddddeeeeffff000011112222",
      "ccccddddeeeeffff0000111122223333",
      "dddd1111222233334444555566667777",
    ];
    const rows = ids.map(id => row(id));
    const groups = groupLoadedReviewRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].grouped).toBe(true);
    expect(groups[0].items.map(item => item.id)).toEqual(ids);
    expect(groups[0].items[0].source_id).not.toBe(groups[0].items[1].source_id);
    expect(groups[0].key).toContain(table);
    expect(chartIssueHeading(rows[0])).toBe("Chart tracks missing label references");
  });

  it("does not group separate source tables, states, or already-identifiable titles", () => {
    const groups = groupLoadedReviewRows([
      row("a1"),
      row("a2"),
      row("a3", { status: "resolved" }),
      row("a4", { source_table: "wkcharts_release_label_missing_reference_queue" }),
      row("a5", { title: "Chart provisional label: Nyota — Karun" }),
      row("a6", { priority: "high" }),
    ]);
    expect(groups).toHaveLength(6);
    expect(groups.every(group => !group.grouped)).toBe(true);
    expect(groups.flatMap(group => group.items.map(item => item.id))).toEqual([
      "a1", "a2", "a3", "a4", "a5", "a6",
    ]);
    expect(genericChartIssue(row("a5", { title: "Chart provisional label: Nyota — Karun" }))).toBe(false);
  });

  it("repeats nothing invented: recorded evidence takes precedence over the source fingerprint", () => {
    expect(sourceDisplay(row("abcdef0123456789abcdef0123456789"))).toBe(
      "Source fingerprint abcdef012345"
    );
    expect(sourceDisplay(row("abcdef0123456789abcdef0123456789", {
      candidate_payload: {
        evidence: { title: "", label: "Actual Label", artist: "Actual Artist" },
      },
    }))).toBe("Actual Label");
  });

  it("preserves loaded-row order and only clusters when at least three items share one template", () => {
    const rows = [
      row("unique", { title: "An actual recording title" }),
      row("1"), row("2"), row("3"),
      row("separate", { review_type: "chart_provisional_track_write" }),
    ];
    const groups = groupLoadedReviewRows(rows);
    expect(groups.map(group => group.items[0].id)).toEqual(["unique", "1", "separate"]);
    expect(groups.map(group => group.grouped)).toEqual([false, true, false]);
    expect(groups.flatMap(group => group.items)).toHaveLength(rows.length);
  });
});
