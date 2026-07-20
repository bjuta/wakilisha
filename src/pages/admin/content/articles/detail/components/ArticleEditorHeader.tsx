import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";

interface Props {
  slug: string;
  title: string | null;
  status: string | null;
  statusLabel?: string;
  statusColorKey?: string;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  isPreviewing: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onSubmitForReview: () => void;
  onRequestChanges?: () => void;
  onApproveVersion?: () => void;
  allowSubmitForReview?: boolean;
  canSubmitForReview?: boolean;
  canRequestChanges?: boolean;
  canApproveVersion?: boolean;
  reviewActionBusy?: boolean;
  publishDisabledReason?: string | null;
  submitForReviewLabel?: string;
  userCanPublish?: boolean;
  userCanEditOthers?: boolean;
  isAdmin?: boolean;
  articleOwner?: string | null;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
    canPublish: boolean;
    reason: string | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  publish: "bg-wk-success-soft text-wk-success",
  draft: "bg-wk-warning-soft text-wk-warning",
  pending: "bg-wk-info-soft text-wk-info",
  approved: "bg-wk-success-soft text-wk-success",
  changes_requested: "bg-wk-warning-soft text-wk-warning",
  future: "bg-wk-brand-soft text-wk-brand",
  private: "bg-wk-surface-raised text-wk-text-muted",
  trash: "bg-wk-danger-soft text-wk-danger",
};

export function ArticleEditorHeader({
  slug,
  title,
  status,
  statusLabel,
  statusColorKey,
  isDirty,
  isSaving,
  isPublishing,
  isPreviewing,
  onSaveDraft,
  onPublish,
  onUnpublish,
  onDelete,
  onPreview,
  onSubmitForReview,
  onRequestChanges,
  onApproveVersion,
  allowSubmitForReview = true,
  canSubmitForReview = allowSubmitForReview,
  canRequestChanges = false,
  canApproveVersion = false,
  reviewActionBusy = false,
  publishDisabledReason = null,
  submitForReviewLabel = "Submit for Review",
  userCanPublish = true,
  userCanEditOthers = true,
  isAdmin = false,
  articleOwner = null,
  permissions,
}: Props) {
  const navigate = useNavigate();
  const resolvedStatusColorKey = statusColorKey ?? status ?? "draft";
  const statusColor =
    STATUS_COLORS[resolvedStatusColorKey] ?? STATUS_COLORS.draft;
  const isPublished = status === "publish";
  const isFuture = status === "future";
  const shouldShowSubmitForReview = !isPublished && !isFuture && canSubmitForReview;
  const shouldShowPublish = userCanPublish && !publishDisabledReason;

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
            {statusLabel ?? status ?? "Draft"}
          </span>
          {isDirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2.5 py-0.5 text-[10px] font-bold text-wk-warning">
              <WkIcon name="Circle" size={6} />
              Unsaved
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2.5 py-0.5 text-[10px] font-bold text-wk-brand">
              <WkIcon name="Shield" size={10} />
              Admin
            </span>
          )}
          {permissions && !permissions.canEdit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2.5 py-0.5 text-[10px] font-bold text-wk-warning">
              <WkIcon name="Eye" size={10} />
              Read-only
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-wk-text-faint">
          <span className="font-mono">{slug}</span>
          {isAdmin && articleOwner && (
            <>
              <span className="text-wk-border">|</span>
              <span>Owner: {articleOwner}</span>
            </>
          )}
        </div>
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
        {(!permissions || permissions.canDelete) && (
        <button
          onClick={onDelete}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger hover:bg-wk-danger-soft hover:border-wk-danger/20"
        >
          <WkIcon name="Trash2" size={14} />
        </button>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-wk-border" />

        {/* Save Draft */}
        {(!permissions || permissions.canEdit) && (
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
        )}

        {/* Review / Publish / Unpublish / Submit */}
        {canRequestChanges ? (
          <button
            onClick={onRequestChanges}
            disabled={isSaving || isPublishing || reviewActionBusy}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Flag" size={14} />
            Request Changes
          </button>
        ) : null}

        {canApproveVersion ? (
          <button
            onClick={onApproveVersion}
            disabled={isSaving || isPublishing || reviewActionBusy}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Shield" size={14} />
            Approve Version
          </button>
        ) : null}

        {!canRequestChanges && !canApproveVersion && shouldShowSubmitForReview ? (
          <button
            onClick={onSubmitForReview}
            disabled={isSaving || reviewActionBusy}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Send" size={14} />
            {submitForReviewLabel}
          </button>
        ) : null}

        {!canRequestChanges && !canApproveVersion && !shouldShowSubmitForReview && isPublished && shouldShowPublish ? (
          <button
            onClick={onPublish}
            disabled={isSaving || isPublishing}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            {isPublishing ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Updating…
              </>
            ) : (
              <>
                <WkIcon name="RefreshCw" size={14} />
                Update
              </>
            )}
          </button>
        ) : null}

        {!canRequestChanges && !canApproveVersion && !shouldShowSubmitForReview && isFuture ? (
          <button
            onClick={onUnpublish}
            disabled={isSaving || isPublishing}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="EyeOff" size={14} />
            Unschedule
          </button>
        ) : null}

        {!canRequestChanges && !canApproveVersion && !shouldShowSubmitForReview && !isPublished && !isFuture && shouldShowPublish ? (
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
        ) : null}

        {!canRequestChanges && !canApproveVersion && !shouldShowSubmitForReview && publishDisabledReason ? (
          <span className="rounded-lg border border-wk-warning/30 bg-wk-warning-soft px-3 py-2 text-[11px] font-bold text-wk-text-muted">
            {publishDisabledReason}
          </span>
        ) : null}
      </div>
    </div>
  );
}