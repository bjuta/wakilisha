import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import type { ScoringConfig } from "@/services/chartsScoring/scoringTypes";

interface PolicySnapshotPanelProps {
  methodologyVersion: string | null;
  sourceVersion: string | null;
  eligibilityVersion: string | null;
  scoringVersion: string | null;
  ruleSetSnapshot: ScoringConfig | null;
  overrideMode: string | null;
}

function VersionBadge({ label, version }: { label: string; version: string | null }) {
  const isSet = !!version;
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
      <span className="text-[9px] font-bold uppercase tracking-widest text-wk-text-faint">{label}</span>
      <span className={`text-[13px] font-mono font-bold ${isSet ? "text-wk-text" : "text-wk-text-faint"}`}>
        {version ?? "—"}
      </span>
    </div>
  );
}

const CONFIG_LABELS: Record<string, { label: string; group: string }> = {
  chart_size:                                  { label: "Chart Size", group: "Core" },
  streaming_min_sources:                       { label: "Min Streaming Sources", group: "Core" },
  cross_source_mode:                           { label: "Cross-Source Mode", group: "Scoring" },
  cross_source_weight:                         { label: "Cross-Source Weight", group: "Scoring" },
  continuity_weight:                           { label: "Continuity Weight", group: "Scoring" },
  carry_forward_weight:                        { label: "Carry-Forward Weight", group: "Scoring" },
  airplay_enabled:                             { label: "Airplay Enabled", group: "Airplay" },
  airplay_station_scope:                       { label: "Station Scope", group: "Airplay" },
  airplay_min_duration:                        { label: "Min Detection Duration (s)", group: "Airplay" },
  airplay_weight:                              { label: "Airplay Weight", group: "Airplay" },
  airplay_min_stations:                        { label: "Min Stations", group: "Airplay" },
  airplay_min_detections:                      { label: "Min Detections", group: "Airplay" },
  airplay_max_score:                           { label: "Max Airplay Score", group: "Airplay" },
  airplay_rescue_mode:                         { label: "Rescue Mode", group: "Airplay" },
  anti_gaming_max_tracks_per_lead_artist:      { label: "Max Tracks / Lead Artist", group: "Anti-Gaming" },
  anti_gaming_overlap_bonus_cap:               { label: "Overlap Bonus Cap", group: "Anti-Gaming" },
  anti_gaming_artist_overflow_penalty:         { label: "Overflow Penalty", group: "Anti-Gaming" },
  anti_gaming_demote_carry_forward_without_current: { label: "Demote Stale CF", group: "Anti-Gaming" },
  missing_policy:                              { label: "Missing Data Policy", group: "Eligibility" },
  override_mode:                               { label: "Override Mode", group: "Governance" },
};

const GROUP_ORDER = ["Core", "Scoring", "Airplay", "Anti-Gaming", "Eligibility", "Governance"];

export function PolicySnapshotPanel({
  methodologyVersion,
  sourceVersion,
  eligibilityVersion,
  scoringVersion,
  ruleSetSnapshot,
  overrideMode,
}: PolicySnapshotPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const grouped = GROUP_ORDER.reduce<Record<string, Array<{ key: string; value: unknown }>>>(
    (acc, group) => {
      acc[group] = [];
      return acc;
    },
    {}
  );

  if (ruleSetSnapshot) {
    for (const [k, v] of Object.entries(ruleSetSnapshot)) {
      const meta = CONFIG_LABELS[k];
      if (meta) {
        grouped[meta.group].push({ key: k, value: v });
      }
    }
  }

  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-wk-surface-raised transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
            <WkIcon name="ShieldCheck" size={15} />
          </div>
          <div className="text-left">
            <div className="text-[13px] font-bold text-wk-text">Policy Snapshot (§12)</div>
            <div className="text-[11px] text-wk-text-muted">Version strings + serialized rule set frozen at publish time</div>
          </div>
        </div>
        <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} className="text-wk-text-muted shrink-0" />
      </button>

      {/* Version badges — always visible */}
      <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-4">
        <VersionBadge label="Methodology" version={methodologyVersion} />
        <VersionBadge label="Source Policy" version={sourceVersion} />
        <VersionBadge label="Eligibility" version={eligibilityVersion} />
        <VersionBadge label="Scoring Policy" version={scoringVersion} />
      </div>

      {/* Expanded rule set */}
      {expanded && ruleSetSnapshot && (
        <div className="border-t border-wk-border px-5 py-4 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-wk-text-muted uppercase tracking-wider">Serialized Rule Set</span>
            <div className="flex items-center gap-2">
              {overrideMode && (
                <span className="rounded-full border border-wk-border px-2 py-0.5 text-[10px] font-semibold text-wk-text-muted">
                  Override: {overrideMode}
                </span>
              )}
              <button
                onClick={() => setShowRaw((x) => !x)}
                className="text-[11px] font-semibold text-wk-brand hover:underline"
              >
                {showRaw ? "Formatted view" : "Raw JSON"}
              </button>
            </div>
          </div>

          {showRaw ? (
            <pre className="overflow-x-auto rounded-lg border border-wk-border bg-wk-bg-subtle p-3 text-[10px] font-mono text-wk-text-muted">
              {JSON.stringify(ruleSetSnapshot, null, 2)}
            </pre>
          ) : (
            <div className="space-y-4">
              {GROUP_ORDER.map((group) => {
                const rows = grouped[group];
                if (!rows || rows.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-wk-text-faint">{group}</div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {rows.map(({ key, value }) => {
                        const meta = CONFIG_LABELS[key];
                        const isBool = typeof value === "boolean";
                        const displayVal = isBool
                          ? (value ? "✓ on" : "✗ off")
                          : String(value);
                        const boolColor = isBool
                          ? (value ? "text-wk-success" : "text-wk-text-faint")
                          : "text-wk-text";
                        return (
                          <div
                            key={key}
                            className="flex flex-col gap-0.5 rounded-lg border border-wk-border bg-wk-bg-subtle px-2.5 py-2"
                          >
                            <span className="text-[9px] font-semibold text-wk-text-faint leading-tight">{meta?.label ?? key}</span>
                            <span className={`text-[12px] font-bold font-mono ${boolColor}`}>{displayVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}