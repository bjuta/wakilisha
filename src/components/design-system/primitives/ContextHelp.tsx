import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import "./ContextHelp.css";

/** Click-to-open contextual guidance. Unlike a hover-only tooltip, this works
 * on touch and keyboard and never conceals the operational source facts.
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
  const id = useId().replace(/:/g, "");
  const shellRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !shellRef.current?.contains(event.target)) {
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

  return (
    <span ref={shellRef} className="wk-context-help" data-open={open ? "true" : "false"}>
      <button
        onKeyDownCapture={(event) => {
          if (open && event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}
        ref={triggerRef}
        type="button"
        className="wk-context-help-trigger"
        aria-expanded={open}
        aria-controls={`wk-help-content-${id}`}
        onClick={() => setOpen(current => !current)}
      >
        <WkIcon name="Info" size={15} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {open ? (
        <span
          id={`wk-help-content-${id}`}
          role="region"
          aria-labelledby={`wk-help-title-${id}`}
          className={`wk-context-help-panel is-${align}`}
        >
          <span className="wk-context-help-head">
            <strong id={`wk-help-title-${id}`}>{title}</strong>
            <button
              type="button"
              className="wk-context-help-close"
              aria-label="Close help"
              onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
            >
              <WkIcon name="X" size={15} aria-hidden="true" />
            </button>
          </span>
          <span className="wk-context-help-body">{children}</span>
        </span>
      ) : null}
    </span>
  );
}
