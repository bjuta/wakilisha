import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Portal } from "@/components/base/Portal";
import { WkIcon } from "@/components/design-system/Icon";

interface OutlineItem {
  index: number;
  level: number;
  label: string;
}

interface Props {
  open: boolean;
  title: string;
  content: string;
  categoryCount: number;
  tagCount: number;
  onClose: () => void;
  children: ReactNode;
}

function buildOutline(content: string): OutlineItem[] {
  if (!content || typeof window === "undefined") {
    return [];
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(
    content,
    "text/html",
  );

  return Array.from(
    documentNode.body.querySelectorAll(
      "h1, h2, h3",
    ),
  )
    .map((heading, index) => ({
      index,
      level: Number(heading.tagName.slice(1)),
      label:
        heading.textContent?.trim() ||
        `Section ${index + 1}`,
    }))
    .filter((heading) => heading.label.length > 0);
}

export function ArticleWriteContextDrawer({
  open,
  title,
  content,
  categoryCount,
  tagCount,
  onClose,
  children,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef =
    useRef<HTMLButtonElement>(null);
  const previousFocusRef =
    useRef<HTMLElement | null>(null);
  const restoreFocusOnCloseRef = useRef(true);

  const outline = useMemo(
    () => buildOutline(content),
    [content],
  );

  useEffect(() => {
    if (!open) return;

    restoreFocusOnCloseRef.current = true;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousBodyOverflow =
      document.body.style.overflow;
    const previousHtmlOverflow =
      document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow =
      "hidden";

    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow =
        previousBodyOverflow;
      document.documentElement.style.overflow =
        previousHtmlOverflow;

      if (restoreFocusOnCloseRef.current) {
        previousFocusRef.current?.focus();
      }
    };
  }, [open]);

  function handleDialogKeyDown(
    event: KeyboardEvent<HTMLElement>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          "button:not([disabled])",
          "a[href]",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    ).filter(
      (element) =>
        !element.hasAttribute("hidden") &&
        element.getAttribute("aria-hidden") !==
          "true",
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function moveToHeading(index: number) {
    const headings =
      document.querySelectorAll<HTMLElement>(
        [
          "[data-article-editor-canvas] .ProseMirror h1",
          "[data-article-editor-canvas] .ProseMirror h2",
          "[data-article-editor-canvas] .ProseMirror h3",
        ].join(", "),
      );

    const target = headings.item(index);

    if (!target) return;

    restoreFocusOnCloseRef.current = false;
    onClose();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        target.setAttribute("tabindex", "-1");
        target.focus({
          preventScroll: true,
        });
      });
    });
  }

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[120] flex justify-end p-2 sm:p-4">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close Article Details"
          onClick={onClose}
          className="absolute inset-0 bg-black/40"
        />

        <aside
          id="article-write-context-drawer"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="article-details-title"
          onKeyDown={handleDialogKeyDown}
          data-article-details-scroll
          className="relative z-10 h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[min(440px,calc(100vw-1rem))] touch-pan-y overflow-y-auto overscroll-y-contain rounded-2xl border border-wk-border bg-wk-surface shadow-2xl [scrollbar-gutter:stable] sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)]"
        >
          <header className="sticky top-0 z-20 border-b border-wk-border bg-wk-surface px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
                  Writing Context
                </div>

                <h2
                  id="article-details-title"
                  className="mt-1 text-[16px] font-black text-wk-text"
                >
                  Article Details
                </h2>

                <p className="mt-1 truncate text-[11px] text-wk-text-muted">
                  {title || "Untitled Article"}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close Article Details"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-wk-border text-wk-text-muted transition-colors hover:bg-wk-surface-raised hover:text-wk-text"
              >
                <WkIcon name="X" size={16} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-wk-text-muted">
              <span className="rounded-full bg-wk-bg-subtle px-2.5 py-1">
                {outline.length} sections
              </span>

              <span className="rounded-full bg-wk-bg-subtle px-2.5 py-1">
                {categoryCount} categories
              </span>

              <span className="rounded-full bg-wk-bg-subtle px-2.5 py-1">
                {tagCount} tags
              </span>
            </div>
          </header>

          <div className="p-4">
            <section className="mb-5 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
              <div className="flex items-center gap-2">
                <WkIcon
                  name="ListTree"
                  size={14}
                  className="text-wk-brand"
                />

                <h3 className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
                  Document Outline
                </h3>
              </div>

              {outline.length > 0 ? (
                <div className="mt-3 space-y-1">
                  {outline.map((heading) => (
                    <button
                      key={`${heading.index}-${heading.label}`}
                      type="button"
                      onClick={() =>
                        moveToHeading(
                          heading.index,
                        )
                      }
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[12px] leading-4 text-wk-text-muted transition-colors hover:bg-wk-surface hover:text-wk-text"
                      style={{
                        paddingLeft: `${
                          8 +
                          (heading.level - 1) *
                            12
                        }px`,
                      }}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-[9px] font-bold text-wk-text-faint">
                        H{heading.level}
                      </span>

                      <span>
                        {heading.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] leading-4 text-wk-text-faint">
                  Add headings to create a
                  navigable Article outline.
                </p>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 px-1">
                <WkIcon
                  name="SlidersHorizontal"
                  size={14}
                  className="text-wk-brand"
                />

                <h3 className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">
                  Editorial Details
                </h3>
              </div>

              {children}
            </section>
          </div>
        </aside>
      </div>
    </Portal>
  );
}
