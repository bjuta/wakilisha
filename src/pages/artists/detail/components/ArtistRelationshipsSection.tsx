import { Link } from "react-router-dom";
import type { PublicArtistRelationship } from "@/services/publicArtistRelationships";

function relationshipLabel(value: string) {
  return value.replace(/_/g, " ");
}

function RelationshipIdentity({ relationship }: { relationship: PublicArtistRelationship }) {
  const content = (
    <div className="flex items-center gap-3">
      {relationship.relatedEntityImageUrl ? (
        <img
          src={relationship.relatedEntityImageUrl}
          alt=""
          className="h-12 w-12 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
          <i className={relationship.relatedEntityType === "artist" ? "ri-user-line" : "ri-music-2-line"} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[15px] font-black text-[var(--wk-text)]">{relationship.relatedEntityName}</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
          {relationshipLabel(relationship.relationshipRole || relationship.relationshipType)}
        </p>
      </div>
    </div>
  );

  return relationship.relatedEntityUrl ? <Link to={relationship.relatedEntityUrl}>{content}</Link> : content;
}

export function ArtistRelationshipsSection({
  artistName,
  relationships,
}: {
  artistName: string;
  relationships: PublicArtistRelationship[];
}) {
  if (relationships.length === 0) return null;

  return (
    <section aria-labelledby="artist-relationships-title">
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">Connected Through The Music</p>
        <h2 id="artist-relationships-title" className="wk-h-section">How {artistName} connects</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--wk-text-muted)]">
          Reviewed links from the WAKILISHA knowledge layer, shown only when the relationship has supporting evidence.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {relationships.map((relationship) => (
          <article key={`${relationship.relationshipId}-${relationship.direction}`} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
            <RelationshipIdentity relationship={relationship} />
            <p className="mt-4 text-[14px] leading-6 text-[var(--wk-text-soft)]">{relationship.plainReason}</p>
            <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
              <i className="ri-shield-check-line" aria-hidden="true" />
              <span>{relationship.evidenceCount} {relationship.evidenceCount === 1 ? "source" : "sources"} reviewed</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
