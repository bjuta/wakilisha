import { supabase } from "@/lib/supabase";
import { validateWkArtworkUrl } from "@/components/data-viz/WkRecordingArtwork";

export type VerifiedAppleChartSong = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
};

// Official song IDs from the captured Apple Music chart only.
// Title lookup, guessed album covers, and cross-source identity merges are forbidden.
const catalogCache = new Map<string, VerifiedAppleChartSong>();
const normalizeTitle = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");

type CatalogSong = {
  id?: string;
  type?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    artwork?: { url?: string };
  };
};

function verifiedSong(row: CatalogSong, wantedTitle: string): VerifiedAppleChartSong | null {
  if (!row || row.type !== "songs" || typeof row.id !== "string") return null;
  const attributes = row.attributes;
  if (!attributes || typeof attributes.name !== "string" ||
      normalizeTitle(attributes.name) !== normalizeTitle(wantedTitle)) return null;
  const template = attributes.artwork?.url;
  const artworkUrl = typeof template === "string"
    ? validateWkArtworkUrl(template.replaceAll("{w}", "240").replaceAll("{h}", "240"))
    : null;
  const durationMs = attributes.durationInMillis;
  return {
    id: row.id,
    title: attributes.name,
    artist: attributes.artistName?.trim() || null,
    album: attributes.albumName?.trim() || null,
    durationMs: typeof durationMs === "number" && Number.isInteger(durationMs) &&
      durationMs > 0 && durationMs < 3_600_000 ? durationMs : null,
    artworkUrl,
  };
}

export async function loadVerifiedAppleChartSongs(
  requested: Array<{ id: string; title: string }>,
  signal?: AbortSignal,
): Promise<Record<string, VerifiedAppleChartSong>> {
  const byId = new Map<string, string>();
  for (const item of requested) {
    if (!/^[0-9]{6,20}$/.test(item.id) || !item.title.trim() ||
        (byId.has(item.id) && byId.get(item.id) !== item.title)) continue;
    byId.set(item.id, item.title);
  }
  const result: Record<string, VerifiedAppleChartSong> = {};
  const pending = [...byId.entries()].filter(([id, title]) => {
    const saved = catalogCache.get(id);
    if (saved && normalizeTitle(saved.title) === normalizeTitle(title)) {
      result[id] = saved;
      return false;
    }
    return true;
  });
  if (!pending.length) return result;

  const { data, error } = await supabase.functions.invoke<{
    developerToken?: string;
    configured?: boolean;
  }>("apple-music-token", {});
  if (error || data?.configured === false || !data?.developerToken) return result;

  // Two bounded official catalogue reads, never a title-search fan-out.
  for (let start = 0; start < pending.length; start += 50) {
    if (signal?.aborted) break;
    const batch = pending.slice(start, start + 50);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    try {
      const url = new URL("https://api.music.apple.com/v1/catalog/ke/songs");
      url.searchParams.set("ids", batch.map(([id]) => id).join(","));
      const response = await fetch(url, {
        headers: { Authorization: "Bearer " + data.developerToken },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const body: { data?: CatalogSong[] } = await response.json();
      const allowed = new Map(batch);
      for (const row of body.data ?? []) {
        if (!row.id || !allowed.has(row.id)) continue;
        const confirmed = verifiedSong(row, allowed.get(row.id)!);
        if (!confirmed) continue;
        result[row.id] = confirmed;
        catalogCache.set(row.id, confirmed);
      }
    } catch {
      // Album artwork is optional. Source ranks must remain available.
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  return result;
}
