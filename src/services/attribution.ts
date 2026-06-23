const PRODUCTION_ORIGIN = "https://wakilisha.africa";

export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export interface ParsedUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

function safeWindowOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  return window.location.origin || PRODUCTION_ORIGIN;
}

export function canonicalPublicUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl || "/", safeWindowOrigin());

    const isPreviewHost =
      url.hostname === "readdy.cc" ||
      url.hostname === "www.readdy.cc" ||
      url.hostname === "readdy.ai" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1";

    if (isPreviewHost) {
      const previewMatch = url.pathname.match(/^\/preview\/[^/]+\/[^/]+(\/.*)?$/);
      const publicPath = previewMatch ? previewMatch[1] || "/" : url.pathname || "/";
      url.protocol = "https:";
      url.host = "wakilisha.africa";
      url.pathname = publicPath;
    }

    return url.toString();
  } catch {
    return `${PRODUCTION_ORIGIN}/`;
  }
}

export function readUtmFromUrl(rawUrl: string): ParsedUtm {
  try {
    const url = new URL(rawUrl || "/", safeWindowOrigin());
    const utm: ParsedUtm = {};
    const source = url.searchParams.get("utm_source");
    const medium = url.searchParams.get("utm_medium");
    const campaign = url.searchParams.get("utm_campaign");
    const content = url.searchParams.get("utm_content");
    const term = url.searchParams.get("utm_term");

    if (source) utm.utm_source = source;
    if (medium) utm.utm_medium = medium;
    if (campaign) utm.utm_campaign = campaign;
    if (content) utm.utm_content = content;
    if (term) utm.utm_term = term;

    return utm;
  } catch {
    return {};
  }
}

export function hasUtm(utm: ParsedUtm): boolean {
  return Boolean(
    utm.utm_source ||
    utm.utm_medium ||
    utm.utm_campaign ||
    utm.utm_content ||
    utm.utm_term,
  );
}

export function buildUtmUrl(rawUrl: string, params: UtmParams): string {
  const url = new URL(canonicalPublicUrl(rawUrl));

  url.searchParams.set("utm_source", params.source);
  url.searchParams.set("utm_medium", params.medium);
  url.searchParams.set("utm_campaign", params.campaign);

  if (params.content) url.searchParams.set("utm_content", params.content);
  if (params.term) url.searchParams.set("utm_term", params.term);

  return url.toString();
}

function referrerDomain(rawReferrer?: string): string | null {
  if (!rawReferrer) return null;
  try {
    return new URL(rawReferrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function readStoredFirstTouch(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem("wk_first_touch_attribution");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredFirstTouch(value: Record<string, unknown>): void {
  try {
    sessionStorage.setItem("wk_first_touch_attribution", JSON.stringify(value));
  } catch {
    // no-op: privacy modes / disabled storage
  }
}

export function getAttributionContext(rawUrl: string, rawReferrer?: string): Record<string, unknown> {
  const currentUtm = readUtmFromUrl(rawUrl);
  const currentHasUtm = hasUtm(currentUtm);
  const storedFirstTouch = readStoredFirstTouch();

  const currentTouch = {
    ...currentUtm,
    landing_url: rawUrl || null,
    referrer: rawReferrer || null,
    referrer_domain: referrerDomain(rawReferrer),
  };

  if (currentHasUtm && !storedFirstTouch) {
    writeStoredFirstTouch({
      ...currentTouch,
      captured_at: new Date().toISOString(),
    });
  }

  return {
    current: currentTouch,
    first_touch: storedFirstTouch || (currentHasUtm ? { ...currentTouch, captured_at: new Date().toISOString() } : null),
  };
}

export function getUtmContextForUrl(rawUrl: string): ParsedUtm {
  return readUtmFromUrl(rawUrl);
}
