import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

/* ── Types ────────────────────────────────────────────────────────────────── */

type AlbumAction = "merge" | "canonicalize" | "ignore";

interface AdditionalPrimaryArtist {
  artist_id: string;
  artist_slug: string;
  artist_name: string;
}

interface PreviewTrack {
  apple_music_id: string;
  title: string;
  track_number: number | null;
  disc_number: number | null;
  duration_ms: number | null;
  duration_display: string;
  isrc: string | null;
  artist_name: string;
  explicit: boolean;
  preview_url: string | null;
}

interface PreviewAlbum {
  apple_music_id: string;
  title: string;
  slug: string;
  release_type: string;
  release_date: string | null;
  upc: string | null;
  record_label: string | null;
  genre_names: string[];
  artwork_url: string | null;
  apple_music_url: string | null;
  track_count: number;
  tracks: PreviewTrack[];
  match_status: "existing" | "new";
  existing_release: {
    id: string;
    slug: string;
    title: string;
    source: string;
  } | null;
  album_artist_name: string;
}

interface PreviewResponse {
  ok: boolean;
  mode: string;
  artist: { id: string; slug: string; name: string };
  storefront: string;
  albums_searched: number;
  albums_fetched: number;
  albums_failed: string[];
  albums: PreviewAlbum[];
  duration_ms: number;
  error?: string;
  detail?: string;
}

interface ApplyResponse {
  ok: boolean;
  mode: string;
  summary: {
    merged: number;
    canonicalized: number;
    ignored: number;
    tracks_created: number;
    errors: string[];
  };
  duration_ms: number;
  error?: string;
}

interface RegistryArtistOption {
  id: string;
  slug: string;
  display_name: string;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatYear(dateStr: string | null): string {
  if (!dateStr) return "—";
  const match = String(dateStr).match(/\d{4}/);
  return match ? match[0] : "—";
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case "album": return "bg-wk-brand/10 text-wk-brand border-wk-brand/20";
    case "ep": return "bg-wk-warning-soft text-wk-warning border-wk-warning/20";
    case "single": return "bg-wk-surface-raised text-wk-text-muted border-wk-border";
    default: return "bg-wk-surface-raised text-wk-text-muted border-wk-border";
  }
}

function sourceLabel(source: string): string {
  if (source.includes("apple_music")) return "Apple Music";
  if (source.includes("phase1")) return "Phase1 Backfill";
  if (source.includes("wp")) return "WP Import";
  return source.replace(/_/g, " ");
}

function displayArtistName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeArtistName(name: string): string {
  return displayArtistName(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugifyArtistName(name: string): string {
  return normalizeArtistName(name)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

/* ── Track Row ────────────────────────────────────────────────────────────── */

function TrackRow({ track, index }: { track: PreviewTrack; index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#fbfcf8] transition-colors group">
      <span className="w-5 shrink-0 text-center text-[11px] font-bold text-[#b8bfb2]">
        {track.track_number ?? index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-semibold text-[#171712] truncate">{track.title}</p>
          {track.explicit && (
            <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase bg-[#f0f0f0] text-[#8a8a8a]">E</span>
          )}
        </div>
        {track.isrc && (
          <p className="text-[10px] font-mono text-[#97a290] mt-0.5">{track.isrc}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[11px] font-mono text-[#b8bfb2]">{track.duration_display}</span>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {track.preview_url && (
            <a
              href={track.preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f7e8] text-[#5f8f2f] hover:bg-[#5f8f2f] hover:text-white transition-colors"
            >
              <WkIcon name="Play" size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Artist Search Dropdown ───────────────────────────────────────────────── */

function ArtistSearchDropdown({
  currentArtistSlug,
  selectedArtists,
  onAdd,
  onRemove,
  onCreate,
}: {
  currentArtistSlug: string;
  selectedArtists: AdditionalPrimaryArtist[];
  onAdd: (artist: AdditionalPrimaryArtist) => void;
  onRemove: (artistSlug: string) => void;
  onCreate: (artistName: string) => Promise<AdditionalPrimaryArtist | null>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistryArtistOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creatingArtist, setCreatingArtist] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from("registry_artists")
          .select("id, slug, display_name")
          .eq("status", "active")
          .ilike("display_name", `%${query}%`)
          .neq("slug", currentArtistSlug)
          .order("display_name")
          .limit(8);
        const filtered = (data || []).filter(
          (a) => !selectedArtists.some((sa) => sa.artist_slug === a.slug)
        );
        setResults(filtered as RegistryArtistOption[]);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, currentArtistSlug, selectedArtists]);

  const handleCreateArtist = useCallback(async () => {
    const cleanName = displayArtistName(query);
    if (cleanName.length < 2) {
      setCreateError("Enter at least 2 characters.");
      return;
    }

    setCreatingArtist(true);
    setCreateError(null);

    try {
      const artist = await onCreate(cleanName);
      if (!artist) {
        setCreateError("Artist was not created.");
        return;
      }

      onAdd(artist);
      setQuery("");
      setResults([]);
      setShowDropdown(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create artist.");
    } finally {
      setCreatingArtist(false);
    }
  }, [query, onAdd, onCreate]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="mt-2">
      {/* Selected artists chips */}
      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedArtists.map((a) => (
            <span
              key={a.artist_slug}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#5f8f2f]/10 border border-[#5f8f2f]/30 px-2.5 py-1 text-[11px] font-bold text-[#5f8f2f]"
            >
              <i className="ri-user-line text-[10px]" />
              {a.artist_name}
              <button
                type="button"
                onClick={() => onRemove(a.artist_slug)}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#5f8f2f]/20 hover:bg-[#5f8f2f]/40 transition-colors cursor-pointer"
              >
                <WkIcon name="X" size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-[#dfe4d8] bg-[#fbfcf8] px-3 py-1.5">
          {searching ? (
            <WkIcon name="Loader2" size={12} className="animate-spin text-[#97a290] shrink-0" />
          ) : (
            <WkIcon name="Search" size={12} className="text-[#97a290] shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCreateError(null);
            }}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search registry for co-primary artist…"
            className="flex-1 bg-transparent text-[11px] text-[#171712] placeholder:text-[#b8bfb2] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults([]); setShowDropdown(false); }}
              className="flex h-4 w-4 items-center justify-center rounded-full text-[#97a290] hover:text-[#171712] transition-colors cursor-pointer"
            >
              <WkIcon name="X" size={10} />
            </button>
          )}
        </div>
        {showDropdown && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-[#dfe4d8] bg-white shadow-lg overflow-hidden"
          >
            {results.map((artist) => (
              <button
                key={artist.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAdd({ artist_id: artist.id, artist_slug: artist.slug, artist_name: artist.display_name });
                  setQuery("");
                  setResults([]);
                  setShowDropdown(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f0f7e8] transition-colors cursor-pointer"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f3ec] shrink-0">
                  <i className="ri-user-line text-[10px] text-[#97a290]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#171712] truncate">{artist.display_name}</p>
                  <p className="text-[10px] font-mono text-[#97a290]">{artist.slug}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {showDropdown && !searching && results.length === 0 && query.length >= 2 && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-[#dfe4d8] bg-white shadow-lg px-3 py-2.5">
            <p className="text-[11px] text-[#97a290] italic">No artists found for &ldquo;{query}&rdquo;</p>
            <button
              type="button"
              disabled={creatingArtist}
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreateArtist();
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#85c441] bg-[#f0f7e8] px-3 py-2 text-[11px] font-bold text-[#5f8f2f] hover:bg-[#5f8f2f] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creatingArtist ? (
                <WkIcon name="Loader2" size={12} className="animate-spin" />
              ) : (
                <WkIcon name="PlusCircle" size={12} />
              )}
              Create artist &ldquo;{displayArtistName(query)}&rdquo;
            </button>
            {createError && (
              <p className="mt-2 text-[10px] font-semibold text-red-600">{createError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Album Card ───────────────────────────────────────────────────────────── */

interface AlbumCardProps {
  album: PreviewAlbum;
  action: AlbumAction | null;
  onAction: (albumId: string, action: AlbumAction) => void;
  applying: boolean;
  additionalPrimaryArtists: AdditionalPrimaryArtist[];
  onAddPrimaryArtist: (albumId: string, artist: AdditionalPrimaryArtist) => void;
  onRemovePrimaryArtist: (albumId: string, artistSlug: string) => void;
  onCreatePrimaryArtist: (artistName: string) => Promise<AdditionalPrimaryArtist | null>;
  currentArtistSlug: string;
}

function AlbumCard({ album, action, onAction, applying, additionalPrimaryArtists, onAddPrimaryArtist, onRemovePrimaryArtist, onCreatePrimaryArtist, currentArtistSlug }: AlbumCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPrimaryArtistPanel, setShowPrimaryArtistPanel] = useState(false);
  const isExisting = album.match_status === "existing";

  return (
    <div className={`rounded-2xl border-2 transition-all ${
      action === "merge"
        ? "border-emerald-400 bg-emerald-50/50 shadow-sm"
        : action === "canonicalize"
        ? "border-[#85c441] bg-[#f0f7e8]/50 shadow-sm"
        : action === "ignore"
        ? "border-[#dfe4d8] bg-[#f7f7f2] opacity-50"
        : "border-[#dfe4d8] bg-white hover:border-[#c8e6a0]"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-4 p-4">
        {/* Artwork */}
        <div className="relative shrink-0">
          {album.artwork_url ? (
            <img
              src={album.artwork_url}
              alt={album.title}
              className="h-20 w-20 rounded-xl object-cover object-top border border-[#dfe4d8]"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#f0f3ec] border border-[#dfe4d8]">
              <WkIcon name="Disc3" size={28} className="text-[#97a290]" />
            </div>
          )}
          {isExisting && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase">
              Match
            </span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-black text-[#171712] leading-tight">{album.title}</p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${typeBadgeColor(album.release_type)}`}>
              {album.release_type}
            </span>
          </div>

          {/* Metadata chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b]">
              {formatYear(album.release_date)}
            </span>
            <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b]">
              {album.track_count} tracks
            </span>
            {album.upc && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-mono text-[#71796b]">
                UPC {album.upc}
              </span>
            )}
            {album.record_label && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b] truncate max-w-[200px]" title={album.record_label}>
                {album.record_label}
              </span>
            )}
            {album.genre_names.slice(0, 3).map((g) => (
              <span key={g} className="rounded-full bg-[#f0f7e8] px-2 py-0.5 text-[10px] text-[#5f8f2f]">
                {g}
              </span>
            ))}
          </div>

          {/* Existing match info */}
          {isExisting && album.existing_release && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
              <WkIcon name="GitBranch" size={12} className="text-amber-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-amber-800 truncate">
                  Existing: {album.existing_release.title}
                </p>
                <p className="text-[10px] text-amber-600">
                  Source: {sourceLabel(album.existing_release.source)} · <span className="font-mono">{album.existing_release.slug}</span>
                </p>
              </div>
            </div>
          )}

          {!isExisting && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#dfe4d8] bg-[#fbfcf8] px-3 py-1.5">
              <WkIcon name="Sparkles" size={12} className="text-[#5f8f2f] shrink-0" />
              <p className="text-[11px] text-[#697062]">
                New release — not yet in WAKILISHA registry
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tracks preview */}
      {album.tracks.length > 0 && (
        <div className="border-t border-[#eef1ea]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 px-4 py-2 text-[11px] font-bold text-[#697062] hover:text-[#171712] transition-colors"
          >
            <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={12} />
            {expanded ? "Hide" : "Show"} {album.tracks.length} tracks
            {!expanded && (
              <span className="text-[10px] font-normal text-[#b8bfb2] ml-1">
                ({album.tracks.filter((t) => t.isrc).length} with ISRC)
              </span>
            )}
          </button>
          {expanded && (
            <div className="divide-y divide-[#eef1ea]/50 max-h-[320px] overflow-y-auto">
              {album.tracks.map((track, idx) => (
                <TrackRow key={track.apple_music_id} track={track} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Primary Artists Panel */}
      {showPrimaryArtistPanel && action !== "ignore" && (
        <div className="border-t border-[#eef1ea] bg-[#fafcf5] px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <WkIcon name="Users" size={13} className="text-[#5f8f2f] shrink-0" />
            <p className="text-[11px] font-bold text-[#171712]">
              Additional Primary Artists
            </p>
            <span className="text-[10px] text-[#97a290]">
              &mdash; co-primary artists who own this release alongside the current artist
            </span>
          </div>
          <ArtistSearchDropdown
            currentArtistSlug={currentArtistSlug}
            selectedArtists={additionalPrimaryArtists}
            onAdd={(artist) => onAddPrimaryArtist(album.apple_music_id, artist)}
            onRemove={(slug) => onRemovePrimaryArtist(album.apple_music_id, slug)}
            onCreate={onCreatePrimaryArtist}
          />
          {additionalPrimaryArtists.length > 0 && (
            <p className="mt-2 text-[10px] text-[#697062]">
              These artists will be written as <strong>is_primary = true</strong> on this release and all its tracks.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#eef1ea] px-4 py-3">
        {isExisting && (
          <button
            onClick={() => onAction(album.apple_music_id, "merge")}
            disabled={applying}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              action === "merge"
                ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300 ring-offset-1"
                : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            } disabled:opacity-50`}
          >
            <WkIcon name={action === "merge" ? "CheckCircle" : "GitMerge"} size={13} />
            {action === "merge" ? "Will Merge" : "Merge (overwrite existing)"}
          </button>
        )}
        <button
          onClick={() => onAction(album.apple_music_id, "canonicalize")}
          disabled={applying}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer ${
            action === "canonicalize"
              ? "bg-[#5f8f2f] text-white shadow-sm ring-2 ring-[#85c441] ring-offset-1"
              : "border border-[#85c441] bg-[#f0f7e8] text-[#5f8f2f] hover:bg-[#5f8f2f] hover:text-white"
          } disabled:opacity-50`}
        >
          <WkIcon name={action === "canonicalize" ? "CheckCircle" : "PlusCircle"} size={13} />
          {action === "canonicalize" ? "Will Canonicalize" : "Canonicalize (create new)"}
        </button>
        <button
          onClick={() => onAction(album.apple_music_id, "ignore")}
          disabled={applying}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer ${
            action === "ignore"
              ? "bg-[#f0f0f0] text-[#8a8a8a] border border-[#d0d0d0] ring-2 ring-[#d0d0d0] ring-offset-1"
              : "border border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#d0d0d0] hover:text-[#171712]"
          } disabled:opacity-50`}
        >
          <WkIcon name={action === "ignore" ? "MinusCircle" : "XCircle"} size={13} />
          {action === "ignore" ? "Ignored" : "Ignore"}
        </button>
        {action !== "ignore" && (
          <button
            onClick={() => setShowPrimaryArtistPanel((v) => !v)}
            disabled={applying}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              showPrimaryArtistPanel || additionalPrimaryArtists.length > 0
                ? "border border-[#5f8f2f]/40 bg-[#f0f7e8] text-[#5f8f2f]"
                : "border border-[#dfe4d8] bg-white text-[#71796b] hover:border-[#85c441]"
            } disabled:opacity-50`}
            title="Set additional primary artists for multi-artist releases"
          >
            <WkIcon name="Users" size={12} />
            {additionalPrimaryArtists.length > 0
              ? `${additionalPrimaryArtists.length} co-primary`
              : "Co-primary"}
          </button>
        )}
        {album.apple_music_url && (
          <a
            href={album.apple_music_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 rounded-lg border border-[#dfe4d8] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#71796b] hover:border-[#85c441] hover:text-[#5f8f2f] transition-colors whitespace-nowrap"
          >
            <WkIcon name="ExternalLink" size={11} />
            Apple Music
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Main Drawer ──────────────────────────────────────────────────────────── */

interface ArtistDiscographyIntakeDrawerProps {
  artistSlug: string;
  artistName: string;
  onClose: () => void;
  onComplete: () => void;
}

export function ArtistDiscographyIntakeDrawer({
  artistSlug,
  artistName,
  onClose,
  onComplete,
}: ArtistDiscographyIntakeDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [albums, setAlbums] = useState<PreviewAlbum[]>([]);
  const [storefront, setStorefront] = useState("—");
  const [duration, setDuration] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [actions, setActions] = useState<Record<string, AlbumAction>>({});
  const [additionalPrimaryArtists, setAdditionalPrimaryArtists] = useState<Record<string, AdditionalPrimaryArtist[]>>({});
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResponse["summary"] | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingApply, setPendingApply] = useState(false);

  const hasFetched = useRef(false);

  // Auto-fetch preview on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function fetchPreview() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "ingest-artist-discography",
          { body: { artistSlug, mode: "preview" }, timeout: 15000 }
        );

        if (invokeError) {
          console.error("[Intake] preview invoke error:", invokeError);
          const ctx = (invokeError as Record<string, unknown>).context;
          let detail = invokeError.message;
          if (ctx) {
            const bodyText = (ctx as Record<string, unknown>).body;
            if (bodyText && typeof bodyText === "string") {
              try {
                const parsed = JSON.parse(bodyText);
                if (parsed?.detail) detail = parsed.detail;
                else if (parsed?.error) detail = `[${parsed.stage ?? "?"}] ${parsed.error}`;
              } catch { /* keep detail */ }
            }
          }
          setError(detail);
          return;
        }

        const response = data as PreviewResponse;
        if (!response.ok) {
          setError(response.detail ?? response.error ?? "Preview failed");
          return;
        }

        // Enrich albums with album_artist_name from Apple Music data
        const enrichedAlbums = response.albums.map((a: any) => ({
          ...a,
          album_artist_name: a.album_artist_name || "",
        })) as PreviewAlbum[];

        setAlbums(enrichedAlbums);
        setStorefront(response.storefront);
        setDuration(response.duration_ms);
        setFailedCount(response.albums_failed.length);

        // Auto-select actions: existing -> merge, new -> canonicalize
        const autoActions: Record<string, AlbumAction> = {};
        for (const album of enrichedAlbums) {
          autoActions[album.apple_music_id] = album.match_status === "existing" ? "merge" : "canonicalize";
        }
        setActions(autoActions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch preview");
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [artistSlug]);

  const handleAction = useCallback((albumId: string, action: AlbumAction) => {
    setApplyError(null);
    setActions((prev) => {
      if (prev[albumId] === action) {
        return prev;
      }
      return { ...prev, [albumId]: action };
    });
  }, []);

  const handleAddPrimaryArtist = useCallback((albumId: string, artist: AdditionalPrimaryArtist) => {
    setAdditionalPrimaryArtists((prev) => {
      const existing = prev[albumId] || [];
      if (existing.some((a) => a.artist_slug === artist.artist_slug)) return prev;
      return { ...prev, [albumId]: [...existing, artist] };
    });
  }, []);

  const handleRemovePrimaryArtist = useCallback((albumId: string, artistSlug: string) => {
    setAdditionalPrimaryArtists((prev) => {
      const existing = prev[albumId] || [];
      return { ...prev, [albumId]: existing.filter((a) => a.artist_slug !== artistSlug) };
    });
  }, []);

  const handleCreatePrimaryArtist = useCallback(async (artistName: string): Promise<AdditionalPrimaryArtist | null> => {
    const cleanName = displayArtistName(artistName);

    if (cleanName.length < 2) {
      throw new Error("Enter a valid artist name.");
    }

    const { data, error: invokeError } = await supabase.functions.invoke(
      "ingest-artist-discography",
      {
        body: {
          artistSlug,
          mode: "create_artist_shell",
          artistName: cleanName,
        },
        timeout: 15000,
      }
    );

    if (invokeError) {
      const ctx = (invokeError as Record<string, unknown>).context;
      let detail = invokeError.message;

      if (ctx) {
        const bodyText = (ctx as Record<string, unknown>).body;
        if (bodyText && typeof bodyText === "string") {
          try {
            const parsed = JSON.parse(bodyText);
            if (parsed?.detail) detail = parsed.detail;
            else if (parsed?.error) detail = `[${parsed.stage ?? "?"}] ${parsed.error}`;
          } catch {
            // Keep default detail.
          }
        }
      }

      throw new Error(detail);
    }

    const response = data as {
      ok?: boolean;
      error?: string;
      detail?: string;
      artist?: AdditionalPrimaryArtist;
    };

    if (!response.ok || !response.artist) {
      throw new Error(response.detail ?? response.error ?? "Artist was not created.");
    }

    return response.artist;
  }, [artistSlug]);

  const handleApply = async () => {
    const selectedAlbums = Object.entries(actions).map(([apple_music_id, action]) => ({
      apple_music_id,
      action,
      additional_primary_artists: additionalPrimaryArtists[apple_music_id] || [],
    }));

    if (selectedAlbums.length === 0) {
      setApplyError("Select at least one album with an action before applying.");
      return;
    }

    setApplying(true);
    setApplyError(null);
    setApplyResult(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "ingest-artist-discography",
        { body: { artistSlug, mode: "apply", selected_albums: selectedAlbums }, timeout: 15000 }
      );

      if (invokeError) {
        console.error("[Intake] apply invoke error:", invokeError);
        const ctx = (invokeError as Record<string, unknown>).context;
        let detail = invokeError.message;
        if (ctx) {
          const bodyText = (ctx as Record<string, unknown>).body;
          if (bodyText && typeof bodyText === "string") {
            try {
              const parsed = JSON.parse(bodyText);
              if (parsed?.detail) detail = parsed.detail;
              else if (parsed?.error) detail = `[${parsed.stage ?? "?"}] ${parsed.error}`;
            } catch { /* keep */ }
          }
        }
        setApplyError(detail);
        return;
      }

      const response = data as ApplyResponse;
      console.log("[Intake] apply response:", response);
      if (!response.ok) {
        setApplyError(response.error ?? "Apply failed");
        return;
      }

      setApplyResult(response.summary);
      // Only auto-close the drawer on clean success — keep it open if errors occurred
      if (response.summary.errors.length === 0) {
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err) {
      console.error("[Intake] apply caught error:", err);
      setApplyError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const existingCount = albums.filter((a) => a.match_status === "existing").length;
  const newCount = albums.filter((a) => a.match_status === "new").length;
  const mergeCount = Object.values(actions).filter((a) => a === "merge").length;
  const canonCount = Object.values(actions).filter((a) => a === "canonicalize").length;
  const ignoreCount = Object.values(actions).filter((a) => a === "ignore").length;
  const unsetCount = albums.length - mergeCount - canonCount - ignoreCount;

  const hasTrackArtistErrors = applyResult?.errors.some((e) => e.includes("track_artists")) ?? false;
  const hasErrors = applyResult?.errors.length ?? 0 > 0;
  const isPartialSuccess = applyResult && hasErrors;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Discography intake">
      {/* Backdrop */}
      <button className="absolute inset-0 bg-black/40 cursor-default" onClick={onClose} aria-label="Close" />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-full max-w-3xl flex-col bg-[#f7f7f2] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfe4d8] bg-white px-6 py-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f0f7e8]">
                <WkIcon name="Apple" size={16} className="text-[#5f8f2f]" />
              </div>
              <h2 className="text-[16px] font-black text-[#171712]">Apple Music Discography</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-[#697062]">
              {artistName} · Storefront {storefront.toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={applying}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#dfe4d8] text-[#71796b] hover:border-[#85c441] hover:text-[#171712] disabled:opacity-50 transition-colors"
          >
            <WkIcon name="X" size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
              <p className="text-[14px] font-bold text-[#171712]">Searching Apple Music for {artistName}…</p>
              <p className="text-[12px] text-[#697062]">Fetching album details, tracks, and metadata</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <WkIcon name="AlertTriangle" size={20} className="shrink-0 text-red-700" />
                <div>
                  <p className="text-[14px] font-bold text-red-800">Failed to load discography</p>
                  <p className="mt-1 text-[12px] text-red-700">{error}</p>
                  <button
                    onClick={() => { hasFetched.current = false; }}
                    className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-[12px] font-bold text-red-700 hover:bg-red-100"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && albums.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                <WkIcon name="Disc3" size={28} className="text-[#97a290]" />
              </div>
              <p className="text-[16px] font-black text-[#171712]">No albums found</p>
              <p className="max-w-sm text-[13px] text-[#697062]">
                Apple Music returned no albums for "{artistName}" in storefront {storefront.toUpperCase()}.
              </p>
            </div>
          )}

          {/* Apply result — success or partial success */}
          {applyResult && (
            <div className={`rounded-2xl border p-5 mb-4 ${
              hasErrors
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  hasErrors ? "bg-amber-100" : "bg-emerald-100"
                }`}>
                  <WkIcon name={hasErrors ? "AlertTriangle" : "CheckCircle"} size={22} className={hasErrors ? "text-amber-600" : "text-emerald-600"} />
                </div>
                <div>
                  <p className={`text-[15px] font-black ${hasErrors ? "text-amber-800" : "text-emerald-800"}`}>
                    {hasErrors ? "Applied with warnings" : "Applied successfully"}
                  </p>
                  <p className={`text-[11px] ${hasErrors ? "text-amber-700" : "text-emerald-700"}`}>
                    {hasErrors
                      ? `${applyResult.errors.length} error${applyResult.errors.length !== 1 ? "s" : ""} occurred. Review below and retry if needed.`
                      : "Discography will refresh…"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className={`rounded-xl bg-white border p-3 text-center ${hasErrors ? "border-amber-200" : "border-emerald-200"}`}>
                  <p className={`text-[20px] font-black ${hasErrors ? "text-amber-700" : "text-emerald-700"}`}>{applyResult.merged}</p>
                  <p className={`text-[10px] font-bold ${hasErrors ? "text-amber-600" : "text-emerald-600"}`}>Merged</p>
                </div>
                <div className={`rounded-xl bg-white border p-3 text-center ${hasErrors ? "border-amber-200" : "border-emerald-200"}`}>
                  <p className={`text-[20px] font-black ${hasErrors ? "text-amber-700" : "text-emerald-700"}`}>{applyResult.canonicalized}</p>
                  <p className={`text-[10px] font-bold ${hasErrors ? "text-amber-600" : "text-emerald-600"}`}>Canonicalized</p>
                </div>
                <div className={`rounded-xl bg-white border p-3 text-center ${hasErrors ? "border-amber-200" : "border-emerald-200"}`}>
                  <p className={`text-[20px] font-black ${hasErrors ? "text-amber-700" : "text-emerald-700"}`}>{applyResult.ignored}</p>
                  <p className={`text-[10px] font-bold ${hasErrors ? "text-amber-600" : "text-emerald-600"}`}>Ignored</p>
                </div>
                <div className={`rounded-xl bg-white border p-3 text-center ${hasErrors ? "border-amber-200" : "border-emerald-200"}`}>
                  <p className={`text-[20px] font-black ${hasErrors ? "text-amber-700" : "text-emerald-700"}`}>{applyResult.tracks_created}</p>
                  <p className={`text-[10px] font-bold ${hasErrors ? "text-amber-600" : "text-emerald-600"}`}>Tracks</p>
                </div>
              </div>
              {applyResult.errors.length > 0 && (
                <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-[11px] font-bold text-red-700 mb-1">Errors</p>
                  {applyResult.errors.map((e, i) => (
                    <p key={i} className="text-[10px] text-red-600">{e}</p>
                  ))}
                </div>
              )}
              {hasErrors && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setApplyResult(null);
                      setApplyError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 cursor-pointer"
                  >
                    <WkIcon name="RefreshCw" size={12} />
                    Retry
                  </button>
                  <button
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4d8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#71796b] hover:bg-[#f7f7f2] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pre-apply confirmation dialog */}
          {showConfirm && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <WkIcon name="AlertTriangle" size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-[15px] font-black text-amber-800">Confirm overwrite</p>
                  <p className="text-[11px] text-amber-700">
                    {mergeCount > 0
                      ? `You selected ${mergeCount} album${mergeCount !== 1 ? "s" : ""} to merge. This will overwrite existing release, track, and artist relationships.`
                      : "This will overwrite existing track-artist relationships for the selected albums."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    handleApply();
                  }}
                  disabled={applying}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  <WkIcon name="Check" size={12} />
                  Yes, overwrite
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={applying}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe4d8] bg-white px-4 py-2 text-[12px] font-bold text-[#71796b] hover:bg-[#f7f7f2] disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Apply error */}
          {applyError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4">
              <div className="flex items-start gap-3">
                <WkIcon name="AlertTriangle" size={18} className="shrink-0 text-red-700" />
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-red-800">Apply failed</p>
                  <p className="text-[12px] text-red-700 mt-0.5">{applyError}</p>
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                  >
                    <WkIcon name="RefreshCw" size={12} />
                    Retry apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats summary bar */}
          {!loading && !error && albums.length > 0 && (!applyResult || applyResult.errors.length > 0) && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#dfe4d8] bg-white p-4">
              <div className="rounded-full bg-[#f0f3ec] px-3 py-1.5 text-[11px] font-bold text-[#71796b]">
                {albums.length} albums · {duration}ms
              </div>
              <div className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-700">
                {existingCount} existing matches
              </div>
              <div className="rounded-full bg-[#f0f7e8] px-3 py-1.5 text-[11px] font-bold text-[#5f8f2f]">
                {newCount} new releases
              </div>
              {failedCount > 0 && (
                <div className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600">
                  {failedCount} failed to fetch
                </div>
              )}
              <div className="ml-auto flex items-center gap-2 text-[11px] text-[#b8bfb2]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {mergeCount} merge
                <span className="h-1.5 w-1.5 rounded-full bg-[#85c441]" />
                {canonCount} canonicalize
                <span className="h-1.5 w-1.5 rounded-full bg-[#d0d0d0]" />
                {ignoreCount} ignore
                {unsetCount > 0 && (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#b8bfb2]" />
                    {unsetCount} unset
                  </>
                )}
              </div>
            </div>
          )}

          {/* Album cards */}
          {!loading && !error && albums.length > 0 && (!applyResult || applyResult.errors.length > 0) && (
            <div className="space-y-3 pb-20">
              {albums.map((album) => (
                <AlbumCard
                  key={album.apple_music_id}
                  album={album}
                  action={actions[album.apple_music_id] ?? null}
                  onAction={handleAction}
                  applying={applying}
                  additionalPrimaryArtists={additionalPrimaryArtists[album.apple_music_id] || []}
                  onAddPrimaryArtist={handleAddPrimaryArtist}
                  onRemovePrimaryArtist={handleRemovePrimaryArtist}
                  onCreatePrimaryArtist={handleCreatePrimaryArtist}
                  currentArtistSlug={artistSlug}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && !error && albums.length > 0 && (!applyResult || applyResult.errors.length > 0) && (
          <div className="shrink-0 border-t border-[#dfe4d8] bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-[12px] font-bold text-[#171712]">
                  {mergeCount + canonCount} album{mergeCount + canonCount !== 1 ? "s" : ""} selected
                </p>
                <p className="text-[11px] text-[#697062]">
                  {ignoreCount} ignored
                  {unsetCount > 0 && (
                    <span className="text-[#b8bfb2] ml-1">· {unsetCount} unset will be skipped</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setApplyError(null);
                    const autoActions: Record<string, AlbumAction> = {};
                    for (const album of albums) {
                      autoActions[album.apple_music_id] = album.match_status === "existing" ? "merge" : "canonicalize";
                    }
                    setActions(autoActions);
                  }}
                  disabled={applying}
                  className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2 text-[12px] font-bold text-[#71796b] hover:border-[#85c441] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  Reset defaults
                </button>
                <button
                  onClick={() => {
                    setApplyError(null);
                    setActions({});
                  }}
                  disabled={applying}
                  className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2 text-[12px] font-bold text-[#71796b] hover:border-[#85c441] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  Clear all
                </button>
                <button
                  onClick={() => {
                    if (mergeCount > 0) {
                      setShowConfirm(true);
                    } else {
                      handleApply();
                    }
                  }}
                  disabled={applying || mergeCount + canonCount === 0}
                  className="flex items-center gap-2 rounded-xl bg-[#5f8f2f] px-6 py-2.5 text-[13px] font-bold text-white hover:bg-[#4d7526] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {applying ? (
                    <><WkIcon name="Loader2" size={14} className="animate-spin" /> Applying…</>
                  ) : (
                    <><WkIcon name="Zap" size={14} /> Apply {mergeCount + canonCount} album{mergeCount + canonCount !== 1 ? "s" : ""}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}