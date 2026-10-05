import { describe, expect, it } from "vitest";
import {
  d11bCollectionSchedule,
  dueD11BCollectionTargets,
} from "../../supabase/functions/chart-research-collect/schedule";

const START = "2026-09-04T00:00:00.000Z";
const END = "2026-09-11T00:00:00.000Z";

describe("D11B collection schedule", () => {
  it("freezes seven Apple daily checkpoints at 18:00 UTC", () => {
    const schedule = d11bCollectionSchedule(START, END);
    const apple = schedule.filter((item) => item.source === "apple");
    expect(apple).toHaveLength(7);
    expect(apple.map((item) => item.dueAt)).toEqual([
      "2026-09-04T18:00:00.000Z",
      "2026-09-05T18:00:00.000Z",
      "2026-09-06T18:00:00.000Z",
      "2026-09-07T18:00:00.000Z",
      "2026-09-08T18:00:00.000Z",
      "2026-09-09T18:00:00.000Z",
      "2026-09-10T18:00:00.000Z",
    ]);
  });

  it("freezes Audiomack Wednesday 18:00-18:30 UTC", () => {
    const schedule = d11bCollectionSchedule(START, END);
    expect(schedule.find((item) => item.source === "audiomack")).toEqual({
      source: "audiomack",
      sourceKey: "audiomack_weekly100_ke",
      dueAt: "2026-09-09T18:00:00.000Z",
      expiresAt: "2026-09-09T18:30:00.000Z",
    });
  });

  it("freezes YouTube Monday 12:00 UTC after week close", () => {
    const schedule = d11bCollectionSchedule(START, END);
    expect(schedule.find((item) => item.source === "youtube")).toEqual({
      source: "youtube",
      sourceKey: "youtube_weekly_ke",
      dueAt: "2026-09-14T12:00:00.000Z",
    });
  });

  it("returns only due incomplete targets", () => {
    const due = dueD11BCollectionTargets(
      START,
      END,
      "2026-09-09T18:01:00.000Z",
      [
        "apple_top100_ke:2026-09-04",
        "apple_top100_ke:2026-09-05",
        "apple_top100_ke:2026-09-06",
        "apple_top100_ke:2026-09-07",
        "apple_top100_ke:2026-09-08",
      ],
    );

    expect(due.map((item) => item.sourceKey)).toEqual([
      "apple_top100_ke:2026-09-09",
      "audiomack_weekly100_ke",
    ]);
  });

  it("expires current-only targets instead of backfilling them", async () => {
    const { expiredD11BCollectionTargets } = await import(
      "../../supabase/functions/chart-research-collect/schedule"
    );

    expect(
      dueD11BCollectionTargets(
        START,
        END,
        "2026-09-09T18:30:00.000Z",
      ).some((item) => item.source === "audiomack"),
    ).toBe(true);

    expect(
      dueD11BCollectionTargets(
        START,
        END,
        "2026-09-09T18:30:00.001Z",
      ).some((item) => item.source === "audiomack"),
    ).toBe(false);

    expect(
      expiredD11BCollectionTargets(
        START,
        END,
        "2026-09-09T18:30:00.001Z",
      ).some((item) => item.source === "audiomack"),
    ).toBe(true);
  });

  it("never expires YouTube exact-period retrieval", async () => {
    const { expiredD11BCollectionTargets } = await import(
      "../../supabase/functions/chart-research-collect/schedule"
    );

    const expired = expiredD11BCollectionTargets(
      START,
      END,
      "2026-10-01T00:00:00.000Z",
    );

    expect(expired.some((item) => item.source === "youtube")).toBe(false);
    expect(
      dueD11BCollectionTargets(
        START,
        END,
        "2026-10-01T00:00:00.000Z",
      ).some((item) => item.source === "youtube"),
    ).toBe(true);
  });

  it("does not make YouTube due before the frozen Monday checkpoint", () => {
    const before = dueD11BCollectionTargets(
      START,
      END,
      "2026-09-14T11:59:59.999Z",
    );
    expect(before.some((item) => item.source === "youtube")).toBe(false);

    const at = dueD11BCollectionTargets(
      START,
      END,
      "2026-09-14T12:00:00.000Z",
    );
    expect(at.some((item) => item.source === "youtube")).toBe(true);
  });
});
