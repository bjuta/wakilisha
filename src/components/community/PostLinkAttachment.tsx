import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  postLinkFallbackLabel,
  resolvePostLinkPreview,
  type PostLinkPreview,
} from "@/services/community/postLinkPreview";

export type PostLinkPreviewState =
  | "loading"
  | "rich"
  | "fallback";

export function PostLinkAttachment({
  linkUrl,
  linkLabel = null,
  className = "",
  interactive = true,
  compact = false,
  onPreviewStateChange,
}: {
  linkUrl: string;
  linkLabel?: string | null;
  className?: string;
  interactive?: boolean;
  compact?: boolean;
  onPreviewStateChange?: (
    state: PostLinkPreviewState,
  ) => void;
}) {
  const [preview, setPreview] =
    useState<PostLinkPreview | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;
    setPreview(null);
    setResolved(false);
    onPreviewStateChange?.("loading");

    void resolvePostLinkPreview(linkUrl).then(
      (nextPreview) => {
        if (!alive) return;
        setPreview(nextPreview);
        setResolved(true);
        onPreviewStateChange?.(
          nextPreview ? "rich" : "fallback",
        );
      },
    );

    return () => {
      alive = false;
    };
  }, [linkUrl, onPreviewStateChange]);

  if (!resolved) {
    return (
      <div
        data-post-link-attachment="loading"
        className={`overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] ${className}`}
        aria-label="Loading Link preview"
      >
        <div className="animate-pulse p-4">
          <div className="h-3 w-24 rounded-full bg-[var(--wk-brand-soft)]" />
          <div className="mt-3 h-5 w-4/5 rounded-full bg-[var(--wk-bg)]" />
          <div className="mt-2 h-3 w-full rounded-full bg-[var(--wk-bg)]" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-[var(--wk-bg)]" />
        </div>
      </div>
    );
  }

  if (!preview) {
    const label =
      postLinkFallbackLabel(linkUrl, linkLabel);

    const fallbackClassName =
      `inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 py-2 text-[11px] font-black text-[var(--wk-text)] transition-colors hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] ${className}`;

    if (!interactive) {
      return (
        <div
          data-post-link-attachment="fallback"
          className={fallbackClassName}
        >
          {label}
          <i
            className="ri-external-link-line"
            aria-hidden="true"
          />
        </div>
      );
    }

    return (
      <a
        data-post-link-attachment="fallback"
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={fallbackClassName}
      >
        {label}
        <i
          className="ri-external-link-line"
          aria-hidden="true"
        />
      </a>
    );
  }

  const card = (
    <>
      {preview.imageUrl ? (
        <div
          className={
            compact
              ? "aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)]"
              : "aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)] sm:aspect-auto sm:min-h-[150px]"
          }
        >
          <img
            src={preview.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div
        className={
          compact
            ? "p-3.5"
            : "p-4 sm:p-5"
        }
      >
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-brand)]">
          <span>{preview.siteName}</span>
          <span aria-hidden="true">·</span>
          <span>{preview.section}</span>
        </div>

        <div
          className={
            compact
              ? "mt-2 line-clamp-2 text-[14px] font-black leading-[1.2] text-[var(--wk-text)]"
              : "mt-2 line-clamp-2 text-[17px] font-black leading-[1.15] tracking-[-0.02em] text-[var(--wk-text)] sm:text-[19px]"
          }
        >
          {preview.title}
        </div>

        {preview.description ? (
          <p
            className={
              compact
                ? "mt-2 line-clamp-2 text-[11px] font-medium leading-[1.45] text-[var(--wk-text-muted)]"
                : "mt-2 line-clamp-3 text-[12px] font-medium leading-[1.5] text-[var(--wk-text-muted)] sm:text-[13px]"
            }
          >
            {preview.description}
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[var(--wk-text-faint)]">
          <span>{preview.displayHost}</span>
          <i
            className="ri-arrow-right-up-line"
            aria-hidden="true"
          />
        </div>
      </div>
    </>
  );

  const wrapperClassName =
    `overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-colors hover:border-[var(--wk-brand)]/45 ${
      preview.imageUrl && !compact
        ? "sm:grid sm:grid-cols-[180px_minmax(0,1fr)]"
        : ""
    } ${className}`;

  if (!interactive) {
    return (
      <div
        data-post-link-attachment="rich"
        className={wrapperClassName}
      >
        {card}
      </div>
    );
  }

  if (preview.internalPath) {
    return (
      <Link
        data-post-link-attachment="rich"
        to={preview.internalPath}
        className={`block ${wrapperClassName}`}
        aria-label={`Open ${preview.title}`}
      >
        {card}
      </Link>
    );
  }

  return (
    <a
      data-post-link-attachment="rich"
      href={preview.canonicalUrl || linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block ${wrapperClassName}`}
      aria-label={`Open ${preview.title}`}
    >
      {card}
    </a>
  );
}
