import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminChartsPageHeader } from "@/pages/admin/charts/components/AdminChartsPageHeader";
import { AdminChartsLoadingState } from "@/pages/admin/charts/components/AdminChartsLoadingState";
import {
  decideArtistClaim,
  listArtistClaims,
  type ArtistClaimQueueItem,
} from "@/services/artists/claimedArtist";

const STATUS_OPTIONS = ["pending", "verified", "rejected", "withdrawn", "revoked"] as const;

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminArtistClaimsPage() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("pending");
  const [claims, setClaims] = useState<ArtistClaimQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setClaims(await listArtistClaims(status, 200));
    } catch (error) {
      setClaims([]);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not load Artist claims." });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  async function decide(claim: ArtistClaimQueueItem, decision: "verified" | "rejected") {
    const reason = (reasons[claim.id] || "").trim();
    if (reason.length < 3) {
      setMessage({ type: "error", text: "Add a short review reason before deciding this claim." });
      return;
    }
    setBusyId(claim.id);
    setMessage(null);
    try {
      await decideArtistClaim({ claimId: claim.id, decision, reason });
      setMessage({ type: "success", text: decision === "verified" ? "Artist claim verified." : "Artist claim rejected." });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not decide this Artist claim." });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <AdminChartsLoadingState message="Loading Artist claims…" />;

  return (
    <div className="space-y-5">
      <AdminChartsPageHeader
        eyebrow="Community"
        title="Artist Claims"
        description="Review who can represent an Artist on WAKILISHA."
      >
        <Link to="/admin/community" className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted hover:text-wk-text">
          Back to Community
        </Link>
      </AdminChartsPageHeader>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-[13px] ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatus(option)}
            className={`rounded-full px-4 py-2 text-[12px] font-bold capitalize ${status === option ? "bg-wk-brand text-white" : "border border-wk-border bg-white text-wk-text-muted"}`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {claims.map((claim) => (
          <article key={claim.id} className="rounded-2xl border border-wk-border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/artists/${claim.artist.slug}`} target="_blank" className="text-[16px] font-black text-wk-text hover:text-wk-brand">
                    {claim.artist.displayName}
                  </Link>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600">{claim.claimantRole.replace(/_/g, " ")}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">{claim.status}</span>
                </div>
                <div className="mt-1 text-[12px] text-wk-text-muted">
                  {claim.claimant.displayName || claim.claimant.username || "WAKILISHA account"}
                  {claim.claimant.username ? ` · @${claim.claimant.username}` : ""}
                  {claim.submittedAt ? ` · ${formatDate(claim.submittedAt)}` : ""}
                </div>
              </div>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-[13px] leading-6 text-wk-text">{claim.statement}</p>

            {claim.evidence.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">Evidence</div>
                {claim.evidence.map((item, index) => (
                  <div key={item.id || `${claim.id}-${index}`} className="rounded-xl bg-gray-50 p-3 text-[12px] text-wk-text-muted">
                    <div className="font-bold capitalize text-wk-text">{item.type.replace(/_/g, " ")}</div>
                    {item.reference && <a href={item.reference} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-wk-brand hover:underline">{item.reference}</a>}
                    {item.note && <p className="mt-1">{item.note}</p>}
                  </div>
                ))}
              </div>
            )}

            {claim.status === "pending" && (
              <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-gray-500">Review Reason</span>
                  <textarea
                    rows={3}
                    value={reasons[claim.id] || ""}
                    onChange={(event) => setReasons((current) => ({ ...current, [claim.id]: event.target.value }))}
                    className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-900"
                  />
                </label>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => void decide(claim, "rejected")} disabled={busyId === claim.id} className="rounded-full border border-red-200 px-4 py-2 text-[12px] font-bold text-red-700 disabled:opacity-50">Reject Claim</button>
                  <button type="button" onClick={() => void decide(claim, "verified")} disabled={busyId === claim.id} className="rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50">Verify Claim</button>
                </div>
              </div>
            )}

            {claim.decisionReason && (
              <div className="mt-4 text-[12px] text-wk-text-muted">Decision: {claim.decisionReason}</div>
            )}
          </article>
        ))}

        {claims.length === 0 && (
          <div className="rounded-2xl border border-dashed border-wk-border bg-white p-10 text-center text-[13px] text-wk-text-muted">
            No {status} Artist claims.
          </div>
        )}
      </div>
    </div>
  );
}
