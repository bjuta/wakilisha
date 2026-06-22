import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────

export type DateRange = { start: string; end: string };

// ── URL normalization ──────────────────────────────────────────────
// Strips query params, hash, trailing slashes, and normalizes www prefix
// so shares aggregate to the same canonical URL regardless of how the
// page is accessed.

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Strip query params and hash
    u.search = "";
    u.hash = "";
    // Strip trailing slash for consistency
    let path = u.pathname.replace(/\/+$/, "") || "/";
    // Strip Readdy preview version segments so shares aggregate across deploys.
    // Preview URLs look like: /preview/PROJECT_ID/VERSION_NUM/actual/path
    // Production URLs are already canonical and won't match this pattern.
    path = path.replace(/^\/preview\/[^/]+\/\d+/, "");
    if (!path || path === "/") path = "/";
    // Normalize www prefix off
    let host = u.hostname.replace(/^www\./, "");
    return `${u.protocol}//${host}${path}`;
  } catch {
    // Fallback: strip query/hash manually, also strip preview segments
    const cleaned = raw.split("?")[0].split("#")[0];
    const stripped = cleaned.replace(/\/preview\/[^/]+\/\d+/g, "");
    return stripped.replace(/\/+$/, "") || "/";
  }
}

// ── In-memory cache ────────────────────────────────────────────────
// Keeps recent counts warm so the UI never flickers to zero while
// Supabase responds. Cache invalidates naturally on page refresh
// (new JS context) but holds within a session.

const cachedCounts = new Map<string, number>();

// ── Debounce guard ─────────────────────────────────────────────────
// Prevents rapid duplicate increments from React re-render chains or
// accidental double-clicks. Once a share is in-flight for a given
// URL+platform pair, subsequent calls within the window are ignored.

const inflightShares = new Set<string>();
const INFLIGHT_WINDOW_MS = 2000;

function cacheKey(url: string, platform: string): string {
  return `${normalizeUrl(url)}::${platform}`;
}

// ── Range helpers ──────────────────────────────────────────────────

function rangeToSince(range: DateRange | number): string {
  if (typeof range === "number") {
    return range > 0
      ? new Date(Date.now() - range * 86400000).toISOString()
      : new Date(0).toISOString();
  }
  return new Date(range.start + "T00:00:00").toISOString();
}

function rangeToUntil(range: DateRange | number): string {
  if (typeof range === "number") return new Date().toISOString();
  return new Date(range.end + "T23:59:59.999").toISOString();
}

function rangeToDaysNumber(range: DateRange | number): number {
  if (typeof range === "number") return range;
  return 0;
}

// ── Public API ─────────────────────────────────────────────────────

export async function incrementShareCount(
  url: string,
  platform: string,
  articleSlug?: string,
  articleTitle?: string,
): Promise<number> {
  const normalized = normalizeUrl(url);
  const key = cacheKey(normalized, platform);

  // Debounce guard: if a share for this URL+platform pair is already
  // in-flight, ignore the duplicate. This prevents React re-render chains
  // and accidental double-taps from spamming the database.
  if (inflightShares.has(key)) {
    return cachedCounts.get(key) || 0;
  }
  inflightShares.add(key);
  setTimeout(() => inflightShares.delete(key), INFLIGHT_WINDOW_MS);

  try {
    const { data, error } = await supabase.rpc("increment_share_count", {
      p_page_url: normalized,
      p_platform: platform,
      p_article_slug: articleSlug ?? null,
      p_article_title: articleTitle ?? null,
    });

    if (error) {
      console.warn("[shareTracking] increment failed:", error.message);
      // Fall back to optimistic local count so the UI still updates
      const current = cachedCounts.get(key) || 0;
      const optimist = current + 1;
      cachedCounts.set(key, optimist);
      return optimist;
    }

    const newCount = Number(data ?? 0);
    cachedCounts.set(key, newCount);
    return newCount;
  } catch (err) {
    console.warn("[shareTracking] increment error:", err);
    const current = cachedCounts.get(key) || 0;
    const optimist = current + 1;
    cachedCounts.set(key, optimist);
    return optimist;
  }
}

export async function getShareCounts(
  url: string,
): Promise<Record<string, number>> {
  const normalized = normalizeUrl(url);

  try {
    const { data, error } = await supabase
      .from("share_counts")
      .select("platform, count")
      .eq("page_url", normalized);

    if (error) {
      console.warn("[shareTracking] fetch failed:", error.message);
      return {};
    }

    if (!data || data.length === 0) return {};

    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.platform] = Number(row.count);
      cachedCounts.set(cacheKey(normalized, row.platform), Number(row.count));
    }
    return counts;
  } catch (err) {
    console.warn("[shareTracking] fetch error:", err);
    return {};
  }
}

export function getTotalShareCount(
  counts: Record<string, number> | null | undefined,
): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, c) => sum + c, 0);
}

export async function getShareEventsDaily(
  range: DateRange | number = 30,
  articleSlug?: string,
): Promise<Array<{ date: string; platform: string; count: number; article_slug: string | null; article_title: string | null }>> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);
  const daysNum = rangeToDaysNumber(range);

  try {
    let query = supabase
      .from("share_events")
      .select("created_at, platform, article_slug, article_title")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: false });

    if (articleSlug) {
      query = query.eq("article_slug", articleSlug);
    }

    const { data, error } = await query;

    if (error) {
      console.warn("[shareTracking] daily events fetch failed:", error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Aggregate by date + platform
    const dailyMap = new Map<string, { date: string; platform: string; count: number; article_slug: string | null; article_title: string | null }>();
    for (const row of data) {
      const date = new Date(row.created_at).toISOString().split("T")[0];
      const key = `${date}::${row.platform}`;
      const existing = dailyMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        dailyMap.set(key, {
          date,
          platform: row.platform,
          count: 1,
          article_slug: row.article_slug,
          article_title: row.article_title,
        });
      }
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn("[shareTracking] daily events error:", err);
    return [];
  }
}

export async function getTopSharedArticles(
  range: DateRange | number = 30,
  limit: number = 20,
): Promise<Array<{ article_slug: string; article_title: string; total_shares: number }>> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);
  const daysNum = rangeToDaysNumber(range);

  try {
    const { data, error } = await supabase
      .from("share_events")
      .select("article_slug, article_title")
      .gte("created_at", since)
      .lte("created_at", until)
      .not("article_slug", "is", null);

    if (error) {
      console.warn("[shareTracking] top articles fetch failed:", error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Aggregate by article_slug
    const articleMap = new Map<string, { article_slug: string; article_title: string; total_shares: number }>();
    for (const row of data) {
      const slug = row.article_slug!;
      const existing = articleMap.get(slug);
      if (existing) {
        existing.total_shares += 1;
      } else {
        articleMap.set(slug, {
          article_slug: slug,
          article_title: row.article_title || slug,
          total_shares: 1,
        });
      }
    }

    return Array.from(articleMap.values())
      .sort((a, b) => b.total_shares - a.total_shares)
      .slice(0, limit);
  } catch (err) {
    console.warn("[shareTracking] top articles error:", err);
    return [];
  }
}

export async function getShareEventsTimeline(
  articleSlug: string,
  range: DateRange | number = 30,
): Promise<Array<{ date: string; count: number }>> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);
  const daysNum = rangeToDaysNumber(range);

  try {
    const { data, error } = await supabase
      .from("share_events")
      .select("created_at")
      .eq("article_slug", articleSlug)
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[shareTracking] timeline fetch failed:", error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    const dailyMap = new Map<string, number>();
    for (const row of data) {
      const date = new Date(row.created_at).toISOString().split("T")[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    }

    return Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn("[shareTracking] timeline error:", err);
    return [];
  }
}