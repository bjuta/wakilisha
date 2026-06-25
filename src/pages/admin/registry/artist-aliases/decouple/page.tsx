import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

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
  role: string;
  is_primary: boolean;
  is_featured: boolean;
  credit_order: number;
  display_credit: string | null;
  status: string;
}

interface DecoupleChartEntry {
  entry_id: string;
  track_id: string | null;
  track_slug: string | null;
  track_title: string;
  artist_name: string;
  artist_slug: string | null;
  rank: number | null;
}

interface DecouplePreview {
  sourceArtist: RegistryArtistSearchResult;
  trackCredits: DecoupleCredit[];
  releaseCredits: DecoupleCredit[];
  chartEntries: DecoupleChartEntry[];
}

interface ReplacementArtist {
  artist: RegistryArtistSearchResult;
  role: string;
  is_primary: boolean;
  is_featured: boolean;
  credit_order: number;
  display_credit: string;
}

type Toast = { message: string; type: "success" | "error" } | null;

const ROLE_OPTIONS = [
  { value: "primary_artist", label: "Primary artist" },
  { value: "featured_artist", label: "Featured artist" },
  { value: "collaborator", label: "Collaborator" },
  { value: "producer", label: "Producer" },
  { value: "composer", label: "Composer" },
  { value: "remixer", label: "Remixer" },
  { value: "group_member", label: "Group member" },
  { value: "unknown", label: "Unknown" },
];

const INPUT_CLASS = "min-w-0 rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#85c441]";
const LABEL_CLASS = "mb-2 block text-[11px] font-black uppercase tracking-wider text-[#71796b]";

function asArtistRows(data: unknown): RegistryArtistSearchResult[] {
  return ((data as RegistryArtistSearchResult[]) ?? []).map((row) => ({
    ...row,
    track_credit_count: Number(row.track_credit_count ?? 0),
    release_credit_count: Number(row.release_credit_count ?? 0),
  }));
}

function truncate(value: string | null | undefined, max = 42): string {
  const clean = value?.trim() ?? "";
  if (clean.length <= max) return clean || "Untitled";
  return `${clean.slice(0, max - 1)}…`;
}

function creditLabel(role: string, isPrimary: boolean, isFeatured: boolean): string {
  if (isPrimary) return "primary";
  if (isFeatured) return "featured";
  return role.replace(/_/g, " ");
}

function ArtistSearchCard({
  artist,
  selected,
  onClick,
}: {
  artist: RegistryArtistSearchResult;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected ? "border-[#85c441] bg-[#f0f7e8]" : "border-[#e8ece2] bg-white hover:border-[#85c441]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-[#171712]">{artist.display_name}</p>
          <p className="truncate text-[11px] text-[#858c7e]">{artist.artist_slug}</p>
        </div>
        <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#5d6557]">
          {artist.status}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-[#858c7e]">
        {artist.track_credit_count} track credits · {artist.release_credit_count} release credits
      </p>
    </button>
  );
}

export default function AdminArtistDecouplePage() {
  const [sourceQuery, setSourceQuery] = useState("");
  const [replacementQuery, setReplacementQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<RegistryArtistSearchResult[]>([]);
  const [replacementResults, setReplacementResults] = useState<RegistryArtistSearchResult[]>([]);
  const [sourceArtist, setSourceArtist] = useState<RegistryArtistSearchResult | null>(null);
  const [replacements, setReplacements] = useState<ReplacementArtist[]>([]);
  const [chartPrimaryArtistId, setChartPrimaryArtistId] = useState("");
  const [preview, setPreview] = useState<DecouplePreview | null>(null);
  const [note, setNote] = useState("");
  const [archiveSource, setArchiveSource] = useState(true);
  const [searchingSource, setSearchingSource] = useState(false);
  const [searchingReplacements, setSearchingReplacements] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [decoupleLoading, setDecoupleLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createStatus, setCreateStatus] = useState("needs_review");
  const [creatingArtist, setCreatingArtist] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const sourceCreditCount = useMemo(() => {
    return (preview?.trackCredits.length ?? 0) + (preview?.releaseCredits.length ?? 0);
  }, [preview]);

  const searchRegistryArtists = useCallback(async (query: string, side: "source" | "replacement") => {
    const clean = query.trim();
    if (!clean) {
      if (side === "source") setSourceResults([]);
      else setReplacementResults([]);
      return;
    }

    if (side === "source") setSearchingSource(true);
    else setSearchingReplacements(true);

    try {
      const { data, error } = await supabase.rpc("admin_search_registry_artists", {
        p_query: clean,
        p_limit: 25,
      });

      if (error) throw error;

      const rows = asArtistRows(data);
      if (side === "source") setSourceResults(rows);
      else setReplacementResults(rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Artist search failed", "error");
      if (side === "source") setSourceResults([]);
      else setReplacementResults([]);
    } finally {
      if (side === "source") setSearchingSource(false);
      else setSearchingReplacements(false);
    }
  }, [showToast]);

  const loadPreview = useCallback(async (artist = sourceArtist) => {
    if (!artist) {
      showToast("Select the combined source artist first.", "error");
      return;
    }

    setPreviewLoading(true);

    try {
      const { data, error } = await supabase.rpc("admin_get_artist_decouple_preview", {
        p_source_artist_id: artist.artist_id,
      });

      if (error) throw error;

      setPreview((data ?? null) as DecouplePreview | null);
      showToast("Decouple preview loaded", "success");
    } catch (err) {
      setPreview(null);
      showToast(err instanceof Error ? err.message : "Preview failed", "error");
    } finally {
      setPreviewLoading(false);
    }
  }, [sourceArtist, showToast]);

  const selectSource = useCallback((artist: RegistryArtistSearchResult) => {
    setSourceArtist(artist);
    setPreview(null);
  }, []);

  const addReplacement = useCallback((artist: RegistryArtistSearchResult) => {
    if (sourceArtist?.artist_id === artist.artist_id) {
      showToast("The source artist cannot also be a replacement.", "error");
      return;
    }

    setReplacements((prev) => {
      if (prev.some((item) => item.artist.artist_id === artist.artist_id)) return prev;

      const nextOrder = prev.length + 1;
      const replacement: ReplacementArtist = {
        artist,
        role: nextOrder === 1 ? "primary_artist" : "featured_artist",
        is_primary: nextOrder === 1,
        is_featured: nextOrder !== 1,
        credit_order: nextOrder,
        display_credit: "",
      };

      const next = [...prev, replacement];
      if (!chartPrimaryArtistId) setChartPrimaryArtistId(artist.artist_id);
      return next;
    });
  }, [chartPrimaryArtistId, sourceArtist, showToast]);

  const updateReplacement = useCallback((artistId: string, patch: Partial<ReplacementArtist>) => {
    setReplacements((prev) => prev.map((item) => (
      item.artist.artist_id === artistId ? { ...item, ...patch } : item
    )));
  }, []);

  const removeReplacement = useCallback((artistId: string) => {
    setReplacements((prev) => {
      const next = prev.filter((item) => item.artist.artist_id !== artistId);
      if (chartPrimaryArtistId === artistId) setChartPrimaryArtistId(next[0]?.artist.artist_id ?? "");
      return next.map((item, index) => ({ ...item, credit_order: index + 1 }));
    });
  }, [chartPrimaryArtistId]);

  const createReplacementArtist = useCallback(async () => {
    const cleanName = createName.trim();
    if (!cleanName) {
      showToast("Enter an artist name to create.", "error");
      return;
    }

    setCreatingArtist(true);

    try {
      const { data, error } = await supabase.rpc("admin_create_registry_artist_for_decouple", {
        p_display_name: cleanName,
        p_slug: createSlug.trim() || null,
        p_status: createStatus,
        p_note: note || null,
      });

      if (error) throw error;

      const result = data as { created?: boolean; artist?: RegistryArtistSearchResult } | null;
      if (!result?.artist) throw new Error("Artist was not returned after create.");

      addReplacement(asArtistRows([result.artist])[0]);
      setCreateName("");
      setCreateSlug("");
      showToast(result.created ? "Replacement artist created" : "Existing artist attached", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create artist", "error");
    } finally {
      setCreatingArtist(false);
    }
  }, [addReplacement, createName, createSlug, createStatus, note, showToast]);

  const decoupleArtist = useCallback(async () => {
    if (!sourceArtist) {
      showToast("Select the combined source artist first.", "error");
      return;
    }

    if (replacements.length < 2) {
      showToast("Add at least two replacement artists.", "error");
      return;
    }

    if (!chartPrimaryArtistId) {
      showToast("Choose the artist that should own the chart row slug.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Decouple "${sourceArtist.display_name}" into ${replacements.map((item) => item.artist.display_name).join(" + ")}?`
    );

    if (!confirmed) return;

    setDecoupleLoading(true);

    try {
      const payload = replacements.map((item) => ({
        artist_id: item.artist.artist_id,
        role: item.role,
        is_primary: item.is_primary,
        is_featured: item.is_featured,
        credit_order: item.credit_order,
        display_credit: item.display_credit.trim() || null,
      }));

      const { data, error } = await supabase.rpc("admin_decouple_registry_artist", {
        p_source_artist_id: sourceArtist.artist_id,
        p_replacements: payload,
        p_note: note || null,
        p_archive_source: archiveSource,
        p_chart_primary_artist_id: chartPrimaryArtistId,
      });

      if (error) throw error;

      const result = (data ?? {}) as {
        trackCreditsInserted?: number;
        releaseCreditsInserted?: number;
        chartEntriesV2Updated?: number;
        chartEntriesRuntimeUpdated?: number;
      };

      showToast(
        `Decoupled · ${result.trackCreditsInserted ?? 0} track credits, ${result.releaseCreditsInserted ?? 0} release credits, ${(result.chartEntriesV2Updated ?? 0) + (result.chartEntriesRuntimeUpdated ?? 0)} chart rows updated`,
        "success"
      );

      await loadPreview(sourceArtist);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Artist decouple failed", "error");
    } finally {
      setDecoupleLoading(false);
    }
  }, [archiveSource, chartPrimaryArtistId, loadPreview, note, replacements, showToast, sourceArtist]);

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
            Use this when one registry artist is actually a combined credit, like Bien and Alikiba stored as one entity.
            Split the bad source into distinct artists, preserve the existing track/release links, and repair chart artist slugs.
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
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Source credits</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{sourceCreditCount}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Tracks affected</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{preview?.trackCredits.length ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Releases affected</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{preview?.releaseCredits.length ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">Chart rows affected</p>
          <p className="mt-1 text-[28px] font-black text-[#171712]">{preview?.chartEntries.length ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
          <div className="mb-4">
            <p className="text-[15px] font-black text-[#171712]">1. Pick the bad combined artist</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#697062]">
              This is the single source entity currently holding track, release, or chart credit that should belong to multiple artists.
            </p>
          </div>

          <label className={LABEL_CLASS}>Combined source artist</label>
          <div className="flex gap-2">
            <input
              value={sourceQuery}
              onChange={(event) => setSourceQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") searchRegistryArtists(sourceQuery, "source"); }}
              placeholder="Search bad combined artist..."
              className={`${INPUT_CLASS} flex-1`}
            />
            <button
              onClick={() => searchRegistryArtists(sourceQuery, "source")}
              disabled={searchingSource}
              className="rounded-xl bg-[#171712] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            >
              {searchingSource ? "..." : "Search"}
            </button>
          </div>

          {sourceArtist && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[12px] font-black text-amber-900">Selected source</p>
              <p className="text-[14px] font-bold text-[#171712]">{sourceArtist.display_name}</p>
              <p className="text-[11px] text-[#71796b]">{sourceArtist.artist_slug} · {sourceArtist.status}</p>
              <button
                onClick={() => loadPreview(sourceArtist)}
                disabled={previewLoading}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              >
                <WkIcon name={previewLoading ? "Loader2" : "Search"} size={13} className={previewLoading ? "animate-spin" : ""} />
                Preview attached credits
              </button>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {sourceResults.map((artist) => (
              <ArtistSearchCard
                key={artist.artist_id}
                artist={artist}
                selected={sourceArtist?.artist_id === artist.artist_id}
                onClick={() => selectSource(artist)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
          <div className="mb-4">
            <p className="text-[15px] font-black text-[#171712]">2. Attach the distinct artists</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#697062]">
              Search existing artists or create missing records, then set how they should appear on the shared track credits.
            </p>
          </div>

          <label className={LABEL_CLASS}>Search replacement artists</label>
          <div className="flex gap-2">
            <input
              value={replacementQuery}
              onChange={(event) => setReplacementQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") searchRegistryArtists(replacementQuery, "replacement"); }}
              placeholder="Search artist to attach..."
              className={`${INPUT_CLASS} flex-1`}
            />
            <button
              onClick={() => searchRegistryArtists(replacementQuery, "replacement")}
              disabled={searchingReplacements}
              className="rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            >
              {searchingReplacements ? "..." : "Search"}
            </button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {replacementResults.map((artist) => (
              <ArtistSearchCard
                key={artist.artist_id}
                artist={artist}
                selected={replacements.some((item) => item.artist.artist_id === artist.artist_id)}
                onClick={() => addReplacement(artist)}
              />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[#e8ece2] bg-[#fbfcf8] p-4">
            <p className="text-[12px] font-black text-[#171712]">Create missing artist</p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_0.85fr_0.7fr_auto]">
              <input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Display name"
                className={INPUT_CLASS}
              />
              <input
                value={createSlug}
                onChange={(event) => setCreateSlug(event.target.value)}
                placeholder="slug optional"
                className={INPUT_CLASS}
              />
              <select
                value={createStatus}
                onChange={(event) => setCreateStatus(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="needs_review">needs_review</option>
                <option value="draft">draft</option>
                <option value="active">active</option>
              </select>
              <button
                onClick={createReplacementArtist}
                disabled={creatingArtist}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#171712] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              >
                <WkIcon name={creatingArtist ? "Loader2" : "Plus"} size={13} className={creatingArtist ? "animate-spin" : ""} />
                Create
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {replacements.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#dfe4d8] bg-white p-4 text-[13px] text-[#697062]">
                No replacement artists selected yet.
              </div>
            )}

            {replacements.map((item) => (
              <div key={item.artist.artist_id} className="rounded-2xl border border-[#e8ece2] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-black text-[#171712]">{item.artist.display_name}</p>
                    <p className="text-[11px] text-[#858c7e]">{item.artist.artist_slug} · {item.artist.status}</p>
                  </div>
                  <button
                    onClick={() => removeReplacement(item.artist.artist_id)}
                    className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_0.8fr_1fr]">
                  <select
                    value={item.role}
                    onChange={(event) => {
                      const role = event.target.value;
                      updateReplacement(item.artist.artist_id, {
                        role,
                        is_primary: role === "primary_artist",
                        is_featured: role === "featured_artist",
                      });
                    }}
                    className={INPUT_CLASS}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.credit_order}
                    onChange={(event) => updateReplacement(item.artist.artist_id, { credit_order: Number(event.target.value) || 1 })}
                    className={INPUT_CLASS}
                    aria-label="Credit order"
                  />
                  <input
                    value={item.display_credit}
                    onChange={(event) => updateReplacement(item.artist.artist_id, { display_credit: event.target.value })}
                    placeholder="Display credit override optional"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-bold text-[#5d6557]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_primary}
                      onChange={(event) => updateReplacement(item.artist.artist_id, { is_primary: event.target.checked })}
                    />
                    Primary on credit
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_featured}
                      onChange={(event) => updateReplacement(item.artist.artist_id, { is_featured: event.target.checked })}
                    />
                    Featured on credit
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-[15px] font-black text-[#171712]">3. Repair chart ownership and run decouple</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#697062]">
              The track/release credit rows will become multi-artist rows. Chart entries still need one canonical owner slug,
              so choose the artist that should carry the chart row while the track itself shows all attached artists.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>Chart row primary artist</label>
                <select
                  value={chartPrimaryArtistId}
                  onChange={(event) => setChartPrimaryArtistId(event.target.value)}
                  className={`${INPUT_CLASS} w-full`}
                >
                  <option value="">Choose artist...</option>
                  {replacements.map((item) => (
                    <option key={item.artist.artist_id} value={item.artist.artist_id}>{item.artist.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Source handling</label>
                <label className="flex min-h-[38px] items-center gap-2 rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-3 text-[12px] font-bold text-[#5d6557]">
                  <input
                    type="checkbox"
                    checked={archiveSource}
                    onChange={(event) => setArchiveSource(event.target.checked)}
                  />
                  Archive the bad combined artist after decouple
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className={LABEL_CLASS}>Decouple note</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Why is this artist being split? Example: Bien and Alikiba were stored as one combined artist credit."
                className="min-h-[96px] w-full rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#85c441]"
              />
            </div>

            <button
              onClick={decoupleArtist}
              disabled={decoupleLoading || !sourceArtist || replacements.length < 2 || !chartPrimaryArtistId}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#5f8f2f] px-5 py-2.5 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <WkIcon name={decoupleLoading ? "Loader2" : "GitBranch"} size={14} className={decoupleLoading ? "animate-spin" : ""} />
              {decoupleLoading ? "Decoupling..." : "Decouple artist credits"}
            </button>
          </div>

          <div className="rounded-2xl border border-[#e8ece2] bg-[#fbfcf8] p-4">
            <p className="text-[12px] font-black uppercase tracking-wider text-[#71796b]">Replacement summary</p>
            <div className="mt-3 space-y-2">
              {replacements.length === 0 ? (
                <p className="text-[13px] text-[#697062]">Add at least two artists to split the source.</p>
              ) : replacements.map((item) => (
                <div key={item.artist.artist_id} className="rounded-xl border border-[#e8ece2] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[13px] font-bold text-[#171712]">{item.artist.display_name}</p>
                    <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#5d6557]">
                      #{item.credit_order}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#858c7e]">
                    {creditLabel(item.role, item.is_primary, item.is_featured)} · {item.display_credit || item.artist.display_name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
            <p className="mb-3 text-[13px] font-black uppercase tracking-wider text-[#71796b]">Track credits preview</p>
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {preview.trackCredits.length === 0 ? (
                <p className="text-[13px] text-[#697062]">No active track credits found for this source.</p>
              ) : preview.trackCredits.slice(0, 80).map((credit) => (
                <div key={credit.credit_id} className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
                  <p className="text-[13px] font-bold text-[#171712]">{truncate(credit.track_title)}</p>
                  <p className="text-[11px] text-[#858c7e]">{credit.release_title ? `${truncate(credit.release_title, 32)} · ` : ""}{creditLabel(credit.role, credit.is_primary, credit.is_featured)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
            <p className="mb-3 text-[13px] font-black uppercase tracking-wider text-[#71796b]">Release credits preview</p>
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {preview.releaseCredits.length === 0 ? (
                <p className="text-[13px] text-[#697062]">No active release credits found for this source.</p>
              ) : preview.releaseCredits.slice(0, 80).map((credit) => (
                <div key={credit.credit_id} className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
                  <p className="text-[13px] font-bold text-[#171712]">{truncate(credit.release_title)}</p>
                  <p className="text-[11px] text-[#858c7e]">{creditLabel(credit.role, credit.is_primary, credit.is_featured)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe4d8] bg-white p-5">
            <p className="mb-3 text-[13px] font-black uppercase tracking-wider text-[#71796b]">Chart rows preview</p>
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {preview.chartEntries.length === 0 ? (
                <p className="text-[13px] text-[#697062]">No chart rows currently point to this source slug.</p>
              ) : preview.chartEntries.slice(0, 80).map((entry) => (
                <div key={entry.entry_id} className="rounded-xl border border-[#e8ece2] bg-[#fbfcf8] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[13px] font-bold text-[#171712]">{entry.track_title}</p>
                    {entry.rank && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#5d6557]">#{entry.rank}</span>}
                  </div>
                  <p className="mt-1 text-[11px] text-[#858c7e]">{entry.artist_name} · {entry.artist_slug ?? "no slug"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
