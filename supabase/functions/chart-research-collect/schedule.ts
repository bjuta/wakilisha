import {
  appleSourceKey,
  validateCanonicalD11BWindow,
} from "./adapters.ts";

export type D11BCollectionTarget =
  | {
      source: "youtube";
      sourceKey: "youtube_weekly_ke";
      dueAt: string;
    }
  | {
      source: "audiomack";
      sourceKey: "audiomack_weekly100_ke";
      dueAt: string;
    }
  | {
      source: "apple";
      sourceKey: string;
      checkpointDate: string;
      dueAt: string;
    };

function iso(date: Date): string {
  return date.toISOString();
}

function atUtc(
  base: Date,
  dayOffset: number,
  hour: number,
): Date {
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + dayOffset,
      hour,
      0,
      0,
      0,
    ),
  );
}

export function d11bCollectionSchedule(
  trackingStartIso: string,
  trackingEndIso: string,
): D11BCollectionTarget[] {
  const { start, end } = validateCanonicalD11BWindow(
    trackingStartIso,
    trackingEndIso,
  );

  const targets: D11BCollectionTarget[] = [];

  // Apple: fixed 18:00 UTC daily Friday through Thursday.
  for (let day = 0; day < 7; day++) {
    const checkpoint = atUtc(start, day, 18);
    const checkpointDate = checkpoint.toISOString().slice(0, 10);
    targets.push({
      source: "apple",
      sourceKey: appleSourceKey(checkpointDate),
      checkpointDate,
      dueAt: iso(checkpoint),
    });
  }

  // Audiomack: first fixed checkpoint after its Wednesday update.
  // Friday + 5 days = Wednesday.
  targets.push({
    source: "audiomack",
    sourceKey: "audiomack_weekly100_ke",
    dueAt: iso(atUtc(start, 5, 18)),
  });

  // YouTube: exact Friday-Thursday target period checked Monday 12:00 UTC
  // after the target week closes.
  targets.push({
    source: "youtube",
    sourceKey: "youtube_weekly_ke",
    dueAt: iso(new Date(end.getTime() + 3 * 86400000 + 12 * 3600000)),
  });

  return targets.sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
}

export function dueD11BCollectionTargets(
  trackingStartIso: string,
  trackingEndIso: string,
  nowIso: string,
  completedSourceKeys: Iterable<string> = [],
): D11BCollectionTarget[] {
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) throw new Error("invalid_scheduler_now");
  const completed = new Set(completedSourceKeys);

  return d11bCollectionSchedule(trackingStartIso, trackingEndIso)
    .filter((target) =>
      new Date(target.dueAt).getTime() <= now.getTime() &&
      !completed.has(target.sourceKey)
    );
}
