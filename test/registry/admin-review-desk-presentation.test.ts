import { describe, expect, it } from "vitest";
import type { RegistryReviewItemRow } from "@/services/adminReviewCommandCenter";
import {
  chartIssueHeading,
  genericChartIssue,
  groupableReviewIssue,
  groupLoadedReviewRows,
  singleReleaseIdentityIssue,
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
    // a1 and a2 share one display bucket, but are not collapsed into one review.
    // Different state, source table, informative title, or priority each isolates
    // the remaining records. Five buckets still carry all six immutable IDs.
    expect(groups).toHaveLength(5);
    expect(groups.every(group => !group.grouped)).toBe(true);
    expect(groups.map(group => group.items.map(item => item.id))).toEqual([
      ["a1", "a2"], ["a3"], ["a4"], ["a5"], ["a6"],
    ]);
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

  it("isolates equal-sized loaded groups across statuses and priorities", () => {
    const rows = [
      row("open-1"), row("open-2"), row("open-3"),
      row("high-1", { priority: "high" }),
      row("high-2", { priority: "high" }),
      row("high-3", { priority: "high" }),
      row("resolved-1", { status: "resolved" }),
      row("resolved-2", { status: "resolved" }),
      row("resolved-3", { status: "resolved" }),
    ];
    const groups = groupLoadedReviewRows(rows);
    expect(groups).toHaveLength(3);
    expect(groups.every(group => group.grouped)).toBe(true);
    expect(groups.map(group => group.items.length)).toEqual([3, 3, 3]);
    expect(groups.map(group => [group.items[0].status, group.items[0].priority])).toEqual([
      ["open", "normal"], ["open", "high"], ["resolved", "normal"],
    ]);
    const sourceIds = groups.flatMap(group => group.items.map(item => item.id));
    expect(sourceIds).toEqual(rows.map(item => item.id));
    expect(new Set(sourceIds).size).toBe(rows.length);
  });

});

function singleReleaseReview(id: string, changes: Partial<RegistryReviewItemRow> = {}): RegistryReviewItemRow {
  return row(id, {
    entity_type: "release",
    entity_id: id,
    review_type: "mizizi_data_hygiene",
    priority: "high",
    title: "MIZIZI found a Single public-identity conflict",
    summary: "This one-track Release cannot automatically converge to its canonical Track presentation because current Registry or Community identity evidence conflicts.",
    source_table: "registry_releases",
    source_id: id,
    source_payload: {
      agent: "mizizi",
      ruleId: "release_single_identity_conflict",
      ruleVersion: "1.4.0",
      currentValue: "current-release-" + id,
      programmeCandidate: {
        release_id: id,
        current_release_slug: "current-release-" + id,
        proposed_release_slug: "proposed-release-" + id,
      },
    },
    candidate_payload: {
      proposedValue: "proposed-release-" + id,
      disposition: "review",
    },
    ...changes,
  });
}

describe("MIZIZI Single identity issue-first display", () => {
  it("presents an exact recorded issue template as a summary with separate source identities", () => {
    const reviews = ["release-a", "release-b", "release-c", "release-d"]
      .map(id => singleReleaseReview(id));
    const groups = groupLoadedReviewRows(reviews);
    expect(groups).toHaveLength(1);
    expect(groups[0].grouped).toBe(true);
    expect(groups[0].items.map(item => item.id)).toEqual(reviews.map(item => item.id));
    expect(chartIssueHeading(reviews[0])).toBe("Single Releases With Identity Conflicts");
    expect(sourceDisplay(reviews[0])).toBe("Current release slug: current-release-release-a");
    expect(sourceDisplay(reviews[1])).toBe("Current release slug: current-release-release-b");
    expect(new Set(groups[0].items.map(item => item.source_id)).size).toBe(4);
  });

  it("never conflates a changed rule/version, priority, status, entity or source table", () => {
    const reviews = [
      singleReleaseReview("a"),
      singleReleaseReview("b"),
      singleReleaseReview("different-version", {
        source_payload: { ruleId: "release_single_identity_conflict", ruleVersion: "2.0.0" },
      }),
      singleReleaseReview("different-rule", {
        source_payload: { ruleId: "release_identity_name_conflict", ruleVersion: "1.4.0" },
      }),
      singleReleaseReview("other-priority", { priority: "normal" }),
      singleReleaseReview("resolved", { status: "resolved" }),
      singleReleaseReview("track", { entity_type: "track" }),
      singleReleaseReview("other-table", { source_table: "registry_tracks" }),
      singleReleaseReview("informative-title", { title: "Actual Single review title" }),
    ];
    const groups = groupLoadedReviewRows(reviews);
    expect(groups).toHaveLength(8);
    expect(groups.every(group => !group.grouped)).toBe(true);
    expect(groups[0].items.map(item => item.id)).toEqual(["a", "b"]);
    expect(groups.flatMap(group => group.items.map(item => item.id))).toEqual(
      reviews.map(item => item.id)
    );
    expect(singleReleaseIdentityIssue(reviews[2])).toBe(false);
    expect(singleReleaseIdentityIssue(reviews[3])).toBe(false);
    expect(singleReleaseIdentityIssue(reviews[6])).toBe(false);
    expect(singleReleaseIdentityIssue(reviews[8])).toBe(false);
    expect(groupableReviewIssue(reviews[0])).toBe(true);
  });

  it("does not turn a proposed slug into a current slug when source evidence is absent", () => {
    const unresolved = singleReleaseReview("source-123", {
      source_payload: {
        ruleId: "release_single_identity_conflict",
        ruleVersion: "1.4.0",
        currentValue: "",
        programmeCandidate: { proposed_release_slug: "not-approved" },
      },
    });
    expect(singleReleaseIdentityIssue(unresolved)).toBe(true);
    expect(sourceDisplay(unresolved)).toBe("Release ID: source-123");
  });
});

