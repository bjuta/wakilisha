import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createCulturalEntityReference,
  createInquiryNote,
  getInquiry,
  linkEntityToInquiry,
  listCulturalEntities,
  listInquiryEntityLinks,
  listInquiryNotes,
  unlinkEntityFromInquiry,
  updateInquiry,
  type CulturalEntity,
  type CulturalEntityType,
  type Inquiry,
  type InquiryEntityLink,
  type InquiryEntityRole,
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

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function AdminInstituteInquiryDetailPage() {
  const { inquiryId } = useParams();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [notes, setNotes] = useState<InquiryNote[]>([]);
  const [entityLinks, setEntityLinks] = useState<InquiryEntityLink[]>([]);
  const [entities, setEntities] = useState<CulturalEntity[]>([]);

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
      const [nextInquiry, nextNotes, nextLinks, nextEntities] = await Promise.all([
        getInquiry(inquiryId),
        listInquiryNotes(inquiryId),
        listInquiryEntityLinks(inquiryId),
        listCulturalEntities({ search: entitySearch || undefined, limit: 50 }),
      ]);

      if (!nextInquiry) {
        throw new Error("Inquiry not found.");
      }

      setInquiry(nextInquiry);
      setNotes(nextNotes);
      setEntityLinks(nextLinks);
      setEntities(nextEntities);

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
      setEntities(await listCulturalEntities({ search: entitySearch || undefined, limit: 50 }));
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
      setNotice("Inquiry updated.");
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
      setNotice("Inquiry note added.");
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
      setNotice("Entity linked to Inquiry.");
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
      setNotice("Entity reference created and linked.");
      const [nextLinks, nextEntities] = await Promise.all([
        listInquiryEntityLinks(inquiryId),
        listCulturalEntities({ search: entitySearch || undefined, limit: 50 }),
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
      setNotice("Entity unlinked.");
      setEntityLinks(await listInquiryEntityLinks(inquiryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Loading Inquiry Workbench…</div>;
  }

  if (!inquiry) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Inquiry not found.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Inquiry {inquiry.inquiry_number}</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">{inquiry.title}</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">{inquiry.primary_question}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/institute/inquiries" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
              Back to Inquiries
            </Link>
            <Link to="/admin/institute/review" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
              Review queue
            </Link>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <h2 className="text-lg font-black text-wk-text">Inquiry basics</h2>
        <form onSubmit={handleSaveBasics} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Visibility
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as InquiryVisibility)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Primary question
            <textarea value={primaryQuestion} onChange={(event) => setPrimaryQuestion(event.target.value)} required rows={2} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Short question
            <input value={shortQuestion} onChange={(event) => setShortQuestion(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Why it matters
            <textarea value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} required rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Summary
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Current understanding
            <textarea value={currentUnderstanding} onChange={(event) => setCurrentUnderstanding(event.target.value)} rows={4} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div>
            <button type="submit" disabled={savingBasics} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {savingBasics ? "Saving…" : "Save Inquiry"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <h2 className="text-lg font-black text-wk-text">Add note</h2>
          <form onSubmit={handleCreateNote} className="mt-4 grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Note type
                <select value={noteType} onChange={(event) => setNoteType(event.target.value as InquiryNoteType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                  {NOTE_TYPES.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
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
              Title
              <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Body
              <textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} required rows={4} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <div>
              <button type="submit" disabled={savingNote} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {savingNote ? "Adding…" : "Add note"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <h2 className="text-lg font-black text-wk-text">Notes</h2>
          {notes.length === 0 ? (
            <p className="mt-4 text-[13px] text-wk-text-muted">No notes yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {notes.map((note) => (
                <article key={note.id} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{statusLabel(note.note_type)}</span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{note.confidence}</span>
                  </div>
                  {note.title ? <h3 className="mt-3 text-[14px] font-black text-wk-text">{note.title}</h3> : null}
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-wk-text-muted">{note.body}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <h2 className="text-lg font-black text-wk-text">Link existing entity reference</h2>
          <div className="mt-4 flex gap-2">
            <input value={entitySearch} onChange={(event) => setEntitySearch(event.target.value)} placeholder="Search entity references" className="min-w-0 flex-1 rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            <button type="button" onClick={refreshEntitySearch} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Search</button>
          </div>

          <form onSubmit={handleLinkEntity} className="mt-4 grid gap-4">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Entity
              <select value={selectedEntityId} onChange={(event) => setSelectedEntityId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose entity</option>
                {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Role
              <select value={entityRole} onChange={(event) => setEntityRole(event.target.value as InquiryEntityRole)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {ENTITY_ROLES.map((role) => <option key={role} value={role}>{statusLabel(role)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Link note
              <textarea value={entityLinkNote} onChange={(event) => setEntityLinkNote(event.target.value)} rows={2} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <div>
              <button type="submit" disabled={savingEntity} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                Link entity
              </button>
            </div>
          </form>

          <form onSubmit={handleCreateAndLinkEntity} className="mt-6 grid gap-4 border-t border-wk-border pt-5">
            <h3 className="text-[14px] font-black text-wk-text">Create reference and link</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Entity name
                <input value={newEntityName} onChange={(event) => setNewEntityName(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Entity type
                <select value={newEntityType} onChange={(event) => setNewEntityType(event.target.value as CulturalEntityType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                  {ENTITY_TYPES.map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Source table
                <input value={newEntitySourceTable} onChange={(event) => setNewEntitySourceTable(event.target.value)} placeholder="registry_artists" className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Source id
                <input value={newEntitySourceId} onChange={(event) => setNewEntitySourceId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
              </label>
            </div>
            <div>
              <button type="submit" disabled={savingEntity} className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40 disabled:cursor-not-allowed disabled:opacity-60">
                Create and link
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <h2 className="text-lg font-black text-wk-text">Linked entities</h2>
          {entityLinks.length === 0 ? (
            <p className="mt-4 text-[13px] text-wk-text-muted">No entity references linked yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {entityLinks.map((link) => (
                <article key={link.id} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-wk-brand">{statusLabel(link.entity_role)}</div>
                      <h3 className="mt-1 text-[14px] font-black text-wk-text">{link.entity?.name ?? link.entity_id}</h3>
                      <p className="mt-1 text-[12px] text-wk-text-muted">{link.entity?.entity_type ?? "entity"}</p>
                    </div>
                    <button type="button" onClick={() => handleUnlinkEntity(link.id)} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40">
                      Unlink
                    </button>
                  </div>
                  {link.link_note ? <p className="mt-3 text-[13px] leading-5 text-wk-text-muted">{link.link_note}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
