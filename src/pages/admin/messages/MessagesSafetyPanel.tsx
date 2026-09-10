import { useCallback, useEffect, useMemo, useState } from "react";
import { WkAuditTimeline } from "@/components/design-system/primitives/AuditTimeline";
import { WkCommandSheet } from "@/components/design-system/primitives/CommandSheet";
import { WkInspector } from "@/components/design-system/primitives/Inspector";
import { WkStateBadge } from "@/components/design-system/primitives/StateBadge";
import {
  WkWorkflowRail,
  type WkWorkflowStep,
} from "@/components/design-system/primitives/WorkflowRail";
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

function shortId(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      setStatusFilter("under_review");
      await loadDetail(selectedId);
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
      setStatusFilter("resolved");
      await loadDetail(selectedId);
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

  const workflowSteps = useMemo<WkWorkflowStep[]>(() => {
    if (!detail) return [];

    const underReview = detail.case.status === "under_review";
    const resolved = detail.case.status === "resolved";
    const evidenceViewed = detail.events.some(
      (event) => event.event_kind === "evidence_viewed",
    );
    const hasResponse =
      detail.case.current_disposition !== "pending"
      || detail.quarantine.length > 0
      || detail.enforcements.length > 0
      || detail.media_containment.length > 0;
    const hasRecovery =
      detail.appeals.length > 0
      || detail.events.some((event) =>
        [
          "released",
          "enforcement_released",
          "enforcement_expired",
          "enforcement_reversed",
          "appeal_resolved",
          "media_containment_released",
        ].includes(event.event_kind),
      );

    return [
      {
        id: "case",
        label: "Case",
        description: "Reported or raised",
        state: "complete",
      },
      {
        id: "review",
        label: "Review",
        description: resolved || underReview ? "Review started" : "Start human review",
        state: resolved || underReview ? "complete" : "current",
      },
      {
        id: "evidence",
        label: "Evidence",
        description: evidenceViewed ? "Inspected deliberately" : "Available when needed",
        state: resolved
          ? evidenceViewed ? "complete" : "available"
          : underReview
            ? evidenceViewed ? "complete" : "available"
            : "blocked",
      },
      {
        id: "response",
        label: "Response",
        description: hasResponse ? "Safety response recorded" : "Choose a proportionate response",
        state: resolved
          ? "complete"
          : underReview
            ? hasResponse ? "complete" : "current"
            : "blocked",
      },
      {
        id: "recovery",
        label: "Recovery",
        description: hasRecovery ? "Recovery history exists" : "Appeals and releases stay available",
        state: resolved
          ? hasRecovery ? "complete" : "available"
          : underReview
            ? hasResponse ? "available" : "upcoming"
            : "blocked",
      },
      {
        id: "resolution",
        label: "Resolution",
        description: resolved ? "Case resolved" : "Close with recorded disposition",
        state: resolved ? "complete" : underReview ? "available" : "upcoming",
      },
    ];
  }, [detail]);

  const auditEvents = useMemo(
    () =>
      detail?.events.map((event) => ({
        id: event.event_id,
        label: humanize(event.event_kind),
        actor:
          event.actor_kind === "human"
            ? "Human reviewer"
            : humanize(event.actor_kind),
        occurredAt: event.occurred_at,
        detail:
          Object.keys(event.metadata ?? {}).length > 0 ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          ) : undefined,
      })) ?? [],
    [detail],
  );

  const targetPresentation = target?.sender?.presentation;
  const targetName =
    targetPresentation?.display_name
    || targetPresentation?.label
    || targetPresentation?.username
    || "Message sender";

  return (
    <section
      className="rounded-2xl border border-wk-border bg-wk-surface p-4 sm:p-5"
      aria-labelledby="messages-safety-heading"
      data-wk-messages-safety-workbench
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
            Safety
          </div>
          <h2
            id="messages-safety-heading"
            className="mt-1 text-[18px] font-black tracking-[-0.02em] text-wk-text"
          >
            Message Safety Cases
          </h2>
          <p className="mt-1 max-w-[700px] text-[11px] leading-relaxed text-wk-text-muted">
            Review reports, inspect private evidence deliberately, and apply the existing Safety authority.
          </p>
        </div>

        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-wk-border bg-wk-bg-subtle p-1"
          aria-label="Safety case status"
        >
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
              className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-black transition-colors ${
                statusFilter === status
                  ? "bg-wk-brand-soft text-wk-brand"
                  : "text-wk-text-muted hover:bg-wk-surface-raised"
              }`}
            >
              {status === "all" ? "All" : STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-wk-danger/30 bg-wk-danger/10 px-4 py-3 text-[11px] font-bold text-wk-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
        <aside className="min-h-[360px] overflow-hidden rounded-2xl border border-wk-border bg-wk-bg-subtle">
          {loading ? (
            <div className="space-y-2 p-3" aria-busy="true">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-xl bg-wk-surface-raised"
                />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center px-6 text-center text-[11px] font-bold text-wk-text-muted">
              No Safety Cases match this view.
            </div>
          ) : (
            <div className="divide-y divide-wk-divider">
              {cases.map((item) => (
                <button
                  key={item.case_id}
                  type="button"
                  onClick={() => void loadDetail(item.case_id)}
                  className={`w-full px-4 py-4 text-left transition-colors hover:bg-wk-surface-raised ${
                    selectedId === item.case_id ? "bg-wk-brand-soft" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-black text-wk-text">
                        {labelCategory(item.policy_category)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <WkStateBadge
                          tone={
                            item.status === "resolved"
                              ? "success"
                              : item.status === "under_review"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {STATUS_LABELS[item.status] ?? item.status}
                        </WkStateBadge>
                        <WkStateBadge
                          tone={
                            item.severity === "severe"
                              ? "danger"
                              : item.severity === "high"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {humanize(item.severity)}
                        </WkStateBadge>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-wk-text-faint">
                      {when(item.updated_at)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-bold text-wk-text-muted">
                    <span>{item.message_target_count} Message</span>
                    <span>{item.active_quarantine_count} quarantined</span>
                    <span>{item.active_enforcement_count} enforced</span>
                    <span>{item.open_appeal_count} appeals</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="min-h-[360px] rounded-2xl border border-wk-border bg-wk-bg-subtle p-3 sm:p-4">
          {!selectedId ? (
            <div className="flex min-h-[328px] items-center justify-center px-6 text-center text-[11px] font-bold text-wk-text-muted">
              Choose a Safety Case to review its safe summary.
            </div>
          ) : detailLoading || !detail ? (
            <div
              className="min-h-[328px] animate-pulse rounded-xl bg-wk-surface-raised"
              aria-busy="true"
            />
          ) : (
            <div className="space-y-4">
              <section className="rounded-2xl border border-wk-border bg-wk-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-black text-wk-text">
                        {labelCategory(detail.case.policy_category)}
                      </h3>
                      <WkStateBadge
                        tone={
                          detail.case.status === "resolved"
                            ? "success"
                            : detail.case.status === "under_review"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {STATUS_LABELS[detail.case.status] ?? detail.case.status}
                      </WkStateBadge>
                    </div>
                    <p className="mt-1 text-[10px] font-bold text-wk-text-muted">
                      {humanize(detail.case.source_kind)} · {humanize(detail.case.severity)} · Case {shortId(detail.case.case_id)}
                    </p>
                  </div>

                  {detail.case.status === "open" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void performReviewStart()}
                      className="wk-button wk-button-sm wk-button-primary shrink-0 disabled:opacity-45"
                    >
                      Start Review
                    </button>
                  ) : null}
                </div>

                <div className="mt-4">
                  <WkWorkflowRail
                    steps={workflowSteps}
                    ariaLabel="Safety Case progress"
                  />
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-wk-text-faint">
                  This rail reflects current case state. Existing server commands remain the authority.
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                    Disposition
                  </div>
                  <div className="mt-1 text-[11px] font-black text-wk-text">
                    {humanize(detail.case.current_disposition)}
                  </div>
                </div>
                <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                    Quarantine
                  </div>
                  <div className="mt-1 text-[11px] font-black text-wk-text">
                    {activeQuarantine ? "Active" : "None"}
                  </div>
                </div>
                <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                    Appeals
                  </div>
                  <div className="mt-1 text-[11px] font-black text-wk-text">
                    {detail.appeals.filter((appeal) => appeal.status !== "resolved").length} open
                  </div>
                </div>
              </section>

              {target?.message_id ? (
                <section className="rounded-2xl border border-wk-border bg-wk-surface p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-wk-text">
                        Exact Message Target
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-wk-text-muted">
                        {targetName}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold text-wk-text-faint">
                        {target.accepted_at ? when(target.accepted_at) : "Time unavailable"} · Message {shortId(target.message_id)}
                      </div>
                    </div>

                    {detail.case.status !== "resolved" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEvidenceOpen(true)}
                          className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                        >
                          Inspect Evidence
                        </button>
                        {activeQuarantine ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setReleaseOpen(true)}
                            className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                          >
                            Release Quarantine
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
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <MessagesSafetyCandidateBControls
                detail={detail}
                onChanged={refresh}
              />

              <section className="rounded-2xl border border-wk-border bg-wk-surface p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] font-black text-wk-text">
                      Case Activity
                    </div>
                    <p className="mt-1 text-[10px] text-wk-text-muted">
                      History stays available without taking over the case workspace.
                    </p>
                  </div>

                  {detail.case.status === "under_review" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setResolveOpen(true)}
                      className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                    >
                      Resolve Case
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 max-h-[360px] overflow-y-auto pr-1">
                  <WkAuditTimeline
                    events={auditEvents}
                    ariaLabel="Safety Case activity"
                    emptyLabel="No Safety Case activity yet."
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <WkCommandSheet
        open={evidenceOpen}
        onClose={() => !busy && setEvidenceOpen(false)}
        title="Inspect Evidence"
        eyebrow="Purpose-audited inspection"
        description="Record why this exact Message needs inspection. Adjacent conversation content will not be returned."
        primaryLabel="Inspect Evidence"
        onPrimary={performEvidenceInspection}
        primaryDisabled={!evidenceReason.trim()}
        busy={busy}
        footerNote="Private Message content remains hidden from the normal Safety workbench."
      >
        <label className="block">
          <span className="text-[10px] font-black text-wk-text">Inspection Purpose</span>
          <textarea
            value={evidenceReason}
            onChange={(event) => setEvidenceReason(event.target.value)}
            rows={5}
            maxLength={2000}
            autoFocus
            placeholder="Why does this exact Message need inspection?"
            className="mt-2 w-full resize-none rounded-xl border border-wk-border bg-wk-bg-subtle p-3 text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-border-strong focus:ring-2 focus:ring-wk-brand/15"
          />
        </label>
      </WkCommandSheet>

      <WkInspector
        open={Boolean(evidence)}
        onClose={() => setEvidence(null)}
        title="Inspected Message Evidence"
        eyebrow="Purpose-audited evidence"
        summary={
          <div>
            <div className="text-[11px] font-black text-wk-text">
              Exact Message {shortId(evidence?.message_id)}
            </div>
            <div className="mt-1 text-[10px] text-wk-text-muted">
              {evidence?.accepted_at ? when(evidence.accepted_at) : "Time unavailable"}
            </div>
          </div>
        }
        advancedLabel="Reveal inspected private evidence"
        advanced={
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
              Private Message Body
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-wk-text">
              {evidence?.body ?? "No Message body."}
            </p>
          </div>
        }
      >
        <p className="text-[11px] leading-relaxed text-wk-text-muted">
          The Message body is not rendered in the normal case. Reveal it only when the inspection purpose requires it.
        </p>
      </WkInspector>

      <WkCommandSheet
        open={quarantineOpen}
        onClose={() => !busy && setQuarantineOpen(false)}
        title="Quarantine Message"
        eyebrow="Governed Safety action"
        description="Remove this Message from ordinary delivery and read views without deleting its canonical record."
        primaryLabel="Quarantine Message"
        onPrimary={() => performQuarantine(true)}
        primaryDisabled={!quarantineReason.trim()}
        busy={busy}
        footerNote="The canonical Message remains preserved. The existing Safety command records this action."
      >
        <label className="block">
          <span className="text-[10px] font-black text-wk-text">Reason</span>
          <textarea
            value={quarantineReason}
            onChange={(event) => setQuarantineReason(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Why should this Message be quarantined?"
            className="mt-2 w-full resize-none rounded-xl border border-wk-border bg-wk-bg-subtle p-3 text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-border-strong focus:ring-2 focus:ring-wk-brand/15"
          />
        </label>
      </WkCommandSheet>

      <WkCommandSheet
        open={releaseOpen}
        onClose={() => !busy && setReleaseOpen(false)}
        title="Release Quarantine"
        eyebrow="Governed Safety action"
        description="Return this Message to its ordinary canonical delivery visibility."
        primaryLabel="Release Quarantine"
        onPrimary={() => performQuarantine(false)}
        primaryDisabled={!releaseReason.trim()}
        busy={busy}
        footerNote="Release changes quarantine state only. It does not delete Safety history."
      >
        <label className="block">
          <span className="text-[10px] font-black text-wk-text">Release Reason</span>
          <textarea
            value={releaseReason}
            onChange={(event) => setReleaseReason(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Why should this quarantine be released?"
            className="mt-2 w-full resize-none rounded-xl border border-wk-border bg-wk-bg-subtle p-3 text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-border-strong focus:ring-2 focus:ring-wk-brand/15"
          />
        </label>
      </WkCommandSheet>

      <WkCommandSheet
        open={resolveOpen}
        onClose={() => !busy && setResolveOpen(false)}
        title="Resolve Safety Case"
        eyebrow="Governed Safety action"
        description="Close this review with the disposition already represented by current quarantine or enforcement state."
        primaryLabel="Resolve Case"
        onPrimary={performResolve}
        primaryDisabled={!resolutionNote.trim()}
        busy={busy}
        footerNote="Disposition is derived from existing Safety state. This surface does not create a new authority."
      >
        <label className="block">
          <span className="text-[10px] font-black text-wk-text">Resolution Note</span>
          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Record the human resolution."
            className="mt-2 w-full resize-none rounded-xl border border-wk-border bg-wk-bg-subtle p-3 text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-border-strong focus:ring-2 focus:ring-wk-brand/15"
          />
        </label>
      </WkCommandSheet>
    </section>
  );
}
