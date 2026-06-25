import { useCallback, useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import {
  fetchAttributionSummary,
  fetchPageTypeDistribution,
  fetchSearchQueries,
  fetchTopEntities,
  fetchTopPages,
  type AttributionSummary,
  type PageTypeDistribution,
  type SearchQueryRow,
  type TopEntity,
  type TopPage,
} from "@/services/adminAnalytics";
import {
  fetchSearchConsoleSeo,
  formatCtr,
  formatPosition,
  syncSearchConsoleSeo,
  type SearchConsolePayload,
  type SearchConsoleRow,
} from "@/services/searchConsoleSeo";
import {
  buildArtistTrendSignalsFromSearchConsole,
  fetchArtistTrendSignals,
  fetchSeoGrowthDrafts,
  fetchSeoGrowthTasks,
  saveArtistTrendSignals,
  saveSeoGrowthTask,
  saveSeoGrowthTaskAndDraft,
  updateArtistTrendSignalStatus,
  updateSeoGrowthTaskStatus,
  type SeoArtistTrendSignal,
  type SeoArtistTrendStatus,
  type SeoGrowthDraft,
  type SeoGrowthTask,
  type SeoGrowthTaskStatus,
} from "@/services/seoGrowthActions";

type SitemapSnapshot = {
  id: string;
  status: "generated" | "published" | "failed";
  source: "internal" | "pro_sitemaps" | "mixed";
  base_url: string;
  url_count: number;
  xml_sha256: string | null;
  pro_sitemaps_site_id: string | null;
  pro_sitemaps_result_json: Record<string, unknown>;
  error_message: string | null;
  generated_at: string;
  published_at: string | null;
};

type ConsoleResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; message: string; detail?: string };

type SeoMetadataEntry = {
  title?: string;
  description?: string;
  kind?: string;
  image?: string | null;
  robots?: string;
  sourceTable?: string | null;
  sourceId?: string | null;
  modifiedAt?: string | null;
};

type MetadataGap = {
  path: string;
  title: string;
  kind: string;
  issue: string;
};

type SeoMeasurement = {
  metadataCount: number;
  dbBackedCount: number;
  indexableCount: number;
  missingImageCount: number;
  missingDescriptionCount: number;
  topSeoPages: TopPage[];
  topSeoEntities: TopEntity[];
  pageTypes: PageTypeDistribution[];
  searchQueries: SearchQueryRow[];
  attribution: AttributionSummary | null;
  gaps: MetadataGap[];
  growthNotes: string[];
};

type GrowthQueueItem = {
  id: string;
  target: string;
  query: string;
  action: string;
  reason: string;
  score: number;
  priority: "High" | "Medium" | "Watch";
  metrics: string;
};

const SEO_PAGE_TYPES = new Set([
  "article",
  "artist_detail",
  "release_detail",
  "track_detail",
  "charts_edition",
  "charts_directory",
  "guide_detail",
  "genre_detail",
  "label_detail",
  "magazine_issue",
  "category_detail",
  "tag_detail",
  "author_detail",
]);

const SEO_ENTITY_TYPES = new Set([
  "artist",
  "release",
  "track",
  "article",
  "chart",
  "guide",
  "genre",
  "label",
  "issue",
]);

const SEO_IMAGE_KINDS = new Set(["artist", "release", "track", "article", "label"]);

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const EDGE_XML_URL = `${SUPABASE_URL}/functions/v1/seo-sitemap-admin?action=xml`;
const ROOT_SITEMAP_URL = "https://wakilisha.africa/sitemap.xml";
const ROOT_ROBOTS_URL = "https://wakilisha.africa/robots.txt";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function shortHash(value?: string | null) {
  if (!value) return "Not stored";
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function isSeoPage(page: TopPage) {
  if (SEO_PAGE_TYPES.has(page.page_type)) return true;
  return /^\/(artists|releases|tracks|charts|articles|magazine|guides|genres|labels|categories|tags|authors)\//.test(page.page_url || "");
}

function isSeoEntity(entity: TopEntity) {
  return SEO_ENTITY_TYPES.has(entity.entity_type);
}

function cleanPathLabel(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/^https?:\/\/wakilisha\.africa/i, "").split("?")[0] || path;
}

function buildGrowthNotes(args: {
  topSeoPages: TopPage[];
  searchQueries: SearchQueryRow[];
  gaps: MetadataGap[];
  attribution: AttributionSummary | null;
}) {
  const notes: string[] = [];

  const zeroResult = args.searchQueries.find((row) => row.zero_results);
  if (zeroResult) {
    notes.push(`Create or improve content for “${zeroResult.query}”. It appears in internal search and has zero-result demand.`);
  }

  const missingImage = args.gaps.find((gap) => gap.issue === "Missing image");
  if (missingImage) {
    notes.push(`Add image coverage for ${missingImage.title}. It is indexable but still missing social/search imagery.`);
  }

  const topPage = args.topSeoPages[0];
  if (topPage) {
    notes.push(`Protect and deepen ${cleanPathLabel(topPage.page_url)}. It is the strongest SEO surface in this period.`);
  }

  const googleSource = args.attribution?.sources.find((row) => /google|search|organic/i.test(row.label));
  if (googleSource) {
    notes.push(`Search/organic is already visible in attribution via ${googleSource.label}. Track this weekly before guessing content priorities.`);
  }

  if (!notes.length) {
    notes.push("No urgent SEO growth signal yet. Keep collecting data and review again after the next crawl/indexing cycle.");
  }

  return notes.slice(0, 4);
}

function searchConsoleCtrLeaks(rows: SearchConsoleRow[]) {
  return rows
    .filter((row) => Number(row.impressions || 0) >= 50 && Number(row.clicks || 0) > 0 && Number(row.ctr || 0) < 0.03)
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
    .slice(0, 10);
}

function searchConsoleLiftTargets(rows: SearchConsoleRow[]) {
  return rows
    .filter((row) => Number(row.impressions || 0) >= 20 && Number(row.position || 0) >= 8 && Number(row.position || 0) <= 20)
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
    .slice(0, 10);
}

function searchConsoleNoClickRows(rows: SearchConsoleRow[]) {
  return rows
    .filter((row) => Number(row.impressions || 0) >= 20 && Number(row.clicks || 0) === 0)
    .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
    .slice(0, 10);
}

function searchConsolePageLabel(row: SearchConsoleRow) {
  return cleanPathLabel(row.page_url || "");
}

function searchConsoleQueryLabel(row: SearchConsoleRow) {
  return row.query || "Unknown query";
}

function normalizeSeoPath(value?: string | null) {
  if (!value) return "";
  const clean = cleanPathLabel(value).toLowerCase();
  if (clean === "/") return clean;
  return clean.replace(/\/$/, "");
}

function hasMetadataGapForPath(path: string, measurement?: SeoMeasurement | null) {
  const normalized = normalizeSeoPath(path);
  return Boolean(
    measurement?.gaps.some((gap) => normalizeSeoPath(gap.path) === normalized),
  );
}

function hasMissingImageForPath(path: string, measurement?: SeoMeasurement | null) {
  const normalized = normalizeSeoPath(path);
  return Boolean(
    measurement?.gaps.some((gap) => normalizeSeoPath(gap.path) === normalized && gap.issue === "Missing image"),
  );
}

function hasInternalSearchDemand(query: string, measurement?: SeoMeasurement | null) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return false;

  return Boolean(
    measurement?.searchQueries.some((row) => {
      const internal = row.query.toLowerCase().trim();
      return internal === normalized || internal.includes(normalized) || normalized.includes(internal);
    }),
  );
}

function pageTypeHint(path: string) {
  const clean = normalizeSeoPath(path);
  if (clean.startsWith("/artists/")) return "artist";
  if (clean.startsWith("/tracks/")) return "track";
  if (clean.startsWith("/releases/")) return "release";
  if (clean.startsWith("/charts/")) return "chart";
  if (clean.startsWith("/articles/")) return "article";
  if (clean.includes("songs") || clean.includes("top-")) return "guide";
  return "page";
}

function actionForSearchRow(row: SearchConsoleRow, measurement?: SeoMeasurement | null) {
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.clicks || 0);
  const ctr = Number(row.ctr || 0);
  const position = Number(row.position || 0);
  const path = searchConsolePageLabel(row);
  const query = searchConsoleQueryLabel(row);
  const type = pageTypeHint(path);
  const missingImage = hasMissingImageForPath(path, measurement);
  const metadataGap = hasMetadataGapForPath(path, measurement);
  const internalDemand = hasInternalSearchDemand(query, measurement);

  if (missingImage) {
    return {
      action: "Add image/artwork",
      reason: `This ${type} is visible in Google but still has a metadata image gap.`,
    };
  }

  if (impressions >= 500 && clicks === 0) {
    return {
      action: "Rewrite snippet/title",
      reason: "Google is testing this result, but nobody is clicking yet.",
    };
  }

  if (impressions >= 500 && ctr < 0.01) {
    return {
      action: "Rewrite title/meta",
      reason: "Strong impressions with very weak CTR. The search result is not selling the click.",
    };
  }

  if (position >= 8 && position <= 20) {
    return {
      action: "Add internal links",
      reason: "This is close enough to move with stronger internal links, supporting copy, and richer page modules.",
    };
  }

  if (metadataGap) {
    return {
      action: "Fix metadata gap",
      reason: "This page has Search Console visibility and still needs metadata cleanup.",
    };
  }

  if (internalDemand && impressions < 100) {
    return {
      action: "Create supporting content",
      reason: "Users are already searching for this inside WAKILISHA before Google has fully picked it up.",
    };
  }

  if (position <= 5 && clicks > 0) {
    return {
      action: "Protect winner",
      reason: "This result is already performing. Keep it fresh and link to deeper related pages.",
    };
  }

  return {
    action: "Improve page depth",
    reason: "This page has enough signal to justify stronger copy, links, and related modules.",
  };
}

function scoreSearchRow(row: SearchConsoleRow, measurement?: SeoMeasurement | null) {
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.clicks || 0);
  const ctr = Number(row.ctr || 0);
  const position = Number(row.position || 0);
  const path = searchConsolePageLabel(row);
  const query = searchConsoleQueryLabel(row);

  let score = Math.log10(impressions + 1) * 24;

  if (impressions >= 1000) score += 25;
  if (impressions >= 5000) score += 20;
  if (clicks === 0 && impressions >= 100) score += 22;
  if (ctr < 0.01 && impressions >= 300) score += 20;
  if (ctr < 0.03 && impressions >= 300) score += 12;
  if (position >= 8 && position <= 20) score += 20;
  if (position > 20 && position <= 40) score += 8;
  if (hasMetadataGapForPath(path, measurement)) score += 14;
  if (hasInternalSearchDemand(query, measurement)) score += 10;

  return Math.round(score);
}

function buildSeoGrowthQueue(rows: SearchConsoleRow[], measurement?: SeoMeasurement | null): GrowthQueueItem[] {
  const seen = new Set<string>();

  return rows
    .filter((row) => Number(row.impressions || 0) >= 50)
    .map((row) => {
      const target = searchConsolePageLabel(row);
      const query = searchConsoleQueryLabel(row);
      const score = scoreSearchRow(row, measurement);
      const action = actionForSearchRow(row, measurement);
      const id = `${target}::${query}`.toLowerCase();

      return {
        id,
        target,
        query,
        action: action.action,
        reason: action.reason,
        score,
        priority: score >= 115 ? "High" : score >= 85 ? "Medium" : "Watch",
        metrics: `${Number(row.impressions || 0).toLocaleString()} imp · ${Number(row.clicks || 0).toLocaleString()} clicks · ${formatCtr(Number(row.ctr || 0))} CTR · pos ${formatPosition(Number(row.position || 0))}`,
      } satisfies GrowthQueueItem;
    })
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 12);
}

function growthItemKeyParts(target: string, query: string | null | undefined, action: string) {
  return `${normalizeSeoPath(target)}::${(query || "").toLowerCase().trim()}::${action.toLowerCase().trim()}`;
}

function growthItemKey(item: GrowthQueueItem) {
  return growthItemKeyParts(item.target, item.query, item.action);
}

function taskKey(task: SeoGrowthTask) {
  return growthItemKeyParts(task.target_url, task.query, task.action);
}

function upsertById<T extends { id?: string }>(rows: T[], next: T) {
  if (!next.id) return rows;
  const exists = rows.some((row) => row.id === next.id);
  if (!exists) return [next, ...rows];
  return rows.map((row) => (row.id === next.id ? next : row));
}

function resultMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Action completed.";
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return "Action completed.";

  const maybeUrlCount = (data as { urlCount?: unknown }).urlCount;
  if (typeof maybeUrlCount === "number") return `Generated ${maybeUrlCount.toLocaleString()} URLs.`;

  const maybeMessage = (data as { message?: unknown }).message;
  if (typeof maybeMessage === "string") return maybeMessage;

  return "Action completed.";
}

export default function AdminSettingsSeoPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SitemapSnapshot | null>(null);
  const [result, setResult] = useState<ConsoleResult | null>(null);
  const [measurementLoading, setMeasurementLoading] = useState(true);
  const [measurement, setMeasurement] = useState<SeoMeasurement | null>(null);
  const [searchConsoleLoading, setSearchConsoleLoading] = useState(true);
  const [searchConsoleSyncing, setSearchConsoleSyncing] = useState(false);
  const [searchConsole, setSearchConsole] = useState<SearchConsolePayload | null>(null);
  const [growthTasks, setGrowthTasks] = useState<SeoGrowthTask[]>([]);
  const [growthDrafts, setGrowthDrafts] = useState<SeoGrowthDraft[]>([]);
  const [artistTrendSignals, setArtistTrendSignals] = useState<SeoArtistTrendSignal[]>([]);
  const [growthActionBusy, setGrowthActionBusy] = useState<string | null>(null);
  const [artistSignalsBusy, setArtistSignalsBusy] = useState<string | null>(null);

  const latestSourceLabel = useMemo(() => {
    if (!snapshot) return "No snapshot yet";
    if (snapshot.source === "mixed") return "Internal + Pro-Sitemaps";
    if (snapshot.source === "pro_sitemaps") return "Pro-Sitemaps";
    return "Internal generator";
  }, [snapshot]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setResult(null);

    const { data, error } = await supabase.functions.invoke("seo-sitemap-admin", {
      method: "GET",
    });

    if (error) {
      setResult({ ok: false, message: "Could not load SEO sitemap status.", detail: error.message });
      setLoading(false);
      return;
    }

    setSnapshot((data as { data?: { snapshot?: SitemapSnapshot | null } })?.data?.snapshot ?? null);
    setLoading(false);
  }, []);

  const loadMeasurement = useCallback(async () => {
    setMeasurementLoading(true);

    try {
      const metadataResponse = await fetch(`${SUPABASE_URL}/functions/v1/seo-sitemap-admin?action=metadata`);
      const metadataPayload = await metadataResponse.json();
      const metadata = ((metadataPayload?.data?.metadata || {}) as Record<string, SeoMetadataEntry>);

      const entries = Object.entries(metadata);
      const indexableEntries = entries.filter(([, entry]) => !String(entry.robots || "").includes("noindex"));
      const dbBackedEntries = indexableEntries.filter(([, entry]) => Boolean(entry.sourceTable && entry.sourceId));
      const missingImageGaps: MetadataGap[] = dbBackedEntries
        .filter(([, entry]) => SEO_IMAGE_KINDS.has(String(entry.kind || "")) && !entry.image)
        .map(([path, entry]) => ({
          path,
          title: entry.title || path,
          kind: entry.kind || "unknown",
          issue: "Missing image",
        }));

      const missingDescriptionGaps: MetadataGap[] = indexableEntries
        .filter(([, entry]) => !String(entry.description || "").trim())
        .map(([path, entry]) => ({
          path,
          title: entry.title || path,
          kind: entry.kind || "unknown",
          issue: "Missing description",
        }));

      const [
        topPages,
        topEntities,
        pageTypes,
        searchQueries,
        attribution,
      ] = await Promise.all([
        fetchTopPages(30, 50),
        fetchTopEntities(30, 50),
        fetchPageTypeDistribution(30),
        fetchSearchQueries(30, 30),
        fetchAttributionSummary(30),
      ]);

      const topSeoPages = topPages.filter(isSeoPage).slice(0, 12);
      const topSeoEntities = topEntities.filter(isSeoEntity).slice(0, 12);
      const gaps = [...missingImageGaps, ...missingDescriptionGaps].slice(0, 12);

      setMeasurement({
        metadataCount: entries.length,
        dbBackedCount: dbBackedEntries.length,
        indexableCount: indexableEntries.length,
        missingImageCount: missingImageGaps.length,
        missingDescriptionCount: missingDescriptionGaps.length,
        topSeoPages,
        topSeoEntities,
        pageTypes,
        searchQueries,
        attribution,
        gaps,
        growthNotes: buildGrowthNotes({ topSeoPages, searchQueries, gaps, attribution }),
      });
    } catch {
      setMeasurement(null);
    } finally {
      setMeasurementLoading(false);
    }
  }, []);

  const loadSearchConsole = useCallback(async () => {
    setSearchConsoleLoading(true);

    try {
      const payload = await fetchSearchConsoleSeo();
      setSearchConsole(payload);
    } catch {
      setSearchConsole(null);
    } finally {
      setSearchConsoleLoading(false);
    }
  }, []);

  const loadGrowthActions = useCallback(async () => {
    try {
      const [tasks, drafts, signals] = await Promise.all([
        fetchSeoGrowthTasks(),
        fetchSeoGrowthDrafts(),
        fetchArtistTrendSignals(),
      ]);

      setGrowthTasks(tasks);
      setGrowthDrafts(drafts);
      setArtistTrendSignals(signals);
    } catch (error) {
      console.error("Failed to load SEO growth actions:", error);
    }
  }, []);

  const runSearchConsoleSync = useCallback(async () => {
    setSearchConsoleSyncing(true);
    setResult(null);

    try {
      const payload = await syncSearchConsoleSeo();
      setSearchConsole(payload);
      setResult({
        ok: true,
        message: `Search Console sync imported ${payload.run?.row_count?.toLocaleString() ?? 0} rows.`,
        detail: payload.run
          ? `${payload.run.start_date} to ${payload.run.end_date}.`
          : "Sync completed.",
      });
    } catch (error) {
      setResult({
        ok: false,
        message: "Search Console sync failed.",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSearchConsoleSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadMeasurement();
    loadSearchConsole();
    loadGrowthActions();
  }, [loadStatus, loadMeasurement, loadSearchConsole, loadGrowthActions]);

  async function saveGrowthTask(item: GrowthQueueItem) {
    setGrowthActionBusy(`task:${item.id}`);
    setResult(null);

    try {
      const task = await saveSeoGrowthTask(item);
      setGrowthTasks((rows) => upsertById(rows, task));
      setResult({
        ok: true,
        message: "SEO growth task saved.",
        detail: `${item.action} for ${item.target}`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: "Could not save SEO growth task.",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setGrowthActionBusy(null);
    }
  }

  async function draftGrowthAction(item: GrowthQueueItem) {
    setGrowthActionBusy(`draft:${item.id}`);
    setResult(null);

    try {
      const { task, draft } = await saveSeoGrowthTaskAndDraft(item);
      setGrowthTasks((rows) => upsertById(rows, task));
      setGrowthDrafts((rows) => upsertById(rows, draft));
      setResult({
        ok: true,
        message: "Admin draft generated.",
        detail: `${draft.content_kind.replace(/_/g, " ")} draft saved for ${item.target}.`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: "Could not generate admin draft.",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setGrowthActionBusy(null);
    }
  }

  async function changeGrowthTaskStatus(taskId: string, status: SeoGrowthTaskStatus) {
    setGrowthActionBusy(`status:${taskId}:${status}`);
    setResult(null);

    try {
      const task = await updateSeoGrowthTaskStatus(taskId, status);
      setGrowthTasks((rows) => upsertById(rows, task));
      setResult({
        ok: true,
        message: "SEO task status updated.",
        detail: `${task.target_url} is now ${status.replace(/_/g, " ")}.`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: "Could not update SEO task.",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setGrowthActionBusy(null);
    }
  }

  async function generateArtistTrendSignals() {
    setArtistSignalsBusy("generate");
    setResult(null);

    try {
      if (!searchConsole?.run) {
        throw new Error("Run Search Console sync before generating artist trend signals.");
      }

      const signals = buildArtistTrendSignalsFromSearchConsole(searchConsole.rows, searchConsole.run);
      const saved = await saveArtistTrendSignals(signals);

      setArtistTrendSignals(saved);
      setResult({
        ok: true,
        message: `Generated ${saved.length.toLocaleString()} artist trend signals.`,
        detail: "Approve or publish signals before they feed public trending artist suggestions.",
      });
    } catch (error) {
      setResult({
        ok: false,
        message: "Could not generate artist trend signals.",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setArtistSignalsBusy(null);
    }
  }

  async function changeArtistTrendSignalStatus(id: string | undefined, status: SeoArtistTrendStatus) {
    if (!id) return;

    setArtistSignalsBusy(`${id}:${status}`);
    setResult(null);

    try {
      const signal = await updateArtistTrendSignalStatus(id, status);
      setArtistTrendSignals((rows) => upsertById(rows, signal));
      setResult({
        ok: true,
        message: "Artist trend signal updated.",
        detail:
          status === "approved" || status === "published"
            ? `${signal.artist_name} can now feed public trending artist suggestions.`
            : `${signal.artist_name} marked ${status}.`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: "Could not update artist trend signal.",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setArtistSignalsBusy(null);
    }
  }

  async function runAction(action: "generate" | "generate_and_pro_update" | "pro_update") {
    setRunning(action);
    setResult(null);

    const { data, error } = await supabase.functions.invoke("seo-sitemap-admin", {
      method: "POST",
      body: { action },
    });

    if (error) {
      setResult({ ok: false, message: "SEO action failed.", detail: error.message });
      setRunning(null);
      return;
    }

    setResult({
      ok: true,
      message: resultMessage(data),
      detail:
        action === "pro_update"
          ? "Pro-Sitemaps update request sent. Check Pro-Sitemaps history for crawl completion."
          : "Snapshot saved. The root static sitemap must still be regenerated/deployed for production if you want a static file refresh.",
    });

    await loadStatus();
    setRunning(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <WkIcon name="Globe" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">SEO Console</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Generate and inspect WAKILISHA public sitemap infrastructure. Internal generation is the source of truth; Pro-Sitemaps is the external crawler support layer.
        </p>
      </div>

      <WkSurface className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[14px] font-black text-[var(--wk-text)]">Launch sitemap status</h2>
            <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
              Latest internal snapshot and public XML endpoints.
            </p>
          </div>

          <button
            onClick={loadStatus}
            disabled={loading || Boolean(running)}
            className="wk-button wk-button-soft wk-button-sm inline-flex items-center justify-center gap-2"
          >
            <WkIcon name={loading ? "Loader" : "RotateCcw"} size={14} />
            {loading ? "Refreshing..." : "Refresh status"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="URLs" value={snapshot ? snapshot.url_count.toLocaleString() : "0"} />
          <MetricCard label="Source" value={latestSourceLabel} />
          <MetricCard label="Generated" value={formatDate(snapshot?.generated_at)} />
          <MetricCard label="Hash" value={shortHash(snapshot?.xml_sha256)} mono />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <EndpointCard label="Root sitemap" url={ROOT_SITEMAP_URL} />
          <EndpointCard label="Robots" url={ROOT_ROBOTS_URL} />
          <EndpointCard label="Edge fallback XML" url={EDGE_XML_URL} />
        </div>
      </WkSurface>

      <SeoMeasurementPanel
        loading={measurementLoading}
        measurement={measurement}
        onRefresh={loadMeasurement}
      />

      <SearchConsolePanel
        loading={searchConsoleLoading}
        syncing={searchConsoleSyncing}
        payload={searchConsole}
        measurement={measurement}
        growthTasks={growthTasks}
        growthDrafts={growthDrafts}
        artistTrendSignals={artistTrendSignals}
        growthActionBusy={growthActionBusy}
        artistSignalsBusy={artistSignalsBusy}
        onRefresh={loadSearchConsole}
        onSync={runSearchConsoleSync}
        onSaveTask={saveGrowthTask}
        onDraftAction={draftGrowthAction}
        onTaskStatusChange={changeGrowthTaskStatus}
        onGenerateArtistSignals={generateArtistTrendSignals}
        onArtistSignalStatusChange={changeArtistTrendSignalStatus}
      />

      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-black text-[var(--wk-text)]">Actions</h2>

        <div className="grid gap-3 lg:grid-cols-3">
          <SeoActionButton
            label="Generate internal sitemap"
            icon="Play"
            description="Build a fresh sitemap snapshot from WAKILISHA public content tables."
            running={running === "generate"}
            disabled={Boolean(running)}
            onClick={() => runAction("generate")}
          />

          <SeoActionButton
            label="Generate + Pro-Sitemaps update"
            icon="RefreshCw"
            description="Build a fresh internal snapshot and ask Pro-Sitemaps to refresh its crawl."
            running={running === "generate_and_pro_update"}
            disabled={Boolean(running)}
            onClick={() => runAction("generate_and_pro_update")}
          />

          <SeoActionButton
            label="Trigger Pro-Sitemaps only"
            icon="Globe"
            description="Ask Pro-Sitemaps to update using the configured external account."
            running={running === "pro_update"}
            disabled={Boolean(running)}
            onClick={() => runAction("pro_update")}
          />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="mb-3 text-[14px] font-black text-[var(--wk-text)]">Operational notes</h2>
        <div className="space-y-2 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
          <p>
            Internal sitemap generation writes an audited snapshot to Supabase. The public Edge XML endpoint can always rebuild from live data if no snapshot exists.
          </p>
          <p>
            For today’s static production launch, regenerate the root <code className="font-mono text-[var(--wk-text)]">public/sitemap.xml</code> from the Edge XML endpoint, commit it, and deploy frontend.
          </p>
          <p>
            Pro-Sitemaps must never be the only source of truth. It is useful for external crawling and validation, but WAKILISHA owns the fallback.
          </p>
        </div>
      </WkSurface>

      {result && (
        <WkSurface className={`p-4 ${result.ok ? "border-l-4 border-[var(--wk-success)]" : "border-l-4 border-[var(--wk-danger)]"}`}>
          <div className="flex items-center gap-2">
            <WkIcon name={result.ok ? "CheckCircle" : "XCircle"} size={16} className={result.ok ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"} />
            <span className={`text-[13px] font-semibold ${result.ok ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"}`}>
              {result.message}
            </span>
          </div>
          {result.detail && <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">{result.detail}</p>}
        </WkSurface>
      )}
    </div>
  );
}

function SearchConsolePanel({
  loading,
  syncing,
  payload,
  measurement,
  growthTasks,
  growthDrafts,
  artistTrendSignals,
  growthActionBusy,
  artistSignalsBusy,
  onRefresh,
  onSync,
  onSaveTask,
  onDraftAction,
  onTaskStatusChange,
  onGenerateArtistSignals,
  onArtistSignalStatusChange,
}: {
  loading: boolean;
  syncing: boolean;
  payload: SearchConsolePayload | null;
  measurement?: SeoMeasurement | null;
  growthTasks: SeoGrowthTask[];
  growthDrafts: SeoGrowthDraft[];
  artistTrendSignals: SeoArtistTrendSignal[];
  growthActionBusy: string | null;
  artistSignalsBusy: string | null;
  onRefresh: () => void;
  onSync: () => void;
  onSaveTask: (item: GrowthQueueItem) => void;
  onDraftAction: (item: GrowthQueueItem) => void;
  onTaskStatusChange: (taskId: string, status: SeoGrowthTaskStatus) => void;
  onGenerateArtistSignals: () => void;
  onArtistSignalStatusChange: (id: string | undefined, status: SeoArtistTrendStatus) => void;
}) {
  const run = payload?.run ?? null;
  const rows = payload?.rows ?? [];
  const growthQueue = buildSeoGrowthQueue(rows, measurement);
  const ctrLeaks = searchConsoleCtrLeaks(rows);
  const liftTargets = searchConsoleLiftTargets(rows);
  const noClickRows = searchConsoleNoClickRows(rows);

  return (
    <WkSurface className="p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[14px] font-black text-[var(--wk-text)]">Search Console API</h2>
          <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
            Google-side SEO truth: clicks, impressions, CTR, average position, and page/query opportunities.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onRefresh}
            disabled={loading || syncing}
            className="wk-button wk-button-soft wk-button-sm inline-flex items-center justify-center gap-2"
          >
            <WkIcon name={loading ? "Loader" : "RotateCcw"} size={14} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={onSync}
            disabled={loading || syncing}
            className="wk-button wk-button-primary wk-button-sm inline-flex items-center justify-center gap-2"
          >
            <WkIcon name={syncing ? "Loader" : "Cloud"} size={14} />
            {syncing ? "Syncing..." : "Sync Search Console"}
          </button>
        </div>
      </div>

      {!run && !loading && (
        <div className="mt-5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
          No Search Console sync has been imported yet. Configure Google service account secrets, add the service account to Search Console, then run the sync.
        </div>
      )}

      {run && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Clicks" value={Number(run.total_clicks || 0).toLocaleString()} />
            <MetricCard label="Impressions" value={Number(run.total_impressions || 0).toLocaleString()} />
            <MetricCard label="CTR" value={formatCtr(Number(run.average_ctr || 0))} />
            <MetricCard label="Avg position" value={formatPosition(Number(run.average_position || 0))} />
            <MetricCard label="Rows" value={Number(run.row_count || 0).toLocaleString()} />
          </div>

          <p className="mt-3 text-[11px] text-[var(--wk-text-faint)]">
            Latest sync: {run.site_url} · {run.start_date} to {run.end_date} · {formatDate(run.completed_at || run.started_at)}
          </p>

          <GrowthQueuePanel
            items={growthQueue}
            tasks={growthTasks}
            drafts={growthDrafts}
            busyKey={growthActionBusy}
            onSaveTask={onSaveTask}
            onDraftAction={onDraftAction}
          />

          <GrowthActionsPanel
            tasks={growthTasks}
            drafts={growthDrafts}
            busyKey={growthActionBusy}
            onTaskStatusChange={onTaskStatusChange}
          />

          <ArtistTrendSignalsPanel
            run={run}
            signals={artistTrendSignals}
            busyKey={artistSignalsBusy}
            onGenerate={onGenerateArtistSignals}
            onStatusChange={onArtistSignalStatusChange}
          />

          <div className="mt-5 grid gap-4 xl:grid-cols-3 xl:items-start">
            <SeoTable
              title="CTR leaks"
              description="Google is showing these pages, but the click-through rate is weak."
              empty="No clear CTR leaks yet."
              limit={8}
              overflowNote="Showing the strongest CTR leaks from the latest Search Console sync."
              rows={ctrLeaks.map((row) => ({
                primary: searchConsolePageLabel(row),
                secondary: searchConsoleQueryLabel(row),
                value: `${Number(row.impressions || 0).toLocaleString()} imp · ${formatCtr(Number(row.ctr || 0))}`,
              }))}
            />

            <SeoTable
              title="Ranking lift targets"
              description="Queries/pages sitting near page-one or page-two breakthrough range."
              empty="No position 8–20 lift targets yet."
              limit={8}
              overflowNote="Showing the strongest ranking lift targets from the latest Search Console sync."
              rows={liftTargets.map((row) => ({
                primary: searchConsoleQueryLabel(row),
                secondary: searchConsolePageLabel(row),
                value: `pos ${formatPosition(Number(row.position || 0))} · ${Number(row.impressions || 0).toLocaleString()} imp`,
              }))}
            />

            <SeoTable
              title="Impressions, no clicks"
              description="Google is testing these results, but users are not choosing them yet."
              empty="No high-impression zero-click pages yet."
              limit={8}
              overflowNote="Showing the strongest zero-click opportunities from the latest Search Console sync."
              rows={noClickRows.map((row) => ({
                primary: searchConsolePageLabel(row),
                secondary: searchConsoleQueryLabel(row),
                value: `${Number(row.impressions || 0).toLocaleString()} imp`,
              }))}
            />
          </div>
        </>
      )}
    </WkSurface>
  );
}

function GrowthQueuePanel({
  items,
  tasks,
  drafts,
  busyKey,
  onSaveTask,
  onDraftAction,
}: {
  items: GrowthQueueItem[];
  tasks: SeoGrowthTask[];
  drafts: SeoGrowthDraft[];
  busyKey: string | null;
  onSaveTask: (item: GrowthQueueItem) => void;
  onDraftAction: (item: GrowthQueueItem) => void;
}) {
  const taskByKey = useMemo(() => {
    return new Map(tasks.map((task) => [taskKey(task), task]));
  }, [tasks]);

  const draftByKey = useMemo(() => {
    return new Map(drafts.map((draft) => [growthItemKeyParts(draft.target_url, draft.query, draft.action), draft]));
  }, [drafts]);

  return (
    <div className="mt-5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <WkIcon name="TrendingUp" size={15} className="text-[var(--wk-brand)]" />
            <h3 className="text-[13px] font-black text-[var(--wk-text)]">Priority growth queue</h3>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Ranked worklist from Search Console demand, CTR leaks, ranking distance, metadata gaps, and internal search demand.
          </p>
        </div>
        {items.length > 0 && (
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            {items.length} active opportunities
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 && (
          <p className="text-[12px] text-[var(--wk-text-faint)]">
            No priority growth items yet. Sync Search Console again after Google collects more data.
          </p>
        )}

        {items.map((item, index) => {
          const key = growthItemKey(item);
          const task = taskByKey.get(key);
          const draft = draftByKey.get(key);
          const taskBusy = busyKey === `task:${item.id}`;
          const draftBusy = busyKey === `draft:${item.id}`;

          return (
            <div
              key={item.id}
              className="grid gap-3 rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 xl:grid-cols-[48px_1.25fr_1fr_1fr_210px]"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Rank</p>
                <p className="mt-1 text-[18px] font-black text-[var(--wk-text)]">#{index + 1}</p>
              </div>

              <div className="min-w-0">
                <p className="truncate text-[13px] font-black text-[var(--wk-text)]">{item.target}</p>
                <p className="mt-1 truncate text-[11px] uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{item.query}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">{item.metrics}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Action</p>
                <p className="mt-1 text-[13px] font-black text-[var(--wk-text)]">{item.action}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">{item.reason}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Priority</p>
                <p className="mt-1 text-[13px] font-black text-[var(--wk-text)]">{item.priority}</p>
                <p className="mt-2 font-mono text-[11px] text-[var(--wk-text-muted)]">score {item.score}</p>
                {task && <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-success)]">Task: {task.status.replace(/_/g, " ")}</p>}
                {draft && <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-brand)]">Draft ready</p>}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onDraftAction(item)}
                  disabled={Boolean(busyKey)}
                  className="wk-button wk-button-primary wk-button-sm inline-flex items-center justify-center gap-2"
                >
                  <WkIcon name={draftBusy ? "Loader" : "Sparkles"} size={14} />
                  {draftBusy ? "Drafting..." : draft ? "Refresh draft" : "Draft action"}
                </button>
                <button
                  type="button"
                  onClick={() => onSaveTask(item)}
                  disabled={Boolean(busyKey)}
                  className="wk-button wk-button-soft wk-button-sm inline-flex items-center justify-center gap-2"
                >
                  <WkIcon name={taskBusy ? "Loader" : "CheckSquare"} size={14} />
                  {taskBusy ? "Saving..." : task ? "Task saved" : "Save task"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GrowthActionsPanel({
  tasks,
  drafts,
  busyKey,
  onTaskStatusChange,
}: {
  tasks: SeoGrowthTask[];
  drafts: SeoGrowthDraft[];
  busyKey: string | null;
  onTaskStatusChange: (taskId: string, status: SeoGrowthTaskStatus) => void;
}) {
  const openTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const latestDrafts = drafts.slice(0, 6);

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-2 xl:items-start">
      <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-black text-[var(--wk-text)]">Saved SEO tasks</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
              Operational queue for growth actions that need publishing, media, review, or follow-up.
            </p>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">{openTasks.length} open</p>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-[12px] text-[var(--wk-text-faint)]">No saved SEO tasks yet.</p>}
          {tasks.slice(0, 8).map((task) => (
            <div key={task.id} className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black text-[var(--wk-text)]">{task.target_url}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{task.action} · {task.priority}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">{task.reason}</p>
                </div>
                <p className="shrink-0 rounded-full border border-[var(--wk-border)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
                  {task.status.replace(/_/g, " ")}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(["open", "in_progress", "done", "ignored"] as SeoGrowthTaskStatus[]).map((status) => (
                  <button
                    key={`${task.id}-${status}`}
                    type="button"
                    disabled={Boolean(busyKey) || task.status === status}
                    onClick={() => onTaskStatusChange(task.id, status)}
                    className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] transition hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyKey === `status:${task.id}:${status}` ? "Saving..." : status.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
        <div className="mb-3">
          <h3 className="text-[13px] font-black text-[var(--wk-text)]">Admin drafts</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Culture Context powered drafts and safe SEO copy suggestions. Review before publishing.
          </p>
        </div>

        <div className="space-y-2">
          {latestDrafts.length === 0 && <p className="text-[12px] text-[var(--wk-text-faint)]">No admin drafts yet.</p>}
          {latestDrafts.map((draft) => (
            <details key={draft.id} className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
              <summary className="cursor-pointer text-[12px] font-black text-[var(--wk-text)]">
                {draft.title}
              </summary>
              <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                {draft.content_kind.replace(/_/g, " ")} · {draft.status}
              </p>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
                {draft.body}
              </pre>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArtistTrendSignalsPanel({
  run,
  signals,
  busyKey,
  onGenerate,
  onStatusChange,
}: {
  run: SearchConsolePayload["run"];
  signals: SeoArtistTrendSignal[];
  busyKey: string | null;
  onGenerate: () => void;
  onStatusChange: (id: string | undefined, status: SeoArtistTrendStatus) => void;
}) {
  const publicSignals = signals.filter((signal) => signal.status === "approved" || signal.status === "published");

  return (
    <div className="mt-5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <WkIcon name="Radio" size={15} className="text-[var(--wk-brand)]" />
            <h3 className="text-[13px] font-black text-[var(--wk-text)]">Search-driven artist trend signals</h3>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Converts the latest Search Console artist-page demand into trend candidates. Approve or publish to feed public trending artist suggestions.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!run || Boolean(busyKey)}
          className="wk-button wk-button-primary wk-button-sm inline-flex items-center justify-center gap-2"
        >
          <WkIcon name={busyKey === "generate" ? "Loader" : "Sparkles"} size={14} />
          {busyKey === "generate" ? "Generating..." : "Generate artist signals"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Trend candidates" value={signals.length.toLocaleString()} />
        <MetricCard label="Public feed ready" value={publicSignals.length.toLocaleString()} />
        <MetricCard label="Source window" value={run ? `${run.start_date} → ${run.end_date}` : "No sync yet"} mono />
      </div>

      <div className="mt-4 space-y-2">
        {signals.length === 0 && (
          <p className="text-[12px] text-[var(--wk-text-faint)]">
            No artist trend signals yet. Generate them after Search Console sync has artist-page rows.
          </p>
        )}

        {signals.slice(0, 10).map((signal) => (
          <div key={signal.id || signal.artist_slug} className="grid gap-3 rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 lg:grid-cols-[1fr_1fr_170px]">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black text-[var(--wk-text)]">{signal.artist_name}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{signal.artist_url}</p>
              <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">
                score {signal.trend_score} · {signal.impressions.toLocaleString()} imp · {signal.clicks.toLocaleString()} clicks · {formatCtr(Number(signal.ctr || 0))} CTR · pos {formatPosition(Number(signal.average_position || 0))}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Top queries</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
                {signal.top_queries?.length ? signal.top_queries.join(", ") : "No query sample"}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Status: {signal.status || "candidate"}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["approved", "published", "rejected", "candidate"] as SeoArtistTrendStatus[]).map((status) => (
                  <button
                    key={`${signal.id}-${status}`}
                    type="button"
                    disabled={Boolean(busyKey) || signal.status === status}
                    onClick={() => onStatusChange(signal.id, status)}
                    className="rounded-full border border-[var(--wk-border)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--wk-text-muted)] transition hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyKey === `${signal.id}:${status}` ? "Saving" : status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeoMeasurementPanel({
  loading,
  measurement,
  onRefresh,
}: {
  loading: boolean;
  measurement: SeoMeasurement | null;
  onRefresh: () => void;
}) {
  return (
    <WkSurface className="p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[14px] font-black text-[var(--wk-text)]">SEO measurement</h2>
          <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
            Growth cockpit for indexable metadata, first-party traffic, internal search demand, and content gaps.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="wk-button wk-button-soft wk-button-sm inline-flex items-center justify-center gap-2"
        >
          <WkIcon name={loading ? "Loader" : "RotateCcw"} size={14} />
          {loading ? "Refreshing..." : "Refresh measurement"}
        </button>
      </div>

      {!measurement && !loading && (
        <div className="mt-5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[12px] text-[var(--wk-text-muted)]">
          SEO measurement could not load. Check the metadata endpoint and analytics_events access.
        </div>
      )}

      {measurement && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Metadata routes" value={measurement.metadataCount.toLocaleString()} />
            <MetricCard label="Indexable" value={measurement.indexableCount.toLocaleString()} />
            <MetricCard label="DB-backed" value={measurement.dbBackedCount.toLocaleString()} />
            <MetricCard label="Missing images" value={measurement.missingImageCount.toLocaleString()} />
            <MetricCard label="Attributed page views" value={measurement.attribution?.attributedPageViews.toLocaleString() ?? "0"} />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2 xl:items-start">
            <SeoTable
              title="Top SEO pages"
              description="First-party page views for crawlable public surfaces over the last 30 days."
              empty="No SEO page traffic yet."
              rows={measurement.topSeoPages.map((row) => ({
                primary: cleanPathLabel(row.page_url),
                secondary: row.page_type.replace(/_/g, " "),
                value: row.views.toLocaleString(),
              }))}
            />

            <SeoTable
              title="Top SEO entities"
              description="Artist, release, track, article, chart, guide, genre, and label demand from analytics_events."
              empty="No entity-level SEO traffic yet."
              rows={measurement.topSeoEntities.map((row) => ({
                primary: row.entity_slug,
                secondary: row.entity_type,
                value: row.views.toLocaleString(),
              }))}
            />

            <SeoTable
              title="Internal search demand"
              description="Queries users are already typing inside WAKILISHA. Zero-result rows are growth opportunities."
              empty="No internal search demand yet."
              rows={measurement.searchQueries.slice(0, 10).map((row) => ({
                primary: row.query,
                secondary: row.zero_results ? "zero results" : "has results",
                value: row.count.toLocaleString(),
              }))}
            />

            <SeoTable
              title="Metadata gaps"
              description="Indexable DB-backed pages that need imagery or stronger metadata before we scale them."
              empty="No obvious metadata gaps in the sampled routes."
              limit={8}
              overflowNote="Showing first metadata gaps only. Use the metadata endpoint for the full gap list."
              rows={measurement.gaps.map((gap) => ({
                primary: cleanPathLabel(gap.path),
                secondary: `${gap.kind} · ${gap.issue}`,
                value: gap.title,
              }))}
            />
          </div>

          <div className="mt-5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <WkIcon name="TrendingUp" size={15} className="text-[var(--wk-brand)]" />
              <h3 className="text-[13px] font-black text-[var(--wk-text)]">Growth notes</h3>
            </div>
            <div className="space-y-2">
              {measurement.growthNotes.map((note) => (
                <p key={note} className="text-[12px] leading-relaxed text-[var(--wk-text-muted)]">{note}</p>
              ))}
            </div>
          </div>
        </>
      )}
    </WkSurface>
  );
}

function SeoTable({
  title,
  description,
  empty,
  rows,
  limit = 10,
  overflowNote,
}: {
  title: string;
  description: string;
  empty: string;
  rows: Array<{ primary: string; secondary: string; value: string }>;
  limit?: number;
  overflowNote?: string;
}) {
  const visibleRows = rows.slice(0, limit);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);

  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <h3 className="text-[13px] font-black text-[var(--wk-text)]">{title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">{description}</p>
      <div className="mt-4 space-y-2">
        {rows.length === 0 && <p className="text-[12px] text-[var(--wk-text-faint)]">{empty}</p>}
        {visibleRows.map((row) => (
          <div key={`${title}-${row.primary}-${row.secondary}-${row.value}`} className="grid gap-2 rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 md:grid-cols-[1fr_120px]">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold text-[var(--wk-text)]">{row.primary}</p>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{row.secondary}</p>
            </div>
            <p className="truncate text-left text-[12px] font-black text-[var(--wk-text)] md:text-right">{row.value}</p>
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="pt-2 text-[11px] text-[var(--wk-text-faint)]">
            {overflowNote || `Showing first ${visibleRows.length} of ${rows.length}.`}
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">{label}</p>
      <p className={`mt-2 truncate text-[18px] font-black text-[var(--wk-text)] ${mono ? "font-mono text-[13px]" : ""}`}>{value}</p>
    </div>
  );
}

function EndpointCard({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition hover:border-[var(--wk-brand)]"
    >
      <div className="mb-1 flex items-center gap-2">
        <WkIcon name="ExternalLink" size={14} className="text-[var(--wk-text-muted)]" />
        <span className="text-[12px] font-black text-[var(--wk-text)]">{label}</span>
      </div>
      <p className="truncate font-mono text-[11px] text-[var(--wk-text-muted)]">{url}</p>
    </a>
  );
}

function SeoActionButton({
  label,
  icon,
  description,
  running,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  description: string;
  running: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <WkIcon name={icon as never} size={16} className="text-[var(--wk-text-muted)]" />
        <span className="text-[13px] font-bold text-[var(--wk-text)]">{label}</span>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className="wk-button wk-button-soft wk-button-sm flex w-full items-center justify-center gap-1.5"
      >
        <WkIcon name={running ? "Loader" : "Play"} size={14} />
        {running ? "Running..." : "Run"}
      </button>
    </div>
  );
}
