import type { ReactNode } from "react";

interface ChapterNavProps {
  groups: string[];
  selected: string | "all";
  onSelect: (g: string | "all") => void;
}

export function ChapterNav({ groups, selected, onSelect }: ChapterNavProps) {
  return (
    <nav className="space-y-1">
      <button
        onClick={() => onSelect("all")}
        className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-all ${
          selected === "all"
            ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
            : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
        }`}
      >
        All groups
      </button>
      {groups.map((g) => (
        <button
          key={g}
          onClick={() => onSelect(g)}
          className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-all ${
            selected === g
              ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
              : "text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
          }`}
        >
          {g}
        </button>
      ))}
    </nav>
  );
}