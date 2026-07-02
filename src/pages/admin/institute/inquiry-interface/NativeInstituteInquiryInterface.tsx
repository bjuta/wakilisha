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
    { screen: "review", label: "Review", disabled: true },
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


type EvidenceSourceConfig = {
  kind: EvidenceKind;
  label: string;
  role: string;
  integrityPrompt: string;
  editorUse: string;
};

const evidenceSourceConfigs: EvidenceSourceConfig[] = [
  {
    kind: "WAKILISHA record",
    label: "WAKILISHA record",
    role: "Use an existing artist, track, release, label, genre, chart, or internal record as structured source material.",
    integrityPrompt: "Confirm the record is current, specific, and relevant to this Inquiry.",
    editorUse: "Can support registry updates, article context, claims, relationships, or corrections.",
  },
  {
    kind: "Article",
    label: "Reference article",
    role: "Use an existing article as source material. This is not the article we are publishing.",
    integrityPrompt: "Capture author, publisher, access date, and what the article actually proves.",
    editorUse: "Can support a future WAKILISHA article, guide, citation trail, or research note.",
  },
  {
    kind: "Link",
    label: "Web source",
    role: "Capture a web page, post, database entry, archive page, or useful public URL.",
    integrityPrompt: "Check source credibility, access date, link rot risk, and whether it needs archiving.",
    editorUse: "Can support claims, provide context, or point editors to material that needs verification.",
  },
  {
    kind: "Citation",
    label: "Citation or quote",
    role: "Capture a quote, excerpt, page reference, timestamp, or exact claim from a source.",
    integrityPrompt: "Separate what is quoted from what we infer. Add page, timestamp, or locator where possible.",
    editorUse: "Can become claim support, article citation, correction evidence, or research packet material.",
  },
  {
    kind: "Interview",
    label: "Interview or oral history",
    role: "Capture an interview, transcript note, voice account, or contributor conversation.",
    integrityPrompt: "Track consent, speaker identity, recording status, and what can or cannot be public.",
    editorUse: "Can support articles, oral history work, internal memory, claims, or future audio/video production.",
  },
  {
    kind: "Audio",
    label: "Audio material",
    role: "Capture a recording, voice note, song-related audio reference, field recording, or audio archive item.",
    integrityPrompt: "Track transcript needs, speaker, timestamp, rights, consent, and public-use limits.",
    editorUse: "Can become internal evidence, article support, oral history material, or future audio vertical input.",
  },
  {
    kind: "Video",
    label: "Video material",
    role: "Capture a video source, clip, scene, interview, performance, explainer, or visual record.",
    integrityPrompt: "Track timestamp, rights, people present, captions, transcript needs, and public-use limits.",
    editorUse: "Can support article embeds, future video work items, claim review, or archive notes.",
  },
  {
    kind: "Photo",
    label: "Photo or image",
    role: "Capture an image that is evidence, not just decoration.",
    integrityPrompt: "Track credit, date, place, rights, people shown, caption, and consent.",
    editorUse: "Can support articles, photo essays, registry image candidates, archive records, or scene documentation.",
  },
  {
    kind: "Archive document",
    label: "Archive document",
    role: "Capture scans, documents, programs, press kits, PDFs, letters, contracts, flyers, or cataloged material.",
    integrityPrompt: "Track collection, locator, access note, rights, excerpt, and what the document does not prove.",
    editorUse: "Can support articles, guides, claims, timelines, corrections, or structured archive records.",
  },
  {
    kind: "Chart data",
    label: "Chart or dataset",
    role: "Capture chart positions, rankings, metrics, lists, datasets, or structured evidence.",
    integrityPrompt: "Track source, date, edition, metric definition, and how the number should be interpreted.",
    editorUse: "Can support data-led stories, charts context, claim support, or registry enrichment.",
  },
  {
    kind: "Personal note",
    label: "Contributor memory",
    role: "Capture a memory, observation, field note, or informed contributor note.",
    integrityPrompt: "Mark uncertainty clearly. Do not treat memory as verified fact without support.",
    editorUse: "Can become internal memory, a lead for further evidence, or a fork into a new Inquiry.",
  },
];

const editorialOutcomeOptions = [
  {
    id: "article_candidate",
    title: "Article candidate",
    body: "This material may help an editor create or improve a WAKILISHA article later.",
    guardrail: "Contributor proposes. Editor decides and opens the real article editor after review.",
  },
  {
    id: "guide_document_candidate",
    title: "Guide or document candidate",
    body: "This material may belong in a guide, explainer, document, or research brief.",
    guardrail: "No public document is created from this screen.",
  },
  {
    id: "registry_update",
    title: "Registry update proposal",
    body: "This material may correct, enrich, or challenge a registry record.",
    guardrail: "Registry changes must be reviewed before anything public changes.",
  },
  {
    id: "claim_support",
    title: "Claim support",
    body: "This material appears to support a claim that may be used later.",
    guardrail: "Claim acceptance comes after review.",
  },
  {
    id: "claim_challenge",
    title: "Claim challenge",
    body: "This material appears to weaken, complicate, or contradict a claim.",
    guardrail: "Contradictions are kept visible for editors.",
  },
  {
    id: "relationship_evidence",
    title: "Relationship evidence",
    body: "This material may support a relationship between artists, tracks, places, labels, scenes, or contributors.",
    guardrail: "Relationship proposals need review before becoming structured knowledge.",
  },
  {
    id: "correction_candidate",
    title: "Correction candidate",
    body: "This material suggests something public or internal may need correction.",
    guardrail: "Corrections need editorial handling before publication.",
  },
  {
    id: "media_work_item",
    title: "Media work item",
    body: "This material may become audio, video, photo, or archive work in a future WAKILISHA vertical.",
    guardrail: "This PR stores the intent. It does not publish media.",
  },
  {
    id: "internal_memory",
    title: "Internal memory only",
    body: "This material is useful for WAKILISHA but may not be public-safe or publication-ready.",
    guardrail: "Useful does not mean public.",
  },
  {
    id: "new_inquiry_fork",
    title: "Fork into new Inquiry",
    body: "This material opens a better or separate question.",
    guardrail: "The fork action comes later.",
  },
];

function evidenceMetadataText(item: EvidenceItem, key: string, fallback = "Not set") {
  const value = item.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
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
}: {
  draft: InquiryDraft | null;
  addEvidence: (inquiryId: string, evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">) => Promise<EvidenceItem>;
}) {
  const [selectedKind, setSelectedKind] = useState<EvidenceKind>("Link");
  const [form, setForm] = useState({
    title: "",
    source: "",
    sourceUrl: "",
    summary: "",
    whyItMatters: "",
    confidence: "Useful clue",
    rightsStatus: "Unknown rights",
    consentStatus: "Not assessed",
    uncertaintyNote: "",
    supports: "",
    challenges: "",
    editorialOutcome: "article_candidate",
    contributorNote: "",
  });
  const [saving, setSaving] = useState(false);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <Panel eyebrow="Evidence Studio" title="No Active Inquiry">
          <EmptyState title="Nothing to service yet" body="Create or select an Inquiry first." />
        </Panel>
      </div>
    );
  }

  const evidence = draft.evidence ?? [];
  const selectedConfig = evidenceSourceConfigs.find((config) => config.kind === selectedKind) ?? evidenceSourceConfigs[0];
  const selectedOutcome = editorialOutcomeOptions.find((outcome) => outcome.id === form.editorialOutcome) ?? editorialOutcomeOptions[0];

  const readyForReview = evidence.filter((item) => item.reviewState === "Needs review").length;
  const internalMemory = evidence.filter((item) => item.reviewState === "Accepted for internal memory").length;
  const publicCandidates = evidence.filter((item) => item.reviewState === "Public-safe candidate").length;
  const withRightsRisk = evidence.filter((item) => evidenceMetadataText(item, "rightsStatus", "").toLowerCase().includes("unknown")).length;
  const withConsentRisk = evidence.filter((item) => evidenceMetadataText(item, "consentStatus", "").toLowerCase().includes("needed")).length;

  const canSave =
    form.title.trim().length >= 3 &&
    form.source.trim().length >= 2 &&
    form.summary.trim().length >= 8 &&
    form.whyItMatters.trim().length >= 8;

  const saveSourceMaterial = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    try {
      await addEvidence(draft.id, {
        title: form.title.trim(),
        kind: selectedKind,
        source: form.source.trim(),
        sourceUrl: form.sourceUrl.trim(),
        summary: form.summary.trim(),
        whyItMatters: form.whyItMatters.trim(),
        mediaMinutes: 0,
        reviewState: "Draft",
        metadata: {
          evidenceStudioVersion: 1,
          sourceMaterialRole: selectedConfig.role,
          sourceIntegrityPrompt: selectedConfig.integrityPrompt,
          editorUse: selectedConfig.editorUse,
          confidence: form.confidence,
          rightsStatus: form.rightsStatus,
          consentStatus: form.consentStatus,
          uncertaintyNote: form.uncertaintyNote.trim(),
          supports: form.supports.trim(),
          challenges: form.challenges.trim(),
          suggestedEditorialOutcome: form.editorialOutcome,
          suggestedEditorialOutcomeLabel: selectedOutcome.title,
          editorialGuardrail: selectedOutcome.guardrail,
          contributorNote: form.contributorNote.trim(),
        },
      });

      setForm({
        title: "",
        source: "",
        sourceUrl: "",
        summary: "",
        whyItMatters: "",
        confidence: "Useful clue",
        rightsStatus: "Unknown rights",
        consentStatus: "Not assessed",
        uncertaintyNote: "",
        supports: "",
        challenges: "",
        editorialOutcome: "article_candidate",
        contributorNote: "",
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
              {draft.code} · Evidence Studio
            </div>
            <h1 className="mt-3 max-w-4xl text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[42px]">
              Service the Inquiry before anything becomes public.
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Evidence Studio is where contributors collect source material, explain what it supports, surface risk, and suggest what an editor should review it as. It does not publish.
            </p>
          </div>

          <div className="rounded-2xl border border-wk-warning/30 bg-wk-warning-soft p-4 text-left">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-warning">Editorial guardrail</div>
            <p className="mt-2 max-w-[280px] text-[12px] leading-5 text-wk-text-muted">
              Contributors create review candidates. Editors approve, promote, schedule, and publish from the correct editorial surface.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Inquiry being serviced</div>
          <p className="mt-2 text-[16px] font-black leading-6 text-wk-text">{draft.workingQuestion}</p>
          {draft.anchor ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone="brand">{draft.anchor.type}</Chip>
              <span className="text-[12px] font-bold text-wk-text-muted">{draft.anchor.label}</span>
              {draft.anchorContextSnapshot ? <Chip tone="success">Anchor brief ready</Chip> : <Chip tone="warning">No anchor snapshot</Chip>}
            </div>
          ) : (
            <div className="mt-3">
              <Chip tone="warning">No anchor</Chip>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <EvidenceMetric label="Source materials" value={evidence.length} note="Raw material collected for this Inquiry." />
        <EvidenceMetric label="Ready for review" value={readyForReview} note="Material waiting for an editor decision." />
        <EvidenceMetric label="Internal memory" value={internalMemory} note="Useful material that may not be public." />
        <EvidenceMetric label="Risk flags" value={withRightsRisk + withConsentRisk} note="Rights or consent issues that need attention." />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel eyebrow="1 · Source Material" title="What are we working with?">
          <p className="mb-4 text-[13px] leading-6 text-wk-text-muted">
            Choose the kind of source material. This choice changes how a contributor thinks about trust, rights, consent, and editorial use.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {evidenceSourceConfigs.map((config) => {
              const selected = config.kind === selectedKind;
              return (
                <button
                  key={config.kind}
                  type="button"
                  onClick={() => setSelectedKind(config.kind)}
                  className={cx(
                    "rounded-xl border p-4 text-left transition",
                    selected ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-bg hover:border-wk-brand/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[13px] font-black text-wk-text">{config.label}</div>
                    <span className={cx(
                      "rounded-full border px-2 py-0.5 text-[10px] font-black",
                      selected ? "border-wk-brand bg-wk-surface text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted",
                    )}>
                      {selected ? "Selected" : "Choose"}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">{config.role}</p>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel eyebrow="2 · Capture" title={`Add ${selectedConfig.label}`}>
          <div className="mb-4 rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-brand">How to treat this source</div>
            <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{selectedConfig.integrityPrompt}</p>
            <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
              <strong className="text-wk-text">Possible editor use:</strong> {selectedConfig.editorUse}
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Material title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Give this source material a clear working title"
                className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Source or creator</span>
                <input
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                  placeholder="Who or where did this come from?"
                  className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                />
              </label>

              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">URL or locator</span>
                <input
                  value={form.sourceUrl}
                  onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                  placeholder="https://, archive locator, file note, or record slug"
                  className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">What does this material say?</span>
              <textarea
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                rows={4}
                placeholder="Summarize the actual material. Keep facts separate from interpretation."
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Why does it matter to this Inquiry?</span>
              <textarea
                value={form.whyItMatters}
                onChange={(event) => setForm((current) => ({ ...current, whyItMatters: event.target.value }))}
                rows={4}
                placeholder="Explain how this services the Inquiry. What does it help an editor understand?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Confidence</span>
                <select
                  value={form.confidence}
                  onChange={(event) => setForm((current) => ({ ...current, confidence: event.target.value }))}
                  className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                >
                  <option>Useful clue</option>
                  <option>Strong support</option>
                  <option>Partial support</option>
                  <option>Contradicts something</option>
                  <option>Needs primary source</option>
                  <option>Unverified memory</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Rights</span>
                <select
                  value={form.rightsStatus}
                  onChange={(event) => setForm((current) => ({ ...current, rightsStatus: event.target.value }))}
                  className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                >
                  <option>Unknown rights</option>
                  <option>Public source</option>
                  <option>Owned by WAKILISHA</option>
                  <option>Permission needed</option>
                  <option>Do not publish</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Consent</span>
                <select
                  value={form.consentStatus}
                  onChange={(event) => setForm((current) => ({ ...current, consentStatus: event.target.value }))}
                  className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                >
                  <option>Not assessed</option>
                  <option>Not needed</option>
                  <option>Consent needed</option>
                  <option>Consent captured</option>
                  <option>Private only</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">What does it support?</span>
                <textarea
                  value={form.supports}
                  onChange={(event) => setForm((current) => ({ ...current, supports: event.target.value }))}
                  rows={3}
                  placeholder="Claim, relationship, context, correction, scene, timeline, or article angle"
                  className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                />
              </label>

              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">What does it challenge or not prove?</span>
                <textarea
                  value={form.challenges}
                  onChange={(event) => setForm((current) => ({ ...current, challenges: event.target.value }))}
                  rows={3}
                  placeholder="Contradictions, limits, weak points, or things an editor must verify"
                  className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Uncertainty note</span>
              <textarea
                value={form.uncertaintyNote}
                onChange={(event) => setForm((current) => ({ ...current, uncertaintyNote: event.target.value }))}
                rows={3}
                placeholder="What should not be treated as confirmed yet?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="3 · Work Product Proposal" title="What should an editor review this as?">
        <p className="mb-4 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
          This is not publishing. This tells the editor what the contributor thinks the material could become after review.
        </p>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {editorialOutcomeOptions.map((outcome) => {
            const selected = outcome.id === form.editorialOutcome;
            return (
              <button
                key={outcome.id}
                type="button"
                onClick={() => setForm((current) => ({ ...current, editorialOutcome: outcome.id }))}
                className={cx(
                  "rounded-xl border p-4 text-left transition",
                  selected ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-bg hover:border-wk-brand/40",
                )}
              >
                <div className="text-[13px] font-black text-wk-text">{outcome.title}</div>
                <p className="mt-2 text-[11px] leading-4 text-wk-text-muted">{outcome.body}</p>
                <p className="mt-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[11px] leading-4 text-wk-text-muted">
                  {outcome.guardrail}
                </p>
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Contributor note to editor</span>
          <textarea
            value={form.contributorNote}
            onChange={(event) => setForm((current) => ({ ...current, contributorNote: event.target.value }))}
            rows={3}
            placeholder="What should the editor know when reviewing this material?"
            className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void saveSourceMaterial()}
            className="rounded-lg bg-wk-brand px-6 py-3 text-[14px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save Source Material"}
          </button>
          <span className="text-[12px] leading-5 text-wk-text-faint">
            Saves material to this Inquiry. It does not publish, schedule, or approve anything.
          </span>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel eyebrow="4 · Source Material Library" title="What has been collected?">
          {evidence.length ? (
            <div className="space-y-3">
              {evidence.map((item) => (
                <article key={item.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="brand">{item.kind}</Chip>
                    <Chip tone={item.reviewState === "Needs review" ? "warning" : item.reviewState === "Accepted for internal memory" ? "success" : "neutral"}>
                      {item.reviewState}
                    </Chip>
                    <Chip>{evidenceMetadataText(item, "confidence")}</Chip>
                  </div>

                  <h3 className="mt-3 text-[17px] font-black tracking-[-0.03em] text-wk-text">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">{item.summary}</p>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] leading-5 text-wk-text-muted">
                      <strong className="text-wk-text">Source:</strong> {item.source}
                      {item.sourceUrl ? (
                        <>
                          <br />
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-wk-brand">
                            Open source
                          </a>
                        </>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] leading-5 text-wk-text-muted">
                      <strong className="text-wk-text">Suggested outcome:</strong> {evidenceMetadataText(item, "suggestedEditorialOutcomeLabel")}
                      <br />
                      <strong className="text-wk-text">Rights:</strong> {evidenceMetadataText(item, "rightsStatus")}
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Why it matters</div>
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{item.whyItMatters}</p>
                  </div>

                  {evidenceMetadataText(item, "uncertaintyNote", "") ? (
                    <div className="mt-3 rounded-lg border border-wk-warning/30 bg-wk-warning-soft px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-warning">Uncertainty</div>
                      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{evidenceMetadataText(item, "uncertaintyNote", "")}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No source material yet"
              body="Start by adding one source material item. The goal is not volume. The goal is useful, reviewable material."
            />
          )}
        </Panel>

        <Panel eyebrow="5 · Review Readiness" title="Can this move to editorial review?">
          <div className="space-y-3">
            <EmptyState
              title={evidence.length ? "Material exists" : "No material yet"}
              body={evidence.length ? `${evidence.length} source material item(s) have been collected.` : "An editor needs source material before they can review anything."}
            />
            <EmptyState
              title={withRightsRisk ? "Rights need attention" : "Rights risk not blocking yet"}
              body={withRightsRisk ? `${withRightsRisk} item(s) still have unknown rights.` : "No unknown-rights flags were counted from saved material."}
            />
            <EmptyState
              title={withConsentRisk ? "Consent needs attention" : "Consent risk not blocking yet"}
              body={withConsentRisk ? `${withConsentRisk} item(s) may need consent before public use.` : "No consent-needed flags were counted from saved material."}
            />
            <EmptyState
              title={publicCandidates ? "Public candidates are only suggestions" : "No public candidates yet"}
              body={publicCandidates ? "Public-safe language is not final approval. Editors still decide." : "Contributors should focus on source quality before public outcomes."}
            />

            <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Next gate</div>
              <h3 className="mt-2 text-[18px] font-black tracking-[-0.04em] text-wk-text">Submit for editorial review</h3>
              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                PR7 will turn this into a frozen review packet. PR6 only builds the Studio foundation and keeps publishing out of the contributor flow.
              </p>
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-lg bg-wk-text px-5 py-3 text-[13px] font-black text-wk-bg opacity-45"
              >
                Submit for editorial review in PR7
              </button>
            </div>
          </div>
        </Panel>
      </div>
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
            <EvidenceScreen draft={active} addEvidence={addEvidence} />
          ) : (
            <LockedScreen screen={state.screen} />
          )}
        </main>
      </div>
    </div>
  );
}
