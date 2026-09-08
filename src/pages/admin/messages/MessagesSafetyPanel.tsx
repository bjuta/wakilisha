import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/design-system/primitives/Modal";
import { MessagesSafetyCandidateBControls } from "./MessagesSafetyCandidateBControls";
import {
  getMessagesSafetyCase,
  inspectMessageSafetyEvidence,
  listMessagesSafetyCases,
  resolveMessageSafetyCase,
  setMessageQuarantine,
  startMessagesSafetyReview,
  type MessagesSafetyCaseDetail,
  type MessagesSafetyCaseSummary,
  type MessagesSafetyEvidence,
  type MessagesSafetyTarget,
} from "@/services/messages";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under Review",
  resolved: "Resolved",
};

const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate_or_abuse: "Hate / Abuse",
  misinformation: "Misinformation",
  privacy: "Privacy",
  copyright: "Copyright",
  off_topic: "Off Topic",
  other: "Other",
};

function labelCategory(value: string): string {
  return CATEGORY_LABELS[value]
    ?? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function when(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function messageTarget(
  detail: MessagesSafetyCaseDetail | null,
): MessagesSafetyTarget | null {
  return detail?.targets.find((target) => target.target_type === "message") ?? null;
}

export function MessagesSafetyPanel() {
  const [cases, setCases] = useState<MessagesSafetyCaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessagesSafetyCaseDetail | null>(null);
  const [evidence, setEvidence] = useState<MessagesSafetyEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "under_review" | "resolved" | "all">("open");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceReason, setEvidenceReason] = useState("");
  const [quarantineOpen, setQuarantineOpen] = useState(false);
  const [quarantineReason, setQuarantineReason] = useState("");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCases(
        await listMessagesSafetyCases(
          statusFilter === "all" ? null : statusFilter,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Safety Cases could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadDetail = useCallback(async (caseId: string) => {
    setSelectedId(caseId);
    setEvidence(null);
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await getMessagesSafetyCase(caseId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Safety Case could not be loaded.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadCases();
    if (selectedId) {
      await loadDetail(selectedId);
    }
  }, [loadCases, loadDetail, selectedId]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const target = useMemo(
    () => messageTarget(detail),
    [detail],
  );

  const activeQuarantine = useMemo(
    () =>
      detail?.quarantine.find(
        (item) => item.status === "active" && item.message_id === target?.message_id,
      ) ?? null,
    [detail, target?.message_id],
  );

  async function performReviewStart() {
    if (!selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await startMessagesSafetyReview(selectedId);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Review could not be started.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function performEvidenceInspection() {
    if (!selectedId || !target?.message_id || !evidenceReason.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const inspectedEvidence = await inspectMessageSafetyEvidence(
        selectedId,
        target.message_id,
        evidenceReason.trim(),
      );
      setEvidenceReason("");
      setEvidenceOpen(false);
      await loadDetail(selectedId);
      setEvidence(inspectedEvidence);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Evidence could not be inspected.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function performQuarantine(quarantined: boolean) {
    const reason = quarantined ? quarantineReason.trim() : releaseReason.trim();
    if (!selectedId || !target?.message_id || !reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setMessageQuarantine(
        selectedId,
        target.message_id,
        quarantined,
        reason,
      );
      setQuarantineReason("");
      setReleaseReason("");
      setQuarantineOpen(false);
      setReleaseOpen(false);
      setEvidence(null);
      await refresh();
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Quarantine could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function performResolve() {
    if (!selectedId || !resolutionNote.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const hasEffectiveEnforcement = detail?.enforcements.some(
        (item) => item.status === "active"
          && (!item.effective_until || new Date(item.effective_until).getTime() > Date.now()),
      ) ?? false;
      await resolveMessageSafetyCase(
        selectedId,
        activeQuarantine ? "quarantine" : hasEffectiveEnforcement ? "enforced" : "no_action",
        resolutionNote.trim(),
      );
      setResolutionNote("");
      setResolveOpen(false);
      setEvidence(null);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Safety Case could not be resolved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 sm:p-5"
      aria-labelledby="messages-safety-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black tracking-[0.14em] text-[var(--wk-text-faint)]">
            Safety
          </div>
          <h2
            id="messages-safety-heading"
            className="mt-1 text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)]"
          >
            Message Safety Cases
          </h2>
          <p className="mt-1 max-w-[700px] text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Review reported Messages without exposing private content before deliberate evidence inspection.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-1">
          {(["open", "under_review", "resolved", "all"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setSelectedId(null);
                setDetail(null);
                setEvidence(null);
              }}
              className={`rounded-lg px-3 py-2 text-[10px] font-black ${
                statusFilter === status
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "text-[var(--wk-text-muted)]"
              }`}
            >
              {status === "all" ? "All" : STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-4 py-3 text-[11px] font-bold text-[var(--wk-danger)]">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-h-[320px] overflow-hidden rounded-2xl border border-[var(--wk-border)]">
          {loading ? (
            <div className="space-y-2 p-3" aria-busy="true">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-xl bg-[var(--wk-surface-raised)]"
                />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center px-6 text-center text-[11px] font-bold text-[var(--wk-text-muted)]">
              No Safety Cases match this view.
            </div>
          ) : (
            <div className="divide-y divide-[var(--wk-divider)]">
              {cases.map((item) => (
                <button
                  key={item.case_id}
                  type="button"
                  onClick={() => void loadDetail(item.case_id)}
                  className={`w-full px-4 py-4 text-left transition-colors hover:bg-[var(--wk-surface-raised)] ${
                    selectedId === item.case_id ? "bg-[var(--wk-brand-soft)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-black text-[var(--wk-text)]">
                        {labelCategory(item.policy_category)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.08em] text-[var(--wk-text-faint)]">
                        <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                        <span>{item.severity}</span>
                        <span>{item.source_kind.replaceAll("_", " ")}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-[var(--wk-text-faint)]">
                      {when(item.updated_at)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[9px] font-bold text-[var(--wk-text-muted)]">
                    <span>{item.message_target_count} Message</span>
                    <span>{item.media_target_count} Media file</span>
                    <span>{item.active_quarantine_count} quarantined</span>
                    <span>{item.active_enforcement_count} enforced</span>
                    <span>{item.open_appeal_count} appeals</span>
                    <span>{item.active_media_containment_count} Media contained</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-[320px] rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
          {!selectedId ? (
            <div className="flex min-h-[288px] items-center justify-center text-center text-[11px] font-bold text-[var(--wk-text-muted)]">
              Choose a Safety Case to review its safe summary.
            </div>
          ) : detailLoading || !detail ? (
            <div className="min-h-[288px] animate-pulse rounded-xl bg-[var(--wk-surface-raised)]" aria-busy="true" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[15px] font-black text-[var(--wk-text)]">
                    {labelCategory(detail.case.policy_category)}
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-[var(--wk-text-muted)]">
                    {STATUS_LABELS[detail.case.status] ?? detail.case.status} · {detail.case.severity}
                  </div>
                  <div className="mt-1 break-all text-[9px] font-bold text-[var(--wk-text-faint)]">
                    {detail.case.case_id}
                  </div>
                </div>

                {detail.case.status !== "resolved" && (
                  <div className="flex flex-wrap gap-2">
                    {detail.case.status === "open" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void performReviewStart()}
                        className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                      >
                        Start Review
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!target?.message_id || busy}
                      onClick={() => setEvidenceOpen(true)}
                      className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                    >
                      Inspect Evidence
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">
                    Disposition
                  </div>
                  <div className="mt-1 text-[11px] font-black capitalize text-[var(--wk-text)]">
                    {detail.case.current_disposition.replaceAll("_", " ")}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">
                    Source
                  </div>
                  <div className="mt-1 text-[11px] font-black capitalize text-[var(--wk-text)]">
                    {detail.case.source_kind.replaceAll("_", " ")}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">
                    Updated
                  </div>
                  <div className="mt-1 text-[11px] font-black text-[var(--wk-text)]">
                    {when(detail.case.updated_at)}
                  </div>
                </div>
              </div>

              <MessagesSafetyCandidateBControls
                detail={detail}
                onChanged={refresh}
              />

              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black text-[var(--wk-text)]">Exact Message Target</div>
                    <div className="mt-1 break-all text-[9px] font-bold text-[var(--wk-text-faint)]">
                      {target?.message_id ?? "No Message target"}
                    </div>
                  </div>
                  {activeQuarantine && (
                    <span className="rounded-full bg-[var(--wk-danger)]/10 px-2.5 py-1 text-[9px] font-black text-[var(--wk-danger)]">
                      QUARANTINED
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">
                  Message content stays hidden here. Inspect Evidence records the access reason before content appears.
                </p>
              </div>

              {evidence && (
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black text-[var(--wk-text)]">Inspected Evidence</div>
                    <span className="text-[9px] font-bold text-[var(--wk-text-faint)]">
                      {when(evidence.accepted_at)}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[var(--wk-text)]">
                    {evidence.body ?? "No Message body."}
                  </p>
                </div>
              )}

              {detail.case.status !== "resolved" && target?.message_id && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--wk-divider)] pt-4">
                  {activeQuarantine ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setReleaseOpen(true)}
                      className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                    >
                      Release Message
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setQuarantineOpen(true)}
                      className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                    >
                      Quarantine Message
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setResolveOpen(true)}
                    className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                  >
                    Resolve Case
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={evidenceOpen}
        onClose={() => !busy && setEvidenceOpen(false)}
        title="Inspect Evidence"
        maxWidth="md"
      >
        <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
          Record why this exact Message needs inspection. Adjacent conversation content will not be returned.
        </p>
        <textarea
          value={evidenceReason}
          onChange={(event) => setEvidenceReason(event.target.value)}
          rows={4}
          maxLength={2000}
          autoFocus
          placeholder="Reason for inspection"
          className="mt-4 w-full resize-none rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 text-[16px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] sm:text-[12px]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setEvidenceOpen(false)} className="wk-button wk-button-sm wk-button-ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={!evidenceReason.trim() || busy}
            onClick={() => void performEvidenceInspection()}
            className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
          >
            {busy ? "Recording..." : "Inspect Evidence"}
          </button>
        </div>
      </Modal>

      <Modal
        open={quarantineOpen}
        onClose={() => !busy && setQuarantineOpen(false)}
        title="Quarantine Message"
        maxWidth="md"
      >
        <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
          Quarantine removes this Message from ordinary delivery and read views without deleting its canonical record.
        </p>
        <textarea
          value={quarantineReason}
          onChange={(event) => setQuarantineReason(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Reason for quarantine"
          className="mt-4 w-full resize-none rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 text-[16px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] sm:text-[12px]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setQuarantineOpen(false)} className="wk-button wk-button-sm wk-button-ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={!quarantineReason.trim() || busy}
            onClick={() => void performQuarantine(true)}
            className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
          >
            {busy ? "Updating..." : "Quarantine Message"}
          </button>
        </div>
      </Modal>

      <Modal
        open={releaseOpen}
        onClose={() => !busy && setReleaseOpen(false)}
        title="Release Message"
        maxWidth="md"
      >
        <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
          Release restores ordinary Message eligibility while preserving the quarantine history.
        </p>
        <textarea
          value={releaseReason}
          onChange={(event) => setReleaseReason(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Reason for release"
          className="mt-4 w-full resize-none rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 text-[16px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] sm:text-[12px]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setReleaseOpen(false)} className="wk-button wk-button-sm wk-button-ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={!releaseReason.trim() || busy}
            onClick={() => void performQuarantine(false)}
            className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
          >
            {busy ? "Updating..." : "Release Message"}
          </button>
        </div>
      </Modal>

      <Modal
        open={resolveOpen}
        onClose={() => !busy && setResolveOpen(false)}
        title="Resolve Safety Case"
        maxWidth="md"
      >
        <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
          The final disposition will match the current quarantine state. Resolution does not delete evidence.
        </p>
        <textarea
          value={resolutionNote}
          onChange={(event) => setResolutionNote(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Resolution note"
          className="mt-4 w-full resize-none rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 text-[16px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)] sm:text-[12px]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setResolveOpen(false)} className="wk-button wk-button-sm wk-button-ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={!resolutionNote.trim() || busy}
            onClick={() => void performResolve()}
            className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
          >
            {busy ? "Resolving..." : "Resolve Case"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
