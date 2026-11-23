/**
 * Copies a public share URL while the originating click still has transient
 * user activation. iOS browser wrappers can omit or stall the Async Clipboard
 * API, so try the synchronous selection fallback before leaving that gesture.
 *
 * A returned true means the browser explicitly reported a successful copy.
 * Never claim success (or increment the share counter) on an unavailable,
 * rejected or timed-out clipboard operation.
 */
export async function copyShareLink(text: string): Promise<boolean> {
  if (!text || typeof document === "undefined") return false;

  if (typeof document.execCommand === "function") {
    const active = document.activeElement;
    const field = document.createElement("textarea");
    field.value = text;
    field.readOnly = true;
    field.setAttribute("aria-hidden", "true");
    field.tabIndex = -1;
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.width = "1px";
    field.style.height = "1px";
    field.style.opacity = "0";
    field.style.fontSize = "16px";
    document.body.appendChild(field);

    let copied = false;
    try {
      field.focus({ preventScroll: true });
      field.select();
      field.setSelectionRange(0, text.length);
      copied = document.execCommand("copy") === true;
    } catch {
      // Some browsers disable the legacy command; try Async Clipboard below.
    } finally {
      field.remove();
      if (active instanceof HTMLElement && active.isConnected) {
        try { active.focus({ preventScroll: true }); } catch { /* not focusable */ }
      }
    }
    if (copied) return true;
  }

  if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") return false;

  // A stalled permission/clipboard promise must not leave the user on an
  // inert Copy button forever. The caller exposes the selectable-link fallback.
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(success);
    };
    const timeout = setTimeout(() => finish(false), 3000);
    try {
      void navigator.clipboard.writeText(text).then(
        () => finish(true),
        () => finish(false),
      );
    } catch {
      finish(false);
    }
  });
}
