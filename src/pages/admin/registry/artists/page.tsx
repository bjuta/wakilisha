import { useEffect, useMemo, useState, useCallback } from "react";
import { Modal } from "@/components/design-system/primitives/Modal";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone } from "@/services/registry/admin/completeness";
import { getRegistryEntityList, saveRegistryEntityPatch } from "@/services/registry/admin/client";
import { previewArtistEnrichment } from "@/services/registry/admin/artistEnrichment";
import { ArtistEnrichPanel, ArtistTypePanel } from "@/components/admin/registry/ArtistEnrichmentGovernancePanels";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSelect } from "@/components/design-system/primitives/Select";


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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-wk-border bg-wk-surface px-4 py-3">
      <span className="text-[12px] text-wk-text-muted">
        Showing <strong className="text-wk-text">{start}</strong>
        –<strong className="text-wk-text">{end}</strong> of{" "}
        <strong className="text-wk-text">{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-wk-border text-wk-text-muted disabled:opacity-40 hover:border-wk-brand hover:text-wk-brand"
        >
          <WkIcon name="ChevronLeft" size={16} />
        </button>
        {getVisiblePages().map((page, i) =>
          typeof page === "string" ? (
            <span key={`dots-${i}`} className="px-2 text-[11px] text-wk-text-muted">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition ${
                page === currentPage
                  ? "bg-wk-brand text-wk-brand-on"
                  : "border border-wk-border text-wk-text-muted hover:border-wk-brand hover:text-wk-brand"
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-wk-border text-wk-text-muted disabled:opacity-40 hover:border-wk-brand hover:text-wk-brand"
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
  onArchive,
  archiving,
  archiveCount,
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
  onArchive?: () => void;
  archiving?: boolean;
  archiveCount?: number;
}) {
  if (selectedCount === 0) return null;

  const showPublish = onPublish && draftCount && draftCount > 0;
  const showUnpublish = activeCount && activeCount > 0;
  const showArchive = onArchive && archiveCount && archiveCount > 0;

  return (
    <div className="sticky top-0 z-30 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-wk-border bg-wk-surface px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-bold text-wk-text">
          {selectedCount} artist{selectedCount !== 1 ? "s" : ""} selected
        </span>
        {selectedCount < totalInView && (
          <button
            onClick={onSelectAll}
            className="text-[12px] font-bold text-wk-brand hover:underline"
          >
            Select all {totalInView} on this page
          </button>
        )}
        <button
          onClick={onDeselectAll}
          className="text-[12px] font-bold text-wk-text-muted hover:text-wk-text"
        >
          Clear selection
        </button>
      </div>
      <div className="flex items-center gap-2">
        {showPublish && (
          <button
            onClick={onPublish}
            disabled={publishing}
            className="rounded-xl bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on transition hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
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
            className="rounded-xl bg-wk-warning-soft px-4 py-2 text-[12px] font-black text-wk-warning transition hover:bg-wk-surface-strong disabled:opacity-50 flex items-center gap-2"
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
        {showArchive && (
          <button
            onClick={onArchive}
            disabled={archiving}
            className="rounded-xl bg-wk-danger-soft px-4 py-2 text-[12px] font-black text-wk-danger transition hover:bg-wk-surface-strong disabled:opacity-50 flex items-center gap-2"
          >
            {archiving ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Archiving…
              </>
            ) : (
              <>
                <WkIcon name="Archive" size={14} />
                Archive ({archiveCount})
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
  onArchive,
  onEnrich,
  enriching,
}: {
  artist: EnrichedArtist;
  onOpen: (artist: EnrichedArtist) => void;
  onNavigate: (slug: string) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onArchive?: (artist: EnrichedArtist) => void;
  onEnrich?: (artist: EnrichedArtist) => void;
  enriching?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const q = artist._quality;

  return (
    <div
      data-wk-registry-artist-card className={`group relative overflow-hidden rounded-2xl border bg-wk-surface transition-all ${
        selected ? "border-wk-brand ring-2 ring-wk-brand" : "border-wk-border hover:border-wk-brand"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox */}
      <div className="absolute left-3 top-3 z-20">
        <button
          aria-label={`Select ${artist._displayName}`}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(String(artist.id));
          }}
          className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition ${
            selected
              ? "border-wk-brand bg-wk-brand text-wk-brand-on"
              : "border-wk-border-strong bg-wk-surface hover:border-wk-brand"
          }`}
        >
          {selected && <WkIcon name="Check" size={12} />}
        </button>
      </div>

      {/* Image area */}
      <div className="relative aspect-square bg-wk-surface-raised">
        {artist._displayImage ? (
          <img
            src={artist._displayImage}
            alt={artist._displayName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <WkIcon name="Mic2" size={40} className="text-wk-text-faint" />
          </div>
        )}
        {/* Hover overlay with actions */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-[var(--wk-overlay)] transition-opacity ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex gap-2 flex-wrap justify-center px-2">
            <button
              onClick={() => onOpen(artist)}
              className="rounded-xl bg-wk-surface px-4 py-2 text-[12px] font-bold text-wk-text hover:bg-wk-surface-raised"
            >
              Edit
            </button>
            <button
              onClick={() => onNavigate(artist.slug)}
              className="rounded-xl border border-wk-border-strong px-4 py-2 text-[12px] font-bold text-wk-text hover:bg-wk-surface-raised"
            >
              Details
            </button>
            {onEnrich && (
              <button
                onClick={() => onEnrich(artist)}
                disabled={enriching}
                className="rounded-xl bg-wk-brand px-4 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {enriching ? (
                  <WkIcon name="Loader2" size={13} className="animate-spin" />
                ) : (
                  <i className="ri-sparkling-line text-[13px]" />
                )}
                Enrich
              </button>
            )}
            {String(artist.status) === "draft" && onArchive && (
              <button
                onClick={() => onArchive(artist)}
                className="rounded-xl bg-wk-danger-soft px-4 py-2 text-[12px] font-bold text-wk-danger hover:bg-wk-surface-strong"
              >
                Archive
              </button>
            )}
          </div>
        </div>
        {/* Status badge */}
        <div className="absolute right-3 top-3 z-20">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm ${
              String(artist.status) === "active"
                ? "bg-wk-success-soft text-wk-success"
                : "bg-wk-surface-strong text-wk-text-muted"
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
              className="text-left text-[14px] font-bold text-wk-text hover:text-wk-brand transition-colors truncate block"
            >
              {artist._displayName}
            </button>
            <p className="mt-0.5 text-[11px] text-wk-text-muted truncate">{artist.slug}</p>
          </div>
          <button
            onClick={() => onOpen(artist)}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-wk-border text-wk-text-muted hover:border-wk-brand hover:text-wk-brand"
            title="Quick edit"
          >
            <WkIcon name="Pencil" size={14} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {artist.artist_type && (
            <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted uppercase tracking-wide">
              {artist.artist_type}
            </span>
          )}
          {artist._displayCountry && (
            <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted uppercase tracking-wide">
              {artist._displayCountry}
            </span>
          )}
        </div>

        {/* Completeness bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-wk-text-muted uppercase tracking-wide">Completeness</span>
            <span className={`text-[11px] font-black ${completenessTone(q.completeness)}`}>
              {q.completeness}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-wk-surface-strong">
            <div
              className="h-full rounded-full bg-wk-brand transition-all"
              style={{ width: `${q.completeness}%` }}
            />
          </div>
          {q.missingFields.length > 0 && (
            <p className="mt-1 text-[10px] text-wk-text-muted truncate">
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
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="md"
      dismissable={!loading}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="wk-button wk-button-secondary wk-button-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-wk-warning-soft px-4 py-2 text-[12px] font-black text-wk-warning hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-wk-text-muted">{message}</p>
      {detail ? (
        <p className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-wk-bg-subtle p-3 font-mono text-[11px] text-wk-text-faint">
          {detail}
        </p>
      ) : null}
    </Modal>
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
    <div data-wk-registry-artist-panel="origin" className="rounded-2xl border border-wk-border bg-wk-surface p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-wk-warning-soft">
            <i className="ri-earth-line text-[18px] text-wk-warning" />
          </div>
          <div>
            <p className="text-[13px] font-black text-wk-text">Enrich Origin</p>
            <p className="text-[11px] text-wk-text-muted">Normalize country metadata &amp; look up ISO origin via MusicBrainz</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setUseMusicBrainz((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${useMusicBrainz ? "border-wk-brand bg-wk-brand-soft text-wk-brand" : "border-wk-border bg-wk-surface-raised text-wk-text-muted"}`}
            title="Use MusicBrainz to look up artists without country metadata"
          >
            <i className="ri-database-2-line text-[12px]" />
            MusicBrainz
          </button>
          <button
            onClick={() => runOriginBackfill(true)}
            disabled={phase === "running"}
            className="rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-2 text-[12px] font-bold text-wk-text-muted hover:border-wk-brand hover:text-wk-brand disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <WkIcon name="Eye" size={13} />
            Preview
          </button>
          <button
            onClick={() => runOriginBackfill(false)}
            disabled={phase === "running"}
            className="rounded-xl bg-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand-on hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
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
        <div className="mt-3 rounded-xl bg-wk-danger-soft border border-wk-danger px-3 py-2 text-[12px] font-bold text-wk-danger">
          {errorMsg}
        </div>
      )}

      {phase === "done" && result && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Found", result.total_found, "text-wk-text-muted"],
              ["From metadata", result.normalized_from_metadata, "text-wk-brand"],
              ["From MusicBrainz", result.from_musicbrainz, "text-wk-brand"],
              ["Skipped", result.skipped, "text-wk-text-muted"],
            ].map(([label, value, cls]) => (
              <div key={label as string} className="rounded-xl border border-wk-border p-2.5 text-center">
                <p className={`text-[18px] font-black ${cls}`}>{value as number}</p>
                <p className="text-[10px] font-bold text-wk-text-muted uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
          {result.dry_run && (
            <div className="rounded-xl bg-wk-warning-soft border border-wk-warning px-3 py-2 text-[12px] font-bold text-wk-warning">
              Preview mode — no changes were written. Click "Backfill Origin" to apply.
            </div>
          )}
          {result.results?.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] font-bold text-wk-brand hover:underline flex items-center gap-1"
              >
                <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
                {expanded ? "Hide" : "Show"} details ({result.results.length} artists)
              </button>
              {expanded && (
                <div className="mt-2 max-h-[500px] overflow-y-auto rounded-xl border border-wk-border">
                  {result.results.map((r, i) => (
                    <div key={r.slug + i} className="flex items-center gap-3 border-b border-wk-divider px-3 py-2.5 last:border-b-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                        r.source === "musicbrainz" ? "bg-wk-brand-soft text-wk-brand" :
                        r.source === "metadata_normalization" ? "bg-wk-warning-soft text-wk-warning" :
                        "bg-wk-surface-raised text-wk-text-muted"
                      }`}>
                        {r.newIso2 || "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-wk-text truncate">{r.name}</p>
                        <p className="text-[10px] text-wk-text-muted truncate">
                          {r.source === "metadata_normalization" ? r.debug :
                           r.source === "musicbrainz" ? `${r.countryName} (${Math.round(r.confidence * 100)}% confidence)` :
                           r.debug || "No origin found"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        r.source === "musicbrainz" ? "bg-wk-brand-soft text-wk-brand" :
                        r.source === "metadata_normalization" ? "bg-wk-warning-soft text-wk-warning" :
                        "bg-wk-surface-raised text-wk-text-muted"
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
  const [archiving, setArchiving] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [singleArchiveTarget, setSingleArchiveTarget] = useState<EnrichedArtist | null>(null);

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

  const confirmArchiveDetail = useMemo(() => {
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
        batch.map((id) => {
          const artist = enrichedArtists.find((row) => String(row.id) === id);
          return saveRegistryEntityPatch(
            "artist",
            id,
            { status: "draft" },
            String(artist?.updated_at ?? ""),
          );
        }),
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
        batch.map((id) => {
          const artist = enrichedArtists.find((row) => String(row.id) === id);
          return saveRegistryEntityPatch(
            "artist",
            id,
            { status: "active" },
            String(artist?.updated_at ?? ""),
          );
        }),
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

  function openConfirmArchive() {
    if (selectedDraftIds.length === 0) {
      showToast("No draft artists selected to archive.");
      return;
    }
    setSingleArchiveTarget(null);
    setConfirmArchiveOpen(true);
  }

  function openConfirmSingleArchive(artist: EnrichedArtist) {
    setSingleArchiveTarget(artist);
    setConfirmArchiveOpen(true);
  }

  async function executeArchive() {
    setArchiving(true);
    setConfirmArchiveOpen(false);

    const ids = singleArchiveTarget
      ? [String(singleArchiveTarget.id)]
      : selectedDraftIds;
    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
      const artist = enrichedArtists.find((row) => String(row.id) === id);
      const result = await saveRegistryEntityPatch(
        "artist",
        id,
        { status: "archived" },
        String(artist?.updated_at ?? ""),
      );
      if (result.ok) {
        succeeded++;
      } else {
        failed++;
      }
    }

    setArchiving(false);
    setSingleArchiveTarget(null);
    setSelectedIds(new Set());
    showToast(`Archived ${succeeded} artist${succeeded !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}`);
    fetchArtists();
  }

  async function enrichSingle(artist: EnrichedArtist) {
    setEnrichingSlug(artist.slug);
    try {
      const preview = await previewArtistEnrichment({
        mode: "profile",
        artistIds: [String(artist.id)],
        providers: ["spotify", "apple_music"],
        force: true,
      });
      const item = preview.results?.[0];

      if (item?.status === "updated") {
        showToast(
          `${artist._displayName}: proposal ready - review and approve on Details.`,
        );
        navigate(`/admin/registry/artists/${artist.slug}`);
      } else if (item?.status === "no_data") {
        showToast(`${artist._displayName}: no provider evidence found`);
      } else {
        showToast(
          `${artist._displayName}: ${
            item?.message || item?.status || "no change proposed"
          }`,
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Enrichment preview failed",
      );
    } finally {
      setEnrichingSlug(null);
    }
  }

  return (
    <div data-wk-registry-artists className="min-w-0 bg-wk-bg px-5 py-6 text-wk-text">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-wk-border bg-wk-surface px-4 py-3 text-sm font-bold text-wk-text shadow-xl">
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
        open={confirmArchiveOpen}
        title={`Archive ${singleArchiveTarget ? `"${singleArchiveTarget._displayName}"` : `${selectedDraftIds.length} artist${selectedDraftIds.length !== 1 ? "s" : ""}`}?`}
        message="This keeps the Artist and Resource identities intact, removes the draft from active work, and preserves provenance for future audit."
        detail={singleArchiveTarget ? singleArchiveTarget._displayName : confirmArchiveDetail}
        confirmLabel={`Yes, archive ${singleArchiveTarget ? "this artist" : `${selectedDraftIds.length}`}`}
        onConfirm={executeArchive}
        onCancel={() => { setConfirmArchiveOpen(false); setSingleArchiveTarget(null); }}
        loading={archiving}
      />

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-wk-brand">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Artists</h1>
            <p className="mt-2 max-w-2xl text-sm text-wk-text-muted">
              {dbTotal !== null
                ? `${dbTotal.toLocaleString()} total · ${filteredArtists.length.toLocaleString()} showing`
                : `${filteredArtists.length.toLocaleString()} artist${filteredArtists.length !== 1 ? "s" : ""} in registry`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/admin/registry/artists/intake")}
              className="rounded-2xl bg-wk-brand px-4 py-3 text-sm font-black text-wk-brand-on shadow-sm transition hover:opacity-90 flex items-center gap-2"
            >
              <WkIcon name="Upload" size={14} />
              Artist Intake
            </button>
            <button
              onClick={fetchArtists}
              className="rounded-2xl border border-wk-border bg-wk-surface px-4 py-3 text-sm font-black text-wk-text shadow-sm transition hover:border-wk-brand flex items-center gap-2"
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
            <div key={label as string} className="rounded-2xl border border-wk-border bg-wk-surface p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-wk-text-muted">{label}</p>
              <p className="mt-2 text-2xl font-black text-wk-text">{value as number}</p>
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
        <section data-wk-registry-artist-filters className="mb-5 rounded-2xl border border-wk-border bg-wk-surface p-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <WkIcon name="Search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wk-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search artists by name, country, slug, id…"
                className="h-11 w-full rounded-xl border border-wk-border bg-wk-surface-raised pl-10 pr-4 text-sm outline-none transition focus:border-wk-brand focus:bg-wk-surface"
              />
            </div>
            <WkSelect
              value={countryFilter}
              onChange={(value) => setCountryFilter(value)}
              triggerClassName="h-11 rounded-xl border border-wk-border bg-wk-surface-raised px-3 text-sm outline-none transition focus:border-wk-brand focus:bg-wk-surface"
            >
              <option value="all">All countries</option>
              {countryOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </WkSelect>
            <WkSelect
              value={qualityFilter}
              onChange={(value) => setQualityFilter(value as QualityFilter)}
              triggerClassName="h-11 rounded-xl border border-wk-border bg-wk-surface-raised px-3 text-sm outline-none transition focus:border-wk-brand focus:bg-wk-surface"
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
            </WkSelect>
            <WkSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              triggerClassName="h-11 rounded-xl border border-wk-border bg-wk-surface-raised px-3 text-sm outline-none transition focus:border-wk-brand focus:bg-wk-surface"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </WkSelect>
            <WkSelect
              value={sortMode}
              onChange={(value) => setSortMode(value as SortMode)}
              triggerClassName="h-11 rounded-xl border border-wk-border bg-wk-surface-raised px-3 text-sm outline-none transition focus:border-wk-brand focus:bg-wk-surface"
            >
              <option value="recent">Recently updated</option>
              <option value="name">Name A-Z</option>
              <option value="completeness_low">Completeness low → high</option>
              <option value="completeness_high">Completeness high → low</option>
            </WkSelect>
          </div>
        </section>

        {/* Error */}
        {error && (
          <section className="mb-4 rounded-2xl border border-wk-danger bg-wk-danger-soft p-4 text-sm font-semibold text-wk-danger">
            <p className="font-bold">Could not load registry artists</p>
            <p className="mt-1 text-xs">{error}</p>
            <button onClick={fetchArtists} className="mt-2 rounded-xl border border-wk-danger bg-wk-surface px-3 py-1.5 text-xs font-bold text-wk-danger hover:bg-wk-danger-soft">
              Retry
            </button>
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-wk-border bg-wk-surface">
            <div className="flex flex-col items-center gap-3">
              <WkIcon name="Loader2" size={28} className="animate-spin text-wk-brand" />
              <p className="text-[13px] font-bold text-wk-text-muted">Loading artists…</p>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && (
          <div className="space-y-4">
            {filteredArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-wk-border bg-wk-surface px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-surface-raised">
                  <WkIcon name="SearchX" size={28} className="text-wk-text-muted" />
                </div>
                <p className="text-[16px] font-black text-wk-text">No artists found</p>
                <p className="max-w-md text-[13px] text-wk-text-muted">
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
                  onArchive={openConfirmArchive}
                  archiving={archiving}
                  archiveCount={selectedDraftIds.length}
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
                      onArchive={openConfirmSingleArchive}
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