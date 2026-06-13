import { useState, useRef, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type { GuideSection, GuideSectionType } from "@/pages/guides/detail/sectionTypes";
import SectionForm from "./SectionForm";

interface SectionCardProps {
  section: GuideSection;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const TYPE_LABELS: Record<GuideSectionType, string> = {
  hero: "Hero (Standard)",
  hero_dossier: "Hero (Dossier)",
  hero_literary: "Hero (Literary)",
  quote: "Quote / Pullquote",
  context_columns: "Context Columns",
  numbered_chapters: "Numbered Chapters",
  preview_mosaic: "Preview Mosaic",
  curator_profile: "Curator Profile",
  pavilions_grid: "Pavilions Grid",
  focus_cards: "Focus Cards",
  sample_pages: "Sample Pages",
  download_form: "Download Form",
  numbered_list: "Numbered List",
  discipline_grid: "Discipline Grid",
  watchlist: "Watchlist",
  timeline: "Timeline",
  follow_form: "Follow Form",
  share_bar: "Share Bar",
  prose_article: "Prose Article",
  next_chapter: "Next Chapter",
  page_footer: "Page Footer",
  artists_grid: "Artists Grid",
};

export default function SectionCard({
  section,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: SectionCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      onDragStart(e, index);
    },
    [index, onDragStart]
  );

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, index); }}
      onDragEnd={onDragEnd}
      onDrop={(e) => { e.preventDefault(); onDrop(e, index); }}
      className={`group rounded-xl border transition-all ${
        isExpanded
          ? "border-[var(--wk-brand)]/30 bg-[var(--wk-surface)] ring-1 ring-[var(--wk-brand)]/10"
          : "border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-border-strong)]"
      }`}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--wk-bg-subtle)] cursor-grab active:cursor-grabbing text-[var(--wk-text-faint)]">
          <WkIcon name="GripVertical" size={14} />
        </div>

        {/* Section number */}
        <span className="text-[10px] font-bold text-[var(--wk-text-faint)] bg-[var(--wk-bg-subtle)] rounded-md px-1.5 py-0.5 min-w-[28px] text-center">
          {index + 1}
        </span>

        {/* Type badge */}
        <span className="inline-flex items-center rounded-md bg-[var(--wk-info-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-info)] uppercase">
          {TYPE_LABELS[section.type] || section.type}
        </span>

        {/* Title */}
        <span className="flex-1 text-[13px] font-semibold text-[var(--wk-text)] truncate">
          {section.title || `Untitled ${section.type}`}
        </span>

        {/* Expand/collapse chevron */}
        <div className="flex items-center justify-center w-5 h-5 text-[var(--wk-text-faint)]">
          <WkIcon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--wk-divider)]">
          <div className="px-4 py-3 space-y-3">
            {/* Key field */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] w-16 shrink-0">
                Key
              </label>
              <input
                type="text"
                value={section.key}
                readOnly
                className="flex-1 text-[12px] font-mono text-[var(--wk-text-muted)] bg-[var(--wk-bg-subtle)] rounded-md px-2 py-1 outline-none"
              />
            </div>

            {/* Title field */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] w-16 shrink-0">
                Title
              </label>
              <input
                type="text"
                value={section.title}
                onChange={(e) => onUpdate({ ...section.data, _title: e.target.value } as any)}
                placeholder="Section display title"
                className="flex-1 text-[13px] text-[var(--wk-text)] bg-transparent border-b border-[var(--wk-divider)] outline-none pb-0.5 placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>

            {/* Section data JSON editor */}
            <SectionForm
              data={section.data}
              type={section.type}
              onChange={onUpdate}
            />
          </div>

          {/* Delete button */}
          <div className="px-4 pb-3 pt-0 flex items-center gap-2 border-t border-[var(--wk-divider)] mt-1">
            {!showDelete ? (
              <button
                onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
                className="flex items-center gap-1 text-[11px] text-[var(--wk-text-faint)] hover:text-[var(--wk-danger)] transition-colors cursor-pointer"
              >
                <WkIcon name="Trash2" size={12} />
                Delete section
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--wk-danger)] font-semibold">Delete this section?</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-[11px] font-bold text-[var(--wk-danger)] hover:underline cursor-pointer"
                >
                  Yes
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDelete(false); }}
                  className="text-[11px] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}