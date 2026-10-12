import { useState } from "react";

const HOSTS = new Set(["is1-ssl.mzstatic.com", "i.scdn.co"]);
export function validateWkArtworkUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && HOSTS.has(url.hostname) &&
      !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
/** Source-backed image only. No generated substitutes or unrelated cover matches. */
export function WkRecordingArtwork({
  url, title, kind = "track",
}: { url?: string | null; title: string; kind?: "track" | "release" | "other" }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = validateWkArtworkUrl(url);
  const visible = Boolean(src && src !== failed);
  return <span data-wk-recording-artwork data-wk-artwork-state={visible ? "loaded-or-pending" : "unavailable"}
    className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-wk-border bg-wk-surface-raised text-wk-text-muted">
    {visible ? <img src={src!} alt={title ? "Artwork for " + title : "Recording artwork"}
      className="h-full w-full object-cover" loading="lazy" decoding="async"
      referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-8 w-8 opacity-60">
        {kind === "release"
          ? <><rect x="8" y="8" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="2" fill="none"/></>
          : <><rect x="9" y="8" width="30" height="32" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M27 14v15a5 5 0 1 1-2-4V17l8-2" stroke="currentColor" strokeWidth="2" fill="none"/></>}
      </svg>
    )}
    {!visible && <span className="sr-only">Artwork unavailable</span>}
  </span>;
}
