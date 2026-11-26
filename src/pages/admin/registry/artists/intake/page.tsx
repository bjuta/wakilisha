import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChartReviewReturnContext } from "@/components/admin/charts/ChartReviewReturnContext";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/design-system/admin/AdminStatusBadge";


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

async function invokeIntakeApi(action: string, payload: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "Not authenticated" };

  const response = await fetch(INTAKE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const result = await response.json().catch(() => ({
    ok: false,
    error: `Artist intake request failed with HTTP ${response.status}`,
  }));

  if (!response.ok && result.ok !== false) {
    return {
      ok: false,
      error: result.error || `Artist intake request failed with HTTP ${response.status}`,
    };
  }

  return result;
}

function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, AdminStatusTone> = {
    exact_match: "success", fuzzy_match: "warning", no_match: "neutral",
    conflict: "danger", pending: "neutral", accepted: "success", rejected: "danger",
  };
  return <AdminStatusBadge status={status} tone={tones[status] ?? "neutral"} />;
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
    <div className="w-full min-w-0 max-w-md">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <WkSearchField
            value={query}
            onChange={handleInput}
            ariaLabel={`Search Registry for "${recordName}"`}
            placeholder="Search Registry Artists"
            disabled={picked}
            autoFocus
          />
          {searching && (
            <WkIcon name="Loader2" size={12} className="animate-spin mt-1 text-wk-text-muted" />
          )}
        </div>
        <WkButton variant="ghost" onClick={onCancel} disabled={picked} className="wk-button-sm">
          Cancel
        </WkButton>
      </div>
      {results.length > 0 && !picked && (
        <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-wk-border bg-wk-surface">
          {results.map((artist) => (
            <button
              key={artist.id}
              onClick={() => handlePick(artist)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-wk-surface-raised transition"
            >
              {artist.public_image_url ? (
                <img src={artist.public_image_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 shrink-0 rounded-full bg-wk-surface-raised flex items-center justify-center">
                  <WkIcon name="Mic2" size={11} className="text-wk-text-muted" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-wk-text truncate">{artist.display_name}</p>
                <p className="text-[10px] text-wk-text-muted">{artist.origin_iso2 || "Not set"} · {artist.status}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {query && !searching && results.length === 0 && !picked && (
        <div className="mt-2 rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-3 text-sm text-wk-text-muted">
          No artists found
        </div>
      )}
    </div>
  );
}

// ── Linked target display ──
function LinkedTarget({ artist }: { artist: RegistryArtistHit }) {
  return (
    <WkSurface className="w-fit max-w-full p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-wk-brand mb-1">Linked Target</p>
      <div className="flex items-center gap-2">
        {artist.public_image_url ? (
          <img src={artist.public_image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-wk-surface-raised flex items-center justify-center">
            <WkIcon name="Mic2" size={12} className="text-wk-text-muted" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-wk-text truncate">{artist.display_name}</p>
          <p className="text-[10px] text-wk-text-muted">{artist.origin_iso2 || "No country"} · {artist.status}</p>
        </div>
      </div>
    </WkSurface>
  );
}

export default function ArtistIntakePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chartRun=searchParams.has("chart_source");
  const candidateRun=searchParams.get("run");
  const chartRunId=candidateRun &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateRun)
      ?candidateRun:null;
  const initialChartRun=useRef(chartRunId);
  const [csvText, setCsvText] = useState("");
  const [runId, setRunId] = useState<string | null>(initialChartRun.current);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [records, setRecords] = useState<StagingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<string>(initialChartRun.current?"no_match":"exact_match");
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
      showToast(`CSV uploaded: ${result.matchSummary?.total || 0} artists staged`);
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

  useEffect(()=>{
    if(!initialChartRun.current)return;
    void loadSummary(initialChartRun.current);
    void loadResults(initialChartRun.current,"no_match");
  },[]);

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
      showToast(`${decision === "accepted" ? "Accepted" : "Rejected"}: ${records.find((r) => r.id === stagingId)?.source_artist_name}`);
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
      showToast(`Linked to ${targetArtist.display_name}`);
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
      showToast(`Applied: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
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
    { key: "exact_match", label: "Exact Matches", count: summary?.exact_matches || 0, color: "text-wk-brand" },
    { key: "fuzzy_match", label: "Fuzzy Matches", count: summary?.fuzzy_matches || 0, color: "text-wk-warning" },
    { key: "no_match", label: "New Artists", count: summary?.no_matches || 0, color: "text-wk-text" },
    { key: "conflict", label: "Conflicts", count: summary?.conflicts || 0, color: "text-wk-danger" },
  ], [summary]);

  const approvedCount = useMemo(() => {
    return records.filter((r) => decisions[r.id]?.status === "accepted" || r.review_status === "accepted").length;
  }, [records, decisions]);

  const pendingCount = useMemo(() => {
    return records.filter((r) => !decisions[r.id]?.status && r.review_status === "pending").length;
  }, [records, decisions]);

  return (
    <div data-wk-artist-intake className="min-w-0 text-wk-text">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-wk-border bg-wk-surface px-4 py-3 text-sm font-bold text-wk-text shadow-xl">
          {toast}
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl min-w-0">
        <ChartReviewReturnContext />
        {chartRun && !chartRunId &&
          <p role="alert" className="mb-4 rounded-xl border border-wk-danger p-4 text-sm text-wk-danger">
            The chart Artist Intake reference is invalid. Reopen the original song in Charts Studio.
          </p>}
        {/* Header */}
        <header className="mb-5 flex flex-col items-start gap-3">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-wk-brand">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Artist Intake</h1>
            <p className="mt-2 max-w-2xl text-sm text-wk-text-muted">
              {chartRun?
                "Review the original chart Artist credit. Choose an existing Registry Artist or approve creating a draft identity. No origin or provider metadata is inferred.":
                "Import artists from CSV or TSV. The Registry owns canonical truth and prevents duplicate identities."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <WkButton variant="ghost"
              onClick={() => navigate("/admin/registry/artists")}
              className="wk-button-sm"
            >
              <WkIcon name="ArrowLeft" size={14} />
              Back to Artists
            </WkButton>
          </div>
        </header>

        {/* Error */}
        {error && (
          <section className="mb-4 rounded-2xl border border-wk-danger bg-wk-danger-soft p-4 text-sm font-semibold text-wk-danger">
            <p className="font-bold">{error}</p>
          </section>
        )}

        {/* Upload area */}
        {!runId && (
          <WkSurface className="mb-5 p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-bold text-wk-text">Upload Artist CSV / TSV</h2>
            <div className="mb-4 rounded-xl border border-wk-border bg-wk-surface-raised p-4 text-[12px] text-wk-text-muted leading-relaxed">
              <p className="font-bold text-wk-text mb-2">Supported column names (tab or comma delimited):</p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                <span><strong>artist_id</strong>: Spotify ID</span>
                <span><strong>artist_name</strong>: Display name</span>
                <span><strong>origin_country</strong>: ISO2 code (e.g. KE)</span>
                <span><strong>followers</strong>: Follower count</span>
                <span><strong>popularity</strong>: 0–100 score</span>
                <span><strong>genres</strong>: Comma-separated</span>
                <span><strong>image_url</strong>: Profile photo</span>
                <span><strong>biography</strong>: Bio text</span>
                <span><strong>profile_url</strong>: Spotify URL</span>
                <span><strong>latest_release</strong>: Latest album/track</span>
                <span><strong>top_tracks</strong>: Spotify track IDs</span>
              </div>
              <p className="mt-2 text-wk-text-muted">
                Reviewed CSV evidence can enrich existing artists. New artist identities are created as drafts before any approved evidence is admitted.
              </p>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`artist_id\tartist_name\torigin_country\tfollowers\tpopularity\tgenres\timage_url\tbiography\n2qUHKed63B8\tBurna Boy\tNG\t13000000\t85\tafrobeats, dancehall\thttps://...\tNigerian artist known for...`}
              aria-label="Artist CSV or TSV"
              className="wk-input mb-4 min-h-52 w-full min-w-0 resize-none p-4 font-mono text-base"
            />
            <div className="flex flex-wrap items-center gap-3">
              <WkButton variant="primary"
                onClick={handleUpload}
                disabled={loading || !csvText.trim()}
                className="wk-button-sm"
              >
                {loading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Upload" size={14} />}
                {loading ? "Matching..." : "Upload & Match"}
              </WkButton>
              <span className="text-[12px] text-wk-text-muted">
                {csvText.trim() ? `${csvText.split("\n").filter((l) => l.trim()).length - 1} rows detected` : "Paste CSV or TSV above"}
              </span>
            </div>
          </WkSurface>
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
                  aria-pressed={activeTab === tab.key}
                  className={`rounded-xl border p-3 text-left transition ${
                    activeTab === tab.key
                      ? "border-wk-brand bg-wk-surface shadow-sm"
                      : "border-wk-border bg-wk-surface hover:border-wk-brand"
                  }`}
                >
                  <p className="text-[11px] font-black uppercase tracking-wide text-wk-text-muted">{tab.label}</p>
                  <p className={`mt-2 text-3xl font-black ${tab.color}`}>{tab.count}</p>
                </button>
              ))}
            </section>

            {/* Tabs */}
            <section className="mb-4 flex flex-wrap items-center gap-2 border-b border-wk-border pb-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  aria-pressed={activeTab === tab.key}
                  className={`wk-button wk-button-sm transition ${
                    activeTab === tab.key
                      ? "bg-wk-brand-soft text-wk-brand"
                      : "text-wk-text-muted hover:bg-wk-surface-raised"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === tab.key ? "bg-wk-surface-raised text-wk-brand" : "bg-wk-surface-raised text-wk-text-muted"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </section>

            {/* Bulk selection bar */}
            {selectedIds.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-wk-warning bg-wk-warning-soft p-3">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-wk-text">
                    {selectedIds.size} artist{selectedIds.size !== 1 ? "s" : ""} selected
                  </span>
                  <WkButton variant="ghost" onClick={clearSelection} className="wk-button-sm">
                    Clear selection
                  </WkButton>
                </div>
                <div className="flex flex-wrap gap-2">
                  <WkButton variant="ghost"
                    onClick={() => handleBulkDecision("rejected")}
                    disabled={bulkLoading}
                    className="wk-button-sm"
                  >
                    {bulkLoading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="X" size={14} />}
                    Reject All Selected
                  </WkButton>
                  <WkButton variant="primary"
                    onClick={() => handleBulkDecision("accepted")}
                    disabled={bulkLoading}
                    className="wk-button-sm"
                  >
                    {bulkLoading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Check" size={14} />}
                    Approve All Selected
                  </WkButton>
                </div>
              </div>
            )}

            {/* Apply bar */}
            <WkSurface className="mb-3 flex flex-wrap items-center gap-3 p-3">
              <div className="flex flex-wrap items-center gap-3">
                {records.length > 0 && (
                  <WkCheckbox checked={allPendingSelected} onChange={toggleSelectAll} className="flex items-center gap-2 cursor-pointer select-none">

                    <span className="text-[13px] font-semibold text-wk-text-muted">
                      {allPendingSelected ? "Deselect all" : "Select all pending"}
                    </span>
                  </WkCheckbox>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-wk-text-muted">
                    <strong className="text-wk-text">{approvedCount}</strong> approved
                    <span className="mx-2 text-wk-text-faint">|</span>
                    <strong className="text-wk-text">{pendingCount}</strong> pending review
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <WkButton variant="ghost"
                  onClick={() => { setRunId(null); setSummary(null); setRecords([]); setDecisions({}); setSelectedIds(new Set()); setLinkedTargets({}); setCsvText(""); }}
                  className="wk-button-sm"
                >
                  Cancel
                </WkButton>
                <WkButton variant="primary"
                  onClick={handleApplyAll}
                  disabled={applyLoading || approvedCount === 0}
                  className="wk-button-sm"
                >
                  {applyLoading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Check" size={14} />}
                  {applyLoading ? "Applying..." : "Apply Approved"}
                </WkButton>
              </div>
            </WkSurface>

            {/* Records list */}
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-wk-border bg-wk-surface">
                <div className="flex flex-col items-center gap-3">
                  <WkIcon name="Loader2" size={28} className="animate-spin text-wk-brand" />
                  <p className="text-[13px] font-bold text-wk-text-muted">Loading results…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-wk-border bg-wk-surface px-6 py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-surface-raised">
                      <WkIcon name="SearchX" size={28} className="text-wk-text-muted" />
                    </div>
                    <p className="text-[16px] font-black text-wk-text">No records in this category</p>
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
                      <WkSurface
                        key={record.id}
                        data-wk-artist-intake-record
                        className={`p-3 sm:p-4 ${isSelected ? "ring-1 ring-wk-warning" : isAccepted ? "ring-1 ring-wk-success" : isRejected ? "ring-1 ring-wk-danger" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection checkbox */}
                          <div className="shrink-0 pt-1">
                            <WkCheckbox
                              checked={isSelected}
                              onChange={() => toggleSelect(record.id)}
                              disabled={!isPending}
                              ariaLabel={`Select ${record.source_artist_name}`}
                            />
                          </div>

                          {/* Artist image */}
                          <div className="shrink-0">
                            {imageUrl ? (
                              <img src={imageUrl} alt={record.source_artist_name} className="h-14 w-14 rounded-xl object-cover" />
                            ) : (
                              <div className="h-14 w-14 rounded-xl bg-wk-surface-raised flex items-center justify-center">
                                <WkIcon name="Mic2" size={20} className="text-wk-text-muted" />
                              </div>
                            )}
                          </div>

                          {/* Source info */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-[15px] font-bold text-wk-text">{record.source_artist_name}</h3>
                              <StatusBadge status={record.match_status} />
                              {(decisions[record.id]?.status || record.review_status) !== "pending" && (
                                <StatusBadge status={decisions[record.id]?.status || record.review_status} />
                              )}
                              {displayTarget && (
                                <span className="inline-flex rounded-full border border-wk-brand bg-wk-brand-soft px-2 py-0.5 text-[10px] font-bold text-wk-brand">
                                  Linked
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-wk-text-muted mb-1.5">
                              {record.source_origin_iso2 && (
                                <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">
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
                                  <span key={g} className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-semibold text-wk-text-muted">{g}</span>
                                ))}
                                {record.source_genres.length > 4 && (
                                  <span className="text-[10px] text-wk-text-faint">+{record.source_genres.length - 4} more</span>
                                )}
                              </div>
                            )}
                            {/* Bio preview */}
                            {bio && (
                              <p className="text-[12px] text-wk-text-muted line-clamp-2 max-w-lg">{bio}</p>
                            )}
                            {record.match_reason && (
                              <p className="mt-1 text-[11px] text-wk-text-faint">{record.match_reason}</p>
                            )}

                          {/* Registry match or Linked target */}
                          {displayTarget ? (
                            <LinkedTarget artist={displayTarget} />
                          ) : matchArtist ? (
                            <WkSurface className="w-fit max-w-full p-3">
                              <p className="text-[10px] font-black uppercase tracking-wide text-wk-text-muted mb-1">Registry Match</p>
                              <div className="flex items-center gap-2">
                                {matchArtist.public_image_url ? (
                                  <img src={matchArtist.public_image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-wk-surface-raised flex items-center justify-center">
                                    <WkIcon name="Mic2" size={12} className="text-wk-text-muted" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-wk-text truncate">{matchArtist.display_name}</p>
                                  <p className="text-[10px] text-wk-text-muted">{matchArtist.origin_iso2 || "No country"}</p>
                                  {!matchArtist.public_image_url && imageUrl && (
                                    <p className="text-[9px] text-wk-brand font-semibold mt-0.5">Will add image</p>
                                  )}
                                  {!matchArtist.bio && bio && (
                                    <p className="text-[9px] text-wk-brand font-semibold">Will add bio</p>
                                  )}
                                </div>
                              </div>
                            </WkSurface>
                          ) : null}

                          {/* Actions */}
                          <div data-wk-artist-intake-actions className="flex flex-wrap items-start gap-2">
                            {(decisions[record.id]?.status || record.review_status) === "pending" ? (
                              <>
                                {/* Link button — only show for no_match records that aren't already linking */}
                                {record.match_status === "no_match" && !isLinking && (
                                  <WkButton variant="ghost"
                                    onClick={() => setLinkingId(record.id)}
                                    className="wk-button-sm"
                                  >
                                    <WkIcon name="Link" size={12} /> Link
                                  </WkButton>
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
                                    <WkButton variant="primary"
                                      onClick={() => handleDecision(record.id, "accepted")}
                                      className="wk-button-sm"
                                    >
                                      <WkIcon name="Check" size={12} /> Accept
                                    </WkButton>
                                    <WkButton variant="ghost"
                                      onClick={() => handleDecision(record.id, "rejected")}
                                      className="wk-button-sm"
                                    >
                                      <WkIcon name="X" size={12} /> Reject
                                    </WkButton>
                                  </>
                                )}
                              </>
                            ) : (
                              <WkButton variant="ghost"
                                onClick={() => handleDecision(record.id, "pending")}
                                className="wk-button-sm"
                              >
                                Undo
                              </WkButton>
                            )}
                          </div>
                          </div>
                        </div>
                      </WkSurface>
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
