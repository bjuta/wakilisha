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

describe("Institute contributor submission review service", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("requires a submission id", async () => {
    const { reviewContributorSubmission } = await import("@/services/institute");

    await expect(
      reviewContributorSubmission({
        submissionId: "",
        decision: "triaged",
      }),
    ).rejects.toThrow("Review contributor submission failed: submissionId is required");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the controlled contributor submission review RPC", async () => {
    const { reviewContributorSubmission } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "submission-1",
          submission_type: "memory",
          review_status: "triaged",
          reviewed_by: "user-1",
          reviewed_at: "2026-06-30T00:00:00.000Z",
          review_note: "Good lead.",
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await reviewContributorSubmission({
      submissionId: "submission-1",
      decision: "triaged",
      decisionNote: " Good lead. ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_contributor_submission", {
      p_submission_id: "submission-1",
      p_decision: "triaged",
      p_decision_note: "Good lead.",
    });
    expect(result.review_status).toBe("triaged");
  });

  it("passes null for blank notes", async () => {
    const { reviewContributorSubmission } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: {
        id: "submission-1",
        submission_type: "evidence",
        review_status: "needs_source",
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        updated_at: "2026-06-30T00:00:00.000Z",
      },
      error: null,
    });

    await reviewContributorSubmission({
      submissionId: "submission-1",
      decision: "needs_source",
      decisionNote: "   ",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("institute_review_contributor_submission", {
      p_submission_id: "submission-1",
      p_decision: "needs_source",
      p_decision_note: null,
    });
  });

  it("raises readable Supabase object errors", async () => {
    const { reviewContributorSubmission } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Unsupported contributor submission review decision",
        code: "22023",
      },
    });

    await expect(
      reviewContributorSubmission({
        submissionId: "submission-1",
        decision: "triaged",
      }),
    ).rejects.toThrow(
      "Review contributor submission failed: Unsupported contributor submission review decision code: 22023",
    );
  });

  it("throws when the RPC returns no row", async () => {
    const { reviewContributorSubmission } = await import("@/services/institute");

    mocks.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      reviewContributorSubmission({
        submissionId: "submission-1",
        decision: "triaged",
      }),
    ).rejects.toThrow("Review contributor submission failed: no submission row returned");
  });
});
