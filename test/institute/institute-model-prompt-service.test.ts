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

describe("Institute model and prompt registry service", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.insert.mockClear();
    mocks.select.mockClear();
    mocks.single.mockReset();
  });

  it("refuses to create a non-embedding AI run without a prompt version snapshot", async () => {
    const { createAiRun } = await import("@/services/institute");

    await expect(
      createAiRun({
        run_type: "relationship_suggestion",
        provider_id: "provider-1",
        model_id: "model-1",
        provider_key_snapshot: "local",
        model_key_snapshot: "llama-test",
        input_summary: "Suggest relationships.",
      }),
    ).rejects.toThrow("prompt version id and version-name snapshot are required");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("refuses to create an AI run without provider and model snapshots", async () => {
    const { createAiRun } = await import("@/services/institute");

    await expect(
      createAiRun({
        run_type: "embedding",
        provider_id: "provider-1",
        model_id: "model-1",
        provider_key_snapshot: " ",
        model_key_snapshot: " ",
        input_summary: "Embed approved evidence.",
      }),
    ).rejects.toThrow("provider and model snapshots are required");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("creates an embedding AI run without a prompt version", async () => {
    const { createAiRun } = await import("@/services/institute");

    mocks.single.mockResolvedValueOnce({
      data: {
        id: "run-1",
        run_type: "embedding",
        provider_id: "provider-1",
        model_id: "model-1",
        provider_key_snapshot: "local",
        model_key_snapshot: "nomic-embed-text",
        prompt_version_name_snapshot: null,
        input_summary: "Embed approved evidence.",
        input_json: {},
        output_json: {},
        status: "queued",
        requires_human_review: true,
        review_status: "not_reviewed",
        created_at: "2026-06-29T00:00:00.000Z",
      },
      error: null,
    });

    const run = await createAiRun({
      run_type: "embedding",
      provider_id: "provider-1",
      model_id: "model-1",
      provider_key_snapshot: " local ",
      model_key_snapshot: " nomic-embed-text ",
      input_summary: "Embed approved evidence.",
    });

    expect(mocks.from).toHaveBeenCalledWith("ai_runs");
    expect(mocks.insert).toHaveBeenCalledWith({
      input_json: {},
      output_json: {},
      status: "queued",
      requires_human_review: true,
      review_status: "not_reviewed",
      run_type: "embedding",
      provider_id: "provider-1",
      model_id: "model-1",
      provider_key_snapshot: "local",
      model_key_snapshot: "nomic-embed-text",
      input_summary: "Embed approved evidence.",
      prompt_version_name_snapshot: null,
    });
    expect(run.provider_key_snapshot).toBe("local");
  });

  it("refuses to create an AI run source without a reference", async () => {
    const { createAiRunSource } = await import("@/services/institute");

    await expect(
      createAiRunSource({
        ai_run_id: "run-1",
        source_type: "manual_context",
      }),
    ).rejects.toThrow("source_id, source_ref, or source_table is required");

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
