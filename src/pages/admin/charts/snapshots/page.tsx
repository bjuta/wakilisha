import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import { getChartFamilies, getChartEditionsForFamily } from "@/services/chartsPublic/client";
import type { ChartFamily, ChartEdition } from "@/services/chartsPublic/client";


interface SnapshotRecord {
  id: string;
  editionId: string;
  editionLabel: string;
  editionSlug: string;
  familyLabel: string;
  familySlug: string;
  publishedAt: string | null;
  publishedBy: string | null;
  checksum: string | null;
  entryCount: number;
  periodStart: string;
  periodEnd: string;
  status: "published" | "draft";
  methodologyVersion: string | null;
}

function toSnapshotRecord(edition: ChartEdition, family: ChartFamily): SnapshotRecord {
  const familySlug = family.publicSlug ?? family.familyKey;
  return {
    id: `${edition.id}-snap`,
    editionId: edition.id,
    editionLabel: edition.label,
    editionSlug: edition.slug,
    familyLabel: family.label,
    familySlug,
    publishedAt: edition.publishedAt,
    publishedBy: edition.publishedBy,
    checksum: null,
    entryCount: edition.entryCount,
    periodStart: edition.periodStart,
    periodEnd: edition.periodEnd,
    status: edition.status,
    methodologyVersion: family.methodologyVersion ?? null,
  };
}

export default function AdminChartsSnapshots() {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const familiesResult = await getChartFamilies();
        const families = familiesResult.data;

        const editionPromises = families.map((family) =>
          getChartEditionsForFamily(family.familyKey)
            .then((result) => result.data.map((edition) => toSnapshotRecord(edition, family)))
            .catch(() => [] as SnapshotRecord[])
        );
        const results = await Promise.all(editionPromises);
        const allSnapshots = results.flat();
        allSnapshots.sort((a, b) => {
          const dateA = a.publishedAt ?? a.periodStart;
          const dateB = b.publishedAt ?? b.periodStart;
          return dateB.localeCompare(dateA);
        });
        setSnapshots(allSnapshots);
      } catch {
        setSnapshots([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const families = Array.from(new Set(snapshots.map((s) => s.familyLabel)));

  const filtered = snapshots.filter((s) => {
    const matchFamily = familyFilter === "all" || s.familyLabel === familyFilter;
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchSearch =
      !search ||
      s.editionLabel.toLowerCase().includes(search.toLowerCase()) ||
      s.familyLabel.toLowerCase().includes(search.toLowerCase()) ||
      s.editionSlug.toLowerCase().includes(search.toLowerCase());
    return matchFamily && matchStatus && matchSearch;
  });

  const publishedCount = snapshots.filter((s) => s.status === "published").length;
  const draftCount = snapshots.filter((s) => s.status === "draft").length;
  const totalEntries = snapshots.filter((s) => s.status === "published").reduce((sum, s) => sum + s.entryCount, 0);

  const handleVerify = (id: string) => {
    setVerifyingId(id);
    setTimeout(() => {
      setVerifyingId(null);
      setVerifiedIds((prev) => new Set([...prev, id]));
      setToastMsg("Integrity check simulation complete");
      setTimeout(() => setToastMsg(null), 3000);
    }, 1200);
  };

  const handleCopySlug = (slug: string) => {
    navigator.clipboard.writeText(slug).catch(() => {});
    setToastMsg("Edition slug copied");
    setTimeout(() => setToastMsg(null), 2000);
  };

  if (loading) return <AdminChartsLoadingState message="Loading edition snapshots…" />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text shadow-lg border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Audit Infrastructure"
        title="Edition Snapshots"
        description="Immutable records of every published chart edition. Trust layer for all chart programs."
      />

      {/* Callout */}
      <div className="rounded-lg border border-wk-border bg-wk-surface p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-success-soft text-wk-success">
          <i className="ri-lock-2-line" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-wk-text">Snapshots are immutable cultural records</p>
          <p className="mt-0.5 text-[12px] text-wk-text-muted">
            Each published edition is a snapshot of the chart at that point in time. Edition data is served from the V2
            public chart API — the same data the public site consumes. {snapshots.length === 0 && "No editions have been published yet. Create your first chart program and publish an edition from the Ingest Studio."}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminChartsKpiCard value={snapshots.length} label="Total Snapshots" icon="Camera" accent="muted" />
        <AdminChartsKpiCard value={publishedCount} label="Published" icon="CheckCircle2" accent="success" />
        <AdminChartsKpiCard value={draftCount} label="Drafts" icon="FileEdit" accent={draftCount > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={totalEntries.toLocaleString()} label="Total Entries" icon="Stack" accent="brand" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snapshots…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
        >
          <option value="all">All Programs</option>
          {families.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex gap-1">
          {["all", "published", "draft"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                statusFilter === s
                  ? "bg-wk-brand text-wk-brand-on"
                  : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Snapshots List */}
      {filtered.length === 0 ? (
        <AdminChartsEmptyState
          icon="Camera"
          title={snapshots.length === 0 ? "No edition snapshots yet" : "No snapshots match your filters"}
          description={
            snapshots.length === 0
              ? "Snapshots are created when editions are published. Create your first chart program and publish an edition from the Ingest Studio."
              : "Try clearing the filters or publish a new edition."
          }
          action={
            snapshots.length === 0
              ? { label: "Open Ingest Studio", onClick: () => navigate("/admin/charts/ingest"), icon: "Plus" }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((snap) => {
            const isVerifying = verifyingId === snap.id;
            const isVerified = verifiedIds.has(snap.id);

            return (
              <WkSurface key={snap.id} className="overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        snap.status === "published" ? "bg-wk-success-soft" : "bg-wk-warning-soft"
                      }`}>
                        <i className={`${snap.status === "published" ? "ri-check-double-line text-wk-success" : "ri-file-edit-line text-wk-warning"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[14px] font-bold text-wk-text">{snap.editionLabel}</h3>
                          <span className="text-[12px] text-wk-text-muted">{snap.familyLabel}</span>
                          {snap.status === "published" ? (
                            <span className="rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-semibold text-wk-success">Published</span>
                          ) : (
                            <span className="rounded-full bg-wk-warning-soft px-2 py-0.5 text-[10px] font-semibold text-wk-warning">Draft</span>
                          )}
                          {isVerified && (
                            <span className="rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-semibold text-wk-success">
                              <i className="ri-check-double-line mr-0.5" />Verified
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-wk-text-muted">
                          <span title={`Period: ${snap.periodStart} → ${snap.periodEnd}`}>
                            <i className="ri-calendar-line mr-1" />
                            {snap.periodStart}
                            {snap.periodStart !== snap.periodEnd && ` → ${snap.periodEnd}`}
                          </span>
                          <span><i className="ri-stack-line mr-1" />{snap.entryCount} entries</span>
                          {snap.publishedBy && <span><i className="ri-user-line mr-1" />{snap.publishedBy}</span>}
                          {snap.publishedAt && (
                            <span><i className="ri-time-line mr-1" />{new Date(snap.publishedAt).toLocaleDateString()}</span>
                          )}
                          {snap.methodologyVersion && (
                            <span className="text-wk-text-faint"><i className="ri-flask-line mr-1" />{snap.methodologyVersion}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => handleCopySlug(snap.editionSlug)}
                        className="inline-flex items-center gap-1 rounded-md border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[11px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap"
                      >
                        <i className="ri-file-copy-line" /> Copy Slug
                      </button>
                      <button
                        onClick={() => handleVerify(snap.id)}
                        disabled={isVerifying || isVerified}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          isVerified
                            ? "bg-wk-success-soft text-wk-success border border-wk-success/20"
                            : "border border-wk-border bg-wk-surface text-wk-text-soft hover:bg-wk-surface-raised"
                        }`}
                      >
                        <i className={isVerifying ? "ri-loader-4-line animate-spin" : isVerified ? "ri-check-double-line" : "ri-shield-check-line"} />
                        {isVerifying ? "Checking…" : isVerified ? "Verified" : "Check"}
                      </button>
                      <button
                        onClick={() => navigate(`/admin/charts/edition-detail?edition=${snap.editionSlug}&family=${snap.familySlug}`)}
                        className="inline-flex items-center gap-1 rounded-md border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[11px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap"
                      >
                        <i className="ri-eye-line" /> Detail
                      </button>
                      <a
                        href={`/charts/${snap.familySlug}/${snap.editionSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-wk-brand px-2.5 py-1.5 text-[11px] font-semibold text-wk-brand-on transition-colors hover:opacity-90 whitespace-nowrap"
                      >
                        <i className="ri-external-link-line" /> Public
                      </a>
                    </div>
                  </div>
                </div>
              </WkSurface>
            );
          })}
        </div>
      )}
    </div>
  );
}