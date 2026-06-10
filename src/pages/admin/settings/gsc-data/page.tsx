import { useEffect, useState, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface GscConnection {
  id: string;
  property_url: string;
  property_type: string | null;
  status: string | null;
  connected_at: string | null;
  last_import_at: string | null;
  created_at: string;
}

interface GscImportRun {
  id: string;
  status: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  rows_imported: number | null;
  rows_matched: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface GscMetricSummary {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  matched_entity_type: string | null;
  matched_entity_slug: string | null;
}

type GscScreen = "connect" | "dashboard";

const OAUTH_SCOPES = "https://www.googleapis.com/auth/webmasters.readonly";

export default function AdminSettingsGscData() {
  const [connection, setConnection] = useState<GscConnection | null>(null);
  const [importRuns, setImportRuns] = useState<GscImportRun[]>([]);
  const [topQueries, setTopQueries] = useState<GscMetricSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreen] = useState<GscScreen>("connect");

  // Connection form state
  const [propertyUrl, setPropertyUrl] = useState("");
  const [propertyType, setPropertyType] = useState<"URL_PREFIX" | "DOMAIN">("URL_PREFIX");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Import state
  const [importRunning, setImportRunning] = useState(false);
  const [importDateStart, setImportDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [importDateEnd, setImportDateEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [importError, setImportError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [connRes, runsRes, metricsRes] = await Promise.all([
        supabase.from("gsc_connections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("gsc_import_runs").select("*").order("started_at", { ascending: false }).limit(10),
        supabase.from("gsc_query_page_metrics").select("query, clicks, impressions, ctr, position").order("clicks", { ascending: false }).limit(20),
      ]);

      if (connRes.error && connRes.error.code !== "PGRST116") throw connRes.error;
      if (runsRes.error) throw runsRes.error;

      const conn = connRes.data as GscConnection | null;
      setConnection(conn);
      setImportRuns((runsRes.data ?? []) as GscImportRun[]);
      setTopQueries((metricsRes.data ?? []).map((m) => ({ ...m, matched_entity_type: null, matched_entity_slug: null })) as GscMetricSummary[]);
      setScreen(conn?.status === "connected" ? "dashboard" : "connect");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load GSC data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    if (!propertyUrl.trim()) {
      setConnectError("Property URL is required.");
      return;
    }
    setConnecting(true);
    setConnectError(null);
    try {
      // Save connection record as pending
      const { data, error } = await supabase
        .from("gsc_connections")
        .upsert({
          property_url: propertyUrl.trim(),
          property_type: propertyType,
          status: "pending",
          created_by: "admin",
          updated_at: new Date().toISOString(),
        }, { onConflict: "property_url" })
        .select()
        .single();

      if (error) throw error;
      setConnection(data as GscConnection);

      // Initiate OAuth flow
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        showToast("error", "VITE_GOOGLE_CLIENT_ID env var is not set. Add your Google OAuth client ID to connect.");
        setConnecting(false);
        return;
      }

      const state = data.id; // use connection ID as state for CSRF
      const redirectUri = `${window.location.origin}/admin/settings/gsc-data?callback=1`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", OAUTH_SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      // Save state to detect callback
      sessionStorage.setItem("gsc_oauth_state", state);
      window.location.href = authUrl.toString();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    if (!confirm("Disconnect Google Search Console? Import history and metrics will be preserved.")) return;
    try {
      await supabase
        .from("gsc_connections")
        .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
        .eq("id", connection.id);
      setConnection((prev) => prev ? { ...prev, status: "disconnected" } : prev);
      setScreen("connect");
      showToast("success", "Disconnected GSC.");
    } catch (err) {
      showToast("error", "Disconnect failed.");
    }
  };

  const handleImport = async () => {
    if (!connection || connection.status !== "connected") {
      setImportError("Connect to Google Search Console first.");
      return;
    }
    setImportRunning(true);
    setImportError(null);
    try {
      // Create import run record
      const { data: run, error: runError } = await supabase
        .from("gsc_import_runs")
        .insert({
          connection_id: connection.id,
          status: "running",
          date_range_start: importDateStart,
          date_range_end: importDateEnd,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (runError) throw runError;

      // In production: call edge function to import from GSC API
      // For now: mark as failed_no_token if no access_token
      const { error: updateError } = await supabase
        .from("gsc_import_runs")
        .update({
          status: "failed",
          error_message: "GSC OAuth not completed. Connect via Google OAuth to enable real data import.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      if (updateError) throw updateError;
      showToast("error", "Connect via OAuth first to import real GSC data.");
      await loadData();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImportRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-[var(--wk-surface-raised)]" />
        <div className="h-40 rounded-xl bg-[var(--wk-surface-raised)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Globe" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">
            Google Search Console
          </h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Connect GSC to import search demand data, match queries to registry entities, and surface artist/track demand insights.
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] p-3 text-[13px] text-[var(--wk-danger)] flex items-center gap-2">
          <WkIcon name="AlertTriangle" size={15} />
          {loadError}
          <button onClick={loadData} className="ml-auto text-[11px] underline">Retry</button>
        </div>
      )}

      {/* Connection status bar */}
      <WkSurface className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              connection?.status === "connected"
                ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
            }`}>
              <WkIcon name="Globe" size={18} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--wk-text)]">
                {connection?.status === "connected" ? "Connected" : connection?.status === "pending" ? "Awaiting OAuth" : "Not connected"}
              </p>
              <p className="text-[12px] text-[var(--wk-text-muted)]">
                {connection?.property_url || "No property configured"}
                {connection?.last_import_at && ` · Last import: ${new Date(connection.last_import_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connection?.status === "connected" && (
              <button onClick={handleDisconnect} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-[var(--wk-danger)]">
                Disconnect
              </button>
            )}
            <button onClick={loadData} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
              <WkIcon name="RefreshCw" size={13} /> Refresh
            </button>
          </div>
        </div>
      </WkSurface>

      {/* Connect screen */}
      {screen === "connect" && (
        <WkSurface className="p-5">
          <h2 className="text-[15px] font-bold text-[var(--wk-text)] mb-1">Connect Google Search Console</h2>
          <p className="text-[12px] text-[var(--wk-text-muted)] mb-5">
            Enter your GSC property URL and authorize via Google OAuth. WAKILISHA never stores passwords — only the OAuth access token.
          </p>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-faint)] mb-1.5">
                Property URL *
              </label>
              <input
                type="url"
                value={propertyUrl}
                onChange={(e) => setPropertyUrl(e.target.value)}
                placeholder="https://wakilisha.africa/"
                className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
              />
              <p className="mt-1 text-[11px] text-[var(--wk-text-faint)]">
                Must match exactly the property registered in Google Search Console.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-faint)] mb-1.5">
                Property type
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as "URL_PREFIX" | "DOMAIN")}
                className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] cursor-pointer"
              >
                <option value="URL_PREFIX">URL prefix (e.g. https://wakilisha.africa/)</option>
                <option value="DOMAIN">Domain property (e.g. sc-domain:wakilisha.africa)</option>
              </select>
            </div>

            {connectError && (
              <p className="text-[12px] text-[var(--wk-danger)]">{connectError}</p>
            )}

            <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
              <p className="text-[11px] font-bold text-[var(--wk-text)] mb-1">Required setup</p>
              <ul className="space-y-1 text-[11px] text-[var(--wk-text-muted)]">
                <li className="flex items-start gap-1.5">
                  <WkIcon name={import.meta.env.VITE_GOOGLE_CLIENT_ID ? "Check" : "AlertCircle"} size={12} className={`mt-0.5 shrink-0 ${import.meta.env.VITE_GOOGLE_CLIENT_ID ? "text-[var(--wk-success)]" : "text-[var(--wk-warning)]"}`} />
                  VITE_GOOGLE_CLIENT_ID env var: {import.meta.env.VITE_GOOGLE_CLIENT_ID ? "Set" : "Not set — required for OAuth"}
                </li>
                <li className="flex items-start gap-1.5">
                  <WkIcon name="Info" size={12} className="mt-0.5 shrink-0 text-[var(--wk-text-faint)]" />
                  Redirect URI must be registered: {window.location.origin}/admin/settings/gsc-data?callback=1
                </li>
                <li className="flex items-start gap-1.5">
                  <WkIcon name="Info" size={12} className="mt-0.5 shrink-0 text-[var(--wk-text-faint)]" />
                  Required OAuth scope: webmasters.readonly
                </li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting || !propertyUrl.trim()}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
            >
              {connecting ? (
                <><WkIcon name="Loader2" size={14} className="animate-spin inline mr-1.5" /> Connecting…</>
              ) : (
                <><WkIcon name="ExternalLink" size={14} /> Connect via Google OAuth</>
              )}
            </button>
          </div>
        </WkSurface>
      )}

      {/* Dashboard screen */}
      {screen === "dashboard" && connection?.status === "connected" && (
        <>
          {/* Import panel */}
          <WkSurface className="p-5">
            <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Import query data</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-faint)] mb-1.5">
                  Date range start
                </label>
                <input
                  type="date"
                  value={importDateStart}
                  onChange={(e) => setImportDateStart(e.target.value)}
                  className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-faint)] mb-1.5">
                  Date range end
                </label>
                <input
                  type="date"
                  value={importDateEnd}
                  onChange={(e) => setImportDateEnd(e.target.value)}
                  className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] cursor-pointer"
                />
              </div>
              <button
                onClick={handleImport}
                disabled={importRunning}
                className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
              >
                {importRunning ? (
                  <><WkIcon name="Loader2" size={14} className="animate-spin inline mr-1.5" /> Importing…</>
                ) : (
                  <><WkIcon name="Download" size={14} /> Import query metrics</>
                )}
              </button>
            </div>
            {importError && (
              <p className="mt-2 text-[12px] text-[var(--wk-danger)]">{importError}</p>
            )}
          </WkSurface>

          {/* Top queries */}
          {topQueries.length > 0 ? (
            <WkSurface className="overflow-hidden">
              <div className="border-b border-[var(--wk-border)] px-5 py-4">
                <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Top search queries</h2>
                <p className="text-[12px] text-[var(--wk-text-muted)] mt-0.5">Queries driving impressions and clicks</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-[var(--wk-border)] bg-[var(--wk-surface-raised)] text-[10px] uppercase tracking-wider text-[var(--wk-text-faint)]">
                    <tr>
                      <th className="px-5 py-3">Query</th>
                      <th className="px-5 py-3">Clicks</th>
                      <th className="px-5 py-3">Impressions</th>
                      <th className="px-5 py-3">CTR</th>
                      <th className="px-5 py-3">Avg Position</th>
                      <th className="px-5 py-3">Registry Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--wk-border)]">
                    {topQueries.map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--wk-surface-raised)]">
                        <td className="px-5 py-3 font-medium text-[var(--wk-text)]">{row.query}</td>
                        <td className="px-5 py-3 font-bold text-[var(--wk-brand)]">{row.clicks.toLocaleString()}</td>
                        <td className="px-5 py-3 text-[var(--wk-text-muted)]">{row.impressions.toLocaleString()}</td>
                        <td className="px-5 py-3 text-[var(--wk-text-muted)]">{(row.ctr * 100).toFixed(1)}%</td>
                        <td className="px-5 py-3 text-[var(--wk-text-muted)]">{row.position.toFixed(1)}</td>
                        <td className="px-5 py-3">
                          {row.matched_entity_slug ? (
                            <span className="text-[var(--wk-success)] font-semibold">{row.matched_entity_type}: {row.matched_entity_slug}</span>
                          ) : (
                            <span className="text-[var(--wk-warning)] text-[10px] font-bold uppercase">Unmatched</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </WkSurface>
          ) : (
            <WkSurface className="p-8 text-center">
              <WkIcon name="BarChart2" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-[14px] font-bold text-[var(--wk-text)]">No query data yet</p>
              <p className="text-[13px] text-[var(--wk-text-muted)] mt-1">
                Import query metrics from GSC to see artist and content demand insights.
              </p>
            </WkSurface>
          )}
        </>
      )}

      {/* Import history */}
      {importRuns.length > 0 && (
        <WkSurface className="p-5">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-3">Import history</h2>
          <div className="space-y-2">
            {importRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--wk-border)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    run.status === "completed" ? "bg-[var(--wk-success)]" :
                    run.status === "running" ? "bg-[var(--wk-brand)] animate-pulse" :
                    "bg-[var(--wk-danger)]"
                  }`} />
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--wk-text)]">
                      {run.date_range_start} → {run.date_range_end}
                    </p>
                    <p className="text-[11px] text-[var(--wk-text-muted)]">
                      {run.rows_imported?.toLocaleString()} rows · {run.rows_matched?.toLocaleString()} matched
                      {run.started_at && ` · ${new Date(run.started_at).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                  run.status === "completed" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                  run.status === "running" ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
                  "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                }`}>
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Roadmap panel */}
      <WkSurface className="p-5">
        <h2 className="text-[13px] font-bold text-[var(--wk-text)] mb-2 flex items-center gap-2">
          <WkIcon name="Map" size={14} className="text-[var(--wk-brand)]" />
          GSC Integration Roadmap
        </h2>
        <div className="space-y-2">
          {[
            { label: "OAuth connection", status: "ready", note: "Tables and connection flow implemented" },
            { label: "Property selection dropdown (real GSC properties)", status: "requires-oauth", note: "Requires VITE_GOOGLE_CLIENT_ID + server-side OAuth exchange" },
            { label: "Import query/page metrics", status: "requires-oauth", note: "Requires access_token from OAuth" },
            { label: "Artist/track/release matching", status: "schema-ready", note: "gsc_entity_matches table ready, matching logic pending" },
            { label: "Entity-level demand panels", status: "pending", note: "Will surface on artist/track admin pages after data exists" },
            { label: "Unmatched query review queue", status: "pending", note: "Requires imported metrics" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                item.status === "ready" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                item.status === "schema-ready" ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
                "bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]"
              }`}>
                {item.status === "ready" ? "✓" : "○"}
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[var(--wk-text)]">{item.label}</p>
                <p className="text-[11px] text-[var(--wk-text-muted)]">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </WkSurface>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[999] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg ${
          toast.type === "success"
            ? "border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
            : "border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
        }`}>
          <WkIcon name={toast.type === "success" ? "CheckCircle2" : "XCircle"} size={16} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}