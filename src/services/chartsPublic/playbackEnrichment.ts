import { supabase } from "@/lib/supabase";
import type { ChartEditionEntry } from "@/services/chartsPublic/types";

type RegistryTrackPlaybackRow = {
  slug: string;
  title?: string | null;
  preview_url?: string | null;
  artwork_url?: string | null;
  duration_ms?: number | null;
  metadata?: Record<string, unknown> | null;
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNested(record: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, record);
}

function readAppleMusicCatalogId(row: RegistryTrackPlaybackRow): string | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;

  return firstString(
    meta.apple_music_track_id,
    meta.apple_music_id,
    meta.appleMusicId,
    meta.apple_music_catalog_id,
    meta.appleMusicCatalogId,
    meta.apple_music_provider_id,
    meta.appleMusicProviderId,
    readNested(meta, ["apple_music", "id"]),
    readNested(meta, ["apple_music", "catalog_id"]),
    readNested(meta, ["appleMusic", "id"]),
    readNested(meta, ["appleMusic", "catalogId"]),
    readNested(meta, ["providers", "apple_music", "id"]),
    readNested(meta, ["providers", "apple_music", "catalog_id"]),
    readNested(meta, ["provider_ids", "apple_music"]),
    readNested(meta, ["source_ids", "apple_music"])
  );
}

function applyPlaybackRow(entry: ChartEditionEntry, row: RegistryTrackPlaybackRow) {
  const appleMusicCatalogId = readAppleMusicCatalogId(row);
  const rich = entry as ChartEditionEntry & {
    previewUrl?: string;
    appleMusicId?: string | null;
    appleMusicCatalogId?: string | null;
    isPlayable?: boolean;
    duration?: number;
  };

  if (row.preview_url) rich.previewUrl = row.preview_url;
  if (row.artwork_url && !entry.artworkUrl) entry.artworkUrl = row.artwork_url;
  if (row.duration_ms && !rich.duration) rich.duration = Math.round(row.duration_ms / 1000);

  if (appleMusicCatalogId) {
    rich.appleMusicId = appleMusicCatalogId;
    rich.appleMusicCatalogId = appleMusicCatalogId;
  }

  rich.isPlayable = Boolean(rich.previewUrl || rich.appleMusicCatalogId || rich.appleMusicId);
}

export async function enrichChartEntriesWithPlaybackData(
  entries: ChartEditionEntry[],
): Promise<ChartEditionEntry[]> {
  if (!entries.length) return entries;

  const next = entries.map((entry) => ({ ...entry }));
  const bySlug = new Map(next.map((entry) => [entry.trackSlug, entry]));
  const slugs = [...new Set(next.map((entry) => entry.trackSlug).filter(Boolean))];

  if (slugs.length) {
    try {
      const { data } = await supabase
        .from("registry_tracks")
        .select("slug, title, preview_url, artwork_url, duration_ms, metadata")
        .in("slug", slugs);

      for (const row of (data || []) as RegistryTrackPlaybackRow[]) {
        const entry = bySlug.get(row.slug);
        if (entry) applyPlaybackRow(entry, row);
      }
    } catch (err) {
      console.warn("Chart playback slug enrichment failed", err);
    }
  }

  const stillMissing = next.filter((entry) => {
    const rich = entry as ChartEditionEntry & {
      previewUrl?: string;
      appleMusicCatalogId?: string | null;
      appleMusicId?: string | null;
    };
    return !rich.previewUrl && !rich.appleMusicCatalogId && !rich.appleMusicId;
  });

  if (stillMissing.length) {
    const titles = [...new Set(stillMissing.map((entry) => entry.trackTitle).filter(Boolean))];

    for (let i = 0; i < titles.length; i += 4) {
      const batch = titles.slice(i, i + 4);

      try {
        const safeTitles = batch.map((title) => title.replace(/'/g, "''"));
        const orFilter = safeTitles.map((title) => `title.ilike.%25${title}%25`).join(",");

        const { data } = await supabase
          .from("registry_tracks")
          .select("slug, title, preview_url, artwork_url, duration_ms, metadata")
          .or(orFilter)
          .limit(25);

        const rows = (data || []) as RegistryTrackPlaybackRow[];

        for (const entry of stillMissing.filter((item) => batch.includes(item.trackTitle))) {
          const entryTitle = (entry.trackTitle || "").toLowerCase();
          const match = rows.find((row) => {
            const title = (row.title || "").toLowerCase();
            return title.includes(entryTitle) || entryTitle.includes(title);
          });

          if (match) applyPlaybackRow(entry, match);
        }
      } catch (err) {
        console.warn("Chart playback title enrichment failed", err);
      }
    }
  }

  return next;
}
