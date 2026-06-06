import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
const mockDuplicateCandidates: any[] = [];
const mockResolutionRuns: any[] = [];

/* ────────────────────────── Types ────────────────────────── */

type FilterStatus = "all" | "pending" | "resolved" | "rejected";
type EntityKind = "all" | "artist" | "track" | "release" | "label" | "genre";

interface DuplicateCandidate {
  id: string;
  entityKind: string;
  primary: { id: string; slug: string; name: string; bio?: string; image?: string; followers?: number; isrc?: string; duration?: string; playCount?: number; country?: string; catalogSize?: number; upc?: string; tracks?: number; releaseDate?: string; description?: string; trackCount?: number };
  duplicate: { id: string; slug: string; name: string; bio?: string; image?: string; followers?: number; isrc?: string; duration?: string; playCount?: number; country?: string; catalogSize?: number; upc?: string; tracks?: number; releaseDate?: string; description?: string; trackCount?: number };
  confidence: number;
  matchFields: string[];
  status: string;
  createdAt: string;
}

/* ────────────────────────── Helpers ────────────────────────── */

const ENTITY_KIND_LABELS: Record<string, string> = {
  artist: "Artist",
  track: "Track",
  release: "Release",
  label: "Label",
  genre: "Genre",
};

const ENTITY_KIND_ICONS: Record<string, string> = {
  artist: "Mic2",
  track: "Music",
  release: "Disc",
  label: "Building2",
  genre: "Tags",
};

/* ────────────────────────── Page ────────────────────────── */

export default function AdminDuplicateMergePage() {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterKind, setFilterKind] = useState<EntityKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<DuplicateCandidate | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>(mockDuplicateCandidates as unknown as DuplicateCandidate[]);

  const filteredCandidates = useMemo(() => {
    let data = [...candidates];
    if (filterStatus !== "all") {
      data = data.filter((c) => c.status === filterStatus);
    }
    if (filterKind !== "all") {
      data = data.filter((c) => c.entityKind === filterKind);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (c) =>
          c.primary.name.toLowerCase().includes(q) ||
          c.duplicate.name.toLowerCase().includes(q)
      );
    }
    return data;
  }, [candidates, filterStatus, filterKind, searchQuery]);

  const stats = useMemo(() => {
    const pending = candidates.filter((c) => c.status === "pending").length;
    const resolved = candidates.filter((c) => c.status === "resolved").length;
    const rejected = candidates.filter((c) => c.status === "rejected").length;
    return { total: candidates.length, pending, resolved, rejected };
  }, [candidates]);

  const runStats = useMemo(() => {
    const run = mockResolutionRuns[0];
    return {
      total: run.totalRows,
      resolved: run.resolvedCount,
      review: run.reviewCount,
      shells: run.shellCount,
      duplicates: run.duplicateCandidateCount,
    };
  }, []);

  function handleMerge(candidate: DuplicateCandidate) {
    setSelectedCandidate(candidate);
    setShowConfirm(true);
  }

  function confirmMerge() {
    if (!selectedCandidate) return;
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === selectedCandidate.id ? { ...c, status: "resolved" } : c
      )
    );
    setShowConfirm(false);
    setSelectedCandidate(null);
    setToast(`Merged "${selectedCandidate.duplicate.name}" into "${selectedCandidate.primary.name}"`);
    setTimeout(() => setToast(null), 3000);
  }

  function handleReject(candidate: DuplicateCandidate) {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidate.id ? { ...c, status: "rejected" } : c
      )
    );
    setToast(`Rejected duplicate for "${candidate.duplicate.name}"`);
    setTimeout(() => setToast(null), 3000);
  }

  function handleUndo(candidate: DuplicateCandidate) {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidate.id ? { ...c, status: "pending" } : c
      )
    );
    setToast(`Reset "${candidate.duplicate.name}" to pending`);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-wk-brand bg-wk-brand-soft px-4 py-3 text-[13px] font-semibold text-wk-brand shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Relationships</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Duplicate Merge</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {stats.pending} pending, {stats.resolved} resolved, {stats.rejected} rejected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/relationships/viewer")}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Network" size={14} />
            View Relationships
          </button>
        </div>
      </div>

      {/* Run Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total Rows", value: runStats.total, icon: "Database", color: "text-wk-brand" },
          { label: "Resolved", value: runStats.resolved, icon: "CheckCircle2", color: "text-emerald-600" },
          { label: "For Review", value: runStats.review, icon: "GitPullRequest", color: "text-amber-600" },
          { label: "Shells", value: runStats.shells, icon: "Shell", color: "text-sky-600" },
          { label: "Duplicates", value: runStats.duplicates, icon: "Copy", color: "text-rose-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-wk-border bg-wk-surface p-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised ${stat.color}`}>
                <WkIcon name={stat.icon as never} size={14} />
              </span>
              <span className="text-[11px] font-semibold text-wk-text-muted">{stat.label}</span>
            </div>
            <div className="mt-1 text-[18px] font-black text-wk-text">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 flex-1 max-w-md">
          <WkIcon name="Search" size={14} className="text-wk-text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search duplicate candidates..."
            className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-wk-text-faint hover:text-wk-text">
              <WkIcon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as EntityKind)}
            className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text outline-none"
          >
            <option value="all">All Types</option>
            {Object.entries(ENTITY_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="flex items-center rounded-lg border border-wk-border bg-wk-surface overflow-hidden">
            {(["all", "pending", "resolved", "rejected"] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 text-[12px] font-semibold transition-all ${
                  filterStatus === status
                    ? "bg-wk-brand-soft text-wk-brand"
                    : "text-wk-text-muted hover:bg-wk-surface-raised"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Candidates Table */}
      <AdminTable
        columns={[
          {
            key: "entityKind",
            label: "Type",
            width: "100px",
            render: (row) => (
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised text-wk-text-muted">
                  <WkIcon name={ENTITY_KIND_ICONS[row.entityKind] || "Circle" as never} size={14} />
                </span>
                <span className="text-[12px] font-semibold text-wk-text">{ENTITY_KIND_LABELS[row.entityKind] || row.entityKind}</span>
              </div>
            ),
          },
          {
            key: "primary",
            label: "Primary Entity",
            render: (row) => (
              <div className="flex items-center gap-2">
                {row.primary.image && (
                  <img src={row.primary.image} alt="" className="h-8 w-8 rounded-md object-cover" />
                )}
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{row.primary.name}</div>
                  <div className="text-[11px] text-wk-text-muted">
                    {row.primary.followers ? `${(row.primary.followers / 1000000).toFixed(1)}M followers` : ""}
                    {row.primary.isrc ? `ISRC: ${row.primary.isrc}` : ""}
                    {row.primary.country ? `Country: ${row.primary.country}` : ""}
                    {row.primary.catalogSize ? `${row.primary.catalogSize} releases` : ""}
                    {row.primary.trackCount ? `${row.primary.trackCount} tracks` : ""}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "duplicate",
            label: "Duplicate Candidate",
            render: (row) => (
              <div className="flex items-center gap-2">
                {row.duplicate.image && (
                  <img src={row.duplicate.image} alt="" className="h-8 w-8 rounded-md object-cover" />
                )}
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{row.duplicate.name}</div>
                  <div className="text-[11px] text-wk-text-muted">
                    {row.duplicate.followers ? `${(row.duplicate.followers / 1000000).toFixed(1)}M followers` : ""}
                    {row.duplicate.isrc ? `ISRC: ${row.duplicate.isrc}` : ""}
                    {row.duplicate.country ? `Country: ${row.duplicate.country}` : ""}
                    {row.duplicate.catalogSize ? `${row.duplicate.catalogSize} releases` : ""}
                    {row.duplicate.trackCount ? `${row.duplicate.trackCount} tracks` : ""}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "confidence",
            label: "Confidence",
            width: "100px",
            render: (row) => (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-wk-surface-raised overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      row.confidence >= 0.9 ? "bg-emerald-500" : row.confidence >= 0.8 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${row.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[12px] font-semibold text-wk-text">{Math.round(row.confidence * 100)}%</span>
              </div>
            ),
          },
          {
            key: "matchFields",
            label: "Matches",
            width: "140px",
            render: (row) => (
              <div className="flex flex-wrap gap-1">
                {row.matchFields.map((field: string) => (
                  <span key={field} className="rounded-full bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">
                    {field}
                  </span>
                ))}
              </div>
            ),
          },
          {
            key: "status",
            label: "Status",
            width: "100px",
            render: (row) => (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                row.status === "pending" ? "bg-amber-100 text-amber-700" :
                row.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                "bg-rose-100 text-rose-700"
              }`}>
                {row.status}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            width: "180px",
            render: (row) => (
              <div className="flex items-center gap-1">
                {row.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleMerge(row)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 transition-colors"
                    >
                      <WkIcon name="Merge" size={12} />
                      Merge
                    </button>
                    <button
                      onClick={() => handleReject(row)}
                      className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-600 transition-colors"
                    >
                      <WkIcon name="X" size={12} />
                      Reject
                    </button>
                  </>
                )}
                {row.status !== "pending" && (
                  <button
                    onClick={() => handleUndo(row)}
                    className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised"
                  >
                    <WkIcon name="Undo2" size={12} />
                    Undo
                  </button>
                )}
              </div>
            ),
          },
        ]}
        rows={filteredCandidates}
        keyField="id"
        emptyMessage="No duplicate candidates found."
      />

      {/* Confirm Merge Modal */}
      {showConfirm && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <WkIcon name="AlertTriangle" size={20} />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-wk-text">Confirm Merge</h3>
                <p className="text-[13px] text-wk-text-muted">This action cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4 space-y-3">
              <div className="flex items-center gap-3">
                {selectedCandidate.primary.image && (
                  <img src={selectedCandidate.primary.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                )}
                <div>
                  <div className="text-[13px] font-bold text-wk-text">Keep: {selectedCandidate.primary.name}</div>
                  <div className="text-[11px] text-wk-text-muted">Primary entity (retained)</div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <WkIcon name="ArrowDown" size={16} className="text-wk-text-muted" />
              </div>
              <div className="flex items-center gap-3 opacity-60">
                {selectedCandidate.duplicate.image && (
                  <img src={selectedCandidate.duplicate.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                )}
                <div>
                  <div className="text-[13px] font-bold text-wk-text">Merge: {selectedCandidate.duplicate.name}</div>
                  <div className="text-[11px] text-wk-text-muted">Duplicate entity (will be archived)</div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowConfirm(false); setSelectedCandidate(null); }}
                className="rounded-lg border border-wk-border px-4 py-2 text-[13px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised"
              >
                Cancel
              </button>
              <button
                onClick={confirmMerge}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-emerald-600"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}