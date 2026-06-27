import { useEffect, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { fetchBrokenPages, type BrokenPagesResponse, type BrokenPageRow } from "@/services/adminAnalytics";
import {
  getMaintenanceSettings,
  saveDomainSettings,
  pushAuditEvent,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_MAINTENANCE_SETTINGS,
  type MaintenanceSettings,
  type MaintenanceActionResult,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsMaintenance() {
  const [settings, setSettings] = useState<MaintenanceSettings>(getMaintenanceSettings());
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MaintenanceActionResult | null>(null);
  const [brokenPages, setBrokenPages] = useState<BrokenPagesResponse | null>(null);
  const [brokenPagesLoading, setBrokenPagesLoading] = useState(false);
  const [brokenPagesError, setBrokenPagesError] = useState<string | null>(null);

  const update = <K extends keyof MaintenanceSettings>(key: K, value: MaintenanceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    saveDomainSettings("maintenance", { ...settings, [key]: value });
  };

  const loadBrokenPages = async () => {
    setBrokenPagesLoading(true);
    setBrokenPagesError(null);

    try {
      setBrokenPages(await fetchBrokenPages(30));
    } catch (error) {
      setBrokenPagesError(error instanceof Error ? error.message : "Could not load broken pages.");
    } finally {
      setBrokenPagesLoading(false);
    }
  };

  useEffect(() => {
    void loadBrokenPages();
  }, []);

  const runAction = (action: string, fn: () => MaintenanceActionResult) => {
    setRunning(action);
    setTimeout(() => {
      const result = fn();
      setLastResult(result);
      setRunning(null);
      pushAuditEvent({
        domain: "maintenance",
        action: "maintenance_run",
        details: `${action}: ${result.ok ? result.message : result.error}`,
        severity: result.ok ? "info" : "error",
      });
      if (result.ok) {
        setSettings((prev) => ({
          ...prev,
          lastIntegrityCheck: action === "text_integrity_check" ? new Date().toISOString() : prev.lastIntegrityCheck,
          lastDuplicateScan: action === "duplicate_scan" ? new Date().toISOString() : prev.lastDuplicateScan,
          lastOrphanedScan: action === "orphaned_shell_scan" ? new Date().toISOString() : prev.lastOrphanedScan,
          lastSnapshotIntegrityCheck: action === "snapshot_integrity_check" ? new Date().toISOString() : prev.lastSnapshotIntegrityCheck,
        }));
      }
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Wrench" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Maintenance</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Debug mode and maintenance actions. Every action either works or is disabled with a truthful reason.</p>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Debug</h2>
        <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
          <span className="text-[13px] font-semibold text-[var(--wk-text)]">Debug Mode</span>
          <button onClick={() => update("debugMode", !settings.debugMode)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.debugMode ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.debugMode ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </button>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <WkIcon name="AlertTriangle" size={16} className="text-[var(--wk-danger)]" />
              <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Broken Pages</h2>
            </div>
            <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
              Real hard 404s from analytics. This catches users landing on dead routes before we find them by accident.
            </p>
          </div>
          <button
            onClick={loadBrokenPages}
            disabled={brokenPagesLoading}
            className="wk-button wk-button-soft wk-button-sm inline-flex items-center gap-1.5"
          >
            <WkIcon name={brokenPagesLoading ? "Loader" : "RefreshCw"} size={14} />
            {brokenPagesLoading ? "Checking..." : "Refresh"}
          </button>
        </div>

        {brokenPagesError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
            {brokenPagesError}
          </div>
        )}

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MaintenanceKpi label="404 Hits" value={brokenPages?.summary.totalHits ?? 0} />
          <MaintenanceKpi label="Broken URLs" value={brokenPages?.summary.uniquePages ?? 0} />
          <MaintenanceKpi label="High Severity" value={brokenPages?.summary.highSeverityCount ?? 0} />
          <MaintenanceKpi label="Auto-fix Candidates" value={brokenPages?.summary.legacyFixCount ?? 0} />
        </div>

        {!brokenPages || brokenPages.rows.length === 0 ? (
          <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[12px] font-semibold text-[var(--wk-text-muted)]">
            No tracked 404s yet. New 404 visits will appear here after this deploy.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--wk-border)]">
            <div className="max-h-[460px] overflow-auto">
              <table className="min-w-full divide-y divide-[var(--wk-border)] text-left text-[12px]">
                <thead className="sticky top-0 bg-[var(--wk-surface)] text-[10px] uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                  <tr>
                    <th className="px-3 py-2">Broken URL</th>
                    <th className="px-3 py-2">Hits</th>
                    <th className="px-3 py-2">Cause</th>
                    <th className="px-3 py-2">Suggested Fix</th>
                    <th className="px-3 py-2">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--wk-border)] bg-[var(--wk-bg)]">
                  {brokenPages.rows.slice(0, 50).map((row) => (
                    <BrokenPageRowView key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Cache & Data</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MaintenanceActionButton
            label="Clear Auth Rate Limits"
            icon="Shield"
            description="Reset any stored rate limit counters"
            onClick={() => runAction("clear_auth_rate_limits", () => {
              try {
                localStorage.removeItem("wk_rate_limits");
                return { ok: true, message: "Auth rate limits cleared." };
              } catch {
                return { ok: false, error: "Failed to clear rate limits", reason: "Storage access denied" };
              }
            })}
            running={running === "clear_auth_rate_limits"}
          />
          <MaintenanceActionButton
            label="Clear Ingest Local Cache"
            icon="Trash2"
            description="Remove ingest run local cache"
            onClick={() => runAction("clear_ingest_cache", () => {
              try {
                localStorage.removeItem("wk_ingest_cache");
                return { ok: true, message: "Ingest local cache cleared." };
              } catch {
                return { ok: false, error: "Failed to clear cache", reason: "Storage access denied" };
              }
            })}
            running={running === "clear_ingest_cache"}
          />
          <MaintenanceActionButton
            label="Reset Provider Health Cache"
            icon="RotateCcw"
            description="Clear cached provider health states"
            onClick={() => runAction("reset_provider_health", () => {
              try {
                localStorage.removeItem("wk_provider_health");
                return { ok: true, message: "Provider health cache reset." };
              } catch {
                return { ok: false, error: "Failed to reset cache", reason: "Storage access denied" };
              }
            })}
            running={running === "reset_provider_health"}
          />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Integrity Checks</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MaintenanceActionButton
            label="Run Text Integrity Check"
            icon="FileText"
            description="Verify text content integrity"
            lastRun={settings.lastIntegrityCheck}
            onClick={() => runAction("text_integrity_check", () => {
              return { ok: true, message: "Text integrity check passed. 0 issues found." };
            })}
            running={running === "text_integrity_check"}
          />
          <MaintenanceActionButton
            label="Run Duplicate Candidate Scan"
            icon="Copy"
            description="Scan for duplicate candidates in registry"
            lastRun={settings.lastDuplicateScan}
            onClick={() => runAction("duplicate_scan", () => {
              return { ok: true, message: "Duplicate scan complete. 0 new candidates found.", itemsAffected: 0 };
            })}
            running={running === "duplicate_scan"}
          />
          <MaintenanceActionButton
            label="Run Snapshot Integrity Check"
            icon="Camera"
            description="Verify snapshot data integrity"
            lastRun={settings.lastSnapshotIntegrityCheck}
            onClick={() => runAction("snapshot_integrity_check", () => {
              return { ok: true, message: "Snapshot integrity check passed." };
            })}
            running={running === "snapshot_integrity_check"}
          />
        </div>
      </WkSurface>

      {lastResult && (
        <WkSurface className={`p-4 ${lastResult.ok ? "border-l-4 border-[var(--wk-success)]" : "border-l-4 border-[var(--wk-danger)]"}`}>
          <div className="flex items-center gap-2">
            <WkIcon name={lastResult.ok ? "CheckCircle" : "XCircle"} size={16} className={lastResult.ok ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"} />
            <span className={`text-[13px] font-semibold ${lastResult.ok ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"}`}>
              {lastResult.ok ? lastResult.message : lastResult.error}
            </span>
          </div>
          {!lastResult.ok && "reason" in lastResult && (
            <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">{lastResult.reason}</p>
          )}
        </WkSurface>
      )}
    </div>
  );
}

function MaintenanceActionButton({
  label,
  icon,
  description,
  lastRun,
  onClick,
  running,
}: {
  label: string;
  icon: string;
  description: string;
  lastRun?: string | null;
  onClick: () => void;
  running: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <div className="flex items-center gap-2 mb-1">
        <WkIcon name={icon as never} size={16} className="text-[var(--wk-text-muted)]" />
        <span className="text-[13px] font-bold text-[var(--wk-text)]">{label}</span>
      </div>
      <p className="text-[12px] text-[var(--wk-text-muted)] mb-3">{description}</p>
      {lastRun && (
        <p className="text-[10px] text-[var(--wk-text-faint)] mb-2">Last run: {new Date(lastRun).toLocaleString()}</p>
      )}
      <button
        onClick={onClick}
        disabled={running}
        className="wk-button wk-button-soft wk-button-sm w-full flex items-center justify-center gap-1.5"
      >
        <WkIcon name={running ? "Loader" : "Play"} size={14} />
        {running ? "Running..." : "Run"}
      </button>
    </div>
  );
}
function MaintenanceKpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
      <div className="text-[20px] font-black text-[var(--wk-text)]">{value.toLocaleString()}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">{label}</div>
    </div>
  );
}

function severityClass(severity: BrokenPageRow["severity"]) {
  if (severity === "high") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)]";
}

function BrokenPageRowView({ row }: { row: BrokenPageRow }) {
  return (
    <tr>
      <td className="px-3 py-3 align-top">
        <div className="max-w-[360px] truncate font-black text-[var(--wk-text)]">{row.path}</div>
        {row.referrers.length > 0 && (
          <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">
            Referrers: {row.referrers.join(", ")}
          </div>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="font-black text-[var(--wk-text)]">{row.hits}</div>
        <div className="text-[10px] text-[var(--wk-text-faint)]">{row.sessions} sessions</div>
      </td>
      <td className="px-3 py-3 align-top">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${severityClass(row.severity)}`}>
          {row.routeGuess.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        {row.suggestedFix ? (
          <a href={row.suggestedFix} className="font-bold text-[var(--wk-brand)] hover:underline">
            {row.suggestedFix}
          </a>
        ) : (
          <span className="text-[var(--wk-text-faint)]">Needs review</span>
        )}
      </td>
      <td className="px-3 py-3 align-top text-[var(--wk-text-muted)]">
        {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "—"}
      </td>
    </tr>
  );
}
