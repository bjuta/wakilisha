import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import { useRelatedEntities } from "@/hooks/useRelatedEntities";
import type { ResolvedRelation } from "@/hooks/useRelatedEntities";

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
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
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

export default function ReleaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [release, setRelease] = useState<ReleaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("registry_releases")
        .select("id, slug, title, normalized_title, release_type, upc, release_date, release_date_precision, label_id, artwork_url, description, status, metadata, created_at, updated_at")
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        addToast("error", "Failed to load release.");
        setLoading(false);
        return;
      }
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
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
    if (error) {
      addToast("error", `Save failed: ${error.message}`);
      return;
    }
    setRelease((prev) => (prev ? { ...prev, ...payload } : prev));
    setIsDirty(false);
    addToast("success", "Release saved.");
  }

  async function handleDelete() {
    if (!release) return;
    const { error } = await supabase
      .from("registry_releases")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", release.id);
    if (error) {
      addToast("error", "Failed to archive release.");
      return;
    }
    addToast("info", "Release archived.");
    setTimeout(() => navigate("/admin/registry/releases"), 1000);
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
  }, [draft, release]);

  const { relations, loading: relLoading } = useRelatedEntities("release", slug);
  const groupedRelations = useMemo(() => {
    const groups: Record<string, ResolvedRelation[]> = {};
    for (const r of relations) {
      if (!groups[r.entity_type]) groups[r.entity_type] = [];
      groups[r.entity_type].push(r);
    }
    return groups;
  }, [relations]);

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
        <h2 className="text-[18px] font-bold text-wk-text">Release Not Found</h2>
        <p className="text-[13px] text-wk-text-muted">No release with slug &quot;{slug}&quot;</p>
        <button onClick={() => navigate("/admin/registry/releases")} className="wk-button wk-button-secondary wk-button-sm">
          <WkIcon name="ArrowLeft" size={14} /> Back to Releases
        </button>
      </div>
    );
  }

  if (!release) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-wk-text-faint mb-1.5">
            <button onClick={() => navigate("/admin/registry/releases")} className="text-wk-brand hover:text-wk-brand-hover font-black uppercase tracking-wider transition-colors">Releases</button>
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
          <p className="mt-1 text-[12px] text-wk-text-faint font-mono">{release.slug}</p>
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Release Type</label>
                <select value={draft.release_type} onChange={(e) => patchDraft({ release_type: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand cursor-pointer">
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Status</label>
                <select value={draft.status} onChange={(e) => patchDraft({ status: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand cursor-pointer">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">UPC</label>
                <input type="text" value={draft.upc} onChange={(e) => patchDraft({ upc: e.target.value })} placeholder="UPC barcode" className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand font-mono" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Release Date</label>
                <input type="date" value={draft.release_date} onChange={(e) => patchDraft({ release_date: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand cursor-pointer" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Date Precision</label>
                <select value={draft.release_date_precision} onChange={(e) => patchDraft({ release_date_precision: e.target.value })} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand cursor-pointer">
                  <option value="">Unknown</option>
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Label ID</label>
                <input type="text" value={draft.label_id} onChange={(e) => patchDraft({ label_id: e.target.value })} placeholder="UUID" className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand font-mono" />
              </div>
            </div>
          </WkSurface>

          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Description</label>
            <textarea value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} placeholder="Release description..." rows={6} className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand resize-none transition-colors" />
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
        </div>

        <div className="space-y-4">
          <WkSurface className="p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">Record Info</h3>
            <div className="space-y-2">
              <InfoRow label="Slug" value={release.slug} mono />
              <InfoRow label="Normalized" value={release.normalized_title} />
              <InfoRow label="Created" value={new Date(release.created_at).toLocaleString()} />
              <InfoRow label="Modified" value={new Date(release.updated_at).toLocaleString()} />
            </div>
          </WkSurface>

          <RelatedPanel
            grouped={groupedRelations}
            loading={relLoading}
            entityLabel="release"
          />
        </div>
      </div>

      {/* Delete */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
              <WkIcon name="Trash2" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">Archive Release?</h3>
            <p className="text-[13px] text-wk-text-muted mb-5">This will set the release status to &quot;archived&quot;. You can restore it later.</p>
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

/* ─── Related Entities Panel ─── */

const ENTITY_LABELS: Record<string, string> = {
  artist: "Artists",
  track: "Tracks",
  release: "Releases",
  genre: "Genres",
  label: "Labels",
};

const ENTITY_ICONS: Record<string, string> = {
  artist: "UserVoice",
  track: "Music",
  release: "Album",
  genre: "PriceTag3",
  label: "Building",
};

function RelatedPanel({
  grouped,
  loading,
  entityLabel,
}: {
  grouped: Record<string, ResolvedRelation[]>;
  loading: boolean;
  entityLabel: string;
}) {
  const navigate = useNavigate();
  const types = Object.keys(grouped);

  if (loading) {
    return (
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">Related</h3>
        <div className="space-y-2 animate-pulse">
          <div className="h-5 w-full rounded bg-wk-surface-raised" />
          <div className="h-5 w-3/4 rounded bg-wk-surface-raised" />
          <div className="h-5 w-1/2 rounded bg-wk-surface-raised" />
        </div>
      </WkSurface>
    );
  }

  if (types.length === 0) {
    return (
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-2">Related</h3>
        <p className="text-[11px] text-wk-text-faint italic">
          No linked {entityLabel}s, tracks, releases, genres, or labels yet.
        </p>
      </WkSurface>
    );
  }

  return (
    <WkSurface className="p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
        Related
      </h3>
      <div className="space-y-3">
        {types.map((type) => {
          const items = grouped[type];
          const label = ENTITY_LABELS[type] || type;
          const icon = ENTITY_ICONS[type] || "Link";
          return (
            <div key={type}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <WkIcon name={icon} size={11} className="text-wk-text-faint" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">
                  {label}
                </span>
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold bg-wk-surface-raised text-wk-text-faint">
                  {items.length}
                </span>
              </div>
              <div className="space-y-1">
                {items.slice(0, 8).map((rel, i) => (
                  <button
                    key={`${rel.entity_type}-${rel.slug}-${i}`}
                    onClick={() => navigate(`/admin/registry/${rel.entity_type}s/${rel.slug}`)}
                    className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-wk-text hover:bg-wk-surface-raised transition-colors group cursor-pointer"
                  >
                    <span className="truncate flex-1 font-medium group-hover:text-wk-brand transition-colors">
                      {rel.display_name}
                    </span>
                    <span className="text-[10px] text-wk-text-faint shrink-0 uppercase font-mono tracking-tight">
                      {rel.relationship_type.replace(/_/g, " ")}
                    </span>
                  </button>
                ))}
                {items.length > 8 && (
                  <p className="text-[10px] text-wk-text-faint px-2">
                    +{items.length - 8} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </WkSurface>
  );
}