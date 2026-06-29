import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));

  return { from, insert, select, single };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
}));

describe("Institute retrieval workflow service", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.insert.mockClear();
    mocks.select.mockClear();
    mocks.single.mockReset();
  });

  it("refuses to enable default retrieval for unreviewed evidence", async () => {
    const { createEvidenceReviewEvent } = await import("@/services/institute");

    await expect(
      createEvidenceReviewEvent({
        evidence_id: "evidence-1",
        decision: "retrieval_enabled",
        next_review_status: "unreviewed",
        next_retrieval_status: "default_retrieval",
      }),
    ).rejects.toThrow("default retrieval requires reviewed or approved evidence");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("refuses to create an unscoped retrieval run", async () => {
    const { createRetrievalRun } = await import("@/services/institute");

    await expect(
      createRetrievalRun({
        run_type: "manual_test",
        task_type: "retrieval_test",
      }),
    ).rejects.toThrow("inquiry_id, entity_id, or query_text is required");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("refuses to include approved evidence that is not retrieval ready", async () => {
    const { createRetrievalRunItem } = await import("@/services/institute");

    await expect(
      createRetrievalRunItem({
        retrieval_run_id: "run-1",
        source_type: "evidence",
        evidence_id: "evidence-1",
        included_in_context: true,
        review_status_snapshot: "approved",
        retrieval_status_snapshot: "review_only",
      }),
    ).rejects.toThrow("included evidence must be reviewed or approved and retrieval ready");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates safe retrieval run items with safe defaults", async () => {
    const { createRetrievalRunItem } = await import("@/services/institute");

    mocks.single.mockResolvedValueOnce({
      data: {
        id: "item-1",
        retrieval_run_id: "run-1",
        source_type: "evidence",
        evidence_id: "evidence-1",
        review_status_snapshot: "approved",
        retrieval_status_snapshot: "default_retrieval",
        included_in_context: true,
        metadata: {},
        created_at: "2026-06-29T00:00:00.000Z",
      },
      error: null,
    });

    const item = await createRetrievalRunItem({
      retrieval_run_id: "run-1",
      source_type: "evidence",
      evidence_id: "evidence-1",
      included_in_context: true,
      review_status_snapshot: "approved",
      retrieval_status_snapshot: "default_retrieval",
    });

    expect(mocks.from).toHaveBeenCalledWith("retrieval_run_items");
    expect(mocks.insert).toHaveBeenCalledWith({
      included_in_context: true,
      metadata: {},
      retrieval_run_id: "run-1",
      source_type: "evidence",
      evidence_id: "evidence-1",
      review_status_snapshot: "approved",
      retrieval_status_snapshot: "default_retrieval",
    });
    expect(item.included_in_context).toBe(true);
  });
});
