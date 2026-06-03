import { useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface ArtistBioSectionProps {
  bio: string;
  fullBio: string;
  name: string;
  country: string;
  debutYear: number;
  trackCount: number;
  releaseCount: number;
  artistType?: string | null;
}

export function ArtistBioSection({
  bio,
  fullBio,
  name,
  country,
  debutYear,
  trackCount,
  releaseCount,
  artistType,
}: ArtistBioSectionProps) {
  const hasFullBio = fullBio && fullBio.length > bio.length;
  const [expanded, setExpanded] = useState(false);
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);

  const displayBio = expanded && fullBio ? fullBio : (bio || `${name} is an artist in the WAKILISHA registry.`);

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      {/* Bio text — clean, no sidebar, just the story */}
      <div className="text-[17px] leading-[1.72] text-[var(--wk-text-soft)]">
        {expanded && fullBio ? (
          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: fullBio }} />
        ) : (
          <p className="first-letter:text-[56px] first-letter:font-black first-letter:leading-[0.7] first-letter:text-[var(--wk-brand)] first-letter:float-left first-letter:mr-3 first-letter:mt-1">
            {bio || `${name} is an artist in the WAKILISHA registry.`}
          </p>
        )}

        {/* Inline meta line — subtle, not a card */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--wk-text-faint)]">
          {artistType && (
            <span className="flex items-center gap-1.5">
              <i className="ri-user-line text-[13px]" />
              {artistType}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <i className="ri-map-pin-line text-[13px]" />
            {country}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="ri-calendar-line text-[13px]" />
            Active since {debutYear}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="ri-music-2-line text-[13px]" />
            {trackCount} tracks, {releaseCount} releases
          </span>
        </div>

        {/* Expand toggle — minimal */}
        {hasFullBio && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-6 text-[13px] font-bold text-[var(--wk-brand)] transition-colors hover:text-[var(--wk-brand-hover)]"
          >
            {expanded ? "Show less" : "Read full bio"}
            {expanded ? (
              <i className="ri-arrow-up-s-line ml-1 align-middle" />
            ) : (
              <i className="ri-arrow-down-s-line ml-1 align-middle" />
            )}
          </button>
        )}
      </div>
    </section>
  );
}