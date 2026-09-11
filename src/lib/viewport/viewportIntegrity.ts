const VIEWPORT_INTEGRITY_EVENT = "wk_viewport_integrity_violation";
const MIN_EDITABLE_FONT_SIZE = 16;
const SCALE_DELTA_TOLERANCE = 0.05;
const DOCUMENT_OVERFLOW_TOLERANCE = 2;
const FOCUS_SCALE_WINDOW_MS = 1500;

const EDITABLE_SELECTOR = [
  'input:not([type="button"]):not([type="checkbox"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="image"]):not([type="radio"]):not([type="range"]):not([type="reset"]):not([type="submit"])',
  "textarea",
  "select",
  '[contenteditable="true"]',
].join(",");

export type ViewportIntegrityViolationKind =
  | "document-overflow"
  | "focus-scale-shift"
  | "small-editable-font";

export type ViewportIntegrityViolationDetail = {
  kind: ViewportIntegrityViolationKind;
  trigger: string;
  route: string;
  layoutViewportWidth: number;
  visualViewportWidth: number;
  visualViewportHeight: number;
  visualViewportScale: number;
  documentScrollWidth: number;
  activeElementTag: string | null;
  activeElementFontSize: number | null;
};

let initialized = false;
let focusScaleBaseline = 1;
let focusScaleDeadline = 0;
let scheduledFrame = 0;
let lastFingerprint = "";
let lastReportedAt = 0;

function currentScale(): number {
  return window.visualViewport?.scale ?? 1;
}

function activeEditableElement(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return null;
  }

  return active.matches(EDITABLE_SELECTOR) ? active : null;
}

function editableFontSize(
  element: HTMLElement | null,
): number | null {
  if (!element) {
    return null;
  }

  const value = Number.parseFloat(
    window.getComputedStyle(element).fontSize,
  );

  return Number.isFinite(value) ? value : null;
}

export function collectViewportIntegritySnapshot(
  trigger: string,
): ViewportIntegrityViolationDetail {
  const root = document.documentElement;
  const body = document.body;
  const visual = window.visualViewport;
  const active = activeEditableElement();

  return {
    kind: "document-overflow",
    trigger,
    route: window.location.pathname,
    layoutViewportWidth: root.clientWidth || window.innerWidth,
    visualViewportWidth: visual?.width ?? window.innerWidth,
    visualViewportHeight: visual?.height ?? window.innerHeight,
    visualViewportScale: visual?.scale ?? 1,
    documentScrollWidth: Math.max(
      root.scrollWidth,
      body?.scrollWidth ?? 0,
    ),
    activeElementTag: active?.tagName.toLowerCase() ?? null,
    activeElementFontSize: editableFontSize(active),
  };
}

function report(
  kind: ViewportIntegrityViolationKind,
  trigger: string,
): void {
  const detail = {
    ...collectViewportIntegritySnapshot(trigger),
    kind,
  };

  const fingerprint = [
    kind,
    detail.route,
    detail.layoutViewportWidth,
    detail.documentScrollWidth,
    detail.activeElementTag ?? "none",
    detail.activeElementFontSize ?? "none",
    detail.visualViewportScale.toFixed(2),
  ].join(":");

  const now = Date.now();
  if (
    fingerprint === lastFingerprint &&
    now - lastReportedAt < 2000
  ) {
    return;
  }

  lastFingerprint = fingerprint;
  lastReportedAt = now;

  window.dispatchEvent(
    new CustomEvent<ViewportIntegrityViolationDetail>(
      VIEWPORT_INTEGRITY_EVENT,
      { detail },
    ),
  );

  if (import.meta.env.DEV) {
    console.warn("[WAKILISHA viewport integrity]", detail);
  }
}

function inspect(trigger: string): void {
  const snapshot = collectViewportIntegritySnapshot(trigger);
  const active = activeEditableElement();

  if (
    active &&
    snapshot.activeElementFontSize !== null &&
    snapshot.activeElementFontSize <
      MIN_EDITABLE_FONT_SIZE - 0.01
  ) {
    report("small-editable-font", trigger);
  }

  if (
    snapshot.documentScrollWidth >
    snapshot.layoutViewportWidth +
      DOCUMENT_OVERFLOW_TOLERANCE
  ) {
    report("document-overflow", trigger);
  }

  if (
    active &&
    performance.now() <= focusScaleDeadline &&
    snapshot.visualViewportScale >
      focusScaleBaseline + SCALE_DELTA_TOLERANCE
  ) {
    report("focus-scale-shift", trigger);
  }
}

function scheduleInspect(trigger: string): void {
  if (scheduledFrame) {
    window.cancelAnimationFrame(scheduledFrame);
  }

  scheduledFrame = window.requestAnimationFrame(() => {
    scheduledFrame = 0;
    inspect(trigger);
  });
}

export function initializeViewportIntegrityObserver(): void {
  if (
    initialized ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return;
  }

  initialized = true;

  document.addEventListener(
    "focusin",
    (event) => {
      const target =
        event.target instanceof HTMLElement
          ? event.target
          : null;

      if (!target?.matches(EDITABLE_SELECTOR)) {
        return;
      }

      focusScaleBaseline = currentScale();
      focusScaleDeadline =
        performance.now() + FOCUS_SCALE_WINDOW_MS;

      scheduleInspect("focusin");
      window.setTimeout(
        () => scheduleInspect("focus-settle"),
        300,
      );
    },
    true,
  );

  window.visualViewport?.addEventListener(
    "resize",
    () => scheduleInspect("visual-viewport-resize"),
    { passive: true },
  );

  window.addEventListener(
    "resize",
    () => scheduleInspect("layout-viewport-resize"),
    { passive: true },
  );

  window.addEventListener(
    "orientationchange",
    () => {
      window.setTimeout(
        () => scheduleInspect("orientationchange"),
        100,
      );
    },
    { passive: true },
  );

  window.addEventListener(
    "pageshow",
    () => scheduleInspect("pageshow"),
    { passive: true },
  );

  const title = document.querySelector("title");
  if (title && typeof MutationObserver !== "undefined") {
    new MutationObserver(() =>
      scheduleInspect("route-title-change"),
    ).observe(title, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  scheduleInspect("initialize");
}

export {
  EDITABLE_SELECTOR,
  MIN_EDITABLE_FONT_SIZE,
  VIEWPORT_INTEGRITY_EVENT,
};
