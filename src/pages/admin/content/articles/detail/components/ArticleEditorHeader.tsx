import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";

interface Props {
  slug: string;
  title: string | null;
  status: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  isPreviewing: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onPreview: () => void;
  userCanPublish?: boolean;
  userCanEditOthers?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  publish: "bg-wk-success-soft text-wk-success",
  draft: "bg-wk-warning-soft text-wk-warning",
  pending: "bg-wk-info-soft text-wk-info",
  future: "bg-wk-brand-soft text-wk-brand",
  private: "bg-wk-surface-raised text-wk-text-muted",
  trash: "bg-wk-danger-soft text-wk-danger",
};

export function ArticleEditorHeader({
  slug,
  title,
  status,
  isDirty,
  isSaving,
  isPublishing,
  isPreviewing,
  onSaveDraft,
  onPublish,
  onUnpublish,
  onDelete,
  onPreview,
  userCanPublish = true,
  userCanEditOthers = true,
}: Props) {
  const navigate = useNavigate();
  const statusColor = status ? (STATUS_COLORS[status] ?? STATUS_COLORS.draft) : STATUS_COLORS.draft;
  const isPublished = status === "publish";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      {/* Left: breadcrumb + title */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-wk-text-faint mb-1.5">
          <button
            onClick={() => navigate("/admin/content/articles")}
            className="text-wk-brand hover:text-wk-brand-hover font-black uppercase tracking-wider transition-colors"
          >
            Articles
          </button>
          <WkIcon name="ChevronRight" size={12} />
          <span className="font-semibold uppercase tracking-wider text-wk-text-muted truncate max-w-[200px]">
            {title || slug}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-black tracking-tight text-wk-text truncate max-w-[480px]">
            {title || "(Untitled)"}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusColor}`}
          >
            {status || "draft"}
          </span>
          {isDirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2.5 py-0.5 text-[10px] font-bold text-wk-warning">
              <WkIcon name="Circle" size={6} />
              Unsaved
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-wk-text-faint font-mono">{slug}</p>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* View live */}
        {isPublished && (
          <a
            href={`/magazine/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="ExternalLink" size={14} />
            View Live
          </a>
        )}

        {/* Preview (for drafts) */}
        {!isPublished && (
          <button
            onClick={onPreview}
            disabled={isPreviewing || isSaving}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
          >
            {isPreviewing ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Previewing…
              </>
            ) : (
              <>
                <WkIcon name="Eye" size={14} />
                Preview
              </>
            )}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={onDelete}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger hover:bg-wk-danger-soft hover:border-wk-danger/20"
        >
          <WkIcon name="Trash2" size={14} />
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-wk-border" />

        {/* Save Draft */}
        <button
          onClick={onSaveDraft}
          disabled={isSaving || isPublishing}
          className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
        >
          {isSaving ? (
            <>
              <WkIcon name="Loader2" size={14} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <WkIcon name="Save" size={14} />
              Save Draft
            </>
          )}
        </button>

        {/* Publish / Unpublish / Submit */}
        {isPublished ? (
          userCanPublish ? (
            <button
              onClick={onUnpublish}
              disabled={isSaving || isPublishing}
              className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="EyeOff" size={14} />
              Unpublish
            </button>
          ) : null
        ) : userCanPublish ? (
          <button
            onClick={onPublish}
            disabled={isSaving || isPublishing}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            {isPublishing ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <WkIcon name="Globe" size={14} />
                Publish
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onSaveDraft}
            disabled={isSaving}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Send" size={14} />
            Submit for Review
          </button>
        )}
      </div>
    </div>
  );
}