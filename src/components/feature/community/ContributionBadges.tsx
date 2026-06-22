import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEntityContributions } from "@/services/community";
import type { CommunityContribution } from "@/services/community";

// ── Contribution type display config ────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  correction: { icon: "ri-edit-line", label: "Correction" },
  missing_credit: { icon: "ri-user-add-line", label: "Credit" },
  genre_fix: { icon: "ri-price-tag-3-line", label: "Genre" },
  bio_correction: { icon: "ri-file-text-line", label: "Bio" },
  lyrics_correction: { icon: "ri-music-2-line", label: "Lyrics" },
  other: { icon: "ri-more-line", label: "Update" },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface ContributionBadgesProps {
  entityType: string;
  entitySlug?: string;
  entityId?: string;
  limit?: number;
}

type ContributionWithMeta = CommunityContribution & {
  contributorName?: string;
  contributorUsername?: string;
};

// ── Component ──────────────────────────────────────────────────────────────

export function ContributionBadges({
  entityType,
  entitySlug,
  entityId,
  limit = 4,
}: ContributionBadgesProps) {
  const [contributions, setContributions] = useState<ContributionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getEntityContributions(entityType, entitySlug, entityId)
      .then((data) => {
        if (!alive) return;
        setContributions((data || []) as ContributionWithMeta[]);
      })
      .catch(() => {
        if (!alive) setContributions([]);
      })
      .finally(() => {
        if (!alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [entityType, entitySlug, entityId]);

  if (loading || contributions.length === 0) return null;

  const visible = contributions.slice(0, limit);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-muted)] whitespace-nowrap">
        Community contributions
      </span>
      {visible.map((c) => {
        const config = TYPE_CONFIG[c.contributionType] || TYPE_CONFIG.other;
        return (
          <Link
            key={c.id}
            to={c.contributorUsername ? `/u/${c.contributorUsername}` : "#"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-all hover:scale-[1.03] whitespace-nowrap ${
              c.status === "merged"
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] border-[var(--wk-brand)]/20"
                : "bg-[var(--wk-surface)] text-[var(--wk-text-muted)] border-[var(--wk-border-2)]"
            }`}
            title={`${config.label} by ${c.contributorName || "Contributor"}`}
          >
            <i className={`${config.icon} text-[10px]`} />
            <span>{config.label}</span>
            <span className="text-[var(--wk-text-faint)]">by</span>
            <span className="text-[var(--wk-text)]">{c.contributorName || "Contributor"}</span>
            {c.status === "merged" && (
              <i className="ri-check-line text-[9px] text-[var(--wk-brand)]" />
            )}
          </Link>
        );
      })}
      {contributions.length > limit && (
        <span className="text-[10px] font-semibold text-[var(--wk-text-faint)]">
          +{contributions.length - limit} more
        </span>
      )}
    </div>
  );
}