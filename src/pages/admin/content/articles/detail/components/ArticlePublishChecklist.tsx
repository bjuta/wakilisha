import { useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";

/* ─── Types ─── */

export interface ChecklistItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "warning";
  detail: string;
}

interface Props {
  title: string;
  content: string;
  excerpt: string;
  heroImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: string;
  categories: string[];
  onClose: () => void;
  onPublishAnyway: () => void;
  isPublishing: boolean;
}

/* ─── Word count helper ─── */
function wordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

/* ─── Component ─── */

export function ArticlePublishChecklist({
  title,
  content,
  excerpt,
  heroImageUrl,
  seoTitle,
  seoDescription,
  publishedAt,
  categories,
  onClose,
  onPublishAnyway,
  isPublishing,
}: Props) {
  const items: ChecklistItem[] = useMemo(() => {
    const wc = wordCount(content);
    const isScheduled = publishedAt && new Date(publishedAt) > new Date();

    return [
      {
        id: "title",
        label: "Article title",
        status: title.trim().length > 0 ? "pass" : "fail",
        detail: title.trim().length > 0 ? "Title is set" : "Title cannot be empty",
      },
      {
        id: "content-length",
        label: "Content length (50+ words)",
        status: wc >= 50 ? "pass" : wc > 0 ? "warning" : "fail",
        detail:
          wc >= 50
            ? `${wc} words — great`
            : wc > 0
            ? `Only ${wc} words — consider writing more before publishing`
            : "Article has no body content",
      },
      {
        id: "excerpt",
        label: "Excerpt / dek",
        status: excerpt.trim().length > 0 ? "pass" : "warning",
        detail: excerpt.trim().length > 0 ? "Excerpt is set" : "No excerpt — will be auto-generated from content",
      },
      {
        id: "hero-image",
        label: "Hero image",
        status: heroImageUrl.trim().length > 0 ? "pass" : "warning",
        detail: heroImageUrl.trim().length > 0 ? "Hero image is set" : "No hero image — article may look bare on listings",
      },
      {
        id: "seo-title",
        label: "SEO title (30–60 chars)",
        status:
          seoTitle.length >= 30 && seoTitle.length <= 60
            ? "pass"
            : seoTitle.length > 0
            ? "warning"
            : "warning",
        detail:
          seoTitle.length >= 30 && seoTitle.length <= 60
            ? `${seoTitle.length} chars — optimal`
            : seoTitle.length > 0
            ? `${seoTitle.length} chars — ideal is 30–60 for search engines`
            : "No SEO title — article title will be used instead",
      },
      {
        id: "seo-description",
        label: "Meta description (120–160 chars)",
        status:
          seoDescription.length >= 120 && seoDescription.length <= 160
            ? "pass"
            : seoDescription.length > 0
            ? "warning"
            : "warning",
        detail:
          seoDescription.length >= 120 && seoDescription.length <= 160
            ? `${seoDescription.length} chars — optimal`
            : seoDescription.length > 0
            ? `${seoDescription.length} chars — ideal is 120–160 for search previews`
            : "No meta description — excerpt will be used instead",
      },
      {
        id: "categories",
        label: "Categories",
        status: categories.length > 0 ? "pass" : "warning",
        detail: categories.length > 0 ? `${categories.length} categor${categories.length > 1 ? "ies" : "y"} assigned` : "No categories — harder for readers to discover",
      },
      {
        id: "schedule",
        label: isScheduled ? "Scheduled publish" : "Immediate publish",
        status: "pass",
        detail: isScheduled
          ? `Will go live on ${new Date(publishedAt).toLocaleString()}`
          : "Article will be published immediately",
      },
    ];
  }, [title, content, excerpt, heroImageUrl, seoTitle, seoDescription, publishedAt, categories]);

  const failCount = items.filter((i) => i.status === "fail").length;
  const warningCount = items.filter((i) => i.status === "warning").length;
  const passCount = items.filter((i) => i.status === "pass").length;
  const canPublish = failCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--wk-border)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <WkIcon name="ClipboardCheck" size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[var(--wk-text)]">Pre-Publish Checklist</h3>
              <p className="text-[11px] text-[var(--wk-text-muted)]">
                {passCount}/{items.length} checks passed
                {failCount > 0 && ` · ${failCount} blocking`}
                {warningCount > 0 && ` · ${warningCount} suggestion${warningCount > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--wk-surface-raised)] transition-colors cursor-pointer"
          >
            <WkIcon name="X" size={16} className="text-[var(--wk-text-faint)]" />
          </button>
        </div>

        {/* Checklist items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                item.status === "fail"
                  ? "bg-[var(--wk-danger-soft)]/50"
                  : item.status === "warning"
                  ? "bg-[var(--wk-warning-soft)]/40"
                  : ""
              }`}
            >
              {/* Status icon */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center mt-0.5">
                {item.status === "pass" ? (
                  <WkIcon name="CheckCircle2" size={16} className="text-[var(--wk-success)]" />
                ) : item.status === "warning" ? (
                  <WkIcon name="AlertTriangle" size={16} className="text-[var(--wk-warning)]" />
                ) : (
                  <WkIcon name="XCircle" size={16} className="text-[var(--wk-danger)]" />
                )}
              </div>
              {/* Content */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[13px] font-semibold ${
                    item.status === "fail"
                      ? "text-[var(--wk-danger)]"
                      : item.status === "warning"
                      ? "text-[var(--wk-warning)]"
                      : "text-[var(--wk-text)]"
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-[11px] text-[var(--wk-text-muted)] leading-relaxed mt-0.5">
                  {item.detail}
                </p>
              </div>
              {/* Badge */}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  item.status === "pass"
                    ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                    : item.status === "warning"
                    ? "bg-[var(--wk-warning-soft)]/80 text-[var(--wk-warning)]"
                    : "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                }`}
              >
                {item.status === "pass" ? "OK" : item.status === "warning" ? "FYI" : "REQUIRED"}
              </span>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="border-t border-[var(--wk-border)] px-6 py-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          {canPublish ? (
            <button
              onClick={onPublishAnyway}
              disabled={isPublishing}
              className="wk-button wk-button-primary wk-button-sm flex-1 whitespace-nowrap cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-[14px]" />
                  Publishing…
                </>
              ) : (
                <>
                  <WkIcon name="Globe" size={14} />
                  {warningCount > 0 ? "Publish Anyway" : "Publish Now"}
                </>
              )}
            </button>
          ) : (
            <button
              disabled
              className="wk-button wk-button-sm flex-1 whitespace-nowrap opacity-40 cursor-not-allowed bg-[var(--wk-border)] text-[var(--wk-text-faint)]"
            >
              <WkIcon name="XCircle" size={14} />
              Fix {failCount} issue{failCount > 1 ? "s" : ""} first
            </button>
          )}
        </div>
      </div>
    </div>
  );
}