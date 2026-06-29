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

describe("Institute service contract", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.insert.mockClear();
    mocks.select.mockClear();
    mocks.single.mockReset();
  });

  it("refuses to create a surface draft without an inquiry or entity scope", async () => {
    const { createSurfaceDraft } = await import("@/services/institute");

    await expect(
      createSurfaceDraft({
        surface_type: "start_here",
        draft_body: "Start with one song.",
      }),
    ).rejects.toThrow("inquiry_id or entity_id is required");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates memory embedding records as excluded by default", async () => {
    const { createMemoryEmbeddingRecord } = await import("@/services/institute");

    mocks.single.mockResolvedValueOnce({
      data: {
        id: "embedding-1",
        source_type: "evidence",
        source_id: "evidence-1",
        content: "Approved evidence text.",
        metadata: {},
        retrieval_status: "excluded",
        created_at: "2026-06-29T00:00:00.000Z",
      },
      error: null,
    });

    const record = await createMemoryEmbeddingRecord({
      source_type: "evidence",
      source_id: "evidence-1",
      content: "Approved evidence text.",
    });

    expect(mocks.from).toHaveBeenCalledWith("memory_embeddings");
    expect(mocks.insert).toHaveBeenCalledWith({
      metadata: {},
      retrieval_status: "excluded",
      source_type: "evidence",
      source_id: "evidence-1",
      content: "Approved evidence text.",
    });
    expect(record.retrieval_status).toBe("excluded");
  });
});
