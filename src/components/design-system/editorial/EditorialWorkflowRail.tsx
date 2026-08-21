export interface EditorialWorkflowItem {
  id: string;
  label: string;
}

export interface EditorialWorkflowGroup {
  label: string;
  items: EditorialWorkflowItem[];
}

export function EditorialWorkflowRail({
  groups,
  activeId,
  onChange,
}: {
  groups: EditorialWorkflowGroup[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav
      className="flex max-w-full items-center gap-2 overflow-x-auto rounded-xl border border-wk-border bg-wk-surface px-2 py-2 shadow-sm"
      aria-label="Editorial workflow"
    >
      {groups.map((group, groupIndex) => (
        <div key={group.label} className="flex shrink-0 items-center gap-1">
          {groupIndex > 0 ? (
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-wk-border" />
          ) : null}
          <span className="px-2 text-[9px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
            {group.label}
          </span>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={activeId === item.id ? "page" : undefined}
              onClick={() => onChange(item.id)}
              className={`rounded-lg px-3 py-2 text-[11px] font-black transition-colors ${
                activeId === item.id
                  ? "bg-wk-brand-soft text-wk-brand"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
