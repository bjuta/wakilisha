import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { WkIcon } from "@/components/design-system/Icon";
import "./ContextHelp.css";

/** Anchored guidance. Portal escapes clipped workspaces; measurements are
 * viewport-relative so the note stays next to the invoking control on phones.
 */
export function WkContextHelp({
  label,
  title,
  children,
  align = "start",
}: {
  label: string;
  title: string;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const id = useId().replace(/:/g, "");
  const shellRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const margin = 14;
    const gap = 8;
    const update = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const view = window.visualViewport;
      const viewportLeft = view?.offsetLeft ?? 0;
      const viewportTop = view?.offsetTop ?? 0;
      const viewportWidth = view?.width ?? window.innerWidth;
      const viewportHeight = view?.height ?? window.innerHeight;
      const bounds = trigger.getBoundingClientRect();

      // Measure actual content, not an assumed character count or page height.
      const width = Math.min(320, Math.max(1, viewportWidth - margin * 2));
      const panelHeight = panel.getBoundingClientRect().height || panel.scrollHeight || 140;
      const roomAbove = bounds.top - viewportTop - margin - gap;
      const roomBelow = viewportTop + viewportHeight - bounds.bottom - margin - gap;
      const above = roomBelow < panelHeight && roomAbove > roomBelow;
      const available = Math.max(1, above ? roomAbove : roomBelow);
      const height = Math.min(panelHeight, available);
      const maxLeft = viewportLeft + viewportWidth - margin - width;
      const preferredLeft = align === "end" ? bounds.right - width : bounds.left;
      const left = Math.max(viewportLeft + margin, Math.min(maxLeft, preferredLeft));
      const top = above ? bounds.top - gap - height : bounds.bottom + gap;

      setPosition({
        position: "fixed",
        top: Math.max(viewportTop + margin, top),
        left,
        right: "auto",
        bottom: "auto",
        width,
        maxWidth: "none",
        maxHeight: available,
        overflowY: "auto",
        visibility: "visible",
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!shellRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    setPosition(null);
    triggerRef.current?.focus();
  };

  return (
    <span ref={shellRef} className="wk-context-help" data-open={open ? "true" : "false"}>
      <button
        ref={triggerRef}
        type="button"
        className="wk-context-help-trigger"
        aria-expanded={open}
        aria-controls={"wk-help-content-" + id}
        onClick={() => {
          setPosition(null);
          setOpen(current => !current);
        }}
      >
        <WkIcon name="Info" size={15} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {open && createPortal(
        <span
          ref={panelRef}
          id={"wk-help-content-" + id}
          role="region"
          aria-labelledby={"wk-help-title-" + id}
          className={"wk-context-help-panel is-" + align}
          style={position ?? {
            position: "fixed",
            left: 0,
            top: 0,
            right: "auto",
            bottom: "auto",
            visibility: "hidden",
            maxWidth: "calc(100vw - 28px)",
          }}
        >
          <span className="wk-context-help-head">
            <strong id={"wk-help-title-" + id}>{title}</strong>
            <button
              type="button"
              className="wk-context-help-close"
              aria-label="Close help"
              onClick={dismiss}
            >
              <WkIcon name="X" size={15} aria-hidden="true" />
            </button>
          </span>
          <span className="wk-context-help-body">{children}</span>
        </span>,
        document.body,
      )}
    </span>
  );
}
