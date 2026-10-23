import { supabase } from "@/lib/supabase";
import { releaseTypeLabelFromActiveTrackCount } from "@/utils/releaseUrl";

/** Staff discovery is separate from public embed authority: drafts cannot be inserted. */
export interface EditorialReleaseHit {
  id: string;
  slug: string;
  title: string;
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  releaseType: "Single" | "EP" | "Album";
  releaseDate: string | null;
  trackCount: number;
  status: "active" | "draft";
}

function escapeLike(query: string): string {
  return query.replace(/[%_\\]/g, (character) => "\\" + character);
}

export async function searchEditorialReleases(query: string): Promise<EditorialReleaseHit[]> {
  const search = query.trim();
  if (search && search.length < 2) return [];
  let releaseIds: string[] = [];

  if (!search) {
    const { data, error } = await supabase.from("registry_releases")
      .select("id").in("status", ["active", "draft"])
      .order("created_at", { ascending: false }).limit(24);
    if (error) throw error;
    releaseIds = (data ?? []).map((release) => release.id);
  } else {
    const pattern = "%" + escapeLike(search) + "%";
    const [titleMatches, artistMatches] = await Promise.all([
      supabase.from("registry_releases").select("id")
        .in("status", ["active", "draft"]).ilike("title", pattern)
        .order("created_at", { ascending: false }).limit(24),
      supabase.from("registry_release_artists").select("release_id")
        .ilike("artist_name_text", pattern).eq("is_primary", true)
        .eq("status", "active").limit(60),
    ]);
    if (titleMatches.error) throw titleMatches.error;
    if (artistMatches.error) throw artistMatches.error;
    releaseIds = Array.from(new Set([
      ...(titleMatches.data ?? []).map((release) => release.id),
      ...(artistMatches.data ?? []).map((artist) => artist.release_id),
    ])).slice(0, 60);
  }

  if (!releaseIds.length) return [];
  const [releases, artists, memberships] = await Promise.all([
    supabase.from("registry_releases")
      .select("id,slug,title,status,release_type,artwork_url,release_date,created_at")
      .in("id", releaseIds).in("status", ["active", "draft"]),
    supabase.from("registry_release_artists")
      .select("release_id,artist_name_text,artist_slug")
      .in("release_id", releaseIds).eq("is_primary", true).eq("status", "active"),
    supabase.from("registry_release_tracks")
      .select("release_id,track_id").in("release_id", releaseIds).eq("status", "active"),
  ]);
  if (releases.error) throw releases.error;
  if (artists.error) throw artists.error;
  if (memberships.error) throw memberships.error;

  const artistByRelease = new Map<string, { name: string; slug: string }>();
  for (const artist of artists.data ?? []) {
    if (!artistByRelease.has(artist.release_id)) {
      artistByRelease.set(artist.release_id, {
        name: artist.artist_name_text || "Artist unresolved",
        slug: artist.artist_slug || "",
      });
    }
  }
  const tracksByRelease = new Map<string, Set<string>>();
  for (const track of memberships.data ?? []) {
    if (!tracksByRelease.has(track.release_id)) tracksByRelease.set(track.release_id, new Set());
    tracksByRelease.get(track.release_id)!.add(track.track_id);
  }

  const result: EditorialReleaseHit[] = [];
  for (const release of releases.data ?? []) {
    const trackCount = tracksByRelease.get(release.id)?.size ?? 0;
    // The Registry's declared release type is identity authority. Draft ingestions
    // may not yet have active track memberships, and must remain discoverable.
    const declaredType = String(release.release_type ?? "").toLowerCase();
    const kind = declaredType === "single"
      ? "Single" as const
      : declaredType === "ep"
        ? "EP" as const
        : declaredType === "album"
          ? "Album" as const
          : releaseTypeLabelFromActiveTrackCount(trackCount);
    if (!kind) continue;
    const artist = artistByRelease.get(release.id);
    result.push({
      id: release.id, slug: release.slug, title: release.title,
      artistName: artist?.name || "Artist unresolved",
      artistSlug: artist?.slug || "", artworkUrl: release.artwork_url,
      releaseDate: release.release_date, releaseType: kind,
      trackCount, status: release.status as "active" | "draft",
    });
  }
  const rank = new Map(releaseIds.map((id, index) => [id, index]));
  return result.sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)).slice(0, 24);
}
