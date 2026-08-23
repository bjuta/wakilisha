import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";
import {
  AdminRecordActions,
  type AdminRecordAction,
} from "@/components/design-system/admin/AdminRecordActions";
import type { WkIconName } from "@/components/design-system/Icon";

export interface PlaylistEditorHeaderAction {
  id?: string;
  label: string;
  icon: WkIconName;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
  tone?: "primary" | "secondary" | "ghost" | "danger";
  placement?: "rail" | "menu";
}

function asRecordAction(
  action: PlaylistEditorHeaderAction,
  fallbackId: string,
): AdminRecordAction {
  return {
    ...action,
    id: action.id || fallbackId,
    placement:
      action.placement ||
      (action.tone === "danger" ? "menu" : "rail"),
  };
}

export function PlaylistEditorHeader({
  title,
  slug,
  status,
  revision,
  trackCount,
  isDirty,
  isSaving,
  detailsOpen,
  canEdit,
  onBack,
  onSave,
  onToggleDetails,
  primaryAction,
  secondaryActions = [],
}: {
  title: string;
  slug: string;
  status: string;
  revision: number;
  trackCount: number;
  isDirty: boolean;
  isSaving: boolean;
  detailsOpen: boolean;
  canEdit: boolean;
  onBack: () => void;
  onSave: () => void;
  onToggleDetails: () => void;
  primaryAction?: PlaylistEditorHeaderAction | null;
  secondaryActions?: PlaylistEditorHeaderAction[];
}) {
  const actions: AdminRecordAction[] = [];

  if (canEdit) {
    actions.push({
      id: "save",
      label: "Save",
      icon: "Save",
      onClick: onSave,
      disabled: isDirty || isSaving,
      title: isDirty
        ? "Wait for moving changes to finish saving first."
        : "Save an immutable working version.",
      tone: "secondary",
      placement: "rail",
    });
  }

  actions.push({
    id: "details",
    label: "Details",
    icon: "PanelRightOpen",
    onClick: onToggleDetails,
    title: detailsOpen ? "Close Playlist details" : "Open Playlist details",
    tone: "ghost",
    placement: "rail",
  });

  secondaryActions.forEach((action, index) => {
    actions.push(asRecordAction(action, `secondary-${index}-${action.label}`));
  });

  if (primaryAction) {
    actions.push(
      asRecordAction(
        {
          ...primaryAction,
          placement: "rail",
        },
        `primary-${primaryAction.label}`,
      ),
    );
  }

  return (
    <AdminRecordHeader
      collectionLabel="Playlists"
      title={title || "Untitled Playlist"}
      status={status}
      onBack={onBack}
      meta={
        <>
          <span className="max-w-full truncate font-mono">/{slug}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">Revision {revision}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">
            {trackCount} {trackCount === 1 ? "track" : "tracks"}
          </span>
        </>
      }
      actions={
        <>
          <AdminSaveState isDirty={isDirty} isSaving={isSaving} />
          <AdminRecordActions actions={actions} />
        </>
      }
    />
  );
}
