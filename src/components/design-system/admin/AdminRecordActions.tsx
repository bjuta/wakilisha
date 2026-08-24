import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";

export interface AdminRecordActionDescriptor {
  key: string;
  label: string;
  icon: WkIconName;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
  tone?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger";
  placement?: "inline" | "overflow";
  separatorBefore?: boolean;
}

function actionClass(
  tone: AdminRecordActionDescriptor["tone"],
): string {
  if (tone === "primary") {
    return "wk-button wk-button-primary wk-button-sm";
  }
  if (tone === "secondary") {
    return "wk-button wk-button-secondary wk-button-sm";
  }
  if (tone === "danger") {
    return "wk-button wk-button-ghost wk-button-sm text-wk-danger";
  }
  return "wk-button wk-button-ghost wk-button-sm";
}

function overflowActionClass(
  tone: AdminRecordActionDescriptor["tone"],
): string {
  return [
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-semibold transition-colors",
    tone === "danger"
      ? "text-wk-danger hover:bg-wk-danger-soft"
      : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text",
  ].join(" ");
}

function ActionContent({
  action,
}: {
  action: AdminRecordActionDescriptor;
}) {
  return (
    <>
      <WkIcon name={action.icon} size={14} />
      {action.label}
    </>
  );
}

export function AdminRecordActions({
  actions = [],
  children,
  overflowLabel = "More actions",
}: {
  actions?: AdminRecordActionDescriptor[];
  children?: ReactNode;
  overflowLabel?: string;
}) {
  const overflowRef = useRef<HTMLDivElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const inlineActions = actions.filter(
    (action) => action.placement !== "overflow",
  );
  const overflowActions = actions.filter(
    (action) => action.placement === "overflow",
  );

  useEffect(() => {
    if (!overflowOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(event.target as Node)
      ) {
        setOverflowOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOverflowOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [overflowOpen]);

  return (
    <>
      {children}

      {inlineActions.map((action) => {
        const content = <ActionContent action={action} />;

        if (action.href) {
          return (
            <a
              key={action.key}
              href={action.href}
              target="_blank"
              rel="noreferrer"
              title={action.title}
              className={actionClass(action.tone)}
            >
              {content}
            </a>
          );
        }

        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
            className={`${actionClass(action.tone)} disabled:opacity-40`}
          >
            {content}
          </button>
        );
      })}

      {overflowActions.length ? (
        <div ref={overflowRef} className="relative">
          <button
            type="button"
            aria-label={overflowLabel}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((current) => !current)}
            className="wk-button wk-button-ghost wk-button-sm"
          >
            <WkIcon name="Ellipsis" size={16} />
          </button>

          {overflowOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-wk-border bg-wk-surface p-1.5 shadow-lg"
            >
              {overflowActions.map((action) => (
                <div key={action.key}>
                  {action.separatorBefore ? (
                    <div className="my-1 h-px bg-wk-border" />
                  ) : null}

                  {action.href ? (
                    <a
                      role="menuitem"
                      href={action.href}
                      target="_blank"
                      rel="noreferrer"
                      title={action.title}
                      onClick={() => setOverflowOpen(false)}
                      className={overflowActionClass(action.tone)}
                    >
                      <ActionContent action={action} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      title={action.title}
                      onClick={() => {
                        setOverflowOpen(false);
                        action.onClick?.();
                      }}
                      className={`${overflowActionClass(action.tone)} disabled:opacity-40`}
                    >
                      <ActionContent action={action} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
