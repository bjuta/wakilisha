import { useMemo, useState, type ReactNode } from "react";
import type { EvidenceItem, InquiryDraft } from "./types";

type EvidenceRelation =
  | "supports"
  | "weakly supports"
  | "contradicts"
  | "background only"
  | "needs verification";

type FindingStrength =
  | "unsupported"
  | "needs evidence"
  | "workable"
  | "strong"
  | "contested";

type Confidence = "Low" | "Medium" | "High";

type FindingEvidenceLink = {
  evidenceId: string;
  title: string;
  kind: string;
  source: string;
  relation: EvidenceRelation;
  reviewState: string;
  summary: string;
  sourceUrl: string;
};

type FindingRecord = {
  id: string;
  text: string;
  kind: string;
  confidence: Confidence;
  caveat: string;
  strength: FindingStrength;
  links: FindingEvidenceLink[];
  reviewState: string;
  createdAt: string;
};

type NoteRecord = {
  id: string;
  text: string;
  noteType: string;
  createdAt: string;
};

type Props = {
  draft: InquiryDraft | null;
  addEvidence: (
    inquiryId: string,
    evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">,
  ) => Promise<EvidenceItem>;
};

const findingKinds = [
  "Main finding",
  "Supporting finding",
  "Timeline finding",
  "Relationship finding",
  "Correction finding",
  "Context finding",
  "Counterpoint",
];

const noteTypes = [
  "Observation",
  "Question",
  "Interpretation",
  "Doubt",
  "Reminder",
  "To verify",
];

const relationOptions: EvidenceRelation[] = [
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
  children: ReactNode;
  tone?: "brand" | "success" | "warning" | "neutral";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black",
        tone === "brand" &&
          "border-wk-brand/30 bg-wk-brand-soft text-wk-brand",
        tone === "success" &&
          "border-wk-success/30 bg-wk-success-soft text-wk-success",
        tone === "warning" &&
          "border-wk-warning/30 bg-wk-warning-soft text-wk-warning",
        tone === "neutral" &&
          "border-wk-border bg-wk-surface text-wk-text-muted",
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
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm">
      {eyebrow ? (
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-wk-brand">
          <span className="h-px w-7 bg-wk-brand" />
          {eyebrow}
        </div>
      ) : null}

      <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">
        {title}
      </h2>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-wk-border/60 bg-wk-bg-subtle p-4">
      <div className="text-[13px] font-black text-wk-text">{title}</div>
      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{body}</p>
    </div>
  );
}

function metadataOf(item: EvidenceItem) {
  return item.metadata && typeof item.metadata === "object"
    ? item.metadata
    : {};
}

function textValue(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function isLegacyClaim(item: EvidenceItem) {
  const metadata = metadataOf(item);

  return (
    metadata.workspaceType === "claims" &&
    metadata.claimVersion === 1
  );
}

function isFinding(item: EvidenceItem) {
  const metadata = metadataOf(item);

  return (
    isLegacyClaim(item) ||
    (metadata.workspaceType === "findings" &&
      metadata.findingVersion === 1)
  );
}

function isInquiryNote(item: EvidenceItem) {
  const metadata = metadataOf(item);

  return (
    metadata.workspaceType === "notes" &&
    metadata.noteVersion === 1
  );
}

function extractFindings(evidence: EvidenceItem[]): FindingRecord[] {
  return evidence.filter(isFinding).map((item) => {
    const metadata = metadataOf(item);

    return {
      id: item.id,
      text: textValue(
        metadata.findingText ?? metadata.claimText,
        item.summary,
      ),
      kind: textValue(
        metadata.findingKind ?? metadata.claimUse,
        "Finding",
      ),
      confidence: textValue(
        metadata.findingConfidence ?? metadata.claimConfidence,
        "Medium",
      ) as Confidence,
      caveat: textValue(
        metadata.findingCaveat ?? metadata.claimCaveat,
      ),
      strength: textValue(
        metadata.findingStrength ?? metadata.claimStrength,
        "unsupported",
      ) as FindingStrength,
      links: Array.isArray(metadata.attachedEvidence)
        ? (metadata.attachedEvidence as FindingEvidenceLink[])
        : [],
      reviewState: item.reviewState,
      createdAt: item.createdAt,
    };
  });
}

function extractNotes(evidence: EvidenceItem[]): NoteRecord[] {
  return evidence.filter(isInquiryNote).map((item) => {
    const metadata = metadataOf(item);

    return {
      id: item.id,
      text: textValue(metadata.noteText, item.summary),
      noteType: textValue(metadata.noteType, "Note"),
      createdAt: item.createdAt,
    };
  });
}

function strengthForLinks(
  links: FindingEvidenceLink[],
): FindingStrength {
  const supports = links.filter(
    (link) => link.relation === "supports",
  ).length;

  const weakSupports = links.filter(
    (link) => link.relation === "weakly supports",
  ).length;

  const contradicts = links.filter(
    (link) => link.relation === "contradicts",
  ).length;

  const needsVerification = links.filter(
    (link) => link.relation === "needs verification",
  ).length;

  if (!links.length) return "unsupported";
  if (contradicts > 0) return "contested";
  if (supports >= 2 && needsVerification === 0) return "strong";
  if (supports >= 1 || weakSupports >= 2) return "workable";

  return "needs evidence";
}

function toneForStrength(
  strength: FindingStrength,
): "success" | "warning" | "neutral" {
  if (strength === "strong" || strength === "workable") {
    return "success";
  }

  if (
    strength === "contested" ||
    strength === "needs evidence" ||
    strength === "unsupported"
  ) {
    return "warning";
  }

  return "neutral";
}

function relationTone(
  relation: EvidenceRelation,
): "success" | "warning" | "neutral" {
  if (relation === "supports") return "success";

  if (
    relation === "contradicts" ||
    relation === "needs verification"
  ) {
    return "warning";
  }

  return "neutral";
}

export function InstituteClaimsWorkspace({
  draft,
  addEvidence,
}: Props) {
  const evidence = draft?.evidence ?? [];

  const findings = useMemo(
    () => extractFindings(evidence),
    [evidence],
  );

  const notes = useMemo(
    () => extractNotes(evidence),
    [evidence],
  );

  const sourceMaterial = evidence.filter(
    (item) => !isFinding(item) && !isInquiryNote(item),
  );

  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState(noteTypes[0]);
  const [findingText, setFindingText] = useState("");
  const [findingKind, setFindingKind] = useState(findingKinds[0]);
  const [confidence, setConfidence] = useState<Confidence>("Medium");
  const [caveat, setCaveat] = useState("");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [relations, setRelations] = useState<
    Record<string, EvidenceRelation>
  >({});
  const [savingNote, setSavingNote] = useState(false);
  const [savingFinding, setSavingFinding] = useState(false);
  const [notice, setNotice] = useState("");

  const attachedMaterial = selectedMaterialIds
    .map((id) => {
      const item = sourceMaterial.find(
        (material) => material.id === id,
      );

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
      } satisfies FindingEvidenceLink;
    })
    .filter(Boolean) as FindingEvidenceLink[];

  const liveStrength = strengthForLinks(attachedMaterial);

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

    setRelations((current) => ({
      ...current,
      [id]: current[id] ?? "supports",
    }));
  };

  const saveNote = async () => {
    if (!draft || noteText.trim().length < 3 || savingNote) return;

    setSavingNote(true);
    setNotice("");

    try {
      await addEvidence(draft.id, {
        title: `${noteType}: ${noteText.trim().slice(0, 96)}`,
        kind: "Personal note",
        source: "Inquiry notes",
        sourceUrl: "",
        summary: noteText.trim(),
        whyItMatters: noteType,
        mediaMinutes: 0,
        reviewState: "Draft",
        metadata: {
          workspaceVersion: 1,
          workspaceFormat: "Note",
          workspaceType: "notes",
          savedFrom: "inquiry_notes_findings",
          noteVersion: 1,
          noteType,
          noteText: noteText.trim(),
          inquiryCode: draft.code,
        },
      });

      setNoteText("");
      setNoteType(noteTypes[0]);
      setNotice("Note saved.");
    } finally {
      setSavingNote(false);
    }
  };

  const saveFinding = async () => {
    if (
      !draft ||
      findingText.trim().length < 8 ||
      caveat.trim().length < 4 ||
      savingFinding
    ) {
      return;
    }

    setSavingFinding(true);
    setNotice("");

    try {
      const strength = strengthForLinks(attachedMaterial);
      const reviewState =
        strength === "strong" || strength === "workable"
          ? "Needs review"
          : "Needs more evidence";

      await addEvidence(draft.id, {
        title: `${findingKind}: ${findingText.trim().slice(0, 96)}`,
        kind: "Personal note",
        source: "Inquiry findings",
        sourceUrl: "",
        summary: findingText.trim(),
        whyItMatters: findingKind,
        mediaMinutes: 0,
        reviewState,
        metadata: {
          workspaceVersion: 1,
          workspaceFormat: "Finding",
          workspaceType: "findings",
          savedFrom: "inquiry_notes_findings",
          findingVersion: 1,
          findingText: findingText.trim(),
          findingKind,
          findingConfidence: confidence,
          findingCaveat: caveat.trim(),
          findingStrength: strength,
          attachedEvidence: attachedMaterial,
          inquiryCode: draft.code,
          inquiryQuestion: draft.workingQuestion,
        },
      });

      setFindingText("");
      setFindingKind(findingKinds[0]);
      setConfidence("Medium");
      setCaveat("");
      setSelectedMaterialIds([]);
      setRelations({});
      setNotice("Finding saved.");
    } finally {
      setSavingFinding(false);
    }
  };

  if (!draft) {
    return (
      <Panel eyebrow="Notes and findings" title="Choose an Inquiry">
        <EmptyState
          title="No Inquiry selected"
          body="Return to Inquiries and choose the question you want to continue."
        />
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
          Notes and findings
        </div>

        <h2 className="mt-3 text-[30px] font-black tracking-[-0.055em] text-wk-text">
          Think openly. Record carefully.
        </h2>

        <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
          Notes can stay uncertain. Findings should show what supports them
          and what could still change.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Pill>{notes.length} notes</Pill>
          <Pill>{findings.length} findings</Pill>
          <Pill>{sourceMaterial.length} material items</Pill>
        </div>
      </section>

      {notice ? (
        <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft px-4 py-3 text-[12px] font-bold text-wk-text-muted">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel eyebrow="Add a note" title="Save something worth remembering">
          <div className="space-y-4">
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Note type
              </span>

              <select
                value={noteType}
                onChange={(event) => setNoteType(event.target.value)}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] font-bold text-wk-text"
              >
                {noteTypes.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Note
              </span>

              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={6}
                placeholder="Write the observation, question, doubt, or reminder."
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[14px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <button
              type="button"
              disabled={noteText.trim().length < 3 || savingNote}
              onClick={() => void saveNote()}
              className="rounded-lg bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingNote ? "Saving..." : "Save Note"}
            </button>
          </div>
        </Panel>

        <Panel eyebrow="Add a finding" title="Record what the Inquiry can support">
          <div className="space-y-4">
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Finding
              </span>

              <textarea
                value={findingText}
                onChange={(event) => setFindingText(event.target.value)}
                rows={5}
                placeholder="What can the Inquiry currently stand behind?"
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[14px] font-bold leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                  Kind
                </span>

                <select
                  value={findingKind}
                  onChange={(event) => setFindingKind(event.target.value)}
                  className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] font-bold text-wk-text"
                >
                  {findingKinds.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                  Confidence
                </span>

                <select
                  value={confidence}
                  onChange={(event) =>
                    setConfidence(event.target.value as Confidence)
                  }
                  className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2.5 text-[13px] font-bold text-wk-text"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
            </div>

            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                What could change this?
              </span>

              <textarea
                value={caveat}
                onChange={(event) => setCaveat(event.target.value)}
                rows={3}
                placeholder="Record the limit, doubt, contradiction, or missing source."
                className="w-full resize-y rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] leading-6 text-wk-text outline-none focus:border-wk-brand"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                  Current support
                </div>
                <div className="mt-2">
                  <Pill tone={toneForStrength(liveStrength)}>
                    {liveStrength}
                  </Pill>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  findingText.trim().length < 8 ||
                  caveat.trim().length < 4 ||
                  savingFinding
                }
                onClick={() => void saveFinding()}
                className="rounded-lg bg-wk-text px-5 py-3 text-[13px] font-black text-wk-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingFinding ? "Saving..." : "Save Finding"}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Supporting material" title="What supports or challenges the finding?">
        {!sourceMaterial.length ? (
          <EmptyState
            title="No material available"
            body="Add material before recording a supported finding."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {sourceMaterial.map((item) => {
              const selected = selectedMaterialIds.includes(item.id);
              const relation = relations[item.id] ?? "supports";

              return (
                <article
                  key={item.id}
                  className={cx(
                    "rounded-xl border p-4",
                    selected
                      ? "border-wk-brand bg-wk-brand-soft"
                      : "border-wk-border bg-wk-bg",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleMaterial(item.id)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={selected ? "brand" : "neutral"}>
                        {selected ? "Attached" : "Attach"}
                      </Pill>
                      <Pill>{item.kind}</Pill>
                    </div>

                    <h3 className="mt-3 text-[14px] font-black text-wk-text">
                      {item.title}
                    </h3>

                    <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-wk-text-muted">
                      {item.summary}
                    </p>
                  </button>

                  {selected ? (
                    <div className="mt-3">
                      <select
                        value={relation}
                        onChange={(event) =>
                          setRelations((current) => ({
                            ...current,
                            [item.id]: event.target
                              .value as EvidenceRelation,
                          }))
                        }
                        className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-bold text-wk-text"
                      >
                        {relationOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>

                      <div className="mt-2">
                        <Pill tone={relationTone(relation)}>
                          {relation}
                        </Pill>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel eyebrow="Notes" title="Working thoughts">
          {!notes.length ? (
            <EmptyState
              title="No notes yet"
              body="Save observations, questions, doubts, and reminders here."
            />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-xl border border-wk-border bg-wk-bg p-4"
                >
                  <Pill tone="brand">{note.noteType}</Pill>

                  <p className="mt-3 text-[13px] leading-6 text-wk-text">
                    {note.text}
                  </p>

                  <p className="mt-3 text-[11px] text-wk-text-faint">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Findings" title="What the Inquiry can currently support">
          {!findings.length ? (
            <EmptyState
              title="No findings yet"
              body="Record a finding when material gives the Inquiry something it can stand behind."
            />
          ) : (
            <div className="space-y-3">
              {findings.map((finding) => (
                <article
                  key={finding.id}
                  className="rounded-xl border border-wk-border bg-wk-bg p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="brand">{finding.kind}</Pill>
                    <Pill tone={toneForStrength(finding.strength)}>
                      {finding.strength}
                    </Pill>
                    <Pill>{finding.confidence} confidence</Pill>
                  </div>

                  <h3 className="mt-3 text-[15px] font-black leading-6 text-wk-text">
                    {finding.text}
                  </h3>

                  {finding.caveat ? (
                    <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                      What could change this: {finding.caveat}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill>{finding.links.length} supporting links</Pill>
                    <Pill>{finding.reviewState}</Pill>
                  </div>

                  <p className="mt-3 text-[11px] text-wk-text-faint">
                    {new Date(finding.createdAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
