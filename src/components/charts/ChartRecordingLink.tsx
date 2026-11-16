import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router-dom";
import { trackUrl } from "@/utils/trackUrl";

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChartRecordingLinkProps = {
  registryTrackId?: string | null;
  slug: string;
  artistSlugs: string[];
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  inline?: boolean;
};

/**
 * Only an accepted canonical Registry Track may carry a Registry Track link.
 * Source-scoped Chart identities are still visible, but cannot be promoted
 * into a made-up public /tracks route by a slug or entry-ID fallback.
 */
export function ChartRecordingLink({
  registryTrackId,
  slug,
  artistSlugs,
  children,
  className,
  onClick,
  inline = false,
}: ChartRecordingLinkProps) {
  if (
    typeof registryTrackId === "string" &&
    CANONICAL_UUID.test(registryTrackId) &&
    typeof slug === "string" &&
    slug.trim().length > 0
  ) {
    return (
      <Link to={trackUrl(slug, artistSlugs)} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  if (inline) {
    return (
      <span className={className} onClick={onClick}>
        {children}
      </span>
    );
  }

  return (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  );
}
