import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

type SourceType = "charts" | "registry" | "provider_intake" | "artist_intake" | "manual";

interface RegistryArtistSearchResult {
  artist_id: string;
  artist_slug: string;
  display_name: string;
  status: string;
  origin_iso2: string | null;
  public_image_url: string | null;
  track_credit_count: number;
  release_credit_count: number;
}

interface DecoupleCredit {
  credit_id: string;
  track_id?: string | null;
  track_slug?: string | null;
  track_title?: string | null;
  release_id?: string | null;
  release_slug?: string | null;
  release_title?: string | null;
  role?: string | null;
  is_primary?: boolean | null;
  is_featured?: boolean | null;
  credit_order?: number | null;
  display_credit?: string | null;
  status?: string | null;
}

interface DecoupleChartEntry {
  entry_id: string;
  track_id?: string | null;
  track_slug?: string | null;
  track_title?: string | null;
  artist_name?: string | null;
  artist_slug?: string | null;
  rank?: number | null;
}

interface DecouplePreview {
  sourceArtist: RegistryArtistSearchResult;
  trackCredits: DecoupleCredit[];
  releaseCredits: DecoupleCredit[];
  chartEntries: DecoupleChartEntry[];
}

interface ArtistResolutionEvent {
  id: string;
  action: "alias_merge" | "artist_merge" | "artist_decouple";
  status: "success" | "failed" | "cancelled";
  source_artist_id: string | null;
  source_artist_slug: string | null;
  source_artist_name: string | null;
  replacement_artists: Array<Record<string, unknown>>;
  track_links: Array<Record<string, unknown>>;
  release_links: Array<Record<string, unknown>>;
  chart_entries: Array<Record<string, unknown>>;
  note: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
}

type Toast = { message: string; type: "success" | "error" } | null;

const INPUT_CLASS = "min-w-0 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#85c441]";
const LABEL_CLASS = "mb-2 block text-[11px] font-black uppercase tracking-wider text-[#71796b]";

const SOURCE_OPTIONS: Array<{
  key: SourceType;
  label: string;
  eyebrow: string;
  description: string;
  status: string;
}> = [
  {
    key: "charts",
    label: "Charts",
    eyebrow: "Chart-origin coupled credits",
    description: "Start from chart rows, chart artist strings, and chart resolution decisions.",
    status: "Use Chart Artist Resolution",
  },
  {
    key: "registry",
    label: "Registry artist entities",
    eyebrow: "Bad combined registry artist",
    description: "Use when one registry artist entity is actually a coupled credit holding track or release links.",
    status: "Read-only preview",
  },
  {
    key: "provider_intake",
    label: "Provider / Apple intake",
    eyebrow: "Provider-origin ambiguity",
    description: "Use when Apple, Spotify, or other provider credits arrive as one coupled artist string.",
    status: "Phase 1B source queue",
  },
  {
    key: "artist_intake",
    label: "Artist Intake drawer",
    eyebrow: "Admin intake-origin ambiguity",
    description: "Use when an artist intake submission creates a multi-artist ambiguity before canonical matching.",
    status: "Phase 1B source queue",
  },
  {
    key: "manual",
    label: "Manual investigation",
    eyebrow: "Known risky case",
    description: "Use only when an admin already knows the exact bad source artist to inspect.",
    status: "Read-only preview",
  },
];

function asArtistRows(data: unknown): RegistryArtistSearchResult[] {
  return ((data as RegistryArtistSearchResult[]) ?? []).map((row) => ({
    ...row,
    track_credit_count: Number(row.track_credit_count ?? 0),
    release_credit_count: Number(row.release_credit_count ?? 0),
  }));
}

function asHistoryRows(data: unknown): ArtistResolutionEvent[] {
  return ((data as ArtistResolutionEvent[]) ?? []).map((row) => ({
    ...row,
    replacement_artists: row.replacement_artists ?? [],
    track_links: row.track_links ?? [],
    release_links: row.release_links ?? [],
    chart_entries: row.chart_entries ?? [],
  }));
}

function asPreview(data: unknown): DecouplePreview | null {
  if (!data) return null;

  const preview = data as DecouplePreview;
  return {
    sourceArtist: preview.sourceArtist,
    trackCredits: preview.trackCredits ?? [],
    releaseCredits: preview.releaseCredits ?? [],
    chartEntries: preview.chartEntries ?? [],
  };
}

function truncate(value: string | null | undefined, max = 46): string {
  const clean = value?.trim() ?? "";
  if (!clean) return "Untitled";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function actionLabel(action: ArtistResolutionEvent["action"]): string {
  switch (action) {
    case "artist_decouple": return "Artist decouple";
    case "artist_merge": return "Artist merge";
    case "alias_merge": return "Alias merge";
    default: return action;
  }
}

function statusClass(status: ArtistResolutionEvent["status"]): string {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function sourceTypeLabel(sourceType: SourceType): string {
  return SOURCE_OPTIONS.find((item) => item.key === sourceType)?.label ?? sourceType;
}

function SourceCard({
  active,
  option,
  onSelect,
}: {
  active: boolean;
  option: (typeof SOURCE_OPTIONS)[number];
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active ? "border-[#85c441] bg-[#f0f7e8]" : "border-[#dfe4d8] bg-white hover:border-[#85c441]"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5f8f2f]">{option.eyebrow}</p>
          <p className="mt-1 text-[16px] font-black text-[#171712]">{option.label}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
          active ? "bg-white text-[#5f8f2f]" : "bg-[#f0f3ec] text-[#71796b]"
        }`}>
          {option.status}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-[#697062]">{option.description}</p>
    </button>
  );
}

function ArtistCandidateCard({
  artist,
  selected,
  onSelect,
}: {
  artist: RegistryArtistSearchResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected ? "border-[#85c441] bg-[#f0f7e8]" : "border-[#e8ece2] bg-white hover:border-[#85c441]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-[#171712]">{artist.display_name}</p>
          <p className="truncate text-[11px] text-[#858c7e]">{artist.artist_slug}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#5d6557]">
          {artist.status}
        </span>
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#858c7e]">
        {artist.track_credit_count} track credits · {artist.release_credit_count} release credits
      </p>
    </button>
  );
}

function EmptySourceNotice({ selectedSource }: { selectedSource: SourceType }) {
  if (selectedSource === "charts") {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Charts begin in Chart Artist Resolution</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Chart-origin coupled credits should be diagnosed from the chart row first. That surface already knows the edition,
          rank, raw artist string, parsed tokens, canonical track, and chart decision status.
        </p>
        <a
          href="/admin/charts/artist-resolution"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-black text-white"
        >
          <WkIcon name="ArrowRight" size={13} />
          Open Chart Artist Resolution
        </a>
      </div>
    );
  }

  if (selectedSource === "provider_intake") {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Provider source queue comes next</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Phase 1B will add a read-only queue for coupled credits entering through Apple, Spotify, and provider intake.
          No mutation is exposed from this placeholder.
        </p>
      </div>
    );
  }

  if (selectedSource === "artist_intake") {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Artist Intake source queue comes next</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Phase 1B will add a read-only queue for ambiguity created inside the Artist Intake drawer.
          This page will not mutate artist credits until a decision is saved in Phase 2.
        </p>
      </div>
    );
  }

  return null;
}

function PreviewPanel({
  preview,
  loading,
  sourceArtist,
  onLoadPreview,
}: {
  preview: DecouplePreview | null;
  loading: boolean;
  sourceArtist: RegistryArtistSearchResult | null;
  onLoadPreview: () => void;
}) {
  if (!sourceArtist) {
    return (
      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <p className="text-[15px] font-black text-[#171712]">Candidate drawer</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#697062]">
          Select a source artist to inspect provenance and impact. No replacement artists or decouple actions are exposed in Phase 1.
        </p>
      </div>
    );
  }

  const totalCredits = (preview?.trackCredits.length ?? 0) + (preview?.releaseCredits.length ?? 0);

  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5f8f2f]">Read-only candidate</p>
          <p className="mt-1 text-[18px] font-black text-[#171712]">{sourceArtist.display_name}</p>
          <p className="text-[12px] text-[#858c7e]">{sourceArtist.artist_slug} · {sourceArtist.status}</p>
        </div>
        <button
          onClick={onLoadPreview}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-black text-white disabled:opacity-50"
        >
          <WkIcon name={loading ? "Loader2" : "Search"} size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Previewing…" : "Preview source impact"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <WkIcon name="AlertTriangle" size={16} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="text-[12px] font-black text-amber-900">Phase 1 safety lock</p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
              This page is now inspection-only. Decouple decisions will be saved in Phase 2 and applied only from a ready decision in Phase 4.
            </p>
          </div>
        </div>
      </div>

      {preview && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{totalCredits}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">source credits</p>
            </div>
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{preview.trackCredits.length}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">tracks</p>
            </div>
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{preview.releaseCredits.length}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">releases</p>
            </div>
            <div className="rounded-xl bg-[#fbfcf8] p-3">
              <p className="text-[20px] font-black text-[#171712]">{preview.chartEntries.length}</p>
              <p className="text-[10px] font-black uppercase text-[#858c7e]">chart rows</p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#858c7e]">Track links</p>
              <div className="max-h-[180px] space-y-1.5 overflow-auto pr-1">
                {preview.trackCredits.length === 0 ? (
                  <p className="text-[12px] text-[#858c7e]">No track links found.</p>
                ) : preview.trackCredits.slice(0, 30).map((track) => (
                  <div key={track.credit_id} className="text-[12px]">
                    <span className="font-bold text-[#171712]">{truncate(track.track_title, 36)}</span>
                    <span className="text-[#858c7e]"> · {track.role ?? "unknown"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#858c7e]">Release links</p>
              <div className="max-h-[180px] space-y-1.5 overflow-auto pr-1">
                {preview.releaseCredits.length === 0 ? (
                  <p className="text-[12px] text-[#858c7e]">No release links found.</p>
                ) : preview.releaseCredits.slice(0, 30).map((release) => (
                  <div key={release.credit_id} className="text-[12px]">
                    <span className="font-bold text-[#171712]">{truncate(release.release_title, 36)}</span>
                    <span className="text-[#858c7e]"> · {release.role ?? "unknown"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#858c7e]">Chart rows</p>
              <div className="max-h-[180px] space-y-1.5 overflow-auto pr-1">
                {preview.chartEntries.length === 0 ? (
                  <p className="text-[12px] text-[#858c7e]">No chart rows found.</p>
                ) : preview.chartEntries.slice(0, 30).map((entry) => (
                  <div key={entry.entry_id} className="text-[12px]">
                    <span className="font-bold text-[#171712]">{truncate(entry.track_title, 34)}</span>
                    <span className="text-[#858c7e]"> · {entry.artist_slug ?? entry.artist_name ?? "unknown artist"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  events,
  loading,
  onRefresh,
}: {
  events: ArtistResolutionEvent[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[15px] font-black text-[#171712]">Resolution history</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#697062]">
            Existing merge and decouple history remains visible, but new decouples are locked behind the source-first workflow.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[12px] font-bold text-[#5f8f2f] hover:border-[#85c441]"
        >
          <WkIcon name={loading ? "Loader2" : "RefreshCcw"} size={13} className={loading ? "animate-spin" : ""} />
          Refresh history
        </button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dfe4d8] bg-[#fbfcf8] p-4 text-[13px] text-[#697062]">
          No artist resolution events recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {events.slice(0, 20).map((event) => (
            <div key={event.id} className="rounded-2xl border border-[#e8ece2] bg-[#fbfcf8] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusClass(event.status)}`}>
                      {event.status}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#5d6557]">
                      {actionLabel(event.action)}
                    </span>
                    <span className="text-[11px] text-[#858c7e]">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[14px] font-black text-[#171712]">
                    Source: {event.source_artist_slug ?? "unknown"}
                    {event.source_artist_name ? ` (${event.source_artist_name})` : ""}
                  </p>
                  {event.note && <p className="mt-2 text-[12px] text-[#697062]">{event.note}</p>}
                  {event.error_message && (
                    <p className="mt-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-[12px] font-bold text-red-700">
                      {event.error_message}
                    </p>
                  )}
                </div>

                <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[16px] font-black text-[#171712]">{event.track_links.length}</p>
                    <p className="text-[9px] font-black uppercase text-[#858c7e]">tracks</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[16px] font-black text-[#171712]">{event.release_links.length}</p>
                    <p className="text-[9px] font-black uppercase text-[#858c7e]">releases</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[16px] font-black text-[#171712]">{event.chart_entries.length}</p>
                    <p className="text-[9px] font-black uppercase text-[#858c7e]">charts</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminArtistDecouplePage() {
  const [selectedSource, setSelectedSource] = useState<SourceType>("registry");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<RegistryArtistSearchResult[]>([]);
  const [sourceArtist, setSourceArtist] = useState<RegistryArtistSearchResult | null>(null);
  const [preview, setPreview] = useState<DecouplePreview | null>(null);
  const [searchingSource, setSearchingSource] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState<ArtistResolutionEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const canSearchSource = selectedSource === "registry" || selectedSource === "manual";

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_artist_resolution_history", { p_limit: 100 });
      if (error) throw error;
      setHistory(asHistoryRows(data));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sourceCounts = useMemo(() => ({
    trackCredits: preview?.trackCredits.length ?? 0,
    releaseCredits: preview?.releaseCredits.length ?? 0,
    chartRows: preview?.chartEntries.length ?? 0,
    candidates: sourceResults.length,
  }), [preview, sourceResults.length]);

  const searchSourceArtists = useCallback(async () => {
    const clean = sourceQuery.trim();
    if (!clean) {
      setSourceResults([]);
      return;
    }

    if (!canSearchSource) {
      showToast("This source queue is staged for Phase 1B.", "error");
      return;
    }

    setSearchingSource(true);

    try {
      const { data, error } = await supabase.rpc("admin_search_registry_artists", {
        p_query: clean,
        p_limit: 25,
      });

      if (error) throw error;
      setSourceResults(asArtistRows(data));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Source artist search failed", "error");
      setSourceResults([]);
    } finally {
      setSearchingSource(false);
    }
  }, [canSearchSource, showToast, sourceQuery]);

  const selectSourceArtist = useCallback((artist: RegistryArtistSearchResult) => {
    setSourceArtist(artist);
    setPreview(null);
  }, []);

  const loadPreview = useCallback(async () => {
    if (!sourceArtist) {
      showToast("Select a source artist first.", "error");
      return;
    }

    setPreviewLoading(true);

    try {
      const { data, error } = await supabase.rpc("admin_get_artist_decouple_preview", {
        p_source_artist_id: sourceArtist.artist_id,
      });

      if (error) throw error;

      setPreview(asPreview(data));
      showToast("Read-only source preview loaded", "success");
    } catch (err) {
      setPreview(null);
      showToast(err instanceof Error ? err.message : "Preview failed", "error");
    } finally {
      setPreviewLoading(false);
    }
  }, [showToast, sourceArtist]);

  const switchSource = useCallback((source: SourceType) => {
    setSelectedSource(source);
    setSourceQuery("");
    setSourceResults([]);
    setSourceArtist(null);
    setPreview(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f7f2] space-y-5">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-5 py-3 text-[13px] font-bold shadow-xl ${
          toast.type === "success" ? "border-emerald-200 bg-white text-emerald-800" : "border-red-200 bg-white text-red-800"
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">Registry</p>
          <h1 className="text-[26px] font-black tracking-tight text-[#171712]">Decouple Artist Credits</h1>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[#697062]">
            Source-first inspection for coupled artist credits. Pick where the problem came from, inspect the candidate,
            then save a decision in the next phase. Direct decouple mutation is intentionally disabled here.
          </p>
        </div>
        <a
          href="/admin/registry/artist-aliases"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:border-[#85c441]"
        >
          <WkIcon name="Link" size={13} />
          Back to aliases
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Current source</p>
          <p className="mt-1 text-[24px] font-black text-[#171712]">{sourceTypeLabel(selectedSource)}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Candidates</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{sourceCounts.candidates}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Source credits</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{sourceCounts.trackCredits + sourceCounts.releaseCredits}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Chart rows</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{sourceCounts.chartRows}</p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        {SOURCE_OPTIONS.map((option) => (
          <SourceCard
            key={option.key}
            option={option}
            active={selectedSource === option.key}
            onSelect={() => switchSource(option.key)}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {canSearchSource ? (
            <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
              <div className="mb-4">
                <p className="text-[15px] font-black text-[#171712]">1. Pick the coupled source</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#697062]">
                  Search only for the source artist/entity to inspect. Replacement matching is intentionally hidden until Phase 3.
                </p>
              </div>

              <label className={LABEL_CLASS}>Source candidate</label>
              <div className="flex gap-2">
                <input
                  value={sourceQuery}
                  onChange={(event) => setSourceQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") searchSourceArtists(); }}
                  placeholder={selectedSource === "manual" ? "Search exact bad source artist..." : "Search coupled registry artist..."}
                  className={`${INPUT_CLASS} flex-1`}
                />
                <button
                  onClick={searchSourceArtists}
                  disabled={searchingSource}
                  className="rounded-xl bg-[#171712] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                >
                  {searchingSource ? "..." : "Search"}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {sourceResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#dfe4d8] bg-[#fbfcf8] p-4 text-[13px] text-[#697062]">
                    Search for a source artist to inspect. This will not mutate registry data.
                  </div>
                ) : sourceResults.map((artist) => (
                  <ArtistCandidateCard
                    key={artist.artist_id}
                    artist={artist}
                    selected={sourceArtist?.artist_id === artist.artist_id}
                    onSelect={() => selectSourceArtist(artist)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptySourceNotice selectedSource={selectedSource} />
          )}
        </div>

        <PreviewPanel
          preview={preview}
          loading={previewLoading}
          sourceArtist={sourceArtist}
          onLoadPreview={loadPreview}
        />
      </div>

      <HistoryPanel events={history} loading={historyLoading} onRefresh={loadHistory} />
    </div>
  );
}
