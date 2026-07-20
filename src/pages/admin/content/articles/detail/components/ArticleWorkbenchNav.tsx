import { WkIcon, type WkIconName } from "@/components/design-system/Icon";

export type ArticleWorkbenchMode =
  | "write"
  | "media"
  | "seo"
  | "review"
  | "publishing"
  | "history"
  | "recovery";

type WorkbenchModeDefinition = {
  key: ArticleWorkbenchMode;
  label: string;
  description: string;
  icon: WkIconName;
};

interface Props {
  activeMode: ArticleWorkbenchMode;
  status: string | null;
  statusLabel?: string;
  isDirty: boolean;
  onModeChange: (mode: ArticleWorkbenchMode) => void;
}

const WORKBENCH_MODES: WorkbenchModeDefinition[] = [
  {
    key: "write",
    label: "Write",
    description: "Draft the story and set its core editorial context.",
    icon: "Pencil",
  },
  {
    key: "media",
    label: "Media",
    description: "Choose the hero image and work with the media library.",
    icon: "Image",
  },
  {
    key: "seo",
    label: "SEO and Social",
    description: "Prepare search metadata and preview how the article will appear.",
    icon: "Search",
  },
  {
    key: "review",
    label: "Review",
    description: "See review controls, decisions, and the article’s governed lifecycle.",
    icon: "Shield",
  },
  {
    key: "publishing",
    label: "Publishing",
    description: "Set visibility, scheduling, preview access, and final publishing controls.",
    icon: "Globe",
  },
  {
    key: "history",
    label: "History",
    description: "Review versions, lifecycle events, and available restore points.",
    icon: "History",
  },
  {
    key: "recovery",
    label: "Recovery",
    description: "Find archive context and recover earlier work.",
    icon: "Archive",
  },
];

function getStatusLabel(status: string | null): string {
  if (status === "publish") return "Published";
  if (status === "future") return "Scheduled";
  if (status === "pending") return "Pending Review";
  if (status === "trash") return "Archived";
  return "Draft";
}

export function ArticleWorkbenchNav({
  activeMode,
  status,
  statusLabel,
  isDirty,
  onModeChange,
}: Props) {
  const activeDefinition =
    WORKBENCH_MODES.find((mode) => mode.key === activeMode) ??
    WORKBENCH_MODES[0];

  return (
    <section
      aria-label="Article Workbench"
      className="overflow-hidden rounded-2xl border border-wk-border bg-wk-surface"
    >
      <div className="flex flex-col gap-3 border-b border-wk-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-text-faint">
            Article Workbench
          </div>
          <div className="mt-1 flex items-center gap-2">
            <WkIcon
              name={activeDefinition.icon}
              size={17}
              className="text-wk-brand"
            />
            <h2 className="text-[16px] font-black text-wk-text">
              {activeDefinition.label}
            </h2>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
            {activeDefinition.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-wk-border bg-wk-bg-subtle px-2.5 py-1 text-[10px] font-bold text-wk-text-muted">
            {statusLabel ?? getStatusLabel(status)}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              isDirty
                ? "border-wk-warning/30 bg-wk-warning-soft text-wk-warning"
                : "border-wk-success/30 bg-wk-success-soft text-wk-success"
            }`}
          >
            {isDirty ? "Unsaved Changes" : "All Saved"}
          </span>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Article work modes"
        className="flex gap-1 overflow-x-auto px-2 py-2"
      >
        {WORKBENCH_MODES.map((mode) => {
          const isActive = mode.key === activeMode;

          return (
            <button
              key={mode.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onModeChange(mode.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${
                isActive
                  ? "bg-wk-brand text-wk-brand-on"
                  : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
              }`}
            >
              <WkIcon name={mode.icon} size={13} />
              {mode.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
