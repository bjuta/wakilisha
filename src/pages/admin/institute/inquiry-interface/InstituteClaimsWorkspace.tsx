import { useMemo, useState } from "react";
import type { EvidenceItem, InquiryDraft } from "./types";

type ClaimRelation =
  | "supports"
  | "weakly supports"
  | "contradicts"
  | "background only"
  | "needs verification";

type ClaimStrength =
  | "unsupported"
  | "needs evidence"
  | "workable"
  | "strong"
  | "contested";

type Confidence = "Low" | "Medium" | "High";

type ClaimEvidenceLink = {
  evidenceId: string;
  title: string;
  kind: string;
  source: string;
  relation: ClaimRelation;
  reviewState: string;
  summary: string;
  sourceUrl: string;
};

type ClaimRecord = {
  id: string;
  title: string;
  claimText: string;
  claimUse: string;
  publicWording: string;
  confidence: Confidence;
  caveat: string;
  strength: ClaimStrength;
  links: ClaimEvidenceLink[];
  reviewState: string;
  createdAt: string;
};

type Props = {
  draft: InquiryDraft | null;
  addEvidence: (inquiryId: string, evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">) => Promise<EvidenceItem>;
};

const claimUseOptions = [
  "Central claim",
  "Supporting claim",
  "Timeline claim",
  "Relationship claim",
  "Correction claim",
  "Context claim",
  "Counter-claim",
];

const relationOptions: ClaimRelation[] = [
  "supports",
  "weakly supports",
  "contradicts",
  "background only",
  "needs verification",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
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
    <div className="rounded-lg border border-dashed border-wk-border/60 bg-wk-bg-subtle p-3">
      <div className="text-[13px] font-black text-wk-text">{title}</div>
      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{body}</p>
    </div>
  );
}

function metadataOf(item: EvidenceItem) {
  return item.metadata && typeof item.metadata === "object" ? item.metadata : {};
}

function textValue(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function isClaimItem(item: EvidenceItem) {
  const metadata = metadataOf(item);
  return metadata.workspaceType === "claims" && metadata.claimVersion === 1;
}

function extractClaims(evidence: EvidenceItem[]): ClaimRecord[] {
  return evidence
    .filter(isClaimItem)
    .map((item) => {
      const metadata = metadataOf(item);

      return {
        id: item.id,
        title: item.title,
        claimText: textValue(metadata.claimText, item.summary),
        claimUse: textValue(metadata.claimUse, item.whyItMatters),
        publicWording: textValue(metadata.publicWording),
        confidence: (textValue(metadata.claimConfidence, "Medium") as Confidence) || "Medium",
        caveat: textValue(metadata.claimCaveat),
        strength: (textValue(metadata.claimStrength, "unsupported") as ClaimStrength) || "unsupported",
        links: Array.isArray(metadata.attachedEvidence) ? (metadata.attachedEvidence as ClaimEvidenceLink[]) : [],
        reviewState: item.reviewState,
        createdAt: item.createdAt,
      };
    });
}

function strengthForLinks(links: ClaimEvidenceLink[]): ClaimStrength {
  const supports = links.filter((link) => link.relation === "supports").length;
  const weakSupports = links.filter((link) => link.relation === "weakly supports").length;
  const contradicts = links.filter((link) => link.relation === "contradicts").length;
  const needsVerification = links.filter((link) => link.relation === "needs verification").length;

  if (!links.length) return "unsupported";
  if (contradicts > 0) return "contested";
  if (supports >= 2 && needsVerification === 0) return "strong";
  if (supports >= 1 || weakSupports >= 2) return "workable";
  return "needs evidence";
}

function toneForStrength(strength: ClaimStrength): "success" | "warning" | "neutral" {
  if (strength === "strong" || strength === "workable") return "success";
  if (strength === "contested" || strength === "needs evidence" || strength === "unsupported") return "warning";
  return "neutral";
}

function relationTone(relation: ClaimRelation): "success" | "warning" | "neutral" {
  if (relation === "supports") return "success";
  if (relation === "contradicts" || relation === "needs verification") return "warning";
  return "neutral";
}

function relationSummary(links: ClaimEvidenceLink[]) {
  const supports = links.filter((link) => link.relation === "supports").length;
  const weak = links.filter((link) => link.relation === "weakly supports").length;
  const contradicts = links.filter((link) => link.relation === "contradicts").length;
  const background = links.filter((link) => link.relation === "background only").length;
  const needs = links.filter((link) => link.relation === "needs verification").length;

  return { supports, weak, contradicts, background, needs };
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

export function InstituteClaimsWorkspace({ draft, addEvidence }: Props) {
  const evidence = draft?.evidence ?? [];
  const claims = useMemo(() => extractClaims(evidence), [evidence]);
  const sourceEvidence = evidence.filter((item) => !isClaimItem(item));

  const [claimText, setClaimText] = useState("");
  const [claimUse, setClaimUse] = useState(claimUseOptions[0]);
  const [publicWording, setPublicWording] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("Medium");
  const [caveat, setCaveat] = useState("");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [relations, setRelations] = useState<Record<string, ClaimRelation>>({});
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  const attachedEvidence = selectedEvidenceIds
    .map((id) => {
      const item = sourceEvidence.find((evidenceItem) => evidenceItem.id === id);
      if (!item) return null;

      return {
        evidenceId: item.id,
        title: item.title,
        kind: item.kind,
        source: item.source,
        relation: relations[item.id] ?? "supports",
        reviewState: item.reviewState,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
      } satisfies ClaimEvidenceLink;
    })
    .filter(Boolean) as ClaimEvidenceLink[];

  const liveStrength = strengthForLinks(attachedEvidence);
  const liveSummary = relationSummary(attachedEvidence);

  const unsupportedClaims = claims.filter((claim) => claim.strength === "unsupported" || claim.strength === "needs evidence").length;
  const contestedClaims = claims.filter((claim) => claim.strength === "contested").length;
  const reviewableClaims = claims.filter((claim) => claim.strength === "workable" || claim.strength === "strong").length;

  const canSave = Boolean(draft && claimText.trim().length >= 8 && caveat.trim().length >= 4 && !saving);

  const toggleEvidence = (id: string) => {
    setSelectedEvidenceIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current, id];
    });

    setRelations((current) => ({
      ...current,
      [id]: current[id] ?? "supports",
    }));
  };

  const resetForm = () => {
    setClaimText("");
    setClaimUse(claimUseOptions[0]);
    setPublicWording("");
    setConfidence("Medium");
    setCaveat("");
    setSelectedEvidenceIds([]);
    setRelations({});
  };

  const saveClaim = async () => {
    if (!draft || !canSave) return;

    setSaving(true);
    setSavedNotice("");

    try {
      const nextStrength = strengthForLinks(attachedEvidence);
      const reviewState =
        nextStrength === "strong" || nextStrength === "workable"
          ? "Needs review"
          : "Needs more evidence";

      await addEvidence(draft.id, {
        title: `${claimUse}: ${claimText.trim().slice(0, 96)}`,
        kind: "Personal note",
        source: "Institute claims workspace",
        sourceUrl: "",
        summary: claimText.trim(),
        whyItMatters: claimUse,
        mediaMinutes: 0,
        reviewState,
        metadata: {
          workspaceVersion: 1,
          workspaceFormat: "Claim",
          workspaceType: "claims",
          savedFrom: "institute_claims_workspace",
          claimVersion: 1,
          claimText: claimText.trim(),
          claimUse,
          publicWording: publicWording.trim(),
          claimConfidence: confidence,
          claimCaveat: caveat.trim(),
          claimStrength: nextStrength,
          attachedEvidence,
          relationSummary: relationSummary(attachedEvidence),
          inquiryCode: draft.code,
          inquiryQuestion: draft.workingQuestion,
        },
      });

      setSavedNotice("Saved claim to the inquiry.");
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <Panel eyebrow="Claims" title="No Active Inquiry">
          <EmptyState title="Nothing to shape yet" body="Create or select an Inquiry first." />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
              {draft.code} · Claims workspace
            </div>
            <h1 className="mt-3 max-w-4xl text-[34px] font-black leading-[1.02] tracking-[-0.065em] text-wk-text lg:text-[42px]">
              Shape claims from evidence.
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Claims are not facts yet. Tie each claim to evidence, mark the relationship honestly, and keep unsupported ideas visible.
            </p>
          </div>

          <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft p-4 text-left">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-warning">No overclaiming</div>
            <p className="mt-2 max-w-[300px] text-[12px] leading-5 text-wk-text-muted">
              A claim can be useful and still need proof. This workspace keeps that distinction clear.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Inquiry being tested</div>
          <p className="mt-2 text-[16px] font-black leading-6 text-wk-text">{draft.workingQuestion}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {draft.anchor ? <Pill tone="brand">{draft.anchor.label}</Pill> : <Pill tone="warning">No anchor</Pill>}
            <Pill>{sourceEvidence.length} evidence item(s)</Pill>
            <Pill>{claims.length} claim(s)</Pill>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <EvidenceMetric label="Evidence" value={sourceEvidence.length} note="Material available for claim testing." />
        <EvidenceMetric label="Claims" value={claims.length} note="Saved claim records in this inquiry." />
        <EvidenceMetric label="Reviewable" value={reviewableClaims} note="Claims with workable or strong evidence." />
        <EvidenceMetric label="Needs care" value={unsupportedClaims + contestedClaims} note="Unsupported, thin, or contested claims." />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Panel eyebrow="1 · Build a claim" title="Write the claim, then attach evidence">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Claim</span>
              <textarea
                value={claimText}
                onChange={(event) => setClaimText(event.target.value)}
                rows={4}
                placeholder="What do we think is true, changing, connected, or worth testing?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[14px] font-bold leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Use</span>
                <select
                  value={claimUse}
                  onChange={(event) => setClaimUse(event.target.value)}
                  className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                >
                  {claimUseOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Confidence</span>
                <select
                  value={confidence}
                  onChange={(event) => setConfidence(event.target.value as Confidence)}
                  className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-3 text-[13px] font-bold text-wk-text outline-none focus:border-wk-brand"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>

              <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Live strength</div>
                <div className="mt-2">
                  <Pill tone={toneForStrength(liveStrength)}>{liveStrength}</Pill>
                </div>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Public wording candidate</span>
              <textarea
                value={publicWording}
                onChange={(event) => setPublicWording(event.target.value)}
                rows={3}
                placeholder="Optional. How could this be phrased publicly without overstating it?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Limits, doubt, or what would change your mind</span>
              <textarea
                value={caveat}
                onChange={(event) => setCaveat(event.target.value)}
                rows={3}
                placeholder="What does this claim not prove yet? What needs another source?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">Attached evidence</div>
                  <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                    Supports: {liveSummary.supports} · Weak: {liveSummary.weak} · Contradicts: {liveSummary.contradicts} · Background: {liveSummary.background} · Needs check: {liveSummary.needs}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => void saveClaim()}
                  className="rounded-lg bg-wk-text px-5 py-3 text-[13px] font-black text-wk-bg transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save claim"}
                </button>
              </div>

              {savedNotice ? (
                <div className="mt-3 rounded-lg border border-wk-success/30 bg-wk-success-soft px-3 py-2 text-[12px] font-bold text-wk-text-muted">
                  {savedNotice}
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel eyebrow="2 · Evidence picker" title="Attach evidence honestly">
          {!sourceEvidence.length ? (
            <EmptyState
              title="No evidence yet"
              body="Add WAKILISHA records or other evidence first. You can still save an unsupported claim later, but evidence makes it useful."
            />
          ) : (
            <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
              {sourceEvidence.map((item) => {
                const selected = selectedEvidenceIds.includes(item.id);
                const relation = relations[item.id] ?? "supports";

                return (
                  <article
                    key={item.id}
                    className={cx(
                      "rounded-xl border p-4 transition",
                      selected ? "border-wk-brand bg-wk-brand-soft shadow-sm" : "border-wk-border bg-wk-bg",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" onClick={() => toggleEvidence(item.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={selected ? "brand" : "neutral"}>{selected ? "Attached" : "Attach"}</Pill>
                          <Pill>{item.kind}</Pill>
                          <Pill tone={item.reviewState === "Draft" ? "neutral" : "warning"}>{item.reviewState}</Pill>
                        </div>
                        <h3 className="mt-3 text-[15px] font-black leading-5 text-wk-text">{item.title}</h3>
                        <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-wk-text-muted">{item.summary}</p>
                      </button>

                      {selected ? (
                        <select
                          value={relation}
                          onChange={(event) =>
                            setRelations((current) => ({
                              ...current,
                              [item.id]: event.target.value as ClaimRelation,
                            }))
                          }
                          className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-black text-wk-text outline-none focus:border-wk-brand"
                        >
                          {relationOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>

                    {selected ? (
                      <div className="mt-3">
                        <Pill tone={relationTone(relation)}>{relation}</Pill>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel eyebrow="3 · Claim board" title="Saved claims">
        {!claims.length ? (
          <EmptyState
            title="No claims shaped yet"
            body="Create the first claim above. Unsupported claims are allowed, but they will be marked as needing evidence."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {claims.map((claim) => {
              const summary = relationSummary(claim.links);

              return (
                <article key={claim.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="brand">{claim.claimUse}</Pill>
                    <Pill tone={toneForStrength(claim.strength)}>{claim.strength}</Pill>
                    <Pill>{claim.reviewState}</Pill>
                  </div>
                  <h3 className="mt-3 text-[16px] font-black leading-6 text-wk-text">{claim.claimText}</h3>
                  {claim.publicWording ? (
                    <p className="mt-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] leading-5 text-wk-text-muted">
                      Public wording: {claim.publicWording}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">{claim.caveat}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill>{claim.links.length} evidence link(s)</Pill>
                    <Pill tone={summary.contradicts ? "warning" : "neutral"}>{summary.contradicts} contradiction(s)</Pill>
                    <Pill>{summary.supports + summary.weak} support signal(s)</Pill>
                  </div>

                  {claim.links.length ? (
                    <div className="mt-3 space-y-2">
                      {claim.links.slice(0, 4).map((link) => (
                        <div key={`${claim.id}-${link.evidenceId}`} className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone={relationTone(link.relation)}>{link.relation}</Pill>
                            <span className="text-[12px] font-black text-wk-text">{link.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
