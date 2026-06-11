import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  listTrashedArticles,
  restoreArticle,
  permanentlyDeleteArticle,
  type TrashedArticle,
} from "@/services/articles/articleAdminService";

let toastCounter = 0;

export default function AdminTrashPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<TrashedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: number; type: "success" | "error" | "info"; message: string }>>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<TrashedArticle | null>(null);

  function addToast(type: "success" | "error" | "info", message: string) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    const data = await listTrashedArticles();
    setArticles(data);
    setLoading(false);
  }

  async function handleRestore(article: TrashedArticle) {
    setRestoringId(article.id);
    const result = await restoreArticle(article.id);
    setRestoringId(null);

    if (result.ok) {
      addToast("success", `"${article.title}" restored as draft.`);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } else {
      addToast("error", result.error ?? "Failed to restore article.");
    }
  }

  async function handlePermanentDelete(article: TrashedArticle) {
    setDeletingId(article.id);
    const result = await permanentlyDeleteArticle(article.id);
    setDeletingId(null);
    setShowDeleteConfirm(null);

    if (result.ok) {
      addToast("info", `"${article.title}" permanently deleted.`);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } else {
      addToast("error", result.error ?? "Failed to delete article.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-wk-text-faint mb-1.5">
            <button
              onClick={() => navigate("/admin/content/articles")}
              className="text-wk-brand hover:text-wk-brand-hover font-black uppercase tracking-wider transition-colors"
            >
              Articles
            </button>
            <WkIcon name="ChevronRight" size={12} />
            <span className="font-semibold uppercase tracking-wider text-wk-text-muted">Trash</span>
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Trash</h1>
          <p className="text-[12px] text-wk-text-muted mt-1">
            Articles in trash for 30+ days may be auto-purged. Restore them to move back to drafts.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/content/articles")}
          className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="ArrowLeft" size={14} />
          Back to Articles
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse h-16 rounded-xl bg-wk-surface-raised" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <WkSurface className="p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-surface-raised text-wk-text-faint mx-auto mb-4">
            <WkIcon name="Trash2" size={28} />
          </div>
          <h3 className="text-[15px] font-bold text-wk-text mb-1">Trash is Empty</h3>
          <p className="text-[12px] text-wk-text-muted">No articles have been trashed yet.</p>
        </WkSurface>
      ) : (
        <WkSurface className="overflow-hidden">
          <div className="divide-y divide-wk-border">
            {articles.map((article) => (
              <div
                key={article.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-wk-surface-raised/50 transition-colors"
              >
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
                  <WkIcon name="Trash2" size={18} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-wk-text truncate">
                    {article.title || "(Untitled)"}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-wk-text-faint mt-0.5">
                    <span className="flex items-center gap-1">
                      <WkIcon name="User" size={10} />
                      {article.author || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                      <WkIcon name="Link" size={10} />
                      <span className="font-mono">/{article.slug}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <WkIcon name="Clock" size={10} />
                      Trashed {article.trashedAt ? new Date(article.trashedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(article)}
                    disabled={restoringId === article.id || deletingId === article.id}
                    className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
                  >
                    {restoringId === article.id ? (
                      <><i className="ri-loader-4-line animate-spin text-[13px]" /> Restoring…</>
                    ) : (
                      <><WkIcon name="RotateCcw" size={13} /> Restore</>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(article)}
                    disabled={restoringId === article.id || deletingId === article.id}
                    className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger hover:bg-wk-danger-soft hover:border-wk-danger/20"
                  >
                    {deletingId === article.id ? (
                      <><i className="ri-loader-4-line animate-spin text-[13px]" /></>
                    ) : (
                      <><WkIcon name="Trash2" size={13} /> Delete Permanently</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Permanent Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-wk-danger/30 bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
              <WkIcon name="AlertTriangle" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">Permanently Delete?</h3>
            <p className="text-[13px] text-wk-text-muted mb-1">
              This will <strong className="text-wk-danger">permanently delete</strong> &quot;{showDeleteConfirm.title}&quot;
              and all its revision history. This action <strong>cannot be undone</strong>.
            </p>
            <p className="text-[12px] text-wk-text-soft bg-wk-bg-subtle rounded-lg px-3 py-2 mb-5 border border-wk-border/50">
              Slug redirects associated with this article will also be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePermanentDelete(showDeleteConfirm)}
                className="wk-button wk-button-sm flex-1 whitespace-nowrap bg-wk-danger text-white hover:opacity-90 border border-wk-danger"
              >
                <WkIcon name="Trash2" size={14} />
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
              toast.type === "success"
                ? "border-wk-success/20 bg-wk-success-soft text-wk-success"
                : toast.type === "error"
                  ? "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"
                  : "border-wk-info/20 bg-wk-info-soft text-wk-info"
            }`}
          >
            <WkIcon
              name={toast.type === "success" ? "CheckCircle2" : toast.type === "error" ? "XCircle" : "Info"}
              size={16}
            />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}