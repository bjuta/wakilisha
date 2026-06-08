import { useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  loadArtistReviewQueue,
  loadArtistSplitPromotionPreview,
  loadArtistSplitRelationshipPreview,
  promoteArtistSplitRelationship,
  saveArtistCollaborationSplit,
  saveArtistReviewDecision,
  searchRegistryArtists,
  linkExistingSplitMember,
  splitArtistTitle,
  type ArtistReviewDecision,
  type ArtistReviewRow,
  type ArtistSplitPromotionPreviewRow,
  type ArtistSplitRelationshipPreviewRow,
  type RegistryArtistCandidate,
} from "@/services/artistReviewResolver";

type LoadState = "loading" | "ready" | "error";
type Filter = "all" | "undecided" | "decided" | "composite";

const DECISIONS: Array<{ key: ArtistReviewDecision; label: string; tone: string }> = [
  { key: "approve_create", label: "Approve create", tone: "brand" },
  { key: "approve_match", label: "Approve match", tone: "success" },
  { key: "mark_duplicate", label: "Mark duplicate", tone: "warning" },
  { key: "split_collaboration", label: "Split collaboration", tone: "brand" },
  { key: "defer", label: "Defer", tone: "neutral" },
  { key: "reject", label: "Reject", tone: "danger" },
];

export default function AdminArtistReviewPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [filter, setFilter] = useState<Filter>("undecided");
  const [rows, setRows] = useState<ArtistReviewRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitPreview, setSplitPreview] = useState<ArtistSplitPromotionPreviewRow[]>([]);
  const [relationshipPreview, setRelationshipPreview] = useState<ArtistSplitRelationshipPreviewRow[]>([]);
  const [error, setError] = useState("");
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  async function reload(nextFilter = filter, preferredNextId?: string | null) {
    setState("loading");
    setError("");
    try {
      const [data, preview, relationships] = await Promise.all([
        loadArtistReviewQueue(nextFilter),
        loadArtistSplitPromotionPreview(),
        loadArtistSplitRelationshipPreview(),
      ]);
      setRows(data);
      setSplitPreview(preview);
      setRelationshipPreview(relationships);
      setSelectedId((current) => {
        if (preferredNextId && data.some((row) => row.id === preferredNextId)) return preferredNextId;
        if (current && data.some((row) => row.id === current)) return current;
        return data[0]?.id ?? null;
      });
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load artist review queue.");
      setState("error");
    }
  }

  useEffect(() => { reload(filter); }, []);

  function changeFilter(next: Filter) {
    setFilter(next);
    reload(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Phase 2 Resolver</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">Artist Review</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            Review 1,102 imported WAKILISHA artist records. Decisions are recorded safely and do not promote data yet.
          </p>
        </div>
        <button onClick={() => reload()} className="wk-button wk-button-ghost wk-button-sm">
          <WkIcon name="RefreshCw" size={14} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["undecided", "composite", "decided", "all"] as Filter[]).map((item) => (
          <button
            key={item}
            onClick={() => changeFilter(item)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold capitalize ${filter === item ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface text-wk-text-muted"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {state === "loading" && <WkSurface className="p-6 text-[13px] text-wk-text-muted">Loading artist review queue…</WkSurface>}
      {state === "error" && <WkSurface className="p-6 text-[13px] text-wk-danger">{error}</WkSurface>}

      {state === "ready" && (
        <>
        <SplitPreviewPanel rows={splitPreview} onChanged={() => reload(filter)} />
        <RelationshipPreviewPanel rows={relationshipPreview} />

        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <WkSurface className="overflow-hidden p-0">
            <div className="border-b border-wk-border p-4">
              <div className="text-[14px] font-bold text-wk-text">Queue</div>
              <div className="text-[11px] text-wk-text-muted">{rows.length} rows in this filter</div>
            </div>
            <div className="max-h-[720px] overflow-auto divide-y divide-wk-border">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`block w-full p-4 text-left hover:bg-wk-surface-raised ${selected?.id === row.id ? "bg-wk-brand-soft/40" : ""}`}
                >
                  <div className="truncate text-[13px] font-bold text-wk-text">{row.source_title || row.source_record_id}</div>
                  <div className="mt-1 truncate text-[11px] text-wk-text-muted">{row.proposed_slug} · {row.source_status || "unknown"}</div>
                  <div className="mt-2 flex gap-2">
                    <Pill label={`${row.candidate_count ?? 0} candidates`} />
                    {row.decision && <Pill label={row.decision} />}
                  </div>
                </button>
              ))}
            </div>
          </WkSurface>

          {selected ? (
            <ArtistReviewDetail
              row={selected}
              onSaved={() => {
                const currentIndex = rows.findIndex((item) => item.id === selected.id);
                const nextRow = rows[currentIndex + 1] ?? rows[currentIndex - 1] ?? null;
                reload(filter, nextRow?.id ?? null);
              }}
            />
          ) : (
            <WkSurface className="p-8 text-center text-[13px] text-wk-text-muted">No rows in this filter.</WkSurface>
          )}
        </div>
        </>
      )}
    </div>
  );
}

function ArtistReviewDetail({ row, onSaved }: { row: ArtistReviewRow; onSaved: () => void }) {
  const [notes, setNotes] = useState(row.decision_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [candidateTerm, setCandidateTerm] = useState(row.source_title ?? "");
  const [candidates, setCandidates] = useState<RegistryArtistCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<RegistryArtistCandidate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotes(row.decision_notes ?? "");
    setCandidateTerm(row.source_title ?? "");
    setCandidates([]);
    setSelectedCandidate(null);
    setError("");
  }, [row.id]);

  async function search() {
    setError("");
    try {
      setCandidates(await searchRegistryArtists(candidateTerm));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search artists.");
    }
  }

  async function decide(decision: ArtistReviewDecision) {
    setSaving(true);
    setError("");

    try {
      if (decision === "split_collaboration") {
        await saveArtistCollaborationSplit({
          staging_record_id: row.staging_record_id,
          members: splitArtistTitle(row.source_title || ""),
          notes,
        });
      } else {
        await saveArtistReviewDecision({
          staging_record_id: row.staging_record_id,
          decision,
          target_artist_id: decision === "approve_match" ? selectedCandidate?.id ?? null : null,
          target_artist_slug: decision === "approve_match" ? selectedCandidate?.slug ?? null : row.proposed_slug,
          notes,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save decision.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-wk-brand">Source Artist</div>
            <h2 className="mt-1 text-[28px] font-black tracking-tight text-wk-text">{row.source_title}</h2>
            <div className="mt-2 text-[12px] text-wk-text-muted">
              WP ID {row.source_record_id} · {row.source_post_type} · {row.source_status}
            </div>
          </div>
          <div className="rounded-xl border border-wk-border bg-wk-surface-raised px-4 py-3 text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Proposed slug</div>
            <div className="mt-1 text-[13px] font-bold text-wk-text">{row.proposed_slug}</div>
          </div>
        </div>
      </WkSurface>

      {splitArtistTitle(row.source_title || "").length > 1 && (
        <WkSurface className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand">
              <WkIcon name="GitBranch" size={18} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-wk-text">Suggested collaboration split</h3>
              <p className="mt-1 text-[12px] text-wk-text-muted">
                This source artist looks like a composite collaboration. Split it into individual artist identities and preserve the relationship.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {splitArtistTitle(row.source_title || "").map((member) => (
                  <span key={member.member_order} className="rounded-full border border-wk-border bg-wk-surface-raised px-3 py-1 text-[12px] font-bold text-wk-text">
                    {member.display_name} <span className="text-wk-text-faint">/{member.proposed_slug}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </WkSurface>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <WkSurface className="p-5">
          <h3 className="text-[14px] font-bold text-wk-text">Match candidate</h3>
          <div className="mt-3 flex gap-2">
            <input value={candidateTerm} onChange={(e) => setCandidateTerm(e.target.value)} className="wk-input flex-1" />
            <button onClick={search} className="wk-button wk-button-ghost wk-button-sm">Search</button>
          </div>
          <div className="mt-3 space-y-2">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => setSelectedCandidate(candidate)}
                className={`w-full rounded-xl border p-3 text-left ${selectedCandidate?.id === candidate.id ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-surface"}`}
              >
                <div className="text-[13px] font-bold text-wk-text">{candidate.display_name}</div>
                <div className="text-[11px] text-wk-text-muted">{candidate.slug} · {candidate.status}</div>
              </button>
            ))}
          </div>
        </WkSurface>

        <WkSurface className="p-5">
          <h3 className="text-[14px] font-bold text-wk-text">Decision</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "composite_artist_title",
              "duplicate_existing_artist",
              "insufficient_data",
              "draft_low_confidence",
              "clean_single_artist",
            ].map((reason) => (
              <button
                key={reason}
                onClick={() => setNotes((current) => current ? `${current}; ${reason}` : reason)}
                className="rounded-full border border-wk-border bg-wk-surface px-3 py-1 text-[10px] font-bold text-wk-text-muted hover:bg-wk-surface-raised"
              >
                {reason}
              </button>
            ))}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="wk-input mt-3 min-h-28 w-full" placeholder="Decision notes…" />
          {error && <div className="mt-3 rounded-xl bg-wk-danger-soft p-3 text-[12px] text-wk-danger">{error}</div>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DECISIONS.map((decision) => (
              <button
                key={decision.key}
                disabled={saving || (decision.key === "approve_match" && !selectedCandidate) || (decision.key === "split_collaboration" && splitArtistTitle(row.source_title || "").length < 2)}
                onClick={() => decide(decision.key)}
                className="wk-button wk-button-primary wk-button-sm justify-center disabled:opacity-40"
              >
                {saving ? "Saving…" : decision.label}
              </button>
            ))}
          </div>
        </WkSurface>
      </div>

      <WkSurface className="overflow-hidden p-0">
        <div className="border-b border-wk-border p-4 text-[14px] font-bold text-wk-text">Source payload</div>
        <pre className="max-h-96 overflow-auto p-4 text-[11px] text-wk-text-muted">{JSON.stringify({ raw_record: row.raw_record, mapped_record: row.mapped_record, warnings: row.warnings, errors: row.errors }, null, 2)}</pre>
      </WkSurface>
    </div>
  );
}



function RelationshipPreviewPanel({ rows }: { rows: ArtistSplitRelationshipPreviewRow[] }) {
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function promote(row: ArtistSplitRelationshipPreviewRow) {
    if (!row.staging_record_id) return;

    setPromotingId(row.staging_record_id);
    setMessage("");
    setError("");

    try {
      const result = await promoteArtistSplitRelationship(row.staging_record_id);
      setMessage(`Promoted ${result.inserted_relationships} relationship(s) for ${row.composite_source_title}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not promote relationship.");
    } finally {
      setPromotingId(null);
    }
  }

  if (!rows.length) {
    return (
      <WkSurface className="p-5">
        <div className="text-[14px] font-bold text-wk-text">Relationship promotion preview</div>
        <p className="mt-1 text-[12px] text-wk-text-muted">
          Once split members are confirmed as existing or create-ready artists, collaboration edges will appear here.
        </p>
      </WkSurface>
    );
  }

  return (
    <WkSurface className="overflow-hidden p-0">
      <div className="border-b border-wk-border p-4">
        <div className="flex items-center gap-2">
          <WkIcon name="Network" size={16} className="text-wk-brand" />
          <h2 className="text-[14px] font-bold text-wk-text">Relationship promotion preview</h2>
        </div>
        <p className="mt-1 text-[12px] text-wk-text-muted">
          These collaboration edges are ready to be promoted after final confirmation.
        </p>
        {message && <div className="mt-3 rounded-xl bg-wk-success-soft p-3 text-[12px] text-wk-success">{message}</div>}
        {error && <div className="mt-3 rounded-xl bg-wk-danger-soft p-3 text-[12px] text-wk-danger">{error}</div>}
      </div>

      <div className="divide-y divide-wk-border">
        {rows.slice(0, 20).map((row) => (
          <div key={`${row.staging_record_id}-${row.artist_a_slug}-${row.artist_b_slug}`} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[13px] font-black text-wk-text">{row.composite_source_title}</div>
                <div className="mt-1 text-[12px] text-wk-text-muted">
                  Source WP ID {row.source_record_id || "unknown"} · {row.source_kind}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill label={row.readiness || "unknown"} />
                <button
                  disabled={promotingId === row.staging_record_id || row.readiness !== "ready_to_create_relationship"}
                  onClick={() => promote(row)}
                  className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                >
                  {promotingId === row.staging_record_id ? "Promoting…" : "Promote relationship"}
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
                <div className="text-[12px] font-bold text-wk-text">{row.artist_a_name}</div>
                <div className="text-[11px] text-wk-text-muted">/{row.artist_a_slug}</div>
              </div>

              <div className="text-center text-[11px] font-black uppercase tracking-wider text-wk-brand">
                {row.relationship_type || "collaboration"}
              </div>

              <div className="rounded-xl border border-wk-border bg-wk-surface p-3">
                <div className="text-[12px] font-bold text-wk-text">{row.artist_b_name}</div>
                <div className="text-[11px] text-wk-text-muted">/{row.artist_b_slug}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}

function SplitPreviewPanel({ rows, onChanged }: { rows: ArtistSplitPromotionPreviewRow[]; onChanged: () => void }) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const groups = rows.reduce<Record<string, ArtistSplitPromotionPreviewRow[]>>((acc, row) => {
    const key = `${row.staging_record_id}:${row.composite_source_title || "Unknown"}`;
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});

  const groupList = Object.values(groups).slice(0, 8);

  async function handleUseExisting(row: ArtistSplitPromotionPreviewRow) {
    setSavingId(row.id);
    setError("");
    try {
      await linkExistingSplitMember(row);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update split member.");
    } finally {
      setSavingId(null);
    }
  }

  if (!rows.length) {
    return (
      <WkSurface className="p-5">
        <div className="text-[14px] font-bold text-wk-text">Split promotion preview</div>
        <p className="mt-1 text-[12px] text-wk-text-muted">Split collaboration decisions will appear here before promotion.</p>
      </WkSurface>
    );
  }

  return (
    <WkSurface className="overflow-hidden p-0">
      <div className="border-b border-wk-border p-4">
        <div className="flex items-center gap-2">
          <WkIcon name="GitBranch" size={16} className="text-wk-brand" />
          <h2 className="text-[14px] font-bold text-wk-text">Split promotion preview</h2>
        </div>
        <p className="mt-1 text-[12px] text-wk-text-muted">
          Confirm whether each split member should use an existing artist or become a create candidate. Nothing is promoted from this panel.
        </p>
        {error && <div className="mt-3 rounded-xl bg-wk-danger-soft p-3 text-[12px] text-wk-danger">{error}</div>}
      </div>

      <div className="divide-y divide-wk-border">
        {groupList.map((members) => (
          <div key={`${members[0].staging_record_id}-${members[0].composite_source_title}`} className="p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[13px] font-black text-wk-text">{members[0].composite_source_title}</div>
                <div className="text-[11px] text-wk-text-muted">Composite source · {members.length} members</div>
              </div>
              <Pill label={members.every((m) => m.action === "match") ? "ready to link" : "needs member confirmation"} />
            </div>

            <div className="grid gap-2 lg:grid-cols-2">
              {members.map((member) => (
                <div key={member.id} className="rounded-xl border border-wk-border bg-wk-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold text-wk-text">{member.display_name}</div>
                      <div className="mt-1 text-[11px] text-wk-text-muted">/{member.proposed_slug}</div>
                    </div>
                    <Pill label={member.action || "unknown"} />
                  </div>

                  <div className="mt-3 rounded-lg bg-wk-surface-raised p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Existing match</div>
                    {member.existing_artist_slug ? (
                      <div className="mt-1 text-[12px] text-wk-text">
                        <span className="font-bold">{member.existing_display_name}</span> · {member.existing_artist_slug} · {member.existing_status}
                      </div>
                    ) : (
                      <div className="mt-1 text-[12px] text-wk-text-muted">No exact slug/name match found.</div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={savingId === member.id || !member.existing_artist_id || (member.action === "match" && Boolean(member.target_artist_id))}
                      onClick={() => handleUseExisting(member)}
                      className="wk-button wk-button-primary wk-button-sm disabled:opacity-60"
                    >
                      {savingId === member.id
                        ? "Saving…"
                        : member.action === "match" && member.target_artist_id
                        ? "Using existing"
                        : "Use existing"}
                    </button>
                    <button
                      disabled={savingId === member.id}
                      onClick={async () => {
                        setSavingId(member.id);
                        setError("");
                        try {
                          const { updateSplitMemberAction } = await import("@/services/artistReviewResolver");
                          await updateSplitMemberAction({ id: member.id, action: "create", notes: member.notes });
                          onChanged();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Could not update split member.");
                        } finally {
                          setSavingId(null);
                        }
                      }}
                      className="wk-button wk-button-ghost wk-button-sm"
                    >
                      Create new
                    </button>
                    <button
                      disabled={savingId === member.id}
                      onClick={async () => {
                        setSavingId(member.id);
                        setError("");
                        try {
                          const { updateSplitMemberAction } = await import("@/services/artistReviewResolver");
                          await updateSplitMemberAction({ id: member.id, action: "defer", notes: member.notes });
                          onChanged();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Could not update split member.");
                        } finally {
                          setSavingId(null);
                        }
                      }}
                      className="wk-button wk-button-ghost wk-button-sm"
                    >
                      Defer member
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}

function Pill({ label }: { label: string }) {
  return <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-wk-text-muted">{label}</span>;
}
