import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface Release extends Record<string, unknown> {
  slug: string;
  title: string;
  normalized_title: string;
  release_type: string | null;
  release_date: string | null;
  label_id: string | null;
  artwork_url: string | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

type QualityFilter = "all" | "missing_artwork" | "missing_date" | "missing_description" | "missing_type" | "needs_review" | "recently_updated";
type SortMode = "title_asc" | "updated_desc" | "updated_asc" | "release_date_desc" | "release_date_asc" | "completeness_asc" | "completeness_desc";

const statusOptions = ["all", "active", "draft", "needs_review", "archived"];
const qualityOptions: Array<{ value: QualityFilter; label: string }> = [
  { value: "all", label: "All quality states" },
  { value: "missing_artwork", label: "Missing artwork" },
  { value: "missing_date", label: "Missing release date" },
  { value: "missing_description", label: "Missing description" },
  { value: "missing_type", label: "Missing type" },
  { value: "needs_review", label: "Needs review" },
  { value: "recently_updated", label: "Recently updated" },
];

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "title_asc", label: "Title A-Z" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Oldest updated" },
  { value: "release_date_desc", label: "Release date newest" },
  { value: "release_date_asc", label: "Release date oldest" },
  { value: "completeness_asc", label: "Completeness lowest" },
  { value: "completeness_desc", label: "Completeness highest" },
];

export default function AdminReleasesPage() {
  const navigate = useNavigate();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("registry_releases")
      .select("slug, title, normalized_title, release_type, release_date, label_id, artwork_url, status, description, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (loadError) {
      console.error("Error loading releases:", loadError);
      setError(loadError.message);
      setReleases([]);
    } else {
      setReleases(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;

    return releases.reduce(
      (acc, release) => {
        acc.total += 1;
        acc.byStatus[release.status] = (acc.byStatus[release.status] ?? 0) + 1;
        if (!release.artwork_url) acc.missingArtwork += 1;
        if (!release.release_date) acc.missingDate += 1;
        if (!release.description) acc.missingDescription += 1;
        if (!release.release_type) acc.missingType += 1;
        if (release.updated_at && new Date(release.updated_at).getTime() >= recentCutoff) acc.recentlyUpdated += 1;
        acc.completenessTotal += getCompletenessScore(release);
        return acc;
      },
      {
        total: 0,
        byStatus: {} as Record<string, number>,
        missingArtwork: 0,
        missingDate: 0,
        missingDescription: 0,
        missingType: 0,
        recentlyUpdated: 0,
        completenessTotal: 0,
      },
    );
  }, [releases]);

  const averageCompleteness = summary.total > 0 ? Math.round(summary.completenessTotal / summary.total) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const recentCutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;

    return releases
      .filter((release) => {
        const matchesSearch = !q || [
          release.title,
          release.slug,
          release.normalized_title,
          release.release_type ?? "",
          release.status,
          release.description ?? "",
        ].some((value) => String(value).toLowerCase().includes(q));

        if (!matchesSearch) return false;
        if (statusFilter !== "all" && release.status !== statusFilter) return false;

        if (qualityFilter === "missing_artwork") return !release.artwork_url;
        if (qualityFilter === "missing_date") return !release.release_date;
        if (qualityFilter === "missing_description") return !release.description;
        if (qualityFilter === "missing_type") return !release.release_type;
        if (qualityFilter === "needs_review") return release.status === "needs_review";
        if (qualityFilter === "recently_updated") return release.updated_at && new Date(release.updated_at).getTime() >= recentCutoff;

        return true;
      })
      .sort((a, b) => sortReleases(a, b, sortMode));
  }, [qualityFilter, releases, search, sortMode, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Registry</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Releases</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-wk-text-muted">
            Canonical release records flowing into WAKILISHA. Use this console to spot missing metadata, triage low-completeness records, and open releases that need registry work.
          </p>
        </div>
        <button onClick={load} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="RefreshCcw" size={14} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total releases" value={summary.total} helper={`${filtered.length} visible`} />
        <MetricCard label="Avg completeness" value={`${averageCompleteness}%`} helper="based on loaded fields" tone={averageCompleteness < 70 ? "warning" : "success"} />
        <MetricCard label="Needs review" value={summary.byStatus.needs_review ?? 0} helper="status flagged" tone={(summary.byStatus.needs_review ?? 0) > 0 ? "danger" : "muted"} />
        <MetricCard label="Missing artwork" value={summary.missingArtwork} helper="visual gaps" tone={summary.missingArtwork > 0 ? "warning" : "success"} />
        <MetricCard label="Missing dates" value={summary.missingDate} helper="timeline gaps" tone={summary.missingDate > 0 ? "warning" : "success"} />
        <MetricCard label="Recently updated" value={summary.recentlyUpdated} helper="last 14 days" />
      </div>

      <WkSurface className="p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search releases by title, slug, type, status, or description..."
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text" aria-label="Clear search">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
            >
              <option value="all">All status</option>
              {statusOptions.filter((status) => status !== "all").map((status) => (
                <option key={status} value={status}>{formatLabel(status)}</option>
              ))}
            </select>

            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value as QualityFilter)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
            >
              {qualityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-wk-text-muted">
          <span>{filtered.length} of {releases.length} loaded releases visible</span>
          {statusFilter !== "all" && <button onClick={() => setStatusFilter("all")} className="text-wk-brand hover:underline">Clear status</button>}
          {qualityFilter !== "all" && <button onClick={() => setQualityFilter("all")} className="text-wk-brand hover:underline">Clear quality</button>}
          {search && <button onClick={() => setSearch("")} className="text-wk-brand hover:underline">Clear search</button>}
        </div>
      </WkSurface>

      {error && (
        <WkSurface className="border-l-4 border-wk-danger p-4">
          <p className="text-[13px] font-bold text-wk-danger">Could not load releases</p>
          <p className="mt-1 text-[12px] text-wk-text-muted">{error}</p>
        </WkSurface>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-wk-surface-raised" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-56 rounded bg-wk-surface-raised" />
                  <div className="h-3 w-40 rounded bg-wk-surface-raised" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminTable
          columns={[
            {
              key: "title",
              label: "Release",
              render: (row) => (
                <div className="flex min-w-[280px] items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-wk-surface-raised ring-1 ring-wk-border">
                    {row.artwork_url ? (
                      <img src={row.artwork_url} alt={row.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                        <WkIcon name="Disc" size={18} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-wk-text">{row.title}</div>
                    <div className="truncate font-mono text-[11px] text-wk-text-muted">{row.slug}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!row.artwork_url && <IssuePill label="No artwork" />}
                      {!row.release_date && <IssuePill label="No date" />}
                      {!row.release_type && <IssuePill label="No type" />}
                    </div>
                  </div>
                </div>
              ),
            },
            { key: "release_type", label: "Type", width: "110px", render: (row) => <TypeBadge value={row.release_type} /> },
            { key: "release_date", label: "Release date", width: "130px", render: (row) => <DateCell value={row.release_date} missingLabel="Missing date" /> },
            { key: "status", label: "Status", width: "120px", render: (row) => <StatusBadge status={row.status} /> },
            { key: "quality", label: "Quality", width: "150px", render: (row) => <CompletenessBadge score={getCompletenessScore(row)} /> },
            {
              key: "description",
              label: "Registry notes",
              width: "260px",
              render: (row) => (
                <span className="line-clamp-2 text-[12px] text-wk-text-muted">
                  {row.description ? row.description : "No description captured"}
                </span>
              ),
            },
            { key: "updated_at", label: "Updated", width: "130px", render: (row) => <DateCell value={row.updated_at} /> },
          ]}
          rows={filtered}
          keyField="slug"
          emptyMessage={getEmptyMessage(search, statusFilter, qualityFilter)}
          onRowClick={(row) => navigate(`/admin/registry/releases/${row.slug}`)}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, helper, tone = "muted" }: { label: string; value: number | string; helper: string; tone?: "success" | "warning" | "danger" | "muted" }) {
  const toneClass = tone === "success" ? "text-wk-success" : tone === "warning" ? "text-wk-warning" : tone === "danger" ? "text-wk-danger" : "text-wk-text";
  return (
    <WkSurface className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-wk-text-muted">{label}</p>
      <p className={`mt-1 text-[26px] font-black ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-wk-text-muted">{helper}</p>
    </WkSurface>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active" ? "bg-wk-success-soft text-wk-success" :
    status === "draft" ? "bg-wk-warning-soft text-wk-warning" :
    status === "needs_review" ? "bg-wk-danger-soft text-wk-danger" :
    "bg-wk-surface-raised text-wk-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {formatLabel(status)}
    </span>
  );
}

function TypeBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-[12px] font-semibold text-wk-warning">Missing</span>;
  return <span className="inline-flex rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold uppercase text-wk-text-muted">{formatLabel(value)}</span>;
}

function DateCell({ value, missingLabel = "—" }: { value: string | null; missingLabel?: string }) {
  if (!value) return <span className="text-[12px] font-semibold text-wk-warning">{missingLabel}</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="text-[12px] text-wk-text-muted">{value}</span>;
  return <span className="text-[12px] text-wk-text-muted">{date.toLocaleDateString()}</span>;
}

function IssuePill({ label }: { label: string }) {
  return <span className="rounded-full bg-wk-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-wk-warning">{label}</span>;
}

function CompletenessBadge({ score }: { score: number }) {
  const tone = score >= 85 ? "bg-wk-success-soft text-wk-success" : score >= 60 ? "bg-wk-warning-soft text-wk-warning" : "bg-wk-danger-soft text-wk-danger";
  return (
    <div className="min-w-[120px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{score}%</span>
        <span className="text-[10px] font-semibold text-wk-text-muted">complete</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-wk-surface-raised">
        <div className="h-full rounded-full bg-wk-brand" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function getCompletenessScore(release: Release): number {
  const checks = [
    Boolean(release.title),
    Boolean(release.slug),
    Boolean(release.release_type),
    Boolean(release.release_date),
    Boolean(release.artwork_url),
    Boolean(release.description),
    Boolean(release.status),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function sortReleases(a: Release, b: Release, mode: SortMode): number {
  if (mode === "updated_desc") return toTime(b.updated_at) - toTime(a.updated_at);
  if (mode === "updated_asc") return toTime(a.updated_at) - toTime(b.updated_at);
  if (mode === "release_date_desc") return toTime(b.release_date) - toTime(a.release_date);
  if (mode === "release_date_asc") return toTime(a.release_date) - toTime(b.release_date);
  if (mode === "completeness_asc") return getCompletenessScore(a) - getCompletenessScore(b);
  if (mode === "completeness_desc") return getCompletenessScore(b) - getCompletenessScore(a);
  return a.title.localeCompare(b.title);
}

function toTime(value: string | null): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getEmptyMessage(search: string, statusFilter: string, qualityFilter: QualityFilter): string {
  if (search || statusFilter !== "all" || qualityFilter !== "all") {
    return "No releases match the current search and filters.";
  }

  return "No releases found in the registry.";
}
