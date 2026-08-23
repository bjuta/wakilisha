import type { ReactNode } from "react";
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

export function AdminRecordActions({
  actions = [],
  children,
}: {
  actions?: AdminRecordActionDescriptor[];
  children?: ReactNode;
}) {
  return (
    <>
      {children}
      {actions.map((action) => {
        const content = (
          <>
            <WkIcon name={action.icon} size={14} />
            {action.label}
          </>
        );

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
    </>
  );
}
