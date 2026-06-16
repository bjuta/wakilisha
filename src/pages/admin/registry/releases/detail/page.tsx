import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import { useRelatedEntities } from "@/hooks/useRelatedEntities";
import AdminReleaseHero from "./components/AdminReleaseHero";
import type { ReleaseHeroData } from "./components/AdminReleaseHero";
import AdminReleaseTracklist from "./components/AdminReleaseTracklist";
import type { TrackItem, TrackArtistRecord } from "./components/AdminReleaseTracklist";
import AdminReleaseExcerpt from "./components/AdminReleaseExcerpt";
import AdminReleaseSidebar from "./components/AdminReleaseSidebar";

/* ─── Types ─── */

interface ReleaseRecord {
  id: string;
  slug: string;
  title: string;
  normalized_title: string;
  release_type: string | null;
  upc: string | null;
  release_date: string | null;
  release_date_precision: string | null;
  label_id: string | null;
  artwork_url: string | null;
  description: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface LabelRecord {
  id: string;
  slug: string;
  name: string;
}

interface ReleaseArtistRecord {
  artist_id: string;
  artist_slug: string;
  artist_name_text: string;
  role: string;
  is_primary: boolean;
}

interface Draft {
  title: string;
  release_type: string;
  upc: string;
  release_date: string;
  release_date_precision: string;
  label_id: string;
  description: string;
  artwork_url: string;
  status: string;
}

interface ToastMsg {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

let toastCounter = 0;

/* ─── Helpers ─── */

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/* ─── Page ─── */

export default function ReleaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [release, setRelease] = useState<ReleaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [trackArtists, setTrackArtists] = useState<TrackArtistRecord[]>([]);
  const [releaseArtists, setReleaseArtists] = useState<ReleaseArtistRecord[]>([]);
  const [label, setLabel] = useState<LabelRecord | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  const [draft, setDraft] = useState<Draft>({
    title: "",
    release_type: "",
    upc: "",
    release_date: "",
    release_date_precision: "",
    label_id: "",
    description: "",
    artwork_url: "",
    status: "draft",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showDelete, setShowDelete] = useState(false);

  /* ─── Load release ─── */

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      const uuid = isUuid(slug);
      const query = supabase.from("registry_releases").select(
        "id, slug, title, normalized_title, release_type, upc, release_date, release_date_precision, label_id, artwork_url, description, status, metadata, created_at, updated_at"
      );
      const { data, error } = uuid
        ? await query.eq("id", slug).maybeSingle()
        : await query.eq("slug", slug).maybeSingle();

      if (error) { addToast("error", "Failed to load release."); setLoading(false); return; }
      if (!data) { setNotFound(true); setLoading(false); return; }

      setRelease(data);
      setDraft({
        title: data.title,
        release_type: data.release_type ?? "",
        upc: data.upc ?? "",
        release_date: data.release_date ?? "",
        release_date_precision: data.release_date_precision ?? "",
        label_id: data.label_id ?? "",
        description: data.description ?? "",
        artwork_url: data.artwork_url ?? "",
        status: data.status,
      });
      setIsDirty(false);
      setLoading(false);

      // Fire-and-forget rich data
      loadRichData(data.id, data.label_id);
    }
    load();
  }, [slug]);

  /* ─── Load rich data ─── */

  async function loadRichData(releaseId: string, labelId: string | null) {
    setDataLoading(true);
    try {
      // Step 1: Get release tracks
      const { data: tracksData, error: tracksErr } = await supabase
        .from("registry_release_tracks")
        .select("track_number, disc_number, status, track_id")
        .eq("release_id", releaseId)
        .order("disc_number")
        .order("track_number");

      if (tracksErr) throw new Error(`tracks: ${tracksErr.message}`);

      const trackIds = tracksData?.map((t) => t.track_id) ?? [];

      // Step 2: Load track details, track artists, release artists, and label in parallel
      const [trackDetailsRes, trackArtistsRes, releaseArtistsRes, labelRes] = await Promise.all([
        trackIds.length > 0
          ? supabase
              .from("registry_tracks")
              .select("id, slug, title, duration_ms, isrc, preview_url, artwork_url, status")
              .in("id", trackIds)
          : Promise.resolve({ data: [], error: null }),
        trackIds.length > 0
          ? supabase
              .from("registry_track_artists")
              .select("track_id, artist_id, artist_slug, artist_name_text, role, is_primary, is_featured, credit_order, display_credit")
              .in("track_id", trackIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("registry_release_artists")
          .select("artist_id, artist_slug, artist_name_text, role, is_primary")
          .eq("release_id", releaseId),
        labelId
          ? supabase.from("registry_labels").select("id, slug, name").eq("id", labelId).maybeSingle()
          : Promise.resolve(null),
      ]);

      // Merge tracks
      if (tracksData && trackDetailsRes.data) {
        const detailMap = new Map(trackDetailsRes.data.map((td) => [td.id, td]));
        const merged: TrackItem[] = tracksData.map((rt) => {
          const td = detailMap.get(rt.track_id);
          return {
            track_id: rt.track_id,
            track_slug: td?.slug ?? "",
            track_title: td?.title ?? "(Unknown)",
            track_number: rt.track_number ?? 0,
            disc_number: rt.disc_number ?? 1,
            duration_ms: td?.duration_ms ?? 0,
            isrc: td?.isrc ?? null,
            preview_url: td?.preview_url ?? null,
            track_artwork_url: td?.artwork_url ?? null,
            track_status: td?.status ?? "draft",
            link_status: rt.status ?? "active",
          };
        });
        setTracks(merged);
      }

      if (trackArtistsRes.data) setTrackArtists(trackArtistsRes.data as TrackArtistRecord[]);
      if (releaseArtistsRes.data) setReleaseArtists(releaseArtistsRes.data as ReleaseArtistRecord[]);
      if (labelRes?.data) setLabel(labelRes.data as LabelRecord);
    } catch (err) {
      console.error("[loadRichData] error:", err);
      addToast("error", "Failed to load tracklist or artist data.");
    } finally {
      setDataLoading(false);
    }
  }

  /* ─── Toasts ─── */

  function addToast(type: ToastMsg["type"], message: string) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  /* ─── Draft mutations ─── */

  const patchDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  }, []);

  async function handleSave() {
    if (!release) return;
    setIsSaving(true);
    const payload = {
      title: draft.title,
      release_type: draft.release_type || null,
      upc: draft.upc || null,
      release_date: draft.release_date || null,
      release_date_precision: draft.release_date_precision || null,
      label_id: draft.label_id || null,
      description: draft.description || null,
      artwork_url: draft.artwork_url || null,
      status: draft.status,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("registry_releases").update(payload).eq("id", release.id);
    setIsSaving(false);
    if (error) { addToast("error", `Save failed: ${error.message}`); return; }
    setRelease((prev) => (prev ? { ...prev, ...payload } : prev));
    setIsDirty(false);
    setEditOpen(false);
    addToast("success", "Release saved.");
  }

  async function handleDelete() {
    if (!release) return;
    const { error } = await supabase
      .from("registry_releases")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", release.id);
    if (error) { addToast("error", "Failed to archive release."); return; }
    addToast("info", "Release archived.");
    setTimeout(() => navigate("/admin/registry/releases"), 1000);
  }

  /* ─── Keyboard shortcuts ─── */

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editOpen && isDirty) handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, release, editOpen, isDirty]);

  /* ─── Relations ─── */

  const { relations, loading: relLoading } = useRelatedEntities("release", release?.slug);

  /* ─── Derived ─── */

  const primaryArtist = releaseArtists.find((ra) => ra.is_primary) || releaseArtists[0];
  const artistName = primaryArtist?.artist_name_text || (release?.metadata?.artist_name as string) || "Unknown";
  const artistSlug = primaryArtist?.artist_slug || "";
  const labelName = label?.name || "—";
  const labelSlug = label?.slug || "";

  const heroData: ReleaseHeroData | null = release ? {
    title: release.title,
    slug: release.slug,
    release_type: release.release_type,
    release_date: release.release_date,
    release_date_precision: release.release_date_precision,
    artwork_url: release.artwork_url,
    status: release.status,
    artist_name: artistName,
    artist_slug: artistSlug,
    label_name: labelName,
    label_slug: labelSlug,
  } : null;

  const totalDurationMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);

  /* ─── Loading ─── */

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-[200px] rounded-2xl bg-[var(--wk-surface-raised)]" />
        <div className="h-[400px] rounded-2xl bg-[var(--wk-surface-raised)]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]">
          <WkIcon name="FileX" size={28} />
        </div>
        <h2 className="text-[18px] font-bold text-[var(--wk-text)]">Release Not Found</h2>
        <p className="text-[13px] text-[var(--wk-text-muted)]">No release with slug &quot;{slug}&quot;</p>
        <button onClick={() => navigate("/admin/registry/releases")} className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} /> Back to Releases
        </button>
      </div>
    );
  }

  if (!release || !heroData) return null;

  /* ─── Render ─── */

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
        <button onClick={() => navigate("/admin/registry/releases")} className="text-[var(--wk-brand)] hover:text-[var(--wk-brand)]/80 font-black uppercase tracking-wider transition-colors cursor-pointer">
          Releases
        </button>
        <WkIcon name="ChevronRight" size={12} />
        <span className="font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] truncate max-w-[280px]">{draft.title || slug}</span>
      </div>

      {/* Hero */}
      <AdminReleaseHero
        release={heroData}
        trackCount={tracks.length}
        totalDurationMs={totalDurationMs}
        onToggleEdit={() => setEditOpen((v) => !v)}
        editOpen={editOpen}
      />

      {/* Rich data loading indicator */}
      {dataLoading && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-faint)]">
          <WkIcon name="Loader2" size={12} className="animate-spin" />
          Loading tracklist, artists, and relationships&hellip;
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          {/* Tracklist */}
          <AdminReleaseTracklist
            tracks={tracks}
            trackArtists={trackArtists}
            releaseArtistName={artistName}
          />

          {/* NLG Excerpt */}
          <AdminReleaseExcerpt
            title={release.title}
            artistName={artistName}
            releaseType={release.release_type}
            labelName={labelName}
            releaseDate={release.release_date}
            releaseDatePrecision={release.release_date_precision}
            tracks={tracks}
            trackArtists={trackArtists}
            description={release.description}
          />

          {/* Edit form (collapsible) */}
          {editOpen && (
            <div className="space-y-4">
              <WkSurface className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <WkIcon name="Edit3" size={14} className="text-[var(--wk-text-muted)]" />
                  <h3 className="text-[12px] font-extrabold uppercase tracking-wider text-[var(--wk-text-muted)]">Edit Release</h3>
                  {isDirty && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                      <WkIcon name="Circle" size={6} /> Unsaved
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Title</label>
                    <input type="text" value={draft.title} onChange={(e) => patchDraft({ title: e.target.value })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[15px] font-bold text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] transition-colors" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Type</label>
                      <select value={draft.release_type} onChange={(e) => patchDraft({ release_type: e.target.value })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] cursor-pointer">
                        <option value="">Select type</option>
                        <option value="album">Album</option>
                        <option value="single">Single</option>
                        <option value="ep">EP</option>
                        <option value="mixtape">Mixtape</option>
                        <option value="compilation">Compilation</option>
                        <option value="live">Live</option>
                        <option value="remix">Remix</option>
                        <option value="soundtrack">Soundtrack</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Status</label>
                      <select value={draft.status} onChange={(e) => patchDraft({ status: e.target.value })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] cursor-pointer">
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="needs_review">Needs Review</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Release Date</label>
                      <input type="date" value={draft.release_date} onChange={(e) => patchDraft({ release_date: e.target.value })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Date Precision</label>
                      <select value={draft.release_date_precision} onChange={(e) => patchDraft({ release_date_precision: e.target.value })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] cursor-pointer">
                        <option value="">Unknown</option>
                        <option value="day">Day</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">UPC</label>
                      <input type="text" value={draft.upc} onChange={(e) => patchDraft({ upc: e.target.value })} placeholder="UPC barcode" className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] font-mono" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Label ID</label>
                      <input type="text" value={draft.label_id} onChange={(e) => patchDraft({ label_id: e.target.value })} placeholder="UUID" className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] font-mono" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Description</label>
                    <textarea value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} placeholder="Release description..." rows={4} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] resize-none transition-colors" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">Artwork URL</label>
                    <div className="flex gap-3 items-start">
                      <input type="text" value={draft.artwork_url} onChange={(e) => patchDraft({ artwork_url: e.target.value })} placeholder="https://..." className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors" />
                      {draft.artwork_url && (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[var(--wk-border)]">
                          <img src={draft.artwork_url} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--wk-brand)] text-white px-5 py-2.5 text-[13px] font-bold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer disabled:opacity-60">
                      {isSaving ? <><WkIcon name="Loader2" size={14} className="animate-spin" /> Saving&hellip;</> : <><WkIcon name="Save" size={14} /> Save Changes</>}
                    </button>
                    <button onClick={() => { setEditOpen(false); setIsDirty(false); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              </WkSurface>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <AdminReleaseSidebar
          releaseId={release.id}
          slug={release.slug}
          normalizedTitle={release.normalized_title}
          upc={release.upc}
          createdAt={release.created_at}
          updatedAt={release.updated_at}
          labelName={labelName}
          labelSlug={labelSlug}
          labelId={release.label_id}
          metadata={release.metadata}
          relations={relations}
          relLoading={relLoading}
          onDelete={() => setShowDelete(true)}
        />
      </div>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <WkIcon name="Trash2" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Archive Release?</h3>
            <p className="text-[13px] text-[var(--wk-text-muted)] mb-5">This will set the release status to &quot;archived&quot;. You can restore it later.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap cursor-pointer">Cancel</button>
              <button onClick={() => { setShowDelete(false); handleDelete(); }} className="flex-1 rounded-lg bg-red-600 text-white px-4 py-2.5 text-[13px] font-bold hover:bg-red-700 transition-colors whitespace-nowrap cursor-pointer">Yes, Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
            toast.type === "success" ? "border-green-200 bg-green-50 text-green-700" :
            toast.type === "error" ? "border-red-200 bg-red-50 text-red-700" :
            "border-blue-200 bg-blue-50 text-blue-700"
          }`}>
            <WkIcon name={toast.type === "success" ? "CheckCircle2" : toast.type === "error" ? "XCircle" : "Info"} size={16} />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}