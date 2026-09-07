import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getFieldSubmissionIntake,
  listFieldSubmissionIntakes,
  startFieldSubmissionMessage,
  type FieldIntakeDetail,
  type FieldIntakeSummary,
} from "@/services/fieldNewsroom";

function when(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function label(value: string | null | undefined): string {
  return String(value ?? "unknown").replaceAll("_", " ");
}

export default function AdminFieldPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSubmissionId = searchParams.get("submission");
  const [rows, setRows] = useState<FieldIntakeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FieldIntakeDetail | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listFieldSubmissionIntakes();
      setRows(next);
      const requested = requestedSubmissionId
        && next.some((row) => row.submission_resource_id === requestedSubmissionId)
        ? requestedSubmissionId
        : null;
      setSelectedId((current) => requested
        ?? (current && next.some((row) => row.submission_resource_id === current)
          ? current
          : next[0]?.submission_resource_id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Field intake could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [requestedSubmissionId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setLoadingDetail(true);
    setError(null);
    getFieldSubmissionIntake(selectedId)
      .then((next) => { if (!cancelled) { setDetail(next); setMessageBody(""); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Field intake could not be opened."); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const selectSubmission = (submissionResourceId: string) => {
    setSelectedId(submissionResourceId);
    setSearchParams({ submission: submissionResourceId }, { replace: true });
  };

  const handleMessage = async () => {
    if (!detail?.can_message_contributor || !messageBody.trim() || starting) return;
    setStarting(true);
    setError(null);
    try {
      const result = await startFieldSubmissionMessage(detail, messageBody.trim());
      navigate(`/messages?conversation=${encodeURIComponent(result.conversation_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The contributor could not be messaged.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--wk-divider)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black tracking-[0.18em] text-[var(--wk-brand)]">Newsroom</div>
          <h1 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-[var(--wk-text)]">Field</h1>
          <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-[var(--wk-text-muted)]">Review Field intake authority and move approved contributor follow-up into canonical Messages.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-50">{loading ? "Refreshing..." : "Refresh"}</button>
      </header>

      {error ? <div className="rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-4 py-3 text-[12px] font-bold text-[var(--wk-danger)]">{error}</div> : null}

      <div className="overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] lg:grid lg:min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="border-b border-[var(--wk-divider)] lg:border-b-0 lg:border-r" aria-label="Field submissions">
          {loading ? (
            <div className="space-y-2 p-3" aria-busy="true">{[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" />)}</div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center px-6 text-center text-[11px] font-bold text-[var(--wk-text-muted)]">No Field submissions are available.</div>
          ) : (
            <div className="divide-y divide-[var(--wk-divider)]">{rows.map((row) => (
              <button key={row.submission_resource_id} type="button" onClick={() => selectSubmission(row.submission_resource_id)} className={`w-full px-4 py-4 text-left transition-colors ${selectedId === row.submission_resource_id ? "bg-[var(--wk-brand-soft)]" : "hover:bg-[var(--wk-surface-raised)]"}`}>
                <div className="flex items-center justify-between gap-3"><span className="truncate text-[12px] font-black text-[var(--wk-text)]">{row.submission_reference}</span><span className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">{label(row.submission_state)}</span></div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-[var(--wk-text-muted)]"><span>{label(row.newsroom_identity_mode)} identity</span><span>•</span><span>{row.follow_up_permission === "allowed" ? "follow-up allowed" : "no follow-up"}</span>{row.preferred_contact_channel ? <><span>•</span><span>{label(row.preferred_contact_channel)}</span></> : null}</div>
              </button>
            ))}</div>
          )}
        </section>

        <section className="min-w-0 p-5 sm:p-6" aria-label="Field intake detail">
          {!selectedId ? (
            <div className="flex min-h-[420px] items-center justify-center text-center text-[12px] text-[var(--wk-text-muted)]">Select a Field submission.</div>
          ) : loadingDetail || !detail ? (
            <div className="min-h-[420px] animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]" aria-busy="true" />
          ) : (
            <div className="space-y-5">
              <div><div className="text-[10px] font-black tracking-[0.14em] text-[var(--wk-text-faint)]">{detail.submission_reference}</div><h2 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-[var(--wk-text)]">Field intake</h2></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
                ["State", label(detail.submission_state)], ["Revision", String(detail.current_revision)], ["Identity", detail.contributor_identity_redacted ? "Restricted" : label(detail.newsroom_identity_mode)], ["Follow-up", detail.follow_up_permission === "allowed" ? "Allowed" : "Not allowed"], ["Channel", detail.preferred_contact_channel ? label(detail.preferred_contact_channel) : "Not selected"], ["Sensitivity", label(detail.declared_sensitivity)], ["Source protection", label(detail.source_protection_request)], ["Received", when(detail.received_at)], ["Submitted", when(detail.submitted_at)],
              ].map(([key, value]) => <div key={key} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4"><div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{key}</div><div className="mt-1 text-[12px] font-black capitalize text-[var(--wk-text)]">{value}</div></div>)}</div>
              <section className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
                <div className="text-[12px] font-black text-[var(--wk-text)]">Message contributor</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-muted)]">The first Message references this Field Submission without copying protected intake content into the Conversation.</p>
                {detail.can_message_contributor ? <><textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={5} maxLength={10000} placeholder="Ask for the follow-up information the newsroom needs." className="mt-4 w-full resize-y rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[12px] leading-relaxed text-[var(--wk-text)] outline-none transition-colors placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)]" /><div className="mt-3 flex justify-end"><button type="button" onClick={() => void handleMessage()} disabled={!messageBody.trim() || starting} className="wk-button wk-button-sm wk-button-primary disabled:opacity-50">{starting ? "Opening Messages..." : "Message contributor"}</button></div></> : <div className="mt-4 rounded-xl bg-[var(--wk-surface-raised)] px-4 py-3 text-[11px] font-bold text-[var(--wk-text-muted)]">Messages follow-up is not currently authorized for this submission.</div>}
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
