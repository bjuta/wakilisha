import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";

export type EditorialDecisionTone =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "warning";

export interface EditorialDecisionDescriptor {
  key: string;
  label: string;
  icon: WkIconName;
  onClick: () => void;
  disabled?: boolean;
  tone?: EditorialDecisionTone;
  requiresNote?: boolean;
  noteRequiredMessage?: string;
  title?: string;
}

export interface EditorialDecisionEvent {
  id: string;
  action: string;
  priorStatus?: string | null;
  resultingStatus?: string | null;
  note?: string | null;
  actorLabel?: string | null;
  createdAt?: string | null;
}

function humanize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function actionClass(tone: EditorialDecisionTone | undefined): string {
  if (tone === "primary") return "wk-button wk-button-primary wk-button-sm";
  if (tone === "secondary") return "wk-button wk-button-secondary wk-button-sm";
  if (tone === "danger") return "wk-button wk-button-ghost wk-button-sm text-wk-danger";
  if (tone === "warning") return "wk-button wk-button-ghost wk-button-sm text-wk-warning";
  return "wk-button wk-button-ghost wk-button-sm";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export function EditorialDecisionWorkspace({
  title = "Editorial decision",
  note,
  onNoteChange,
  noteLabel = "Decision note",
  notePlaceholder = "Add context for this editorial decision.",
  statusLabel,
  targetLabel,
  actions,
  busy = false,
  events = [],
  children,
  emptyHistoryLabel = "No editorial decisions yet.",
}: {
  title?: string;
  note: string;
  onNoteChange: (value: string) => void;
  noteLabel?: string;
  notePlaceholder?: string;
  statusLabel?: string | null;
  targetLabel?: string | null;
  actions: EditorialDecisionDescriptor[];
  busy?: boolean;
  events?: EditorialDecisionEvent[];
  children?: ReactNode;
  emptyHistoryLabel?: string;
}) {
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const visibleEvents = useMemo(
    () => events.slice().sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || "");
      const rightTime = Date.parse(right.createdAt || "");
      return (Number.isNaN(rightTime) ? 0 : rightTime) -
        (Number.isNaN(leftTime) ? 0 : leftTime);
    }),
    [events],
  );

  const invoke = (action: EditorialDecisionDescriptor) => {
    if (busy || action.disabled) return;

    if (action.requiresNote && !note.trim()) {
      setValidationMessage(
        action.noteRequiredMessage ||
          `Add a ${noteLabel.toLowerCase()} before ${action.label.toLowerCase()}.`,
      );
      return;
    }

    setValidationMessage(null);
    action.onClick();
  };

  return (
    <div className="space-y-5">
      {children}

      <AdminWorkspaceSection
        icon="GitPullRequest"
        title={title}
        note="Lifecycle decisions stay bound to the exact version under review."
      >
        {(statusLabel || targetLabel) ? (
          <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-wk-text-muted">
            {statusLabel ? (
              <span className="rounded-full border border-wk-border bg-wk-bg px-2.5 py-1 font-bold">
                {humanize(statusLabel)}
              </span>
            ) : null}
            {targetLabel ? (
              <span className="rounded-full border border-wk-border bg-wk-bg px-2.5 py-1 font-mono text-[10px]">
                {targetLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <label className="block text-xs font-bold text-wk-text-muted">
          {noteLabel}
          <textarea
            value={note}
            onChange={(event) => {
              onNoteChange(event.target.value);
              if (validationMessage) setValidationMessage(null);
            }}
            rows={3}
            placeholder={notePlaceholder}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-sm text-wk-text outline-none focus:border-wk-brand"
          />
        </label>

        {validationMessage ? (
          <p role="alert" className="mt-2 text-xs font-bold text-wk-warning">
            {validationMessage}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={busy || action.disabled}
              title={action.title}
              onClick={() => invoke(action)}
              className={`${actionClass(action.tone)} disabled:opacity-40`}
            >
              <WkIcon name={action.icon} size={14} />
              {action.label}
            </button>
          ))}
        </div>
      </AdminWorkspaceSection>

      <AdminWorkspaceSection
        icon="History"
        title="Decision history"
        note="Review and lifecycle decisions remain visible after the working state changes."
      >
        {visibleEvents.length ? (
          <div className="space-y-3">
            {visibleEvents.map((event) => (
              <div
                key={event.id}
                className="border-l-2 border-wk-border pl-4"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xs font-black text-wk-text">
                    {humanize(event.action)}
                  </p>
                  {event.createdAt ? (
                    <span className="text-[10px] text-wk-text-faint">
                      {formatDate(event.createdAt)}
                    </span>
                  ) : null}
                  {event.actorLabel ? (
                    <span className="text-[10px] text-wk-text-faint">
                      by {event.actorLabel}
                    </span>
                  ) : null}
                </div>
                {(event.priorStatus || event.resultingStatus) ? (
                  <p className="mt-1 text-[11px] text-wk-text-muted">
                    {humanize(event.priorStatus || "draft")}
                    {event.resultingStatus ? ` → ${humanize(event.resultingStatus)}` : ""}
                  </p>
                ) : null}
                {event.note ? (
                  <p className="mt-1 text-xs leading-5 text-wk-text">
                    {event.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-wk-text-muted">{emptyHistoryLabel}</p>
        )}
      </AdminWorkspaceSection>
    </div>
  );
}
