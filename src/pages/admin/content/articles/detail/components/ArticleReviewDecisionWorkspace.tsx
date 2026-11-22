import {
  EditorialDecisionWorkspace,
  type EditorialDecisionDescriptor,
  type EditorialDecisionEvent,
} from "@/components/design-system/editorial/EditorialDecisionWorkspace";

export interface ArticleDecisionHistoryEvent {
  id: string;
  action: string;
  priorStatus: string | null;
  resultingStatus: string | null;
  note: string | null;
  createdAt: string;
  versionNumber: number | null;
}

export function ArticleReviewDecisionWorkspace({
  title,
  status,
  submittedVersionNumber,
  workingVersionNumber,
  latestApprovedVersionNumber,
  latestPublishedVersionNumber,
  isPublished = false,
  canEditArticle = false,
  onEditArticle,
  canResubmitWorkingVersion,
  onResubmitWorkingVersion,
  note,
  onNoteChange,
  canRequestChanges,
  canApprove,
  busy,
  events,
  onRequestChanges,
  onApprove,
}: {
  title: string;
  status: string | null;
  submittedVersionNumber: number | null;
  workingVersionNumber: number | null;
  latestApprovedVersionNumber: number | null;
  latestPublishedVersionNumber?: number | null;
  isPublished?: boolean;
  canEditArticle?: boolean;
  onEditArticle?: () => void;
  canResubmitWorkingVersion: boolean;
  onResubmitWorkingVersion: (note: string | null) => void | Promise<void>;
  note: string;
  onNoteChange: (value: string) => void;
  canRequestChanges: boolean;
  canApprove: boolean;
  busy: boolean;
  events: ArticleDecisionHistoryEvent[];
  onRequestChanges: () => void | Promise<void>;
  onApprove: () => void | Promise<void>;
}) {
  const actions: EditorialDecisionDescriptor[] = [];
  if (isPublished && canEditArticle && onEditArticle) {
    actions.push({
      key: "edit-published",
      label: "Edit Article",
      icon: "Pencil",
      tone: "secondary",
      disabled: busy,
      title: "Edit a new working version without taking the published Article offline.",
      onClick: onEditArticle,
    });
  }

  if (canResubmitWorkingVersion) {
    actions.push({
      key: "resubmit-working",
      label: isPublished ? "Submit Updated Article for Review" : "Resubmit Current Version for Review",
      icon: "Send",
      tone: "primary",
      disabled: busy,
      title: "Create a new immutable submission from the current working Article without changing prior decisions.",
      onClick: () => void onResubmitWorkingVersion(note.trim() || null),
    });
  }

  if (canRequestChanges) {
    actions.push({
      key: "request-changes",
      label: "Request Changes",
      icon: "MessageSquareWarning",
      tone: "warning",
      requiresNote: true,
      noteRequiredMessage:
        "Explain what needs to change before returning this Article to Draft.",
      disabled: busy,
      onClick: () => void onRequestChanges(),
    });
  }

  if (canApprove) {
    actions.push({
      key: "approve",
      label: "Approve Version",
      icon: "ShieldCheck",
      tone: "primary",
      disabled: busy,
      onClick: () => void onApprove(),
    });
  }

  const decisionEvents: EditorialDecisionEvent[] = events.map((event) => ({
    id: event.id,
    action: event.action,
    priorStatus: event.priorStatus,
    resultingStatus: event.resultingStatus ?? "",
    note: event.note,
    createdAt: event.createdAt,
  }));

  return (
    <EditorialDecisionWorkspace
      title="Article editorial decision"
      note={note}
      onNoteChange={onNoteChange}
      noteLabel={canResubmitWorkingVersion ? "Optional submission note" : "Review note"}
      notePlaceholder="Record the reason for this exact-version decision."
      statusLabel={status || "draft"}
      targetLabel={
        isPublished && latestPublishedVersionNumber
          ? canResubmitWorkingVersion && workingVersionNumber
            ? `${title || "Untitled Article"} · published v${latestPublishedVersionNumber} · working v${workingVersionNumber} needs review`
            : status?.includes("In Review") && submittedVersionNumber
              ? `${title || "Untitled Article"} · published v${latestPublishedVersionNumber} · submitted v${submittedVersionNumber}`
              : status?.includes("Update Approved") && latestApprovedVersionNumber
                ? `${title || "Untitled Article"} · published v${latestPublishedVersionNumber} · approved v${latestApprovedVersionNumber}`
                : `${title || "Untitled Article"} · published v${latestPublishedVersionNumber}`
          : canResubmitWorkingVersion && workingVersionNumber
          ? `${title || "Untitled Article"} · working v${workingVersionNumber} needs review`
          : status === "Approved for Publication" && latestApprovedVersionNumber
            ? `${title || "Untitled Article"} · approved v${latestApprovedVersionNumber}`
            : status === "Pending Review" && submittedVersionNumber
              ? `${title || "Untitled Article"} · submitted v${submittedVersionNumber}`
              : `${title || "Untitled Article"} · review authority unavailable`
      }
      actions={actions}
      showNote={actions.some((action) => action.key !== "edit-published")}
      busy={busy}
      events={decisionEvents}
    >
      <div className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs leading-5 text-wk-text-muted">
        {isPublished ? (
          <p data-wk-article-review-cycle="published-correction">
            This Article stays published while you edit its working version.
            Save your changes in Write, then submit the updated version for
            review. The public Article changes only after the new version is
            approved and published.
          </p>
        ) : canResubmitWorkingVersion ? (
          <p data-wk-article-review-cycle="resubmit-working">
            {latestApprovedVersionNumber
              ? `Approved v${latestApprovedVersionNumber} remains preserved. `
              : ""}
            The working Article has unreviewed changes. Resubmit the current
            version to create a new immutable review target before publishing.
          </p>
        ) : (
          <p>
            Review decisions target the immutable submitted Article version.
            Suggestions and writing changes remain separate until they are
            accepted back into Draft.
          </p>
        )}
      </div>
    </EditorialDecisionWorkspace>
  );
}
