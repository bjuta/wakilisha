import { WkIcon } from "@/components/design-system/Icon";
import type { ProviderSearchResult, ProviderEntityType } from "@/services/registry/provider-intake/types";

interface ProviderResultCardProps {
  result: ProviderSearchResult;
  onInspect: (result: ProviderSearchResult) => void;
  onCreateShell?: (result: ProviderSearchResult) => void;
  onAttachToShell?: (result: ProviderSearchResult) => void;
  isLoading?: boolean;
}

function entityTypeLabel(type: ProviderEntityType): string {
  switch (type) {
    case "release": return "Release";
    case "track": return "Track";
    case "artist": return "Artist";
    case "label": return "Label";
    default: return type;
  }
}

function entityTypeColor(type: ProviderEntityType): string {
  switch (type) {
    case "release": return "bg-[#f0f7e8] text-[#5f8f2f] border-[#c8e6a0]";
    case "track": return "bg-amber-50 text-amber-700 border-amber-200";
    case "artist": return "bg-sky-50 text-sky-700 border-sky-200";
    case "label": return "bg-rose-50 text-rose-700 border-rose-200";
    default: return "bg-[#f0f3ec] text-[#71796b] border-[#dfe4d8]";
  }
}

function getKeyField(result: ProviderSearchResult, key: string): string | null {
  const field = result.summaryFields.find((f) => f.key === key);
  return field?.value != null ? String(field.value) : null;
}

export function ProviderResultCard({ result, onInspect, onCreateShell, onAttachToShell, isLoading = false }: ProviderResultCardProps) {
  const isRelease = result.providerEntityType === "release";
  const isTrack = result.providerEntityType === "track";
  const isArtist = result.providerEntityType === "artist";

  const releaseDate = getKeyField(result, "release_date");
  const trackCount = getKeyField(result, "track_count");
  const label = getKeyField(result, "label");
  const upc = getKeyField(result, "upc");
  const isrc = getKeyField(result, "isrc");
  const duration = getKeyField(result, "duration");
  const genres = getKeyField(result, "genres");

  return (
    <div className="group rounded-2xl border border-[#e8ece2] bg-white transition-all hover:border-[#c8e6a0] hover:shadow-sm">
      <div className="flex items-start gap-3 p-4">
        {/* Artwork */}
        <div className="relative shrink-0">
          {result.artworkUrl ? (
            <img
              src={result.artworkUrl}
              alt={result.title}
              className="h-16 w-16 rounded-xl object-cover object-top"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#f0f3ec]">
              <WkIcon
                name={isArtist ? "UserCircle" : isTrack ? "Music" : "Disc3"}
                size={24}
                className="text-[#97a290]"
              />
            </div>
          )}
          <span className={`absolute -right-1.5 -top-1.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${entityTypeColor(result.providerEntityType)}`}>
            {entityTypeLabel(result.providerEntityType)}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black text-[#171712] leading-tight truncate">{result.title}</p>

          {result.artistDisplayName && !isArtist && (
            <p className="mt-0.5 text-[12px] text-[#697062] truncate">{result.artistDisplayName}</p>
          )}

          {/* Metadata chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {isRelease && releaseDate && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b]">
                {releaseDate.slice(0, 4)}
              </span>
            )}
            {isRelease && trackCount && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b]">
                {trackCount} tracks
              </span>
            )}
            {isRelease && label && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b] truncate max-w-[140px]">
                {label}
              </span>
            )}
            {isRelease && upc && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-mono text-[#71796b]">
                UPC {upc.slice(-8)}
              </span>
            )}
            {isTrack && isrc && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-mono text-[#71796b]">
                {isrc}
              </span>
            )}
            {isTrack && duration && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b]">
                {duration}
              </span>
            )}
            {isArtist && genres && (
              <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] text-[#71796b] truncate max-w-[180px]">
                {genres.split(",")[0]}
              </span>
            )}
            <span className="rounded-full bg-[#f0f7e8] px-2 py-0.5 text-[10px] font-bold text-[#5f8f2f]">
              {result.source.storefrontOrMarket?.toUpperCase() ?? "–"} · {Math.round(result.confidenceScore * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#f0f3ec] px-4 py-3">
        <button
          onClick={() => onInspect(result)}
          disabled={isLoading}
          className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#171712] hover:border-[#85c441] hover:text-[#5f8f2f] disabled:opacity-50 whitespace-nowrap transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <WkIcon name="ZoomIn" size={12} />
            Inspect
          </span>
        </button>

        {(isRelease || isTrack) && onCreateShell && (
          <button
            onClick={() => onCreateShell(result)}
            disabled={isLoading}
            className="rounded-xl bg-[#5f8f2f] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#4d7526] disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <WkIcon name="Plus" size={12} />
              Create release shell
            </span>
          </button>
        )}

        {(isRelease || isTrack) && onAttachToShell && (
          <button
            onClick={() => onAttachToShell(result)}
            disabled={isLoading}
            className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#697062] hover:border-[#85c441] disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <WkIcon name="Link" size={12} />
              Attach to existing shell
            </span>
          </button>
        )}

        {isArtist && (
          <span className="rounded-xl border border-[#f0e0c0] bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">
            Artist results cannot directly create release shells. Choose a release from catalogue below.
          </span>
        )}
      </div>
    </div>
  );
}