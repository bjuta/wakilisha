import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { ResolvedRelation } from "@/hooks/useRelatedEntities";

interface AdminReleaseSidebarProps {
  releaseId: string;
  slug: string;
  normalizedTitle: string;
  upc: string | null;
  createdAt: string;
  updatedAt: string;
  labelName: string;
  labelSlug: string;
  labelId: string | null;
  metadata: Record<string, unknown> | null;
  relations: ResolvedRelation[];
  relLoading: boolean;
  onDelete: () => void;
}

const ENTITY_LABELS: Record<string, string> = {
  artist: "Artists",
  track: "Tracks",
  release: "Releases",
  genre: "Genres",
  label: "Labels",
};

const ENTITY_ICONS: Record<string, string> = {
  artist: "UserVoice",
  track: "Music",
  release: "Album",
  genre: "PriceTag3",
  label: "Building",
};

export default function AdminReleaseSidebar({
  releaseId,
  slug,
  normalizedTitle,
  upc,
  createdAt,
  updatedAt,
  labelName,
  labelSlug,
  labelId,
  metadata,
  relations,
  relLoading,
  onDelete,
}: AdminReleaseSidebarProps) {
  const navigate = useNavigate();

  const groupedRelations: Record<string, ResolvedRelation[]> = {};
  for (const r of relations) {
    if (!groupedRelations[r.entity_type]) groupedRelations[r.entity_type] = [];
    groupedRelations[r.entity_type].push(r);
  }
  const relTypes = Object.keys(groupedRelations);

  const labelUrl = labelSlug ? `/admin/registry/labels/${labelSlug}` : "";

  return (
    <div className="space-y-4">
      {/* Label info */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3 flex items-center gap-1.5">
          <WkIcon name="Building2" size={12} />
          Label
        </h3>
        {labelName ? (
          <div>
            <div className="text-[15px] font-extrabold text-[var(--wk-text)]">
              {labelUrl ? (
                <a href={labelUrl} className="hover:text-[var(--wk-brand)] transition-colors">
                  {labelName}
                </a>
              ) : (
                labelName
              )}
            </div>
            {labelId && (
              <div className="mt-1 text-[10px] font-mono text-[var(--wk-text-faint)] truncate" title={labelId}>
                {labelId.slice(0, 8)}&hellip;
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--wk-text-faint)] italic">No label assigned</p>
        )}
      </WkSurface>

      {/* Metadata from provider */}
      {metadata && Object.keys(metadata).length > 0 && (
        <WkSurface className="p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3 flex items-center gap-1.5">
            <WkIcon name="Database" size={12} />
            Provider Metadata
          </h3>
          <div className="space-y-2">
            {metadata.provider && (
              <InfoRow label="Source" value={String(metadata.provider)} />
            )}
            {metadata.provider_url && (
              <InfoRow label="Provider URL" value={String(metadata.provider_url)} mono link />
            )}
            {metadata.apple_music_genres && Array.isArray(metadata.apple_music_genres) && (metadata.apple_music_genres as string[]).length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-[var(--wk-text-faint)] block mb-1">Genres</span>
                <div className="flex flex-wrap gap-1">
                  {(metadata.apple_music_genres as string[]).map((g) => (
                    <span key={g} className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {metadata.artist_name && (
              <InfoRow label="Provider Artist" value={String(metadata.artist_name)} />
            )}
          </div>
        </WkSurface>
      )}

      {/* Record info */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3 flex items-center gap-1.5">
          <WkIcon name="Info" size={12} />
          Record Info
        </h3>
        <div className="space-y-2">
          <InfoRow label="ID" value={releaseId.slice(0, 12) + "\u2026"} mono />
          <InfoRow label="Slug" value={slug} mono />
          <InfoRow label="Normalized" value={normalizedTitle} />
          {upc && <InfoRow label="UPC" value={upc} mono />}
          <InfoRow label="Created" value={new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
          <InfoRow label="Modified" value={new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
        </div>
      </WkSurface>

      {/* Related entities */}
      <WkSurface className="p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3 flex items-center gap-1.5">
          <WkIcon name="GitBranch" size={12} />
          Related
        </h3>
        {relLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-5 w-full rounded bg-[var(--wk-surface-raised)]" />
            <div className="h-5 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
          </div>
        ) : relTypes.length === 0 ? (
          <p className="text-[11px] text-[var(--wk-text-faint)] italic">No linked entities yet.</p>
        ) : (
          <div className="space-y-3">
            {relTypes.map((type) => {
              const items = groupedRelations[type];
              const label = ENTITY_LABELS[type] || type;
              const icon = ENTITY_ICONS[type] || "Link";
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <WkIcon name={icon} size={11} className="text-[var(--wk-text-faint)]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{label}</span>
                    <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold bg-[var(--wk-bg)] text-[var(--wk-text-faint)]">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 8).map((rel, i) => (
                      <button
                        key={`${rel.entity_type}-${rel.slug}-${i}`}
                        onClick={() => navigate(`/admin/registry/${rel.entity_type}s/${rel.slug}`)}
                        className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--wk-text)] hover:bg-[var(--wk-bg)] transition-colors group cursor-pointer"
                      >
                        <span className="truncate flex-1 font-medium group-hover:text-[var(--wk-brand)] transition-colors">
                          {rel.display_name}
                        </span>
                        <span className="text-[10px] text-[var(--wk-text-faint)] shrink-0 uppercase font-mono tracking-tight">
                          {rel.relationship_type.replace(/_/g, " ")}
                        </span>
                      </button>
                    ))}
                    {items.length > 8 && (
                      <p className="text-[10px] text-[var(--wk-text-faint)] px-2">+{items.length - 8} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WkSurface>

      {/* Danger zone */}
      <WkSurface className="p-4 border-red-200">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-600 mb-2 flex items-center gap-1.5">
          <WkIcon name="AlertTriangle" size={12} />
          Danger Zone
        </h3>
        <button
          onClick={onDelete}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-600 hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer"
        >
          <WkIcon name="Trash2" size={13} />
          Archive Release
        </button>
      </WkSurface>
    </div>
  );
}

function InfoRow({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-semibold text-[var(--wk-text-faint)] shrink-0">{label}</span>
      {link ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-right text-[11px] text-[var(--wk-brand)] hover:underline truncate max-w-[170px] ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {value.length > 40 ? value.slice(0, 40) + "\u2026" : value}
          <WkIcon name="ExternalLink" size={9} className="inline ml-1" />
        </a>
      ) : (
        <span
          className={`text-right text-[11px] text-[var(--wk-text-soft)] truncate max-w-[170px] ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {value}
        </span>
      )}
    </div>
  );
}