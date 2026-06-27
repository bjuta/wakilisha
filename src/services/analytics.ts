import { supabase } from "@/lib/supabase";
import { getAttributionContext } from "@/services/attribution";

// ── Session ID ────────────────────────────────────────────────────
// Generated once per browser tab session, stored in sessionStorage.
// Persists across page navigations within the same tab but resets
// when the tab is closed. Format: wk_ + random hex (16 chars).

function getSessionId(): string {
  const key = "wk_session_id";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = "wk_" + Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    // sessionStorage unavailable (rare: iframes, privacy modes)
    return "wk_" + Math.random().toString(36).slice(2, 10);
  }
}

// ── URL normalization ──────────────────────────────────────────────
// Strips query params, hash, trailing slashes, and normalizes www
// prefix so events aggregate under a canonical URL no matter how
// the page is accessed.

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.search = "";
    u.hash = "";
    let path = u.pathname.replace(/\/+$/, "") || "/";
    let host = u.hostname.replace(/^www\./, "");
    return `${u.protocol}//${host}${path}`;
  } catch {
    return raw.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  }
}

// ── Types ──────────────────────────────────────────────────────────

export interface TrackEventOptions {
  pageType?: string;
  entitySlug?: string;
  entityType?: string;
  context?: Record<string, unknown>;
  userId?: string;
  /**
   * Use only for deliberate admin diagnostics. Normal internal/dev traffic is suppressed.
   */
  allowInternal?: boolean;
}

export const INTERNAL_TRAFFIC_STORAGE_KEY = "wakilisha_internal_traffic";

function currentHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.replace(/^www\./, "").toLowerCase();
}

function isLocalDevelopmentHost(hostname = currentHostname()): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export function isInternalTrafficEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INTERNAL_TRAFFIC_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setInternalTrafficEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(INTERNAL_TRAFFIC_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(INTERNAL_TRAFFIC_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent("wakilisha_internal_traffic_changed", { detail: { enabled } }));
  } catch {
    // localStorage unavailable; ignore.
  }
}

export function shouldSuppressAnalytics(options: Pick<TrackEventOptions, "allowInternal"> = {}): boolean {
  if (options.allowInternal) return false;
  return isInternalTrafficEnabled() || isLocalDevelopmentHost();
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Fire-and-forget analytics event. Never throws, never blocks.
 *
 * Uses SECURITY DEFINER RPC (track_analytics_event) for all inserts
 * so both anonymous and authenticated users can write events without
 * needing complex RLS policies. The RPC bypasses RLS with service_role
 * privileges but only accepts the columns defined above — it cannot
 * read or mutate any other table.
 */
export function trackEvent(
  eventName: string,
  options: TrackEventOptions = {},
): void {
  if (shouldSuppressAnalytics(options)) return;

  const rawPageUrl =
    typeof window !== "undefined" ? window.location.href : "";
  const pageUrl = normalizeUrl(rawPageUrl);
  const sessionId = getSessionId();
  const hostname = currentHostname();
  const referrer =
    typeof document !== "undefined" ? document.referrer || undefined : undefined;

  const enrichedContext = {
    ...(options.context ?? {}),
    attribution: getAttributionContext(rawPageUrl, referrer),
    raw_page_url: rawPageUrl || null,
    canonical_page_url: pageUrl || null,
    analytics_traffic_type: "external",
    analytics_is_internal: false,
    analytics_hostname: hostname || null,
  };

  const payload = {
    p_event_name: eventName,
    p_page_url: pageUrl,
    p_page_type: options.pageType ?? null,
    p_entity_slug: options.entitySlug ?? null,
    p_entity_type: options.entityType ?? null,
    p_context: enrichedContext,
    p_session_id: sessionId,
    p_user_id: options.userId ?? null,
    p_referrer: referrer ?? null,
  };

  // Fire-and-forget — never await, never throw
  supabase.rpc("track_analytics_event", payload).then(({ error }) => {
    if (error) {
      console.warn("[analytics] trackEvent failed:", error.message);
    }
  });
}

/**
 * Synchronous version — returns the session ID immediately.
 * Useful when you need the session ID for hidden form fields
 * before the form submits.
 */
export function getAnalyticsSessionId(): string {
  return getSessionId();
}

/**
 * Returns the canonical page URL (no query params, no hash).
 * Useful for hidden form fields that need page context.
 */
export function getCanonicalPageUrl(): string {
  if (typeof window === "undefined") return "";
  return normalizeUrl(window.location.href);
}
