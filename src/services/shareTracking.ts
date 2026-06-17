import { supabase } from "@/lib/supabase";

const cachedCounts = new Map<string, number>();

function cacheKey(url: string, platform: string): string {
  return `${url}::${platform}`;
}

export async function incrementShareCount(url: string, platform: string): Promise<number> {
  const key = cacheKey(url, platform);

  try {
    const { data, error } = await supabase.rpc("increment_share_count", {
      p_page_url: url,
      p_platform: platform,
    });

    if (error) {
      console.warn("[shareTracking] increment failed:", error.message);
      return cachedCounts.get(key) || 0;
    }

    const newCount = Number(data || 0);
    cachedCounts.set(key, newCount);
    return newCount;
  } catch (err) {
    console.warn("[shareTracking] increment error:", err);
    return cachedCounts.get(key) || 0;
  }
}

export async function getShareCounts(url: string): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from("share_counts")
      .select("platform, count")
      .eq("page_url", url);

    if (error || !data) return {};

    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.platform] = Number(row.count);
      cachedCounts.set(cacheKey(url, row.platform), Number(row.count));
    }
    return counts;
  } catch {
    return {};
  }
}

export function getTotalShareCount(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, c) => sum + c, 0);
}