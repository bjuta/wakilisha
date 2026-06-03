import { useState, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { RichTextEditor } from "@/components/design-system/editorial/RichTextEditor";

interface Props {
  title: string;
  excerpt: string;
  content: string;
  onTitleChange: (v: string) => void;
  onExcerptChange: (v: string) => void;
  onContentChange: (v: string) => void;
}

export function ArticleContentEditor({
  title,
  excerpt,
  content,
  onTitleChange,
  onExcerptChange,
  onContentChange,
}: Props) {
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const wordCount = content
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const charCount = content.replace(/<[^>]*>/g, "").length;

  function handleReplace() {
    if (!findText) return;
    const replaced = content.replaceAll(findText, replaceText);
    onContentChange(replaced);
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <WkSurface className="p-5">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Article title..."
          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 py-3 text-[18px] font-bold text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
        />
      </WkSurface>

      {/* Excerpt */}
      <WkSurface className="p-5">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Excerpt / Summary
          </label>
          <span className="text-[11px] text-[var(--wk-text-faint)]">{excerpt.length} / 500</span>
        </div>
        <textarea
          value={excerpt}
          onChange={(e) => onExcerptChange(e.target.value)}
          placeholder="Short summary shown in article cards and SEO descriptions..."
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] resize-none transition-colors"
        />
      </WkSurface>

      {/* Content Editor */}
      <WkSurface className="overflow-hidden">
        {/* Find & Replace Bar */}
        {showFindReplace && (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] whitespace-nowrap">
                Find
              </label>
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Find text..."
                className="flex-1 min-w-0 rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1.5 text-[12px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] whitespace-nowrap">
                Replace
              </label>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with..."
                className="flex-1 min-w-0 rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-1.5 text-[12px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
              />
            </div>
            <button
              onClick={handleReplace}
              disabled={!findText}
              className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
            >
              Replace All
            </button>
          </div>
        )}

        {/* Rich Text Editor */}
        <RichTextEditor
          value={content}
          onChange={onContentChange}
          placeholder="Start writing your article..."
          minHeight={500}
        />
      </WkSurface>
    </div>
  );
}