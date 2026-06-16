import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

/* ──────────────────────── Types ──────────────────────── */

interface UnknownSlug {
  unknown_slug: string;
  source_table: string;
  occurrence_count: number;
  sample_display_name: string | null;
}

interface SimilarArtist {
  artist_id: string;
  artist_slug: string;
  display_name: string;
  similarity_score: number;
  match_reason: string;
}

interface AliasRecord {
  id: string;
  alias_slug: string;
  canonical_artist_id: string;
  canonical_slug: string;
  canonical_name: string;
  alias_display_name: string | null;
  confidence: number;
  source: string;
  created_at: string;
  notes: string | null;
}

interface ReviewItem {
  slug: string;
  source_table: string;
  occurrence_count: number;
  sample_name: string | null;
  suggestions: SimilarArtist[];
  loadingSuggestions: boolean;
}

type TabKey = "review" | "confirmed";

/* ──────────────────────── Helpers ──────────────────────── */

function sourceLabel(table: string): string {
  switch (table) {
    case "release_artists": return "Release Artists";
    case "track_artists": return "Track Artists";
    case "entity_relationships": return "Relationships";
    default: return table;
  }
}

function sourceColor(table: string): string {
  switch (table) {
    case "release_artists": return "bg-amber-50 text-amber-700 border-amber-200";
    case "track_artists": return "bg-sky-50 text-sky-700 border-sky-200";
    case "entity_relationships": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function matchReasonLabel(reason: string): string {
  switch (reason) {
    case "exact_slug": return "Exact slug";
    case "exact_name": return "Exact name";
    case "high_slug_similarity": return "High slug match";
    case "high_name_similarity": return "High name match";
    default: return "Partial match";
  }
}

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-emerald-700 bg-emerald-50";
  if (score >= 0.5) return "text-amber-700 bg-amber-50";
  return "text-gray-600 bg-gray-50";
}

/* ──────────────────────── Page ──────────────────────── */

export default function ArtistAliasesPage() {
  const [tab, setTab] = useState<TabKey>("review");

  // Review queue state
  const [unknownSlugs, setUnknownSlugs] = useState<UnknownSlug[]>([]);
  const [reviewItems, setReviewItems] = useState<Map<string, ReviewItem>>(new Map());
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Confirmed aliases state
  const [aliases, setAliases] = useState<AliasRecord[]>([]);
  const [loadingAliases, setLoadingAliases] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ──── Load unknown slugs ──── */
  const loadUnknownSlugs = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const { data, error } = await supabase.rpc("discover_unknown_artist_slugs_v2");
      if (error) throw new Error(error.message);
      // Map v2 function return columns to the UI shape
      const mapped = ((data as Record<string, unknown>[]) ?? []).map((row) => ({
        unknown_slug: row.slug as string,
        source_table: row.source_type as string,
        occurrence_count: Number(row.source_count ?? 0),
        sample_display_name: row.sample_name as string | null,
      }));
      setUnknownSlugs(mapped);
      setReviewItems(new Map());
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Failed to load");
      setUnknownSlugs([]);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  /* ──── Load confirmed aliases ──── */
  const loadAliases = useCallback(async () => {
    setLoadingAliases(true);
    try {
      const { data, error } = await supabase
        .from("registry_artist_aliases")
        .select(`
          id, alias_slug, canonical_artist_id, alias_display_name,
          confidence, source, created_at, notes,
          registry_artists!inner(slug, display_name)
        `)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw new Error(error.message);

      const rows: AliasRecord[] = ((data as unknown[]) ?? []).map((row: Record<string, unknown>) => {
        const artist = (row.registry_artists as Record<string, unknown>) ?? {};
        return {
          id: row.id as string,
          alias_slug: row.alias_slug as string,
          canonical_artist_id: row.canonical_artist_id as string,
          canonical_slug: artist.slug as string,
          canonical_name: artist.display_name as string,
          alias_display_name: row.alias_display_name as string | null,
          confidence: row.confidence as number,
          source: row.source as string,
          created_at: row.created_at as string,
          notes: row.notes as string | null,
        };
      });

      setAliases(rows);
    } catch (err) {
      setAliases([]);
    } finally {
      setLoadingAliases(false);
    }
  }, []);

  useEffect(() => {
    loadUnknownSlugs();
    loadAliases();
  }, [loadUnknownSlugs, loadAliases]);

  /* ──── Load suggestions for a single slug ──── */
  const loadSuggestions = useCallback(async (slug: string, displayName: string | null) => {
    setReviewItems((prev) => {
      const next = new Map(prev);
      const existing = next.get(slug);
      next.set(slug, {
        slug,
        source_table: existing?.source_table ?? "",
        occurrence_count: existing?.occurrence_count ?? 0,
        sample_name: existing?.sample_name ?? displayName,
        suggestions: existing?.suggestions ?? [],
        loadingSuggestions: true,
      });
      return next;
    });

    try {
      const { data, error } = await supabase.rpc("find_similar_artists", {
        search_slug: slug,
        search_name: displayName,
        similarity_threshold: 0.15,
        max_results: 6,
      });

      if (error) throw error;

      setReviewItems((prev) => {
        const next = new Map(prev);
        const existing = next.get(slug);
        next.set(slug, {
          slug,
          source_table: existing?.source_table ?? "",
          occurrence_count: existing?.occurrence_count ?? 0,
          sample_name: existing?.sample_name ?? displayName,
          suggestions: (data as SimilarArtist[]) ?? [],
          loadingSuggestions: false,
        });
        return next;
      });
    } catch {
      setReviewItems((prev) => {
        const next = new Map(prev);
        const existing = next.get(slug);
        next.set(slug, {
          slug,
          source_table: existing?.source_table ?? "",
          occurrence_count: existing?.occurrence_count ?? 0,
          sample_name: existing?.sample_name ?? displayName,
          suggestions: [],
          loadingSuggestions: false,
        });
        return next;
      });
    }
  }, []);

  /* ──── Load all suggestions ──── */
  const loadAllSuggestions = useCallback(() => {
    unknownSlugs.forEach((u) => {
      setReviewItems((prev) => {
        const next = new Map(prev);
        if (!next.has(u.unknown_slug)) {
          next.set(u.unknown_slug, {
            slug: u.unknown_slug,
            source_table: u.source_table,
            occurrence_count: u.occurrence_count,
            sample_name: u.sample_display_name,
            suggestions: [],
            loadingSuggestions: false,
          });
        }
        return next;
      });
      loadSuggestions(u.unknown_slug, u.sample_display_name);
    });
  }, [unknownSlugs, loadSuggestions]);

  /* ──── Confirm alias ──── */
  const confirmAlias = useCallback(async (aliasSlug: string, canonicalArtistId: string, displayName: string | null) => {
    try {
      const { error } = await supabase.from("registry_artist_aliases").insert({
        alias_slug: aliasSlug,
        canonical_artist_id: canonicalArtistId,
        alias_display_name: displayName,
        confidence: 100,
        source: "similarity_match",
        notes: "Confirmed via admin review",
      });

      if (error) {
        if (error.message.includes("duplicate")) {
          showToast("Alias already exists", "error");
        } else {
          throw error;
        }
        return;
      }

      showToast(`Alias "${aliasSlug}" confirmed`, "success");
      setUnknownSlugs((prev) => prev.filter((u) => u.unknown_slug !== aliasSlug));
      loadAliases();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to confirm alias", "error");
    }
  }, [loadAliases, showToast]);

  /* ──── Dismiss slug (skip review) ──── */
  const dismissSlug = useCallback((slug: string) => {
    setUnknownSlugs((prev) => prev.filter((u) => u.unknown_slug !== slug));
  }, []);

  /* ──── Delete alias ──── */
  const deleteAlias = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("registry_artist_aliases").delete().eq("id", id);
      if (error) throw error;
      showToast("Alias removed", "success");
      loadAliases();
      loadUnknownSlugs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete alias", "error");
    }
  }, [loadAliases, loadUnknownSlugs, showToast]);

  /* ──── Stats ──── */
  const stats = useMemo(() => ({
    pending: unknownSlugs.length,
    confirmed: aliases.length,
    withSuggestions: Array.from(reviewItems.values()).filter((r) => r.suggestions.length > 0).length,
  }), [unknownSlugs, aliases, reviewItems]);

  /* ──────────────────────── Render ──────────────────────── */

  return (
    <div className="min-h-screen bg-[#f7f7f2] space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-5 py-3 text-[13px] font-bold shadow-xl transition-all ${
          toast.type === "success" ? "border-emerald-200 bg-white text-emerald-800" : "border-red-200 bg-white text-red-800"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">Registry</p>
          <h1 className="text-[26px] font-black tracking-tight text-[#171712]">Artist Aliases</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#697062]">
            Reconcile artist name variations — when "Abbas Doobeez" and "Abbas Kubaff" are the same person,
            confirm the link once and the system handles it automatically.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => { loadUnknownSlugs(); loadAliases(); }}
            className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441] flex items-center gap-2 whitespace-nowrap"
          >
            <WkIcon name="RefreshCcw" size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Pending Review", stats.pending, "GitPullRequest"],
          ["With Suggestions", stats.withSuggestions, "Lightbulb"],
          ["Confirmed Aliases", stats.confirmed, "CheckCircle2"],
        ].map(([label, value, icon]) => (
          <div key={label as string} className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <WkIcon name={icon as never} size={14} className="text-[#5f8f2f]" />
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">{label}</p>
            </div>
            <p className="text-[28px] font-black text-[#171712]">{value as number}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-2xl border border-[#dfe4d8] bg-white p-1 w-fit">
        {([
          ["review", "Review Queue", stats.pending],
          ["confirmed", "Confirmed Aliases", stats.confirmed],
        ] as Array<[TabKey, string, number]>).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-[13px] font-bold whitespace-nowrap transition-all ${
              tab === key
                ? "bg-[#5f8f2f] text-white"
                : "text-[#71796b] hover:text-[#171712] hover:bg-[#f0f3ec]"
            }`}
          >
            {label} · {count}
          </button>
        ))}
      </div>

      {/* ──────── REVIEW QUEUE TAB ──────── */}
      {tab === "review" && (
        <>
          {queueError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <WkIcon name="AlertTriangle" size={20} className="shrink-0 text-red-700" />
                <div>
                  <p className="text-[13px] font-bold text-red-800">Could not load unknown slugs</p>
                  <p className="mt-1 text-[12px] text-red-700">{queueError}</p>
                  <button onClick={loadUnknownSlugs} className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-100">
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {!queueError && loadingQueue && (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-[#dfe4d8] bg-white">
              <div className="flex flex-col items-center gap-3">
                <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
                <p className="text-[13px] font-bold text-[#697062]">Scanning for unknown artist slugs…</p>
              </div>
            </div>
          )}

          {!queueError && !loadingQueue && unknownSlugs.length === 0 && (
            <div className="rounded-2xl border border-[#dfe4d8] bg-white">
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                  <WkIcon name="CheckCircle2" size={32} className="text-emerald-600" />
                </div>
                <p className="text-[16px] font-black text-[#171712]">All clear!</p>
                <p className="max-w-md text-[13px] text-[#697062]">
                  Every artist slug in the system resolves to a known registry artist. No loose ends to reconcile.
                </p>
              </div>
            </div>
          )}

          {!queueError && !loadingQueue && unknownSlugs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#697062]">
                  {unknownSlugs.length} unknown artist {unknownSlugs.length === 1 ? "slug" : "slugs"} found across relationship data
                </p>
                <button
                  onClick={loadAllSuggestions}
                  className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2 text-[12px] font-bold text-[#5f8f2f] hover:border-[#85c441] hover:bg-[#f0f7e8] flex items-center gap-2"
                >
                  <WkIcon name="Search" size={13} />
                  Find matches for all
                </button>
              </div>

              {unknownSlugs.map((u) => {
                const item = reviewItems.get(u.unknown_slug);
                const suggestions = item?.suggestions ?? [];
                const isLoading = item?.loadingSuggestions ?? false;

                return (
                  <div
                    key={u.unknown_slug}
                    className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white"
                  >
                    {/* Unknown slug row */}
                    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className="text-[15px] font-black text-[#171712] truncate">{u.unknown_slug}</p>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sourceColor(u.source_table)}`}>
                            {sourceLabel(u.source_table)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#858c7e]">
                          {u.sample_display_name && (
                            <span>Display name: <strong className="text-[#5d6557]">{u.sample_display_name}</strong></span>
                          )}
                          <span>Appears in <strong className="text-[#5d6557]">{u.occurrence_count}</strong> {u.occurrence_count === 1 ? "record" : "records"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {suggestions.length === 0 && !isLoading && (
                          <button
                            onClick={() => loadSuggestions(u.unknown_slug, u.sample_display_name)}
                            className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#5f8f2f] hover:border-[#85c441] hover:bg-[#f0f7e8]"
                          >
                            Find matches
                          </button>
                        )}
                        <button
                          onClick={() => dismissSlug(u.unknown_slug)}
                          className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#858c7e] hover:border-red-300 hover:text-red-700 hover:bg-red-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>

                    {/* Suggestions area */}
                    {isLoading && (
                      <div className="border-t border-[#e8ece2] bg-[#fbfcf8] px-5 py-4 flex items-center gap-2 text-[12px] text-[#858c7e]">
                        <WkIcon name="Loader2" size={14} className="animate-spin" />
                        Searching for similar artists…
                      </div>
                    )}

                    {!isLoading && suggestions.length > 0 && (
                      <div className="border-t border-[#e8ece2] bg-[#fbfcf8] px-5 py-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#858c7e] mb-3">
                          Suggested matches
                        </p>
                        <div className="space-y-2">
                          {suggestions.map((s) => (
                            <div
                              key={s.artist_id}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-[#e8ece2] bg-white p-3 hover:border-[#85c441]/60 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f3ec] text-[11px] font-black text-[#5f8f2f]">
                                  {s.display_name?.charAt(0)?.toUpperCase() ?? "?"}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-[#171712] truncate">{s.display_name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-[#858c7e] truncate">{s.artist_slug}</span>
                                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${scoreColor(s.similarity_score)}`}>
                                      {Math.round(s.similarity_score * 100)}%
                                    </span>
                                    <span className="text-[10px] text-[#b8bfb2]">{matchReasonLabel(s.match_reason)}</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => confirmAlias(u.unknown_slug, s.artist_id, u.sample_display_name)}
                                className="shrink-0 rounded-xl bg-[#5f8f2f] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#4d7526] transition-colors whitespace-nowrap flex items-center gap-1.5"
                              >
                                <WkIcon name="Check" size={12} />
                                Link as alias
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isLoading && suggestions.length === 0 && item !== undefined && (
                      <div className="border-t border-[#e8ece2] bg-[#fbfcf8] px-5 py-3">
                        <p className="text-[12px] text-[#858c7e]">
                          No similar artists found. This might be a genuinely new artist, or the name is too different for automatic matching.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ──────── CONFIRMED ALIASES TAB ──────── */}
      {tab === "confirmed" && (
        <div className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white">
          {loadingAliases && (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
                <p className="text-[13px] font-bold text-[#697062]">Loading aliases…</p>
              </div>
            </div>
          )}

          {!loadingAliases && aliases.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                <WkIcon name="Link" size={28} className="text-[#5f8f2f]" />
              </div>
              <p className="text-[16px] font-black text-[#171712]">No aliases yet</p>
              <p className="max-w-md text-[13px] text-[#697062]">
                When you confirm an alias in the Review Queue, it will appear here. Aliases are automatically resolved during future data imports.
              </p>
            </div>
          )}

          {!loadingAliases && aliases.length > 0 && (
            <div>
              {/* Table header */}
              <div className="grid items-center gap-3 border-b border-[#e8ece2] bg-[#fbfcf8] px-5 py-3 text-[10px] font-black uppercase tracking-wider text-[#71796b]"
                style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1.5fr) 80px 100px 130px 60px" }}
              >
                <span>Alias</span>
                <span>Canonical Artist</span>
                <span>Confidence</span>
                <span>Source</span>
                <span>Created</span>
                <span></span>
              </div>

              {aliases.map((a) => (
                <div
                  key={a.id}
                  className="grid items-center gap-3 border-b border-[#eef1ea] px-5 py-3 hover:bg-[#fbfcf8] transition-colors last:border-b-0"
                  style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1.5fr) 80px 100px 130px 60px" }}
                >
                  {/* Alias */}
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#171712] truncate">{a.alias_slug}</p>
                    {a.alias_display_name && (
                      <p className="text-[11px] text-[#858c7e] truncate">{a.alias_display_name}</p>
                    )}
                  </div>

                  {/* Canonical */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[10px] font-black text-emerald-700">
                        {a.canonical_name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#171712] truncate">{a.canonical_name}</p>
                        <p className="text-[11px] text-[#858c7e] truncate">{a.canonical_slug}</p>
                      </div>
                    </div>
                  </div>

                  {/* Confidence */}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold w-fit ${a.confidence >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {a.confidence}%
                  </span>

                  {/* Source */}
                  <span className="text-[11px] text-[#5d6557] capitalize">{a.source.replace(/_/g, " ")}</span>

                  {/* Created */}
                  <span className="text-[11px] text-[#858c7e]">
                    {new Date(a.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={() => deleteAlias(a.id)}
                    className="flex items-center justify-center h-8 w-8 rounded-lg border border-[#dfe4d8] text-[#858c7e] hover:border-red-300 hover:text-red-700 hover:bg-red-50 transition-colors"
                    title="Remove alias"
                  >
                    <WkIcon name="Trash2" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}