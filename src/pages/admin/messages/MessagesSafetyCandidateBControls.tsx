import { useEffect, useMemo, useState } from "react";
import {
  resolveMessagesSafetyAppeal,
  setMessagesSafetyEnforcement,
  setMessagesSafetyMediaContainment,
  startMessagesSafetyAppealReview,
  submitMessagesSafetyMediaScan,
  updateMessagesSafetyAssessment,
  type MessagesSafetyAppeal,
  type MessagesSafetyCaseDetail,
  type MessagesSafetyEnforcement,
  type MessagesSafetyEnforcementKind,
  type MessagesSafetyTarget,
} from "@/services/messages";

const ENFORCEMENT_KINDS: MessagesSafetyEnforcementKind[] = [
  "warning",
  "send_cooldown",
  "send_rate_limit",
  "links_restricted",
  "media_restricted",
  "conversation_start_restricted",
  "messaging_suspended",
  "messaging_removed",
];

const SEVERITY_ORDER = ["low", "medium", "high", "severe"] as const;
const KIND_MINIMUM_SEVERITY: Record<MessagesSafetyEnforcementKind, number> = {
  warning: 0,
  send_cooldown: 0,
  send_rate_limit: 0,
  links_restricted: 1,
  media_restricted: 1,
  conversation_start_restricted: 1,
  messaging_suspended: 2,
  messaging_removed: 3,
};

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function effective(enforcement: MessagesSafetyEnforcement): boolean {
  return enforcement.status === "active"
    && (!enforcement.effective_until || new Date(enforcement.effective_until).getTime() > Date.now());
}

function isoAfterHours(hours: string): string | null {
  const amount = Number(hours);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Date(Date.now() + amount * 60 * 60 * 1000).toISOString();
}

function messageTarget(detail: MessagesSafetyCaseDetail): MessagesSafetyTarget | null {
  return detail.targets.find((item) => item.target_type === "message" && item.message_id) ?? null;
}

function appealEnforcement(
  detail: MessagesSafetyCaseDetail,
  appeal: MessagesSafetyAppeal,
): MessagesSafetyEnforcement | null {
  return detail.enforcements.find((item) => item.enforcement_id === appeal.enforcement_id) ?? null;
}

export function MessagesSafetyCandidateBControls({
  detail,
  onChanged,
}: {
  detail: MessagesSafetyCaseDetail;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentReason, setAssessmentReason] = useState("");
  const [assessmentCategory, setAssessmentCategory] = useState(detail.case.policy_category);
  const [assessmentSeverity, setAssessmentSeverity] = useState(detail.case.severity);
  const [assessmentConfidence, setAssessmentConfidence] = useState(
    detail.case.confidence == null ? "" : String(detail.case.confidence),
  );
  const [kind, setKind] = useState<MessagesSafetyEnforcementKind>("warning");
  const [publicReason, setPublicReason] = useState("");
  const [internalReason, setInternalReason] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [appealAllowed, setAppealAllowed] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState("300");
  const [rateLimitCount, setRateLimitCount] = useState("5");
  const [rateLimitWindowSeconds, setRateLimitWindowSeconds] = useState("3600");
  const [containmentReason, setContainmentReason] = useState("");
  const [appealNotes, setAppealNotes] = useState<Record<string, { public: string; internal: string }>>({});
  const [modifiedKind, setModifiedKind] = useState<Record<string, MessagesSafetyEnforcementKind>>({});

  useEffect(() => {
    setAssessmentCategory(detail.case.policy_category);
    setAssessmentSeverity(detail.case.severity);
    setAssessmentConfidence(
      detail.case.confidence == null ? "" : String(detail.case.confidence),
    );
    setAssessmentReason("");
  }, [
    detail.case.case_id,
    detail.case.policy_category,
    detail.case.severity,
    detail.case.confidence,
  ]);

  const target = useMemo(() => messageTarget(detail), [detail]);
  const severityIndex = Math.max(0, SEVERITY_ORDER.indexOf(detail.case.severity as (typeof SEVERITY_ORDER)[number]));
  const allowedKinds = ENFORCEMENT_KINDS.filter((item) => KIND_MINIMUM_SEVERITY[item] <= severityIndex);
  const activeEnforcements = detail.enforcements.filter(effective);
  const mediaTargets = detail.targets.filter(
    (item) => item.target_type === "media_file" && item.media_file_object_id,
  );

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Messages Safety action failed.");
    } finally {
      setBusy(false);
    }
  }

  function enforcementShape(selectedKind: MessagesSafetyEnforcementKind) {
    return {
      effectiveUntil: selectedKind === "messaging_removed" ? null : isoAfterHours(durationHours),
      cooldownSeconds: selectedKind === "send_cooldown" ? Number(cooldownSeconds) : null,
      rateLimitCount: selectedKind === "send_rate_limit" ? Number(rateLimitCount) : null,
      rateLimitWindowSeconds: selectedKind === "send_rate_limit" ? Number(rateLimitWindowSeconds) : null,
    };
  }

  async function updateAssessment() {
    const confidence = assessmentConfidence.trim() ? Number(assessmentConfidence) : null;
    await run(() => updateMessagesSafetyAssessment(
      detail.case.case_id,
      assessmentCategory.trim(),
      assessmentSeverity,
      confidence,
      assessmentReason.trim(),
    ));
    setAssessmentReason("");
  }

  async function applyEnforcement() {
    if (!target?.message_id) return;
    const shape = enforcementShape(kind);
    await run(() => setMessagesSafetyEnforcement({
      caseId: detail.case.case_id,
      messageId: target.message_id!,
      enforcementKind: kind,
      active: true,
      effectiveUntil: shape.effectiveUntil,
      appealAllowed,
      publicReason: publicReason.trim(),
      internalReason: internalReason.trim(),
      cooldownSeconds: shape.cooldownSeconds,
      rateLimitCount: shape.rateLimitCount,
      rateLimitWindowSeconds: shape.rateLimitWindowSeconds,
    }));
    setPublicReason("");
    setInternalReason("");
  }

  async function releaseEnforcement(enforcement: MessagesSafetyEnforcement) {
    await run(() => setMessagesSafetyEnforcement({
      caseId: detail.case.case_id,
      messageId: enforcement.source_message_id,
      enforcementKind: enforcement.enforcement_kind,
      active: false,
      effectiveUntil: null,
      appealAllowed: false,
      publicReason: "This Messages restriction has been released.",
      internalReason: "Restriction released by Safety review.",
      cooldownSeconds: null,
      rateLimitCount: null,
      rateLimitWindowSeconds: null,
    }));
  }

  async function resolveAppeal(appeal: MessagesSafetyAppeal, resolution: "upheld" | "reversed" | "modified") {
    const notes = appealNotes[appeal.appeal_id] ?? { public: "", internal: "" };
    const original = appealEnforcement(detail, appeal);
    const nextKind = modifiedKind[appeal.appeal_id] ?? "warning";
    const shape = enforcementShape(nextKind);
    await run(() => resolveMessagesSafetyAppeal({
      appealId: appeal.appeal_id,
      resolution,
      resolutionPublicNote: notes.public.trim(),
      resolutionInternalNote: notes.internal.trim(),
      modifiedEnforcementKind: resolution === "modified" ? nextKind : null,
      modifiedEffectiveUntil: resolution === "modified" ? shape.effectiveUntil : null,
      modifiedAppealAllowed: resolution === "modified" ? Boolean(original?.appeal_allowed) : null,
      modifiedCooldownSeconds: resolution === "modified" ? shape.cooldownSeconds : null,
      modifiedRateLimitCount: resolution === "modified" ? shape.rateLimitCount : null,
      modifiedRateLimitWindowSeconds: resolution === "modified" ? shape.rateLimitWindowSeconds : null,
    }));
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4" data-wk-messages-safety-candidate-b>
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-brand)]">Enforcement & recovery</div>
        <div className="mt-1 text-[12px] font-black text-[var(--wk-text)]">Graduated Messages Safety authority</div>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">
          Assessment, subject-scoped enforcement, appeals and exact Media containment remain attached to this Safety Case.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-3 py-2 text-[10px] font-bold text-[var(--wk-danger)]">{error}</div>
      )}

      {detail.case.status === "under_review" && (
        <section className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
          <div className="text-[10px] font-black text-[var(--wk-text)]">Assessment</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={assessmentCategory}
              onChange={(event) => setAssessmentCategory(event.target.value)}
              aria-label="Policy category"
              className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
            />
            <input
              value={assessmentConfidence}
              onChange={(event) => setAssessmentConfidence(event.target.value)}
              inputMode="decimal"
              aria-label="Assessment confidence"
              placeholder="Confidence, optional"
              className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SEVERITY_ORDER.map((severity) => (
              <button
                key={severity}
                type="button"
                onClick={() => setAssessmentSeverity(severity)}
                className={`rounded-full px-2.5 py-1 text-[9px] font-black ${assessmentSeverity === severity ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}
              >
                {label(severity)}
              </button>
            ))}
          </div>
          <textarea
            value={assessmentReason}
            onChange={(event) => setAssessmentReason(event.target.value)}
            rows={2}
            placeholder="Assessment reason"
            className="mt-2 w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
          />
          <div className="mt-2 flex justify-end">
            <button type="button" disabled={!assessmentCategory.trim() || !assessmentReason.trim() || busy} onClick={() => void updateAssessment()} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45">
              Update Assessment
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black text-[var(--wk-text)]">Subject enforcement</div>
          <span className="text-[9px] font-bold text-[var(--wk-text-faint)]">{activeEnforcements.length} effective</span>
        </div>

        {activeEnforcements.length > 0 && (
          <div className="mt-2 space-y-2">
            {activeEnforcements.map((enforcement) => (
              <div key={enforcement.enforcement_id} className="flex flex-col gap-2 rounded-lg bg-[var(--wk-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] font-black text-[var(--wk-text)]">{label(enforcement.enforcement_kind)}</div>
                  <div className="mt-1 text-[9px] text-[var(--wk-text-muted)]">{enforcement.public_reason}</div>
                </div>
                <button type="button" disabled={busy} onClick={() => void releaseEnforcement(enforcement)} className="wk-button wk-button-sm wk-button-ghost shrink-0 disabled:opacity-45">Release</button>
              </div>
            ))}
          </div>
        )}

        {detail.case.status === "under_review" && target?.message_id && (
          <div className="mt-3 border-t border-[var(--wk-divider)] pt-3">
            <div className="flex flex-wrap gap-1.5">
              {allowedKinds.map((item) => (
                <button key={item} type="button" onClick={() => setKind(item)} className={`rounded-full px-2.5 py-1 text-[9px] font-black ${kind === item ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}>
                  {label(item)}
                </button>
              ))}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <textarea value={publicReason} onChange={(event) => setPublicReason(event.target.value)} maxLength={500} rows={3} placeholder="Public reason" className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
              <textarea value={internalReason} onChange={(event) => setInternalReason(event.target.value)} maxLength={2000} rows={3} placeholder="Internal reason" className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {kind !== "messaging_removed" && (
                <input value={durationHours} onChange={(event) => setDurationHours(event.target.value)} inputMode="decimal" placeholder="Term hours, blank = indefinite" className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
              )}
              {kind === "send_cooldown" && (
                <input value={cooldownSeconds} onChange={(event) => setCooldownSeconds(event.target.value)} inputMode="numeric" placeholder="Cooldown seconds" className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
              )}
              {kind === "send_rate_limit" && (
                <>
                  <input value={rateLimitCount} onChange={(event) => setRateLimitCount(event.target.value)} inputMode="numeric" placeholder="Message count" className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
                  <input value={rateLimitWindowSeconds} onChange={(event) => setRateLimitWindowSeconds(event.target.value)} inputMode="numeric" placeholder="Window seconds" className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setAppealAllowed((value) => !value)} className={`rounded-full px-2.5 py-1 text-[9px] font-black ${appealAllowed ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}>
                Appeal {appealAllowed ? "allowed" : "not allowed"}
              </button>
              <button type="button" disabled={!publicReason.trim() || !internalReason.trim() || busy} onClick={() => void applyEnforcement()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">Apply Enforcement</button>
            </div>
          </div>
        )}
      </section>

      {detail.appeals.length > 0 && (
        <section className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
          <div className="text-[10px] font-black text-[var(--wk-text)]">Appeals</div>
          <div className="mt-2 space-y-2">
            {detail.appeals.map((appeal) => {
              const original = appealEnforcement(detail, appeal);
              const notes = appealNotes[appeal.appeal_id] ?? { public: "", internal: "" };
              return (
                <div key={appeal.appeal_id} className="rounded-lg bg-[var(--wk-surface)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-black text-[var(--wk-text)]">{original ? label(original.enforcement_kind) : "Enforcement"}</div>
                      <div className="mt-1 text-[9px] font-bold text-[var(--wk-text-faint)]">{label(appeal.status)}</div>
                    </div>
                    {appeal.status === "open" && <button type="button" disabled={busy} onClick={() => void run(() => startMessagesSafetyAppealReview(appeal.appeal_id))} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45">Start Appeal Review</button>}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">{appeal.appeal_reason}</p>
                  {appeal.status === "under_review" && (
                    <div className="mt-3 border-t border-[var(--wk-divider)] pt-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <textarea value={notes.public} onChange={(event) => setAppealNotes((current) => ({ ...current, [appeal.appeal_id]: { ...notes, public: event.target.value } }))} maxLength={1000} rows={2} placeholder="Public resolution note" className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
                        <textarea value={notes.internal} onChange={(event) => setAppealNotes((current) => ({ ...current, [appeal.appeal_id]: { ...notes, internal: event.target.value } }))} maxLength={4000} rows={2} placeholder="Internal resolution note" className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ENFORCEMENT_KINDS.map((item) => (
                          <button key={item} type="button" onClick={() => setModifiedKind((current) => ({ ...current, [appeal.appeal_id]: item }))} className={`rounded-full px-2 py-1 text-[8px] font-black ${(modifiedKind[appeal.appeal_id] ?? "warning") === item ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]"}`}>{label(item)}</button>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={!notes.public.trim() || !notes.internal.trim() || busy} onClick={() => void resolveAppeal(appeal, "upheld")} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45">Uphold</button>
                        <button type="button" disabled={!notes.public.trim() || !notes.internal.trim() || busy} onClick={() => void resolveAppeal(appeal, "modified")} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45">Modify Narrower</button>
                        <button type="button" disabled={!notes.public.trim() || !notes.internal.trim() || busy} onClick={() => void resolveAppeal(appeal, "reversed")} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">Reverse</button>
                      </div>
                    </div>
                  )}
                  {appeal.resolution_public_note && <div className="mt-2 rounded-lg bg-[var(--wk-surface-raised)] px-3 py-2 text-[9px] text-[var(--wk-text-muted)]">{appeal.resolution_public_note}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {mediaTargets.length > 0 && (
        <section className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
          <div className="text-[10px] font-black text-[var(--wk-text)]">Severe Media containment</div>
          <textarea value={containmentReason} onChange={(event) => setContainmentReason(event.target.value)} rows={2} placeholder="Containment or release reason" className="mt-2 w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[10px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]" />
          <div className="mt-2 space-y-2">
            {mediaTargets.map((media) => {
              const fileId = media.media_file_object_id!;
              const containment = detail.media_containment.find((item) => item.media_file_object_id === fileId && item.status === "active");
              return (
                <div key={fileId} className="flex flex-col gap-2 rounded-lg bg-[var(--wk-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="break-all text-[9px] font-bold text-[var(--wk-text-muted)]">{fileId}</div>
                    <div className="mt-1 text-[9px] font-black text-[var(--wk-text-faint)]">{containment ? "Exact-match containment active" : "Not contained by this case"}</div>
                  </div>
                  <div className="flex gap-2">
                    {detail.case.status === "under_review" && detail.case.severity === "severe" && (
                      <button type="button" disabled={busy} onClick={() => void run(() => submitMessagesSafetyMediaScan(detail.case.case_id, fileId))} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45">Scan</button>
                    )}
                    {(containment || (detail.case.status === "under_review" && detail.case.severity === "severe")) && (
                      <button type="button" disabled={!containmentReason.trim() || busy} onClick={() => void run(() => setMessagesSafetyMediaContainment(detail.case.case_id, fileId, !containment, containmentReason.trim()))} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{containment ? "Release" : "Contain"}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
