import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  pingWordPress,
  discoverWordPress,
  generateMappings,
  createIngestionRun,
  stageIngestionRun,
  finalizeIngestionRun,
  type WpDiscoveryResult,
  type EntityMapping,
  type WizardRun,
  type TypeDiagnostic,
  testWordPressDatabase,
  stageWordPressDatabase,
  type WpDbCredentials,
  type WpDbTestResult,
  type WpDbStageResult,
  getExistingEntityCounts,
  createDatabaseRun,
} from "@/services/wordpressConnectService";
import { uploadZipAndCreateIngestionRun } from "@/services/migrationImportJobs";
import { supabase } from "@/lib/supabase";

type ImportMethod = "wordpress" | "database" | "zip";

type WizardStep = "welcome" | "connect" | "map" | "stage" | "finalize" | "complete" | "db-connect" | "db-stage" | "zip-upload" | "zip-done";

const STEPS: { id: WizardStep; number: string; label: string; sub: string }[] = [
  { id: "welcome", number: "0", label: "Start", sub: "Choose method" },
  { id: "connect", number: "1", label: "Connect", sub: "Find your site" },
  { id: "map", number: "2", label: "Map", sub: "Match entities" },
  { id: "stage", number: "3", label: "Stage", sub: "Import data" },
  { id: "finalize", number: "4", label: "Finalize", sub: "Publish" },
  { id: "complete", number: "✓", label: "Done", sub: "Summary" },
];

// ═══════════════════════════════════════════
// Discography Enrichment Panel
// ═══════════════════════════════════════════

type EnrichStats = {
  wp_artists: number;
  wp_releases: number;
  wp_tracks: number;
  wp_track_artists: number;
  wp_release_shell_artists: number;
  wp_release_shell_tracks: number;
  artists_enriched: number;
  releases_upserted: number;
  tracks_upserted: number;
  release_artists_upserted: number;
  release_tracks_upserted: number;
  errors: number;
  skipped_no_registry_match: number;
};

function DiscographyEnrichmentPanel() {
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(3306);
  const [user, setUser] = useState("bn_wordpress");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("bitnami_wordpress");
  const [prefix, setPrefix] = useState("wp_");
  const [running, setRunning] = useState(false);
  const [commit, setCommit] = useState(false);
  const [result, setResult] = useState<{ success: boolean; stats?: EnrichStats; log?: string[]; error?: string } | null>(null);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-artist-discography", {
        body: { credentials: { host, port, user, password, database, prefix }, commit },
      });
      if (error) { setResult({ success: false, error: error.message }); return; }
      setResult(data as { success: boolean; stats?: EnrichStats; log?: string[]; error?: string });
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setRunning(false);
    }
  }, [host, port, user, password, database, prefix, commit]);

  return (
    <WkSurface className="p-6 mt-8 border-2 border-primary-200">
      <div className="flex items-start gap-4 mb-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100">
          <i className="ri-music-2-line text-xl text-primary-600" />
        </div>
        <div>
          <h2 className="text-[16px] font-black text-wk-text">Enrich Artist Discographies from WordPress</h2>
          <p className="mt-1 text-[12px] text-wk-text-muted leading-5 max-w-2xl">
            Connects to WordPress MySQL database, reads <strong>wp_wkcharts_release_shells</strong>, <strong>wp_wkcharts_tracks</strong>, and artist/track relationships, then populates <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_releases</code>, <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_tracks</code>, <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_release_artists</code>, and <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_release_tracks</code>.
            Artist public profiles will automatically serve the richer discography once this runs.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Host</span>
          <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            placeholder="127.0.0.1" />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Port</span>
          <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Table Prefix</span>
          <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">User</span>
          <input type="text" value={user} onChange={(e) => setUser(e.target.value)}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Database</span>
          <input type="text" value={database} onChange={(e) => setDatabase(e.target.value)}
            className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={commit} onChange={(e) => setCommit(e.target.checked)}
            className="h-4 w-4 accent-primary-500 cursor-pointer" />
          <span className="text-[13px] font-semibold text-wk-text">Commit changes to database</span>
          {!commit && (
            <span className="rounded-full border border-wk-warning/30 bg-wk-warning-soft/50 px-2 py-0.5 text-[10px] font-bold text-wk-warning">
              Dry Run
            </span>
          )}
          {commit && (
            <span className="rounded-full border border-wk-danger/30 bg-wk-danger-soft/50 px-2 py-0.5 text-[10px] font-bold text-wk-danger">
              WRITES TO DB
            </span>
          )}
        </label>
        <button
          onClick={handleRun}
          disabled={running || !host || !user || !password || !database}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-[13px] font-bold text-white whitespace-nowrap hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? (
            <><i className="ri-loader-4-line animate-spin" /> {commit ? "Running enrichment..." : "Running dry run..."}</>
          ) : (
            <><i className="ri-play-circle-line" /> {commit ? "Run Enrichment" : "Preview (dry run)"}</>
          )}
        </button>
      </div>

      {result && (
        <div className={`mt-5 rounded-xl border p-5 ${result.success ? "border-wk-success/20 bg-wk-success-soft" : "border-wk-danger/20 bg-wk-danger-soft"}`}>
          <div className="flex items-center gap-2 mb-3">
            <WkIcon name={result.success ? "CheckCircle2" : "XCircle"} size={18} className={result.success ? "text-wk-success" : "text-wk-danger"} />
            <span className={`text-[14px] font-black ${result.success ? "text-wk-text" : "text-wk-danger"}`}>
              {result.success ? (commit ? "Enrichment complete" : "Dry run complete — no changes written") : "Enrichment failed"}
            </span>
          </div>
          {result.error && <p className="text-[12px] text-wk-danger mb-3">{result.error}</p>}
          {result.stats && (
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 mb-3">
              {[
                { label: "WP Artists", value: result.stats.wp_artists },
                { label: "WP Releases", value: result.stats.wp_releases },
                { label: "WP Tracks", value: result.stats.wp_tracks },
                { label: "Artists Enriched", value: result.stats.artists_enriched },
                { label: "Releases", value: result.stats.releases_upserted },
                { label: "Tracks", value: result.stats.tracks_upserted },
                { label: "Release-Artists", value: result.stats.release_artists_upserted },
                { label: "Release-Tracks", value: result.stats.release_tracks_upserted },
                { label: "No Match", value: result.stats.skipped_no_registry_match },
                { label: "Errors", value: result.stats.errors },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-white/30 bg-white/40 p-2.5">
                  <div className={`text-[17px] font-black ${s.label === "Errors" && s.value > 0 ? "text-wk-danger" : "text-wk-text"}`}>{s.value.toLocaleString()}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {result.log && result.log.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-bold text-wk-text-muted">View log ({result.log.length} lines)</summary>
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                {result.log.map((line, i) => (
                  <div key={i} className="text-[11px] font-mono text-wk-text-muted leading-5">{line}</div>
                ))}
              </div>
            </details>
          )}
          {result.success && !commit && (
            <div className="mt-3 rounded-lg border border-wk-warning/30 bg-wk-warning-soft/50 p-3">
              <p className="text-[12px] font-semibold text-wk-text">
                This was a dry run. Check the stats above, then tick <strong>"Commit changes"</strong> and run again to write to the database.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-wk-warning/20 bg-wk-warning-soft/30 p-3">
        <div className="flex items-start gap-2">
          <WkIcon name="AlertCircle" size={14} className="text-wk-warning shrink-0 mt-0.5" />
          <p className="text-[11px] leading-5 text-wk-text-muted">
            <strong>Note:</strong> The WordPress MySQL database is on <code className="font-mono bg-wk-bg-subtle px-1 rounded">localhost</code> of your Lightsail server.
            Supabase Edge Functions cannot reach localhost directly. For this to work, you need either:
            (a) an SSH tunnel exposing MySQL on a public IP,
            (b) a direct connection string from within the same network, or
            (c) run the CLI script <code className="font-mono bg-wk-bg-subtle px-1 rounded">stage-wordpress-database-records.ts</code> directly on the WP server instead.
            The credentials shown are the WP database credentials from your server.
          </p>
        </div>
      </div>
    </WkSurface>
  );
}

export default function AdminImportsPage() {
  const navigate = useNavigate();

  // Method selection
  const [method, setMethod] = useState<ImportMethod | null>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("welcome");
  const [siteUrl, setSiteUrl] = useState("https://wakilisha.africa");
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ accessible: boolean; message: string } | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<WpDiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = useState("");
  const [mappings, setMappings] = useState<EntityMapping[]>([]);
  const [staging, setStaging] = useState(false);
  const [run, setRun] = useState<WizardRun | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [stagingResult, setStagingResult] = useState<{ stats: Record<string, number>; entityCounts: Record<string, number>; draftCounts: Record<string, number>; typeDiagnostics: Record<string, TypeDiagnostic> } | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<{ summary: Record<string, number>; totalFinalized: number; skipped: number } | null>(null);
  const [existingCounts, setExistingCounts] = useState<Record<string, number> | null>(null);

  // Database connect state
  const [dbCredentials, setDbCredentials] = useState<WpDbCredentials>({
    host: "localhost", port: 3306, user: "", password: "", database: "", prefix: "wp_",
  });
  const [dbTesting, setDbTesting] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<WpDbTestResult | null>(null);
  const [dbStaging, setDbStaging] = useState(false);
  const [dbStageResult, setDbStageResult] = useState<WpDbStageResult | null>(null);

  // ZIP upload state
  const [zipUploading, setZipUploading] = useState(false);
  const [zipRun, setZipRun] = useState<{ id: string; status: string; source_name: string } | null>(null);
  const [zipError, setZipError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [draggingZip, setDraggingZip] = useState(false);

  useEffect(() => {
    getExistingEntityCounts().then(setExistingCounts).catch(() => {});
  }, []);

  const computedMappings = useMemo(() => {
    if (discovery && mappings.length === 0) {
      return generateMappings(discovery);
    }
    return mappings;
  }, [discovery, mappings]);

  const totalItems = useMemo(() => {
    if (!discovery) return 0;
    return Object.values(discovery.counts).reduce((sum, c) => sum + (typeof c === "number" ? c : 0), 0);
  }, [discovery]);

  const autoMatched = useMemo(() => computedMappings.filter((m) => m.status === "auto_matched").length, [computedMappings]);
  const needsReview = useMemo(() => computedMappings.filter((m) => m.status === "needs_review").length, [computedMappings]);

  // ---- WordPress Connect Actions ----
  const handlePing = useCallback(async () => {
    const trimmed = siteUrl.trim().replace(/\/+$/, "");
    if (!trimmed) return;
    setPinging(true);
    setPingResult(null);
    setDiscoveryError("");
    try {
      const result = await pingWordPress(trimmed);
      setPingResult({ accessible: result.accessible, message: result.message });
      if (result.accessible) {
        setDiscovering(true);
        try {
          const disc = await discoverWordPress(trimmed);
          setDiscovery(disc);
          setMappings(generateMappings(disc));
        } catch (err) {
          setDiscoveryError(err instanceof Error ? err.message : "Discovery failed.");
        } finally {
          setDiscovering(false);
        }
      }
    } catch (err) {
      setPingResult({ accessible: false, message: err instanceof Error ? err.message : "Connection failed." });
    } finally {
      setPinging(false);
    }
  }, [siteUrl]);

  const toggleMapping = useCallback((id: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: m.status === "ignored" ? "auto_matched" : m.status === "auto_matched" ? "ignored" : "auto_matched" }
          : m,
      ),
    );
  }, []);

  const handleStage = useCallback(async () => {
    if (!discovery) return;
    setStaging(true);
    try {
      const newRun = await createIngestionRun(siteUrl.trim().replace(/\/+$/, ""), discovery, computedMappings);
      setRun(newRun);
      const result = await stageIngestionRun(newRun.id);
      setRun((prev) => prev ? { ...prev, status: "staged", imported_counts: result.entityCounts } : prev);
      setStagingResult(result);
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Staging failed.");
    } finally {
      setStaging(false);
    }
  }, [discovery, siteUrl, computedMappings]);

  const handleFinalize = useCallback(async () => {
    if (!run) return;
    setFinalizing(true);
    try {
      const result = await finalizeIngestionRun(run.id);
      setFinalizeResult(result);
      setFinalized(true);
      setStep("complete");
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Finalize failed.");
    } finally {
      setFinalizing(false);
    }
  }, [run]);

  // ---- Database Connect Actions ----
  const handleDbTest = useCallback(async () => {
    setDbTesting(true);
    setDbTestResult(null);
    setDiscoveryError("");
    try {
      const result = await testWordPressDatabase(dbCredentials);
      setDbTestResult(result);
    } catch (err) {
      setDbTestResult({ success: false, accessible: false, message: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setDbTesting(false);
    }
  }, [dbCredentials]);

  const handleDbStage = useCallback(async () => {
    setDbStaging(true);
    try {
      const result = await stageWordPressDatabase(dbCredentials);
      setDbStageResult(result);
      setRun({ id: result.runId, source_name: `${dbCredentials.host}/${dbCredentials.database}`, source_kind: "wordpress_database", status: "staged", source_manifest: null, created_at: new Date().toISOString(), imported_counts: result.entityCounts });
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Database staging failed.");
    } finally {
      setDbStaging(false);
    }
  }, [dbCredentials]);

  // ---- ZIP Upload Actions ----
  const handleZipUpload = useCallback(async (file: File) => {
    setZipFile(file);
    setZipUploading(true);
    setZipError("");
    try {
      const created = await uploadZipAndCreateIngestionRun(file);
      setZipRun(created);
      setStep("zip-done");
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setZipUploading(false);
    }
  }, []);

  const onDropZip = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingZip(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".zip")) {
      handleZipUpload(file);
    } else {
      setZipError("Only .zip files are accepted.");
    }
  }, [handleZipUpload]);

  // ---- Method selection ----
  const handleChooseMethod = useCallback((m: ImportMethod) => {
    setMethod(m);
    if (m === "wordpress") {
      setStep("connect");
    } else if (m === "database") {
      setStep("db-connect");
    } else {
      setStep("zip-upload");
    }
  }, []);

  // ---- Step progression ----
  const canProceedToMap = discovery !== null && !discovering;
  const canProceedToStage = computedMappings.filter((m) => m.status === "auto_matched").length > 0;
  const canProceedToFinalize = run !== null && run.status === "staged";
  const canDbStage = dbTestResult?.accessible ?? false;

  const wizardSteps = method === "wordpress" ? STEPS.filter((s) => s.id !== "zip-upload" && s.id !== "zip-done" && s.id !== "db-connect" && s.id !== "db-stage") :
                     method === "database" ? STEPS.filter((s) => s.id !== "zip-upload" && s.id !== "zip-done" && s.id !== "connect" && s.id !== "map") :
                     STEPS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">WordPress Import</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-6 text-wk-text-muted">
            One-time migration from wakilisha.africa. Connect to your live WordPress site, use the database directly, or upload a ZIP export as fallback.
          </p>
        </div>
        <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="List" size={14} /> View Past Jobs
        </button>
      </div>

      {/* Step Indicator (only for WordPress flow) */}
      {(method === "wordpress" || method === "database") && step !== "welcome" && (
        <WkSurface className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            {wizardSteps.filter(s => s.id !== "welcome").map((s, i, arr) => {
              const isActive = step === s.id || (method === "database" && step === "db-connect" && s.id === "connect") || (method === "database" && step === "db-stage" && s.id === "stage");
              const isDone = (step === "complete" || (step === "finalize" && s.id !== "complete" && s.id !== "finalize") || (step === "stage" && s.id === "connect") || (step === "map" && s.id === "connect") || (method === "database" && step === "db-stage" && s.id === "connect") || (method === "database" && step === "finalize" && s.id === "stage"));
              const canClick = s.id === "connect" || (s.id === "map" && canProceedToMap) || (s.id === "stage" && canProceedToStage) || (s.id === "finalize" && canProceedToFinalize);
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (canClick) setStep(s.id);
                    }}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all ${
                      isActive
                        ? "border-wk-brand bg-wk-brand-soft"
                        : isDone
                        ? "border-wk-success/30 bg-wk-success-soft cursor-pointer hover:border-wk-success/50"
                        : canClick
                        ? "border-wk-border bg-wk-bg-subtle cursor-pointer hover:border-wk-border-2"
                        : "border-wk-border bg-wk-bg-subtle opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black ${
                      isActive ? "bg-wk-brand text-black" : isDone ? "bg-wk-success/20 text-wk-success" : "bg-wk-surface-raised text-wk-text-muted"
                    }`}>
                      {isDone ? <WkIcon name="Check" size={12} /> : s.number}
                    </span>
                    <div className="text-left">
                      <div className="text-[12px] font-black text-wk-text">{s.label}</div>
                      <div className="text-[10px] text-wk-text-muted">{s.sub}</div>
                    </div>
                  </button>
                  {i < arr.length - 1 && (
                    <div className={`h-px w-6 ${isDone ? "bg-wk-success" : "bg-wk-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </WkSurface>
      )}

      {/* Step Content */}
      {step === "welcome" && <WelcomeStep onChoose={handleChooseMethod} existingCounts={existingCounts} />}

      {step === "connect" && (
        <ConnectStep
          siteUrl={siteUrl}
          setSiteUrl={setSiteUrl}
          pinging={pinging}
          pingResult={pingResult}
          discovering={discovering}
          discovery={discovery}
          discoveryError={discoveryError}
          onPing={handlePing}
          onContinue={() => setStep("map")}
          canContinue={canProceedToMap}
          onBack={() => setStep("welcome")}
          existingCounts={existingCounts}
        />
      )}

      {step === "map" && discovery && (
        <MapStep
          discovery={discovery}
          mappings={computedMappings}
          totalItems={totalItems}
          autoMatched={autoMatched}
          needsReview={needsReview}
          onToggle={toggleMapping}
          onBack={() => setStep("connect")}
          onContinue={() => setStep("stage")}
          canContinue={canProceedToStage}
        />
      )}

      {step === "stage" && discovery && (
        <StageStep
          discovery={discovery}
          mappings={computedMappings.filter((m) => m.status === "auto_matched")}
          totalItems={totalItems}
          staging={staging}
          run={run}
          stagingResult={stagingResult}
          onStage={handleStage}
          onBack={() => setStep("map")}
          onContinue={() => setStep("finalize")}
          canContinue={canProceedToFinalize}
        />
      )}

      {step === "finalize" && run && (
        <FinalizeStep
          run={run}
          discovery={discovery}
          mappings={computedMappings.filter((m) => m.status === "auto_matched")}
          totalItems={totalItems}
          finalizing={finalizing}
          onFinalize={handleFinalize}
          onBack={() => setStep("stage")}
        />
      )}

      {step === "complete" && run && (
        <CompleteStep
          run={run}
          mappings={computedMappings.filter((m) => m.status === "auto_matched")}
          finalizeResult={finalizeResult}
          stagingResult={stagingResult}
        />
      )}

      {step === "db-connect" && (
        <DbConnectStep
          credentials={dbCredentials}
          setCredentials={setDbCredentials}
          testing={dbTesting}
          testResult={dbTestResult}
          onTest={handleDbTest}
          onStage={handleDbStage}
          staging={dbStaging}
          stageResult={dbStageResult}
          onContinue={() => setStep("finalize")}
          canContinue={canProceedToFinalize}
          onBack={() => setStep("welcome")}
        />
      )}

      {step === "db-stage" && (
        <DbStageStep
          credentials={dbCredentials}
          stageResult={dbStageResult}
          onStage={handleDbStage}
          staging={dbStaging}
          onContinue={() => setStep("finalize")}
          canContinue={canProceedToFinalize}
          onBack={() => setStep("db-connect")}
        />
      )}

      {step === "zip-upload" && (
        <ZipUploadStep
          zipUploading={zipUploading}
          zipError={zipError}
          zipFile={zipFile}
          draggingZip={draggingZip}
          fileInputRef={fileInputRef}
          setDraggingZip={setDraggingZip}
          onDrop={onDropZip}
          onFileSelect={(e) => {
            const file = e.target.files?.[0];
            if (file?.name.endsWith(".zip")) {
              handleZipUpload(file);
            } else {
              setZipError("Only .zip files are accepted.");
            }
            e.target.value = "";
          }}
          onBack={() => { setStep("welcome"); setMethod(null); }}
        />
      )}

      {step === "zip-done" && zipRun && (
        <ZipDoneStep zipRun={zipRun} zipFile={zipFile} />
      )}

      {/* Discography enrichment — always visible */}
      <DiscographyEnrichmentPanel />
    </div>
  );
}

// ═══════════════════════════════════════════
// Step 0: Welcome — choose import method
// ═══════════════════════════════════════════

function WelcomeStep({ onChoose, existingCounts }: { onChoose: (m: ImportMethod) => void; existingCounts: Record<string, number> | null }) {
  return (
    <div className="space-y-5">
      {/* Existing data notice */}
      {existingCounts && Object.values(existingCounts).some(c => c > 0) && (
        <WkSurface className="p-4 border-wk-success/20 bg-wk-success-soft/30">
          <div className="flex items-start gap-2">
            <WkIcon name="CheckCircle2" size={15} className="text-wk-success shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold text-wk-text">Database already has data</p>
              <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
                {existingCounts.tracks > 0 && <span>{existingCounts.tracks.toLocaleString()} tracks</span>}
                {existingCounts.artists > 0 && <span> · {existingCounts.artists.toLocaleString()} artists</span>}
                {existingCounts.releases > 0 && <span> · {existingCounts.releases.toLocaleString()} releases</span>}
                {existingCounts.labels > 0 && <span> · {existingCounts.labels.toLocaleString()} labels</span>}
                {existingCounts.genres > 0 && <span> · {existingCounts.genres.toLocaleString()} genres</span>}
                {existingCounts.articles > 0 && <span> · {existingCounts.articles.toLocaleString()} articles</span>}
                <span> already in database. The import will only add missing content.</span>
              </p>
            </div>
          </div>
        </WkSurface>
      )}

      <div className="grid gap-4 lg:grid-cols-3 max-w-4xl">
        {/* Primary: Connect to WordPress REST API */}
        <WkSurface className="p-6 text-center border-2 border-wk-brand/20 bg-wk-brand-soft/10 hover:border-wk-brand/40 transition-all cursor-pointer" onClick={() => onChoose("wordpress")}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-brand-soft">
            <WkIcon name="Link" size={28} className="text-wk-brand" />
          </div>
          <h2 className="text-[16px] font-black text-wk-text">Connect to WordPress</h2>
          <p className="mt-2 text-[12px] text-wk-text-muted leading-5">
            Enter your wakilisha.africa URL. We&apos;ll auto-discover all content, map entities, and stage records.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-wk-brand/30 bg-wk-brand-soft/50 px-3 py-1.5 text-[11px] font-bold text-wk-brand">
            For most content
          </div>
        </WkSurface>

        {/* Secondary: Connect to WordPress Database */}
        <WkSurface className="p-6 text-center border-2 border-wk-accent/20 bg-wk-accent-soft/10 hover:border-wk-accent/40 transition-all cursor-pointer" onClick={() => onChoose("database")}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-accent-soft">
            <WkIcon name="Database" size={28} className="text-wk-accent" />
          </div>
          <h2 className="text-[16px] font-black text-wk-text">Connect to Database</h2>
          <p className="mt-2 text-[12px] text-wk-text-muted leading-5">
            Connect directly to the WordPress MySQL database. Best for importing all tracks, releases, and postmeta.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-wk-accent/30 bg-wk-accent-soft/50 px-3 py-1.5 text-[11px] font-bold text-wk-accent">
            For all data
          </div>
        </WkSurface>

        {/* Tertiary: Upload ZIP */}
        <WkSurface className="p-6 text-center border border-wk-border bg-wk-bg-subtle hover:border-wk-border-2 transition-all cursor-pointer" onClick={() => onChoose("zip")}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-surface-raised">
            <WkIcon name="FileUp" size={24} className="text-wk-text-muted" />
          </div>
          <h2 className="text-[16px] font-black text-wk-text">Upload ZIP Export</h2>
          <p className="mt-2 text-[12px] text-wk-text-muted leading-5">
            If the site is down or inaccessible, upload a WordPress export ZIP archive instead.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-wk-border bg-wk-surface-raised px-3 py-1.5 text-[11px] font-semibold text-wk-text-muted">
            Fallback option
          </div>
        </WkSurface>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Step 1: Connect — enter URL & discover
// ═══════════════════════════════════════════

function ConnectStep({
  siteUrl, setSiteUrl, pinging, pingResult, discovering, discovery, discoveryError, onPing, onContinue, canContinue, onBack, existingCounts,
}: {
  siteUrl: string;
  setSiteUrl: (v: string) => void;
  pinging: boolean;
  pingResult: { accessible: boolean; message: string } | null;
  discovering: boolean;
  discovery: WpDiscoveryResult | null;
  discoveryError: string;
  onPing: () => void;
  onContinue: () => void;
  canContinue: boolean;
  onBack: () => void;
  existingCounts: Record<string, number> | null;
}) {
  const counts = discovery?.counts ?? {};
  const postTypes = discovery?.postTypes ?? {};
  const taxonomies = discovery?.taxonomies ?? {};
  const samples = discovery?.samples ?? {};
  const countEntries = Object.entries(counts).filter(([, c]) => (typeof c === "number" ? c : 0) > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <WkSurface className="p-6">
        <h2 className="text-[16px] font-black text-wk-text mb-4">Enter your WordPress site</h2>
        <label className="block">
          <span className="text-[12px] font-bold text-wk-text">Site URL</span>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onPing(); }}
              placeholder="https://wakilisha.africa"
              className="flex-1 rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand placeholder:text-wk-text-faint"
              disabled={pinging || discovering}
            />
            <button
              onClick={onPing}
              disabled={pinging || discovering || !siteUrl.trim()}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              {pinging ? (
                <><WkIcon name="Loader2" size={14} className="animate-spin" /> Testing...</>
              ) : discovering ? (
                <><WkIcon name="Loader2" size={14} className="animate-spin" /> Scanning...</>
              ) : (
                <><WkIcon name="Search" size={14} /> Connect</>
              )}
            </button>
          </div>
        </label>

        {pingResult && (
          <div className={`mt-4 rounded-xl border p-4 ${pingResult.accessible ? "border-wk-success/20 bg-wk-success-soft" : "border-wk-danger/20 bg-wk-danger-soft"}`}>
            <div className="flex items-center gap-2">
              <WkIcon name={pingResult.accessible ? "CheckCircle2" : "XCircle"} size={18} className={pingResult.accessible ? "text-wk-success" : "text-wk-danger"} />
              <span className={`text-[13px] font-semibold ${pingResult.accessible ? "text-wk-success" : "text-wk-danger"}`}>
                {pingResult.accessible ? "Connected" : "Connection failed"}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{pingResult.message}</p>
          </div>
        )}

        {discoveryError && (
          <div className="mt-4 rounded-xl border border-wk-danger/20 bg-wk-danger-soft p-4">
            <div className="flex items-center gap-2">
              <WkIcon name="AlertCircle" size={16} className="text-wk-danger" />
              <span className="text-[13px] font-semibold text-wk-danger">Discovery error</span>
            </div>
            <p className="mt-1 text-[12px] text-wk-danger">{discoveryError}</p>
          </div>
        )}

        {discovering && !discovery && (
          <div className="mt-6 space-y-3">
            <div className="text-[13px] font-semibold text-wk-text">Discovering content...</div>
            {["posts", "pages", "media", "taxonomies", "users"].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-wk-brand animate-pulse" />
                <span className="text-[12px] text-wk-text-muted capitalize">Checking {item}...</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={onBack} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="ArrowLeft" size={14} /> Back
          </button>
          {canContinue && (
            <button onClick={onContinue} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
              Continue to mapping <WkIcon name="ArrowRight" size={14} />
            </button>
          )}
        </div>
      </WkSurface>

      {discovery && (
        <div className="space-y-5">
          {/* Data already imported notice */}
          {existingCounts && Object.values(existingCounts).some(c => c > 0) && (
            <WkSurface className="p-4 border-wk-success/20 bg-wk-success-soft/20">
              <div className="flex items-start gap-2">
                <WkIcon name="CheckCircle2" size={15} className="text-wk-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-wk-text">Data already imported</p>
                  <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
                    {existingCounts.tracks > 0 && <span>{existingCounts.tracks.toLocaleString()} tracks</span>}
                    {existingCounts.artists > 0 && <span> · {existingCounts.artists.toLocaleString()} artists</span>}
                    {existingCounts.releases > 0 && <span> · {existingCounts.releases.toLocaleString()} releases</span>}
                    {existingCounts.labels > 0 && <span> · {existingCounts.labels.toLocaleString()} labels</span>}
                    {existingCounts.genres > 0 && <span> · {existingCounts.genres.toLocaleString()} genres</span>}
                    {existingCounts.articles > 0 && <span> · {existingCounts.articles.toLocaleString()} articles</span>}
                    <span> already exist. This import will only add remaining content.</span>
                  </p>
                </div>
              </div>
            </WkSurface>
          )}

          {/* REST API limitation notice */}
          <WkSurface className="p-4 border-wk-warning/20 bg-wk-warning-soft/20">
            <div className="flex items-start gap-2">
              <WkIcon name="Info" size={15} className="text-wk-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-wk-text">REST API Limitations</p>
                <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
                  The REST API only shows content stored as individual posts. Tracks, releases, and labels may be stored in postmeta and show low counts. For the full dataset, use <strong>Connect to Database</strong> instead.
                </p>
              </div>
            </div>
          </WkSurface>

          <WkSurface className="p-5">
            <h3 className="text-[14px] font-bold text-wk-text mb-3">Discovered Content</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {countEntries.length > 0 ? countEntries.map(([key, count]) => (
                <div key={key} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[18px] font-black text-wk-text">{Number(count).toLocaleString()}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{postTypes[key]?.name || key}</div>
                </div>
              )) : (
                <p className="col-span-3 text-[13px] text-wk-text-muted">No content types found.</p>
              )}
            </div>
          </WkSurface>

          {Object.keys(taxonomies).length > 0 && (
            <WkSurface className="p-5">
              <h3 className="text-[14px] font-bold text-wk-text mb-3">Taxonomies</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(taxonomies).map(([slug, info]) => (
                  <span key={slug} className="rounded-full border border-wk-border bg-wk-bg-subtle px-3 py-1.5 text-[12px] font-semibold text-wk-text">
                    {info.name}
                    <span className="ml-1.5 text-[10px] text-wk-text-muted">({slug})</span>
                  </span>
                ))}
              </div>
            </WkSurface>
          )}

          {Object.keys(samples).length > 0 && (
            <WkSurface className="p-5">
              <h3 className="text-[14px] font-bold text-wk-text mb-3">Sample Content</h3>
              <div className="space-y-2 max-h-[260px] overflow-auto">
                {Object.entries(samples).slice(0, 4).map(([type, items]) => (
                  <details key={type} className="rounded-lg border border-wk-border bg-wk-bg-subtle">
                    <summary className="cursor-pointer p-3 text-[12px] font-bold text-wk-text uppercase">{type} ({items.length} samples)</summary>
                    <div className="border-t border-wk-border px-3 py-2 space-y-1.5">
                      {items.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-[11px] text-wk-text-muted truncate">
                          #{item.id} — {item.title || item.name || "(untitled)"}
                          {item.slug && <span className="text-wk-text-faint"> /{item.slug}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </WkSurface>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// DB Connect Step
// ═══════════════════════════════════════════

function DbConnectStep({
  credentials, setCredentials, testing, testResult, onTest, onStage, staging, stageResult, onContinue, canContinue, onBack,
}: {
  credentials: WpDbCredentials;
  setCredentials: (c: WpDbCredentials) => void;
  testing: boolean;
  testResult: WpDbTestResult | null;
  onTest: () => void;
  onStage: () => void;
  staging: boolean;
  stageResult: WpDbStageResult | null;
  onContinue: () => void;
  canContinue: boolean;
  onBack: () => void;
}) {
  const isLocalhost = credentials.host === "localhost" || credentials.host === "127.0.0.1";
  const localhostFailed = isLocalhost && testResult && !testResult.accessible;
  const [cliRun, setCliRun] = useState<{ runId: string } | null>(null);
  const [cliCreating, setCliCreating] = useState(false);
  const [cliError, setCliError] = useState("");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const update = (field: keyof WpDbCredentials, value: string | number) =>
    setCredentials({ ...credentials, [field]: value });

  const handleCreateCliRun = useCallback(async () => {
    setCliCreating(true);
    setCliError("");
    try {
      const result = await createDatabaseRun(credentials);
      setCliRun({ runId: result.runId });
    } catch (err) {
      setCliError(err instanceof Error ? err.message : "Failed to create run.");
    } finally {
      setCliCreating(false);
    }
  }, [credentials]);

  const cliCommand = useMemo(() => {
    if (!cliRun) return null;
    const dbUrl = databaseUrl.trim() || "<your-supabase-connection-string>";
    return `export WP_DB_HOST="${credentials.host}"
export WP_DB_PORT="${credentials.port}"
export WP_DB_USER="${credentials.user}"
export WP_DB_PASSWORD="${credentials.password}"
export WP_DB_NAME="${credentials.database}"
export WP_DB_PREFIX="${credentials.prefix}"
export DATABASE_URL="${dbUrl}"

node /home/bitnami/wk-import/stage.mjs --job ${cliRun.runId}`;
  }, [cliRun, credentials, databaseUrl]);

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <WkSurface className="p-6">
        <h2 className="text-[16px] font-black text-wk-text mb-4">Connect to WordPress Database</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12px] font-bold text-wk-text">Host</span>
            <input
              type="text"
              value={credentials.host}
              onChange={(e) => update("host", e.target.value)}
              className="mt-1 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              placeholder="localhost"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-bold text-wk-text">Port</span>
              <input
                type="number"
                value={credentials.port}
                onChange={(e) => update("port", Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-wk-text">Table Prefix</span>
              <input
                type="text"
                value={credentials.prefix}
                onChange={(e) => update("prefix", e.target.value)}
                className="mt-1 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[12px] font-bold text-wk-text">User</span>
            <input
              type="text"
              value={credentials.user}
              onChange={(e) => update("user", e.target.value)}
              className="mt-1 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-wk-text">Password</span>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => update("password", e.target.value)}
              className="mt-1 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-wk-text">Database Name</span>
            <input
              type="text"
              value={credentials.database}
              onChange={(e) => update("database", e.target.value)}
              className="mt-1 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            />
          </label>
        </div>

        <button
          onClick={onTest}
          disabled={testing || !credentials.host || !credentials.user || !credentials.password || !credentials.database}
          className="wk-button wk-button-primary wk-button-sm mt-4 w-full whitespace-nowrap"
        >
          {testing ? (
            <><WkIcon name="Loader2" size={14} className="animate-spin" /> Testing...</>
          ) : (
            <><WkIcon name="Database" size={14} /> Test Connection</>
          )}
        </button>

        {testResult && (
          <div className={`mt-4 rounded-xl border p-4 ${testResult.accessible ? "border-wk-success/20 bg-wk-success-soft" : "border-wk-danger/20 bg-wk-danger-soft"}`}>
            <div className="flex items-center gap-2">
              <WkIcon name={testResult.accessible ? "CheckCircle2" : "XCircle"} size={18} className={testResult.accessible ? "text-wk-success" : "text-wk-danger"} />
              <span className={`text-[13px] font-semibold ${testResult.accessible ? "text-wk-success" : "text-wk-danger"}`}>
                {testResult.accessible ? "Connected" : "Connection failed"}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{testResult.message}</p>
            {testResult.error && <p className="mt-1 text-[12px] text-wk-danger">{testResult.error}</p>}
          </div>
        )}

        {localhostFailed && (
          <div className="mt-4 rounded-xl border-2 border-wk-warning/40 bg-wk-warning-soft p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wk-warning/20">
                <WkIcon name="AlertCircle" size={20} className="text-wk-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-black text-wk-text">Can&apos;t reach localhost from the cloud</p>
                <p className="mt-1.5 text-[12px] leading-5 text-wk-text-muted">
                  Your database is on <strong>localhost</strong> inside your WordPress Lightsail instance. The edge function runs on Supabase&apos;s servers — they&apos;re on completely different networks. <strong>localhost means the same machine</strong>, and from Supabase that&apos;s not your WordPress box.
                </p>
                <div className="mt-3 rounded-lg border border-wk-warning/30 bg-white/60 p-3">
                  <p className="text-[11px] font-bold text-wk-text mb-2">Your options:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-wk-brand/15 text-[10px] font-black text-wk-brand mt-0.5">1</span>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-wk-text">Run the CLI on the WordPress server</p>
                        <p className="mt-0.5 text-[11px] text-wk-text-muted">SSH into your Lightsail instance and run the staging script directly — it talks to localhost MySQL with zero network issues.</p>
                        {!cliRun && (
                          <div className="mt-2 space-y-2">
                            <label className="block">
                              <span className="text-[11px] font-bold text-wk-text">Supabase DATABASE_URL (pooler)</span>
                              <input
                                type="text"
                                value={databaseUrl}
                                onChange={(e) => setDatabaseUrl(e.target.value)}
                                placeholder="postgresql://postgres.xxx:password@aws-1-eu-west-2.pooler.supabase.com:5432/postgres"
                                className="mt-1 w-full rounded-lg border border-wk-border bg-white px-3 py-2 text-[12px] font-mono text-wk-text outline-none focus:border-wk-brand placeholder:text-wk-text-faint"
                              />
                              <p className="mt-0.5 text-[10px] text-wk-text-muted">Paste your Supabase pooler connection string. Stays local — never sent anywhere.</p>
                            </label>
                            <button
                              onClick={handleCreateCliRun}
                              disabled={cliCreating || !credentials.host || !credentials.user || !credentials.password || !credentials.database}
                              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
                            >
                              {cliCreating ? (
                                <><WkIcon name="Loader2" size={14} className="animate-spin" /> Creating run...</>
                              ) : (
                                <><WkIcon name="Terminal" size={14} /> Create Run &amp; Get Command</>
                              )}
                            </button>
                          </div>
                        )}
                        {cliRun && cliCommand && (
                          <div className="mt-2 space-y-2">
                            <div className="rounded-lg border border-wk-success/30 bg-wk-success-soft p-3">
                              <p className="text-[11px] font-bold text-wk-success mb-1">Run ID created: {cliRun.runId}</p>
                              <p className="text-[11px] text-wk-text-muted">Copy this command and run it on your WordPress server via SSH.</p>
                            </div>
                            <div className="relative">
                              <pre className="text-[11px] font-mono text-wk-text bg-wk-bg-subtle p-3 rounded-lg border border-wk-border overflow-x-auto select-all">{cliCommand}</pre>
                              <button
                                onClick={() => navigator.clipboard.writeText(cliCommand)}
                                className="absolute top-2 right-2 wk-button wk-button-ghost wk-button-xs"
                              >
                                <WkIcon name="Copy" size={12} /> Copy
                              </button>
                            </div>
                            {!databaseUrl.trim() && (
                              <p className="text-[11px] text-wk-text-muted">
                                <strong>Important:</strong> Set your <code className="text-[10px] font-mono bg-wk-bg-subtle px-1 py-0.5 rounded">DATABASE_URL</code> above to your Supabase pooler connection string so the script can write staged records back.
                              </p>
                            )}
                          </div>
                        )}
                        {cliError && (
                          <div className="mt-2 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-2.5">
                            <p className="text-[11px] text-wk-danger">{cliError}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-wk-accent/15 text-[10px] font-black text-wk-accent mt-0.5">2</span>
                      <div>
                        <p className="text-[12px] font-semibold text-wk-text">Use the WordPress REST API instead</p>
                        <p className="mt-0.5 text-[11px] text-wk-text-muted">Go back and choose <strong>Connect to WordPress</strong> — it works over HTTP from anywhere and doesn&apos;t need direct database access.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-wk-text-faint/15 text-[10px] font-black text-wk-text-muted mt-0.5">3</span>
                      <div>
                        <p className="text-[12px] font-semibold text-wk-text">Expose MySQL with an SSH tunnel</p>
                        <p className="mt-0.5 text-[11px] text-wk-text-muted">Create a reverse SSH tunnel from a public server to your Lightsail MySQL port, then enter that public host here. Advanced — only if you really need the DB connector UI.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLocalhost && testResult?.accessible && null}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={onBack} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="ArrowLeft" size={14} /> Back
          </button>
          {testResult?.accessible && !isLocalhost && (
            <button onClick={onStage} disabled={staging} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
              {staging ? (
                <><WkIcon name="Loader2" size={14} className="animate-spin" /> Staging...</>
              ) : (
                <><WkIcon name="Play" size={14} /> Stage Now</>
              )}
            </button>
          )}
          {stageResult && (
            <button onClick={onContinue} disabled={!canContinue} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
              Continue to finalize <WkIcon name="ArrowRight" size={14} />
            </button>
          )}
        </div>
      </WkSurface>

      {testResult?.scan && (
        <div className="space-y-5">
          <WkSurface className="p-5">
            <h3 className="text-[14px] font-bold text-wk-text mb-3">Database Tables</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(testResult.scan.counts).map(([key, count]) => (
                <div key={key} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[18px] font-black text-wk-text">{Number(count).toLocaleString()}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{key}</div>
                </div>
              ))}
            </div>
          </WkSurface>

          <WkSurface className="p-5">
            <h3 className="text-[14px] font-bold text-wk-text mb-3">Post Types</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(testResult.scan.postTypeCounts).map(([key, count]) => (
                <div key={key} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[18px] font-black text-wk-text">{Number(count).toLocaleString()}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{key}</div>
                </div>
              ))}
            </div>
          </WkSurface>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// DB Stage Step
// ═══════════════════════════════════════════

function DbStageStep({
  credentials, stageResult, onStage, staging, onContinue, canContinue, onBack,
}: {
  credentials: WpDbCredentials;
  stageResult: WpDbStageResult | null;
  onStage: () => void;
  staging: boolean;
  onContinue: () => void;
  canContinue: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <h3 className="text-[14px] font-bold text-wk-text mb-3">Database Staging</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Host" value={0} customDisplay={<span className="text-[12px] font-mono text-wk-text">{credentials.host}</span>} />
          <Metric label="Database" value={0} customDisplay={<span className="text-[12px] text-wk-text">{credentials.database}</span>} />
          <Metric label="Prefix" value={0} customDisplay={<span className="text-[12px] font-mono text-wk-text">{credentials.prefix}</span>} />
        </div>
      </WkSurface>

      {!stageResult && (
        <WkSurface className="border-2 border-dashed border-wk-brand/30 bg-wk-brand-soft/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-brand-soft">
            <WkIcon name={staging ? "Loader2" : "Database"} size={28} className={staging ? "animate-spin text-wk-brand" : "text-wk-brand"} />
          </div>
          <h3 className="text-[16px] font-black text-wk-text">{staging ? "Staging from database..." : "Ready to stage"}</h3>
          <p className="mt-2 text-[13px] text-wk-text-muted max-w-md mx-auto">
            {staging ? "Fetching data from MySQL database and staging records..." : "This connects directly to the MySQL database and stages all records."}
          </p>
          {!staging && (
            <button onClick={onStage} className="wk-button wk-button-primary wk-button-sm mt-5 whitespace-nowrap">
              <WkIcon name="Play" size={14} /> Stage Now
            </button>
          )}
        </WkSurface>
      )}

      {stageResult && (
        <WkSurface className="border-wk-success/20 bg-wk-success-soft p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wk-success/20">
              <WkIcon name="CheckCircle2" size={20} className="text-wk-success" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-black text-wk-text">Staging Complete</h3>
              <p className="mt-1 text-[13px] text-wk-text-muted">
                Run <span className="font-mono text-wk-text">{stageResult.runId.slice(0, 8)}...</span> staged with {stageResult.stats.total} records.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Metric label="Total Staged" value={stageResult.stats.total} />
                <Metric label="Ready" value={stageResult.stats.ready} />
                <Metric label="Needs Review" value={stageResult.stats.needs_review} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Metric label="Drafts" value={stageResult.stats.drafts} />
                <Metric label="Blocked" value={stageResult.stats.blocked} />
                <Metric label="Failed" value={stageResult.stats.failed} />
              </div>
              {Object.keys(stageResult.entityCounts).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(stageResult.entityCounts).map(([entity, count]) => (
                    <span key={entity} className="rounded-full border border-wk-success/20 bg-white/50 px-2 py-0.5 text-[10px] font-semibold text-wk-text">
                      {entity}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </WkSurface>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onBack} disabled={staging} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} /> Back
        </button>
        {stageResult && (
          <button onClick={onContinue} disabled={!canContinue} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            Continue to finalize <WkIcon name="ArrowRight" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Step 2: Map — review entity mappings
// ═══════════════════════════════════════════

function MapStep({
  discovery, mappings, totalItems, autoMatched, needsReview, onToggle, onBack, onContinue, canContinue,
}: {
  discovery: WpDiscoveryResult;
  mappings: EntityMapping[];
  totalItems: number;
  autoMatched: number;
  needsReview: number;
  onToggle: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Total items found" value={totalItems} />
          <Metric label="Entity types" value={Object.keys(discovery.postTypes).length} />
          <Metric label="Auto-matched" value={autoMatched} />
          <Metric label="Needs review" value={needsReview} />
        </div>
      </WkSurface>

      <WkSurface className="p-0 overflow-hidden">
        <div className="border-b border-wk-border px-5 py-3">
          <h3 className="text-[14px] font-bold text-wk-text">Entity Mappings</h3>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            Content types are auto-matched to target tables. Click a row to toggle between matched and ignored.
          </p>
        </div>
        <div className="divide-y divide-wk-border">
          {mappings.map((m) => (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-wk-bg-subtle transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-wk-surface-raised">
                <WkIcon
                  name={m.status === "auto_matched" ? "CheckCircle2" : m.status === "ignored" ? "XCircle" : "AlertCircle"}
                  size={16}
                  className={m.status === "auto_matched" ? "text-wk-success" : m.status === "ignored" ? "text-wk-text-faint" : "text-wk-warning"}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-wk-text">{m.sourceLabel}</span>
                  <WkIcon name="ArrowRight" size={12} className="text-wk-text-faint" />
                  <span className="text-[13px] font-bold text-wk-text">{m.targetLabel}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[11px] text-wk-text-muted">{m.sourceType} → {m.targetTable}</span>
                  {m.exampleCount > 0 && (
                    <span className="text-[11px] text-wk-text-faint">{m.exampleCount.toLocaleString()} items</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-wk-border overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.confidence >= 0.9 ? "bg-wk-success" : m.confidence >= 0.7 ? "bg-wk-warning" : "bg-wk-danger"}`}
                    style={{ width: `${Math.round(m.confidence * 100)}%` }}
                  />
                </div>
                <span className={`text-[11px] font-bold whitespace-nowrap ${m.status === "ignored" ? "text-wk-text-faint" : "text-wk-text-muted"}`}>
                  {Math.round(m.confidence * 100)}%
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap ${
                  m.status === "auto_matched" ? "bg-wk-success-soft text-wk-success" :
                  m.status === "ignored" ? "bg-wk-surface-raised text-wk-text-faint" :
                  "bg-wk-warning-soft text-wk-warning"
                }`}>
                  {m.status === "auto_matched" ? "Active" : m.status === "ignored" ? "Skipped" : "Review"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </WkSurface>

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} /> Back
        </button>
        <button onClick={onContinue} disabled={!canContinue} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          Continue to staging <WkIcon name="ArrowRight" size={14} />
        </button>
        {!canContinue && <span className="text-[12px] text-wk-warning">Select at least one entity type.</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Step 3: Stage — import data
// ═══════════════════════════════════════════

function StageStep({
  discovery, mappings, totalItems, staging, run, stagingResult, onStage, onBack, onContinue, canContinue,
}: {
  discovery: WpDiscoveryResult;
  mappings: EntityMapping[];
  totalItems: number;
  staging: boolean;
  run: WizardRun | null;
  stagingResult: { stats: Record<string, number>; entityCounts: Record<string, number>; draftCounts: Record<string, number>; typeDiagnostics: Record<string, TypeDiagnostic> } | null;
  onStage: () => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <h3 className="text-[14px] font-bold text-wk-text mb-3">Staging Summary</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Total items" value={totalItems} />
          <Metric label="Entity types" value={mappings.length} />
          <Metric label="Post types" value={Object.keys(discovery.postTypes).length} />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h3 className="text-[14px] font-bold text-wk-text mb-3">Entities to Import</h3>
        <div className="space-y-2">
          {mappings.map((m) => {
            const diag = stagingResult?.typeDiagnostics?.[m.sourceType];
            const hasWarning = diag?.warning != null;
            const isAggregate = diag?.isAggregateCpt && (diag?.expectedTotal ?? 0) <= 5;
            return (
            <div key={m.id} className={`flex items-start justify-between rounded-lg border p-3 ${hasWarning ? "border-wk-warning/30 bg-wk-warning-soft/30" : "border-wk-border bg-wk-bg-subtle"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${hasWarning ? "bg-wk-warning/15" : "bg-wk-success-soft"}`}>
                  <WkIcon name={hasWarning ? "AlertCircle" : "CheckCircle2"} size={14} className={hasWarning ? "text-wk-warning" : "text-wk-success"} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{m.sourceLabel} → {m.targetLabel}</div>
                  <div className="text-[11px] text-wk-text-muted">
                    {m.exampleCount.toLocaleString()} items · {m.targetTable}
                    {diag && (
                      <span className="ml-2 text-wk-text-faint">
                        ({diag.fetchedCount > 0 ? `${diag.fetchedCount} fetched` : "not yet fetched"})
                      </span>
                    )}
                  </div>
                  {hasWarning && (
                    <div className="mt-2 flex items-start gap-2 rounded-md bg-wk-warning/10 border border-wk-warning/20 p-2">
                      <WkIcon name="Info" size={13} className="text-wk-warning shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-5 text-wk-text">{diag.warning}</p>
                    </div>
                  )}
                  {isAggregate && !hasWarning && (
                    <div className="mt-1">
                      <span className="rounded-full bg-wk-warning/10 border border-wk-warning/20 px-2 py-0.5 text-[10px] font-semibold text-wk-warning">
                        Data may be in postmeta — REST API limited
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap ${hasWarning ? "bg-wk-warning/15 text-wk-warning" : "bg-wk-success-soft text-wk-success"}`}>
                {hasWarning ? "Limited" : "Ready"}
              </span>
            </div>
          )})}
        </div>
      </WkSurface>

      {!run && (
        <WkSurface className="border-2 border-dashed border-wk-brand/30 bg-wk-brand-soft/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-brand-soft">
            <WkIcon name={staging ? "Loader2" : "Database"} size={28} className={staging ? "animate-spin text-wk-brand" : "text-wk-brand"} />
          </div>
          <h3 className="text-[16px] font-black text-wk-text">{staging ? "Creating staging run..." : "Ready to stage"}</h3>
          <p className="mt-2 text-[13px] text-wk-text-muted max-w-md mx-auto">
            {staging ? "Fetching data from WordPress and staging records..." : "This creates an ingestion run, fetches all content from WordPress, and stages records."}
          </p>
          {!staging && (
            <button onClick={onStage} className="wk-button wk-button-primary wk-button-sm mt-5 whitespace-nowrap">
              <WkIcon name="Play" size={14} /> Stage Now
            </button>
          )}
        </WkSurface>
      )}

      {run && (
        <WkSurface className="border-wk-success/20 bg-wk-success-soft p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wk-success/20">
              <WkIcon name="CheckCircle2" size={20} className="text-wk-success" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-black text-wk-text">Staging Complete</h3>
              <p className="mt-1 text-[13px] text-wk-text-muted">
                Run <span className="font-mono text-wk-text">{run.id.slice(0, 8)}...</span> staged with {stagingResult?.stats.staged || 0} records.
              </p>
              {stagingResult && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Metric label="Total Fetched" value={stagingResult.stats.total || 0} />
                  <Metric label="Staged" value={stagingResult.stats.staged || 0} />
                  <Metric label="Drafts Preserved" value={stagingResult.stats.drafts || 0} />
                </div>
              )}
              {stagingResult && Object.keys(stagingResult.entityCounts).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(stagingResult.entityCounts).map(([entity, count]) => (
                    <span key={entity} className="rounded-full border border-wk-success/20 bg-white/50 px-2 py-0.5 text-[10px] font-semibold text-wk-text">
                      {entity}: {count}
                      {(stagingResult.draftCounts[entity] ?? 0) > 0 && (
                        <span className="ml-1 text-wk-warning">({stagingResult.draftCounts[entity]} draft)</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </WkSurface>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onBack} disabled={staging} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} /> Back
        </button>
        <button onClick={onContinue} disabled={!canContinue} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          Continue to finalize <WkIcon name="ArrowRight" size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Step 4: Finalize — promote to production
// ═══════════════════════════════════════════

function FinalizeStep({
  run, discovery, mappings, totalItems, finalizing, onFinalize, onBack,
}: {
  run: WizardRun;
  discovery: WpDiscoveryResult | null;
  mappings: EntityMapping[];
  totalItems: number;
  finalizing: boolean;
  onFinalize: () => void;
  onBack: () => void;
}) {
  const importedTotal = useMemo(() =>
    mappings.reduce((sum, m) => sum + m.exampleCount, 0),
  [mappings]);

  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <h3 className="text-[14px] font-bold text-wk-text mb-3">Finalize Import</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Run ID" value={0} customDisplay={<span className="text-[12px] font-mono text-wk-text">{run.id.slice(0, 12)}...</span>} />
          <Metric label="Source" value={0} customDisplay={<span className="text-[12px] text-wk-text">{run.source_name}</span>} />
          <Metric label="Entities" value={mappings.length} />
          <Metric label="Total Items" value={importedTotal} />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h3 className="text-[14px] font-bold text-wk-text mb-3">Entity Breakdown</h3>
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-success-soft">
                  <WkIcon name="Database" size={14} className="text-wk-success" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{m.targetLabel}</div>
                  <div className="text-[11px] text-wk-text-muted">{m.targetTable} · from {m.sourceType}</div>
                </div>
              </div>
              <span className="text-[14px] font-bold text-wk-text">{m.exampleCount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </WkSurface>

      <WkSurface className="border-2 border-dashed border-wk-brand/30 bg-wk-brand-soft/20 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-brand-soft">
          <WkIcon name={finalizing ? "Loader2" : "Flag"} size={28} className={finalizing ? "animate-spin text-wk-brand" : "text-wk-brand"} />
        </div>
        <h3 className="text-[16px] font-black text-wk-text">{finalizing ? "Promoting records..." : "Ready to finalize"}</h3>
        <p className="mt-2 text-[13px] text-wk-text-muted max-w-md mx-auto">
          {finalizing
            ? "Moving staged records to production tables. Draft items stay draft, ready items publish."
            : "This promotes all staged records to production tables. Ready items publish, draft items stay draft, and review items remain in staging."}
        </p>
        {!finalizing && (
          <button onClick={onFinalize} className="wk-button wk-button-primary wk-button-sm mt-5 whitespace-nowrap">
            <WkIcon name="Flag" size={14} /> Finalize Import
          </button>
        )}
      </WkSurface>

      <div className="flex items-center gap-3">
        <button onClick={onBack} disabled={finalizing} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} /> Back
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Step 5: Complete
// ═══════════════════════════════════════════

function CompleteStep({
  run, mappings, finalizeResult, stagingResult,
}: {
  run: WizardRun;
  mappings: EntityMapping[];
  finalizeResult: { summary: Record<string, number>; totalFinalized: number; skipped: number } | null;
  stagingResult: { stats: Record<string, number>; entityCounts: Record<string, number>; draftCounts: Record<string, number>; typeDiagnostics: Record<string, TypeDiagnostic> } | null;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-5 max-w-2xl">
      <WkSurface className="border-wk-success/20 bg-wk-success-soft p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-success/20">
          <WkIcon name="CheckCircle2" size={36} className="text-wk-success" />
        </div>
        <h2 className="text-[20px] font-black text-wk-text">Import Complete</h2>
        <p className="mt-2 text-[14px] text-wk-text-muted max-w-lg mx-auto">
          {finalizeResult ? (
            <>{finalizeResult.totalFinalized.toLocaleString()} records finalized across {Object.values(finalizeResult.summary).filter(v => v > 0).length} target tables. {finalizeResult.skipped > 0 ? `${finalizeResult.skipped} non-ready items skipped.` : ""}</>
          ) : (
            <>{mappings.length} entity types have been imported from WordPress.</>
          )}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => navigate(`/admin/imports/jobs/${run.id}`)} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Eye" size={14} /> View Import Job
          </button>
          <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="List" size={14} /> All Jobs
          </button>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h3 className="text-[14px] font-bold text-wk-text mb-3">Import Summary</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Run ID" value={0} customDisplay={<span className="text-[12px] font-mono text-wk-text">{run.id.slice(0, 12)}...</span>} />
          <Metric label="Source" value={0} customDisplay={<span className="text-[12px] text-wk-text">{run.source_name}</span>} />
          <Metric label="Finalized" value={finalizeResult?.totalFinalized || 0} />
        </div>
        {finalizeResult && Object.keys(finalizeResult.summary).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(finalizeResult.summary).filter(([, v]) => v > 0).map(([key, count]) => (
              <span key={key} className="rounded-full border border-wk-border bg-wk-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-wk-text">
                {key}: {count}
              </span>
            ))}
            {finalizeResult.skipped > 0 && (
              <span className="rounded-full border border-wk-warning/30 bg-wk-warning-soft px-2 py-0.5 text-[10px] font-semibold text-wk-warning">
                {finalizeResult.skipped} skipped
              </span>
            )}
          </div>
        )}
        {stagingResult && stagingResult.stats.drafts > 0 && (
          <div className="mt-3 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3">
            <p className="text-[12px] text-wk-text">
              <span className="font-bold text-wk-warning">{stagingResult.stats.drafts} draft items</span> were preserved from WordPress and remain as drafts.
            </p>
          </div>
        )}
      </WkSurface>
    </div>
  );
}

// ═══════════════════════════════════════════
// ZIP Upload Step
// ═══════════════════════════════════════════

function ZipUploadStep({
  zipUploading, zipError, zipFile, draggingZip, fileInputRef, setDraggingZip, onDrop, onFileSelect, onBack,
}: {
  zipUploading: boolean;
  zipError: string;
  zipFile: File | null;
  draggingZip: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setDraggingZip: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} /> Back
        </button>
      </div>

      <WkSurface className="p-6">
        <h2 className="text-[16px] font-black text-wk-text mb-1">Upload WordPress Export ZIP</h2>
        <p className="text-[12px] text-wk-text-muted mb-6">Use this if the WordPress site is inaccessible. The archive will be queued for processing.</p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDraggingZip(true); }}
          onDragLeave={() => setDraggingZip(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            draggingZip ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-bg-subtle hover:border-wk-border-2"
          }`}
        >
          {zipUploading ? (
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-brand-soft">
                <WkIcon name="Loader2" size={28} className="animate-spin text-wk-brand" />
              </div>
              <p className="text-[15px] font-semibold text-wk-text">Uploading {zipFile?.name}...</p>
              <p className="mt-1 text-[12px] text-wk-text-muted">Creating ingestion run and queuing for processing.</p>
            </div>
          ) : (
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-surface-raised">
                <WkIcon name="FileUp" size={28} className="text-wk-text-muted" />
              </div>
              <p className="text-[15px] font-semibold text-wk-text">Drop your WordPress export ZIP here</p>
              <p className="mt-1 text-[12px] text-wk-text-muted">or click to browse. .zip files only.</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onFileSelect}
          />
        </div>

        {zipError && (
          <div className="mt-4 rounded-xl border border-wk-danger/20 bg-wk-danger-soft p-4">
            <div className="flex items-center gap-2">
              <WkIcon name="AlertCircle" size={16} className="text-wk-danger" />
              <span className="text-[13px] font-semibold text-wk-danger">{zipError}</span>
            </div>
          </div>
        )}
      </WkSurface>

      <WkSurface className="p-5">
        <h3 className="mb-3 text-[14px] font-bold text-wk-text">What happens with ZIP imports</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <StepCard icon="UploadCloud" title="1. Upload" desc="Archive goes to Supabase Storage." />
          <StepCard icon="ListChecks" title="2. Queue" desc="A job is created with status queued." />
          <StepCard icon="Database" title="3. Process" desc="Backend worker validates and imports records." />
        </div>
      </WkSurface>
    </div>
  );
}

// ═══════════════════════════════════════════
// ZIP Done Step
// ═══════════════════════════════════════════

function ZipDoneStep({ zipRun, zipFile }: { zipRun: { id: string; status: string; source_name: string }; zipFile: File | null }) {
  const navigate = useNavigate();
  return (
    <div className="max-w-xl space-y-5">
      <WkSurface className="border-wk-success/20 bg-wk-success-soft p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-success/20">
          <WkIcon name="CheckCircle2" size={36} className="text-wk-success" />
        </div>
        <h2 className="text-[20px] font-black text-wk-text">ZIP Uploaded</h2>
        <p className="mt-2 text-[14px] text-wk-text-muted">
          {zipFile?.name || zipRun.source_name} has been queued for processing.
        </p>
        <p className="mt-1 text-[12px] text-wk-text-muted">
          Job ID: <span className="font-mono text-wk-text">{zipRun.id.slice(0, 12)}...</span> · Status: <span className="font-semibold text-wk-warning">{zipRun.status}</span>
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => navigate(`/admin/imports/jobs/${zipRun.id}`)} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Eye" size={14} /> View Job
          </button>
          <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="List" size={14} /> All Jobs
          </button>
        </div>
      </WkSurface>
    </div>
  );
}

// ═══════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════

function Metric({ label, value, customDisplay }: { label: string; value: number; customDisplay?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
      {customDisplay || <div className="text-[18px] font-black text-wk-text">{Number(value).toLocaleString()}</div>}
      <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{label}</div>
    </div>
  );
}

function StepCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-wk-brand-soft">
        <WkIcon name={icon as never} size={16} className="text-wk-brand" />
      </div>
      <h4 className="text-[13px] font-bold text-wk-text">{title}</h4>
      <p className="mt-1 text-[12px] text-wk-text-muted">{desc}</p>
    </div>
  );
}