import { WkIcon, type WkIconName } from "@/components/design-system/Icon";
import { AdminRecordHeader } from "@/components/design-system/admin/AdminRecordHeader";
import { AdminSaveState } from "@/components/design-system/admin/AdminSaveState";

// Shell semantics are organization-level now:
// AdminRecordHeader owns sticky top-0; AdminSaveState owns Saving, Unsaved, and All Saved.

export interface PlaylistEditorHeaderAction {
  label: string;
  icon: WkIconName;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
  tone?: "primary" | "ghost" | "danger";
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
  function actionClass(
    action: PlaylistEditorHeaderAction,
  ): string {
    if (action.tone === "danger") {
      return "wk-button wk-button-ghost wk-button-sm text-wk-danger";
    }
    if (action.tone === "primary") {
      return "wk-button wk-button-primary wk-button-sm";
    }
    return "wk-button wk-button-ghost wk-button-sm";
  }

  function renderAction(
    action: PlaylistEditorHeaderAction,
    key: string,
  ) {
    const content = (
      <>
        <WkIcon name={action.icon} size={14} />
        {action.label}
      </>
    );

    if (action.href) {
      return (
        <a
          key={key}
          href={action.href}
          target="_blank"
          rel="noreferrer"
          title={action.title}
          className={actionClass(action)}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        key={key}
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        title={action.title}
        className={`${actionClass(action)} disabled:opacity-40`}
      >
        {content}
      </button>
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

          {secondaryActions.map((action, index) =>
            renderAction(action, `secondary-${index}`),
          )}

          {primaryAction
            ? renderAction(primaryAction, "primary")
            : null}
        </>
      }
    />
  );
}
