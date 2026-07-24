import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  PUBLISHING_PRIORITIES,
  PUBLISHING_PRODUCTION_STAGES,
  createPublishingItem,
  type PublishingContentKind,
  type PublishingPriority,
  type PublishingProductionStage,
} from "@/services/publishing/publishingWorkspaceService";

interface CreatePublishingItemDrawerProps {
  contentKinds: PublishingContentKind[];
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

type OwnerMode = "me" | "unassigned";

function formatChoice(value: string): string {
  return value
    .split("_")
    .map((part) =>
      part.length > 0
        ? `${part[0].toUpperCase()}${part.slice(1)}`
        : part,
    )
    .join(" ");
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

export function CreatePublishingItemDrawer({
  contentKinds,
  currentUserId,
  currentUserName,
  onClose,
  onCreated,
}: CreatePublishingItemDrawerProps) {
  const [title, setTitle] = useState("");
  const [contentKind, setContentKind] = useState(
    contentKinds[0]?.key ?? "",
  );
  const [brief, setBrief] = useState("");
  const [productionStage, setProductionStage] =
    useState<PublishingProductionStage>("idea");
  const [priority, setPriority] =
    useState<PublishingPriority>("normal");
  const [ownerMode, setOwnerMode] =
    useState<OwnerMode>("me");
  const [productionDeadline, setProductionDeadline] =
    useState("");
  const [plannedPublishAt, setPlannedPublishAt] =
    useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  const selectedContentKind =
    contentKinds.find(
      (kind) => kind.key === contentKind,
    ) ?? null;

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose, saving]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanTitle = title.trim();

    if (cleanTitle.length < 2) {
      setError(
        "Enter a title with at least two characters.",
      );
      return;
    }

    if (!contentKind) {
      setError("Choose a content type.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await createPublishingItem({
        title: cleanTitle,
        contentKind,
        ownerId:
          ownerMode === "me" && currentUserId
            ? currentUserId
            : null,
        brief: brief.trim() || null,
        productionStage,
        priority,
        productionDeadline:
          toIsoOrNull(productionDeadline),
        plannedPublishAt:
          toIsoOrNull(plannedPublishAt),
        note: note.trim() || null,
      });

      if (!result.ok) {
        setError(
          result.error ??
            "We could not add this work to Publishing.",
        );
        setSaving(false);
        return;
      }

      await onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not add this work to Publishing.",
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-publishing-title"
    >
      <button
        type="button"
        aria-label="Close Create Publishing Item"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm disabled:cursor-wait"
      />

      <aside className="relative ml-auto flex h-full max-h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-l border-wk-border bg-wk-surface shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-wk-border px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
              Editorial Operations
            </div>
            <h2
              id="create-publishing-title"
              className="mt-1 text-[18px] font-black text-wk-text"
            >
              Create Publishing Item
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              Add work when it enters production. You can connect it to a canonical editor later.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-wk-border text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text disabled:opacity-50"
          >
            <WkIcon name="X" size={15} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
            {error ? (
              <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft p-3">
                <div className="flex items-start gap-2">
                  <WkIcon
                    name="AlertTriangle"
                    size={16}
                    className="mt-0.5 shrink-0 text-wk-danger"
                  />
                  <p className="text-[12px] leading-5 text-wk-danger">
                    {error}
                  </p>
                </div>
              </div>
            ) : null}

            <label className="block">
              <span className="text-[12px] font-bold text-wk-text">
                Title
              </span>
              <input
                autoFocus
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError(null);
                }}
                disabled={saving}
                placeholder="Name the work entering production"
                className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-bold text-wk-text">
                Content Type
              </span>
              <select
                value={contentKind}
                onChange={(event) => {
                  setContentKind(event.target.value);
                  setError(null);
                }}
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              >
                {contentKinds.map((kind) => (
                  <option
                    key={kind.key}
                    value={kind.key}
                  >
                    {kind.label}
                  </option>
                ))}
              </select>
              {selectedContentKind?.description ? (
                <p className="mt-1.5 text-[11px] leading-4 text-wk-text-muted">
                  {selectedContentKind.description}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="text-[12px] font-bold text-wk-text">
                Brief
              </span>
              <textarea
                value={brief}
                onChange={(event) =>
                  setBrief(event.target.value)
                }
                disabled={saving}
                rows={4}
                placeholder="Describe what needs to be made"
                className="mt-2 w-full resize-y rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] leading-5 text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Production Stage
                </span>
                <select
                  value={productionStage}
                  onChange={(event) =>
                    setProductionStage(
                      event.target
                        .value as PublishingProductionStage,
                    )
                  }
                  disabled={saving}
                  className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                >
                  {PUBLISHING_PRODUCTION_STAGES.map(
                    (stage) => (
                      <option key={stage} value={stage}>
                        {formatChoice(stage)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Priority
                </span>
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target
                        .value as PublishingPriority,
                    )
                  }
                  disabled={saving}
                  className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                >
                  {PUBLISHING_PRIORITIES.map(
                    (priorityOption) => (
                      <option
                        key={priorityOption}
                        value={priorityOption}
                      >
                        {formatChoice(priorityOption)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-[12px] font-bold text-wk-text">
                Owner
              </span>
              <select
                value={ownerMode}
                onChange={(event) =>
                  setOwnerMode(
                    event.target.value as OwnerMode,
                  )
                }
                disabled={saving}
                className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              >
                <option value="me">
                  Assign To Me ({currentUserName})
                </option>
                <option value="unassigned">
                  Leave Unassigned
                </option>
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Production Deadline
                </span>
                <input
                  type="datetime-local"
                  value={productionDeadline}
                  onChange={(event) =>
                    setProductionDeadline(
                      event.target.value,
                    )
                  }
                  disabled={saving}
                  className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-[12px] font-bold text-wk-text">
                  Planned Publish Time
                </span>
                <input
                  type="datetime-local"
                  value={plannedPublishAt}
                  onChange={(event) =>
                    setPlannedPublishAt(
                      event.target.value,
                    )
                  }
                  disabled={saving}
                  className="mt-2 w-full rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                />
              </label>
            </div>

            <p className="text-[11px] leading-4 text-wk-text-muted">
              Planned timing does not schedule or publish canonical content.
            </p>

            <label className="block">
              <span className="text-[12px] font-bold text-wk-text">
                Creation Note
              </span>
              <textarea
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                disabled={saving}
                rows={3}
                placeholder="Record why this work is entering production"
                className="mt-2 w-full resize-y rounded-xl border border-wk-border bg-wk-surface px-3 py-2.5 text-[13px] leading-5 text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mb-0 flex shrink-0 flex-col-reverse gap-2 border-t border-wk-border bg-wk-surface px-5 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="wk-button wk-button-secondary wk-button-sm justify-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                title.trim().length < 2 ||
                !contentKind
              }
              className="wk-button wk-button-primary wk-button-sm justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <WkIcon
                  name="Loader2"
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <WkIcon name="PlusCircle" size={14} />
              )}
              {saving
                ? "Adding To Publishing"
                : "Add To Publishing"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
