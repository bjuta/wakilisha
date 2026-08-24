import { WkIcon } from "@/components/design-system/Icon";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import {
  AdminRecordActions,
  type AdminRecordActionDescriptor,
} from "@/components/design-system/admin/AdminRecordActions";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";
import type { AudioPublicationWorkspace } from "@/services/audio/audioAdminService";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function versionState(
  label: string,
  value: string | null,
): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-1.5 w-1.5 rounded-full ${value ? "bg-wk-success" : "bg-wk-border"}`}
      />
      {label}
    </span>
  );
}

export function AudioEditorHeader({
  workspace,
  workingDirty,
  isSaving,
  busy,
  canSubmit,
  onBack,
  onSave,
  onSubmit,
  onOpenDetails,
  onOpenReview,
  onArchive,
  onRestore,
}: {
  workspace: AudioPublicationWorkspace;
  workingDirty: boolean;
  isSaving: boolean;
  busy: boolean;
  canSubmit: boolean;
  onBack: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onOpenDetails: () => void;
  onOpenReview: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const publication = workspace.publication;
  const editable =
    workspace.canEdit &&
    ["draft", "changes_requested"].includes(publication.status);
  const reviewLifecycle = [
    "ready_for_review",
    "in_review",
    "approved",
  ].includes(publication.status);

  const actions: AdminRecordActionDescriptor[] = [];

  if (editable) {
    actions.push({
      key: "save",
      label: "Save",
      icon: "Save",
      tone: "secondary",
      disabled: busy || !workingDirty,
      title: workingDirty
        ? "Save Audio edits and snapshot the exact working version."
        : "The working Audio version is already saved.",
      onClick: onSave,
    });
  }

  actions.push({
    key: "details",
    label: "Details",
    icon: "PanelRightOpen",
    onClick: onOpenDetails,
  });

  if (canSubmit) {
    actions.push({
      key: "submit",
      label: "Submit for Review",
      icon: "Send",
      tone: "primary",
      disabled: busy || workingDirty,
      title: workingDirty
        ? "Save the working Audio version before submitting for Review."
        : "Submit the exact saved Audio version for editorial Review.",
      onClick: onSubmit,
    });
  } else if (reviewLifecycle) {
    actions.push({
      key: "review",
      label: publication.status === "approved"
        ? "Review & Publish"
        : "Open Review",
      icon: publication.status === "approved"
        ? "CloudUpload"
        : "ScanText",
      tone: "primary",
      onClick: onOpenReview,
    });
  } else if (publication.status === "published") {
    actions.push({
      key: "view-live",
      label: "View Live",
      icon: "ExternalLink",
      tone: "primary",
      href: `/audio/${encodeURIComponent(publication.slug)}`,
    });
  }

  if (publication.status === "archived" && workspace.canEdit) {
    actions.push({
      key: "restore",
      label: "Restore",
      icon: "Undo2",
      placement: "overflow",
      disabled: busy,
      onClick: onRestore,
    });
  }

  if (publication.status !== "archived" && workspace.canArchive) {
    actions.push({
      key: "archive",
      label: "Archive",
      icon: "Archive",
      tone: "danger",
      placement: "overflow",
      disabled: busy,
      onClick: onArchive,
    });
  }

  return (
    <AdminRecordHeader
      collectionLabel="Audio"
      title={publication.title}
      status={publication.status}
      onBack={onBack}
      meta={
        <>
          <span className="font-mono">{publication.slug}</span>
          <span aria-hidden="true">·</span>
          <span>
            {publication.publicationKind === "episode"
              ? publication.episodeNumber
                ? `Show Episode ${publication.episodeNumber}`
                : "Show Episode"
              : "Standalone Audio"}
          </span>
          <span aria-hidden="true">·</span>
          <span>Authority revision {publication.authorityRevision}</span>
        </>
      }
      actions={
        <AdminRecordActions
          actions={actions}
          overflowLabel="More Audio actions"
        >
          <AdminSaveState
            isDirty={workingDirty}
            isSaving={isSaving}
            locked={!editable}
            lockedLabel={`${humanize(publication.status)} Version`}
          />
        </AdminRecordActions>
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {versionState("Working", workspace.versions.working)}
            {versionState("Submitted", workspace.versions.submitted)}
            {versionState("Approved", workspace.versions.approved)}
            {versionState("Published", workspace.versions.published)}
          </div>
          {workingDirty ? (
            <span className="font-semibold text-wk-warning">
              Save the working version before Review.
            </span>
          ) : reviewLifecycle ? (
            <span className="font-semibold text-wk-info">
              Editorial decisions live with the exact submitted version in Review.
            </span>
          ) : null}
        </div>
      }
    />
  );
}
