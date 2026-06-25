import { supabase } from "@/lib/supabase";
import {
  buildArtistCardBlurb,
  buildArtistHeroIntro,
  buildArtistSeoDescription,
} from "@/services/cultureContext/artistAdapters";
import { formatCtr, formatPosition, type SearchConsoleRow, type SearchConsoleRun } from "@/services/searchConsoleSeo";

export type SeoGrowthPriority = "High" | "Medium" | "Watch";
export type SeoGrowthTaskStatus = "open" | "in_progress" | "done" | "ignored";
export type SeoGrowthDraftStatus = "draft" | "published" | "archived";
export type SeoArtistTrendStatus = "candidate" | "approved" | "rejected" | "published";

export type SeoGrowthActionInput = {
  target: string;
  query: string;
  action: string;
  reason: string;
  priority: SeoGrowthPriority;
  score: number;
  metrics: string;
};

export type SeoGrowthTask = {
  id: string;
  target_url: string;
  query: string | null;
  action: string;
  reason: string | null;
  priority: SeoGrowthPriority;
  score: number;
  metrics: string | null;
  status: SeoGrowthTaskStatus;
  source: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type SeoGrowthDraft = {
  id: string;
  task_id: string | null;
  target_url: string;
  query: string | null;
  action: string;
  content_kind: "seo_meta" | "page_copy" | "supporting_article" | "internal_links" | "refresh_checklist";
  title: string;
  summary: string | null;
  body: string;
  payload: Record<string, unknown>;
  status: SeoGrowthDraftStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type SeoArtistTrendSignal = {
  id?: string;
  artist_slug: string;
  artist_name: string;
  artist_url: string;
  source_run_id: string | null;
  window_start: string;
  window_end: string;
  clicks: number;
  impressions: number;
  ctr: number;
  average_position: number;
  trend_score: number;
  top_queries: string[];
  payload: Record<string, unknown>;
  status?: SeoArtistTrendStatus;
  created_at?: string;
  updated_at?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function readableSupabaseError(error: unknown) {
  if (!error) return new Error("Unknown Supabase error.");
  if (error instanceof Error) return error;

  if (typeof error === "object") {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [
      typeof value.message === "string" ? value.message : null,
      typeof value.details === "string" ? value.details : null,
      typeof value.hint === "string" ? value.hint : null,
      typeof value.code === "string" ? `code ${value.code}` : null,
    ].filter(Boolean);

    return new Error(parts.length ? parts.join(" · ") : JSON.stringify(error));
  }

  return new Error(String(error));
}

function slugToTitle(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanPath(value: string) {
  if (!value) return "";
  return value.replace(/^https?:\/\/(www\.)?wakilisha\.africa/i, "").split("?")[0].replace(/\/$/, "") || "/";
}

function extractArtistSlug(value?: string | null) {
  if (!value) return null;
  const clean = cleanPath(value);
  const match = clean.match(/^\/artists\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function inferContentKind(action: string): SeoGrowthDraft["content_kind"] {
  const clean = action.toLowerCase();

  if (clean.includes("title") || clean.includes("snippet") || clean.includes("meta")) return "seo_meta";
  if (clean.includes("supporting content")) return "supporting_article";
  if (clean.includes("internal link")) return "internal_links";
  if (clean.includes("protect")) return "refresh_checklist";
  return "page_copy";
}

function draftTitleFor(item: SeoGrowthActionInput) {
  const target = cleanPath(item.target);
  if (item.action.toLowerCase().includes("supporting content")) {
    return `Draft supporting content for ${item.query}`;
  }
  return `${item.action}: ${target}`;
}

function buildArtistDraftBody(item: SeoGrowthActionInput, artistSlug: string) {
  const artistName = slugToTitle(artistSlug);
  const artist = { name: artistName, genres: [], country: "" };
  const heroIntro = buildArtistHeroIntro(artist);
  const cardBlurb = buildArtistCardBlurb(artist);
  const seoDescription = buildArtistSeoDescription(artist);

  return [
    `Target: ${cleanPath(item.target)}`,
    `Search intent: ${item.query}`,
    `Recommended action: ${item.action}`,
    "",
    "Culture Context draft",
    "",
    "Hero intro:",
    heroIntro,
    "",
    "Card blurb:",
    cardBlurb,
    "",
    "SEO description:",
    seoDescription,
    "",
    "Admin notes:",
    item.reason,
    "",
    `Search Console signal: ${item.metrics}`,
    "",
    "Review before publishing. Confirm names, context, artwork, and any factual claims before this goes live.",
  ].join("\n");
}

function buildGenericDraftBody(item: SeoGrowthActionInput) {
  const target = cleanPath(item.target);
  const action = item.action.toLowerCase();

  if (action.includes("title") || action.includes("snippet") || action.includes("meta")) {
    return [
      `Target: ${target}`,
      `Search intent: ${item.query}`,
      "",
      "Draft title options:",
      `1. ${slugToTitle(target.split("/").filter(Boolean).pop() || item.query)} | WAKILISHA`,
      `2. ${item.query}: context, music, and culture notes | WAKILISHA`,
      `3. Why ${item.query} is moving in search | WAKILISHA`,
      "",
      "Draft meta description:",
      `Explore ${item.query} through WAKILISHA: context, related artists, music signals, and the culture around the page.`,
      "",
      "Admin notes:",
      item.reason,
      "",
      `Search Console signal: ${item.metrics}`,
      "",
      "Review tone, accuracy, and page fit before publishing.",
    ].join("\n");
  }

  if (action.includes("internal link")) {
    return [
      `Target: ${target}`,
      `Search intent: ${item.query}`,
      "",
      "Suggested internal-link block:",
      `If you came here for ${item.query}, keep going through related artists, releases, tracks, charts, and field notes inside WAKILISHA.`,
      "",
      "Placement ideas:",
      "- Add near the page intro.",
      "- Add below the main context section.",
      "- Add next to related tracks/releases where relevant.",
      "",
      "Admin notes:",
      item.reason,
      "",
      `Search Console signal: ${item.metrics}`,
    ].join("\n");
  }

  if (action.includes("supporting content")) {
    return [
      `Working title: ${slugToTitle(item.query)}`,
      "",
      "Draft brief:",
      `Create a short, useful WAKILISHA guide around “${item.query}”. The piece should explain what people are looking for, point them to the strongest related WAKILISHA pages, and give enough context to satisfy search intent without pretending to know what we have not verified.`,
      "",
      "Opening draft:",
      `${slugToTitle(item.query)} is showing search demand around WAKILISHA. This guide should help readers find the right artist, release, track, or culture thread faster, then move them deeper into the archive.`,
      "",
      "Suggested sections:",
      "- Start here",
      "- Why people are searching this",
      "- Related artists/releases/tracks",
      "- What to follow next",
      "",
      `Search Console signal: ${item.metrics}`,
    ].join("\n");
  }

  if (action.includes("protect")) {
    return [
      `Target: ${target}`,
      `Search intent: ${item.query}`,
      "",
      "Refresh checklist:",
      "- Confirm page title and meta still match search intent.",
      "- Add one fresh internal link to a related page.",
      "- Confirm artwork/image fallback is strong.",
      "- Add or refresh related modules.",
      "- Avoid rewriting what is already winning unless CTR drops.",
      "",
      "Admin notes:",
      item.reason,
      "",
      `Search Console signal: ${item.metrics}`,
    ].join("\n");
  }

  return [
    `Target: ${target}`,
    `Search intent: ${item.query}`,
    `Recommended action: ${item.action}`,
    "",
    "Draft page improvement:",
    `This page is getting enough search signal to deserve stronger context. Add a sharper opening, clearer related links, and one useful next-step module that helps users continue from “${item.query}” into WAKILISHA.`,
    "",
    "Admin notes:",
    item.reason,
    "",
    `Search Console signal: ${item.metrics}`,
    "",
    "Review before publishing.",
  ].join("\n");
}

export function buildGrowthDraft(item: SeoGrowthActionInput) {
  const artistSlug = extractArtistSlug(item.target);
  const contentKind = inferContentKind(item.action);
  const body = artistSlug ? buildArtistDraftBody(item, artistSlug) : buildGenericDraftBody(item);

  return {
    target_url: cleanPath(item.target),
    query: item.query,
    action: item.action,
    content_kind: contentKind,
    title: draftTitleFor(item),
    summary: item.reason,
    body,
    payload: {
      priority: item.priority,
      score: item.score,
      metrics: item.metrics,
      source: "search_console_growth_queue",
      artistSlug,
    },
  };
}

export async function fetchSeoGrowthTasks() {
  const { data, error } = await supabase
    .from("seo_growth_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw readableSupabaseError(error);
  return (data || []) as SeoGrowthTask[];
}

export async function fetchSeoGrowthDrafts() {
  const { data, error } = await supabase
    .from("seo_growth_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw readableSupabaseError(error);
  return (data || []) as SeoGrowthDraft[];
}

export async function saveSeoGrowthTask(item: SeoGrowthActionInput) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const timestamp = nowIso();

  const { data, error } = await supabase
    .from("seo_growth_tasks")
    .upsert(
      {
        target_url: cleanPath(item.target),
        query: item.query,
        action: item.action,
        reason: item.reason,
        priority: item.priority,
        score: item.score,
        metrics: item.metrics,
        status: "open",
        source: "search_console_growth_queue",
        created_by: userId,
        updated_by: userId,
        updated_at: timestamp,
      },
      { onConflict: "target_url,query,action" },
    )
    .select("*")
    .single();

  if (error) throw readableSupabaseError(error);
  return data as SeoGrowthTask;
}

export async function saveSeoGrowthDraft(item: SeoGrowthActionInput, taskId?: string | null) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const draft = buildGrowthDraft(item);

  const { data, error } = await supabase
    .from("seo_growth_drafts")
    .upsert(
      {
        ...draft,
        task_id: taskId ?? null,
        generated_by: userId,
        updated_at: nowIso(),
      },
      { onConflict: "target_url,query,action,content_kind" },
    )
    .select("*")
    .single();

  if (error) throw readableSupabaseError(error);
  return data as SeoGrowthDraft;
}

export async function saveSeoGrowthTaskAndDraft(item: SeoGrowthActionInput) {
  const task = await saveSeoGrowthTask(item);
  const draft = await saveSeoGrowthDraft(item, task.id);
  return { task, draft };
}

export async function updateSeoGrowthTaskStatus(taskId: string, status: SeoGrowthTaskStatus) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const completedAt = status === "done" ? nowIso() : null;

  const { data, error } = await supabase
    .from("seo_growth_tasks")
    .update({
      status,
      updated_by: userId,
      updated_at: nowIso(),
      completed_at: completedAt,
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) throw readableSupabaseError(error);
  return data as SeoGrowthTask;
}

type ArtistAggregate = {
  artist_slug: string;
  artist_name: string;
  artist_url: string;
  clicks: number;
  impressions: number;
  positionNumerator: number;
  queries: Map<string, { query: string; impressions: number; clicks: number }>;
};

export function buildArtistTrendSignalsFromSearchConsole(
  rows: SearchConsoleRow[],
  run: SearchConsoleRun | null,
): SeoArtistTrendSignal[] {
  if (!run) return [];

  const map = new Map<string, ArtistAggregate>();

  for (const row of rows) {
    const slug = extractArtistSlug(row.page_url);
    if (!slug) continue;

    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    if (impressions <= 0) continue;

    const existing =
      map.get(slug) ||
      {
        artist_slug: slug,
        artist_name: slugToTitle(slug),
        artist_url: `/artists/${slug}`,
        clicks: 0,
        impressions: 0,
        positionNumerator: 0,
        queries: new Map(),
      };

    existing.clicks += clicks;
    existing.impressions += impressions;
    existing.positionNumerator += Number(row.position || 0) * impressions;

    const query = row.query || "unknown query";
    const queryExisting = existing.queries.get(query) || { query, impressions: 0, clicks: 0 };
    queryExisting.impressions += impressions;
    queryExisting.clicks += clicks;
    existing.queries.set(query, queryExisting);

    map.set(slug, existing);
  }

  return Array.from(map.values())
    .map((item) => {
      const ctr = item.impressions > 0 ? item.clicks / item.impressions : 0;
      const averagePosition = item.impressions > 0 ? item.positionNumerator / item.impressions : 0;
      const topQueries = Array.from(item.queries.values())
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5)
        .map((query) => query.query);

      const score = Math.min(
        100,
        Math.round(
          Math.log10(item.impressions + 1) * 22 +
            item.clicks * 0.35 +
            ctr * 180 +
            Math.max(0, 20 - averagePosition) * 2,
        ),
      );

      return {
        artist_slug: item.artist_slug,
        artist_name: item.artist_name,
        artist_url: item.artist_url,
        source_run_id: run.id,
        window_start: run.start_date,
        window_end: run.end_date,
        clicks: item.clicks,
        impressions: item.impressions,
        ctr,
        average_position: averagePosition,
        trend_score: score,
        top_queries: topQueries,
        payload: {
          source: "search_console",
          siteUrl: run.site_url,
          rowWindow: `${run.start_date} to ${run.end_date}`,
        },
        status: "candidate" as const,
      };
    })
    .filter((signal) => signal.impressions >= 20)
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, 30);
}

export async function saveArtistTrendSignals(signals: SeoArtistTrendSignal[]) {
  if (!signals.length) return [];

  const { data, error } = await supabase
    .from("seo_artist_trend_signals")
    .upsert(
      signals.map((signal) => ({
        ...signal,
        updated_at: nowIso(),
      })),
      { onConflict: "artist_slug,window_start,window_end" },
    )
    .select("*");

  if (error) throw readableSupabaseError(error);
  return (data || []) as SeoArtistTrendSignal[];
}

export async function fetchArtistTrendSignals() {
  const { data, error } = await supabase
    .from("seo_artist_trend_signals")
    .select("*")
    .order("trend_score", { ascending: false })
    .limit(30);

  if (error) throw readableSupabaseError(error);
  return (data || []) as SeoArtistTrendSignal[];
}

export async function updateArtistTrendSignalStatus(id: string, status: SeoArtistTrendStatus) {
  const { data, error } = await supabase
    .from("seo_artist_trend_signals")
    .update({ status, updated_at: nowIso() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw readableSupabaseError(error);
  return data as SeoArtistTrendSignal;
}
