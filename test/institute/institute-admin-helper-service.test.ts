import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const builder = {} as {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    data: unknown[];
    error: unknown;
  };

  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.data = [];
  builder.error = null;

  const from = vi.fn(() => builder);

  return { builder, from };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
}));

describe("Institute admin helper service", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.builder.select.mockClear();
    mocks.builder.order.mockClear();
    mocks.builder.limit.mockClear();
    mocks.builder.eq.mockClear();
    mocks.builder.or.mockClear();
    mocks.builder.data = [];
    mocks.builder.error = null;
  });

  it("lists human review queue items with filters and priority sorting", async () => {
    const { listHumanReviewQueueItems } = await import("@/services/institute");

    mocks.builder.data = [
      {
        subject_type: "evidence",
        subject_id: "evidence-1",
        title: "Evidence item",
        summary: "Needs review.",
        review_status: "unreviewed",
        review_reason: "Needs first review",
        priority_weight: 70,
        inquiry_id: "inquiry-1",
        entity_id: "entity-1",
        submitted_by: null,
        created_at: "2026-06-29T00:00:00.000Z",
        updated_at: "2026-06-29T00:00:00.000Z",
        metadata: {},
      },
    ];

    const rows = await listHumanReviewQueueItems({
      subjectType: "evidence",
      inquiryId: "inquiry-1",
      entityId: "entity-1",
      limit: 25,
    });

    expect(mocks.from).toHaveBeenCalledWith("institute_review_queue_items");
    expect(mocks.builder.order).toHaveBeenCalledWith("priority_weight", { ascending: false });
    expect(mocks.builder.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(mocks.builder.limit).toHaveBeenCalledWith(25);
    expect(mocks.builder.eq).toHaveBeenCalledWith("subject_type", "evidence");
    expect(mocks.builder.eq).toHaveBeenCalledWith("inquiry_id", "inquiry-1");
    expect(mocks.builder.eq).toHaveBeenCalledWith("entity_id", "entity-1");
    expect(rows).toHaveLength(1);
  });

  it("returns admin overview counts as a simple map", async () => {
    const { getInstituteAdminOverviewCountMap } = await import("@/services/institute");

    mocks.builder.data = [
      { metric_key: "review_queue_items", metric_value: "7", measured_at: "2026-06-29T00:00:00.000Z" },
      { metric_key: "active_inquiries", metric_value: 2, measured_at: "2026-06-29T00:00:00.000Z" },
    ];

    const map = await getInstituteAdminOverviewCountMap();

    expect(mocks.from).toHaveBeenCalledWith("institute_admin_overview_counts");
    expect(map.review_queue_items).toBe(7);
    expect(map.active_inquiries).toBe(2);
  });

  it("lists inquiry evidence through the admin helper view", async () => {
    const { listInstituteAdminInquiryEvidence } = await import("@/services/institute");

    mocks.builder.data = [];

    await listInstituteAdminInquiryEvidence("inquiry-1");

    expect(mocks.from).toHaveBeenCalledWith("institute_admin_inquiry_evidence");
    expect(mocks.builder.eq).toHaveBeenCalledWith("inquiry_id", "inquiry-1");
    expect(mocks.builder.order).toHaveBeenCalledWith("added_at", { ascending: false });
  });

  it("lists entity relationships from either side of the relationship", async () => {
    const { listInstituteAdminEntityRelationships } = await import("@/services/institute");

    mocks.builder.data = [];

    await listInstituteAdminEntityRelationships("entity-1");

    expect(mocks.from).toHaveBeenCalledWith("institute_admin_entity_relationships");
    expect(mocks.builder.or).toHaveBeenCalledWith("source_entity_id.eq.entity-1,target_entity_id.eq.entity-1");
    expect(mocks.builder.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("raises readable Supabase errors", async () => {
    const { listInstituteAdminOverviewCounts } = await import("@/services/institute");

    mocks.builder.error = new Error("RLS denied");

    await expect(listInstituteAdminOverviewCounts()).rejects.toThrow(
      "List Institute admin overview counts failed: RLS denied",
    );
  });
  it("includes Supabase object error details", async () => {
    const { listHumanReviewQueueItems } = await import("@/services/institute");

    mocks.builder.error = {
      message: "relation does not exist",
      details: "Missing helper view",
      hint: "Apply PR4 migration",
      code: "42P01",
    };

    await expect(listHumanReviewQueueItems()).rejects.toThrow(
      "List human review queue items failed: relation does not exist Missing helper view Apply PR4 migration code: 42P01",
    );
  });

});
