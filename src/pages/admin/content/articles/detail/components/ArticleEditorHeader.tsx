import { useEffect, useRef, useState } from "react";
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
  lastAutosavedAt?: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onPreview: () => void | Promise<void>;
  onOpenArticleDetails?: () => void;
  showArticleDetails?: boolean;
  articleDetailsOpen?: boolean;
  draftActionsDisabled?: boolean;
  documentModeLabel?: string | null;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
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
  lastAutosavedAt = null,
  onSaveDraft,
  onPublish,
  onUnpublish,
  onDelete,
  onPreview,
  onOpenArticleDetails,
  showArticleDetails = false,
  articleDetailsOpen = false,
  draftActionsDisabled = false,
  documentModeLabel = null,
  focusMode = false,
  onToggleFocusMode,
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
  isAdmin = false,
  articleOwner = null,
  permissions,
}: Props) {
  const navigate = useNavigate();
  const overflowRef = useRef<HTMLDivElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const resolvedStatusColorKey = statusColorKey ?? status ?? "draft";
  const statusColor =
    STATUS_COLORS[resolvedStatusColorKey] ?? STATUS_COLORS.draft;

  const isPublished = status === "publish";
  const isFuture = status === "future";
  const shouldShowSubmitForReview =
    !isPublished && !isFuture && canSubmitForReview;
  const shouldShowPublish = userCanPublish && !publishDisabledReason;
  const canEdit =
    (!permissions || permissions.canEdit) &&
    !draftActionsDisabled;
  const canManagePublication =
    !permissions || permissions.canPublish;

  const canDeleteArticle =
    (!permissions || permissions.canDelete) &&
    !draftActionsDisabled;

  const hasOverflowActions =
    isPublished ||
    (
      isFuture &&
      canManagePublication
    ) ||
    canDeleteArticle;


  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(event.target as Node)
      ) {
        setOverflowOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOverflowOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const saveStateLabel = isSaving
    ? "Saving"
    : isDirty
      ? "Unsaved"
      : "All Saved";

  const saveStateTone = isSaving
    ? "border-wk-info/30 bg-wk-info-soft text-wk-info"
    : isDirty
      ? "border-wk-warning/30 bg-wk-warning-soft text-wk-warning"
      : "border-wk-success/30 bg-wk-success-soft text-wk-success";

  const displayedSaveStateLabel =
    draftActionsDisabled
      ? documentModeLabel || "Submitted Version"
      : saveStateLabel;

  const displayedSaveStateTone =
    draftActionsDisabled
      ? "border-wk-info/30 bg-wk-info-soft text-wk-info"
      : saveStateTone;

  function renderPrimaryAction() {
    if (canApproveVersion) {
      return (
        <button
          type="button"
          onClick={onApproveVersion}
          disabled={isSaving || isPublishing || reviewActionBusy}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="ShieldCheck" size={14} />
          Approve Version
        </button>
      );
    }

    if (canRequestChanges) {
      return (
        <button
          type="button"
          onClick={onRequestChanges}
          disabled={isSaving || isPublishing || reviewActionBusy}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Flag" size={14} />
          Request Changes
        </button>
      );
    }

    if (shouldShowSubmitForReview) {
      return (
        <button
          type="button"
          onClick={onSubmitForReview}
          disabled={isSaving || reviewActionBusy}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Send" size={14} />
          {submitForReviewLabel}
        </button>
      );
    }

    if (isFuture) {
      return (
        <button
          type="button"
          onClick={onUnpublish}
          disabled={isSaving || isPublishing}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="CalendarX" size={14} />
          Unschedule
        </button>
      );
    }

    if (isPublished && shouldShowPublish) {
      return (
        <button
          type="button"
          onClick={onPublish}
          disabled={isSaving || isPublishing}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          {isPublishing ? (
            <>
              <WkIcon name="Loader2" size={14} className="animate-spin" />
              Updating
            </>
          ) : (
            <>
              <WkIcon name="RefreshCw" size={14} />
              Update
            </>
          )}
        </button>
      );
    }

    if (!isPublished && !isFuture && shouldShowPublish) {
      return (
        <button
          type="button"
          onClick={onPublish}
          disabled={isSaving || isPublishing}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          {isPublishing ? (
            <>
              <WkIcon name="Loader2" size={14} className="animate-spin" />
              Publishing
            </>
          ) : (
            <>
              <WkIcon name="Globe" size={14} />
              Publish
            </>
          )}
        </button>
      );
    }

    return null;
  }

  return (
    <header className="sticky top-0 z-30 rounded-2xl border border-wk-border bg-wk-surface shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-wk-text-faint">
            <button
              type="button"
              onClick={() => navigate("/admin/content/articles")}
              className="text-wk-brand transition-colors hover:text-wk-brand-hover"
            >
              Articles
            </button>
            <WkIcon name="ChevronRight" size={11} />
            <span className="truncate">{title || slug}</span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="max-w-full truncate text-[18px] font-black tracking-tight text-wk-text sm:text-[20px] lg:max-w-[520px]">
              {title || "(Untitled)"}
            </h1>

            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusColor}`}
            >
              {statusLabel ?? status ?? "Draft"}
            </span>

            {isAdmin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2.5 py-1 text-[10px] font-bold text-wk-brand">
                <WkIcon name="Shield" size={10} />
                Admin
              </span>
            ) : null}

            {permissions && !permissions.canEdit ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2.5 py-1 text-[10px] font-bold text-wk-warning">
                <WkIcon name="Eye" size={10} />
                Read-only
              </span>
            ) : null}

            {draftActionsDisabled &&
            documentModeLabel ? (
              <span className="inline-flex items-center rounded-full bg-wk-info-soft px-2.5 py-1 text-[10px] font-bold text-wk-info">
                {documentModeLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-wk-text-faint">
            <span className="max-w-full truncate font-mono">{slug}</span>
            {articleOwner ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Owner: {articleOwner}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${displayedSaveStateTone}`}
          >
            {isSaving ? (
              <WkIcon name="Loader2" size={11} className="animate-spin" />
            ) : isDirty ? (
              <WkIcon name="Circle" size={7} />
            ) : (
              <WkIcon name="Check" size={11} />
            )}
            {displayedSaveStateLabel}
          </span>

          {!draftActionsDisabled ? (
            <button
              type="button"
              onClick={onPreview}
              disabled={isPreviewing || isSaving}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
            >
              {isPreviewing ? (
                <>
                  <WkIcon
                    name="Loader2"
                    size={14}
                    className="animate-spin"
                  />
                  Preparing
                </>
              ) : (
                <>
                  <WkIcon name="Eye" size={14} />
                  Preview
                </>
              )}
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving || isPublishing}
              className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="Save" size={14} />
              Save
            </button>
          ) : null}

          {focusMode && onToggleFocusMode ? (
            <button
              type="button"
              onClick={onToggleFocusMode}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="PanelLeftOpen" size={14} />
              <span className="hidden sm:inline">
                Exit Focus
              </span>
            </button>
          ) : null}

          {showArticleDetails && onOpenArticleDetails ? (
            <button
              type="button"
              title="Article Details"
              aria-label="Open Article Details"
              aria-expanded={articleDetailsOpen}
              aria-controls="article-write-context-drawer"
              onClick={onOpenArticleDetails}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="PanelRightOpen" size={14} />
              <span className="hidden sm:inline">
                Details
              </span>
            </button>
          ) : null}

          {canRequestChanges && canApproveVersion ? (
            <button
              type="button"
              onClick={onRequestChanges}
              disabled={isSaving || isPublishing || reviewActionBusy}
              className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="Flag" size={14} />
              Request Changes
            </button>
          ) : null}

          {renderPrimaryAction()}

          <div
            ref={overflowRef}
            className={
              hasOverflowActions
                ? "relative"
                : "hidden"
            }
          >
            <button
              type="button"
              aria-label="More Article actions"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              onClick={() => setOverflowOpen((current) => !current)}
              className="wk-button wk-button-ghost wk-button-sm"
            >
              <WkIcon name="Ellipsis" size={16} />
            </button>

            {overflowOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-wk-border bg-wk-surface p-1.5 shadow-lg"
              >
                {isPublished ? (
                  <a
                    role="menuitem"
                    href={`/magazine/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                  >
                    <WkIcon name="ExternalLink" size={14} />
                    View Live
                  </a>
                ) : null}

                {(isPublished || isFuture) &&
                canManagePublication ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverflowOpen(false);
                      onUnpublish();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                  >
                    <WkIcon name="Undo2" size={14} />
                    {isFuture ? "Unschedule" : "Return to Draft"}
                  </button>
                ) : null}

                {!draftActionsDisabled &&
                canDeleteArticle ? (
                  <>
                    <div className="my-1 h-px bg-wk-border" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOverflowOpen(false);
                        onDelete();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-wk-danger hover:bg-wk-danger-soft"
                    >
                      <WkIcon name="Trash2" size={14} />
                      Move to Trash
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {publishDisabledReason || lastAutosavedAt ? (
        <div className="flex flex-col gap-1 border-t border-wk-border px-4 py-2 text-[10px] text-wk-text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>
            {lastAutosavedAt
              ? `Last auto-saved ${new Date(lastAutosavedAt).toLocaleTimeString()}`
              : "Auto-save starts after the first change."}
          </span>

          {publishDisabledReason ? (
            <span className="font-semibold text-wk-warning">
              {publishDisabledReason}
            </span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
