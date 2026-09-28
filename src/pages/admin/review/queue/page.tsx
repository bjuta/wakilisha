import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon, type WkIconName } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  formatReviewCount,
  isPublicMusicIdentityTrackReview,
  loadPublicMusicIdentityTrackReviewContext,
  loadRegistryReviewItems,
  loadReviewCommandCenter,
  recordRegistryReviewDecision,
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
  type ReviewWorkstream,
  type StagingSummaryRow,
} from "@/services/adminReviewCommandCenter";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";



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

function toneClass(tone: ReadinessTone): string {
  if (tone === "success") return "bg-wk-success-soft text-wk-success";
  if (tone === "warning") return "bg-wk-warning-soft text-wk-warning";
  if (tone === "danger") return "bg-wk-danger-soft text-wk-danger";
  if (tone === "brand") return "bg-wk-brand-soft text-wk-brand";
  return "bg-wk-surface-raised text-wk-text-muted";
}

export default function AdminReviewQueuePage() {
  const navigate = useNavigate();
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

  const activeWork = useMemo(() => {
    if (!data) return 0;
    return data.totals.registryReviewItems + data.totals.openDecisions + data.totals.reviewArtifacts + data.totals.stagingNeedsReview + data.totals.blockedStaging + data.totals.unknownFields;
  }, [data]);

  const openItem = (item: RegistryReviewItemRow) => {
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
  };

  const closeItem = () => {
    if (decision.submitting) return;
    setSelectedItem(null);
    setDecision(emptyDecisionState());
  };

  const submitDecision = async () => {
    if (!selectedItem) return;
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Review</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">Review Command Center</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">One cockpit for registry credit review, import artifacts, resolver decisions, media candidates, postmeta classification, staging exceptions, and promotion audit events.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPanel("registry")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"><WkIcon name="GitPullRequest" size={14} /> Registry Queue</button>
          <button onClick={() => setPanel("artifacts")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="Archive" size={14} /> Artifacts</button>
          <button onClick={() => navigate("/admin/charts/review-queue")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="ArrowRight" size={14} /> Charts Review</button>
        </div>
      </div>

      <div className="rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wk-surface text-wk-brand"><WkIcon name="Command" size={20} /></div>
          <div>
            <div className="text-[13px] font-bold text-wk-text">Operational, not decorative</div>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">Phase 3C.3 adds quick decisions, next-item flow, and readiness badges so the review queue can be processed quickly without bypassing audit safety.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active review load" value={activeWork} icon="Activity" tone={activeWork > 0 ? "danger" : "success"} />
        <KpiCard label="Registry review items" value={data.totals.registryReviewItems} icon="GitPullRequest" tone={data.totals.registryReviewItems > 0 ? "danger" : "success"} />
        <KpiCard label="High priority registry" value={data.totals.highPriorityRegistryReviewItems} icon="AlertTriangle" tone={data.totals.highPriorityRegistryReviewItems > 0 ? "warning" : "success"} />
        <KpiCard label="Open decisions" value={data.totals.openDecisions} icon="GitPullRequest" tone={data.totals.openDecisions > 0 ? "danger" : "success"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Staging needs review" value={data.totals.stagingNeedsReview} detail="Rows still awaiting resolver attention" />
        <MiniStat label="Blocked staging" value={data.totals.blockedStaging} detail="Rows that cannot be promoted yet" />
        <MiniStat label="Unknown/review fields" value={data.totals.unknownFields} detail="Postmeta keys needing policy" />
        <MiniStat label="Media review items" value={data.totals.unresolvedMedia} detail="Unresolved media candidates" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <WkSurface className="overflow-hidden p-0"><SectionHeader title="Workstreams" subtitle="Prioritized queues created by import, registry, resolver, and audit phases." icon="Layers" /><div className="divide-y divide-wk-border">{data.workstreams.map((stream) => <WorkstreamRow key={stream.key} stream={stream} onOpen={(path) => navigate(path)} />)}</div></WkSurface>
        <WkSurface className="overflow-hidden p-0"><div className="border-b border-wk-border p-4"><div className="flex items-center gap-2"><WkIcon name="PanelTop" size={16} className="text-wk-brand" /><h2 className="text-[14px] font-bold text-wk-text">Review panels</h2></div><p className="mt-1 text-[12px] text-wk-text-muted">Recent examples from each operational review stream.</p><div className="mt-3 flex flex-wrap gap-2">{PANEL_BUTTONS.map((item) => <button key={item.key} onClick={() => setPanel(item.key)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${panel === item.key ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised"}`}><WkIcon name={item.icon} size={12} /> {item.label}</button>)}</div></div><PanelContent panel={panel} data={data} onOpenRegistryItem={openItem} /></WkSurface>
      </div>

      {selectedItem && <RegistryDecisionModal item={selectedItem} decision={decision} setDecision={setDecision} onClose={closeItem} onSubmit={submitDecision} />}
    </div>
  );
}

function LoadingState() {
  return <div className="space-y-4"><div className="h-9 w-80 animate-pulse rounded bg-wk-surface-raised" /><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-wk-border bg-wk-surface" />)}</div><div className="h-96 animate-pulse rounded-xl border border-wk-border bg-wk-surface" /></div>;
}

function ErrorState({ error }: { error: string }) {
  return <div className="py-20 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger"><WkIcon name="AlertCircle" size={28} /></div><h2 className="text-[18px] font-bold text-wk-text">Could not load review command center</h2><p className="mx-auto mt-2 max-w-xl text-[13px] text-wk-text-muted">{error || "Some review tables may not exist in this environment yet."}</p></div>;
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: WkIconName; tone: "danger" | "warning" | "neutral" | "success" }) {
  const cls = tone === "danger" ? "bg-wk-danger-soft text-wk-danger" : tone === "warning" ? "bg-wk-warning-soft text-wk-warning" : tone === "success" ? "bg-wk-success-soft text-wk-success" : "bg-wk-surface-raised text-wk-text-muted";
  return <WkSurface className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[26px] font-black tracking-tight text-wk-text">{formatReviewCount(value)}</div><div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-wk-text-faint">{label}</div></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cls}`}><WkIcon name={icon} size={19} /></div></div></WkSurface>;
}

function MiniStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-wk-border bg-wk-surface px-4 py-3"><div className="text-[18px] font-black text-wk-text">{formatReviewCount(value)}</div><div className="mt-0.5 text-[12px] font-bold text-wk-text">{label}</div><div className="text-[11px] text-wk-text-muted">{detail}</div></div>;
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: WkIconName }) {
  return <div className="border-b border-wk-border p-4"><div className="flex items-center gap-2"><WkIcon name={icon} size={16} className="text-wk-brand" /><h2 className="text-[14px] font-bold text-wk-text">{title}</h2></div><p className="mt-1 text-[12px] text-wk-text-muted">{subtitle}</p></div>;
}

function WorkstreamRow({ stream, onOpen }: { stream: ReviewWorkstream; onOpen: (path: string) => void }) {
  const tone = stream.severity === "danger" ? "bg-wk-danger-soft text-wk-danger" : stream.severity === "warning" ? "bg-wk-warning-soft text-wk-warning" : stream.severity === "success" ? "bg-wk-success-soft text-wk-success" : stream.severity === "brand" ? "bg-wk-brand-soft text-wk-brand" : "bg-wk-surface-raised text-wk-text-muted";
  return <div className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[14px] font-bold text-wk-text">{stream.label}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${tone}`}>{formatReviewCount(stream.count)}</span></div><p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{stream.description}</p><p className="mt-2 text-[12px] leading-5 text-wk-text"><span className="font-bold">Next:</span> {stream.nextAction}</p></div>{stream.path && <button onClick={() => onOpen(stream.path!)} className="wk-button wk-button-ghost wk-button-sm shrink-0 whitespace-nowrap">Open <WkIcon name="ArrowRight" size={13} /></button>}</div></div>;
}

function PanelContent({ panel, data, onOpenRegistryItem }: { panel: Panel; data: ReviewCommandCenterData; onOpenRegistryItem: (item: RegistryReviewItemRow) => void }) {
  if (panel === "registry") return <RegistryReviewPanel initialRows={data.registryReviewItems} summary={data.registryReviewSummary} onOpen={onOpenRegistryItem} />;
  if (panel === "decisions") return <DecisionRows rows={data.decisionSamples} />;
  if (panel === "artifacts") return <ArtifactRows rows={data.artifactSamples} />;
  if (panel === "fields") return <FieldRows rows={data.fieldDictionary} />;
  if (panel === "media") return <MediaRows rows={data.mediaRows} />;
  if (panel === "staging") return <StagingRows rows={data.stagingSummary} />;
  return <EventRows rows={data.promotionEvents} />;
}

function RegistryReviewPanel({ initialRows, summary, onOpen }: { initialRows: RegistryReviewItemRow[]; summary: RegistryReviewSummaryRow[]; onOpen: (item: RegistryReviewItemRow) => void }) {
  const [filters, setFilters] = useState<RegistryFilterState>(DEFAULT_REGISTRY_FILTERS);
  const [rows, setRows] = useState<RegistryReviewItemRow[]>(initialRows);
  const [total, setTotal] = useState(summary.find((item) => item.status === "open")?.count ?? initialRows.length);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadPage = async (nextFilters: RegistryFilterState, nextOffset: number, mode: "replace" | "append") => {
    setLoading(true);
    setMessage("");
    try {
      const page = await loadRegistryReviewItems(toRegistryFilters(nextFilters, nextOffset));
      setRows((current) => mode === "append" ? [...current, ...page.rows] : page.rows);
      setTotal(page.total);
      setOffset(page.offset);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load registry review items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setRows(initialRows); }, [initialRows]);

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

  if (!rows.length && !summary.length) return <EmptyState title="No registry review items" body="Ambiguous release and track artist credits will appear here after Phase 2A review population runs." />;

  return <div><div className="border-b border-wk-border bg-wk-surface-raised/50 p-4"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{summary.slice(0, 6).map((item) => <div key={`${item.status}-${item.review_type}`} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2"><div className="text-[15px] font-black text-wk-text">{formatReviewCount(item.count)}</div><div className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wider text-wk-text-faint">{humanize(item.review_type)}</div><div className="mt-1 text-[11px] text-wk-text-muted">{item.status}</div></div>)}</div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5"><FilterInput label="Search" value={filters.search} placeholder="Title, summary, review key" onChange={(value) => updateFilter("search", value)} /><FilterSelect label="Status" value={filters.status} onChange={(value) => updateFilter("status", value)} options={["open", "resolved"]} /><FilterSelect label="Priority" value={filters.priority} onChange={(value) => updateFilter("priority", value)} options={["high", "normal"]} /><FilterSelect label="Review type" value={filters.reviewType} onChange={(value) => updateFilter("reviewType", value)} options={[...new Set(summary.map((item) => item.review_type))]} /><FilterSelect label="Entity" value={filters.entityType} onChange={(value) => updateFilter("entityType", value)} options={["release", "track"]} /></div><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="text-[11px] font-semibold text-wk-text-muted">Showing {formatReviewCount(rows.length)} of {formatReviewCount(total)} matching review items.</div><button onClick={resetFilters} disabled={loading} className="wk-button wk-button-ghost wk-button-sm self-start sm:self-auto">Reset filters</button></div>{message && <div className="mt-2 text-[12px] font-semibold text-wk-warning">{message}</div>}</div><div className="divide-y divide-wk-border">{rows.map((row) => <RegistryReviewRow key={row.id} row={row} onOpen={() => onOpen(row)} />)}</div><div className="border-t border-wk-border p-4 text-center"><button onClick={loadMore} disabled={loading || rows.length >= total} className="wk-button wk-button-ghost wk-button-sm">{loading ? "Loading..." : rows.length >= total ? "All matching items loaded" : "Load more"}</button></div></div>;
}

function FilterInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text" /></label>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">{label}</span><WkSelect value={value} onChange={(value) => onChange(value)} triggerClassName="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text"><option value="">All</option>{options.filter(Boolean).map((option) => <option key={option} value={option}>{humanize(option)}</option>)}</WkSelect></label>;
}

function RegistryReviewRow({ row, onOpen }: { row: RegistryReviewItemRow; onOpen: () => void }) {
  const artistText = candidateString(row, "artistText");
  const artistSlug = candidateString(row, "artistSlug");
  const reviewType = row.review_type || "registry_review";
  const readiness = reviewReadiness(row);
  const priorityTone = row.priority === "high" ? "bg-wk-warning-soft text-wk-warning" : "bg-wk-surface-raised text-wk-text-muted";
  return <div className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><RowTop left={row.title || row.review_key || row.id} right={humanize(reviewType)} /><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${priorityTone}`}>{row.priority || "normal"}</span><span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-text-muted">{row.status || "open"}</span><span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-text-muted">{row.entity_type || "entity"}</span><span title={readiness.description} className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${toneClass(readiness.tone)}`}>{readiness.label}</span></div><p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{row.summary || "Registry item requires human review before canonicalization."}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><FieldPill label="Artist text" value={artistText || "Missing"} /><FieldPill label="Artist slug" value={artistSlug || "Missing"} /></div><div className="mt-2 text-[11px] text-wk-text-faint">Source: {row.source_table || "unknown"}/{row.source_id || row.entity_id || "unknown"}</div></div><div className="flex shrink-0 flex-col gap-2 sm:items-end"><button onClick={onOpen} className="wk-button wk-button-ghost wk-button-sm">Open detail <WkIcon name="ArrowRight" size={13} /></button><div className="max-w-[220px] text-right text-[10px] leading-4 text-wk-text-faint">{readiness.description}</div></div></div></div>;
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

  const setPreset = (decisionType: RegistryDecisionType, notes: string) => {
    setDecision((current) => ({ ...current, decisionType, notes, message: "" }));
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-wk-border bg-wk-surface shadow-2xl"><div className="border-b border-wk-border p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-[11px] font-black uppercase tracking-wider text-wk-brand">Registry review detail</div><h2 className="mt-1 text-[18px] font-black text-wk-text">{item.title || item.review_key || item.id}</h2><p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{item.summary || "Resolve this item by recording an auditable decision. Canonical relationship tables are not mutated in Phase 2B."}</p></div><button onClick={onClose} className="wk-button wk-button-ghost wk-button-sm">Close</button></div></div><div className="max-h-[calc(90vh-170px)] overflow-y-auto p-5"><div className="grid gap-3 md:grid-cols-4"><FieldPill label="Review type" value={humanize(item.review_type || "registry_review")} /><FieldPill label="Priority" value={item.priority || "normal"} /><FieldPill label="Status" value={item.status || "open"} /><FieldPill label="Readiness" value={readiness.label} /></div><p className="mt-2 text-[11px] leading-5 text-wk-text-muted">{readiness.description}</p><div className="mt-4 grid gap-3 md:grid-cols-2"><FieldPill label="Source artist text" value={artistText || "Missing"} /><FieldPill label="Source artist slug" value={artistSlug || "Missing"} /></div><div className="mt-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4"><div className="text-[11px] font-black uppercase tracking-wider text-wk-text-faint">Source reference</div><div className="mt-2 text-[12px] text-wk-text">{item.source_table || "unknown"}/{item.source_id || item.entity_id || "unknown"}</div><div className="mt-1 break-all text-[11px] text-wk-text-faint">{item.review_key || item.id}</div></div><div className="mt-4 grid gap-4 md:grid-cols-2"><JsonBlock title="Candidate payload" value={candidatePayload} /><JsonBlock title="Source payload" value={sourcePayload} /></div><div className="mt-5 rounded-xl border border-wk-border bg-wk-surface p-4"><div className="text-[12px] font-bold text-wk-text">Quick decision presets</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{publicMusicReview ? <><button type="button" onClick={() => setPreset("public_music_identity_needs_more_research", "Needs additional identity evidence before governed execution.")} className="wk-button wk-button-ghost wk-button-sm">Needs research</button><button type="button" onClick={() => setPreset("public_music_identity_safe_slug_repair", "Reviewed clean slug is culturally and structurally correct; execution remains governed.")} className="wk-button wk-button-ghost wk-button-sm">Safe slug repair</button><button type="button" onClick={() => setPreset("public_music_identity_distinct_recording", "Authoritative evidence proves this is a legitimately distinct recording.")} className="wk-button wk-button-ghost wk-button-sm">Distinct recording</button><button type="button" onClick={() => setPreset("public_music_identity_true_duplicate", "Authoritative evidence proves this Track is a duplicate of the selected canonical Track.")} className="wk-button wk-button-ghost wk-button-sm">True duplicate</button></> : <><button type="button" onClick={() => setPreset("needs_more_research", "Needs additional source verification before canonicalization.")} className="wk-button wk-button-ghost wk-button-sm">Needs research</button><button type="button" onClick={() => setPreset("approve_primary_artist", "Verified single canonical primary artist. No canonical mutation at review stage.")} className="wk-button wk-button-ghost wk-button-sm">Approve primary</button><button type="button" onClick={() => setPreset("approve_featured_artist_split", "Verified primary artist and featured/collaborator split. No canonical mutation at review stage.")} className="wk-button wk-button-ghost wk-button-sm">Approve split</button><button type="button" onClick={() => setPreset("reject_bad_metadata", "Source metadata is not reliable enough for canonical relationships.")} className="wk-button wk-button-ghost wk-button-sm">Reject metadata</button></>}</div></div><div className="mt-5 rounded-xl border border-wk-border bg-wk-surface p-4"><label className="block text-[12px] font-bold text-wk-text">Decision</label><WkSelect value={decision.decisionType} onChange={(value) => setDecision((current) => ({ ...current, decisionType: value as RegistryDecisionType, message: "" }))} triggerClassName="mt-2 w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-[13px] text-wk-text">{decisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</WkSelect><p className="mt-1 text-[11px] leading-5 text-wk-text-muted">{selectedOption?.help}</p>{publicMusicReview && <div className="mt-4 rounded-xl border border-wk-brand/25 bg-wk-brand-soft p-4"><div className="text-[12px] font-bold text-wk-text">Public Music Identity — governed human decision</div><p className="mt-1 text-[11px] leading-5 text-wk-text-muted">Recording this decision does not resolve the review or mutate the Track. A later governed executor must verify the accepted outcome before resolution.</p>{decision.publicMusicContextLoading ? <p className="mt-3 text-[12px] text-wk-text-muted">Loading current Track authority…</p> : decision.publicMusicContext ? <><div className="mt-3 grid gap-3 md:grid-cols-2"><FieldPill label="Current slug" value={decision.publicMusicContext.currentSlug} /><FieldPill label="Reviewed proposed slug" value={decision.publicMusicContext.proposedSlug || "None"} /><FieldPill label="Rule" value={decision.publicMusicContext.ruleId + "/" + decision.publicMusicContext.ruleVersion} /><FieldPill label="Recording identity review" value={decision.publicMusicContext.openRecordingIdentityReviewId || "None"} /><FieldPill label="Human decision" value={decision.publicMusicContext.existingDecision ? humanize(String(decision.publicMusicContext.existingDecision.decisionType || "recorded")) : "Not recorded"} /><FieldPill label="Execution state" value={decision.publicMusicContext.existingDecision ? "Decision recorded · execution pending" : "Awaiting human decision"} /></div><div className="mt-3 grid gap-4 md:grid-cols-2"><JsonBlock title="Current active credits" value={decision.publicMusicContext.activeCredits} /><JsonBlock title="Review evidence" value={decision.publicMusicContext.reviewEvidence} /></div></> : <p className="mt-3 text-[12px] text-wk-warning">Current Track authority could not be loaded.</p>}<div className="mt-4 grid gap-3 md:grid-cols-2"><TextInput label="Reviewed proposed slug" value={decision.proposedSlug} placeholder="e.g. summer" onChange={(value) => setDecision((current) => ({ ...current, proposedSlug: value, message: "" }))} />{decision.decisionType === "public_music_identity_distinct_recording" && <TextInput label="Evidence-backed canonical slug" value={decision.canonicalSlug} placeholder="e.g. song-live" onChange={(value) => setDecision((current) => ({ ...current, canonicalSlug: value, message: "" }))} />}{decision.decisionType === "public_music_identity_true_duplicate" && <TextInput label="Canonical Track UUID" value={decision.canonicalTrackId} placeholder="UUID of surviving Track" onChange={(value) => setDecision((current) => ({ ...current, canonicalTrackId: value, message: "" }))} />}</div>{decision.decisionType === "public_music_identity_distinct_recording" && <div className="mt-3"><TextAreaInput label="Semantic distinction evidence" value={decision.semanticDistinction} placeholder="What authoritative version distinction makes this recording legitimately distinct?" rows={3} onChange={(value) => setDecision((current) => ({ ...current, semanticDistinction: value, message: "" }))} /></div>}{decision.decisionType === "public_music_identity_credit_correction_required" && <div className="mt-3"><TextAreaInput label="Structured credit evidence" value={decision.creditEvidence} placeholder="State the exact primary/featured credit correction required and its evidence." rows={3} onChange={(value) => setDecision((current) => ({ ...current, creditEvidence: value, message: "" }))} /></div>}</div>}{showStructuredFields && <div className="mt-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4"><div className="text-[12px] font-bold text-wk-text">Structured canonical resolution</div><p className="mt-1 text-[11px] leading-5 text-wk-text-muted">Phase 3A will only treat an approval as actionable when this points to one clean canonical artist.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><TextInput label="Canonical primary artist name" value={decision.canonicalPrimaryArtistName} placeholder="e.g. Karun" onChange={(value) => setDecision((current) => ({ ...current, canonicalPrimaryArtistName: value, message: "" }))} /><TextInput label="Canonical primary artist slug" value={decision.canonicalPrimaryArtistSlug} placeholder="e.g. karun" onChange={(value) => setDecision((current) => ({ ...current, canonicalPrimaryArtistSlug: value, message: "" }))} /></div>{showFeaturedFields && <div className="mt-3 grid gap-3 md:grid-cols-2"><TextAreaInput label="Featured/collaborator names" value={decision.featuredArtistNames} placeholder="One per line or comma-separated" rows={3} onChange={(value) => setDecision((current) => ({ ...current, featuredArtistNames: value, message: "" }))} /><TextAreaInput label="Featured/collaborator slugs" value={decision.featuredArtistSlugs} placeholder="One per line or comma-separated" rows={3} onChange={(value) => setDecision((current) => ({ ...current, featuredArtistSlugs: value, message: "" }))} /></div>}</div>}<label className="mt-4 block text-[12px] font-bold text-wk-text">Decision notes</label><textarea value={decision.notes} onChange={(event) => setDecision((current) => ({ ...current, notes: event.target.value, message: "" }))} rows={4} className="mt-2 w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-[13px] text-wk-text" placeholder="Explain what you verified and why this decision is safe." /><WkCheckbox checked={decision.continueToNext} onChange={(checked) => setDecision((current) => ({ ...current, continueToNext: checked }))} className="mt-4 flex items-start gap-2 text-[12px] text-wk-text-muted"> Open next visible item after recording</WkCheckbox>{decision.message && <p className="mt-2 text-[12px] font-semibold text-wk-warning">{decision.message}</p>}</div></div><div className="flex flex-col gap-2 border-t border-wk-border p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-wk-text-faint">{publicMusicReview ? "This records human judgment only. The review stays open until a governed executor mutates/verifies the canonical outcome and a finalizer resolves the review." : "This records a structured Phase 2B.1 decision only. Phase 3 decides whether to mutate canonical relationships."}</p><div className="flex gap-2"><button onClick={onClose} disabled={decision.submitting} className="wk-button wk-button-ghost wk-button-sm">Cancel</button><button onClick={onSubmit} disabled={decision.submitting} className="wk-button wk-button-primary wk-button-sm">{decision.submitting ? "Recording..." : "Record decision"}</button></div></div></div></div>;
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
