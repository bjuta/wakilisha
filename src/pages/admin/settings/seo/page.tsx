import { useCallback, useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

type SitemapSnapshot = {
  id: string;
  status: "generated" | "published" | "failed";
  source: "internal" | "pro_sitemaps" | "mixed";
  base_url: string;
  url_count: number;
  xml_sha256: string | null;
  pro_sitemaps_site_id: string | null;
  pro_sitemaps_result_json: Record<string, unknown>;
  error_message: string | null;
  generated_at: string;
  published_at: string | null;
};

type ConsoleResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; message: string; detail?: string };

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const EDGE_XML_URL = `${SUPABASE_URL}/functions/v1/seo-sitemap-admin?action=xml`;
const ROOT_SITEMAP_URL = "https://wakilisha.africa/sitemap.xml";
const ROOT_ROBOTS_URL = "https://wakilisha.africa/robots.txt";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function shortHash(value?: string | null) {
  if (!value) return "Not stored";
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function resultMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Action completed.";
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return "Action completed.";

  const maybeUrlCount = (data as { urlCount?: unknown }).urlCount;
  if (typeof maybeUrlCount === "number") return `Generated ${maybeUrlCount.toLocaleString()} URLs.`;

  const maybeMessage = (data as { message?: unknown }).message;
  if (typeof maybeMessage === "string") return maybeMessage;

  return "Action completed.";
}

export default function AdminSettingsSeoPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SitemapSnapshot | null>(null);
  const [result, setResult] = useState<ConsoleResult | null>(null);

  const latestSourceLabel = useMemo(() => {
    if (!snapshot) return "No snapshot yet";
    if (snapshot.source === "mixed") return "Internal + Pro-Sitemaps";
    if (snapshot.source === "pro_sitemaps") return "Pro-Sitemaps";
    return "Internal generator";
  }, [snapshot]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setResult(null);

    const { data, error } = await supabase.functions.invoke("seo-sitemap-admin", {
      method: "GET",
    });

    if (error) {
      setResult({ ok: false, message: "Could not load SEO sitemap status.", detail: error.message });
      setLoading(false);
      return;
    }

    setSnapshot((data as { data?: { snapshot?: SitemapSnapshot | null } })?.data?.snapshot ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runAction(action: "generate" | "generate_and_pro_update" | "pro_update") {
    setRunning(action);
    setResult(null);

    const { data, error } = await supabase.functions.invoke("seo-sitemap-admin", {
      method: "POST",
      body: { action },
    });

    if (error) {
      setResult({ ok: false, message: "SEO action failed.", detail: error.message });
      setRunning(null);
      return;
    }

    setResult({
      ok: true,
      message: resultMessage(data),
      detail:
        action === "pro_update"
          ? "Pro-Sitemaps update request sent. Check Pro-Sitemaps history for crawl completion."
          : "Snapshot saved. The root static sitemap must still be regenerated/deployed for production if you want a static file refresh.",
    });

    await loadStatus();
    setRunning(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <WkIcon name="Globe" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">SEO Console</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Generate and inspect WAKILISHA public sitemap infrastructure. Internal generation is the source of truth; Pro-Sitemaps is the external crawler support layer.
        </p>
      </div>

      <WkSurface className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[14px] font-black text-[var(--wk-text)]">Launch sitemap status</h2>
            <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
              Latest internal snapshot and public XML endpoints.
            </p>
          </div>

          <button
            onClick={loadStatus}
            disabled={loading || Boolean(running)}
            className="wk-button wk-button-soft wk-button-sm inline-flex items-center justify-center gap-2"
          >
            <WkIcon name={loading ? "Loader" : "RotateCcw"} size={14} />
            {loading ? "Refreshing..." : "Refresh status"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="URLs" value={snapshot ? snapshot.url_count.toLocaleString() : "0"} />
          <MetricCard label="Source" value={latestSourceLabel} />
          <MetricCard label="Generated" value={formatDate(snapshot?.generated_at)} />
          <MetricCard label="Hash" value={shortHash(snapshot?.xml_sha256)} mono />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <EndpointCard label="Root sitemap" url={ROOT_SITEMAP_URL} />
          <EndpointCard label="Robots" url={ROOT_ROBOTS_URL} />
          <EndpointCard label="Edge fallback XML" url={EDGE_XML_URL} />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-black text-[var(--wk-text)]">Actions</h2>

        <div className="grid gap-3 lg:grid-cols-3">
          <SeoActionButton
            label="Generate internal sitemap"
            icon="Play"
            description="Build a fresh sitemap snapshot from WAKILISHA public content tables."
            running={running === "generate"}
            disabled={Boolean(running)}
            onClick={() => runAction("generate")}
          />

          <SeoActionButton
            label="Generate + Pro-Sitemaps update"
            icon="RefreshCw"
            description="Build a fresh internal snapshot and ask Pro-Sitemaps to refresh its crawl."
            running={running === "generate_and_pro_update"}
            disabled={Boolean(running)}
            onClick={() => runAction("generate_and_pro_update")}
          />

          <SeoActionButton
            label="Trigger Pro-Sitemaps only"
            icon="Globe"
            description="Ask Pro-Sitemaps to update using the configured external account."
            running={running === "pro_update"}
            disabled={Boolean(running)}
            onClick={() => runAction("pro_update")}
          />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="mb-3 text-[14px] font-black text-[var(--wk-text)]">Operational notes</h2>
        <div className="space-y-2 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
          <p>
            Internal sitemap generation writes an audited snapshot to Supabase. The public Edge XML endpoint can always rebuild from live data if no snapshot exists.
          </p>
          <p>
            For today’s static production launch, regenerate the root <code className="font-mono text-[var(--wk-text)]">public/sitemap.xml</code> from the Edge XML endpoint, commit it, and deploy frontend.
          </p>
          <p>
            Pro-Sitemaps must never be the only source of truth. It is useful for external crawling and validation, but WAKILISHA owns the fallback.
          </p>
        </div>
      </WkSurface>

      {result && (
        <WkSurface className={`p-4 ${result.ok ? "border-l-4 border-[var(--wk-success)]" : "border-l-4 border-[var(--wk-danger)]"}`}>
          <div className="flex items-center gap-2">
            <WkIcon name={result.ok ? "CheckCircle" : "XCircle"} size={16} className={result.ok ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"} />
            <span className={`text-[13px] font-semibold ${result.ok ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"}`}>
              {result.message}
            </span>
          </div>
          {result.detail && <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">{result.detail}</p>}
        </WkSurface>
      )}
    </div>
  );
}

function MetricCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">{label}</p>
      <p className={`mt-2 truncate text-[18px] font-black text-[var(--wk-text)] ${mono ? "font-mono text-[13px]" : ""}`}>{value}</p>
    </div>
  );
}

function EndpointCard({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 transition hover:border-[var(--wk-brand)]"
    >
      <div className="mb-1 flex items-center gap-2">
        <WkIcon name="ExternalLink" size={14} className="text-[var(--wk-text-muted)]" />
        <span className="text-[12px] font-black text-[var(--wk-text)]">{label}</span>
      </div>
      <p className="truncate font-mono text-[11px] text-[var(--wk-text-muted)]">{url}</p>
    </a>
  );
}

function SeoActionButton({
  label,
  icon,
  description,
  running,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  description: string;
  running: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <WkIcon name={icon as never} size={16} className="text-[var(--wk-text-muted)]" />
        <span className="text-[13px] font-bold text-[var(--wk-text)]">{label}</span>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className="wk-button wk-button-soft wk-button-sm flex w-full items-center justify-center gap-1.5"
      >
        <WkIcon name={running ? "Loader" : "Play"} size={14} />
        {running ? "Running..." : "Run"}
      </button>
    </div>
  );
}
