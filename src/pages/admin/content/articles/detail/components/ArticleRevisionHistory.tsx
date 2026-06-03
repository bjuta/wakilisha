import { useState, useEffect } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

/* ─── Types ─── */

interface Revision {
  id: string;
  revision_number: number;
  created_at: string;
  created_by: string;
  title: string | null;
  content_html: string | null;
  excerpt: string | null;
  author: string | null;
  categories: string[] | null;
  tags: string[] | null;
  seo: Record<string, unknown> | null;
  wp_status: string | null;
  published_at: string | null;
}

interface RestorePayload {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  categories: string[];
  tags: string[];
  seo: Record<string, unknown>;
  publishedAt: string;
  wpStatus: string | null;
}

/* ─── Component ─── */

interface Props {
  articleId: string;
  currentStatus: string | null;
  currentTitle: string;
  onRestore?: (payload: RestorePayload) => void;
}

export function ArticleRevisionHistory({ articleId, currentStatus, currentTitle, onRestore }: Props) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRev, setExpandedRev] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<Revision | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("wk_article_revisions")
        .select("id, revision_number, created_at, created_by, title, content_html, excerpt, author, categories, tags, seo, wp_status, published_at")
        .eq("article_id", articleId)
        .order("revision_number", { ascending: false })
        .limit(20);

      if (error) {
        setRevisions([]);
      } else {
        setRevisions(data || []);
      }
      setLoading(false);
    }
    load();
  }, [articleId]);

  if (loading) {
    return (
      <WkSurface className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse h-10 rounded-lg bg-[var(--wk-surface-raised)]" />
          ))}
        </div>
      </WkSurface>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="text-center py-4">
        <WkIcon name="History" size={20} className="text-[var(--wk-text-faint)] mx-auto mb-2" />
        <p className="text-[12px] text-[var(--wk-text-muted)]">No revisions yet.</p>
        <p className="text-[11px] text-[var(--wk-text-faint)] mt-1">Auto-saves appear here every 10 seconds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {revisions.map((rev) => {
        const isExpanded = expandedRev === rev.id;
        const isCurrent = rev.revision_number === Math.max(...revisions.map((r) => r.revision_number));
        const isAutosave = rev.created_by === "System" || rev.created_by === "autosave";

        return (
          <WkSurface
            key={rev.id}
            className={`overflow-hidden transition-all ${isExpanded ? "border-[var(--wk-brand)]/30" : ""}`}
          >
            <button
              onClick={() => setExpandedRev(isExpanded ? null : rev.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--wk-surface-raised)] transition-colors"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isAutosave ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}>
                <WkIcon name={isAutosave ? "Save" : "GitCommit"} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[var(--wk-text)]">
                    {isCurrent ? "Current" : `v${rev.revision_number}`}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                      Latest
                    </span>
                  )}
                  {isAutosave && (
                    <span className="inline-flex items-center rounded-full bg-[var(--wk-info-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-info)]">
                      Auto-saved
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--wk-text-muted)]">
                    by {rev.created_by || "System"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mt-0.5">
                  <span>{new Date(rev.created_at).toLocaleString()}</span>
                  <span>·</span>
                  <span className="uppercase">{rev.wp_status || "draft"}</span>
                </div>
              </div>
              <WkIcon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} className="text-[var(--wk-text-faint)]" />
            </button>

            {isExpanded && (
              <div className="border-t border-[var(--wk-border)] px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase">Title</span>
                    <p className="text-[var(--wk-text)] mt-0.5 truncate">{rev.title || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase">Author</span>
                    <p className="text-[var(--wk-text)] mt-0.5">{rev.author || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase">Status</span>
                    <p className="text-[var(--wk-text)] mt-0.5 uppercase">{rev.wp_status || "draft"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase">Published</span>
                    <p className="text-[var(--wk-text)] mt-0.5">
                      {rev.published_at ? new Date(rev.published_at).toLocaleString() : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase">Excerpt</span>
                  <p className="text-[12px] text-[var(--wk-text)] mt-0.5">{rev.excerpt || "—"}</p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase">Content</span>
                  <div className="mt-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3 max-h-[200px] overflow-y-auto">
                    <div
                      className="text-[12px] text-[var(--wk-text-soft)] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: rev.content_html || "<p>—</p>" }}
                    />
                  </div>
                </div>

                {!isCurrent && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConfirm(rev)}
                      className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
                    >
                      <WkIcon name="RotateCcw" size={14} />
                      Restore This Version
                    </button>
                  </div>
                )}
              </div>
            )}
          </WkSurface>
        );
      })}

      {/* Confirm restore modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">
              <WkIcon name="RotateCcw" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Restore Version?</h3>
            <p className="text-[13px] text-[var(--wk-text-muted)] mb-5">
              This will overwrite the current article with version {showConfirm.revision_number} from{" "}
              {new Date(showConfirm.created_at).toLocaleString()}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const payload: RestorePayload = {
                    title: showConfirm.title || "",
                    excerpt: showConfirm.excerpt || "",
                    content: showConfirm.content_html || "",
                    author: showConfirm.author || "",
                    categories: Array.isArray(showConfirm.categories) ? showConfirm.categories : [],
                    tags: Array.isArray(showConfirm.tags) ? showConfirm.tags : [],
                    seo: (showConfirm.seo as Record<string, unknown>) || {},
                    publishedAt: showConfirm.published_at || "",
                    wpStatus: showConfirm.wp_status,
                  };
                  onRestore?.(payload);
                  setShowConfirm(null);
                }}
                className="wk-button wk-button-sm flex-1 whitespace-nowrap bg-[var(--wk-warning)] text-[var(--wk-brand-on)] hover:opacity-90 border border-[var(--wk-warning)]"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}