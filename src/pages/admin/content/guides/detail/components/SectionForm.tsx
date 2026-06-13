import { useState, useEffect } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type { GuideSectionType } from "@/pages/guides/detail/sectionTypes";

interface SectionFormProps {
  data: Record<string, unknown>;
  type: GuideSectionType;
  onChange: (data: Record<string, unknown>) => void;
}

export default function SectionForm({ data, type, onChange }: SectionFormProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync JSON text when data prop changes
  useEffect(() => {
    try {
      setJsonText(JSON.stringify(data, null, 2));
      setError(null);
    } catch {
      setJsonText("");
    }
  }, [data]);

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setError(null);
      onChange(parsed);
    } catch (e: any) {
      setError(e.message || "Invalid JSON");
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setError(null);
      onChange(parsed);
    } catch (e: any) {
      setError(e.message || "Invalid JSON");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Enter to save
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
            Data (JSON)
          </label>
          <span className="text-[10px] text-[var(--wk-text-faint)]">
            type: {type}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFormat}
            className="flex items-center gap-1 text-[10px] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
          >
            <WkIcon name="Wand" size={10} />
            Format
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setError(null); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          rows={Math.max(6, Math.min(30, jsonText.split("\n").length))}
          className={`w-full text-[12px] font-mono leading-relaxed rounded-lg border px-3 py-2 outline-none resize-y transition-colors ${
            error
              ? "border-[var(--wk-danger)]/40 bg-[var(--wk-danger-soft)]/30 text-[var(--wk-text)]"
              : "border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text)] focus:border-[var(--wk-brand)]/40"
          }`}
          placeholder='{"key": "value"}'
        />
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-danger)]">
          <WkIcon name="AlertTriangle" size={11} />
          {error}
        </div>
      )}

      <p className="text-[10px] text-[var(--wk-text-faint)]">
        Shift+Enter to apply changes
      </p>
    </div>
  );
}