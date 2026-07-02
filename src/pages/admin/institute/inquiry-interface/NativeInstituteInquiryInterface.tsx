import {
  fetchInstituteReviewPackets,
  updateInstituteReviewPacketDecision,
  type InstituteReviewPacket,
  type InstituteReviewPacketStatus,
} from "@/services/institute/instituteReviewDeskService";
import { ArticleEditorWorkspace } from "@/pages/admin/content/articles/detail/ArticleEditorWorkspace";
import {
  createOrFetchInstituteArticleDraftLink,
  fetchInstituteArticleDraftLink,
  submitInstituteArticleDraftForReview,
  type InstituteArticleDraftLink,
} from "@/services/institute/instituteArticleBridgeService";
import { useEffect, useMemo, useState } from "react";
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
  consentDefault: "Only for review, keep it private",
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
    { label: "Review queue", note: "Editor decisions" },
    { label: "Inquiry Assistant", note: "AI help, never approval" },
  ],
  consentDefaults: [
    "Publicly after review",
    "Internally as a clue",
    "Only for review, keep it private",
  ],
  reviewStandards: [
    "Internal memory first",
    "Public-safe required",
    "Senior editor required",
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
  children: React.ReactNode;
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
  children: React.ReactNode;
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
    <div className="rounded-xl border border-dashed border-wk-border bg-wk-bg p-4">
      <div className="text-[13px] font-black text-wk-text">{title}</div>
      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{body}</p>
    </div>
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

  return { inquiries, loading, error, addInquiry, addEvidence, updateInquiry };
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
    { screen: "workbench", label: "Workbench" },
    { screen: "anchorBrief", label: "Anchor brief", badge: active?.anchorContextSnapshot ? "ready" : "none" },
    { screen: "evidence", label: "Evidence", badge: active?.evidence?.length ? String(active.evidence.length) : "0" },
    { screen: "claims", label: "Claims", disabled: true },
    { screen: "relationships", label: "Relationships", disabled: true },
    { screen: "review", label: "Review", badge: "desk" },
    { screen: "summary", label: "Inquiry summary", disabled: true },
    { screen: "clinic", label: "Question & clinic", badge: active ? `v${active.versionCount}` : "", disabled: true },
    { screen: "lineage", label: "Lineage & forks", disabled: true },
    { screen: "memory", label: "Contributor memory", disabled: true },
    { screen: "corrections", label: "Corrections", disabled: true },
    { screen: "learned", label: "How this learned", disabled: true },
  ];

  return (
    <aside className="rounded-2xl border border-wk-border bg-wk-surface p-3 shadow-sm xl:sticky xl:top-5">
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
          <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-wk-text-faint">This Inquiry</div>
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
          <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-wk-text-faint">Reader Surface</div>
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
          <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-wk-text-faint">System</div>
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

        <div className="mt-5 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
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
                      body="Try another spelling or choose No anchor. Creating new registry entities comes in a later PR."
                    />
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {state.selectedAnchorCategory === "none" ? (
            <div className="mt-5 rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="text-[13px] font-black text-wk-text">No registry anchor selected</div>
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
                  className="self-start rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[11px] font-black text-wk-text-muted"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {similarDrafts.length ? (
          <div className="mt-5 rounded-xl border border-wk-warning/30 bg-wk-warning-soft p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-warning">A similar Inquiry may already exist</div>
            <div className="mt-3 space-y-2">
              {similarDrafts.slice(0, 2).map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => setState({ activeId: draft.id, screen: "workbench" })}
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
            Creates a production Inquiry and opens the workbench.
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
              onClick={() => setState({ activeId: draft.id, screen: "workbench" })}
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
                  <div className="flex h-full items-center justify-center text-[11px] font-black uppercase tracking-[0.18em] text-wk-text-faint">
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
  children: React.ReactNode;
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
  children: React.ReactNode;
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
          How are we going to investigate this?
        </h1>
        <p className="mt-2 text-[14px] leading-6 text-wk-text-muted">
          Select the formats, tools, scope, and defaults for this Inquiry.
        </p>

        <div className="mt-5 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Working question</div>
          <input
            value={workingQuestion}
            onChange={(event) => setWorkingQuestion(event.target.value)}
            className="mt-2 w-full rounded-lg border border-wk-border bg-wk-surface px-4 py-3 text-[18px] font-black leading-6 text-wk-text outline-none focus:border-wk-brand"
          />
          <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
            {draft.rawQuestion === workingQuestion ? "Original question preserved as Version 1." : `Original question: ${draft.rawQuestion}`}
          </p>
        </div>
      </section>

      <Panel eyebrow="Featured Image" title="What image carries this Inquiry?">
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="self-start overflow-hidden rounded-xl border border-wk-border bg-wk-bg-subtle">
            {draft.featuredImageUrl ? (
              <img
                src={draft.featuredImageUrl}
                alt={draft.featuredImageAlt || ""}
                className="h-40 w-full object-cover"
              />
            ) : (
              <div className="flex h-40 items-center justify-center px-4 text-center text-[11px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
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
                    featuredImageAlt: `${draft.anchor?.label ?? "Artist"} registry image`,
                    featuredImageCredit: "WAKILISHA registry",
                    featuredImageSource: "Registry anchor",
                  })
                }
                className="rounded-lg border border-wk-brand/30 bg-wk-brand-soft px-4 py-3 text-left text-[12px] font-black text-wk-text"
              >
                Use {draft.anchor.label} registry image
              </button>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Image URL</span>
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
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Alt text</span>
              <input
                value={draft.featuredImageAlt}
                onChange={(event) => updateDraft({ featuredImageAlt: event.target.value })}
                placeholder="Describe the image for readers who cannot see it."
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Credit</span>
              <input
                value={draft.featuredImageCredit}
                onChange={(event) => updateDraft({ featuredImageCredit: event.target.value })}
                placeholder="Photographer, archive, registry, or source credit"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
          </div>
        </div>
      </Panel>

      <section className="rounded-2xl border border-wk-brand/20 bg-wk-brand-soft p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">AI Setup</div>
            <h2 className="mt-1 text-[18px] font-black tracking-[-0.04em] text-wk-text">Suggest inquiry setup.</h2>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              Later, AI can suggest formats, tools, scope, and search terms from the working question.
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
          <Panel eyebrow="1 · Inquiry Shape" title="What kind of investigation is this?">
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

          <Panel eyebrow="2 · Output Surfaces" title="What might hold the final work?">
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

          <Panel eyebrow="3 · Evidence Formats" title="What material will we use?">
            <p className="mb-3 text-[12px] leading-5 text-wk-text-muted">
              These choices control the Evidence page.
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

          <Panel eyebrow="7 · Tools of the Trade" title="What tools does this inquiry need?">
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
          <Panel eyebrow="4 · Scope" title="Give the inquiry edges.">
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

          <Panel eyebrow="6 · Defaults" title="Set the default care level.">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Consent default</div>
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
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Review standard</div>
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
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Draft timer</div>
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
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">Ready</div>
            <h2 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-wk-text">Next: Evidence</h2>
            <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
              The Evidence page will use the formats selected here.
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
              Start Adding Material
            </button>
          </section>
        </div>
      </div>
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
    <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
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
            title="This Inquiry started without a registry anchor"
            body="Use the Workbench and Evidence surfaces to frame it manually. Anchor suggestions come later."
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
              <div className="flex h-44 items-center justify-center text-[11px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
                No image
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="brand">{draft.anchor.type}</Chip>
              {snapshot ? <Chip tone="success">Snapshot ready</Chip> : <Chip tone="warning">No snapshot</Chip>}
            </div>

            <h1 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[40px]">
              {draft.anchor.label}
            </h1>

            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              {draft.anchor.contextText || draft.anchor.subtitle}
            </p>

            {snapshot ? (
              <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                Captured {new Date(snapshot.createdAt).toLocaleString()} as snapshot v{snapshot.snapshotVersion}.
              </p>
            ) : (
              <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                This Inquiry has an anchor but no captured context snapshot yet. Create a new anchored Inquiry after PR4 deployment, or add a backfill later.
              </p>
            )}
          </div>
        </div>
      </section>

      {snapshot ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Knowns</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.knowns.length}</div>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Unknowns</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.unknowns.length}</div>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Evidence gaps</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.evidenceGaps.length}</div>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Relationship leads</div>
              <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{snapshot.relationshipLeads.length}</div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <BriefItemList title="What this anchor already gives us" items={snapshot.knowns} empty="No knowns were captured." />
            <BriefItemList title="What is still unknown" items={snapshot.unknowns} empty="No unknowns were captured." />
            <BriefItemList title="Evidence gaps to fill" items={snapshot.evidenceGaps} empty="No evidence gaps were captured." />
            <BriefItemList title="Relationship leads" items={snapshot.relationshipLeads} empty="No relationship leads were captured." />
          </div>

          {snapshot.thinDataNotes.length ? (
            <Panel eyebrow="Data Quality" title="Thin data notes">
              <BriefItemList title="Things to improve" items={snapshot.thinDataNotes} empty="No thin data notes were captured." />
            </Panel>
          ) : null}
        </>
      ) : (
        <Panel title="No captured snapshot yet">
          <EmptyState
            title="Anchor exists, but the brief has no saved snapshot"
            body="This usually means the Inquiry was created before snapshot capture existed. A backfill can handle older Inquiries later."
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
  workspaceType: "article" | "interview" | "audio" | "video" | "photo" | "archive" | "data" | "registry" | "source" | "memory";
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
    productionGoal: "A reviewable image evidence package that can later support articles, archives, photo essays, or registry images.",
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
    productionGoal: "A reviewable data note that can support chart context, claims, explainers, or registry enrichment.",
    required: ["Dataset or chart source", "Metric definition", "Date/edition", "Relevant values", "Interpretation note", "Limitations"],
    niceToHave: ["Comparison set", "Chart idea", "CSV/file link", "Method note"],
    reviewQuestions: ["What does the number mean?", "What should we not infer?", "Is the source consistent?"],
  },
  {
    label: "WAKILISHA record",
    evidenceKind: "WAKILISHA record",
    workspaceType: "registry",
    deck: "Use existing WAKILISHA records as structured evidence, but mark what needs correction, enrichment, or second sourcing.",
    productionGoal: "A reviewable registry-backed evidence package that can support claims, relationships, articles, or corrections.",
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
    <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">{title}</div>
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
    <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">{label}</div>
      <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{value}</div>
      <p className="mt-1 text-[11px] leading-4 text-wk-text-muted">{note}</p>
    </div>
  );
}

function EvidenceScreen({
  draft,
  addEvidence,
  updateDraft,
}: {
  draft: InquiryDraft | null;
  addEvidence: (inquiryId: string, evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">) => Promise<EvidenceItem>;
  updateDraft: (patch: Partial<InquiryDraft>) => void;
}) {
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
  const [articleReviewSubmission, setArticleReviewSubmission] = useState<{ packetId: string; packetVersion: number; submittedAt: string } | null>(null);

  const activeDefinition = activeFormat ? workspaceDefinitionFor(activeFormat) : null;
  const isArticleWorkspace = activeDefinition?.workspaceType === "article";

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
    if (!draft || !articleLink) throw new Error("Linked article draft is not ready.");

    const submission = await submitInstituteArticleDraftForReview(draft, articleLink, articlePayload);
    setArticleReviewSubmission(submission);
    setArticleLink((current) => (current ? { ...current, status: "submitted_for_review", updatedAt: submission.submittedAt } : current));
  };


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

  return (
    <div className="mx-auto max-w-[1240px] space-y-5">
      <section className="rounded-[26px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
              {draft.code} · Evidence workspaces
            </div>
            <h1 className="mt-3 max-w-4xl text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[42px]">
              Produce the formats promised in Workbench.
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              This is not another setup page. Workbench decided the evidence formats. This page is where contributors put the work on the table.
            </p>
          </div>

          <div className="rounded-2xl border border-wk-warning/30 bg-wk-warning-soft p-4 text-left">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-warning">No publishing here</div>
            <p className="mt-2 max-w-[280px] text-[12px] leading-5 text-wk-text-muted">
              Contributors produce workspaces. Editors review completed work later. No contributor gets a publish button.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Inquiry being produced</div>
          <p className="mt-2 text-[16px] font-black leading-6 text-wk-text">{draft.workingQuestion}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {draft.anchor ? <Chip tone="brand">{draft.anchor.label}</Chip> : <Chip tone="warning">No anchor</Chip>}
            <Chip>{formats.length} promised format(s)</Chip>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <EvidenceMetric label="Promised formats" value={formats.length} note="Chosen in Workbench. These control this page." />
        <EvidenceMetric label="Started" value={producedFormats.length} note="At least one workspace checkpoint exists." />
        <EvidenceMetric label="Near review" value={completedFormats.length} note="Completion is 80% or higher." />
        <EvidenceMetric label="Evidence records" value={evidence.length} note="Saved checkpoints and source material." />
      </div>

      {!formats.length ? (
        <Panel eyebrow="No formats selected" title="Go back to Workbench first">
          <EmptyState
            title="Evidence has nothing to produce yet"
            body="Choose evidence formats in Workbench. Once selected, they appear here as production workspaces."
          />
        </Panel>
      ) : (
        <>
          <Panel eyebrow="1 · Format queue" title="What did the contributor promise to produce?">
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
                        <span>Completion</span>
                        <span>{completion}%</span>
                      </div>
                      <CompletionBar value={completion} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveFormat(format)}
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
            <section className="space-y-4 rounded-[26px] border border-wk-border bg-wk-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-wk-brand">Article workspace</div>
                  <h2 className="mt-2 text-[24px] font-black tracking-[-0.055em] text-wk-text">Write this article in the shared WAKILISHA editor.</h2>
                  <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
                    This creates a real article draft linked to this Inquiry. Drafting, autosave, preview, and submit for review use the existing article system. Publishing stays editor-only.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void ensureArticleDraft()}
                  disabled={articleLinkLoading}
                  className="rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {articleLinkLoading ? "Loading..." : articleLink ? "Linked draft ready" : "Create linked article draft"}
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
                    Linked draft: <strong className="text-wk-text">{articleLink.articleSlug}</strong>. This draft is private unless an editor publishes it later.
                  </div>

                  {articleReviewSubmission ? (
                    <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                      Review packet created: <strong className="text-wk-text">v{articleReviewSubmission.packetVersion}</strong>. Submitted {new Date(articleReviewSubmission.submittedAt).toLocaleString()}.
                    </div>
                  ) : null}

                  <ArticleEditorWorkspace
                    slug={articleLink.articleSlug}
                    mode="institute"
                    returnPath="/admin/institute/inquiry-interface"
                    onSubmittedForReview={submitLinkedArticleForReview}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-5">
                  <h3 className="text-[16px] font-black text-wk-text">No linked article draft yet</h3>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                    Create one draft once, then keep writing here. The article will save through the shared article editor, not through a separate Institute textarea.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {activeDefinition && activeDefinition.workspaceType !== "article" ? (
            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel eyebrow="2 · Workspace standard" title={`${activeFormat} production room`}>
                <p className="text-[13px] leading-6 text-wk-text-muted">{activeDefinition.productionGoal}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <WorkspaceChecklist title="Required before review" items={activeDefinition.required} />
                  <WorkspaceChecklist title="Useful if available" items={activeDefinition.niceToHave} />
                </div>

                <div className="mt-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Editor will ask</div>
                  <div className="mt-3 space-y-2">
                    {activeDefinition.reviewQuestions.map((question) => (
                      <div key={question} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-bold text-wk-text-muted">
                        {question}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel eyebrow="3 · Produce work" title={`Save a ${activeFormat} checkpoint`}>
                {latestForActive ? (
                  <div className="mb-4 rounded-xl border border-wk-success/30 bg-wk-success-soft p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-success">Latest saved checkpoint</div>
                    <div className="mt-2 text-[15px] font-black text-wk-text">{latestForActive.title}</div>
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                      {activeCompletion}% complete · saved {new Date(latestForActive.createdAt).toLocaleString()}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Checkpoint title</span>
                    <input
                      value={workspace.title}
                      onChange={(event) => setWorkspace((current) => ({ ...current, title: event.target.value }))}
                      placeholder={`Name this ${activeFormat} checkpoint`}
                      className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Produced work</span>
                    <textarea
                      value={workspace.producedWork}
                      onChange={(event) => setWorkspace((current) => ({ ...current, producedWork: event.target.value }))}
                      rows={8}
                      placeholder="Do the actual work here. For article, draft the section. For interview, add transcript and excerpts. For video, add timestamped analysis."
                      className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Evidence used</span>
                    <textarea
                      value={workspace.evidenceUsed}
                      onChange={(event) => setWorkspace((current) => ({ ...current, evidenceUsed: event.target.value }))}
                      rows={4}
                      placeholder="What source, quote, timestamp, image, record, or document supports this work?"
                      className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Open risks</span>
                      <textarea
                        value={workspace.openRisks}
                        onChange={(event) => setWorkspace((current) => ({ ...current, openRisks: event.target.value }))}
                        rows={4}
                        placeholder="What is weak, risky, private, disputed, or not proven yet?"
                        className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                      />
                    </label>

                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">What should the editor check later?</span>
                      <textarea
                        value={workspace.editorCheck}
                        onChange={(event) => setWorkspace((current) => ({ ...current, editorCheck: event.target.value }))}
                        rows={4}
                        placeholder="This is not a briefing. It is a review pointer attached to completed work."
                        className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Workspace status</span>
                      <select
                        value={workspace.status}
                        onChange={(event) => setWorkspace((current) => ({ ...current, status: event.target.value }))}
                        className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                      >
                        <option>Not started</option>
                        <option>In progress</option>
                        <option>Blocked</option>
                        <option>Needs source</option>
                        <option>Ready for review</option>
                      </select>
                    </label>

                    <label>
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Completion</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={workspace.completion}
                        onChange={(event) => setWorkspace((current) => ({ ...current, completion: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }))}
                        className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
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
      setError(loadError instanceof Error ? loadError.message : "Failed to load review packets.");
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
  const workProduct = snapshot?.workProduct;
  const articleAdminUrl = article?.slug ? `/admin/content/articles/${article.slug}` : null;
  const isPublishedWork = activePacket?.liveWorkProductStatus === "published";
  const isApprovedHandoff = activePacket?.status === "approved_for_promotion" && !isPublishedWork;
  const liveArticleUrl = article?.slug ? `/magazine/${article.slug}` : null;

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
      setError(updateError instanceof Error ? updateError.message : "Failed to update review packet.");
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
    "rounded-lg border border-wk-border bg-wk-surface px-4 py-2 text-[12px] font-black text-wk-text transition hover:border-wk-brand hover:text-wk-brand disabled:cursor-not-allowed disabled:opacity-50";

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
      <section className="rounded-[26px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">Institute Review Desk</div>
            <h1 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[42px]">
              Review submitted Inquiry work.
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              This is the editor gate. Review packets can be accepted, rejected, or sent back. Nothing publishes from here.
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
        <Panel eyebrow="Review queue" title="Loading packets">
          <EmptyState title="Loading Review Desk" body="Fetching submitted review packets." />
        </Panel>
      ) : !packets.length ? (
        <Panel eyebrow="Review queue" title="Nothing waiting">
          <EmptyState title="No submitted packets yet" body="When contributors submit linked article drafts, they will appear here." />
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <Panel eyebrow="Queue" title={`${filteredPackets.length} of ${packets.length} packet(s)`}>
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
              <EmptyState title="No packets in this queue" body="Change the filter or wait for more submissions." />
            ) : (
              <div className="space-y-3">
                {filteredPackets.map((packet) => {
                const packetArticle = packet.snapshot?.articleDraft;
                const packetInquiry = packet.snapshot?.inquiry;
                const selected = activePacket?.id === packet.id;

                return (
                  <button
                    key={packet.id}
                    type="button"
                    onClick={() => setActiveId(packet.id)}
                    className={cx(
                      "block w-full rounded-xl border p-4 text-left transition",
                      selected ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-bg",
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
                    <div className="mt-2 text-[15px] font-black text-wk-text">{packetArticle?.title || packetArticle?.slug || "Untitled article draft"}</div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-wk-text-muted">
                      {packetInquiry?.workingQuestion || packetInquiry?.rawQuestion || "No Inquiry question in snapshot."}
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
            <Panel eyebrow="Packet detail" title={article?.title || "Selected review packet"}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Inquiry</div>
                  <div className="mt-2 text-[15px] font-black text-wk-text">{inquiry?.code ?? "Unknown Inquiry"}</div>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                    {inquiry?.workingQuestion || inquiry?.rawQuestion || "No question captured."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inquiry?.anchor?.label ? <Chip tone="brand">{inquiry.anchor.label}</Chip> : <Chip tone="warning">No anchor</Chip>}
                    <Chip>{workProduct?.formatLabel ?? "Article"}</Chip>
                  </div>
                </div>

                <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Linked article draft</div>
                  <div className="mt-2 text-[15px] font-black text-wk-text">{article?.slug ?? workProduct?.productSlug ?? "No article slug"}</div>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                    {article?.excerpt || "No excerpt captured in snapshot."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip tone="warning">{article?.wpStatus ?? "pending"}</Chip>
                    <Chip>Private draft</Chip>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Contributor note</div>
                <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                  {activePacket?.contributorNote || "No contributor note captured."}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Article snapshot preview</div>
                <div
                  className="prose prose-sm mt-3 max-h-[360px] overflow-auto text-wk-text"
                  dangerouslySetInnerHTML={{ __html: article?.contentHtml || "<p>No article body captured.</p>" }}
                />
              </div>
            </Panel>

            {isPublishedWork ? (
              <Panel eyebrow="Published" title="This Institute work is live">
                <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  The linked article has been published from the editor-controlled Article Editor. Institute did not publish it directly.
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

                <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  Published state is synced from the article system into the Institute work product link.
                </div>
              </Panel>
            ) : null}

            {isApprovedHandoff ? (
              <Panel eyebrow="Editorial handoff" title="Ready for final editorial pass">
                <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  This packet has been approved by Institute review. The next step is a final editor-controlled pass in the existing article system. Nothing publishes from the Institute Review Desk.
                </div>

                {articleAdminUrl ? (
                  <a
                    href={articleAdminUrl}
                    className="mt-4 inline-flex rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on"
                  >
                    Open full Article Editor
                  </a>
                ) : (
                  <div className="mt-4 rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] font-bold text-wk-warning">
                    No linked article slug found in this packet snapshot.
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  The article should remain private or pending until an editor intentionally publishes through the normal article admin workflow.
                </div>
              </Panel>
            ) : null}

            {article?.slug ? (
              <Panel eyebrow="Linked article editor" title="Review the draft itself">
                <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                  Open the real article draft, make editorial changes if needed, save, preview, then use the Review Desk decision buttons below. Publishing remains locked.
                </div>

                <button
                  type="button"
                  onClick={() => setArticleEditorOpen((current) => !current)}
                  className="mt-4 rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on"
                >
                  {articleEditorOpen ? "Close linked article editor" : "Open linked article editor"}
                </button>

                {articleEditorOpen ? (
                  <div className="mt-5 rounded-[22px] border border-wk-border bg-wk-surface p-4">
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

            <Panel eyebrow="Editor decision" title="Gate this work">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Editor notes</span>
                <textarea
                  value={editorNotes}
                  onChange={(event) => setEditorNotes(event.target.value)}
                  rows={6}
                  placeholder="What should happen next? What needs revision? What is approved?"
                  className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
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
                  Approve and hand off
                </button>
                <button type="button" disabled={Boolean(savingStatus)} onClick={() => void updateStatus("accepted_for_internal_memory")} className={actionClass}>
                  Accept as internal memory
                </button>
                <button type="button" disabled={Boolean(savingStatus)} onClick={() => void updateStatus("rejected")} className={actionClass}>
                  Reject
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] leading-5 text-wk-text-muted">
                No publishing happens here. Approval only moves the work to the next editor-controlled step.
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}



function LockedScreen({ screen }: { screen: InquiryScreen }) {
  const labels: Record<InquiryScreen, string> = {
    home: "Home",
    workbench: "Workbench",
    anchorBrief: "Anchor Brief",
    evidence: "Evidence",
    claims: "Claims",
    relationships: "Relationships",
    memory: "Contributor Memory",
    corrections: "Corrections",
    review: "Review",
    summary: "Inquiry Summary",
    clinic: "Question & Clinic",
    lineage: "Lineage & Forks",
    public: "Public Preview",
    learned: "How This Learned",
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

export default function NativeInstituteInquiryInterface() {
  useEffect(() => {
    stripLegacyInstituteHash();
  }, []);

  const { inquiries: drafts, loading: inquiriesLoading, error: inquiriesError, addInquiry, addEvidence, updateInquiry } = useSupabaseInquiries();
  const [state, setRawState] = useState<InstituteState>({
    screen: "home",
    activeId: null,
    questionDraft: "",
    selectedAnchor: null,
    selectedAnchorCategory: null,
    anchorSearch: "",
  });

  const { anchors, loading: anchorsLoading, error: anchorsError } = useInstituteAnchorSearch(state.selectedAnchorCategory, state.anchorSearch);

  const setState = (patch: Partial<InstituteState>) => setRawState((current) => ({ ...current, ...patch }));

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
      screen: "workbench",
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
    <div className="-mx-3 min-h-[calc(100vh-90px)] bg-wk-bg-subtle px-3 py-2 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[250px_minmax(0,1fr)]">
        <Rail state={state} setState={setState} drafts={drafts} active={active} />

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
          ) : state.screen === "workbench" ? (
            <WorkbenchScreen draft={active} updateDraft={updateActiveDraft} />
          ) : state.screen === "anchorBrief" ? (
            <AnchorBriefScreen draft={active} />
          ) : state.screen === "evidence" ? (
            <EvidenceScreen draft={active} addEvidence={addEvidence} updateDraft={updateActiveDraft} />
          ) : state.screen === "review" ? (
            <ReviewDeskScreen />
          ) : (
            <LockedScreen screen={state.screen} />
          )}
        </main>
      </div>
    </div>
  );
}
