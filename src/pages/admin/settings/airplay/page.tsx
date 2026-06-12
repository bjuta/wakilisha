import { useState, useEffect } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import {
  getAirplaySettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_AIRPLAY_SETTINGS,
  type AirplaySettings,
} from "@/services/adminSettings/settingsTypes";

interface AirplaySourceRow {
  id: string;
  station_name: string;
  station_slug: string;
  country_code: string | null;
  market_slug: string | null;
  station_weight: number;
  enabled: boolean;
  source_type: string | null;
  metadata_json: Record<string, unknown> | null;
}

export default function AdminSettingsAirplay() {
  const [settings, setSettings] = useState<AirplaySettings>(getAirplaySettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    detectionCount: number;
    evidenceBucketCount: number;
    sourceCount: number;
    message: string;
  } | null>(null);
  const [stations, setStations] = useState<AirplaySourceRow[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [credStatus, setCredStatus] = useState<{
    acr: boolean;
    spotify: boolean;
    appleMusic: boolean;
  }>({ acr: false, spotify: false, appleMusic: false });

  const update = <K extends keyof AirplaySettings>(key: K, value: AirplaySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("airplay", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  // Load airplay stations from DB
  useEffect(() => {
    async function loadStations() {
      try {
        const { data } = await supabase
          .from("airplay_sources")
          .select("*")
          .order("station_name");
        setStations((data || []) as AirplaySourceRow[]);
      } catch {
        // Table might not be populated yet
      } finally {
        setStationsLoading(false);
      }
    }
    loadStations();
  }, []);

  // Check which credentials exist in admin_settings_secrets
  useEffect(() => {
    async function checkCreds() {
      try {
        const { data } = await supabase
          .from("admin_settings_secrets")
          .select("setting_key")
          .in("setting_key", [
            "acr_host", "acr_access_key", "acr_access_secret",
            "spotify_client_id", "spotify_client_secret",
            "apple_music_team_id", "apple_music_key_id",
          ]);
        const keys = new Set((data || []).map((r: { setting_key: string }) => r.setting_key));
        setCredStatus({
          acr: keys.has("acr_host") && keys.has("acr_access_key") && keys.has("acr_access_secret"),
          spotify: keys.has("spotify_client_id") && keys.has("spotify_client_secret"),
          appleMusic: keys.has("apple_music_team_id") && keys.has("apple_music_key_id"),
        });
      } catch {
        // ignore
      }
    }
    checkCreds();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data: detData } = await supabase
        .from("airplay_detections")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

      const { count: evCount } = await supabase
        .from("airplay_evidence_weekly")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

      const { count: srcCount } = await supabase
        .from("airplay_sources")
        .select("*", { count: "exact", head: true })
        .eq("enabled", true);

      const detectionCount = detData?.count || 0;

      setTestResult({
        ok: true,
        detectionCount,
        evidenceBucketCount: evCount || 0,
        sourceCount: srcCount || 0,
        message: detectionCount > 0
          ? `Pipeline active: ${detectionCount} detections this week across ${srcCount || 0} stations.`
          : `Pipeline ready. ${srcCount || 0} stations configured. Run an ingest with airplay enabled to populate detections.`,
      });
    } catch (e) {
      setTestResult({
        ok: false,
        detectionCount: 0,
        evidenceBucketCount: 0,
        sourceCount: 0,
        message: `Failed to query pipeline: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Radio" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Airplay</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          ACRCloud-powered airplay detection and evidence pipeline.
        </p>
      </div>

      {/* Credential Status Banner */}
      <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${credStatus.acr ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <WkIcon
          name={credStatus.acr ? "CheckCircle" : "AlertTriangle"}
          size={18}
          className={credStatus.acr ? "text-green-600 mt-0.5" : "text-amber-600 mt-0.5"}
        />
        <div>
          <h3 className="text-[13px] font-bold text-[var(--wk-text)]">
            {credStatus.acr ? "ACRCloud credentials configured" : "ACRCloud credentials needed"}
          </h3>
          <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">
            {credStatus.acr
              ? "ACRCloud API credentials are saved in Settings → Integrations. The pipeline is ready to fetch detections."
              : "Save your ACR_HOST, ACR_ACCESS_KEY, and ACR_ACCESS_SECRET in Settings → Integrations to enable live airplay detection."}
          </p>
          {!credStatus.acr && (
            <a href="/admin/settings/integrations" className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-[var(--wk-brand)] hover:underline">
              <WkIcon name="ExternalLink" size={12} /> Go to Integrations
            </a>
          )}
        </div>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Pipeline Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Enable Airplay in Scoring</label>
            <div className="flex items-center gap-3">
              <button onClick={() => update("enabled", !settings.enabled)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.enabled ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
              <span className="text-[13px] text-[var(--wk-text)]">{settings.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Market</label>
            <input type="text" value={settings.defaultMarket} onChange={(e) => update("defaultMarket", e.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Minimum Confidence Threshold</label>
            <input type="number" value={settings.minimumConfidenceThreshold} min={0} max={1} step={0.05} onChange={(e) => update("minimumConfidenceThreshold", Number(e.target.value))} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Auto-Link Detections to Registry</span>
            <button onClick={() => update("autoLinkDetections", !settings.autoLinkDetections)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.autoLinkDetections ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.autoLinkDetections ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </WkSurface>

      {/* Station List */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">
          Airplay Stations
          <span className="ml-2 text-[12px] font-normal text-[var(--wk-text-muted)]">
            ({stations.length} configured)
          </span>
        </h2>
        {stationsLoading ? (
          <div className="flex items-center gap-2 text-[13px] text-[var(--wk-text-muted)] py-4">
            <WkIcon name="Loader" size={14} className="animate-spin" /> Loading stations...
          </div>
        ) : stations.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-[var(--wk-text-muted)]">
            <WkIcon name="Radio" size={28} className="mx-auto mb-2 text-[var(--wk-text-faint)]" />
            <p>No airplay stations configured yet.</p>
            <p className="mt-1 text-[12px]">
              Add stations to the <code className="bg-[var(--wk-bg)] px-1 rounded">airplay_sources</code> table with ACRCloud stream IDs in metadata_json.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--wk-border)] text-left text-[12px] font-semibold text-[var(--wk-text-muted)]">
                  <th className="pb-2 pr-4">Station</th>
                  <th className="pb-2 pr-4">Slug</th>
                  <th className="pb-2 pr-4">Market</th>
                  <th className="pb-2 pr-4">Weight</th>
                  <th className="pb-2 pr-4">ACR Stream ID</th>
                  <th className="pb-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s) => {
                  const streamId = (s.metadata_json as Record<string, unknown> | null)?.acr_stream_id as string;
                  return (
                    <tr key={s.id} className="border-b border-[var(--wk-border)]/50">
                      <td className="py-2.5 pr-4 font-medium text-[var(--wk-text)]">{s.station_name}</td>
                      <td className="py-2.5 pr-4 text-[var(--wk-text-muted)]">{s.station_slug}</td>
                      <td className="py-2.5 pr-4 text-[var(--wk-text-muted)]">{s.market_slug || s.country_code || "—"}</td>
                      <td className="py-2.5 pr-4 text-[var(--wk-text-muted)]">{s.station_weight}</td>
                      <td className="py-2.5 pr-4">
                        {streamId ? (
                          <span className="inline-flex items-center gap-1 text-[var(--wk-text)]">
                            <WkIcon name="Check" size={12} className="text-green-500" />
                            <code className="text-[11px] bg-[var(--wk-bg)] px-1.5 py-0.5 rounded">{streamId}</code>
                          </span>
                        ) : (
                          <span className="text-[var(--wk-text-faint)] italic">Not set</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {s.enabled ? (
                          <span className="inline-flex items-center gap-1 text-[12px] text-green-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                          </span>
                        ) : (
                          <span className="text-[12px] text-[var(--wk-text-faint)]">Disabled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </WkSurface>

      {/* Pipeline Health Check */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Pipeline Health</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button onClick={handleSave} disabled={saving} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
            <WkIcon name={saving ? "Loader" : "Save"} size={14} /> {saving ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={handleTest} disabled={testing} className="wk-button wk-button-soft wk-button-sm flex items-center gap-2">
            <WkIcon name={testing ? "Loader" : "Activity"} size={14} /> {testing ? "Checking..." : "Check Pipeline"}
          </button>
          {saved && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-green-600"><WkIcon name="Check" size={14} /> Saved</span>}
        </div>
        {testResult && (
          <div className={`rounded-lg border px-4 py-3 ${testResult.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-start gap-2">
              <WkIcon
                name={testResult.ok ? "CheckCircle" : "AlertTriangle"}
                size={16}
                className={testResult.ok ? "text-green-600 mt-0.5" : "text-red-500 mt-0.5"}
              />
              <div className="text-[13px] text-[var(--wk-text)]">
                <p className="font-semibold">{testResult.ok ? "Pipeline Status" : "Pipeline Issue"}</p>
                <p className="mt-0.5">{testResult.message}</p>
                <div className="flex gap-4 mt-2 text-[12px] text-[var(--wk-text-muted)]">
                  <span>Stations: <strong>{testResult.sourceCount}</strong></span>
                  <span>Detections (7d): <strong>{testResult.detectionCount}</strong></span>
                  <span>Evidence buckets (7d): <strong>{testResult.evidenceBucketCount}</strong></span>
                </div>
              </div>
              <button onClick={() => setTestResult(null)} className="ml-auto text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">
                <WkIcon name="X" size={13} />
              </button>
            </div>
          </div>
        )}
      </WkSurface>

      {/* How it works */}
      <WkSurface className="p-5 border-l-4 border-[var(--wk-info)]">
        <div className="flex items-start gap-3">
          <WkIcon name="Info" size={18} className="text-[var(--wk-info)] mt-0.5" />
          <div>
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">How the airplay pipeline works</h3>
            <ol className="text-[12px] text-[var(--wk-text-muted)] mt-2 space-y-1 list-decimal list-inside">
              <li>ACRCloud credentials are saved in <strong>Settings → Integrations</strong> (ACR_HOST, ACR_ACCESS_KEY, ACR_ACCESS_SECRET)</li>
              <li>Airplay stations are configured in the <code className="bg-[var(--wk-bg)] px-1 rounded">airplay_sources</code> table with ACR stream IDs in <code className="bg-[var(--wk-bg)] px-1 rounded">metadata_json</code></li>
              <li>During ingest, the <strong>airplay_evidence</strong> stage calls ACRCloud with proper HMAC-SHA1 signing</li>
              <li>Results populate <code className="bg-[var(--wk-bg)] px-1 rounded">airplay_detections</code> and aggregate into <code className="bg-[var(--wk-bg)] px-1 rounded">airplay_evidence_weekly</code></li>
              <li>The scoring engine reads evidence buckets and applies the airplay formula (§4.7)</li>
            </ol>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}