import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  return { rpc };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

describe("Institute review decision service", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("requires an evidence id", async () => {
    const { reviewEvidenceItem } = await import("@/services/institute");

    await expect(
      reviewEvidenceItem({
        evidenceId: "",
        decision: "approved",
      }),
    ).rejects.toThrow("Review evidence item failed: evidenceId is required");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the controlled evidence review RPC", async () => {
    const { reviewEvidenceItem } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "evidence-1",
          title: "Evidence",
          review_status: "approved",
          retrieval_status: "excluded",
          reviewed_by: "user-1",
          reviewed_at: "2026-06-29T00:00:00.000Z",
          updated_at: "2026-06-29T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await reviewEvidenceItem({
      evidenceId: "evidence-1",
      decision: "approved",
      decisionNote: " Looks good. ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_evidence_item", {
      p_evidence_id: "evidence-1",
      p_decision: "approved",
      p_decision_note: "Looks good.",
    });
    expect(result.review_status).toBe("approved");
  });

  it("passes null for blank notes", async () => {
    const { reviewEvidenceItem } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: {
        id: "evidence-1",
        title: "Evidence",
        review_status: "reviewed",
        retrieval_status: "excluded",
        reviewed_by: null,
        reviewed_at: null,
        updated_at: "2026-06-29T00:00:00.000Z",
      },
      error: null,
    });

    await reviewEvidenceItem({
      evidenceId: "evidence-1",
      decision: "reviewed",
      decisionNote: "   ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_evidence_item", {
      p_evidence_id: "evidence-1",
      p_decision: "reviewed",
      p_decision_note: null,
    });
  });

  it("raises readable Supabase object errors", async () => {
    const { reviewEvidenceItem } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Default retrieval requires reviewed or approved evidence",
        code: "23514",
      },
    });

    await expect(
      reviewEvidenceItem({
        evidenceId: "evidence-1",
        decision: "retrieval_enabled",
      }),
    ).rejects.toThrow(
      "Review evidence item failed: Default retrieval requires reviewed or approved evidence code: 23514",
    );
  });

  it("throws when the RPC returns no row", async () => {
    const { reviewEvidenceItem } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      reviewEvidenceItem({
        evidenceId: "evidence-1",
        decision: "approved",
      }),
    ).rejects.toThrow("Review evidence item failed: no evidence row returned");
  });
});
