import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  InstituteEvidenceStatePanel,
  InstituteNextMovePanel,
  InstitutePageHeader,
  InstituteRelationshipStatePanel,
  InstituteSectionCard,
  InstituteUncertaintyPanel,
  type InstituteActionItem,
  type InstituteBadgeItem,
  type InstituteInsightItem,
} from "@/components/admin/institute";
import {
  createEntityRelationship,
  linkRelationshipEvidence,
  listCulturalEntities,
  listEntityRelationships,
  listEvidenceItems,
  type CulturalEntity,
  type EntityRelationship,
  type EvidenceItem,
  type InstituteConfidence,
  type RelationshipEvidenceSupportType,
  type RelationshipReviewStatus,
  type RelationshipType,
} from "@/services/institute";

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

export default function AdminInstituteRelationshipsPage() {
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);
  const [entities, setEntities] = useState<CulturalEntity[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [entitySearch, setEntitySearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  const [sourceEntityId, setSourceEntityId] = useState("");
  const [targetEntityId, setTargetEntityId] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("shares_context_with");
  const [reason, setReason] = useState("");
  const [confidence, setConfidence] = useState<InstituteConfidence>("medium");
  const [evidenceId, setEvidenceId] = useState("");
  const [supportType, setSupportType] = useState<RelationshipEvidenceSupportType>("supports");
  const [evidenceNote, setEvidenceNote] = useState("");

  const entityOptions = useMemo(() => entities, [entities]);

  async function loadCurator() {
    setLoading(true);
    setError(null);

    try {
      const [nextRelationships, nextEntities, nextEvidenceItems] = await Promise.all([
        listEntityRelationships({
          reviewStatus: reviewStatus || undefined,
          limit: 100,
        }),
        listCulturalEntities({
          search: entitySearch || undefined,
          limit: 100,
        }),
        listEvidenceItems({
          reviewStatus: "approved",
          limit: 100,
        }),
      ]);

      setRelationships(nextRelationships);
      setEntities(nextEntities);
      setEvidenceItems(nextEvidenceItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurator();
  }, []);

  async function handleCreateRelationship(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const created = await createEntityRelationship({
        source_entity_id: sourceEntityId,
        target_entity_id: targetEntityId,
        relationship_type: relationshipType,
        reason: reason.trim(),
        confidence,
        review_status: "pending_review",
        public_safe: false,
      });

      if (evidenceId) {
        await linkRelationshipEvidence({
          relationship_id: created.id,
          evidence_id: evidenceId,
          support_type: supportType,
          note: evidenceNote.trim() || null,
        });
      }

      setSourceEntityId("");
      setTargetEntityId("");
      setRelationshipType("shares_context_with");
      setReason("");
      setConfidence("medium");
      setEvidenceId("");
      setEvidenceNote("");
      setNotice("Relationship entered the Curator for review.");
      await loadCurator();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const relationshipStateItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "Relationships in view",
      value: relationships.length,
      description: "Possible cultural connections visible under this filter.",
      tone: "info",
    },
    {
      label: "Approved",
      value: relationships.filter((relationship) => relationship.review_status === "approved").length,
      description: "Connections with enough reason and evidence to carry meaning.",
      tone: "good",
    },
    {
      label: "Public-safe",
      value: relationships.filter((relationship) => relationship.public_safe).length,
      description: "Approved connections that may travel beyond internal review.",
      tone: "good",
    },
  ], [relationships]);

  const evidenceStateItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "Approved evidence available",
      value: evidenceItems.length,
      description: "Evidence that can be linked to relationship meaning.",
      tone: evidenceItems.length > 0 ? "good" : "warning",
    },
    {
      label: "Low confidence",
      value: relationships.filter((relationship) => relationship.confidence === "low").length,
      description: "Connections that should stay cautious until strengthened.",
      tone: "warning",
    },
    {
      label: "Rejected or disputed",
      value: relationships.filter((relationship) => relationship.review_status === "rejected" || relationship.review_status === "disputed").length,
      description: "Still useful internally because rejections teach the method.",
      tone: "danger",
    },
  ], [evidenceItems.length, relationships]);

  const uncertaintyItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "Needs judgment",
      value: relationships.filter((relationship) => relationship.review_status === "pending_review" || relationship.review_status === "suggested").length,
      description: "Connections waiting for human review.",
      tone: "warning",
    },
    {
      label: "Internal only",
      value: relationships.filter((relationship) => !relationship.public_safe).length,
      description: "Connections that should not travel publicly yet.",
      tone: "warning",
    },
    {
      label: "Missing stronger confidence",
      value: relationships.filter((relationship) => relationship.confidence !== "high").length,
      description: "Connections that may need more evidence, sharper reason, or restraint.",
      tone: "info",
    },
  ], [relationships]);

  const nextMoves: InstituteActionItem[] = [
    {
      label: "Name a meaningful relationship",
      description: "Connect two cultural references only when the link helps someone understand something.",
      href: "#name-relationship",
      tone: "neutral",
    },
    ...(relationships.some((relationship) => relationship.review_status === "pending_review" || relationship.review_status === "suggested")
      ? [{
          label: "Review waiting relationships",
          description: "Decide which connections need evidence, dispute, rejection, approval, or public-safe review.",
          href: "#relationship-judgment",
          tone: "warning" as const,
        }]
      : []),
    ...(evidenceItems.length === 0
      ? [{
          label: "Approve evidence first",
          description: "Relationship meaning needs evidence before it can carry stronger claims.",
          href: "/admin/institute/evidence",
          tone: "warning" as const,
        }]
      : []),
  ];

  return (
    <div className="space-y-6 p-6">
      <InstitutePageHeader
        eyebrow="Relationship Curator"
        title="Relationship meaning"
        description="A relationship is not adjacency. It must explain what two cultural references help us understand together."
        badges={[
          {
            label: `${relationships.length} in view`,
            description: "Connections visible under this filter.",
            tone: "info",
          },
          {
            label: `${relationships.filter((relationship) => relationship.review_status === "approved").length} approved`,
            description: "Connections that carry reviewed meaning.",
            tone: "good",
          },
          {
            label: `${relationships.filter((relationship) => relationship.public_safe).length} public-safe`,
            description: "Connections approved to travel outside internal review.",
            tone: "good",
          },
        ]}
        actions={[{ label: "Back to Institute", href: "/admin/institute" }]}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <InstituteRelationshipStatePanel items={relationshipStateItems} />
        <InstituteUncertaintyPanel items={uncertaintyItems} />
      </div>

      <InstituteEvidenceStatePanel items={evidenceStateItems} />
      <InstituteNextMovePanel moves={nextMoves} />

      <InstituteSectionCard
        eyebrow="Meaning first"
        title="What does this relationship help someone understand?"
        description="Create a relationship only when the connection has a reason, a confidence level, and evidence that can support it."
      >
        <form id="name-relationship" onSubmit={handleCreateRelationship} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_240px_160px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              First cultural reference
              <select value={sourceEntityId} onChange={(event) => setSourceEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose first reference</option>
                {entityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Second cultural reference
              <select value={targetEntityId} onChange={(event) => setTargetEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose second reference</option>
                {entityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Kind of connection
              <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {RELATIONSHIP_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Claim confidence
              <select value={confidence} onChange={(event) => setConfidence(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Why this connection matters
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={4} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px_1fr]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Evidence already supporting this
              <select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">No evidence link yet</option>
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
              Evidence note
              <input value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
          </div>

          <div>
            <button type="submit" disabled={saving} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Sending..." : "Send to review"}
            </button>
          </div>
        </form>
      </InstituteSectionCard>

      <InstituteSectionCard
        eyebrow="Relationship judgment"
        title="Which relationships need judgment?"
        description="Rejected relationships stay useful internally. Approval and public-safe review stay separate."
      >
        <div id="relationship-judgment" className="grid gap-2 lg:grid-cols-[220px_200px_auto]">
          <input value={entitySearch} onChange={(event) => setEntitySearch(event.target.value)} placeholder="Search cultural references" className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
            <option value="">Any human review state</option>
            {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
          </select>
          <button type="button" onClick={loadCurator} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Filter</button>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">Loading relationships...</p>
        ) : relationships.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
            No relationship meaning is waiting under this filter.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {relationships.map((relationship) => (
              <Link key={relationship.id} to={`/admin/institute/relationships/${relationship.id}`} className="block rounded-3xl border border-wk-border bg-wk-bg p-4 transition hover:border-wk-brand/40">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{humanize(relationship.relationship_type)}</div>
                    <h3 className="mt-1 text-[17px] font-black text-wk-text">
                      {entityName(entities, relationship.source_entity_id)} → {entityName(entities, relationship.target_entity_id)}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-[13px] leading-5 text-wk-text-muted">{relationship.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reviewTone(relationship.review_status) === "good" ? "border-wk-success/30 bg-wk-success-soft text-wk-success" : reviewTone(relationship.review_status) === "danger" ? "border-wk-danger/30 bg-wk-danger-soft text-wk-danger" : reviewTone(relationship.review_status) === "warning" ? "border-wk-warning/30 bg-wk-warning-soft text-wk-warning" : "border-wk-info/30 bg-wk-info-soft text-wk-info"}`}>
                      {humanize(relationship.review_status)}
                    </span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{relationship.confidence} confidence</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${publicSafetyTone(relationship.public_safe) === "good" ? "border-wk-success/30 bg-wk-success-soft text-wk-success" : "border-wk-warning/30 bg-wk-warning-soft text-wk-warning"}`}>
                      {publicSafetyLabel(relationship.public_safe)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </InstituteSectionCard>
    </div>
  );
}
