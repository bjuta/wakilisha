import { useCallback, useEffect, useMemo, useState } from "react";
import type { InquiryDraft } from "./types";
import {
  type AssistantSuggestion,
  decideSuggestion,
  listAssistantSuggestions,
  runAssistantJob,
} from "@/services/institute/assistantRunService";
import {
  CONFIDENCE_BAND_LABELS,
  RELATIONSHIP_ENTITY_TYPES,
  type InstituteRelationship,
  type RelationshipConfidenceBand,
  type RelationshipEntityType,
  type RelationshipInput,
  createRelationship,
  listRelationships,
  supersedeRelationship,
  withdrawRelationship,
} from "@/services/institute/relationshipService";

// Relationship Mapper. Candidates arrive from the assistant and wait in a
// review queue; judgments are made by humans, stand on evidence, and stay
// on the record even when superseded or withdrawn.

const ENTITY_TYPE_LABELS: Record<RelationshipEntityType, string> = {
  artist: "Artist",
  track: "Track",
  release: "Release",
  label: "Label",
  genre: "Genre",
  scene: "Scene",
  place: "Place",
  event: "Event",
  institution: "Institution",
  person: "Person",
  work: "Work",
  contributor_memory: "Contributor memory",
  evidence_item: "Evidence item",
  claim: "Claim",
  inquiry: "Inquiry",
};

const ACTION_LABELS: Record<string, string> = {
  accept: "Looks ready",
  review_carefully: "Review carefully",
  hold_as_doubt: "Hold as doubt",
};

type CandidatePayload = {
  kind?: string;
  part?: string;
  sourceEntity?: { entity_type: string; label: string; registry_slug: string };
  targetEntity?: { entity_type: string; label: string; registry_slug: string };
  relationshipKind?: string;
  confidenceBand?: string;
  evidenceItemIds?: string[];
  evidenceItemId?: string;
  contradictions?: string[];
  recommendedAction?: string;
  needsEvidence?: boolean;
  fromEntity?: string;
  toEntity?: string;
};

type FormState = {
  mode: "accept" | "manual" | "replace";
  suggestionId: string | null;
  replacing: InstituteRelationship | null;
  sourceType: RelationshipEntityType;
  sourceLabel: string;
  sourceSlug: string;
  targetType: RelationshipEntityType;
  targetLabel: string;
  targetSlug: string;
  kind: string;
  reason: string;
  band: RelationshipConfidenceBand;
  evidenceIds: string[];
  statusReason: string;
};

const emptyForm = (mode: FormState["mode"]): FormState => ({
  mode,
  suggestionId: null,
  replacing: null,
  sourceType: "artist",
  sourceLabel: "",
  sourceSlug: "",
  targetType: "scene",
  targetLabel: "",
  targetSlug: "",
  kind: "",
  reason: "",
  band: "partly_supported",
  evidenceIds: [],
  statusReason: "",
});

function isCandidate(s: AssistantSuggestion): boolean {
  if (s.status !== "suggested" || s.suggestionType !== "relationship_lead") return false;
  const p = s.payload as CandidatePayload;
  return p.kind === "relationship_candidate" || p.part === "possible_relationship";
}

export default function RelationshipsScreen({
  draft,
}: {
  draft: InquiryDraft | null;
}) {
  const [relationships, setRelationships] = useState<InstituteRelationship[]>([]);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");

  const refresh = useCallback(async () => {
    if (!draft) return;
    try {
      const [nextRelationships, nextSuggestions] = await Promise.all([
        listRelationships(draft.id).catch(() => [] as InstituteRelationship[]),
        listAssistantSuggestions(draft.id, 200),
      ]);
      setRelationships(nextRelationships);
      setSuggestions(nextSuggestions);
    } catch {
      setNotice("The relationships could not load. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [draft?.id]);

  useEffect(() => {
    setLoading(true);
    setNotice(null);
    setForm(null);
    void refresh();
  }, [refresh]);

  const candidates = useMemo(() => suggestions.filter(isCandidate), [suggestions]);
  const standing = useMemo(() => relationships.filter((r) => r.status === "accepted"), [relationships]);
  const history = useMemo(() => relationships.filter((r) => r.status !== "accepted"), [relationships]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-8 text-center shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">Relationships</div>
          <h1 className="mt-2 text-[26px] font-black tracking-[-0.04em] text-wk-text">No inquiry selected</h1>
          <p className="mt-2 text-[14px] text-wk-text-muted">Pick an inquiry first. Relationships live inside one inquiry at a time.</p>
        </section>
      </div>
    );
  }

  const runMapper = async () => {
    setRunning(true);
    setNotice(null);
    try {
      await runAssistantJob(draft.id, "relationship_mapper");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The mapper run did not finish.");
    } finally {
      setRunning(false);
    }
  };

  const openAcceptForm = (suggestion: AssistantSuggestion) => {
    const p = suggestion.payload as CandidatePayload;
    const base = emptyForm("accept");
    base.suggestionId = suggestion.id;
    if (p.kind === "relationship_candidate" && p.sourceEntity && p.targetEntity) {
      base.sourceType = (p.sourceEntity.entity_type as RelationshipEntityType) ?? "person";
      base.sourceLabel = p.sourceEntity.label;
      base.sourceSlug = p.sourceEntity.registry_slug ?? "";
      base.targetType = (p.targetEntity.entity_type as RelationshipEntityType) ?? "person";
      base.targetLabel = p.targetEntity.label;
      base.targetSlug = p.targetEntity.registry_slug ?? "";
      base.kind = p.relationshipKind ?? "";
      base.band = (p.confidenceBand as RelationshipConfidenceBand) ?? "partly_supported";
      base.evidenceIds = p.evidenceItemIds ?? [];
    } else {
      // Evidence Reader lead: entities arrive as plain names.
      base.sourceType = "person";
      base.sourceLabel = p.fromEntity ?? "";
      base.targetType = "person";
      base.targetLabel = p.toEntity ?? "";
      base.kind = suggestion.body.replace(/\.$/, "");
      base.evidenceIds = p.evidenceItemId ? [p.evidenceItemId] : [];
    }
    base.reason = suggestion.reason ?? "";
    setForm(base);
  };

  const openReplaceForm = (relationship: InstituteRelationship) => {
    const base = emptyForm("replace");
    base.replacing = relationship;
    base.sourceType = relationship.source.entityType;
    base.sourceLabel = relationship.source.label;
    base.sourceSlug = relationship.source.registrySlug ?? "";
    base.targetType = relationship.target.entityType;
    base.targetLabel = relationship.target.label;
    base.targetSlug = relationship.target.registrySlug ?? "";
    base.kind = relationship.relationshipKind;
    base.band = relationship.confidenceBand;
    base.evidenceIds = relationship.evidenceRefs.map((ref) => ref.id);
    setForm(base);
  };

  const submitForm = async () => {
    if (!form) return;
    setSaving(true);
    setNotice(null);
    const input: RelationshipInput = {
      source: { entityType: form.sourceType, label: form.sourceLabel, registrySlug: form.sourceSlug || null },
      target: { entityType: form.targetType, label: form.targetLabel, registrySlug: form.targetSlug || null },
      relationshipKind: form.kind,
      plainReason: form.reason,
      confidenceBand: form.band,
      evidenceItemIds: form.evidenceIds,
      sourceSuggestionId: form.mode === "accept" ? form.suggestionId : null,
    };
    try {
      if (form.mode === "replace" && form.replacing) {
        await supersedeRelationship(
          { id: draft.id, code: draft.code },
          form.replacing,
          input,
          form.statusReason || "Replaced by a better judgment",
        );
      } else {
        await createRelationship({ id: draft.id, code: draft.code }, input);
      }
      setForm(null);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The relationship could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const decideCandidate = async (suggestion: AssistantSuggestion, decision: "rejected" | "saved_as_doubt") => {
    try {
      await decideSuggestion(suggestion.id, decision);
      await refresh();
    } catch {
      setNotice("That decision could not be saved. Try again.");
    }
  };

  const submitWithdraw = async (relationship: InstituteRelationship) => {
    setSaving(true);
    setNotice(null);
    try {
      await withdrawRelationship({ id: draft.id }, relationship, withdrawReason);
      setWithdrawingId(null);
      setWithdrawReason("");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The withdrawal could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const evidence = draft.evidence ?? [];

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
              Inquiry {draft.code.replace("Inquiry ", "")} · Relationships
            </div>
            <h1 className="mt-3 text-[30px] font-black leading-[1.05] tracking-[-0.06em] text-wk-text lg:text-[34px]">
              Connections with reasons
            </h1>
            <p className="mt-2 max-w-[62ch] text-[13px] leading-6 text-wk-text-muted">
              Working question: <span className="font-bold text-wk-text">{draft.workingQuestion}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => void runMapper()}
              className="rounded-full bg-wk-brand px-5 py-2.5 text-[13px] font-extrabold text-wk-brand-on disabled:opacity-50"
            >
              {running ? "Mapping..." : "Ask the assistant to map relationships"}
            </button>
            <button
              type="button"
              onClick={() => setForm(emptyForm("manual"))}
              className="rounded-full border border-wk-border bg-wk-bg px-5 py-2.5 text-[13px] font-extrabold text-wk-text"
            >
              Add one myself
            </button>
          </div>
        </div>
        {notice && (
          <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] text-wk-text">{notice}</div>
        )}
      </section>

      {candidates.length > 0 && (
        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
          <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">Candidates to review</h2>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            The assistant suggested these. Nothing becomes a relationship until you accept it with evidence.
          </p>
          <div className="mt-4 space-y-3">
            {candidates.map((candidate) => {
              const p = candidate.payload as CandidatePayload;
              const band = p.confidenceBand as RelationshipConfidenceBand | undefined;
              return (
                <article key={candidate.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                    <span className="text-wk-brand">Candidate</span>
                    {band && <span className="normal-case tracking-normal font-bold text-wk-text-faint">{CONFIDENCE_BAND_LABELS[band]}</span>}
                    {p.recommendedAction && (
                      <span className="normal-case tracking-normal font-bold text-wk-text-faint">
                        Assistant says: {ACTION_LABELS[p.recommendedAction] ?? p.recommendedAction}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-[15px] font-black leading-snug text-wk-text">{candidate.body}</h3>
                  {candidate.reason && (
                    <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                      <span className="font-bold">Why this is suggested:</span> {candidate.reason}
                    </p>
                  )}
                  {(p.contradictions ?? []).map((item) => (
                    <p key={item} className="mt-1 text-[12px] text-wk-text-muted">
                      <span className="font-bold">Complication:</span> {item}
                    </p>
                  ))}
                  {p.needsEvidence && (
                    <p className="mt-2 text-[12px] font-bold text-wk-text">
                      No evidence attached yet. It can be held as doubt, but not accepted.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openAcceptForm(candidate)}
                      className="rounded-full bg-wk-brand px-4 py-2 text-[12px] font-extrabold text-wk-brand-on"
                    >
                      Review and accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void decideCandidate(candidate, "saved_as_doubt")}
                      className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted"
                    >
                      Keep as doubt
                    </button>
                    <button
                      type="button"
                      onClick={() => void decideCandidate(candidate, "rejected")}
                      className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {form && (
        <section className="rounded-[22px] border border-wk-brand/25 bg-wk-surface p-6 shadow-sm lg:p-7">
          <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">
            {form.mode === "replace" ? "Replace with a better judgment" : form.mode === "accept" ? "Make this a relationship" : "Add a relationship"}
          </h2>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            Every relationship needs a reason and at least one piece of evidence.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(["source", "target"] as const).map((side) => (
              <div key={side} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
                  {side === "source" ? "From" : "To"}
                </div>
                <div className="mt-2 grid gap-2">
                  <select
                    aria-label={`${side} type`}
                    value={side === "source" ? form.sourceType : form.targetType}
                    onChange={(e) =>
                      setForm((f) => f && { ...f, [side === "source" ? "sourceType" : "targetType"]: e.target.value as RelationshipEntityType })
                    }
                    className="rounded-lg border border-wk-border bg-wk-surface p-2.5 text-[13px] text-wk-text"
                  >
                    {RELATIONSHIP_ENTITY_TYPES.map((t) => (
                      <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <input
                    aria-label={`${side} name`}
                    value={side === "source" ? form.sourceLabel : form.targetLabel}
                    onChange={(e) =>
                      setForm((f) => f && { ...f, [side === "source" ? "sourceLabel" : "targetLabel"]: e.target.value })
                    }
                    placeholder="Name, exactly as written"
                    className="rounded-lg border border-wk-border bg-wk-surface p-2.5 text-[13px] text-wk-text"
                  />
                  <input
                    aria-label={`${side} registry slug`}
                    value={side === "source" ? form.sourceSlug : form.targetSlug}
                    onChange={(e) =>
                      setForm((f) => f && { ...f, [side === "source" ? "sourceSlug" : "targetSlug"]: e.target.value })
                    }
                    placeholder="Registry slug, if it exists"
                    className="rounded-lg border border-wk-border bg-wk-surface p-2.5 text-[12px] text-wk-text-muted"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <input
              aria-label="How they are related"
              value={form.kind}
              onChange={(e) => setForm((f) => f && { ...f, kind: e.target.value })}
              placeholder='How they relate, in a short phrase: "mentored", "grew out of"'
              className="rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] text-wk-text"
            />
            <select
              aria-label="Confidence band"
              value={form.band}
              onChange={(e) => setForm((f) => f && { ...f, band: e.target.value as RelationshipConfidenceBand })}
              className="rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] text-wk-text"
            >
              {Object.entries(CONFIDENCE_BAND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <textarea
            aria-label="Why this relationship holds"
            value={form.reason}
            onChange={(e) => setForm((f) => f && { ...f, reason: e.target.value })}
            rows={2}
            placeholder="Why this holds. A link without a reason is not a relationship."
            className="mt-3 w-full rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] leading-6 text-wk-text"
          />

          {form.mode === "replace" && (
            <input
              aria-label="Why the old judgment is replaced"
              value={form.statusReason}
              onChange={(e) => setForm((f) => f && { ...f, statusReason: e.target.value })}
              placeholder="Why the old judgment gives way to this one."
              className="mt-3 w-full rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] text-wk-text"
            />
          )}

          <div className="mt-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
              Standing on which evidence?
            </div>
            {evidence.length === 0 ? (
              <p className="mt-2 text-[13px] text-wk-text-muted">
                This inquiry has no evidence yet. Add evidence first; a relationship cannot stand on nothing.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {evidence.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-[13px] text-wk-text">
                    <input
                      type="checkbox"
                      checked={form.evidenceIds.includes(item.id)}
                      onChange={(e) =>
                        setForm((f) =>
                          f && {
                            ...f,
                            evidenceIds: e.target.checked
                              ? [...f.evidenceIds, item.id]
                              : f.evidenceIds.filter((id) => id !== item.id),
                          },
                        )
                      }
                      className="mt-1"
                    />
                    <span>
                      {item.title}
                      <span className="text-wk-text-faint"> · {item.reviewState}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || form.evidenceIds.length === 0 || form.reason.trim().length <= 3 || !form.kind.trim() || !form.sourceLabel.trim() || !form.targetLabel.trim()}
              onClick={() => void submitForm()}
              className="rounded-full bg-wk-brand px-5 py-2.5 text-[13px] font-extrabold text-wk-brand-on disabled:opacity-50"
            >
              {saving ? "Saving..." : form.mode === "replace" ? "Replace the judgment" : "Accept this relationship"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setForm(null)}
              className="rounded-full border border-wk-border px-5 py-2.5 text-[13px] font-bold text-wk-text-muted"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">Standing relationships</h2>
        {loading ? (
          <p className="mt-3 text-[13px] text-wk-text-muted">Loading relationships...</p>
        ) : standing.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-wk-border bg-wk-bg px-5 py-8 text-center">
            <p className="text-[14px] font-bold text-wk-text">Nothing has entered this part of the inquiry yet</p>
            <p className="mt-1 text-[13px] text-wk-text-muted">
              Accept a candidate with evidence, or add a relationship yourself.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {standing.map((relationship) => (
              <article key={relationship.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
                  <span className="text-wk-brand">
                    {ENTITY_TYPE_LABELS[relationship.source.entityType]} to {ENTITY_TYPE_LABELS[relationship.target.entityType]}
                  </span>
                  <span className="normal-case tracking-normal font-bold">{CONFIDENCE_BAND_LABELS[relationship.confidenceBand]}</span>
                  <span className="normal-case tracking-normal">
                    Stands on {relationship.evidenceRefs.length} piece{relationship.evidenceRefs.length === 1 ? "" : "s"} of evidence
                  </span>
                </div>
                <h3 className="mt-2 text-[15px] font-black leading-snug text-wk-text">
                  {relationship.source.label} {relationship.relationshipKind} {relationship.target.label}
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                  <span className="font-bold">Why:</span> {relationship.plainReason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openReplaceForm(relationship)}
                    className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text"
                  >
                    Replace with better
                  </button>
                  {withdrawingId === relationship.id ? (
                    <>
                      <input
                        aria-label="Withdrawal reason"
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        placeholder="Why we no longer stand behind it."
                        className="rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text"
                      />
                      <button
                        type="button"
                        disabled={saving || withdrawReason.trim().length <= 3}
                        onClick={() => void submitWithdraw(relationship)}
                        className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text disabled:opacity-50"
                      >
                        Confirm withdrawal
                      </button>
                      <button
                        type="button"
                        onClick={() => { setWithdrawingId(null); setWithdrawReason(""); }}
                        className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWithdrawingId(relationship.id)}
                      className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[13px] font-black uppercase tracking-[0.14em] text-wk-text-faint">On the record</h3>
            <div className="mt-2 space-y-2">
              {history.map((relationship) => (
                <div key={relationship.id} className="rounded-lg border border-wk-border bg-wk-bg px-4 py-3 text-[12px] text-wk-text-muted">
                  <span className="font-bold text-wk-text">
                    {relationship.source.label} {relationship.relationshipKind} {relationship.target.label}
                  </span>{" "}
                  {relationship.status === "superseded" ? "was superseded" : "was withdrawn"}
                  {relationship.statusReason ? <> because {relationship.statusReason}</> : null}.
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
