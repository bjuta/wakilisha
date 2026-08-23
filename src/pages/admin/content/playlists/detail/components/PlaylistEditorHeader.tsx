import { WkIcon } from "@/components/design-system/Icon";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import {
  AdminRecordActions,
  type AdminRecordActionDescriptor,
} from "@/components/design-system/admin/AdminRecordActions";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";

// Shell semantics are organization-level now:
// AdminRecordHeader owns sticky top-0; AdminSaveState owns Saving, Unsaved, and All Saved.

export type PlaylistEditorHeaderAction = AdminRecordActionDescriptor;

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
  primaryAction?: Omit<PlaylistEditorHeaderAction, "key"> & { key?: string } | null;
  secondaryActions?: Array<Omit<PlaylistEditorHeaderAction, "key"> & { key?: string }>;
}) {
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

          {canEdit ? (
            <button
              type="button"
              onClick={onSave}
              disabled={isDirty || isSaving}
              title={
                isDirty
                  ? "Wait for moving changes to finish saving first."
                  : "Save an immutable working version."
              }
              className="wk-button wk-button-secondary wk-button-sm disabled:opacity-40"
            >
              <WkIcon name="Save" size={14} />
              Save
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={detailsOpen}
            className="wk-button wk-button-ghost wk-button-sm"
          >
            <WkIcon name="PanelRightOpen" size={14} />
            Details
          </button>

          <AdminRecordActions
            actions={[
              ...secondaryActions.map(
                (action, index) => ({
                  ...action,
                  key: action.key ?? `secondary-${index}`,
                }),
              ),
              ...(primaryAction
                ? [{
                    ...primaryAction,
                    key: primaryAction.key ?? "primary",
                  }]
                : []),
            ]}
          />
        </>
      }
    />
  );
}
