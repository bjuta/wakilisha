import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminChartsStatusBadge } from "../../components/AdminChartsStatusBadge";
import { ScoreBreakdownChips } from "./ScoreBreakdownChips";
import { AirplayDetailPanel } from "./AirplayDetailPanel";
import type { WkChartEntryV2Row } from "@/services/chartsScoring/scoringTypes";

interface EntryAuditTableProps {
  entries: WkChartEntryV2Row[];
  loading: boolean;
}

function MovementBadge({ movement, previousRank, currentRank }: { movement: string | null; previousRank: number | null; currentRank: number }) {
  if (movement === "new") {
    return <span className="inline-flex items-center rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-black text-wk-success">NEW</span>;
  }
  if (movement === "reentry") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-wk-info-soft px-2 py-0.5 text-[10px] font-black text-wk-info"><WkIcon name="RefreshCw" size={9} />RE</span>;
  }
  if (movement === "up" && previousRank !== null) {
    const diff = previousRank - currentRank;
    return <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-wk-success"><WkIcon name="ArrowUp" size={12} />{diff}</span>;
  }
  if (movement === "down" && previousRank !== null) {
    const diff = currentRank - previousRank;
    return <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-wk-danger"><WkIcon name="ArrowDown" size={12} />{diff}</span>;
  }
  if (movement === "same") {
    return <span className="text-[10px] font-bold text-wk-text-faint">—</span>;
  }
  return <span className="text-[10px] text-wk-text-faint">—</span>;
}

function FlagChip({ label, active, color }: { label: string; active: boolean; color: string }) {
  if (!active) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${color}`}>
      {label}
    </span>
  );
}

function CompactScoreChip({ label, value, cap }: { label: string; value: number; cap: number }) {
  const fillPct = cap > 0 ? Math.min((value / cap) * 100, 100) : 0;
  return (
    <div className="relative flex flex-col items-center rounded-md border border-wk-border px-1.5 py-1 text-center min-w-[36px]" title={`${label}: ${value.toFixed(4)} (cap ${cap})`}>
      <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-md overflow-hidden">
        <div className="h-full bg-wk-brand/40 transition-all" style={{ width: `${fillPct}%` }} />
      </div>
      <span className="text-[8px] font-bold uppercase tracking-widest text-wk-text-faint">{label}</span>
      <span className="text-[11px] font-black tabular-nums leading-none text-wk-text">{value.toFixed(1)}</span>
    </div>
  );
}

function InvariantBadge({ entry }: { entry: WkChartEntryV2Row }) {
  const computed =
    entry.source_score +
    entry.cross_source_bonus +
    entry.overlap_bonus +
    entry.recency_score +
    entry.continuity_score +
    entry.carry_forward_bonus +
    entry.airplay_score -
    entry.anti_gaming_penalty;
  const epsilon = 0.001;
  const passes = Math.abs(computed - entry.total_score) <= epsilon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
        passes ? "bg-wk-success-soft text-wk-success" : "bg-wk-danger-soft text-wk-danger"
      }`}
      title={`Computed: ${computed.toFixed(4)} | Stored: ${entry.total_score.toFixed(4)}`}
    >
      <WkIcon name={passes ? "CheckCircle2" : "AlertTriangle"} size={9} />
      {passes ? "✓" : `Δ${(computed - entry.total_score).toFixed(2)}`}
    </span>
  );
}

function EligibilitySection({ entry }: { entry: WkChartEntryV2Row }) {
  const status = entry.eligibility_status ?? "eligible";
  const warnings = entry.eligibility_warnings ?? [];
  const color =
    status === "excluded" ? "text-wk-danger" :
    status === "review"   ? "text-wk-warning" :
    "text-wk-success";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <WkIcon
          name={status === "excluded" ? "XCircle" : status === "review" ? "AlertTriangle" : "CheckCircle2"}
          size={13}
          className={color}
        />
        <span className={`text-[12px] font-bold capitalize ${color}`}>{status}</span>
        {entry.continuity_locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-wk-info-soft px-2 py-0.5 text-[9px] font-bold text-wk-info">
            <WkIcon name="Lock" size={9} />
            Continuity Locked
          </span>
        )}
        {entry.carry_forward_only && (
          <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2 py-0.5 text-[9px] font-bold text-wk-warning">
            <WkIcon name="RotateCcw" size={9} />
            Carry Forward
          </span>
        )}
      </div>
      {warnings.length > 0 && (
        <div className="rounded-lg border border-wk-warning/30 bg-wk-warning-soft p-2 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-wk-warning">
              <WkIcon name="AlertCircle" size={11} className="mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CarryForwardProvenance({ entry }: { entry: WkChartEntryV2Row }) {
  if (!entry.carry_forward_only) return null;
  return (
    <div className="rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-3 space-y-1">
      <div className="flex items-center gap-2 text-[11px] font-bold text-wk-text-muted">
        <WkIcon name="RotateCcw" size={12} />
        Carry-Forward Provenance
      </div>
      <p className="text-[11px] text-wk-text-muted italic">
        "Carried forward from the most recent published edition to preserve chart continuity."
      </p>
      {entry.previous_rank !== null && (
        <p className="text-[11px] text-wk-text-muted">
          Previous position: <strong className="text-wk-text">#{entry.previous_rank}</strong>
          {entry.continuity_locked && <span className="ml-2 text-wk-info font-semibold">(continuity-locked — cannot be removed)</span>}
        </p>
      )}
      <p className="text-[11px] text-wk-text-faint">
        source_count={entry.source_count} · occurrence_count={entry.occurrence_count} · airplay_score={entry.airplay_score.toFixed(4)}
      </p>
    </div>
  );
}

function EntryDetailPanel({ entry }: { entry: WkChartEntryV2Row }) {
  const [tab, setTab] = useState<"score" | "airplay" | "eligibility" | "sources" | "payload">("score");

  const tabs = [
    { id: "score",       label: "Score Breakdown", icon: "BarChart2" },
    { id: "airplay",     label: "Airplay",          icon: "Radio" },
    { id: "eligibility", label: "Eligibility",      icon: "Shield" },
    { id: "sources",     label: "Sources",          icon: "Link" },
    { id: "payload",     label: "Raw Payload",      icon: "Code" },
  ] as const;

  return (
    <div className="border-t border-wk-border bg-wk-bg-subtle px-4 pb-4 pt-3 space-y-4">
      {/* Anti-gaming flags strip */}
      <div className="flex flex-wrap gap-1.5">
        <FlagChip label="Overlap Capped" active={entry.overlap_bonus_capped} color="bg-wk-warning-soft text-wk-warning" />
        <FlagChip label="Artist Overflow" active={entry.lead_artist_overflow} color="bg-wk-danger-soft text-wk-danger" />
        <FlagChip label="Stale CF Demoted" active={entry.stale_carry_forward_demoted} color="bg-wk-warning-soft text-wk-warning" />
        <FlagChip label="Airplay Candidate" active={entry.airplay_candidate_only} color="bg-wk-info-soft text-wk-info" />
        {!entry.overlap_bonus_capped && !entry.lead_artist_overflow && !entry.stale_carry_forward_demoted && !entry.airplay_candidate_only && (
          <span className="text-[11px] text-wk-text-faint italic">No anti-gaming flags</span>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-wk-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id
                ? "border-wk-brand text-wk-brand"
                : "border-transparent text-wk-text-muted hover:text-wk-text"
            }`}
          >
            <WkIcon name={t.icon as never} size={11} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "score" && (
          <div className="space-y-3">
            <ScoreBreakdownChips
              sourceScore={entry.source_score}
              crossSourceBonus={entry.cross_source_bonus}
              overlapBonus={entry.overlap_bonus}
              recencyScore={entry.recency_score}
              continuityScore={entry.continuity_score}
              carryForwardBonus={entry.carry_forward_bonus}
              airplayScore={entry.airplay_score}
              antiGamingPenalty={entry.anti_gaming_penalty}
              totalScore={entry.total_score}
              showInvariantCheck
            />
            <CarryForwardProvenance entry={entry} />
            {entry.release_date && (
              <div className="flex items-center gap-2 text-[11px] text-wk-text-muted">
                <WkIcon name="Calendar" size={11} />
                Release date: <strong className="text-wk-text">{entry.release_date}</strong>
                {entry.release_recency_days !== null && (
                  <span className="text-wk-text-faint">({entry.release_recency_days} days ago)</span>
                )}
              </div>
            )}
            {entry.scoring_policy_version && (
              <div className="flex items-center gap-2 text-[11px] text-wk-text-faint">
                <WkIcon name="ShieldCheck" size={11} />
                Scoring policy: <code className="font-mono">{entry.scoring_policy_version}</code>
                {entry.methodology_version && <span>· Methodology: <code className="font-mono">{entry.methodology_version}</code></span>}
              </div>
            )}
          </div>
        )}

        {tab === "airplay" && (
          <AirplayDetailPanel
            airplayScore={entry.airplay_score}
            detections={entry.airplay_detections}
            stationCount={entry.airplay_station_count}
            totalDurationSeconds={entry.airplay_total_duration}
            weightedScore={entry.airplay_weighted_score}
            lastDetectedAt={entry.airplay_last_detected_at ?? null}
            matchedBy={entry.airplay_matched_by}
            rescueMode={entry.airplay_rescue_mode}
            isAirplayCandidate={entry.airplay_candidate_only}
          />
        )}

        {tab === "eligibility" && (
          <EligibilitySection entry={entry} />
        )}

        {tab === "sources" && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-wk-text-muted uppercase tracking-wider">
              {entry.source_count} Distinct Sources · {entry.occurrence_count} Total Occurrences
            </div>
            {Array.isArray(entry.source_urls_seen) && entry.source_urls_seen.length > 0 ? (
              <div className="space-y-1">
                {entry.source_urls_seen.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                    <WkIcon name="Link" size={11} className="text-wk-text-faint shrink-0" />
                    <span className="text-[11px] font-mono text-wk-text truncate">{url}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-wk-text-faint italic">No source URLs recorded (carry-forward or airplay-only row)</p>
            )}
            {entry.normalized_key && (
              <div className="flex items-center gap-2 text-[10px] text-wk-text-faint font-mono">
                <WkIcon name="Key" size={10} />
                normalized_key: {entry.normalized_key}
              </div>
            )}
            {entry.lead_artist_key && (
              <div className="flex items-center gap-2 text-[10px] text-wk-text-faint font-mono">
                <WkIcon name="User" size={10} />
                lead_artist_key: {entry.lead_artist_key}
              </div>
            )}
          </div>
        )}

        {tab === "payload" && (
          <div className="space-y-2">
            <p className="text-[11px] text-wk-text-muted">Raw <code className="font-mono text-[10px]">source_payload</code> JSONB — the full audit record as persisted in the database.</p>
            <pre className="overflow-x-auto rounded-lg border border-wk-border bg-wk-bg-subtle p-3 text-[10px] font-mono text-wk-text-muted max-h-[400px]">
              {JSON.stringify(entry.source_payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function EntryAuditTable({ entries, loading }: EntryAuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  if (loading) {
    return (
      <div className="py-12 text-center text-[13px] text-wk-text-muted">
        <WkIcon name="Loader" size={20} className="animate-spin inline mr-2 text-wk-brand" />
        Loading entries...
      </div>
    );
  }

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.track_title?.toLowerCase().includes(q) ||
      e.artist_name?.toLowerCase().includes(q) ||
      e.normalized_key?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by track, artist, normalized key…"
          className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand"
        />
      </div>

      {/* Count */}
      <div className="text-[11px] text-wk-text-muted">
        {filtered.length} of {entries.length} entries
        {filtered.length < entries.length && " (filtered)"}
        {" "}· Click any row to expand the full audit breakdown
      </div>

      {/* Table */}
      <div className="rounded-xl border border-wk-border overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-wk-border bg-wk-bg-subtle">
              <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-wk-text-faint w-10">#</th>
              <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-wk-text-faint">Track / Artist</th>
              <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-wk-text-faint text-right">Total</th>
              <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-wk-text-faint text-center hidden md:table-cell">Audit</th>
              <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-wk-text-faint text-center hidden md:table-cell">Move</th>
              <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-wk-text-faint text-center hidden md:table-cell">Flags</th>
              <th className="px-3 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const hasFlags = entry.overlap_bonus_capped || entry.lead_artist_overflow || entry.stale_carry_forward_demoted || entry.carry_forward_only || entry.airplay_candidate_only;
              return (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className={`cursor-pointer border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised ${
                      isExpanded ? "bg-wk-surface-raised" : ""
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-3 py-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wk-brand-soft text-[12px] font-black text-wk-brand">
                        {entry.rank}
                      </div>
                    </td>

                    {/* Track + Artist */}
                    <td className="px-3 py-3">
                      <div className="font-semibold text-wk-text truncate max-w-[240px]">{entry.track_title ?? "—"}</div>
                      <div className="text-[11px] text-wk-text-muted truncate max-w-[240px]">{entry.artist_name ?? "—"}</div>
                      {/* Compact inline score chips */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <CompactScoreChip label="SRC" value={entry.source_score} cap={72} />
                        <CompactScoreChip label="CROSS" value={entry.cross_source_bonus} cap={24} />
                        <CompactScoreChip label="OVL" value={entry.overlap_bonus} cap={10} />
                        <CompactScoreChip label="REC" value={entry.recency_score} cap={18} />
                        <CompactScoreChip label="CONT" value={entry.continuity_score} cap={18} />
                        <CompactScoreChip label="CF" value={entry.carry_forward_bonus} cap={18} />
                        <CompactScoreChip label="AIR" value={entry.airplay_score} cap={24} />
                        {entry.anti_gaming_penalty > 0 && (
                          <div className="relative flex flex-col items-center rounded-md border border-wk-danger/30 px-1.5 py-1 text-center min-w-[36px] bg-wk-danger-soft" title={`Anti-gaming penalty: -${entry.anti_gaming_penalty.toFixed(4)}`}>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-wk-danger">PEN</span>
                            <span className="text-[11px] font-black tabular-nums leading-none text-wk-danger">-{entry.anti_gaming_penalty.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Total score + invariant */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[14px] font-black tabular-nums text-wk-brand">{entry.total_score.toFixed(2)}</span>
                        <InvariantBadge entry={entry} />
                      </div>
                    </td>

                    {/* Audit */}
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-wk-text-muted">{entry.source_count} src</span>
                        <span className={`text-[10px] tabular-nums ${entry.airplay_score > 0 ? "text-wk-brand font-semibold" : "text-wk-text-faint"}`}>
                          {entry.airplay_score > 0 ? `air ${entry.airplay_score.toFixed(1)}` : "—"}
                        </span>
                        {entry.carry_forward_bonus > 0 && (
                          <span className="text-[10px] text-wk-warning font-semibold">cf {entry.carry_forward_bonus.toFixed(1)}</span>
                        )}
                      </div>
                    </td>

                    {/* Movement */}
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      <MovementBadge movement={entry.movement} previousRank={entry.previous_rank} currentRank={entry.rank} />
                    </td>

                    {/* Flags */}
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      {hasFlags ? (
                        <div className="flex items-center justify-center gap-1">
                          {entry.overlap_bonus_capped && (
                            <span title="Overlap bonus capped" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-wk-warning-soft text-wk-warning">
                              <WkIcon name="AlertTriangle" size={10} />
                            </span>
                          )}
                          {entry.lead_artist_overflow && (
                            <span title="Lead artist overflow" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-wk-danger-soft text-wk-danger">
                              <WkIcon name="Users" size={10} />
                            </span>
                          )}
                          {entry.carry_forward_only && (
                            <span title="Carry forward" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-wk-warning-soft text-wk-warning">
                              <WkIcon name="RotateCcw" size={10} />
                            </span>
                          )}
                          {entry.airplay_candidate_only && (
                            <span title="Airplay rescue candidate" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-wk-info-soft text-wk-info">
                              <WkIcon name="Radio" size={10} />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-wk-text-faint">—</span>
                      )}
                    </td>

                    {/* Expand toggle */}
                    <td className="px-3 py-3 text-right">
                      <WkIcon
                        name={isExpanded ? "ChevronUp" : "ChevronDown"}
                        size={14}
                        className="text-wk-text-faint"
                      />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${entry.id}-detail`} className="bg-wk-bg-subtle">
                      <td colSpan={7} className="p-0">
                        <EntryDetailPanel entry={entry} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <WkIcon name="Search" size={28} className="text-wk-text-faint mx-auto mb-2" />
            <p className="text-[13px] text-wk-text-muted">No entries match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}