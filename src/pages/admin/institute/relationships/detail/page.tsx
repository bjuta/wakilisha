import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  InstituteDecisionLog,
  InstituteEvidenceStatePanel,
  InstituteNextMovePanel,
  InstitutePageHeader,
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
  getEntityRelationship,
  linkRelationshipEvidence,
  listCulturalEntities,
  listEvidenceItems,
  listRelationshipEvidenceLinks,
  reviewEntityRelationship,
  unlinkRelationshipEvidence,
  updateEntityRelationship,
  type CulturalEntity,
  type EntityRelationship,
  type EvidenceItem,
  type InstituteConfidence,
  type InstituteRelationshipReviewAction,
  type RelationshipEvidenceLink,
  type RelationshipEvidenceSupportType,
  type RelationshipReviewStatus,
  type RelationshipType,
} from "@/services/institute";
import { useParams } from "react-router-dom";

const RELATIONSHIP_TYPES: RelationshipType[] = [
  "collaborated_with",
  "appeared_on",
  "released_by",
  "produced_by",
  "belongs_to_scene",
  "connected_to_place",
  "uses_language",
  "charted_with",
  "mentioned_in",
  "remembered_for",
  "influenced_by",
  "influenced",
  "shares_context_with",
  "opened_question",
  "disputed_by",
  "corrected_by",
];

const REVIEW_STATUSES: RelationshipReviewStatus[] = ["suggested", "pending_review", "approved", "rejected", "disputed"];
const CONFIDENCE_OPTIONS: InstituteConfidence[] = ["low", "medium", "high"];
const SUPPORT_TYPES: RelationshipEvidenceSupportType[] = ["supports", "challenges", "contextualizes"];

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function entityName(entities: CulturalEntity[], id: string) {
  return entities.find((entity) => entity.id === id)?.name ?? id;
}

function reviewTone(status: RelationshipReviewStatus): InstituteBadgeItem["tone"] {
  if (status === "approved") return "good";
  if (status === "rejected" || status === "disputed") return "danger";
  if (status === "pending_review" || status === "suggested") return "warning";
  return "info";
}

function publicSafetyLabel(isSafe: boolean) {
  return isSafe ? "public-safe" : "internal only";
}

function publicSafetyTone(isSafe: boolean): InstituteBadgeItem["tone"] {
  return isSafe ? "good" : "warning";
}

export default function AdminInstituteRelationshipDetailPage() {
  const { relationshipId } = useParams();

  const [relationship, setRelationship] = useState<EntityRelationship | null>(null);
  const [entities, setEntities] = useState<CulturalEntity[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<RelationshipEvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [linkingEvidence, setLinkingEvidence] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [sourceEntityId, setSourceEntityId] = useState("");
  const [targetEntityId, setTargetEntityId] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("shares_context_with");
  const [reason, setReason] = useState("");
  const [confidence, setConfidence] = useState<InstituteConfidence>("medium");
  const [reviewStatus, setReviewStatus] = useState<RelationshipReviewStatus>("pending_review");
  const [publicSafe, setPublicSafe] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const [evidenceId, setEvidenceId] = useState("");
  const [supportType, setSupportType] = useState<RelationshipEvidenceSupportType>("supports");
  const [evidenceNote, setEvidenceNote] = useState("");

  const hasEvidence = evidenceLinks.length > 0;
  const hasReason = reason.trim().length > 0;
  const canApprove = hasReason && confidence && hasEvidence;
  const canMarkPublicSafe = relationship?.review_status === "approved";

  const title = useMemo(() => {
    if (!relationship) return "Relationship";
    return `${entityName(entities, relationship.source_entity_id)} → ${entityName(entities, relationship.target_entity_id)}`;
  }, [entities, relationship]);

  async function loadRelationship() {
    if (!relationshipId) return;

    setLoading(true);
    setError(null);

    try {
      const [nextRelationship, nextEntities, nextEvidenceItems, nextEvidenceLinks] = await Promise.all([
        getEntityRelationship(relationshipId),
        listCulturalEntities({ limit: 100 }),
        listEvidenceItems({ limit: 100 }),
        listRelationshipEvidenceLinks(relationshipId),
      ]);

      if (!nextRelationship) {
        throw new Error("Relationship not found.");
      }

      setRelationship(nextRelationship);
      setEntities(nextEntities);
      setEvidenceItems(nextEvidenceItems);
      setEvidenceLinks(nextEvidenceLinks);

      setSourceEntityId(nextRelationship.source_entity_id);
      setTargetEntityId(nextRelationship.target_entity_id);
      setRelationshipType(nextRelationship.relationship_type);
      setReason(nextRelationship.reason);
      setConfidence(nextRelationship.confidence);
      setReviewStatus(nextRelationship.review_status);
      setPublicSafe(nextRelationship.public_safe);
      setReviewNote(nextRelationship.review_note ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRelationship();
  }, [relationshipId]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!relationshipId) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const updated = await updateEntityRelationship(relationshipId, {
        source_entity_id: sourceEntityId,
        target_entity_id: targetEntityId,
        relationship_type: relationshipType,
        reason: reason.trim(),
        confidence,
        review_status: reviewStatus,
        public_safe: publicSafe,
        review_note: reviewNote.trim() || null,
      });

      setRelationship(updated);
      setNotice("Relationship meaning updated.");
      await loadRelationship();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(decision: InstituteRelationshipReviewAction) {
    if (!relationshipId) return;

    setReviewing(true);
    setError(null);
    setNotice(null);

    try {
      await reviewEntityRelationship({
        relationshipId,
        decision,
        decisionNote: reviewNote.trim() || `Relationship Curator action: ${humanize(decision)}`,
      });

      setNotice(`Relationship action applied: ${humanize(decision)}.`);
      await loadRelationship();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewing(false);
    }
  }

  async function handleLinkEvidence(event: FormEvent) {
    event.preventDefault();
    if (!relationshipId || !evidenceId) return;

    setLinkingEvidence(true);
    setError(null);
    setNotice(null);

    try {
      await linkRelationshipEvidence({
        relationship_id: relationshipId,
        evidence_id: evidenceId,
        support_type: supportType,
        note: evidenceNote.trim() || null,
      });

      setEvidenceId("");
      setEvidenceNote("");
      setNotice("Evidence attached to the relationship.");
      setEvidenceLinks(await listRelationshipEvidenceLinks(relationshipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLinkingEvidence(false);
    }
  }

  async function handleUnlinkEvidence(link: RelationshipEvidenceLink) {
    if (!relationshipId) return;

    setError(null);
    setNotice(null);

    try {
      await unlinkRelationshipEvidence({
        relationship_id: relationshipId,
        evidence_id: link.evidence_id,
      });

      setNotice("Evidence removed from this relationship.");
      setEvidenceLinks(await listRelationshipEvidenceLinks(relationshipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const relationshipStateItems: InstituteInsightItem[] = useMemo(() => {
    if (!relationship) return [];

    return [
      {
        label: "Where this stands",
        value: humanize(relationship.review_status),
        description: relationship.review_status === "approved" ? "This relationship has reviewed meaning." : "This relationship still needs human judgment.",
        tone: reviewTone(relationship.review_status),
      },
      {
        label: "Public safety",
        value: publicSafetyLabel(relationship.public_safe),
        description: relationship.public_safe ? "This relationship can travel beyond internal review." : "This relationship stays internal until approved for travel.",
        tone: publicSafetyTone(relationship.public_safe),
      },
      {
        label: "Evidence links",
        value: evidenceLinks.length,
        description: "Evidence currently attached to this relationship.",
        tone: evidenceLinks.length > 0 ? "good" : "warning",
      },
    ];
  }, [relationship, evidenceLinks.length]);

  const evidenceStateItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "Supports",
      value: evidenceLinks.filter((link) => link.support_type === "supports").length,
      description: "Evidence that supports the relationship.",
      tone: "good",
    },
    {
      label: "Challenges",
      value: evidenceLinks.filter((link) => link.support_type === "challenges").length,
      description: "Evidence that limits or challenges the relationship.",
      tone: "warning",
    },
    {
      label: "Context",
      value: evidenceLinks.filter((link) => link.support_type === "contextualizes").length,
      description: "Evidence that gives background without proving the relationship alone.",
      tone: "info",
    },
  ], [evidenceLinks]);

  const uncertaintyItems: InstituteInsightItem[] = useMemo(() => {
    if (!relationship) return [];

    return [
      {
        label: "Approval blocked",
        value: canApprove ? "No" : "Yes",
        description: canApprove ? "Reason, confidence, and evidence are present." : "Approval is blocked until reason, confidence, and evidence are present.",
        tone: canApprove ? "good" : "warning",
      },
      {
        label: "Confidence",
        value: relationship.confidence,
        description: relationship.confidence === "high" ? "The relationship is strongly held." : "The relationship may need stronger evidence or a sharper reason.",
        tone: relationship.confidence === "high" ? "good" : "info",
      },
      {
        label: "Travel risk",
        value: relationship.public_safe ? "Lower" : "High",
        description: relationship.public_safe ? "Still use with context." : "Do not surface this as public meaning yet.",
        tone: relationship.public_safe ? "info" : "danger",
      },
    ];
  }, [relationship, canApprove]);

  const decisionItems: InstituteDecisionItem[] = relationship
    ? [
        {
          label: `Human review: ${humanize(relationship.review_status)}`,
          reason: relationship.review_note ?? "No reviewer note has been added yet.",
          meta: relationship.reviewed_at ? new Date(relationship.reviewed_at).toLocaleString() : "waiting",
          tone: reviewTone(relationship.review_status),
        },
        {
          label: `Public safety: ${publicSafetyLabel(relationship.public_safe)}`,
          reason: relationship.public_safe ? "This relationship has been marked safe for public travel." : "This relationship remains internal.",
          tone: publicSafetyTone(relationship.public_safe),
        },
      ]
    : [];

  const nextMoves: InstituteActionItem[] = relationship
    ? [
        ...(!hasEvidence
          ? [{
              label: "Attach evidence",
              description: "Relationship approval needs at least one evidence link.",
              href: "#relationship-evidence",
              tone: "warning" as const,
            }]
          : []),
        ...(!hasReason
          ? [{
              label: "Write the reason",
              description: "The reason should explain what the relationship helps someone understand.",
              href: "#shape-relationship",
              tone: "warning" as const,
            }]
          : []),
        ...(relationship.review_status !== "approved"
          ? [{
              label: "Review the relationship",
              description: "Approve, dispute, reject, or request stronger evidence.",
              href: "#review-relationship",
              tone: "warning" as const,
            }]
          : []),
        ...(relationship.review_status === "approved" && !relationship.public_safe
          ? [{
              label: "Consider public safety",
              description: "Only approved relationships should be marked safe to travel.",
              href: "#review-relationship",
              tone: "info" as const,
            }]
          : []),
      ]
    : [];

  if (loading) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Opening relationship...</div>;
  }

  if (!relationship) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Relationship could not be found.</div>;
  }

  const safeToSay = hasReason ? [relationship.reason] : [];
  const cannotSayYet = [
    ...(!hasEvidence ? ["This relationship does not have enough evidence yet."] : []),
    ...(relationship.review_status !== "approved" ? ["This relationship should not carry strong claims yet."] : []),
    ...(!relationship.public_safe ? ["This relationship should remain internal until public-safe review is complete."] : []),
  ];

  return (
    <div className="space-y-6 p-6">
      <InstitutePageHeader
        eyebrow="Relationship Curator"
        title={title}
        description="A meaningful relationship must explain something, carry evidence, show uncertainty, and stay internal until it is safe to travel."
        badges={[
          {
            label: `Where this stands: ${humanize(relationship.review_status)}`,
            description: relationship.review_status === "approved" ? "Reviewed relationship meaning." : "Still waiting for judgment.",
            tone: reviewTone(relationship.review_status),
          },
          {
            label: `Public safety: ${publicSafetyLabel(relationship.public_safe)}`,
            description: relationship.public_safe ? "Safe to travel beyond internal review." : "Internal until reviewed further.",
            tone: publicSafetyTone(relationship.public_safe),
          },
          {
            label: `${evidenceLinks.length} evidence links`,
            description: "Evidence attached to this relationship.",
            tone: evidenceLinks.length > 0 ? "good" : "warning",
          },
        ]}
        actions={[{ label: "Back to Relationships", href: "/admin/institute/relationships" }]}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <InstituteSectionCard
        eyebrow="Meaning first"
        title="What does this relationship help someone understand?"
        description="Separate a useful cultural relationship from shallow adjacency."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-wk-border bg-wk-bg p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">What this helps explain</div>
            <p className="mt-2 text-[14px] leading-6 text-wk-text-soft">{relationship.reason}</p>
          </div>
          <div className="rounded-2xl border border-wk-border bg-wk-bg p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-warning">What this does not prove</div>
            <p className="mt-2 text-[14px] leading-6 text-wk-text-soft">
              This relationship does not prove influence, importance, or public meaning beyond its evidence and review.
            </p>
          </div>
        </div>
      </InstituteSectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <InstituteUnderstandingPanel
          currentUnderstanding={relationship.reason}
          safeToSay={safeToSay}
          cannotSayYet={cannotSayYet}
          confidenceLabel={`${relationship.confidence} confidence`}
        />
        <InstituteUncertaintyPanel items={uncertaintyItems} />
      </div>

      <InstituteRelationshipStatePanel items={relationshipStateItems} />
      <InstituteEvidenceStatePanel items={evidenceStateItems} />
      <InstituteDecisionLog decisions={decisionItems} />
      <InstituteNextMovePanel moves={nextMoves} />

      <InstituteSectionCard
        eyebrow="Review"
        title="Decide how far this relationship can travel"
        description="Approval requires a reason, confidence, and evidence. Public safety is a separate decision."
      >
        <div id="review-relationship" className="grid gap-4">
          {!canApprove ? (
            <p className="rounded-2xl border border-wk-warning/30 bg-wk-warning-soft p-3 text-[13px] font-bold leading-5 text-wk-warning">
              Approval is blocked until reason, confidence, and evidence are present.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={reviewing || !canApprove} onClick={() => handleReview("approved")} className="rounded-full bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("needs_more_evidence")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs stronger evidence</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("disputed")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Dispute</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("rejected")} className="rounded-full border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700 hover:border-red-400 disabled:opacity-60">Reject</button>
            <button type="button" disabled={reviewing || !canMarkPublicSafe} onClick={() => handleReview("public_safe_enabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:cursor-not-allowed disabled:opacity-50">Mark public-safe</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("public_safe_disabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Keep internal</button>
          </div>
        </div>
      </InstituteSectionCard>

      <InstituteSectionCard
        eyebrow="Shape relationship"
        title="Edit the meaning, safety, and review notes"
        description="Use this when the reason, confidence, human review state, or safety boundary changes."
      >
        <form id="shape-relationship" onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_240px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              First cultural reference
              <select value={sourceEntityId} onChange={(event) => setSourceEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Second cultural reference
              <select value={targetEntityId} onChange={(event) => setTargetEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Kind of connection
              <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {RELATIONSHIP_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Where this stands
              <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as RelationshipReviewStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Claim confidence
              <select value={confidence} onChange={(event) => setConfidence(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Public safety
              <select value={String(publicSafe)} onChange={(event) => setPublicSafe(event.target.value === "true")} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="false">internal only</option>
                <option value="true">public-safe</option>
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Why this connection matters
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={4} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Reviewer note
            <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div>
            <button type="submit" disabled={saving} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : "Save relationship"}
            </button>
          </div>
        </form>
      </InstituteSectionCard>

      <section id="relationship-evidence" className="grid gap-6 xl:grid-cols-2">
        <InstituteSectionCard
          eyebrow="Evidence strength"
          title="Attach evidence to the relationship"
          description="Evidence can support, challenge, or contextualize the connection."
        >
          <form onSubmit={handleLinkEvidence} className="grid gap-4">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Evidence
              <select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose evidence</option>
                {evidenceItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Evidence role
              <select value={supportType} onChange={(event) => setSupportType(event.target.value as RelationshipEvidenceSupportType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {SUPPORT_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Note
              <textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} rows={2} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <div>
              <button type="submit" disabled={linkingEvidence} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {linkingEvidence ? "Attaching..." : "Attach evidence"}
              </button>
            </div>
          </form>
        </InstituteSectionCard>

        <InstituteSectionCard
          eyebrow="Evidence map"
          title="Evidence attached to this relationship"
          description="Review what supports, challenges, or contextualizes the connection before approval."
        >
          {evidenceLinks.length === 0 ? (
            <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
              No evidence is attached to this relationship yet.
            </p>
          ) : (
            <div className="grid gap-3">
              {evidenceLinks.map((link) => (
                <article key={`${link.relationship_id}-${link.evidence_id}`} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{humanize(link.support_type)}</div>
                      <h3 className="mt-1 text-[14px] font-black text-wk-text">{link.evidence?.title ?? link.evidence_id}</h3>
                      {link.note ? <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{link.note}</p> : null}
                    </div>
                    <button type="button" onClick={() => handleUnlinkEvidence(link)} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40">
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </InstituteSectionCard>
      </section>
    </div>
  );
}
