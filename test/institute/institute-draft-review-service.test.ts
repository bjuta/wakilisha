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

describe("Institute draft review service", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("requires a draft id", async () => {
    const { reviewSurfaceDraft } = await import("@/services/institute");

    await expect(
      reviewSurfaceDraft({
        draftId: "",
        decision: "approved",
      }),
    ).rejects.toThrow("Review surface draft failed: draftId is required");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the controlled draft review RPC", async () => {
    const { reviewSurfaceDraft } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "draft-1",
          surface_type: "start_here",
          review_status: "approved",
          public_safe: false,
          reviewed_by: "user-1",
          reviewed_at: "2026-06-30T00:00:00.000Z",
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await reviewSurfaceDraft({
      draftId: "draft-1",
      decision: "approved",
      decisionNote: " Looks good. ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_surface_draft", {
      p_draft_id: "draft-1",
      p_decision: "approved",
      p_decision_note: "Looks good.",
    });
    expect(result.review_status).toBe("approved");
  });

  it("passes null for blank notes", async () => {
    const { reviewSurfaceDraft } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: {
        id: "draft-1",
        surface_type: "relationship_reason",
        review_status: "revised",
        public_safe: false,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: "2026-06-30T00:00:00.000Z",
      },
      error: null,
    });

    await reviewSurfaceDraft({
      draftId: "draft-1",
      decision: "needs_rewrite",
      decisionNote: "   ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_surface_draft", {
      p_draft_id: "draft-1",
      p_decision: "needs_rewrite",
      p_decision_note: null,
    });
  });

  it("raises readable Supabase object errors", async () => {
    const { reviewSurfaceDraft } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Public-safe draft publishing requires approved draft review",
        code: "23514",
      },
    });

    await expect(
      reviewSurfaceDraft({
        draftId: "draft-1",
        decision: "public_safe_enabled",
      }),
    ).rejects.toThrow(
      "Review surface draft failed: Public-safe draft publishing requires approved draft review code: 23514",
    );
  });

  it("throws when the RPC returns no row", async () => {
    const { reviewSurfaceDraft } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      reviewSurfaceDraft({
        draftId: "draft-1",
        decision: "approved",
      }),
    ).rejects.toThrow("Review surface draft failed: no draft row returned");
  });
});
