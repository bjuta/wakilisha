import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";

interface ChartEdition {
  id: string;
  familyId: string;
  familyLabel: string;
  slug: string;
  label: string;
  date: string;
  status: "draft" | "published" | "archived";
  ingestRunId: string | null;
  ingestJobId: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  entryCount: number;
  newEntries: number;
  reEntries: number;
  snapshotId: string | null;
  publicUrl: string | null;
}

const MOCK_EDITIONS: ChartEdition[] = [
  {
    id: "ed-2026-w22-t40",
    familyId: "wakilisha-top-40",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-05-30",
    label: "Week 22, 2026",
    date: "2026-05-30",
    status: "published",
    ingestRunId: "run-001",
    ingestJobId: null,
    publishedAt: "2026-05-30T12:15:00Z",
    publishedBy: "James",
    entryCount: 40,
    newEntries: 3,
    reEntries: 1,
    snapshotId: "snap-001",
    publicUrl: "/charts/wakilisha-top-40/2026-05-30",
  },
  {
    id: "ed-2026-w22-t100",
    familyId: "wakilisha-top-100",
    familyLabel: "WAKILISHA Top 100",
    slug: "2026-05-30",
    label: "Week 22, 2026",
    date: "2026-05-30",
    status: "published",
    ingestRunId: "run-002",
    ingestJobId: null,
    publishedAt: "2026-05-30T12:30:00Z",
    publishedBy: "Sarah",
    entryCount: 100,
    newEntries: 5,
    reEntries: 2,
    snapshotId: "snap-002",
    publicUrl: "/charts/wakilisha-top-100/2026-05-30",
  },
  {
    id: "ed-2026-w22-afro",
    familyId: "afrobeats-top-20",
    familyLabel: "Afrobeats Top 20",
    slug: "2026-05-30",
    label: "Week 22, 2026",
    date: "2026-05-30",
    status: "draft",
    ingestRunId: "run-003",
    ingestJobId: null,
    publishedAt: null,
    publishedBy: null,
    entryCount: 0,
    newEntries: 0,
    reEntries: 0,
    snapshotId: null,
    publicUrl: null,
  },
  {
    id: "ed-2026-w21-t40",
    familyId: "wakilisha-top-40",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-05-23",
    label: "Week 21, 2026",
    date: "2026-05-23",
    status: "published",
    ingestRunId: "run-004",
    ingestJobId: null,
    publishedAt: "2026-05-23T12:00:00Z",
    publishedBy: "James",
    entryCount: 40,
    newEntries: 2,
    reEntries: 0,
    snapshotId: "snap-003",
    publicUrl: "/charts/wakilisha-top-40/2026-05-23",
  },
  {
    id: "ed-2026-w20-t40",
    familyId: "wakilisha-top-40",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-05-16",
    label: "Week 20, 2026",
    date: "2026-05-16",
    status: "published",
    ingestRunId: null,
    ingestJobId: "job-001",
    publishedAt: "2026-05-16T12:00:00Z",
    publishedBy: "James",
    entryCount: 40,
    newEntries: 4,
    reEntries: 1,
    snapshotId: "snap-004",
    publicUrl: "/charts/wakilisha-top-40/2026-05-16",
  },
  {
    id: "ed-2026-w19-t40",
    familyId: "wakilisha-top-40",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-05-09",
    label: "Week 19, 2026",
    date: "2026-05-09",
    status: "published",
    ingestRunId: null,
    ingestJobId: "job-002",
    publishedAt: "2026-05-09T12:00:00Z",
    publishedBy: "Sarah",
    entryCount: 40,
    newEntries: 2,
    reEntries: 3,
    snapshotId: "snap-005",
    publicUrl: "/charts/wakilisha-top-40/2026-05-09",
  },
];

export default function AdminChartsEditions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const families = Array.from(new Set(MOCK_EDITIONS.map((e) => e.familyLabel)));

  const filtered = MOCK_EDITIONS.filter((e) => {
    const matchStatus = filter === "all" || e.status === filter;
    const matchFamily = familyFilter === "all" || e.familyLabel === familyFilter;
    const matchSearch =
      !search ||
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      e.slug.toLowerCase().includes(search.toLowerCase()) ||
      e.familyLabel.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchFamily && matchSearch;
  });

  const publishedCount = MOCK_EDITIONS.filter((e) => e.status === "published").length;
  const draftCount = MOCK_EDITIONS.filter((e) => e.status === "draft").length;
  const totalEntries = MOCK_EDITIONS.filter((e) => e.status === "published").reduce((s, e) => s + e.entryCount, 0);
  const totalNew = MOCK_EDITIONS.reduce((s, e) => s + e.newEntries, 0);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setToastMsg("URL copied to clipboard");
    setTimeout(() => setToastMsg(null), 2000);
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text shadow-lg border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Published Charts"
        title="Chart Editions"
        description="Committed chart outputs. Editions are published; runs are the process that creates them."
      >
        <button
          onClick={() => navigate("/admin/charts/ingest")}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <i className="ri-add-line" />
          New Edition
        </button>
        <button
          onClick={() => navigate("/admin/charts/snapshots")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <i className="ri-camera-lens-line" />
          Snapshots
        </button>
      </AdminChartsPageHeader>

      {/* Conceptual callout */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex items-start gap-3 rounded-lg border border-wk-border bg-wk-surface p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-wk-info-soft text-wk-info">
            <i className="ri-database-2-line text-sm" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-wk-text">Run</p>
            <p className="text-[11px] text-wk-text-muted">The ingestion process. Fetches, normalizes, matches.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-wk-brand/20 bg-wk-brand-soft p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-wk-brand text-wk-brand-on">
            <i className="ri-stack-line text-sm" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-wk-text">Edition</p>
            <p className="text-[11px] text-wk-text-muted">Committed chart output. Public-facing. This page.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-wk-border bg-wk-surface p-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-wk-success-soft text-wk-success">
            <i className="ri-lock-2-line text-sm" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-wk-text">Snapshot</p>
            <p className="text-[11px] text-wk-text-muted">Immutable record of what was published. Trust layer.</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminChartsKpiCard value={MOCK_EDITIONS.length} label="Total Editions" icon="ri-stack-line" accent="muted" />
        <AdminChartsKpiCard value={publishedCount} label="Published" icon="ri-check-double-line" accent="success" />
        <AdminChartsKpiCard value={draftCount} label="Drafts" icon="ri-draft-line" accent={draftCount > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={totalNew} label="New Entries (Total)" icon="ri-star-line" accent="brand" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search editions…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
        >
          <option value="all">All Families</option>
          {families.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex gap-1">
          {["all", "published", "draft", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                filter === s ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Editions Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["Edition", "Family", "Status", "Entries", "New", "Date", "Source", "By", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((edition) => (
                <tr
                  key={edition.id}
                  className="border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-wk-text">{edition.label}</div>
                    <div className="text-[11px] font-mono text-wk-text-muted">{edition.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-wk-text-soft">{edition.familyLabel}</td>
                  <td className="px-4 py-3">
                    <AdminChartsStatusBadge status={edition.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-wk-text-soft">{edition.entryCount || "—"}</td>
                  <td className="px-4 py-3">
                    {edition.newEntries > 0 ? (
                      <span className="font-semibold text-wk-brand">{edition.newEntries}</span>
                    ) : (
                      <span className="text-wk-text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-wk-text-soft">{edition.date}</td>
                  <td className="px-4 py-3">
                    {edition.ingestRunId ? (
                      <button
                        onClick={() => navigate(`/admin/charts/ingest-runs/${edition.ingestRunId}`)}
                        className="text-[11px] font-semibold text-wk-info hover:underline whitespace-nowrap"
                      >
                        <i className="ri-database-2-line mr-0.5" /> Run
                      </button>
                    ) : edition.ingestJobId ? (
                      <button
                        onClick={() => navigate(`/admin/charts/ingest-jobs/${edition.ingestJobId}`)}
                        className="text-[11px] font-semibold text-wk-text-muted hover:underline whitespace-nowrap"
                      >
                        <i className="ri-history-line mr-0.5" /> Legacy Job
                      </button>
                    ) : (
                      <span className="text-wk-text-faint text-[11px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-wk-text-muted">{edition.publishedBy || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {edition.publicUrl && (
                        <a
                          href={edition.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                          title="Open public URL"
                        >
                          <i className="ri-eye-line" />
                        </a>
                      )}
                      {edition.snapshotId && (
                        <button
                          onClick={() => navigate("/admin/charts/snapshots")}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-wk-success hover:bg-wk-success-soft transition-colors whitespace-nowrap"
                          title="View snapshot"
                        >
                          <i className="ri-lock-2-line" />
                        </button>
                      )}
                      {edition.publicUrl && (
                        <button
                          onClick={() => handleCopyUrl(edition.publicUrl!)}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
                          title="Copy public URL"
                        >
                          <i className="ri-links-line" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-14 text-center">
            <AdminChartsEmptyState
              icon="ri-stack-line"
              title="No editions match your filters"
              description="Try clearing the filters or publishing a new edition from the Ingest Studio."
            />
          </div>
        )}
      </WkSurface>
    </div>
  );
}