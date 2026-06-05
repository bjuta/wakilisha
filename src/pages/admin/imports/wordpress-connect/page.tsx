import { useCallback, useEffect, useMemo, useState } from "react";
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
  type WizardStep,
  type WpDiscoveryResult,
  type EntityMapping,
  type WizardRun,
} from "@/services/wordpressConnectService";

// ---- Step definitions ----
const STEPS: { id: WizardStep; number: string; label: string; sub: string }[] = [
  { id: "connect", number: "1", label: "Connect", sub: "Find your site" },
  { id: "map", number: "2", label: "Map", sub: "Match entities" },
  { id: "stage", number: "3", label: "Stage", sub: "Create run" },
  { id: "finalize", number: "4", label: "Finalize", sub: "Complete" },
];

// ---- Main Component ----
export default function AdminWordPressConnectWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("connect");
  const [siteUrl, setSiteUrl] = useState("");
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

  // ---- Actions ----
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
      await stageIngestionRun(newRun.id);
      setRun((prev) => prev ? { ...prev, status: "planned" } : prev);
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
      const activeMappings = computedMappings.filter((m) => m.status === "auto_matched");
      const counts: Record<string, number> = {};
      for (const m of activeMappings) {
        const key = m.targetTable.replace(/^registry_/, "");
        counts[key] = m.exampleCount;
      }
      await finalizeIngestionRun(run.id, counts);
      setFinalized(true);
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Finalize failed.");
    } finally {
      setFinalizing(false);
    }
  }, [run, computedMappings]);

  const canProceedToMap = discovery !== null && !discovering;
  const canProceedToStage = computedMappings.filter((m) => m.status === "auto_matched").length > 0;
  const canProceedToFinalize = run !== null && run.status === "planned";
  const isComplete = finalized;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports / WordPress</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">WordPress Connect Wizard</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-6 text-wk-text-muted">
            Connect to your live WordPress site, auto-discover content, map entities, stage, and finalize — all in one automated flow.
          </p>
        </div>
        <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="List" size={14} /> View Jobs
        </button>
      </div>

      {/* Step Indicator */}
      <WkSurface className="p-4">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (s.id === "connect") setStep("connect");
                  else if (s.id === "map" && canProceedToMap) setStep("map");
                  else if (s.id === "stage" && canProceedToStage) setStep("stage");
                  else if (s.id === "finalize" && canProceedToFinalize) setStep("finalize");
                }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all ${
                  step === s.id
                    ? "border-wk-brand bg-wk-brand-soft"
                    : (s.id === "map" && canProceedToMap) ||
                      (s.id === "stage" && canProceedToStage) ||
                      (s.id === "finalize" && canProceedToFinalize) ||
                      s.id === "connect"
                    ? "border-wk-border bg-wk-bg-subtle cursor-pointer hover:border-wk-border-2"
                    : "border-wk-border bg-wk-bg-subtle opacity-40 cursor-not-allowed"
                }`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black ${
                  step === s.id ? "bg-wk-brand text-black" : "bg-wk-surface-raised text-wk-text-muted"
                }`}>
                  {s.id === "finalize" && isComplete ? <WkIcon name="Check" size={12} /> : s.number}
                </span>
                <div className="text-left">
                  <div className="text-[12px] font-black text-wk-text">{s.label}</div>
                  <div className="text-[10px] text-wk-text-muted">{s.sub}</div>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 ${step === s.id || (i < STEPS.findIndex((st) => st.id === step)) ? "bg-wk-brand" : "bg-wk-border"}`} />
              )}
            </div>
          ))}
        </div>
      </WkSurface>

      {/* Step Content */}
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
          onStage={handleStage}
          onBack={() => setStep("map")}
          onContinue={() => setStep("finalize")}
          canContinue={canProceedToFinalize}
        />
      )}

      {step === "finalize" && run && discovery && (
        <FinalizeStep
          run={run}
          discovery={discovery}
          mappings={computedMappings.filter((m) => m.status === "auto_matched")}
          totalItems={totalItems}
          finalizing={finalizing}
          finalized={finalized}
          onFinalize={handleFinalize}
          onBack={() => setStep("stage")}
        />
      )}
    </div>
  );
}

// ---- Step 1: Connect ----
function ConnectStep({
  siteUrl, setSiteUrl, pinging, pingResult, discovering, discovery, discoveryError, onPing, onContinue, canContinue,
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
}) {
  const counts = discovery?.counts ?? {};
  const postTypes = discovery?.postTypes ?? {};
  const taxonomies = discovery?.taxonomies ?? {};
  const samples = discovery?.samples ?? {};
  const countEntries = Object.entries(counts).filter(([, c]) => (typeof c === "number" ? c : 0) > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Left: URL Input */}
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
              placeholder="https://your-wordpress-site.com"
              className="flex-1 rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand placeholder:text-wk-text-faint"
              disabled={pinging || discovering}
            />
            <button
              onClick={onPing}
              disabled={pinging || discovering || !siteUrl.trim()}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              {pinging ? (
                <><WkIcon name="Loader2" size={14} className="animate-spin" /> Pinging...</>
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
                {pingResult.accessible ? "Connected successfully" : "Connection failed"}
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

        {canContinue && (
          <button onClick={onContinue} className="wk-button wk-button-primary wk-button-sm mt-6 w-full whitespace-nowrap">
            Continue to mapping <WkIcon name="ArrowRight" size={14} />
          </button>
        )}
      </WkSurface>

      {/* Right: Discovery Results */}
      {discovery && (
        <div className="space-y-5">
          <WkSurface className="p-5">
            <h3 className="text-[14px] font-bold text-wk-text mb-3">Discovered Content</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {countEntries.length > 0 ? countEntries.map(([key, count]) => (
                <div key={key} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[18px] font-black text-wk-text">{Number(count).toLocaleString()}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{postTypes[key]?.name || key}</div>
                </div>
              )) : (
                <p className="col-span-3 text-[13px] text-wk-text-muted">No content types with items found.</p>
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

// ---- Step 2: Map ----
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
      {/* Summary */}
      <WkSurface className="p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Total items found" value={totalItems} />
          <Metric label="Entity types" value={Object.keys(discovery.postTypes).length} />
          <Metric label="Auto-matched" value={autoMatched} />
          <Metric label="Needs review" value={needsReview} />
        </div>
      </WkSurface>

      {/* Mapping Table */}
      <WkSurface className="p-0 overflow-hidden">
        <div className="border-b border-wk-border px-5 py-3">
          <h3 className="text-[14px] font-bold text-wk-text">Entity Mappings</h3>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            WordPress content types are auto-matched to their target tables. Click a row to toggle between matched and ignored.
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
                  <span className="text-[11px] text-wk-text-muted">
                    {m.sourceType} → {m.targetTable}
                  </span>
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

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} /> Back
        </button>
        <button onClick={onContinue} disabled={!canContinue} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          Continue to staging <WkIcon name="ArrowRight" size={14} />
        </button>
        {!canContinue && (
          <span className="text-[12px] text-wk-warning">Select at least one entity type to continue.</span>
        )}
      </div>
    </div>
  );
}

// ---- Step 3: Stage ----
function StageStep({
  discovery, mappings, totalItems, staging, run, onStage, onBack, onContinue, canContinue,
}: {
  discovery: WpDiscoveryResult;
  mappings: EntityMapping[];
  totalItems: number;
  staging: boolean;
  run: WizardRun | null;
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
          <Metric label="Entity types to import" value={mappings.length} />
          <Metric label="Post types" value={Object.keys(discovery.postTypes).length} />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h3 className="text-[14px] font-bold text-wk-text mb-3">Entities to Import</h3>
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-success-soft">
                  <WkIcon name="CheckCircle2" size={14} className="text-wk-success" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{m.sourceLabel} → {m.targetLabel}</div>
                  <div className="text-[11px] text-wk-text-muted">{m.exampleCount.toLocaleString()} items · {m.targetTable}</div>
                </div>
              </div>
              <span className="rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-wk-success">Ready</span>
            </div>
          ))}
        </div>
      </WkSurface>

      {!run && (
        <WkSurface className="border-2 border-dashed border-wk-brand/30 bg-wk-brand-soft/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-brand-soft">
            <WkIcon name={staging ? "Loader2" : "Database"} size={28} className={staging ? "animate-spin text-wk-brand" : "text-wk-brand"} />
          </div>
          <h3 className="text-[16px] font-black text-wk-text">{staging ? "Creating staging run..." : "Ready to stage"}</h3>
          <p className="mt-2 text-[13px] text-wk-text-muted max-w-md mx-auto">
            {staging
              ? "Creating the ingestion run record with scan results, entity mappings, and staging plan."
              : "This will create a real ingestion run in the database with all scan and mapping data. Nothing is imported yet."}
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
            <div>
              <h3 className="text-[14px] font-black text-wk-text">Staging Complete</h3>
              <p className="mt-1 text-[13px] text-wk-text-muted">
                Ingestion run <span className="font-mono text-wk-text">{run.id.slice(0, 8)}...</span> has been created with status "{run.status}".
              </p>
              <p className="mt-1 text-[12px] text-wk-text-muted">
                Source: {run.source_name} · Created: {new Date(run.created_at).toLocaleString()}
              </p>
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

// ---- Step 4: Finalize ----
function FinalizeStep({
  run, discovery, mappings, totalItems, finalizing, finalized, onFinalize, onBack,
}: {
  run: WizardRun;
  discovery: WpDiscoveryResult;
  mappings: EntityMapping[];
  totalItems: number;
  finalizing: boolean;
  finalized: boolean;
  onFinalize: () => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const importedTotal = useMemo(() =>
    mappings.reduce((sum, m) => sum + m.exampleCount, 0),
  [mappings]);

  if (finalized) {
    return (
      <div className="space-y-5">
        <WkSurface className="border-wk-success/20 bg-wk-success-soft p-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-success/20">
            <WkIcon name="CheckCircle2" size={36} className="text-wk-success" />
          </div>
          <h2 className="text-[20px] font-black text-wk-text">Import Complete</h2>
          <p className="mt-2 text-[14px] text-wk-text-muted max-w-lg mx-auto">
            The WordPress connection has been finalized. {importedTotal.toLocaleString()} items across {mappings.length} entity types have been staged for import.
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
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Run ID" value={0} customDisplay={<span className="text-[12px] font-mono text-wk-text">{run.id.slice(0, 12)}...</span>} />
            <Metric label="Source" value={0} customDisplay={<span className="text-[12px] text-wk-text">{run.source_name}</span>} />
            <Metric label="Entities" value={mappings.length} />
            <Metric label="Total Items" value={importedTotal} />
          </div>
        </WkSurface>
      </div>
    );
  }

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
        <h3 className="text-[16px] font-black text-wk-text">{finalizing ? "Finalizing..." : "Ready to finalize"}</h3>
        <p className="mt-2 text-[13px] text-wk-text-muted max-w-md mx-auto">
          This marks the ingestion run as completed. The scan, mappings, and staging plan are stored in the database for future processing.
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

// ---- Shared ----
function Metric({ label, value, customDisplay }: { label: string; value: number; customDisplay?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
      {customDisplay || <div className="text-[18px] font-black text-wk-text">{Number(value).toLocaleString()}</div>}
      <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{label}</div>
    </div>
  );
}