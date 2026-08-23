import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";
import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";
import {
  AdminRecordActions,
  type AdminRecordAction,
} from "@/components/design-system/admin/AdminRecordActions";

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
  const isPublished = status === "publish";
  const isFuture = status === "future";
  const shouldShowSubmitForReview = !isPublished && !isFuture && canSubmitForReview;
  const shouldShowPublish = userCanPublish && !publishDisabledReason;
  const canEdit = (!permissions || permissions.canEdit) && !draftActionsDisabled;
  const canManagePublication = !permissions || permissions.canPublish;
  const canDeleteArticle = (!permissions || permissions.canDelete) && !draftActionsDisabled;

  const actions: AdminRecordAction[] = [];

  if (!draftActionsDisabled) {
    actions.push({
      id: "preview",
      label: isPreviewing ? "Preparing" : "Preview",
      icon: isPreviewing ? "Loader2" : "Eye",
      onClick: () => void onPreview(),
      disabled: isPreviewing || isSaving,
      placement: "rail",
    });
  }

  if (canEdit) {
    actions.push({
      id: "save",
      label: "Save",
      icon: "Save",
      onClick: onSaveDraft,
      disabled: isSaving || isPublishing,
      tone: "secondary",
      placement: "rail",
    });
  }

  if (focusMode && onToggleFocusMode) {
    actions.push({
      id: "exit-focus",
      label: "Exit Focus",
      icon: "PanelLeftOpen",
      onClick: onToggleFocusMode,
      placement: "rail",
    });
  }

  if (showArticleDetails && onOpenArticleDetails) {
    actions.push({
      id: "details",
      label: "Details",
      icon: "PanelRightOpen",
      onClick: onOpenArticleDetails,
      title: articleDetailsOpen ? "Close Article Details" : "Open Article Details",
      placement: "rail",
    });
  }

  if (canRequestChanges && canApproveVersion && onRequestChanges) {
    actions.push({
      id: "request-changes",
      label: "Request Changes",
      icon: "Flag",
      onClick: onRequestChanges,
      disabled: isSaving || isPublishing || reviewActionBusy,
      tone: "secondary",
      placement: "rail",
    });
  }

  if (canApproveVersion && onApproveVersion) {
    actions.push({
      id: "approve",
      label: "Approve Version",
      icon: "ShieldCheck",
      onClick: onApproveVersion,
      disabled: isSaving || isPublishing || reviewActionBusy,
      tone: "primary",
      placement: "rail",
    });
  } else if (canRequestChanges && onRequestChanges) {
    actions.push({
      id: "request-changes-primary",
      label: "Request Changes",
      icon: "Flag",
      onClick: onRequestChanges,
      disabled: isSaving || isPublishing || reviewActionBusy,
      tone: "primary",
      placement: "rail",
    });
  } else if (shouldShowSubmitForReview) {
    actions.push({
      id: "submit-review",
      label: submitForReviewLabel,
      icon: "Send",
      onClick: onSubmitForReview,
      disabled: isSaving || reviewActionBusy,
      tone: "primary",
      placement: "rail",
    });
  } else if (isFuture) {
    actions.push({
      id: "unschedule",
      label: "Unschedule",
      icon: "CalendarX",
      onClick: onUnpublish,
      disabled: isSaving || isPublishing,
      tone: "primary",
      placement: "rail",
    });
  } else if (isPublished && shouldShowPublish) {
    actions.push({
      id: "publish",
      label: isPublishing ? "Updating" : "Update",
      icon: isPublishing ? "Loader2" : "RefreshCw",
      onClick: onPublish,
      disabled: isSaving || isPublishing,
      tone: "primary",
      placement: "rail",
    });
  } else if (!isPublished && !isFuture && shouldShowPublish) {
    actions.push({
      id: "publish",
      label: isPublishing ? "Publishing" : "Publish",
      icon: isPublishing ? "Loader2" : "Globe",
      onClick: onPublish,
      disabled: isSaving || isPublishing,
      tone: "primary",
      placement: "rail",
    });
  }

  if (isPublished) {
    actions.push({
      id: "view-live",
      label: "View Live",
      icon: "ExternalLink",
      href: `/magazine/${slug}`,
      placement: "menu",
    });
  }

  if ((isPublished || isFuture) && canManagePublication) {
    actions.push({
      id: isFuture ? "unschedule-menu" : "return-draft",
      label: isFuture ? "Unschedule" : "Return to Draft",
      icon: "Undo2",
      onClick: onUnpublish,
      placement: "menu",
    });
  }

  if (!draftActionsDisabled && canDeleteArticle) {
    actions.push({
      id: "trash",
      label: "Move to Trash",
      icon: "Trash2",
      onClick: onDelete,
      tone: "danger",
      placement: "menu",
    });
  }

  return (
    <AdminRecordHeader
      collectionLabel="Articles"
      title={title || "(Untitled)"}
      status={statusColorKey ?? status ?? "draft"}
      statusLabel={statusLabel ?? status ?? "Draft"}
      onBack={() => navigate("/admin/content/articles")}
      badges={
        <>
          {isAdmin ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2.5 py-1 text-[10px] font-bold text-wk-brand">
              <WkIcon name="Shield" size={10} />
              Admin
            </span>
          ) : null}
          {permissions && !permissions.canEdit ? (
            <AdminStatusBadge
              status="changes_requested"
              label="Read-only"
              className="normal-case tracking-normal"
            />
          ) : null}
        </>
      }
      meta={
        <>
          <span className="max-w-full truncate font-mono">{slug}</span>
          {articleOwner ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Owner: {articleOwner}</span>
            </>
          ) : null}
        </>
      }
      actions={
        <>
          <AdminSaveState
            isDirty={isDirty}
            isSaving={isSaving}
            locked={draftActionsDisabled}
            lockedLabel={documentModeLabel || "Submitted Version"}
          />
          <AdminRecordActions
            actions={actions}
            overflowLabel="More Article actions"
          />
        </>
      }
      footer={
        publishDisabledReason || lastAutosavedAt ? (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {lastAutosavedAt
                ? `Last auto-saved ${new Date(lastAutosavedAt).toLocaleTimeString()}`
                : "Auto-save starts after the first change."}
            </span>
            {publishDisabledReason ? (
              <span className="font-semibold text-wk-warning">{publishDisabledReason}</span>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
