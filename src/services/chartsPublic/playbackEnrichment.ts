import { supabase } from "@/lib/supabase";
import type { ChartEditionEntry } from "@/services/chartsPublic/types";
import {
  getPublicTrackPlaybackProviders,
  type PublicTrackPlaybackProvider,
} from "@/services/registry/providerLinks";

type RegistryTrackPlaybackRow = {
  id?: string | null;
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

function readAppleMusicCatalogId(
  row: RegistryTrackPlaybackRow,
  provider?: PublicTrackPlaybackProvider | null,
): string | null {
  const meta = (row.metadata || {}) as Record<string, unknown>;

  return firstString(
    provider?.providerTrackId,
    provider?.providerReleaseId,
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

function applyPlaybackRow(
  entry: ChartEditionEntry,
  row: RegistryTrackPlaybackRow,
  provider?: PublicTrackPlaybackProvider | null,
) {
  const appleMusicCatalogId = readAppleMusicCatalogId(row, provider);
  const rich = entry as ChartEditionEntry & {
    previewUrl?: string;
    appleMusicId?: string | null;
    appleMusicCatalogId?: string | null;
    isPlayable?: boolean;
    duration?: number;
  };

  const previewUrl = firstString(provider?.previewUrl, row.preview_url);
  const artworkUrl = firstString(provider?.artworkUrl, row.artwork_url);
  const durationMs = provider?.durationMs || row.duration_ms || null;

  if (previewUrl) rich.previewUrl = previewUrl;
  if (artworkUrl && !entry.artworkUrl) entry.artworkUrl = artworkUrl;
  if (durationMs && !rich.duration) rich.duration = Math.round(durationMs / 1000);

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
        .select("id, slug, title, preview_url, artwork_url, duration_ms, metadata")
        .in("slug", slugs);

      const rows = (data || []) as RegistryTrackPlaybackRow[];
      const trackIds = rows.map((row) => row.id).filter(Boolean) as string[];
      let providerByTrackId = new Map<string, PublicTrackPlaybackProvider>();

      if (trackIds.length > 0) {
        try {
          const providers = await getPublicTrackPlaybackProviders(trackIds, "apple_music");
          providerByTrackId = new Map(providers.map((provider) => [provider.trackId, provider]));
        } catch (err) {
          console.warn("Chart playback provider-link enrichment failed", err);
        }
      }

      for (const row of rows) {
        const entry = bySlug.get(row.slug);
        const provider = row.id ? providerByTrackId.get(row.id) : null;
        if (entry) applyPlaybackRow(entry, row, provider);
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
          .select("id, slug, title, preview_url, artwork_url, duration_ms, metadata")
          .or(orFilter)
          .limit(25);

        const rows = (data || []) as RegistryTrackPlaybackRow[];
        const trackIds = rows.map((row) => row.id).filter(Boolean) as string[];
        let providerByTrackId = new Map<string, PublicTrackPlaybackProvider>();

        if (trackIds.length > 0) {
          try {
            const providers = await getPublicTrackPlaybackProviders(trackIds, "apple_music");
            providerByTrackId = new Map(providers.map((provider) => [provider.trackId, provider]));
          } catch (err) {
            console.warn("Chart playback provider-link title enrichment failed", err);
          }
        }

        for (const entry of stillMissing.filter((item) => batch.includes(item.trackTitle))) {
          const entryTitle = (entry.trackTitle || "").toLowerCase();
          const match = rows.find((row) => {
            const title = (row.title || "").toLowerCase();
            return title.includes(entryTitle) || entryTitle.includes(title);
          });

          const provider = match?.id ? providerByTrackId.get(match.id) : null;
          if (match) applyPlaybackRow(entry, match, provider);
        }
      } catch (err) {
        console.warn("Chart playback title enrichment failed", err);
      }
    }
  }

  return next;
}
