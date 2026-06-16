import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { ReleaseShellIntakeDrawer } from "@/components/admin/registry/release-shells/ReleaseShellIntakeDrawer";
import { ShellReviewDrawer } from "@/components/admin/registry/release-shells/ShellReviewDrawer";
import type { ShellReviewData } from "@/components/admin/registry/release-shells/ShellReviewDrawer";

type ShellStatus = "all" | "pending" | "canonicalized" | "rejected";

interface ShellRow {
  id: string;
  releaseId: string;
  title: string;
  primaryArtistName: string | null;
  releaseDate: string | null;
  trackCount: number;
  artworkUrl: string | null;
  provider: string;
  status: string;
  createdAt: string;
}

function statusStyle(status: string): { badge: string; label: string } {
  switch (status) {
    case "canonicalized": return { badge: "bg-emerald-100 text-emerald-700", label: "Canonicalized" };
    case "rejected": return { badge: "bg-red-100 text-red-700", label: "Rejected" };
    default: return { badge: "bg-amber-100 text-amber-700", label: "Pending" };
  }
}

function providerFromProvenance(provenance: unknown): string {
  const p = provenance as Record<string, unknown> | null;
  const provider = p?.provider as string | undefined;
  if (provider === "spotify") return "Spotify";
  if (provider === "apple_music") return "Apple Music";
  return provider ?? "Registry";
}

function artworkFromProvenance(provenance: unknown): string | null {
  const p = provenance as Record<string, unknown> | null;
  return (p?.artwork_url as string) ?? null;
}

export default function AdminRegistryReleaseShells() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showIntakeDrawer, setShowIntakeDrawer] = useState(false);
  const [reviewShell, setReviewShell] = useState<ShellReviewData | null>(null);
  const [pendingReviewShellId, setPendingReviewShellId] = useState<string | null>(null);

  // Auto-open intake drawer when navigating to /intake
  useEffect(() => {
    if (location.pathname.includes("/intake")) {
      setShowIntakeDrawer(true);
    }
  }, [location.pathname]);

  const [shells, setShells] = useState<ShellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShellStatus>("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from("registry_release_shells")
        .select("id, release_id, title, primary_artist_name, release_date, track_count, source_provenance, status, created_at")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw new Error(error.message);

      const rows: ShellRow[] = (data ?? []).map((s) => ({
        id: s.id,
        releaseId: s.release_id,
        title: s.title,
        primaryArtistName: s.primary_artist_name,
        releaseDate: s.release_date,
        trackCount: s.track_count,
        artworkUrl: artworkFromProvenance(s.source_provenance),
        provider: providerFromProvenance(s.source_provenance),
        status: s.status,
        createdAt: s.created_at,
      }));

      setShells(rows);
    } catch (err) {
      setShells([]);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load shells.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Open review drawer for a shell ID
  const openReviewByShellId = async (shellId: string) => {
    setLoading(true);
    try {
      const { data: shellData } = await supabase
        .from("registry_release_shells")
        .select("id, release_id, title, primary_artist_name, release_date, track_count, source_provenance, status, tracks")
        .eq("id", shellId)
        .single();

      if (!shellData) {
        showToast("Shell not found", "error");
        return;
      }

      const rawTracks = Array.isArray(shellData.tracks) ? shellData.tracks : [];
      const tracks = rawTracks.map((t: Record<string, unknown>) => ({
        title: (t.title as string) || "Untitled",
        artistName: (t.artistName as string) || shellData.primary_artist_name || "",
        trackNumber: (t.trackNumber as number | null) ?? null,
        durationMs: (t.durationMs as number | null) ?? null,
        isrc: (t.isrc as string) || null,
        previewUrl: (t.previewUrl as string) || null,
      }));

      const reviewData: ShellReviewData = {
        id: shellData.id,
        releaseId: shellData.release_id,
        title: shellData.title,
        primaryArtistName: shellData.primary_artist_name,
        releaseDate: shellData.release_date,
        trackCount: shellData.track_count,
        artworkUrl: artworkFromProvenance(shellData.source_provenance),
        providerUrl: (shellData.source_provenance as Record<string, unknown> | null)?.provider_url as string | null,
        provider: providerFromProvenance(shellData.source_provenance),
        status: shellData.status,
        tracks,
        sourceProvenance: (shellData.source_provenance as Record<string, unknown>) ?? {},
      };

      setReviewShell(reviewData);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load shell details", "error");
    } finally {
      setLoading(false);
    }
  };

  // When pendingReviewShellId is set, open the review drawer
  useEffect(() => {
    if (pendingReviewShellId) {
      openReviewByShellId(pendingReviewShellId);
      setPendingReviewShellId(null);
    }
  }, [pendingReviewShellId]);

  const handleCloseIntakeDrawer = useCallback(() => {
    setShowIntakeDrawer(false);
    if (location.pathname.includes("/intake")) {
      navigate("/admin/registry/release-shells", { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleIntakeComplete = useCallback(() => {
    setShowIntakeDrawer(false);
    if (location.pathname.includes("/intake")) {
      navigate("/admin/registry/release-shells", { replace: true });
    }
    load();
  }, [location.pathname, navigate, load]);

  const handleIntakeShellCreated = useCallback((shellId: string) => {
    setShowIntakeDrawer(false);
    setPendingReviewShellId(shellId);
    if (location.pathname.includes("/intake")) {
      navigate("/admin/registry/release-shells", { replace: true });
    }
    load();
  }, [location.pathname, navigate, load]);

  const handleOpenReview = async (row: ShellRow) => {
    await openReviewByShellId(row.id);
  };

  const filtered = useMemo(() => {
    return shells.filter((row) => {
      const matchesStatus = statusFilter === "all"
        ? true
        : statusFilter === "pending"
        ? row.status !== "canonicalized" && row.status !== "rejected"
        : row.status === statusFilter;

      if (!matchesStatus) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      return [
        row.title,
        row.primaryArtistName,
        row.provider,
        row.status,
      ].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [shells, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const pending = shells.filter((s) => s.status !== "canonicalized" && s.status !== "rejected").length;
    const canonicalized = shells.filter((s) => s.status === "canonicalized").length;
    const rejected = shells.filter((s) => s.status === "rejected").length;
    return { all: shells.length, pending, canonicalized, rejected };
  }, [shells]);

  if (loading && shells.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-[#dfe4d8] bg-[#f7f7f2]">
        <div className="flex flex-col items-center gap-3 text-center">
          <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
          <p className="text-[14px] font-bold text-[#171712]">Loading release shells…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] space-y-5">
      {/* Intake drawer */}
      {showIntakeDrawer && (
        <ReleaseShellIntakeDrawer
          onClose={handleCloseIntakeDrawer}
          onShellCreated={handleIntakeComplete}
          onShellCreatedWithId={handleIntakeShellCreated}
        />
      )}

      {/* Review drawer */}
      {reviewShell && (
        <ShellReviewDrawer
          shell={reviewShell}
          onClose={() => setReviewShell(null)}
          onCanonicalized={() => {
            setReviewShell(null);
            showToast("Shell canonicalized successfully", "success");
            load();
          }}
          onRejected={() => {
            setReviewShell(null);
            showToast("Shell rejected", "success");
            load();
          }}
          onSaved={() => {
            showToast("Shell saved", "success");
            load();
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-5 py-3 text-[13px] font-bold shadow-xl transition-all ${
          toast.type === "success" ? "border-emerald-200 bg-white text-emerald-800" : "border-red-200 bg-white text-red-800"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">Registry</p>
          <h1 className="text-[26px] font-black tracking-tight text-[#171712]">Release Shells</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#697062]">
            Pull provider releases into staging shells, review their metadata and tracks, then canonicalize into the registry.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowIntakeDrawer(true)}
            className="rounded-2xl bg-[#5f8f2f] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#4d7526] flex items-center gap-2 whitespace-nowrap"
          >
            <WkIcon name="Plus" size={14} />
            Start intake
          </button>
          <button
            onClick={load}
            className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441] flex items-center gap-2"
          >
            <WkIcon name="RefreshCcw" size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1 max-w-md">
          <WkIcon name="Search" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b8bfb2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, artist, or provider…"
            className="h-10 w-full rounded-2xl border border-[#dfe4d8] bg-white pl-10 pr-4 text-[13px] text-[#171712] outline-none focus:border-[#85c441]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "All", statusCounts.all],
            ["pending", "Pending", statusCounts.pending],
            ["canonicalized", "Canonicalized", statusCounts.canonicalized],
            ["rejected", "Rejected", statusCounts.rejected],
          ] as Array<[ShellStatus, string, number]>).map(([filter, label, count]) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-all ${
                statusFilter === filter
                  ? "border-[#85c441] bg-[#f0f7e8] text-[#5f8f2f]"
                  : "border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#85c441]/60"
              }`}
            >
              {label} · {count}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <WkIcon name="AlertTriangle" size={20} className="shrink-0 text-red-700" />
            <div>
              <p className="text-[13px] font-bold text-red-800">Could not load release shells</p>
              <p className="mt-1 text-[12px] text-red-700">{errorMessage}</p>
              <button
                onClick={load}
                className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white">
        {filtered.length === 0 && !errorMessage ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
              <WkIcon name="FolderCheck" size={28} className="text-[#5f8f2f]" />
            </div>
            <p className="text-[16px] font-black text-[#171712]">
              {search || statusFilter !== "all" ? "No shells match your filters" : "No release shells"}
            </p>
            <p className="max-w-md text-[13px] text-[#697062]">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Pull releases from Apple Music to create staging shells for review."}
            </p>
            {(search || statusFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
                className="rounded-xl border border-[#dfe4d8] px-4 py-2 text-[13px] font-bold text-[#697062] hover:border-[#85c441]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid items-center gap-3 border-b border-[#e8ece2] bg-[#fbfcf8] px-5 py-3 text-[10px] font-black uppercase tracking-wider text-[#71796b]"
              style={{ gridTemplateColumns: "48px minmax(0,2fr) minmax(0,1.2fr) minmax(0,0.8fr) 100px 80px 90px" }}
            >
              <span />
              <span>Release</span>
              <span>Artist</span>
              <span>Provider</span>
              <span>Status</span>
              <span>Tracks</span>
              <span>Action</span>
            </div>

            <div>
              {filtered.map((row, index) => {
                const style = statusStyle(row.status);
                return (
                  <div
                    key={row.id}
                    className="grid items-center gap-3 border-b border-[#eef1ea] px-5 py-3 hover:bg-[#fbfcf8] transition-colors last:border-b-0"
                    style={{ gridTemplateColumns: "48px minmax(0,2fr) minmax(0,1.2fr) minmax(0,0.8fr) 100px 80px 90px" }}
                  >
                    {/* Artwork */}
                    <div>
                      {row.artworkUrl ? (
                        <img src={row.artworkUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f3ec] text-[11px] font-black text-[#8a9283]">
                          R
                        </div>
                      )}
                    </div>

                    {/* Release */}
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#171712]">{row.title}</p>
                      <p className="truncate text-[10px] text-[#858c7e]">{row.id}</p>
                    </div>

                    {/* Artist */}
                    <p className="truncate text-[13px] text-[#5d6557]">{row.primaryArtistName || "—"}</p>

                    {/* Provider */}
                    <span className="rounded-full border border-[#dfe4d8] bg-[#f8f9f4] px-2 py-0.5 text-[10px] font-bold text-[#71796b] uppercase tracking-wide w-fit">
                      {row.provider}
                    </span>

                    {/* Status */}
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap w-fit ${style.badge}`}>
                      {style.label}
                    </span>

                    {/* Tracks */}
                    <span className="text-[13px] font-bold text-[#171712]">{row.trackCount}</span>

                    {/* Action */}
                    <button
                      onClick={() => handleOpenReview(row)}
                      className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#5f8f2f] hover:border-[#85c441] hover:bg-[#f0f7e8] transition-colors whitespace-nowrap"
                    >
                      Review
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}