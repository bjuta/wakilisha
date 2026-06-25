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

function humanJoin(values: string[], limit = 5) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean).slice(0, limit);
  if (cleanValues.length <= 1) return cleanValues[0] || "";
  if (cleanValues.length === 2) return `${cleanValues[0]} and ${cleanValues[1]}`;
  return `${cleanValues.slice(0, -1).join(", ")}, and ${cleanValues[cleanValues.length - 1]}`;
}

function buildMetaDescription(label: string, item: SeoGrowthActionInput, trackNames: string[] = []) {
  const intent = cleanIntent(item.query);
  const tracks = humanJoin(trackNames, 5);

  if (tracks) {
    return clampMetaDescription(
      `Explore ${label} on WAKILISHA, including ${tracks}, releases, credits, and related music context.`,
    );
  }

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

type ArtistDraftContext = {
  name: string;
  country?: string;
  genres: string[];
  topSongs: Array<{ title: string }>;
  releases: Array<{ title: string; releaseType?: string | null; releaseDate?: string | null; labelName?: string | null }>;
  trackCount?: number;
  releaseCount?: number;
  labels: string[];
};

function rowMeta(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const value = row?.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstText(row: Record<string, unknown> | null | undefined, rowKeys: string[], metaKeys: string[] = []) {
  const meta = rowMeta(row);

  for (const key of rowKeys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const key of metaKeys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function uniqueStrings(values: string[], limit = 8) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const clean = value.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }

  return out;
}

async function fetchArtistDraftContext(artistSlug: string): Promise<ArtistDraftContext | null> {
  try {
    const { data: artistRow } = await supabase
      .from("registry_artists")
      .select("*")
      .eq("slug", artistSlug)
      .maybeSingle();

    const [trackLinksResponse, releaseLinksResponse] = await Promise.all([
      supabase
        .from("registry_track_artists")
        .select("track_id, artist_name_text, is_primary, is_featured, credit_order, status")
        .eq("artist_slug", artistSlug)
        .in("status", ["active", "shadow"])
        .limit(120),
      supabase
        .from("registry_release_artists")
        .select("release_id, artist_name_text, is_primary, is_featured, credit_order, status")
        .eq("artist_slug", artistSlug)
        .in("status", ["active", "shadow"])
        .limit(120),
    ]);

    const trackIds = uniqueStrings((trackLinksResponse.data || []).map((row: any) => String(row.track_id || "")), 80);
    const releaseIds = uniqueStrings((releaseLinksResponse.data || []).map((row: any) => String(row.release_id || "")), 80);

    const [tracksResponse, releasesResponse] = await Promise.all([
      trackIds.length
        ? supabase.from("registry_tracks").select("*").in("id", trackIds).limit(80)
        : Promise.resolve({ data: [], error: null }),
      releaseIds.length
        ? supabase.from("registry_releases").select("*").in("id", releaseIds).limit(80)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (trackLinksResponse.error) console.warn("SEO artist track link lookup failed:", trackLinksResponse.error.message);
    if (releaseLinksResponse.error) console.warn("SEO artist release link lookup failed:", releaseLinksResponse.error.message);
    if (tracksResponse.error) console.warn("SEO artist track lookup failed:", tracksResponse.error.message);
    if (releasesResponse.error) console.warn("SEO artist release lookup failed:", releasesResponse.error.message);

    const trackRows = (tracksResponse.data || []) as Record<string, unknown>[];
    const releaseRows = (releasesResponse.data || []) as Record<string, unknown>[];
    const trackById = new Map(trackRows.map((row) => [String(row.id || ""), row]));
    const releaseById = new Map(releaseRows.map((row) => [String(row.id || ""), row]));

    const orderedTracks = trackIds
      .map((id) => trackById.get(id))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((row) => ({
        title: firstText(row, ["title", "name", "display_title", "normalized_title"], ["title", "name", "display_title", "normalized_title"]),
      }))
      .filter((row) => row.title);

    const orderedReleases = releaseIds
      .map((id) => releaseById.get(id))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((row) => ({
        title: firstText(row, ["title", "name", "display_title", "normalized_title"], ["title", "name", "display_title", "normalized_title"]),
        releaseType: firstText(row, ["release_type", "type"], ["release_type", "type"]) || null,
        releaseDate: firstText(row, ["release_date", "date"], ["release_date", "date"]) || null,
        labelName: firstText(row, ["label_name"], ["label_name"]) || null,
      }))
      .filter((row) => row.title);

    const artist = (artistRow || {}) as Record<string, unknown>;
    const meta = rowMeta(artist);
    const genres = uniqueStrings([
      ...stringArray(artist.genres),
      ...stringArray(meta.genres),
      ...stringArray(meta.genre),
    ], 5);

    const labels = uniqueStrings(orderedReleases.map((release) => release.labelName || ""), 5);
    const linkArtistName =
      firstText((trackLinksResponse.data || [])[0] as Record<string, unknown> | undefined, ["artist_name_text"]) ||
      firstText((releaseLinksResponse.data || [])[0] as Record<string, unknown> | undefined, ["artist_name_text"]);

    return {
      name: firstText(artist, ["name", "title", "display_name", "artist_name", "normalized_name"], ["name", "display_name", "artist_name"]) || linkArtistName || slugToTitle(artistSlug),
      country: firstText(artist, ["country", "country_name"], ["country", "country_name"]) || undefined,
      genres,
      topSongs: orderedTracks.slice(0, 8),
      releases: orderedReleases.slice(0, 6),
      trackCount: orderedTracks.length || undefined,
      releaseCount: orderedReleases.length || undefined,
      labels,
    };
  } catch (error) {
    console.warn("SEO artist draft context lookup failed:", error);
    return null;
  }
}

function artistFactPayload(artistName: string, context: ArtistDraftContext | null) {
  return {
    name: context?.name || artistName,
    country: context?.country || "",
    genres: context?.genres || [],
    topSongs: context?.topSongs || [],
    releases: context?.releases || [],
    trackCount: context?.trackCount,
    releaseCount: context?.releaseCount,
    labels: context?.labels || [],
  };
}

function buildArtistDraftBody(item: SeoGrowthActionInput, artistSlug: string, context: ArtistDraftContext | null = null) {
  const artistName = context?.name || slugToTitle(artistSlug);
  const topSongNames = uniqueStrings((context?.topSongs || []).map((song) => song.title), 8);
  const releaseNames = uniqueStrings((context?.releases || []).map((release) => release.title), 6);
  const artist = artistFactPayload(artistName, context);
  const heroIntro = buildArtistHeroIntro(artist);
  const cardBlurb = buildArtistCardBlurb(artist);
  const seoDescription = buildArtistSeoDescription(artist);
  const titleOptions = buildTitleOptions(artistName, item);
  const metaDescription = buildMetaDescription(artistName, item, topSongNames);
  const intent = cleanIntent(item.query);
  const discographySignal = topSongNames.length
    ? `${artistName} now has discography signals: ${humanJoin(topSongNames, 6)}.`
    : releaseNames.length
      ? `${artistName} now has release signals: ${humanJoin(releaseNames, 4)}.`
      : `${artistName} still needs stronger discography data before the copy can make specific catalogue promises.`;

  const pageIntro = topSongNames.length
    ? `${artistName}'s WAKILISHA page brings together the artist's catalogue, including ${humanJoin(topSongNames, 6)}. Start here for songs, releases, credits, and the music context around ${artistName}, then keep moving through related tracks and artists inside WAKILISHA.`
    : `${artistName} is picking up search demand on WAKILISHA. For people searching ${quoteIntent(item.query)}, this page should work as the clean starting point: available songs, releases, related artists, and the music context around the name. Keep it direct, useful, and easy to keep moving from.`;

  return [
    `Target: ${cleanPath(item.target)}`,
    `Search intent: ${intent}`,
    `Recommended action: ${item.action}`,
    "",
    "Search result problem:",
    searchDiagnosis(item),
    "",
    "Discography signal:",
    discographySignal,
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
    pageIntro,
    "",
    "Internal link module draft:",
    `Looking for ${artistName} music? Start with ${topSongNames.length ? humanJoin(topSongNames, 4) : "the available songs and releases"}, then follow related tracks, featured credits, artist links, and chart or culture signals connected to this page.`,
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

export async function buildGrowthDraft(item: SeoGrowthActionInput) {
  const artistSlug = extractArtistSlug(item.target);
  const contentKind = inferContentKind(item.action);
  const artistContext = artistSlug ? await fetchArtistDraftContext(artistSlug) : null;
  const body = artistSlug ? buildArtistDraftBody(item, artistSlug, artistContext) : buildGenericDraftBody(item);

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
      artistContext,
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
  const draft = await buildGrowthDraft(item);

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
