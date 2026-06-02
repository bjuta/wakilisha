import { WkSurface } from "@/components/design-system/primitives/Surface";

interface AdminChartsEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
}

export function AdminChartsEmptyState({
  icon,
  title,
  description,
  action,
}: AdminChartsEmptyStateProps) {
  return (
    <WkSurface className="p-10">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-wk-surface-raised text-wk-text-faint">
          <i className={`${icon} text-[22px]`} />
        </div>
        <h3 className="mt-4 text-[15px] font-bold text-wk-text">{title}</h3>
        <p className="mt-1 max-w-md text-[13px] text-wk-text-muted">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-4 py-2 text-[13px] font-semibold text-wk-brand-on transition-colors hover:opacity-90 whitespace-nowrap"
          >
            {action.icon && <i className={action.icon} />}
            {action.label}
          </button>
        )}
      </div>
    </WkSurface>
  );
}