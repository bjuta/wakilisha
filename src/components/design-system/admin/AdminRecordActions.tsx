import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";

export type AdminRecordActionId =
  | "preview"
  | "details"
  | "view-live"
  | "archive"
  | "restore"
  | "trash"
  | "unpublish"
  | "unschedule"
  | "submit-review"
  | "start-review"
  | "request-changes"
  | "approve"
  | "publish"
  | "save"
  | string;

export type AdminRecordActionTone =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger";

export interface AdminRecordAction {
  id: AdminRecordActionId;
  label: string;
  icon: WkIconName;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
  tone?: AdminRecordActionTone;
  placement?: "rail" | "menu";
}

function actionClass(
  action: AdminRecordAction,
  inMenu: boolean,
): string {
  if (inMenu) {
    return action.tone === "danger"
      ? "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-wk-danger hover:bg-wk-danger-soft disabled:opacity-40"
      : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text disabled:opacity-40";
  }

  if (action.tone === "primary") {
    return "wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-40";
  }
  if (action.tone === "secondary") {
    return "wk-button wk-button-secondary wk-button-sm whitespace-nowrap disabled:opacity-40";
  }
  if (action.tone === "danger") {
    return "wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger disabled:opacity-40";
  }
  return "wk-button wk-button-ghost wk-button-sm whitespace-nowrap disabled:opacity-40";
}

function ActionControl({
  action,
  inMenu = false,
  onChosen,
}: {
  action: AdminRecordAction;
  inMenu?: boolean;
  onChosen?: () => void;
}) {
  const content = (
    <>
      <WkIcon name={action.icon} size={14} />
      <span>{action.label}</span>
    </>
  );

  if (action.href) {
    return (
      <a
        role={inMenu ? "menuitem" : undefined}
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        title={action.title}
        onClick={onChosen}
        className={actionClass(action, inMenu)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      role={inMenu ? "menuitem" : undefined}
      onClick={() => {
        if (action.disabled) return;
        onChosen?.();
        action.onClick?.();
      }}
      disabled={action.disabled}
      title={action.title}
      className={actionClass(action, inMenu)}
    >
      {content}
    </button>
  );
}

export function AdminRecordActions({
  actions,
  overflowLabel = "More record actions",
}: {
  actions: AdminRecordAction[];
  overflowLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const railActions = actions.filter(
    (action) => action.placement !== "menu",
  );
  const menuActions = actions.filter(
    (action) => action.placement === "menu",
  );

  useEffect(() => {
    if (!open) return;

    const closeForPointer = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const closeForKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeForPointer);
    document.addEventListener("keydown", closeForKey);
    return () => {
      document.removeEventListener("mousedown", closeForPointer);
      document.removeEventListener("keydown", closeForKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <>
      {railActions.map((action) => (
        <ActionControl key={action.id} action={action} />
      ))}

      {menuActions.length > 0 ? (
        <div ref={rootRef} className="relative">
          <button
            type="button"
            aria-label={overflowLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="wk-button wk-button-ghost wk-button-sm"
          >
            <WkIcon name="Ellipsis" size={16} />
          </button>

          {open ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-wk-border bg-wk-surface p-1.5 shadow-lg"
            >
              {menuActions.map((action, index) => (
                <div key={action.id}>
                  {index > 0 && action.tone === "danger" ? (
                    <div className="my-1 h-px bg-wk-border" />
                  ) : null}
                  <ActionControl
                    action={action}
                    inMenu
                    onChosen={() => setOpen(false)}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
