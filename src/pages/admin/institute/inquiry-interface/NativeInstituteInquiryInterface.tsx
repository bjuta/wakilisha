import { useEffect, useMemo, useState } from "react";
import {
  createInstituteInquiry,
  listInstituteInquiries,
  updateInstituteInquiry,
} from "@/services/institute/inquiryService";
import {
  anchorCategoryOptions,
  useInstituteAnchorSearch,
} from "./useInstituteAnchorSearch";
import type {
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

  return { inquiries, loading, error, addInquiry, updateInquiry };
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
    { screen: "evidence", label: "Evidence", badge: "soon", disabled: true },
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

function EvidenceScreen({
  draft,
  updateDraft,
}: {
  draft: InquiryDraft | null;
  updateDraft: (patch: Partial<InquiryDraft>) => void;
}) {
  const [evidenceDraft, setEvidenceDraft] = useState({
    title: "",
    kind: "Link" as EvidenceKind,
    source: "",
    sourceUrl: "",
    summary: "",
    whyItMatters: "",
    mediaMinutes: "0",
    reviewState: "Draft" as ReviewState,
  });

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <Panel eyebrow="Evidence" title="No Active Inquiry">
          <EmptyState title="Nothing to add evidence to yet" body="Create or select an Inquiry first." />
        </Panel>
      </div>
    );
  }

  const evidence = draft.evidence ?? [];
  const canAdd =
    evidenceDraft.title.trim().length >= 3 &&
    evidenceDraft.source.trim().length >= 2 &&
    evidenceDraft.summary.trim().length >= 8 &&
    evidenceDraft.whyItMatters.trim().length >= 8;

  const addEvidence = () => {
    if (!canAdd) return;

    const createdAt = nowDate();
    const item: EvidenceItem = {
      id: makeId(),
      title: evidenceDraft.title.trim(),
      kind: evidenceDraft.kind,
      source: evidenceDraft.source.trim(),
      sourceUrl: evidenceDraft.sourceUrl.trim(),
      summary: evidenceDraft.summary.trim(),
      whyItMatters: evidenceDraft.whyItMatters.trim(),
      mediaMinutes: Math.max(0, Number(evidenceDraft.mediaMinutes) || 0),
      reviewState: evidenceDraft.reviewState,
      createdAt,
      updatedAt: createdAt,
    };

    updateDraft({ evidence: [item, ...evidence] });

    setEvidenceDraft({
      title: "",
      kind: "Link",
      source: "",
      sourceUrl: "",
      summary: "",
      whyItMatters: "",
      mediaMinutes: "0",
      reviewState: "Draft",
    });
  };

  const reviewReadyCount = evidence.filter((item) => item.reviewState === "Needs review").length;
  const internalMemoryCount = evidence.filter((item) => item.reviewState === "Accepted for internal memory").length;
  const publicCandidateCount = evidence.filter((item) => item.reviewState === "Public-safe candidate").length;
  const totalMaterialMinutes = evidence.reduce((sum, item) => sum + item.mediaMinutes, 0);

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <Panel eyebrow={`${draft.code} · Evidence`} title="What can we put on the table?">
        <p className="mb-4 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
          Add real source material for this Inquiry. Evidence can be useful before it is public-safe.
        </p>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Items</div>
            <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{evidence.length}</div>
          </div>
          <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Needs review</div>
            <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{reviewReadyCount}</div>
          </div>
          <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Internal memory</div>
            <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{internalMemoryCount}</div>
          </div>
          <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Material time</div>
            <div className="mt-2 text-[26px] font-black tracking-[-0.05em] text-wk-text">{totalMaterialMinutes} min</div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Add Evidence">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Evidence title</span>
              <input
                value={evidenceDraft.title}
                onChange={(event) => setEvidenceDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Example: Interview clip, article, archive note"
                className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Format</span>
                <select
                  value={evidenceDraft.kind}
                  onChange={(event) => setEvidenceDraft((current) => ({ ...current, kind: event.target.value as EvidenceKind }))}
                  className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                >
                  {evidenceKinds.map((kind) => <option key={kind}>{kind}</option>)}
                </select>
              </label>

              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Review state</span>
                <select
                  value={evidenceDraft.reviewState}
                  onChange={(event) => setEvidenceDraft((current) => ({ ...current, reviewState: event.target.value as ReviewState }))}
                  className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                >
                  {reviewStates.map((state) => <option key={state}>{state}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Source</span>
              <input
                value={evidenceDraft.source}
                onChange={(event) => setEvidenceDraft((current) => ({ ...current, source: event.target.value }))}
                placeholder="Who or where did this come from?"
                className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Source URL, if any</span>
              <input
                value={evidenceDraft.sourceUrl}
                onChange={(event) => setEvidenceDraft((current) => ({ ...current, sourceUrl: event.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Summary</span>
              <textarea
                value={evidenceDraft.summary}
                onChange={(event) => setEvidenceDraft((current) => ({ ...current, summary: event.target.value }))}
                rows={3}
                placeholder="What does this evidence say?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Why it matters</span>
              <textarea
                value={evidenceDraft.whyItMatters}
                onChange={(event) => setEvidenceDraft((current) => ({ ...current, whyItMatters: event.target.value }))}
                rows={3}
                placeholder="What does this help us understand?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">Media time, minutes</span>
              <input
                type="number"
                min="0"
                value={evidenceDraft.mediaMinutes}
                onChange={(event) => setEvidenceDraft((current) => ({ ...current, mediaMinutes: event.target.value }))}
                className="w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <button
              type="button"
              disabled={!canAdd}
              onClick={addEvidence}
              className="rounded-lg bg-wk-brand px-6 py-3 text-[14px] font-black text-wk-brand-on transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add Evidence
            </button>
          </div>
        </Panel>

        <Panel title="Evidence on This Inquiry">
          {evidence.length ? (
            <div className="space-y-3">
              {evidence.map((item) => (
                <article key={item.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="brand">{item.kind}</Chip>
                    <Chip tone={item.reviewState === "Needs review" ? "warning" : item.reviewState === "Accepted for internal memory" ? "success" : "neutral"}>
                      {item.reviewState}
                    </Chip>
                    {item.mediaMinutes ? <Chip>{item.mediaMinutes} min</Chip> : null}
                  </div>
                  <h3 className="mt-3 text-[16px] font-black tracking-[-0.03em] text-wk-text">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">{item.summary}</p>
                  <div className="mt-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] leading-5 text-wk-text-muted">
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
                  <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">{item.whyItMatters}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No evidence yet"
              body="Add the first source, record, link, note, or media item for this Inquiry."
            />
          )}
        </Panel>
      </div>

      <Panel title="Review Prep">
        {evidence.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            <EmptyState
              title={publicCandidateCount ? "Public candidates exist" : "No public candidates yet"}
              body={publicCandidateCount ? `${publicCandidateCount} evidence item(s) may support public work after review.` : "Evidence can be internal memory before it is public-safe."}
            />
            <EmptyState
              title={reviewReadyCount ? "Review needed" : "Nothing waiting for review"}
              body={reviewReadyCount ? `${reviewReadyCount} item(s) are waiting for a human decision.` : "Mark evidence as Needs review when it is ready."}
            />
            <EmptyState
              title="Next useful step"
              body="After evidence is useful, the next native surface should be Claims."
            />
          </div>
        ) : (
          <EmptyState
            title="Not ready for review"
            body="Add evidence before review prep can say anything useful."
          />
        )}
      </Panel>
    </div>
  );
}


function LockedScreen({ screen }: { screen: InquiryScreen }) {
  const labels: Record<InquiryScreen, string> = {
    home: "Home",
    workbench: "Workbench",
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

  const { inquiries: drafts, loading: inquiriesLoading, error: inquiriesError, addInquiry, updateInquiry } = useSupabaseInquiries();
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
          ) : state.screen === "evidence" ? (
            <EvidenceScreen draft={active} updateDraft={updateActiveDraft} />
          ) : (
            <LockedScreen screen={state.screen} />
          )}
        </main>
      </div>
    </div>
  );
}
