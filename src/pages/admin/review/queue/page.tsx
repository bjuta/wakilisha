import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon, type WkIconName } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  formatReviewCount,
  loadReviewCommandCenter,
  type FieldDictionaryRow,
  type MediaReviewRow,
  type PromotionEventRow,
  type ReviewArtifactSample,
  type ReviewCommandCenterData,
  type ReviewDecisionSample,
  type ReviewWorkstream,
  type StagingSummaryRow,
} from "@/services/adminReviewCommandCenter";

type LoadState = "loading" | "ready" | "error";
type Panel = "decisions" | "artifacts" | "fields" | "media" | "staging" | "events";

const PANEL_BUTTONS: Array<{ key: Panel; label: string; icon: WkIconName }> = [
  { key: "decisions", label: "Decisions", icon: "GitPullRequest" },
  { key: "artifacts", label: "Artifacts", icon: "Archive" },
  { key: "fields", label: "Fields", icon: "Braces" },
  { key: "media", label: "Media", icon: "Image" },
  { key: "staging", label: "Staging", icon: "Database" },
  { key: "events", label: "Events", icon: "Clock" },
];

export default function AdminReviewQueuePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<ReviewCommandCenterData | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>("decisions");

  useEffect(() => {
    let alive = true;
    setState("loading");
    loadReviewCommandCenter()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setState("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load review command center.");
        setState("error");
      });
    return () => { alive = false; };
  }, []);

  const activeWork = useMemo(() => {
    if (!data) return 0;
    return data.totals.openDecisions + data.totals.reviewArtifacts + data.totals.stagingNeedsReview + data.totals.blockedStaging + data.totals.unknownFields;
  }, [data]);

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-9 w-80 animate-pulse rounded bg-wk-surface-raised" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />)}
        </div>
        <div className="h-96 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
          <WkIcon name="AlertCircle" size={28} />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text">Could not load review command center</h2>
        <p className="mx-auto mt-2 max-w-xl text-[13px] text-wk-text-muted">{error || "Some Phase 0–7 tables may not exist in this environment yet."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Review</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">Review Command Center</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            One cockpit for import artifacts, resolver decisions, media candidates, postmeta classification, staging exceptions, and promotion audit events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => navigate("/admin/imports/review-artifacts")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="Archive" size={14} /> Artifacts
          </button>
          <button onClick={() => navigate("/admin/settings/charts/review-queue")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="ArrowRight" size={14} /> Charts Review
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wk-surface text-wk-brand">
            <WkIcon name="Command" size={20} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-wk-text">Operational, not decorative</div>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              This page reads the live resolver/audit tables created across Phases 0–7. It does not pretend to resolve records yet; guarded write actions should be added only behind explicit resolver endpoints.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active review load" value={activeWork} icon="Activity" tone={activeWork > 0 ? "danger" : "success"} />
        <KpiCard label="Open decisions" value={data.totals.openDecisions} icon="GitPullRequest" tone={data.totals.openDecisions > 0 ? "danger" : "success"} />
        <KpiCard label="Artifacts preserved" value={data.totals.reviewArtifacts} icon="Archive" tone="warning" />
        <KpiCard label="Promotion events" value={data.totals.promotionEvents} icon="Clock" tone="neutral" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Staging needs review" value={data.totals.stagingNeedsReview} detail="Rows still awaiting resolver attention" />
        <MiniStat label="Blocked staging" value={data.totals.blockedStaging} detail="Rows that cannot be promoted yet" />
        <MiniStat label="Unknown/review fields" value={data.totals.unknownFields} detail="Postmeta keys needing policy" />
        <MiniStat label="Media review items" value={data.totals.unresolvedMedia} detail="Unresolved media candidates" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <WkSurface className="overflow-hidden p-0">
          <SectionHeader title="Workstreams" subtitle="Prioritized queues created by the import/resolver phases." icon="Layers" />
          <div className="divide-y divide-wk-border">
            {data.workstreams.map((stream) => <WorkstreamRow key={stream.key} stream={stream} onOpen={(path) => navigate(path)} />)}
          </div>
        </WkSurface>

        <WkSurface className="overflow-hidden p-0">
          <div className="border-b border-wk-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <WkIcon name="PanelTop" size={16} className="text-wk-brand" />
                  <h2 className="text-[14px] font-bold text-wk-text">Review panels</h2>
                </div>
                <p className="mt-1 text-[12px] text-wk-text-muted">Recent examples from each operational review stream.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PANEL_BUTTONS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setPanel(item.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${panel === item.key ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised"}`}
                >
                  <WkIcon name={item.icon} size={12} /> {item.label}
                </button>
              ))}
            </div>
          </div>
          <PanelContent panel={panel} data={data} />
        </WkSurface>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: WkIconName; tone: "danger" | "warning" | "neutral" | "success" }) {
  const cls = tone === "danger" ? "bg-wk-danger-soft text-wk-danger" : tone === "warning" ? "bg-wk-warning-soft text-wk-warning" : tone === "success" ? "bg-wk-success-soft text-wk-success" : "bg-wk-surface-raised text-wk-text-muted";
  return (
    <WkSurface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[26px] font-black tracking-tight text-wk-text">{formatReviewCount(value)}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-wk-text-faint">{label}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cls}`}><WkIcon name={icon} size={19} /></div>
      </div>
    </WkSurface>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3">
      <div className="text-[18px] font-black text-wk-text">{formatReviewCount(value)}</div>
      <div className="mt-0.5 text-[12px] font-bold text-wk-text">{label}</div>
      <div className="text-[11px] text-wk-text-muted">{detail}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: WkIconName }) {
  return (
    <div className="border-b border-wk-border p-4">
      <div className="flex items-center gap-2"><WkIcon name={icon} size={16} className="text-wk-brand" /><h2 className="text-[14px] font-bold text-wk-text">{title}</h2></div>
      <p className="mt-1 text-[12px] text-wk-text-muted">{subtitle}</p>
    </div>
  );
}

function WorkstreamRow({ stream, onOpen }: { stream: ReviewWorkstream; onOpen: (path: string) => void }) {
  const tone = stream.severity === "danger" ? "bg-wk-danger-soft text-wk-danger" : stream.severity === "warning" ? "bg-wk-warning-soft text-wk-warning" : stream.severity === "success" ? "bg-wk-success-soft text-wk-success" : "bg-wk-surface-raised text-wk-text-muted";
  return (
    <div className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-bold text-wk-text">{stream.label}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${tone}`}>{formatReviewCount(stream.count)}</span>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{stream.description}</p>
          <p className="mt-2 text-[12px] leading-5 text-wk-text"><span className="font-bold">Next:</span> {stream.nextAction}</p>
        </div>
        {stream.path && (
          <button onClick={() => onOpen(stream.path!)} className="wk-button wk-button-ghost wk-button-sm shrink-0 whitespace-nowrap">
            Open <WkIcon name="ArrowRight" size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function PanelContent({ panel, data }: { panel: Panel; data: ReviewCommandCenterData }) {
  if (panel === "decisions") return <DecisionRows rows={data.decisionSamples} />;
  if (panel === "artifacts") return <ArtifactRows rows={data.artifactSamples} />;
  if (panel === "fields") return <FieldRows rows={data.fieldDictionary} />;
  if (panel === "media") return <MediaRows rows={data.mediaRows} />;
  if (panel === "staging") return <StagingRows rows={data.stagingSummary} />;
  return <EventRows rows={data.promotionEvents} />;
}

function DecisionRows({ rows }: { rows: ReviewDecisionSample[] }) {
  if (!rows.length) return <EmptyState title="No decision samples" body="Resolution decisions will appear here after resolver phases run." />;
  return <div className="divide-y divide-wk-border">{rows.map((row) => <div key={row.id} className="p-4"><RowTop left={row.source_title || row.source_slug || row.id} right={row.decision || "decision"} /><p className="mt-1 text-[12px] text-wk-text-muted">{row.entity_type || "entity"} → {row.target_title || row.target_slug || "unresolved"}</p><p className="mt-2 text-[12px] leading-5 text-wk-text-faint">{row.reason || "No reason recorded."}</p></div>)}</div>;
}

function ArtifactRows({ rows }: { rows: ReviewArtifactSample[] }) {
  if (!rows.length) return <EmptyState title="No artifact samples" body="Import artifacts will appear after WordPress staging/finalization runs." />;
  return <div className="divide-y divide-wk-border">{rows.map((row) => <div key={row.id} className="p-4"><RowTop left={row.title || row.source_record_id || row.id} right={row.artifact_type || "artifact"} /><p className="mt-1 text-[12px] text-wk-text-muted">{row.source_kind || "source"} · {row.review_status || "needs_review"}</p><p className="mt-2 text-[12px] leading-5 text-wk-text-faint">{row.notes || "Preserved for resolver review."}</p></div>)}</div>;
}

function FieldRows({ rows }: { rows: FieldDictionaryRow[] }) {
  if (!rows.length) return <EmptyState title="No field dictionary rows" body="Run Phase 5 to classify WordPress postmeta keys." />;
  return <div className="divide-y divide-wk-border">{rows.map((row) => <div key={row.id} className="p-4"><RowTop left={row.meta_key} right={row.promotion_policy} /><p className="mt-1 text-[12px] text-wk-text-muted">{row.field_group} · {formatReviewCount(row.occurrence_count)} occurrences · {formatReviewCount(row.object_count)} objects</p><p className="mt-2 text-[12px] leading-5 text-wk-text-faint">{row.reason || "No classification reason recorded."}</p></div>)}</div>;
}

function MediaRows({ rows }: { rows: MediaReviewRow[] }) {
  if (!rows.length) return <EmptyState title="No media rows" body="Run Phase 6 to operationalize WordPress media assets." />;
  return <div className="divide-y divide-wk-border">{rows.map((row) => <div key={row.id} className="p-4"><RowTop left={`${row.entity_type || "entity"}/${row.entity_slug || "unattached"}`} right={row.role || "media"} /><p className="mt-1 truncate text-[12px] text-wk-text-muted">{row.url || "No URL"}</p><p className="mt-2 text-[12px] text-wk-text-faint">{row.source || "source"} · {row.status || "status"}</p></div>)}</div>;
}

function StagingRows({ rows }: { rows: StagingSummaryRow[] }) {
  if (!rows.length) return <EmptyState title="No staging summary" body="Staged records will appear after import staging runs." />;
  return <div className="overflow-x-auto"><table className="w-full text-left text-[12px]"><thead className="border-b border-wk-border bg-wk-surface-raised text-[10px] uppercase tracking-wider text-wk-text-faint"><tr><th className="px-4 py-3">Target</th><th className="px-4 py-3 text-right">Ready</th><th className="px-4 py-3 text-right">Review</th><th className="px-4 py-3 text-right">Blocked</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-wk-border">{rows.map((row) => <tr key={row.target_entity}><td className="px-4 py-3 font-semibold text-wk-text">{row.target_entity}</td><td className="px-4 py-3 text-right text-wk-success">{formatReviewCount(row.ready)}</td><td className="px-4 py-3 text-right text-wk-warning">{formatReviewCount(row.needs_review)}</td><td className="px-4 py-3 text-right text-wk-danger">{formatReviewCount(row.blocked)}</td><td className="px-4 py-3 text-right font-bold text-wk-text">{formatReviewCount(row.total)}</td></tr>)}</tbody></table></div>;
}

function EventRows({ rows }: { rows: PromotionEventRow[] }) {
  if (!rows.length) return <EmptyState title="No promotion events" body="Promotion audit events will appear after resolver/promoter phases run." />;
  return <div className="divide-y divide-wk-border">{rows.map((row) => <div key={row.id} className="p-4"><RowTop left={row.target_table || "target"} right={row.event_type || "event"} /><p className="mt-1 text-[12px] text-wk-text-muted">{row.target_record_id || "record"}</p><p className="mt-2 text-[12px] leading-5 text-wk-text-faint">{row.message || "No message recorded."}</p></div>)}</div>;
}

function RowTop({ left, right }: { left: string; right?: string | null }) {
  return <div className="flex items-start justify-between gap-3"><div className="min-w-0 truncate text-[13px] font-bold text-wk-text">{left}</div>{right && <span className="shrink-0 rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-text-muted">{right}</span>}</div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="p-8 text-center"><WkIcon name="Inbox" size={24} className="mx-auto mb-3 text-wk-text-faint" /><div className="text-[13px] font-bold text-wk-text">{title}</div><p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-wk-text-muted">{body}</p></div>;
}
