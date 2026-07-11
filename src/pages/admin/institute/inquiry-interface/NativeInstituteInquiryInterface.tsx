import {
  fetchInstituteReviewPackets,
  updateInstituteReviewPacketDecision,
  type InstituteReviewPacket,
  type InstituteReviewPacketStatus,
} from "@/services/institute/instituteReviewDeskService";
import { ArticleEditorWorkspace } from "@/pages/admin/content/articles/detail/ArticleEditorWorkspace";
import { WakilishaRecordWorkspace } from "./WakilishaRecordWorkspace";
import { InstituteClaimsWorkspace } from "./InstituteClaimsWorkspace";
import { InstitutePlaylistWorkspace } from "./InstitutePlaylistWorkspace";
import InquiryAssistantPanel from "./InquiryAssistantPanel";
import ClinicScreen from "./ClinicScreen";
import EvidenceReaderPanel from "./EvidenceReaderPanel";
import HowThisLearnedScreen from "./HowThisLearnedScreen";
import RelationshipsScreen from "./RelationshipsScreen";
import {
  createOrFetchInstituteArticleDraftLink,
  fetchInstituteArticleDraftLink,
  fetchInstituteArticleReviewHistory,
  fetchInstituteArticleReviewState,
  submitInstituteArticleDraftForReview,
  type InstituteArticleDraftLink,
  type InstituteLinkedArticleReviewState,
} from "@/services/institute/instituteArticleBridgeService";
import {
  fetchInstitutePlaylistDraftLink,
  type InstitutePlaylistDraftLink,
} from "@/services/institute/institutePlaylistBridgeService";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createInstituteEvidenceItem,
  createInstituteInquiry,
  listInstituteInquiries,
  updateInstituteInquiry,
} from "@/services/institute/inquiryService";
import {
  anchorCategoryOptions,
  useInstituteAnchorSearch,
} from "./useInstituteAnchorSearch";
import type {
  AnchorContextItem,
  EvidenceItem,
  EvidenceKind,
  InquiryDraft,
  InquiryScreen,
  InquirySection,
  InquirySetup,
  InstituteState,
  RegistryAnchor,
  ReviewState,
} from "./types";

const defaultSetup: InquirySetup = {
  inquiryType: "Explain a cultural shift",
  outputs: ["Article", "WAKILISHA record"],
  formats: ["WAKILISHA record", "Article", "Link", "Citation"],
  tools: ["Evidence board", "Claims board", "Relationship mapper"],
  scopeTimeRange: "",
  scopePlaceRoute: "",
  scopeLanguageRegister: "",
  scopeExclusion: "",
  consentDefault: "Private until reviewed",
  reviewStandard: "Internal memory first",
  draftTimer: "Off",
  previewDepth: "Estimate from real material",
};

const setupOptions = {
  inquiryTypes: [
    "Explain a cultural shift",
    "Trace a relationship",
    "Test a claim",
    "Build a public record",
    "Collect memory",
    "Correct something",
    "Follow a timeline",
    "Compare scenes",
  ],
  outputs: [
    "Article",
    "WAKILISHA record",
    "Artist surface",
    "Track surface",
    "Release surface",
    "Genre or scene surface",
    "Timeline",
    "Map",
    "Audio piece",
    "Video piece",
    "Photo essay",
    "Internal research brief",
  ],
  formats: [
    { label: "WAKILISHA record", note: "Search, select, and preserve the canonical record." },
    { label: "Article", note: "Full article outline, source details, references, and report-ready blocks." },
    { label: "Link", note: "URL, title, page title, access date, and why it matters." },
    { label: "Citation", note: "Source title, author, page, timestamp, edition, and quotation." },
    { label: "Audio", note: "Upload, link, or record audio, then mark what matters." },
    { label: "Video", note: "Upload, link, or record video, then mark the scene." },
    { label: "Photo", note: "Upload, link, or use camera, then add caption and rights." },
    { label: "Interview", note: "Interviewer, interviewee, date, consent, recording, and transcript." },
    { label: "Contributor memory", note: "Text, audio, video, photo, place, actor, consent, and uncertainty." },
    { label: "Social post", note: "Platform, URL, post date, capture date, tone, numbers, archive status." },
    { label: "Chart data", note: "Choose a WAKILISHA edition, entry range, verify surface, and visual system." },
    { label: "Playlist data", note: "Playlist, curator, platform, date added, position, and context." },
    { label: "Event or place", note: "Venue, match, city, date, people present, and what happened." },
    { label: "Archive document", note: "Document title, collection, date, locator, scan, and excerpt." },
    { label: "Personal note", note: "Observation, date, source of memory, uncertainty, and next check." },
    { label: "Correction", note: "Current wording, better wording, source, reason, and affected surface." },
  ],
  tools: [
    { label: "Evidence board", note: "Add material" },
    { label: "Claims board", note: "Shape meaning" },
    { label: "Relationship mapper", note: "Name connections" },
    { label: "Contributor memory intake", note: "Collect memories" },
    { label: "Corrections", note: "Handle changes" },
    { label: "Lineage and forks", note: "Track splits" },
    { label: "Review", note: "Editor decisions" },
    { label: "Inquiry Assistant", note: "AI help, never approval" },
  ],
  consentDefaults: [
    "Publicly after review",
    "Internally as a clue",
    "Private until reviewed",
  ],
  reviewStandards: [
    "Internal memory first",
    "Public-safe",
    "Senior editor",
  ],
  draftTimers: ["10 sec", "30 sec", "60 sec", "Off"],
};

const evidenceKinds: EvidenceKind[] = [
  "WAKILISHA record",
  "Article",
  "Link",
  "Citation",
  "Audio",
  "Video",
  "Photo",
  "Interview",
  "Chart data",
  "Archive document",
  "Personal note",
];

const reviewStates: ReviewState[] = [
  "Draft",
  "Needs review",
  "Accepted for internal memory",
  "Public-safe candidate",
  "Needs more evidence",
  "Kept as doubt",
  "Rejected with reason",
];

function stripLegacyInstituteHash() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/admin/institute/inquiry-interface") return;
  if (!window.location.hash.startsWith("#/")) return;

  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowDate() {
  return new Date().toISOString();
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "brand" | "success" | "warning" | "neutral" | "dark";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black",
        tone === "brand" && "border-wk-brand/30 bg-wk-brand-soft text-wk-brand",
        tone === "success" && "border-wk-success/30 bg-wk-success-soft text-wk-success",
        tone === "warning" && "border-wk-warning/30 bg-wk-warning-soft text-wk-warning",
        tone === "dark" && "border-wk-text bg-wk-text text-wk-bg",
        tone === "neutral" && "border-wk-border bg-wk-surface text-wk-text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Panel({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm", className)}>
      {eyebrow ? (
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-wk-brand">
          <span className="h-px w-7 bg-wk-brand" />
          {eyebrow}
        </div>
      ) : null}
      <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-wk-border/60 bg-wk-bg-subtle p-3">
      <div className="text-[13px] font-black text-wk-text">{title}</div>
      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{body}</p>
    </div>
  );
}

function InstituteWorkspaceOverlay({
  open,
  title,
  eyebrow,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black/45 backdrop-blur-sm">
      <div className="flex h-dvh min-h-0 items-stretch justify-center p-2 sm:p-4">
        <section className="flex h-full max-h-full w-full max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[28px] border border-wk-border bg-wk-bg shadow-2xl sm:max-w-[calc(100vw-2rem)] 2xl:max-w-[1600px]">
          <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-wk-border bg-wk-surface px-5 py-4">
            <div className="min-w-0">
              {eyebrow ? (
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">{eyebrow}</div>
              ) : null}
              <h2 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-wk-text">{title}</h2>
              {description ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-wk-text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-wk-border bg-wk-bg px-4 py-2 text-[12px] font-black text-wk-text-muted transition hover:border-wk-brand hover:text-wk-brand"
            >
              Close workspace
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto px-4 py-4 sm:px-5 sm:py-5">
            {children}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function useSupabaseInquiries() {
  const [inquiries, setInquiries] = useState<InquiryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInquiries = async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await listInstituteInquiries(defaultSetup);
      setInquiries(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Institute inquiries.";
      setError(message);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInquiries();
  }, []);

  const addInquiry = async (question: string, anchor: RegistryAnchor | null) => {
    const inquiry = await createInstituteInquiry(question, anchor, defaultSetup);
    setInquiries((current) => [inquiry, ...current.filter((item) => item.id !== inquiry.id)]);
    return inquiry;
  };

  const addEvidence = async (id: string, evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">) => {
    const saved = await createInstituteEvidenceItem(id, evidence);
    setInquiries((current) =>
      current.map((inquiry) =>
        inquiry.id === id
          ? {
              ...inquiry,
              evidence: [saved, ...(inquiry.evidence ?? [])],
              updatedAt: saved.updatedAt,
            }
          : inquiry,
      ),
    );
    return saved;
  };

  const updateInquiry = async (id: string, patch: Partial<InquiryDraft>) => {
    const existing = inquiries.find((inquiry) => inquiry.id === id) ?? null;
    const updatedAt = new Date().toISOString();
    const questionChanged =
      typeof patch.workingQuestion === "string" &&
      patch.workingQuestion.trim().length >= 8 &&
      patch.workingQuestion.trim() !== existing?.workingQuestion;

    setInquiries((current) =>
      current.map((inquiry) =>
        inquiry.id === id
          ? {
              ...inquiry,
              ...patch,
              updatedAt,
              versionCount: questionChanged ? inquiry.versionCount + 1 : inquiry.versionCount,
            }
          : inquiry,
      ),
    );

    try {
      await updateInstituteInquiry(id, patch, existing);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save Institute Inquiry.";
      setError(message);
      await loadInquiries();
    }
  };

  return { inquiries, loading, error, addInquiry, addEvidence, updateInquiry, reloadInquiries: loadInquiries };
}

function Rail({
  state,
  setState,
  drafts,
  active,
}: {
  state: InstituteState;
  setState: (patch: Partial<InstituteState>) => void;
  drafts: InquiryDraft[];
  active: InquiryDraft | null;
}) {
  const inquiryNav: Array<{ screen: InquiryScreen; label: string; badge?: string; disabled?: boolean }> = [
    { screen: "workbench", label: "Legacy setup" },
    { screen: "anchorBrief", label: "Anchor brief", badge: active?.anchorContextSnapshot ? "ready" : "none" },
    { screen: "evidence", label: "Legacy workspaces", badge: active?.evidence?.length ? String(active.evidence.length) : "0" },
    { screen: "claims", label: "Notes and findings", badge: active?.evidence?.filter((item) => item.metadata?.workspaceType === "claims").length ? String(active.evidence.filter((item) => item.metadata?.workspaceType === "claims").length) : "0" },
    { screen: "relationships", label: "Relationships" },
    { screen: "review", label: "Review", badge: "desk" },
    { screen: "summary", label: "Inquiry summary", disabled: true },
    { screen: "clinic", label: "Question & clinic", badge: active ? `v${active.versionCount}` : "" },
    { screen: "lineage", label: "Inquiry links", disabled: true },
    { screen: "memory", label: "Contributor memory", disabled: true },
    { screen: "corrections", label: "Corrections", disabled: true },
    { screen: "learned", label: "History" },
  ];

  return (
    <aside className="rounded-xl border border-wk-border/70 bg-wk-surface/70 p-3 shadow-none xl:sticky xl:top-5">
      <button
        type="button"
        onClick={() => setState({ screen: "home", activeId: null })}
        className="mb-4 flex w-full items-center justify-between rounded-xl border border-wk-border bg-wk-bg px-3 py-2 text-left text-[13px] font-black text-wk-text"
      >
        All Inquiries
        <span className="text-[11px] text-wk-text-faint">{drafts.length}</span>
      </button>

      <div className="mb-5 rounded-xl border border-wk-border bg-wk-bg p-4">
        {active ? (
          <>
            <div className="flex items-center gap-2">
              <Chip tone="brand">{active.code}</Chip>
              <Chip tone="warning">Production</Chip>
            </div>
            <p className="mt-3 line-clamp-3 text-[13px] font-bold leading-5 text-wk-text">{active.workingQuestion}</p>
            {active.anchor ? (
              <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">
                Anchor: {active.anchor.label}
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">No anchor attached yet.</p>
            )}
          </>
        ) : (
          <>
            <div className="text-[13px] font-black text-wk-text">No Active Inquiry</div>
            <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">Start with a question or continue an Inquiry.</p>
          </>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">This Inquiry</div>
          <div className="space-y-1">
            {inquiryNav.map((item) => (
              <button
                key={item.screen}
                type="button"
                disabled={item.disabled || !active}
                onClick={() => setState({ screen: item.screen })}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-bold transition",
                  state.screen === item.screen && active ? "bg-wk-brand text-wk-brand-on" : "text-wk-text-muted hover:bg-wk-bg hover:text-wk-text",
                  (item.disabled || !active) && "cursor-not-allowed opacity-45 hover:bg-transparent",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? <span className="text-[9px]">{item.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Reader Surface</div>
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-bold text-wk-text-muted opacity-45"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="flex-1">Public preview</span>
            <span className="text-[9px]">later</span>
          </button>
        </div>

        <div>
          <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-wk-text-faint">System</div>
          <button type="button" disabled className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-bold text-wk-text-muted opacity-45">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Learning board
          </button>
          <button type="button" disabled className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-bold text-wk-text-muted opacity-45">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            AI readiness
          </button>
        </div>
      </div>
    </aside>
  );
}

function HomeScreen({
  state,
  setState,
  anchors,
  anchorsLoading,
  anchorsError,
  drafts,
  createDraft,
  inquiriesLoading,
  inquiriesError,
}: {
  state: InstituteState;
  setState: (patch: Partial<InstituteState>) => void;
  anchors: RegistryAnchor[];
  anchorsLoading: boolean;
  anchorsError: string;
  drafts: InquiryDraft[];
  createDraft: () => void;
  inquiriesLoading: boolean;
  inquiriesError: string;
}) {
  const similarDrafts = useMemo(() => {
    const q = state.questionDraft.trim().toLowerCase();
    if (q.length < 10) return [];
    return drafts.filter((draft) => {
      const haystack = `${draft.rawQuestion} ${draft.workingQuestion}`.toLowerCase();
      return haystack.includes(q.slice(0, Math.min(q.length, 32)));
    });
  }, [drafts, state.questionDraft]);

  const canCreate =
    state.questionDraft.trim().length >= 8 &&
    (state.selectedAnchorCategory === "none" || Boolean(state.selectedAnchor));

  return (
    <div className="mx-auto max-w-[1000px] space-y-8">
      <Panel eyebrow="The Institute · A workspace for cultural thinking" title="What do you want to understand?">
        <p className="mb-4 text-[14px] leading-6 text-wk-text-muted">
          Name the doubt. We will help you turn it into a usable Inquiry. Nothing here is published.
        </p>

        <textarea
          value={state.questionDraft}
          onChange={(event) => setState({ questionDraft: event.target.value })}
          rows={2}
          placeholder="Start with a messy cultural question."
          className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg-subtle px-4 py-4 text-[16px] font-semibold leading-6 text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand"
        />

        <div className="mt-5 rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
            1 · Pick the main anchor category
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {anchorCategoryOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() =>
                  setState({
                    selectedAnchorCategory: option.key,
                    selectedAnchor: null,
                    anchorSearch: "",
                  })
                }
                className={cx(
                  "rounded-xl border px-4 py-3 text-left transition",
                  state.selectedAnchorCategory === option.key
                    ? "border-wk-brand bg-wk-brand-soft shadow-sm"
                    : "border-wk-border bg-wk-surface hover:border-wk-brand/40",
                )}
              >
                <div className="text-[13px] font-black text-wk-text">{option.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-wk-text-muted">{option.note}</div>
              </button>
            ))}
          </div>

          {state.selectedAnchorCategory && state.selectedAnchorCategory !== "none" ? (
            <div className="mt-5">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                2 · Search inside {state.selectedAnchorCategory}
              </div>

              <input
                value={state.anchorSearch}
                onChange={(event) => setState({ anchorSearch: event.target.value, selectedAnchor: null })}
                placeholder={`Search ${state.selectedAnchorCategory}s by name, title, artist, label, country, or context.`}
                className="mt-3 w-full rounded-xl border border-wk-border bg-wk-surface px-4 py-3 text-[14px] font-bold text-wk-text outline-none placeholder:text-wk-text-faint focus:border-wk-brand"
              />

              {anchorsLoading ? (
                <div className="mt-3"><Chip>Loading {state.selectedAnchorCategory}s</Chip></div>
              ) : null}
              {anchorsError ? (
                <div className="mt-3"><Chip tone="warning">Registry search unavailable</Chip></div>
              ) : null}

              {!anchorsLoading && !anchorsError && state.anchorSearch.trim().length < 2 ? (
                <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                  Type at least two characters to search. Individual records only appear after a category is chosen.
                </p>
              ) : null}

              {!anchorsLoading && !anchorsError && state.anchorSearch.trim().length >= 2 ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {anchors.length ? anchors.map((anchor) => (
                    <button
                      key={`${anchor.type}:${anchor.slug}`}
                      type="button"
                      onClick={() => setState({ selectedAnchor: anchor })}
                      className={cx(
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                        state.selectedAnchor?.type === anchor.type && state.selectedAnchor?.slug === anchor.slug
                          ? "border-wk-brand bg-wk-brand-soft shadow-sm"
                          : "border-wk-border bg-wk-surface hover:border-wk-brand/40",
                      )}
                    >
                      {anchor.imageUrl ? (
                        <img src={anchor.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-wk-brand-soft text-[10px] font-black uppercase text-wk-brand">
                          {anchor.type}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-[13px] font-black text-wk-text">{anchor.label}</span>
                        <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-wk-text-muted">{anchor.subtitle}</span>
                      </span>
                    </button>
                  )) : (
                    <EmptyState
                      title="No matching anchor found"
                      body="Try another spelling or choose No anchor."
                    />
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {state.selectedAnchorCategory === "none" ? (
            <div className="mt-5 rounded-lg border border-wk-border bg-wk-surface p-3">
              <div className="text-[13px] font-black text-wk-text">No anchor selected</div>
              <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                This Inquiry will start from the question alone. You can attach evidence and relationships later.
              </p>
            </div>
          ) : null}

          {state.selectedAnchor ? (
            <div className="mt-5 rounded-xl border border-wk-brand/30 bg-wk-brand-soft p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-brand">3 · Selected anchor</div>
              <div className="mt-3 flex gap-3">
                {state.selectedAnchor.imageUrl ? (
                  <img src={state.selectedAnchor.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-wk-surface text-[10px] font-black uppercase text-wk-brand">
                    {state.selectedAnchor.type}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="brand">{state.selectedAnchor.type}</Chip>
                    <span className="text-[14px] font-black text-wk-text">{state.selectedAnchor.label}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{state.selectedAnchor.subtitle}</p>
                  {state.selectedAnchor.contextText ? (
                    <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-wk-text-muted">{state.selectedAnchor.contextText}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setState({ selectedAnchor: null })}
                  className="self-start rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[11px] font-black text-wk-text-muted"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {similarDrafts.length ? (
          <div className="mt-5 rounded-xl border border-wk-warning/30 bg-wk-warning-soft p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-wk-warning">A similar Inquiry may already exist</div>
            <div className="mt-3 space-y-2">
              {similarDrafts.slice(0, 2).map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => setState({ activeId: draft.id, screen: "inquiry", section: "overview" })}
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-4 py-3 text-left"
                >
                  <div className="text-[11px] font-black text-wk-text-faint">{draft.code} · open it</div>
                  <div className="mt-1 text-[13px] font-bold leading-5 text-wk-text">{draft.workingQuestion}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canCreate}
            onClick={createDraft}
            className="rounded-lg bg-wk-brand px-6 py-3 text-[14px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create Inquiry
          </button>
          <span className="text-[12px] leading-5 text-wk-text-faint">
            Creates a production Inquiry and opens its workspace.
          </span>
        </div>
      </Panel>

      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-wk-brand">
          <span className="h-px w-7 bg-wk-brand" />
          Continue an Inquiry
        </div>
        <span className="text-[12px] font-semibold text-wk-text-faint">{drafts.length} production record(s)</span>
      </div>

      {drafts.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => setState({ activeId: draft.id, screen: "inquiry", section: "overview" })}
              className="rounded-2xl border border-wk-border bg-wk-surface p-5 text-left transition hover:border-wk-brand/40 hover:shadow-sm"
            >
              <div className="relative -m-5 mb-4 h-32 overflow-hidden rounded-t-2xl bg-wk-bg-subtle">
                {draft.featuredImageUrl ? (
                  <img
                    src={draft.featuredImageUrl}
                    alt={draft.featuredImageAlt || ""}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                    No featured image yet
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="dark">{draft.code}</Chip>
                    <Chip tone="warning">Production</Chip>
                    {draft.anchor ? <Chip tone="brand">{draft.anchor.label}</Chip> : null}
                  </div>
                </div>
              </div>
              <h3 className="text-[18px] font-black tracking-[-0.03em] text-wk-text">{draft.workingQuestion}</h3>
              <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                Updated {new Date(draft.updatedAt).toLocaleString()}
                {draft.featuredImageSource !== "Not set" ? ` · Image: ${draft.featuredImageSource}` : ""}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Inquiries yet"
          body="The Institute has no production Inquiries yet. Start with a question above."
        />
      )}
    </div>
  );
}

function ToggleButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-2 text-[12px] font-bold transition",
        selected ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40",
      )}
    >
      {children}
    </button>
  );
}

function OptionPill({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-2 text-[12px] font-black transition",
        selected
          ? "border-wk-brand bg-wk-brand-soft text-wk-brand shadow-sm"
          : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40 hover:text-wk-text",
      )}
    >
      {children}
    </button>
  );
}

function SelectableCard({
  selected,
  title,
  note,
  onClick,
}: {
  selected: boolean;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-xl border p-4 text-left transition min-h-[92px]",
        selected
          ? "border-wk-brand bg-wk-brand-soft shadow-sm"
          : "border-wk-border bg-wk-bg hover:border-wk-brand/40",
      )}
    >
      <div className="text-[13px] font-black text-wk-text">{title}</div>
      <div className="mt-1 text-[11px] leading-4 text-wk-text-muted">{note}</div>
    </button>
  );
}

function WorkbenchScreen({
  draft,
  updateDraft,
}: {
  draft: InquiryDraft | null;
  updateDraft: (patch: Partial<InquiryDraft>) => void;
}) {
  const [setup, setSetup] = useState<InquirySetup>(draft?.setup ?? defaultSetup);
  const [workingQuestion, setWorkingQuestion] = useState(draft?.workingQuestion ?? "");
  const [savedLabel, setSavedLabel] = useState("Not saved this session");

  useEffect(() => {
    setSetup({ ...defaultSetup, ...(draft?.setup ?? {}) });
    setWorkingQuestion(draft?.workingQuestion ?? "");
    setSavedLabel(draft ? `Saved ${new Date(draft.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not saved this session");
  }, [draft?.id, draft?.workingQuestion]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <Panel eyebrow="Workbench" title="No Active Inquiry">
          <EmptyState title="Nothing to configure yet" body="Create or select an Inquiry first." />
        </Panel>
      </div>
    );
  }

  const toggleListValue = (key: "outputs" | "formats" | "tools", value: string) => {
    setSetup((current) => {
      const exists = current[key].includes(value);
      return {
        ...current,
        [key]: exists ? current[key].filter((item) => item !== value) : [...current[key], value],
      };
    });
  };

  const saveSetup = () => {
    updateDraft({ setup, workingQuestion: workingQuestion.trim() || draft.workingQuestion });
    setSavedLabel(`Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
            Inquiry {draft.code.replace("Inquiry ", "")} · Workbench
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone="warning">Needs review</Chip>
            <Chip tone="success">{savedLabel}</Chip>
          </div>
        </div>

        <h1 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[38px]">
          Set up the inquiry
        </h1>
        <p className="mt-2 text-[14px] leading-6 text-wk-text-muted">
          
        </p>

        <div className="mt-5 rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Working question</div>
          <input
            value={workingQuestion}
            onChange={(event) => setWorkingQuestion(event.target.value)}
            className="mt-2 w-full rounded-lg border border-wk-border bg-wk-surface px-4 py-3 text-[18px] font-black leading-6 text-wk-text outline-none focus:border-wk-brand"
          />
          <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
            {draft.rawQuestion === workingQuestion ? "" : `Original question: ${draft.rawQuestion}`}
          </p>
        </div>
      </section>

      <Panel eyebrow="Featured Image" title="Image">
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="self-start overflow-hidden rounded-xl border border-wk-border bg-wk-bg-subtle">
            {draft.featuredImageUrl ? (
              <img
                src={draft.featuredImageUrl}
                alt={draft.featuredImageAlt || ""}
                className="h-40 w-full object-cover"
              />
            ) : (
              <div className="flex h-40 items-center justify-center px-4 text-center text-[11px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                No featured image yet
              </div>
            )}
          </div>

          <div className="space-y-3">
            {draft.anchor?.imageUrl ? (
              <button
                type="button"
                onClick={() =>
                  updateDraft({
                    featuredImageUrl: draft.anchor?.imageUrl ?? "",
                    featuredImageAlt: `${draft.anchor?.label ?? "Artist"} image`,
                    featuredImageCredit: "WAKILISHA",
                    featuredImageSource: "Registry anchor",
                  })
                }
                className="rounded-lg border border-wk-brand/30 bg-wk-brand-soft px-4 py-3 text-left text-[12px] font-black text-wk-text"
              >
                Use {draft.anchor.label} image
              </button>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Image URL</span>
              <input
                value={draft.featuredImageUrl}
                onChange={(event) =>
                  updateDraft({
                    featuredImageUrl: event.target.value,
                    featuredImageSource: event.target.value.trim() ? "Manual URL" : "Not set",
                  })
                }
                placeholder="https://..."
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Alt text</span>
              <input
                value={draft.featuredImageAlt}
                onChange={(event) => updateDraft({ featuredImageAlt: event.target.value })}
                placeholder="Describe the image for readers who cannot see it."
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Credit</span>
              <input
                value={draft.featuredImageCredit}
                onChange={(event) => updateDraft({ featuredImageCredit: event.target.value })}
                placeholder="Photographer, archive, or source credit"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
          </div>
        </div>
      </Panel>

      <section className="rounded-2xl border border-wk-brand/20 bg-wk-brand-soft p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">Setup</div>
            <h2 className="mt-1 text-[18px] font-black tracking-[-0.04em] text-wk-text">Suggest setup</h2>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              
            </p>
          </div>
          <button
            type="button"
            disabled
            className="rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on opacity-50"
          >
            Suggest Setup
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel eyebrow="1 · Inquiry Shape" title="Shape">
            <p className="mb-3 text-[12px] leading-5 text-wk-text-muted">Select one.</p>
            <div className="flex flex-wrap gap-2">
              {setupOptions.inquiryTypes.map((option) => (
                <OptionPill
                  key={option}
                  selected={setup.inquiryType === option}
                  onClick={() => setSetup((current) => ({ ...current, inquiryType: option }))}
                >
                  {option}
                </OptionPill>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="2 · Output Surfaces" title="Where will this live?">
            <p className="mb-3 text-[12px] leading-5 text-wk-text-muted">Select any that apply.</p>
            <div className="flex flex-wrap gap-2">
              {setupOptions.outputs.map((option) => (
                <OptionPill
                  key={option}
                  selected={setup.outputs.includes(option)}
                  onClick={() => toggleListValue("outputs", option)}
                >
                  {option}
                </OptionPill>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="3 · Evidence Formats" title="Materials">
            <p className="mb-3 text-[12px] leading-5 text-wk-text-muted">
              
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {setupOptions.formats.map((option) => {
                const selected = setup.formats.includes(option.label);
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => toggleListValue("formats", option.label)}
                    className={cx(
                      "rounded-xl border p-4 text-left transition min-h-[92px]",
                      selected
                        ? "border-wk-brand bg-wk-brand-soft shadow-sm"
                        : "border-wk-border bg-wk-bg hover:border-wk-brand/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[13px] font-black text-wk-text">{option.label}</div>
                      <span className={cx(
                        "rounded-full border px-2 py-0.5 text-[10px] font-black",
                        selected ? "border-wk-brand bg-wk-surface text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted",
                      )}>
                        {selected ? "On" : "Add"}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">{option.note}</p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel eyebrow="7 · Tools" title="Tools">
            <p className="mb-3 text-[12px] leading-5 text-wk-text-muted">Select any that apply.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {setupOptions.tools.map((tool) => (
                <SelectableCard
                  key={tool.label}
                  selected={setup.tools.includes(tool.label)}
                  title={tool.label}
                  note={tool.note}
                  onClick={() => toggleListValue("tools", tool.label)}
                />
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Panel eyebrow="4 · Scope" title="Scope">
            <div className="space-y-3">
              <input
                value={setup.scopeTimeRange}
                onChange={(event) => setSetup((current) => ({ ...current, scopeTimeRange: event.target.value }))}
                placeholder="Time range, if any"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
              <input
                value={setup.scopePlaceRoute}
                onChange={(event) => setSetup((current) => ({ ...current, scopePlaceRoute: event.target.value }))}
                placeholder="Place, route, scene, or geography"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
              <input
                value={setup.scopeLanguageRegister}
                onChange={(event) => setSetup((current) => ({ ...current, scopeLanguageRegister: event.target.value }))}
                placeholder="Language, slang, or register"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
              <textarea
                value={setup.scopeExclusion}
                onChange={(event) => setSetup((current) => ({ ...current, scopeExclusion: event.target.value }))}
                rows={4}
                placeholder="What this inquiry is not trying to answer"
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </div>
          </Panel>

          <Panel eyebrow="6 · Review" title="Care level">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Consent default</div>
                <div className="space-y-2">
                  {setupOptions.consentDefaults.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSetup((current) => ({ ...current, consentDefault: option }))}
                      className={cx(
                        "w-full rounded-lg border px-4 py-3 text-left text-[12px] font-black transition",
                        setup.consentDefault === option
                          ? "border-wk-brand bg-wk-brand-soft text-wk-text"
                          : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Review standard</div>
                <div className="space-y-2">
                  {setupOptions.reviewStandards.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSetup((current) => ({ ...current, reviewStandard: option }))}
                      className={cx(
                        "w-full rounded-lg border px-4 py-3 text-left text-[12px] font-black transition",
                        setup.reviewStandard === option
                          ? "border-wk-brand bg-wk-brand-soft text-wk-text"
                          : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Draft timer</div>
                <div className="grid grid-cols-2 gap-2">
                  {setupOptions.draftTimers.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSetup((current) => ({ ...current, draftTimer: option }))}
                      className={cx(
                        "rounded-lg border px-4 py-3 text-[12px] font-black transition",
                        setup.draftTimer === option
                          ? "border-wk-brand bg-wk-brand-soft text-wk-text"
                          : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
                  <span className="text-[11px] text-wk-text-muted">{savedLabel}</span>
                  <button type="button" onClick={saveSetup} className="rounded-md bg-wk-surface px-3 py-1.5 text-[11px] font-black text-wk-text">
                    Save Now
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <section className="rounded-2xl border border-wk-brand/20 bg-wk-brand-soft p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">Ready</div>
            <h2 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-wk-text">Next: Evidence</h2>
            <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
              
            </p>
            <button
              type="button"
              onClick={() => {
                saveSetup();
                window.location.hash = "";
                document.querySelector<HTMLButtonElement>('button[data-institute-screen="evidence"]')?.click();
              }}
              className="mt-4 w-full rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on"
            >
              Start evidence
            </button>
          </section>
        </div>
      </div>

      <InquiryAssistantPanel inquiryId={draft.id} workingQuestion={draft.workingQuestion} />
    </div>
  );
}

function BriefItemList({
  title,
  items,
  empty,
}: {
  title: string;
  items: AnchorContextItem[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-black text-wk-text">{title}</h3>
        <Chip>{items.length}</Chip>
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <article key={`${item.title}-${index}`} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
              <div className="text-[12px] font-black text-wk-text">{item.title}</div>
              <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{item.body}</p>
              {item.source ? (
                <div className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                  Source: {item.source}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing here yet" body={empty} />
      )}
    </div>
  );
}

function AnchorBriefScreen({ draft }: { draft: InquiryDraft | null }) {
  if (!draft) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <Panel eyebrow="Anchor Brief" title="No Active Inquiry">
          <EmptyState title="Nothing to brief yet" body="Create or select an Inquiry first." />
        </Panel>
      </div>
    );
  }

  if (!draft.anchor) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <Panel eyebrow={`${draft.code} · Anchor Brief`} title="No anchor attached">
          <EmptyState
            title="This inquiry has no anchor"
            body="Use Overview and Material to frame it manually. Anchor suggestions can come later."
          />
        </Panel>
      </div>
    );
  }

  const snapshot = draft.anchorContextSnapshot;

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
          {draft.code} · Anchor Brief
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-xl border border-wk-border bg-wk-bg-subtle">
            {draft.anchor.imageUrl ? (
              <img src={draft.anchor.imageUrl} alt="" className="h-44 w-full object-cover" />
            ) : (
              <div className="flex h-44 items-center justify-center text-[11px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                No image
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="brand">{draft.anchor.type}</Chip>
              {snapshot ? <Chip tone="success">Ready</Chip> : <Chip tone="warning">Not ready</Chip>}
            </div>

            <h1 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[40px]">
              {draft.anchor.label}
            </h1>

            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              {draft.anchor.contextText || draft.anchor.subtitle}
            </p>

            {snapshot ? (
              <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                Brief saved {new Date(snapshot.createdAt).toLocaleString()}.
              </p>
            ) : (
              <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                This inquiry has an anchor, but no brief yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {snapshot ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Knowns</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.knowns.length}</div>
            </div>
            <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Unknowns</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.unknowns.length}</div>
            </div>
            <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Evidence gaps</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.evidenceGaps.length}</div>
            </div>
            <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Relationship leads</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.relationshipLeads.length}</div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <BriefItemList title="What this anchor already gives us" items={snapshot.knowns} empty="Nothing saved yet." />
            <BriefItemList title="What is still unknown" items={snapshot.unknowns} empty="Nothing saved yet." />
            <BriefItemList title="Evidence gaps to fill" items={snapshot.evidenceGaps} empty="Nothing saved yet." />
            <BriefItemList title="Relationship leads" items={snapshot.relationshipLeads} empty="Nothing saved yet." />
          </div>

          {snapshot.thinDataNotes.length ? (
            <Panel eyebrow="Data Quality" title="Thin data notes">
              <BriefItemList title="Things to improve" items={snapshot.thinDataNotes} empty="Nothing saved yet." />
            </Panel>
          ) : null}
        </>
      ) : (
        <Panel title="No brief yet">
          <EmptyState
            title="Anchor exists, but no brief is saved yet."
            body="Older inquiries may need a backfill."
          />
        </Panel>
      )}
    </div>
  );
}

type FormatWorkspaceDefinition = {
  label: string;
  evidenceKind: EvidenceKind;
  deck: string;
  productionGoal: string;
  workspaceType: "article" | "interview" | "audio" | "video" | "photo" | "archive" | "data" | "registry" | "playlist" | "source" | "memory";
  required: string[];
  niceToHave: string[];
  reviewQuestions: string[];
};

const formatWorkspaceDefinitions: FormatWorkspaceDefinition[] = [
  {
    label: "Article",
    evidenceKind: "Article",
    workspaceType: "article",
    deck: "Write the actual draft inside the Inquiry. The editor should receive reviewable work, not loose notes.",
    productionGoal: "A private, review-ready article draft with structure, evidence spine, claims, source notes, and open risks.",
    required: ["Working headline", "Standfirst", "Article body", "Section outline", "Evidence spine", "Source list", "Claims to verify"],
    niceToHave: ["Pull quote candidates", "Registry cards to insert", "Image ideas", "Counter-argument section"],
    reviewQuestions: ["What is the central argument?", "Which claims are unsupported?", "What must not be overstated?"],
  },
  {
    label: "Interview",
    evidenceKind: "Interview",
    workspaceType: "interview",
    deck: "Produce the interview package: consent, transcript, quote candidates, claims made, and verification needs.",
    productionGoal: "A structured interview record that separates what was said, what it means, and what still needs proof.",
    required: ["Interviewee", "Relationship to Inquiry", "Consent status", "Recording or notes", "Transcript or summary", "Key excerpts"],
    niceToHave: ["Follow-up questions", "Quote approval notes", "Translation notes", "Names and places mentioned"],
    reviewQuestions: ["Can any quote be public?", "Which claims need another source?", "What is private-only?"],
  },
  {
    label: "Audio",
    evidenceKind: "Audio",
    workspaceType: "audio",
    deck: "Produce an audio evidence room with transcript notes, timestamps, speaker context, rights, and public-use limits.",
    productionGoal: "A reviewable audio package for oral history, voice notes, field recordings, or sound evidence.",
    required: ["Audio link or placeholder", "Speaker or source", "Runtime", "Consent status", "Timestamped notes", "Transcript needs"],
    niceToHave: ["Best quote", "Clip candidates", "Language notes", "Sound quality notes"],
    reviewQuestions: ["Who owns this audio?", "What can be quoted?", "Which sections are sensitive?"],
  },
  {
    label: "Video",
    evidenceKind: "Video",
    workspaceType: "video",
    deck: "Produce the video evidence package: scene notes, timestamps, people present, transcript/caption needs, rights, and consent.",
    productionGoal: "A reviewable visual record that can support article work, archive work, or future video production.",
    required: ["Video link or placeholder", "Runtime", "People shown", "Place/date", "Timestamped notes", "Rights status"],
    niceToHave: ["Clip candidates", "Caption notes", "Thumbnail candidate", "Sensitive content flags"],
    reviewQuestions: ["What does the video prove?", "What does it only suggest?", "Can any clip be public?"],
  },
  {
    label: "Photo",
    evidenceKind: "Photo",
    workspaceType: "photo",
    deck: "Produce visual evidence with caption, credit, place, people shown, rights, consent, and what the image proves.",
    productionGoal: "A reviewable image evidence package that can later support articles, archives, photo essays, or images.",
    required: ["Image URL or placeholder", "Caption", "Credit", "Date/place", "People shown", "Rights status"],
    niceToHave: ["Alt text", "Crop ideas", "Archive source", "Registry image candidate note"],
    reviewQuestions: ["Can we publish this image?", "Is the caption accurate?", "Is the date/place confirmed?"],
  },
  {
    label: "Archive document",
    evidenceKind: "Archive document",
    workspaceType: "archive",
    deck: "Catalog the document properly: collection, locator, excerpts, reliability, rights, and what it proves or does not prove.",
    productionGoal: "A reviewable archive record with enough structure to support articles, claims, corrections, or timelines.",
    required: ["Document title", "Document type", "Collection or source", "Locator", "Excerpt", "Reliability note"],
    niceToHave: ["OCR text", "Page references", "Access restrictions", "Timeline implications"],
    reviewQuestions: ["What does this document prove?", "What does it not prove?", "Does it conflict with another source?"],
  },
  {
    label: "Chart data",
    evidenceKind: "Chart data",
    workspaceType: "data",
    deck: "Produce a data evidence package with metric definition, source, date, interpretation, and limits.",
    productionGoal: "A data note that can support chart context, claims, or explainers.",
    required: ["Dataset or chart source", "Metric definition", "Date/edition", "Relevant values", "Interpretation note", "Limitations"],
    niceToHave: ["Comparison set", "Chart idea", "CSV/file link", "Method note"],
    reviewQuestions: ["What does the number mean?", "What should we not infer?", "Is the source consistent?"],
  },
  {
    label: "Playlist data",
    evidenceKind: "Personal note",
    workspaceType: "playlist",
    deck: "Create a private playlist draft linked to this Inquiry, with track candidates and provider IDs for later normalization.",
    productionGoal: "A reviewable playlist work product that can later become a public listening path.",
    required: ["Playlist title", "Curator label", "Track title", "Artist name", "Provider ID or URL", "Why the track belongs"],
    niceToHave: ["Registry track ID", "ISRC", "Artwork URL", "Preview URL", "Release title", "Normalization notes"],
    reviewQuestions: ["Does every track belong?", "Which items need registry matching?", "Is this ready for editor review?"],
  },
  {
    label: "WAKILISHA record",
    evidenceKind: "WAKILISHA record",
    workspaceType: "registry",
    deck: "Use existing WAKILISHA records as structured evidence, but mark what needs correction, enrichment, or second sourcing.",
    productionGoal: "A source-backed note that can support claims, relationships, articles, or corrections.",
    required: ["Record type", "Record link or slug", "Current value", "Proposed use", "Evidence gap", "Public impact"],
    niceToHave: ["Proposed correction", "Related records", "Merge risk", "Missing image/source note"],
    reviewQuestions: ["Is the record current?", "Is the record enough evidence?", "What must be verified elsewhere?"],
  },
  {
    label: "Link",
    evidenceKind: "Link",
    workspaceType: "source",
    deck: "Turn a link into usable evidence: source quality, access date, what it supports, and what still needs verification.",
    productionGoal: "A clean source note that can support a larger workspace without becoming the final work itself.",
    required: ["URL", "Source name", "Access date", "Summary", "Use in Inquiry", "Reliability note"],
    niceToHave: ["Archive URL", "Author", "Publisher", "Quote/excerpt"],
    reviewQuestions: ["Is this source credible?", "What exactly does it prove?", "Should we archive it?"],
  },
  {
    label: "Citation",
    evidenceKind: "Citation",
    workspaceType: "source",
    deck: "Capture exact citations, quotes, excerpts, timestamps, or page references with context and limits.",
    productionGoal: "A citation note that can be attached to article sections, claims, interviews, archives, or corrections.",
    required: ["Exact citation or quote", "Source", "Locator", "Context", "Allowed use", "Claim supported"],
    niceToHave: ["Translation note", "Paraphrase option", "Original language", "Sensitivity flag"],
    reviewQuestions: ["Is the quote exact?", "Is context preserved?", "Can this be public?"],
  },
  {
    label: "Personal note",
    evidenceKind: "Personal note",
    workspaceType: "memory",
    deck: "Capture memory carefully. Useful memory is not automatically verified fact.",
    productionGoal: "A contributor memory note that can become a lead, internal memory, or a future Inquiry fork.",
    required: ["Memory note", "Who remembers this", "Time/place", "Confidence", "What needs proof", "Public-use limit"],
    niceToHave: ["People to ask", "Related records", "Follow-up question", "Contradiction note"],
    reviewQuestions: ["Is this fact or memory?", "Who can verify it?", "Should this stay internal?"],
  },
];

function normalizeFormatLabel(format: string) {
  return format.trim().toLowerCase();
}

function workspaceDefinitionFor(format: string): FormatWorkspaceDefinition {
  const normalized = normalizeFormatLabel(format);
  return (
    formatWorkspaceDefinitions.find((definition) => normalizeFormatLabel(definition.label) === normalized) ??
    formatWorkspaceDefinitions.find((definition) => normalizeFormatLabel(definition.label).includes(normalized) || normalized.includes(normalizeFormatLabel(definition.label))) ??
    {
      label: format,
      evidenceKind: "Personal note",
      workspaceType: "memory",
      deck: "Produce the promised evidence format as reviewable work.",
      productionGoal: "A structured workspace checkpoint that explains what was produced and what still needs review.",
      required: ["Work produced", "Evidence used", "Open risks", "Review note"],
      niceToHave: ["Related entities", "Claims supported", "Source notes"],
      reviewQuestions: ["What is complete?", "What remains uncertain?", "What should an editor check first?"],
    }
  );
}

function workspaceMetadataText(item: EvidenceItem, key: string, fallback = "Not set") {
  const value = item.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function workspaceCompletion(item: EvidenceItem) {
  const value = item.metadata?.workspaceCompletion;
  if (typeof value === "number") return Math.max(0, Math.min(100, value));
  if (typeof value === "string") return Math.max(0, Math.min(100, Number(value) || 0));
  return 0;
}

function evidenceForFormat(evidence: EvidenceItem[], format: string) {
  return evidence.filter((item) => {
    const metadataFormat = workspaceMetadataText(item, "workspaceFormat", "");
    return normalizeFormatLabel(metadataFormat || item.kind) === normalizeFormatLabel(format);
  });
}

function CompletionBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-wk-bg-subtle">
      <div className="h-full rounded-full bg-wk-brand transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function WorkspaceChecklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-[12px] leading-5 text-wk-text-muted">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-wk-brand" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceMetric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">{label}</div>
      <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{value}</div>
      <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">{note}</p>
    </div>
  );
}

function MaterialSection({
  draft,
  addEvidence,
  reloadInquiries,
}: {
  draft: InquiryDraft | null;
  addEvidence: (
    inquiryId: string,
    evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">,
  ) => Promise<EvidenceItem>;
  reloadInquiries: () => Promise<void>;
}) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    kind: "Article" as EvidenceKind,
    source: "",
    sourceUrl: "",
    summary: "",
    whyItMatters: "",
  });

  if (!draft) {
    return (
      <Panel eyebrow="Material" title="Choose an Inquiry">
        <EmptyState
          title="No Inquiry selected"
          body="Return to Inquiries and choose the question you want to continue."
        />
      </Panel>
    );
  }

  const material = draft.evidence ?? [];
  const kinds = Array.from(new Set(material.map((item) => item.kind))).sort();
  const statuses = Array.from(new Set(material.map((item) => item.reviewState))).sort();

  const visibleMaterial = material.filter((item) => {
    const matchesType = typeFilter === "All" || item.kind === typeFilter;
    const matchesStatus = statusFilter === "All" || item.reviewState === statusFilter;
    return matchesType && matchesStatus;
  });

  const canSave =
    form.title.trim().length >= 3 &&
    form.summary.trim().length >= 8;

  const saveMaterial = async () => {
    if (!canSave || saving) return;

    setSaving(true);

    try {
      await addEvidence(draft.id, {
        title: form.title.trim(),
        kind: form.kind,
        source: form.source.trim(),
        sourceUrl: form.sourceUrl.trim(),
        summary: form.summary.trim(),
        whyItMatters: form.whyItMatters.trim(),
        mediaMinutes: 0,
        reviewState: "Draft",
        metadata: {
          savedFrom: "inquiry_material_section",
        },
      });

      setForm({
        title: "",
        kind: "Article",
        source: "",
        sourceUrl: "",
        summary: "",
        whyItMatters: "",
      });

      await reloadInquiries();
    } finally {
      setSaving(false);
    }
  };

  const statusTone = (status: ReviewState) => {
    if (
      status === "Accepted for internal memory" ||
      status === "Public-safe candidate"
    ) {
      return "success" as const;
    }

    if (
      status === "Needs review" ||
      status === "Needs more evidence" ||
      status === "Kept as doubt"
    ) {
      return "warning" as const;
    }

    return "neutral" as const;
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-wk-brand">
              Material
            </div>
            <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em] text-wk-text">
              Everything collected for this Inquiry.
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-wk-text-muted">
              Sources, notes, recordings, images, records, and other useful material belong here.
            </p>
          </div>

          <div className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
              Total material
            </div>
            <div className="mt-1 text-[24px] font-black text-wk-text">{material.length}</div>
          </div>
        </div>
      </section>

      <details className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">
                Add Material
              </div>
              <div className="mt-1 text-[18px] font-black text-wk-text">
                Save something useful
              </div>
            </div>
            <span className="rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on">
              Add Material
            </span>
          </div>
        </summary>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Title
              </span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Name this material"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Type
              </span>
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    kind: event.target.value as EvidenceKind,
                  }))
                }
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              >
                <option>Article</option>
                <option>Link</option>
                <option>Citation</option>
                <option>Audio</option>
                <option>Video</option>
                <option>Photo</option>
                <option>Interview</option>
                <option>Contributor memory</option>
                <option>Social post</option>
                <option>Chart data</option>
                <option>Playlist data</option>
                <option>Archive document</option>
                <option>WAKILISHA record</option>
                <option>Personal note</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Source
              </span>
              <input
                value={form.source}
                onChange={(event) =>
                  setForm((current) => ({ ...current, source: event.target.value }))
                }
                placeholder="Who or where this came from"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Link
              </span>
              <input
                value={form.sourceUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sourceUrl: event.target.value }))
                }
                placeholder="Optional URL"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
          </div>

          <label>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              Summary
            </span>
            <textarea
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
              rows={4}
              placeholder="What does this material contain?"
              className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
            />
          </label>

          <label>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              Why it matters
            </span>
            <textarea
              value={form.whyItMatters}
              onChange={(event) =>
                setForm((current) => ({ ...current, whyItMatters: event.target.value }))
              }
              rows={3}
              placeholder="How could this help the Inquiry?"
              className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
            />
          </label>

          <div>
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={() => void saveMaterial()}
              className="rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Material"}
            </button>
          </div>
        </div>
      </details>

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">
              Collected Material
            </div>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-wk-text">
              {visibleMaterial.length} item{visibleMaterial.length === 1 ? "" : "s"}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] font-bold text-wk-text"
            >
              <option>All</option>
              {kinds.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] font-bold text-wk-text"
            >
              <option>All</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {visibleMaterial.length ? (
          <div className="mt-5 space-y-3">
            {visibleMaterial.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-wk-border bg-wk-bg p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="brand">{item.kind}</Chip>
                      <Chip tone={statusTone(item.reviewState)}>{item.reviewState}</Chip>
                    </div>

                    <h3 className="mt-3 text-[17px] font-black tracking-[-0.03em] text-wk-text">
                      {item.title}
                    </h3>

                    {item.source ? (
                      <p className="mt-1 text-[11px] font-bold text-wk-text-faint">
                        Source: {item.source}
                      </p>
                    ) : null}

                    <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                      {item.summary || "No summary saved yet."}
                    </p>

                    <p className="mt-3 text-[11px] text-wk-text-faint">
                      Updated {new Date(item.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[11px] font-black text-wk-text"
                    >
                      Open Source
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              title={material.length ? "Nothing matches these filters" : "No material yet"}
              body={
                material.length
                  ? "Change the type or status filter."
                  : "Add the first useful source, note, recording, image, or record."
              }
            />
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">
              Review
            </div>
            <h2 className="mt-1 text-[18px] font-black text-wk-text">
              Check material more closely
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setReviewOpen((current) => !current)}
            className="rounded-lg border border-wk-border bg-wk-bg px-4 py-2 text-[12px] font-black text-wk-text"
          >
            {reviewOpen ? "Close Review" : "Review Material"}
          </button>
        </div>

        {reviewOpen ? (
          <div className="mt-5">
            <EvidenceReaderPanel
              draft={draft}
              onEvidenceChanged={reloadInquiries}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}


function workStatusLabel(status?: string | null) {
  if (!status) return "Draft";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function workStatusTone(
  status?: string | null,
): "success" | "warning" | "neutral" {
  if (
    status === "published" ||
    status === "approved" ||
    status === "approved_for_promotion"
  ) {
    return "success";
  }

  if (
    status === "submitted" ||
    status === "submitted_for_review" ||
    status === "under_review" ||
    status === "changes_requested"
  ) {
    return "warning";
  }

  return "neutral";
}

function WorkSection({ draft }: { draft: InquiryDraft | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articleLink, setArticleLink] =
    useState<InstituteArticleDraftLink | null>(null);
  const [playlistLink, setPlaylistLink] =
    useState<InstitutePlaylistDraftLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingArticle, setCreatingArticle] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadWork() {
      if (!draft?.id) {
        setArticleLink(null);
        setPlaylistLink(null);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [article, playlist] = await Promise.all([
          fetchInstituteArticleDraftLink(draft.id),
          fetchInstitutePlaylistDraftLink(draft.id),
        ]);

        if (!alive) return;

        setArticleLink(article);
        setPlaylistLink(playlist);
      } catch (nextError) {
        if (!alive) return;

        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load work for this Inquiry.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadWork();

    return () => {
      alive = false;
    };
  }, [draft?.id]);

  const openWorkspace = (workspace: "article" | "playlist") => {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("screen", "inquiry");
    nextParams.set("section", "work");
    nextParams.set("workspace", workspace);

    setSearchParams(nextParams, { replace: false });
  };

  const startArticle = async () => {
    if (!draft || creatingArticle) return;

    setCreatingArticle(true);
    setError("");

    try {
      const link = await createOrFetchInstituteArticleDraftLink(draft);
      setArticleLink(link);
      openWorkspace("article");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to start the article.",
      );
    } finally {
      setCreatingArticle(false);
    }
  };

  if (!draft) {
    return (
      <Panel eyebrow="Work" title="Choose an Inquiry">
        <EmptyState
          title="No Inquiry selected"
          body="Return to Inquiries and choose the question you want to continue."
        />
      </Panel>
    );
  }

  const workCount =
    Number(Boolean(articleLink)) + Number(Boolean(playlistLink));

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
          Work
        </div>

        <h2 className="mt-3 text-[30px] font-black tracking-[-0.055em] text-wk-text">
          Work made from this Inquiry
        </h2>

        <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
          Open the article, playlist, or other work that this Inquiry is
          producing.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Chip>{workCount} work item(s)</Chip>
          <Chip>{draft.code}</Chip>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] font-bold text-wk-text-muted">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Panel eyebrow="Work" title="Loading work">
          <p className="text-[13px] text-wk-text-muted">
            Checking what has already been started.
          </p>
        </Panel>
      ) : workCount ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {articleLink ? (
            <article className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="brand">Article</Chip>
                <Chip tone={workStatusTone(articleLink.status)}>
                  {workStatusLabel(articleLink.status)}
                </Chip>
              </div>

              <h3 className="mt-4 text-[19px] font-black leading-6 text-wk-text">
                {draft.workingQuestion || "Article draft"}
              </h3>

              <p className="mt-2 break-all text-[12px] leading-5 text-wk-text-muted">
                {articleLink.articleSlug}
              </p>

              <p className="mt-4 text-[11px] text-wk-text-faint">
                Updated{" "}
                {new Date(articleLink.updatedAt).toLocaleString()}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openWorkspace("article")}
                  className="rounded-lg bg-wk-text px-4 py-2.5 text-[12px] font-black text-wk-bg"
                >
                  Open
                </button>

                <button
                  type="button"
                  onClick={() => openWorkspace("article")}
                  className="rounded-lg border border-wk-border bg-wk-bg px-4 py-2.5 text-[12px] font-black text-wk-text"
                >
                  Preview
                </button>
              </div>
            </article>
          ) : null}

          {playlistLink ? (
            <article className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="brand">Playlist</Chip>
                <Chip tone={workStatusTone(playlistLink.status)}>
                  {workStatusLabel(playlistLink.status)}
                </Chip>
              </div>

              <h3 className="mt-4 text-[19px] font-black leading-6 text-wk-text">
                {playlistLink.playlistSlug || "Playlist draft"}
              </h3>

              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                A listening path connected to this Inquiry.
              </p>

              {playlistLink.updatedAt ? (
                <p className="mt-4 text-[11px] text-wk-text-faint">
                  Updated{" "}
                  {new Date(playlistLink.updatedAt).toLocaleString()}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openWorkspace("playlist")}
                  className="rounded-lg bg-wk-text px-4 py-2.5 text-[12px] font-black text-wk-bg"
                >
                  Open
                </button>

                <button
                  type="button"
                  onClick={() => openWorkspace("playlist")}
                  className="rounded-lg border border-wk-border bg-wk-bg px-4 py-2.5 text-[12px] font-black text-wk-text"
                >
                  Preview
                </button>
              </div>
            </article>
          ) : null}
        </div>
      ) : (
        <Panel eyebrow="Work" title="Nothing has been started yet">
          <EmptyState
            title="No work yet"
            body="Start an article or playlist when the Inquiry is ready to become something people can read or hear."
          />
        </Panel>
      )}

      <Panel eyebrow="Start something" title="What should this Inquiry become?">
        <div className="grid gap-3 md:grid-cols-2">
          {!articleLink ? (
            <button
              type="button"
              disabled={creatingArticle}
              onClick={() => void startArticle()}
              className="rounded-xl border border-wk-border bg-wk-bg p-5 text-left transition hover:border-wk-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="text-[14px] font-black text-wk-text">
                {creatingArticle ? "Starting Article..." : "Start Article"}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                Create a private article draft and open the editor.
              </p>
            </button>
          ) : null}

          {!playlistLink ? (
            <button
              type="button"
              onClick={() => openWorkspace("playlist")}
              className="rounded-xl border border-wk-border bg-wk-bg p-5 text-left transition hover:border-wk-brand"
            >
              <div className="text-[14px] font-black text-wk-text">
                Start Playlist
              </div>
              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                Add the first track and create a playlist draft.
              </p>
            </button>
          ) : null}

          {articleLink && playlistLink ? (
            <p className="text-[13px] leading-6 text-wk-text-muted">
              The currently supported work types have already been started.
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function EvidenceScreen({
  draft,
  addEvidence,
  updateDraft,
  focusedWorkspace,
  onCloseFocusedWorkspace,
}: {
  draft: InquiryDraft | null;
  addEvidence: (inquiryId: string, evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">) => Promise<EvidenceItem>;
  updateDraft: (patch: Partial<InquiryDraft>) => void;
  focusedWorkspace?: "article";
  onCloseFocusedWorkspace?: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeWorkspace = focusedWorkspace ?? searchParams.get("workspace");
  const articleWorkspaceOpen = activeWorkspace === "article";
  const registryWorkspaceOpen = activeWorkspace === "registry";
  const playlistWorkspaceOpen = activeWorkspace === "playlist";

  const openWorkspace = (workspace: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "evidence");
    nextParams.set("workspace", workspace);
    setSearchParams(nextParams, { replace: false });
  };

  const closeWorkspace = () => {
    if (onCloseFocusedWorkspace) {
      onCloseFocusedWorkspace();
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("workspace");
    setSearchParams(nextParams, { replace: false });
  };

  const openArticleWorkspace = () => {
    if (articleLink) {
      openWorkspace("article");
      return;
    }

    void ensureArticleDraft().then(() => openWorkspace("article"));
  };

  const openRegistryWorkspace = () => {
    setActiveFormat("WAKILISHA record");
    openWorkspace("registry");
  };

  const openPlaylistWorkspace = () => {
    setActiveFormat("Playlist data");
    openWorkspace("playlist");
  };

  const formats = draft?.setup.formats ?? [];
  const [activeFormat, setActiveFormat] = useState("");
  const [saving, setSaving] = useState(false);
  const [workspace, setWorkspace] = useState({
    title: "",
    producedWork: "",
    evidenceUsed: "",
    openRisks: "",
    editorCheck: "",
    completion: 25,
    status: "In progress",
  });
  const [articleLink, setArticleLink] = useState<InstituteArticleDraftLink | null>(null);
  const [articleLinkLoading, setArticleLinkLoading] = useState(false);
  const [articleLinkError, setArticleLinkError] = useState<string | null>(null);
  const [articleReviewState, setArticleReviewState] = useState<InstituteLinkedArticleReviewState | null>(null);
  const [articleReviewHistory, setArticleReviewHistory] = useState<InstituteLinkedArticleReviewState[]>([]);

  const activeDefinition = activeFormat ? workspaceDefinitionFor(activeFormat) : null;
  const isArticleWorkspace =
    focusedWorkspace === "article" ||
    activeDefinition?.workspaceType === "article";
  const canSubmitArticleForReview =
    !articleReviewState ||
    articleReviewState.status === "changes_requested" ||
    articleReviewState.status === "withdrawn";
  const articleReviewNotice =
    articleReviewState?.status === "submitted" || articleReviewState?.status === "under_review"
      ? "Already with editors. You can still save and preview."
      : articleReviewState?.status === "changes_requested"
        ? "Changes requested. Revise, then resubmit."
        : articleReviewState?.status === "approved_for_promotion" || articleReviewState?.status === "accepted_for_internal_memory"
          ? "Accepted. Editors control the next step."
          : articleReviewState?.status === "rejected"
            ? "Rejected. Start a new Inquiry to rebuild it."
            : "Draft, save, preview, then submit.";

  useEffect(() => {
    let alive = true;

    async function loadArticleLink() {
      if (!draft?.id || !isArticleWorkspace) {
        setArticleLink(null);
        setArticleLinkError(null);
        return;
      }

      setArticleLinkLoading(true);
      setArticleLinkError(null);

      try {
        const link = await fetchInstituteArticleDraftLink(draft.id);
        if (alive) setArticleLink(link);
      } catch (error) {
        if (alive) setArticleLinkError(error instanceof Error ? error.message : "Failed to load linked article draft.");
      } finally {
        if (alive) setArticleLinkLoading(false);
      }
    }

    void loadArticleLink();

    return () => {
      alive = false;
    };
  }, [draft?.id, isArticleWorkspace]);

  const ensureArticleDraft = async () => {
    if (!draft || articleLinkLoading) return;

    setArticleLinkLoading(true);
    setArticleLinkError(null);

    try {
      const link = await createOrFetchInstituteArticleDraftLink(draft);
      setArticleLink(link);
    } catch (error) {
      setArticleLinkError(error instanceof Error ? error.message : "Failed to create linked article draft.");
    } finally {
      setArticleLinkLoading(false);
    }
  };

  const submitLinkedArticleForReview = async (articlePayload: Parameters<typeof submitInstituteArticleDraftForReview>[2]) => {
    if (!draft || !articleLink) throw new Error("Article draft is not ready.");

    const submission = await submitInstituteArticleDraftForReview(draft, articleLink, articlePayload);
    setArticleReviewState(submission);
    setArticleReviewHistory((current) =>
      [...current.filter((item) => item.packetId !== submission.packetId), submission].sort(
        (first, second) => first.packetVersion - second.packetVersion,
      ),
    );
    setArticleLink((current) => (current ? { ...current, status: "submitted_for_review", updatedAt: submission.submittedAt } : current));
  };

  useEffect(() => {
    let alive = true;

    if (!draft || !articleLink) {
      setArticleReviewState(null);
      setArticleReviewHistory([]);
      return () => {
        alive = false;
      };
    }

    void Promise.all([
      fetchInstituteArticleReviewState(draft, articleLink),
      fetchInstituteArticleReviewHistory(draft, articleLink),
    ])
      .then(([reviewState, reviewHistory]) => {
        if (!alive) return;
        setArticleReviewState(reviewState);
        setArticleReviewHistory(reviewHistory);
      })
      .catch(() => {
        if (!alive) return;
        setArticleReviewState(null);
        setArticleReviewHistory([]);
      });

    return () => {
      alive = false;
    };
  }, [draft?.id, articleLink?.id, articleLink?.updatedAt]);

  useEffect(() => {
    if (!activeFormat && formats.length) setActiveFormat(formats[0]);
    if (activeFormat && formats.length && !formats.includes(activeFormat)) setActiveFormat(formats[0]);
  }, [activeFormat, formats]);

  useEffect(() => {
    setWorkspace({
      title: "",
      producedWork: "",
      evidenceUsed: "",
      openRisks: "",
      editorCheck: "",
      completion: 25,
      status: "In progress",
    });
  }, [activeFormat]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <Panel eyebrow="Evidence workspaces" title="No Active Inquiry">
          <EmptyState title="Nothing to produce yet" body="Create or select an Inquiry first." />
        </Panel>
      </div>
    );
  }

  const evidence = draft.evidence ?? [];
  const producedFormats = formats.filter((format) => evidenceForFormat(evidence, format).length > 0);
  const completedFormats = formats.filter((format) => {
    const items = evidenceForFormat(evidence, format);
    return items.some((item) => workspaceCompletion(item) >= 80);
  });
  const latestForActive = activeFormat ? evidenceForFormat(evidence, activeFormat)[0] : null;
  const activeCompletion = latestForActive ? workspaceCompletion(latestForActive) : 0;

  const canSave = Boolean(
    activeDefinition &&
    workspace.title.trim().length >= 3 &&
    workspace.producedWork.trim().length >= 8 &&
    workspace.evidenceUsed.trim().length >= 4,
  );

  const removeFormat = (format: string) => {
    const nextFormats = formats.filter((item) => item !== format);
    updateDraft({
      setup: {
        ...draft.setup,
        formats: nextFormats,
      },
    });

    if (activeFormat === format) {
      setActiveFormat(nextFormats[0] ?? "");
    }
  };

  const saveWorkspaceCheckpoint = async () => {
    if (!activeDefinition || !activeFormat || !canSave || saving) return;

    setSaving(true);
    try {
      await addEvidence(draft.id, {
        title: workspace.title.trim(),
        kind: activeDefinition.evidenceKind,
        source: `${activeFormat} workspace`,
        sourceUrl: "",
        summary: workspace.producedWork.trim(),
        whyItMatters: workspace.evidenceUsed.trim(),
        mediaMinutes: 0,
        reviewState: workspace.completion >= 80 ? "Needs review" : "Draft",
        metadata: {
          workspaceVersion: 1,
          workspaceFormat: activeFormat,
          workspaceType: activeDefinition.workspaceType,
          workspaceStatus: workspace.status,
          workspaceCompletion: workspace.completion,
          producedWork: workspace.producedWork.trim(),
          evidenceUsed: workspace.evidenceUsed.trim(),
          openRisks: workspace.openRisks.trim(),
          editorCheck: workspace.editorCheck.trim(),
          productionGoal: activeDefinition.productionGoal,
          savedFrom: "evidence_format_workspace",
        },
      });

      setWorkspace({
        title: "",
        producedWork: "",
        evidenceUsed: "",
        openRisks: "",
        editorCheck: "",
        completion: 25,
        status: "In progress",
      });
    } finally {
      setSaving(false);
    }
  };

  if (focusedWorkspace === "article") {
    return (
      <div className="mx-auto max-w-[1240px] space-y-4">
        <button
          type="button"
          onClick={closeWorkspace}
          className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text"
        >
          Back to Work
        </button>

        {articleLinkLoading ? (
          <Panel eyebrow="Article" title="Loading Article">
            <p className="text-[13px] text-wk-text-muted">
              Opening the linked article draft.
            </p>
          </Panel>
        ) : articleLinkError ? (
          <Panel eyebrow="Article" title="Article Could Not Open">
            <p className="text-[13px] text-wk-text-muted">
              {articleLinkError}
            </p>
          </Panel>
        ) : articleLink ? (
          <ArticleEditorWorkspace
            slug={articleLink.articleSlug}
            mode="institute"
            returnPath={`/admin/institute/inquiry-interface?screen=inquiry&section=work&inquiry=${draft.id}`}
            allowSubmitForReview={canSubmitArticleForReview}
            submitForReviewLabel={
              articleReviewState?.status === "changes_requested"
                ? "Resubmit for Review"
                : "Submit for Review"
            }
            instituteNotice={articleReviewNotice}
            onSubmittedForReview={submitLinkedArticleForReview}
          />
        ) : (
          <Panel eyebrow="Article" title="No Article Draft">
            <EmptyState
              title="The article draft is not ready"
              body="Return to Work and start the article again."
            />
          </Panel>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
              {draft.code} · Evidence workspaces
            </div>
            <h1 className="mt-3 max-w-4xl text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[42px]">
              Quick evidence capture.
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Capture evidence quickly here. Review and refine later.
            </p>
          </div>

          <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft p-4 text-left">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-warning">Editor-only publishing</div>
            <p className="mt-2 max-w-[280px] text-[12px] leading-5 text-wk-text-muted">
              Contributors produce workspaces. Editors review completed work later. No contributor gets a publish button.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Inquiry being produced</div>
          <p className="mt-2 text-[16px] font-black leading-6 text-wk-text">{draft.workingQuestion}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {draft.anchor ? <Chip tone="brand">{draft.anchor.label}</Chip> : <Chip tone="warning">No anchor</Chip>}
            <Chip>{formats.length} promised format(s)</Chip>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <EvidenceMetric label="Promised formats" value={formats.length} note="Chosen earlier. Use them as capture lanes." />
        <EvidenceMetric label="Started" value={producedFormats.length} note="At least one item has been saved." />
        <EvidenceMetric label="Near review" value={completedFormats.length} note="Ready for an editor to inspect." />
        <EvidenceMetric label="Evidence records" value={evidence.length} note="Saved evidence and source notes." />
      </div>

      {!formats.length ? (
        <Panel eyebrow="No formats selected" title="Return to the Inquiry first">
          <EmptyState
            title="No evidence to capture yet"
            body="Open the Inquiry and choose the material or work you want to continue."
          />
        </Panel>
      ) : (
        <>
          <Panel eyebrow="1 · Format queue" title="Formats promised for capture">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {formats.map((format) => {
                const definition = workspaceDefinitionFor(format);
                const items = evidenceForFormat(evidence, format);
                const latest = items[0];
                const completion = latest ? workspaceCompletion(latest) : 0;
                const selected = activeFormat === format;

                return (
                  <article
                    key={format}
                    className={cx(
                      "rounded-xl border p-4 transition",
                      selected ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-bg",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-black text-wk-text">{format}</div>
                        <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">{definition.deck}</p>
                      </div>
                      <Chip tone={completion >= 80 ? "success" : items.length ? "warning" : "neutral"}>
                        {completion >= 80 ? "Near review" : items.length ? "Started" : "Not started"}
                      </Chip>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                        <span>Capture state</span>
                        <span>{completion}%</span>
                      </div>
                      <CompletionBar value={completion} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFormat(format);
                          if (definition.workspaceType === "article") {
                            openArticleWorkspace();
                          } else if (definition.workspaceType === "registry") {
                            openRegistryWorkspace();
                          } else if (definition.workspaceType === "playlist") {
                            openPlaylistWorkspace();
                          }
                        }}
                        className="rounded-lg bg-wk-text px-4 py-2 text-[11px] font-black text-wk-bg"
                      >
                        Open workspace
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFormat(format)}
                        className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[11px] font-black text-wk-text-muted"
                      >
                        Remove format
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>

          {activeDefinition && activeDefinition.workspaceType === "article" ? (
            <section className="space-y-4 rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">Article workspace</div>
                  <h2 className="mt-2 text-[24px] font-black tracking-[-0.055em] text-wk-text">Write the article.</h2>
                  <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
                    Use the shared editor. Publishing is editor-only.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openArticleWorkspace}
                  disabled={articleLinkLoading}
                  className="rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {articleLinkLoading ? "Opening..." : articleLink ? "Open workspace" : "Create linked article draft"}
                </button>
              </div>

              {articleLinkError ? (
                <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft px-4 py-3 text-[12px] font-bold text-wk-danger">
                  {articleLinkError}
                </div>
              ) : null}

              {articleLink ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                    Linked draft: <strong className="text-wk-text">{articleLink.articleSlug}</strong>. Private draft.
                  </div>

                  {articleReviewState ? (
                    <div
                      className={cx(
                        "rounded-xl border px-4 py-3 text-[12px] leading-5",
                        articleReviewState.status === "changes_requested"
                          ? "border-wk-warning/30 bg-wk-warning-soft text-wk-text-muted"
                          : "border-wk-success/30 bg-wk-success-soft text-wk-text-muted",
                      )}
                    >
                      <strong className="text-wk-text">
                        {articleReviewState.status === "changes_requested" ? "Changes requested" : `Review packet v${articleReviewState.packetVersion}`}
                      </strong>
                      {" "}· {articleReviewState.status.replaceAll("_", " ")} · Submitted {new Date(articleReviewState.submittedAt).toLocaleString()}.
                      {articleReviewState.editorNotes ? (
                        <div className="mt-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-wk-text-muted">
                          <span className="font-black text-wk-text">Editor notes:</span> {articleReviewState.editorNotes}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {articleReviewHistory.length > 1 ? (
                    <div className="rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Review version history</div>
                      <div className="mt-3 space-y-2">
                        {articleReviewHistory.map((item) => (
                          <div key={item.packetId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text-muted">
                            <div>
                              <strong className="text-wk-text">v{item.packetVersion}</strong>
                              {" "}· {item.status.replaceAll("_", " ")}
                              {" "}· {new Date(item.submittedAt).toLocaleString()}
                            </div>
                            {item.editorNotes ? (
                              <span className="max-w-[420px] truncate text-wk-text-faint">Editor notes: {item.editorNotes}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-wk-border bg-wk-surface p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-black text-wk-text">Article workspace ready</div>
                        <p className="mt-1 text-[13px] leading-5 text-wk-text-muted">
                          Open the focused workspace to write, save, preview, and submit.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openWorkspace("article")}
                        className="rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on"
                      >
                        Open workspace
                      </button>
                    </div>
                  </div>

                  <InstituteWorkspaceOverlay
                    open={Boolean(articleLink && articleWorkspaceOpen)}
                    eyebrow="Work · Article"
                    title="Article workspace"
                    description="Write in focus. Close returns you to Work without losing the Inquiry."
                    onClose={closeWorkspace}
                  >
                    {articleLink ? (
                      <ArticleEditorWorkspace
                          slug={articleLink.articleSlug}
                        mode="institute"
                        returnPath="/admin/institute/inquiry-interface?screen=evidence"
                        allowSubmitForReview={canSubmitArticleForReview}
                        submitForReviewLabel={articleReviewState?.status === "changes_requested" ? "Resubmit for Review" : "Submit for Review"}
                        instituteNotice={articleReviewNotice}
                          onSubmittedForReview={submitLinkedArticleForReview}
                        />
                    ) : null}
                  </InstituteWorkspaceOverlay>
                </div>
              ) : (
                <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-5">
                  <h3 className="text-[16px] font-black text-wk-text">No linked article draft yet</h3>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                    Create one draft, then open the focused workspace.
                  </p>
                </div>
              )}
            </section>
          ) : null}


          {activeDefinition && activeDefinition.workspaceType === "registry" ? (
            <section className="space-y-4 rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">WAKILISHA record workspace</div>
                  <h2 className="mt-2 text-[24px] font-black tracking-[-0.055em] text-wk-text">Use the registry as structured evidence.</h2>
                  <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
                    Search real WAKILISHA records, preserve a snapshot, and flag missing or incorrect registry data for editor review.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openRegistryWorkspace}
                  className="rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on transition"
                >
                  Open workspace
                </button>
              </div>

              <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <div className="text-[13px] font-black text-wk-text">Registry evidence ready</div>
                <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                  This workspace uses live WAKILISHA records only. Missing records are saved as review suggestions, not created directly.
                </p>
              </div>

              <InstituteWorkspaceOverlay
                open={registryWorkspaceOpen}
                eyebrow="Material · WAKILISHA record"
                title="WAKILISHA record workspace"
                description="Use real WAKILISHA records as structured evidence. Suggest missing records or corrections without mutating the public registry."
                onClose={closeWorkspace}
              >
                <WakilishaRecordWorkspace draft={draft} addEvidence={addEvidence} />
              </InstituteWorkspaceOverlay>
            </section>
          ) : null}

          {activeDefinition && activeDefinition.workspaceType === "playlist" ? (
            <section className="space-y-4 rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">Playlist workspace</div>
                  <h2 className="mt-2 text-[24px] font-black tracking-[-0.055em] text-wk-text">Build a listening path.</h2>
                  <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
                    Create a private playlist draft from track candidates. Matching, public routes, and publishing come later.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openPlaylistWorkspace}
                  className="rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on transition"
                >
                  Open workspace
                </button>
              </div>

              <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                <div className="text-[13px] font-black text-wk-text">Playlist draft bridge ready</div>
                <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                  The workspace creates a private playlist work product and links it back to this Inquiry.
                </p>
              </div>

              <InstituteWorkspaceOverlay
                open={playlistWorkspaceOpen}
                eyebrow="Work · Playlist"
                title="Playlist workspace"
                description="Create a private playlist draft linked to this Inquiry. Editors control public use later."
                onClose={closeWorkspace}
              >
                <InstitutePlaylistWorkspace draft={draft} />
              </InstituteWorkspaceOverlay>
            </section>
          ) : null}

          {activeDefinition && activeDefinition.workspaceType !== "article" && activeDefinition.workspaceType !== "registry" && activeDefinition.workspaceType !== "playlist" ? (
            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel eyebrow="2 · Workspace standard" title={`${activeFormat} production room`}>
                <p className="text-[13px] leading-6 text-wk-text-muted">{activeDefinition.productionGoal}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <WorkspaceChecklist title="Required before review" items={activeDefinition.required} />
                  <WorkspaceChecklist title="Useful if available" items={activeDefinition.niceToHave} />
                </div>

                <div className="mt-3 rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Editor will ask</div>
                  <div className="mt-3 space-y-2">
                    {activeDefinition.reviewQuestions.map((question) => (
                      <div key={question} className="rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-bold text-wk-text-muted">
                        {question}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel eyebrow="3 · Produce work" title={`Save a ${activeFormat} checkpoint`}>
                {latestForActive ? (
                  <div className="mb-4 rounded-xl border border-wk-success/30 bg-wk-success-soft p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-success">Latest saved checkpoint</div>
                    <div className="mt-2 text-[15px] font-black text-wk-text">{latestForActive.title}</div>
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                      {activeCompletion}% complete · saved {new Date(latestForActive.createdAt).toLocaleString()}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Checkpoint title</span>
                    <input
                      value={workspace.title}
                      onChange={(event) => setWorkspace((current) => ({ ...current, title: event.target.value }))}
                      placeholder={`Name this ${activeFormat} checkpoint`}
                      className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Produced work</span>
                    <textarea
                      value={workspace.producedWork}
                      onChange={(event) => setWorkspace((current) => ({ ...current, producedWork: event.target.value }))}
                      rows={8}
                      placeholder="Do the actual work here. For article, draft the section. For interview, add transcript and excerpts. For video, add timestamped analysis."
                      className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Evidence used</span>
                    <textarea
                      value={workspace.evidenceUsed}
                      onChange={(event) => setWorkspace((current) => ({ ...current, evidenceUsed: event.target.value }))}
                      rows={4}
                      placeholder="What source, quote, timestamp, image, record, or document supports this work?"
                      className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Open risks</span>
                      <textarea
                        value={workspace.openRisks}
                        onChange={(event) => setWorkspace((current) => ({ ...current, openRisks: event.target.value }))}
                        rows={4}
                        placeholder="What is weak, risky, private, disputed, or not proven yet?"
                        className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                      />
                    </label>

                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">What should the editor check later?</span>
                      <textarea
                        value={workspace.editorCheck}
                        onChange={(event) => setWorkspace((current) => ({ ...current, editorCheck: event.target.value }))}
                        rows={4}
                        placeholder="This is not a briefing. It is a review pointer attached to completed work."
                        className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Workspace status</span>
                      <select
                        value={workspace.status}
                        onChange={(event) => setWorkspace((current) => ({ ...current, status: event.target.value }))}
                        className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                      >
                        <option>Not started</option>
                        <option>In progress</option>
                        <option>Blocked</option>
                        <option>Needs source</option>
                        <option>Ready for review</option>
                      </select>
                    </label>

                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Capture state</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={workspace.completion}
                        onChange={(event) => setWorkspace((current) => ({ ...current, completion: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }))}
                        className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={!canSave || saving}
                    onClick={() => void saveWorkspaceCheckpoint()}
                    className="rounded-lg bg-wk-brand px-6 py-3 text-[14px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Saving..." : "Save workspace checkpoint"}
                  </button>
                </div>
              </Panel>
            </div>
          ) : null}

          <Panel eyebrow="4 · Saved workspace checkpoints" title="What has been produced so far?">
            {evidence.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {evidence.map((item) => (
                  <article key={item.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="brand">{workspaceMetadataText(item, "workspaceFormat", item.kind)}</Chip>
                      <Chip tone={item.reviewState === "Needs review" ? "warning" : "neutral"}>{item.reviewState}</Chip>
                      <Chip>{workspaceCompletion(item)}%</Chip>
                    </div>
                    <h3 className="mt-3 text-[17px] font-black tracking-[-0.03em] text-wk-text">{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">{item.summary}</p>
                    {workspaceMetadataText(item, "openRisks", "") ? (
                      <div className="mt-3 rounded-lg border border-wk-warning/30 bg-wk-warning-soft px-3 py-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-warning">Open risks</div>
                        <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{workspaceMetadataText(item, "openRisks", "")}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No workspace checkpoints yet"
                body="Open a promised format and save the first piece of produced work."
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function ReviewDeskScreen() {
  const [packets, setPackets] = useState<InstituteReviewPacket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorNotes, setEditorNotes] = useState("");
  const [articleEditorOpen, setArticleEditorOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState<"all" | "published" | InstituteReviewPacketStatus>("all");
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<InstituteReviewPacketStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPackets = async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchInstituteReviewPackets();
      setPackets(rows);
      setActiveId((current) => current ?? rows[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPackets();
  }, []);

  const filteredPackets = useMemo(
    () =>
      queueFilter === "all"
        ? packets
        : queueFilter === "published"
          ? packets.filter((packet) => packet.liveWorkProductStatus === "published")
          : packets.filter((packet) => packet.status === queueFilter && packet.liveWorkProductStatus !== "published"),
    [packets, queueFilter],
  );

  const activePacket = filteredPackets.find((packet) => packet.id === activeId) ?? filteredPackets[0] ?? packets[0] ?? null;
  const snapshot = activePacket?.snapshot;
  const inquiry = snapshot?.inquiry;
  const article = snapshot?.articleDraft;
  const playlist = snapshot?.playlistDraft;
  const workProduct = snapshot?.workProduct;
  const articleAdminUrl = article?.slug ? `/admin/content/articles/${article.slug}` : null;
  const isPublishedWork = activePacket?.liveWorkProductStatus === "published";
  const isApprovedHandoff = activePacket?.status === "approved_for_promotion" && !isPublishedWork;
  const liveArticleUrl = article?.slug ? `/magazine/${article.slug}` : null;

  const packetVersionHistory = useMemo(() => {
    if (!activePacket) return [];

    const activeLinkId = activePacket.snapshot?.workProduct?.linkId;
    const activeSlug = activePacket.snapshot?.workProduct?.productSlug ?? activePacket.snapshot?.articleDraft?.slug;

    return packets
      .filter((packet) => {
        const packetLinkId = packet.snapshot?.workProduct?.linkId;
        const packetSlug = packet.snapshot?.workProduct?.productSlug ?? packet.snapshot?.articleDraft?.slug;

        return Boolean(
          (activeLinkId && packetLinkId === activeLinkId) ||
            (activeSlug && packetSlug === activeSlug),
        );
      })
      .sort((first, second) => first.packetVersion - second.packetVersion);
  }, [activePacket, packets]);

  useEffect(() => {
    setEditorNotes(activePacket?.editorNotes ?? "");
    setArticleEditorOpen(false);
  }, [activePacket?.id]);

  const updateStatus = async (status: InstituteReviewPacketStatus) => {
    if (!activePacket || savingStatus) return;

    setSavingStatus(status);
    setError(null);

    try {
      const updated = await updateInstituteReviewPacketDecision(activePacket, status, editorNotes);
      setPackets((current) => current.map((packet) => (packet.id === updated.id ? updated : packet)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update review.");
    } finally {
      setSavingStatus(null);
    }
  };

  const counts = {
    submitted: packets.filter((packet) => packet.status === "submitted").length,
    underReview: packets.filter((packet) => packet.status === "under_review").length,
    changesRequested: packets.filter((packet) => packet.status === "changes_requested").length,
    approved: packets.filter((packet) => packet.status === "approved_for_promotion" && packet.liveWorkProductStatus !== "published").length,
    published: packets.filter((packet) => packet.liveWorkProductStatus === "published").length,
    rejected: packets.filter((packet) => packet.status === "rejected").length,
  };

  const actionClass =
    "rounded-md border border-wk-border/70 bg-wk-surface/70 px-3 py-2 text-[12px] font-black text-wk-text transition hover:border-wk-brand hover:text-wk-brand disabled:cursor-not-allowed disabled:opacity-50";

  const queueTabs: Array<{ key: "all" | "published" | InstituteReviewPacketStatus; label: string; count: number }> = [
    { key: "all", label: "All", count: packets.length },
    { key: "submitted", label: "Submitted", count: counts.submitted },
    { key: "under_review", label: "Under review", count: counts.underReview },
    { key: "changes_requested", label: "Changes requested", count: counts.changesRequested },
    { key: "approved_for_promotion", label: "Approved handoff", count: counts.approved },
    { key: "published", label: "Published", count: counts.published },
    { key: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="mx-auto max-w-[1240px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">Institute Review Desk</div>
            <h1 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[42px]">
              Review work.
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Accept, reject, or send work back. Nothing publishes here.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadPackets()}
            className="rounded-lg border border-wk-border bg-wk-bg px-4 py-2 text-[12px] font-black text-wk-text"
          >
            Refresh queue
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <EvidenceMetric label="Submitted" value={counts.submitted} note="Waiting for editor action." />
          <EvidenceMetric label="Under review" value={counts.underReview} note="An editor has picked these up." />
          <EvidenceMetric label="Changes requested" value={counts.changesRequested} note="Contributor needs to revise." />
          <EvidenceMetric label="Approved" value={counts.approved} note="Ready for the next editorial step." />
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft px-4 py-3 text-[12px] font-bold text-wk-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Panel eyebrow="Review" title="Loading reviews">
          <EmptyState title="Loading Review Desk" body="Fetching submitted work." />
        </Panel>
      ) : !packets.length ? (
        <Panel eyebrow="Review" title="Nothing waiting">
          <EmptyState title="Nothing submitted yet" body="Submitted article drafts will appear here." />
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <Panel eyebrow="Queue" title={`${filteredPackets.length} of ${packets.length} submission(s)`}>
            <div className="mb-4 flex flex-wrap gap-2">
              {queueTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setQueueFilter(tab.key);
                    const nextPacket = tab.key === "all" ? packets[0] : packets.find((packet) => packet.status === tab.key);
                    setActiveId(nextPacket?.id ?? null);
                  }}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-[11px] font-black transition",
                    queueFilter === tab.key
                      ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                      : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40",
                  )}
                >
                  {tab.label} · {tab.count}
                </button>
              ))}
            </div>

            {!filteredPackets.length ? (
              <EmptyState title="Nothing in this queue" body="Change the filter or wait for more work." />
            ) : (
              <div className="space-y-3">
                {filteredPackets.map((packet) => {
                const packetArticle = packet.snapshot?.articleDraft;
                const packetPlaylist = packet.snapshot?.playlistDraft;
                const packetInquiry = packet.snapshot?.inquiry;
                const packetWorkProduct = packet.snapshot?.workProduct;
                const selected = activePacket?.id === packet.id;
                const packetTitle =
                  packetArticle?.title ||
                  packetPlaylist?.title ||
                  packetWorkProduct?.productSlug ||
                  "Untitled submission";

                return (
                  <button
                    key={packet.id}
                    type="button"
                    onClick={() => setActiveId(packet.id)}
                    className={cx(
                      "block w-full rounded-xl border p-4 text-left transition",
                      selected ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-surface hover:border-wk-brand/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                        {packetInquiry?.code ?? "Inquiry"} · v{packet.packetVersion}
                      </div>
                      <Chip tone={packet.liveWorkProductStatus === "published" ? "success" : packet.status === "submitted" ? "warning" : packet.status === "approved_for_promotion" ? "success" : "neutral"}>
                        {(packet.liveWorkProductStatus === "published" ? "published" : packet.status).replaceAll("_", " ")}
                      </Chip>
                    </div>
                    <div className="mt-2 text-[15px] font-black text-wk-text">{packetTitle}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Chip>{packetWorkProduct?.formatLabel ?? (packetPlaylist ? "Playlist" : "Article")}</Chip>
                      {packetPlaylist?.itemCount ? <Chip>{packetPlaylist.itemCount} item{packetPlaylist.itemCount === 1 ? "" : "s"}</Chip> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-wk-text-muted">
                      {packetInquiry?.workingQuestion || packetInquiry?.rawQuestion || "No question saved."}
                    </p>
                    <div className="mt-3 text-[11px] text-wk-text-faint">
                      Submitted {new Date(packet.submittedAt).toLocaleString()}
                    </div>
                  </button>
                );
                })}
              </div>
            )}
          </Panel>

          <div className="space-y-5">
            <Panel eyebrow="Submission" title={article?.title || playlist?.title || "Selected review"}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Inquiry</div>
                  <div className="mt-2 text-[15px] font-black text-wk-text">{inquiry?.code ?? "Unknown Inquiry"}</div>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                    {inquiry?.workingQuestion || inquiry?.rawQuestion || "No question captured."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inquiry?.anchor?.label ? <Chip tone="brand">{inquiry.anchor.label}</Chip> : <Chip tone="warning">No anchor</Chip>}
                    <Chip>{workProduct?.formatLabel ?? "Article"}</Chip>
                  </div>
                </div>

                <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                    {playlist ? "Playlist draft" : "Article draft"}
                  </div>
                  <div className="mt-2 text-[15px] font-black text-wk-text">
                    {playlist?.slug ?? article?.slug ?? workProduct?.productSlug ?? "No work product slug"}
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                    {playlist?.description || article?.excerpt || "No summary saved."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip tone="warning">{playlist?.status ?? article?.wpStatus ?? "pending"}</Chip>
                    <Chip>{playlist ? `${playlist.itemCount ?? playlist.items?.length ?? 0} playlist item(s)` : "Private draft"}</Chip>
                    {playlist?.curatorLabel ? <Chip>{playlist.curatorLabel}</Chip> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Contributor note</div>
                <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                  {activePacket?.contributorNote || "No contributor note captured."}
                </p>
              </div>

              {article ? (
                <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Article preview</div>
                  <div
                    className="prose prose-sm mt-3 max-h-[360px] overflow-auto text-wk-text"
                    dangerouslySetInnerHTML={{ __html: article.contentHtml || "<p>No article body saved.</p>" }}
                  />
                </div>
              ) : null}

              {playlist ? (
                <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Playlist preview</div>
                  {playlist.items?.length ? (
                    <div className="mt-3 space-y-3">
                      {playlist.items.map((item) => (
                        <article key={item.id ?? `${item.position}-${item.title}`} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-[13px] font-black text-wk-text">
                                {item.position ? `${item.position}. ` : null}{item.title || item.providerTrackId || "Untitled playlist item"}
                              </div>
                              <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                                {item.artistNames?.filter(Boolean).join(", ") || "Unknown artist"}
                              </p>
                            </div>
                            <Chip>{item.matchStatus?.replaceAll("_", " ") ?? "pending"}</Chip>
                          </div>

                          <div className="mt-3 grid gap-2 text-[11px] leading-5 text-wk-text-muted md:grid-cols-2">
                            {item.providerKey ? <div><strong className="text-wk-text">Provider:</strong> {item.providerKey}</div> : null}
                            {item.providerTrackId ? <div><strong className="text-wk-text">Provider ID:</strong> {item.providerTrackId}</div> : null}
                            {item.providerUrl ? <div className="md:col-span-2"><strong className="text-wk-text">URL:</strong> {item.providerUrl}</div> : null}
                            {item.notes ? <div className="md:col-span-2"><strong className="text-wk-text">Notes:</strong> {item.notes}</div> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No playlist items in snapshot" body="The submitted packet did not include item details." />
                  )}
                </div>
              ) : null}
            </Panel>

            {packetVersionHistory.length > 1 ? (
              <Panel eyebrow="Version history" title={`${packetVersionHistory.length} review submissions`}>
                <div className="space-y-3">
                  {packetVersionHistory.map((packet) => (
                    <div
                      key={packet.id}
                      className={cx(
                        "rounded-xl border p-4",
                        packet.id === activePacket?.id ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-surface",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[13px] font-black text-wk-text">v{packet.packetVersion}</div>
                        <Chip tone={packet.liveWorkProductStatus === "published" ? "success" : packet.status === "changes_requested" ? "warning" : packet.status === "rejected" ? "danger" : "neutral"}>
                          {(packet.liveWorkProductStatus === "published" ? "published" : packet.status).replaceAll("_", " ")}
                        </Chip>
                      </div>
                      <div className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                        Submitted {new Date(packet.submittedAt).toLocaleString()}
                        {packet.reviewedAt ? ` · Reviewed ${new Date(packet.reviewedAt).toLocaleString()}` : ""}
                      </div>
                      {packet.editorNotes ? (
                        <div className="mt-3 rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[12px] leading-5 text-wk-text-muted">
                          <span className="font-black text-wk-text">Editor notes:</span> {packet.editorNotes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            {isPublishedWork ? (
              <Panel eyebrow="Published" title="This Institute work is live">
                <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  Published from the article editor.
                </div>

                {liveArticleUrl ? (
                  <a
                    href={liveArticleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on"
                  >
                    Open live article
                  </a>
                ) : null}

                <div className="mt-4 rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[12px] leading-5 text-wk-text-muted">
                  Synced from the article editor.
                </div>
              </Panel>
            ) : null}

            {isApprovedHandoff ? (
              <Panel eyebrow="Editorial handoff" title="Ready for final editorial pass">
                <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  Approved for final editorial pass.
                </div>

                {articleAdminUrl ? (
                  <a
                    href={articleAdminUrl}
                    className="mt-4 inline-flex rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on"
                  >
                    Open article editor
                  </a>
                ) : (
                  <div className="mt-4 rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] font-bold text-wk-warning">
                    No linked article found.
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[12px] leading-5 text-wk-text-muted">
                  Publish only from the article editor.
                </div>
              </Panel>
            ) : null}

            {article?.slug ? (
              <Panel eyebrow="Linked article editor" title="Review the draft">
                <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  Edit, save, preview, then decide below.
                </div>

                <button
                  type="button"
                  onClick={() => setArticleEditorOpen((current) => !current)}
                  className="mt-4 rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on"
                >
                  {articleEditorOpen ? "Close article editor" : "Open article editor"}
                </button>

                {articleEditorOpen ? (
                  <div className="mt-5 rounded-[22px] border border-wk-border bg-wk-surface p-4 shadow-sm">
                    <ArticleEditorWorkspace
                      slug={article.slug}
                      mode="institute"
                      returnPath="/admin/institute/inquiry-interface"
                      allowSubmitForReview={false}
                      instituteNotice="Institute editor review mode. Save Draft and Preview are available. Review decisions happen in the Review Desk. Publishing remains locked."
                    />
                  </div>
                ) : null}
              </Panel>
            ) : null}

            <Panel eyebrow="Editor decision" title="Decision">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Editor notes</span>
                <textarea
                  value={editorNotes}
                  onChange={(event) => setEditorNotes(event.target.value)}
                  rows={6}
                  placeholder="What should happen next? What needs revision? What is approved?"
                  className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(savingStatus)} onClick={() => void updateStatus("under_review")} className={actionClass}>
                  Start review
                </button>
                <button type="button" disabled={Boolean(savingStatus)} onClick={() => void updateStatus("changes_requested")} className={actionClass}>
                  Request changes
                </button>
                <button type="button" disabled={Boolean(savingStatus)} onClick={() => void updateStatus("approved_for_promotion")} className={actionClass}>
                  Approve
                </button>
                <button type="button" disabled={Boolean(savingStatus)} onClick={() => void updateStatus("accepted_for_internal_memory")} className={actionClass}>
                  Keep internally
                </button>
                <button type="button" disabled={Boolean(savingStatus)} onClick={() => void updateStatus("rejected")} className={actionClass}>
                  Reject
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                Approval moves the work to the next editorial step.
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function InquiryShell({
  draft,
  section,
  setSection,
  addEvidence,
  updateDraft,
  reloadInquiries,
}: {
  draft: InquiryDraft | null;
  section: InquirySection;
  setSection: (section: InquirySection) => void;
  addEvidence: (inquiryId: string, evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">) => Promise<EvidenceItem>;
  updateDraft: (patch: Partial<InquiryDraft>) => void;
  reloadInquiries: () => Promise<void>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeWorkWorkspace = searchParams.get("workspace");

  const closeFocusedWork = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("workspace");
    nextParams.set("screen", "inquiry");
    nextParams.set("section", "work");
    setSearchParams(nextParams, { replace: false });
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-inquiry-section="${section}"]`,
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [section]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <Panel eyebrow="Inquiry" title="Choose an Inquiry">
          <EmptyState
            title="No Inquiry selected"
            body="Return to Inquiries and choose the question you want to continue."
          />
        </Panel>
      </div>
    );
  }

  const sections: Array<{ key: InquirySection; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "material", label: "Material" },
    { key: "notes", label: "Notes and findings" },
    { key: "work", label: "Work" },
    { key: "history", label: "History" },
  ];

  const isProceduralSnapshotItem = (title: string) => {
    const normalized = title.trim().toLowerCase();

    return (
      normalized.startsWith("anchor type") ||
      normalized.startsWith("anchor label") ||
      normalized.startsWith("anchor context") ||
      normalized.startsWith("anchor metadata") ||
      normalized === "evidence has not been reviewed yet" ||
      normalized === "claims are not settled" ||
      normalized === "primary sources" ||
      normalized === "relationship evidence"
    );
  };

  const usefulKnowns =
    draft.anchorContextSnapshot?.knowns.filter(
      (item) => !isProceduralSnapshotItem(item.title),
    ) ?? [];

  const usefulUnknowns =
    draft.anchorContextSnapshot?.unknowns.filter(
      (item) => !isProceduralSnapshotItem(item.title),
    ) ?? [];

  const usefulNextSteps =
    draft.anchorContextSnapshot?.evidenceGaps.filter(
      (item) => !isProceduralSnapshotItem(item.title),
    ) ?? [];

  const establishedMaterial = draft.evidence.filter(
    (item) =>
      item.reviewState === "Accepted for internal memory" ||
      item.reviewState === "Public-safe candidate",
  );

  const uncertainMaterial = draft.evidence.filter(
    (item) =>
      item.reviewState === "Needs more evidence" ||
      item.reviewState === "Kept as doubt",
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <header className="min-w-0 overflow-hidden rounded-2xl border border-wk-border bg-wk-surface px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="brand">{draft.code}</Chip>
          <Chip>{draft.status}</Chip>
        </div>

        <h1 className="mt-4 max-w-[900px] break-words text-[22px] font-black leading-[1.12] tracking-[-0.035em] text-wk-text sm:text-[30px] sm:leading-tight">
          {draft.workingQuestion}
        </h1>

        {draft.anchor ? (
          <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
            Anchored to {draft.anchor.label}
          </p>
        ) : null}

        <nav
          className="-mx-4 mt-5 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-5 sm:px-5"
          aria-label="Inquiry sections"
        >
          {sections.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              data-inquiry-section={item.key}
              className={cx(
                "shrink-0 snap-center whitespace-nowrap rounded-lg border px-3 py-2 text-[12px] font-black transition",
                section === item.key
                  ? "border-wk-brand bg-wk-brand text-wk-brand-on"
                  : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40 hover:text-wk-text",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {section === "overview" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel eyebrow="Question" title="What are we trying to understand?">
            <p className="text-[14px] leading-6 text-wk-text">{draft.workingQuestion}</p>

            {draft.rawQuestion !== draft.workingQuestion ? (
              <details className="mt-5 rounded-xl border border-wk-border bg-wk-bg px-4 py-3">
                <summary className="cursor-pointer text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                  See the original question
                </summary>
                <p className="mt-3 text-[13px] leading-5 text-wk-text-muted">{draft.rawQuestion}</p>
              </details>
            ) : null}
          </Panel>

          <Panel eyebrow="Current state" title="Where does this Inquiry stand?">
            <dl className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-wk-text-muted">Material collected</dt>
                <dd className="font-black text-wk-text">{draft.evidence.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-wk-text-muted">Question versions</dt>
                <dd className="font-black text-wk-text">{draft.versionCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-wk-text-muted">Main subject</dt>
                <dd className="text-right font-black text-wk-text">{draft.anchor?.label ?? "None yet"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-wk-text-muted">Last updated</dt>
                <dd className="font-black text-wk-text">
                  {new Date(draft.updatedAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel eyebrow="Current understanding" title="What do we know so far?">
            {usefulKnowns.length ? (
              <div className="space-y-3">
                {usefulKnowns.slice(0, 4).map((item) => (
                  <div key={`${item.title}:${item.body}`} className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3">
                    <div className="text-[13px] font-black text-wk-text">{item.title}</div>
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{item.body}</p>
                  </div>
                ))}
              </div>
            ) : establishedMaterial.length ? (
              <div className="space-y-3">
                {establishedMaterial.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3">
                    <div className="text-[13px] font-black text-wk-text">{item.title}</div>
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                      {item.summary || item.whyItMatters || "Material saved for this Inquiry."}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing established yet"
                body="Add material before deciding what this Inquiry knows."
              />
            )}
          </Panel>

          <Panel eyebrow="Open questions" title="What is still unclear?">
            {usefulUnknowns.length ? (
              <div className="space-y-3">
                {usefulUnknowns.slice(0, 4).map((item) => (
                  <div key={`${item.title}:${item.body}`} className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3">
                    <div className="text-[13px] font-black text-wk-text">{item.title}</div>
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{item.body}</p>
                  </div>
                ))}
              </div>
            ) : uncertainMaterial.length ? (
              <div className="space-y-3">
                {uncertainMaterial.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3">
                    <div className="text-[13px] font-black text-wk-text">{item.title}</div>
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                      {item.summary || item.whyItMatters || "This still needs more checking."}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No open questions recorded"
                body="Keep uncertainty visible as the Inquiry develops."
              />
            )}
          </Panel>

          <div className="lg:col-span-2">
            <Panel eyebrow="Next step" title="What should happen next?">
              {usefulNextSteps.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {usefulNextSteps.slice(0, 4).map((item) => (
                    <div key={`${item.title}:${item.body}`} className="rounded-xl border border-wk-border bg-wk-bg px-4 py-3">
                      <div className="text-[13px] font-black text-wk-text">{item.title}</div>
                      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{item.body}</p>
                    </div>
                  ))}
                </div>
              ) : draft.evidence.length === 0 ? (
                <p className="text-[13px] leading-5 text-wk-text-muted">
                  Start by adding the first useful piece of material.
                </p>
              ) : (
                <p className="text-[13px] leading-5 text-wk-text-muted">
                  Review the material, record a finding, or begin a piece of work.
                </p>
              )}
            </Panel>
          </div>
        </div>
      ) : section === "material" ? (
        <MaterialSection
          draft={draft}
          addEvidence={addEvidence}
          reloadInquiries={reloadInquiries}
        />
      ) : section === "notes" ? (
        <InstituteClaimsWorkspace draft={draft} addEvidence={addEvidence} />
      ) : section === "work" && activeWorkWorkspace === "playlist" ? (
        <div className="mx-auto max-w-[1240px] space-y-4">
          <button
            type="button"
            onClick={closeFocusedWork}
            className="rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text"
          >
            Back to Work
          </button>

          <InstitutePlaylistWorkspace draft={draft} />
        </div>
      ) : section === "work" && activeWorkWorkspace === "article" ? (
        <EvidenceScreen
          draft={draft}
          addEvidence={addEvidence}
          updateDraft={updateDraft}
          focusedWorkspace="article"
          onCloseFocusedWorkspace={closeFocusedWork}
        />
      ) : section === "work" ? (
        <WorkSection draft={draft} />
      ) : (
        <HowThisLearnedScreen draft={draft} />
      )}
    </div>
  );
}

function LockedScreen({ screen }: { screen: InquiryScreen }) {
  const labels: Record<InquiryScreen, string> = {
    home: "Home",
    inquiry: "Inquiry",
    workbench: "Legacy setup",
    anchorBrief: "Legacy overview",
    evidence: "Legacy workspaces",
    claims: "Notes and findings",
    relationships: "Relationships",
    memory: "Contributor Memory",
    corrections: "Corrections",
    review: "Review",
    summary: "Inquiry Summary",
    clinic: "Question",
    lineage: "Inquiry links",
    public: "Preview",
    learned: "History",
    ai: "AI Readiness",
  };

  return (
    <div className="mx-auto max-w-[1000px]">
      <Panel eyebrow="Coming next" title={labels[screen]}>
        <EmptyState
          title="Not ported yet"
          body="We are moving V8 into the app one surface at a time. This page is visible in the architecture, but not active in this slice."
        />
      </Panel>
    </div>
  );
}

const globalInstituteScreens = new Set<InquiryScreen>(["home", "inquiry", "workbench", "anchorBrief", "evidence", "claims", "review", "clinic", "learned", "relationships"]);

function readInstituteScreen(value: string | null): InquiryScreen {
  return value && globalInstituteScreens.has(value as InquiryScreen) ? (value as InquiryScreen) : "home";
}

const inquirySections = new Set<InquirySection>(["overview", "material", "notes", "work", "history"]);

function readInquirySection(value: string | null): InquirySection {
  return value && inquirySections.has(value as InquirySection) ? (value as InquirySection) : "overview";
}

export default function NativeInstituteInquiryInterface() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    stripLegacyInstituteHash();
  }, []);

  const { inquiries: drafts, loading: inquiriesLoading, error: inquiriesError, addInquiry, addEvidence, updateInquiry, reloadInquiries } = useSupabaseInquiries();
  const [state, setRawState] = useState<InstituteState>({
    screen: readInstituteScreen(searchParams.get("screen")),
    section: readInquirySection(searchParams.get("section")),
    activeId: searchParams.get("inquiry"),
    questionDraft: "",
    selectedAnchor: null,
    selectedAnchorCategory: null,
    anchorSearch: "",
  });

  const { anchors, loading: anchorsLoading, error: anchorsError } = useInstituteAnchorSearch(state.selectedAnchorCategory, state.anchorSearch);

  useEffect(() => {
    const nextScreen = readInstituteScreen(searchParams.get("screen"));
    const nextSection = readInquirySection(searchParams.get("section"));
    const nextActiveId = searchParams.get("inquiry");

    setRawState((current) => {
      if (
        current.screen === nextScreen &&
        current.section === nextSection &&
        current.activeId === nextActiveId
      ) {
        return current;
      }

      return {
        ...current,
        screen: nextScreen,
        section: nextSection,
        activeId: nextActiveId,
      };
    });
  }, [searchParams]);

  const setState = (patch: Partial<InstituteState>) => {
    setRawState((current) => ({ ...current, ...patch }));

    const nextParams = new URLSearchParams(searchParams);

    if (patch.screen) {
      nextParams.set("screen", patch.screen);
    }

    if (patch.section) {
      nextParams.set("section", patch.section);
    }

    if ("activeId" in patch) {
      if (patch.activeId) {
        nextParams.set("inquiry", patch.activeId);
      } else {
        nextParams.delete("inquiry");
      }
    }

    setSearchParams(nextParams, { replace: true });
  };

  const active = useMemo(
    () => drafts.find((draft) => draft.id === state.activeId) ?? null,
    [drafts, state.activeId],
  );

  const createDraft = async () => {
    const question = state.questionDraft.trim();
    if (question.length < 8) return;

    const inquiry = await addInquiry(question, state.selectedAnchor);
    setState({
      activeId: inquiry.id,
      screen: "inquiry",
      section: "overview",
      questionDraft: "",
      selectedAnchor: null,
      selectedAnchorCategory: null,
      anchorSearch: "",
    });
  };

  const updateActiveDraft = (patch: Partial<InquiryDraft>) => {
    if (!active) return;
    void updateInquiry(active.id, patch);
  };

  return (
    <div className="-mx-3 min-h-[calc(100vh-90px)] bg-wk-bg px-3 py-2 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
      <main className="min-w-0">
        {state.screen === "home" ? (
            <HomeScreen
              state={state}
              setState={setState}
              anchors={anchors}
              anchorsLoading={anchorsLoading}
              anchorsError={anchorsError}
              drafts={drafts}
              createDraft={createDraft}
              inquiriesLoading={inquiriesLoading}
              inquiriesError={inquiriesError}
            />
          ) : state.screen === "inquiry" ? (
            <InquiryShell
              draft={active}
              section={state.section}
              setSection={(section) => setState({ section })}
              addEvidence={addEvidence}
              updateDraft={updateActiveDraft}
              reloadInquiries={reloadInquiries}
            />
          ) : state.screen === "workbench" ? (
            <WorkbenchScreen draft={active} updateDraft={updateActiveDraft} />
          ) : state.screen === "anchorBrief" ? (
            <AnchorBriefScreen draft={active} />
          ) : state.screen === "evidence" ? (
            <>
              <EvidenceScreen draft={active} addEvidence={addEvidence} updateDraft={updateActiveDraft} />
              {active && <EvidenceReaderPanel draft={active} onEvidenceChanged={reloadInquiries} />}
            </>
          ) : state.screen === "claims" ? (
            <InstituteClaimsWorkspace draft={active} addEvidence={addEvidence} />
          ) : state.screen === "review" ? (
            <ReviewDeskScreen />
          ) : state.screen === "clinic" ? (
            <ClinicScreen draft={active} onQuestionChanged={reloadInquiries} />
          ) : state.screen === "learned" ? (
            <HowThisLearnedScreen draft={active} />
          ) : state.screen === "relationships" ? (
            <RelationshipsScreen draft={active} />
        ) : (
          <LockedScreen screen={state.screen} />
        )}
      </main>
    </div>
  );
}
