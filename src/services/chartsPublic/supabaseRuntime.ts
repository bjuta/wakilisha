import { supabase } from "@/lib/supabase";
import type { ChartEdition, ChartEditionEntry, ChartFamily, TrackChartHistory } from "./types";

type DbRow = Record<string, unknown>;

type EditionLookup = {
  edition: ChartEdition;
  raw: DbRow;
  familySlug: string;
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asMovement(value: unknown): ChartEditionEntry["movement"] {
  if (value === "up" || value === "down" || value === "same" || value === "new" || value === "re_entry") return value;
  return "same";
}

function slugify(value: string, fallback = "item"): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || fallback;
}

function dateOnly(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "";
  return raw.slice(0, 10);
}

function pick(row: DbRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return fallback;
}

function familySlugFromRow(row: DbRow): string {
  return slugify(
    pick(row, ["public_slug", "publicSlug", "series_slug", "seriesSlug", "slug", "name", "title", "id"], "charts"),
    "charts"
  );
}

function editionFamilySlug(row: DbRow, fallback = "charts"): string {
  return slugify(
    pick(row, ["public_slug", "publicSlug", "series_slug", "seriesSlug", "chart_slug", "chartSlug", "series", "program_slug", "family_slug"], fallback),
    fallback
  );
}

function toFamily(row: DbRow, latest?: ChartEdition | null): ChartFamily {
  const slug = familySlugFromRow(row);
  const label = pick(row, ["public_label", "publicLabel", "series_label", "seriesLabel", "label", "name", "title"], slug.replaceAll("-", " "));
  const marketSlug = slugify(pick(row, ["market_slug", "marketSlug", "country_slug", "country", "country_iso2"], "kenya"), "kenya");
  const marketLabel = pick(row, ["market_label", "marketLabel", "country_label", "country_name", "country"], marketSlug.toUpperCase());

  return {
    id: pick(row, ["id"], slug),
    familyKey: slug,
    label,
    description: pick(row, ["description", "dek", "summary"], ""),
    defaultChartSize: asNumber(row.default_chart_size ?? row.defaultChartSize ?? latest?.entryCount, latest?.entryCount || 100),
    defaultRegion: marketLabel,
    editionFrequency: "weekly",
    defaultRuleset: pick(row, ["eligibility_rules_version", "eligibilityRulesVersion"], "legacy-import-v1"),
    defaultScoringModel: pick(row, ["methodology_version", "methodologyVersion"], "legacy-import-v1"),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    slug,
    sourceFamilySlug: slug,
    seriesSlug: slug,
    seriesLabel: label,
    marketSlug,
    marketLabel,
    publicSlug: slug,
    publicLabel: label,
    shortLabel: pick(row, ["short_label", "shortLabel"], label),
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: pick(row, ["methodology_version", "methodologyVersion"], "legacy-import-v1"),
    eligibilityRulesVersion: pick(row, ["eligibility_rules_version", "eligibilityRulesVersion"], "legacy-import-v1"),
    legacySlugs: [],
  };
}

function toEdition(row: DbRow, familySlug: string): ChartEdition {
  const id = pick(row, ["id", "edition_id", "uuid"], familySlug);
  const date = dateOnly(row.chart_date ?? row.edition_date ?? row.date ?? row.published_at ?? row.created_at);
  const slug = slugify(pick(row, ["slug", "edition_slug", "public_slug"], date || id), id);
  const label = pick(row, ["label", "title", "name", "edition_title"], `${familySlug.replaceAll("-", " ")} ${date}`.trim());

  return {
    id,
    familyId: familySlug,
    slug,
    label,
    date,
    periodStart: dateOnly(row.period_start ?? row.periodStart ?? row.start_date) || date,
    periodEnd: dateOnly(row.period_end ?? row.periodEnd ?? row.end_date) || date,
    status: asString(row.status, "published") === "draft" ? "draft" : "published",
    ingestJobId: asString(row.ingest_job_id) || null,
    publishedAt: asString(row.published_at) || null,
    publishedBy: asString(row.published_by) || null,
    entryCount: asNumber(row.entry_count ?? row.entryCount ?? row.entries_count, 0),
    newEntries: asNumber(row.new_entries ?? row.newEntries, 0),
    reEntries: asNumber(row.re_entries ?? row.reEntries, 0),
  };
}

function toEntry(row: DbRow, editionId: string): ChartEditionEntry {
  const sourceEntryId = pick(row, ["source_entry_id", "legacy_entry_id", "entry_id", "id"]);
  const trackTitle = pick(row, ["track_title", "title", "name"], "Untitled track");
  const artistName = pick(row, ["artist_name", "artist", "artists"], "Unknown artist");
  const trackSlug = pick(row, ["track_slug"], slugify(trackTitle, sourceEntryId || "track"));
  const artistSlug = pick(row, ["artist_slug"], slugify(artistName, "artist"));
  const rank = asNumber(row.rank ?? row.position, 0);

  return {
    id: pick(row, ["id"], sourceEntryId || `${editionId}-${rank}`),
    editionId: pick(row, ["edition_id"], editionId),
    rank,
    previousRank: asNullableNumber(row.previous_rank ?? row.previousRank),
    movement: asMovement(row.movement),
    peakPosition: asNullableNumber(row.peak_position ?? row.peakPosition) ?? rank,
    weeksOnChart: asNullableNumber(row.weeks_on_chart ?? row.weeksOnChart) ?? 1,
    trackSlug,
    trackTitle,
    artistSlugs: artistSlug ? [artistSlug] : [],
    artistNames: artistName ? artistName.split(",").map((name) => name.trim()).filter(Boolean) : [],
    artworkUrl: pick(row, ["artwork_url", "image_url", "cover_url"]) || null,
    score: asNumber(row.score, 0),
    entryPayload: row,
    source: "legacy_import",
    isPlayable: false,
    duration: undefined,
    movementAmount: asNullableNumber(row.movement_amount ?? row.movementAmount) ?? undefined,
  };
}

function sortEditions(a: EditionLookup, b: EditionLookup): number {
  const dateCompare = (b.edition.date || "").localeCompare(a.edition.date || "");
  if (dateCompare !== 0) return dateCompare;
  return b.edition.id.localeCompare(a.edition.id);
}

async function loadEditionLookups(): Promise<EditionLookup[]> {
  const { data, error } = await supabase.from("wk_chart_editions_v2").select("*").limit(500);
  if (error) throw new Error(error.message);

  return ((data || []) as DbRow[])
    .map((row) => {
      const familySlug = editionFamilySlug(row, "charts");
      return { edition: toEdition(row, familySlug), raw: row, familySlug };
    })
    .sort(sortEditions);
}

export async function getSupabaseChartFamilies(): Promise<ChartFamily[]> {
  const editions = await loadEditionLookups();
  const latestByFamily = new Map<string, ChartEdition>();
  for (const lookup of editions) {
    if (!latestByFamily.has(lookup.familySlug)) latestByFamily.set(lookup.familySlug, lookup.edition);
  }

  const { data, error } = await supabase.from("wk_chart_series_v2").select("*").limit(100);
  if (!error && data && data.length > 0) {
    return (data as DbRow[]).map((row) => {
      const slug = familySlugFromRow(row);
      return toFamily(row, latestByFamily.get(slug) ?? null);
    });
  }

  const familyRows = Array.from(latestByFamily.entries()).map(([slug, latest]) => ({
    id: slug,
    slug,
    label: slug.replaceAll("-", " "),
    latest,
  }));

  return familyRows.map((row) => toFamily(row, row.latest));
}

export async function getSupabaseChartFamily(familySlug: string): Promise<ChartFamily | null> {
  const families = await getSupabaseChartFamilies();
  return families.find((family) => family.slug === familySlug || family.publicSlug === familySlug || family.familyKey === familySlug) ?? families[0] ?? null;
}

export async function getSupabaseChartEditionsForFamily(familySlug: string): Promise<ChartEdition[]> {
  const editions = await loadEditionLookups();
  const matching = editions.filter((lookup) => lookup.familySlug === familySlug).map((lookup) => lookup.edition);
  return matching.length > 0 ? matching : editions.map((lookup) => lookup.edition);
}

export async function getSupabaseLatestChartEdition(familySlug: string): Promise<ChartEdition | null> {
  const editions = await getSupabaseChartEditionsForFamily(familySlug);
  return editions[0] ?? null;
}

export async function getSupabaseChartEdition(familySlug: string, editionSlug: string): Promise<ChartEdition | null> {
  const editions = await getSupabaseChartEditionsForFamily(familySlug);
  return editions.find((edition) => edition.slug === editionSlug || edition.id === editionSlug) ?? editions[0] ?? null;
}

export async function getSupabaseChartEditionEntries(_familySlug: string, editionSlug: string): Promise<ChartEditionEntry[]> {
  const edition = await getSupabaseChartEdition(_familySlug, editionSlug);
  const editionId = edition?.id || editionSlug;
  const { data, error } = await supabase
    .from("wk_chart_entries_v2")
    .select("*")
    .eq("edition_id", editionId)
    .order("rank", { ascending: true })
    .limit(150);

  if (error) throw new Error(error.message);
  return ((data || []) as DbRow[]).map((row) => toEntry(row, editionId));
}

export async function getSupabaseTrackChartHistory(trackSlug: string): Promise<TrackChartHistory | null> {
  const { data, error } = await supabase
    .from("wk_chart_entries_v2")
    .select("*")
    .eq("track_slug", trackSlug)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  const rows = ((data || []) as DbRow[]).map((row) => toEntry(row, asString(row.edition_id)));
  if (rows.length === 0) return null;

  return {
    trackSlug,
    trackTitle: rows[0].trackTitle,
    artistNames: rows[0].artistNames,
    appearances: rows.map((row) => ({
      editionSlug: row.editionId,
      editionLabel: row.editionId,
      rank: row.rank,
      weeksOnChart: row.weeksOnChart ?? 1,
      movement: row.movement,
    })),
    peakPosition: Math.min(...rows.map((row) => row.rank).filter(Boolean)),
    totalWeeksOnChart: rows.length,
    firstAppearance: null,
    latestAppearance: null,
  };
}
