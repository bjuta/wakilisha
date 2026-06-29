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

describe("Institute relationship review service", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("requires a relationship id", async () => {
    const { reviewEntityRelationship } = await import("@/services/institute");

    await expect(
      reviewEntityRelationship({
        relationshipId: "",
        decision: "approved",
      }),
    ).rejects.toThrow("Review entity relationship failed: relationshipId is required");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the controlled relationship review RPC", async () => {
    const { reviewEntityRelationship } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "relationship-1",
          relationship_type: "collaborated_with",
          review_status: "approved",
          public_safe: false,
          reviewed_by: "user-1",
          reviewed_at: "2026-06-30T00:00:00.000Z",
          review_note: "Looks good.",
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await reviewEntityRelationship({
      relationshipId: "relationship-1",
      decision: "approved",
      decisionNote: " Looks good. ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_entity_relationship", {
      p_relationship_id: "relationship-1",
      p_decision: "approved",
      p_decision_note: "Looks good.",
    });
    expect(result.review_status).toBe("approved");
  });

  it("passes null for blank notes", async () => {
    const { reviewEntityRelationship } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: {
        id: "relationship-1",
        relationship_type: "appeared_on",
        review_status: "pending_review",
        public_safe: false,
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        updated_at: "2026-06-30T00:00:00.000Z",
      },
      error: null,
    });

    await reviewEntityRelationship({
      relationshipId: "relationship-1",
      decision: "needs_more_evidence",
      decisionNote: "   ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_entity_relationship", {
      p_relationship_id: "relationship-1",
      p_decision: "needs_more_evidence",
      p_decision_note: null,
    });
  });

  it("raises readable Supabase object errors", async () => {
    const { reviewEntityRelationship } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Public-safe relationship publishing requires approved relationship review",
        code: "23514",
      },
    });

    await expect(
      reviewEntityRelationship({
        relationshipId: "relationship-1",
        decision: "public_safe_enabled",
      }),
    ).rejects.toThrow(
      "Review entity relationship failed: Public-safe relationship publishing requires approved relationship review code: 23514",
    );
  });

  it("throws when the RPC returns no row", async () => {
    const { reviewEntityRelationship } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      reviewEntityRelationship({
        relationshipId: "relationship-1",
        decision: "approved",
      }),
    ).rejects.toThrow("Review entity relationship failed: no relationship row returned");
  });
});
