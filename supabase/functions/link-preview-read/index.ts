const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 262_144;
const FETCH_TIMEOUT_MS = 5_000;
const RICH_CACHE_MS = 30 * 60 * 1000;
const EMPTY_CACHE_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;

const ALLOWED_ORIGINS = new Set([
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
]);

type RichPreview = {
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  section: string;
  displayHost: string;
  mediaType: "article" | "website" | "image" | "video" | "audio" | "product" | "profile" | "other";
};

type CachedPreview = {
  expiresAt: number;
  data: RichPreview | null;
};

const previewCache = new Map<string, CachedPreview>();
const requestWindows = new Map<string, number[]>();

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://wakilisha.africa";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");
}

function parseIpv4(raw: string): number[] | null {
  const parts = raw.split(".");
  if (parts.length !== 4) return null;

  const numbers = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return NaN;
    return Number(part);
  });

  if (
    numbers.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > 255,
    )
  ) {
    return null;
  }

  return numbers;
}

function isUnsafeIpv4(raw: string): boolean {
  const ip = parseIpv4(raw);
  if (!ip) return false;

  const [a, b] = ip;

  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
}

function isUnsafeIpv6(raw: string): boolean {
  const ip = normalizeHostname(raw);

  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (/^fe[89ab]/i.test(ip)) return true;
  if (ip.startsWith("ff")) return true;
  if (ip.startsWith("2001:db8:")) return true;

  const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isUnsafeIpv4(mapped[1]);

  return false;
}

function looksLikeIpv6(hostname: string): boolean {
  return normalizeHostname(hostname).includes(":");
}

function unsafeHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);

  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home") ||
    host.endsWith(".lan") ||
    host.endsWith(".test") ||
    host.endsWith(".invalid") ||
    host.endsWith(".example")
  ) {
    return true;
  }

  if (parseIpv4(host)) return isUnsafeIpv4(host);
  if (looksLikeIpv6(host)) return isUnsafeIpv6(host);

  return false;
}

function normalizeTarget(rawUrl: string): URL {
  if (
    typeof rawUrl !== "string" ||
    rawUrl.length === 0 ||
    rawUrl.length > MAX_URL_LENGTH
  ) {
    throw new Error("invalid_url");
  }

  const parsed = new URL(rawUrl.trim());

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    throw new Error("unsupported_protocol");
  }

  if (parsed.username || parsed.password) {
    throw new Error("credentials_not_allowed");
  }

  if (
    parsed.port &&
    !(
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    )
  ) {
    throw new Error("port_not_allowed");
  }

  if (unsafeHostname(parsed.hostname)) {
    throw new Error("private_target");
  }

  return parsed;
}

async function assertPublicDns(url: URL): Promise<void> {
  const host = normalizeHostname(url.hostname);

  if (parseIpv4(host)) {
    if (isUnsafeIpv4(host)) throw new Error("private_target");
    return;
  }

  if (looksLikeIpv6(host)) {
    if (isUnsafeIpv6(host)) throw new Error("private_target");
    return;
  }

  const [aRecords, aaaaRecords] = await Promise.all([
    Deno.resolveDns(host, "A").catch(() => [] as string[]),
    Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
  ]);

  const addresses = [...aRecords, ...aaaaRecords];
  if (addresses.length === 0) {
    throw new Error("dns_unresolved");
  }

  for (const address of addresses) {
    if (
      isUnsafeIpv4(address) ||
      isUnsafeIpv6(address)
    ) {
      throw new Error("private_target");
    }
  }
}

function clientKey(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function allowRequest(req: Request): boolean {
  const key = clientKey(req);
  const now = Date.now();
  const current = requestWindows.get(key) || [];
  const live = current.filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS,
  );

  if (live.length >= RATE_MAX) {
    requestWindows.set(key, live);
    return false;
  }

  live.push(now);
  requestWindows.set(key, live);
  return true;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, raw) => {
      const code = Number(raw);
      return Number.isFinite(code)
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, raw) => {
      const code = Number.parseInt(raw, 16);
      return Number.isFinite(code)
        ? String.fromCodePoint(code)
        : "";
    });
}

function cleanText(
  value: string | null | undefined,
  maxLength: number,
): string {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function tagAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const pattern =
    /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(pattern)) {
    const name = String(match[1] || "").toLowerCase();
    const value =
      match[2] ??
      match[3] ??
      match[4] ??
      "";
    attrs.set(name, decodeHtmlEntities(value.trim()));
  }

  return attrs;
}

function firstValue(
  values: Map<string, string>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = values.get(key);
    if (value?.trim()) return value.trim();
  }
  return "";
}

function absoluteHttpUrl(
  raw: string,
  base: URL,
): string {
  if (!raw.trim()) return "";

  try {
    const resolved = new URL(raw, base);
    if (
      resolved.protocol !== "https:" &&
      resolved.protocol !== "http:"
    ) {
      return "";
    }
    return resolved.toString();
  } catch {
    return "";
  }
}

function safeImageUrl(
  raw: string,
  base: URL,
): string {
  const resolved = absoluteHttpUrl(raw, base);
  if (!resolved) return "";

  try {
    return new URL(resolved).protocol === "https:"
      ? resolved
      : "";
  } catch {
    return "";
  }
}

function displayHost(url: URL): string {
  return normalizeHostname(url.hostname)
    .replace(/^www\./, "");
}

function sectionFromType(
  rawType: string,
): RichPreview["section"] {
  const type = rawType.toLowerCase();

  if (type.includes("article")) return "Article";
  if (type.includes("video")) return "Video";
  if (
    type.includes("music") ||
    type.includes("audio")
  ) return "Audio";
  if (type.includes("product")) return "Product";
  if (type.includes("profile")) return "Profile";

  return "Website";
}

function mediaTypeFromType(
  rawType: string,
): RichPreview["mediaType"] {
  const type = rawType.toLowerCase();

  if (type.includes("article")) return "article";
  if (type.includes("video")) return "video";
  if (
    type.includes("music") ||
    type.includes("audio")
  ) return "audio";
  if (type.includes("product")) return "product";
  if (type.includes("profile")) return "profile";
  if (!type || type.includes("website")) return "website";

  return "other";
}

async function readLimitedText(
  response: Response,
): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  try {
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const remaining = MAX_HTML_BYTES - total;
      const slice =
        value.byteLength > remaining
          ? value.slice(0, remaining)
          : value;

      total += slice.byteLength;
      text += decoder.decode(slice, { stream: true });

      if (value.byteLength > remaining) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // no-op
    }
  }

  text += decoder.decode();
  return text;
}

function parseHtmlPreview(
  html: string,
  sourceUrl: string,
  finalUrl: URL,
): RichPreview | null {
  const meta = new Map<string, string>();

  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = tagAttributes(tag);
    const key = (
      attrs.get("property") ||
      attrs.get("name") ||
      ""
    ).toLowerCase();
    const content = attrs.get("content") || "";
    if (key && content && !meta.has(key)) {
      meta.set(key, content);
    }
  }

  let canonical = "";
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const attrs = tagAttributes(tag);
    const rel = (attrs.get("rel") || "")
      .toLowerCase()
      .split(/\s+/);

    if (
      rel.includes("canonical") &&
      attrs.get("href")
    ) {
      canonical = attrs.get("href") || "";
      break;
    }
  }

  const titleTag =
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    "";

  const title = cleanText(
    firstValue(meta, [
      "og:title",
      "twitter:title",
    ]) || titleTag,
    300,
  );

  const description = cleanText(
    firstValue(meta, [
      "og:description",
      "twitter:description",
      "description",
    ]),
    700,
  );

  const imageUrl = safeImageUrl(
    firstValue(meta, [
      "og:image:secure_url",
      "og:image",
      "twitter:image",
      "twitter:image:src",
    ]),
    finalUrl,
  );

  if (!title && !description && !imageUrl) {
    return null;
  }

  const rawType = firstValue(meta, ["og:type"]);
  const canonicalUrl =
    absoluteHttpUrl(
      canonical ||
      firstValue(meta, ["og:url"]),
      finalUrl,
    ) ||
    finalUrl.toString();

  const siteName =
    cleanText(
      firstValue(meta, ["og:site_name"]) ||
      displayHost(finalUrl),
      120,
    ) ||
    displayHost(finalUrl);

  return {
    sourceUrl,
    canonicalUrl,
    title:
      title ||
      siteName,
    description,
    imageUrl,
    siteName,
    section: sectionFromType(rawType),
    displayHost: displayHost(finalUrl),
    mediaType: mediaTypeFromType(rawType),
  };
}

function directImagePreview(
  sourceUrl: string,
  finalUrl: URL,
): RichPreview {
  const fileName = decodeURIComponent(
    finalUrl.pathname.split("/").filter(Boolean).at(-1) ||
    "Image",
  );

  return {
    sourceUrl,
    canonicalUrl: finalUrl.toString(),
    title: cleanText(fileName, 300) || "Image",
    description: "",
    imageUrl:
      finalUrl.protocol === "https:"
        ? finalUrl.toString()
        : "",
    siteName: displayHost(finalUrl),
    section: "Image",
    displayHost: displayHost(finalUrl),
    mediaType: "image",
  };
}

async function fetchOriginPreview(
  sourceUrl: string,
): Promise<RichPreview | null> {
  let currentUrl = normalizeTarget(sourceUrl);

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    await assertPublicDns(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,image/*;q=0.8,*/*;q=0.5",
          "User-Agent": "WAKILISHA-LinkPreview/1.0 (+https://wakilisha.africa)",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new Error("redirect_limit");
      }

      currentUrl = normalizeTarget(
        new URL(location, currentUrl).toString(),
      );
      continue;
    }

    if (!response.ok) {
      return null;
    }

    const contentType = (
      response.headers.get("content-type") ||
      ""
    ).toLowerCase();

    if (contentType.startsWith("image/")) {
      return directImagePreview(
        sourceUrl,
        currentUrl,
      );
    }

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return null;
    }

    const html = await readLimitedText(response);
    return parseHtmlPreview(
      html,
      sourceUrl,
      currentUrl,
    );
  }

  return null;
}

async function resolveWithCache(
  rawUrl: string,
): Promise<RichPreview | null> {
  const target = normalizeTarget(rawUrl);
  const key = target.toString();
  const now = Date.now();
  const cached = previewCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await fetchOriginPreview(key);
  previewCache.set(key, {
    data,
    expiresAt:
      now +
      (data ? RICH_CACHE_MS : EMPTY_CACHE_MS),
  });

  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      req,
      { data: null, error: "method_not_allowed" },
      405,
    );
  }

  if (!allowRequest(req)) {
    return jsonResponse(
      req,
      { data: null, error: "rate_limited" },
      429,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(
      req,
      { data: null, error: "invalid_json" },
      400,
    );
  }

  const rawUrl =
    typeof payload.url === "string"
      ? payload.url
      : "";

  try {
    const data = await resolveWithCache(rawUrl);
    return jsonResponse(req, { data });
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "preview_failed";

    const clientSafeCodes = new Set([
      "invalid_url",
      "unsupported_protocol",
      "credentials_not_allowed",
      "port_not_allowed",
      "private_target",
      "dns_unresolved",
      "redirect_limit",
    ]);

    return jsonResponse(
      req,
      {
        data: null,
        error: clientSafeCodes.has(code)
          ? code
          : "preview_failed",
      },
      200,
    );
  }
});
