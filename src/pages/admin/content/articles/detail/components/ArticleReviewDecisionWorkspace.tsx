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
        submittedVersionNumber
          ? `${title || "Untitled Article"} · submitted v${submittedVersionNumber}`
          : title || "Article lifecycle"
      }
      actions={actions}
      busy={busy}
      events={decisionEvents}
    >
      <div className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs leading-5 text-wk-text-muted">
        Review decisions target the immutable submitted Article version. Suggestions
        and writing changes remain separate until they are accepted back into Draft.
      </div>
    </EditorialDecisionWorkspace>
  );
}
