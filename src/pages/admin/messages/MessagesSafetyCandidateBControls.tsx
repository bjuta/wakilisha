import { useEffect, useMemo, useState } from "react";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/design-system/primitives/SearchableSelect";
import { WkCommandSheet } from "@/components/design-system/primitives/CommandSheet";
import { WkStateBadge } from "@/components/design-system/primitives/StateBadge";
import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
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

const BASE_POLICY_OPTIONS: SearchableSelectOption[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate_or_abuse", label: "Hate / Abuse" },
  { value: "misinformation", label: "Misinformation" },
  { value: "privacy", label: "Privacy" },
  { value: "copyright", label: "Copyright" },
  { value: "off_topic", label: "Off Topic" },
  { value: "other", label: "Other" },
];

type AppealResolution = "upheld" | "modified" | "reversed";

interface AppealAction {
  appealId: string;
  resolution: AppealResolution;
}

interface MediaAction {
  fileId: string;
  nextContained: boolean;
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  return value.length > 12
    ? `${value.slice(0, 8)}...${value.slice(-4)}`
    : value;
}

function effective(enforcement: MessagesSafetyEnforcement): boolean {
  return enforcement.status === "active"
    && (
      !enforcement.effective_until
      || new Date(enforcement.effective_until).getTime() > Date.now()
    );
}

function isoAfterHours(hours: string): string | null {
  const amount = Number(hours);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Date(Date.now() + amount * 60 * 60 * 1000).toISOString();
}

function messageTarget(
  detail: MessagesSafetyCaseDetail,
): MessagesSafetyTarget | null {
  return detail.targets.find(
    (item) => item.target_type === "message" && item.message_id,
  ) ?? null;
}

function appealEnforcement(
  detail: MessagesSafetyCaseDetail,
  appeal: MessagesSafetyAppeal,
): MessagesSafetyEnforcement | null {
  return detail.enforcements.find(
    (item) => item.enforcement_id === appeal.enforcement_id,
  ) ?? null;
}

function fieldClass(): string {
  return "mt-2 w-full rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[12px] text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-border-strong focus:ring-2 focus:ring-wk-brand/15";
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

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentReason, setAssessmentReason] = useState("");
  const [assessmentCategory, setAssessmentCategory] = useState(
    detail.case.policy_category,
  );
  const [assessmentSeverity, setAssessmentSeverity] = useState(
    detail.case.severity,
  );
  const [assessmentConfidence, setAssessmentConfidence] = useState(
    detail.case.confidence == null ? "" : String(detail.case.confidence),
  );

  const [enforcementOpen, setEnforcementOpen] = useState(false);
  const [kind, setKind] = useState<MessagesSafetyEnforcementKind>("warning");
  const [publicReason, setPublicReason] = useState("");
  const [internalReason, setInternalReason] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [appealAllowed, setAppealAllowed] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState("300");
  const [rateLimitCount, setRateLimitCount] = useState("5");
  const [rateLimitWindowSeconds, setRateLimitWindowSeconds] = useState("3600");
  const [releaseTarget, setReleaseTarget] =
    useState<MessagesSafetyEnforcement | null>(null);

  const [appealAction, setAppealAction] = useState<AppealAction | null>(null);
  const [appealPublicNote, setAppealPublicNote] = useState("");
  const [appealInternalNote, setAppealInternalNote] = useState("");
  const [modifiedKind, setModifiedKind] =
    useState<MessagesSafetyEnforcementKind>("warning");

  const [mediaAction, setMediaAction] = useState<MediaAction | null>(null);
  const [containmentReason, setContainmentReason] = useState("");

  useEffect(() => {
    setAssessmentCategory(detail.case.policy_category);
    setAssessmentSeverity(detail.case.severity);
    setAssessmentConfidence(
      detail.case.confidence == null ? "" : String(detail.case.confidence),
    );
    setAssessmentReason("");
    setAssessmentOpen(false);
    setEnforcementOpen(false);
    setReleaseTarget(null);
    setAppealAction(null);
    setMediaAction(null);
  }, [
    detail.case.case_id,
    detail.case.policy_category,
    detail.case.severity,
    detail.case.confidence,
  ]);

  const target = useMemo(() => messageTarget(detail), [detail]);

  const severityIndex = Math.max(
    0,
    SEVERITY_ORDER.indexOf(
      detail.case.severity as (typeof SEVERITY_ORDER)[number],
    ),
  );

  const allowedKinds = ENFORCEMENT_KINDS.filter(
    (item) => KIND_MINIMUM_SEVERITY[item] <= severityIndex,
  );

  const allowedKindOptions = useMemo<SearchableSelectOption[]>(
    () =>
      allowedKinds.map((item) => ({
        value: item,
        label: label(item),
      })),
    [allowedKinds],
  );

  const policyOptions = useMemo<SearchableSelectOption[]>(() => {
    if (
      BASE_POLICY_OPTIONS.some(
        (option) => option.value === assessmentCategory,
      )
    ) {
      return BASE_POLICY_OPTIONS;
    }

    return [
      {
        value: assessmentCategory,
        label: label(assessmentCategory),
        description: "Current case category",
      },
      ...BASE_POLICY_OPTIONS,
    ];
  }, [assessmentCategory]);

  const activeEnforcements = detail.enforcements.filter(effective);

  const mediaTargets = detail.targets.filter(
    (item) => item.target_type === "media_file" && item.media_file_object_id,
  );

  const selectedAppeal = appealAction
    ? detail.appeals.find(
        (appeal) => appeal.appeal_id === appealAction.appealId,
      ) ?? null
    : null;

  const selectedAppealEnforcement = selectedAppeal
    ? appealEnforcement(detail, selectedAppeal)
    : null;

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);

    try {
      await action();
      await onChanged();
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Messages Safety action failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  function enforcementShape(selectedKind: MessagesSafetyEnforcementKind) {
    return {
      effectiveUntil:
        selectedKind === "messaging_removed"
          ? null
          : isoAfterHours(durationHours),
      cooldownSeconds:
        selectedKind === "send_cooldown"
          ? Number(cooldownSeconds)
          : null,
      rateLimitCount:
        selectedKind === "send_rate_limit"
          ? Number(rateLimitCount)
          : null,
      rateLimitWindowSeconds:
        selectedKind === "send_rate_limit"
          ? Number(rateLimitWindowSeconds)
          : null,
    };
  }

  async function updateAssessment() {
    const confidence = assessmentConfidence.trim()
      ? Number(assessmentConfidence)
      : null;

    const accepted = await run(() =>
      updateMessagesSafetyAssessment(
        detail.case.case_id,
        assessmentCategory.trim(),
        assessmentSeverity,
        confidence,
        assessmentReason.trim(),
      ),
    );

    if (accepted) {
      setAssessmentReason("");
      setAssessmentOpen(false);
    }
  }

  async function applyEnforcement() {
    if (!target?.message_id) return;

    const shape = enforcementShape(kind);
    const accepted = await run(() =>
      setMessagesSafetyEnforcement({
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
      }),
    );

    if (accepted) {
      setPublicReason("");
      setInternalReason("");
      setEnforcementOpen(false);
    }
  }

  async function releaseEnforcement() {
    if (!releaseTarget) return;

    const accepted = await run(() =>
      setMessagesSafetyEnforcement({
        caseId: detail.case.case_id,
        messageId: releaseTarget.source_message_id,
        enforcementKind: releaseTarget.enforcement_kind,
        active: false,
        effectiveUntil: null,
        appealAllowed: false,
        publicReason: "This Messages restriction has been released.",
        internalReason: "Restriction released by Safety review.",
        cooldownSeconds: null,
        rateLimitCount: null,
        rateLimitWindowSeconds: null,
      }),
    );

    if (accepted) setReleaseTarget(null);
  }

  function openAppealResolution(
    appeal: MessagesSafetyAppeal,
    resolution: AppealResolution,
  ) {
    const original = appealEnforcement(detail, appeal);

    setAppealAction({
      appealId: appeal.appeal_id,
      resolution,
    });
    setAppealPublicNote("");
    setAppealInternalNote("");
    setModifiedKind(original?.enforcement_kind ?? "warning");
  }

  async function resolveAppeal() {
    if (!appealAction || !selectedAppeal) return;

    const shape = enforcementShape(modifiedKind);
    const accepted = await run(() =>
      resolveMessagesSafetyAppeal({
        appealId: selectedAppeal.appeal_id,
        resolution: appealAction.resolution,
        resolutionPublicNote: appealPublicNote.trim(),
        resolutionInternalNote: appealInternalNote.trim(),
        modifiedEnforcementKind:
          appealAction.resolution === "modified" ? modifiedKind : null,
        modifiedEffectiveUntil:
          appealAction.resolution === "modified"
            ? shape.effectiveUntil
            : null,
        modifiedAppealAllowed:
          appealAction.resolution === "modified"
            ? Boolean(selectedAppealEnforcement?.appeal_allowed)
            : null,
        modifiedCooldownSeconds:
          appealAction.resolution === "modified"
            ? shape.cooldownSeconds
            : null,
        modifiedRateLimitCount:
          appealAction.resolution === "modified"
            ? shape.rateLimitCount
            : null,
        modifiedRateLimitWindowSeconds:
          appealAction.resolution === "modified"
            ? shape.rateLimitWindowSeconds
            : null,
      }),
    );

    if (accepted) {
      setAppealAction(null);
      setAppealPublicNote("");
      setAppealInternalNote("");
    }
  }

  async function applyMediaAction() {
    if (!mediaAction) return;

    const accepted = await run(() =>
      setMessagesSafetyMediaContainment(
        detail.case.case_id,
        mediaAction.fileId,
        mediaAction.nextContained,
        containmentReason.trim(),
      ),
    );

    if (accepted) {
      setContainmentReason("");
      setMediaAction(null);
    }
  }

  const appealResolutionLabel =
    appealAction?.resolution === "upheld"
      ? "Uphold Appeal Decision"
      : appealAction?.resolution === "modified"
        ? "Modify Restriction"
        : "Reverse Restriction";

  return (
    <div
      className="space-y-4 rounded-2xl border border-wk-border bg-wk-surface p-4"
      data-wk-messages-safety-candidate-b
      data-wk-messages-safety-candidate-b-workbench
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-brand">
            Enforcement and Recovery
          </div>
          <div className="mt-1 text-[13px] font-black text-wk-text">
            Graduated Messages Safety
          </div>
          <p className="mt-1 max-w-[680px] text-[10px] leading-relaxed text-wk-text-muted">
            Assessment, subject restrictions, appeals, and exact Media containment stay attached to this Safety Case.
          </p>
        </div>

        <WkStateBadge
          tone={
            detail.case.severity === "severe"
              ? "danger"
              : detail.case.severity === "high"
                ? "warning"
                : "neutral"
          }
        >
          {label(detail.case.severity)}
        </WkStateBadge>
      </div>

      {error ? (
        <div className="rounded-xl border border-wk-danger/30 bg-wk-danger/10 px-3 py-2 text-[10px] font-bold text-wk-danger">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black text-wk-text">
              Assessment
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <WkStateBadge tone="neutral">
                {label(detail.case.policy_category)}
              </WkStateBadge>
              <WkStateBadge
                tone={
                  detail.case.severity === "severe"
                    ? "danger"
                    : detail.case.severity === "high"
                      ? "warning"
                      : "neutral"
                }
              >
                {label(detail.case.severity)}
              </WkStateBadge>
              {detail.case.confidence != null ? (
                <WkStateBadge tone="info">
                  Confidence {String(detail.case.confidence)}
                </WkStateBadge>
              ) : null}
            </div>
          </div>

          {detail.case.status === "under_review" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setAssessmentOpen(true)}
              className="wk-button wk-button-sm wk-button-ghost shrink-0 disabled:opacity-45"
            >
              Update Assessment
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black text-wk-text">
              Subject Enforcement
            </div>
            <p className="mt-1 text-[10px] text-wk-text-muted">
              {activeEnforcements.length === 0
                ? "No effective restriction is active."
                : `${activeEnforcements.length} effective restriction${activeEnforcements.length === 1 ? "" : "s"}.`}
            </p>
          </div>

          {detail.case.status === "under_review" && target?.message_id ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEnforcementOpen(true)}
              className="wk-button wk-button-sm wk-button-primary shrink-0 disabled:opacity-45"
            >
              Apply Enforcement
            </button>
          ) : null}
        </div>

        {activeEnforcements.length > 0 ? (
          <div className="mt-3 space-y-2">
            {activeEnforcements.map((enforcement) => (
              <div
                key={enforcement.enforcement_id}
                className="flex flex-col gap-3 rounded-xl border border-wk-border bg-wk-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10px] font-black text-wk-text">
                      {label(enforcement.enforcement_kind)}
                    </div>
                    <WkStateBadge tone="warning">Active</WkStateBadge>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-wk-text-muted">
                    {enforcement.public_reason}
                  </p>
                  {enforcement.effective_until ? (
                    <div className="mt-1 text-[9px] font-bold text-wk-text-faint">
                      Effective until {new Date(enforcement.effective_until).toLocaleString()}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setReleaseTarget(enforcement)}
                  className="wk-button wk-button-sm wk-button-ghost shrink-0 disabled:opacity-45"
                >
                  Release
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {detail.appeals.length > 0 ? (
        <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
          <div className="text-[10px] font-black text-wk-text">
            Appeals
          </div>

          <div className="mt-3 space-y-2">
            {detail.appeals.map((appeal) => {
              const original = appealEnforcement(detail, appeal);

              return (
                <div
                  key={appeal.appeal_id}
                  className="rounded-xl border border-wk-border bg-wk-surface p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[10px] font-black text-wk-text">
                          {original
                            ? label(original.enforcement_kind)
                            : "Enforcement"}
                        </div>
                        <WkStateBadge
                          tone={
                            appeal.status === "resolved"
                              ? "success"
                              : appeal.status === "under_review"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {label(appeal.status)}
                        </WkStateBadge>
                      </div>

                      <p className="mt-2 text-[10px] leading-relaxed text-wk-text-muted">
                        {appeal.appeal_reason}
                      </p>

                      {appeal.resolution_public_note ? (
                        <div className="mt-2 rounded-lg bg-wk-bg-subtle px-3 py-2 text-[9px] text-wk-text-muted">
                          {appeal.resolution_public_note}
                        </div>
                      ) : null}
                    </div>

                    {appeal.status === "open" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            startMessagesSafetyAppealReview(
                              appeal.appeal_id,
                            ),
                          )
                        }
                        className="wk-button wk-button-sm wk-button-ghost shrink-0 disabled:opacity-45"
                      >
                        Start Appeal Review
                      </button>
                    ) : null}
                  </div>

                  {appeal.status === "under_review" ? (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-wk-divider pt-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          openAppealResolution(appeal, "upheld")
                        }
                        className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                      >
                        Uphold
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          openAppealResolution(appeal, "modified")
                        }
                        className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                      >
                        Modify
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          openAppealResolution(appeal, "reversed")
                        }
                        className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                      >
                        Reverse
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {mediaTargets.length > 0 ? (
        <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
          <div>
            <div className="text-[10px] font-black text-wk-text">
              Severe Media Containment
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-wk-text-muted">
              Actions stay scoped to the exact Media file attached to this case.
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {mediaTargets.map((media) => {
              const fileId = media.media_file_object_id!;
              const containment = detail.media_containment.find(
                (item) =>
                  item.media_file_object_id === fileId
                  && item.status === "active",
              );

              return (
                <div
                  key={fileId}
                  className="flex flex-col gap-3 rounded-xl border border-wk-border bg-wk-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-wk-text">
                      Media {shortId(fileId)}
                    </div>
                    <div className="mt-1">
                      <WkStateBadge
                        tone={containment ? "danger" : "neutral"}
                      >
                        {containment
                          ? "Containment Active"
                          : "Not Contained"}
                      </WkStateBadge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {detail.case.status === "under_review"
                    && detail.case.severity === "severe" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            submitMessagesSafetyMediaScan(
                              detail.case.case_id,
                              fileId,
                            ),
                          )
                        }
                        className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                      >
                        Scan
                      </button>
                    ) : null}

                    {containment
                    || (
                      detail.case.status === "under_review"
                      && detail.case.severity === "severe"
                    ) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setContainmentReason("");
                          setMediaAction({
                            fileId,
                            nextContained: !containment,
                          });
                        }}
                        className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                      >
                        {containment ? "Release" : "Contain"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <WkCommandSheet
        open={assessmentOpen}
        onClose={() => !busy && setAssessmentOpen(false)}
        title="Update Safety Assessment"
        eyebrow="Governed Safety assessment"
        description="Record the current policy category, severity, confidence, and reviewer reason."
        primaryLabel="Save Assessment"
        onPrimary={updateAssessment}
        primaryDisabled={
          !assessmentCategory.trim()
          || !assessmentReason.trim()
        }
        busy={busy}
        footerNote="Assessment changes remain attached to this Safety Case and its event history."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Policy Category
            </span>
            <SearchableSelect
              options={policyOptions}
              value={assessmentCategory}
              onChange={setAssessmentCategory}
              placeholder="Choose policy category"
              searchPlaceholder="Search policy categories"
              ariaLabel="Policy category"
              className="mt-2"
            />
          </label>

          <div>
            <div className="text-[10px] font-black text-wk-text">
              Severity
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SEVERITY_ORDER.map((severity) => (
                <button
                  key={severity}
                  type="button"
                  aria-pressed={assessmentSeverity === severity}
                  onClick={() => setAssessmentSeverity(severity)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black transition-colors ${
                    assessmentSeverity === severity
                      ? "bg-wk-brand text-white"
                      : "bg-wk-surface-raised text-wk-text-muted hover:text-wk-text"
                  }`}
                >
                  {label(severity)}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Confidence
            </span>
            <input
              value={assessmentConfidence}
              onChange={(event) =>
                setAssessmentConfidence(event.target.value)
              }
              inputMode="decimal"
              placeholder="Optional numeric confidence"
              className={fieldClass()}
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Assessment Reason
            </span>
            <textarea
              value={assessmentReason}
              onChange={(event) => setAssessmentReason(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Why does this assessment fit the case?"
              className={`${fieldClass()} resize-none`}
            />
          </label>
        </div>
      </WkCommandSheet>

      <WkCommandSheet
        open={enforcementOpen}
        onClose={() => !busy && setEnforcementOpen(false)}
        title="Apply Safety Enforcement"
        eyebrow="Governed Safety action"
        description="Choose the proportionate restriction and record both participant-facing and internal reasons."
        primaryLabel="Apply Enforcement"
        onPrimary={applyEnforcement}
        primaryDisabled={
          !target?.message_id
          || !publicReason.trim()
          || !internalReason.trim()
        }
        busy={busy}
        footerNote="Severity eligibility and enforcement authority remain server-enforced."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Restriction
            </span>
            <SearchableSelect
              options={allowedKindOptions}
              value={kind}
              onChange={(value) =>
                setKind(value as MessagesSafetyEnforcementKind)
              }
              placeholder="Choose restriction"
              searchPlaceholder="Search restrictions"
              ariaLabel="Safety enforcement"
              className="mt-2"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Participant-Facing Reason
            </span>
            <textarea
              value={publicReason}
              onChange={(event) => setPublicReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What should the participant see?"
              className={`${fieldClass()} resize-none`}
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Internal Reason
            </span>
            <textarea
              value={internalReason}
              onChange={(event) => setInternalReason(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Record the Safety review basis."
              className={`${fieldClass()} resize-none`}
            />
          </label>

          {kind !== "messaging_removed" ? (
            <label className="block">
              <span className="text-[10px] font-black text-wk-text">
                Term Hours
              </span>
              <input
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                inputMode="decimal"
                placeholder="Leave blank for no fixed end time"
                className={fieldClass()}
              />
            </label>
          ) : null}

          {kind === "send_cooldown" ? (
            <label className="block">
              <span className="text-[10px] font-black text-wk-text">
                Cooldown Seconds
              </span>
              <input
                value={cooldownSeconds}
                onChange={(event) =>
                  setCooldownSeconds(event.target.value)
                }
                inputMode="numeric"
                placeholder="Cooldown seconds"
                className={fieldClass()}
              />
            </label>
          ) : null}

          {kind === "send_rate_limit" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-black text-wk-text">
                  Message Count
                </span>
                <input
                  value={rateLimitCount}
                  onChange={(event) =>
                    setRateLimitCount(event.target.value)
                  }
                  inputMode="numeric"
                  placeholder="Messages"
                  className={fieldClass()}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black text-wk-text">
                  Window Seconds
                </span>
                <input
                  value={rateLimitWindowSeconds}
                  onChange={(event) =>
                    setRateLimitWindowSeconds(event.target.value)
                  }
                  inputMode="numeric"
                  placeholder="Window"
                  className={fieldClass()}
                />
              </label>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-3">
            <div>
              <div className="text-[10px] font-black text-wk-text">
                Allow Appeal
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-wk-text-muted">
                Keep the participant recovery path available for this restriction.
              </p>
            </div>
            <WakilishaToggle
              value={appealAllowed}
              onChange={setAppealAllowed}
              size="sm"
              ariaLabel="Allow appeal"
            />
          </div>
        </div>
      </WkCommandSheet>

      <WkCommandSheet
        open={Boolean(releaseTarget)}
        onClose={() => !busy && setReleaseTarget(null)}
        title="Release Safety Enforcement"
        eyebrow="Governed recovery action"
        description={
          releaseTarget
            ? `Release ${label(releaseTarget.enforcement_kind)} from this Safety Case.`
            : undefined
        }
        primaryLabel="Release Enforcement"
        onPrimary={releaseEnforcement}
        primaryDisabled={!releaseTarget}
        busy={busy}
        footerNote="The enforcement record stays in history after release."
      >
        <p className="text-[11px] leading-relaxed text-wk-text-muted">
          This uses the accepted release semantics and records the release in the Safety history.
        </p>
      </WkCommandSheet>

      <WkCommandSheet
        open={Boolean(appealAction)}
        onClose={() => !busy && setAppealAction(null)}
        title="Resolve Safety Appeal"
        eyebrow="Human recovery decision"
        description={
          appealAction
            ? `${appealResolutionLabel} for the reviewed appeal.`
            : undefined
        }
        primaryLabel={appealResolutionLabel}
        onPrimary={resolveAppeal}
        primaryDisabled={
          !appealAction
          || !appealPublicNote.trim()
          || !appealInternalNote.trim()
        }
        busy={busy}
        footerNote="Appeal resolution remains bound to the original enforcement and server-side recovery rules."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Participant-Facing Note
            </span>
            <textarea
              value={appealPublicNote}
              onChange={(event) => setAppealPublicNote(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="What should the participant see?"
              className={`${fieldClass()} resize-none`}
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-wk-text">
              Internal Resolution Note
            </span>
            <textarea
              value={appealInternalNote}
              onChange={(event) => setAppealInternalNote(event.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="Record the review basis."
              className={`${fieldClass()} resize-none`}
            />
          </label>

          {appealAction?.resolution === "modified" ? (
            <>
              <label className="block">
                <span className="text-[10px] font-black text-wk-text">
                  Modified Restriction
                </span>
                <SearchableSelect
                  options={ENFORCEMENT_KINDS.map((item) => ({
                    value: item,
                    label: label(item),
                  }))}
                  value={modifiedKind}
                  onChange={(value) =>
                    setModifiedKind(
                      value as MessagesSafetyEnforcementKind,
                    )
                  }
                  placeholder="Choose modified restriction"
                  searchPlaceholder="Search restrictions"
                  ariaLabel="Modified safety enforcement"
                  className="mt-2"
                />
              </label>

              {modifiedKind !== "messaging_removed" ? (
                <label className="block">
                  <span className="text-[10px] font-black text-wk-text">
                    Modified Term Hours
                  </span>
                  <input
                    value={durationHours}
                    onChange={(event) =>
                      setDurationHours(event.target.value)
                    }
                    inputMode="decimal"
                    placeholder="Leave blank for no fixed end time"
                    className={fieldClass()}
                  />
                </label>
              ) : null}

              {modifiedKind === "send_cooldown" ? (
                <label className="block">
                  <span className="text-[10px] font-black text-wk-text">
                    Modified Cooldown Seconds
                  </span>
                  <input
                    value={cooldownSeconds}
                    onChange={(event) =>
                      setCooldownSeconds(event.target.value)
                    }
                    inputMode="numeric"
                    placeholder="Cooldown seconds"
                    className={fieldClass()}
                  />
                </label>
              ) : null}

              {modifiedKind === "send_rate_limit" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-black text-wk-text">
                      Modified Message Count
                    </span>
                    <input
                      value={rateLimitCount}
                      onChange={(event) =>
                        setRateLimitCount(event.target.value)
                      }
                      inputMode="numeric"
                      placeholder="Messages"
                      className={fieldClass()}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black text-wk-text">
                      Modified Window Seconds
                    </span>
                    <input
                      value={rateLimitWindowSeconds}
                      onChange={(event) =>
                        setRateLimitWindowSeconds(event.target.value)
                      }
                      inputMode="numeric"
                      placeholder="Window"
                      className={fieldClass()}
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </WkCommandSheet>

      <WkCommandSheet
        open={Boolean(mediaAction)}
        onClose={() => !busy && setMediaAction(null)}
        title={
          mediaAction?.nextContained
            ? "Contain Media"
            : "Release Media"
        }
        eyebrow="Exact Media action"
        description={
          mediaAction
            ? `${mediaAction.nextContained ? "Contain" : "Release"} Media ${shortId(mediaAction.fileId)} for this case only.`
            : undefined
        }
        primaryLabel={
          mediaAction?.nextContained
            ? "Contain Media"
            : "Release Media"
        }
        onPrimary={applyMediaAction}
        primaryDisabled={!mediaAction || !containmentReason.trim()}
        busy={busy}
        footerNote="Exact Media identity and containment authority remain server-enforced."
      >
        <label className="block">
          <span className="text-[10px] font-black text-wk-text">
            Reason
          </span>
          <textarea
            value={containmentReason}
            onChange={(event) =>
              setContainmentReason(event.target.value)
            }
            rows={4}
            maxLength={2000}
            placeholder="Record the reason for this exact Media action."
            className={`${fieldClass()} resize-none`}
          />
        </label>
      </WkCommandSheet>
    </div>
  );
}
