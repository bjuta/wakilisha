import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone } from "@/services/registry/admin/completeness";
import { getRegistryEntityList, saveRegistryEntityPatch, deleteRegistryEntity } from "@/services/registry/admin/client";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";
import { WkIcon } from "@/components/design-system/Icon";

const schema = getEntitySchema("artist");
const PAGE_SIZE = 20;
const FETCH_LIMIT = 5000;

type SortMode = "recent" | "name" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_country"
  | "missing_origin"
  | "missing_image"
  | "missing_bio"
  | "missing_genre"
  | "missing_type"
  | "blocked";

type StatusFilter = "all" | "active" | "draft";

type CountryFilter = string;

interface CountryOption {
  code: string;
  label: string;
  count: number;
}

interface EnrichedArtist extends RegistryEntityProfile {
  _quality: ReturnType<typeof calculateCompleteness>;
  _displayName: string;
  _displayImage: string;
  _displayCountry: string;
}

function getDisplayName(artist: RegistryEntityProfile): string {
  return String(artist.display_name ?? artist.slug ?? artist.id ?? "Untitled artist");
}

function getDisplayImage(artist: RegistryEntityProfile): string {
  return String(artist.public_image_url ?? "");
}

function getDisplayCountry(artist: RegistryEntityProfile): string {
  return String(artist.origin_iso2 ?? "");
}

/* ─────────────── Pagination helper ─────────────── */

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      for (let i = startPage; i <= endPage; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3">
      <span className="text-[12px] text-[#858c7e]">
        Showing <strong className="text-[#171712]">{start}</strong>
        –<strong className="text-[#171712]">{end}</strong> of{" "}
        <strong className="text-[#171712]">{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] disabled:opacity-40 hover:border-[#85c441] hover:text-[#5f8f2f]"
        >
          <WkIcon name="ChevronLeft" size={16} />
        </button>
        {getVisiblePages().map((page, i) =>
          typeof page === "string" ? (
            <span key={`dots-${i}`} className="px-2 text-[11px] text-[#858c7e]">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition ${
                page === currentPage
                  ? "bg-[#5f8f2f] text-white"
                  : "border border-[#dfe4d8] text-[#71796b] hover:border-[#85c441] hover:text-[#5f8f2f]"
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] disabled:opacity-40 hover:border-[#85c441] hover:text-[#5f8f2f]"
        >
          <WkIcon name="ChevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Bulk Action Toolbar ─────────────── */

function BulkToolbar({
  selectedCount,
  totalInView,
  onSelectAll,
  onDeselectAll,
  onUnpublish,
  unpublishing,
  onPublish,
  publishing,
  draftCount,
  activeCount,
  onDelete,
  deleting,
  deleteCount,
}: {
  selectedCount: number;
  totalInView: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUnpublish: () => void;
  unpublishing: boolean;
  onPublish?: () => void;
  publishing?: boolean;
  draftCount?: number;
  activeCount?: number;
  onDelete?: () => void;
  deleting?: boolean;
  deleteCount?: number;
}) {
  if (selectedCount === 0) return null;

  const showPublish = onPublish && draftCount && draftCount > 0;
  const showUnpublish = activeCount && activeCount > 0;
  const showDelete = onDelete && deleteCount && deleteCount > 0;

  return (
    <div className="sticky top-0 z-30 mb-3 flex items-center justify-between rounded-2xl border border-[#dfe4d8] bg-white px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-bold text-[#171712]">
          {selectedCount} artist{selectedCount !== 1 ? "s" : ""} selected
        </span>
        {selectedCount < totalInView && (
          <button
            onClick={onSelectAll}
            className="text-[12px] font-bold text-[#5f8f2f] hover:underline"
          >
            Select all {totalInView} on this page
          </button>
        )}
        <button
          onClick={onDeselectAll}
          className="text-[12px] font-bold text-[#858c7e] hover:text-[#171712]"
        >
          Clear selection
        </button>
      </div>
      <div className="flex items-center gap-2">
        {showPublish && (
          <button
            onClick={onPublish}
            disabled={publishing}
            className="rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-2"
          >
            {publishing ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <WkIcon name="Eye" size={14} />
                Publish ({draftCount})
              </>
            )}
          </button>
        )}
        {showUnpublish && (
          <button
            onClick={onUnpublish}
            disabled={unpublishing}
            className="rounded-xl bg-[#f0a020] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#d4880d] disabled:opacity-50 flex items-center gap-2"
          >
            {unpublishing ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Unpublishing…
              </>
            ) : (
              <>
                <WkIcon name="EyeOff" size={14} />
                Unpublish ({activeCount})
              </>
            )}
          </button>
        )}
        {showDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-xl bg-red-600 px-4 py-2 text-[12px] font-black text-white transition hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {deleting ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <i className="ri-delete-bin-6-line text-[14px]" />
                Delete ({deleteCount})
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Artist Card ─────────────── */

function ArtistCard({
  artist,
  onOpen,
  onNavigate,
  selected,
  onToggleSelect,
  onDelete,
  onEnrich,
  enriching,
}: {
  artist: EnrichedArtist;
  onOpen: (artist: EnrichedArtist) => void;
  onNavigate: (slug: string) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete?: (artist: EnrichedArtist) => void;
  onEnrich?: (artist: EnrichedArtist) => void;
  enriching?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const q = artist._quality;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white transition-all ${
        selected ? "border-[#5f8f2f] ring-2 ring-[#85c441]/30" : "border-[#dfe4d8] hover:border-[#85c441]"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox */}
      <div className="absolute left-3 top-3 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(String(artist.id));
          }}
          className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition ${
            selected
              ? "border-[#5f8f2f] bg-[#5f8f2f] text-white"
              : "border-[#c8d0be] bg-white/80 hover:border-[#85c441]"
          }`}
        >
          {selected && <WkIcon name="Check" size={12} />}
        </button>
      </div>

      {/* Image area */}
      <div className="relative aspect-square bg-[#f0f3ec]">
        {artist._displayImage ? (
          <img
            src={artist._displayImage}
            alt={artist._displayName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <WkIcon name="Mic2" size={40} className="text-[#c8d0be]" />
          </div>
        )}
        {/* Hover overlay with actions */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex gap-2 flex-wrap justify-center px-2">
            <button
              onClick={() => onOpen(artist)}
              className="rounded-xl bg-white px-4 py-2 text-[12px] font-bold text-[#171712] hover:bg-[#f0f3ec]"
            >
              Edit
            </button>
            <button
              onClick={() => onNavigate(artist.slug)}
              className="rounded-xl border border-white/50 px-4 py-2 text-[12px] font-bold text-white hover:bg-white/20"
            >
              Details
            </button>
            {onEnrich && (
              <button
                onClick={() => onEnrich(artist)}
                disabled={enriching}
                className="rounded-xl bg-[#5f8f2f] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-1.5"
              >
                {enriching ? (
                  <WkIcon name="Loader2" size={13} className="animate-spin" />
                ) : (
                  <i className="ri-sparkling-line text-[13px]" />
                )}
                Enrich
              </button>
            )}
            {String(artist.status) === "draft" && onDelete && (
              <button
                onClick={() => onDelete(artist)}
                className="rounded-xl bg-red-600/90 px-4 py-2 text-[12px] font-bold text-white hover:bg-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        {/* Status badge */}
        <div className="absolute right-3 top-3 z-20">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm ${
              String(artist.status) === "active"
                ? "bg-[#5f8f2f]/80 text-white"
                : "bg-black/50 text-white"
            }`}
          >
            {String(artist.status || "unknown")}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => onNavigate(artist.slug)}
              className="text-left text-[14px] font-bold text-[#171712] hover:text-[#5f8f2f] transition-colors truncate block"
            >
              {artist._displayName}
            </button>
            <p className="mt-0.5 text-[11px] text-[#858c7e] truncate">{artist.slug}</p>
          </div>
          <button
            onClick={() => onOpen(artist)}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] hover:border-[#85c441] hover:text-[#5f8f2f]"
            title="Quick edit"
          >
            <WkIcon name="Pencil" size={14} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {artist.artist_type && (
            <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#71796b] uppercase tracking-wide">
              {artist.artist_type}
            </span>
          )}
          {artist._displayCountry && (
            <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#71796b] uppercase tracking-wide">
              {artist._displayCountry}
            </span>
          )}
        </div>

        {/* Completeness bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#858c7e] uppercase tracking-wide">Completeness</span>
            <span className={`text-[11px] font-black ${completenessTone(q.completeness)}`}>
              {q.completeness}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
            <div
              className="h-full rounded-full bg-[#85c441] transition-all"
              style={{ width: `${q.completeness}%` }}
            />
          </div>
          {q.missingFields.length > 0 && (
            <p className="mt-1 text-[10px] text-[#a8ad9e] truncate">
              Missing: {q.missingFields.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Confirm Modal ─────────────── */

function ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-[#dfe4d8] bg-white p-6 shadow-xl">
        <h3 className="text-[17px] font-black text-[#171712]">{title}</h3>
        <p className="mt-2 text-[13px] text-[#697062]">{message}</p>
        {detail && (
          <p className="mt-2 rounded-xl bg-[#f8f9f4] p-3 text-[11px] text-[#858c7e] font-mono max-h-32 overflow-y-auto">
            {detail}
          </p>
        )}
        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#171712] hover:bg-[#f8f9f4] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-[#f0a020] px-4 py-2.5 text-[13px] font-black text-white hover:bg-[#d4880d] disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <WkIcon name="Loader2" size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Artist Enrich Panel ─────────────── */

type EnrichResultItem = {
  slug: string;
  name: string;
  status: "updated" | "skipped" | "no_data" | "error";
  providersTried: string[];
  providersFound: string[];
  changes: {
    image?: { old: string | null; new: string | null; source: string };
    bio?: { old: string | null; new: string | null; source: string };
    genres?: { old: string[]; new: string[]; source: string };
  };
  message?: string;
  debug?: Record<string, unknown>;
};

type EnrichResult = {
  ok: boolean;
  dry_run: boolean;
  force: boolean;
  total_found: number;
  updated: number;
  skipped: number;
  no_data: number;
  errors: number;
  provider_status: Record<string, { connected: boolean; error?: string }>;
  results: EnrichResultItem[];
};

function ArtistEnrichPanel({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState<string>("missing_image");
  const [providers, setProviders] = useState<string[]>(["spotify", "apple_music"]);
  const [force, setForce] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const CHUNK_SIZE = 20;

  async function runEnrich(dryRun: boolean) {
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    setProgress(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setPhase("error"); setErrorMsg("Not authenticated."); return; }
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string) || "";

      const callEnrich = async () => {
        const res = await fetch(`${supabaseUrl}/functions/v1/registry-enrich-artist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string) || "",
          },
          body: JSON.stringify({
            dry_run: dryRun,
            batch_size: CHUNK_SIZE,
            filter: filterMode,
            providers,
            force,
          }),
        });
        return await res.json() as EnrichResult & { error?: string; message?: string };
      };

      if (dryRun) {
        const data = await callEnrich();
        if (!data.ok || data.error) { setPhase("error"); setErrorMsg(data.message || data.error || `HTTP error`); return; }
        setResult({ ...data, results: data.results ?? [] });
        setPhase("done");
        return;
      }

      // Non-dry-run: loop in chunks until all artists processed
      let allResults: EnrichResultItem[] = [];
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalNoData = 0;
      let totalErrors = 0;
      let totalFound = 0;
      let lastProviderStatus: Record<string, { connected: boolean; error?: string }> = {};

      while (true) {
        const data = await callEnrich();
        if (!data.ok || data.error) { setPhase("error"); setErrorMsg(data.message || data.error || `HTTP error`); return; }

        const chunkResults = data.results ?? [];
        allResults = [...allResults, ...chunkResults];
        totalUpdated += data.updated ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalNoData += data.no_data ?? 0;
        totalErrors += data.errors ?? 0;
        totalFound += data.total_found ?? 0;
        if (data.provider_status) lastProviderStatus = data.provider_status;

        setResult({
          ok: true,
          dry_run: false,
          force,
          total_found: totalFound,
          updated: totalUpdated,
          skipped: totalSkipped,
          no_data: totalNoData,
          errors: totalErrors,
          provider_status: lastProviderStatus,
          results: allResults.slice(-500),
        });
        setProgress({ current: totalUpdated + totalSkipped + totalNoData + totalErrors, total: -1 });

        if ((data.total_found ?? 0) === 0 || chunkResults.length === 0) break;
      }

      setProgress(null);
      setPhase("done");
      if (totalUpdated > 0) onDone();
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const providerDot = (connected: boolean) => (
    <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-[#5f8f2f]" : "bg-[#f0a020]"}`} />
  );

  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f3ec]">
            <i className="ri-sparkling-line text-[18px] text-[#5f8f2f]" />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#171712]">Enrich Artists</p>
            <p className="text-[11px] text-[#858c7e]">Backfill images, bio, and genres from Spotify &amp; Apple Music</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Provider toggles */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-2 py-1.5">
            <button
              onClick={() => setProviders((prev) => prev.includes("spotify") ? prev.filter((p) => p !== "spotify") : [...prev, "spotify"])}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${providers.includes("spotify") ? "bg-[#1DB954]/10 text-[#1DB954]" : "text-[#a8ad9e]"}`}
              title="Toggle Spotify"
            >
              <i className="ri-spotify-line text-[13px]" />
              Spotify
            </button>
            <button
              onClick={() => setProviders((prev) => prev.includes("apple_music") ? prev.filter((p) => p !== "apple_music") : [...prev, "apple_music"])}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${providers.includes("apple_music") ? "bg-[#fa2d48]/10 text-[#fa2d48]" : "text-[#a8ad9e]"}`}
              title="Toggle Apple Music"
            >
              <i className="ri-apple-line text-[13px]" />
              Apple
            </button>
          </div>
          {/* Filter */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="h-8 rounded-lg border border-[#dfe4d8] bg-[#f8f9f4] px-2 text-[11px] font-bold text-[#697062] outline-none"
          >
            <option value="missing_image">Missing image</option>
            <option value="missing_bio">Missing bio</option>
            <option value="all">All artists</option>
          </select>
          {/* Force */}
          <button
            onClick={() => setForce((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${force ? "border-[#5f8f2f] bg-[#e8f5dc] text-[#5f8f2f]" : "border-[#dfe4d8] bg-[#f8f9f4] text-[#a8ad9e]"}`}
            title="Force re-enrich even if data already exists"
          >
            <WkIcon name="RotateCcw" size={12} />
            Force
          </button>
          <button
            onClick={() => runEnrich(true)}
            disabled={phase === "running"}
            className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-2 text-[12px] font-bold text-[#697062] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={() => runEnrich(false)}
            disabled={phase === "running"}
            className="rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-black text-white hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {phase === "running" ? (
              <><WkIcon name="Loader2" size={13} className="animate-spin" /> {progress ? `Processing… (${progress.current} done)` : "Running…"}</>
            ) : (
              <><i className="ri-sparkling-line text-[13px]" /> Enrich</>
            )}
          </button>
        </div>
      </div>

      {/* Provider status */}
      {result && (
        <div className="mt-2 flex gap-3 flex-wrap">
          {Object.entries(result.provider_status).map(([key, status]) => (
            <div key={key} className="flex items-center gap-1.5 text-[11px]">
              {providerDot(status.connected)}
              <span className="font-bold text-[#697062] capitalize">{key.replace("_", " ")}</span>
              <span className={status.connected ? "text-[#5f8f2f]" : "text-[#f0a020]"}>
                {status.connected ? "connected" : "disconnected"}
              </span>
            </div>
          ))}
        </div>
      )}

      {phase === "error" && errorMsg && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {[
              ["Found", result.total_found, "text-[#697062]"],
              ["Updated", result.updated, "text-[#5f8f2f]"],
              ["Skipped", result.skipped, "text-[#858c7e]"],
              ["No data", result.no_data, "text-[#f0a020]"],
              ["Errors", result.errors, "text-red-600"],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="rounded-xl border border-[#dfe4d8] p-2.5 text-center">
                <p className={`text-[18px] font-black ${cls}`}>{value as number}</p>
                <p className="text-[10px] font-bold text-[#a8ad9e] uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
          {result.dry_run && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] font-bold text-amber-700">
              Preview mode — no changes were written. Click "Enrich" to apply.
            </div>
          )}
          {result.results?.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] font-bold text-[#5f8f2f] hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({result.results.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-[#dfe4d8]">
                  {result.results.map((r, i) => (
                    <EnrichResultRow key={r.slug + i} item={r} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Artist Origin Panel ─────────────── */

type OriginResultItem = {
  slug: string;
  name: string;
  previousIso2: string | null;
  newIso2: string | null;
  countryName: string | null;
  confidence: number;
  source: "metadata_normalization" | "musicbrainz" | "skipped";
  debug?: string;
};

type OriginResult = {
  ok: boolean;
  dry_run: boolean;
  total_found: number;
  normalized_from_metadata: number;
  from_musicbrainz: number;
  skipped: number;
  results: OriginResultItem[];
};

function ArtistOriginPanel({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<OriginResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [useMusicBrainz, setUseMusicBrainz] = useState(true);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const CHUNK_SIZE = 25;

  async function runOriginBackfill(dryRun: boolean) {
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    setProgress(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setPhase("error"); setErrorMsg("Not authenticated."); return; }
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string) || "";

      const callBackfill = async () => {
        const res = await fetch(`${supabaseUrl}/functions/v1/backfill-artist-origin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string) || "",
          },
          body: JSON.stringify({ dry_run: dryRun, use_musicbrainz: useMusicBrainz, batch_size: CHUNK_SIZE }),
        });
        return await res.json() as (OriginResult & { error?: string; message?: string });
      };

      if (dryRun) {
        const data = await callBackfill();
        if (data.error) { setPhase("error"); setErrorMsg(data.message || data.error); return; }
        setResult({ ...data, results: data.results ?? [] });
        setPhase("done");
        return;
      }

      // Non-dry-run: loop in chunks until all artists processed
      let allResults: OriginResultItem[] = [];
      let totalNormalized = 0;
      let totalMb = 0;
      let totalSkipped = 0;
      let totalFound = 0;
      let chunkCount = 0;

      while (true) {
        chunkCount++;
        const data = await callBackfill();
        if (data.error) { setPhase("error"); setErrorMsg(data.message || data.error); return; }

        const chunkResults = data.results ?? [];
        allResults = [...allResults, ...chunkResults];
        totalNormalized += data.normalized_from_metadata ?? 0;
        totalMb += data.from_musicbrainz ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalFound += data.total_found ?? 0;

        setResult({
          ok: true,
          dry_run: false,
          total_found: totalFound,
          normalized_from_metadata: totalNormalized,
          from_musicbrainz: totalMb,
          skipped: totalSkipped,
          results: allResults.slice(-500),
        });
        setProgress({ current: totalNormalized + totalMb + totalSkipped, total: -1 });

        if ((data.total_found ?? 0) === 0 || chunkResults.length === 0) break;
      }

      setProgress(null);
      setPhase("done");
      if (totalNormalized + totalMb > 0) onDone();
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
            <i className="ri-earth-line text-[18px] text-amber-600" />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#171712]">Enrich Origin</p>
            <p className="text-[11px] text-[#858c7e]">Normalize country metadata &amp; look up ISO origin via MusicBrainz</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setUseMusicBrainz((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${useMusicBrainz ? "border-[#5f8f2f] bg-[#e8f5dc] text-[#5f8f2f]" : "border-[#dfe4d8] bg-[#f8f9f4] text-[#a8ad9e]"}`}
            title="Use MusicBrainz to look up artists without country metadata"
          >
            <i className="ri-database-2-line text-[12px]" />
            MusicBrainz
          </button>
          <button
            onClick={() => runOriginBackfill(true)}
            disabled={phase === "running"}
            className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-2 text-[12px] font-bold text-[#697062] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={() => runOriginBackfill(false)}
            disabled={phase === "running"}
            className="rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-black text-white hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {phase === "running" ? (
              <><WkIcon name="Loader2" size={13} className="animate-spin" /> {progress ? `Processing chunk… (${progress.current} done)` : "Running…"}</>
            ) : (
              <><i className="ri-earth-line text-[13px]" /> Backfill Origin</>
            )}
          </button>
        </div>
      </div>

      {phase === "error" && errorMsg && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Found", result.total_found, "text-[#697062]"],
              ["From metadata", result.normalized_from_metadata, "text-[#5f8f2f]"],
              ["From MusicBrainz", result.from_musicbrainz, "text-[#5f8f2f]"],
              ["Skipped", result.skipped, "text-[#858c7e]"],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="rounded-xl border border-[#dfe4d8] p-2.5 text-center">
                <p className={`text-[18px] font-black ${cls}`}>{value as number}</p>
                <p className="text-[10px] font-bold text-[#a8ad9e] uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
          {result.dry_run && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] font-bold text-amber-700">
              Preview mode — no changes were written. Click "Backfill Origin" to apply.
            </div>
          )}
          {result.results?.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] font-bold text-[#5f8f2f] hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({result.results.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-[#dfe4d8]">
                  {result.results.map((r, i) => (
                    <div key={r.slug + i} className="flex items-center gap-3 border-b border-[#f0f3ec] px-3 py-2.5 last:border-b-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                        r.source === "musicbrainz" ? "bg-[#e8f5dc] text-[#5f8f2f]" :
                        r.source === "metadata_normalization" ? "bg-amber-50 text-amber-600" :
                        "bg-[#f0f3ec] text-[#858c7e]"
                      }`}>
                        {r.newIso2 || "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#171712] truncate">{r.name}</p>
                        <p className="text-[10px] text-[#a8ad9e] truncate">
                          {r.source === "metadata_normalization" ? r.debug :
                           r.source === "musicbrainz" ? `${r.countryName} (${Math.round(r.confidence * 100)}% confidence)` :
                           r.debug || "No origin found"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        r.source === "musicbrainz" ? "bg-[#e8f5dc] text-[#5f8f2f]" :
                        r.source === "metadata_normalization" ? "bg-amber-50 text-amber-600" :
                        "bg-[#f0f3ec] text-[#858c7e]"
                      }`}>{r.source === "musicbrainz" ? "MB" : r.source === "metadata_normalization" ? "norm" : "skip"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Artist Type Panel ─────────────── */

type TypeResultItem = {
  slug: string;
  name: string;
  previousType: string | null;
  newType: string | null;
  heuristic: string;
  source: "name_heuristic" | "musicbrainz" | "skipped";
  mbType?: string | null;
  confidence?: number;
};

type TypeBackfillResult = {
  ok: boolean;
  dry_run: boolean;
  force: boolean;
  total_found: number;
  from_heuristic: number;
  from_musicbrainz: number;
  skipped: number;
  results: TypeResultItem[];
};

function ArtistTypePanel({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<TypeBackfillResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [useMusicBrainz, setUseMusicBrainz] = useState(true);
  const [force, setForce] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const CHUNK_SIZE = 25;

  async function runTypeBackfill(dryRun: boolean) {
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    setProgress(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setPhase("error"); setErrorMsg("Not authenticated."); return; }
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string) || "";

      const callBackfill = async () => {
        const res = await fetch(`${supabaseUrl}/functions/v1/backfill-artist-type`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string) || "",
          },
          body: JSON.stringify({ dry_run: dryRun, use_musicbrainz: useMusicBrainz, force, batch_size: CHUNK_SIZE }),
        });
        return await res.json() as (TypeBackfillResult & { error?: string; message?: string });
      };

      if (dryRun) {
        const data = await callBackfill();
        if (data.error) { setPhase("error"); setErrorMsg(data.message || data.error); return; }
        setResult({ ...data, results: data.results ?? [] });
        setPhase("done");
        return;
      }

      // Non-dry-run: loop in chunks until all artists processed
      let allResults: TypeResultItem[] = [];
      let totalHeuristic = 0;
      let totalMb = 0;
      let totalSkipped = 0;
      let totalFound = 0;

      while (true) {
        const data = await callBackfill();
        if (data.error) { setPhase("error"); setErrorMsg(data.message || data.error); return; }

        const chunkResults = data.results ?? [];
        allResults = [...allResults, ...chunkResults];
        totalHeuristic += data.from_heuristic ?? 0;
        totalMb += data.from_musicbrainz ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalFound += data.total_found ?? 0;

        setResult({
          ok: true,
          dry_run: false,
          force,
          total_found: totalFound,
          from_heuristic: totalHeuristic,
          from_musicbrainz: totalMb,
          skipped: totalSkipped,
          results: allResults.slice(-500),
        });
        setProgress({ current: totalHeuristic + totalMb + totalSkipped, total: -1 });

        if ((data.total_found ?? 0) === 0 || chunkResults.length === 0) break;
      }

      setProgress(null);
      setPhase("done");
      if (totalHeuristic + totalMb > 0) onDone();
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const typeBadge = (type: string | null) => {
    if (!type) return null;
    const colors: Record<string, string> = {
      solo: "bg-[#e8f5dc] text-[#5f8f2f]",
      group: "bg-[#ede9fe] text-[#7c3aed]",
      band: "bg-amber-50 text-amber-700",
      duo: "bg-rose-50 text-rose-600",
      collective: "bg-sky-50 text-sky-600",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${colors[type] || "bg-[#f0f3ec] text-[#858c7e]"}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
            <i className="ri-user-voice-line text-[18px] text-sky-600" />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#171712]">Enrich Type</p>
            <p className="text-[11px] text-[#858c7e]">Classify artists as solo, group, band, duo, or collective using name heuristics &amp; MusicBrainz</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setUseMusicBrainz((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${useMusicBrainz ? "border-[#5f8f2f] bg-[#e8f5dc] text-[#5f8f2f]" : "border-[#dfe4d8] bg-[#f8f9f4] text-[#a8ad9e]"}`}
            title="Use MusicBrainz to verify artist type"
          >
            <i className="ri-database-2-line text-[12px]" />
            MusicBrainz
          </button>
          <button
            onClick={() => setForce((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${force ? "border-[#5f8f2f] bg-[#e8f5dc] text-[#5f8f2f]" : "border-[#dfe4d8] bg-[#f8f9f4] text-[#a8ad9e]"}`}
            title="Re-classify artists that already have a type"
          >
            <WkIcon name="RotateCcw" size={12} />
            Force
          </button>
          <button
            onClick={() => runTypeBackfill(true)}
            disabled={phase === "running"}
            className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-2 text-[12px] font-bold text-[#697062] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={() => runTypeBackfill(false)}
            disabled={phase === "running"}
            className="rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-black text-white hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {phase === "running" ? (
              <><WkIcon name="Loader2" size={13} className="animate-spin" /> {progress ? `Processing chunk… (${progress.current} done)` : "Running…"}</>
            ) : (
              <><i className="ri-user-voice-line text-[13px]" /> Backfill Type</>
            )}
          </button>
        </div>
      </div>

      {phase === "error" && errorMsg && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Found", result.total_found, "text-[#697062]"],
              ["Name heuristic", result.from_heuristic, "text-[#5f8f2f]"],
              ["MusicBrainz", result.from_musicbrainz, "text-[#7c3aed]"],
              ["Skipped", result.skipped, "text-[#858c7e]"],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="rounded-xl border border-[#dfe4d8] p-2.5 text-center">
                <p className={`text-[18px] font-black ${cls}`}>{value as number}</p>
                <p className="text-[10px] font-bold text-[#a8ad9e] uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
          {result.dry_run && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] font-bold text-amber-700">
              Preview mode — no changes were written. Click "Backfill Type" to apply.
            </div>
          )}
          {/* Quick type distribution */}
          {(() => {
            const dist = new Map<string, number>();
            result.results.forEach((r) => {
              if (r.newType) dist.set(r.newType, (dist.get(r.newType) ?? 0) + 1);
            });
            if (dist.size === 0) return null;
            return (
              <div className="flex flex-wrap gap-2">
                {Array.from(dist.entries()).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-1.5 rounded-lg border border-[#dfe4d8] bg-[#f8f9f4] px-2.5 py-1">
                    {typeBadge(type)}
                    <span className="text-[12px] font-black text-[#171712]">{count}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          {result.results?.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] font-bold text-[#5f8f2f] hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({result.results.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-[#dfe4d8]">
                  {result.results.map((r, i) => (
                    <div key={r.slug + i} className="flex items-center gap-3 border-b border-[#f0f3ec] px-3 py-2.5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#171712] truncate">{r.name}</p>
                        <p className="text-[10px] text-[#a8ad9e] truncate">{r.heuristic}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.source === "musicbrainz" && (
                          <span className="rounded-full bg-[#ede9fe] px-1.5 py-0.5 text-[10px] font-black text-[#7c3aed] uppercase">MB</span>
                        )}
                        {typeBadge(r.newType)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Spotify Backfill Panel (legacy) ─────────────── */

type BackfillResultItem = {
  slug: string;
  name: string;
  status: "updated" | "skipped" | "no_image" | "error";
  old_image?: string | null;
  new_image?: string | null;
  message?: string;
};

type BackfillResult = {
  ok: boolean;
  dry_run: boolean;
  total_found: number;
  updated: number;
  skipped: number;
  no_image: number;
  errors: number;
  results: BackfillResultItem[];
};

function SpotifyBackfillPanel({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function runBackfill(dryRun: boolean) {
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setPhase("error"); setErrorMsg("Not authenticated."); return; }
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string) || "";
      const res = await fetch(`${supabaseUrl}/functions/v1/backfill-artist-spotify-images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string) || "",
        },
        body: JSON.stringify({ dry_run: dryRun, batch_size: 100 }),
      });
      const data = await res.json() as BackfillResult & { error?: string; message?: string };
      if (!res.ok || data.error) {
        setPhase("error");
        setErrorMsg(data.message || data.error || `HTTP ${res.status}`);
        return;
      }
      setResult({ ...data, results: data.results ?? [] });
      setPhase("done");
      if (!dryRun && ((data.updated ?? 0) > 0)) onDone();
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1DB954]/10">
            <i className="ri-spotify-line text-[18px]" style={{ color: "#1DB954" }} />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#171712]">Backfill Spotify Profile Images</p>
            <p className="text-[11px] text-[#858c7e]">Fetches artist photos from Spotify for artists missing profile pics</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runBackfill(true)}
            disabled={phase === "running"}
            className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-2 text-[12px] font-bold text-[#697062] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Dry run
          </button>
          <button
            onClick={() => runBackfill(false)}
            disabled={phase === "running"}
            className="rounded-xl bg-[#5f8f2f] px-3 py-2 text-[12px] font-black text-white hover:bg-[#4d7a26] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {phase === "running" ? (
              <><WkIcon name="Loader2" size={13} className="animate-spin" /> Running…</>
            ) : (
              <><i className="ri-image-add-line text-[13px]" /> Backfill images</>
            )}
          </button>
        </div>
      </div>

      {phase === "error" && errorMsg && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Found", result.total_found, "text-[#697062]"],
              ["Updated", result.updated, "text-[#5f8f2f]"],
              ["No image", result.no_image, "text-[#f0a020]"],
              ["Errors", result.errors, "text-red-600"],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="rounded-xl border border-[#dfe4d8] p-2.5 text-center">
                <p className={`text-[18px] font-black ${cls}`}>{value as number}</p>
                <p className="text-[10px] font-bold text-[#a8ad9e] uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
          {result.dry_run && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] font-bold text-amber-700">
              Dry run — no changes were written. Click "Backfill images" to apply.
            </div>
          )}
          {result.results?.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] font-bold text-[#5f8f2f] hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({result.results.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#dfe4d8]">
                  {result.results.map((r, i) => (
                    <div key={r.slug + i} className="flex items-center gap-3 border-b border-[#f0f3ec] px-3 py-2 last:border-b-0">
                      {r.new_image ? (
                        <img src={r.new_image} alt={r.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#f0f3ec] shrink-0 flex items-center justify-center">
                          <WkIcon name="Mic2" size={14} className="text-[#c8d0be]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#171712] truncate">{r.name}</p>
                        {r.message && <p className="text-[10px] text-[#a8ad9e] truncate">{r.message}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        r.status === "updated" ? "bg-[#e8f5dc] text-[#5f8f2f]" :
                        r.status === "error" ? "bg-red-50 text-red-600" :
                        r.status === "no_image" ? "bg-amber-50 text-amber-600" :
                        "bg-[#f0f3ec] text-[#858c7e]"
                      }`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Enrich Result Row ─────────────── */

function EnrichResultRow({ item: r }: { item: EnrichResultItem }) {
  const [rowExpanded, setRowExpanded] = useState(false);

  return (
    <div className="border-b border-[#f0f3ec] last:border-b-0">
      <button
        onClick={() => setRowExpanded((v) => !v)}
        className="flex items-center gap-3 px-3 py-2.5 w-full text-left hover:bg-[#f8f9f4] transition-colors"
      >
        {r.changes.image?.new ? (
          <img src={r.changes.image.new} alt={r.name} className="h-9 w-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-[#f0f3ec] shrink-0 flex items-center justify-center">
            <WkIcon name="Mic2" size={14} className="text-[#c8d0be]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-[#171712] truncate">{r.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {r.providersFound.map((p) => (
              <span key={p} className="text-[10px] font-bold text-[#5f8f2f] bg-[#e8f5dc] rounded-full px-1.5 py-0.5">
                {p}
              </span>
            ))}
            {r.changes.bio && (
              <span className="text-[10px] font-bold text-[#697062] bg-[#f0f3ec] rounded-full px-1.5 py-0.5">bio</span>
            )}
            {r.changes.genres && (
              <span className="text-[10px] font-bold text-[#697062] bg-[#f0f3ec] rounded-full px-1.5 py-0.5">genres</span>
            )}
            {r.message && <span className="text-[10px] text-[#a8ad9e] truncate">{r.message}</span>}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
          r.status === "updated" ? "bg-[#e8f5dc] text-[#5f8f2f]" :
          r.status === "error" ? "bg-red-50 text-red-600" :
          r.status === "no_data" ? "bg-amber-50 text-amber-600" :
          "bg-[#f0f3ec] text-[#858c7e]"
        }`}>{r.status}</span>
      </button>
      {rowExpanded && r.debug && (
        <div className="px-3 pb-3 pl-14">
          <pre className="text-[10px] text-[#697062] font-mono bg-[#f8f9f4] rounded-lg p-2 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
            {JSON.stringify(r.debug, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Page ─────────────── */

export default function ArtistsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlFilter = searchParams.get("filter");

  const [artists, setArtists] = useState<RegistryEntityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dbTotal, setDbTotal] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>(
    (urlFilter as QualityFilter) || "all"
  );
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [page, setPage] = useState(1);

  const [genreSlugs, setGenreSlugs] = useState<Set<string>>(new Set());
  const [selectedArtist, setSelectedArtist] = useState<EnrichedArtist | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [unpublishing, setUnpublishing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<EnrichedArtist | null>(null);

  // Single enrich state
  const [enrichingSlug, setEnrichingSlug] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchArtists() {
    setLoading(true);
    setError(null);

    // Fetch total count directly from DB
    supabase
      .from("registry_artists")
      .select("*", { count: "exact", head: true })
      .then(({ count }) => {
        if (count !== null) setDbTotal(count);
      });

    // Fetch the full list
    const { data, error: fetchError } = await getRegistryEntityList("artist", { limit: FETCH_LIMIT });
    if (fetchError) {
      setError(fetchError);
      setArtists([]);
    } else {
      setArtists(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchArtists();
  }, []);

  useEffect(() => {
    if (qualityFilter === "missing_genre") {
      supabase
        .from("registry_entity_relationships")
        .select("source_slug")
        .eq("relationship_type", "artist_genre")
        .eq("source_entity_type", "artists")
        .then(({ data }) => {
          setGenreSlugs(new Set((data ?? []).map((r) => r.source_slug).filter(Boolean)));
        });
    }
  }, [qualityFilter]);

  const enrichedArtists = useMemo<EnrichedArtist[]>(() => {
    return artists.map((artist) => ({
      ...artist,
      _quality: calculateCompleteness(artist, schema),
      _displayName: getDisplayName(artist),
      _displayImage: getDisplayImage(artist),
      _displayCountry: getDisplayCountry(artist),
    }));
  }, [artists]);

  // Compute available country options from the data
  const countryOptions = useMemo<CountryOption[]>(() => {
    const map = new Map<string, number>();
    enrichedArtists.forEach((a) => {
      if (a._displayCountry) {
        map.set(a._displayCountry, (map.get(a._displayCountry) ?? 0) + 1);
      }
    });
    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, label: code, count }));
    return sorted;
  }, [enrichedArtists]);

  const summary = useMemo(() => {
    const total = dbTotal ?? enrichedArtists.length;
    const complete = enrichedArtists.filter((a) => a._quality.completeness >= 85).length;
    const draftOnly = enrichedArtists.filter((a) => String(a.status) === "draft").length;
    const activeOnly = enrichedArtists.filter((a) => String(a.status) === "active").length;
    const missingCountry = enrichedArtists.filter((a) => !a._displayCountry).length;
    const missingImage = enrichedArtists.filter((a) => !a._displayImage).length;
    const missingType = enrichedArtists.filter((a) => !a.artist_type || a.artist_type === "unknown").length;
    const averageCompleteness = enrichedArtists.length
      ? Math.round(enrichedArtists.reduce((sum, a) => sum + a._quality.completeness, 0) / enrichedArtists.length)
      : 0;
    return { total, complete, draftOnly, activeOnly, missingCountry, missingImage, missingType, averageCompleteness };
  }, [enrichedArtists, dbTotal]);

  const filteredArtists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = enrichedArtists.filter((artist) => {
      const searchable = [
        artist._displayName,
        artist._displayCountry,
        artist.slug,
        artist.status,
        artist.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (qualityFilter === "complete") return artist._quality.completeness >= 85;
      if (qualityFilter === "incomplete") return artist._quality.completeness < 85;
      if (qualityFilter === "missing_country") return !artist._displayCountry;
      if (qualityFilter === "missing_origin") return !artist.origin_iso2 || String(artist.origin_iso2).trim() === "";
      if (qualityFilter === "missing_image") return !artist._displayImage;
      if (qualityFilter === "missing_bio") return !artist.bio;
      if (qualityFilter === "missing_genre") return !genreSlugs.has(String(artist.slug));
      if (qualityFilter === "missing_type") return !artist.artist_type || artist.artist_type === "unknown";
      if (qualityFilter === "blocked") return artist._quality.state === "blocked";
      return true;
    });
    // Country filter
    if (countryFilter !== "all") {
      rows = rows.filter((a) => a._displayCountry === countryFilter);
    }
    // Status filter
    if (statusFilter !== "all") {
      rows = rows.filter((a) => String(a.status) === statusFilter);
    }
    rows = [...rows].sort((a, b) => {
      if (sortMode === "name") return a._displayName.localeCompare(b._displayName);
      if (sortMode === "completeness_low") return a._quality.completeness - b._quality.completeness;
      if (sortMode === "completeness_high") return b._quality.completeness - a._quality.completeness;
      const aTime = new Date(String(a.updated_at || a.created_at || 0)).getTime();
      const bTime = new Date(String(b.updated_at || b.created_at || 0)).getTime();
      return bTime - aTime;
    });
    return rows;
  }, [enrichedArtists, query, qualityFilter, countryFilter, statusFilter, sortMode, genreSlugs]);

  const totalPages = Math.max(1, Math.ceil(filteredArtists.length / PAGE_SIZE));
  const pagedArtists = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredArtists.slice(start, start + PAGE_SIZE);
  }, [filteredArtists, page]);

  // Reset page and clear selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [query, qualityFilter, countryFilter, statusFilter, sortMode]);

  function handleSaved(updatedEntity: Record<string, unknown>) {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === updatedEntity.id ? (updatedEntity as RegistryEntityProfile) : artist,
      ),
    );
    setSelectedArtist((current) =>
      current?.id === updatedEntity.id
        ? (updatedEntity as EnrichedArtist)
        : current,
    );
    showToast(`Saved ${getDisplayName(updatedEntity)}`);
  }

  // ─── Bulk selection handlers ───

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllInPage() {
    const pageIds = new Set(pagedArtists.map((a) => String(a.id)));
    setSelectedIds(pageIds);
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  // ─── Bulk unpublish ───

  const selectedActiveIds = useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const artist = enrichedArtists.find((a) => String(a.id) === id);
      return artist && String(artist.status) === "active";
    });
  }, [selectedIds, enrichedArtists]);

  const selectedDraftIds = useMemo(() => {
    return Array.from(selectedIds).filter((id) => {
      const artist = enrichedArtists.find((a) => String(a.id) === id);
      return artist && String(artist.status) === "draft";
    });
  }, [selectedIds, enrichedArtists]);

  const confirmDetail = useMemo(() => {
    return selectedActiveIds
      .slice(0, 15)
      .map((id) => {
        const a = enrichedArtists.find((art) => String(art.id) === id);
        return a ? a._displayName : id;
      })
      .join(", ")
      + (selectedActiveIds.length > 15 ? ` …and ${selectedActiveIds.length - 15} more` : "");
  }, [selectedActiveIds, enrichedArtists]);

  const confirmPublishDetail = useMemo(() => {
    return selectedDraftIds
      .slice(0, 15)
      .map((id) => {
        const a = enrichedArtists.find((art) => String(art.id) === id);
        return a ? a._displayName : id;
      })
      .join(", ")
      + (selectedDraftIds.length > 15 ? ` …and ${selectedDraftIds.length - 15} more` : "");
  }, [selectedDraftIds, enrichedArtists]);

  const confirmDeleteDetail = useMemo(() => {
    return selectedDraftIds
      .slice(0, 15)
      .map((id) => {
        const a = enrichedArtists.find((art) => String(art.id) === id);
        return a ? a._displayName : id;
      })
      .join(", ")
      + (selectedDraftIds.length > 15 ? ` …and ${selectedDraftIds.length - 15} more` : "");
  }, [selectedDraftIds, enrichedArtists]);

  function openConfirmUnpublish() {
    if (selectedActiveIds.length === 0) {
      showToast("No active artists selected to unpublish.");
      return;
    }
    setConfirmOpen(true);
  }

  function openConfirmPublish() {
    if (selectedDraftIds.length === 0) {
      showToast("No draft artists selected to publish.");
      return;
    }
    setConfirmPublishOpen(true);
  }

  async function executeUnpublish() {
    setUnpublishing(true);
    setConfirmOpen(false);

    const ids = selectedActiveIds;
    let succeeded = 0;
    let failed = 0;

    // Batch in groups of 10 for faster processing
    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          saveRegistryEntityPatch("artist", id, { status: "draft" })
        ),
      );
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value.ok) {
          succeeded++;
        } else {
          failed++;
        }
      });
    }

    setUnpublishing(false);
    setSelectedIds(new Set());
    showToast(`Unpublished ${succeeded} artist${succeeded !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}`);
    fetchArtists();
  }

  async function executePublish() {
    setPublishing(true);
    setConfirmPublishOpen(false);

    const ids = selectedDraftIds;
    let succeeded = 0;
    let failed = 0;

    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          saveRegistryEntityPatch("artist", id, { status: "active" })
        ),
      );
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value.ok) {
          succeeded++;
        } else {
          failed++;
        }
      });
    }

    setPublishing(false);
    setSelectedIds(new Set());
    showToast(`Published ${succeeded} artist${succeeded !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}`);
    fetchArtists();
  }

  function openConfirmDelete() {
    if (selectedDraftIds.length === 0) {
      showToast("No draft artists selected to delete.");
      return;
    }
    setSingleDeleteTarget(null);
    setConfirmDeleteOpen(true);
  }

  function openConfirmSingleDelete(artist: EnrichedArtist) {
    setSingleDeleteTarget(artist);
    setConfirmDeleteOpen(true);
  }

  async function executeDelete() {
    setDeleting(true);
    setConfirmDeleteOpen(false);

    const ids = singleDeleteTarget
      ? [String(singleDeleteTarget.id)]
      : selectedDraftIds;
    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
      const result = await deleteRegistryEntity("artist", id);
      if (result.ok) {
        succeeded++;
      } else {
        failed++;
      }
    }

    setDeleting(false);
    setSingleDeleteTarget(null);
    setSelectedIds(new Set());
    showToast(`Deleted ${succeeded} artist${succeeded !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}`);
    fetchArtists();
  }

  async function enrichSingle(artist: EnrichedArtist) {
    setEnrichingSlug(artist.slug);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showToast("Not authenticated."); return; }
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string) || "";
      const res = await fetch(`${supabaseUrl}/functions/v1/registry-enrich-artist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string) || "",
        },
        body: JSON.stringify({ artist_slug: artist.slug, providers: ["spotify", "apple_music"] }),
      });
      const data = await res.json() as EnrichResult & { error?: string; message?: string };
      if (!res.ok || data.error) {
        showToast(data.message || data.error || "Enrich failed");
        return;
      }
      const r = data.results?.[0];
      if (r?.status === "updated") {
        showToast(`${artist._displayName} enriched — ${r.providersFound.join(", ")}`);
        fetchArtists();
      } else if (r?.status === "no_data") {
        showToast(`${artist._displayName}: no data found`);
      } else {
        showToast(`${artist._displayName}: ${r?.message || r?.status || "skipped"}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Enrich failed");
    } finally {
      setEnrichingSlug(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-bold text-[#171712] shadow-xl">
          {toast}
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={`Unpublish ${selectedActiveIds.length} artist${selectedActiveIds.length !== 1 ? "s" : ""}?`}
        message="This will move them from active to draft status. They will no longer appear on the frontend, in searches, or contribute to chart editions."
        detail={confirmDetail}
        confirmLabel={`Yes, unpublish ${selectedActiveIds.length}`}
        onConfirm={executeUnpublish}
        onCancel={() => setConfirmOpen(false)}
        loading={false}
      />

      <ConfirmModal
        open={confirmPublishOpen}
        title={`Publish ${selectedDraftIds.length} artist${selectedDraftIds.length !== 1 ? "s" : ""}?`}
        message="This will move them from draft to active status. They will appear on the frontend, in searches, and contribute to future chart editions."
        detail={confirmPublishDetail}
        confirmLabel={`Yes, publish ${selectedDraftIds.length}`}
        onConfirm={executePublish}
        onCancel={() => setConfirmPublishOpen(false)}
        loading={false}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        title={`Delete ${singleDeleteTarget ? `"${singleDeleteTarget._displayName}"` : `${selectedDraftIds.length} artist${selectedDraftIds.length !== 1 ? "s" : ""}`}?`}
        message="This action is permanent and cannot be undone. The artist record will be completely removed from the database."
        detail={singleDeleteTarget ? singleDeleteTarget._displayName : confirmDeleteDetail}
        confirmLabel={`Yes, delete ${singleDeleteTarget ? "this artist" : `${selectedDraftIds.length}`}`}
        onConfirm={executeDelete}
        onCancel={() => { setConfirmDeleteOpen(false); setSingleDeleteTarget(null); }}
        loading={deleting}
      />

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Artists</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              {dbTotal !== null
                ? `${dbTotal.toLocaleString()} total · ${filteredArtists.length.toLocaleString()} showing`
                : `${filteredArtists.length.toLocaleString()} artist${filteredArtists.length !== 1 ? "s" : ""} in registry`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/admin/registry/artists/intake")}
              className="rounded-2xl bg-[#5f8f2f] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#4d7a26] flex items-center gap-2"
            >
              <WkIcon name="Upload" size={14} />
              Artist Intake
            </button>
            <button
              onClick={fetchArtists}
              className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-black text-[#171712] shadow-sm transition hover:border-[#85c441] flex items-center gap-2"
            >
              <WkIcon name="RefreshCcw" size={14} />
              Refresh
            </button>
          </div>
        </header>

        {/* KPI stats */}
        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            ["Total in DB", summary.total],
            ["Active", summary.activeOnly],
            ["Draft", summary.draftOnly],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing country", summary.missingCountry],
            ["Missing image", summary.missingImage],
            ["Missing type", summary.missingType],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">{label}</p>
              <p className="mt-2 text-2xl font-black text-[#171712]">{value as number}</p>
            </div>
          ))}
        </section>

        {/* Spotify Backfill */}
        <section className="mb-5">
          <ArtistEnrichPanel onDone={fetchArtists} />
        </section>

        {/* Artist Origin Enrichment */}
        <section className="mb-5">
          <ArtistOriginPanel onDone={fetchArtists} />
        </section>

        {/* Artist Type Backfill */}
        <section className="mb-5">
          <ArtistTypePanel onDone={fetchArtists} />
        </section>

        {/* Filter bar */}
        <section className="mb-5 rounded-2xl border border-[#dfe4d8] bg-white p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_160px_160px]">
            <div className="relative">
              <WkIcon name="Search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8ad9e]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search artists by name, country, slug, id…"
                className="h-11 w-full rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] pl-10 pr-4 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
              />
            </div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="all">All countries</option>
              {countryOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value as QualityFilter)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="all">All quality states</option>
              <option value="complete">Near complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing_country">Missing country</option>
              <option value="missing_origin">Missing origin ISO</option>
              <option value="missing_image">Missing image</option>
              <option value="missing_bio">Missing bio</option>
              <option value="missing_genre">Missing genre</option>
              <option value="missing_type">Missing type</option>
              <option value="blocked">Blocked</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="recent">Recently updated</option>
              <option value="name">Name A-Z</option>
              <option value="completeness_low">Completeness low → high</option>
              <option value="completeness_high">Completeness high → low</option>
            </select>
          </div>
        </section>

        {/* Error */}
        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-bold">Could not load registry artists</p>
            <p className="mt-1 text-xs">{error}</p>
            <button onClick={fetchArtists} className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">
              Retry
            </button>
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[#dfe4d8] bg-white">
            <div className="flex flex-col items-center gap-3">
              <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
              <p className="text-[13px] font-bold text-[#697062]">Loading artists…</p>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && (
          <div className="space-y-4">
            {filteredArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#dfe4d8] bg-white px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                  <WkIcon name="SearchX" size={28} className="text-[#858c7e]" />
                </div>
                <p className="text-[16px] font-black text-[#171712]">No artists found</p>
                <p className="max-w-md text-[13px] text-[#697062]">
                  {query || qualityFilter !== "all" || countryFilter !== "all"
                    ? "No artists match your current filters. Try adjusting your search or filters."
                    : "No live registry artists found."}
                </p>
              </div>
            ) : (
              <>
                {/* Bulk toolbar */}
                <BulkToolbar
                  selectedCount={selectedIds.size}
                  totalInView={pagedArtists.length}
                  onSelectAll={selectAllInPage}
                  onDeselectAll={deselectAll}
                  onUnpublish={openConfirmUnpublish}
                  unpublishing={unpublishing}
                  onPublish={openConfirmPublish}
                  publishing={publishing}
                  draftCount={selectedDraftIds.length}
                  activeCount={selectedActiveIds.length}
                  onDelete={openConfirmDelete}
                  deleting={deleting}
                  deleteCount={selectedDraftIds.length}
                />

                {/* Card grid */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {pagedArtists.map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onOpen={setSelectedArtist}
                      onNavigate={(slug) => navigate(`/admin/registry/artists/${slug}`)}
                      selected={selectedIds.has(String(artist.id))}
                      onToggleSelect={toggleSelect}
                      onDelete={openConfirmSingleDelete}
                      onEnrich={enrichSingle}
                      enriching={enrichingSlug === artist.slug}
                    />
                  ))}
                </div>
                {/* Pagination */}
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={filteredArtists.length}
                  pageSize={PAGE_SIZE}
                />
              </>
            )}
          </div>
        )}
      </div>

      {selectedArtist && (
        <RegistryEntityEditorDrawer
          entityType="artist"
          entity={selectedArtist}
          schema={schema}
          onClose={() => setSelectedArtist(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}