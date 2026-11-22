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
  canResubmitWorkingVersion: boolean;
  onResubmitWorkingVersion: () => void | Promise<void>;
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

  if (canResubmitWorkingVersion) {
    actions.push({
      key: "resubmit-working",
      label: "Resubmit Current Version for Review",
      icon: "Send",
      tone: "primary",
      disabled: busy,
      title: "Create a new immutable submission from the current working Article without changing prior decisions.",
      onClick: () => void onResubmitWorkingVersion(),
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
      noteLabel="Review note"
      notePlaceholder="Record the reason for this exact-version decision."
      statusLabel={status || "draft"}
      targetLabel={
        canResubmitWorkingVersion && workingVersionNumber
          ? `${title || "Untitled Article"} · working v${workingVersionNumber} needs review`
          : submittedVersionNumber
            ? `${title || "Untitled Article"} · submitted v${submittedVersionNumber}`
            : title || "Article lifecycle"
      }
      actions={actions}
      busy={busy}
      events={decisionEvents}
    >
      <div className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs leading-5 text-wk-text-muted">
        {canResubmitWorkingVersion ? (
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
