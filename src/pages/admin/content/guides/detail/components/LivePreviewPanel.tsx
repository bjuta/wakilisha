import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import GuideSectionRenderer from "@/pages/guides/detail/sections/GuideSectionRenderer";
import type { GuideSection } from "@/pages/guides/detail/sectionTypes";

interface LivePreviewPanelProps {
  sections: GuideSection[];
}

export default function LivePreviewPanel({ sections }: LivePreviewPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="sticky top-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-divider)]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-2 h-2 rounded-full bg-[var(--wk-success)] animate-pulse" />
          <span className="text-[12px] font-bold text-[var(--wk-text)] uppercase tracking-wider">Live Preview</span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--wk-bg-subtle)] text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
        >
          <WkIcon name={isCollapsed ? "Maximize2" : "Minimize2"} size={13} />
        </button>
      </div>

      {/* Preview iframe */}
      {!isCollapsed && (
        <div className="bg-[var(--wk-bg)]">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-bg-subtle)] text-[var(--wk-text-faint)] mb-3">
                <WkIcon name="Layout" size={20} />
              </div>
              <p className="text-[13px] font-semibold text-[var(--wk-text-muted)]">No sections yet</p>
              <p className="text-[11px] text-[var(--wk-text-faint)] mt-1">Add sections using the left panel to see a live preview here.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(100vh-180px)]">
              <div className="scale-[0.35] origin-top-left w-[285%]">
                {sections.map((section, index) => (
                  <GuideSectionRenderer
                    key={`${section.key}-${index}`}
                    section={section}
                  />
                ))}
              </div>
              <div className="px-4 py-3 border-t border-[var(--wk-divider)]">
                <p className="text-[10px] text-[var(--wk-text-faint)]">
                  Preview rendered at 35% scale — {sections.length} section{sections.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}