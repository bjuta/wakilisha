import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/design-system/primitives/Modal";
import {
  classifyMessagesLegalObject,
  closeMessagesLegalRequestCase,
  createMessagesLegalDisclosureDelivery,
  getMessagesLegalCase,
  getMessagesLegalDisclosurePackage,
  inspectMessagesLegalEvidence,
  listMessagesLegalCases,
  materializeMessagesLegalPreservation,
  openMessagesLegalRequestCase,
  prepareMessagesLegalDisclosure,
  releaseMessagesLegalDisclosure,
  releaseMessagesLegalPreservation,
  startMessagesLegalReview,
  submitMessagesLegalDisclosureGeneration,
  updateMessagesLegalDisclosureApproval,
  updateMessagesLegalScope,
  voidMessagesLegalDisclosure,
  type MessagesLegalCaseDetail,
  type MessagesLegalCaseStatus,
  type MessagesLegalCaseSummary,
  type MessagesLegalClassification,
  type MessagesLegalDisclosurePackageDetail,
  type MessagesLegalEvidenceResult,
  type MessagesLegalPackageSummary,
  type MessagesLegalPreservedObject,
  type MessagesLegalScope,
  type MessagesLegalScopeKind,
} from "@/services/messages";

const CASE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_review: "Under Review",
  closed: "Closed",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  unclassified: "Unclassified",
  responsive: "Responsive",
  elevated_review: "Elevated Review",
  excluded: "Excluded",
};

const SCOPE_LABELS: Record<string, string> = {
  exact_message: "Exact Message",
  conversation_window: "Conversation Window",
  exact_media_file: "Exact Media File",
  exact_resource_version: "Exact Resource Version",
};

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function when(value: string | null | undefined): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(value: string | null | undefined): string {
  if (!value) return "None";
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function objectIdentity(item: MessagesLegalPreservedObject): string {
  return item.message_id || item.media_file_object_id || item.resource_version_id || item.id;
}

function scopeIdentity(item: MessagesLegalScope): string {
  if (item.scope_kind === "exact_message") return item.message_id || "Missing Message";
  if (item.scope_kind === "conversation_window") {
    return `${item.conversation_id || "Missing Conversation"} · ${when(item.accepted_from)} → ${when(item.accepted_until)}`;
  }
  if (item.scope_kind === "exact_media_file") return item.media_file_object_id || "Missing Media file";
  return item.resource_version_id || "Missing Resource Version";
}

function eligibleForPackage(item: MessagesLegalPreservedObject): boolean {
  return item.preservation_status === "held"
    && (item.response_classification === "responsive"
      || item.response_classification === "elevated_review");
}

function activePackageApproval(detail: MessagesLegalDisclosurePackageDetail | null): boolean {
  if (!detail) return false;
  return detail.approvals.some(
    (approval) => approval.status === "active"
      && approval.approval_scope === "package"
      && approval.selection_fingerprint === detail.package.selection_fingerprint,
  );
}

function activeElevatedApproval(
  detail: MessagesLegalDisclosurePackageDetail | null,
  preservedObjectId: string,
): boolean {
  if (!detail) return false;
  return detail.approvals.some(
    (approval) => approval.status === "active"
      && approval.approval_scope === "elevated_object"
      && approval.legal_preserved_object_id === preservedObjectId
      && approval.selection_fingerprint === detail.package.selection_fingerprint,
  );
}

function allElevatedObjectsApproved(
  detail: MessagesLegalDisclosurePackageDetail | null,
): boolean {
  if (!detail) return false;
  return detail.objects
    .filter((item) => item.response_classification === "elevated_review")
    .every((item) => activeElevatedApproval(detail, item.legal_preserved_object_id));
}

type ReasonAction =
  | { kind: "start_review" }
  | { kind: "materialize"; scope: MessagesLegalScope }
  | { kind: "release_scope"; scope: MessagesLegalScope }
  | { kind: "release_hold"; object: MessagesLegalPreservedObject }
  | { kind: "approve_package"; package: MessagesLegalPackageSummary }
  | { kind: "revoke_package"; package: MessagesLegalPackageSummary }
  | { kind: "approve_elevated"; package: MessagesLegalPackageSummary; preservedObjectId: string }
  | { kind: "revoke_elevated"; package: MessagesLegalPackageSummary; preservedObjectId: string }
  | { kind: "release_package"; package: MessagesLegalPackageSummary }
  | { kind: "void_package"; package: MessagesLegalPackageSummary }
  | { kind: "close_case" };

export function MessagesLegalPanel() {
  const [cases, setCases] = useState<MessagesLegalCaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessagesLegalCaseDetail | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packageDetail, setPackageDetail] = useState<MessagesLegalDisclosurePackageDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<MessagesLegalCaseStatus | "all">("under_review");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [openCaseOpen, setOpenCaseOpen] = useState(false);
  const [openCaseForm, setOpenCaseForm] = useState({
    requestReference: "",
    requestKind: "disclosure" as "preservation" | "disclosure" | "emergency" | "other",
    requestingAuthority: "",
    jurisdictionOrProcess: "",
    receivedAt: "",
    scopeStatement: "",
    noticeRestrictionState: "unknown" as "none" | "restricted" | "unknown",
    assignedUserId: "",
  });

  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeForm, setScopeForm] = useState({
    scopeKind: "exact_message" as MessagesLegalScopeKind,
    messageId: "",
    conversationId: "",
    acceptedFrom: "",
    acceptedUntil: "",
    mediaFileObjectId: "",
    resourceVersionId: "",
    scopeNote: "",
    reason: "",
  });

  const [classificationOpen, setClassificationOpen] = useState(false);
  const [classificationTarget, setClassificationTarget] = useState<MessagesLegalPreservedObject | null>(null);
  const [classification, setClassification] = useState<Exclude<MessagesLegalClassification, "unclassified">>("responsive");
  const [classificationReason, setClassificationReason] = useState("");

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceTarget, setEvidenceTarget] = useState<MessagesLegalPreservedObject | null>(null);
  const [evidencePurpose, setEvidencePurpose] = useState("");
  const [evidence, setEvidence] = useState<MessagesLegalEvidenceResult | null>(null);

  const [prepareOpen, setPrepareOpen] = useState(false);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [prepareForm, setPrepareForm] = useState({
    productionReference: "",
    scopeStatement: "",
    omissions: "",
  });

  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [assignedReviewUserId, setAssignedReviewUserId] = useState("");

  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryPackage, setDeliveryPackage] = useState<MessagesLegalPackageSummary | null>(null);
  const [deliveryPurpose, setDeliveryPurpose] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      setCases(await listMessagesLegalCases(statusFilter === "all" ? null : statusFilter));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Legal Request Cases could not be loaded.";
      if (/capability|required|permission|authorized/i.test(message)) {
        setAccessDenied(true);
        setCases([]);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadDetail = useCallback(async (caseId: string) => {
    setSelectedCaseId(caseId);
    setSelectedPackageId(null);
    setPackageDetail(null);
    setEvidence(null);
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await getMessagesLegalCase(caseId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Legal Request Case could not be loaded.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadPackage = useCallback(async (packageId: string) => {
    setSelectedPackageId(packageId);
    setPackageLoading(true);
    setError(null);
    try {
      setPackageDetail(await getMessagesLegalDisclosurePackage(packageId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Legal disclosure package could not be loaded.");
      setPackageDetail(null);
    } finally {
      setPackageLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadCases();
    if (selectedCaseId) {
      const next = await getMessagesLegalCase(selectedCaseId);
      setDetail(next);
      if (selectedPackageId) {
        const stillExists = next.packages.some((item) => item.id === selectedPackageId);
        if (stillExists) {
          setPackageDetail(await getMessagesLegalDisclosurePackage(selectedPackageId));
        } else {
          setSelectedPackageId(null);
          setPackageDetail(null);
        }
      }
    }
  }, [loadCases, selectedCaseId, selectedPackageId]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const eligibleObjects = useMemo(
    () => detail?.preserved_objects.filter(eligibleForPackage) ?? [],
    [detail],
  );

  async function runMutation(operation: () => Promise<unknown>, fallback: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
      setEvidence(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  async function performOpenCase() {
    if (
      busy
      || !openCaseForm.requestReference.trim()
      || !openCaseForm.requestingAuthority.trim()
      || !openCaseForm.jurisdictionOrProcess.trim()
      || !openCaseForm.receivedAt
      || !openCaseForm.scopeStatement.trim()
    ) return;
    try {
      await runMutation(
        () => openMessagesLegalRequestCase({
          requestReference: openCaseForm.requestReference.trim(),
          requestKind: openCaseForm.requestKind,
          requestingAuthority: openCaseForm.requestingAuthority.trim(),
          jurisdictionOrProcess: openCaseForm.jurisdictionOrProcess.trim(),
          receivedAt: new Date(openCaseForm.receivedAt).toISOString(),
          scopeStatement: openCaseForm.scopeStatement.trim(),
          noticeRestrictionState: openCaseForm.noticeRestrictionState,
          assignedUserId: openCaseForm.assignedUserId.trim() || null,
        }),
        "Legal Request Case could not be opened.",
      );
      setOpenCaseOpen(false);
      setOpenCaseForm({
        requestReference: "",
        requestKind: "disclosure",
        requestingAuthority: "",
        jurisdictionOrProcess: "",
        receivedAt: "",
        scopeStatement: "",
        noticeRestrictionState: "unknown",
        assignedUserId: "",
      });
    } catch {
      // Error is surfaced by runMutation.
    }
  }

  async function performAddScope() {
    if (!detail || !scopeForm.reason.trim() || busy) return;
    const kind = scopeForm.scopeKind;
    if (kind === "exact_message" && !scopeForm.messageId.trim()) return;
    if (kind === "conversation_window" && (!scopeForm.conversationId.trim() || !scopeForm.acceptedFrom || !scopeForm.acceptedUntil)) return;
    if (kind === "exact_media_file" && !scopeForm.mediaFileObjectId.trim()) return;
    if (kind === "exact_resource_version" && !scopeForm.resourceVersionId.trim()) return;
    try {
      await runMutation(
        () => updateMessagesLegalScope({
          caseId: detail.case.id,
          action: "add",
          scopeKind: kind,
          messageId: kind === "exact_message" ? scopeForm.messageId.trim() : null,
          conversationId: kind === "conversation_window" ? scopeForm.conversationId.trim() : null,
          acceptedFrom: kind === "conversation_window" ? new Date(scopeForm.acceptedFrom).toISOString() : null,
          acceptedUntil: kind === "conversation_window" ? new Date(scopeForm.acceptedUntil).toISOString() : null,
          mediaFileObjectId: kind === "exact_media_file" ? scopeForm.mediaFileObjectId.trim() : null,
          resourceVersionId: kind === "exact_resource_version" ? scopeForm.resourceVersionId.trim() : null,
          scopeNote: scopeForm.scopeNote.trim() || null,
          expectedRevision: detail.case.revision,
          reason: scopeForm.reason.trim(),
        }),
        "Legal preservation scope could not be added.",
      );
      setScopeOpen(false);
      setScopeForm({
        scopeKind: "exact_message",
        messageId: "",
        conversationId: "",
        acceptedFrom: "",
        acceptedUntil: "",
        mediaFileObjectId: "",
        resourceVersionId: "",
        scopeNote: "",
        reason: "",
      });
    } catch {
      // Error is surfaced by runMutation.
    }
  }

  async function performClassification() {
    if (!detail || !classificationTarget || !classificationReason.trim() || busy) return;
    try {
      await runMutation(
        () => classifyMessagesLegalObject(
          detail.case.id,
          classificationTarget.id,
          classificationTarget.revision,
          classification,
          classificationReason.trim(),
        ),
        "Legal response classification could not be recorded.",
      );
      setClassificationOpen(false);
      setClassificationTarget(null);
      setClassificationReason("");
    } catch {
      // Error is surfaced by runMutation.
    }
  }

  async function performEvidenceInspection() {
    if (!detail || !evidenceTarget || !evidencePurpose.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await inspectMessagesLegalEvidence(
        detail.case.id,
        evidenceTarget.id,
        evidencePurpose.trim(),
      );
      setEvidence(result);
      setEvidencePurpose("");
      setEvidenceOpen(false);
      const refreshed = await getMessagesLegalCase(detail.case.id);
      setDetail(refreshed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Legal evidence could not be inspected.");
    } finally {
      setBusy(false);
    }
  }

  async function performPrepare() {
    if (
      !detail
      || busy
      || !prepareForm.productionReference.trim()
      || !prepareForm.scopeStatement.trim()
      || selectedObjectIds.length === 0
    ) return;
    const omissions = prepareForm.omissions
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      await runMutation(
        () => prepareMessagesLegalDisclosure(
          detail.case.id,
          prepareForm.productionReference.trim(),
          prepareForm.scopeStatement.trim(),
          omissions,
          selectedObjectIds,
        ),
        "Legal disclosure package could not be prepared.",
      );
      setPrepareOpen(false);
      setSelectedObjectIds([]);
      setPrepareForm({ productionReference: "", scopeStatement: "", omissions: "" });
    } catch {
      // Error is surfaced by runMutation.
    }
  }

  async function performReasonAction() {
    if (!detail || !reasonAction || !reasonText.trim() || busy) return;
    const action = reasonAction;
    try {
      await runMutation(async () => {
        if (action.kind === "start_review") {
          return startMessagesLegalReview(
            detail.case.id,
            detail.case.revision,
            reasonText.trim(),
            assignedReviewUserId.trim() || null,
          );
        }
        if (action.kind === "materialize") {
          return materializeMessagesLegalPreservation(
            detail.case.id,
            action.scope.id,
            detail.case.revision,
            reasonText.trim(),
          );
        }
        if (action.kind === "release_scope") {
          return updateMessagesLegalScope({
            caseId: detail.case.id,
            action: "release",
            scopeId: action.scope.id,
            expectedRevision: detail.case.revision,
            reason: reasonText.trim(),
          });
        }
        if (action.kind === "release_hold") {
          return releaseMessagesLegalPreservation(
            detail.case.id,
            action.object.id,
            action.object.revision,
            reasonText.trim(),
          );
        }
        if (action.kind === "approve_package" || action.kind === "revoke_package") {
          return updateMessagesLegalDisclosureApproval(
            action.package.id,
            action.kind === "approve_package" ? "record_package" : "revoke_package",
            null,
            action.package.revision,
            action.package.selection_fingerprint,
            reasonText.trim(),
          );
        }
        if (action.kind === "approve_elevated" || action.kind === "revoke_elevated") {
          return updateMessagesLegalDisclosureApproval(
            action.package.id,
            action.kind === "approve_elevated" ? "record_elevated" : "revoke_elevated",
            action.preservedObjectId,
            action.package.revision,
            action.package.selection_fingerprint,
            reasonText.trim(),
          );
        }
        if (action.kind === "release_package") {
          return releaseMessagesLegalDisclosure(
            action.package.id,
            action.package.revision,
            reasonText.trim(),
          );
        }
        if (action.kind === "void_package") {
          return voidMessagesLegalDisclosure(
            action.package.id,
            action.package.revision,
            reasonText.trim(),
          );
        }
        return closeMessagesLegalRequestCase(
          detail.case.id,
          detail.case.revision,
          reasonText.trim(),
        );
      }, "Legal operation could not be completed.");
      setReasonAction(null);
      setReasonText("");
      setAssignedReviewUserId("");
    } catch {
      // Error is surfaced by runMutation.
    }
  }

  async function performGenerate(item: MessagesLegalPackageSummary) {
    try {
      await runMutation(
        () => submitMessagesLegalDisclosureGeneration(item.id, item.revision),
        "Legal disclosure generation could not be queued.",
      );
    } catch {
      // Error is surfaced by runMutation.
    }
  }

  async function performDelivery() {
    if (!deliveryPackage || !deliveryPurpose.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const target = await createMessagesLegalDisclosureDelivery(
        deliveryPackage.id,
        deliveryPurpose.trim(),
      );
      const anchor = document.createElement("a");
      anchor.href = target.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
      setDeliveryPurpose("");
      setDeliveryPackage(null);
      setDeliveryOpen(false);
      if (selectedCaseId) setDetail(await getMessagesLegalCase(selectedCaseId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Released Legal package could not be delivered.");
    } finally {
      setBusy(false);
    }
  }

  const packageFromDetail = detail?.packages.find((item) => item.id === selectedPackageId) ?? null;
  const packageHasApproval = activePackageApproval(packageDetail);
  const elevatedApprovalsComplete = allElevatedObjectsApproved(packageDetail);

  return (
    <section
      className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 sm:p-5"
      aria-labelledby="messages-legal-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black tracking-[0.14em] text-[var(--wk-text-faint)]">Legal</div>
          <h2 id="messages-legal-heading" className="mt-1 text-[18px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
            Legal Request Cases
          </h2>
          <p className="mt-1 max-w-[760px] text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Preserve exact objects, record human response decisions, and produce controlled disclosure packages without ambient access to private content.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-1">
            {(["open", "under_review", "closed", "all"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setSelectedCaseId(null);
                  setDetail(null);
                  setSelectedPackageId(null);
                  setPackageDetail(null);
                  setEvidence(null);
                }}
                className={`rounded-lg px-3 py-2 text-[10px] font-black ${
                  statusFilter === status
                    ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                    : "text-[var(--wk-text-muted)]"
                }`}
              >
                {status === "all" ? "All" : CASE_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
          {!accessDenied && (
            <>
              <button type="button" disabled={busy} onClick={() => void refresh()} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45">
                Refresh
              </button>
              <button type="button" onClick={() => setOpenCaseOpen(true)} className="wk-button wk-button-sm wk-button-primary">
                Open Legal Case
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 px-4 py-3 text-[11px] font-bold text-[var(--wk-danger)]">
          {error}
        </div>
      )}

      {accessDenied ? (
        <div className="mt-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-8 text-center">
          <div className="text-[12px] font-black text-[var(--wk-text)]">Legal authority is not assigned to this account.</div>
          <p className="mx-auto mt-2 max-w-[620px] text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            The Messages Control Center does not grant Legal case visibility or evidence access by itself.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
          <div className="min-h-[420px] overflow-hidden rounded-2xl border border-[var(--wk-border)]">
            {loading ? (
              <div className="space-y-2 p-3" aria-busy="true">
                {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-[var(--wk-surface-raised)]" />)}
              </div>
            ) : cases.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-[11px] font-bold text-[var(--wk-text-muted)]">
                No Legal Request Cases match this view.
              </div>
            ) : (
              <div className="divide-y divide-[var(--wk-divider)]">
                {cases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void loadDetail(item.id)}
                    className={`w-full px-4 py-4 text-left transition-colors hover:bg-[var(--wk-surface-raised)] ${
                      selectedCaseId === item.id ? "bg-[var(--wk-brand-soft)]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-black text-[var(--wk-text)]">{item.request_reference}</div>
                        <div className="mt-1 truncate text-[10px] font-bold text-[var(--wk-text-muted)]">{item.requesting_authority}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--wk-surface-raised)] px-2 py-1 text-[9px] font-black text-[var(--wk-text-muted)]">
                        {CASE_STATUS_LABELS[item.status] ?? humanize(item.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-[var(--wk-text-faint)]">
                      <span>{humanize(item.request_kind)}</span>
                      <span>{item.held_object_count} held</span>
                      <span>{item.package_count} packages</span>
                      <span>{when(item.received_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-[420px] rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
            {!selectedCaseId ? (
              <div className="flex min-h-[388px] items-center justify-center text-center text-[11px] font-bold text-[var(--wk-text-muted)]">
                Choose a Legal Request Case to review its safe metadata.
              </div>
            ) : detailLoading || !detail ? (
              <div className="min-h-[388px] animate-pulse rounded-xl bg-[var(--wk-surface-raised)]" aria-busy="true" />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-black text-[var(--wk-text)]">{detail.case.request_reference}</h3>
                      <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-1 text-[9px] font-black text-[var(--wk-text-muted)]">
                        {CASE_STATUS_LABELS[detail.case.status] ?? humanize(detail.case.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-[var(--wk-text-muted)]">{detail.case.requesting_authority}</div>
                    <div className="mt-1 break-all text-[9px] font-bold text-[var(--wk-text-faint)]">{detail.case.id}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.case.status === "open" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setReasonAction({ kind: "start_review" })}
                        className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                      >
                        Start Review
                      </button>
                    )}
                    {detail.case.status === "under_review" && (
                      <>
                        <button type="button" onClick={() => setScopeOpen(true)} className="wk-button wk-button-sm wk-button-ghost">
                          Add Scope
                        </button>
                        <button
                          type="button"
                          disabled={eligibleObjects.length === 0}
                          onClick={() => {
                            setSelectedObjectIds([]);
                            setPrepareForm((current) => ({ ...current, scopeStatement: detail.case.scope_statement }));
                            setPrepareOpen(true);
                          }}
                          className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                        >
                          Prepare Disclosure
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Kind", humanize(detail.case.request_kind)],
                    ["Received", when(detail.case.received_at)],
                    ["Notice", humanize(detail.case.notice_restriction_state)],
                    ["Revision", String(detail.case.revision)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">{label}</div>
                      <div className="mt-1 text-[11px] font-black text-[var(--wk-text)]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">Jurisdiction / process</div>
                    <div className="mt-2 text-[11px] leading-relaxed text-[var(--wk-text)]">{detail.case.jurisdiction_or_process}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">Scope statement</div>
                    <div className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--wk-text)]">{detail.case.scope_statement}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black tracking-[0.12em] text-[var(--wk-text-faint)]">Preservation scope</div>
                      <div className="mt-1 text-[13px] font-black text-[var(--wk-text)]">Finite scope rows</div>
                    </div>
                    <span className="text-[9px] font-bold text-[var(--wk-text-faint)]">{detail.scopes.length} total</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {detail.scopes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--wk-border)] px-4 py-5 text-center text-[10px] font-bold text-[var(--wk-text-muted)]">
                        No preservation scope has been recorded.
                      </div>
                    ) : detail.scopes.map((scope) => (
                      <div key={scope.id} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-black text-[var(--wk-text)]">{SCOPE_LABELS[scope.scope_kind] ?? humanize(scope.scope_kind)}</span>
                              <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-1 text-[8px] font-black uppercase text-[var(--wk-text-muted)]">{scope.status}</span>
                            </div>
                            <div className="mt-1 break-all text-[9px] font-bold text-[var(--wk-text-faint)]">{scopeIdentity(scope)}</div>
                            {scope.scope_note && <div className="mt-2 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">{scope.scope_note}</div>}
                          </div>
                          {detail.case.status === "under_review" && scope.status === "active" && (
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setReasonAction({ kind: "materialize", scope })}
                                className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                              >
                                Materialize
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setReasonAction({ kind: "release_scope", scope })}
                                className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                              >
                                Release Scope
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black tracking-[0.12em] text-[var(--wk-text-faint)]">Exact held objects</div>
                      <div className="mt-1 text-[13px] font-black text-[var(--wk-text)]">Preserved object ledger</div>
                    </div>
                    <span className="text-[9px] font-bold text-[var(--wk-text-faint)]">{detail.preserved_objects.length} total</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {detail.preserved_objects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--wk-border)] px-4 py-5 text-center text-[10px] font-bold text-[var(--wk-text-muted)]">
                        Materialize an active scope to create exact held object identities.
                      </div>
                    ) : detail.preserved_objects.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-black text-[var(--wk-text)]">{humanize(item.object_kind)}</span>
                              <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-1 text-[8px] font-black uppercase text-[var(--wk-text-muted)]">{item.preservation_status}</span>
                              <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-1 text-[8px] font-black text-[var(--wk-brand)]">
                                {CLASSIFICATION_LABELS[item.response_classification] ?? humanize(item.response_classification)}
                              </span>
                            </div>
                            <div className="mt-1 break-all text-[9px] font-bold text-[var(--wk-text-faint)]">{objectIdentity(item)}</div>
                            {item.classification_reason && <div className="mt-2 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">{item.classification_reason}</div>}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {item.preservation_status === "held" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setEvidenceTarget(item);
                                  setEvidencePurpose("");
                                  setEvidenceOpen(true);
                                }}
                                className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                              >
                                Inspect Evidence
                              </button>
                            )}
                            {detail.case.status === "under_review" && item.preservation_status === "held" && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setClassificationTarget(item);
                                    setClassification(item.response_classification === "unclassified" ? "responsive" : item.response_classification as Exclude<MessagesLegalClassification, "unclassified">);
                                    setClassificationReason("");
                                    setClassificationOpen(true);
                                  }}
                                  className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                                >
                                  Classify
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setReasonAction({ kind: "release_hold", object: item })}
                                  className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                                >
                                  Release Hold
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {evidence && (
                  <div className="rounded-2xl border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black tracking-[0.12em] text-[var(--wk-brand)]">Deliberately inspected evidence</div>
                        <div className="mt-1 text-[9px] font-bold text-[var(--wk-text-faint)]">Object {shortId(evidence.legal_preserved_object_id)}</div>
                      </div>
                      <button type="button" onClick={() => setEvidence(null)} className="wk-button wk-button-sm wk-button-ghost">Hide Evidence</button>
                    </div>
                    <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--wk-bg)] p-3 text-[10px] leading-relaxed text-[var(--wk-text)]">
                      {JSON.stringify(evidence.evidence, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black tracking-[0.12em] text-[var(--wk-text-faint)]">Disclosure packages</div>
                      <div className="mt-1 text-[13px] font-black text-[var(--wk-text)]">Exact production identities</div>
                    </div>
                    <span className="text-[9px] font-bold text-[var(--wk-text-faint)]">{detail.packages.length} total</span>
                  </div>
                  <div className="mt-2 grid gap-2 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-2">
                      {detail.packages.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--wk-border)] px-4 py-5 text-center text-[10px] font-bold text-[var(--wk-text-muted)]">
                          No disclosure package has been prepared.
                        </div>
                      ) : detail.packages.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void loadPackage(item.id)}
                          className={`w-full rounded-xl border p-3 text-left ${
                            selectedPackageId === item.id
                              ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                              : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[11px] font-black text-[var(--wk-text)]">{item.production_reference}</div>
                              <div className="mt-1 text-[9px] font-bold text-[var(--wk-text-faint)]">{when(item.requested_at)}</div>
                            </div>
                            <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-1 text-[8px] font-black uppercase text-[var(--wk-text-muted)]">{item.status}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="min-h-[190px] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                      {!selectedPackageId ? (
                        <div className="flex min-h-[164px] items-center justify-center text-center text-[10px] font-bold text-[var(--wk-text-muted)]">
                          Choose a package to review its exact selection and approvals.
                        </div>
                      ) : packageLoading || !packageDetail || !packageFromDetail ? (
                        <div className="min-h-[164px] animate-pulse rounded-lg bg-[var(--wk-surface-raised)]" aria-busy="true" />
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-[11px] font-black text-[var(--wk-text)]">{packageFromDetail.production_reference}</div>
                              <div className="mt-1 break-all text-[8px] font-bold text-[var(--wk-text-faint)]">Fingerprint {packageFromDetail.selection_fingerprint}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {!packageHasApproval && packageFromDetail.status === "draft" && elevatedApprovalsComplete && (
                                <button type="button" onClick={() => setReasonAction({ kind: "approve_package", package: packageFromDetail })} className="wk-button wk-button-sm wk-button-primary">Approve Package</button>
                              )}
                              {packageHasApproval && ["approved", "draft"].includes(packageFromDetail.status) && (
                                <button type="button" onClick={() => setReasonAction({ kind: "revoke_package", package: packageFromDetail })} className="wk-button wk-button-sm wk-button-ghost">Revoke Approval</button>
                              )}
                              {packageFromDetail.status === "approved" && (
                                <button type="button" disabled={busy} onClick={() => void performGenerate(packageFromDetail)} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">Generate</button>
                              )}
                              {packageFromDetail.status === "generated" && (
                                <button type="button" onClick={() => setReasonAction({ kind: "release_package", package: packageFromDetail })} className="wk-button wk-button-sm wk-button-primary">Release</button>
                              )}
                              {packageFromDetail.status === "released" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeliveryPackage(packageFromDetail);
                                    setDeliveryPurpose("");
                                    setDeliveryOpen(true);
                                  }}
                                  className="wk-button wk-button-sm wk-button-primary"
                                >
                                  Deliver Package
                                </button>
                              )}
                              {!["released", "voided", "queued", "generating"].includes(packageFromDetail.status) && (
                                <button type="button" onClick={() => setReasonAction({ kind: "void_package", package: packageFromDetail })} className="wk-button wk-button-sm wk-button-ghost">Void</button>
                              )}
                            </div>
                          </div>

                          {packageFromDetail.failure_summary && (
                            <div className="rounded-lg border border-[var(--wk-danger)]/30 bg-[var(--wk-danger)]/10 p-2.5 text-[9px] font-bold text-[var(--wk-danger)]">
                              {packageFromDetail.failure_summary}
                            </div>
                          )}

                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg bg-[var(--wk-bg)] p-2.5">
                              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">Manifest SHA-256</div>
                              <div className="mt-1 break-all text-[9px] font-bold text-[var(--wk-text)]">{packageFromDetail.manifest_sha256 || "Not generated"}</div>
                            </div>
                            <div className="rounded-lg bg-[var(--wk-bg)] p-2.5">
                              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">Package SHA-256</div>
                              <div className="mt-1 break-all text-[9px] font-bold text-[var(--wk-text)]">{packageFromDetail.package_sha256 || "Not generated"}</div>
                            </div>
                          </div>

                          {!elevatedApprovalsComplete && packageDetail.objects.some((item) => item.response_classification === "elevated_review") && packageFromDetail.status === "draft" && (
                            <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2.5 text-[9px] font-bold text-[var(--wk-text-muted)]">
                              Approve every Elevated Review object before recording package approval.
                            </div>
                          )}

                          {packageFromDetail.documented_omissions.length > 0 && (
                            <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2.5">
                              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">Documented omissions</div>
                              <ul className="mt-2 space-y-1 text-[9px] leading-relaxed text-[var(--wk-text-muted)]">
                                {packageFromDetail.documented_omissions.map((item, index) => <li key={`${index}-${item}`}>• {item}</li>)}
                              </ul>
                            </div>
                          )}

                          {packageDetail.package.manifest_text && (
                            <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2.5">
                              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--wk-text-faint)]">Exact generated manifest</div>
                              <pre className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words text-[8px] leading-relaxed text-[var(--wk-text)]">{packageDetail.package.manifest_text}</pre>
                              <span className="sr-only">V110 exact manifest review</span>
                            </div>
                          )}

                          <div className="space-y-2">
                            {packageDetail.objects.map((item) => {
                              const elevated = item.response_classification === "elevated_review";
                              const approved = elevated ? activeElevatedApproval(packageDetail, item.legal_preserved_object_id) : true;
                              return (
                                <div key={item.id} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2.5">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="text-[10px] font-black text-[var(--wk-text)]">#{item.manifest_order} {humanize(item.object_kind)}</div>
                                      <div className="mt-1 break-all text-[8px] font-bold text-[var(--wk-text-faint)]">{item.legal_preserved_object_id}</div>
                                      <div className="mt-1 text-[8px] font-black text-[var(--wk-text-muted)]">{CLASSIFICATION_LABELS[item.response_classification] ?? humanize(item.response_classification)}</div>
                                      {item.source_fingerprint && (
                                        <div className="mt-1 break-all text-[8px] font-bold text-[var(--wk-text-faint)]">Source fingerprint {item.source_fingerprint}</div>
                                      )}
                                      {item.object_sha256 && (
                                        <div className="mt-1 break-all text-[8px] font-bold text-[var(--wk-text-faint)]">Emitted SHA-256 {item.object_sha256}{item.object_byte_size !== null ? ` · ${item.object_byte_size.toLocaleString()} bytes` : ""}</div>
                                      )}
                                      {item.output_path && (
                                        <div className="mt-1 break-all text-[8px] font-bold text-[var(--wk-text-faint)]">Output {item.output_path}{item.output_mime_type ? ` · ${item.output_mime_type}` : ""}</div>
                                      )}
                                    </div>
                                    {elevated && ["draft", "approved"].includes(packageFromDetail.status) && (
                                      <button
                                        type="button"
                                        onClick={() => setReasonAction({
                                          kind: approved ? "revoke_elevated" : "approve_elevated",
                                          package: packageFromDetail,
                                          preservedObjectId: item.legal_preserved_object_id,
                                        })}
                                        className={`wk-button wk-button-sm ${approved ? "wk-button-ghost" : "wk-button-primary"}`}
                                      >
                                        {approved ? "Revoke Elevated Approval" : "Approve Elevated Object"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-black tracking-[0.12em] text-[var(--wk-text-faint)]">Case history</div>
                  <div className="mt-2 max-h-[260px] space-y-2 overflow-auto pr-1">
                    {detail.events.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--wk-border)] px-4 py-5 text-center text-[10px] font-bold text-[var(--wk-text-muted)]">No Legal events.</div>
                    ) : detail.events.slice().reverse().map((event) => (
                      <div key={event.id} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-black text-[var(--wk-text)]">{humanize(event.event_kind)}</div>
                            <div className="mt-1 text-[8px] font-bold text-[var(--wk-text-faint)]">{event.actor_kind} · {shortId(event.actor_user_id || event.actor_key)}</div>
                          </div>
                          <span className="text-[8px] font-bold text-[var(--wk-text-faint)]">{when(event.occurred_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {detail.case.status === "under_review" && (
                  <div className="flex justify-end border-t border-[var(--wk-divider)] pt-4">
                    <button type="button" onClick={() => setReasonAction({ kind: "close_case" })} className="wk-button wk-button-sm wk-button-ghost">
                      Close Legal Case
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={openCaseOpen} onClose={() => !busy && setOpenCaseOpen(false)} title="Open Legal Request Case" maxWidth="lg">
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Record the request as received. WAKILISHA stores the human legal decision context but does not calculate legal entitlement.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-black text-[var(--wk-text-muted)]">Request reference
              <input className="wk-input mt-1 w-full" value={openCaseForm.requestReference} onChange={(event) => setOpenCaseForm((current) => ({ ...current, requestReference: event.target.value }))} maxLength={240} autoFocus />
            </label>
            <label className="text-[10px] font-black text-[var(--wk-text-muted)]">Request kind
              <select className="wk-input mt-1 w-full" value={openCaseForm.requestKind} onChange={(event) => setOpenCaseForm((current) => ({ ...current, requestKind: event.target.value as typeof current.requestKind }))}>
                <option value="preservation">Preservation</option><option value="disclosure">Disclosure</option><option value="emergency">Emergency</option><option value="other">Other</option>
              </select>
            </label>
            <label className="text-[10px] font-black text-[var(--wk-text-muted)]">Requesting authority
              <input className="wk-input mt-1 w-full" value={openCaseForm.requestingAuthority} onChange={(event) => setOpenCaseForm((current) => ({ ...current, requestingAuthority: event.target.value }))} maxLength={500} />
            </label>
            <label className="text-[10px] font-black text-[var(--wk-text-muted)]">Jurisdiction or process
              <input className="wk-input mt-1 w-full" value={openCaseForm.jurisdictionOrProcess} onChange={(event) => setOpenCaseForm((current) => ({ ...current, jurisdictionOrProcess: event.target.value }))} maxLength={500} />
            </label>
            <label className="text-[10px] font-black text-[var(--wk-text-muted)]">Received at
              <input type="datetime-local" className="wk-input mt-1 w-full" value={openCaseForm.receivedAt} onChange={(event) => setOpenCaseForm((current) => ({ ...current, receivedAt: event.target.value }))} />
            </label>
            <label className="text-[10px] font-black text-[var(--wk-text-muted)]">Notice restriction
              <select className="wk-input mt-1 w-full" value={openCaseForm.noticeRestrictionState} onChange={(event) => setOpenCaseForm((current) => ({ ...current, noticeRestrictionState: event.target.value as typeof current.noticeRestrictionState }))}>
                <option value="unknown">Unknown</option><option value="none">None</option><option value="restricted">Restricted</option>
              </select>
            </label>
          </div>
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Scope statement
            <textarea className="wk-input mt-1 w-full resize-y" rows={4} value={openCaseForm.scopeStatement} onChange={(event) => setOpenCaseForm((current) => ({ ...current, scopeStatement: event.target.value }))} maxLength={8192} />
          </label>
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Assigned user UUID <span className="font-bold text-[var(--wk-text-faint)]">optional</span>
            <input className="wk-input mt-1 w-full" value={openCaseForm.assignedUserId} onChange={(event) => setOpenCaseForm((current) => ({ ...current, assignedUserId: event.target.value }))} placeholder="Leave blank to assign during review" />
          </label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpenCaseOpen(false)} className="wk-button wk-button-sm wk-button-ghost">Cancel</button><button type="button" disabled={busy || !openCaseForm.requestReference.trim() || !openCaseForm.requestingAuthority.trim() || !openCaseForm.jurisdictionOrProcess.trim() || !openCaseForm.receivedAt || !openCaseForm.scopeStatement.trim()} onClick={() => void performOpenCase()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{busy ? "Recording..." : "Open Case"}</button></div>
        </div>
      </Modal>

      <Modal open={scopeOpen} onClose={() => !busy && setScopeOpen(false)} title="Add Preservation Scope" maxWidth="lg">
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">Scopes are finite selectors. They do not disclose content until exact objects are materialized, classified, selected, approved, and generated.</p>
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Scope kind
            <select className="wk-input mt-1 w-full" value={scopeForm.scopeKind} onChange={(event) => setScopeForm((current) => ({ ...current, scopeKind: event.target.value as MessagesLegalScopeKind }))}>
              <option value="exact_message">Exact Message</option><option value="conversation_window">Conversation Window</option><option value="exact_media_file">Exact Media File</option><option value="exact_resource_version">Exact Resource Version</option>
            </select>
          </label>
          {scopeForm.scopeKind === "exact_message" && <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Message UUID<input className="wk-input mt-1 w-full" value={scopeForm.messageId} onChange={(event) => setScopeForm((current) => ({ ...current, messageId: event.target.value }))} /></label>}
          {scopeForm.scopeKind === "conversation_window" && <div className="grid gap-3 sm:grid-cols-3"><label className="text-[10px] font-black text-[var(--wk-text-muted)]">Conversation UUID<input className="wk-input mt-1 w-full" value={scopeForm.conversationId} onChange={(event) => setScopeForm((current) => ({ ...current, conversationId: event.target.value }))} /></label><label className="text-[10px] font-black text-[var(--wk-text-muted)]">Accepted from<input type="datetime-local" className="wk-input mt-1 w-full" value={scopeForm.acceptedFrom} onChange={(event) => setScopeForm((current) => ({ ...current, acceptedFrom: event.target.value }))} /></label><label className="text-[10px] font-black text-[var(--wk-text-muted)]">Accepted until<input type="datetime-local" className="wk-input mt-1 w-full" value={scopeForm.acceptedUntil} onChange={(event) => setScopeForm((current) => ({ ...current, acceptedUntil: event.target.value }))} /></label></div>}
          {scopeForm.scopeKind === "exact_media_file" && <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Media file object UUID<input className="wk-input mt-1 w-full" value={scopeForm.mediaFileObjectId} onChange={(event) => setScopeForm((current) => ({ ...current, mediaFileObjectId: event.target.value }))} /></label>}
          {scopeForm.scopeKind === "exact_resource_version" && <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Resource Version UUID<input className="wk-input mt-1 w-full" value={scopeForm.resourceVersionId} onChange={(event) => setScopeForm((current) => ({ ...current, resourceVersionId: event.target.value }))} /></label>}
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Scope note <span className="font-bold text-[var(--wk-text-faint)]">optional</span><textarea className="wk-input mt-1 w-full resize-y" rows={3} value={scopeForm.scopeNote} onChange={(event) => setScopeForm((current) => ({ ...current, scopeNote: event.target.value }))} maxLength={4096} /></label>
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Reason<textarea className="wk-input mt-1 w-full resize-y" rows={3} value={scopeForm.reason} onChange={(event) => setScopeForm((current) => ({ ...current, reason: event.target.value }))} maxLength={8192} /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setScopeOpen(false)} className="wk-button wk-button-sm wk-button-ghost">Cancel</button><button type="button" disabled={busy || !scopeForm.reason.trim()} onClick={() => void performAddScope()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{busy ? "Recording..." : "Add Scope"}</button></div>
        </div>
      </Modal>

      <Modal open={classificationOpen} onClose={() => !busy && setClassificationOpen(false)} title="Classify Exact Held Object" maxWidth="md">
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">Classification is a recorded human response decision. It does not disclose the object by itself.</p>
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Classification<select className="wk-input mt-1 w-full" value={classification} onChange={(event) => setClassification(event.target.value as typeof classification)}><option value="responsive">Responsive</option><option value="elevated_review">Elevated Review</option><option value="excluded">Excluded</option></select></label>
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Reason<textarea className="wk-input mt-1 w-full resize-y" rows={4} value={classificationReason} onChange={(event) => setClassificationReason(event.target.value)} maxLength={8192} autoFocus /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setClassificationOpen(false)} className="wk-button wk-button-sm wk-button-ghost">Cancel</button><button type="button" disabled={busy || !classificationReason.trim()} onClick={() => void performClassification()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{busy ? "Recording..." : "Record Classification"}</button></div>
        </div>
      </Modal>

      <Modal open={evidenceOpen} onClose={() => !busy && setEvidenceOpen(false)} title="Inspect Exact Legal Evidence" maxWidth="md">
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">Record why this exact held object needs inspection. The case view does not auto-render Message bodies, restricted Media, or Resource payloads.</p>
          <textarea className="wk-input w-full resize-y" rows={4} value={evidencePurpose} onChange={(event) => setEvidencePurpose(event.target.value)} maxLength={4096} autoFocus placeholder="Purpose for inspection" />
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEvidenceOpen(false)} className="wk-button wk-button-sm wk-button-ghost">Cancel</button><button type="button" disabled={busy || !evidencePurpose.trim()} onClick={() => void performEvidenceInspection()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{busy ? "Recording..." : "Inspect Evidence"}</button></div>
        </div>
      </Modal>

      <Modal open={prepareOpen} onClose={() => !busy && setPrepareOpen(false)} title="Prepare Exact Disclosure Package" maxWidth="lg">
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">Select only held objects already classified Responsive or Elevated Review. Excluded and unclassified objects are not eligible.</p>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-black text-[var(--wk-text-muted)]">Production reference<input className="wk-input mt-1 w-full" value={prepareForm.productionReference} onChange={(event) => setPrepareForm((current) => ({ ...current, productionReference: event.target.value }))} maxLength={240} /></label><label className="text-[10px] font-black text-[var(--wk-text-muted)]">Scope statement<input className="wk-input mt-1 w-full" value={prepareForm.scopeStatement} onChange={(event) => setPrepareForm((current) => ({ ...current, scopeStatement: event.target.value }))} maxLength={8192} /></label></div>
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Documented omissions <span className="font-bold text-[var(--wk-text-faint)]">one per line</span><textarea className="wk-input mt-1 w-full resize-y" rows={3} value={prepareForm.omissions} onChange={(event) => setPrepareForm((current) => ({ ...current, omissions: event.target.value }))} /></label>
          <div className="max-h-[300px] space-y-2 overflow-auto rounded-xl border border-[var(--wk-border)] p-2">
            {eligibleObjects.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-[var(--wk-surface-raised)]"><input type="checkbox" className="mt-0.5" checked={selectedObjectIds.includes(item.id)} onChange={(event) => setSelectedObjectIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span className="min-w-0"><span className="block text-[10px] font-black text-[var(--wk-text)]">{humanize(item.object_kind)} · {CLASSIFICATION_LABELS[item.response_classification]}</span><span className="mt-1 block break-all text-[8px] font-bold text-[var(--wk-text-faint)]">{objectIdentity(item)}</span></span></label>)}
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setPrepareOpen(false)} className="wk-button wk-button-sm wk-button-ghost">Cancel</button><button type="button" disabled={busy || !prepareForm.productionReference.trim() || !prepareForm.scopeStatement.trim() || selectedObjectIds.length === 0} onClick={() => void performPrepare()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{busy ? "Preparing..." : `Prepare ${selectedObjectIds.length} Object${selectedObjectIds.length === 1 ? "" : "s"}`}</button></div>
        </div>
      </Modal>

      <Modal open={Boolean(reasonAction)} onClose={() => !busy && setReasonAction(null)} title={reasonAction ? humanize(reasonAction.kind) : "Legal Action"} maxWidth="md">
        <div className="space-y-4">
          {reasonAction?.kind === "start_review" && <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">Assigned user UUID <span className="font-bold text-[var(--wk-text-faint)]">optional</span><input className="wk-input mt-1 w-full" value={assignedReviewUserId} onChange={(event) => setAssignedReviewUserId(event.target.value)} /></label>}
          <label className="block text-[10px] font-black text-[var(--wk-text-muted)]">{reasonAction?.kind === "close_case" ? "Closure note" : "Reason"}<textarea className="wk-input mt-1 w-full resize-y" rows={4} value={reasonText} onChange={(event) => setReasonText(event.target.value)} maxLength={8192} autoFocus /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setReasonAction(null)} className="wk-button wk-button-sm wk-button-ghost">Cancel</button><button type="button" disabled={busy || !reasonText.trim()} onClick={() => void performReasonAction()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{busy ? "Recording..." : "Continue"}</button></div>
        </div>
      </Modal>

      <Modal open={deliveryOpen} onClose={() => !busy && setDeliveryOpen(false)} title="Deliver Released Legal Package" maxWidth="md">
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">A short-lived signed URL is created only for this released Legal package. Record the delivery purpose before opening it.</p>
          <textarea className="wk-input w-full resize-y" rows={4} value={deliveryPurpose} onChange={(event) => setDeliveryPurpose(event.target.value)} maxLength={4096} autoFocus placeholder="Purpose for controlled delivery" />
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setDeliveryOpen(false)} className="wk-button wk-button-sm wk-button-ghost">Cancel</button><button type="button" disabled={busy || !deliveryPurpose.trim()} onClick={() => void performDelivery()} className="wk-button wk-button-sm wk-button-primary disabled:opacity-45">{busy ? "Authorizing..." : "Open Released Package"}</button></div>
        </div>
      </Modal>
    </section>
  );
}
