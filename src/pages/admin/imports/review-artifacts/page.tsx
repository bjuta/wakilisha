import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  formatCount,
  loadImportReviewArtifactDashboard,
  type ReviewArtifactDashboard,
  type ReviewArtifactSample,
  type StagingBucket,
} from "@/services/importReviewArtifacts";

type LoadState = "loading" | "ready" | "error";
type SampleFilter = "all" | "entity_relationships" | "custom_fields" | "artist_relationships" | "media_assets" | "artists";

const SAMPLE_FILTERS: { key: SampleFilter; label: string }[] = [
  { key: "all", label: "All samples" },
  { key: "entity_relationships", label: "Relationships" },
  { key: "custom_fields", label: "Custom fields" },
  { key: "artist_relationships", label: "Artist graph" },
  { key: "media_assets", label: "Media" },
  { key: "artists", label: "Artists" },
];

export default function AdminImportReviewArtifactsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>("loading");
  const [dashboard, setDashboard] = useState<ReviewArtifactDashboard | null>(null);
  const [error, setError] = useState("");
  const [sampleFilter, setSampleFilter] = useState<SampleFilter>("all");
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    loadImportReviewArtifactDashboard()
      .then((data) => {
        if (!alive) return;
        setDashboard(data);
        setState("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load review artifacts.");
        setState("error");
      });
    return () => { alive = false; };
  }, []);

  const filteredSamples = useMemo(() => {
    const samples = dashboard?.samples ?? [];
    if (sampleFilter === "all") return samples;
    return samples.filter((sample) => sample.artifact_type === sampleFilter);
  }, [dashboard?.samples, sampleFilter]);

  const relationshipTotal = dashboard?.reviewBuckets
    .filter((bucket) => bucket.key.includes("relationship"))
    .reduce((sum, bucket) => sum + bucket.count, 0) ?? 0;
  const customFieldTotal = dashboard?.reviewBuckets.find((bucket) => bucket.key === "custom_fields")?.count ?? 0;
  const mediaStaging = dashboard?.stagingBuckets.find((bucket) => bucket.target_entity === "media_assets")?.total ?? 0;
  const artistNeedsReview = dashboard?.stagingBuckets.find((bucket) => bucket.target_entity === "artists")?.needs_review ?? 0;

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-8 w-72 animate-pulse rounded bg-wk-surface-raised" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />)}
        </div>
        <div className="h-96 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />
      </div>
    );
  }

  if (state === "error" || !dashboard) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
          <WkIcon name="AlertCircle" size={28} />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text">Could not load review artifacts</h2>
        <p className="mx-auto mt-2 max-w-xl text-[13px] text-wk-text-muted">{error || "The review artifact tables may not exist in this environment yet."}</p>
        <button onClick={() => navigate("/admin/imports")} className="mt-4 wk-button wk-button-primary wk-button-sm whitespace-nowrap">Back to imports</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            <button onClick={() => navigate("/admin/imports")} className="hover:text-wk-brand-600">Imports</button>
            <WkIcon name="ChevronRight" size={12} />
            <span>Review Artifacts</span>
          </div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">Import Review Artifacts</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            Read-only visibility over preserved WordPress relationships, postmeta, media, and unresolved registry records. Nothing on this page promotes or mutates production data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate("/admin/review/queue")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="ClipboardList" size={14} /> Review Queue
          </button>
          <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="List" size={14} /> Import Jobs
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-wk-warning/20 bg-wk-warning-soft p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wk-surface text-wk-warning">
            <WkIcon name="Lock" size={18} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-wk-text">Phase 0 is visibility only</div>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              These records are preserved evidence from the migration pipeline. Promotion into registry, media, taxonomy, and graph tables comes later through explicit resolver phases.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Review artifacts" value={dashboard.totalReviewArtifacts} icon="Archive" tone="brand" />
        <KpiCard label="Staging records" value={dashboard.totalStagingRecords} icon="Database" tone="neutral" />
        <KpiCard label="Relationship artifacts" value={relationshipTotal} icon="GitBranch" tone="warning" />
        <KpiCard label="Custom fields" value={customFieldTotal} icon="Braces" tone="danger" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Media staged" value={mediaStaging} detail="Attachment and image candidates" />
        <MiniStat label="Artists needing review" value={artistNeedsReview} detail="Merge/create/enrich candidates" />
        <MiniStat label="Latest runs shown" value={dashboard.latestRuns.length} detail="Most recent ingestion jobs" />
        <MiniStat label="Sample rows" value={dashboard.samples.length} detail="Recent preserved artifacts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <div className="space-y-6">
          <WkSurface className="overflow-hidden p-0">
            <SectionHeader title="Artifact buckets" subtitle="What is preserved and what resolver work comes next." icon="Layers" />
            <div className="divide-y divide-wk-border">
              {dashboard.reviewBuckets.map((bucket) => (
                <div key={bucket.key} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-bold text-wk-text">{bucket.label}</h3>
                        <StatusPill status={bucket.status} />
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{bucket.description}</p>
                      <p className="mt-2 text-[12px] leading-5 text-wk-text"><span className="font-bold">Next:</span> {bucket.nextAction}</p>
                    </div>
                    <div className="shrink-0 rounded-xl border border-wk-border bg-wk-surface-raised px-4 py-3 text-right">
                      <div className="text-[20px] font-black text-wk-text">{formatCount(bucket.count)}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">records</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WkSurface>

          <WkSurface className="overflow-hidden p-0">
            <SectionHeader title="Staging map" subtitle="What exists in wk_import_staging_records by target and status." icon="Table" />
            {dashboard.stagingBuckets.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-wk-border bg-wk-surface-raised text-[10px] uppercase tracking-wider text-wk-text-faint">
                    <tr>
                      <th className="px-4 py-3 font-bold">Target</th>
                      <th className="px-4 py-3 text-right font-bold">Ready</th>
                      <th className="px-4 py-3 text-right font-bold">Needs review</th>
                      <th className="px-4 py-3 text-right font-bold">Blocked</th>
                      <th className="px-4 py-3 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wk-border">
                    {dashboard.stagingBuckets.map((bucket) => <StagingRow key={bucket.target_entity} bucket={bucket} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No staging records found" body="Run the WordPress database staging step before using this dashboard." />
            )}
          </WkSurface>
        </div>

        <div className="space-y-6">
          <WkSurface className="overflow-hidden p-0">
            <SectionHeader title="Latest import runs" subtitle="Recent jobs that produced staging or review evidence." icon="Clock" />
            {dashboard.latestRuns.length ? (
              <div className="divide-y divide-wk-border">
                {dashboard.latestRuns.map((run) => (
                  <button key={run.id} onClick={() => navigate(`/admin/imports/jobs/${run.id}`)} className="block w-full p-4 text-left transition-colors hover:bg-wk-surface-raised">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold text-wk-text">{run.source_name || run.id}</div>
                        <div className="mt-1 text-[11px] text-wk-text-muted">{run.source_kind || "unknown source"} · {run.id.slice(0, 8)}</div>
                      </div>
                      <StatusText status={run.status || "unknown"} />
                    </div>
                    <div className="mt-2 text-[11px] text-wk-text-faint">
                      {run.created_at ? new Date(run.created_at).toLocaleString() : "No timestamp"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No import runs found" body="Once staging runs exist, the latest jobs will appear here." />
            )}
          </WkSurface>

          <WkSurface className="overflow-hidden p-0">
            <div className="border-b border-wk-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <WkIcon name="Search" size={16} className="text-wk-brand" />
                    <h2 className="text-[14px] font-bold text-wk-text">Recent artifact samples</h2>
                  </div>
                  <p className="mt-1 text-[12px] text-wk-text-muted">A small window into preserved rows, not the full dataset.</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {SAMPLE_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setSampleFilter(filter.key)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${sampleFilter === filter.key ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised"}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredSamples.length ? (
              <div className="divide-y divide-wk-border">
                {filteredSamples.map((sample) => (
                  <SampleRow
                    key={sample.id}
                    sample={sample}
                    expanded={expandedSampleId === sample.id}
                    onToggle={() => setExpandedSampleId((current) => current === sample.id ? null : sample.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="No samples in this filter" body="The selected artifact type has no recent rows in the sample window." />
            )}
          </WkSurface>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: Parameters<typeof WkIcon>[0]["name"]; tone: "brand" | "warning" | "danger" | "neutral" }) {
  const toneClass = tone === "brand" ? "bg-wk-brand-soft text-wk-brand" : tone === "warning" ? "bg-wk-warning-soft text-wk-warning" : tone === "danger" ? "bg-wk-danger-soft text-wk-danger" : "bg-wk-surface-raised text-wk-text-muted";
  return (
    <WkSurface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[26px] font-black tracking-tight text-wk-text">{formatCount(value)}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-wk-text-faint">{label}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
          <WkIcon name={icon} size={19} />
        </div>
      </div>
    </WkSurface>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3">
      <div className="text-[18px] font-black text-wk-text">{formatCount(value)}</div>
      <div className="mt-0.5 text-[12px] font-bold text-wk-text">{label}</div>
      <div className="text-[11px] text-wk-text-muted">{detail}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: Parameters<typeof WkIcon>[0]["name"] }) {
  return (
    <div className="border-b border-wk-border p-4">
      <div className="flex items-center gap-2">
        <WkIcon name={icon} size={16} className="text-wk-brand" />
        <h2 className="text-[14px] font-bold text-wk-text">{title}</h2>
      </div>
      <p className="mt-1 text-[12px] text-wk-text-muted">{subtitle}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "preserved" ? "bg-wk-brand-soft text-wk-brand" : status === "empty" ? "bg-wk-surface-raised text-wk-text-muted" : "bg-wk-warning-soft text-wk-warning";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${cls}`}>{status.replace("_", " ")}</span>;
}

function StatusText({ status }: { status: string }) {
  const cls = status === "finalized" || status === "completed" ? "text-wk-success" : status === "failed" ? "text-wk-danger" : status === "staged" ? "text-wk-warning" : "text-wk-text-muted";
  return <span className={`shrink-0 text-[11px] font-black uppercase tracking-wider ${cls}`}>{status.replace("_", " ")}</span>;
}

function StagingRow({ bucket }: { bucket: StagingBucket }) {
  return (
    <tr className="hover:bg-wk-surface-raised/60">
      <td className="px-4 py-3 font-semibold text-wk-text">{bucket.target_entity}</td>
      <td className="px-4 py-3 text-right text-wk-success">{formatCount(bucket.ready)}</td>
      <td className="px-4 py-3 text-right text-wk-warning">{formatCount(bucket.needs_review)}</td>
      <td className="px-4 py-3 text-right text-wk-danger">{formatCount(bucket.blocked)}</td>
      <td className="px-4 py-3 text-right font-bold text-wk-text">{formatCount(bucket.total)}</td>
    </tr>
  );
}

function SampleRow({ sample, expanded, onToggle }: { sample: ReviewArtifactSample; expanded: boolean; onToggle: () => void }) {
  const mappedKeys = Object.keys(sample.mapped_record ?? {}).slice(0, 5);
  return (
    <div className="p-4">
      <button onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{sample.artifact_type}</span>
            <span className="text-[11px] text-wk-text-faint">{sample.review_status || "needs_review"}</span>
          </div>
          <div className="mt-2 truncate text-[13px] font-bold text-wk-text">{sample.title || sample.source_record_id || sample.id}</div>
          <div className="mt-1 text-[11px] text-wk-text-muted">{sample.source_kind || "unknown"} · {sample.source_record_id || "no source id"}</div>
          {mappedKeys.length > 0 && <div className="mt-2 text-[11px] text-wk-text-faint">Mapped keys: {mappedKeys.join(", ")}</div>}
        </div>
        <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} className="mt-1 shrink-0 text-wk-text-muted" />
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
          {sample.notes && <p className="text-[12px] leading-5 text-wk-text-muted">{sample.notes}</p>}
          <JsonBlock label="mapped_record" value={sample.mapped_record} />
          <JsonBlock label="raw_record" value={sample.raw_record} />
        </div>
      )}
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-wk-text-faint">{label}</div>
      <pre className="max-h-56 overflow-auto rounded-lg bg-wk-surface p-3 text-[11px] leading-5 text-wk-text-muted">{JSON.stringify(value ?? {}, null, 2)}</pre>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-8 text-center">
      <WkIcon name="Inbox" size={24} className="mx-auto mb-3 text-wk-text-faint" />
      <div className="text-[13px] font-bold text-wk-text">{title}</div>
      <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-wk-text-muted">{body}</p>
    </div>
  );
}
