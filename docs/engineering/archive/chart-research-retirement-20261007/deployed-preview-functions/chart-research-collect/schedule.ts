import {
  appleSourceKey,
  validateCanonicalD11BWindow,
} from "./adapters.ts";

export const CURRENT_ONLY_CAPTURE_TOLERANCE_MS = 30 * 60 * 1000;

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
      expiresAt: string;
    }
  | {
      source: "apple";
      sourceKey: string;
      checkpointDate: string;
      dueAt: string;
      expiresAt: string;
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

function withExpiry<T extends { dueAt: string }>(
  target: T,
): T & { expiresAt: string } {
  return {
    ...target,
    expiresAt: new Date(
      new Date(target.dueAt).getTime() + CURRENT_ONLY_CAPTURE_TOLERANCE_MS,
    ).toISOString(),
  };
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
  // The public chart is current-only, so D010 permits collection only through
  // 18:30 UTC. A missed checkpoint must remain missing and must not be backfilled.
  for (let day = 0; day < 7; day++) {
    const checkpoint = atUtc(start, day, 18);
    const checkpointDate = checkpoint.toISOString().slice(0, 10);
    targets.push(withExpiry({
      source: "apple" as const,
      sourceKey: appleSourceKey(checkpointDate),
      checkpointDate,
      dueAt: iso(checkpoint),
    }));
  }

  // Audiomack: first fixed checkpoint after its Wednesday update.
  // This public surface is also current-only and uses the same D010 tolerance.
  targets.push(withExpiry({
    source: "audiomack" as const,
    sourceKey: "audiomack_weekly100_ke" as const,
    dueAt: iso(atUtc(start, 5, 18)),
  }));

  // YouTube: exact Friday-Thursday target period checked Monday 12:00 UTC
  // after the target week closes. The provider accepts an explicit historical
  // period ID, so delayed retrieval remains legitimate if that exact period
  // is present in the response.
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
    .filter((target) => {
      if (completed.has(target.sourceKey)) return false;
      const due = new Date(target.dueAt).getTime();
      if (due > now.getTime()) return false;
      if ("expiresAt" in target) {
        return now.getTime() <= new Date(target.expiresAt).getTime();
      }
      return true;
    });
}

export function expiredD11BCollectionTargets(
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
      !completed.has(target.sourceKey) &&
      "expiresAt" in target &&
      now.getTime() > new Date(target.expiresAt).getTime()
    );
}

export function assertD11BTargetCollectableNow(
  target: D11BCollectionTarget,
  nowIso: string,
): void {
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) throw new Error("invalid_scheduler_now");

  if (now.getTime() < new Date(target.dueAt).getTime()) {
    throw new Error("checkpoint_not_due");
  }
  if (
    "expiresAt" in target &&
    now.getTime() > new Date(target.expiresAt).getTime()
  ) {
    throw new Error("current_only_checkpoint_expired");
  }
}
