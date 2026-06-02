import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface Snapshot {
  id: string;
  editionId: string;
  editionLabel: string;
  familyId: string;
  familyLabel: string;
  snapshotJson: Record<string, unknown>;
  publishedAt: string;
  publishedBy: string;
  checksum: string;
  entryCount: number;
}

const snapshots: Snapshot[] = [
  {
    id: "snap-001",
    editionId: "ed-2026-w22",
    editionLabel: "Week 22, 2026",
    familyId: "fam-002",
    familyLabel: "WAKILISHA Top 100",
    snapshotJson: { edition: { id: "ed-2026-w22", label: "Week 22, 2026" }, items: [], chartFamily: { id: "fam-002", label: "WAKILISHA Top 100" } },
    publishedAt: "2026-05-30T12:30:00Z",
    publishedBy: "Sarah",
    checksum: "sha256:a3f7c2d8e9b1...",
    entryCount: 100,
  },
  {
    id: "snap-002",
    editionId: "ed-2026-w21",
    editionLabel: "Week 21, 2026",
    familyId: "fam-001",
    familyLabel: "WAKILISHA Top 40",
    snapshotJson: { edition: { id: "ed-2026-w21", label: "Week 21, 2026" }, items: [], chartFamily: { id: "fam-001", label: "WAKILISHA Top 40" } },
    publishedAt: "2026-05-23T12:15:00Z",
    publishedBy: "James",
    checksum: "sha256:b4e8d3f0a2c1...",
    entryCount: 40,
  },
  {
    id: "snap-003",
    editionId: "ed-2026-w20",
    editionLabel: "Week 20, 2026",
    familyId: "fam-001",
    familyLabel: "WAKILISHA Top 40",
    snapshotJson: { edition: { id: "ed-2026-w20", label: "Week 20, 2026" }, items: [], chartFamily: { id: "fam-001", label: "WAKILISHA Top 40" } },
    publishedAt: "2026-05-16T12:00:00Z",
    publishedBy: "James",
    checksum: "sha256:c5f9e4a1b3d0...",
    entryCount: 40,
  },
  {
    id: "snap-004",
    editionId: "ed-2026-w19",
    editionLabel: "Week 19, 2026",
    familyId: "fam-001",
    familyLabel: "WAKILISHA Top 40",
    snapshotJson: { edition: { id: "ed-2026-w19", label: "Week 19, 2026" }, items: [], chartFamily: { id: "fam-001", label: "WAKILISHA Top 40" } },
    publishedAt: "2026-05-09T12:00:00Z",
    publishedBy: "Sarah",
    checksum: "sha256:d6a0f5b2c4e1...",
    entryCount: 40,
  },
];

export default function AdminChartsSnapshots() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<string>("all");

  const families = Array.from(new Set(snapshots.map((s) => s.familyLabel)));

  const filtered = snapshots.filter((s) => {
    const matchesFamily = selectedFamily === "all" || s.familyLabel === selectedFamily;
    const matchesSearch =
      s.editionLabel.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    return matchesFamily && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">
            Immutable Records
          </div>
          <h1 className="text-[20px] font-bold text-foreground-950">Snapshots</h1>
          <p className="text-[13px] text-foreground-600">View and verify immutable snapshots of published chart editions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snapshots..."
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
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-3">
        {filtered.map((snapshot) => (
          <SnapshotCard key={snapshot.id} snapshot={snapshot} navigate={navigate} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-background-200 bg-background-50 p-8 text-center">
            <i className="ri-camera-lens-line mb-3 block text-3xl text-foreground-400" />
            <p className="text-[13px] text-foreground-500">No snapshots match the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotCard({ snapshot, navigate }: { snapshot: Snapshot; navigate: ReturnType<typeof useNavigate> }) {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1200);
  };

  return (
    <WkSurface className="p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <i className="ri-lock-2-line text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <h3 className="text-[14px] font-bold text-foreground-950">{snapshot.editionLabel}</h3>
              <p className="text-[12px] text-foreground-500">{snapshot.familyLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                {snapshot.entryCount} entries
              </span>
              <span className="text-[11px] text-foreground-400">
                {new Date(snapshot.publishedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <i className="ri-fingerprint-line text-foreground-400" />
              <span className="text-[11px] font-mono text-foreground-500">{snapshot.checksum}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <i className="ri-user-line text-foreground-400" />
              <span className="text-[11px] text-foreground-500">{snapshot.publishedBy}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 rounded-md border border-background-200 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className={expanded ? "ri-eye-off-line" : "ri-eye-line"} />
              {expanded ? "Hide JSON" : "View JSON"}
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying || verified}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                verified
                  ? "bg-green-100 text-green-700"
                  : "border border-background-200 bg-background-50 text-foreground-600 hover:bg-background-100"
              }`}
            >
              <i className={verifying ? "ri-loader-4-line animate-spin" : verified ? "ri-check-double-line" : "ri-shield-check-line"} />
              {verifying ? "Verifying..." : verified ? "Integrity Verified" : "Verify Integrity"}
            </button>
            <button
              onClick={() => navigate(`/charts/${snapshot.familyId}/${snapshot.editionId}`)}
              className="inline-flex items-center gap-1 rounded-md bg-primary-500 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-eye-line" /> View Edition
            </button>
          </div>

          {expanded && (
            <div className="mt-3 rounded-lg bg-background-100 p-3">
              <pre className="text-[11px] text-foreground-600 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(snapshot.snapshotJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </WkSurface>
  );
}