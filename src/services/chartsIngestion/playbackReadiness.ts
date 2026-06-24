import { supabase } from "@/lib/supabase";

export type ChartPlaybackMissingRow = {
  rank: number;
  title: string;
  artist: string;
  trackSlug: string | null;
  registryTrackId: string | null;
  reason: "missing_registry_track" | "missing_apple_music_provider_link" | "ready" | string;
};

export type ChartPlaybackReadiness = {
  runId: string;
  providerKey: string;
  totalEntries: number;
  top10Entries: number;
  playableEntries: number;
  top10Playable: number;
  missingRegistryTracks: number;
  missingProviderLinks: number;
  playbackRate: number;
  top10PlaybackRate: number;
  canPublish: boolean;
  missingRows: ChartPlaybackMissingRow[];
};

function numberValue(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapReadiness(data: Record<string, unknown>): ChartPlaybackReadiness {
  return {
    runId: String(data.runId || data.run_id || ""),
    providerKey: String(data.providerKey || data.provider_key || "apple_music"),
    totalEntries: numberValue(data.totalEntries),
    top10Entries: numberValue(data.top10Entries),
    playableEntries: numberValue(data.playableEntries),
    top10Playable: numberValue(data.top10Playable),
    missingRegistryTracks: numberValue(data.missingRegistryTracks),
    missingProviderLinks: numberValue(data.missingProviderLinks),
    playbackRate: numberValue(data.playbackRate),
    top10PlaybackRate: numberValue(data.top10PlaybackRate),
    canPublish: data.canPublish === true,
    missingRows: Array.isArray(data.missingRows)
      ? data.missingRows as ChartPlaybackMissingRow[]
      : [],
  };
}

export async function getChartPlaybackReadiness(
  runId: string,
  providerKey: string = "apple_music",
): Promise<ChartPlaybackReadiness> {
  const { data, error } = await supabase.rpc("chart_get_run_playback_readiness", {
    p_run_id: runId,
    p_provider_key: providerKey,
  });

  if (error) throw error;

  return mapReadiness((data || {}) as Record<string, unknown>);
}
