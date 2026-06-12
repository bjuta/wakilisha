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
  rows_failed: number | null;
  error_message: string | null;
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
const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;

async function callEdgeFunction(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; [key: string]: unknown }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; [key: string]: unknown }>;
}

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
  const [importResult, setImportResult] = useState<string | null>(null);

  // OAuth callback processing state
  const [processingOAuth, setProcessingOAuth] = useState(false);

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

      // Don't include access_token/refresh_token in frontend state
      if (conn) {
        const { access_token, refresh_token, ...safeConn } = conn as GscConnection & { access_token?: string; refresh_token?: string };
        setConnection(safeConn as GscConnection);
      }

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
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const isCallback = params.get("callback") === "1";
    const code = params.get("code");
    const state = params.get("state");

    if (isCallback && code && state) {
      // Verify state matches what we stored
      const savedState = sessionStorage.getItem("gsc_oauth_state");
      if (savedState !== state) {
        setLoadError("OAuth state mismatch. Please try connecting again.");
        window.history.replaceState({}, "", "/admin/settings/gsc-data");
        loadData();
        return;
      }

      // Exchange code for tokens via Edge Function
      const exchangeCode = async () => {
        setProcessingOAuth(true);
        try {
          const redirectUri = `${window.location.origin}/admin/settings/gsc-data?callback=1`;
          const result = await callEdgeFunction("gsc-oauth-callback", {
            action: "exchange_code",
            code,
            redirectUri,
            connectionId: state,
          });

          // Clean up URL and session storage
          sessionStorage.removeItem("gsc_oauth_state");
          window.history.replaceState({}, "", "/admin/settings/gsc-data");

          if (result.ok) {
            showToast("success", "Google Search Console connected successfully!");
          } else {
            showToast("error", `OAuth failed: ${result.error || "Unknown error"}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "OAuth callback failed";
          setLoadError(msg);
          window.history.replaceState({}, "", "/admin/settings/gsc-data");
        } finally {
          setProcessingOAuth(false);
        }
      };

      exchangeCode();
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    if (!propertyUrl.trim()) {
      setConnectError("Property URL is required.");
      return;
    }
    setConnecting(true);
    setConnectError(null);
    try {
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

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        showToast("error", "VITE_GOOGLE_CLIENT_ID env var is not set. Add your Google OAuth client ID to connect.");
        setConnecting(false);
        return;
      }

      const state = data.id;
      const redirectUri = `${window.location.origin}/admin/settings/gsc-data?callback=1`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", OAUTH_SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

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
      const result = await callEdgeFunction("gsc-oauth-callback", {
        action: "disconnect",
        connectionId: connection.id,
      });

      if (result.ok) {
        setConnection((prev) => prev ? { ...prev, status: "disconnected" } : prev);
        setScreen("connect");
        showToast("success", "Disconnected GSC. Tokens have been cleared.");
      } else {
        showToast("error", `Disconnect failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Disconnect failed.");
    }
  };

  const handleImport = async () => {
    if (!connection || connection.status !== "connected") {
      setImportError("Connect to Google Search Console first.");
      return;
    }
    setImportRunning(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await callEdgeFunction("gsc-import-metrics", {
        action: "import",
        connectionId: connection.id,
        dateRangeStart: importDateStart,
        dateRangeEnd: importDateEnd,
        rowLimit: 5000,
      });

      if (result.ok) {
        const imported = result.rowsImported as number ?? 0;
        setImportResult(`Import successful! ${imported.toLocaleString()} rows imported from Google Search Console.`);
        showToast("success", `Imported ${imported.toLocaleString()} query metrics.`);
      } else {
        setImportError(`Import failed: ${result.error || "Unknown error"}`);
      }
      await loadData();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImportRunning(false);
    }
  };

  if (loading || processingOAuth) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-[var(--wk-surface-raised)]" />
        <div className="h-40 rounded-xl bg-[var(--wk-surface-raised)]" />
        {processingOAuth && (
          <div className="flex items-center justify-center gap-3 py-8">
            <WkIcon name="Loader2" size={20} className="animate-spin text-[var(--wk-brand)]" />
            <span className="text-[14px] text-[var(--wk-text)]">Completing Google OAuth…</span>
          </div>
        )}
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
                : connection?.status === "needs_reauth"
                ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
                : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
            }`}>
              <WkIcon name="Globe" size={18} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--wk-text)]">
                {connection?.status === "connected" ? "Connected" :
                 connection?.status === "needs_reauth" ? "Needs Re-Authorization" :
                 connection?.status === "pending" ? "Awaiting OAuth" : "Not connected"}
              </p>
              <p className="text-[12px] text-[var(--wk-text-muted)]">
                {connection?.property_url || "No property configured"}
                {connection?.last_import_at && ` · Last import: ${new Date(connection.last_import_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(connection?.status === "connected" || connection?.status === "needs_reauth") && (
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
            Enter your GSC property URL and authorize via Google OAuth. Tokens are exchanged server-side and stored securely — never in the browser.
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
                  VITE_GOOGLE_CLIENT_ID env var: {import.meta.env.VITE_GOOGLE_CLIENT_ID ? "Set" : "Not set — required for OAuth redirect"}
                </li>
                <li className="flex items-start gap-1.5">
                  <WkIcon name="Info" size={12} className="mt-0.5 shrink-0 text-[var(--wk-text-faint)]" />
                  GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET must be set as Edge Function secrets on gsc-oauth-callback
                </li>
                <li className="flex items-start gap-1.5">
                  <WkIcon name="Info" size={12} className="mt-0.5 shrink-0 text-[var(--wk-text-faint)]" />
                  Redirect URI must be registered in Google Cloud Console: {window.location.origin}/admin/settings/gsc-data?callback=1
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
      {(screen === "dashboard" || connection?.status === "needs_reauth") && (
        <>
          {connection?.status === "needs_reauth" && (
            <div className="rounded-xl border border-[var(--wk-warning)]/20 bg-[var(--wk-warning-soft)] p-4 text-[13px] text-[var(--wk-warning)]">
              <div className="flex items-center gap-2 font-bold mb-1">
                <WkIcon name="AlertTriangle" size={16} />
                Access token expired or revoked
              </div>
              <p className="text-[12px]">
                Google returned a 401/403 error on the last import attempt. Reconnect via OAuth to refresh your credentials.
              </p>
            </div>
          )}

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
                disabled={importRunning || connection?.status !== "connected"}
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
            {importResult && (
              <p className="mt-2 text-[12px] text-[var(--wk-success)]">{importResult}</p>
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
                      {run.rows_imported?.toLocaleString() ?? 0} rows · {run.rows_matched?.toLocaleString() ?? 0} matched
                      {run.rows_failed ? ` · ${run.rows_failed.toLocaleString()} failed` : ""}
                      {run.started_at && ` · ${new Date(run.started_at).toLocaleString()}`}
                    </p>
                    {run.error_message && (
                      <p className="text-[11px] text-[var(--wk-danger)] mt-0.5">{run.error_message}</p>
                    )}
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
            { label: "OAuth connection", status: "ready", note: "Server-side token exchange via gsc-oauth-callback Edge Function" },
            { label: "Property selection & import", status: "ready", note: "Real GSC API import via gsc-import-metrics Edge Function" },
            { label: "Query/page metrics", status: "ready", note: "Auto-refresh on token expiry, batch insert, audit logging" },
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