import {
  EditorialDecisionWorkspace,
  type EditorialDecisionDescriptor,
  type EditorialDecisionEvent,
} from "@/components/design-system/editorial/EditorialDecisionWorkspace";
import type {
  PlaylistRecord,
  PlaylistReviewWorkspace,
} from "@/services/playlists/playlistAdminService";

export function PlaylistReviewDecisionWorkspace({
  playlist,
  review,
  note,
  onNoteChange,
  busy,
  onStartReview,
  onRequestChanges,
  onApprove,
  onPublish,
}: {
  playlist: PlaylistRecord;
  review: PlaylistReviewWorkspace;
  note: string;
  onNoteChange: (value: string) => void;
  busy: boolean;
  onStartReview: () => void | Promise<void>;
  onRequestChanges: () => void | Promise<void>;
  onApprove: () => void | Promise<void>;
  onPublish: () => void | Promise<void>;
}) {
  const actions: EditorialDecisionDescriptor[] = [];

  if (
    review.canManageReview &&
    playlist.status === "ready_for_review" &&
    review.currentSubmittedVersionId
  ) {
    actions.push({
      key: "start-review",
      label: "Start Review",
      icon: "ScanText",
      tone: "primary",
      disabled: busy,
      onClick: () => void onStartReview(),
    });
  }

  if (
    review.canManageReview &&
    playlist.status === "in_review" &&
    review.currentSubmittedVersionId
  ) {
    actions.push(
      {
        key: "request-changes",
        label: "Request Changes",
        icon: "MessageSquareWarning",
        tone: "warning",
        requiresNote: true,
        noteRequiredMessage:
          "Add a Review note explaining what needs to change.",
        disabled: busy,
        onClick: () => void onRequestChanges(),
      },
      {
        key: "approve",
        label: "Approve",
        icon: "CheckCircle2",
        tone: "primary",
        disabled: busy,
        onClick: () => void onApprove(),
      },
    );
  }

  if (
    review.canPublish &&
    playlist.status === "approved" &&
    review.currentApprovedVersionId
  ) {
    actions.push({
      key: "publish",
      label: "Publish",
      icon: "CloudUpload",
      tone: "primary",
      disabled: busy,
      onClick: () => void onPublish(),
    });
  }

  const events: EditorialDecisionEvent[] = [
    ...review.reviewEvents.map((event, index) => ({
      id: `review-${event.id ?? event.event_number ?? index}`,
      action: event.action ?? "review_event",
      priorStatus: event.prior_status ?? null,
      resultingStatus: event.resulting_status ?? "",
      note: event.reason ?? null,
      createdAt: event.created_at ?? "",
    })),
    ...review.lifecycleEvents.map((event) => ({
      id: `lifecycle-${event.id}`,
      action: event.action,
      priorStatus: event.priorStatus,
      resultingStatus: event.resultingStatus,
      note: event.note,
      createdAt: event.createdAt,
    })),
  ];

  return (
    <EditorialDecisionWorkspace
      title="Playlist editorial decision"
      note={note}
      onNoteChange={onNoteChange}
      noteLabel="Review note"
      notePlaceholder="Record the reason for this exact-version decision."
      statusLabel={playlist.status}
      targetLabel={
        review.currentSubmittedVersionId
          ? "Submitted Playlist version"
          : review.currentApprovedVersionId
            ? "Approved Playlist version"
            : "Playlist lifecycle"
      }
      actions={actions}
      busy={busy}
      events={events}
    >
      <div className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-xs leading-5 text-wk-text-muted">
        Review decisions target the immutable submitted Playlist version. Track order,
        Registry matches, cover state, and Discovery remain owned by the Playlist
        workspace and must be saved before resubmission.
      </div>
    </EditorialDecisionWorkspace>
  );
}
