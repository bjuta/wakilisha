import { WkIcon } from "@/components/design-system/Icon";

export interface ReleaseHeroData {
  title: string;
  slug: string;
  release_type: string | null;
  release_date: string | null;
  release_date_precision: string | null;
  artwork_url: string | null;
  status: string;
  artist_name: string;
  artist_slug: string;
  label_name: string;
  label_slug: string;
}

interface AdminReleaseHeroProps {
  release: ReleaseHeroData;
  trackCount: number;
  totalDurationMs: number;
  onToggleEdit: () => void;
  editOpen: boolean;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatDate(date: string | null, precision: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  if (precision === "year") return d.getFullYear().toString();
  if (precision === "month") return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function statusColor(status: string) {
  switch (status) {
    case "active": return "bg-green-100 text-green-800 border-green-200";
    case "draft": return "bg-amber-100 text-amber-800 border-amber-200";
    case "needs_review": return "bg-red-100 text-red-800 border-red-200";
    case "archived": return "bg-gray-100 text-gray-500 border-gray-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function releaseTypeLabel(t: string | null): string {
  if (!t) return "Release";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function AdminReleaseHero({ release, trackCount, totalDurationMs, onToggleEdit, editOpen }: AdminReleaseHeroProps) {
  const publicUrl = release.slug.includes('--')
    ? `/releases/${release.slug}`
    : `/releases/${release.artist_slug}--${release.slug}`;
  const artistUrl = `/admin/registry/artists/${release.artist_slug}`;
  const labelUrl = release.label_slug ? `/admin/registry/labels/${release.label_slug}` : "";
  const artworkFailed = false;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
      {/* Artwork background blur */}
      {release.artwork_url && (
        <div
          className="absolute inset-0 opacity-[0.08] scale-110"
          style={{
            backgroundImage: `url("${release.artwork_url}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) saturate(1.2)",
          }}
        />
      )}

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Artwork */}
          <div className="flex-shrink-0 w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-bg)]">
            {release.artwork_url && !artworkFailed ? (
              <img src={release.artwork_url} alt={release.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--wk-surface-raised)] to-[var(--wk-bg)]">
                <WkIcon name="Album" size={48} className="text-[var(--wk-text-faint)]" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Type badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3">
              <WkIcon name="Disc3" size={11} />
              {releaseTypeLabel(release.release_type)}
            </div>

            {/* Title */}
            <h1 className="text-[24px] md:text-[32px] font-black text-[var(--wk-text)] tracking-tight leading-tight">
              {release.title}
            </h1>

            {/* Artist + Label */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <a href={artistUrl} className="text-[15px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors">
                {release.artist_name}
              </a>
              {release.label_name && (
                <>
                  <span className="text-[var(--wk-text-faint)] text-[13px]">·</span>
                  {labelUrl ? (
                    <a href={labelUrl} className="text-[14px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors">
                      {release.label_name}
                    </a>
                  ) : (
                    <span className="text-[14px] font-semibold text-[var(--wk-text-muted)]">{release.label_name}</span>
                  )}
                </>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-[12px] font-semibold text-[var(--wk-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <WkIcon name="Calendar" size={12} />
                {formatDate(release.release_date, release.release_date_precision)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <WkIcon name="ListMusic" size={12} />
                {trackCount} tracks
              </span>
              {totalDurationMs > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <WkIcon name="Clock3" size={12} />
                  {formatDuration(totalDurationMs)}
                </span>
              )}
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusColor(release.status)}`}>
                {release.status.replace("_", " ")}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2 text-[13px] font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <WkIcon name="ExternalLink" size={14} />
                View Public Page
              </a>
              <button
                onClick={onToggleEdit}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2 text-[13px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <WkIcon name={editOpen ? "ChevronUp" : "Edit3"} size={14} />
                {editOpen ? "Close Editor" : "Edit Release"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}