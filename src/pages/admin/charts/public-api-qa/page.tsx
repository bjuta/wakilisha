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
import { WkIcon } from "@/components/design-system/Icon";

interface TestResult {
  id: string;
  name: string;
  endpoint: string;
  status: "pass" | "fail" | "warning" | "idle";
  durationMs: number;
  dataSource: "mock" | "wordpress" | "cache" | "—";
  resultCount: number;
  error?: string;
  timestamp: string;
}

const DEFAULT_FAMILY = "weekly-top-40";
const DEFAULT_EDITION = "week-22-2026";
const SAMPLE_TRACK = "midnight-dreams";

const TESTS = [
  {
    id: "families",
    name: "getChartFamilies",
    endpoint: `${PUBLIC_API_BASE}/charts`,
    run: async () => {
      const result = await getChartFamilies();
      return {
        dataSource: result.meta.source,
        resultCount: result.data.length,
      };
    },
  },
  {
    id: "family",
    name: "getChartFamily",
    endpoint: `${PUBLIC_API_BASE}/charts/${DEFAULT_FAMILY}`,
    run: async () => {
      const result = await getChartFamily(DEFAULT_FAMILY);
      return {
        dataSource: result.meta.source,
        resultCount: result.data ? 1 : 0,
      };
    },
  },
  {
    id: "latest",
    name: "getLatestChartEdition",
    endpoint: `${PUBLIC_API_BASE}/charts/${DEFAULT_FAMILY}/latest`,
    run: async () => {
      const result = await getLatestChartEdition(DEFAULT_FAMILY);
      return {
        dataSource: result.meta.source,
        resultCount: result.data ? 1 : 0,
      };
    },
  },
  {
    id: "edition",
    name: "getChartEdition",
    endpoint: `${PUBLIC_API_BASE}/charts/${DEFAULT_FAMILY}/${DEFAULT_EDITION}`,
    run: async () => {
      const result = await getChartEdition(DEFAULT_FAMILY, DEFAULT_EDITION);
      return {
        dataSource: result.meta.source,
        resultCount: result.data ? 1 : 0,
      };
    },
  },
  {
    id: "entries",
    name: "getChartEditionEntries",
    endpoint: `${PUBLIC_API_BASE}/charts/${DEFAULT_FAMILY}/${DEFAULT_EDITION}/entries`,
    run: async () => {
      const result = await getChartEditionEntries(DEFAULT_FAMILY, DEFAULT_EDITION);
      return {
        dataSource: result.meta.source,
        resultCount: result.data.length,
      };
    },
  },
  {
    id: "track-history",
    name: "getTrackChartHistory",
    endpoint: `${PUBLIC_API_BASE}/tracks/${SAMPLE_TRACK}/chart-history`,
    run: async () => {
      const result = await getTrackChartHistory(SAMPLE_TRACK);
      return {
        dataSource: result.meta.source,
        resultCount: result.data?.appearances?.length ?? 0,
      };
    },
  },
];

function initialResults(): TestResult[] {
  return TESTS.map((t) => ({
    id: t.id,
    name: t.name,
    endpoint: t.endpoint,
    status: "idle",
    durationMs: 0,
    dataSource: "—",
    resultCount: 0,
    timestamp: "",
  }));
}

export default function PublicApiQaPage() {
  const [results, setResults] = useState<TestResult[]>(initialResults);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runTest = useCallback(async (test: (typeof TESTS)[number], existing?: TestResult[]) => {
    const start = performance.now();
    let status: TestResult["status"] = "pass";
    let dataSource: TestResult["dataSource"] = "—";
    let resultCount = 0;
    let error: string | undefined;

    try {
      const outcome = await test.run();
      dataSource = outcome.dataSource;
      resultCount = outcome.resultCount;
      if (resultCount === 0 && test.id !== "track-history") {
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

  const runAll = useCallback(async () => {
    setRunning(true);
    const base = initialResults();
    setResults(base);

    for (const test of TESTS) {
      await runTest(test, base);
    }

    setLastRun(new Date().toLocaleString());
    setRunning(false);
  }, [runTest]);

  const retestFailed = useCallback(async () => {
    const failed = results.filter((r) => r.status === "fail" || r.status === "warning");
    if (failed.length === 0) return;
    setRunning(true);
    for (const test of TESTS.filter((t) => failed.some((f) => f.id === t.id))) {
      await runTest(test);
    }
    setRunning(false);
  }, [results, runTest]);

  const handleClearCache = useCallback(() => {
    clearChartCache();
    setResults((prev) =>
      prev.map((r) => ({
        ...r,
        status: "idle" as const,
        durationMs: 0,
        dataSource: "—" as const,
        resultCount: 0,
        error: undefined,
      }))
    );
    setLastRun(null);
  }, []);

  const smokeReport = useMemo(() => {
    const failures = results.filter((r) => r.status === "fail").length;
    const lines = [
      "WAKILISHA Public Charts API Smoke Report",
      `Mode: ${PUBLIC_MODE}`,
      `API Base: ${PUBLIC_API_BASE}`,
      `Run: ${lastRun ?? new Date().toLocaleString()}`,
      ``,
      ...results.map((r) => {
        const label = r.status === "pass" ? "PASS" : r.status === "warning" ? "WARN" : r.status === "fail" ? "FAIL" : "SKIP";
        return `${r.name}: ${label}, ${r.resultCount} ${r.resultCount === 1 ? "item" : "items"}, ${r.durationMs}ms`;
      }),
      ``,
      `Failures: ${failures}`,
    ];
    return lines.join("\n");
  }, [results, lastRun]);

  const copySmokeReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(smokeReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = smokeReport;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [smokeReport]);

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warning").length;
  const idleCount = results.filter((r) => r.status === "idle").length;

  const statusBadge = (status: TestResult["status"]) => {
    const map: Record<string, { bg: string; text: string; icon: string; label: string }> = {
      pass: { bg: "bg-[var(--wk-success)]/10", text: "text-[var(--wk-success)]", icon: "ri-check-line", label: "PASS" },
      fail: { bg: "bg-[var(--wk-danger)]/10", text: "text-[var(--wk-danger)]", icon: "ri-close-line", label: "FAIL" },
      warning: { bg: "bg-[var(--wk-warning)]/10", text: "text-[var(--wk-warning)]", icon: "ri-alert-line", label: "WARN" },
      idle: { bg: "bg-[var(--wk-surface-raised)]", text: "text-[var(--wk-text-faint)]", icon: "ri-loader-4-line", label: "IDLE" },
    };
    const s = map[status] ?? map.idle;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.bg} ${s.text}`}>
        <i className={s.icon} />
        {s.label}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-[var(--wk-brand)]">
            Quality Assurance
          </div>
          <h1 className="text-[22px] font-black text-[var(--wk-text)]">Public Charts API QA</h1>
          <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
            Validate public chart endpoints before switching to WordPress mode.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Mode</div>
          <div className="text-[14px] font-black text-[var(--wk-brand)]">{PUBLIC_MODE}</div>
          <div className="text-[10px] text-[var(--wk-text-muted)]">{PUBLIC_API_BASE}</div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Passed", value: passCount, color: "var(--wk-success)" },
          { label: "Failed", value: failCount, color: "var(--wk-danger)" },
          { label: "Warnings", value: warnCount, color: "var(--wk-warning)" },
          { label: "Idle", value: idleCount, color: "var(--wk-text-faint)" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-center">
            <div className="text-[20px] font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={runAll}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--wk-brand)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          <WkIcon name={running ? "Loader" : "Play"} size={16} className={running ? "animate-spin" : ""} />
          {running ? "Running tests..." : "Run all tests"}
        </button>
        <button
          onClick={retestFailed}
          disabled={running || failCount + warnCount === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] disabled:opacity-40 whitespace-nowrap"
        >
          <WkIcon name="RefreshCw" size={16} />
          Retest failed only
        </button>
        <button
          onClick={handleClearCache}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] whitespace-nowrap"
        >
          <WkIcon name="Trash2" size={16} />
          Clear cache
        </button>
        <button
          onClick={copySmokeReport}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] whitespace-nowrap"
        >
          <WkIcon name={copied ? "Check" : "Copy"} size={16} className={copied ? "text-[var(--wk-success)]" : ""} />
          {copied ? "Copied" : "Copy smoke report"}
        </button>
      </div>

      {/* Test results table */}
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_80px_60px_80px] gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)] md:grid-cols-[1fr_200px_100px_80px_100px]">
          <div>Function / Endpoint</div>
          <div className="text-right">Status</div>
          <div className="text-right">Duration</div>
          <div className="text-right">Source</div>
          <div className="text-right">Count</div>
        </div>
        <div className="divide-y divide-[var(--wk-divider)]">
          {results.map((result) => (
            <div
              key={result.id}
              className="grid grid-cols-[1fr_120px_80px_60px_80px] gap-2 items-center px-4 py-3 md:grid-cols-[1fr_200px_100px_80px_100px]"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">{result.name}</div>
                <div className="text-[10px] font-mono text-[var(--wk-text-faint)] truncate">{result.endpoint}</div>
                {result.error && (
                  <div className="mt-1 text-[10px] text-[var(--wk-danger)] truncate">{result.error}</div>
                )}
              </div>
              <div className="text-right">{statusBadge(result.status)}</div>
              <div className="text-right text-[12px] font-bold text-[var(--wk-text-muted)]">
                {result.durationMs > 0 ? `${result.durationMs}ms` : "—"}
              </div>
              <div className="text-right text-[12px] font-bold text-[var(--wk-text-muted)]">
                {result.dataSource === "—" ? "—" : (
                  <span className={
                    result.dataSource === "mock" ? "text-[var(--wk-warning)]" :
                    result.dataSource === "wordpress" ? "text-[var(--wk-success)]" :
                    "text-[var(--wk-info)]"
                  }>
                    {result.dataSource}
                  </span>
                )}
              </div>
              <div className="text-right text-[12px] font-bold text-[var(--wk-text)]">
                {result.resultCount > 0 ? result.resultCount : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smoke report preview */}
      <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--wk-divider)] flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Smoke report preview</div>
          <button
            onClick={copySmokeReport}
            className="text-[12px] font-bold text-[var(--wk-brand)] flex items-center gap-1"
          >
            <WkIcon name={copied ? "Check" : "Copy"} size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="p-4">
          <pre className="font-mono text-[11px] leading-relaxed text-[var(--wk-text-soft)] whitespace-pre-wrap">{smokeReport}</pre>
        </div>
      </div>

      {/* Info callout */}
      <div className="mt-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <i className="ri-information-line text-sm" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-[var(--wk-text)] mb-1">How to switch to WordPress mode</div>
            <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
              Set <code className="font-mono text-[11px] bg-[var(--wk-bg)] px-1 rounded">VITE_CHARTS_PUBLIC_MODE=wordpress</code>
              in your environment, ensure <code className="font-mono text-[11px] bg-[var(--wk-bg)] px-1 rounded">VITE_WAKILISHA_WP_API_BASE</code>
              is configured, and run these tests again. All endpoints should pass with green "wordpress" source.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}