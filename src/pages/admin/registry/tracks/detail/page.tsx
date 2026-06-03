import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface TrackRecord {
  id: string;
  slug: string;
  title: string;
  normalized_title: string;
  isrc: string | null;
  release_id: string | null;
  duration_ms: number | null;
  explicit: boolean | null;
  track_number: number | null;
  disc_number: number | null;
  artwork_url: string | null;
  preview_url: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Draft {
  title: string;
  isrc: string;
  duration_ms: string;
  explicit: boolean;
  track_number: string;
  disc_number: string;
  artwork_url: string;
  preview_url: string;
  status: string;
}

interface ToastMsg {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

let toastCounter = 0;

export default function TrackDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [track, setTrack] = useState<TrackRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [draft, setDraft] = useState<Draft>({
    title: "",
    isrc: "",
    duration_ms: "",
    explicit: false,
    track_number: "",
    disc_number: "",
    artwork_url: "",
    preview_url: "",
    status: "draft",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("registry_tracks")
        .select("id, slug, title, normalized_title, isrc, release_id, duration_ms, explicit, track_number, disc_number, artwork_url, preview_url, status, metadata, created_at, updated_at")
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        addToast("error", "Failed to load track.");
        setLoading(false);
        return;
      }
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTrack(data);
      setDraft({
        title: data.title,
        isrc: data.isrc ?? "",
        duration_ms: data.duration_ms?.toString() ?? "",
        explicit: data.explicit ?? false,
        track_number: data.track_number?.toString() ?? "",
        disc_number: data.disc_number?.toString() ?? "",
        artwork_url: data.artwork_url ?? "",
        preview_url: data.preview_url ?? "",
        status: data.status,
      });
      setIsDirty(false);
      setLoading(false);
    }
    load();
  }, [slug]);

  function addToast(type: ToastMsg["type"], message: string) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const patchDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  }, []);

  async function handleSave() {
    if (!track) return;
    setIsSaving(true);
    const payload = {
      title: draft.title,
      isrc: draft.isrc || null,
      duration_ms: draft.duration_ms ? parseInt(draft.duration_ms, 10) : null,
      explicit: draft.explicit,
      track_number: draft.track_number ? parseInt(draft.track_number, 10) : null,
      disc_number: draft.disc_number ? parseInt(draft.disc_number, 10) : null,
      artwork_url: draft.artwork_url || null,
      preview_url: draft.preview_url || null,
      status: draft.status,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("registry_tracks").update(payload).eq("id", track.id);
    setIsSaving(false);
    if (error) {
      addToast("error", `Save failed: ${error.message}`);
      return;
    }
    setTrack((prev) => (prev ? { ...prev, ...payload } : prev));
    setIsDirty(false);
    addToast("success", "Track saved.");
  }

  async function handleDelete() {
    if (!track) return;
    const { error } = await supabase
      .from("registry_tracks")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", track.id);
    if (error) {
      addToast("error", "Failed to archive track.");
      return;
    }
    addToast("info", "Track archived.");
    setTimeout(() => navigate("/admin/registry/tracks"), 1000);
  }

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
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, track]);

  function formatDuration(ms: number | null) {
    if (!ms) return "—";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 w-72 rounded-xl bg-wk-surface-raised" />
        <div className="h-[400px] rounded-xl bg-wk-surface-raised" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-surface-raised text-wk-text-faint">
          <WkIcon name="FileX" size={28} />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text">Track Not Found</h2>
        <p className="text-[13px] text-wk-text-muted">No track with slug &quot;{slug}&quot;</p>
        <button onClick={() => navigate("/admin/registry/tracks")} className="wk-button wk-button-secondary wk-button-sm">
          <WkIcon name="ArrowLeft" size={14} /> Back to Tracks
        </button>
      </div>
    );
  }

  if (!track) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-wk-text-faint mb-1.5">
            <button onClick={() => navigate("/admin/registry/tracks")} className="text-wk-brand hover:text-wk-brand-hover font-black uppercase tracking-wider transition-colors">Tracks</button>
            <WkIcon name="ChevronRight" size={12} />
            <span className="font-semibold uppercase tracking-wider text-wk-text-muted truncate max-w-[200px]">{draft.title || slug}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-black tracking-tight text-wk-text truncate max-w-[480px]">{draft.title || "(Untitled)"}</h1>
            <StatusBadge status={draft.status} />
            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2.5 py-0.5 text-[10px] font-bold text-wk-warning">
                <WkIcon name="Circle" size={6} /> Unsaved
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-wk-text-faint font-mono">{track.slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button onClick={() => setShowDelete(true)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger hover:bg-wk-danger-soft hover:border-wk-danger/20">
            <WkIcon name="Trash2" size={14} />
          </button>
          <div className="h-6 w-px bg-wk-border" />
          <button onClick={handleSave} disabled={isSaving} className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap">
            {isSaving ? <><WkIcon name="Loader2" size={14} className="animate-spin" /> Saving&hellip;</> : <><WkIcon name="Save" size={14} /> Save</>}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-wk-text-faint">
        <WkIcon name="Command" size={11} /> <span>+S to save</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Title</label>
            <input type="text" value={draft.title} onChange={(e) => patchDraft({ title: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[16px] font-bold text-wk-text outline-none focus:border-wk-brand transition-colors" />
          </WkSurface>

          <WkSurface className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">ISRC</label>
                <input type="text" value={draft.isrc} onChange={(e) => patchDraft({ isrc: e.target.value })} placeholder="ISRC code" className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand font-mono uppercase" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Status</label>
                <select value={draft.status} onChange={(e) => patchDraft({ status: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand cursor-pointer">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Duration (ms)</label>
                <input type="number" value={draft.duration_ms} onChange={(e) => patchDraft({ duration_ms: e.target.value })} placeholder="e.g. 215000" className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Duration</label>
                <div className="text-[13px] text-wk-text-muted py-2.5">{formatDuration(draft.duration_ms ? parseInt(draft.duration_ms, 10) : null)}</div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Track #</label>
                <input type="number" value={draft.track_number} onChange={(e) => patchDraft({ track_number: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Disc #</label>
                <input type="number" value={draft.disc_number} onChange={(e) => patchDraft({ disc_number: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="flex items-center gap-2 text-[13px] text-wk-text cursor-pointer">
                  <input type="checkbox" checked={draft.explicit} onChange={(e) => patchDraft({ explicit: e.target.checked })} className="h-4 w-4 rounded border-wk-border accent-wk-brand" />
                  Explicit content
                </label>
              </div>
            </div>
          </WkSurface>

          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Artwork URL</label>
            <input type="text" value={draft.artwork_url} onChange={(e) => patchDraft({ artwork_url: e.target.value })} placeholder="https://..." className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors" />
            {draft.artwork_url && (
              <div className="mt-3 h-48 w-48 overflow-hidden rounded-lg border border-wk-border">
                <img src={draft.artwork_url} alt="Preview" className="h-full w-full object-cover" />
              </div>
            )}
          </WkSurface>

          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Preview URL</label>
            <input type="text" value={draft.preview_url} onChange={(e) => patchDraft({ preview_url: e.target.value })} placeholder="https://..." className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand transition-colors" />
            {draft.preview_url && (
              <div className="mt-3">
                <audio controls src={draft.preview_url} className="w-full h-10" />
              </div>
            )}
          </WkSurface>
        </div>

        <div className="space-y-4">
          <WkSurface className="p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">Record Info</h3>
            <div className="space-y-2">
              <InfoRow label="Slug" value={track.slug} mono />
              <InfoRow label="Normalized" value={track.normalized_title} />
              <InfoRow label="Release ID" value={track.release_id ?? "—"} mono />
              <InfoRow label="Created" value={new Date(track.created_at).toLocaleString()} />
              <InfoRow label="Modified" value={new Date(track.updated_at).toLocaleString()} />
            </div>
          </WkSurface>
        </div>
      </div>

      {/* Delete */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
              <WkIcon name="Trash2" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">Archive Track?</h3>
            <p className="text-[13px] text-wk-text-muted mb-5">This will set the track status to &quot;archived&quot;. You can restore it later.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap">Cancel</button>
              <button onClick={() => { setShowDelete(false); handleDelete(); }} className="wk-button wk-button-sm flex-1 whitespace-nowrap bg-wk-danger text-white hover:opacity-90 border border-wk-danger">Yes, Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
            toast.type === "success" ? "border-wk-success/20 bg-wk-success-soft text-wk-success" : toast.type === "error" ? "border-wk-danger/20 bg-wk-danger-soft text-wk-danger" : "border-wk-info/20 bg-wk-info-soft text-wk-info"
          }`}>
            <WkIcon name={toast.type === "success" ? "CheckCircle2" : toast.type === "error" ? "XCircle" : "Info"} size={16} />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "active" ? "bg-wk-success-soft text-wk-success" : status === "draft" ? "bg-wk-warning-soft text-wk-warning" : status === "needs_review" ? "bg-wk-danger-soft text-wk-danger" : "bg-wk-surface-raised text-wk-text-muted";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${color}`}>{status.replace("_", " ")}</span>;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] font-semibold text-wk-text-faint shrink-0">{label}</span>
      <span className={`text-right text-[11px] text-wk-text-soft truncate max-w-[160px] ${mono ? "font-mono" : ""}`} title={value}>{value}</span>
    </div>
  );
}