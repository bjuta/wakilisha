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
type DecisionType = "accepted_as_group" | "split_plan" | "alias_plan" | "needs_follow_up";
type DecisionStatus = "draft" | "ready" | "resolved" | "superseded";

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

interface RegistryArtistSearchResult {
  artist_id: string;
  artist_slug: string;
  display_name: string;
  status: string;
  origin_iso2: string | null;
  public_image_url: string | null;
  track_credit_count: number;
  release_credit_count: number;
}

interface SelectedArtist {
  token: string;
  artist_id: string;
  artist_slug: string;
  display_name: string;
  role: string;
  credit_order: number;
}

interface TokenDraft {
  token: string;
  query: string;
  loading: boolean;
  creating: boolean;
  results: RegistryArtistSearchResult[];
  selectedArtist: RegistryArtistSearchResult | null;
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

interface ResolutionDecision {
  id: string;
  chartEntryId: string;
  editionId: string;
  programId: string | null;
  decisionType: DecisionType;
  decisionStatus: DecisionStatus;
  parsedTokens: string[];
  selectedArtists: SelectedArtist[];
  note: string | null;
  updatedAt: string | null;
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

function asArtistRows(data: unknown): RegistryArtistSearchResult[] {
  return ((data as RegistryArtistSearchResult[]) ?? []).map((row) => ({
    ...row,
    track_credit_count: Number(row.track_credit_count ?? 0),
    release_credit_count: Number(row.release_credit_count ?? 0),
  }));
}

function asDecisionRows(data: unknown): ResolutionDecision[] {
  if (!Array.isArray(data)) return [];

  return (data as DbRow[]).map((row) => ({
    id: asString(row.id),
    chartEntryId: asString(row.chart_entry_id),
    editionId: asString(row.edition_id),
    programId: asString(row.program_id) || null,
    decisionType: asString(row.decision_type, "needs_follow_up") as DecisionType,
    decisionStatus: asString(row.decision_status, "draft") as DecisionStatus,
    parsedTokens: asStringArray(row.parsed_tokens),
    selectedArtists: Array.isArray(row.selected_artists) ? row.selected_artists as SelectedArtist[] : [],
    note: asString(row.note) || null,
    updatedAt: asString(row.updated_at) || null,
  }));
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

function decisionClass(status: DecisionStatus): string {
  if (status === "resolved") return "border-wk-success/20 bg-wk-success-soft text-wk-success";
  if (status === "ready") return "border-wk-brand/20 bg-wk-brand-soft text-wk-brand";
  if (status === "superseded") return "border-wk-text-faint/20 bg-wk-surface-raised text-wk-text-muted";
  return "border-wk-warning/20 bg-wk-warning-soft text-wk-warning";
}

function IssueChip({ issue }: { issue: IssueBadge }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${issueClass(issue.severity)}`}>
      <WkIcon name={issue.icon} size={10} />
      {issue.label}
    </span>
  );
}

function DecisionChip({ decision }: { decision: ResolutionDecision | null }) {
  if (!decision) return null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${decisionClass(decision.decisionStatus)}`}>
      <WkIcon name={decision.decisionStatus === "resolved" ? "CheckCircle2" : "ListChecks"} size={10} />
      {decision.decisionType.replace(/_/g, " ")} · {decision.decisionStatus}
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

function decisionLabel(value: DecisionType): string {
  if (value === "accepted_as_group") return "Accept as group/collab";
  if (value === "split_plan") return "Split plan";
  if (value === "alias_plan") return "Alias plan";
  return "Needs follow-up";
}

export default function AdminChartsArtistResolutionPage() {
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [editions, setEditions] = useState<EditionOption[]>([]);
  const [entries, setEntries] = useState<ChartArtistEntry[]>([]);
  const [registryArtists, setRegistryArtists] = useState<Map<string, RegistryArtistLite>>(new Map());
  const [decisions, setDecisions] = useState<Map<string, ResolutionDecision>>(new Map());
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [decisionStatusFilter, setDecisionStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);

  const [decisionType, setDecisionType] = useState<DecisionType>("split_plan");
  const [decisionNote, setDecisionNote] = useState("");
  const [tokenDrafts, setTokenDrafts] = useState<TokenDraft[]>([]);
  const [savingDecision, setSavingDecision] = useState(false);
  const [applyingDecision, setApplyingDecision] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [loadingEditions, setLoadingEditions] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const selectedEdition = useMemo(
    () => editions.find((edition) => edition.id === selectedEditionId) ?? null,
    [editions, selectedEditionId]
  );

  const loadDecisions = useCallback(async (editionId: string) => {
    if (!editionId) {
      setDecisions(new Map());
      return;
    }

    const { data, error: decisionError } = await supabase.rpc("admin_get_chart_artist_resolution_decisions", {
      p_edition_id: editionId,
    });

    if (decisionError) {
      setDecisions(new Map());
      return;
    }

    const rows = asDecisionRows(data);
    setDecisions(new Map(rows.map((decision) => [decision.chartEntryId, decision])));
  }, []);

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
      setDecisions(new Map());
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
      await loadDecisions(editionId);
    } catch (err) {
      setEntries([]);
      setRegistryArtists(new Map());
      setDecisions(new Map());
      setError(err instanceof Error ? err.message : "Could not load chart entries");
    } finally {
      setLoadingEntries(false);
    }
  }, [loadDecisions]);

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
      const decision = decisions.get(entry.id) ?? null;
      const unresolved = issues.some((issue) => issue.key !== "looks_clean") && decision?.decisionStatus !== "resolved";
      const matchesUnresolved = !unresolvedOnly || unresolved;
      const matchesIssue = issueFilter === "all" || issues.some((issue) => issue.key === issueFilter);
      const matchesDecisionStatus =
        decisionStatusFilter === "all"
        || (decisionStatusFilter === "undecided" && !decision)
        || decision?.decisionStatus === decisionStatusFilter;
      const matchesSearch =
        !q ||
        entry.trackTitle.toLowerCase().includes(q) ||
        entry.artistName.toLowerCase().includes(q) ||
        (entry.artistSlug ?? "").toLowerCase().includes(q) ||
        (entry.normalizedKey ?? "").toLowerCase().includes(q) ||
        (entry.leadArtistKey ?? "").toLowerCase().includes(q);

      return matchesUnresolved && matchesIssue && matchesDecisionStatus && matchesSearch;
    });
  }, [decisions, decisionStatusFilter, entries, entrySearch, issueFilter, unresolvedOnly]);

  const issueSummary = useMemo(() => {
    let missingCanonical = 0;
    let combined = 0;
    let openCombined = 0;
    let missingSlug = 0;
    let trackNotCanonical = 0;
    let clean = 0;
    let openQueue = 0;
    let undecidedOpen = 0;

    entries.forEach((entry) => {
      const issues = getArtistIssues(entry);
      const decision = decisions.get(entry.id) ?? null;
      const hasIssue = issues.some((issue) => issue.key !== "looks_clean");
      const isResolved = decision?.decisionStatus === "resolved";
      const isOpen = hasIssue && !isResolved;

      if (issues.some((issue) => issue.key === "missing_canonical_artist")) missingCanonical += 1;
      if (issues.some((issue) => issue.key === "combined_artist_suspect")) combined += 1;
      if (issues.some((issue) => issue.key === "combined_artist_suspect") && isOpen) openCombined += 1;
      if (issues.some((issue) => issue.key === "missing_artist_slug")) missingSlug += 1;
      if (issues.some((issue) => issue.key === "track_not_canonical")) trackNotCanonical += 1;
      if (issues.length === 1 && issues[0]?.key === "looks_clean") clean += 1;
      if (isOpen) openQueue += 1;
      if (isOpen && !decision) undecidedOpen += 1;
    });

    const decisionRows = Array.from(decisions.values());
    const resolved = decisionRows.filter((decision) => decision.decisionStatus === "resolved").length;
    const ready = decisionRows.filter((decision) => decision.decisionStatus === "ready").length;
    const draft = decisionRows.filter((decision) => decision.decisionStatus === "draft").length;

    return {
      missingCanonical,
      combined,
      openCombined,
      missingSlug,
      trackNotCanonical,
      clean,
      unresolved: openQueue,
      decisions: decisions.size,
      undecided: undecidedOpen,
      draft,
      ready,
      resolved,
    };
  }, [entries, decisions]);

  const selectedRow = useMemo(
    () => entries.find((entry) => entry.id === selectedRowId) ?? filteredEntries[0] ?? null,
    [entries, filteredEntries, selectedRowId]
  );

  const selectedDecision = selectedRow ? decisions.get(selectedRow.id) ?? null : null;

  useEffect(() => {
    if (!selectedRow) {
      setTokenDrafts([]);
      setDecisionNote("");
      setDecisionType("split_plan");
      return;
    }

    const decision = decisions.get(selectedRow.id);
    const tokens = decision?.parsedTokens.length ? decision.parsedTokens : splitArtistTokens(selectedRow.artistName);
    const safeTokens = tokens.length ? tokens : [selectedRow.artistName];
    const selectedByToken = new Map((decision?.selectedArtists ?? []).map((artist) => [artist.token, artist]));

    setDecisionType(decision?.decisionType ?? (safeTokens.length > 1 ? "split_plan" : "needs_follow_up"));
    setDecisionNote(decision?.note ?? "");
    setTokenDrafts(safeTokens.map((token) => {
      const selected = selectedByToken.get(token);
      return {
        token,
        query: token,
        loading: false,
        creating: false,
        results: [],
        selectedArtist: selected ? {
          artist_id: selected.artist_id,
          artist_slug: selected.artist_slug,
          display_name: selected.display_name,
          status: "active",
          origin_iso2: null,
          public_image_url: null,
          track_credit_count: 0,
          release_credit_count: 0,
        } : null,
      };
    }));
  }, [selectedRow, decisions]);

  const searchArtistsForToken = useCallback(async (index: number) => {
    const draft = tokenDrafts[index];
    const clean = draft?.query.trim();

    if (!draft || !clean) return;

    setTokenDrafts((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, loading: true } : item
    )));

    try {
      const { data, error: searchError } = await supabase.rpc("admin_search_registry_artists", {
        p_query: clean,
        p_limit: 10,
      });

      if (searchError) throw new Error(searchError.message);

      const rows = asArtistRows(data);
      setTokenDrafts((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, loading: false, results: rows } : item
      )));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Artist search failed", "error");
      setTokenDrafts((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, loading: false, results: [] } : item
      )));
    }
  }, [showToast, tokenDrafts]);

  const updateTokenDraft = useCallback((index: number, patch: Partial<TokenDraft>) => {
    setTokenDrafts((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  }, []);

  const createArtistForToken = useCallback(async (index: number) => {
    const draft = tokenDrafts[index];
    const tokenName = draft?.token.trim();
    const queryName = draft?.query.trim();
    const suggestedName = tokenName || queryName;

    if (!draft || !suggestedName) return;

    const exactDisplayName = window.prompt(
      "Exact artist display name. Keep punctuation, dots, symbols, and casing exactly as the artist uses them.",
      suggestedName
    )?.trim();

    if (!exactDisplayName) return;

    const suggestedSlug = exactDisplayName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const exactSlug = window.prompt(
      "Artist slug. Use a clean URL slug, but do not change the display name.",
      suggestedSlug
    )?.trim();

    if (!exactSlug) return;

    const confirmed = window.confirm(`Create registry artist "${exactDisplayName}" with slug "${exactSlug}" and attach it to this token?`);
    if (!confirmed) return;

    setTokenDrafts((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, creating: true } : item
    )));

    try {
      const { data, error: createError } = await supabase.rpc("admin_create_registry_artist_for_decouple", {
        p_display_name: exactDisplayName,
        p_slug: exactSlug,
        p_status: "needs_review",
        p_note: `Created from chart artist resolution token "${draft.token}"`,
      });

      if (createError) throw new Error(createError.message);

      const result = data as { artist?: RegistryArtistSearchResult; created?: boolean } | null;
      if (!result?.artist) throw new Error("Artist was not returned after create.");

      const artist = asArtistRows([result.artist])[0];

      setTokenDrafts((current) => current.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, creating: false, selectedArtist: artist, results: [] }
          : item
      )));

      showToast(result.created ? "Registry artist created and attached" : "Existing registry artist attached", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create registry artist", "error");
      setTokenDrafts((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, creating: false } : item
      )));
    }
  }, [showToast, tokenDrafts]);

  const autoMatchExistingArtists = useCallback(async () => {
    const unmatched = tokenDrafts
      .map((draft, index) => ({ draft, index }))
      .filter(({ draft }) => !draft.selectedArtist && draft.token.trim());

    if (unmatched.length === 0) {
      showToast("All visible tokens already have selected artists.", "success");
      return;
    }

    setAutoMatching(true);

    let matched = 0;
    let uncertain = 0;

    const nextDrafts = [...tokenDrafts];

    for (const { draft, index } of unmatched) {
      try {
        const cleanToken = draft.token.trim();
        const tokenSlug = slugify(cleanToken, "");

        const { data, error: searchError } = await supabase.rpc("admin_search_registry_artists", {
          p_query: cleanToken,
          p_limit: 8,
        });

        if (searchError) throw new Error(searchError.message);

        const rows = asArtistRows(data);
        const exactSlug = rows.find((artist) => artist.artist_slug === tokenSlug);
        const exactName = rows.find((artist) => artist.display_name.toLowerCase() === cleanToken.toLowerCase());
        const picked = exactSlug ?? exactName ?? (rows.length === 1 ? rows[0] : null);

        nextDrafts[index] = {
          ...nextDrafts[index],
          results: rows,
          selectedArtist: picked,
        };

        if (picked) matched += 1;
        else uncertain += 1;
      } catch {
        uncertain += 1;
      }
    }

    setTokenDrafts(nextDrafts);
    setAutoMatching(false);

    if (matched > 0 && uncertain === 0) {
      showToast(`Auto-matched ${matched} token${matched === 1 ? "" : "s"}.`, "success");
    } else if (matched > 0) {
      showToast(`Auto-matched ${matched}; ${uncertain} need manual review.`, "success");
    } else {
      showToast("No confident existing artist matches found.", "error");
    }
  }, [showToast, tokenDrafts]);

  const saveResolutionDecision = useCallback(async () => {
    if (!selectedRow) return;

    setSavingDecision(true);

    try {
      const selectedArtists: SelectedArtist[] = tokenDrafts
        .filter((draft) => draft.selectedArtist)
        .map((draft, index) => ({
          token: draft.token,
          artist_id: draft.selectedArtist!.artist_id,
          artist_slug: draft.selectedArtist!.artist_slug,
          display_name: draft.selectedArtist!.display_name,
          role: index === 0 ? "primary_artist" : "featured_artist",
          credit_order: index + 1,
        }));

      const decisionStatus: DecisionStatus =
        decisionType === "accepted_as_group"
          ? "resolved"
          : selectedArtists.length > 0
            ? "ready"
            : "draft";

      const { error: saveError } = await supabase.rpc("admin_upsert_chart_artist_resolution_decision", {
        p_chart_entry_id: selectedRow.id,
        p_decision_type: decisionType,
        p_decision_status: decisionStatus,
        p_parsed_tokens: tokenDrafts.map((draft) => draft.token),
        p_selected_artists: selectedArtists,
        p_note: decisionNote.trim() || null,
      });

      if (saveError) throw new Error(saveError.message);

      await loadDecisions(selectedRow.editionId);
      showToast("Resolution decision saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save resolution decision", "error");
    } finally {
      setSavingDecision(false);
    }
  }, [decisionNote, decisionType, loadDecisions, selectedRow, showToast, tokenDrafts]);

  const applyResolutionDecision = useCallback(async () => {
    if (!selectedRow || !selectedDecision) return;

    const confirmed = window.confirm("Apply this saved artist resolution decision to registry track credits?");
    if (!confirmed) return;

    setApplyingDecision(true);

    try {
      const { data, error: applyError } = await supabase.rpc("admin_apply_chart_artist_resolution_decision", {
        p_decision_id: selectedDecision.id,
      });

      if (applyError) throw new Error(applyError.message);

      const result = data as { trackCreditsInserted?: number; trackCreditsExisting?: number; message?: string } | null;
      await loadEntries(selectedRow.editionId);
      setSelectedRowId(selectedRow.id);
      showToast(
        `Applied. Inserted ${result?.trackCreditsInserted ?? 0} track credits; ${result?.trackCreditsExisting ?? 0} already existed.`,
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not apply resolution decision", "error");
    } finally {
      setApplyingDecision(false);
    }
  }, [loadEntries, selectedDecision, selectedRow, showToast]);

  const acceptSelectedAsGroup = useCallback(async () => {
    if (!selectedRow) return;

    const confirmed = window.confirm(`Accept "${selectedRow.artistName}" as an intentional group/collab credit?`);
    if (!confirmed) return;

    setSavingDecision(true);

    try {
      const { error: saveError } = await supabase.rpc("admin_upsert_chart_artist_resolution_decision", {
        p_chart_entry_id: selectedRow.id,
        p_decision_type: "accepted_as_group",
        p_decision_status: "resolved",
        p_parsed_tokens: splitArtistTokens(selectedRow.artistName),
        p_selected_artists: [],
        p_note: decisionNote.trim() || "Accepted as intentional group/collab credit.",
      });

      if (saveError) throw new Error(saveError.message);

      await loadDecisions(selectedRow.editionId);
      showToast("Accepted as group/collab", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not accept as group/collab", "error");
    } finally {
      setSavingDecision(false);
    }
  }, [decisionNote, loadDecisions, selectedRow, showToast]);

  const selectNextUnresolved = useCallback(() => {
    const queue = entries.filter((entry) => {
      const issues = getArtistIssues(entry);
      const decision = decisions.get(entry.id) ?? null;
      return issues.some((issue) => issue.key !== "looks_clean") && decision?.decisionStatus !== "resolved";
    });

    if (queue.length === 0) {
      showToast("No unresolved artist rows left in this edition.", "success");
      return;
    }

    const currentIndex = selectedRow ? queue.findIndex((entry) => entry.id === selectedRow.id) : -1;
    const next = queue[currentIndex + 1] ?? queue[0];
    setSelectedRowId(next.id);
  }, [decisions, entries, selectedRow, showToast]);

  const applyAllReadyDecisions = useCallback(async () => {
    const readyDecisions = Array.from(decisions.values()).filter((decision) => decision.decisionStatus === "ready");

    if (readyDecisions.length === 0) {
      showToast("No ready decisions to apply.", "error");
      return;
    }

    const confirmed = window.confirm(`Apply ${readyDecisions.length} ready decision${readyDecisions.length === 1 ? "" : "s"} to registry track credits?`);
    if (!confirmed) return;

    setBulkApplying(true);

    let applied = 0;
    let failed = 0;

    for (const decision of readyDecisions) {
      try {
        const { error: applyError } = await supabase.rpc("admin_apply_chart_artist_resolution_decision", {
          p_decision_id: decision.id,
        });

        if (applyError) throw new Error(applyError.message);
        applied += 1;
      } catch {
        failed += 1;
      }
    }

    if (selectedEditionId) await loadEntries(selectedEditionId);
    showToast(`Applied ${applied} ready decision${applied === 1 ? "" : "s"}${failed ? `; ${failed} failed` : ""}.`, failed ? "error" : "success");
    setBulkApplying(false);
  }, [decisions, loadEntries, selectedEditionId, showToast]);

  if (loadingEditions) return <AdminChartsLoadingState message="Loading chart artist workbench…" />;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg ${
          toast.type === "success" ? "border-wk-success/20 bg-wk-success-soft text-wk-success" : "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"
        }`}>
          {toast.message}
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Registry Integrity"
        title="Chart Artist Resolution"
        description="Edition-first workbench for saving non-destructive artist resolution decisions before registry mutations."
      >
        <button onClick={() => navigate("/admin/charts/editions")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="Layers" size={14} />
          Editions
        </button>
        <button onClick={loadEditions} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          <WkIcon name="RefreshCw" size={14} />
          Refresh
        </button>
      </AdminChartsPageHeader>

      {error && (
        <div className="rounded-xl border border-wk-danger/20 bg-wk-danger-soft px-4 py-3 text-[13px] font-semibold text-wk-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <AdminChartsKpiCard value={entries.length} label="Edition Rows" icon="ListChecks" accent="brand" />
        <AdminChartsKpiCard value={issueSummary.unresolved} label="Open Queue" icon="AlertTriangle" accent={issueSummary.unresolved > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={issueSummary.openCombined} label="Open Combined" icon="Users" accent={issueSummary.openCombined > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={issueSummary.undecided} label="Open Undecided" icon="User" accent={issueSummary.undecided > 0 ? "danger" : "muted"} />
        <AdminChartsKpiCard value={issueSummary.ready} label="Ready to Apply" icon="Rocket" accent={issueSummary.ready > 0 ? "info" : "muted"} />
        <AdminChartsKpiCard value={issueSummary.resolved} label="Resolved" icon="CheckCircle2" accent="success" />
      </div>

      <WkSurface className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="relative">
            <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${INPUT_CLASS} w-full pl-9`} placeholder="Search editions, families, dates…" />
          </div>

          <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className={INPUT_CLASS}>
            <option value="all">All chart families</option>
            {programs.map((program) => <option key={program.id} value={program.id}>{program.label}</option>)}
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={INPUT_CLASS}>
            <option value="all">All statuses</option>
            {Array.from(new Set(editions.map((edition) => edition.status))).map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
          </select>

          <button
            onClick={() => {
              setProgramFilter("all");
              setStatusFilter("all");
              setIssueFilter("all");
              setDecisionStatusFilter("all");
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

          <div className="max-h-[760px] overflow-auto">
            {filteredEditions.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-wk-text-muted">No editions match the current filters.</div>
            ) : (
              filteredEditions.map((edition) => {
                const active = edition.id === selectedEditionId;
                return (
                  <button
                    key={edition.id}
                    onClick={() => setSelectedEditionId(edition.id)}
                    className={`w-full border-b border-wk-border/60 px-4 py-3 text-left transition-colors ${active ? "bg-wk-brand-soft" : "hover:bg-wk-surface-raised"}`}
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
                  <span className="rounded-full bg-wk-brand-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-brand">Decision capture</span>
                  {selectedEdition && <AdminChartsStatusBadge status={selectedEdition.status} size="sm" />}
                </div>
                <h2 className="text-[20px] font-black tracking-tight text-wk-text">{selectedEdition?.editionLabel ?? "Select an edition"}</h2>
                {selectedEdition && <p className="mt-1 text-[12px] text-wk-text-muted">{selectedEdition.programLabel} · {formatDate(selectedEdition.editionDate)} · {selectedEdition.entryCount} entries</p>}
              </div>

              {selectedEdition && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={selectNextUnresolved} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
                    <WkIcon name="ArrowRight" size={13} />
                    Next unresolved
                  </button>
                  <button onClick={applyAllReadyDecisions} disabled={bulkApplying || issueSummary.ready === 0} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
                    <WkIcon name={bulkApplying ? "Loader" : "Rocket"} size={13} className={bulkApplying ? "animate-spin" : ""} />
                    {bulkApplying ? "Applying…" : `Apply all ready (${issueSummary.ready})`}
                  </button>
                  <button onClick={() => navigate(`/admin/charts/editions/${selectedEdition.id}`)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
                    <WkIcon name="SearchCheck" size={13} />
                    Open scoring audit
                  </button>
                </div>
              )}
            </div>
          </WkSurface>

          <WkSurface className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
                <input value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} className={`${INPUT_CLASS} w-full pl-9`} placeholder="Search rows by track, artist, slug, normalized key…" />
              </div>

              <select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">All issue types</option>
                {issueOptions.map((issue) => <option key={issue} value={issue}>{issue.replace(/_/g, " ")}</option>)}
              </select>

              <select value={decisionStatusFilter} onChange={(event) => setDecisionStatusFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">All decision states</option>
                <option value="undecided">Undecided only</option>
                <option value="draft">Draft only</option>
                <option value="ready">Ready only</option>
                <option value="resolved">Resolved only</option>
              </select>

              <button onClick={() => setUnresolvedOnly((value) => !value)} className={`wk-button wk-button-sm justify-center ${unresolvedOnly ? "wk-button-primary" : "wk-button-ghost"}`}>
                <WkIcon name={unresolvedOnly ? "AlertTriangle" : "CheckCircle2"} size={13} />
                {unresolvedOnly ? "Needs review only" : "All rows"}
              </button>
            </div>
          </WkSurface>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <WkSurface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-wk-border bg-wk-bg-subtle">
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Rank</th>
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Track / chart artist</th>
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Canonical state</th>
                      <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-wk-text-faint">Issues / decision</th>
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
                          {issueSummary.unresolved === 0 && unresolvedOnly
                            ? "Queue clear. All issue rows in this edition are resolved."
                            : "No chart rows match the current filters."}
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry) => {
                        const issues = getArtistIssues(entry);
                        const artist = entry.canonicalArtistId ? registryArtists.get(entry.canonicalArtistId) : entry.artistSlug ? registryArtists.get(entry.artistSlug) : null;
                        const active = selectedRow?.id === entry.id;
                        const decision = decisions.get(entry.id) ?? null;

                        return (
                          <tr key={entry.id} onClick={() => setSelectedRowId(entry.id)} className={`cursor-pointer border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised ${active ? "bg-wk-brand-soft/60" : ""}`}>
                            <td className="px-3 py-3 align-top">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wk-brand-soft text-[12px] font-black text-wk-brand">{entry.rank ?? "—"}</div>
                            </td>

                            <td className="px-3 py-3 align-top">
                              <p className="max-w-[280px] truncate font-black text-wk-text">{entry.trackTitle}</p>
                              <p className="mt-0.5 max-w-[280px] truncate text-[12px] font-semibold text-wk-text-soft">{entry.artistName}</p>
                              <div className="mt-1"><ArtistTokens value={entry.artistName} /></div>
                            </td>

                            <td className="px-3 py-3 align-top">
                              <div className="space-y-1 text-[11px]">
                                <p className={entry.canonicalArtistId ? "text-wk-success" : "text-wk-danger"}>Artist: {artist?.displayName ?? entry.artistSlug ?? entry.canonicalArtistId ?? "missing"}</p>
                                <p className={entry.canonicalTrackId ? "text-wk-success" : "text-wk-text-faint"}>Track: {entry.trackSlug ?? entry.canonicalTrackId ?? "not linked"}</p>
                                {entry.normalizedKey && <p className="font-mono text-[10px] text-wk-text-faint">{entry.normalizedKey}</p>}
                              </div>
                            </td>

                            <td className="px-3 py-3 align-top">
                              <div className="flex max-w-[360px] flex-wrap gap-1">
                                {issues.map((issue) => <IssueChip key={`${entry.id}-${issue.key}`} issue={issue} />)}
                                <DecisionChip decision={decision} />
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
                <WkIcon name="Users" size={15} className="text-wk-brand" />
                <h3 className="text-[14px] font-black text-wk-text">Resolution drawer</h3>
              </div>

              {!selectedRow ? (
                <p className="text-[13px] text-wk-text-muted">Select a chart row to inspect and save a non-destructive artist resolution decision.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Chart row</p>
                    <p className="mt-1 text-[14px] font-black text-wk-text">#{selectedRow.rank ?? "—"} · {selectedRow.trackTitle}</p>
                    <p className="text-[13px] text-wk-text-soft">{selectedRow.artistName}</p>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Current state</p>
                    <div className="flex flex-wrap gap-1">
                      {getArtistIssues(selectedRow).map((issue) => <IssueChip key={`detail-${issue.key}`} issue={issue} />)}
                      <DecisionChip decision={selectedDecision} />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Decision</label>
                    <select value={decisionType} onChange={(event) => setDecisionType(event.target.value as DecisionType)} className={`${INPUT_CLASS} w-full`}>
                      <option value="split_plan">Split plan</option>
                      <option value="accepted_as_group">Accept as group/collab</option>
                      <option value="alias_plan">Alias plan</option>
                      <option value="needs_follow_up">Needs follow-up</option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Parsed tokens</p>
                      <span className="text-[10px] text-wk-text-muted">{tokenDrafts.length} token{tokenDrafts.length === 1 ? "" : "s"}</span>
                    </div>

                    <div className="space-y-3">
                      {tokenDrafts.map((draft, index) => (
                        <div key={`${draft.token}-${index}`} className="rounded-xl border border-wk-border bg-wk-surface p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[12px] font-black text-wk-text">{draft.token}</p>
                            {draft.selectedArtist && (
                              <span className="rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-bold text-wk-success">
                                {draft.selectedArtist.display_name}
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <input value={draft.query} onChange={(event) => updateTokenDraft(index, { query: event.target.value })} className={`${INPUT_CLASS} min-w-0 flex-1`} placeholder="Search registry artist…" />
                            <button onClick={() => searchArtistsForToken(index)} className="wk-button wk-button-ghost wk-button-sm" disabled={draft.loading || draft.creating}>
                              <WkIcon name={draft.loading ? "Loader" : "Search"} size={13} className={draft.loading ? "animate-spin" : ""} />
                              Search
                            </button>
                          </div>

                          {!draft.selectedArtist && (
                            <button onClick={() => createArtistForToken(index)} className="mt-2 wk-button wk-button-ghost wk-button-sm w-full justify-center" disabled={draft.creating || draft.loading}>
                              <WkIcon name={draft.creating ? "Loader" : "Plus"} size={13} className={draft.creating ? "animate-spin" : ""} />
                              {draft.creating ? "Creating…" : `Create exact artist for "${draft.token}"`}
                            </button>
                          )}

                          {draft.results.length > 0 && (
                            <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                              {draft.results.map((artist) => (
                                <button
                                  key={artist.artist_id}
                                  onClick={() => updateTokenDraft(index, { selectedArtist: artist, results: [] })}
                                  className="w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-left hover:border-wk-brand"
                                >
                                  <p className="text-[12px] font-bold text-wk-text">{artist.display_name}</p>
                                  <p className="text-[10px] text-wk-text-muted">{artist.artist_slug} · {artist.status} · {artist.track_credit_count} track credits</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Note</label>
                    <textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} className={`${INPUT_CLASS} min-h-[90px] w-full resize-y`} placeholder="Why are we accepting, splitting, aliasing, or deferring this row?" />
                  </div>

                  <button onClick={autoMatchExistingArtists} disabled={autoMatching || savingDecision} className="wk-button wk-button-ghost wk-button-sm w-full justify-center">
                    <WkIcon name={autoMatching ? "Loader" : "SearchCheck"} size={14} className={autoMatching ? "animate-spin" : ""} />
                    {autoMatching ? "Auto-matching…" : "Auto-match existing artists"}
                  </button>

                  <button onClick={saveResolutionDecision} disabled={savingDecision || autoMatching} className="wk-button wk-button-primary wk-button-sm w-full justify-center">
                    <WkIcon name={savingDecision ? "Loader" : "CheckCircle2"} size={14} className={savingDecision ? "animate-spin" : ""} />
                    {savingDecision ? "Saving…" : `Save ${decisionLabel(decisionType)}`}
                  </button>

                  {(!selectedDecision || selectedDecision.decisionStatus !== "resolved") && (
                    <button onClick={acceptSelectedAsGroup} disabled={savingDecision} className="wk-button wk-button-ghost wk-button-sm w-full justify-center">
                      <WkIcon name="CheckCircle2" size={14} />
                      Accept as group/collab
                    </button>
                  )}

                  {selectedDecision && selectedDecision.decisionStatus === "ready" && (
                    <button onClick={applyResolutionDecision} disabled={applyingDecision} className="wk-button wk-button-ghost wk-button-sm w-full justify-center border-wk-warning/30 bg-wk-warning-soft text-wk-warning hover:bg-wk-warning-soft">
                      <WkIcon name={applyingDecision ? "Loader" : "Rocket"} size={14} className={applyingDecision ? "animate-spin" : ""} />
                      {applyingDecision ? "Applying…" : "Apply saved decision to track credits"}
                    </button>
                  )}

                  {selectedDecision && selectedDecision.decisionStatus === "draft" && selectedDecision.decisionType !== "accepted_as_group" && (
                    <div className="rounded-xl border border-wk-warning/20 bg-wk-warning-soft p-3 text-[11px] font-semibold text-wk-warning">
                      Pick at least one registry artist and save again before applying this decision.
                    </div>
                  )}

                  {selectedDecision?.decisionStatus === "resolved" && (
                    <div className="rounded-xl border border-wk-success/20 bg-wk-success-soft p-3 text-[11px] font-semibold text-wk-success">
                      This decision has been applied to registry track credits.
                    </div>
                  )}

                  <div className="rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-3 text-[11px] leading-relaxed text-wk-text-muted">
                    Save captures the decision. Apply inserts missing registry track credits and marks the decision resolved. It does not delete old credits or archive artists.
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
