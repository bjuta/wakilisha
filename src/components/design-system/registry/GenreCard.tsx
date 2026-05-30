import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";

export interface GenreCardProps {
  slug: string;
  name: string;
  artistCount?: number;
  trackCount?: number;
  accentVar?: string;
  representativeArtists?: string[];
}

export function GenreCard({
  slug,
  name,
  artistCount,
  trackCount,
  accentVar = "--wk-v-music",
  representativeArtists = [],
}: GenreCardProps) {
  return (
    <Link
      to={`/genres/${slug}`}
      className="group relative block overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)]"
    >
      <div
        className="absolute right-0 top-0 h-24 w-24 rounded-bl-full opacity-10 transition-opacity group-hover:opacity-15"
        style={{ background: `var(${accentVar})` }}
      />
      <div
        className="mb-1 text-xs font-bold uppercase tracking-widest"
        style={{ color: `var(${accentVar})` }}
      >
        Genre
      </div>
      <h3 className="text-[16px] font-black tracking-tight text-[var(--wk-text)]">{name}</h3>
      <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
        {artistCount !== undefined && <span>{artistCount} artists</span>}
        {trackCount !== undefined && <span>{trackCount} tracks</span>}
      </div>
      {representativeArtists.length > 0 && (
        <div className="mt-3 text-[11px] text-[var(--wk-text-faint)]">
          {representativeArtists.slice(0, 3).join(", ")}
        </div>
      )}
    </Link>
  );
}