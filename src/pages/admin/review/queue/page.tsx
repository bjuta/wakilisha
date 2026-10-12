import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WkIcon, type WkIconName } from "@/components/design-system/Icon";
import { Modal } from "@/components/design-system/primitives/Modal";
import {
  formatReviewCount,
  isPublicMusicIdentityTrackReview,
  loadPublicMusicIdentityTrackReviewContext,
  loadRegistryReviewItems,
  loadReviewCommandCenter,
  recordRegistryReviewDecision,
  requiresGovernedSingleReleaseReview,
  type FieldDictionaryRow,
  type MediaReviewRow,
  type PromotionEventRow,
  type PublicMusicIdentityTrackReviewContext,
  type RegistryDecisionType,
  type RegistryReviewFilters,
  type RegistryReviewItemRow,
  type RegistryReviewSummaryRow,
  type ReviewArtifactSample,
  type ReviewCommandCenterData,
  type ReviewDecisionSample,
  type StagingSummaryRow,
} from "@/services/adminReviewCommandCenter";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkDisclosure } from "@/components/design-system/primitives/Disclosure";
import {
  chartIssueHeading,
  genericChartIssue,
  groupableReviewIssue,
  singleReleaseIdentityIssue,
  groupLoadedReviewRows,
  sourceDisplay,
} from "./reviewDeskPresentation";
import { projectRecordedCaseSubject } from "@/services/miziziRecordedCaseSubject";
import { supabase } from "@/lib/supabase";
import "./review-desk.css";



type LoadState = "loading" | "ready" | "error";
type Panel = "registry" | "decisions" | "artifacts" | "fields" | "media" | "staging" | "events";
type ReadinessTone = "success" | "warning" | "danger" | "neutral" | "brand";

type DecisionState = {
  decisionType: RegistryDecisionType;
  notes: string;
  canonicalPrimaryArtistName: string;
  canonicalPrimaryArtistSlug: string;
  featuredArtistNames: string;
  featuredArtistSlugs: string;
  publicMusicContext: PublicMusicIdentityTrackReviewContext | null;
  publicMusicContextLoading: boolean;
  proposedSlug: string;
  canonicalSlug: string;
  semanticDistinction: string;
  canonicalTrackId: string;
  creditEvidence: string;
  continueToNext: boolean;
  message: string;
  submitting: boolean;
};

type RegistryFilterState = {
  search: string;
  status: string;
  reviewType: string;
  priority: string;
  entityType: string;
};

const PANEL_BUTTONS: Array<{ key: Panel; label: string; icon: WkIconName }> = [
  { key: "registry", label: "Registry Queue", icon: "GitPullRequest" },
  { key: "decisions", label: "Decisions", icon: "GitPullRequest" },
  { key: "artifacts", label: "Artifacts", icon: "Archive" },
  { key: "fields", label: "Fields", icon: "Braces" },
  { key: "media", label: "Media", icon: "Image" },
  { key: "staging", label: "Staging", icon: "Database" },
  { key: "events", label: "Events", icon: "Clock" },
];

const DECISION_OPTIONS: Array<{ value: RegistryDecisionType; label: string; help: string }> = [
  { value: "needs_more_research", label: "Needs more research", help: "Keep unresolved but record why this item cannot be safely resolved yet." },
  { value: "approve_primary_artist", label: "Approve primary artist", help: "Record one verified canonical primary artist name/slug for Phase 3 canonicalization." },
  { value: "approve_featured_artist_split", label: "Approve featured artist split", help: "Record a verified primary artist plus featured/collaborator credits for a later structured split." },
  { value: "reject_bad_metadata", label: "Reject bad metadata", help: "Record that the source credit is wrong or not useful for canonical relationships." },
  { value: "duplicate_or_bad_source", label: "Duplicate or bad source", help: "Record that this item should be ignored or deduplicated later." },
];

const PUBLIC_MUSIC_IDENTITY_DECISION_OPTIONS: Array<{ value: RegistryDecisionType; label: string; help: string }> = [
  { value: "public_music_identity_needs_more_research", label: "Needs more research", help: "Record the evidence gap and keep the review open." },
  { value: "public_music_identity_safe_slug_repair", label: "Approve safe canonical slug repair", help: "Bind the exact reviewed clean slug. Execution still happens later through governed Track authority." },
  { value: "public_music_identity_distinct_recording", label: "Confirm legitimately distinct recording", help: "Require an evidence-backed semantic distinction and canonical slug; no synthetic suffixes." },
  { value: "public_music_identity_true_duplicate", label: "Confirm true duplicate identity", help: "Bind a different active canonical Track UUID. Duplicate execution remains a separate governed step." },
  { value: "public_music_identity_retire_unresolvable", label: "Retire unresolvable canonical shell", help: "Record that the Track cannot safely own public identity and must be retired through governed lifecycle authority." },
  { value: "public_music_identity_credit_correction_required", label: "Structured credit correction required", help: "Record the exact credit evidence that must be corrected before slug execution." },
];

const DEFAULT_REGISTRY_FILTERS: RegistryFilterState = {
  search: "",
  status: "open",
  reviewType: "",
  priority: "",
  entityType: "",
};

const REGISTRY_PAGE_SIZE = 18;
const MULTI_CREDIT_PATTERN = /(,| & | and | feat\.?| ft\.?| featuring | with | x )/i;

function emptyDecisionState(overrides: Partial<DecisionState> = {}): DecisionState {
  return {
    decisionType: "needs_more_research",
    notes: "",
    canonicalPrimaryArtistName: "",
    canonicalPrimaryArtistSlug: "",
    featuredArtistNames: "",
    featuredArtistSlugs: "",
    publicMusicContext: null,
    publicMusicContextLoading: false,
    proposedSlug: "",
    canonicalSlug: "",
    semanticDistinction: "",
    canonicalTrackId: "",
    creditEvidence: "",
    continueToNext: true,
    message: "",
    submitting: false,
    ...overrides,
  };
}

function splitStructuredList(value: string): string[] {
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function isStructuredDecision(decisionType: RegistryDecisionType): boolean {
  return decisionType === "approve_primary_artist" || decisionType === "approve_featured_artist_split";
}

function toRegistryFilters(filters: RegistryFilterState, offset: number): RegistryReviewFilters {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status || undefined,
    reviewType: filters.reviewType || undefined,
    priority: filters.priority || undefined,
    entityType: filters.entityType || undefined,
    limit: REGISTRY_PAGE_SIZE,
    offset,
  };
}

function candidateString(item: RegistryReviewItemRow, key: "artistText" | "artistSlug"): string {
  const candidate = item.candidate_payload ?? {};
  const value = candidate[key];
  return typeof value === "string" ? value.trim() : "";
}

function decisionSeedForItem(item: RegistryReviewItemRow, overrides: Partial<DecisionState> = {}): DecisionState {
  return emptyDecisionState({
    canonicalPrimaryArtistName: candidateString(item, "artistText"),
    canonicalPrimaryArtistSlug: candidateString(item, "artistSlug"),
    ...overrides,
  });
}

function reviewReadiness(item: RegistryReviewItemRow): { label: string; tone: ReadinessTone; description: string } {
  const artistText = candidateString(item, "artistText");
  const artistSlug = candidateString(item, "artistSlug");
  const status = item.status || "open";
  const reviewType = item.review_type || "";

  if (status === "resolved") return { label: "Resolved", tone: "success", description: "Decision already recorded." };
  if (reviewType.includes("missing_metadata")) return { label: "Needs research", tone: "warning", description: "Source metadata is missing artist credit details." };
  if (reviewType.includes("unmatched")) return { label: "Needs match", tone: "warning", description: "Source credit exists but does not map cleanly to a registry artist." };
  if (artistText && MULTI_CREDIT_PATTERN.test(artistText)) return { label: "Split required", tone: "danger", description: "Multiple credits need primary/featured split before Phase 3 writes." };
  if (artistSlug || artistText) return { label: "Potentially actionable", tone: "brand", description: "Single candidate may become actionable after structured approval." };
  return { label: "Review needed", tone: "neutral", description: "Needs manual review before canonicalization." };
}

export default function AdminReviewQueuePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const linkedReviewId = new URLSearchParams(location.search).get("review");
  const [linkedReviewError, setLinkedReviewError] = useState("");
  const linkedRecordId = new URLSearchParams(location.search).get("record");
  const [selectedRecord, setSelectedRecord] = useState<RegistryReviewItemRow | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<ReviewCommandCenterData | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>("registry");
  const [selectedItem, setSelectedItem] = useState<RegistryReviewItemRow | null>(null);
  const [decision, setDecision] = useState<DecisionState>(emptyDecisionState());

  const reload = () => {
    setState("loading");
    loadReviewCommandCenter()
      .then((result) => { setData(result); setState("ready"); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Could not load review command center."); setState("error"); });
  };

  useEffect(() => {
    let alive = true;
    setState("loading");
    loadReviewCommandCenter()
      .then((result) => { if (alive) { setData(result); setState("ready"); } })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : "Could not load review command center."); setState("error"); } });
    return () => { alive = false; };
  }, []);

  const openItem = useCallback((item: RegistryReviewItemRow) => {
    if (requiresGovernedSingleReleaseReview(item)) {
      setSelectedItem(null);
      setSelectedRecord(item);
      return;
    }
    setSelectedItem(item);

    if (!isPublicMusicIdentityTrackReview(item)) {
      setDecision(decisionSeedForItem(item));
      return;
    }

    setDecision(
      decisionSeedForItem(item, {
        decisionType: "public_music_identity_needs_more_research",
        publicMusicContextLoading: true,
      }),
    );

    loadPublicMusicIdentityTrackReviewContext(item.id)
      .then((context) => {
        setDecision((current) => ({
          ...current,
          publicMusicContext: context,
          publicMusicContextLoading: false,
          proposedSlug: context.proposedSlug || "",
          canonicalSlug: context.proposedSlug || "",
          message: "",
        }));
      })
      .catch((err) => {
        setDecision((current) => ({
          ...current,
          publicMusicContextLoading: false,
          message:
            err instanceof Error
              ? err.message
              : "Could not load current Track review context.",
        }));
      });
  }, []);

  useEffect(() => {
    if (linkedReviewId === null) { setLinkedReviewError(""); return; }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkedReviewId)) {
      setLinkedReviewError("That review reference is invalid.");
      return;
    }
    let active = true;
    void loadRegistryReviewItems({ reviewId: linkedReviewId, limit: 1 }).then(({ rows }) => {
      if (!active) return;
      const item = rows[0];
      if (rows.length !== 1 || !item || item.id.toLowerCase() !== linkedReviewId.toLowerCase()) {
        setLinkedReviewError("That review is no longer available.");
        return;
      }
      if (item.status !== "open") {
        setLinkedReviewError("This review is not open for a new decision.");
        return;
      }
      setLinkedReviewError("");
      setPanel("registry");
      openItem(item);
    }).catch(() => { if (active) setLinkedReviewError("That review could not be opened."); });
    return () => { active = false; };
  }, [linkedReviewId, openItem]);

  // Historical records have a separate read-only deep-link. A resolved review
  // must never enter the decision-only ?review= route, which correctly fails closed.
  useEffect(() => {
    if (linkedRecordId === null) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkedRecordId)) {
      setLinkedReviewError("That review reference is invalid.");
      return;
    }
    let active = true;
    void loadRegistryReviewItems({ reviewId: linkedRecordId, limit: 1 }).then(({ rows }) => {
      if (!active) return;
      const row = rows[0];
      if (!row || rows.length !== 1 || row.id.toLowerCase() !== linkedRecordId.toLowerCase()) {
        setLinkedReviewError("That record is no longer available.");
        return;
      }
      setLinkedReviewError("");
      setSelectedRecord(row);
    }).catch(() => { if (active) setLinkedReviewError("That record could not be opened."); });
    return () => { active = false; };
  }, [linkedRecordId]);

  const closeItem = () => {
    if (decision.submitting) return;
    setSelectedItem(null);
    setDecision(emptyDecisionState());
  };

  const submitDecision = async () => {
    if (!selectedItem) return;
    if (requiresGovernedSingleReleaseReview(selectedItem)) {
      setDecision(current => ({
        ...current,
        message: "This Release conflict must use governed MIZIZI resolution, not the generic review writer.",
      }));
      return;
    }
    const notes = decision.notes.trim();
    const primaryName = decision.canonicalPrimaryArtistName.trim();
    const primarySlug = decision.canonicalPrimaryArtistSlug.trim();
    const featuredNames = splitStructuredList(decision.featuredArtistNames);
    const featuredSlugs = splitStructuredList(decision.featuredArtistSlugs);

    if (!notes) {
      setDecision((current) => ({ ...current, message: "Add a short note before recording the decision." }));
      return;
    }
    if (isStructuredDecision(decision.decisionType) && !primaryName && !primarySlug) {
      setDecision((current) => ({ ...current, message: "Add a canonical primary artist name or slug before approving this item." }));
      return;
    }
    if (decision.decisionType === "approve_featured_artist_split" && !featuredNames.length && !featuredSlugs.length) {
      setDecision((current) => ({ ...current, message: "Add at least one featured/collaborator name or slug for a featured split." }));
      return;
    }

    const publicMusicReview =
      isPublicMusicIdentityTrackReview(selectedItem);

    if (publicMusicReview) {
      if (
        decision.publicMusicContextLoading ||
        !decision.publicMusicContext
      ) {
        setDecision((current) => ({
          ...current,
          message:
            "Load the current Track review context before recording a decision.",
        }));
        return;
      }

      if (
        decision.decisionType ===
          "public_music_identity_safe_slug_repair" &&
        !decision.proposedSlug.trim()
      ) {
        setDecision((current) => ({
          ...current,
          message:
            "The exact reviewed proposed slug is required.",
        }));
        return;
      }

      if (
        decision.decisionType ===
          "public_music_identity_distinct_recording" &&
        (
          !decision.semanticDistinction.trim() ||
          !decision.canonicalSlug.trim()
        )
      ) {
        setDecision((current) => ({
          ...current,
          message:
            "A semantic distinction and canonical slug are required for a distinct recording.",
        }));
        return;
      }

      if (
        decision.decisionType ===
          "public_music_identity_true_duplicate" &&
        !decision.canonicalTrackId.trim()
      ) {
        setDecision((current) => ({
          ...current,
          message:
            "A different active canonical Track UUID is required for a duplicate decision.",
        }));
        return;
      }

      if (
        decision.decisionType ===
          "public_music_identity_credit_correction_required" &&
        !decision.creditEvidence.trim()
      ) {
        setDecision((current) => ({
          ...current,
          message:
            "Describe the exact structured credit evidence that requires correction.",
        }));
        return;
      }
    }

    const shouldContinue = decision.continueToNext;
    setDecision((current) => ({ ...current, submitting: true, message: "" }));
    try {
      await recordRegistryReviewDecision({
        item: selectedItem,
        decisionType: decision.decisionType,
        notes,
        expectedTrackStateFingerprint:
          decision.publicMusicContext?.trackStateFingerprint,
        resolutionPayload: publicMusicReview
          ? {
              reviewedFrom:
                "admin_review_command_center",
              programmeIssue: 1094,
              proposedSlug:
                decision.proposedSlug.trim(),
              canonicalSlug:
                decision.canonicalSlug.trim(),
              semanticDistinction:
                decision.semanticDistinction.trim(),
              canonicalTrackId:
                decision.canonicalTrackId.trim(),
              creditEvidence:
                decision.creditEvidence.trim(),
              canonicalEntitiesChanged: false,
              reviewResolved: false,
              redirectMutation: false,
            }
          : {
              reviewedFrom: "admin_review_command_center",
              phase: "phase2b_structured_resolution",
              canonicalPrimaryArtistName: primaryName,
              canonicalPrimaryArtistSlug: primarySlug,
              primaryArtistName: primaryName,
              primaryArtistSlug: primarySlug,
              artistText: primaryName,
              artistSlug: primarySlug,
              featuredArtistNames: featuredNames,
              featuredArtistSlugs: featuredSlugs,
              canonicalEntitiesChanged: false,
              publicApiChanged: false,
              publicRenderingChanged: false,
            },
      });

      const visibleRows = data?.registryReviewItems ?? [];
      const currentIndex = visibleRows.findIndex((row) => row.id === selectedItem.id);
      const nextItem = shouldContinue ? visibleRows.slice(currentIndex + 1).find((row) => row.status !== "resolved") ?? null : null;

      setSelectedItem(nextItem);
      setDecision(nextItem ? decisionSeedForItem(nextItem, { message: "Previous decision recorded." }) : emptyDecisionState({ message: "Decision recorded." }));
      reload();
    } catch (err) {
      setDecision((current) => ({ ...current, submitting: false, message: err instanceof Error ? err.message : "Could not record decision." }));
    }
  };

  if (state === "loading") return <LoadingState />;
  if (state === "error" || !data) return <ErrorState error={error} />;

  return (
    <main data-wk-review-desk className="wk-review-desk">
      {linkedReviewError ? (
        <p role="alert" className="rounded-xl border border-wk-warning bg-wk-warning-soft p-4 text-[13px] text-wk-text">
          {linkedReviewError}
        </p>
      ) : null}

      <header className="wk-review-desk-header">
        <div>
          <p className="wk-review-desk-eyebrow">WAKILISHA Registry</p>
          <h1>All Reviews</h1>
          <p className="wk-review-desk-intro">
            Inspect the record, check the evidence, and make a governed decision.
          </p>
        </div>
        <div className="wk-review-desk-actions">
          <button type="button" className="wk-button wk-button-soft wk-button-sm"
            onClick={() => navigate("/admin/review/mizizi")}>
            <WkIcon name="GitBranch" size={16} /> Explore MIZIZI
          </button>
          <button type="button" className="wk-button wk-button-ghost wk-button-sm"
            onClick={() => navigate("/admin/charts/review-queue")}>
            <WkIcon name="BarChart3" size={16} /> Chart Reviews
          </button>
        </div>
      </header>

      <section className="wk-review-desk-overview" aria-label="Current Registry review load">
        <div className="wk-review-desk-metric wk-review-desk-metric-primary">
          <span>Open Registry Reviews</span>
          <strong>{formatReviewCount(data.totals.registryReviewItems)}</strong>
          <p>Records still awaiting resolution.</p>
        </div>
        <div className="wk-review-desk-metric">
          <span>High Priority</span>
          <strong>{formatReviewCount(data.totals.highPriorityRegistryReviewItems)}</strong>
          <p>Open reviews marked high priority by the Registry.</p>
        </div>
        <div className="wk-review-desk-metric wk-review-desk-metric-note">
          <WkIcon name="ShieldCheck" size={21} aria-hidden="true" />
          <p><strong>Human decisions remain governed.</strong> Recording a decision does not directly change a canonical Track or Artist.</p>
        </div>
      </section>

      <section id="review-desk-results" className="wk-review-desk-workspace"
        aria-label="Review work">
        <div className="wk-review-desk-workspace-head">
          <div>
            <p className="wk-review-desk-eyebrow">{panel === "registry" ? "Current work" : "Historical sources"}</p>
            <h2>{panel === "registry" ? "Registry Review Queue" : PANEL_BUTTONS.find(item => item.key === panel)?.label}</h2>
            <p>{panel === "registry"
              ? "Find an open review, examine its recorded context, then decide through the authorised workflow."
              : "Historical records are available for inspection. This view does not create new write authority."}</p>
          </div>
          {panel !== "registry" ? (
            <button type="button" className="wk-button wk-button-soft wk-button-sm"
              onClick={() => setPanel("registry")}>
              <WkIcon name="ArrowLeft" size={14} /> Back to Reviews
            </button>
          ) : null}
        </div>
        <PanelContent panel={panel} data={data} onOpenRegistryItem={openItem}
          onReadRegistryItem={setSelectedRecord} />
      </section>

      <WkDisclosure summary={(expanded) => (
        <span className="wk-review-desk-archive-label">
          <WkIcon name="Archive" size={18} />
          <span><strong>Other Review Sources</strong>
            <small>Historical imports, decision samples, fields, media, and staging records.</small>
          </span>
          <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={17} />
        </span>
      )} className="wk-review-desk-archive"
        triggerClassName="wk-review-desk-archive-trigger"
        contentClassName="wk-review-desk-archive-body">
        <div className="wk-review-desk-source-nav" role="group" aria-label="Source views">
          {PANEL_BUTTONS.filter(item => item.key !== "registry").map(item => (
            <button key={item.key} type="button" aria-pressed={panel === item.key}
              className="wk-review-desk-source-choice"
              onClick={() => { setPanel(item.key); document.getElementById("review-desk-results")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <WkIcon name={item.icon} size={16} />
              {item.label}
              <WkIcon name="ArrowUpRight" size={13} />
            </button>
          ))}
        </div>
        <div className="wk-review-desk-legacy">
          <h3>Import and Migration Workstreams</h3>
          <p>Legacy process references. An unavailable staging count is not evidence that the work is complete.</p>
          <div className="wk-review-desk-legacy-items">
            {data.workstreams.filter(stream => stream.key !== "phase2b_registry_review").map(stream => (
              <div key={stream.key} className="wk-review-desk-legacy-item">
                <div>
                  <strong>{stream.label}</strong>
                  <p>{stream.description}</p>
                </div>
                {stream.path ? (
                  <button type="button" className="wk-button wk-button-ghost wk-button-sm"
                    onClick={() => navigate(stream.path!)}>
                    Open <WkIcon name="ArrowRight" size={13} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </WkDisclosure>

      {selectedItem ? <RegistryDecisionModal item={selectedItem}
        decision={decision} setDecision={setDecision}
        onClose={closeItem} onSubmit={submitDecision} /> : null}
      {selectedRecord ? <RegistryReadOnlyModal item={selectedRecord}
        onClose={() => {
          setSelectedRecord(null);
          if (linkedRecordId !== null) navigate("/admin/review/queue", { replace: true });
        }} /> : null}
    </main>
  );
}

function LoadingState() {
  return <div className="space-y-4"><div className="h-9 w-80 animate-pulse rounded bg-wk-surface-raised" /><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />)}</div><div className="h-96 animate-pulse rounded-xl border border-wk-border bg-wk-surface" /></div>;
}

function ErrorState({ error }: { error: string }) {
  return <div className="py-20 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger"><WkIcon name="AlertCircle" size={28} /></div><h2 className="text-[18px] font-bold text-wk-text">Could not load review command center</h2><p className="mx-auto mt-2 max-w-xl text-[13px] text-wk-text-muted">{error || "Some review tables may not exist in this environment yet."}</p></div>;
}

function PanelContent({ panel, data, onOpenRegistryItem, onReadRegistryItem }: { panel: Panel; data: ReviewCommandCenterData; onOpenRegistryItem: (item: RegistryReviewItemRow) => void; onReadRegistryItem: (item: RegistryReviewItemRow) => void }) {
  if (panel === "registry") return <RegistryReviewPanel initialRows={data.registryReviewItems} summary={data.registryReviewSummary} openTotal={data.totals.registryReviewItems} onOpen={onOpenRegistryItem} onRead={onReadRegistryItem} />;
  if (panel === "decisions") return <DecisionRows rows={data.decisionSamples} />;
  if (panel === "artifacts") return <ArtifactRows rows={data.artifactSamples} />;
  if (panel === "fields") return <FieldRows rows={data.fieldDictionary} />;
  if (panel === "media") return <MediaRows rows={data.mediaRows} />;
  if (panel === "staging") return <StagingRows rows={data.stagingSummary} />;
  return <EventRows rows={data.promotionEvents} />;
}


function reviewTypeLabel(value: string): string {
  if (value === "mizizi_data_hygiene") return "Music Identity and Credits";
  if (value === "chart_entry_missing_canonical_link") return "Chart Links";
  if (value.includes("chart") && value.includes("label")) return "Chart Labels";
  if (value === "public_music_identity") return "Public Music Identity";
  return value ? humanize(value) : "Unclassified Review";
}

/** A single bounded, read-only title lookup for the loaded exact source IDs.
 * The source title is display context, not proof that a proposed slug was accepted.
 */
function useLoadedCanonicalTitles(rows: readonly RegistryReviewItemRow[]): Readonly<Record<string, string>> {
  const [snapshot, setSnapshot] = useState<Readonly<Record<string, string>>>({});
  useEffect(() => {
    let active = true;
    setSnapshot({});
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const eligible = rows.filter(row => row.source_id && uuidPattern.test(row.source_id) &&
      ((row.entity_type === "release" && row.source_table === "registry_releases") ||
       (row.entity_type === "track" && row.source_table === "registry_tracks"))).slice(0, 300);
    const readTitles = async () => {
      const next: Record<string, string> = {};
      for (const kind of ["release", "track"] as const) {
        const group = eligible.filter(row => row.entity_type === kind);
        if (!group.length) continue;
        const table = kind === "release" ? "registry_releases" : "registry_tracks";
        const sourceIds = [...new Set(group.map(row => row.source_id as string))];
        // Keep each source read bounded even if the review pagination grows.
        for (let offset = 0; offset < sourceIds.length; offset += 100) {
          const requested = sourceIds.slice(offset, offset + 100);
          const { data, error } = await supabase.from(table)
            .select("id,title").in("id", requested);
          if (!active) return;
          if (error || !data) continue;
          const allowed = new Set(requested);
          const verified = new Map<string, string>();
          for (const record of data) {
            if (!record || !allowed.has(record.id) || verified.has(record.id) ||
                typeof record.title !== "string" || !record.title.trim()) continue;
            verified.set(record.id, record.title.trim());
          }
          for (const row of group) {
            const title = verified.get(row.source_id as string);
            if (title) next[row.id] = title;
          }
        }
      }
      if (active) setSnapshot(next);
    };
    void readTitles().catch(() => { if (active) setSnapshot({}); });
    return () => { active = false; };
  }, [rows]);
  return snapshot;
}

function RegistryReviewPanel({ initialRows, summary, openTotal, onOpen, onRead }: {
  initialRows: RegistryReviewItemRow[];
  summary: RegistryReviewSummaryRow[];
  openTotal: number;
  onOpen: (item: RegistryReviewItemRow) => void;
  onRead: (item: RegistryReviewItemRow) => void;
}) {
  const [filters, setFilters] = useState<RegistryFilterState>(DEFAULT_REGISTRY_FILTERS);
  const [rows, setRows] = useState<RegistryReviewItemRow[]>(initialRows.filter(row => row.status === "open"));
  const canonicalTitles = useLoadedCanonicalTitles(rows);
  const [total, setTotal] = useState(
    openTotal
  );
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [visibleIssueItems, setVisibleIssueItems] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const requestVersion = useRef(0);

  const loadPage = async (nextFilters: RegistryFilterState, nextOffset: number, mode: "replace" | "append") => {
    const version = ++requestVersion.current;
    setLoading(true);
    setMessage("");
    try {
      const page = await loadRegistryReviewItems(toRegistryFilters(nextFilters, nextOffset));
      if (version !== requestVersion.current) return;
      setRows(current => mode === "append"
        ? [...current, ...page.rows.filter(item => !current.some(other => other.id === item.id))]
        : page.rows);
      setTotal(page.total);
      setOffset(page.offset);
      if (mode === "replace") {
        setExpandedId(null);
        setExpandedIssue(null);
        setVisibleIssueItems({});
      }
    } catch (err) {
      if (version === requestVersion.current)
        setMessage(err instanceof Error ? err.message : "Could not load reviews.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (filters.search || filters.status !== "open" || filters.priority ||
        filters.reviewType || filters.entityType) {
      void loadPage(filters, 0, "replace");
    } else {
      requestVersion.current += 1;
      setLoading(false);
      setRows(initialRows.filter(row => row.status === "open"));
      setTotal(openTotal);
      setOffset(0);
      setExpandedId(null);
      setExpandedIssue(null);
      setVisibleIssueItems({});
    }
    // The authoritative snapshot changes after an actual governed decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRows, summary, openTotal]);

  const updateFilter = (key: keyof RegistryFilterState, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    void loadPage(next, 0, "replace");
  };
  const resetFilters = () => {
    setFilters(DEFAULT_REGISTRY_FILTERS);
    void loadPage(DEFAULT_REGISTRY_FILTERS, 0, "replace");
  };
  const loadMore = () => {
    if (rows.length >= total || loading) return;
    void loadPage(filters, offset + REGISTRY_PAGE_SIZE, "append");
  };

  const types = [...summary.filter(item => item.status === filters.status || !filters.status)
    .reduce((map, item) => {
      map.set(item.review_type, (map.get(item.review_type) ?? 0) + item.count);
      return map;
    }, new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const activeTypeCount = types.find(([key]) => key === filters.reviewType)?.[1] ?? 0;
  const displayGroups = groupLoadedReviewRows(rows);

  return (
    <div className="wk-review-queue" data-wk-registry-review-panel>
      <div className="wk-review-queue-controls">
        <div className="wk-review-status-switch" role="group" aria-label="Review state">
          {[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "", label: "All States" },
          ].map(option => (
            <button key={option.label} type="button"
              aria-pressed={filters.status === option.value}
              onClick={() => updateFilter("status", option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        <div className="wk-review-search">
          <WkSearchField ariaLabel="Search Registry reviews"
            placeholder="Search reviews, artists, recordings, or references"
            value={filters.search} onChange={value => updateFilter("search", value)} />
        </div>
        <div className="wk-review-queue-selectors">
          <FilterSelect label="Priority" value={filters.priority}
            onChange={value => updateFilter("priority", value)} options={["high", "normal"]} />
          <FilterSelect label="Entity" value={filters.entityType}
            onChange={value => updateFilter("entityType", value)}
            options={["track", "release", "contribution_attestation"]} />
        </div>
        <div className="wk-review-types" role="group" aria-label="Review workstream">
          <button type="button" aria-pressed={!filters.reviewType}
            onClick={() => updateFilter("reviewType", "")}>All Workstreams</button>
          {types.map(([type, count]) => (
            <button key={type} type="button" aria-pressed={filters.reviewType === type}
              onClick={() => updateFilter("reviewType", type)}>
              {reviewTypeLabel(type)} <span>{formatReviewCount(count)}</span>
            </button>
          ))}
        </div>
        <div className="wk-review-queue-results">
          <span role="status">
            {loading ? "Loading reviews…" :
              (filters.reviewType && activeTypeCount === 0 ? "No work in this category. " : "") +
              formatReviewCount(rows.length) + " of " + formatReviewCount(total) + " matching records"}
          </span>
          <button type="button" className="wk-button wk-button-ghost wk-button-sm"
            disabled={loading} onClick={resetFilters}>Reset Filters</button>
        </div>
        {message ? <p role="alert" className="text-[12px] text-wk-warning">{message}</p> : null}
      </div>
      <div className="wk-review-queue-list">
        {rows.length ? displayGroups.map(group => group.grouped ? (
          <section key={group.key} className="wk-review-issue-group"
            aria-label={chartIssueHeading(group.items[0])}
            data-wk-review-issue-group={group.key}>
            <button type="button" className="wk-review-issue-trigger"
              aria-expanded={expandedIssue === group.key}
              onClick={() => {
                setExpandedIssue(current => current === group.key ? null : group.key);
                setExpandedId(null);
              }}>
              <span className="wk-review-issue-icon" aria-hidden="true">
                <WkIcon name="Layers3" size={20} />
              </span>
              <span className="wk-review-issue-copy">
                <strong>{chartIssueHeading(group.items[0])}</strong>
                <span>{group.items[0].summary || "The source rows share one recorded issue type."}</span>
                <small>{formatReviewCount(group.items.length)} distinct source records loaded · {humanize(group.items[0].status || "Unknown")} · Individual review required</small>
              </span>
              <span className="wk-review-issue-count" aria-hidden="true">{group.items.length}</span>
              <WkIcon name={expandedIssue === group.key ? "ChevronUp" : "ChevronDown"}
                size={19} aria-hidden="true" />
            </button>
            {expandedIssue === group.key ? (
              <div className="wk-review-issue-contents">
                <p className="wk-review-issue-explanation">
                  Each item below is a separate Registry review. This grouping changes only
                  how records are displayed, never their decisions or source identities.
                </p>
                {group.items.slice(0, visibleIssueItems[group.key] ?? 6).map(row => (
                  <RegistryReviewRow key={row.id} row={row} compact
                    canonicalTitle={canonicalTitles[row.id]}
                    expanded={expandedId === row.id}
                    onToggle={() => setExpandedId(current => current === row.id ? null : row.id)}
                    onOpen={() => onOpen(row)}
                    onRead={() => onRead(row)} />
                ))}
                {group.items.length > (visibleIssueItems[group.key] ?? 6) ? (
                  <button type="button" className="wk-button wk-button-soft wk-button-sm wk-review-issue-more"
                    onClick={() => setVisibleIssueItems(current => ({
                      ...current,
                      [group.key]: Math.min(group.items.length, (current[group.key] ?? 6) + 6),
                    }))}>
                    Show more individual records ({Math.min(group.items.length, visibleIssueItems[group.key] ?? 6)} of {group.items.length})
                    <WkIcon name="ChevronDown" size={14} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : group.items.map(row => (
          <RegistryReviewRow key={row.id} row={row}
            canonicalTitle={canonicalTitles[row.id]}
            expanded={expandedId === row.id}
            onToggle={() => setExpandedId(current => current === row.id ? null : row.id)}
            onOpen={() => onOpen(row)}
            onRead={() => onRead(row)} />
        ))) : !loading ? (
          <div className="wk-review-queue-empty" role="status">
            <WkIcon name="Inbox" size={26} aria-hidden="true" />
            <h3>No matching reviews</h3>
            <p>Try a different search or change the state and workstream filters.</p>
            <button type="button" className="wk-button wk-button-ghost wk-button-sm"
              onClick={resetFilters}>Clear Filters</button>
          </div>
        ) : null}
      </div>
      {rows.length < total ? (
        <div className="wk-review-queue-pagination">
          <span>{formatReviewCount(rows.length)} of {formatReviewCount(total)} loaded</span>
          <button type="button" className="wk-button wk-button-soft wk-button-sm"
            disabled={loading} onClick={loadMore}>
            {loading ? "Loading…" : "Load More Reviews"} <WkIcon name="ChevronDown" size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return <label className="wk-review-queue-filter">
    <span>{label}</span>
    <WkSelect value={value} onChange={onChange}
      triggerClassName="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text">
      <option value="">All</option>
      {options.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
    </WkSelect>
  </label>;
}

function RegistryReviewRow({ row, canonicalTitle, expanded, onToggle, onOpen, onRead, compact = false }: {
  canonicalTitle?: string;
  row: RegistryReviewItemRow;
  compact?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onRead: () => void;
}) {
  const artistText = candidateString(row, "artistText");
  const artistSlug = candidateString(row, "artistSlug");
  const open = row.status === "open";
  const needsReleaseGovernance = requiresGovernedSingleReleaseReview(row);
  const recorded = row.review_type === "mizizi_data_hygiene"
    ? projectRecordedCaseSubject(row.source_payload, row.title ?? "")
    : null;
  const reviewedTitle = canonicalTitle ||
    (singleReleaseIdentityIssue(row) || genericChartIssue(row)
      ? sourceDisplay(row)
      : recorded?.specific ? recorded.title
        : row.title?.trim() || row.review_key || row.id);
  const recordedSource = [row.source_table, row.source_id || row.entity_id].filter(Boolean).join(" / ");
  return <article className={"wk-review-record" + (compact ? " is-issue-child" : "")}
    data-wk-review-record={row.id}>
    <button type="button" className="wk-review-record-main"
      aria-expanded={expanded} aria-controls={"review-preview-" + row.id}
      onClick={onToggle}>
      <span className="wk-review-record-marker" aria-hidden="true">
        <WkIcon name={open ? "FileText" : "ClipboardCheck"} size={18} />
      </span>
      <span className="wk-review-record-description">
        <strong className="wk-review-record-title">{reviewedTitle}</strong>
        <span className="wk-review-record-context">
          {row.entity_type ? humanize(row.entity_type) : reviewTypeLabel(row.review_type || "")}
          {singleReleaseIdentityIssue(row) && canonicalTitle &&
           typeof row.source_payload?.currentValue === "string" && row.source_payload.currentValue.trim()
            ? " · Current slug: " + row.source_payload.currentValue.trim() : ""}
        </span>
        {recorded?.artistReference ? (
          <span className="wk-review-record-context">Recorded artist reference: {recorded.artistReference}</span>
        ) : null}
        {!compact && row.summary
          ? <span className="wk-review-record-summary">{row.summary}</span> : null}
      </span>
      <span className="wk-review-record-meta">
        {row.priority === "high" ? <span className="wk-review-record-priority">High Priority</span> : null}
        <span className={"wk-review-record-state " + (open ? "is-open" : "is-other")}>
          {humanize(row.status || "Unknown")}
        </span>
        {row.updated_at ? <time dateTime={row.updated_at} className="wk-review-record-date">
          {new Date(row.updated_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
        </time> : null}
      </span>
      <span className="wk-review-record-expand" aria-hidden="true">
        <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={18}/>
      </span>
    </button>
    <div id={"review-preview-" + row.id} hidden={!expanded}
      className="wk-review-record-detail">
      <div className="wk-review-record-evidence">
        <div>
          <h4>Recorded Issue</h4>
          <p>{row.summary || "This review needs an inspection of its source record."}</p>
        </div>
        <dl className="wk-review-record-facts">
          {artistText ? <div><dt>Source Artist</dt><dd>{artistText}</dd></div> : null}
          {artistSlug ? <div><dt>Recorded Artist Slug</dt><dd>{artistSlug}</dd></div> : null}
          <div><dt>Review Status</dt><dd>{humanize(row.status || "Unknown")}</dd></div>
          <div><dt>Review Reference</dt><dd className="break-all font-mono">{row.id}</dd></div>
          {recordedSource ? <div><dt>Source Reference</dt><dd className="break-all">{recordedSource}</dd></div> : null}
          {singleReleaseIdentityIssue(row) ? (
            <>
              {typeof row.source_payload?.currentValue === "string" && row.source_payload.currentValue.trim() ? (
                <div><dt>Current Release Slug</dt><dd className="break-all">{row.source_payload.currentValue}</dd></div>
              ) : null}
              {typeof row.candidate_payload?.proposedValue === "string" && row.candidate_payload.proposedValue.trim() ? (
                <div><dt>Proposed Release Slug</dt><dd className="break-all">{row.candidate_payload.proposedValue}</dd></div>
              ) : null}
            </>
          ) : null}
          {groupableReviewIssue(row) ? (
            <div><dt>Recorded Issue Title</dt><dd>{row.title}</dd></div>
          ) : null}
        </dl>
      </div>
      <div className="wk-review-record-footer">
        <p>{needsReleaseGovernance
          ? "Review the recorded Release identity conflict. A separate governed decision is required."
          : "Inspect the latest source and evidence before recording a decision."}</p>
        <button type="button" onClick={open && !needsReleaseGovernance ? onOpen : onRead}
          className={"wk-button wk-button-sm " + (open ? "wk-button-primary" : "wk-button-soft")}>
          {needsReleaseGovernance ? "Inspect Release Evidence" : open ? "Review Evidence and Decide" : "Read Governed Record"}
          <WkIcon name="ArrowRight" size={14}/>
        </button>
      </div>
    </div>
  </article>;
}

/** Historical record inspection is read-only. It deliberately never mounts decision inputs. */

/** Only exact, authorised Registry source IDs can provide the subject heading.
 * This read does not infer that a proposed slug or a related peer is canonical.
 */
function useCanonicalReviewTitle(item: RegistryReviewItemRow): string | null {
  const sourceId = item.source_id || item.entity_id || "";
  const type = item.entity_type;
  const key = type + ":" + sourceId;
  const [found, setFound] = useState<{ key: string; title: string | null } | null>(null);
  useEffect(() => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId) ||
        (type !== "track" && type !== "release")) return;
    let active = true;
    const read = async (): Promise<string | null> => {
      if (type === "track") {
        const { data, error } = await supabase.from("registry_tracks")
          .select("id,title").eq("id", sourceId).maybeSingle();
        return !error && data?.id === sourceId && typeof data.title === "string" && data.title.trim()
          ? data.title.trim() : null;
      }
      const { data, error } = await supabase.from("registry_releases")
        .select("id,title").eq("id", sourceId).maybeSingle();
      return !error && data?.id === sourceId && typeof data.title === "string" && data.title.trim()
        ? data.title.trim() : null;
    };
    void read().then(title => {
      if (active) setFound({ key, title });
    }).catch(() => {
      if (active) setFound({ key, title: null });
    });
    return () => { active = false; };
  }, [sourceId, type, key]);
  return found?.key === key ? found.title : null;
}

function RegistryReadOnlyModal({ item, onClose }: {
  item: RegistryReviewItemRow;
  onClose: () => void;
}) {
  const governedRelease = requiresGovernedSingleReleaseReview(item);
  const canonicalTitle = useCanonicalReviewTitle(item);
  const programmeCandidateValue = item.source_payload?.programmeCandidate;
  const programmeCandidate = programmeCandidateValue && typeof programmeCandidateValue === "object" && !Array.isArray(programmeCandidateValue)
    ? programmeCandidateValue as Record<string, unknown> : {};
  // The accepted Release review stores reasonCodes at source_payload's root.
  // Retain nested support for historical snapshots without inventing reasons.
  const recordedReasons = item.source_payload?.reasonCodes ?? programmeCandidate.reasonCodes;
  const reasonCodes = Array.isArray(recordedReasons)
    ? recordedReasons.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const hasRecordedResolution = Boolean(
    item.resolution_payload &&
    typeof item.resolution_payload === "object" &&
    Object.keys(item.resolution_payload).length > 0,
  );
  return <Modal open onClose={onClose}
    title={governedRelease ? "Release identity review" : canonicalTitle || item.title?.trim() || "Recorded Registry Review"}
    maxWidth="3xl"
    footer={<button type="button" className="wk-button wk-button-soft wk-button-sm"
      onClick={onClose}>Close Record</button>}>
    <section data-wk-registry-record-readonly className="wk-review-record-modal">
      {governedRelease ? (
        <section aria-label="Release identity evidence" className="wk-release-evidence">
          <h3 className="wk-release-evidence-title">
            {canonicalTitle || "Release title unavailable"}
          </h3>
          <p className="wk-release-evidence-intro">Recorded Release identity conflict</p>
          <p className="wk-release-evidence-intro">
            The current Release identity conflicts with recorded Registry or Community evidence.
            Inspect each source before a governed MIZIZI decision.
          </p>
          <dl className="wk-review-record-facts wk-release-identity-facts">
            {typeof item.source_payload?.currentValue === "string" ? (
              <div><dt>Current Release Slug</dt><dd className="break-all">{item.source_payload.currentValue || "Not recorded"}</dd></div>
            ) : null}
            {typeof item.candidate_payload?.proposedValue === "string" ? (
              <div><dt>Proposed Release Slug (Not Approved)</dt><dd className="break-all">{item.candidate_payload.proposedValue || "Not recorded"}</dd></div>
            ) : null}
            <div><dt>Review Rule</dt><dd>{String(item.source_payload?.ruleId || "Unknown")}</dd></div>
            <div><dt>Rule Version</dt><dd>{String(item.source_payload?.ruleVersion || "Unknown")}</dd></div>
          </dl>
          {reasonCodes.length ? (
            <section className="wk-release-reason-block" aria-label="Recorded conflict reasons">
              <h4>Recorded Conflict Reasons</h4>
              <ul>
                {reasonCodes.map(reason => <li key={reason}>
                  <span>{humanize(reason)}</span>
                  <code>{reason}</code>
                </li>)}
              </ul>
            </section>
          ) : null}
          <p className="wk-release-readonly-note">
            This review stays open. The generic decision form cannot resolve it.
          </p>
        </section>
      ) : null}
      <div className="wk-review-record-modal-head" aria-label="Recorded review status">
        <span className="wk-review-record-state is-other">{humanize(item.status || "Unknown")}</span>
        {!governedRelease ? <span className="text-[12px] text-wk-text-muted">{reviewTypeLabel(item.review_type || "")}</span> : null}
      </div>
      <div className="wk-review-record-issue-summary">
        <h3 className="wk-review-record-meta-title">What needs review</h3>
        <p className="wk-review-record-description-text">
          {item.summary || "The Registry has not recorded a summary for this review."}
        </p>
      </div>
      <WkDisclosure summary="Review references" triggerClassName="wk-button wk-button-ghost wk-button-sm"
        contentClassName="pt-3">
        <dl className="wk-review-record-facts wk-review-record-meta-facts">
          <div><dt>Review Reference</dt><dd className="break-all font-mono">{item.id}</dd></div>
          <div><dt>Recorded State</dt><dd>{humanize(item.status || "Unknown")}</dd></div>
          {item.priority ? <div><dt>Priority</dt><dd>{humanize(item.priority)}</dd></div> : null}
          {item.entity_type ? <div><dt>Subject</dt><dd>{humanize(item.entity_type)}</dd></div> : null}
          {item.source_table ? <div><dt>Source Table</dt><dd>{item.source_table}</dd></div> : null}
          {item.source_id ? <div><dt>Source ID</dt><dd className="break-all font-mono">{item.source_id}</dd></div> : null}
        </dl>
      </WkDisclosure>
      <div className="wk-review-record-source-section">
        <WkDisclosure summary="Read Recorded Source Data"
          triggerClassName="wk-button wk-button-ghost wk-button-sm"
          contentClassName="grid gap-3 pt-4 md:grid-cols-2">
          <JsonBlock title="Source Evidence" value={item.source_payload} />
          <JsonBlock title="Candidate Record" value={item.candidate_payload} />
          {hasRecordedResolution ? <JsonBlock title="Recorded Resolution" value={item.resolution_payload} /> : null}
        </WkDisclosure>
      </div>
      <p className="wk-review-record-readonly-footer">
        {governedRelease
          ? "This Release review remains open until MIZIZI verifies a governed outcome."
          : "This is a record inspection. It does not change Registry data."}
      </p>
    </section>
  </Modal>;
}

function RegistryDecisionModal({ item, decision, setDecision, onClose, onSubmit }: { item: RegistryReviewItemRow; decision: DecisionState; setDecision: Dispatch<SetStateAction<DecisionState>>; onClose: () => void; onSubmit: () => void }) {
  const candidatePayload = item.candidate_payload ?? {};
  const sourcePayload = item.source_payload ?? {};
  const artistText = candidateString(item, "artistText");
  const artistSlug = candidateString(item, "artistSlug");
  const publicMusicReview =
    isPublicMusicIdentityTrackReview(item);
  const decisionOptions =
    publicMusicReview
      ? PUBLIC_MUSIC_IDENTITY_DECISION_OPTIONS
      : DECISION_OPTIONS;
  const selectedOption = decisionOptions.find(
    (option) => option.value === decision.decisionType,
  );
  const showStructuredFields =
    !publicMusicReview &&
    isStructuredDecision(decision.decisionType);
  const showFeaturedFields =
    !publicMusicReview &&
    decision.decisionType === "approve_featured_artist_split";
  const readiness = reviewReadiness(item);
  const hasRecordedTrackDecision = publicMusicReview && Boolean(decision.publicMusicContext?.existingDecision);
  const recordedSubject = projectRecordedCaseSubject(item.source_payload, item.title ?? "");
  const canonicalTitle = useCanonicalReviewTitle(item);
  const jobTitle = publicMusicReview && decision.publicMusicContext?.title
    ? decision.publicMusicContext.title
    : canonicalTitle || (recordedSubject.specific ? recordedSubject.title
      : item.title || item.review_key || item.id);

  // Presets choose an option, never manufacture a verified evidence statement.
  const setPreset = (decisionType: RegistryDecisionType) => {
    setDecision((current) => ({ ...current, decisionType, notes: "", message: "" }));
  };

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] leading-5 text-wk-text-faint">
        {publicMusicReview
          ? "This records human judgment only. The review stays open until a governed executor mutates and verifies the canonical outcome, then a finalizer resolves the review."
          : "This records a structured review decision only. Canonical relationship changes remain governed separately."}
      </p>
      <div className="flex shrink-0 gap-2">
        <button onClick={onClose} disabled={decision.submitting} className="wk-button wk-button-ghost wk-button-sm">Cancel</button>
        <button onClick={onSubmit} disabled={decision.submitting || !decision.notes.trim()} className="wk-button wk-button-primary wk-button-sm">
          {decision.submitting
            ? "Recording..."
            : hasRecordedTrackDecision ? "Record Revised Decision" : "Record Decision"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={jobTitle}
      maxWidth="3xl"
      dismissable={!decision.submitting}
      footer={footer}
    >
      <div className="wk-review-job-head">
        <p className="wk-review-job-kicker">{item.entity_type === "track" ? "Recording" : item.entity_type === "release" ? "Release" : "Review"} to inspect</p>
        <h3>{jobTitle}</h3>
        {publicMusicReview && decision.publicMusicContext?.isrc ? (
          <p>ISRC {decision.publicMusicContext.isrc}</p>
        ) : null}
        {recordedSubject.artistReference ? <p>Recorded artist reference: {recordedSubject.artistReference}</p> : null}
        <div className="wk-review-job-issue">
          <h4>What Needs Review</h4>
          <p>{item.summary || item.title || "Inspect the source record before deciding."}</p>
        </div>
      </div>
<p className="wk-review-job-standing">
  <strong>{humanize(item.status || "Unknown")}</strong>
  {item.priority === "high" ? " · High priority" : ""}
  {readiness.label === "Review needed" ? " · Needs review" : ""}
</p>{!publicMusicReview ? (
  <div className="mt-4 grid gap-3 md:grid-cols-2">
    <FieldPill label="Source Artist Text" value={artistText || "Not recorded"} />
    <FieldPill label="Source Artist Slug" value={artistSlug || "Not recorded"} />
  </div>
) : null}<WkDisclosure summary="Source IDs and Recorded Data"
 triggerClassName="wk-button wk-button-ghost wk-button-sm mt-4"
 contentClassName="pt-3">
 <p className="break-all text-[12px] text-wk-text-muted">{item.source_table || "Unknown source"} / {item.source_id || item.entity_id || "Unknown ID"}</p>
 <p className="mt-1 break-all font-mono text-[11px] text-wk-text-muted">Review {item.id}</p>
 <div className="mt-3 grid gap-4 md:grid-cols-2">
   <JsonBlock title="Candidate Record" value={candidatePayload} />
   <JsonBlock title="Recorded Source" value={sourcePayload} />
 </div>
</WkDisclosure><div className="mt-5 rounded-xl border border-wk-border bg-wk-surface p-4"><div className="text-[12px] font-bold text-wk-text">Quick decision presets</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{publicMusicReview ? <><button type="button" onClick={() => setPreset("public_music_identity_needs_more_research")} className="wk-button wk-button-ghost wk-button-sm">Needs research</button><button type="button" onClick={() => setPreset("public_music_identity_safe_slug_repair")} className="wk-button wk-button-ghost wk-button-sm">Safe slug repair</button><button type="button" onClick={() => setPreset("public_music_identity_distinct_recording")} className="wk-button wk-button-ghost wk-button-sm">Distinct recording</button><button type="button" onClick={() => setPreset("public_music_identity_true_duplicate")} className="wk-button wk-button-ghost wk-button-sm">True duplicate</button></> : <><button type="button" onClick={() => setPreset("needs_more_research")} className="wk-button wk-button-ghost wk-button-sm">Needs research</button><button type="button" onClick={() => setPreset("approve_primary_artist")} className="wk-button wk-button-ghost wk-button-sm">Approve primary</button><button type="button" onClick={() => setPreset("approve_featured_artist_split")} className="wk-button wk-button-ghost wk-button-sm">Approve split</button><button type="button" onClick={() => setPreset("reject_bad_metadata")} className="wk-button wk-button-ghost wk-button-sm">Reject metadata</button></>}</div></div><div className="mt-5 rounded-xl border border-wk-border bg-wk-surface p-4"><label className="block text-[12px] font-bold text-wk-text">Decision</label><WkSelect value={decision.decisionType} onChange={(value) => setDecision((current) => ({ ...current, decisionType: value as RegistryDecisionType, notes: "", message: "" }))} triggerClassName="mt-2 w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-[13px] text-wk-text">{decisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</WkSelect><p className="mt-1 text-[11px] leading-5 text-wk-text-muted">{selectedOption?.help}</p>{publicMusicReview && <div className="mt-4 rounded-xl border border-wk-brand/25 bg-wk-brand-soft p-4"><div className="text-[12px] font-bold text-wk-text">Public Music Identity: governed human decision</div>
{hasRecordedTrackDecision ? (
  <p className="mt-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] leading-5 text-wk-text">
    A human decision is already recorded for this Track. Recording another decision will supersede it.
    Review its evidence and existing judgment before making a change.
  </p>
) : null}
<p className="mt-1 text-[11px] leading-5 text-wk-text-muted">Recording this decision does not resolve the review or mutate the Track. A later governed executor must verify the accepted outcome before resolution.</p>{decision.publicMusicContextLoading ? <p className="mt-3 text-[12px] text-wk-text-muted">Loading current Track authority…</p> : decision.publicMusicContext ? <><div className="mt-3 grid gap-3 md:grid-cols-2"><FieldPill label="Current slug" value={decision.publicMusicContext.currentSlug} /><FieldPill label="Reviewed proposed slug" value={decision.publicMusicContext.proposedSlug || "None"} /><FieldPill label="Rule" value={decision.publicMusicContext.ruleId + "/" + decision.publicMusicContext.ruleVersion} /><FieldPill label="Recording identity review" value={decision.publicMusicContext.openRecordingIdentityReviewId || "None"} /><FieldPill label="Human decision" value={decision.publicMusicContext.existingDecision ? humanize(String(decision.publicMusicContext.existingDecision.decisionType || "recorded")) : "Not recorded"} /><FieldPill label="Execution state" value={decision.publicMusicContext.existingDecision ? "Decision recorded · execution pending" : "Awaiting human decision"} /></div><div className="mt-3 grid gap-4 md:grid-cols-2"><JsonBlock title="Current active credits" value={decision.publicMusicContext.activeCredits} /><JsonBlock title="Review evidence" value={decision.publicMusicContext.reviewEvidence} /></div></> : <p className="mt-3 text-[12px] text-wk-warning">Current Track authority could not be loaded.</p>}<div className="mt-4 grid gap-3 md:grid-cols-2"><TextInput label="Reviewed proposed slug" value={decision.proposedSlug} placeholder="e.g. summer" onChange={(value) => setDecision((current) => ({ ...current, proposedSlug: value, message: "" }))} />{decision.decisionType === "public_music_identity_distinct_recording" && <TextInput label="Evidence-backed canonical slug" value={decision.canonicalSlug} placeholder="e.g. song-live" onChange={(value) => setDecision((current) => ({ ...current, canonicalSlug: value, message: "" }))} />}{decision.decisionType === "public_music_identity_true_duplicate" && <TextInput label="Canonical Track UUID" value={decision.canonicalTrackId} placeholder="UUID of surviving Track" onChange={(value) => setDecision((current) => ({ ...current, canonicalTrackId: value, message: "" }))} />}</div>{decision.decisionType === "public_music_identity_distinct_recording" && <div className="mt-3"><TextAreaInput label="Semantic distinction evidence" value={decision.semanticDistinction} placeholder="What authoritative version distinction makes this recording legitimately distinct?" rows={3} onChange={(value) => setDecision((current) => ({ ...current, semanticDistinction: value, message: "" }))} /></div>}{decision.decisionType === "public_music_identity_credit_correction_required" && <div className="mt-3"><TextAreaInput label="Structured credit evidence" value={decision.creditEvidence} placeholder="State the exact primary/featured credit correction required and its evidence." rows={3} onChange={(value) => setDecision((current) => ({ ...current, creditEvidence: value, message: "" }))} /></div>}</div>}{showStructuredFields && <div className="mt-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4"><div className="text-[12px] font-bold text-wk-text">Structured canonical resolution</div><p className="mt-1 text-[11px] leading-5 text-wk-text-muted">Phase 3A will only treat an approval as actionable when this points to one clean canonical artist.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><TextInput label="Canonical primary artist name" value={decision.canonicalPrimaryArtistName} placeholder="e.g. Karun" onChange={(value) => setDecision((current) => ({ ...current, canonicalPrimaryArtistName: value, message: "" }))} /><TextInput label="Canonical primary artist slug" value={decision.canonicalPrimaryArtistSlug} placeholder="e.g. karun" onChange={(value) => setDecision((current) => ({ ...current, canonicalPrimaryArtistSlug: value, message: "" }))} /></div>{showFeaturedFields && <div className="mt-3 grid gap-3 md:grid-cols-2"><TextAreaInput label="Featured/collaborator names" value={decision.featuredArtistNames} placeholder="One per line or comma-separated" rows={3} onChange={(value) => setDecision((current) => ({ ...current, featuredArtistNames: value, message: "" }))} /><TextAreaInput label="Featured/collaborator slugs" value={decision.featuredArtistSlugs} placeholder="One per line or comma-separated" rows={3} onChange={(value) => setDecision((current) => ({ ...current, featuredArtistSlugs: value, message: "" }))} /></div>}</div>}<label className="mt-4 block text-[12px] font-bold text-wk-text">Decision notes</label><textarea value={decision.notes} onChange={(event) => setDecision((current) => ({ ...current, notes: event.target.value, message: "" }))} rows={4} className="mt-2 w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-[13px] text-wk-text" placeholder="Explain what you verified and why this decision is safe." /><WkCheckbox checked={decision.continueToNext} onChange={(checked) => setDecision((current) => ({ ...current, continueToNext: checked }))} className="mt-4 flex items-start gap-2 text-[12px] text-wk-text-muted"> Open next visible item after recording</WkCheckbox>{decision.message && <p className="mt-2 text-[12px] font-semibold text-wk-warning">{decision.message}</p>}</div>
    </Modal>
  );
}

function TextInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" /></label>;
}

function TextAreaInput({ label, value, placeholder, rows, onChange }: { label: string; value: string; placeholder?: string; rows?: number; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows ?? 3} className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" /></label>;
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4"><div className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">{title}</div><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-wk-text-muted">{JSON.stringify(value ?? {}, null, 2)}</pre></div>;
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
  return <div className="divide-y divide-wk-border">{rows.map((row) => {
    const role = (row.metadata?.role as string) || "media";
    return <div key={row.id} className="p-4"><RowTop left={`${row.source_entity || "entity"}/${row.source_record_id || "unattached"}`} right={role} /><p className="mt-1 truncate text-[12px] text-wk-text-muted">{row.url || "No URL"}</p><p className="mt-2 text-[12px] text-wk-text-faint">{row.source_kind || "source"} · {row.status || "status"}</p></div>;
  })}</div>;
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

function FieldPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2"><div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">{label}</div><div className="mt-1 truncate text-[12px] font-semibold text-wk-text">{value}</div></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="p-8 text-center"><WkIcon name="Inbox" size={24} className="mx-auto mb-3 text-wk-text-faint" /><div className="text-[13px] font-bold text-wk-text">{title}</div><p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-wk-text-muted">{body}</p></div>;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
