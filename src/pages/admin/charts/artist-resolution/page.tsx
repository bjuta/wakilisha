import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import type { WkIconName } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";

type DbRow = Record<string, unknown>;

interface ProgramOption {
  id: string;
  slug: string;
  label: string;
  marketSlug: string | null;
}

interface EditionOption {
  id: string;
  programId: string;
  programSlug: string;
  programLabel: string;
  editionSlug: string;
  editionLabel: string;
  editionDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  entryCount: number;
  createdAt: string | null;
}

interface RegistryArtistLite {
  id: string;
  slug: string;
  displayName: string;
  status: string | null;
  originIso2: string | null;
  publicImageUrl: string | null;
}

interface ChartArtistEntry {
  id: string;
  editionId: string;
  rank: number | null;
  movement: string | null;
  trackSlug: string | null;
  trackTitle: string;
  artistSlug: string | null;
  artistName: string;
  normalizedKey: string | null;
  leadArtistKey: string | null;
  canonicalTrackId: string | null;
  canonicalReleaseId: string | null;
  canonicalArtistId: string | null;
  sourceCount: number;
  occurrenceCount: number;
  releaseDate: string | null;
  sourceUrlsSeen: string[];
  sourcePayload: unknown;
}

interface IssueBadge {
  key: string;
  label: string;
  severity: "danger" | "warning" | "info" | "success";
  icon: WkIconName;
}

const INPUT_CLASS = "rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand";
const COMBINED_ARTIST_PATTERN = /\b(feat\.?|ft\.?|featuring|with)\b|\sx\s|\s&\s|,|\/|\+|\band\b/i;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateOnly(value: unknown): string {
  const raw = asString(value);
  return raw ? raw.slice(0, 10) : "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => asString(item)).filter(Boolean);
    } catch {
      return [value.trim()];
    }
  }

  return [];
}

function splitArtistTokens(value: string): string[] {
  return value
    .split(/\b(?:feat\.?|ft\.?|featuring|with)\b|\sx\s|\s&\s|,|\/|\+|\band\b/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function toProgram(row: DbRow): ProgramOption {
  const id = asString(row.id);
  const fallbackSlug = asString(row.public_slug ?? row.series_slug ?? id, "charts");
  return {
    id,
    slug: slugify(fallbackSlug, "charts"),
    label: asString(row.public_label ?? row.short_label ?? row.series_slug, fallbackSlug),
    marketSlug: asString(row.market_slug) || null,
  };
}

function toEdition(row: DbRow, programById: Map<string, ProgramOption>): EditionOption {
  const id = asString(row.id);
  const programId = asString(row.program_id);
  const program = programById.get(programId);
  const editionDate = dateOnly(row.edition_date);
  const editionSlug = asString(row.edition_slug, editionDate || id);

  return {
    id,
    programId,
    programSlug: program?.slug ?? slugify(programId, "charts"),
    programLabel: program?.label ?? programId,
    editionSlug,
    editionLabel: asString(row.edition_label, `${program?.label ?? programId} — ${editionDate || editionSlug}`),
    editionDate,
    periodStart: dateOnly(row.period_start) || null,
    periodEnd: dateOnly(row.period_end) || null,
    status: asString(row.status, "unknown"),
    entryCount: asNumber(row.entry_count, 0),
    createdAt: asString(row.created_at) || null,
  };
}

function toEntry(row: DbRow): ChartArtistEntry {
  return {
    id: asString(row.id),
    editionId: asString(row.edition_id),
    rank: row.rank === null || row.rank === undefined ? null : asNumber(row.rank),
    movement: asString(row.movement) || null,
    trackSlug: asString(row.track_slug) || null,
    trackTitle: asString(row.track_title, "Untitled track"),
    artistSlug: asString(row.artist_slug) || null,
    artistName: asString(row.artist_name, "Unknown artist"),
    normalizedKey: asString(row.normalized_key) || null,
    leadArtistKey: asString(row.lead_artist_key) || null,
    canonicalTrackId: asString(row.canonical_track_id) || null,
    canonicalReleaseId: asString(row.canonical_release_id) || null,
    canonicalArtistId: asString(row.canonical_artist_id) || null,
    sourceCount: asNumber(row.source_count, 0),
    occurrenceCount: asNumber(row.occurrence_count, 0),
    releaseDate: dateOnly(row.release_date) || null,
    sourceUrlsSeen: asStringArray(row.source_urls_seen),
    sourcePayload: row.source_payload ?? row.raw_payload ?? null,
  };
}

function toRegistryArtist(row: DbRow): RegistryArtistLite {
  return {
    id: asString(row.id),
    slug: asString(row.slug),
    displayName: asString(row.display_name, "Unknown artist"),
    status: asString(row.status) || null,
    originIso2: asString(row.origin_iso2) || null,
    publicImageUrl: asString(row.public_image_url) || null,
  };
}

function getArtistIssues(entry: ChartArtistEntry): IssueBadge[] {
  const issues: IssueBadge[] = [];
  const tokens = splitArtistTokens(entry.artistName);
  const combinedSuspect = COMBINED_ARTIST_PATTERN.test(entry.artistName) && tokens.length > 1;

  if (!entry.canonicalArtistId) {
    issues.push({ key: "missing_canonical_artist", label: "Missing canonical artist", severity: "danger", icon: "AlertTriangle" });
  }

  if (!entry.artistSlug) {
    issues.push({ key: "missing_artist_slug", label: "Missing artist slug", severity: "warning", icon: "User" });
  }

  if (combinedSuspect) {
    issues.push({ key: "combined_artist_suspect", label: "Combined artist suspect", severity: "warning", icon: "Users" });
  }

  if (!entry.canonicalTrackId) {
    issues.push({ key: "track_not_canonical", label: "Track not canonical", severity: "info", icon: "Link" });
  }

  if (!entry.leadArtistKey) {
    issues.push({ key: "weak_lead_key", label: "Weak lead key", severity: "info", icon: "Key" });
  }

  if (issues.length === 0) {
    issues.push({ key: "looks_clean", label: "Looks clean", severity: "success", icon: "CheckCircle2" });
  }

  return issues;
}

function issueClass(severity: IssueBadge["severity"]): string {
  switch (severity) {
    case "danger":
      return "border-wk-danger/20 bg-wk-danger-soft text-wk-danger";
    case "warning":
      return "border-wk-warning/20 bg-wk-warning-soft text-wk-warning";
    case "info":
      return "border-wk-info/20 bg-wk-info-soft text-wk-info";
    case "success":
      return "border-wk-success/20 bg-wk-success-soft text-wk-success";
    default:
      return "border-wk-border bg-wk-surface-raised text-wk-text-muted";
  }
}

function IssueChip({ issue }: { issue: IssueBadge }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${issueClass(issue.severity)}`}>
      <WkIcon name={issue.icon} size={10} />
      {issue.label}
    </span>
  );
}

function ArtistTokens({ value }: { value: string }) {
  const tokens = splitArtistTokens(value);

  if (tokens.length <= 1) {
    return <span className="text-[11px] text-wk-text-faint">No split pattern detected</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tokens.map((token, index) => (
        <span key={`${token}-${index}`} className="rounded-full border border-wk-border bg-wk-surface px-2 py-0.5 text-[10px] font-semibold text-wk-text-soft">
          {token}
        </span>
      ))}
    </div>
  );
}

export default function AdminChartsArtistResolutionPage() {
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [editions, setEditions] = useState<EditionOption[]>([]);
  const [entries, setEntries] = useState<ChartArtistEntry[]>([]);
  const [registryArtists, setRegistryArtists] = useState<Map<string, RegistryArtistLite>>(new Map());
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);

  const [loadingEditions, setLoadingEditions] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEdition = useMemo(
    () => editions.find((edition) => edition.id === selectedEditionId) ?? null,
    [editions, selectedEditionId]
  );

  const loadEditions = useCallback(async () => {
    setLoadingEditions(true);
    setError(null);

    try {
      const { data: programRows, error: programError } = await supabase
        .from("wk_chart_programs_v2")
        .select("*")
        .order("public_label", { ascending: true });

      if (programError) throw new Error(programError.message);

      const programList = ((programRows ?? []) as DbRow[]).map(toProgram);
      const programById = new Map(programList.map((program) => [program.id, program]));
      setPrograms(programList);

      const { data: editionRows, error: editionError } = await supabase
        .from("wk_chart_editions_v2")
        .select("*")
        .order("edition_date", { ascending: false })
        .limit(500);

      if (editionError) throw new Error(editionError.message);

      const editionList = ((editionRows ?? []) as DbRow[]).map((row) => toEdition(row, programById));
      setEditions(editionList);
      setSelectedEditionId((current) => current || editionList[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chart editions");
      setPrograms([]);
      setEditions([]);
    } finally {
      setLoadingEditions(false);
    }
  }, []);

  const loadEntries = useCallback(async (editionId: string) => {
    if (!editionId) {
      setEntries([]);
      setRegistryArtists(new Map());
      return;
    }

    setLoadingEntries(true);
    setSelectedRowId(null);

    try {
      const { data, error: entryError } = await supabase
        .from("wk_chart_entries_v2")
        .select("*")
        .eq("edition_id", editionId)
        .order("rank", { ascending: true });

      if (entryError) throw new Error(entryError.message);

      const rows = ((data ?? []) as DbRow[]).map(toEntry);
      setEntries(rows);

      const ids = Array.from(new Set(rows.map((row) => row.canonicalArtistId).filter(Boolean))) as string[];
      const slugs = Array.from(new Set(rows.map((row) => row.artistSlug).filter(Boolean))) as string[];

      const artistMap = new Map<string, RegistryArtistLite>();

      if (ids.length > 0) {
        const { data: artistRows } = await supabase
          .from("registry_artists")
          .select("id, slug, display_name, status, origin_iso2, public_image_url")
          .in("id", ids);

        ((artistRows ?? []) as DbRow[]).map(toRegistryArtist).forEach((artist) => {
          artistMap.set(artist.id, artist);
          artistMap.set(artist.slug, artist);
        });
      }

      if (slugs.length > 0) {
        const missingSlugs = slugs.filter((slug) => !artistMap.has(slug));
        if (missingSlugs.length > 0) {
          const { data: slugRows } = await supabase
            .from("registry_artists")
            .select("id, slug, display_name, status, origin_iso2, public_image_url")
            .in("slug", missingSlugs);

          ((slugRows ?? []) as DbRow[]).map(toRegistryArtist).forEach((artist) => {
            artistMap.set(artist.id, artist);
            artistMap.set(artist.slug, artist);
          });
        }
      }

      setRegistryArtists(artistMap);
    } catch (err) {
      setEntries([]);
      setRegistryArtists(new Map());
      setError(err instanceof Error ? err.message : "Could not load chart entries");
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    loadEditions();
  }, [loadEditions]);

  useEffect(() => {
    loadEntries(selectedEditionId);
  }, [loadEntries, selectedEditionId]);

  const filteredEditions = useMemo(() => {
    const q = search.trim().toLowerCase();

    return editions.filter((edition) => {
      const matchesProgram = programFilter === "all" || edition.programId === programFilter || edition.programSlug === programFilter;
      const matchesStatus = statusFilter === "all" || edition.status === statusFilter;
      const matchesSearch =
        !q ||
        edition.editionLabel.toLowerCase().includes(q) ||
        edition.editionSlug.toLowerCase().includes(q) ||
        edition.programLabel.toLowerCase().includes(q) ||
        edition.programSlug.toLowerCase().includes(q);

      return matchesProgram && matchesStatus && matchesSearch;
    });
  }, [editions, programFilter, search, statusFilter]);

  const issueOptions = useMemo(() => {
    const keys = new Set<string>();
    entries.forEach((entry) => {
      getArtistIssues(entry).forEach((issue) => {
        if (issue.key !== "looks_clean") keys.add(issue.key);
      });
    });
    return Array.from(keys);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = entrySearch.trim().toLowerCase();

    return entries.filter((entry) => {
      const issues = getArtistIssues(entry);
      const unresolved = issues.some((issue) => issue.key !== "looks_clean");
      const matchesUnresolved = !unresolvedOnly || unresolved;
      const matchesIssue = issueFilter === "all" || issues.some((issue) => issue.key === issueFilter);
      const matchesSearch =
        !q ||
        entry.trackTitle.toLowerCase().includes(q) ||
        entry.artistName.toLowerCase().includes(q) ||
        (entry.artistSlug ?? "").toLowerCase().includes(q) ||
        (entry.normalizedKey ?? "").toLowerCase().includes(q) ||
        (entry.leadArtistKey ?? "").toLowerCase().includes(q);

      return matchesUnresolved && matchesIssue && matchesSearch;
    });
  }, [entries, entrySearch, issueFilter, unresolvedOnly]);

  const issueSummary = useMemo(() => {
    let missingCanonical = 0;
    let combined = 0;
    let missingSlug = 0;
    let trackNotCanonical = 0;
    let clean = 0;

    entries.forEach((entry) => {
      const issues = getArtistIssues(entry);
      if (issues.some((issue) => issue.key === "missing_canonical_artist")) missingCanonical += 1;
      if (issues.some((issue) => issue.key === "combined_artist_suspect")) combined += 1;
      if (issues.some((issue) => issue.key === "missing_artist_slug")) missingSlug += 1;
      if (issues.some((issue) => issue.key === "track_not_canonical")) trackNotCanonical += 1;
      if (issues.length === 1 && issues[0]?.key === "looks_clean") clean += 1;
    });

    return {
      missingCanonical,
      combined,
      missingSlug,
      trackNotCanonical,
      clean,
      unresolved: entries.length - clean,
    };
  }, [entries]);

  const selectedRow = useMemo(
    () => entries.find((entry) => entry.id === selectedRowId) ?? filteredEntries[0] ?? null,
    [entries, filteredEntries, selectedRowId]
  );

  if (loadingEditions) return <AdminChartsLoadingState message="Loading chart artist workbench…" />;

  return (
    <div className="space-y-6">
      <AdminChartsPageHeader
        eyebrow="Registry Integrity"
        title="Chart Artist Resolution"
        description="Read-only workbench for finding artist identity problems inside chart editions before we write registry fixes."
      >
        <button
          onClick={() => navigate("/admin/charts/editions")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Layers" size={14} />
          Editions
        </button>
        <button
          onClick={loadEditions}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="RefreshCw" size={14} />
          Refresh
        </button>
      </AdminChartsPageHeader>

      {error && (
        <div className="rounded-xl border border-wk-danger/20 bg-wk-danger-soft px-4 py-3 text-[13px] font-semibold text-wk-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <AdminChartsKpiCard value={entries.length} label="Edition Rows" icon="ListChecks" accent="brand" />
        <AdminChartsKpiCard value={issueSummary.unresolved} label="Needs Review" icon="AlertTriangle" accent={issueSummary.unresolved > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={issueSummary.missingCanonical} label="Missing Canonical Artist" icon="User" accent={issueSummary.missingCanonical > 0 ? "danger" : "muted"} />
        <AdminChartsKpiCard value={issueSummary.combined} label="Combined Suspects" icon="Users" accent={issueSummary.combined > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={issueSummary.clean} label="Looks Clean" icon="CheckCircle2" accent="success" />
      </div>

      <WkSurface className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="relative">
            <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${INPUT_CLASS} w-full pl-9`}
              placeholder="Search editions, families, dates…"
            />
          </div>

          <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className={INPUT_CLASS}>
            <option value="all">All chart families</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.label}
              </option>
            ))}
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={INPUT_CLASS}>
            <option value="all">All statuses</option>
            {Array.from(new Set(editions.map((edition) => edition.status))).map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setProgramFilter("all");
              setStatusFilter("all");
              setIssueFilter("all");
              setSearch("");
              setEntrySearch("");
              setUnresolvedOnly(true);
            }}
            className="wk-button wk-button-ghost wk-button-sm justify-center"
          >
            <WkIcon name="Filter" size={13} />
            Reset filters
          </button>
        </div>
      </WkSurface>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <WkSurface className="overflow-hidden">
          <div className="border-b border-wk-border px-4 py-3">
            <p className="text-[13px] font-black text-wk-text">Chart editions</p>
            <p className="text-[11px] text-wk-text-muted">{filteredEditions.length} editions match your filters</p>
          </div>

          <div className="max-h-[680px] overflow-auto">
            {filteredEditions.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-wk-text-muted">
                No editions match the current filters.
              </div>
            ) : (
              filteredEditions.map((edition) => {
                const active = edition.id === selectedEditionId;
                return (
                  <button
                    key={edition.id}
                    onClick={() => setSelectedEditionId(edition.id)}
                    className={`w-full border-b border-wk-border/60 px-4 py-3 text-left transition-colors ${
                      active ? "bg-wk-brand-soft" : "hover:bg-wk-surface-raised"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-black text-wk-text">{edition.editionLabel}</p>
                      <AdminChartsStatusBadge status={edition.status} size="sm" />
                    </div>
                    <p className="text-[11px] text-wk-text-muted">{edition.programLabel} · {formatDate(edition.editionDate)}</p>
                    <p className="mt-1 font-mono text-[10px] text-wk-text-faint">{edition.editionSlug}</p>
                    <p className="mt-1 text-[10px] text-wk-text-muted">{edition.entryCount} entries</p>
                  </button>
                );
              })
            )}
          </div>
        </WkSurface>

        <div className="space-y-4">
          <WkSurface className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-wk-brand-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-brand">
                    Read only
                  </span>
                  {selectedEdition && <AdminChartsStatusBadge status={selectedEdition.status} size="sm" />}
                </div>
                <h2 className="text-[20px] font-black tracking-tight text-wk-text">
                  {selectedEdition?.editionLabel ?? "Select an edition"}
                </h2>
                {selectedEdition && (
                  <p className="mt-1 text-[12px] text-wk-text-muted">
                    {selectedEdition.programLabel} · {formatDate(selectedEdition.editionDate)} · {selectedEdition.entryCount} entries
                  </p>
                )}
              </div>

              {selectedEdition && (
                <button
                  onClick={() => navigate(`/admin/charts/editions/${selectedEdition.id}`)}
                  className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
                >
                  <WkIcon name="SearchCheck" size={13} />
                  Open scoring audit
                </button>
              )}
            </div>
          </WkSurface>

          <WkSurface className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
                <input
                  value={entrySearch}
                  onChange={(event) => setEntrySearch(event.target.value)}
                  className={`${INPUT_CLASS} w-full pl-9`}
                  placeholder="Search rows by track, artist, slug, normalized key…"
                />
              </div>

              <select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">All issue types</option>
                {issueOptions.map((issue) => (
                  <option key={issue} value={issue}>
                    {issue.replace(/_/g, " ")}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setUnresolvedOnly((value) => !value)}
                className={`wk-button wk-button-sm justify-center ${unresolvedOnly ? "wk-button-primary" : "wk-button-ghost"}`}
              >
                <WkIcon name={unresolvedOnly ? "AlertTriangle" : "CheckCircle2"} size={13} />
                {unresolvedOnly ? "Needs review only" : "All rows"}
              </button>
            </div>
          </WkSurface>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <WkSurface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-wk-border bg-wk-bg-subtle">
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Rank</th>
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Track / chart artist</th>
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Canonical state</th>
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEntries ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-14 text-center text-[13px] text-wk-text-muted">
                          <WkIcon name="Loader" size={18} className="mr-2 inline animate-spin text-wk-brand" />
                          Loading chart rows…
                        </td>
                      </tr>
                    ) : filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-14 text-center text-[13px] text-wk-text-muted">
                          No chart rows match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry) => {
                        const issues = getArtistIssues(entry);
                        const artist = entry.canonicalArtistId ? registryArtists.get(entry.canonicalArtistId) : entry.artistSlug ? registryArtists.get(entry.artistSlug) : null;
                        const active = selectedRow?.id === entry.id;

                        return (
                          <tr
                            key={entry.id}
                            onClick={() => setSelectedRowId(entry.id)}
                            className={`cursor-pointer border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised ${
                              active ? "bg-wk-brand-soft/60" : ""
                            }`}
                          >
                            <td className="px-3 py-3 align-top">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wk-brand-soft text-[12px] font-black text-wk-brand">
                                {entry.rank ?? "—"}
                              </div>
                            </td>

                            <td className="px-3 py-3 align-top">
                              <p className="max-w-[280px] truncate font-black text-wk-text">{entry.trackTitle}</p>
                              <p className="mt-0.5 max-w-[280px] truncate text-[12px] font-semibold text-wk-text-soft">{entry.artistName}</p>
                              <div className="mt-1">
                                <ArtistTokens value={entry.artistName} />
                              </div>
                            </td>

                            <td className="px-3 py-3 align-top">
                              <div className="space-y-1 text-[11px]">
                                <p className={entry.canonicalArtistId ? "text-wk-success" : "text-wk-danger"}>
                                  Artist: {artist?.displayName ?? entry.artistSlug ?? entry.canonicalArtistId ?? "missing"}
                                </p>
                                <p className={entry.canonicalTrackId ? "text-wk-success" : "text-wk-text-faint"}>
                                  Track: {entry.trackSlug ?? entry.canonicalTrackId ?? "not linked"}
                                </p>
                                {entry.normalizedKey && <p className="font-mono text-[10px] text-wk-text-faint">{entry.normalizedKey}</p>}
                              </div>
                            </td>

                            <td className="px-3 py-3 align-top">
                              <div className="flex max-w-[340px] flex-wrap gap-1">
                                {issues.map((issue) => <IssueChip key={`${entry.id}-${issue.key}`} issue={issue} />)}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </WkSurface>

            <WkSurface className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <WkIcon name="User" size={15} className="text-wk-brand" />
                <h3 className="text-[14px] font-black text-wk-text">Selected row evidence</h3>
              </div>

              {!selectedRow ? (
                <p className="text-[13px] text-wk-text-muted">Select a chart row to inspect artist evidence.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Chart row</p>
                    <p className="mt-1 text-[14px] font-black text-wk-text">#{selectedRow.rank ?? "—"} · {selectedRow.trackTitle}</p>
                    <p className="text-[13px] text-wk-text-soft">{selectedRow.artistName}</p>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Issue badges</p>
                    <div className="flex flex-wrap gap-1">
                      {getArtistIssues(selectedRow).map((issue) => <IssueChip key={`detail-${issue.key}`} issue={issue} />)}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Parsed artist tokens</p>
                    <ArtistTokens value={selectedRow.artistName} />
                  </div>

                  <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Canonical links</p>
                    <div className="space-y-1 text-[12px]">
                      <p><strong>Artist ID:</strong> <span className="font-mono text-[11px]">{selectedRow.canonicalArtistId ?? "missing"}</span></p>
                      <p><strong>Artist slug:</strong> <span className="font-mono text-[11px]">{selectedRow.artistSlug ?? "missing"}</span></p>
                      <p><strong>Track ID:</strong> <span className="font-mono text-[11px]">{selectedRow.canonicalTrackId ?? "missing"}</span></p>
                      <p><strong>Track slug:</strong> <span className="font-mono text-[11px]">{selectedRow.trackSlug ?? "missing"}</span></p>
                      <p><strong>Lead key:</strong> <span className="font-mono text-[11px]">{selectedRow.leadArtistKey ?? "missing"}</span></p>
                    </div>
                  </div>

                  {selectedRow.sourceUrlsSeen.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Sources</p>
                      <div className="space-y-1">
                        {selectedRow.sourceUrlsSeen.slice(0, 5).map((url, index) => (
                          <div key={`${url}-${index}`} className="truncate rounded-lg border border-wk-border bg-wk-surface px-2 py-1.5 text-[11px] font-mono text-wk-text-muted">
                            {url}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Raw payload</p>
                    <pre className="max-h-[260px] overflow-auto rounded-xl border border-wk-border bg-wk-bg-subtle p-3 text-[10px] text-wk-text-muted">
                      {JSON.stringify(selectedRow.sourcePayload ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </WkSurface>
          </div>
        </div>
      </div>
    </div>
  );
}
