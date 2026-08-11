import { WkIcon, type WkIconName } from "@/components/design-system/Icon";

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
  const saveLabel = isSaving
    ? "Saving"
    : isDirty
      ? "Unsaved"
      : "All Saved";

  const saveTone = isSaving
    ? "border-wk-info/20 bg-wk-info-soft text-wk-info"
    : isDirty
      ? "border-wk-warning/20 bg-wk-warning-soft text-wk-warning"
      : "border-wk-success/20 bg-wk-success-soft text-wk-success";

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
    <header className="sticky top-0 z-40 -mx-4 border-b border-wk-border bg-wk-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface hover:text-wk-text"
            aria-label="Back to Playlists"
          >
            <WkIcon name="ArrowLeft" size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[16px] font-black tracking-tight text-wk-text sm:text-[18px]">
                {title || "Untitled Playlist"}
              </h1>
              <span className="shrink-0 rounded-full bg-wk-surface-raised px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-wk-text-muted">
                {status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] text-wk-text-faint">
              <span className="truncate">/{slug}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">Revision {revision}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">
                {trackCount} {trackCount === 1 ? "track" : "tracks"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <span
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-bold ${saveTone}`}
          >
            {isSaving ? (
              <WkIcon
                name="LoaderCircle"
                size={12}
                className="animate-spin"
              />
            ) : (
              <WkIcon
                name={isDirty ? "Circle" : "CheckCircle2"}
                size={11}
              />
            )}
            {saveLabel}
          </span>

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
              className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
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
        </div>
      </div>
    </header>
  );
}
