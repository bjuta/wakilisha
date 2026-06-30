import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  InstituteContributionStatePanel,
  InstituteDecisionLog,
  InstituteEvidenceStatePanel,
  InstituteNextMovePanel,
  InstitutePageHeader,
  InstituteQuestionPanel,
  InstituteRelationshipStatePanel,
  InstituteSectionCard,
  InstituteUnderstandingPanel,
  InstituteUncertaintyPanel,
  type InstituteActionItem,
  type InstituteBadgeItem,
  type InstituteDecisionItem,
  type InstituteInsightItem,
} from "@/components/admin/institute";
import {
  createCulturalEntityReference,
  createInquiryNote,
  getInquiry,
  linkEntityToInquiry,
  listContributorSubmissions,
  listCulturalEntities,
  listEntityRelationships,
  listInquiryEntityLinks,
  listInquiryEvidenceLinks,
  listInquiryNotes,
  unlinkEntityFromInquiry,
  updateInquiry,
  type ContributorSubmission,
  type CulturalEntity,
  type CulturalEntityType,
  type EntityRelationship,
  type Inquiry,
  type InquiryEntityLink,
  type InquiryEntityRole,
  type InquiryEvidenceLink,
  type InquiryNote,
  type InquiryNoteType,
  type InquiryStatus,
  type InquiryVisibility,
  type InstituteConfidence,
} from "@/services/institute";

const STATUS_OPTIONS: InquiryStatus[] = ["draft", "open", "active", "paused", "closed"];
const VISIBILITY_OPTIONS: InquiryVisibility[] = ["internal", "private", "public"];
const NOTE_TYPES: InquiryNoteType[] = ["known_known", "known_unknown", "unknown_unknown", "memory", "open_question", "decision_note"];
const CONFIDENCE_OPTIONS: InstituteConfidence[] = ["low", "medium", "high"];
const ENTITY_TYPES: CulturalEntityType[] = ["artist", "track", "release", "label", "genre", "place", "scene", "language", "article", "inquiry", "memory", "source"];
const ENTITY_ROLES: InquiryEntityRole[] = ["primary_subject", "related_subject", "context", "place", "scene", "language", "source"];

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function noteText(note: InquiryNote) {
  return note.title ? `${note.title}: ${note.body}` : note.body;
}

function statusTone(status: InquiryStatus): InstituteBadgeItem["tone"] {
  if (status === "active" || status === "open") return "good";
  if (status === "paused") return "warning";
  if (status === "closed") return "neutral";
  return "info";
}

function visibilityTone(visibility: InquiryVisibility): InstituteBadgeItem["tone"] {
  if (visibility === "public") return "warning";
  if (visibility === "private") return "info";
  return "neutral";
}

function noteTypeLabel(value: InquiryNoteType) {
  switch (value) {
    case "known_known":
      return "Known";
    case "known_unknown":
      return "Still missing";
    case "unknown_unknown":
      return "Blind spot";
    case "memory":
      return "Memory";
    case "open_question":
      return "Open question";
    case "decision_note":
      return "Decision";
    default:
      return humanize(value);
  }
}

function uniqueRelationships(relationships: EntityRelationship[]) {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    if (seen.has(relationship.id)) return false;
    seen.add(relationship.id);
    return true;
  });
}

export default function AdminInstituteInquiryDetailPage() {
  const { inquiryId } = useParams();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [notes, setNotes] = useState<InquiryNote[]>([]);
  const [entityLinks, setEntityLinks] = useState<InquiryEntityLink[]>([]);
  const [entities, setEntities] = useState<CulturalEntity[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<InquiryEvidenceLink[]>([]);
  const [submissions, setSubmissions] = useState<ContributorSubmission[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingBasics, setSavingBasics] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingEntity, setSavingEntity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [primaryQuestion, setPrimaryQuestion] = useState("");
  const [shortQuestion, setShortQuestion] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [summary, setSummary] = useState("");
  const [currentUnderstanding, setCurrentUnderstanding] = useState("");
  const [status, setStatus] = useState<InquiryStatus>("draft");
  const [visibility, setVisibility] = useState<InquiryVisibility>("internal");

  const [noteType, setNoteType] = useState<InquiryNoteType>("known_known");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteConfidence, setNoteConfidence] = useState<InstituteConfidence>("medium");

  const [entitySearch, setEntitySearch] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [entityRole, setEntityRole] = useState<InquiryEntityRole>("related_subject");
  const [entityLinkNote, setEntityLinkNote] = useState("");

  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityType, setNewEntityType] = useState<CulturalEntityType>("artist");
  const [newEntitySourceTable, setNewEntitySourceTable] = useState("");
  const [newEntitySourceId, setNewEntitySourceId] = useState("");

  async function loadWorkbench() {
    if (!inquiryId) return;

    setLoading(true);
    setError(null);

    try {
      const [nextInquiry, nextNotes, nextLinks, nextEntities, nextEvidenceLinks, nextSubmissions] = await Promise.all([
        getInquiry(inquiryId),
        listInquiryNotes(inquiryId),
        listInquiryEntityLinks(inquiryId),
        listCulturalEntities({ search: entitySearch || undefined, limit: 100 }),
        listInquiryEvidenceLinks(inquiryId),
        listContributorSubmissions({ inquiryId, limit: 100 }),
      ]);

      if (!nextInquiry) {
        throw new Error("Inquiry not found.");
      }

      const entityIds = Array.from(new Set(nextLinks.map((link) => link.entity_id))).slice(0, 12);
      const relationshipGroups = await Promise.all(
        entityIds.map((entityId) => listEntityRelationships({ entityId, limit: 50 })),
      );

      setInquiry(nextInquiry);
      setNotes(nextNotes);
      setEntityLinks(nextLinks);
      setEntities(nextEntities);
      setEvidenceLinks(nextEvidenceLinks);
      setSubmissions(nextSubmissions);
      setRelationships(uniqueRelationships(relationshipGroups.flat()));

      setTitle(nextInquiry.title);
      setPrimaryQuestion(nextInquiry.primary_question);
      setShortQuestion(nextInquiry.short_question ?? "");
      setWhyItMatters(nextInquiry.why_it_matters);
      setSummary(nextInquiry.summary ?? "");
      setCurrentUnderstanding(nextInquiry.current_understanding ?? "");
      setStatus(nextInquiry.status);
      setVisibility(nextInquiry.visibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshEntitySearch() {
    try {
      setEntities(await listCulturalEntities({ search: entitySearch || undefined, limit: 100 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    loadWorkbench();
  }, [inquiryId]);

  async function handleSaveBasics(event: FormEvent) {
    event.preventDefault();
    if (!inquiryId) return;

    setSavingBasics(true);
    setNotice(null);
    setError(null);

    try {
      const updated = await updateInquiry(inquiryId, {
        title: title.trim(),
        primary_question: primaryQuestion.trim(),
        short_question: shortQuestion.trim() || null,
        why_it_matters: whyItMatters.trim(),
        summary: summary.trim() || null,
        current_understanding: currentUnderstanding.trim() || null,
        status,
        visibility,
        closed_at: status === "closed" ? new Date().toISOString() : null,
      });

      setInquiry(updated);
      setNotice("Inquiry shaped.");
      await loadWorkbench();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingBasics(false);
    }
  }

  async function handleCreateNote(event: FormEvent) {
    event.preventDefault();
    if (!inquiryId) return;

    setSavingNote(true);
    setNotice(null);
    setError(null);

    try {
      await createInquiryNote({
        inquiry_id: inquiryId,
        note_type: noteType,
        title: noteTitle.trim() || null,
        body: noteBody.trim(),
        confidence: noteConfidence,
      });

      setNoteTitle("");
      setNoteBody("");
      setNoteConfidence("medium");
      setNotice("Memory added to the Inquiry.");
      setNotes(await listInquiryNotes(inquiryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingNote(false);
    }
  }

  async function handleLinkEntity(event: FormEvent) {
    event.preventDefault();
    if (!inquiryId || !selectedEntityId) return;

    setSavingEntity(true);
    setNotice(null);
    setError(null);

    try {
      await linkEntityToInquiry({
        inquiry_id: inquiryId,
        entity_id: selectedEntityId,
        entity_role: entityRole,
        link_note: entityLinkNote.trim() || null,
      });

      setSelectedEntityId("");
      setEntityLinkNote("");
      setNotice("Cultural reference added to this Inquiry.");
      setEntityLinks(await listInquiryEntityLinks(inquiryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEntity(false);
    }
  }

  async function handleCreateAndLinkEntity(event: FormEvent) {
    event.preventDefault();
    if (!inquiryId) return;

    setSavingEntity(true);
    setNotice(null);
    setError(null);

    try {
      const created = await createCulturalEntityReference({
        entity_type: newEntityType,
        name: newEntityName.trim(),
        source_table: newEntitySourceTable.trim() || null,
        source_id: newEntitySourceId.trim() || null,
        status: "active",
      });

      await linkEntityToInquiry({
        inquiry_id: inquiryId,
        entity_id: created.id,
        entity_role: entityRole,
        link_note: entityLinkNote.trim() || null,
      });

      setNewEntityName("");
      setNewEntitySourceTable("");
      setNewEntitySourceId("");
      setEntityLinkNote("");
      setNotice(`${created.name} is now part of this Inquiry.`);

      const [nextLinks, nextEntities] = await Promise.all([
        listInquiryEntityLinks(inquiryId),
        listCulturalEntities({ search: entitySearch || undefined, limit: 100 }),
      ]);

      setEntityLinks(nextLinks);
      setEntities(nextEntities);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEntity(false);
    }
  }

  async function handleUnlinkEntity(linkId: string) {
    if (!inquiryId) return;

    setNotice(null);
    setError(null);

    try {
      await unlinkEntityFromInquiry(linkId);
      setNotice("Cultural reference removed from this Inquiry.");
      setEntityLinks(await listInquiryEntityLinks(inquiryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const noteGroups = useMemo(() => {
    return {
      known: notes.filter((note) => note.note_type === "known_known"),
      missing: notes.filter((note) => note.note_type === "known_unknown"),
      blindSpots: notes.filter((note) => note.note_type === "unknown_unknown"),
      memory: notes.filter((note) => note.note_type === "memory"),
      openQuestions: notes.filter((note) => note.note_type === "open_question"),
      decisions: notes.filter((note) => note.note_type === "decision_note"),
    };
  }, [notes]);

  const headerBadges: InstituteBadgeItem[] = inquiry
    ? [
        {
          label: `Where this stands: ${humanize(inquiry.status)}`,
          description: inquiry.status === "active" ? "The question is moving." : "This tells editors how much attention the Inquiry needs.",
          tone: statusTone(inquiry.status),
        },
        {
          label: `Audience: ${humanize(inquiry.visibility)}`,
          description: inquiry.visibility === "public" ? "Be careful. Public visibility needs stronger evidence." : "This Inquiry is still being shaped internally.",
          tone: visibilityTone(inquiry.visibility),
        },
        {
          label: `Evidence links: ${evidenceLinks.length}`,
          description: evidenceLinks.length > 0 ? "Evidence is attached to the question." : "No evidence has been attached yet.",
          tone: evidenceLinks.length > 0 ? "good" : "warning",
        },
      ]
    : [];

  const safeToSay = [
    ...noteGroups.known.slice(0, 4).map(noteText),
    ...(inquiry?.current_understanding ? [inquiry.current_understanding] : []),
  ].slice(0, 5);

  const cannotSayYet = [
    ...noteGroups.missing.map(noteText),
    ...noteGroups.blindSpots.map(noteText),
    ...noteGroups.openQuestions.map(noteText),
  ].slice(0, 6);

  const uncertaintyItems: InstituteInsightItem[] = [
    {
      label: "Still missing",
      value: noteGroups.missing.length,
      description: "Named gaps that need source, memory, or review.",
      tone: noteGroups.missing.length > 0 ? "warning" : "neutral",
    },
    {
      label: "Blind spots",
      value: noteGroups.blindSpots.length,
      description: "Things the team has admitted it may not know yet.",
      tone: noteGroups.blindSpots.length > 0 ? "danger" : "neutral",
    },
    {
      label: "Open questions",
      value: noteGroups.openQuestions.length,
      description: "Questions that should shape the next round of work.",
      tone: noteGroups.openQuestions.length > 0 ? "info" : "neutral",
    },
  ];

  const evidenceItems: InstituteInsightItem[] = [
    {
      label: "Attached",
      value: evidenceLinks.length,
      description: "Evidence connected directly to this Inquiry.",
      tone: evidenceLinks.length > 0 ? "good" : "warning",
    },
    {
      label: "Approved",
      value: evidenceLinks.filter((link) => link.evidence?.review_status === "approved").length,
      description: "Reviewed evidence that can safely support stronger claims.",
      tone: "good",
    },
    {
      label: "Ready for default use",
      value: evidenceLinks.filter((link) => link.evidence?.retrieval_status === "default_retrieval").length,
      description: "Approved memory that can support future drafting safely.",
      tone: "info",
    },
  ];

  const contributionItems: InstituteInsightItem[] = [
    {
      label: "New memory",
      value: submissions.filter((submission) => submission.review_status === "submitted").length,
      description: "Contributor memory waiting for a first read.",
      tone: "warning",
    },
    {
      label: "Needs source",
      value: submissions.filter((submission) => submission.review_status === "needs_source").length,
      description: "Useful memory that cannot be trusted yet.",
      tone: "warning",
    },
    {
      label: "Accepted",
      value: submissions.filter((submission) => ["accepted_as_memory", "accepted_as_evidence"].includes(submission.review_status)).length,
      description: "Contribution already absorbed into Institute memory.",
      tone: "good",
    },
  ].filter((item) => item.value !== 0);

  const relationshipItems: InstituteInsightItem[] = [
    {
      label: "Reviewed",
      value: relationships.filter((relationship) => relationship.review_status === "approved").length,
      description: "Connections that have reason, confidence, evidence, and review.",
      tone: "good",
    },
    {
      label: "Needs review",
      value: relationships.filter((relationship) => ["suggested", "pending_review"].includes(relationship.review_status)).length,
      description: "Connections that still need judgment.",
      tone: "warning",
    },
    {
      label: "Rejected but remembered",
      value: relationships.filter((relationship) => relationship.review_status === "rejected").length,
      description: "Rejected relationships stay visible internally so the team remembers why.",
      tone: "neutral",
    },
  ].filter((item) => item.value !== 0);

  const decisionItems: InstituteDecisionItem[] = noteGroups.decisions.map((note) => ({
    label: note.title ?? "Decision recorded",
    reason: note.body,
    meta: `${note.confidence} confidence`,
    tone: "info",
  }));

  const nextMoves: InstituteActionItem[] = [
    ...(!currentUnderstanding.trim()
      ? [{
          label: "Write the best answer today",
          description: "Capture what WAKILISHA can honestly say right now.",
          href: "#shape-inquiry",
          tone: "warning" as const,
        }]
      : []),
    ...(evidenceLinks.length === 0
      ? [{
          label: "Attach evidence",
          description: "Open the Evidence Room and connect reviewed sources to this question.",
          href: "/admin/institute/evidence",
          tone: "warning" as const,
        }]
      : []),
    ...(cannotSayYet.length === 0
      ? [{
          label: "Name what is missing",
          description: "Add a missing piece, blind spot, or open question.",
          href: "#add-memory",
          tone: "info" as const,
        }]
      : []),
    ...(entityLinks.length === 0
      ? [{
          label: "Add a cultural reference",
          description: "Connect the people, works, places, scenes, or languages in view.",
          href: "#cultural-references",
          tone: "info" as const,
        }]
      : []),
    {
      label: "Add memory",
      description: "Record a known, unknown, memory, open question, or decision.",
      href: "#add-memory",
      tone: "neutral",
    },
  ];

  if (loading) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Opening the Inquiry Workbench...</div>;
  }

  if (!inquiry) {
    return <div className="p-6 text-[13px] text-wk-text-muted">This Inquiry could not be found.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <InstitutePageHeader
        eyebrow="Inquiry Workbench"
        title={`${inquiry.inquiry_number}: ${inquiry.title}`}
        description="Carry the question through understanding, evidence, contribution, relationships, decisions, and the next honest move."
        question={inquiry.primary_question}
        badges={headerBadges}
        actions={[{ label: "Back to Inquiries", href: "/admin/institute/inquiries" }]}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <InstituteQuestionPanel
        question={inquiry.primary_question}
        shortQuestion={inquiry.short_question}
        whyItMatters={inquiry.why_it_matters}
        badges={[
          { label: `Stage: ${humanize(inquiry.status)}`, description: "The working state of this Inquiry.", tone: statusTone(inquiry.status) },
          { label: `Visibility: ${humanize(inquiry.visibility)}`, description: "Who can safely see this work right now.", tone: visibilityTone(inquiry.visibility) },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <InstituteUnderstandingPanel
          currentUnderstanding={inquiry.current_understanding}
          safeToSay={safeToSay}
          cannotSayYet={cannotSayYet}
          confidenceLabel={safeToSay.length > 0 ? "working understanding" : "not yet formed"}
        />
        <InstituteUncertaintyPanel items={uncertaintyItems} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <InstituteEvidenceStatePanel items={evidenceItems} />
        </div>
        <InstituteContributionStatePanel items={contributionItems} />
      </div>

      <InstituteRelationshipStatePanel items={relationshipItems} />
      <InstituteDecisionLog decisions={decisionItems} />
      <InstituteNextMovePanel moves={nextMoves} />

      <InstituteSectionCard
        eyebrow="Shape the Inquiry"
        title="Edit the working question"
        description="Use this when the question, current understanding, or public readiness changes."
      >
        <form id="shape-inquiry" onSubmit={handleSaveBasics} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Where this stands
              <select value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Who can see it
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as InquiryVisibility)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Primary question
            <textarea value={primaryQuestion} onChange={(event) => setPrimaryQuestion(event.target.value)} required rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Short question
              <input value={shortQuestion} onChange={(event) => setShortQuestion(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Why this matters
              <input value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Short internal summary
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Best answer today
            <textarea value={currentUnderstanding} onChange={(event) => setCurrentUnderstanding(event.target.value)} rows={5} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div>
            <button type="submit" disabled={savingBasics} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {savingBasics ? "Saving..." : "Save Inquiry"}
            </button>
          </div>
        </form>
      </InstituteSectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <InstituteSectionCard
          eyebrow="Add memory"
          title="Add what changed"
          description="Record knowns, missing pieces, blind spots, memories, open questions, or decisions."
        >
          <form id="add-memory" onSubmit={handleCreateNote} className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Memory type
                <select value={noteType} onChange={(event) => setNoteType(event.target.value as InquiryNoteType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                  {NOTE_TYPES.map((type) => <option key={type} value={type}>{noteTypeLabel(type)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Confidence
                <select value={noteConfidence} onChange={(event) => setNoteConfidence(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                  {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Optional title
              <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>

            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Memory
              <textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} required rows={5} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>

            <div>
              <button type="submit" disabled={savingNote} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {savingNote ? "Adding..." : "Add memory"}
              </button>
            </div>
          </form>
        </InstituteSectionCard>

        <InstituteSectionCard
          eyebrow="Memory trail"
          title="What has entered the Inquiry?"
          description="This is the working memory of the question."
        >
          {notes.length === 0 ? (
            <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
              Nothing has entered this Inquiry yet. Add the first known, missing piece, memory, or decision.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <article key={note.id} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{noteTypeLabel(note.note_type)}</div>
                      {note.title ? <h3 className="mt-1 text-[14px] font-black text-wk-text">{note.title}</h3> : null}
                    </div>
                    <span className="rounded-full border border-wk-border px-3 py-1 text-[11px] font-bold text-wk-text-muted">{note.confidence}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[13px] leading-5 text-wk-text-muted">{note.body}</p>
                </article>
              ))}
            </div>
          )}
        </InstituteSectionCard>
      </div>

      <InstituteSectionCard
        eyebrow="Cultural references"
        title="Who and what belongs in this Inquiry?"
        description="Connect the people, works, places, scenes, languages, and source references that help the question breathe."
      >
        <div id="cultural-references" className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <form onSubmit={handleLinkEntity} className="grid gap-4 rounded-2xl border border-wk-border bg-wk-bg p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                  Search references
                  <input value={entitySearch} onChange={(event) => setEntitySearch(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" />
                </label>
                <button type="button" onClick={refreshEntitySearch} className="self-end rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">
                  Search
                </button>
              </div>

              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Existing reference
                <select value={selectedEntityId} onChange={(event) => setSelectedEntityId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text">
                  <option value="">Choose a reference</option>
                  {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {humanize(entity.entity_type)}</option>)}
                </select>
              </label>

              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                  Role in the question
                  <select value={entityRole} onChange={(event) => setEntityRole(event.target.value as InquiryEntityRole)} className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text">
                    {ENTITY_ROLES.map((role) => <option key={role} value={role}>{humanize(role)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                  Why it belongs here
                  <input value={entityLinkNote} onChange={(event) => setEntityLinkNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" />
                </label>
              </div>

              <div>
                <button type="submit" disabled={savingEntity || !selectedEntityId} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                  Add reference
                </button>
              </div>
            </form>

            <form onSubmit={handleCreateAndLinkEntity} className="grid gap-4 rounded-2xl border border-wk-border bg-wk-bg p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                  New reference name
                  <input value={newEntityName} onChange={(event) => setNewEntityName(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" />
                </label>
                <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                  Kind of reference
                  <select value={newEntityType} onChange={(event) => setNewEntityType(event.target.value as CulturalEntityType)} className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text">
                    {ENTITY_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                  Source table
                  <input value={newEntitySourceTable} onChange={(event) => setNewEntitySourceTable(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" />
                </label>
                <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                  Source ID
                  <input value={newEntitySourceId} onChange={(event) => setNewEntitySourceId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text" />
                </label>
              </div>

              <div>
                <button type="submit" disabled={savingEntity} className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40 disabled:cursor-not-allowed disabled:opacity-60">
                  Create and add reference
                </button>
              </div>
            </form>
          </div>

          <div>
            {entityLinks.length === 0 ? (
              <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
                No cultural references are attached yet. Add the first person, work, place, scene, language, or source in view.
              </p>
            ) : (
              <div className="space-y-3">
                {entityLinks.map((link) => (
                  <article key={link.id} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{humanize(link.entity_role)}</div>
                        <h3 className="mt-1 text-[14px] font-black text-wk-text">{link.entity?.name ?? link.entity_id}</h3>
                        {link.link_note ? <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{link.link_note}</p> : null}
                      </div>
                      <button type="button" onClick={() => handleUnlinkEntity(link.id)} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40">
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </InstituteSectionCard>
    </div>
  );
}
