import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { Modal } from "@/components/design-system/primitives/Modal";
import {
  WkWorkflowRail,
  type WkWorkflowStep,
} from "@/components/design-system/primitives/WorkflowRail";
import { supabase } from "@/lib/supabase";
import {
  isMusicProvenanceContributionReview,
  isPublicMusicIdentityTrackReview,
  loadMusicProvenanceContributionReviewContext,
  loadPublicMusicIdentityTrackReviewContext,
  loadRegistryReviewItems,
  recordRegistryReviewDecision,
  type MusicProvenanceContributionReviewContext,
  type PublicMusicIdentityTrackReviewContext,
  type RegistryDecisionType,
  type RegistryReviewItemRow,
} from "@/services/adminReviewCommandCenter";

type Lane = "needs_decision" | "approved" | "credit" | "research" | "all";

type ProgrammeDecision = {
  review_item_id: string;
  decision_type: RegistryDecisionType;
  status: string | null;
  created_at: string | null;
  decision_notes: string | null;
  after_payload: Record<string, unknown> | null;
};

type WorkspaceItem = {
  review: RegistryReviewItemRow;
  decision: ProgrammeDecision | null;
};

type PeerTrack = {
  id: string;
  title: string;
  slug: string;
  isrc: string;
  durationMs: number | null;
};

type DecisionForm = {
  decisionType: RegistryDecisionType | "";
  canonicalTrackId: string;
  canonicalSlug: string;
  semanticDistinction: string;
  creditEvidence: string;
  notes: string;
};

type DetailState = {
  loading: boolean;
  error: string;
  context: PublicMusicIdentityTrackReviewContext | null;
  peers: PeerTrack[];
};

type ProvenanceDecisionType =
  | "music_provenance_admit_contribution"
  | "music_provenance_request_new_attestation"
  | "music_provenance_escalate_integrity_conflict"
  | "music_provenance_needs_more_evidence";

type ProvenanceDetailState = {
  loading: boolean;
  error: string;
  context: MusicProvenanceContributionReviewContext | null;
};

type ProvenanceDecisionForm = {
  decisionType: ProvenanceDecisionType | "";
  notes: string;
};

const PROGRAMME_KEY = "public_music_identity_track_actual_zero_v1";

const WORKFLOW_STEPS: WkWorkflowStep[] = [
  { id: "review", label: "Review", description: "See what MIZIZI found.", state: "complete" },
  { id: "decide", label: "Decide", description: "Choose the right outcome.", state: "current" },
  { id: "apply", label: "Apply", description: "Approved work uses its governed write path.", state: "available" },
  { id: "verify", label: "Verify", description: "The issue leaves this list when the result is proven.", state: "upcoming" },
];

const EMPTY_FORM: DecisionForm = {
  decisionType: "",
  canonicalTrackId: "",
  canonicalSlug: "",
  semanticDistinction: "",
  creditEvidence: "",
  notes: "",
};

const EMPTY_DETAIL: DetailState = {
  loading: false,
  error: "",
  context: null,
  peers: [],
};

const EMPTY_PROVENANCE_DETAIL: ProvenanceDetailState = {
  loading: false,
  error: "",
  context: null,
};

const EMPTY_PROVENANCE_FORM: ProvenanceDecisionForm = {
  decisionType: "",
  notes: "",
};

const PROVENANCE_DECISION_TYPES: ProvenanceDecisionType[] = [
  "music_provenance_admit_contribution",
  "music_provenance_request_new_attestation",
  "music_provenance_escalate_integrity_conflict",
  "music_provenance_needs_more_evidence",
];

const LANES: Array<{ key: Lane; label: string }> = [
  { key: "needs_decision", label: "Needs a decision" },
  { key: "approved", label: "Approved" },
  { key: "credit", label: "Credit issues" },
  { key: "research", label: "Needs research" },
  { key: "all", label: "All current work" },
];

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceEvidence(review: RegistryReviewItemRow): Record<string, unknown> {
  return asObject(asObject(review.source_payload).evidence);
}

function ruleId(review: RegistryReviewItemRow): string {
  return textValue(asObject(review.source_payload).ruleId);
}

function currentSlug(review: RegistryReviewItemRow): string {
  return textValue(asObject(review.source_payload).currentValue);
}

function proposedSlug(review: RegistryReviewItemRow): string {
  return textValue(asObject(review.candidate_payload).proposedValue);
}

function artistScope(review: RegistryReviewItemRow): string {
  return textValue(sourceEvidence(review).primaryArtistSlug);
}

function humanizeSlug(value: string): string {
  if (!value) return "Artist needs review";
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function laneFor(item: WorkspaceItem): "needs_decision" | "approved" | "research" {
  const decisionType = item.decision?.decision_type;
  if (!decisionType) return "needs_decision";
  if (decisionType === "public_music_identity_needs_more_research") return "research";
  return "approved";
}

function matchesLane(item: WorkspaceItem, lane: Lane): boolean {
  if (lane === "all") return true;
  if (lane === "credit") {
    return ruleId(item.review) === "track_slug_credit_evidence_gap"
      || item.decision?.decision_type === "public_music_identity_credit_correction_required";
  }
  return laneFor(item) === lane;
}

function defaultNote(decisionType: RegistryDecisionType): string {
  switch (decisionType) {
    case "public_music_identity_safe_slug_repair":
      return "Use the reviewed clean Track slug.";
    case "public_music_identity_true_duplicate":
      return "This is the same recording as the selected Track.";
    case "public_music_identity_distinct_recording":
      return "This is a different recording and needs its own route identity.";
    case "public_music_identity_credit_correction_required":
      return "The Track credits need correction before MIZIZI can finish.";
    case "public_music_identity_retire_unresolvable":
      return "This Track cannot be resolved safely and should be retired.";
    default:
      return "More evidence is needed before changing this Track.";
  }
}

function defaultProvenanceNote(decisionType: ProvenanceDecisionType): string {
  switch (decisionType) {
    case "music_provenance_admit_contribution":
      return "Admit this reviewed contribution through the existing verified provenance authority.";
    case "music_provenance_request_new_attestation":
      return "Require a new reviewed attestation before this contribution can become current.";
    case "music_provenance_escalate_integrity_conflict":
      return "Escalate this provenance integrity conflict without changing canonical contribution data.";
    default:
      return "More provenance evidence is required before any canonical change.";
  }
}

function provenanceRuleLabel(review: RegistryReviewItemRow): string {
  switch (ruleId(review)) {
    case "provenance_admissible_attestation_pending_review":
      return "Ready for human admission";
    case "provenance_attestation_noncurrent_canonical_history":
      return "Fresh attestation required";
    case "provenance_attestation_evidence_binding_drift":
      return "Evidence binding conflict";
    case "provenance_attestation_multiple_canonical_rows":
      return "Canonical history conflict";
    default:
      return "Contribution provenance review";
  }
}

function parsePeers(value: unknown): PeerTrack[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const peer = asObject(entry);
      const id = textValue(peer.id);
      if (!id) return null;
      return {
        id,
        title: textValue(peer.title) || "Reviewed Track",
        slug: textValue(peer.slug),
        isrc: textValue(peer.isrc),
        durationMs: numberValue(peer.durationMs ?? peer.duration_ms),
      };
    })
    .filter((peer): peer is PeerTrack => Boolean(peer));
}

function durationLabel(durationMs: number | null): string {
  if (durationMs === null) return "";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function decisionLabel(value: RegistryDecisionType | null | undefined): string {
  switch (value) {
    case "public_music_identity_safe_slug_repair":
      return "Clean slug approved";
    case "public_music_identity_true_duplicate":
      return "Same recording";
    case "public_music_identity_distinct_recording":
      return "Different recording";
    case "public_music_identity_credit_correction_required":
      return "Credit fix needed";
    case "public_music_identity_retire_unresolvable":
      return "Retire Track";
    case "public_music_identity_needs_more_research":
      return "Needs research";
    default:
      return "Needs a decision";
  }
}

async function loadCurrentProgrammeReviews(): Promise<RegistryReviewItemRow[]> {
  const reviews = new Map<string, RegistryReviewItemRow>();
  let offset = 0;
  let total = 0;

  do {
    const page = await loadRegistryReviewItems({
      status: "open",
      reviewType: "mizizi_data_hygiene",
      entityType: "track",
      offset,
      limit: 100,
    });

    for (const review of page.rows) {
      if (isPublicMusicIdentityTrackReview(review)) {
        reviews.set(review.id, review);
      }
    }

    total = page.total;
    offset += page.rows.length;

    if (page.rows.length === 0) break;
  } while (offset < total);

  return [...reviews.values()];
}

async function loadCurrentProvenanceReviews(): Promise<RegistryReviewItemRow[]> {
  const reviews = new Map<string, RegistryReviewItemRow>();
  let offset = 0;
  let total = 0;

  do {
    const page = await loadRegistryReviewItems({
      status: "open",
      reviewType: "mizizi_data_hygiene",
      entityType: "contribution_attestation",
      offset,
      limit: 100,
    });

    for (const review of page.rows) {
      if (isMusicProvenanceContributionReview(review)) {
        reviews.set(review.id, review);
      }
    }

    total = page.total;
    offset += page.rows.length;

    if (page.rows.length === 0) break;
  } while (offset < total);

  return [...reviews.values()];
}

async function loadWorkspace(): Promise<WorkspaceItem[]> {
  const reviews = await loadCurrentProgrammeReviews();
  const reviewIds = reviews.map((review) => review.id);
  if (!reviewIds.length) return [];

  const { data, error } = await supabase
    .from("registry_canonicalization_decisions")
    .select("review_item_id, decision_type, status, created_at, decision_notes, after_payload")
    .in("review_item_id", reviewIds)
    .eq("status", "recorded")
    .eq("metadata->>programmeKey", PROGRAMME_KEY)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const latest = new Map<string, ProgrammeDecision>();
  for (const row of (data ?? []) as ProgrammeDecision[]) {
    if (!latest.has(row.review_item_id)) latest.set(row.review_item_id, row);
  }

  return reviews.map((review) => ({
    review,
    decision: latest.get(review.id) ?? null,
  }));
}

async function loadDetail(reviewId: string): Promise<Omit<DetailState, "loading" | "error">> {
  const context = await loadPublicMusicIdentityTrackReviewContext(reviewId);
  let peers: PeerTrack[] = [];

  if (context.openRecordingIdentityReviewId) {
    const { data, error } = await supabase
      .from("registry_review_items")
      .select("source_payload")
      .eq("id", context.openRecordingIdentityReviewId)
      .maybeSingle();

    if (!error && data) {
      const evidence = asObject(asObject(data.source_payload).evidence);
      peers = parsePeers(evidence.peers);
    }
  }

  return { context, peers };
}

export default function AdminMiziziWorkspacePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [lane, setLane] = useState<Lane>("needs_decision");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [selected, setSelected] = useState<WorkspaceItem | null>(null);
  const [detail, setDetail] = useState<DetailState>(EMPTY_DETAIL);
  const [form, setForm] = useState<DecisionForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [provenanceReviews, setProvenanceReviews] = useState<RegistryReviewItemRow[]>([]);
  const [selectedProvenance, setSelectedProvenance] = useState<RegistryReviewItemRow | null>(null);
  const [provenanceDetail, setProvenanceDetail] = useState<ProvenanceDetailState>(EMPTY_PROVENANCE_DETAIL);
  const [provenanceForm, setProvenanceForm] = useState<ProvenanceDecisionForm>(EMPTY_PROVENANCE_FORM);
  const [provenanceSubmitting, setProvenanceSubmitting] = useState(false);
  const [provenanceMessage, setProvenanceMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const [workspace, provenance] = await Promise.all([
        loadWorkspace(),
        loadCurrentProvenanceReviews(),
      ]);
      setItems(workspace);
      setProvenanceReviews(provenance);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "MIZIZI could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => ({
    needsDecision: items.filter((item) => laneFor(item) === "needs_decision").length,
    approved: items.filter((item) => laneFor(item) === "approved").length,
    credit: items.filter((item) => ruleId(item.review) === "track_slug_credit_evidence_gap").length,
    research: items.filter((item) => laneFor(item) === "research").length,
  }), [items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesLane(item, lane)) return false;
      if (!query) return true;
      const review = item.review;
      return [
        review.title,
        review.summary,
        currentSlug(review),
        proposedSlug(review),
        artistScope(review),
        item.decision?.decision_type,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [items, lane, search]);

  const openReview = useCallback(async (item: WorkspaceItem) => {
    setSelected(item);
    setMessage("");
    setForm({
      decisionType: item.decision?.decision_type ?? "",
      canonicalTrackId: textValue(item.decision?.after_payload?.canonicalTrackId),
      canonicalSlug: textValue(item.decision?.after_payload?.canonicalSlug),
      semanticDistinction: textValue(item.decision?.after_payload?.semanticDistinction),
      creditEvidence: textValue(item.decision?.after_payload?.creditEvidence),
      notes: item.decision?.decision_notes ?? "",
    });
    setDetail({ ...EMPTY_DETAIL, loading: true });

    try {
      const loaded = await loadDetail(item.review.id);
      setDetail({ loading: false, error: "", context: loaded.context, peers: loaded.peers });
      setForm((current) => ({
        ...current,
        canonicalSlug: current.canonicalSlug || loaded.context.proposedSlug || "",
      }));
    } catch (error) {
      setDetail({
        ...EMPTY_DETAIL,
        error: error instanceof Error ? error.message : "This review could not be loaded.",
      });
    }
  }, []);

  const chooseOutcome = (decisionType: RegistryDecisionType) => {
    setForm((current) => ({
      ...current,
      decisionType,
      notes: defaultNote(decisionType),
      canonicalTrackId:
        decisionType === "public_music_identity_true_duplicate"
          ? current.canonicalTrackId
          : "",
    }));
    setMessage("");
  };

  const submit = async (continueNext: boolean) => {
    if (!selected || !detail.context || !form.decisionType) {
      setMessage("Choose an outcome before recording the decision.");
      return;
    }
    if (form.decisionType === "public_music_identity_true_duplicate" && !form.canonicalTrackId) {
      setMessage("Choose the Track that should remain.");
      return;
    }
    if (
      form.decisionType === "public_music_identity_distinct_recording"
      && (!form.canonicalSlug.trim() || !form.semanticDistinction.trim())
    ) {
      setMessage("Add the clean route slug and the evidence that makes this a different recording.");
      return;
    }
    if (
      form.decisionType === "public_music_identity_credit_correction_required"
      && !form.creditEvidence.trim()
    ) {
      setMessage("Describe the credit fix MIZIZI should make.");
      return;
    }

    const note = form.notes.trim() || defaultNote(form.decisionType);
    setSubmitting(true);
    setMessage("");

    try {
      await recordRegistryReviewDecision({
        item: selected.review,
        decisionType: form.decisionType,
        notes: note,
        expectedTrackStateFingerprint: detail.context.trackStateFingerprint,
        resolutionPayload: {
          reviewedFrom: "admin_mizizi_workspace",
          programmeIssue: 1094,
          proposedSlug: detail.context.proposedSlug || "",
          canonicalSlug: form.canonicalSlug.trim(),
          semanticDistinction: form.semanticDistinction.trim(),
          canonicalTrackId: form.canonicalTrackId.trim(),
          creditEvidence: form.creditEvidence.trim(),
          canonicalEntitiesChanged: false,
          reviewResolved: false,
          redirectMutation: false,
        },
      });

      const fresh = await loadWorkspace();
      setItems(fresh);

      if (continueNext) {
        const next = fresh.find((item) => laneFor(item) === "needs_decision");
        if (next) {
          await openReview(next);
          setMessage("Previous decision recorded.");
        } else {
          setSelected(null);
          setDetail(EMPTY_DETAIL);
          setForm(EMPTY_FORM);
        }
      } else {
        setSelected(null);
        setDetail(EMPTY_DETAIL);
        setForm(EMPTY_FORM);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The decision could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  const openProvenanceReview = useCallback(async (review: RegistryReviewItemRow) => {
    setSelectedProvenance(review);
    setProvenanceMessage("");
    setProvenanceForm(EMPTY_PROVENANCE_FORM);
    setProvenanceDetail({ ...EMPTY_PROVENANCE_DETAIL, loading: true });

    try {
      const context = await loadMusicProvenanceContributionReviewContext(review.id);
      const existing = asObject(context.existingDecision);
      const existingType = textValue(existing.decisionType);
      const decisionType = PROVENANCE_DECISION_TYPES.includes(
        existingType as ProvenanceDecisionType,
      )
        ? existingType as ProvenanceDecisionType
        : "";

      setProvenanceDetail({
        loading: false,
        error: "",
        context,
      });
      setProvenanceForm({
        decisionType,
        notes: textValue(existing.notes),
      });
    } catch (error) {
      setProvenanceDetail({
        ...EMPTY_PROVENANCE_DETAIL,
        error:
          error instanceof Error
            ? error.message
            : "This contribution review could not be loaded.",
      });
    }
  }, []);

  const chooseProvenanceOutcome = (decisionType: ProvenanceDecisionType) => {
    setProvenanceForm((current) => ({
      decisionType,
      notes: current.notes || defaultProvenanceNote(decisionType),
    }));
    setProvenanceMessage("");
  };

  const submitProvenance = async () => {
    const context = provenanceDetail.context;
    if (!selectedProvenance || !context || !provenanceForm.decisionType) {
      setProvenanceMessage("Choose an outcome before recording the decision.");
      return;
    }

    const notes = provenanceForm.notes.trim();
    if (!notes) {
      setProvenanceMessage("Add a short note for the provenance audit trail.");
      return;
    }

    setProvenanceSubmitting(true);
    setProvenanceMessage("");

    try {
      await recordRegistryReviewDecision({
        item: selectedProvenance,
        decisionType: provenanceForm.decisionType,
        notes,
        expectedProvenanceContextFingerprint: context.contextFingerprint,
        provenanceContext: context,
        resolutionPayload: {
          reviewedFrom: "admin_mizizi_workspace",
          programmeIssue: 1121,
          attestationId: context.attestationId,
          subjectType: context.subjectType,
          subjectId: context.subjectId,
          rightsClaimInferred: false,
        },
      });

      setProvenanceReviews(await loadCurrentProvenanceReviews());
      setSelectedProvenance(null);
      setProvenanceDetail(EMPTY_PROVENANCE_DETAIL);
      setProvenanceForm(EMPTY_PROVENANCE_FORM);
    } catch (error) {
      setProvenanceMessage(
        error instanceof Error
          ? error.message
          : "The provenance decision could not be recorded.",
      );
    } finally {
      setProvenanceSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-wk-mizizi-workspace>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Music Registry</div>
          <h1 className="text-[26px] font-black tracking-tight text-wk-text">MIZIZI</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            Work through music identity and contribution provenance issues that need a human decision. Old review history stays out of the way.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate("/admin/review/queue")} className="wk-button wk-button-ghost wk-button-sm">
            <WkIcon name="GitPullRequest" size={14} />
            All Reviews
          </button>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="wk-button wk-button-secondary wk-button-sm">
            <WkIcon name={loading ? "Loader2" : "RefreshCcw"} size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <WkWorkflowRail steps={WORKFLOW_STEPS} ariaLabel="MIZIZI workflow" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Needs a decision" value={counts.needsDecision} help="MIZIZI found the issue. You choose the outcome." />
        <SummaryCard label="Approved" value={counts.approved} help="A human decision is recorded and ready for the apply step." />
        <SummaryCard label="Credit issues" value={counts.credit} help="Track credits need attention before route cleanup can finish." />
        <SummaryCard label="Needs research" value={counts.research} help="These stay open until better evidence arrives." />
      </div>

      <WkSurface className="overflow-hidden p-0">
        <div className="border-b border-wk-border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[15px] font-black text-wk-text">Current work</h2>
              <p className="mt-1 text-[12px] text-wk-text-muted">Only active MIZIZI Track identity reviews are shown here.</p>
            </div>
            <label className="block w-full max-w-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Track, artist, or slug"
                className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {LANES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setLane(item.key)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  lane === item.key
                    ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                    : "border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {pageError ? (
          <div className="p-8 text-center">
            <div className="text-[13px] font-bold text-wk-danger">MIZIZI could not load.</div>
            <p className="mt-1 text-[12px] text-wk-text-muted">{pageError}</p>
          </div>
        ) : loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-wk-surface-raised" />
            ))}
          </div>
        ) : visibleItems.length ? (
          <div className="divide-y divide-wk-border">
            {visibleItems.map((item) => (
              <MiziziRow key={item.review.id} item={item} onOpen={() => void openReview(item)} />
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <WkIcon name="Inbox" size={24} className="mx-auto text-wk-text-faint" />
            <div className="mt-3 text-[13px] font-bold text-wk-text">Nothing in this view</div>
            <p className="mt-1 text-[12px] text-wk-text-muted">Change the filter or search for another Track.</p>
          </div>
        )}
      </WkSurface>

      <ProvenanceReviewSection
        reviews={provenanceReviews}
        onOpen={(review) => void openProvenanceReview(review)}
      />

      {selectedProvenance ? (
        <ProvenanceDecisionModal
          review={selectedProvenance}
          detail={provenanceDetail}
          form={provenanceForm}
          message={provenanceMessage}
          submitting={provenanceSubmitting}
          onClose={() => {
            if (provenanceSubmitting) return;
            setSelectedProvenance(null);
            setProvenanceDetail(EMPTY_PROVENANCE_DETAIL);
            setProvenanceForm(EMPTY_PROVENANCE_FORM);
            setProvenanceMessage("");
          }}
          onChooseOutcome={chooseProvenanceOutcome}
          onFormChange={setProvenanceForm}
          onSubmit={() => void submitProvenance()}
        />
      ) : null}

      {selected ? (
        <DecisionModal
          item={selected}
          detail={detail}
          form={form}
          message={message}
          submitting={submitting}
          onClose={() => {
            if (submitting) return;
            setSelected(null);
            setDetail(EMPTY_DETAIL);
            setForm(EMPTY_FORM);
            setMessage("");
          }}
          onChooseOutcome={chooseOutcome}
          onFormChange={setForm}
          onSubmit={submit}
        />
      ) : null}
    </div>
  );
}

function ProvenanceReviewSection({
  reviews,
  onOpen,
}: {
  reviews: RegistryReviewItemRow[];
  onOpen: (review: RegistryReviewItemRow) => void;
}) {
  return (
    <WkSurface
      className="overflow-hidden p-0"
      data-wk-mizizi-provenance-reviews
    >
      <div className="border-b border-wk-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[15px] font-black text-wk-text">
              Contribution provenance
            </h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-5 text-wk-text-muted">
              MIZIZI can surface contribution evidence problems here. Only a human review can admit a canonical contribution.
            </p>
          </div>
          <span className="self-start rounded-full bg-wk-surface-raised px-2.5 py-1 text-[11px] font-black text-wk-text-muted">
            {new Intl.NumberFormat().format(reviews.length)}
          </span>
        </div>
      </div>

      {reviews.length ? (
        <div className="divide-y divide-wk-border">
          {reviews.map((review) => {
            const source = asObject(review.source_payload);
            return (
              <div
                key={review.id}
                className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-black text-wk-text">
                      {review.title || "Contribution review"}
                    </h3>
                    <span className="rounded-full bg-wk-brand-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-brand">
                      {provenanceRuleLabel(review)}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                    {review.summary || "Review the current contribution evidence before any canonical action."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-wk-text-faint">
                    <span>{textValue(source.subjectType) || "Registry"} contribution</span>
                    <span>{textValue(source.attestationState) || "Unknown attestation state"}</span>
                    <span>{review.priority === "high" ? "High priority" : "Review"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(review)}
                  className="wk-button wk-button-primary wk-button-sm shrink-0"
                >
                  Review
                  <WkIcon name="ArrowRight" size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-10 text-center">
          <WkIcon name="Inbox" size={24} className="mx-auto text-wk-text-faint" />
          <div className="mt-3 text-[13px] font-bold text-wk-text">
            No contribution provenance exceptions
          </div>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            New MIZIZI provenance findings will appear here for human review.
          </p>
        </div>
      )}
    </WkSurface>
  );
}

function ProvenanceDecisionModal({
  review,
  detail,
  form,
  message,
  submitting,
  onClose,
  onChooseOutcome,
  onFormChange,
  onSubmit,
}: {
  review: RegistryReviewItemRow;
  detail: ProvenanceDetailState;
  form: ProvenanceDecisionForm;
  message: string;
  submitting: boolean;
  onClose: () => void;
  onChooseOutcome: (decisionType: ProvenanceDecisionType) => void;
  onFormChange: Dispatch<SetStateAction<ProvenanceDecisionForm>>;
  onSubmit: () => void;
}) {
  const context = detail.context;
  const choice = (value: ProvenanceDecisionType) =>
    form.decisionType === value
      ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
      : "border-wk-border bg-wk-surface text-wk-text hover:bg-wk-surface-raised";

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="wk-button wk-button-ghost wk-button-sm"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !context || !form.decisionType}
        className="wk-button wk-button-primary wk-button-sm"
      >
        {submitting ? "Recording..." : "Record provenance decision"}
      </button>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={review.title || "Contribution provenance review"}
      maxWidth="3xl"
      dismissable={!submitting}
      footer={footer}
    >
      <div className="mb-5">
        <div className="text-[11px] font-black uppercase tracking-wider text-wk-brand">
          Contribution provenance
        </div>
        <p className="mt-1 text-[12px] text-wk-text-muted">
          Review the live attestation and evidence before choosing an outcome.
        </p>
      </div>

      {detail.loading ? (
        <div className="py-16 text-center text-[13px] text-wk-text-muted">
          Loading the latest contribution evidence...
        </div>
      ) : detail.error || !context ? (
        <div className="rounded-xl border border-wk-danger/25 bg-wk-danger-soft p-4 text-[12px] text-wk-danger">
          {detail.error || "This contribution review could not be loaded."}
        </div>
      ) : (
        <>
          <section>
            <div className="grid gap-3 md:grid-cols-2">
              <Fact
                label="Subject"
                value={context.subjectTitle || `${context.subjectType} contribution`}
              />
              <Fact label="Role" value={context.roleKey} />
              <Fact
                label="Credited as"
                value={context.creditedAs || "Not supplied"}
              />
              <Fact
                label="Attestation state"
                value={context.attestationState}
              />
              <Fact
                label="Evidence trust"
                value={context.evidenceTrustClass || "Not classified"}
              />
              <Fact
                label="Canonical history"
                value={`${context.canonicalContributionCount} contribution row${context.canonicalContributionCount === 1 ? "" : "s"}`}
              />
            </div>

            <div className="mt-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">
                What MIZIZI found
              </div>
              <div className="mt-1 text-[13px] font-black text-wk-text">
                {provenanceRuleLabel(review)}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                {review.summary || "This contribution needs a human provenance decision."}
              </p>
            </div>
          </section>

          <section className="mt-6 border-t border-wk-border pt-5">
            <h3 className="text-[13px] font-black text-wk-text">
              Choose the outcome
            </h3>
            <p className="mt-1 text-[12px] text-wk-text-muted">
              Canonical contribution admission is available only when the live evidence is admissible and still current.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {context.canAdmit ? (
                <OutcomeButton
                  activeClass={choice("music_provenance_admit_contribution")}
                  label="Admit contribution"
                  help="Use the existing verified human admission path for this exact attestation."
                  onClick={() =>
                    onChooseOutcome("music_provenance_admit_contribution")
                  }
                />
              ) : null}

              {context.ruleId === "provenance_attestation_noncurrent_canonical_history" ? (
                <OutcomeButton
                  activeClass={choice("music_provenance_request_new_attestation")}
                  label="Require fresh attestation"
                  help="Do not revive old contribution history. Collect a new reviewed attestation."
                  onClick={() =>
                    onChooseOutcome("music_provenance_request_new_attestation")
                  }
                />
              ) : null}

              {[
                "provenance_attestation_evidence_binding_drift",
                "provenance_attestation_multiple_canonical_rows",
              ].includes(context.ruleId) ? (
                <OutcomeButton
                  activeClass={choice("music_provenance_escalate_integrity_conflict")}
                  label="Escalate integrity conflict"
                  help="Keep canonical contribution data unchanged while the inconsistency is repaired."
                  onClick={() =>
                    onChooseOutcome("music_provenance_escalate_integrity_conflict")
                  }
                />
              ) : null}

              <OutcomeButton
                activeClass={choice("music_provenance_needs_more_evidence")}
                label="Need more evidence"
                help="Keep this review open until stronger provenance is available."
                onClick={() =>
                  onChooseOutcome("music_provenance_needs_more_evidence")
                }
              />
            </div>
          </section>

          {context.existingDecision ? (
            <section className="mt-5 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">
                Latest recorded decision
              </div>
              <div className="mt-1 text-[12px] font-semibold text-wk-text">
                {textValue(asObject(context.existingDecision).decisionType) || "Recorded"}
              </div>
              <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">
                {textValue(asObject(context.existingDecision).notes) || "No note recorded."}
              </p>
            </section>
          ) : null}

          {form.decisionType ? (
            <section className="mt-5">
              <TextArea
                label="Decision note"
                value={form.notes}
                placeholder="State the evidence or remediation required."
                onChange={(value) =>
                  onFormChange((current) => ({
                    ...current,
                    notes: value,
                  }))
                }
              />
            </section>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-lg bg-wk-warning-soft px-3 py-2 text-[12px] font-semibold text-wk-warning">
              {message}
            </p>
          ) : null}
        </>
      )}
    </Modal>
  );
}

function SummaryCard({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <WkSurface className="p-4">
      <div className="text-[26px] font-black tracking-tight text-wk-text">{new Intl.NumberFormat().format(value)}</div>
      <div className="mt-1 text-[12px] font-bold text-wk-text">{label}</div>
      <p className="mt-1 text-[11px] leading-5 text-wk-text-muted">{help}</p>
    </WkSurface>
  );
}

function MiziziRow({ item, onOpen }: { item: WorkspaceItem; onOpen: () => void }) {
  const review = item.review;
  const hasCreditIssue = ruleId(review) === "track_slug_credit_evidence_gap";

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-black text-wk-text">{review.title || "Track review"}</h3>
            <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-text-muted">
              {decisionLabel(item.decision?.decision_type)}
            </span>
            {hasCreditIssue ? (
              <span className="rounded-full bg-wk-warning-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-warning">Credits</span>
            ) : null}
          </div>
          <div className="mt-2 text-[12px] text-wk-text-muted">{humanizeSlug(artistScope(review))}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <code className="rounded bg-wk-surface-raised px-2 py-1 text-wk-text-muted">{currentSlug(review) || "No current slug"}</code>
            <WkIcon name="ArrowRight" size={12} className="text-wk-text-faint" />
            <code className="rounded bg-wk-brand-soft px-2 py-1 text-wk-brand">{proposedSlug(review) || "Needs a clean slug"}</code>
          </div>
        </div>
        <button type="button" onClick={onOpen} className="wk-button wk-button-primary wk-button-sm shrink-0">
          Review
          <WkIcon name="ArrowRight" size={13} />
        </button>
      </div>
    </div>
  );
}

function DecisionModal({
  item,
  detail,
  form,
  message,
  submitting,
  onClose,
  onChooseOutcome,
  onFormChange,
  onSubmit,
}: {
  item: WorkspaceItem;
  detail: DetailState;
  form: DecisionForm;
  message: string;
  submitting: boolean;
  onClose: () => void;
  onChooseOutcome: (decisionType: RegistryDecisionType) => void;
  onFormChange: Dispatch<SetStateAction<DecisionForm>>;
  onSubmit: (continueNext: boolean) => void;
}) {
  const review = item.review;
  const context = detail.context;
  const credits = Array.isArray(context?.activeCredits) ? context.activeCredits : [];
  const choice = (value: RegistryDecisionType) =>
    form.decisionType === value
      ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
      : "border-wk-border bg-wk-surface text-wk-text hover:bg-wk-surface-raised";

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <button type="button" onClick={onClose} disabled={submitting} className="wk-button wk-button-ghost wk-button-sm">Cancel</button>
      <button type="button" onClick={() => void onSubmit(false)} disabled={submitting || !detail.context || !form.decisionType} className="wk-button wk-button-secondary wk-button-sm">Record Decision</button>
      <button type="button" onClick={() => void onSubmit(true)} disabled={submitting || !detail.context || !form.decisionType} className="wk-button wk-button-primary wk-button-sm">
        {submitting ? "Recording..." : "Record and Next"}
      </button>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={review.title || "Track review"}
      maxWidth="4xl"
      dismissable={!submitting}
      footer={footer}
    >
      <div className="mb-5">
        <div className="text-[11px] font-black uppercase tracking-wider text-wk-brand">MIZIZI Review</div>
        <p className="mt-1 text-[12px] text-wk-text-muted">{humanizeSlug(artistScope(review))}</p>
      </div>

      {detail.loading ? (
        <div className="py-16 text-center text-[13px] text-wk-text-muted">Loading the latest Track evidence...</div>
      ) : detail.error || !context ? (
        <div className="rounded-xl border border-wk-danger/25 bg-wk-danger-soft p-4 text-[12px] text-wk-danger">
          {detail.error || "This review could not be loaded."}
        </div>
      ) : (
        <>
          <section>
            <h3 className="text-[13px] font-black text-wk-text">What MIZIZI found</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Fact label="Current slug" value={context.currentSlug} />
              <Fact label="Clean slug" value={context.proposedSlug || "Needs review"} />
              <Fact label="ISRC" value={context.isrc || "Not available"} />
              <Fact
                label="Issue"
                value={ruleId(review) === "track_slug_credit_evidence_gap"
                  ? "Track credits do not fully support the route."
                  : "Featured artist names are packaged into the route."}
              />
            </div>

            {credits.length ? (
              <div className="mt-4">
                <div className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">Current credits</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {credits.map((entry, index) => {
                    const credit = asObject(entry);
                    const name =
                      textValue(credit.artistNameText)
                      || textValue(credit.artist_name_text)
                      || humanizeSlug(textValue(credit.artistSlug) || textValue(credit.artist_slug));
                    const role =
                      credit.isPrimary === true || credit.is_primary === true
                        ? "Primary"
                        : credit.isFeatured === true || credit.is_featured === true
                          ? "Featured"
                          : textValue(credit.role) || "Credit";
                    return (
                      <span key={`${name}-${index}`} className="rounded-full border border-wk-border bg-wk-surface-raised px-3 py-1 text-[11px] text-wk-text">
                        <strong>{name || "Unknown artist"}</strong>
                        <span className="ml-1 text-wk-text-muted">{role}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="mt-6 border-t border-wk-border pt-5">
            <h3 className="text-[13px] font-black text-wk-text">Choose the outcome</h3>
            <p className="mt-1 text-[12px] text-wk-text-muted">
              Pick the answer. MIZIZI keeps the evidence and applies the approved fix in the next step.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <OutcomeButton activeClass={choice("public_music_identity_safe_slug_repair")} label="Use clean slug" help="The Track is right. The route needs cleanup." onClick={() => onChooseOutcome("public_music_identity_safe_slug_repair")} />
              <OutcomeButton activeClass={choice("public_music_identity_true_duplicate")} label="Same recording" help="Keep one Track and retire the duplicate." onClick={() => onChooseOutcome("public_music_identity_true_duplicate")} />
              <OutcomeButton activeClass={choice("public_music_identity_distinct_recording")} label="Different recording" help="Keep both because the recordings are genuinely different." onClick={() => onChooseOutcome("public_music_identity_distinct_recording")} />
              <OutcomeButton activeClass={choice("public_music_identity_credit_correction_required")} label="Fix credits" help="The artist roles need correction first." onClick={() => onChooseOutcome("public_music_identity_credit_correction_required")} />
              <OutcomeButton activeClass={choice("public_music_identity_needs_more_research")} label="Need more evidence" help="Leave it open until the identity is clearer." onClick={() => onChooseOutcome("public_music_identity_needs_more_research")} />
              <OutcomeButton activeClass={choice("public_music_identity_retire_unresolvable")} label="Retire Track" help="Use only when the Track cannot be resolved safely." onClick={() => onChooseOutcome("public_music_identity_retire_unresolvable")} />
            </div>
          </section>

          {form.decisionType === "public_music_identity_true_duplicate" ? (
            <section className="mt-5 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
              <div className="text-[12px] font-black text-wk-text">Which Track should remain?</div>
              {detail.peers.length ? (
                <div className="mt-3 grid gap-2">
                  {detail.peers.map((peer) => (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => onFormChange((current) => ({ ...current, canonicalTrackId: peer.id }))}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        form.canonicalTrackId === peer.id
                          ? "border-wk-brand bg-wk-brand-soft"
                          : "border-wk-border bg-wk-surface hover:bg-wk-surface-raised"
                      }`}
                    >
                      <div className="text-[12px] font-black text-wk-text">{peer.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-wk-text-muted">
                        {peer.slug ? <span>{peer.slug}</span> : null}
                        {peer.isrc ? <span>ISRC {peer.isrc}</span> : null}
                        {peer.durationMs !== null ? <span>{durationLabel(peer.durationMs)}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-wk-warning">
                  MIZIZI did not return a reviewed peer. Choose another outcome or refresh this item.
                </p>
              )}
            </section>
          ) : null}

          {form.decisionType === "public_music_identity_distinct_recording" ? (
            <section className="mt-5 grid gap-3 md:grid-cols-2">
              <TextField label="Clean route slug" value={form.canonicalSlug} placeholder="song-live" onChange={(value) => onFormChange((current) => ({ ...current, canonicalSlug: value }))} />
              <TextArea label="What makes this recording different?" value={form.semanticDistinction} placeholder="Live version, remix, acoustic version, or another proven distinction." onChange={(value) => onFormChange((current) => ({ ...current, semanticDistinction: value }))} />
            </section>
          ) : null}

          {form.decisionType === "public_music_identity_credit_correction_required" ? (
            <section className="mt-5">
              <TextArea label="Credit fix" value={form.creditEvidence} placeholder="State who should be primary and who should be featured." onChange={(value) => onFormChange((current) => ({ ...current, creditEvidence: value }))} />
            </section>
          ) : null}

          {form.decisionType ? (
            <section className="mt-5">
              <TextArea label="Note" value={form.notes} placeholder="Add anything useful for the audit trail." onChange={(value) => onFormChange((current) => ({ ...current, notes: value }))} />
            </section>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-lg bg-wk-warning-soft px-3 py-2 text-[12px] font-semibold text-wk-warning">{message}</p>
          ) : null}
        </>
      )}
    </Modal>
  );
}

function OutcomeButton({ activeClass, label, help, onClick }: { activeClass: string; label: string; help: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left transition-colors ${activeClass}`}>
      <div className="text-[12px] font-black">{label}</div>
      <div className="mt-1 text-[11px] leading-4 opacity-80">{help}</div>
    </button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">{label}</div>
      <div className="mt-1 break-words text-[12px] font-semibold text-wk-text">{value}</div>
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" />
    </label>
  );
}

function TextArea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" />
    </label>
  );
}
