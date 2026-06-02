import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { loadAuditEvents, clearAuditEvents } from "@/services/adminSettings/settingsStore";
import type { AuditEvent } from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsAudit() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<AuditEvent[]>(loadAuditEvents());
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? events : events.filter((e) => e.domain === filter);
  const hasAuditPersistence = events.length > 0 || typeof window !== "undefined";

  const severityIcon = (severity: string) => {
    if (severity === "error") return "XCircle";
    if (severity === "warning") return "AlertTriangle";
    return "Info";
  };

  const severityColor = (severity: string) => {
    if (severity === "error") return "text-[var(--wk-danger)]";
    if (severity === "warning") return "text-[var(--wk-warning)]";
    return "text-[var(--wk-info)]";
  };

  const severityBg = (severity: string) => {
    if (severity === "error") return "bg-[var(--wk-danger-soft)]";
    if (severity === "warning") return "bg-[var(--wk-warning-soft)]";
    return "bg-[var(--wk-info-soft)]";
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="ClipboardList" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Audit</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Recent admin-sensitive events and settings changes.</p>
      </div>

      {!hasAuditPersistence && (
        <WkSurface className="p-4 border-l-4 border-[var(--wk-warning)]">
          <div className="flex items-start gap-3">
            <WkIcon name="AlertTriangle" size={18} className="text-[var(--wk-warning)] mt-0.5" />
            <div>
              <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Audit Persistence Not Connected</h3>
              <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">
                Audit persistence is not connected yet. Local admin events are shown for this browser session only.
              </p>
            </div>
          </div>
        </WkSurface>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[12px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none"
          >
            <option value="all">All Domains</option>
            <option value="charts">Charts</option>
            <option value="integrations">Integrations</option>
            <option value="gscData">GSC Data</option>
            <option value="frontendAppearance">Appearance</option>
            <option value="playerPlayback">Playback</option>
            <option value="registry">Registry</option>
            <option value="airplay">Airplay</option>
            <option value="audience">Audience</option>
            <option value="emailBriefings">Email</option>
            <option value="maintenance">Maintenance</option>
            <option value="navigation">Navigation</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--wk-text-muted)]">{filtered.length} events</span>
          <button
            onClick={() => { clearAuditEvents(); setEvents([]); }}
            className="wk-button wk-button-ghost wk-button-sm flex items-center gap-1.5"
          >
            <WkIcon name="Trash2" size={14} /> Clear
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <WkSurface className="p-8 text-center">
          <WkIcon name="ClipboardList" size={32} className="text-[var(--wk-text-faint)] mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-[var(--wk-text)]">No audit events</p>
          <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">Events will appear here when settings are updated, providers are tested, or maintenance actions are run.</p>
        </WkSurface>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => (
            <div key={event.id} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${severityBg(event.severity)}`}>
                  <WkIcon name={severityIcon(event.severity)} size={16} className={severityColor(event.severity)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[var(--wk-text)]">{event.action}</span>
                    <span className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)] uppercase">
                      {event.domain}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">{event.details}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--wk-text-faint)]">
                    <span>{new Date(event.timestamp).toLocaleString()}</span>
                    <span>by {event.actor}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}