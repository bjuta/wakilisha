import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import {
  AdminRecordActions,
  type AdminRecordActionDescriptor,
} from "@/components/design-system/admin/AdminRecordActions";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";
import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";

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

  const actions: AdminRecordActionDescriptor[] = [];

  if (!draftActionsDisabled) {
    actions.push({
      key: "preview",
      label: isPreviewing ? "Preparing" : "Preview",
      icon: isPreviewing ? "Loader2" : "Eye",
      disabled: isPreviewing || isSaving,
      onClick: () => void onPreview(),
    });
  }

  if (canEdit) {
    actions.push({
      key: "save",
      label: "Save",
      icon: "Save",
      tone: "secondary",
      disabled: isSaving || isPublishing,
      onClick: onSaveDraft,
    });
  }

  if (focusMode && onToggleFocusMode) {
    actions.push({
      key: "exit-focus",
      label: "Exit Focus",
      icon: "PanelLeftOpen",
      onClick: onToggleFocusMode,
    });
  }

  if (showArticleDetails && onOpenArticleDetails) {
    actions.push({
      key: "details",
      label: "Details",
      icon: "PanelRightOpen",
      title: articleDetailsOpen ? "Close Article Details" : "Article Details",
      onClick: onOpenArticleDetails,
    });
  }

  if (canRequestChanges && canApproveVersion && onRequestChanges) {
    actions.push({
      key: "request-changes-secondary",
      label: "Request Changes",
      icon: "Flag",
      tone: "secondary",
      disabled: isSaving || isPublishing || reviewActionBusy,
      onClick: onRequestChanges,
    });
  }

  if (canApproveVersion && onApproveVersion) {
    actions.push({
      key: "approve-version",
      label: "Approve Version",
      icon: "ShieldCheck",
      tone: "primary",
      disabled: isSaving || isPublishing || reviewActionBusy,
      onClick: onApproveVersion,
    });
  } else if (canRequestChanges && onRequestChanges) {
    actions.push({
      key: "request-changes-primary",
      label: "Request Changes",
      icon: "Flag",
      tone: "primary",
      disabled: isSaving || isPublishing || reviewActionBusy,
      onClick: onRequestChanges,
    });
  } else if (shouldShowSubmitForReview) {
    actions.push({
      key: "submit-review",
      label: submitForReviewLabel,
      icon: "Send",
      tone: "primary",
      disabled: isSaving || reviewActionBusy,
      onClick: onSubmitForReview,
    });
  } else if (isFuture) {
    actions.push({
      key: "unschedule-primary",
      label: "Unschedule",
      icon: "CalendarX",
      tone: "primary",
      disabled: isSaving || isPublishing,
      onClick: onUnpublish,
    });
  } else if (isPublished && shouldShowPublish) {
    actions.push({
      key: "update",
      label: isPublishing ? "Updating" : "Update",
      icon: isPublishing ? "Loader2" : "RefreshCw",
      tone: "primary",
      disabled: isSaving || isPublishing,
      onClick: onPublish,
    });
  } else if (!isPublished && !isFuture && shouldShowPublish) {
    actions.push({
      key: "publish",
      label: isPublishing ? "Publishing" : "Publish",
      icon: isPublishing ? "Loader2" : "Globe",
      tone: "primary",
      disabled: isSaving || isPublishing,
      onClick: onPublish,
    });
  }

  if (isPublished) {
    actions.push({
      key: "view-live",
      label: "View Live",
      icon: "ExternalLink",
      href: `/magazine/${slug}`,
      placement: "overflow",
    });
  }

  if ((isPublished || isFuture) && canManagePublication) {
    actions.push({
      key: "return-draft",
      label: isFuture ? "Unschedule" : "Return to Draft",
      icon: "Undo2",
      placement: "overflow",
      onClick: onUnpublish,
    });
  }

  if (canDeleteArticle) {
    actions.push({
      key: "trash",
      label: "Move to Trash",
      icon: "Trash2",
      tone: "danger",
      placement: "overflow",
      separatorBefore: isPublished || isFuture,
      onClick: onDelete,
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
        <AdminRecordActions
          actions={actions}
          overflowLabel="More Article actions"
        >
          <AdminSaveState
            isDirty={isDirty}
            isSaving={isSaving}
            locked={draftActionsDisabled}
            lockedLabel={documentModeLabel || "Submitted Version"}
          />
        </AdminRecordActions>
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
              <span className="font-semibold text-wk-warning">
                {publishDisabledReason}
              </span>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
