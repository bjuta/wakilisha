import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

const INTAKE_API = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/artist-registry-intake`;

interface StagingRecord {
  id: string;
  source_artist_name: string;
  source_normalized_name: string;
  source_origin_iso2: string | null;
  source_spotify_id: string | null;
  source_popularity: number | null;
  source_followers: number | null;
  source_genres: string[];
  match_status: string;
  matched_registry_artist_id: string | null;
  matched_registry_artist_name: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  review_status: string;
  review_notes: string | null;
  action_taken: string | null;
  target_registry_artist_id: string | null;
  registry_artists?: {
    id: string;
    display_name: string;
    origin_iso2: string | null;
    public_image_url: string | null;
    status: string;
  } | null;
}

interface MatchSummary {
  exact_matches: number;
  fuzzy_matches: number;
  no_matches: number;
  conflicts: number;
  total: number;
}

function invokeIntakeApi(action: string, payload: Record<string, unknown>) {
  return fetch(INTAKE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  }).then((r) => r.json());
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    exact_match: "bg-[#5f8f2f]/10 text-[#5f8f2f] border-[#5f8f2f]/20",
    fuzzy_match: "bg-[#c88b1a]/10 text-[#c88b1a] border-[#c88b1a]/20",
    no_match: "bg-[#c44242]/10 text-[#c44242] border-[#c44242]/20",
    conflict: "bg-[#c44242]/10 text-[#c44242] border-[#c44242]/20",
    pending: "bg-[#71796b]/10 text-[#71796b] border-[#71796b]/20",
    accepted: "bg-[#5f8f2f]/10 text-[#5f8f2f] border-[#5f8f2f]/20",
    rejected: "bg-[#c44242]/10 text-[#c44242] border-[#c44242]/20",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors[status] || colors.pending}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function ArtistIntakePage() {
  const navigate = useNavigate();
  const [csvText, setCsvText] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [records, setRecords] = useState<StagingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<string>("exact_match");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, { status: string; notes: string }>>({});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function handleUpload() {
    if (!csvText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invokeIntakeApi("upload_csv", { csvText });
      if (!result.ok) throw new Error(result.error || "Upload failed");
      setRunId(result.runId);
      setSummary(result.matchSummary);
      showToast(`CSV uploaded — ${result.matchSummary?.total || 0} artists staged`);
      await loadResults(result.runId, "exact_match");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadResults(id: string, status: string) {
    setLoading(true);
    try {
      const result = await invokeIntakeApi("get_staging_results", { runId: id, status });
      if (!result.ok) throw new Error(result.error || "Failed to load results");
      setRecords(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary(id: string) {
    const result = await invokeIntakeApi("get_run_summary", { runId: id });
    if (result.ok) setSummary(result.summary);
  }

  async function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (runId) {
      await loadResults(runId, tab);
    }
  }

  async function handleDecision(stagingId: string, decision: string, notes?: string) {
    if (!runId) return;
    try {
      const result = await invokeIntakeApi("review_decision", {
        runId,
        decisions: [{ stagingId, decision, notes: notes || "" }],
      });
      if (!result.ok) throw new Error(result.error);
      setDecisions((prev) => ({ ...prev, [stagingId]: { status: decision, notes: notes || "" } }));
      showToast(`${decision === "accepted" ? "Accepted" : "Rejected"} — ${records.find((r) => r.id === stagingId)?.source_artist_name}`);
      await loadSummary(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    }
  }

  async function handleApplyAll() {
    if (!runId) return;
    setApplyLoading(true);
    setError(null);
    try {
      const result = await invokeIntakeApi("apply_approved", { runId });
      if (!result.ok) throw new Error(result.error || "Apply failed");
      showToast(`Applied — ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
      setRunId(null);
      setSummary(null);
      setRecords([]);
      setDecisions({});
      setCsvText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplyLoading(false);
    }
  }

  const tabs = useMemo(() => [
    { key: "exact_match", label: "Exact Matches", count: summary?.exact_matches || 0, color: "text-[#5f8f2f]" },
    { key: "fuzzy_match", label: "Fuzzy Matches", count: summary?.fuzzy_matches || 0, color: "text-[#c88b1a]" },
    { key: "no_match", label: "New Artists", count: summary?.no_matches || 0, color: "text-[#c44242]" },
    { key: "conflict", label: "Conflicts", count: summary?.conflicts || 0, color: "text-[#c44242]" },
  ], [summary]);

  const approvedCount = useMemo(() => {
    return records.filter((r) => decisions[r.id]?.status === "accepted" || r.review_status === "accepted").length;
  }, [records, decisions]);

  const pendingCount = useMemo(() => {
    return records.filter((r) => !decisions[r.id]?.status && r.review_status === "pending").length;
  }, [records, decisions]);

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-bold text-[#171712] shadow-xl">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Artist Intake</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              Import artists from CSV. The registry owns the truth — no duplicates allowed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/admin/registry/artists")}
              className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-black text-[#171712] shadow-sm transition hover:border-[#85c441] flex items-center gap-2"
            >
              <WkIcon name="ArrowLeft" size={14} />
              Back to Artists
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-bold">{error}</p>
          </section>
        )}

        {/* Upload area */}
        {!runId && (
          <section className="mb-6 rounded-2xl border border-[#dfe4d8] bg-white p-6">
            <h2 className="mb-3 text-lg font-bold text-[#171712]">Upload Artist CSV</h2>
            <p className="mb-4 text-[13px] text-[#697062]">
              CSV must have columns: <strong>artist_name, spotify_id, spotify_uri, origin_iso2, popularity, followers, genres</strong>
              <br />
              Only new artists are created. Existing artists are updated only if missing origin data.
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`artist_name,spotify_id,spotify_uri,origin_iso2,popularity,followers,genres\nBurna Boy,123,spotify:artist:123,NG,85,5000000,"afrobeats, dancehall"`}
              className="mb-4 h-48 w-full rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] p-4 text-sm font-mono outline-none transition focus:border-[#85c441] focus:bg-white resize-y"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpload}
                disabled={loading || !csvText.trim()}
                className="rounded-2xl bg-[#5f8f2f] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#4d7a26] disabled:opacity-40 flex items-center gap-2"
              >
                {loading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Upload" size={14} />}
                {loading ? "Matching..." : "Upload & Match"}
              </button>
              <span className="text-[12px] text-[#858c7e]">
                {csvText.trim() ? `${csvText.split("\n").filter((l) => l.trim()).length - 1} rows detected` : "Paste CSV above"}
              </span>
            </div>
          </section>
        )}

        {/* Results */}
        {runId && summary && (
          <>
            {/* Summary cards */}
            <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    activeTab === tab.key
                      ? "border-[#85c441] bg-white shadow-sm"
                      : "border-[#dfe4d8] bg-white hover:border-[#85c441]"
                  }`}
                >
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">{tab.label}</p>
                  <p className={`mt-2 text-3xl font-black ${tab.color}`}>{tab.count}</p>
                </button>
              ))}
            </section>

            {/* Tabs */}
            <section className="mb-4 flex items-center gap-2 border-b border-[#dfe4d8] pb-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`rounded-lg px-3 py-2 text-[13px] font-bold transition ${
                    activeTab === tab.key
                      ? "bg-[#5f8f2f] text-white"
                      : "text-[#71796b] hover:bg-[#f0f3ec]"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-[#f0f3ec] text-[#71796b]"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </section>

            {/* Apply bar */}
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#dfe4d8] bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-[#697062]">
                  <strong className="text-[#171712]">{approvedCount}</strong> approved
                  <span className="mx-2 text-[#c8d0be]">|</span>
                  <strong className="text-[#171712]">{pendingCount}</strong> pending review
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setRunId(null); setSummary(null); setRecords([]); setDecisions({}); setCsvText(""); }}
                  className="rounded-xl border border-[#dfe4d8] px-4 py-2 text-[13px] font-bold text-[#71796b] hover:bg-[#f0f3ec]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyAll}
                  disabled={applyLoading || approvedCount === 0}
                  className="rounded-xl bg-[#5f8f2f] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#4d7a26] disabled:opacity-40 flex items-center gap-2"
                >
                  {applyLoading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Check" size={14} />}
                  {applyLoading ? "Applying..." : "Apply Approved"}
                </button>
              </div>
            </div>

            {/* Records list */}
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[#dfe4d8] bg-white">
                <div className="flex flex-col items-center gap-3">
                  <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
                  <p className="text-[13px] font-bold text-[#697062]">Loading results…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#dfe4d8] bg-white px-6 py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                      <WkIcon name="SearchX" size={28} className="text-[#858c7e]" />
                    </div>
                    <p className="text-[16px] font-black text-[#171712]">No records in this category</p>
                  </div>
                ) : (
                  records.map((record) => (
                    <div
                      key={record.id}
                      className={`rounded-2xl border bg-white p-4 transition ${
                        decisions[record.id]?.status === "accepted" || record.review_status === "accepted"
                          ? "border-[#5f8f2f]/30 bg-[#5f8f2f]/5"
                          : decisions[record.id]?.status === "rejected" || record.review_status === "rejected"
                          ? "border-[#c44242]/30 bg-[#c44242]/5"
                          : "border-[#dfe4d8]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Source info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[15px] font-bold text-[#171712]">{record.source_artist_name}</h3>
                            <StatusBadge status={record.match_status} />
                            {(decisions[record.id]?.status || record.review_status) !== "pending" && (
                              <StatusBadge status={decisions[record.id]?.status || record.review_status} />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#858c7e]">
                            {record.source_origin_iso2 && (
                              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#71796b]">
                                {record.source_origin_iso2}
                              </span>
                            )}
                            {record.source_spotify_id && (
                              <span className="font-mono text-[10px]">Spotify: {record.source_spotify_id.slice(0, 12)}…</span>
                            )}
                            {record.source_popularity !== null && (
                              <span>Popularity: {record.source_popularity}</span>
                            )}
                            {record.source_followers !== null && (
                              <span>Followers: {record.source_followers.toLocaleString()}</span>
                            )}
                            {record.source_genres && record.source_genres.length > 0 && (
                              <span className="truncate max-w-[200px]">Genres: {record.source_genres.join(", ")}</span>
                            )}
                          </div>
                          {record.match_reason && (
                            <p className="mt-1 text-[11px] text-[#a8ad9e]">{record.match_reason}</p>
                          )}
                        </div>

                        {/* Registry match */}
                        {record.registry_artists && (
                          <div className="shrink-0 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] p-3 min-w-[200px]">
                            <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b] mb-1">Registry Match</p>
                            <div className="flex items-center gap-2">
                              {record.registry_artists.public_image_url ? (
                                <img src={record.registry_artists.public_image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-[#e0e5d8] flex items-center justify-center">
                                  <WkIcon name="Mic2" size={12} className="text-[#858c7e]" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#171712] truncate">{record.registry_artists.display_name}</p>
                                <p className="text-[10px] text-[#858c7e]">{record.registry_artists.origin_iso2 || "No country"}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="shrink-0 flex flex-col gap-2">
                          {(decisions[record.id]?.status || record.review_status) === "pending" ? (
                            <>
                              <button
                                onClick={() => handleDecision(record.id, "accepted")}
                                className="rounded-lg bg-[#5f8f2f] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#4d7a26] flex items-center gap-1.5"
                              >
                                <WkIcon name="Check" size={12} /> Accept
                              </button>
                              <button
                                onClick={() => handleDecision(record.id, "rejected")}
                                className="rounded-lg border border-[#dfe4d8] px-3 py-2 text-[12px] font-bold text-[#71796b] hover:bg-[#f0f3ec] flex items-center gap-1.5"
                              >
                                <WkIcon name="X" size={12} /> Reject
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleDecision(record.id, "pending")}
                              className="rounded-lg border border-[#dfe4d8] px-3 py-2 text-[12px] font-bold text-[#71796b] hover:bg-[#f0f3ec]"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}