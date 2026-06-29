import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

function label(value: string) {
  return value.replaceAll("_", " ");
}

function entityName(entities: CulturalEntity[], id: string) {
  return entities.find((entity) => entity.id === id)?.name ?? id;
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
  const canApprove = reason.trim().length > 0 && confidence && hasEvidence;
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
      setNotice("Relationship updated.");
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
        decisionNote: reviewNote.trim() || `Relationship Curator action: ${label(decision)}`,
      });

      setNotice(`Relationship action applied: ${label(decision)}.`);
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
      setNotice("Evidence linked.");
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

      setNotice("Evidence unlinked.");
      setEvidenceLinks(await listRelationshipEvidenceLinks(relationshipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Loading relationship…</div>;
  }

  if (!relationship) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Relationship not found.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Relationship Curator</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">{title}</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">{relationship.reason}</p>
          </div>
          <Link to="/admin/institute/relationships" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Back to Relationships
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-wk-text">Review actions</h2>
            <p className="mt-1 text-[13px] text-wk-text-muted">
              Approval requires a reason, confidence, and at least one evidence link.
            </p>
            {!canApprove ? (
              <p className="mt-2 text-[12px] font-bold text-red-700">Approval is blocked until reason, confidence, and evidence are present.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={reviewing || !canApprove} onClick={() => handleReview("approved")} className="rounded-full bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("needs_more_evidence")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs evidence</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("disputed")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Dispute</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("rejected")} className="rounded-full border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700 hover:border-red-400 disabled:opacity-60">Reject</button>
            <button type="button" disabled={reviewing || relationship.review_status !== "approved"} onClick={() => handleReview("public_safe_enabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:cursor-not-allowed disabled:opacity-50">Public safe</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("public_safe_disabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Internal only</button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <h2 className="text-lg font-black text-wk-text">Relationship detail</h2>
        <form onSubmit={handleSave} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_240px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source entity
              <select value={sourceEntityId} onChange={(event) => setSourceEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Target entity
              <select value={targetEntityId} onChange={(event) => setTargetEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Relationship
              <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {RELATIONSHIP_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_180px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Review status
              <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as RelationshipReviewStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Confidence
              <select value={confidence} onChange={(event) => setConfidence(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Public safe
              <select value={String(publicSafe)} onChange={(event) => setPublicSafe(event.target.value === "true")} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="false">internal</option>
                <option value="true">public safe</option>
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={4} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Review note
            <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div>
            <button type="submit" disabled={saving} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving…" : "Save relationship"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <h2 className="text-lg font-black text-wk-text">Link evidence</h2>
          <form onSubmit={handleLinkEvidence} className="mt-4 grid gap-4">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Evidence
              <select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose evidence</option>
                {evidenceItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Support type
              <select value={supportType} onChange={(event) => setSupportType(event.target.value as RelationshipEvidenceSupportType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {SUPPORT_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Note
              <textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} rows={2} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <div>
              <button type="submit" disabled={linkingEvidence} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {linkingEvidence ? "Linking…" : "Link evidence"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <h2 className="text-lg font-black text-wk-text">Evidence links</h2>
          {evidenceLinks.length === 0 ? (
            <p className="mt-4 text-[13px] text-wk-text-muted">No evidence linked yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {evidenceLinks.map((link) => (
                <article key={`${link.relationship_id}-${link.evidence_id}`} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-wk-brand">{label(link.support_type)}</div>
                      <h3 className="mt-1 text-[14px] font-black text-wk-text">{link.evidence?.title ?? link.evidence_id}</h3>
                      {link.note ? <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{link.note}</p> : null}
                    </div>
                    <button type="button" onClick={() => handleUnlinkEvidence(link)} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40">
                      Unlink
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
