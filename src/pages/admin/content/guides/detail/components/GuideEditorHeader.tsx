import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type { GuidePageRecord } from "@/pages/guides/detail/sectionTypes";

interface GuideEditorHeaderProps {
  guide: GuidePageRecord;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  onTitleChange: (v: string) => void;
  onSubtitleChange: (v: string) => void;
  onFormatChange: (v: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onBack: () => void;
}

const FORMATS = [
  { value: "field_guide", label: "Field Guide" },
  { value: "advance_dossier", label: "Advance Dossier" },
  { value: "literary_project", label: "Literary Project" },
];

export default function GuideEditorHeader({
  guide,
  isDirty,
  isSaving,
  isPublishing,
  onTitleChange,
  onSubtitleChange,
  onFormatChange,
  onSave,
  onPublish,
  onUnpublish,
  onBack,
}: GuideEditorHeaderProps) {
  const statusLabel = guide.status === "published" ? "Published" : guide.status === "draft" ? "Draft" : guide.status || "Draft";
  const statusColor =
    guide.status === "published"
      ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
      : "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]";

  return (
    <div className="space-y-4">
      {/* Top row: back, slug, status, actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
        >
          <WkIcon name="ArrowLeft" size={14} />
          Guides
        </button>

        <div className="h-4 w-px bg-[var(--wk-divider)]" />

        <span className="text-[12px] font-mono text-[var(--wk-text-muted)] bg-[var(--wk-bg-subtle)] rounded-md px-2 py-1">
          /{guide.slug}
        </span>

        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor}`}>
          {statusLabel}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {guide.status === "published" ? (
            <button
              onClick={onUnpublish}
              className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="EyeOff" size={14} />
              Unpublish
            </button>
          ) : (
            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name={isPublishing ? "Loader2" : "Send"} size={14} className={isPublishing ? "animate-spin" : ""} />
              {isPublishing ? "Publishing..." : "Publish"}
            </button>
          )}
          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className={`wk-button wk-button-sm whitespace-nowrap ${
              isDirty ? "wk-button-secondary" : "opacity-40 cursor-not-allowed border border-[var(--wk-border)] bg-transparent text-[var(--wk-text-muted)]"
            }`}
          >
            <WkIcon name={isSaving ? "Loader2" : "Save"} size={14} className={isSaving ? "animate-spin" : ""} />
            {isSaving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
          </button>
        </div>
      </div>

      {/* Title & metadata editing */}
      <div className="space-y-3">
        <input
          type="text"
          value={guide.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Guide title..."
          className="w-full text-[22px] font-black tracking-tight text-[var(--wk-text)] bg-transparent border-none outline-none placeholder:text-[var(--wk-text-faint)]"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={guide.subtitle || ""}
            onChange={(e) => onSubtitleChange(e.target.value)}
            placeholder="Subtitle (optional)"
            className="flex-1 min-w-[200px] text-[14px] text-[var(--wk-text-muted)] bg-transparent border-b border-[var(--wk-divider)] outline-none pb-1 placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)] transition-colors"
          />
          <select
            value={guide.guide_format || "field_guide"}
            onChange={(e) => onFormatChange(e.target.value)}
            className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text)] outline-none cursor-pointer"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <span className="text-[11px] text-[var(--wk-text-faint)]">
            {guide.sections.length} sections
          </span>
        </div>
      </div>
    </div>
  );
}