import { useCallback, useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { RelationshipReviewDrawer } from "./RelationshipReviewDrawer";
import {
  acceptMissingArtistIntake,
  createMissingArtistIntake,
  loadRegistryKnowledgeReviewSnapshot,
  type MissingArtistIntakeRow,
  type RegistryKnowledgeReviewSnapshot,
} from "@/services/registryKnowledgeReviewService";

type WorkspaceTab = "artists" | "endpoints" | "evidence" | "relationships";
type DialogMode = "create" | "accept";

const EMPTY_SNAPSHOT: RegistryKnowledgeReviewSnapshot = {
  missingArtists: [],
  endpoints: [],
  evidence: [],
  relationships: [],
};

function humanize(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Not set";
}

function StatusPill({ value }: { value: string }) {
  const tone = value.includes("ready") || value.includes("completed")
    ? "border-wk-success/20 bg-wk-success/10 text-wk-success"
    : value.includes("missing") || value.includes("resolve") || value.includes("evidence")
      ? "border-wk-warning/20 bg-wk-warning/10 text-wk-warning"
      : "border-wk-border bg-wk-surface-raised text-wk-text-muted";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${tone}`}>{humanize(value)}</span>;
}

function MetricCard({ label, value, icon, note }: { label: string; value: number; icon: string; note: string }) {
  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
      <div className="flex items-center gap-2 text-wk-text-muted">
        <WkIcon name={icon as never} size={15} />
        <span className="text-[11px] font-black uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-[26px] font-black tracking-tight text-wk-text">{value}</div>
      <p className="mt-1 text-[11px] text-wk-text-muted">{note}</p>
    </div>
  );
}

function ActionDialog({
  row,
  mode,
  busy,
  onClose,
  onSubmit,
}: {
  row: MissingArtistIntakeRow;
  mode: DialogMode;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { displayName: string; reason: string; sourceUrl: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(row.suggested_display_name);
  const [reason, setReason] = useState(
    mode === "create"
      ? `Create a reviewable Registry intake because ${row.legacy_slug} is required by ${row.affected_relationship_count} unresolved relationship${row.affected_relationship_count === 1 ? "" : "s"}.`
      : `Accept the reviewed intake for ${row.legacy_slug} and resolve only the exact matching relationship endpoints.`,
  );
  const [sourceUrl, setSourceUrl] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-wk-border bg-wk-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide text-wk-brand">{mode === "create" ? "Missing Artist Intake" : "Accept Into Registry"}</div>
            <h2 className="mt-1 text-[20px] font-black text-wk-text">{row.suggested_display_name}</h2>
            <p className="mt-1 text-[12px] text-wk-text-muted">Legacy slug: {row.legacy_slug}</p>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-2 text-wk-text-muted hover:bg-wk-surface-raised" aria-label="Close"><WkIcon name="X" size={16} /></button>
        </div>
        <div className="mt-5 space-y-4">
          {mode === "create" ? <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Proposed Display Name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label> : null}
          <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Review Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="w-full resize-none rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label>
          {mode === "create" ? <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Source URL <span className="font-normal">(optional)</span></span><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" /></label> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted">Cancel</button>
          <button onClick={() => onSubmit({ displayName, reason, sourceUrl })} disabled={busy || !reason.trim() || (mode === "create" && !displayName.trim())} className="inline-flex items-center gap-2 rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on disabled:opacity-40">
            {busy ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name={mode === "create" ? "Upload" : "Check"} size={14} />}
            {mode === "create" ? "Create Intake" : "Accept Artist"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRelationshipViewerPage() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [tab, setTab] = useState<WorkspaceTab>("artists");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: DialogMode; row: MissingArtistIntakeRow } | null>(null);
  const [relationshipReviewId, setRelationshipReviewId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await loadRegistryKnowledgeReviewSnapshot());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Registry review workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const normalized = query.trim().toLowerCase();
  const filteredMissingArtists = useMemo(() => !normalized ? snapshot.missingArtists : snapshot.missingArtists.filter((row) => row.legacy_slug.includes(normalized) || row.suggested_display_name.toLowerCase().includes(normalized)), [normalized, snapshot.missingArtists]);
  const filteredEndpoints = useMemo(() => !normalized ? snapshot.endpoints : snapshot.endpoints.filter((row) => row.legacy_slug.includes(normalized) || row.relationship_type.includes(normalized)), [normalized, snapshot.endpoints]);
  const filteredEvidence = useMemo(() => !normalized ? snapshot.evidence : snapshot.evidence.filter((row) => row.source_slug.includes(normalized) || row.target_slug.includes(normalized) || row.relationship_type.includes(normalized)), [normalized, snapshot.evidence]);
  const filteredRelationships = useMemo(() => !normalized ? snapshot.relationships : snapshot.relationships.filter((row) => row.source_slug.includes(normalized) || row.target_slug.includes(normalized) || row.relationship_type.includes(normalized)), [normalized, snapshot.relationships]);

  const handleDialogSubmit = async (values: { displayName: string; reason: string; sourceUrl: string }) => {
    if (!dialog) return;
    setActionBusy(true);
    setError(null);
    try {
      if (dialog.mode === "create") {
        await createMissingArtistIntake({ legacySlug: dialog.row.legacy_slug, displayName: values.displayName, reason: values.reason, sourceUrl: values.sourceUrl });
        setNotice(`Intake created for ${values.displayName}. It is ready for review.`);
      } else {
        if (!dialog.row.submission_id) throw new Error("This artist does not have an intake submission yet.");
        await acceptMissingArtistIntake({ submissionId: dialog.row.submission_id, reviewReason: values.reason });
        setNotice(`${dialog.row.suggested_display_name} was added to the Registry as Needs Review. Matching endpoints were resolved.`);
      }
      setDialog(null);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The Registry action failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const completeReview = async (message: string) => {
    setNotice(message);
    await load();
  };

  const tabs = [
    { id: "artists" as const, label: "Missing Artists", count: snapshot.missingArtists.length },
    { id: "endpoints" as const, label: "Endpoint Work", count: snapshot.endpoints.length },
    { id: "evidence" as const, label: "Evidence Work", count: snapshot.evidence.length },
    { id: "relationships" as const, label: "All Relationships", count: snapshot.relationships.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-[11px] font-black uppercase tracking-wider text-wk-brand">Registry Knowledge Layer</div><h1 className="mt-1 text-[24px] font-black tracking-tight text-wk-text">Knowledge Review</h1><p className="mt-1 max-w-2xl text-[13px] text-wk-text-muted">Resolve missing identities, review evidence, and decide what can become public.</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-bold text-wk-text-muted"><WkIcon name="RefreshCw" size={14} className={loading ? "animate-spin" : ""} />Refresh</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Missing Artists" value={snapshot.missingArtists.length} icon="Mic2" note="Canonical identities still needed" />
        <MetricCard label="Open Endpoints" value={snapshot.endpoints.length} icon="Link" note="Relationship sides not yet resolved" />
        <MetricCard label="Need Evidence" value={snapshot.evidence.filter((row) => row.evidence_work_state === "attach_evidence").length} icon="BookOpen" note="Resolved relationships without support" />
        <MetricCard label="Public Safe" value={snapshot.relationships.filter((row) => row.public_safe).length} icon="Globe" note="Relationships cleared for public use" />
      </div>

      {notice ? <div className="flex items-start gap-2 rounded-xl border border-wk-success/20 bg-wk-success/10 px-4 py-3 text-[12px] font-semibold text-wk-success"><WkIcon name="Check" size={15} />{notice}</div> : null}
      {error ? <div className="flex items-start gap-2 rounded-xl border border-wk-danger/20 bg-wk-danger/10 px-4 py-3 text-[12px] font-semibold text-wk-danger"><WkIcon name="AlertTriangle" size={15} />{error}</div> : null}

      <div className="rounded-xl border border-wk-border bg-wk-surface">
        <div className="flex flex-col gap-3 border-b border-wk-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-bold ${tab === item.id ? "bg-wk-brand-soft text-wk-brand" : "text-wk-text-muted hover:bg-wk-surface-raised"}`}>{item.label} <span className="ml-1 text-[10px] opacity-70">{item.count}</span></button>)}</div>
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 lg:w-80"><WkIcon name="Search" size={14} className="text-wk-text-faint" /><input value={query} onChange={(event) => setQuery(event.target.value.toLowerCase())} placeholder="Search this queue" className="min-w-0 flex-1 bg-transparent text-[12px] text-wk-text outline-none" />{query ? <button onClick={() => setQuery("")} aria-label="Clear Search"><WkIcon name="X" size={13} /></button> : null}</div>
        </div>

        {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-[13px] font-semibold text-wk-text-muted"><WkIcon name="Loader2" size={18} className="animate-spin" />Loading Registry knowledge</div> : null}

        {!loading && tab === "artists" ? <div className="divide-y divide-wk-border">{filteredMissingArtists.map((row) => <div key={row.legacy_slug} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-wk-brand-soft text-wk-brand"><WkIcon name="Mic2" size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[14px] font-black text-wk-text">{row.suggested_display_name}</h2><StatusPill value={row.intake_state} /></div><p className="mt-1 text-[11px] text-wk-text-muted">{row.legacy_slug} · {row.affected_relationship_count} relationship{row.affected_relationship_count === 1 ? "" : "s"}</p></div>{row.intake_state === "needs_intake" || row.intake_state === "needs_reassessment" ? <button onClick={() => setDialog({ mode: "create", row })} className="inline-flex items-center gap-2 rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand-on"><WkIcon name="Upload" size={14} />Create Intake</button> : row.intake_state === "intake_in_progress" && row.submission_id ? <button onClick={() => setDialog({ mode: "accept", row })} className="inline-flex items-center gap-2 rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand-on"><WkIcon name="Check" size={14} />Accept Artist</button> : <span className="text-[11px] font-bold text-wk-success">Review complete</span>}</div>)}</div> : null}

        {!loading && tab === "endpoints" ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-wk-surface-raised text-[10px] font-black uppercase tracking-wide text-wk-text-muted"><tr><th className="px-4 py-3">Missing Artist</th><th className="px-4 py-3">Side</th><th className="px-4 py-3">Relationship</th><th className="px-4 py-3">State</th></tr></thead><tbody className="divide-y divide-wk-border">{filteredEndpoints.map((row) => <tr key={`${row.relationship_id}-${row.missing_side}`}><td className="px-4 py-3 text-[12px] font-bold text-wk-text">{row.legacy_slug}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{row.missing_side}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{humanize(row.relationship_type)}</td><td className="px-4 py-3"><StatusPill value={row.endpoint_work_state} /></td></tr>)}</tbody></table></div> : null}

        {!loading && tab === "evidence" ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-wk-surface-raised text-[10px] font-black uppercase tracking-wide text-wk-text-muted"><tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Relationship</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-wk-border">{filteredEvidence.map((row) => <tr key={row.relationship_id}><td className="px-4 py-3 text-[12px] font-bold text-wk-text">{row.source_slug}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{humanize(row.relationship_type)}</td><td className="px-4 py-3 text-[12px] font-bold text-wk-text">{row.target_slug}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{row.evidence_count}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{row.has_plain_reason ? "Added" : "Missing"}</td><td className="px-4 py-3"><button onClick={() => setRelationshipReviewId(row.relationship_id)} className="inline-flex items-center gap-2 rounded-lg bg-wk-brand px-3 py-2 text-[11px] font-black text-wk-brand-on"><WkIcon name="FileCheck" size={13} />Review Relationship</button></td></tr>)}</tbody></table></div> : null}

        {!loading && tab === "relationships" ? <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead className="bg-wk-surface-raised text-[10px] font-black uppercase tracking-wide text-wk-text-muted"><tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Review</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Public</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-wk-border">{filteredRelationships.map((row) => <tr key={row.relationship_id}><td className="px-4 py-3 text-[12px] font-bold text-wk-text">{row.source_slug}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{humanize(row.relationship_type)}</td><td className="px-4 py-3 text-[12px] font-bold text-wk-text">{row.target_slug}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{humanize(row.review_status)}</td><td className="px-4 py-3 text-[12px] text-wk-text-muted">{row.evidence_count}</td><td className="px-4 py-3 text-[12px] font-bold text-wk-text-muted">{row.public_safe ? "Yes" : "No"}</td><td className="px-4 py-3"><button onClick={() => setRelationshipReviewId(row.relationship_id)} className="inline-flex items-center gap-2 rounded-lg border border-wk-brand px-3 py-2 text-[11px] font-black text-wk-brand"><WkIcon name="FileCheck" size={13} />Review Relationship</button></td></tr>)}</tbody></table></div> : null}
      </div>

      {dialog ? <ActionDialog row={dialog.row} mode={dialog.mode} busy={actionBusy} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} /> : null}
      {relationshipReviewId ? <RelationshipReviewDrawer relationshipId={relationshipReviewId} onClose={() => setRelationshipReviewId(null)} onComplete={completeReview} /> : null}
    </div>
  );
}