import { useCallback, useEffect, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  canonicalizeShell,
  saveShell,
  rejectShell,
  checkDuplicate,
  fetchCanonicalReleaseForComparison,
  type ShellDuplicateCheckResult,
  type ShellCanonicalizeResult,
  type CanonicalReleaseComparison,
} from "@/services/registry/enrichment-review/client";
import { refreshShellTracks } from "@/services/registry/provider-intake/client";

export interface ShellReviewData {
  id: string;
  releaseId: string;
  title: string;
  primaryArtistName: string | null;
  releaseDate: string | null;
  trackCount: number;
  artworkUrl: string | null;
  providerUrl: string | null;
  provider: string;
  status: string;
  tracks: Array<{
    title: string;
    artistName: string;
    trackNumber: number | null;
    durationMs: number | null;
    isrc: string | null;
    previewUrl: string | null;
  }>;
  sourceProvenance: Record<string, unknown>;
}

interface ShellReviewDrawerProps {
  shell: ShellReviewData;
  onClose: () => void;
  onCanonicalized: () => void;
  onRejected: () => void;
  onSaved: () => void;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ShellReviewDrawer({
  shell,
  onClose,
  onCanonicalized,
  onRejected,
  onSaved,
}: ShellReviewDrawerProps) {
  useScrollLock(true);

  const [title, setTitle] = useState(shell.title);
  const [artistName, setArtistName] = useState(shell.primaryArtistName ?? "");
  const [releaseDate, setReleaseDate] = useState(shell.releaseDate ?? "");
  const [artworkUrl, setArtworkUrl] = useState(shell.artworkUrl ?? "");
  const [reviewNotes, setReviewNotes] = useState("");

  const [duplicateCheck, setDuplicateCheck] = useState<ShellDuplicateCheckResult | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [comparison, setComparison] = useState<CanonicalReleaseComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const [canonicalizing, setCanonicalizing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshingTracks, setRefreshingTracks] = useState(false);
  const [result, setResult] = useState<ShellCanonicalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract provider info from source_provenance for track refresh
  const providerEntityId = (shell.sourceProvenance as Record<string, unknown>)?.provider_entity_id as string | undefined;
  const providerName = (shell.sourceProvenance as Record<string, unknown>)?.provider as string | undefined ?? shell.provider;
  const storefront = ((shell.sourceProvenance as Record<string, unknown>)?.provider_url as string | undefined
    )?.match(/\/catalog\/([a-z]{2})\//)?.[1] ?? "ke";
  const hasStaleTracksData = shell.tracks.length < shell.trackCount && shell.tracks.length <= 1;

  const handleRefreshTracks = async () => {
    if (!providerEntityId || refreshingTracks) return;
    setRefreshingTracks(true);
    setError(null);
    try {
      const res = await refreshShellTracks(shell.id, providerEntityId, providerName === "Apple Music" ? "apple_music" : providerName, storefront);
      if (res.tracksFetched > 0) {
        onSaved(); // triggers parent to reload the shell data
      } else {
        setError("Track refresh returned 0 tracks. The Apple Music API may not have returned track data for this album.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Track refresh failed");
    } finally {
      setRefreshingTracks(false);
    }
  };

  const isCanonicalized = shell.status === "canonicalized";
  const isRejected = shell.status === "rejected";
  const isReadOnly = isCanonicalized || isRejected;

  const runDuplicateCheck = useCallback(async () => {
    if (isCanonicalized || isRejected) return;
    setDuplicateLoading(true);
    try {
      const res = await checkDuplicate(shell.id);
      setDuplicateCheck(res);
      if (res.hasDuplicates && res.duplicates[0]) {
        setComparisonLoading(true);
        const comp = await fetchCanonicalReleaseForComparison(res.duplicates[0].registryEntityId);
        setComparison(comp);
      }
    } catch {
      // Duplicate check is best-effort
    } finally {
      setDuplicateLoading(false);
      setComparisonLoading(false);
    }
  }, [shell.id, isCanonicalized, isRejected]);

  useEffect(() => {
    runDuplicateCheck();
  }, [runDuplicateCheck]);

  const handleSave = async () => {
    if (isReadOnly) return;
    setSaving(true);
    setError(null);
    try {
      await saveShell(shell.id, {
        title,
        primary_artist_name: artistName,
        release_date: releaseDate,
        artwork_url: artworkUrl,
        review_notes: reviewNotes,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCanonicalize = async () => {
    if (isReadOnly) return;
    setCanonicalizing(true);
    setError(null);
    try {
      const res = await canonicalizeShell(shell.id);
      setResult(res);
      onCanonicalized();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Canonicalization failed");
    } finally {
      setCanonicalizing(false);
    }
  };

  const handleReject = async () => {
    if (isReadOnly) return;
    setRejecting(true);
    setError(null);
    try {
      await rejectShell(shell.id, reviewNotes || "Rejected from review drawer");
      onRejected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/40 cursor-default"
        onClick={onClose}
        aria-label="Close review drawer"
      />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-full max-w-4xl flex-col bg-[#f7f7f2] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfe4d8] bg-white px-6 py-4">
          <div>
            <h2 className="text-[15px] font-black text-[#171712]">Review Release Shell</h2>
            <p className="mt-0.5 text-[11px] text-[#697062]">
              {isCanonicalized
                ? "This shell has already been canonicalized."
                : isRejected
                ? "This shell has been rejected."
                : "Edit fields, review tracks, and canonicalize."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#dfe4d8] text-[#71796b] hover:border-[#85c441] hover:text-[#171712] transition-colors"
          >
            <WkIcon name="X" size={15} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Error */}
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <WkIcon name="AlertTriangle" size={18} className="shrink-0 text-red-700" />
                <div>
                  <p className="text-[13px] font-bold text-red-800">Error</p>
                  <p className="text-[12px] text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <WkIcon name="CheckCircle" size={18} className="shrink-0 text-emerald-700" />
                <div>
                  <p className="text-[13px] font-bold text-emerald-800">
                    {result.collisionResolved ? "Canonicalized with duplicate merge" : "Canonicalized successfully"}
                  </p>
                  {result.collisionResolved && (
                    <p className="text-[12px] text-emerald-700 mt-0.5">
                      A duplicate draft release was found and merged into the existing active release.
                    </p>
                  )}
                  <p className="text-[12px] text-emerald-700 mt-0.5">
                    {result.tracks.created} tracks created, {result.tracks.joins} release-track joins,
                    {result.tracks.trackArtists} track artists, {result.tracks.releaseArtists} release artists.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Artwork + basic info row */}
          <div className="mb-5 flex items-start gap-4">
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt={title}
                className="h-24 w-24 shrink-0 rounded-2xl object-cover object-top"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                <WkIcon name="Disc3" size={32} className="text-[#97a290]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                  isCanonicalized
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isRejected
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  {isCanonicalized ? "Canonicalized" : isRejected ? "Rejected" : "Pending review"}
                </span>
                <span className="rounded-full border border-[#dfe4d8] bg-[#f8f9f4] px-2 py-0.5 text-[10px] font-bold text-[#71796b] uppercase">
                  {shell.provider}
                </span>
                <span className="rounded-full border border-[#dfe4d8] bg-[#f8f9f4] px-2 py-0.5 text-[10px] font-bold text-[#71796b]">
                  {shell.trackCount} tracks
                </span>
                {shell.releaseId && (
                  <a
                    href={`/admin/registry/releases/${shell.releaseId}`}
                    className="rounded-full border border-[#85c441] bg-[#f0f7e8] px-2 py-0.5 text-[10px] font-bold text-[#5f8f2f] hover:bg-[#5f8f2f] hover:text-white transition-colors whitespace-nowrap"
                  >
                    View in registry
                  </a>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[#b8bfb2]">
                Shell ID: <span className="font-mono">{shell.id}</span>
              </p>
            </div>
          </div>

          {/* Duplicate detection + side-by-side comparison */}
          {duplicateLoading && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#dfe4d8] bg-white p-3">
              <WkIcon name="Loader2" size={14} className="animate-spin text-[#5f8f2f]" />
              <p className="text-[12px] text-[#697062]">Checking for duplicates…</p>
            </div>
          )}

          {/* Side-by-side comparison */}
          {duplicateCheck && duplicateCheck.hasDuplicates && comparison && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <WkIcon name="AlertTriangle" size={15} className="text-amber-600" />
                <p className="text-[12px] font-black text-amber-800">Possible duplicate detected — side-by-side comparison</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Shell data (new) */}
                <div className="rounded-xl border border-[#dfe4d8] bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded-full bg-[#f0f7e8] px-2 py-0.5 text-[9px] font-bold text-[#5f8f2f] uppercase">New shell</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Title</p>
                      <p className="text-[13px] font-bold text-[#171712]">{title || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Artist</p>
                      <p className="text-[13px] font-bold text-[#171712]">{artistName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Release date</p>
                      <p className="text-[13px] font-bold text-[#171712]">{releaseDate || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Artwork</p>
                      {artworkUrl ? (
                        <img src={artworkUrl} alt="" className="mt-1 h-20 w-20 rounded-lg object-cover" />
                      ) : (
                        <p className="text-[12px] text-[#b8bfb2]">No artwork</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Tracks</p>
                      <p className="text-[13px] font-bold text-[#171712]">{shell.tracks.length} tracks</p>
                    </div>
                  </div>
                </div>

                {/* Right: Canonical data (existing) */}
                <div className="rounded-xl border border-[#dfe4d8] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[9px] font-bold text-[#71796b] uppercase">Existing registry</span>
                    <a
                      href={`/admin/registry/releases/${comparison.slug}`}
                      className="text-[10px] font-bold text-[#5f8f2f] hover:underline"
                    >
                      View release
                    </a>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Title</p>
                      <p className="text-[13px] font-bold text-[#171712]">{comparison.title || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Artist</p>
                      <p className="text-[13px] font-bold text-[#171712]">{comparison.artistName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Release date</p>
                      <p className="text-[13px] font-bold text-[#171712]">{comparison.releaseDate || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Artwork</p>
                      {comparison.artworkUrl ? (
                        <img src={comparison.artworkUrl} alt="" className="mt-1 h-20 w-20 rounded-lg object-cover" />
                      ) : (
                        <p className="text-[12px] text-[#b8bfb2]">No artwork</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Tracks</p>
                      <p className="text-[13px] font-bold text-[#171712]">{comparison.trackCount} tracks</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Status</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        comparison.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-[#f0f3ec] text-[#71796b]"
                      }`}>
                        {comparison.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {!isReadOnly && (
                <div className="mt-4 rounded-xl bg-white border border-amber-200 p-3">
                  <p className="text-[12px] font-bold text-amber-800">
                    This release may already exist in the registry.
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">
                    If the existing release is correct, reject this shell. If the shell has better data, canonicalize it — the existing release will be updated.
                  </p>
                </div>
              )}
            </div>
          )}

          {duplicateCheck && !duplicateCheck.hasDuplicates && !isReadOnly && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <WkIcon name="Check" size={14} className="text-emerald-600" />
              <p className="text-[12px] text-emerald-700">No duplicate releases detected.</p>
            </div>
          )}

          {/* Editable form */}
          <div className="mb-5 rounded-2xl border border-[#dfe4d8] bg-white p-5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#71796b]">Shell metadata</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isReadOnly}
                  className="h-10 w-full rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-3 text-[13px] text-[#171712] outline-none focus:border-[#85c441] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Primary artist</label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  disabled={isReadOnly}
                  className="h-10 w-full rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-3 text-[13px] text-[#171712] outline-none focus:border-[#85c441] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Release date</label>
                <input
                  type="date"
                  value={releaseDate?.slice(0, 10) ?? ""}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  disabled={isReadOnly}
                  className="h-10 w-full rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-3 text-[13px] text-[#171712] outline-none focus:border-[#85c441] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Artwork URL</label>
                <input
                  type="text"
                  value={artworkUrl}
                  onChange={(e) => setArtworkUrl(e.target.value)}
                  disabled={isReadOnly}
                  className="h-10 w-full rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-3 text-[13px] text-[#171712] outline-none focus:border-[#85c441] disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#97a290]">Review notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={isReadOnly}
                  rows={3}
                  className="w-full rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-3 py-2 text-[13px] text-[#171712] outline-none focus:border-[#85c441] disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                Tracks · {shell.tracks.length}
                {shell.trackCount > shell.tracks.length && (
                  <span className="ml-2 text-amber-600">(expected {shell.trackCount})</span>
                )}
              </p>
              {providerEntityId && !isReadOnly && (
                <button
                  onClick={handleRefreshTracks}
                  disabled={refreshingTracks}
                  title="Re-fetch tracks from Apple Music"
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-bold transition-colors whitespace-nowrap disabled:opacity-50 ${
                    hasStaleTracksData
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#85c441]"
                  }`}
                >
                  {refreshingTracks ? (
                    <><WkIcon name="Loader2" size={11} className="animate-spin" /> Refreshing…</>
                  ) : (
                    <><WkIcon name="RefreshCcw" size={11} /> Refresh tracks</>
                  )}
                </button>
              )}
            </div>
            {hasStaleTracksData && !refreshingTracks && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                <WkIcon name="AlertTriangle" size={13} className="shrink-0 text-amber-600" />
                <p className="text-[11px] text-amber-700">
                  Track data looks incomplete — {shell.tracks.length} track{shell.tracks.length !== 1 ? "s" : ""} stored but {shell.trackCount} expected. Click Refresh tracks to re-pull from Apple Music.
                </p>
              </div>
            )}
            {shell.tracks.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-[#697062]">No tracks in this shell.</p>
            ) : (
              <div className="space-y-1">
                {shell.tracks.map((track, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fbfcf8]"
                  >
                    <span className="w-6 shrink-0 text-center text-[11px] font-bold text-[#b8bfb2]">
                      {track.trackNumber ?? index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[#171712] truncate">{track.title}</p>
                      <p className="text-[11px] text-[#697062] truncate">{track.artistName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {track.isrc && (
                        <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[9px] font-mono text-[#71796b]">
                          {track.isrc}
                        </span>
                      )}
                      <span className="text-[11px] text-[#b8bfb2]">{formatDuration(track.durationMs)}</span>
                      {track.previewUrl && (
                        <a
                          href={track.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f7e8] text-[#5f8f2f] hover:bg-[#5f8f2f] hover:text-white transition-colors"
                        >
                          <WkIcon name="Play" size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-[#dfe4d8] bg-white px-6 py-4">
          {isReadOnly ? (
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#171712]">
                {isCanonicalized ? "This shell is canonicalized." : "This shell has been rejected."}
              </p>
              <button
                onClick={onClose}
                className="rounded-xl border border-[#dfe4d8] bg-white px-5 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441]"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441] disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {saving ? (
                  <><WkIcon name="Loader2" size={14} className="animate-spin" /> Saving…</>
                ) : (
                  <><WkIcon name="Save" size={14} /> Save changes</>
                )}
              </button>

              <button
                onClick={handleCanonicalize}
                disabled={canonicalizing}
                className="rounded-xl bg-[#5f8f2f] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#4d7526] disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {canonicalizing ? (
                  <><WkIcon name="Loader2" size={14} className="animate-spin" /> Canonicalizing…</>
                ) : (
                  <><WkIcon name="CheckCheck" size={14} /> Canonicalize</>
                )}
              </button>

              <button
                onClick={handleReject}
                disabled={rejecting}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {rejecting ? (
                  <><WkIcon name="Loader2" size={14} className="animate-spin" /> Rejecting…</>
                ) : (
                  <><WkIcon name="X" size={14} /> Reject</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}