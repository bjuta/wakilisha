import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface ChartEdition {
  id: string;
  familyId: string;
  familyLabel: string;
  slug: string;
  label: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "published" | "archived";
  ingestJobId: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  entryCount: number;
  newEntries: number;
  reEntries: number;
}

const editions: ChartEdition[] = [
  {
    id: "ed-2026-w22",
    familyId: "fam-001",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-week-22",
    label: "Week 22, 2026",
    date: "2026-05-30",
    periodStart: "2026-05-23",
    periodEnd: "2026-05-30",
    status: "published",
    ingestJobId: "job-004",
    publishedAt: "2026-05-30T12:15:00Z",
    publishedBy: "James",
    entryCount: 40,
    newEntries: 3,
    reEntries: 1,
  },
  {
    id: "ed-2026-w21",
    familyId: "fam-001",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-week-21",
    label: "Week 21, 2026",
    date: "2026-05-23",
    periodStart: "2026-05-16",
    periodEnd: "2026-05-23",
    status: "published",
    ingestJobId: "job-004",
    publishedAt: "2026-05-23T12:15:00Z",
    publishedBy: "James",
    entryCount: 40,
    newEntries: 2,
    reEntries: 0,
  },
  {
    id: "ed-2026-w22-top100",
    familyId: "fam-002",
    familyLabel: "WAKILISHA Top 100",
    slug: "2026-week-22",
    label: "Week 22, 2026",
    date: "2026-05-30",
    periodStart: "2026-05-23",
    periodEnd: "2026-05-30",
    status: "published",
    ingestJobId: "job-002",
    publishedAt: "2026-05-30T12:30:00Z",
    publishedBy: "Sarah",
    entryCount: 100,
    newEntries: 5,
    reEntries: 2,
  },
  {
    id: "ed-2026-w22-afrobeats",
    familyId: "fam-003",
    familyLabel: "Afrobeats Top 20",
    slug: "2026-week-22-afrobeats",
    label: "Week 22, 2026",
    date: "2026-05-30",
    periodStart: "2026-05-23",
    periodEnd: "2026-05-30",
    status: "draft",
    ingestJobId: "job-003",
    publishedAt: null,
    publishedBy: null,
    entryCount: 0,
    newEntries: 0,
    reEntries: 0,
  },
  {
    id: "ed-2026-w20",
    familyId: "fam-001",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-week-20",
    label: "Week 20, 2026",
    date: "2026-05-16",
    periodStart: "2026-05-09",
    periodEnd: "2026-05-16",
    status: "published",
    ingestJobId: "job-001",
    publishedAt: "2026-05-16T12:00:00Z",
    publishedBy: "James",
    entryCount: 40,
    newEntries: 4,
    reEntries: 1,
  },
  {
    id: "ed-2026-w19",
    familyId: "fam-001",
    familyLabel: "WAKILISHA Top 40",
    slug: "2026-week-19",
    label: "Week 19, 2026",
    date: "2026-05-09",
    periodStart: "2026-05-02",
    periodEnd: "2026-05-09",
    status: "published",
    ingestJobId: "job-001",
    publishedAt: "2026-05-09T12:00:00Z",
    publishedBy: "Sarah",
    entryCount: 40,
    newEntries: 2,
    reEntries: 3,
  },
];

export default function AdminChartsEditions() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<string>("all");

  const families = Array.from(new Set(editions.map((e) => e.familyLabel)));

  const filtered = editions.filter((e) => {
    const matchesFilter = filter === "all" || e.status === filter;
    const matchesFamily = selectedFamily === "all" || e.familyLabel === selectedFamily;
    const matchesSearch =
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      e.slug.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesFamily && matchesSearch;
  });

  const statusBadge: Record<string, string> = {
    published: "bg-green-100 text-green-700",
    draft: "bg-amber-100 text-amber-700",
    archived: "bg-background-200 text-foreground-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">
            Published Charts
          </div>
          <h1 className="text-[20px] font-bold text-foreground-950">Chart Editions</h1>
          <p className="text-[13px] text-foreground-600">Browse, edit, and manage published chart editions</p>
        </div>
        <button
          onClick={() => navigate("/admin/charts/ingest")}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-4 py-2 text-[13px] font-semibold text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap"
        >
          <i className="ri-add-line" />
          New Edition
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search editions..."
            className="w-full rounded-md border border-background-200 bg-background-50 py-2 pl-9 pr-3 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedFamily}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className="rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400"
          >
            <option value="all">All Families</option>
            {families.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {["all", "published", "draft", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                filter === s
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-100 text-foreground-600 hover:bg-background-200"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Total Editions</p>
          <p className="mt-1 text-[24px] font-black text-foreground-950">{editions.length}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Published</p>
          <p className="mt-1 text-[24px] font-black text-green-700">
            {editions.filter((e) => e.status === "published").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Drafts</p>
          <p className="mt-1 text-[24px] font-black text-amber-700">
            {editions.filter((e) => e.status === "draft").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Total Entries</p>
          <p className="mt-1 text-[24px] font-black text-foreground-950">
            {editions.reduce((sum, e) => sum + e.entryCount, 0)}
          </p>
        </WkSurface>
      </div>

      {/* Editions Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-background-200">
                <th className="px-4 py-3 font-semibold text-foreground-500">Edition</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Family</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Status</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Entries</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">New</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Date</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Published By</th>
                <th className="px-4 py-3 font-semibold text-foreground-500" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((edition) => (
                <tr
                  key={edition.id}
                  className="border-b border-background-200/50 transition-colors hover:bg-background-100/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground-950">{edition.label}</div>
                    <div className="text-[11px] text-foreground-500 font-mono">{edition.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground-600">{edition.familyLabel}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge[edition.status] || "bg-background-100 text-foreground-500"}`}>
                      {edition.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-600">{edition.entryCount}</td>
                  <td className="px-4 py-3 text-primary-700 font-semibold">{edition.newEntries}</td>
                  <td className="px-4 py-3 text-foreground-500">{edition.date}</td>
                  <td className="px-4 py-3 text-foreground-500">{edition.publishedBy || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/charts/${edition.familyId}/${edition.slug}`)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
                      >
                        <i className="ri-eye-line" /> View
                      </button>
                      <button
                        onClick={() => edition.ingestJobId && navigate(`/admin/charts/ingest/${edition.ingestJobId}`)}
                        disabled={!edition.ingestJobId}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-foreground-600 hover:bg-background-100 transition-colors disabled:opacity-40"
                      >
                        <i className="ri-settings-4-line" /> Job
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-[13px] text-foreground-500">
            No editions match the selected filters.
          </div>
        )}
      </WkSurface>
    </div>
  );
}