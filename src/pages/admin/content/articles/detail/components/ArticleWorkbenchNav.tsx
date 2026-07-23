import { useEffect, useRef } from "react";
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

type WorkbenchGroup = {
  label: string;
  modes: ArticleWorkbenchMode[];
};

interface Props {
  activeMode: ArticleWorkbenchMode;
  onModeChange: (mode: ArticleWorkbenchMode) => void;
}

const WORKBENCH_MODES: WorkbenchModeDefinition[] = [
  {
    key: "write",
    label: "Document",
    description: "Write, suggest, or view the Article document.",
    icon: "Pencil",
  },
  {
    key: "media",
    label: "Media",
    description: "Prepare the hero image and Article media.",
    icon: "Image",
  },
  {
    key: "seo",
    label: "SEO and Social",
    description: "Prepare search metadata and sharing previews.",
    icon: "Search",
  },
  {
    key: "review",
    label: "Review",
    description: "Inspect the governed version and review decisions.",
    icon: "Shield",
  },
  {
    key: "publishing",
    label: "Publish",
    description: "Control visibility, timing, preview access, and publication.",
    icon: "Globe",
  },
  {
    key: "history",
    label: "History",
    description: "Inspect lifecycle and revision history.",
    icon: "History",
  },
  {
    key: "recovery",
    label: "Recovery",
    description: "Restore earlier work safely as a draft.",
    icon: "Archive",
  },
];

const WORKBENCH_GROUPS: WorkbenchGroup[] = [
  { label: "Compose", modes: ["write", "media"] },
  { label: "Prepare", modes: ["seo"] },
  { label: "Workflow", modes: ["review", "publishing"] },
  { label: "Record", modes: ["history", "recovery"] },
];

function definitionFor(mode: ArticleWorkbenchMode) {
  return (
    WORKBENCH_MODES.find((definition) => definition.key === mode) ??
    WORKBENCH_MODES[0]
  );
}

export function ArticleWorkbenchNav({
  activeMode,
  onModeChange,
}: Props) {
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const activeDefinition = definitionFor(activeMode);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeMode]);

  return (
    <nav
      aria-label="Article work modes"
      className="overflow-hidden rounded-xl border border-wk-border bg-wk-surface"
    >
      <div className="p-3 sm:hidden">
        <label
          htmlFor="article-work-mode"
          className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint"
        >
          Work Mode
        </label>

        <div className="relative">
          <select
            id="article-work-mode"
            value={activeMode}
            onChange={(event) =>
              onModeChange(event.target.value as ArticleWorkbenchMode)
            }
            className="w-full appearance-none rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 pr-10 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
          >
            {WORKBENCH_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.modes.map((mode) => {
                  const definition = definitionFor(mode);
                  return (
                    <option key={definition.key} value={definition.key}>
                      {definition.label}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>

          <WkIcon
            name="ChevronDown"
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-wk-text-faint"
          />
        </div>

        <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">
          {activeDefinition.description}
        </p>
      </div>

      <div className="hidden items-center gap-1 overflow-x-auto p-2 sm:flex">
        {WORKBENCH_GROUPS.map((group, groupIndex) => (
          <div
            key={group.label}
            className="flex shrink-0 items-center gap-1"
          >
            {groupIndex > 0 ? (
              <div
                aria-hidden="true"
                className="mx-1 h-7 w-px bg-wk-border"
              />
            ) : null}

            <span className="px-2 text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
              {group.label}
            </span>

            {group.modes.map((mode) => {
              const definition = definitionFor(mode);
              const active = definition.key === activeMode;

              return (
                <button
                  key={definition.key}
                  ref={active ? activeTabRef : undefined}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onModeChange(definition.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${
                    active
                      ? "bg-wk-brand text-wk-brand-on"
                      : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                  }`}
                >
                  <WkIcon name={definition.icon} size={13} />
                  {definition.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
