import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type RegistryStatus = {
  release_artists_links: number;
  release_tracks_links: number;
  track_artist_links: number;
};

type ArtistEntry = { slug: string; display_name: string };

type BatchResult = {
  slug: string;
  success: boolean;
  scraped_releases?: number;
  scraped_appears_on?: number;
  stats?: Record<string, number>;
  errors?: string[];
};

type BatchSummary = {
  total: number;
  aggregate: Record<string, number>;
  results: BatchResult[];
};

type ScrapedPreview = {
  name: string;
  bio_length: number;
  releases: number;
  appears_on: number;
  top_songs: number;
  videos: number;
  related_artists: number;
  genres: string[];
  country: string | null;
  sample_releases: Array<{ title: string; type: string; date: string | null; track_count: number; sample_tracks: string[] }>;
  sample_appears_on: Array<{ title: string; primary_artist: string; track_count: number }>;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScraperPage() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<RegistryStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [artists, setArtists] = useState<ArtistEntry[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);

  // Single artist scrape
  const [singleSlug, setSingleSlug] = useState("bien");
  const [singleDryRun, setSingleDryRun] = useState(true);
  const [singleOverwrite, setSingleOverwrite] = useState(false);
  const [singleBioOnly, setSingleBioOnly] = useState(false);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<{ success: boolean; scraped?: ScrapedPreview; write_result?: { success: boolean; stats: Record<string, number>; errors: string[] }; error?: string } | null>(null);

  // Batch scrape
  const [batchDryRun, setBatchDryRun] = useState(true);
  const [batchOverwrite, setBatchOverwrite] = useState(false);
  const [batchBioOnly, setBatchBioOnly] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentSlug: string }>({ current: 0, total: 0, currentSlug: "" });
  const [batchResults, setBatchResults] = useState<BatchSummary[]>([]);
  const [batchSlice, setBatchSlice] = useState<{ from: number; to: number }>({ from: 0, to: 20 });

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-artist-data", {
        body: { mode: "status" },
      });
      if (!error && data?.registry) setStatus(data.registry as RegistryStatus);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadArtists = useCallback(async () => {
    setArtistsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-artist-data", {
        body: { mode: "list_artists" },
      });
      if (!error && data?.artists) setArtists(data.artists as ArtistEntry[]);
    } finally {
      setArtistsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadArtists();
  }, [loadStatus, loadArtists]);

  // ── Single scrape ────────────────────────────────────────────────────────
  const handleScrapeOne = useCallback(async () => {
    if (!singleSlug.trim()) return;
    setSingleLoading(true);
    setSingleResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-artist-data", {
        body: { mode: "scrape_one", artistSlug: singleSlug.trim(), dryRun: singleDryRun, overwrite: singleOverwrite, bioOnly: singleBioOnly },
      });
      if (error) {
        setSingleResult({ success: false, error: error.message });
      } else {
        setSingleResult(data as any);
        if (!singleDryRun) await loadStatus();
      }
    } catch (err) {
      setSingleResult({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSingleLoading(false);
    }
  }, [singleSlug, singleDryRun, singleOverwrite, singleBioOnly, loadStatus]);

  // ── Batch scrape ─────────────────────────────────────────────────────────
  const handleBatchScrape = useCallback(async () => {
    if (!artists.length) return;

    const artistsToScrape = artists.slice(batchSlice.from, batchSlice.to > 0 ? batchSlice.to : artists.length);
    if (!artistsToScrape.length) return;

    setBatchRunning(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: artistsToScrape.length, currentSlug: "" });

    const BATCH_SIZE = 10; // 10 artists per edge function call
    const batches = chunk(artistsToScrape.map(a => a.slug), BATCH_SIZE);

    let processed = 0;
    const allResults: BatchSummary[] = [];

    for (const batch of batches) {
      setBatchProgress(prev => ({ ...prev, currentSlug: batch[0], current: processed }));

      try {
        const { data, error } = await supabase.functions.invoke("scrape-artist-data", {
          body: { mode: "batch", slugs: batch, dryRun: batchDryRun, overwrite: batchOverwrite, bioOnly: batchBioOnly },
        });

        if (!error && data) {
          allResults.push(data as BatchSummary);
          setBatchResults([...allResults]);
        }

        processed += batch.length;
        setBatchProgress(prev => ({ ...prev, current: processed }));
      } catch (err) {
        console.error("Batch error:", err);
      }

      // Small pause between batches
      if (!batchDryRun) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setBatchRunning(false);
    await loadStatus();
  }, [artists, batchDryRun, batchOverwrite, batchBioOnly, batchSlice, loadStatus]);

  // ── Aggregate batch stats ────────────────────────────────────────────────
  const aggregateStats = batchResults.reduce((acc, batch) => {
    for (const [k, v] of Object.entries(batch.aggregate || {})) {
      acc[k] = (acc[k] ?? 0) + v;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalBatchResults = batchResults.reduce((acc, b) => acc + (b.results?.length ?? 0), 0);
  const failedBatchResults = batchResults.reduce((acc, b) => acc + (b.results?.filter(r => !r.success).length ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports → Scraper</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Artist Data Scraper</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-wk-text-muted">
            Scrapes artist pages from wakilisha.africa (the old WordPress site) and feeds the data into the registry.
            Extracts bios, releases with full tracklists, "Appears On" releases, featured artists, social links, and videos.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/imports")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="ArrowLeft" size={14} /> Back to Imports
        </button>
      </div>

      {/* Registry Status Strip */}
      <WkSurface className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-[13px] font-black text-wk-text">Registry Status</h2>
          <button
            onClick={loadStatus}
            disabled={statusLoading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-wk-brand hover:underline cursor-pointer"
          >
            {statusLoading ? <WkIcon name="Loader2" size={12} className="animate-spin" /> : <WkIcon name="RefreshCw" size={12} />}
            Refresh
          </button>
        </div>
        {status ? (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Release→Artist Links", value: status.release_artists_links, target: 1000, icon: "Music" },
              { label: "Release→Track Links", value: status.release_tracks_links, target: 5000, icon: "Disc" },
              { label: "Track→Artist Links", value: status.track_artist_links, target: 8000, icon: "Users" },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                <div className="text-[20px] font-black text-wk-text">{stat.value.toLocaleString()}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{stat.label}</div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-wk-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${Math.min(100, Math.round((stat.value / stat.target) * 100))}%` }}
                  />
                </div>
                <div className="mt-1 text-[9px] text-wk-text-muted">{Math.round((stat.value / stat.target) * 100)}% of est. target</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-wk-text-muted">Loading registry status...</div>
        )}
      </WkSurface>

      {/* Single Artist Test */}
      <WkSurface className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100">
            <i className="ri-search-line text-base text-accent-600" />
          </div>
          <div>
            <h2 className="text-[14px] font-black text-wk-text">Test — Single Artist</h2>
            <p className="text-[12px] text-wk-text-muted mt-0.5">
              Scrape a single artist to verify the extraction looks correct before running the full batch.
              <strong> Always dry-run first.</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="block flex-1 min-w-[200px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Artist Slug</span>
            <input
              type="text"
              value={singleSlug}
              onChange={e => setSingleSlug(e.target.value)}
              placeholder="bien"
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand"
              list="artist-slugs-list"
            />
            <datalist id="artist-slugs-list">
              {artists.slice(0, 50).map(a => (
                <option key={a.slug} value={a.slug}>{a.display_name}</option>
              ))}
            </datalist>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={singleDryRun}
              onChange={e => setSingleDryRun(e.target.checked)}
              className="h-4 w-4 accent-primary-500 cursor-pointer"
            />
            <span className="text-[13px] font-semibold text-wk-text">Dry run</span>
            {singleDryRun && (
              <span className="rounded-full border border-wk-warning/30 bg-wk-warning-soft/50 px-2 py-0.5 text-[10px] font-bold text-wk-warning">
                Preview only
              </span>
            )}
            {!singleDryRun && (
              <span className="rounded-full border border-wk-danger/30 bg-wk-danger-soft/50 px-2 py-0.5 text-[10px] font-bold text-wk-danger">
                Writes to DB
              </span>
            )}
          </label>

          <label className={`flex items-center gap-2 ${singleDryRun ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={singleOverwrite}
              onChange={e => setSingleOverwrite(e.target.checked)}
              disabled={singleDryRun}
              className="h-4 w-4 accent-secondary-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-[13px] font-semibold text-wk-text">Overwrite existing</span>
            {singleOverwrite && !singleDryRun && (
              <span className="rounded-full border border-wk-danger/40 bg-wk-danger-soft/60 px-2 py-0.5 text-[10px] font-bold text-wk-danger">
                Destructive
              </span>
            )}
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={singleBioOnly}
              onChange={e => setSingleBioOnly(e.target.checked)}
              className="h-4 w-4 accent-green-600 cursor-pointer"
            />
            <span className="text-[13px] font-semibold text-wk-text">Bio only</span>
            {singleBioOnly && (
              <span className="rounded-full border border-green-500/30 bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                Skips releases & tracks
              </span>
            )}
          </label>

          <button
            onClick={handleScrapeOne}
            disabled={singleLoading || !singleSlug.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-[13px] font-bold text-white whitespace-nowrap hover:bg-accent-600 disabled:opacity-50 transition-colors"
          >
            {singleLoading
              ? <><WkIcon name="Loader2" size={14} className="animate-spin" /> Scraping...</>
              : <><i className="ri-search-line" /> {singleBioOnly ? "Scrape Bio" : "Scrape Artist"}</>}
          </button>
        </div>

        {singleResult && (
          <div className={`mt-4 rounded-xl border p-4 ${singleResult.success ? "border-wk-success/20 bg-wk-success-soft/50" : "border-wk-danger/20 bg-wk-danger-soft/50"}`}>
            <div className="flex items-center gap-2 mb-2">
              <WkIcon name={singleResult.success ? "CheckCircle2" : "XCircle"} size={16} className={singleResult.success ? "text-wk-success" : "text-wk-danger"} />
              <span className="text-[13px] font-bold text-wk-text">
                {singleResult.success
                  ? `${singleResult.scraped?.name} — scraped successfully${singleDryRun ? " (dry run)" : ""}${singleBioOnly ? " (bio only)" : ""}`
                  : `Scrape failed: ${singleResult.error}`}
              </span>
              {singleResult.success && !singleDryRun && (
                <a
                  href={`/artists/${singleSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 ml-auto rounded-lg border border-wk-success/30 bg-white/70 px-3 py-1.5 text-[12px] font-bold text-wk-success hover:bg-wk-success hover:text-white transition-colors cursor-pointer"
                >
                  <i className="ri-external-link-line" /> View Artist Page
                </a>
              )}
            </div>

            {singleResult.scraped && (
              <div className="space-y-3">
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {[
                    { label: "Bio length", value: `${singleResult.scraped.bio_length} chars` },
                    { label: "Releases found", value: singleResult.scraped.releases },
                    { label: "Appears On", value: singleResult.scraped.appears_on },
                    { label: "Top songs", value: singleResult.scraped.top_songs },
                    { label: "Videos", value: singleResult.scraped.videos },
                    { label: "Related artists", value: singleResult.scraped.related_artists },
                    { label: "Country", value: singleResult.scraped.country || "—" },
                    { label: "Genres", value: singleResult.scraped.genres.join(", ") || "—" },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-white/60 p-2.5 border border-white/50">
                      <div className="text-[14px] font-black text-wk-text">{s.value}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-wk-text-muted">{s.label}</div>
                    </div>
                  ))}
                </div>

                {singleResult.scraped.sample_releases.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-1.5">Sample Releases</div>
                    <div className="space-y-1.5">
                      {singleResult.scraped.sample_releases.map((r, i) => (
                        <div key={i} className="rounded-lg bg-white/60 border border-white/50 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-wk-text">{r.title}</span>
                            <span className="rounded-full bg-secondary-100 text-secondary-700 px-1.5 py-0.5 text-[10px] font-semibold">{r.type}</span>
                            {r.date && <span className="text-[10px] text-wk-text-muted">{r.date}</span>}
                            <span className="text-[10px] text-wk-text-muted">{r.track_count} tracks</span>
                          </div>
                          {r.sample_tracks.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {r.sample_tracks.map((t, ti) => (
                                <div key={ti} className="text-[11px] text-wk-text-muted font-mono">{t}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {singleResult.scraped.sample_appears_on.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-1.5">Sample Appears On</div>
                    <div className="space-y-1">
                      {singleResult.scraped.sample_appears_on.map((a, i) => (
                        <div key={i} className="rounded-lg bg-white/60 border border-white/50 px-2.5 py-2 flex items-center gap-2">
                          <span className="text-[12px] font-bold text-wk-text">{a.title}</span>
                          <span className="text-[11px] text-wk-text-muted">by {a.primary_artist}</span>
                          <span className="text-[10px] text-wk-text-muted">{a.track_count} tracks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {singleResult.write_result && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted mb-1.5">Write Result</div>
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                      {Object.entries(singleResult.write_result.stats).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-white/60 p-2 border border-white/50">
                          <div className="text-[14px] font-black text-wk-text">{v}</div>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-wk-text-muted">{k.replace(/_/g, " ")}</div>
                        </div>
                      ))}
                    </div>
                    {singleResult.write_result.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {singleResult.write_result.errors.map((e, i) => (
                          <div key={i} className="text-[11px] text-wk-danger font-mono">{e}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </WkSurface>

      {/* Batch Runner */}
      <WkSurface className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100">
            <WkIcon name="Zap" size={16} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-[14px] font-black text-wk-text">Batch Scrape — All Artists</h2>
            <p className="text-[12px] text-wk-text-muted mt-0.5">
              Scrape all {artists.length} artists from the old site in batches of 10. Run dry first, then commit.
              Processing {artists.length} artists takes approximately {Math.ceil(artists.length / 10 * 1.5)} minutes.
            </p>
          </div>
        </div>

        {/* Batch configuration */}
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Start index (0 = beginning)</span>
            <input
              type="number"
              min="0"
              max={artists.length}
              value={batchSlice.from}
              onChange={e => setBatchSlice(prev => ({ ...prev, from: parseInt(e.target.value) || 0 }))}
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">End index (0 = all)</span>
            <input
              type="number"
              min="0"
              max={artists.length}
              value={batchSlice.to}
              onChange={e => setBatchSlice(prev => ({ ...prev, to: parseInt(e.target.value) || 0 }))}
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand"
            />
          </label>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={batchDryRun}
                onChange={e => setBatchDryRun(e.target.checked)}
                className="h-4 w-4 accent-primary-500 cursor-pointer"
              />
              <span className="text-[13px] font-semibold text-wk-text">Dry run</span>
              {batchDryRun && (
                <span className="rounded-full border border-wk-warning/30 bg-wk-warning-soft/50 px-2 py-0.5 text-[10px] font-bold text-wk-warning">
                  Preview only
                </span>
              )}
              {!batchDryRun && (
                <span className="rounded-full border border-wk-danger/30 bg-wk-danger-soft/50 px-2 py-0.5 text-[10px] font-bold text-wk-danger">
                  Writes to DB
                </span>
              )}
            </label>
            <label className={`flex items-center gap-2 pb-2 ${batchDryRun ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={batchOverwrite}
                onChange={e => setBatchOverwrite(e.target.checked)}
                disabled={batchDryRun}
                className="h-4 w-4 accent-secondary-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-[13px] font-semibold text-wk-text">Overwrite existing</span>
              {batchOverwrite && !batchDryRun && (
                <span className="rounded-full border border-wk-danger/40 bg-wk-danger-soft/60 px-2 py-0.5 text-[10px] font-bold text-wk-danger">
                  Destructive
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={batchBioOnly}
                onChange={e => setBatchBioOnly(e.target.checked)}
                className="h-4 w-4 accent-green-600 cursor-pointer"
              />
              <span className="text-[13px] font-semibold text-wk-text">Bio only</span>
              {batchBioOnly && (
                <span className="rounded-full border border-green-500/30 bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                  Skips releases & tracks
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {artistsLoading ? (
            <div className="text-[13px] text-wk-text-muted flex items-center gap-2">
              <WkIcon name="Loader2" size={14} className="animate-spin" /> Loading artist list...
            </div>
          ) : (
            <div className="text-[13px] text-wk-text-muted">
              {artists.length} artists in registry.
              Will scrape: <strong className="text-wk-text">{Math.min(artists.length, (batchSlice.to || artists.length) - batchSlice.from)}</strong> artists
              (index {batchSlice.from}–{batchSlice.to || artists.length}).
            </div>
          )}

          <button
            onClick={handleBatchScrape}
            disabled={batchRunning || artistsLoading || !artists.length}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-[13px] font-bold text-white whitespace-nowrap hover:bg-primary-600 disabled:opacity-50 transition-colors ml-auto"
          >
            {batchRunning
                ? <><WkIcon name="Loader2" size={14} className="animate-spin" /> Running... ({batchProgress.current}/{batchProgress.total})</>
                : <><WkIcon name="Zap" size={14} /> {batchDryRun ? "Dry Run All" : batchBioOnly ? "Scrape Bios Only" : "Scrape & Write All"}</>}
          </button>
        </div>

        {/* Progress bar */}
        {batchRunning && batchProgress.total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] text-wk-text-muted">
                Processing <strong className="font-mono">{batchProgress.currentSlug}</strong>...
              </span>
              <span className="text-[12px] font-bold text-wk-text">
                {batchProgress.current}/{batchProgress.total}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-wk-border overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Aggregate stats */}
        {batchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <WkIcon name="CheckCircle2" size={16} className="text-wk-success" />
              <span className="text-[13px] font-bold text-wk-text">
                Batch complete — {totalBatchResults} artists processed, {failedBatchResults} failed
              </span>
              {batchDryRun && <span className="rounded-full border border-wk-warning/30 bg-wk-warning-soft/50 px-2 py-0.5 text-[10px] font-bold text-wk-warning">Dry run — nothing was written</span>}
            </div>

            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {Object.entries(aggregateStats).filter(([, v]) => v > 0).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-2.5">
                  <div className="text-[18px] font-black text-wk-text">{v.toLocaleString()}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-wk-text-muted">{k.replace(/_/g, " ")}</div>
                </div>
              ))}
            </div>

            {/* Per-artist results */}
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-bold text-wk-text-muted hover:text-wk-text">
                View per-artist results ({totalBatchResults} entries)
              </summary>
              <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-wk-border">
                {batchResults.flatMap(batch => batch.results).map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-wk-border last:border-0 ${!r.success ? "bg-wk-danger-soft/30" : ""}`}
                  >
                    <WkIcon
                      name={r.success ? "CheckCircle2" : "XCircle"}
                      size={12}
                      className={r.success ? "text-wk-success" : "text-wk-danger"}
                    />
                    <span className="text-[12px] font-mono text-wk-text min-w-[160px]">{r.slug}</span>
                    {r.success && r.stats && (
                      <span className="text-[11px] text-wk-text-muted">
                        +{r.stats.releases_upserted || 0} releases, +{r.stats.tracks_upserted || 0} tracks
                        {r.scraped_appears_on ? `, ${r.scraped_appears_on} appears-on` : ""}
                      </span>
                    )}
                    {!r.success && r.errors && (
                      <span className="text-[11px] text-wk-danger">{r.errors[0]}</span>
                    )}
                    {r.success && (
                      <a
                        href={`/artists/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 rounded-md border border-wk-border bg-white/70 px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:text-wk-text hover:border-wk-brand/30 transition-colors cursor-pointer"
                      >
                        <i className="ri-external-link-line text-[10px]" /> View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </WkSurface>

      {/* How it works */}
      <WkSurface className="p-5">
        <h3 className="text-[13px] font-black text-wk-text mb-3">How it works</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "Globe", title: "1. Scrape old site", desc: "Fetches each artist's page from wakilisha.africa, parses HTML to extract bio, releases with full tracklists, appears-on, videos, and related artists." },
            { icon: "Database", title: "2. Match registry", desc: "Checks if releases/tracks already exist by title or ISRC. In overwrite mode, updates existing records with fresh scraped data. Otherwise, only fills in missing artwork." },
            { icon: "Link", title: "3. Write relationships", desc: "Creates registry_release_artists, registry_release_tracks, and registry_track_artists links so the discography and appears-on sections appear automatically." },
          ].map(s => (
            <div key={s.title} className="rounded-lg border border-wk-border p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <WkIcon name={s.icon as any} size={14} className="text-primary-500" />
                <span className="text-[12px] font-bold text-wk-text">{s.title}</span>
              </div>
              <p className="text-[11px] leading-5 text-wk-text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-wk-warning/20 bg-wk-warning-soft/30 p-3">
          <p className="text-[11px] leading-5 text-wk-text-muted">
            <strong>Safe to re-run:</strong> The scraper uses upsert semantics — running it multiple times on the same artist is safe. It won't create duplicates, and it will fill in any gaps from a previous run.
            Enable <strong>Overwrite existing</strong> to force-update titles, dates, types, artwork, and track metadata on releases that already exist in the registry.
            Always dry-run first to verify extraction quality before committing.
          </p>
        </div>
      </WkSurface>
    </div>
  );
}