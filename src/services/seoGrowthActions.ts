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

function labelFromTarget(targetUrl: string) {
  const parts = cleanPath(targetUrl).split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const previous = parts[parts.length - 2] || "";

  if (parts[0] === "artists" && last) return slugToTitle(last);
  if ((parts[0] === "tracks" || parts[0] === "releases") && last) {
    return previous ? `${slugToTitle(last)} by ${slugToTitle(previous)}` : slugToTitle(last);
  }

  return slugToTitle(last || "WAKILISHA");
}

function cleanIntent(query: string) {
  return String(query || "").trim() || "this page";
}

function quoteIntent(query: string) {
  return `“${cleanIntent(query)}”`;
}

function searchDiagnosis(item: SeoGrowthActionInput) {
  return [
    `Google is already showing this page for ${quoteIntent(item.query)}, but the result is not earning enough clicks.`,
    `Signal: ${item.metrics}.`,
    item.reason,
  ].join(" ");
}

function buildTitleOptions(label: string, item: SeoGrowthActionInput) {
  const intent = cleanIntent(item.query);
  const lowerLabel = label.toLowerCase();
  const queryAlreadyNamesPage = intent.toLowerCase().includes(lowerLabel) || lowerLabel.includes(intent.toLowerCase());

  if (queryAlreadyNamesPage) {
    return [
      `${label} songs, releases, and profile | WAKILISHA`,
      `${label}: music, releases, and culture context | WAKILISHA`,
      `${label} on WAKILISHA | songs, releases, and related artists`,
    ];
  }

  return [
    `${label} | WAKILISHA`,
    `${intent}: ${label} context, music, and related pages | WAKILISHA`,
    `${label} on WAKILISHA | music, context, and culture signals`,
  ];
}

function buildMetaDescription(label: string, item: SeoGrowthActionInput) {
  const intent = cleanIntent(item.query);

  if (item.action.toLowerCase().includes("protect")) {
    return clampMetaDescription(
      `${label} is already earning search attention. Explore songs, releases, related artists, and culture context on WAKILISHA.`,
    );
  }

  return clampMetaDescription(
    `Find ${label} on WAKILISHA with songs, releases, artist context, related music, and search signals around ${intent}.`,
  );
}

function titleOptionsLines(options: string[]) {
  return options.map((option, index) => `${index + 1}. ${option}`);
}

function buildArtistDraftBody(item: SeoGrowthActionInput, artistSlug: string) {
  const artistName = slugToTitle(artistSlug);
  const artist = { name: artistName, genres: [], country: "" };
  const heroIntro = buildArtistHeroIntro(artist);
  const cardBlurb = buildArtistCardBlurb(artist);
  const seoDescription = buildArtistSeoDescription(artist);
  const titleOptions = buildTitleOptions(artistName, item);
  const metaDescription = buildMetaDescription(artistName, item);
  const intent = cleanIntent(item.query);

  return [
    `Target: ${cleanPath(item.target)}`,
    `Search intent: ${intent}`,
    `Recommended action: ${item.action}`,
    "",
    "Search result problem:",
    searchDiagnosis(item),
    "",
    "Recommended SEO title:",
    ...titleOptionsLines(titleOptions),
    "",
    "Draft meta description:",
    metaDescription,
    "",
    "Search snippet promise:",
    `The result should quickly tell searchers that WAKILISHA has a useful ${artistName} page, not just a thin name record. The promise should be songs, releases, related artists, and culture context.`,
    "",
    "Page intro draft:",
    `${artistName} is picking up search demand on WAKILISHA. For people searching ${quoteIntent(item.query)}, this page should work as the clean starting point: available songs, releases, related artists, and the music context around the name. Keep it direct, useful, and easy to keep moving from.`,
    "",
    "Internal link module draft:",
    `Looking for ${artistName}? Start with the available songs and releases, then follow the related artists, charts, and culture notes that connect this page to the wider WAKILISHA map.`,
    "",
    "Culture Context support copy:",
    "Hero intro:",
    heroIntro,
    "",
    "Card blurb:",
    cardBlurb,
    "",
    "Baseline SEO description:",
    seoDescription,
    "",
    "Admin publishing notes:",
    "- Confirm the spelling and stylization of the artist name.",
    "- Confirm that songs/releases actually exist before promising a specific catalogue depth.",
    "- Add artwork or a stronger profile image if missing.",
    "- Add 3 to 6 internal links once related pages are known.",
    "- Do not publish claims about biography, nationality, labels, age, or real name unless verified.",
    "",
    `Search Console signal: ${item.metrics}`,
  ].join("\n");
}

function buildGenericDraftBody(item: SeoGrowthActionInput) {
  const target = cleanPath(item.target);
  const label = labelFromTarget(target);
  const action = item.action.toLowerCase();
  const intent = cleanIntent(item.query);
  const titleOptions = buildTitleOptions(label, item);
  const metaDescription = buildMetaDescription(label, item);

  if (action.includes("title") || action.includes("snippet") || action.includes("meta")) {
    return [
      `Target: ${target}`,
      `Search intent: ${intent}`,
      `Recommended action: ${item.action}`,
      "",
      "Search result problem:",
      searchDiagnosis(item),
      "",
      "Recommended SEO title:",
      ...titleOptionsLines(titleOptions),
      "",
      "Draft meta description:",
      metaDescription,
      "",
      "Search snippet promise:",
      `The result should make the page feel useful before the click. For ${quoteIntent(item.query)}, lead with the clearest value: what this page helps the reader find, understand, or continue exploring.`,
      "",
      "Page intro draft:",
      `${label} is getting search visibility, but the current result is not pulling enough people through. Tighten the opening around ${quoteIntent(item.query)}, then give readers fast paths into related artists, tracks, releases, charts, and culture context.`,
      "",
      "Internal link module draft:",
      `Keep exploring ${label} through related WAKILISHA artists, songs, releases, charts, and stories connected to this search.`,
      "",
      "Admin publishing notes:",
      "- Keep the title human, not keyword-stuffed.",
      "- Match the meta description to what the page actually contains.",
      "- Add internal links near the first screen, not only at the bottom.",
      "- Check image/social preview coverage before marking this done.",
      "",
      `Search Console signal: ${item.metrics}`,
    ].join("\n");
  }

  if (action.includes("internal link")) {
    return [
      `Target: ${target}`,
      `Search intent: ${intent}`,
      `Recommended action: ${item.action}`,
      "",
      "Search result problem:",
      searchDiagnosis(item),
      "",
      "Internal link module draft:",
      `People arriving through ${quoteIntent(item.query)} should not hit a dead end. Add a compact “keep going” block with related artists, songs, releases, charts, and stories that naturally extend the page.`,
      "",
      "Suggested anchor text:",
      `1. More music connected to ${label}`,
      `2. Related artists and releases`,
      `3. Follow this thread through WAKILISHA`,
      "",
      "Admin publishing notes:",
      "- Use real related pages only.",
      "- Prioritize pages with images, metadata, and active status.",
      "- Keep links contextual, not dumped as a random list.",
      "",
      `Search Console signal: ${item.metrics}`,
    ].join("\n");
  }

  if (action.includes("supporting content")) {
    return [
      `Target: ${target}`,
      `Search intent: ${intent}`,
      `Recommended action: ${item.action}`,
      "",
      "Supporting article or guide draft:",
      `Working title: ${intent}: the WAKILISHA starting point`,
      "",
      "Opening draft:",
      `${intent} is showing search demand around WAKILISHA. This guide should help readers find the right artist, song, release, or culture thread faster, then move them into stronger related pages instead of leaving them with a thin search result.`,
      "",
      "Suggested sections:",
      "1. Start here",
      "2. What people are looking for",
      "3. Related artists, songs, or releases",
      "4. What to follow next",
      "5. Why this search is moving",
      "",
      "Admin publishing notes:",
      "- Keep it short unless there is enough verified material.",
      "- Use the guide to send traffic to stronger entity pages.",
      "- Do not invent biographical or industry claims.",
      "",
      `Search Console signal: ${item.metrics}`,
    ].join("\n");
  }

  if (action.includes("protect")) {
    return [
      `Target: ${target}`,
      `Search intent: ${intent}`,
      `Recommended action: ${item.action}`,
      "",
      "Search result strength:",
      `${label} is already performing. The goal is not to rewrite everything. Protect the ranking, improve the click path, and keep the page fresh.`,
      "",
      "Recommended SEO title:",
      ...titleOptionsLines(titleOptions),
      "",
      "Draft meta description:",
      metaDescription,
      "",
      "Refresh checklist:",
      "- Confirm title and meta still match search intent.",
      "- Add one fresh internal link to a related page.",
      "- Confirm artwork/image fallback is strong.",
      "- Add or refresh related modules.",
      "- Avoid heavy rewrites unless CTR drops.",
      "",
      `Search Console signal: ${item.metrics}`,
    ].join("\n");
  }

  return [
    `Target: ${target}`,
    `Search intent: ${intent}`,
    `Recommended action: ${item.action}`,
    "",
    "Search result problem:",
    searchDiagnosis(item),
    "",
    "Recommended SEO title:",
    ...titleOptionsLines(titleOptions),
    "",
    "Draft meta description:",
    metaDescription,
    "",
    "Page improvement draft:",
    `${label} has enough search signal to deserve a sharper page. Lead with the search intent, show what the user can do next, then connect the page to related WAKILISHA artists, tracks, releases, charts, and stories.`,
    "",
    "Admin publishing notes:",
    "- Improve the first screen first.",
    "- Add internal links that answer the searcher's next question.",
    "- Keep factual claims grounded in verified registry data.",
    "",
    `Search Console signal: ${item.metrics}`,
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

export type SeoContentOverride = {
  id: string;
  target_url: string;
  title: string | null;
  description: string | null;
  social_title: string | null;
  social_description: string | null;
  payload: Record<string, unknown>;
  status: "active" | "archived";
  source_draft_id: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string;
  archived_at: string | null;
};

export type SeoDraftPublishEvent = {
  id: string;
  draft_id: string | null;
  task_id: string | null;
  override_id: string | null;
  target_url: string;
  event_type: "applied" | "published" | "archived" | "reverted";
  before_payload: Record<string, unknown>;
  after_payload: Record<string, unknown>;
  created_at: string;
};

export type SeoDraftOverrideInput = {
  title?: string;
  description?: string;
  socialTitle?: string;
  socialDescription?: string;
};

function firstMatchingLine(body: string, regex: RegExp) {
  for (const line of body.split("\n")) {
    const match = line.match(regex);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function sectionLine(body: string, label: string) {
  const lines = body.split("\n");
  const index = lines.findIndex((line) => line.trim().toLowerCase() === label.toLowerCase());
  if (index < 0) return "";

  for (const line of lines.slice(index + 1)) {
    const clean = line.trim();
    if (clean) return clean;
  }

  return "";
}

function titleFromTarget(targetUrl: string) {
  const parts = cleanPath(targetUrl).split("/").filter(Boolean);
  if (parts[0] === "artists" && parts[1]) return `${slugToTitle(parts[1])} | WAKILISHA`;
  if (parts[0] === "tracks" && parts.length >= 3) return `${slugToTitle(parts[2])} by ${slugToTitle(parts[1])} | WAKILISHA`;
  if (parts[0] === "releases" && parts.length >= 3) return `${slugToTitle(parts[2])} by ${slugToTitle(parts[1])} | WAKILISHA`;
  if (parts.length) return `${slugToTitle(parts[parts.length - 1])} | WAKILISHA`;
  return "WAKILISHA";
}

function clampMetaDescription(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > 158 ? `${clean.slice(0, 155).trim()}...` : clean;
}

export function deriveSeoOverrideFromDraft(draft: SeoGrowthDraft) {
  const body = draft.body || "";
  const title =
    firstMatchingLine(body, /^\s*1\.\s*(.+)$/) ||
    firstMatchingLine(body, /^Title:\s*(.+)$/i) ||
    titleFromTarget(draft.target_url);

  const description =
    sectionLine(body, "Draft meta description:") ||
    sectionLine(body, "SEO description:") ||
    sectionLine(body, "Opening draft:") ||
    draft.summary ||
    `Explore ${title.replace(/\s+\|\s+WAKILISHA$/i, "")} on WAKILISHA.`;

  return {
    target_url: cleanPath(draft.target_url),
    title: title.trim(),
    description: clampMetaDescription(description),
    social_title: title.trim(),
    social_description: clampMetaDescription(description),
    payload: {
      source: "seo_growth_draft_publish_bridge",
      contentKind: draft.content_kind,
      draftTitle: draft.title,
      draftSummary: draft.summary,
      draftPayload: draft.payload,
    },
  };
}

export async function fetchSeoContentOverrides() {
  const { data, error } = await supabase
    .from("seo_content_overrides")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw readableSupabaseError(error);
  return (data || []) as SeoContentOverride[];
}

export async function applySeoGrowthDraft(draft: SeoGrowthDraft, editedOverride?: SeoDraftOverrideInput) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const timestamp = nowIso();
  const base = deriveSeoOverrideFromDraft(draft);
  const editedTitle = editedOverride?.title?.trim();
  const editedDescription = editedOverride?.description?.trim();
  const editedSocialTitle = editedOverride?.socialTitle?.trim();
  const editedSocialDescription = editedOverride?.socialDescription?.trim();

  const next = {
    ...base,
    title: editedTitle || base.title,
    description: clampMetaDescription(editedDescription || base.description),
    social_title: editedSocialTitle || editedTitle || base.social_title,
    social_description: clampMetaDescription(editedSocialDescription || editedDescription || base.social_description),
    payload: {
      ...base.payload,
      editedBeforeApply: Boolean(editedTitle || editedDescription || editedSocialTitle || editedSocialDescription),
      editedAt: editedTitle || editedDescription || editedSocialTitle || editedSocialDescription ? timestamp : null,
    },
  };

  const { data: existing, error: existingError } = await supabase
    .from("seo_content_overrides")
    .select("*")
    .eq("target_url", next.target_url)
    .eq("status", "active")
    .limit(1);

  if (existingError) throw readableSupabaseError(existingError);

  const before = (existing || [])[0] ?? null;

  const { error: archiveError } = await supabase
    .from("seo_content_overrides")
    .update({
      status: "archived",
      archived_at: timestamp,
      updated_at: timestamp,
      updated_by: userId,
    })
    .eq("target_url", next.target_url)
    .eq("status", "active");

  if (archiveError) throw readableSupabaseError(archiveError);

  const { data: override, error: insertError } = await supabase
    .from("seo_content_overrides")
    .insert({
      ...next,
      status: "active",
      source_draft_id: draft.id,
      task_id: draft.task_id,
      created_by: userId,
      updated_by: userId,
      created_at: timestamp,
      updated_at: timestamp,
      applied_at: timestamp,
    })
    .select("*")
    .single();

  if (insertError) throw readableSupabaseError(insertError);

  const { data: publishedDraft, error: draftError } = await supabase
    .from("seo_growth_drafts")
    .update({
      status: "published",
      published_by: userId,
      published_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", draft.id)
    .select("*")
    .single();

  if (draftError) throw readableSupabaseError(draftError);

  let completedTask: SeoGrowthTask | null = null;

  if (draft.task_id) {
    const { data: task, error: taskError } = await supabase
      .from("seo_growth_tasks")
      .update({
        status: "done",
        updated_by: userId,
        updated_at: timestamp,
        completed_at: timestamp,
      })
      .eq("id", draft.task_id)
      .select("*")
      .single();

    if (taskError) throw readableSupabaseError(taskError);
    completedTask = task as SeoGrowthTask;
  }

  const { error: eventError } = await supabase
    .from("seo_draft_publish_events")
    .insert({
      draft_id: draft.id,
      task_id: draft.task_id,
      override_id: override.id,
      target_url: next.target_url,
      event_type: "applied",
      before_payload: before ?? {},
      after_payload: override,
      actor_id: userId,
    });

  if (eventError) throw readableSupabaseError(eventError);

  return {
    override: override as SeoContentOverride,
    draft: publishedDraft as SeoGrowthDraft,
    task: completedTask,
  };
}

export async function archiveSeoContentOverride(override: SeoContentOverride) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const timestamp = nowIso();

  const { data, error } = await supabase
    .from("seo_content_overrides")
    .update({
      status: "archived",
      archived_at: timestamp,
      updated_at: timestamp,
      updated_by: userId,
    })
    .eq("id", override.id)
    .select("*")
    .single();

  if (error) throw readableSupabaseError(error);

  const { error: eventError } = await supabase
    .from("seo_draft_publish_events")
    .insert({
      draft_id: override.source_draft_id,
      task_id: override.task_id,
      override_id: override.id,
      target_url: override.target_url,
      event_type: "archived",
      before_payload: override,
      after_payload: data,
      actor_id: userId,
    });

  if (eventError) throw readableSupabaseError(eventError);

  return data as SeoContentOverride;
}
