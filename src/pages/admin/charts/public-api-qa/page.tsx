import { useState, useCallback, useMemo } from "react";
import {
  getChartFamilies,
  getChartFamily,
  getLatestChartEdition,
  getChartEdition,
  getChartEditionEntries,
  getTrackChartHistory,
  PUBLIC_API_BASE,
  PUBLIC_MODE,
  clearChartCache,
} from "@/services/chartsPublic/client";
import {
  getV2ChartFamilies,
  getV2ChartFamily,
  getV2LatestChartEdition,
  getV2ChartEditionEntries,
  testPublicV2Connection,
  PUBLIC_V2_API_BASE,
} from "@/services/chartsPublic/v2Adapter";
import { WkIcon } from "@/components/design-system/Icon";

interface TestResult {
  id: string;
  name: string;
  endpoint: string;
  suite: "v1" | "v2";
  status: "pass" | "fail" | "warning" | "idle";
  durationMs: number;
  dataSource: "mock" | "wordpress" | "cache" | "—";
  resultCount: number;
  error?: string;
  timestamp: string;
}

const V1_FAMILY = "weekly-top-40";
const V1_EDITION = "week-22-2026";
const V2_PROGRAM = "rnb-kenya";
const V2_EDITION = "rnb-2026-05-18";
const SAMPLE_TRACK = "midnight-dreams";

const V1_TESTS = [
  {
    id: "v1-families",
    name: "getChartFamilies",
    suite: "v1" as const,
    endpoint: `${PUBLIC_API_BASE}/charts`,
    run: async () => {
      const result = await getChartFamilies();
      return { dataSource: result.meta.source, resultCount: result.data.families.length };
    },
  },
  {
    id: "v1-family",
    name: "getChartFamily",
    suite: "v1" as const,
    endpoint: `${PUBLIC_API_BASE}/charts/${V1_FAMILY}`,
    run: async () => {
      const result = await getChartFamily(V1_FAMILY);
      return { dataSource: result.meta.source, resultCount: result.data ? 1 : 0 };
    },
  },
  {
    id: "v1-latest",
    name: "getLatestChartEdition",
    suite: "v1" as const,
    endpoint: `${PUBLIC_API_BASE}/charts/${V1_FAMILY}/latest`,
    run: async () => {
      const result = await getLatestChartEdition(V1_FAMILY);
      return { dataSource: result.meta.source, resultCount: result.data ? 1 : 0 };
    },
  },
  {
    id: "v1-edition",
    name: "getChartEdition",
    suite: "v1" as const,
    endpoint: `${PUBLIC_API_BASE}/charts/${V1_FAMILY}/${V1_EDITION}`,
    run: async () => {
      const result = await getChartEdition(V1_FAMILY, V1_EDITION);
      return { dataSource: result.meta.source, resultCount: result.data ? 1 : 0 };
    },
  },
  {
    id: "v1-entries",
    name: "getChartEditionEntries",
    suite: "v1" as const,
    endpoint: `${PUBLIC_API_BASE}/charts/${V1_FAMILY}/${V1_EDITION}/entries`,
    run: async () => {
      const result = await getChartEditionEntries(V1_FAMILY, V1_EDITION);
      return { dataSource: result.meta.source, resultCount: result.data.length };
    },
  },
  {
    id: "v1-track-history",
    name: "getTrackChartHistory",
    suite: "v1" as const,
    endpoint: `${PUBLIC_API_BASE}/tracks/${SAMPLE_TRACK}/chart-history`,
    run: async () => {
      const result = await getTrackChartHistory(SAMPLE_TRACK);
      return { dataSource: result.meta.source, resultCount: result.data?.appearances?.length ?? 0 };
    },
  },
];

const V2_TESTS = [
  {
    id: "v2-health",
    name: "testPublicV2Connection",
    suite: "v2" as const,
    endpoint: `${PUBLIC_V2_API_BASE}/charts/health`,
    run: async () => {
      const result = await testPublicV2Connection();
      return { dataSource: "wordpress" as const, resultCount: result.ok ? 1 : 0 };
    },
  },
  {
    id: "v2-programs",
    name: "getV2ChartFamilies",
    suite: "v2" as const,
    endpoint: `${PUBLIC_V2_API_BASE}/charts`,
    run: async () => {
      const result = await getV2ChartFamilies();
      return { dataSource: "wordpress" as const, resultCount: result.families.length };
    },
  },
  {
    id: "v2-program",
    name: "getV2ChartFamily",
    suite: "v2" as const,
    endpoint: `${PUBLIC_V2_API_BASE}/charts/${V2_PROGRAM}`,
    run: async () => {
      const result = await getV2ChartFamily(V2_PROGRAM);
      return { dataSource: "wordpress" as const, resultCount: result ? 1 : 0 };
    },
  },
  {
    id: "v2-latest",
    name: "getV2LatestChartEdition",
    suite: "v2" as const,
    endpoint: `${PUBLIC_V2_API_BASE}/charts/${V2_PROGRAM}/latest`,
    run: async () => {
      const result = await getV2LatestChartEdition(V2_PROGRAM);
      return { dataSource: "wordpress" as const, resultCount: result ? 1 : 0 };
    },
  },
  {
    id: "v2-entries",
    name: "getV2ChartEditionEntries",
    suite: "v2" as const,
    endpoint: `${PUBLIC_V2_API_BASE}/charts/${V2_PROGRAM}/${V2_EDITION}/entries`,
    run: async () => {
      const result = await getV2ChartEditionEntries(V2_PROGRAM, V2_EDITION);
      return { dataSource: "wordpress" as const, resultCount: result.length };
    },
  },
];

const ALL_TESTS = [...V1_TESTS, ...V2_TESTS];

function initialResults(): TestResult[] {
  return ALL_TESTS.map((t) => ({
    id: t.id,
    name: t.name,
    endpoint: t.endpoint,
    suite: t.suite,
    status: "idle",
    durationMs: 0,
    dataSource: "—",
    resultCount: 0,
    timestamp: "",
  }));
}

function StatusBadge({ status }: { status: TestResult["status"] }) {
  const map: Record<string, { bg: string; icon: string; label: string }> = {
    pass: { bg: "bg-wk-success-soft text-wk-success", icon: "Check", label: "PASS" },
    fail: { bg: "bg-wk-danger-soft text-wk-danger", icon: "X", label: "FAIL" },
    warning: { bg: "bg-wk-warning-soft text-wk-warning", icon: "AlertTriangle", label: "WARN" },
    idle: { bg: "bg-wk-surface-raised text-wk-text-faint", icon: "Circle", label: "IDLE" },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.bg}`}>
      <WkIcon name={s.icon as never} size={11} />
      {s.label}
    </span>
  );
}

export default function PublicApiQaPage() {
  const [results, setResults] = useState<TestResult[]>(initialResults);
  const [running, setRunning] = useState(false);
  const [activeSuite, setActiveSuite] = useState<"all" | "v1" | "v2">("all");
  const [copied, setCopied] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runTest = useCallback(async (test: (typeof ALL_TESTS)[number], existing?: TestResult[]) => {
    const start = performance.now();
    let status: TestResult["status"] = "pass";
    let dataSource: TestResult["dataSource"] = "—";
    let resultCount = 0;
    let error: string | undefined;

    try {
      const outcome = await test.run();
      dataSource = outcome.dataSource;
      resultCount = outcome.resultCount;
      if (resultCount === 0 && !test.id.includes("track-history") && !test.id.includes("v2-health")) {
        status = "warning";
      }
    } catch (err) {
      status = "fail";
      error = err instanceof Error ? err.message : "Unknown error";
    }

    const durationMs = Math.round(performance.now() - start);
    const result: TestResult = {
      id: test.id,
      name: test.name,
      endpoint: test.endpoint,
      suite: test.suite,
      status,
      durationMs,
      dataSource,
      resultCount,
      error,
      timestamp: new Date().toISOString(),
    };

    setResults((prev) => {
      const base = existing ?? prev;
      const idx = base.findIndex((r) => r.id === test.id);
      if (idx >= 0) {
        const next = [...base];
        next[idx] = result;
        return next;
      }
      return [...base, result];
    });

    return result;
  }, []);

  const runSuite = useCallback(async (suite: "all" | "v1" | "v2") => {
    setRunning(true);
    const base = initialResults();
    setResults(base);
    const tests = suite === "all" ? ALL_TESTS : ALL_TESTS.filter((t) => t.suite === suite);
    for (const test of tests) {
      await runTest(test, base);
    }
    setLastRun(new Date().toLocaleString());
    setRunning(false);
  }, [runTest]);

  const handleClearCache = useCallback(() => {
    clearChartCache();
    setResults(initialResults);
    setLastRun(null);
  }, []);

  const displayedResults = activeSuite === "all" ? results : results.filter((r) => r.suite === activeSuite);

  const passCount = displayedResults.filter((r) => r.status === "pass").length;
  const failCount = displayedResults.filter((r) => r.status === "fail").length;
  const warnCount = displayedResults.filter((r) => r.status === "warning").length;
  const idleCount = displayedResults.filter((r) => r.status === "idle").length;

  const smokeReport = useMemo(() => {
    const lines = [
      "WAKILISHA Public Charts API Smoke Report",
      `Mode: ${PUBLIC_MODE}`,
      `V1 API Base: ${PUBLIC_API_BASE}`,
      `V2 API Base: ${PUBLIC_V2_API_BASE}`,
      `Run: ${lastRun ?? "not run yet"}`,
      "",
      "=== V1 Endpoints ===",
      ...results.filter((r) => r.suite === "v1").map((r) => {
        const label = r.status === "pass" ? "PASS" : r.status === "warning" ? "WARN" : r.status === "fail" ? "FAIL" : "SKIP";
        return `${r.name}: ${label}, ${r.resultCount} items, ${r.durationMs}ms`;
      }),
      "",
      "=== V2 Endpoints ===",
      ...results.filter((r) => r.suite === "v2").map((r) => {
        const label = r.status === "pass" ? "PASS" : r.status === "warning" ? "WARN" : r.status === "fail" ? "FAIL" : "SKIP";
        return `${r.name}: ${label}, ${r.resultCount} items, ${r.durationMs}ms`;
      }),
      "",
      `Failures: ${results.filter((r) => r.status === "fail").length}`,
    ];
    return lines.join("\n");
  }, [results, lastRun]);

  const copySmokeReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(smokeReport);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = smokeReport;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [smokeReport]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-wk-brand">Quality Assurance</div>
          <h1 className="text-[22px] font-bold text-wk-text">Public Charts API QA</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            Validate V1 and V2 public chart endpoints. V2 is the new ontology layer (programs, markets, editions).
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">V1 Mode</div>
            <div className="text-[13px] font-bold text-wk-brand">{PUBLIC_MODE}</div>
            <div className="text-[10px] font-mono text-wk-text-muted truncate max-w-[220px]">{PUBLIC_API_BASE}</div>
          </div>
          <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">V2 Base</div>
            <div className="text-[10px] font-mono text-wk-text-muted truncate max-w-[220px]">{PUBLIC_V2_API_BASE}</div>
          </div>
        </div>
      </div>

      {/* V2 context callout */}
      <div className="rounded-lg border border-wk-brand/20 bg-wk-brand-soft p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-brand text-wk-brand-on">
          <WkIcon name="BarChart3" size={16} />
        </div>
        <div>
          <p className="text-[13px] font-bold text-wk-text">V2 API — Charts Ontology V2</p>
          <p className="mt-0.5 text-[12px] text-wk-text-muted">
            The V2 API introduces <strong>ChartProgram</strong> (series + market), structured edition slugs, and a consistent response envelope.
            Programs: <code className="text-[11px] bg-white/40 rounded px-1">rnb-kenya</code>, <code className="text-[11px] bg-white/40 rounded px-1">top-songs-kenya</code>, <code className="text-[11px] bg-white/40 rounded px-1">gengetone-kenya</code>, <code className="text-[11px] bg-white/40 rounded px-1">2026-releases-kenya</code>.
            V2 is served from the local dev server when running <code className="text-[11px] bg-white/40 rounded px-1">npm run charts:v2-serve</code>.
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Passed", value: passCount, color: "text-wk-success" },
          { label: "Failed", value: failCount, color: "text-wk-danger" },
          { label: "Warnings", value: warnCount, color: "text-wk-warning" },
          { label: "Idle", value: idleCount, color: "text-wk-text-faint" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-wk-border bg-wk-surface p-3 text-center">
            <div className={`text-[20px] font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Suite Tabs */}
      <div className="flex gap-1 border-b border-wk-border">
        {(["all", "v1", "v2"] as const).map((suite) => (
          <button
            key={suite}
            onClick={() => setActiveSuite(suite)}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px ${
              activeSuite === suite
                ? "border-wk-brand text-wk-brand"
                : "border-transparent text-wk-text-muted hover:text-wk-text"
            }`}
          >
            {suite === "all" ? "All Tests" : suite === "v1" ? "V1 Endpoints" : "V2 Endpoints (New)"}
            {suite === "v2" && (
              <span className="ml-1.5 rounded-full bg-wk-brand px-1.5 py-0.5 text-[9px] font-bold text-wk-brand-on">NEW</span>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => runSuite("all")}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-wk-brand px-4 py-2.5 text-[13px] font-bold text-wk-brand-on transition-all hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          <WkIcon name={running ? "Loader" : "Play"} size={16} className={running ? "animate-spin" : ""} />
          {running ? "Running tests…" : "Run all tests"}
        </button>
        {activeSuite !== "all" && (
          <button
            onClick={() => runSuite(activeSuite)}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-xl border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-bold text-wk-text transition-all hover:bg-wk-surface-raised disabled:opacity-50 whitespace-nowrap"
          >
            <WkIcon name="Play" size={14} />
            Run {activeSuite.toUpperCase()} only
          </button>
        )}
        <button
          onClick={handleClearCache}
          className="inline-flex items-center gap-2 rounded-xl border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-bold text-wk-text transition-all hover:bg-wk-surface-raised whitespace-nowrap"
        >
          <WkIcon name="Trash2" size={14} />
          Clear cache
        </button>
        <button
          onClick={copySmokeReport}
          className="inline-flex items-center gap-2 rounded-xl border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-bold text-wk-text transition-all hover:bg-wk-surface-raised whitespace-nowrap"
        >
          <WkIcon name={copied ? "Check" : "Copy"} size={14} className={copied ? "text-wk-success" : ""} />
          {copied ? "Copied" : "Copy smoke report"}
        </button>
      </div>

      {/* Results Table */}
      <div className="rounded-2xl border border-wk-border bg-wk-surface overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_140px_80px_60px_80px] gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-faint border-b border-wk-border">
          <div>Suite</div>
          <div>Function / Endpoint</div>
          <div className="text-right">Status</div>
          <div className="text-right">Duration</div>
          <div className="text-right">Source</div>
          <div className="text-right">Count</div>
        </div>
        <div className="divide-y divide-wk-border">
          {displayedResults.map((result) => (
            <div key={result.id} className="grid grid-cols-[auto_1fr_140px_80px_60px_80px] gap-2 items-center px-4 py-3">
              <div>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  result.suite === "v2"
                    ? "bg-wk-brand-soft text-wk-brand"
                    : "bg-wk-surface-raised text-wk-text-muted"
                }`}>
                  {result.suite.toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-wk-text">{result.name}</div>
                <div className="text-[10px] font-mono text-wk-text-faint truncate">{result.endpoint}</div>
                {result.error && (
                  <div className="mt-1 text-[10px] text-wk-danger truncate">{result.error}</div>
                )}
              </div>
              <div className="text-right"><StatusBadge status={result.status} /></div>
              <div className="text-right text-[12px] font-bold text-wk-text-muted">
                {result.durationMs > 0 ? `${result.durationMs}ms` : "—"}
              </div>
              <div className="text-right text-[12px] font-bold">
                {result.dataSource === "—" ? <span className="text-wk-text-faint">—</span> : (
                  <span className={
                    result.dataSource === "mock" ? "text-wk-warning" :
                    result.dataSource === "wordpress" ? "text-wk-success" :
                    "text-wk-info"
                  }>
                    {result.dataSource}
                  </span>
                )}
              </div>
              <div className="text-right text-[12px] font-bold text-wk-text">
                {result.resultCount > 0 ? result.resultCount : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smoke report preview */}
      <div className="rounded-2xl border border-wk-border bg-wk-surface-raised overflow-hidden">
        <div className="px-4 py-3 border-b border-wk-border flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Smoke report preview</div>
          <button onClick={copySmokeReport} className="flex items-center gap-1 text-[12px] font-bold text-wk-brand">
            <WkIcon name={copied ? "Check" : "Copy"} size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="p-4">
          <pre className="font-mono text-[11px] leading-relaxed text-wk-text-soft whitespace-pre-wrap">{smokeReport}</pre>
        </div>
      </div>

      {/* How to switch mode */}
      <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
            <WkIcon name="Info" size={16} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-wk-text mb-2">How to test live endpoints</div>
            <div className="space-y-2 text-[12px] text-wk-text-muted">
              <p>
                <strong className="text-wk-text">V1 WordPress mode:</strong> Set{" "}
                <code className="font-mono text-[11px] bg-wk-surface-raised px-1 rounded">VITE_CHARTS_PUBLIC_MODE=wordpress</code> and{" "}
                <code className="font-mono text-[11px] bg-wk-surface-raised px-1 rounded">VITE_WAKILISHA_WP_API_BASE</code>.
              </p>
              <p>
                <strong className="text-wk-text">V2 local server:</strong> Run{" "}
                <code className="font-mono text-[11px] bg-wk-surface-raised px-1 rounded">npm run charts:v2-serve</code> to start the local V2 API server
                then run V2 tests here. The V2 server uses the public JSON data as its source.
              </p>
              <p>
                <strong className="text-wk-text">V2 execution readiness:</strong>{" "}
                See <code className="font-mono text-[11px] bg-wk-surface-raised px-1 rounded">reports/chart-v2-execution-readiness.md</code> — 6/6 checks pass, 0 blockers, 2 content QA warnings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}