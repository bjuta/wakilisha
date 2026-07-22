import { WkIcon } from "@/components/design-system/Icon";

export function ArticlePreviewModeBanner() {
  return (
    <div
      role="status"
      aria-label="Article Preview Mode"
      className="sticky top-0 z-[60] border-b border-wk-warning/25 bg-wk-warning-soft"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-wk-warning">
          <WkIcon name="Eye" size={14} />

          <span>Preview Mode</span>

          <span className="rounded-full bg-wk-warning/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]">
            Version-bound
          </span>
        </div>

        <p className="text-[10px] leading-4 text-wk-text-muted sm:text-[11px]">
          This is a shareable preview link for review purposes.
        </p>
      </div>
    </div>
  );
}
