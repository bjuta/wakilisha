import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

const INTAKE_API = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/artist-registry-intake`;

interface RegistryArtistHit {
  id: string;
  display_name: string;
  origin_iso2: string | null;
  public_image_url: string | null;
  bio: string | null;
  status: string;
}

interface StagingRecord {
  id: string;
  source_artist_name: string;
  source_normalized_name: string;
  source_origin_iso2: string | null;
  source_spotify_id: string | null;
  source_popularity: number | null;
  source_followers: number | null;
  source_genres: string[];
  source_images: { primary?: string; all?: string[] } | null;
  source_metadata: {
    biography?: string;
    profile_url?: string;
    latest_release?: string;
    top_tracks?: string;
  } | null;
  match_status: string;
  matched_registry_artist_id: string | null;
  matched_registry_artist_name: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  review_status: string;
  review_notes: string | null;
  action_taken: string | null;
  target_registry_artist_id: string | null;
  registry_artists?: RegistryArtistHit | null;
  target_artist?: RegistryArtistHit | null;
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

// ── Inline artist search component ──
function ArtistLinkSearch({
  recordName,
  onSelect,
  onCancel,
}: {
  recordName: string;
  onSelect: (artist: RegistryArtistHit) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistryArtistHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase
        .from("registry_artists")
        .select("id, display_name, origin_iso2, public_image_url, bio, status")
        .ilike("display_name", `%${q}%`)
        .order("display_name")
        .limit(12);
      setResults((data as RegistryArtistHit[]) || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 250);
  };

  const handlePick = (artist: RegistryArtistHit) => {
    setPicked(true);
    onSelect(artist);
  };

  return (
    <div className="relative w-full max-w-xs">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={`Search registry for "${recordName}"…`}
            disabled={picked}
            autoFocus
            className="w-full rounded-lg border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-1.5 text-[12px] outline-none transition focus:border-[#85c441] focus:bg-white disabled:opacity-50"
          />
          {searching && (
            <WkIcon name="Loader2" size={12} className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-[#858c7e]" />
          )}
        </div>
        <button onClick={onCancel} disabled={picked} className="shrink-0 text-[11px] font-semibold text-[#858c7e] hover:text-[#171712] disabled:opacity-30 whitespace-nowrap">
          Cancel
        </button>
      </div>
      {results.length > 0 && !picked && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#dfe4d8] bg-white shadow-lg">
          {results.map((artist) => (
            <button
              key={artist.id}
              onClick={() => handlePick(artist)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f0f3ec] transition"
            >
              {artist.public_image_url ? (
                <img src={artist.public_image_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 shrink-0 rounded-full bg-[#e0e5d8] flex items-center justify-center">
                  <WkIcon name="Mic2" size={11} className="text-[#858c7e]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-[#171712] truncate">{artist.display_name}</p>
                <p className="text-[10px] text-[#858c7e]">{artist.origin_iso2 || "—"} · {artist.status}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {query && !searching && results.length === 0 && !picked && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-[#dfe4d8] bg-white px-3 py-3 text-center text-[12px] text-[#858c7e] shadow-lg">
          No artists found
        </div>
      )}
    </div>
  );
}

// ── Linked target display ──
function LinkedTarget({ artist }: { artist: RegistryArtistHit }) {
  return (
    <div className="shrink-0 rounded-xl border border-[#85c441]/30 bg-[#5f8f2f]/5 p-3 min-w-[180px] max-w-[220px]">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#5f8f2f] mb-1">Linked Target</p>
      <div className="flex items-center gap-2">
        {artist.public_image_url ? (
          <img src={artist.public_image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-[#e0e5d8] flex items-center justify-center">
            <WkIcon name="Mic2" size={12} className="text-[#858c7e]" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#171712] truncate">{artist.display_name}</p>
          <p className="text-[10px] text-[#858c7e]">{artist.origin_iso2 || "No country"} · {artist.status}</p>
        </div>
      </div>
    </div>
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  // Track which record is in "link" mode
  const [linkingId, setLinkingId] = useState<string | null>(null);
  // Cache linked target artists resolved from target_registry_artist_id
  const [linkedTargets, setLinkedTargets] = useState<Record<string, RegistryArtistHit>>({});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── selection helpers ──
  const pendingRecords = useMemo(() => records.filter((r) => !decisions[r.id]?.status && r.review_status === "pending"), [records, decisions]);

  const allPendingSelected = pendingRecords.length > 0 && pendingRecords.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRecords.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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
    clearSelection();
    setLinkingId(null);
    try {
      const result = await invokeIntakeApi("get_staging_results", { runId: id, status });
      if (!result.ok) throw new Error(result.error || "Failed to load results");
      const data = (result.data || []) as StagingRecord[];
      setRecords(data);
      // Pre-populate linked targets from target_artist join
      const targets: Record<string, RegistryArtistHit> = {};
      for (const r of data) {
        if (r.target_artist) {
          targets[r.id] = r.target_artist;
        }
      }
      setLinkedTargets(targets);
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
      const payload: Record<string, unknown> = {
        runId,
        decisions: [{ stagingId, decision, notes: notes || "" }],
      };
      const result = await invokeIntakeApi("review_decision", payload);
      if (!result.ok) throw new Error(result.error);
      setDecisions((prev) => ({ ...prev, [stagingId]: { status: decision, notes: notes || "" } }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(stagingId);
        return next;
      });
      showToast(`${decision === "accepted" ? "Accepted" : "Rejected"} — ${records.find((r) => r.id === stagingId)?.source_artist_name}`);
      await loadSummary(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    }
  }

  async function handleLinkArtist(stagingId: string, targetArtist: RegistryArtistHit) {
    if (!runId) return;
    try {
      const result = await invokeIntakeApi("review_decision", {
        runId,
        decisions: [{ stagingId, decision: "accepted", notes: "", targetRegistryArtistId: targetArtist.id }],
      });
      if (!result.ok) throw new Error(result.error);
      setDecisions((prev) => ({ ...prev, [stagingId]: { status: "accepted", notes: "" } }));
      setLinkedTargets((prev) => ({ ...prev, [stagingId]: targetArtist }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(stagingId);
        return next;
      });
      setLinkingId(null);
      showToast(`Linked → ${targetArtist.display_name}`);
      await loadSummary(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link failed");
    }
  }

  async function handleBulkDecision(decision: string) {
    if (!runId || selectedIds.size === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      const batch = Array.from(selectedIds).map((stagingId) => ({
        stagingId,
        decision,
        notes: "",
      }));
      const result = await invokeIntakeApi("review_decision", { runId, decisions: batch });
      if (!result.ok) throw new Error(result.error);
      const newDecisions: Record<string, { status: string; notes: string }> = {};
      for (const id of selectedIds) {
        newDecisions[id] = { status: decision, notes: "" };
      }
      setDecisions((prev) => ({ ...prev, ...newDecisions }));
      showToast(`Bulk ${decision === "accepted" ? "approved" : "rejected"} ${result.processed} artists`);
      clearSelection();
      await loadSummary(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk decision failed");
    } finally {
      setBulkLoading(false);
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
      setSelectedIds(new Set());
      setLinkedTargets({});
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
              Import artists from CSV or TSV. The registry owns the truth — no duplicates allowed.
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
            <h2 className="mb-3 text-lg font-bold text-[#171712]">Upload Artist CSV / TSV</h2>
            <div className="mb-4 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] p-4 text-[12px] text-[#697062] leading-relaxed">
              <p className="font-bold text-[#171712] mb-2">Supported column names (tab or comma delimited):</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                <span><strong>artist_id</strong> — Spotify ID</span>
                <span><strong>artist_name</strong> — Display name</span>
                <span><strong>origin_country</strong> — ISO2 code (e.g. KE)</span>
                <span><strong>followers</strong> — Follower count</span>
                <span><strong>popularity</strong> — 0–100 score</span>
                <span><strong>genres</strong> — Comma-separated</span>
                <span><strong>image_url</strong> — Profile photo</span>
                <span><strong>biography</strong> — Bio text</span>
                <span><strong>profile_url</strong> — Spotify URL</span>
                <span><strong>latest_release</strong> — Latest album/track</span>
                <span><strong>top_tracks</strong> — Spotify track IDs</span>
              </div>
              <p className="mt-2 text-[#858c7e]">
                Images, bios, and genres from this file will be merged into existing artist records. New artists will be created with all available data.
              </p>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`artist_id\tartist_name\torigin_country\tfollowers\tpopularity\tgenres\timage_url\tbiography\n2qUHKed63B8\tBurna Boy\tNG\t13000000\t85\tafrobeats, dancehall\thttps://...\tNigerian artist known for...`}
              className="mb-4 h-52 w-full rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] p-4 text-sm font-mono outline-none transition focus:border-[#85c441] focus:bg-white resize-y"
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
                {csvText.trim() ? `${csvText.split("\n").filter((l) => l.trim()).length - 1} rows detected` : "Paste CSV or TSV above"}
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

            {/* Bulk selection bar */}
            {selectedIds.size > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#c88b1a]/30 bg-[#c88b1a]/5 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-[#171712]">
                    {selectedIds.size} artist{selectedIds.size !== 1 ? "s" : ""} selected
                  </span>
                  <button onClick={clearSelection} className="text-[12px] font-semibold text-[#858c7e] hover:text-[#171712]">
                    Clear selection
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkDecision("rejected")}
                    disabled={bulkLoading}
                    className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2 text-[13px] font-bold text-[#71796b] hover:bg-[#f0f3ec] disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
                  >
                    {bulkLoading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="X" size={14} />}
                    Reject All Selected
                  </button>
                  <button
                    onClick={() => handleBulkDecision("accepted")}
                    disabled={bulkLoading}
                    className="rounded-xl bg-[#5f8f2f] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#4d7a26] disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
                  >
                    {bulkLoading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Check" size={14} />}
                    Approve All Selected
                  </button>
                </div>
              </div>
            )}

            {/* Apply bar */}
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#dfe4d8] bg-white p-4">
              <div className="flex items-center gap-4">
                {records.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-[#c8d0be] text-[#5f8f2f] focus:ring-[#85c441]"
                    />
                    <span className="text-[13px] font-semibold text-[#697062]">
                      {allPendingSelected ? "Deselect all" : "Select all pending"}
                    </span>
                  </label>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-[#697062]">
                    <strong className="text-[#171712]">{approvedCount}</strong> approved
                    <span className="mx-2 text-[#c8d0be]">|</span>
                    <strong className="text-[#171712]">{pendingCount}</strong> pending review
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setRunId(null); setSummary(null); setRecords([]); setDecisions({}); setSelectedIds(new Set()); setLinkedTargets({}); setCsvText(""); }}
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
                  records.map((record) => {
                    const imageUrl = record.source_images?.primary || record.source_images?.all?.[0] || "";
                    const bio = record.source_metadata?.biography || "";
                    const isAccepted = decisions[record.id]?.status === "accepted" || record.review_status === "accepted";
                    const isRejected = decisions[record.id]?.status === "rejected" || record.review_status === "rejected";
                    const isPending = !isAccepted && !isRejected;
                    const isSelected = selectedIds.has(record.id);
                    const isLinking = linkingId === record.id;
                    const linkedTarget = linkedTargets[record.id];

                    // Determine which registry artist to show
                    const matchArtist = record.registry_artists;
                    const displayTarget = linkedTarget || record.target_artist;

                    return (
                      <div
                        key={record.id}
                        className={`rounded-2xl border bg-white p-4 transition ${
                          isSelected
                            ? "border-[#c88b1a] ring-1 ring-[#c88b1a]/30"
                            : isAccepted
                            ? "border-[#5f8f2f]/30 bg-[#5f8f2f]/5"
                            : isRejected
                            ? "border-[#c44242]/30 bg-[#c44242]/5"
                            : "border-[#dfe4d8]"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Selection checkbox */}
                          <div className="shrink-0 pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(record.id)}
                              disabled={!isPending}
                              className={`h-4 w-4 cursor-pointer rounded border-[#c8d0be] text-[#5f8f2f] focus:ring-[#85c441] ${!isPending ? "opacity-30 cursor-not-allowed" : ""}`}
                            />
                          </div>

                          {/* Artist image */}
                          <div className="shrink-0">
                            {imageUrl ? (
                              <img src={imageUrl} alt={record.source_artist_name} className="h-14 w-14 rounded-xl object-cover" />
                            ) : (
                              <div className="h-14 w-14 rounded-xl bg-[#e0e5d8] flex items-center justify-center">
                                <WkIcon name="Mic2" size={20} className="text-[#858c7e]" />
                              </div>
                            )}
                          </div>

                          {/* Source info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-[15px] font-bold text-[#171712]">{record.source_artist_name}</h3>
                              <StatusBadge status={record.match_status} />
                              {(decisions[record.id]?.status || record.review_status) !== "pending" && (
                                <StatusBadge status={decisions[record.id]?.status || record.review_status} />
                              )}
                              {displayTarget && (
                                <span className="inline-flex rounded-full border border-[#5f8f2f]/20 bg-[#5f8f2f]/10 px-2 py-0.5 text-[10px] font-bold text-[#5f8f2f]">
                                  Linked
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#858c7e] mb-1.5">
                              {record.source_origin_iso2 && (
                                <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#71796b]">
                                  {record.source_origin_iso2}
                                </span>
                              )}
                              {record.source_spotify_id && (
                                <span className="font-mono text-[10px]">ID: {record.source_spotify_id.slice(0, 14)}…</span>
                              )}
                              {record.source_popularity !== null && (
                                <span>Pop: {record.source_popularity}</span>
                              )}
                              {record.source_followers !== null && (
                                <span>{record.source_followers.toLocaleString()} followers</span>
                              )}
                            </div>
                            {/* Genres */}
                            {record.source_genres && record.source_genres.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1.5">
                                {record.source_genres.slice(0, 4).map((g) => (
                                  <span key={g} className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-semibold text-[#71796b]">{g}</span>
                                ))}
                                {record.source_genres.length > 4 && (
                                  <span className="text-[10px] text-[#a8ad9e]">+{record.source_genres.length - 4} more</span>
                                )}
                              </div>
                            )}
                            {/* Bio preview */}
                            {bio && (
                              <p className="text-[12px] text-[#858c7e] line-clamp-2 max-w-lg">{bio}</p>
                            )}
                            {record.match_reason && (
                              <p className="mt-1 text-[11px] text-[#a8ad9e]">{record.match_reason}</p>
                            )}
                          </div>

                          {/* Registry match or Linked target */}
                          {displayTarget ? (
                            <LinkedTarget artist={displayTarget} />
                          ) : matchArtist ? (
                            <div className="shrink-0 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] p-3 min-w-[180px] max-w-[220px]">
                              <p className="text-[10px] font-black uppercase tracking-wide text-[#71796b] mb-1">Registry Match</p>
                              <div className="flex items-center gap-2">
                                {matchArtist.public_image_url ? (
                                  <img src={matchArtist.public_image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-[#e0e5d8] flex items-center justify-center">
                                    <WkIcon name="Mic2" size={12} className="text-[#858c7e]" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-[#171712] truncate">{matchArtist.display_name}</p>
                                  <p className="text-[10px] text-[#858c7e]">{matchArtist.origin_iso2 || "No country"}</p>
                                  {!matchArtist.public_image_url && imageUrl && (
                                    <p className="text-[9px] text-[#85c441] font-semibold mt-0.5">Will add image</p>
                                  )}
                                  {!matchArtist.bio && bio && (
                                    <p className="text-[9px] text-[#85c441] font-semibold">Will add bio</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {/* Actions */}
                          <div className="shrink-0 flex flex-col gap-2">
                            {(decisions[record.id]?.status || record.review_status) === "pending" ? (
                              <>
                                {/* Link button — only show for no_match records that aren't already linking */}
                                {record.match_status === "no_match" && !isLinking && (
                                  <button
                                    onClick={() => setLinkingId(record.id)}
                                    className="rounded-lg border border-[#c88b1a]/30 bg-[#c88b1a]/5 px-3 py-2 text-[12px] font-bold text-[#c88b1a] hover:bg-[#c88b1a]/10 flex items-center gap-1.5 whitespace-nowrap"
                                  >
                                    <WkIcon name="Link" size={12} /> Link
                                  </button>
                                )}
                                {/* Inline search when linking */}
                                {isLinking && (
                                  <ArtistLinkSearch
                                    recordName={record.source_artist_name}
                                    onSelect={(artist) => handleLinkArtist(record.id, artist)}
                                    onCancel={() => setLinkingId(null)}
                                  />
                                )}
                                {!isLinking && (
                                  <>
                                    <button
                                      onClick={() => handleDecision(record.id, "accepted")}
                                      className="rounded-lg bg-[#5f8f2f] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#4d7a26] flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                      <WkIcon name="Check" size={12} /> Accept
                                    </button>
                                    <button
                                      onClick={() => handleDecision(record.id, "rejected")}
                                      className="rounded-lg border border-[#dfe4d8] px-3 py-2 text-[12px] font-bold text-[#71796b] hover:bg-[#f0f3ec] flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                      <WkIcon name="X" size={12} /> Reject
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handleDecision(record.id, "pending")}
                                className="rounded-lg border border-[#dfe4d8] px-3 py-2 text-[12px] font-bold text-[#71796b] hover:bg-[#f0f3ec] whitespace-nowrap"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}