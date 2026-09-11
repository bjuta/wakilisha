import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Modal } from "@/components/design-system/primitives/Modal";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/design-system/primitives/SearchableSelect";
import {
  WkAuditTimeline,
  type WkAuditTimelineEvent,
} from "@/components/design-system/primitives/AuditTimeline";
import { WkCommandSheet } from "@/components/design-system/primitives/CommandSheet";
import { WkDateTimePicker } from "@/components/design-system/primitives/DateTimePicker";
import {
  WkEntityPicker,
  type WkEntityPickerOption,
} from "@/components/design-system/primitives/EntityPicker";
import { WkInspector } from "@/components/design-system/primitives/Inspector";
import { WkStateBadge } from "@/components/design-system/primitives/StateBadge";
import {
  WkWorkflowRail,
  type WkWorkflowStep,
} from "@/components/design-system/primitives/WorkflowRail";
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
  searchMessagesLegalReviewers,
  searchMessagesLegalScopeTargets,
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
  type MessagesLegalScopeTargetKind,
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

const REQUEST_KIND_OPTIONS: SearchableSelectOption[] = [
  { value: "preservation", label: "Preservation" },
  { value: "disclosure", label: "Disclosure" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

const NOTICE_OPTIONS: SearchableSelectOption[] = [
  {
    value: "unknown",
    label: "Unknown",
    description: "No notice restriction has been established yet.",
  },
  {
    value: "none",
    label: "None",
    description: "No notice restriction is recorded.",
  },
  {
    value: "restricted",
    label: "Restricted",
    description: "Notice is restricted by the recorded legal process.",
  },
];

const SCOPE_KIND_OPTIONS: SearchableSelectOption[] = [
  {
    value: "exact_message",
    label: "Exact Message",
    description: "One canonical Message identity.",
  },
  {
    value: "conversation_window",
    label: "Conversation Window",
    description: "One Conversation plus a finite accepted-time window.",
  },
  {
    value: "exact_media_file",
    label: "Exact Media File",
    description: "One canonical Media file-object identity.",
  },
  {
    value: "exact_resource_version",
    label: "Exact Resource Version",
    description: "One immutable Resource Version identity.",
  },
];

const CLASSIFICATION_OPTIONS: SearchableSelectOption[] = [
  {
    value: "responsive",
    label: "Responsive",
    description: "The held object is responsive to the recorded scope.",
  },
  {
    value: "elevated_review",
    label: "Elevated Review",
    description: "Explicit elevated approval is required before package approval.",
  },
  {
    value: "excluded",
    label: "Excluded",
    description: "The object is excluded from disclosure production.",
  },
];

const SCOPE_TARGET_KIND: Record<
  MessagesLegalScopeKind,
  MessagesLegalScopeTargetKind
> = {
  exact_message: "message",
  conversation_window: "conversation",
  exact_media_file: "media_file",
  exact_resource_version: "resource_version",
};

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  return value.length > 18
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
}

function objectIdentity(item: MessagesLegalPreservedObject): string {
  return (
    item.message_id
    || item.media_file_object_id
    || item.resource_version_id
    || item.id
  );
}

function scopeIdentity(item: MessagesLegalScope): string {
  if (item.scope_kind === "exact_message") {
    return item.message_id || "Missing Message";
  }
  if (item.scope_kind === "conversation_window") {
    return [
      item.conversation_id || "Missing Conversation",
      `${when(item.accepted_from)} to ${when(item.accepted_until)}`,
    ].join(" · ");
  }
  if (item.scope_kind === "exact_media_file") {
    return item.media_file_object_id || "Missing Media file";
  }
  return item.resource_version_id || "Missing Resource Version";
}

function eligibleForPackage(
  item: MessagesLegalPreservedObject,
): boolean {
  return (
    item.preservation_status === "held"
    && (
      item.response_classification === "responsive"
      || item.response_classification === "elevated_review"
    )
  );
}

function activePackageApproval(
  detail: MessagesLegalDisclosurePackageDetail | null,
): boolean {
  if (!detail) return false;
  return detail.approvals.some(
    (approval) =>
      approval.status === "active"
      && approval.approval_scope === "package"
      && approval.selection_fingerprint
        === detail.package.selection_fingerprint,
  );
}

function activeElevatedApproval(
  detail: MessagesLegalDisclosurePackageDetail | null,
  preservedObjectId: string,
): boolean {
  if (!detail) return false;
  return detail.approvals.some(
    (approval) =>
      approval.status === "active"
      && approval.approval_scope === "elevated_object"
      && approval.legal_preserved_object_id === preservedObjectId
      && approval.selection_fingerprint
        === detail.package.selection_fingerprint,
  );
}

function allElevatedObjectsApproved(
  detail: MessagesLegalDisclosurePackageDetail | null,
): boolean {
  if (!detail) return false;
  return detail.objects
    .filter(
      (item) => item.response_classification === "elevated_review",
    )
    .every(
      (item) =>
        activeElevatedApproval(
          detail,
          item.legal_preserved_object_id,
        ),
    );
}

function packageTone(
  status: MessagesLegalPackageSummary["status"],
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "released" || status === "generated") return "success";
  if (status === "queued" || status === "generating") return "info";
  if (status === "failed" || status === "voided") return "danger";
  if (status === "approved") return "warning";
  return "neutral";
}

function buildWorkflowSteps(
  detail: MessagesLegalCaseDetail,
  activePackage: MessagesLegalPackageSummary | null,
): WkWorkflowStep[] {
  const underReview = detail.case.status === "under_review";
  const closed = detail.case.status === "closed";
  const hasScope = detail.scopes.length > 0;
  const activeScopes = detail.scopes.filter(
    (scope) => scope.status === "active",
  );
  const heldObjects = detail.preserved_objects.filter(
    (item) => item.preservation_status === "held",
  );
  const eligibleObjects = heldObjects.filter(eligibleForPackage);
  const hasPackage = detail.packages.length > 0;
  const packageStatus = activePackage?.status ?? null;
  const workerActive =
    packageStatus === "queued" || packageStatus === "generating";
  const generatedOrReleased =
    packageStatus === "generated" || packageStatus === "released";
  const released = packageStatus === "released";
  const deliveryRecorded = detail.events.some(
    (event) =>
      event.event_kind.toLowerCase().includes("deliver")
      && (
        !activePackage
        || event.legal_disclosure_package_id === activePackage.id
      ),
  );
  const closureAvailable =
    underReview
    && activeScopes.length === 0
    && heldObjects.length === 0
    && !workerActive;

  return [
    {
      id: "request",
      label: "Request",
      description: "Case and legal process recorded.",
      state: "complete",
    },
    {
      id: "review",
      label: "Review",
      description: closed
        ? "Review completed."
        : underReview
          ? "Human review is active."
          : "Start human review.",
      state: closed ? "complete" : underReview ? "complete" : "current",
    },
    {
      id: "scope",
      label: "Scope",
      description: hasScope
        ? "Finite scope recorded."
        : "Define exact preservation scope.",
      state: closed
        ? "complete"
        : !underReview
          ? "blocked"
          : hasScope
            ? "complete"
            : "current",
    },
    {
      id: "evidence",
      label: "Evidence",
      description: heldObjects.length > 0
        ? "Held objects are available for purpose-audited inspection."
        : "Materialize scope into exact held objects.",
      state: closed
        ? "complete"
        : heldObjects.length > 0
          ? "available"
          : hasScope && underReview
            ? "current"
            : "blocked",
    },
    {
      id: "disclosure",
      label: "Disclosure",
      description: hasPackage
        ? "Disclosure selection prepared."
        : "Select classified held objects.",
      state: closed
        ? "complete"
        : hasPackage
          ? "complete"
          : eligibleObjects.length > 0
            ? "current"
            : "blocked",
    },
    {
      id: "approval",
      label: "Approval",
      description: packageStatus
        ? `Package is ${humanize(packageStatus)}.`
        : "Package approval follows exact selection.",
      state: closed
        ? "complete"
        : !activePackage
          ? "blocked"
          : packageStatus === "draft"
            ? "current"
            : "complete",
    },
    {
      id: "generation",
      label: "Generation",
      description: workerActive
        ? "Worker-backed generation is in progress."
        : generatedOrReleased
          ? "Package generation completed."
          : "Generation begins after package approval.",
      state: closed
        ? "complete"
        : !activePackage || packageStatus === "draft"
          ? "blocked"
          : workerActive || packageStatus === "approved"
            ? "current"
            : generatedOrReleased
              ? "complete"
              : "available",
    },
    {
      id: "release",
      label: "Release",
      description: released
        ? "Package is released."
        : "Release follows successful generation.",
      state: closed
        ? "complete"
        : !activePackage || !generatedOrReleased
          ? "blocked"
          : released
            ? "complete"
            : "current",
    },
    {
      id: "delivery",
      label: "Delivery",
      description: deliveryRecorded
        ? "Controlled delivery was authorized."
        : "Delivery requires a released package and recorded purpose.",
      state: closed && deliveryRecorded
        ? "complete"
        : !released
          ? "blocked"
          : deliveryRecorded
            ? "complete"
            : "current",
    },
    {
      id: "closure",
      label: "Closure",
      description: closed
        ? "Case is closed."
        : closureAvailable
          ? "No active hold or worker state blocks closure."
          : "Release active scope, holds, and in-flight work first.",
      state: closed ? "complete" : closureAvailable ? "available" : "blocked",
    },
  ];
}

function nextGovernedAction(
  detail: MessagesLegalCaseDetail,
  activePackage: MessagesLegalPackageSummary | null,
): string {
  if (detail.case.status === "closed") return "Case closed";
  if (detail.case.status === "open") return "Start human review";

  const activeScopes = detail.scopes.filter(
    (scope) => scope.status === "active",
  );
  const held = detail.preserved_objects.filter(
    (item) => item.preservation_status === "held",
  );
  const unclassified = held.filter(
    (item) => item.response_classification === "unclassified",
  );
  const eligible = held.filter(eligibleForPackage);

  if (detail.scopes.length === 0) return "Add finite preservation scope";
  if (held.length === 0 && activeScopes.length > 0) {
    return "Materialize an active scope";
  }
  if (unclassified.length > 0) return "Classify held objects";
  if (!activePackage && eligible.length > 0) {
    return "Prepare an exact disclosure package";
  }
  if (activePackage?.status === "draft") {
    return "Complete elevated and package approval";
  }
  if (activePackage?.status === "approved") {
    return "Generate the approved package";
  }
  if (
    activePackage?.status === "queued"
    || activePackage?.status === "generating"
  ) {
    return "Generation is in progress";
  }
  if (activePackage?.status === "generated") {
    return "Release the generated package";
  }
  if (activePackage?.status === "released") {
    return "Deliver the released package or close remaining holds";
  }
  if (activeScopes.length > 0) return "Release completed scope";
  if (held.length > 0) return "Release remaining holds";
  return "Close the Legal Request Case";
}

interface LegalRemotePickerProps {
  label: string;
  helper: string;
  query: string;
  onQueryChange: (value: string) => void;
  minLength: number;
  searching: boolean;
  onSearch: () => Promise<void>;
  value: string;
  onChange: (value: string) => void;
  options: WkEntityPickerOption[];
  resultLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
}

function LegalRemotePicker({
  label,
  helper,
  query,
  onQueryChange,
  minLength,
  searching,
  onSearch,
  value,
  onChange,
  options,
  resultLabel,
  searchPlaceholder,
  emptyLabel,
}: LegalRemotePickerProps) {
  const canSearch = query.trim().length >= minLength;

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black text-wk-text-muted">
        {label}
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            className="wk-input min-w-0 flex-1"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSearch && !searching) {
                event.preventDefault();
                void onSearch();
              }
            }}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={!canSearch || searching}
            onClick={() => void onSearch()}
            className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </label>

      <p className="text-[10px] leading-relaxed text-wk-text-faint">
        {helper}
      </p>

      <WkEntityPicker
        label={resultLabel}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={
          options.length > 0
            ? "Choose a search result"
            : `Search ${minLength}+ characters first`
        }
        searchPlaceholder="Filter returned results"
        emptyLabel={emptyLabel}
        disabled={searching || options.length === 0}
      />
    </div>
  );
}

type ReasonAction =
  | { kind: "start_review" }
  | { kind: "materialize"; scope: MessagesLegalScope }
  | { kind: "release_scope"; scope: MessagesLegalScope }
  | { kind: "release_hold"; object: MessagesLegalPreservedObject }
  | { kind: "approve_package"; package: MessagesLegalPackageSummary }
  | { kind: "revoke_package"; package: MessagesLegalPackageSummary }
  | {
      kind: "approve_elevated";
      package: MessagesLegalPackageSummary;
      preservedObjectId: string;
    }
  | {
      kind: "revoke_elevated";
      package: MessagesLegalPackageSummary;
      preservedObjectId: string;
    }
  | { kind: "release_package"; package: MessagesLegalPackageSummary }
  | { kind: "void_package"; package: MessagesLegalPackageSummary }
  | { kind: "close_case" };

export function MessagesLegalPanel() {
  const [cases, setCases] = useState<MessagesLegalCaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessagesLegalCaseDetail | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packageDetail, setPackageDetail] =
    useState<MessagesLegalDisclosurePackageDetail | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<MessagesLegalCaseStatus | "all">("under_review");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [openCaseOpen, setOpenCaseOpen] = useState(false);
  const [openCaseForm, setOpenCaseForm] = useState({
    requestReference: "",
    requestKind: "disclosure" as
      | "preservation"
      | "disclosure"
      | "emergency"
      | "other",
    requestingAuthority: "",
    jurisdictionOrProcess: "",
    receivedAt: "",
    scopeStatement: "",
    noticeRestrictionState: "unknown" as
      | "none"
      | "restricted"
      | "unknown",
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
  const [scopeSearchQuery, setScopeSearchQuery] = useState("");
  const [scopeSearchOptions, setScopeSearchOptions] =
    useState<WkEntityPickerOption[]>([]);
  const [scopeSearching, setScopeSearching] = useState(false);

  const [classificationOpen, setClassificationOpen] = useState(false);
  const [classificationTarget, setClassificationTarget] =
    useState<MessagesLegalPreservedObject | null>(null);
  const [classification, setClassification] =
    useState<Exclude<MessagesLegalClassification, "unclassified">>(
      "responsive",
    );
  const [classificationReason, setClassificationReason] = useState("");

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceTarget, setEvidenceTarget] =
    useState<MessagesLegalPreservedObject | null>(null);
  const [evidencePurpose, setEvidencePurpose] = useState("");
  const [evidence, setEvidence] =
    useState<MessagesLegalEvidenceResult | null>(null);

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
  const [reviewerSearchQuery, setReviewerSearchQuery] = useState("");
  const [reviewerOptions, setReviewerOptions] =
    useState<WkEntityPickerOption[]>([]);
  const [reviewerSearching, setReviewerSearching] = useState(false);

  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryPackage, setDeliveryPackage] =
    useState<MessagesLegalPackageSummary | null>(null);
  const [deliveryPurpose, setDeliveryPurpose] = useState("");
  const [packageInspectorOpen, setPackageInspectorOpen] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    try {
      setCases(
        await listMessagesLegalCases(
          statusFilter === "all" ? null : statusFilter,
        ),
      );
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Legal Request Cases could not be loaded.";
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
    setPackageInspectorOpen(false);
    setEvidence(null);
    setDetailLoading(true);
    setError(null);

    try {
      setDetail(await getMessagesLegalCase(caseId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Legal Request Case could not be loaded.",
      );
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadPackage = useCallback(async (packageId: string) => {
    setSelectedPackageId(packageId);
    setPackageInspectorOpen(false);
    setPackageLoading(true);
    setError(null);

    try {
      setPackageDetail(await getMessagesLegalDisclosurePackage(packageId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Legal disclosure package could not be loaded.",
      );
      setPackageDetail(null);
    } finally {
      setPackageLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadCases();
    if (!selectedCaseId) return;

    const next = await getMessagesLegalCase(selectedCaseId);
    setDetail(next);

    if (!selectedPackageId) return;
    const stillExists = next.packages.some(
      (item) => item.id === selectedPackageId,
    );
    if (!stillExists) {
      setSelectedPackageId(null);
      setPackageDetail(null);
      setPackageInspectorOpen(false);
      return;
    }
    setPackageDetail(await getMessagesLegalDisclosurePackage(selectedPackageId));
  }, [loadCases, selectedCaseId, selectedPackageId]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const eligibleObjects = useMemo(
    () => detail?.preserved_objects.filter(eligibleForPackage) ?? [],
    [detail],
  );

  const packageFromDetail = useMemo(
    () =>
      detail?.packages.find((item) => item.id === selectedPackageId) ?? null,
    [detail, selectedPackageId],
  );

  const workflowPackage = useMemo(() => {
    if (packageFromDetail) return packageFromDetail;
    if (!detail || detail.packages.length === 0) return null;
    return [...detail.packages].sort(
      (a, b) =>
        new Date(b.requested_at).getTime()
        - new Date(a.requested_at).getTime(),
    )[0] ?? null;
  }, [detail, packageFromDetail]);

  const workflowSteps = useMemo(
    () => (detail ? buildWorkflowSteps(detail, workflowPackage) : []),
    [detail, workflowPackage],
  );

  const nextAction = useMemo(
    () => (detail ? nextGovernedAction(detail, workflowPackage) : ""),
    [detail, workflowPackage],
  );

  const packageHasApproval = activePackageApproval(packageDetail);
  const elevatedApprovalsComplete = allElevatedObjectsApproved(packageDetail);

  const closureAvailable = workflowSteps.some(
    (step) =>
      step.id === "closure"
      && step.state === "available",
  );

  const selectedScopeTargetId =
    scopeForm.scopeKind === "exact_message"
      ? scopeForm.messageId
      : scopeForm.scopeKind === "conversation_window"
        ? scopeForm.conversationId
        : scopeForm.scopeKind === "exact_media_file"
          ? scopeForm.mediaFileObjectId
          : scopeForm.resourceVersionId;

  useEffect(() => {
    if (
      !selectedCaseId
      || !selectedPackageId
      || !packageFromDetail
      || !["queued", "generating"].includes(packageFromDetail.status)
    ) {
      return undefined;
    }

    let cancelled = false;
    let running = false;

    const poll = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        const [nextCase, nextPackage] = await Promise.all([
          getMessagesLegalCase(selectedCaseId),
          getMessagesLegalDisclosurePackage(selectedPackageId),
        ]);
        if (!cancelled) {
          setDetail(nextCase);
          setPackageDetail(nextPackage);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Legal package status could not be refreshed.",
          );
        }
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [packageFromDetail, selectedCaseId, selectedPackageId]);

  async function runMutation(
    operation: () => Promise<unknown>,
    fallback: string,
  ) {
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
          assignedUserId: null,
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
      });
    } catch {
      // Error is surfaced by runMutation.
    }
  }

  async function performScopeSearch() {
    if (!detail || scopeSearching || scopeSearchQuery.trim().length < 3) {
      return;
    }
    setScopeSearching(true);
    setError(null);
    try {
      const rows = await searchMessagesLegalScopeTargets(
        detail.case.id,
        SCOPE_TARGET_KIND[scopeForm.scopeKind],
        scopeSearchQuery,
        20,
      );
      setScopeSearchOptions(
        rows.map((row) => ({
          value: row.target_id,
          label: row.label,
          kind: humanize(row.target_kind),
          context: [
            row.context,
            row.occurred_at ? when(row.occurred_at) : null,
          ].filter(Boolean).join(" · "),
        })),
      );
    } catch (reason) {
      setScopeSearchOptions([]);
      setError(
        reason instanceof Error
          ? reason.message
          : "Legal scope targets could not be searched.",
      );
    } finally {
      setScopeSearching(false);
    }
  }

  function selectScopeTarget(value: string) {
    setScopeForm((current) => ({
      ...current,
      messageId: current.scopeKind === "exact_message" ? value : "",
      conversationId:
        current.scopeKind === "conversation_window" ? value : "",
      mediaFileObjectId:
        current.scopeKind === "exact_media_file" ? value : "",
      resourceVersionId:
        current.scopeKind === "exact_resource_version" ? value : "",
    }));
  }

  async function performAddScope() {
    if (!detail || !scopeForm.reason.trim() || busy) return;
    const kind = scopeForm.scopeKind;

    if (kind === "exact_message" && !scopeForm.messageId) return;
    if (
      kind === "conversation_window"
      && (
        !scopeForm.conversationId
        || !scopeForm.acceptedFrom
        || !scopeForm.acceptedUntil
      )
    ) return;
    if (kind === "exact_media_file" && !scopeForm.mediaFileObjectId) return;
    if (kind === "exact_resource_version" && !scopeForm.resourceVersionId) {
      return;
    }

    try {
      await runMutation(
        () => updateMessagesLegalScope({
          caseId: detail.case.id,
          action: "add",
          scopeKind: kind,
          messageId: kind === "exact_message" ? scopeForm.messageId : null,
          conversationId:
            kind === "conversation_window" ? scopeForm.conversationId : null,
          acceptedFrom:
            kind === "conversation_window"
              ? new Date(scopeForm.acceptedFrom).toISOString()
              : null,
          acceptedUntil:
            kind === "conversation_window"
              ? new Date(scopeForm.acceptedUntil).toISOString()
              : null,
          mediaFileObjectId:
            kind === "exact_media_file" ? scopeForm.mediaFileObjectId : null,
          resourceVersionId:
            kind === "exact_resource_version" ? scopeForm.resourceVersionId : null,
          scopeNote: scopeForm.scopeNote.trim() || null,
          expectedRevision: detail.case.revision,
          reason: scopeForm.reason.trim(),
        }),
        "Legal preservation scope could not be added.",
      );
      setScopeOpen(false);
      setScopeSearchQuery("");
      setScopeSearchOptions([]);
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

  async function performReviewerSearch() {
    if (!detail || reviewerSearching || reviewerSearchQuery.trim().length < 2) {
      return;
    }
    setReviewerSearching(true);
    setError(null);
    try {
      const rows = await searchMessagesLegalReviewers(
        detail.case.id,
        reviewerSearchQuery,
        20,
      );
      setReviewerOptions(
        rows.map((row) => ({
          value: row.user_id,
          label: row.display_name,
          kind: "Legal Super Admin",
          context: row.secondary_label || "Eligible Legal reviewer",
        })),
      );
    } catch (reason) {
      setReviewerOptions([]);
      setError(
        reason instanceof Error
          ? reason.message
          : "Eligible Legal reviewers could not be searched.",
      );
    } finally {
      setReviewerSearching(false);
    }
  }

  async function performClassification() {
    if (
      !detail
      || !classificationTarget
      || !classificationReason.trim()
      || busy
    ) return;

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
      setDetail(await getMessagesLegalCase(detail.case.id));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Legal evidence could not be inspected.",
      );
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
      setPrepareForm({
        productionReference: "",
        scopeStatement: "",
        omissions: "",
      });
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
            assignedReviewUserId || null,
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
        if (
          action.kind === "approve_package"
          || action.kind === "revoke_package"
        ) {
          return updateMessagesLegalDisclosureApproval(
            action.package.id,
            action.kind === "approve_package"
              ? "record_package"
              : "revoke_package",
            null,
            action.package.revision,
            action.package.selection_fingerprint,
            reasonText.trim(),
          );
        }
        if (
          action.kind === "approve_elevated"
          || action.kind === "revoke_elevated"
        ) {
          return updateMessagesLegalDisclosureApproval(
            action.package.id,
            action.kind === "approve_elevated"
              ? "record_elevated"
              : "revoke_elevated",
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

      if (action.kind === "start_review") {
        setStatusFilter("under_review");
      } else if (action.kind === "close_case") {
        setStatusFilter("closed");
      }

      setReasonAction(null);
      setReasonText("");
      setAssignedReviewUserId("");
      setReviewerSearchQuery("");
      setReviewerOptions([]);
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
      window.location.assign(target.url);
      setDeliveryPurpose("");
      setDeliveryPackage(null);
      setDeliveryOpen(false);
      if (selectedCaseId) {
        setDetail(await getMessagesLegalCase(selectedCaseId));
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Released Legal package could not be delivered.",
      );
    } finally {
      setBusy(false);
    }
  }

  const auditEvents: WkAuditTimelineEvent[] =
    detail?.events.slice().reverse().map((event) => ({
      id: event.id,
      label: humanize(event.event_kind),
      actor: [
        humanize(event.actor_kind),
        shortId(event.actor_user_id || event.actor_key),
      ].join(" · "),
      occurredAt: event.occurred_at,
      detail: Object.keys(event.metadata ?? {}).length > 0 ? (
        <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words text-[9px] leading-relaxed">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      ) : undefined,
    })) ?? [];

  return (
    <section aria-labelledby="messages-legal-heading">
      <div className="flex flex-col gap-3 border-b border-wk-divider pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
            Legal casework
          </div>
          <h3
            id="messages-legal-heading"
            className="mt-1 text-[18px] font-black tracking-[-0.02em] text-wk-text"
          >
            Governed preservation and disclosure
          </h3>
          <p className="mt-1 max-w-[760px] text-[11px] leading-relaxed text-wk-text-muted">
            Work one Legal Request Case through finite scope, preservation,
            human classification, exact disclosure, approval, generation,
            release, delivery, and closure. Private evidence remains
            purpose-audited and non-ambient.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-wk-border bg-wk-bg-subtle p-1">
            {(["open", "under_review", "closed", "all"] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={statusFilter === status}
                  onClick={() => {
                    setStatusFilter(status);
                    setSelectedCaseId(null);
                    setDetail(null);
                    setSelectedPackageId(null);
                    setPackageDetail(null);
                    setEvidence(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-[10px] font-black transition-colors ${
                    statusFilter === status
                      ? "bg-wk-brand-soft text-wk-brand"
                      : "text-wk-text-muted hover:bg-wk-surface-raised"
                  }`}
                >
                  {status === "all" ? "All" : CASE_STATUS_LABELS[status]}
                </button>
              ),
            )}
          </div>

          {!accessDenied ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void refresh()}
                className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setOpenCaseOpen(true)}
                className="wk-button wk-button-sm wk-button-primary"
              >
                Open Legal Case
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-wk-danger/30 bg-wk-danger/10 px-4 py-3 text-[11px] font-bold text-wk-danger">
          {error}
        </div>
      ) : null}

      {accessDenied ? (
        <div className="mt-4 rounded-2xl border border-wk-border bg-wk-bg-subtle px-5 py-8 text-center">
          <div className="text-[12px] font-black text-wk-text">
            Legal authority is not assigned to this account.
          </div>
          <p className="mx-auto mt-2 max-w-[620px] text-[11px] leading-relaxed text-wk-text-muted">
            Messages Operations does not grant Legal case visibility or
            private evidence access by itself.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(280px,0.68fr)_minmax(0,1.32fr)]">
          <aside className="min-h-[520px] min-w-0 overflow-hidden rounded-2xl border border-wk-border bg-wk-surface">
            <div className="border-b border-wk-divider px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Case queue
              </div>
              <div className="mt-1 text-[12px] font-black text-wk-text">
                {statusFilter === "all"
                  ? "All Legal Request Cases"
                  : `${CASE_STATUS_LABELS[statusFilter]} cases`}
              </div>
            </div>

            {loading ? (
              <div className="space-y-2 p-3" aria-busy="true">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-28 animate-pulse rounded-xl bg-wk-surface-raised"
                  />
                ))}
              </div>
            ) : cases.length === 0 ? (
              <div className="flex min-h-[440px] items-center justify-center px-6 text-center text-[11px] font-bold text-wk-text-muted">
                No Legal Request Cases match this queue.
              </div>
            ) : (
              <div className="divide-y divide-wk-divider">
                {cases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void loadDetail(item.id)}
                    className={`w-full px-4 py-4 text-left transition-colors hover:bg-wk-surface-raised ${
                      selectedCaseId === item.id ? "bg-wk-brand-soft" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-black text-wk-text">
                          {item.request_reference}
                        </div>
                        <div className="mt-1 truncate text-[10px] font-bold text-wk-text-muted">
                          {item.requesting_authority}
                        </div>
                      </div>
                      <WkStateBadge
                        tone={
                          item.status === "closed"
                            ? "success"
                            : item.status === "under_review"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {CASE_STATUS_LABELS[item.status] ?? humanize(item.status)}
                      </WkStateBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-wk-text-faint">
                      <span>{humanize(item.request_kind)}</span>
                      <span>{item.held_object_count} held</span>
                      <span>{item.package_count} packages</span>
                      <span>{when(item.received_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <div className="min-h-[520px] min-w-0 rounded-2xl border border-wk-border bg-wk-bg-subtle p-4">
            {!selectedCaseId ? (
              <div className="flex min-h-[488px] items-center justify-center px-8 text-center text-[11px] font-bold text-wk-text-muted">
                Choose a Legal Request Case to enter its governed workbench.
              </div>
            ) : detailLoading || !detail ? (
              <div
                className="min-h-[488px] animate-pulse rounded-xl bg-wk-surface-raised"
                aria-busy="true"
              />
            ) : (
              <div className="min-w-0 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="wk-identity-wrap text-[16px] font-black text-wk-text">
                        {detail.case.request_reference}
                      </h4>
                      <WkStateBadge
                        tone={
                          detail.case.status === "closed"
                            ? "success"
                            : detail.case.status === "under_review"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {CASE_STATUS_LABELS[detail.case.status]
                          ?? humanize(detail.case.status)}
                      </WkStateBadge>
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-wk-text-muted">
                      {detail.case.requesting_authority}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {detail.case.status === "open" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setAssignedReviewUserId("");
                          setReviewerSearchQuery("");
                          setReviewerOptions([]);
                          setReasonText("");
                          setReasonAction({ kind: "start_review" });
                        }}
                        className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                      >
                        Start Review
                      </button>
                    ) : null}

                    {detail.case.status === "under_review" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setScopeSearchQuery("");
                            setScopeSearchOptions([]);
                            setScopeOpen(true);
                          }}
                          className="wk-button wk-button-sm wk-button-ghost"
                        >
                          Add Scope
                        </button>
                        <button
                          type="button"
                          disabled={eligibleObjects.length === 0}
                          onClick={() => {
                            setSelectedObjectIds([]);
                            setPrepareForm((current) => ({
                              ...current,
                              scopeStatement: detail.case.scope_statement,
                            }));
                            setPrepareOpen(true);
                          }}
                          className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                        >
                          Prepare Disclosure
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <section className="rounded-2xl border border-wk-border bg-wk-surface p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                        Governed workflow
                      </div>
                      <div className="mt-1 text-[13px] font-black text-wk-text">
                        Request to closure
                      </div>
                    </div>
                    <div className="rounded-xl bg-wk-brand-soft px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.12em] text-wk-brand">
                        Next governed action
                      </div>
                      <div className="mt-0.5 text-[10px] font-black text-wk-text">
                        {nextAction}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <WkWorkflowRail
                      steps={workflowSteps}
                      ariaLabel="Legal Request Case workflow"
                    />
                  </div>
                </section>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Kind", humanize(detail.case.request_kind)],
                    ["Received", when(detail.case.received_at)],
                    [
                      "Notice",
                      humanize(detail.case.notice_restriction_state),
                    ],
                    ["Revision", String(detail.case.revision)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-wk-border bg-wk-surface p-3"
                    >
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                        {label}
                      </div>
                      <div className="mt-1 text-[11px] font-black text-wk-text">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Jurisdiction / process
                    </div>
                    <div className="mt-2 text-[11px] leading-relaxed text-wk-text">
                      {detail.case.jurisdiction_or_process}
                    </div>
                  </div>
                  <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                      Scope statement
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-wk-text">
                      {detail.case.scope_statement}
                    </div>
                  </div>
                </div>

                <section>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                        Scope
                      </div>
                      <div className="mt-1 text-[13px] font-black text-wk-text">
                        Finite preservation selectors
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-wk-text-faint">
                      {detail.scopes.length} total
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {detail.scopes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-wk-border px-4 py-5 text-center text-[10px] font-bold text-wk-text-muted">
                        No preservation scope has been recorded.
                      </div>
                    ) : (
                      detail.scopes.map((scope) => (
                        <div
                          key={scope.id}
                          className="rounded-xl border border-wk-border bg-wk-surface p-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-black text-wk-text">
                                  {SCOPE_LABELS[scope.scope_kind]
                                    ?? humanize(scope.scope_kind)}
                                </span>
                                <WkStateBadge
                                  tone={
                                    scope.status === "active"
                                      ? "info"
                                      : "neutral"
                                  }
                                >
                                  {scope.status}
                                </WkStateBadge>
                              </div>
                              <div className="mt-1 break-all text-[9px] font-bold text-wk-text-faint">
                                {scopeIdentity(scope)}
                              </div>
                              {scope.scope_note ? (
                                <div className="mt-2 text-[10px] leading-relaxed text-wk-text-muted">
                                  {scope.scope_note}
                                </div>
                              ) : null}
                            </div>

                            {detail.case.status === "under_review"
                            && scope.status === "active" ? (
                              <div className="flex shrink-0 flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setReasonText("");
                                    setReasonAction({ kind: "materialize", scope });
                                  }}
                                  className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                                >
                                  Materialize
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setReasonText("");
                                    setReasonAction({ kind: "release_scope", scope });
                                  }}
                                  className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                                >
                                  Release Scope
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                        Evidence
                      </div>
                      <div className="mt-1 text-[13px] font-black text-wk-text">
                        Exact held object ledger
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-wk-text-faint">
                      {detail.preserved_objects.length} total
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {detail.preserved_objects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-wk-border px-4 py-5 text-center text-[10px] font-bold text-wk-text-muted">
                        Materialize an active scope to create exact held object
                        identities.
                      </div>
                    ) : (
                      detail.preserved_objects.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-wk-border bg-wk-surface p-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-black text-wk-text">
                                  {humanize(item.object_kind)}
                                </span>
                                <WkStateBadge
                                  tone={
                                    item.preservation_status === "held"
                                      ? "info"
                                      : "neutral"
                                  }
                                >
                                  {item.preservation_status}
                                </WkStateBadge>
                                <WkStateBadge
                                  tone={
                                    item.response_classification === "elevated_review"
                                      ? "warning"
                                      : item.response_classification === "responsive"
                                        ? "success"
                                        : "neutral"
                                  }
                                >
                                  {CLASSIFICATION_LABELS[
                                    item.response_classification
                                  ] ?? humanize(item.response_classification)}
                                </WkStateBadge>
                              </div>
                              <div className="mt-1 break-all text-[9px] font-bold text-wk-text-faint">
                                {objectIdentity(item)}
                              </div>
                              {item.classification_reason ? (
                                <div className="mt-2 text-[10px] leading-relaxed text-wk-text-muted">
                                  {item.classification_reason}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              {item.preservation_status === "held" ? (
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
                              ) : null}

                              {detail.case.status === "under_review"
                              && item.preservation_status === "held" ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setClassificationTarget(item);
                                      setClassification(
                                        item.response_classification
                                          === "unclassified"
                                          ? "responsive"
                                          : item.response_classification as Exclude<
                                              MessagesLegalClassification,
                                              "unclassified"
                                            >,
                                      );
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
                                    onClick={() => {
                                      setReasonText("");
                                      setReasonAction({ kind: "release_hold", object: item });
                                    }}
                                    className="wk-button wk-button-sm wk-button-ghost disabled:opacity-45"
                                  >
                                    Release Hold
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                        Disclosure
                      </div>
                      <div className="mt-1 text-[13px] font-black text-wk-text">
                        Exact disclosure packages
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-wk-text-faint">
                      {detail.packages.length} total
                    </span>
                  </div>

                  <div className="mt-2 grid gap-2 lg:grid-cols-[0.82fr_1.18fr]">
                    <div className="space-y-2">
                      {detail.packages.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-wk-border px-4 py-5 text-center text-[10px] font-bold text-wk-text-muted">
                          No disclosure package has been prepared.
                        </div>
                      ) : (
                        detail.packages.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void loadPackage(item.id)}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
                              selectedPackageId === item.id
                                ? "border-wk-brand bg-wk-brand-soft"
                                : "border-wk-border bg-wk-surface hover:bg-wk-surface-raised"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-[11px] font-black text-wk-text">
                                  {item.production_reference}
                                </div>
                                <div className="mt-1 text-[9px] font-bold text-wk-text-faint">
                                  {when(item.requested_at)}
                                </div>
                              </div>
                              <WkStateBadge tone={packageTone(item.status)}>
                                {humanize(item.status)}
                              </WkStateBadge>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="min-h-[220px] rounded-xl border border-wk-border bg-wk-surface p-3">
                      {!selectedPackageId ? (
                        <div className="flex min-h-[194px] items-center justify-center px-5 text-center text-[10px] font-bold text-wk-text-muted">
                          Choose a package to review human-readable selection,
                          approvals, and governed actions.
                        </div>
                      ) : packageLoading || !packageDetail || !packageFromDetail ? (
                        <div
                          className="min-h-[194px] animate-pulse rounded-lg bg-wk-surface-raised"
                          aria-busy="true"
                        />
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-[11px] font-black text-wk-text">
                                {packageFromDetail.production_reference}
                              </div>
                              <div className="mt-1 text-[9px] font-bold text-wk-text-faint">
                                {packageDetail.objects.length} exact object
                                {packageDetail.objects.length === 1 ? "" : "s"}
                                {" · "}
                                {packageDetail.approvals.length} approval record
                                {packageDetail.approvals.length === 1 ? "" : "s"}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setPackageInspectorOpen(true)}
                                className="wk-button wk-button-sm wk-button-ghost"
                              >
                                Inspect Package
                              </button>

                              {!packageHasApproval
                              && packageFromDetail.status === "draft"
                              && elevatedApprovalsComplete ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReasonText("");
                                    setReasonAction({
                                      kind: "approve_package",
                                      package: packageFromDetail,
                                    });
                                  }}
                                  className="wk-button wk-button-sm wk-button-primary"
                                >
                                  Approve Package
                                </button>
                              ) : null}

                              {packageHasApproval
                              && ["approved", "draft"].includes(packageFromDetail.status) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReasonText("");
                                    setReasonAction({
                                      kind: "revoke_package",
                                      package: packageFromDetail,
                                    });
                                  }}
                                  className="wk-button wk-button-sm wk-button-ghost"
                                >
                                  Revoke Approval
                                </button>
                              ) : null}

                              {packageFromDetail.status === "approved" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void performGenerate(packageFromDetail)}
                                  className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
                                >
                                  Generate
                                </button>
                              ) : null}

                              {packageFromDetail.status === "generated" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReasonText("");
                                    setReasonAction({
                                      kind: "release_package",
                                      package: packageFromDetail,
                                    });
                                  }}
                                  className="wk-button wk-button-sm wk-button-primary"
                                >
                                  Release
                                </button>
                              ) : null}

                              {packageFromDetail.status === "released" ? (
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
                              ) : null}

                              {![
                                "released",
                                "voided",
                                "queued",
                                "generating",
                              ].includes(packageFromDetail.status) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReasonText("");
                                    setReasonAction({
                                      kind: "void_package",
                                      package: packageFromDetail,
                                    });
                                  }}
                                  className="wk-button wk-button-sm wk-button-ghost"
                                >
                                  Void
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {["queued", "generating"].includes(
                            packageFromDetail.status,
                          ) ? (
                            <div
                              aria-live="polite"
                              className="rounded-lg border border-wk-border bg-wk-brand-soft p-2.5 text-[9px] font-bold text-wk-text-muted"
                            >
                              Generation is active. This workbench polls only
                              while this package remains selected and
                              worker-backed state is active.
                            </div>
                          ) : null}

                          {packageFromDetail.failure_summary ? (
                            <div className="rounded-lg border border-wk-danger/30 bg-wk-danger/10 p-2.5 text-[9px] font-bold text-wk-danger">
                              {packageFromDetail.failure_summary}
                            </div>
                          ) : null}

                          {packageFromDetail.documented_omissions.length > 0 ? (
                            <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-2.5">
                              <div className="text-[8px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                                Documented omissions
                              </div>
                              <ul className="mt-2 space-y-1 text-[9px] leading-relaxed text-wk-text-muted">
                                {packageFromDetail.documented_omissions.map(
                                  (item, index) => (
                                    <li key={`${index}-${item}`}>• {item}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          ) : null}

                          {!elevatedApprovalsComplete
                          && packageDetail.objects.some(
                            (item) =>
                              item.response_classification === "elevated_review",
                          )
                          && packageFromDetail.status === "draft" ? (
                            <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-2.5 text-[9px] font-bold text-wk-text-muted">
                              Approve every Elevated Review object before
                              recording package approval.
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            {packageDetail.objects.map((item) => {
                              const elevated =
                                item.response_classification === "elevated_review";
                              const approved = elevated
                                ? activeElevatedApproval(
                                    packageDetail,
                                    item.legal_preserved_object_id,
                                  )
                                : true;

                              return (
                                <div
                                  key={item.id}
                                  className="rounded-lg border border-wk-border bg-wk-bg-subtle p-2.5"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <div className="text-[10px] font-black text-wk-text">
                                        #{item.manifest_order} {humanize(item.object_kind)}
                                      </div>
                                      <div className="mt-1 text-[8px] font-black text-wk-text-muted">
                                        {CLASSIFICATION_LABELS[
                                          item.response_classification
                                        ] ?? humanize(item.response_classification)}
                                      </div>
                                    </div>

                                    {elevated
                                    && ["draft", "approved"].includes(
                                      packageFromDetail.status,
                                    ) ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReasonText("");
                                          setReasonAction({
                                            kind: approved
                                              ? "revoke_elevated"
                                              : "approve_elevated",
                                            package: packageFromDetail,
                                            preservedObjectId:
                                              item.legal_preserved_object_id,
                                          });
                                        }}
                                        className={`wk-button wk-button-sm ${
                                          approved
                                            ? "wk-button-ghost"
                                            : "wk-button-primary"
                                        }`}
                                      >
                                        {approved
                                          ? "Revoke Elevated Approval"
                                          : "Approve Elevated Object"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                    Case activity
                  </div>
                  <div className="mt-2 max-h-[320px] overflow-auto pr-1">
                    <WkAuditTimeline
                      events={auditEvents}
                      emptyLabel="No Legal case activity has been recorded."
                      ariaLabel="Legal Request Case activity"
                    />
                  </div>
                </section>

                {detail.case.status === "under_review" ? (
                  <div className="flex justify-end border-t border-wk-divider pt-4">
                    <button
                      type="button"
                      disabled={busy || !closureAvailable}
                      title={
                        closureAvailable
                          ? undefined
                          : "Release active scope, held objects, and in-flight generation before closure."
                      }
                      onClick={() => {
                        setReasonText("");
                        setReasonAction({ kind: "close_case" });
                      }}
                      className="wk-button wk-button-sm wk-button-ghost disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Close Legal Case
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={openCaseOpen}
        onClose={() => !busy && setOpenCaseOpen(false)}
        title="Open Legal Request Case"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-wk-text-muted">
            Record the request as received. WAKILISHA stores the human legal
            decision context but does not calculate legal entitlement.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-black text-wk-text-muted">
              Request reference
              <input
                className="wk-input mt-1 w-full"
                value={openCaseForm.requestReference}
                onChange={(event) =>
                  setOpenCaseForm((current) => ({
                    ...current,
                    requestReference: event.target.value,
                  }))
                }
                maxLength={240}
                autoFocus
              />
            </label>

            <div>
              <div className="mb-1 text-[10px] font-black text-wk-text-muted">
                Request kind
              </div>
              <SearchableSelect
                ariaLabel="Request kind"
                value={openCaseForm.requestKind}
                onChange={(value) =>
                  setOpenCaseForm((current) => ({
                    ...current,
                    requestKind: value as typeof current.requestKind,
                  }))
                }
                options={REQUEST_KIND_OPTIONS}
                placeholder="Choose request kind"
                searchPlaceholder="Find request kind"
              />
            </div>

            <label className="text-[10px] font-black text-wk-text-muted">
              Requesting authority
              <input
                className="wk-input mt-1 w-full"
                value={openCaseForm.requestingAuthority}
                onChange={(event) =>
                  setOpenCaseForm((current) => ({
                    ...current,
                    requestingAuthority: event.target.value,
                  }))
                }
                maxLength={500}
              />
            </label>

            <label className="text-[10px] font-black text-wk-text-muted">
              Jurisdiction or process
              <input
                className="wk-input mt-1 w-full"
                value={openCaseForm.jurisdictionOrProcess}
                onChange={(event) =>
                  setOpenCaseForm((current) => ({
                    ...current,
                    jurisdictionOrProcess: event.target.value,
                  }))
                }
                maxLength={500}
              />
            </label>

            <WkDateTimePicker
              label="Received at"
              value={openCaseForm.receivedAt}
              onChange={(value) =>
                setOpenCaseForm((current) => ({
                  ...current,
                  receivedAt: value,
                }))
              }
            />

            <div>
              <div className="mb-1 text-[10px] font-black text-wk-text-muted">
                Notice restriction
              </div>
              <SearchableSelect
                ariaLabel="Notice restriction"
                value={openCaseForm.noticeRestrictionState}
                onChange={(value) =>
                  setOpenCaseForm((current) => ({
                    ...current,
                    noticeRestrictionState:
                      value as typeof current.noticeRestrictionState,
                  }))
                }
                options={NOTICE_OPTIONS}
                placeholder="Choose notice state"
                searchPlaceholder="Find notice state"
              />
            </div>
          </div>

          <label className="block text-[10px] font-black text-wk-text-muted">
            Scope statement
            <textarea
              className="wk-input mt-1 w-full resize-y"
              rows={4}
              value={openCaseForm.scopeStatement}
              onChange={(event) =>
                setOpenCaseForm((current) => ({
                  ...current,
                  scopeStatement: event.target.value,
                }))
              }
              maxLength={8192}
            />
          </label>

          <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2.5 text-[10px] leading-relaxed text-wk-text-muted">
            Reviewer assignment happens after the case exists, so reviewer
            discovery remains case-bound. Leaving review assignment unselected
            uses the existing current authorized Super Admin behavior.
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenCaseOpen(false)}
              className="wk-button wk-button-sm wk-button-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                busy
                || !openCaseForm.requestReference.trim()
                || !openCaseForm.requestingAuthority.trim()
                || !openCaseForm.jurisdictionOrProcess.trim()
                || !openCaseForm.receivedAt
                || !openCaseForm.scopeStatement.trim()
              }
              onClick={() => void performOpenCase()}
              className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
            >
              {busy ? "Recording..." : "Open Case"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={scopeOpen}
        onClose={() => !busy && setScopeOpen(false)}
        title="Add Preservation Scope"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-wk-text-muted">
            Scope is finite. Safe metadata discovery does not expose Message
            body, private Media location, Resource payload, or Legal evidence.
          </p>

          <div>
            <div className="mb-1 text-[10px] font-black text-wk-text-muted">
              Scope kind
            </div>
            <SearchableSelect
              ariaLabel="Legal scope kind"
              value={scopeForm.scopeKind}
              onChange={(value) => {
                setScopeForm((current) => ({
                  ...current,
                  scopeKind: value as MessagesLegalScopeKind,
                  messageId: "",
                  conversationId: "",
                  mediaFileObjectId: "",
                  resourceVersionId: "",
                }));
                setScopeSearchQuery("");
                setScopeSearchOptions([]);
              }}
              options={SCOPE_KIND_OPTIONS}
              placeholder="Choose scope kind"
              searchPlaceholder="Find scope kind"
            />
          </div>

          <LegalRemotePicker
            label={`Find ${
              SCOPE_LABELS[scopeForm.scopeKind] ?? humanize(scopeForm.scopeKind)
            }`}
            helper="Search is case-bound, deliberate, and capped at 20 safe metadata results. Routine raw identifier entry is not part of this flow."
            query={scopeSearchQuery}
            onQueryChange={setScopeSearchQuery}
            minLength={3}
            searching={scopeSearching}
            onSearch={performScopeSearch}
            value={selectedScopeTargetId}
            onChange={selectScopeTarget}
            options={scopeSearchOptions}
            resultLabel="Scope target"
            searchPlaceholder="Search name, identity, kind, or safe context"
            emptyLabel="No matching Legal scope targets"
          />

          {scopeForm.scopeKind === "conversation_window" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <WkDateTimePicker
                label="Accepted from"
                value={scopeForm.acceptedFrom}
                onChange={(value) =>
                  setScopeForm((current) => ({
                    ...current,
                    acceptedFrom: value,
                  }))
                }
              />
              <WkDateTimePicker
                label="Accepted until"
                value={scopeForm.acceptedUntil}
                onChange={(value) =>
                  setScopeForm((current) => ({
                    ...current,
                    acceptedUntil: value,
                  }))
                }
              />
            </div>
          ) : null}

          <label className="block text-[10px] font-black text-wk-text-muted">
            Scope note <span className="font-bold text-wk-text-faint">optional</span>
            <textarea
              className="wk-input mt-1 w-full resize-y"
              rows={3}
              value={scopeForm.scopeNote}
              onChange={(event) =>
                setScopeForm((current) => ({
                  ...current,
                  scopeNote: event.target.value,
                }))
              }
              maxLength={4096}
            />
          </label>

          <label className="block text-[10px] font-black text-wk-text-muted">
            Reason
            <textarea
              className="wk-input mt-1 w-full resize-y"
              rows={3}
              value={scopeForm.reason}
              onChange={(event) =>
                setScopeForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              maxLength={8192}
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setScopeOpen(false)}
              className="wk-button wk-button-sm wk-button-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                busy
                || !scopeForm.reason.trim()
                || !selectedScopeTargetId
                || (
                  scopeForm.scopeKind === "conversation_window"
                  && (!scopeForm.acceptedFrom || !scopeForm.acceptedUntil)
                )
              }
              onClick={() => void performAddScope()}
              className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
            >
              {busy ? "Recording..." : "Add Scope"}
            </button>
          </div>
        </div>
      </Modal>

      <WkCommandSheet
        open={classificationOpen}
        onClose={() => {
          if (!busy) setClassificationOpen(false);
        }}
        title="Classify Exact Held Object"
        eyebrow="Human response decision"
        description="Classification does not disclose the object by itself."
        primaryLabel="Record Classification"
        onPrimary={performClassification}
        primaryDisabled={!classificationReason.trim()}
        busy={busy}
        footerNote="Expected revision and Candidate C classification authority remain unchanged."
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-[10px] font-black text-wk-text-muted">
              Classification
            </div>
            <SearchableSelect
              ariaLabel="Response classification"
              value={classification}
              onChange={(value) =>
                setClassification(
                  value as Exclude<
                    MessagesLegalClassification,
                    "unclassified"
                  >,
                )
              }
              options={CLASSIFICATION_OPTIONS}
              placeholder="Choose classification"
              searchPlaceholder="Find classification"
            />
          </div>

          <label className="block text-[10px] font-black text-wk-text-muted">
            Reason
            <textarea
              className="wk-input mt-1 w-full resize-y"
              rows={4}
              value={classificationReason}
              onChange={(event) => setClassificationReason(event.target.value)}
              maxLength={8192}
              autoFocus
            />
          </label>
        </div>
      </WkCommandSheet>

      <WkCommandSheet
        open={evidenceOpen}
        onClose={() => {
          if (!busy) setEvidenceOpen(false);
        }}
        title="Inspect Exact Legal Evidence"
        eyebrow="Purpose-audited inspection"
        description="Private evidence stays outside the normal workbench until this exact held object is deliberately inspected."
        primaryLabel="Inspect Evidence"
        onPrimary={performEvidenceInspection}
        primaryDisabled={!evidencePurpose.trim()}
        busy={busy}
        footerNote="This action records the inspection purpose through existing Candidate C authority."
      >
        <label className="block text-[10px] font-black text-wk-text-muted">
          Inspection purpose
          <textarea
            className="wk-input mt-1 w-full resize-y"
            rows={4}
            value={evidencePurpose}
            onChange={(event) => setEvidencePurpose(event.target.value)}
            maxLength={4096}
            autoFocus
            placeholder="Why this exact held object needs inspection"
          />
        </label>
      </WkCommandSheet>

      <Modal
        open={prepareOpen}
        onClose={() => !busy && setPrepareOpen(false)}
        title="Prepare Exact Disclosure Package"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-wk-text-muted">
            Select only held objects already classified Responsive or Elevated
            Review. Excluded and unclassified objects are not eligible.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-black text-wk-text-muted">
              Production reference
              <input
                className="wk-input mt-1 w-full"
                value={prepareForm.productionReference}
                onChange={(event) =>
                  setPrepareForm((current) => ({
                    ...current,
                    productionReference: event.target.value,
                  }))
                }
                maxLength={240}
              />
            </label>
            <label className="text-[10px] font-black text-wk-text-muted">
              Scope statement
              <input
                className="wk-input mt-1 w-full"
                value={prepareForm.scopeStatement}
                onChange={(event) =>
                  setPrepareForm((current) => ({
                    ...current,
                    scopeStatement: event.target.value,
                  }))
                }
                maxLength={8192}
              />
            </label>
          </div>

          <label className="block text-[10px] font-black text-wk-text-muted">
            Documented omissions{" "}
            <span className="font-bold text-wk-text-faint">one per line</span>
            <textarea
              className="wk-input mt-1 w-full resize-y"
              rows={3}
              value={prepareForm.omissions}
              onChange={(event) =>
                setPrepareForm((current) => ({
                  ...current,
                  omissions: event.target.value,
                }))
              }
            />
          </label>

          <div className="max-h-[320px] space-y-2 overflow-auto rounded-xl border border-wk-border p-2">
            {eligibleObjects.map((item) => {
              const selected = selectedObjectIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() =>
                    setSelectedObjectIds((current) =>
                      selected
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id],
                    )
                  }
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-wk-brand/15 ${
                    selected
                      ? "border-wk-brand bg-wk-brand-soft"
                      : "border-transparent hover:bg-wk-surface-raised"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      selected
                        ? "border-wk-brand bg-wk-brand text-white"
                        : "border-wk-border-strong bg-wk-surface"
                    }`}
                  >
                    {selected ? <i className="ri-check-line text-[13px]" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black text-wk-text">
                      {humanize(item.object_kind)} · {CLASSIFICATION_LABELS[
                        item.response_classification
                      ]}
                    </span>
                    <span className="mt-1 block break-all text-[8px] font-bold text-wk-text-faint">
                      {objectIdentity(item)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPrepareOpen(false)}
              className="wk-button wk-button-sm wk-button-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                busy
                || !prepareForm.productionReference.trim()
                || !prepareForm.scopeStatement.trim()
                || selectedObjectIds.length === 0
              }
              onClick={() => void performPrepare()}
              className="wk-button wk-button-sm wk-button-primary disabled:opacity-45"
            >
              {busy
                ? "Preparing..."
                : `Prepare ${selectedObjectIds.length} Object${
                    selectedObjectIds.length === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        </div>
      </Modal>

      <WkCommandSheet
        open={Boolean(reasonAction)}
        onClose={() => {
          if (!busy) {
            setReasonAction(null);
            setReasonText("");
            setAssignedReviewUserId("");
            setReviewerSearchQuery("");
            setReviewerOptions([]);
          }
        }}
        title={reasonAction ? humanize(reasonAction.kind) : "Legal Action"}
        eyebrow="Governed Legal action"
        description="Record the human reason required by the existing Candidate C command contract."
        primaryLabel={
          reasonAction?.kind === "close_case"
            ? "Close Case"
            : reasonAction?.kind === "start_review"
              ? "Start Review"
              : "Continue"
        }
        onPrimary={performReasonAction}
        primaryDisabled={!reasonText.trim()}
        busy={busy}
        footerNote="Expected revisions, approval fingerprints, idempotency, and release prerequisites remain server-enforced."
      >
        <div className="space-y-4">
          {reasonAction?.kind === "start_review" ? (
            <LegalRemotePicker
              label="Find an eligible reviewer"
              helper="Search only active Super Admin identities eligible for this exact Legal Request Case. Leave unselected to use the existing current authorized Super Admin behavior."
              query={reviewerSearchQuery}
              onQueryChange={setReviewerSearchQuery}
              minLength={2}
              searching={reviewerSearching}
              onSearch={performReviewerSearch}
              value={assignedReviewUserId}
              onChange={setAssignedReviewUserId}
              options={reviewerOptions}
              resultLabel="Assigned reviewer"
              searchPlaceholder="Search reviewer name or handle"
              emptyLabel="No matching eligible reviewers"
            />
          ) : null}

          <label className="block text-[10px] font-black text-wk-text-muted">
            {reasonAction?.kind === "close_case" ? "Closure note" : "Reason"}
            <textarea
              className="wk-input mt-1 w-full resize-y"
              rows={4}
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              maxLength={8192}
              autoFocus={reasonAction?.kind !== "start_review"}
            />
          </label>
        </div>
      </WkCommandSheet>

      <WkCommandSheet
        open={deliveryOpen}
        onClose={() => {
          if (!busy) setDeliveryOpen(false);
        }}
        title="Deliver Released Legal Package"
        eyebrow="Controlled package delivery"
        description="Create a short-lived signed target only for this released package after recording delivery purpose."
        primaryLabel="Open Released Package"
        onPrimary={performDelivery}
        primaryDisabled={!deliveryPurpose.trim()}
        busy={busy}
        footerNote="Delivery remains same-context so browser popup policy cannot break the post-authorization handoff."
      >
        <label className="block text-[10px] font-black text-wk-text-muted">
          Delivery purpose
          <textarea
            className="wk-input mt-1 w-full resize-y"
            rows={4}
            value={deliveryPurpose}
            onChange={(event) => setDeliveryPurpose(event.target.value)}
            maxLength={4096}
            autoFocus
            placeholder="Purpose for controlled delivery"
          />
        </label>
      </WkCommandSheet>

      <WkInspector
        open={Boolean(evidence)}
        onClose={() => setEvidence(null)}
        title="Inspected Legal Evidence"
        eyebrow="Purpose-audited evidence"
        summary={
          <div>
            <div className="text-[11px] font-black text-wk-text">
              Exact held object
            </div>
            <div className="mt-1 text-[9px] font-bold text-wk-text-faint">
              {shortId(evidence?.legal_preserved_object_id)}
            </div>
          </div>
        }
        advancedLabel="Reveal inspected private evidence"
        advanced={
          evidence ? (
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-wk-text">
              {JSON.stringify(evidence.evidence, null, 2)}
            </pre>
          ) : null
        }
      >
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed text-wk-text-muted">
            This private payload was returned only after explicit,
            purpose-recorded inspection. It is not rendered in the normal case
            workbench.
          </p>
          <p className="text-[10px] leading-relaxed text-wk-text-faint">
            Close this Inspector when the review need is complete.
          </p>
        </div>
      </WkInspector>

      <WkInspector
        open={
          packageInspectorOpen
          && Boolean(packageDetail)
          && Boolean(packageFromDetail)
        }
        onClose={() => setPackageInspectorOpen(false)}
        title="Disclosure Package Inspector"
        eyebrow="Exact package authority"
        summary={
          packageFromDetail && packageDetail ? (
            <div>
              <div className="text-[11px] font-black text-wk-text">
                {packageFromDetail.production_reference}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <WkStateBadge tone={packageTone(packageFromDetail.status)}>
                  {humanize(packageFromDetail.status)}
                </WkStateBadge>
                <span className="text-[9px] font-bold text-wk-text-faint">
                  {packageDetail.objects.length} exact object
                  {packageDetail.objects.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ) : null
        }
        advancedLabel="Reveal hashes, fingerprints, paths, and manifest"
        advanced={
          packageFromDetail && packageDetail ? (
            <div className="space-y-4">
              <div className="space-y-2 break-all text-[9px] font-bold text-wk-text-muted">
                <div>
                  <span className="font-black text-wk-text">Package identity:</span>{" "}
                  {packageFromDetail.id}
                </div>
                <div>
                  <span className="font-black text-wk-text">
                    Selection fingerprint:
                  </span>{" "}
                  {packageFromDetail.selection_fingerprint}
                </div>
                <div>
                  <span className="font-black text-wk-text">Manifest SHA-256:</span>{" "}
                  {packageFromDetail.manifest_sha256 || "Not generated"}
                </div>
                <div>
                  <span className="font-black text-wk-text">Package SHA-256:</span>{" "}
                  {packageFromDetail.package_sha256 || "Not generated"}
                </div>
                <div>
                  <span className="font-black text-wk-text">Package file object:</span>{" "}
                  {packageFromDetail.package_file_object_id || "Not generated"}
                </div>
              </div>

              <div className="space-y-2">
                {packageDetail.objects.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-wk-border bg-wk-surface p-3"
                  >
                    <div className="text-[10px] font-black text-wk-text">
                      #{item.manifest_order} {humanize(item.object_kind)}
                    </div>
                    <div className="mt-2 space-y-1 break-all text-[8px] font-bold text-wk-text-faint">
                      <div>Preserved object: {item.legal_preserved_object_id}</div>
                      <div>Source object: {item.source_object_id}</div>
                      <div>
                        Source fingerprint: {item.source_fingerprint || "None"}
                      </div>
                      <div>Output path: {item.output_path || "Not generated"}</div>
                      <div>
                        Output type: {item.output_mime_type || "Not generated"}
                      </div>
                      <div>
                        Object SHA-256: {item.object_sha256 || "Not generated"}
                      </div>
                      <div>
                        Object bytes: {item.object_byte_size ?? "Not generated"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {packageDetail.package.manifest_text ? (
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                    Exact generated manifest
                  </div>
                  <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-wk-bg-subtle p-3 text-[8px] leading-relaxed text-wk-text">
                    {packageDetail.package.manifest_text}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-wk-text-muted">
            The workbench keeps machine detail collapsed so human workflow,
            scope, approvals, and next action stay primary.
          </p>
          {packageFromDetail?.documented_omissions.length ? (
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
                Documented omissions
              </div>
              <ul className="mt-2 space-y-1 text-[10px] text-wk-text-muted">
                {packageFromDetail.documented_omissions.map((item, index) => (
                  <li key={`${index}-${item}`}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </WkInspector>
    </section>
  );
}
