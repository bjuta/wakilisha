import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ArtistEmbedData {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  country?: string;
  trackCount?: number;
  releaseCount?: number;
  chartEntryCount?: number;
  topChartPosition?: number | null;
  contextText?: string;
}

/* ------------------------------------------------------------------ */
/*  Marker helpers                                                     */
/* ------------------------------------------------------------------ */

export const ARTIST_MARKER_PREFIX = "WK_REGISTRY_ARTIST";

const REGISTRY_MARKER_RE = /<!--WK_REGISTRY_ARTIST:([^:]+):([^:]*):([^>]*)-->/g;

/**
 * Scans HTML for artist registry markers and fetches artist data from Supabase.
 */
export async function resolveArtistMarkers(
  markedHtml: string,
): Promise<{ markedHtml: string; artists: ArtistEmbedData[] }> {
  const markers: Array<{ fullMatch: string; slug: string; artistSlug: string; artistName: string }> = [];

  let m: RegExpExecArray | null;
  const re = new RegExp(REGISTRY_MARKER_RE.source, "g");
  while ((m = re.exec(markedHtml)) !== null) {
    markers.push({
      fullMatch: m[0],
      slug: m[1],
      artistSlug: m[2] || "",
      artistName: decodeURIComponent(m[3] || ""),
    });
  }

  if (!markers.length) {
    return { markedHtml, artists: [] };
  }

  const slugs = markers.map((mk) => mk.slug);
  const { data: artistRows } = await supabase
    .from("registry_artists")
    .select("slug, display_name, public_image_url, metadata")
    .eq("status", "active")
    .in("slug", slugs);

  if (!artistRows?.length) {
    let stripped = markedHtml;
    for (const mk of markers) {
      stripped = stripped.replace(mk.fullMatch, "");
    }
    return { markedHtml: stripped, artists: [] };
  }

  const artistsBySlug = new Map(artistRows.map((a) => [a.slug, a]));
  const newArtists: ArtistEmbedData[] = [];
  let resultHtml = markedHtml;

  for (const mk of markers) {
    const row = artistsBySlug.get(mk.slug);
    if (!row) {
      resultHtml = resultHtml.replace(mk.fullMatch, "");
      continue;
    }

    const meta = (row.metadata as Record<string, unknown>) || {};
    const genres = Array.isArray(meta.genres) ? (meta.genres as string[]) : [];
    const country = typeof meta.country === "string" ? meta.country : undefined;

    const artistData: ArtistEmbedData = {
      slug: row.slug,
      name: row.display_name || mk.artistName || mk.slug,
      imageUrl: row.public_image_url || undefined,
      genres,
      country,
      chartEntryCount: row.chart_entry_count || undefined,
      topChartPosition: row.top_chart_position || null,
      contextText: undefined,
    };

    const artistIdx = newArtists.length;
    const markerComment = `<!--${ARTIST_MARKER_PREFIX}${artistIdx}-->`;
    resultHtml = resultHtml.replace(mk.fullMatch, markerComment);
    newArtists.push(artistData);
  }

  return { markedHtml: resultHtml, artists: newArtists };
}

/* ------------------------------------------------------------------ */
/*  Artist Embed Card                                                  */
/* ------------------------------------------------------------------ */

export function ArtistEmbedCard({ artist }: { artist: ArtistEmbedData }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  const artistUrl = `/artists/${artist.slug}`;

  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden my-10">
      <div className="flex gap-4 p-4 md:p-5">
        {/* Artist Image */}
        <div className="relative w-[100px] h-[100px] md:w-[120px] md:h-[120px] shrink-0 rounded-xl overflow-hidden bg-[var(--wk-surface-raised)]">
          {artist.imageUrl ? (
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          ) : (
            <Ch19GradientImage slug={artist.slug} name={artist.name} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="text-[17px] md:text-[20px] font-black text-[var(--wk-text)] leading-tight truncate">
            {artist.name}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--wk-text-faint)] font-medium">
            {artist.country && <span>{artist.country}</span>}
            {artist.genres.length > 0 && (
              <>
                {artist.country && <span>·</span>}
                <span>{artist.genres.slice(0, 3).join(", ")}</span>
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--wk-text-faint)]">
            {artist.trackCount !== undefined && (
              <span>
                {artist.trackCount} {artist.trackCount === 1 ? "track" : "tracks"}
              </span>
            )}
            {artist.releaseCount !== undefined && (
              <>
                {artist.trackCount !== undefined && <span>·</span>}
                <span>
                  {artist.releaseCount} {artist.releaseCount === 1 ? "release" : "releases"}
                </span>
              </>
            )}
            {artist.chartEntryCount !== undefined && artist.chartEntryCount > 0 && (
              <>
                {(artist.trackCount !== undefined || artist.releaseCount !== undefined) && <span>·</span>}
                <span>
                  {artist.chartEntryCount} chart {artist.chartEntryCount === 1 ? "entry" : "entries"}
                </span>
              </>
            )}
            {artist.topChartPosition !== undefined && artist.topChartPosition !== null && (
              <>
                <span>·</span>
                <span className="inline-flex items-center rounded-full bg-[var(--wk-brand-soft)]/40 px-2 py-0.5 text-[var(--wk-brand)] font-bold">
                  #1 peak
                </span>
              </>
            )}
          </div>

          <div className="mt-3">
            <Link
              to={artistUrl}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-soft)] px-3.5 py-2 text-[12px] font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all whitespace-nowrap"
            >
              <i className="ri-external-link-line text-[13px]" />
              View artist
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy wrapper                                                    */
/* ------------------------------------------------------------------ */

export function ArticleArtistEmbeds({
  artists,
}: {
  artists: ArtistEmbedData[];
}) {
  if (artists.length === 0) return null;
  return (
    <>
      {artists.map((artist, i) => (
        <ArtistEmbedCard key={`artist-${i}`} artist={artist} />
      ))}
    </>
  );
}