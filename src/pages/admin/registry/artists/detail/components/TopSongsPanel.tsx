import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { clearDiscographyCache } from "@/services/publicContent/client";

interface TopSongEntry {
  trackId: string;
  trackSlug: string;
  title: string;
  artistNames: string;
  durationDisplay: string;
  artworkUrl: string;
  sortOrder: number;
}

interface DiscographyTrack {
  trackId: string;
  trackSlug: string;
  title: string;
  artistNames: string;
  durationMs: number | null;
  artworkUrl: string;
  releaseTitle: string;
  releaseSlug: string;
  isrc: string | null;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;

async function fetchAdminTopSongs(artistSlug: string): Promise<TopSongEntry[]> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const resp = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-registry-api/top-songs/${encodeURIComponent(artistSlug)}`,
    {
      headers: {
        Accept: "application/json",
        apikey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Admin API ${resp.status}: ${text}`);
  }

  const payload = await resp.json();
  const tracks = payload?.data?.tracks || payload?.tracks || [];

  return tracks.map((t: any) => ({
    trackId: t.trackId || t.track_id || "",
    trackSlug: t.trackSlug || t.track_slug || "",
    title: t.title || "",
    artistNames: t.artistNames || t.artist_names || "",
    durationDisplay: t.durationDisplay || t.duration_display || "",
    artworkUrl: t.artworkUrl || t.artwork_url || "",
    sortOrder: t.sortOrder ?? t.sort_order ?? 0,
  }));
}

async function saveAdminTopSongs(
  artistSlug: string,
  tracks: Array<{ trackSlug: string; title: string; trackId: string }>,
): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const resp = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-registry-api/top-songs/${encodeURIComponent(artistSlug)}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tracks }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Admin API ${resp.status}: ${text}`);
  }
}

export function TopSongsPanel({ artistSlug, artistName }: { artistSlug: string; artistName?: string }) {
  const [topSongs, setTopSongs] = useState<TopSongEntry[]>([]);
  const [discographyTracks, setDiscographyTracks] = useState<DiscographyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [discographyLoading, setDiscographyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load existing top songs via admin-registry-api
  const loadTopSongs = useCallback(async () => {
    if (!artistSlug) return;
    setLoading(true);
    setError(null);

    try {
      const songs = await fetchAdminTopSongs(artistSlug);
      setTopSongs(songs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load top songs");
    } finally {
      setLoading(false);
    }
  }, [artistSlug]);

  // Load artist's discography tracks for the picker (read-only, Supabase RPC OK)
  const loadDiscographyTracks = useCallback(async () => {
    if (!artistSlug) return;
    setDiscographyLoading(true);

    try {
      // Get artist-release links
      const { data: links } = await supabase
        .rpc("get_release_artists_for_anon_v2", { p_artist_slug: artistSlug });

      if (!links || links.length === 0) {
        setDiscographyTracks([]);
        setDiscographyLoading(false);
        return;
      }

      const releaseIds = [...new Set((links as Array<{ release_id: string }>).map((l) => l.release_id))];

      // Get release metadata
      const { data: releaseRows } = await supabase
        .rpc("get_releases_by_ids_v2", { p_release_ids: releaseIds });

      const releaseById = new Map((releaseRows || []).map((r: any) => [r.id, r]));

      // Get release-track links
      const { data: trackLinks } = await supabase
        .rpc("get_release_tracks_by_ids", { p_release_ids: releaseIds });

      if (!trackLinks || trackLinks.length === 0) {
        setDiscographyTracks([]);
        setDiscographyLoading(false);
        return;
      }

      const trackIds = [...new Set((trackLinks as Array<Record<string, unknown>>).map((tl) => tl.track_id as string))];
      const releaseIdByTrack = new Map<string, string>();
      for (const tl of (trackLinks as Array<Record<string, unknown>>)) {
        releaseIdByTrack.set(tl.track_id as string, tl.release_id as string);
      }

      // Get track details
      const { data: trackRows } = await supabase
        .rpc("get_tracks_by_ids", { p_track_ids: trackIds });

      const trackById = new Map((trackRows || []).map((t: any) => [t.id, t]));

      // Get track artists
      const artistsByTrackId = new Map<string, string>();
      const { data: taRows } = await supabase
        .from("registry_track_artists")
        .select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order")
        .in("track_id", trackIds)
        .eq("status", "active")
        .order("credit_order", { ascending: true });

      const groups = new Map<string, Array<{ name: string; isPrimary: boolean }>>();
      for (const ta of (taRows || [])) {
        if (!groups.has(ta.track_id)) groups.set(ta.track_id, []);
        groups.get(ta.track_id)!.push({
          name: ta.artist_name_text || ta.artist_slug,
          isPrimary: !!ta.is_primary,
        });
      }
      for (const [tid, artists] of groups) {
        const primary = artists.find((a) => a.isPrimary) || artists[0];
        const featured = artists.filter((a) => a !== primary && a.name).map((a) => a.name);
        artistsByTrackId.set(
          tid,
          featured.length > 0
            ? `${primary?.name || ""} (feat. ${featured.join(", ")})`
            : (primary?.name || ""),
        );
      }

      const tracks: DiscographyTrack[] = (trackLinks as Array<Record<string, unknown>>)
        .map((tl) => {
          const track = trackById.get(tl.track_id as string);
          if (!track || !track.title) return null;
          const release = releaseById.get(tl.release_id as string);
          return {
            trackId: track.id,
            trackSlug: track.slug || tl.track_id as string,
            title: track.title,
            artistNames: artistsByTrackId.get(track.id) || artistName || "",
            durationMs: track.duration_ms || null,
            artworkUrl: track.artwork_url || "",
            releaseTitle: release?.title || "",
            releaseSlug: release?.slug || "",
            isrc: track.isrc || null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a?.title || "").localeCompare(b?.title || ""));

      setDiscographyTracks(tracks as DiscographyTrack[]);
    } catch (err) {
      console.warn("[TopSongs] Failed to load discography tracks:", err);
    } finally {
      setDiscographyLoading(false);
    }
  }, [artistSlug, artistName]);

  useEffect(() => {
    loadTopSongs();
  }, [loadTopSongs]);

  // Add a track to top songs
  const handleAddTrack = (track: DiscographyTrack) => {
    const selectedSlugs = new Set(topSongs.map((s) => s.trackSlug));
    if (selectedSlugs.has(track.trackSlug)) return;

    if (topSongs.length >= 20) {
      setToast("Maximum 20 top songs allowed");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setTopSongs((prev) => [
      ...prev,
      {
        trackId: track.trackId,
        trackSlug: track.trackSlug,
        title: track.title,
        artistNames: track.artistNames,
        durationDisplay: formatDuration(track.durationMs),
        artworkUrl: track.artworkUrl,
        sortOrder: prev.length,
      },
    ]);
  };

  // Remove a track
  const handleRemoveTrack = (trackSlug: string) => {
    setTopSongs((prev) =>
      prev
        .filter((s) => s.trackSlug !== trackSlug)
        .map((s, i) => ({ ...s, sortOrder: i })),
    );
  };

  // Move track up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setTopSongs((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((s, i) => ({ ...s, sortOrder: i }));
    });
  };

  // Move track down
  const handleMoveDown = (index: number) => {
    setTopSongs((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((s, i) => ({ ...s, sortOrder: i }));
    });
  };

  // Save via admin-registry-api
  const handleSave = async () => {
    if (!artistSlug) return;
    setSaving(true);
    setError(null);

    try {
      const tracks = topSongs.map((s) => ({
        trackSlug: s.trackSlug,
        title: s.title,
        trackId: s.trackId,
      }));

      await saveAdminTopSongs(artistSlug, tracks);

      // Clear the discography cache so the public page refreshes
      clearDiscographyCache(artistSlug);

      setToast(`Saved ${topSongs.length} top song${topSongs.length !== 1 ? "s" : ""}`);
      setTimeout(() => setToast(null), 3000);
      setShowTrackPicker(false);
      await loadTopSongs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Filter discography tracks for picker
  const selectedSlugs = new Set(topSongs.map((s) => s.trackSlug));
  const filteredTracks = discographyTracks.filter(
    (t) =>
      !selectedSlugs.has(t.trackSlug) &&
      (searchQuery === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artistNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.isrc && t.isrc.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.releaseTitle.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (loading) {
    return (
      <WkSurface className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <WkIcon name="Music" size={14} className="text-[var(--wk-text-faint)]" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Top Songs
          </h3>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-14 w-full rounded-lg bg-[var(--wk-surface-raised)]" />
          <div className="h-14 w-full rounded-lg bg-[var(--wk-surface-raised)]" />
          <div className="h-14 w-full rounded-lg bg-[var(--wk-surface-raised)]" />
        </div>
      </WkSurface>
    );
  }

  return (
    <WkSurface className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <WkIcon name="Music" size={14} className="text-[var(--wk-text-faint)]" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Top Songs
          </h3>
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]">
            {topSongs.length}/20
          </span>
        </div>
        <div className="flex items-center gap-2">
          {topSongs.length > 0 && !showTrackPicker && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wk-brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand-on)] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap cursor-pointer"
            >
              {saving ? (
                <><WkIcon name="Loader2" size={11} className="animate-spin" /> Saving&hellip;</>
              ) : (
                <><WkIcon name="Save" size={11} /> Save</>
              )}
            </button>
          )}
          <button
            onClick={() => {
              if (!showTrackPicker) {
                loadDiscographyTracks();
              }
              setShowTrackPicker(!showTrackPicker);
              setSearchQuery("");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-brand)] transition-colors whitespace-nowrap cursor-pointer"
          >
            <WkIcon name={showTrackPicker ? "X" : "PlusCircle"} size={11} />
            {showTrackPicker ? "Close" : "Add Tracks"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <WkIcon name="AlertTriangle" size={14} className="text-red-600 shrink-0" />
          <p className="text-[11px] font-semibold text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-[11px] font-bold text-red-600 hover:text-red-800 shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Track picker */}
      {showTrackPicker && (
        <div className="mb-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <WkIcon name="Search" size={13} className="text-[var(--wk-text-faint)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, artist, ISRC, or release&hellip;"
              className="flex-1 bg-transparent text-[12px] font-semibold text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none"
            />
            {discographyLoading && (
              <WkIcon name="Loader2" size={13} className="animate-spin text-[var(--wk-brand)]" />
            )}
          </div>

          {discographyLoading ? (
            <div className="space-y-1 animate-pulse">
              <div className="h-8 w-full rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-8 w-full rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-8 w-full rounded bg-[var(--wk-surface-raised)]" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <p className="text-[11px] text-[var(--wk-text-faint)] italic py-4 text-center">
              {searchQuery ? "No matching tracks found" : "All tracks from this artist's discography are already selected"}
            </p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto space-y-0.5">
              {filteredTracks.slice(0, 100).map((track) => (
                <button
                  key={track.trackId}
                  onClick={() => handleAddTrack(track)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--wk-surface)] transition-colors group cursor-pointer"
                >
                  {/* Artwork thumbnail */}
                  <div className="h-8 w-8 shrink-0 rounded-md overflow-hidden bg-[var(--wk-surface-raised)] border border-[var(--wk-border)]">
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-[var(--wk-text-faint)]">
                        <WkIcon name="Music" size={12} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[var(--wk-text)] truncate">
                      {track.title}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {track.artistNames && (
                        <span className="text-[10px] text-[var(--wk-text-faint)] truncate">
                          {track.artistNames}
                        </span>
                      )}
                      {track.releaseTitle && (
                        <>
                          <span className="text-[var(--wk-border-strong)]">&middot;</span>
                          <span className="text-[10px] text-[var(--wk-text-faint)] truncate">
                            {track.releaseTitle}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add button */}
                  <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-[var(--wk-brand)]/10 text-[var(--wk-brand)] group-hover:bg-[var(--wk-brand)] group-hover:text-[var(--wk-brand-on)] transition-colors">
                    <WkIcon name="Plus" size={12} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {topSongs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--wk-divider)] flex items-center justify-between">
              <span className="text-[10px] text-[var(--wk-text-faint)]">
                {topSongs.length} track{topSongs.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wk-brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand-on)] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap cursor-pointer"
              >
                {saving ? (
                  <><WkIcon name="Loader2" size={11} className="animate-spin" /> Saving&hellip;</>
                ) : (
                  <><WkIcon name="Save" size={11} /> Save {topSongs.length} Track{topSongs.length !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected tracks list */}
      {topSongs.length === 0 && !showTrackPicker ? (
        <div className="text-center py-8">
          <div className="flex items-center justify-center h-12 w-12 mx-auto rounded-xl bg-[var(--wk-surface-raised)] mb-3">
            <WkIcon name="Music" size={20} className="text-[var(--wk-text-faint)]" />
          </div>
          <p className="text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1">
            No top songs curated yet
          </p>
          <p className="text-[11px] text-[var(--wk-text-faint)] max-w-xs mx-auto">
            Select 1-20 tracks from {artistName || "this artist"}&rsquo;s registry discography. These tracks will appear in the &ldquo;Top Songs&rdquo; section on the public artist page.
          </p>
          <button
            onClick={() => {
              loadDiscographyTracks();
              setShowTrackPicker(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-brand)] transition-colors cursor-pointer"
          >
            <WkIcon name="PlusCircle" size={13} />
            Curate Top Songs
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {topSongs.map((song, index) => (
            <div
              key={song.trackSlug}
              className="flex items-center gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2.5 group hover:border-[var(--wk-brand)]/30 transition-colors"
            >
              {/* Rank */}
              <span className="w-6 shrink-0 text-center text-[12px] font-black text-[var(--wk-text-faint)]">
                {index + 1}
              </span>

              {/* Artwork */}
              <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-[var(--wk-surface-raised)] border border-[var(--wk-border)]">
                {song.artworkUrl ? (
                  <img src={song.artworkUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full w-full text-[var(--wk-text-faint)]">
                    <WkIcon name="Music" size={14} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-[var(--wk-text)] truncate">{song.title}</p>
                {song.artistNames && (
                  <p className="text-[10px] text-[var(--wk-text-faint)] truncate">{song.artistNames}</p>
                )}
              </div>

              {/* Duration */}
              {song.durationDisplay && (
                <span className="text-[10px] font-mono text-[var(--wk-text-faint)] shrink-0 hidden sm:block">
                  {song.durationDisplay}
                </span>
              )}

              {/* Reorder buttons */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-[var(--wk-surface)] disabled:opacity-30 transition-colors cursor-pointer"
                  title="Move up"
                >
                  <WkIcon name="ChevronUp" size={13} className="text-[var(--wk-text-muted)]" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === topSongs.length - 1}
                  className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-[var(--wk-surface)] disabled:opacity-30 transition-colors cursor-pointer"
                  title="Move down"
                >
                  <WkIcon name="ChevronDown" size={13} className="text-[var(--wk-text-muted)]" />
                </button>
              </div>

              {/* Remove */}
              <button
                onClick={() => handleRemoveTrack(song.trackSlug)}
                className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-red-50 text-[var(--wk-text-faint)] hover:text-red-600 transition-colors shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Remove"
              >
                <WkIcon name="X" size={12} />
              </button>
            </div>
          ))}

          {/* Hint text */}
          {topSongs.length > 0 && !showTrackPicker && (
            <p className="text-[10px] text-[var(--wk-text-faint)] text-center pt-2">
              Click &ldquo;Add Tracks&rdquo; to select more, or use the arrows to reorder. Changes won&rsquo;t take effect until you save.
            </p>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)] px-4 py-3 text-[13px] font-semibold text-[var(--wk-success)] shadow-lg animate-in slide-in-from-bottom-2">
          <WkIcon name="CheckCircle2" size={16} />
          {toast}
        </div>
      )}
    </WkSurface>
  );
}