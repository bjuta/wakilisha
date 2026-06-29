import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

function label(value: string) {
  return value.replaceAll("_", " ");
}

function entityName(entities: CulturalEntity[], id: string) {
  return entities.find((entity) => entity.id === id)?.name ?? id;
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
      setNotice("Relationship created.");
      await loadCurator();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Relationship Curator</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">Relationships</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Curate cultural relationships with reason, evidence, confidence, and human review.
            </p>
          </div>
          <Link to="/admin/institute" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Back to Institute
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <h2 className="text-lg font-black text-wk-text">Create relationship</h2>
        <form onSubmit={handleCreateRelationship} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_240px_160px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source entity
              <select value={sourceEntityId} onChange={(event) => setSourceEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose source</option>
                {entityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Target entity
              <select value={targetEntityId} onChange={(event) => setTargetEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose target</option>
                {entityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Relationship
              <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as RelationshipType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {RELATIONSHIP_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Confidence
              <select value={confidence} onChange={(event) => setConfidence(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px_1fr]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Evidence link
              <select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">No evidence link yet</option>
                {evidenceItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Support
              <select value={supportType} onChange={(event) => setSupportType(event.target.value as RelationshipEvidenceSupportType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {SUPPORT_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Evidence note
              <input value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
          </div>

          <div>
            <button type="submit" disabled={saving} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Creating…" : "Create relationship"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-wk-text">Curator queue</h2>
            <p className="mt-1 text-[13px] text-wk-text-muted">Rejected relationships stay visible internally. Public-safe is separate from approval.</p>
          </div>
          <div className="grid gap-2 lg:grid-cols-[220px_200px_auto]">
            <input value={entitySearch} onChange={(event) => setEntitySearch(event.target.value)} placeholder="Search entities" className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
              <option value="">Any review</option>
              {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
            </select>
            <button type="button" onClick={loadCurator} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Filter</button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">Loading relationships…</p>
        ) : relationships.length === 0 ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">No relationships found.</p>
        ) : (
          <div className="mt-4 divide-y divide-wk-border">
            {relationships.map((relationship) => (
              <Link key={relationship.id} to={`/admin/institute/relationships/${relationship.id}`} className="block py-4 hover:bg-wk-bg/60">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-wk-brand">{label(relationship.relationship_type)}</div>
                    <h3 className="mt-1 text-[16px] font-black text-wk-text">
                      {entityName(entities, relationship.source_entity_id)} → {entityName(entities, relationship.target_entity_id)}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-wk-text-muted">{relationship.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{label(relationship.review_status)}</span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{relationship.confidence}</span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{relationship.public_safe ? "public safe" : "internal"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
