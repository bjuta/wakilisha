import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";

interface SnapshotRecord {
  id: string;
  editionId: string;
  editionLabel: string;
  familyLabel: string;
  familySlug: string;
  editionSlug: string;
  publishedAt: string;
  publishedBy: string;
  checksum: string;
  entryCount: number;
  integrityStatus: "ok" | "warn" | "error";
  integrityWarnings: string[];
  snapshotJson: Record<string, unknown>;
  repairStatus: "none" | "repaired" | "pending_repair";
}

const MOCK_SNAPSHOTS: SnapshotRecord[] = [
  {
    id: "snap-001",
    editionId: "ed-2026-w22-t40",
    editionLabel: "Week 22, 2026",
    familyLabel: "WAKILISHA Top 40",
    familySlug: "wakilisha-top-40",
    editionSlug: "2026-05-30",
    publishedAt: "2026-05-30T12:15:00Z",
    publishedBy: "James",
    checksum: "sha256:a3f7c2d8e9b14f2c…",
    entryCount: 40,
    integrityStatus: "ok",
    integrityWarnings: [],
    snapshotJson: { edition: "ed-2026-w22-t40", entries: 40, version: 2 },
    repairStatus: "none",
  },
  {
    id: "snap-002",
    editionId: "ed-2026-w22-t100",
    editionLabel: "Week 22, 2026",
    familyLabel: "WAKILISHA Top 100",
    familySlug: "wakilisha-top-100",
    editionSlug: "2026-05-30",
    publishedAt: "2026-05-30T12:30:00Z",
    publishedBy: "Sarah",
    checksum: "sha256:b4e8d3f0a2c16e1b…",
    entryCount: 100,
    integrityStatus: "warn",
    integrityWarnings: ["2 entries have missing ISRC codes", "1 entry has no canonical artist entity"],
    snapshotJson: { edition: "ed-2026-w22-t100", entries: 100, version: 2 },
    repairStatus: "pending_repair",
  },
  {
    id: "snap-003",
    editionId: "ed-2026-w21-t40",
    editionLabel: "Week 21, 2026",
    familyLabel: "WAKILISHA Top 40",
    familySlug: "wakilisha-top-40",
    editionSlug: "2026-05-23",
    publishedAt: "2026-05-23T12:00:00Z",
    publishedBy: "James",
    checksum: "sha256:c5f9e4a1b3d08e2d…",
    entryCount: 40,
    integrityStatus: "ok",
    integrityWarnings: [],
    snapshotJson: { edition: "ed-2026-w21-t40", entries: 40, version: 2 },
    repairStatus: "none",
  },
  {
    id: "snap-004",
    editionId: "ed-2026-w20-t40",
    editionLabel: "Week 20, 2026",
    familyLabel: "WAKILISHA Top 40",
    familySlug: "wakilisha-top-40",
    editionSlug: "2026-05-16",
    publishedAt: "2026-05-16T12:00:00Z",
    publishedBy: "James",
    checksum: "sha256:d6a0f5b2c4e19f3e…",
    entryCount: 40,
    integrityStatus: "ok",
    integrityWarnings: [],
    snapshotJson: { edition: "ed-2026-w20-t40", entries: 40, version: 2 },
    repairStatus: "repaired",
  },
];

export default function AdminChartsSnapshots() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [integrityFilter, setIntegrityFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const families = Array.from(new Set(MOCK_SNAPSHOTS.map((s) => s.familyLabel)));

  const filtered = MOCK_SNAPSHOTS.filter((s) => {
    const matchFamily = familyFilter === "all" || s.familyLabel === familyFilter;
    const matchIntegrity = integrityFilter === "all" || s.integrityStatus === integrityFilter;
    const matchSearch = !search || s.editionLabel.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase());
    return matchFamily && matchIntegrity && matchSearch;
  });

  const okCount = MOCK_SNAPSHOTS.filter((s) => s.integrityStatus === "ok").length;
  const warnCount = MOCK_SNAPSHOTS.filter((s) => s.integrityStatus === "warn").length;
  const errorCount = MOCK_SNAPSHOTS.filter((s) => s.integrityStatus === "error").length;

  const handleVerify = (id: string) => {
    setVerifyingId(id);
    setTimeout(() => {
      setVerifyingId(null);
      setVerifiedIds((prev) => new Set([...prev, id]));
      setToastMsg("Integrity check passed — checksum verified");
      setTimeout(() => setToastMsg(null), 3000);
    }, 1500);
  };

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum).catch(() => {});
    setToastMsg("Checksum copied");
    setTimeout(() => setToastMsg(null), 2000);
  };

  const integrityColors: Record<string, string> = {
    ok: "text-wk-success",
    warn: "text-wk-warning",
    error: "text-wk-danger",
  };

  const integrityIcons: Record<string, string> = {
    ok: "ri-shield-check-line",
    warn: "ri-shield-keyhole-line",
    error: "ri-shield-cross-line",
  };

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
        description="Immutable records of every published chart edition. The trust and accountability layer."
      />

      {/* Callout */}
      <div className="rounded-lg border border-wk-border bg-wk-surface p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-success-soft text-wk-success">
          <i className="ri-lock-2-line" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-wk-text">Snapshots are immutable cultural records</p>
          <p className="mt-0.5 text-[12px] text-wk-text-muted">
            Once created, a snapshot cannot be modified. It contains the complete JSON representation of a published chart edition,
            a SHA-256 checksum, and metadata. Use integrity checks to verify snapshots have not been altered.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminChartsKpiCard value={MOCK_SNAPSHOTS.length} label="Total Snapshots" icon="Camera" accent="muted" />
        <AdminChartsKpiCard value={okCount} label="Integrity OK" icon="ShieldCheck" accent="success" />
        <AdminChartsKpiCard value={warnCount} label="Warnings" icon="ShieldAlert" accent={warnCount > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={verifiedIds.size} label="Verified This Session" icon="Fingerprint" accent="brand" />
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
          <option value="all">All Families</option>
          {families.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex gap-1">
          {["all", "ok", "warn", "error"].map((s) => (
            <button
              key={s}
              onClick={() => setIntegrityFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                integrityFilter === s ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {s === "all" ? "All" : s === "ok" ? "Healthy" : s === "warn" ? "Warnings" : "Errors"}
            </button>
          ))}
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-3">
        {filtered.map((snap) => {
          const isExpanded = expandedId === snap.id;
          const isVerifying = verifyingId === snap.id;
          const isVerified = verifiedIds.has(snap.id);
          const hasWarnings = snap.integrityWarnings.length > 0;

          return (
            <WkSurface key={snap.id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${snap.integrityStatus === "ok" ? "bg-wk-success-soft" : snap.integrityStatus === "warn" ? "bg-wk-warning-soft" : "bg-wk-danger-soft"}`}>
                      <i className={`${integrityIcons[snap.integrityStatus]} ${integrityColors[snap.integrityStatus]}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[14px] font-bold text-wk-text">{snap.editionLabel}</h3>
                        <span className="text-[12px] text-wk-text-muted">{snap.familyLabel}</span>
                        {snap.repairStatus === "repaired" && (
                          <span className="rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-semibold text-wk-success">Repaired</span>
                        )}
                        {snap.repairStatus === "pending_repair" && (
                          <span className="rounded-full bg-wk-warning-soft px-2 py-0.5 text-[10px] font-semibold text-wk-warning">Pending Repair</span>
                        )}
                        {isVerified && (
                          <span className="rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-semibold text-wk-success">
                            <i className="ri-check-double-line mr-0.5" />Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-wk-text-muted">
                        <span><i className="ri-fingerprint-2-line mr-1" />{snap.checksum}</span>
                        <span><i className="ri-stack-line mr-1" />{snap.entryCount} entries</span>
                        <span><i className="ri-user-line mr-1" />{snap.publishedBy}</span>
                        <span><i className="ri-calendar-line mr-1" />{new Date(snap.publishedAt).toLocaleDateString()}</span>
                      </div>
                      {hasWarnings && (
                        <div className="mt-2 space-y-1">
                          {snap.integrityWarnings.map((w, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-wk-warning">
                              <i className="ri-error-warning-line shrink-0" />
                              {w}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyChecksum(snap.checksum)}
                      className="inline-flex items-center gap-1 rounded-md border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[11px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap"
                    >
                      <i className="ri-file-copy-line" /> Checksum
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
                      {isVerifying ? "Verifying…" : isVerified ? "Verified" : "Verify"}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[11px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap"
                    >
                      <i className={isExpanded ? "ri-eye-off-line" : "ri-code-line"} />
                      {isExpanded ? "Hide JSON" : "View JSON"}
                    </button>
                    <a
                      href={`/charts/${snap.familySlug}/${snap.editionSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-wk-brand px-2.5 py-1.5 text-[11px] font-semibold text-wk-brand-on transition-colors hover:opacity-90 whitespace-nowrap"
                    >
                      <i className="ri-external-link-line" /> Public URL
                    </a>
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-wk-border bg-wk-bg-subtle p-4">
                  <pre className="overflow-x-auto text-[11px] font-mono text-wk-text-soft whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(snap.snapshotJson, null, 2)}
                  </pre>
                </div>
              )}
            </WkSurface>
          );
        })}
        {filtered.length === 0 && (
          <AdminChartsEmptyState
            icon="Camera"
            title="No snapshots match"
            description="Snapshots are created automatically when editions are published. Try clearing your filters."
          />
        )}
      </div>
    </div>
  );
}