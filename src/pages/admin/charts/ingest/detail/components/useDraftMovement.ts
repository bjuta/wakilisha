import { useState, useEffect } from "react";
import type { DraftEntry, IngestJob } from "@/services/chartsIngestion/types";
import {
  getChartEditionsForFamily,
  getChartEditionEntries,
} from "@/services/chartsPublic/client";

export interface EnrichedDraftEntry extends DraftEntry {
  displayMovement: "up" | "down" | "same" | "new" | "re_entry";
  displayPreviousRank: number | null;
  displayMovementAmount: number | null;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWithinDays(dateA: string, dateB: string, days: number): boolean {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (isNaN(a) || isNaN(b)) return false;
  const diffMs = Math.abs(b - a);
  return diffMs <= days * 24 * 60 * 60 * 1000;
}

export function useDraftMovement(
  job: IngestJob,
  draftEntries: DraftEntry[]
): EnrichedDraftEntry[] {
  const [enriched, setEnriched] = useState<EnrichedDraftEntry[]>(() =>
    draftEntries.map((e) => ({
      ...e,
      displayMovement: e.movement,
      displayPreviousRank: e.previousRank,
      displayMovementAmount:
        e.previousRank && e.finalRank
          ? Math.abs(e.finalRank - e.previousRank)
          : null,
    }))
  );

  useEffect(() => {
    if (draftEntries.length === 0) {
      setEnriched([]);
      return;
    }

    const familySlug = job.chartFamily?.familyKey;
    const editionDate = job.editionDate;

    if (!familySlug || !editionDate) {
      setEnriched(
        draftEntries.map((e) => ({
          ...e,
          displayMovement: e.movement,
          displayPreviousRank: e.previousRank,
          displayMovementAmount:
            e.previousRank && e.finalRank
              ? Math.abs(e.finalRank - e.previousRank)
              : null,
        }))
      );
      return;
    }

    let cancelled = false;

    async function enrich() {
      try {
        // Find prior edition by date
        const { data: allEditions } = await getChartEditionsForFamily(
          familySlug
        );
        if (cancelled) return;

        const sorted = [...allEditions].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const currentDate = new Date(editionDate).getTime();
        const prior = sorted.find(
          (e) => new Date(e.date).getTime() < currentDate
        );

        if (!prior) {
          // No prior edition — all entries are "new" unless released >14 days ago
          const result = draftEntries.map((e) => {
            const track = e.entryPayload?.track as
              | Record<string, unknown>
              | undefined;
            const releaseDate = (track?.releaseDate as string) ?? "";
            const isNewByRelease =
              releaseDate && isWithinDays(releaseDate, editionDate, 14);

            return {
              ...e,
              displayMovement: isNewByRelease
                ? ("new" as const)
                : ("new" as const),
              displayPreviousRank: null,
              displayMovementAmount: 0,
            };
          });
          setEnriched(result);
          return;
        }

        // Fetch prior edition entries
        const { data: priorEntries } = await getChartEditionEntries(
          familySlug,
          prior.slug
        );
        if (cancelled) return;

        // Build lookup by normalized title
        const priorRankMap = new Map<string, number>();
        for (const pe of priorEntries) {
          const key = normalizeTitle(pe.trackTitle);
          priorRankMap.set(key, pe.rank);
        }

        // Compute movement for each draft entry
        const result = draftEntries.map((e) => {
          const track = e.entryPayload?.track as
            | Record<string, unknown>
            | undefined;
          const title = normalizeTitle(
            (track?.normalizedTitle as string) ?? ""
          );
          const releaseDate = (track?.releaseDate as string) ?? "";

          const prevRank = priorRankMap.get(title) ?? null;
          const isNewByRelease =
            releaseDate && isWithinDays(releaseDate, editionDate, 14);

          let displayMovement: EnrichedDraftEntry["displayMovement"];
          let displayMovementAmount: number | null;

          if (prevRank === null) {
            // Track not in prior edition
            displayMovement = isNewByRelease ? "new" : "re_entry";
            displayMovementAmount = 0;
          } else if (prevRank > e.finalRank) {
            displayMovement = "up";
            displayMovementAmount = prevRank - e.finalRank;
          } else if (prevRank < e.finalRank) {
            displayMovement = "down";
            displayMovementAmount = e.finalRank - prevRank;
          } else {
            displayMovement = "same";
            displayMovementAmount = 0;
          }

          return {
            ...e,
            displayMovement,
            displayPreviousRank: prevRank,
            displayMovementAmount,
          };
        });

        if (!cancelled) setEnriched(result);
      } catch {
        // Fall back to mock movement
        if (!cancelled) {
          setEnriched(
            draftEntries.map((e) => ({
              ...e,
              displayMovement: e.movement,
              displayPreviousRank: e.previousRank,
              displayMovementAmount:
                e.previousRank && e.finalRank
                  ? Math.abs(e.finalRank - e.previousRank)
                  : null,
            }))
          );
        }
      }
    }

    enrich();
    return () => {
      cancelled = true;
    };
  }, [draftEntries, job.editionDate, job.chartFamily?.familyKey]);

  return enriched;
}