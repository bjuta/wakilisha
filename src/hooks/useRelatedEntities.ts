import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─── */

export interface ResolvedRelation {
  entity_type: string;
  slug: string;
  display_name: string;
  relationship_type: string;
  direction: "outgoing" | "incoming";
}

interface RawRelation {
  source_entity_type: string;
  source_slug: string;
  target_entity_type: string;
  target_slug: string;
  relationship_type: string;
}

const REGISTRY_TYPES = ["artist", "track", "release", "genre", "label"] as const;

const TABLE_MAP: Record<string, { table: string; name_col: string }> = {
  artist: { table: "registry_artists", name_col: "display_name" },
  track: { table: "registry_tracks", name_col: "title" },
  release: { table: "registry_releases", name_col: "title" },
  genre: { table: "registry_genres", name_col: "name" },
  label: { table: "registry_labels", name_col: "name" },
};

/* ─── Hook ─── */

export function useRelatedEntities(entityType: string, slug: string | undefined) {
  const [relations, setRelations] = useState<ResolvedRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !entityType) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      /* 1. Fetch raw relationships */
      const { data: raw, error: relErr } = await supabase
        .from("registry_entity_relationships")
        .select("source_entity_type, source_slug, target_entity_type, target_slug, relationship_type")
        .or(`source_slug.eq.${slug},target_slug.eq.${slug}`)
        .limit(200);

      if (relErr) {
        if (!cancelled) {
          setError(relErr.message);
          setLoading(false);
        }
        return;
      }

      if (!raw || raw.length === 0) {
        if (!cancelled) {
          setRelations([]);
          setLoading(false);
        }
        return;
      }

      /* 2. Split into outgoing/incoming and group slugs by entity type */
      const slugsByType: Record<string, Set<string>> = {};
      const built: ResolvedRelation[] = [];

      for (const r of raw) {
        const isOutgoing = r.source_slug === slug && r.source_entity_type === entityType;
        const otherType = isOutgoing ? r.target_entity_type : r.source_entity_type;
        const otherSlug = isOutgoing ? r.target_slug : r.source_slug;

        if (!REGISTRY_TYPES.includes(otherType as typeof REGISTRY_TYPES[number])) continue;

        if (!slugsByType[otherType]) slugsByType[otherType] = new Set();
        slugsByType[otherType].add(otherSlug);

        built.push({
          entity_type: otherType,
          slug: otherSlug,
          display_name: otherSlug,
          relationship_type: r.relationship_type,
          direction: isOutgoing ? "outgoing" : "incoming",
        });
      }

      /* 3. Resolve display names by batch-querying each entity table */
      const nameMap = new Map<string, string>();

      for (const [type, slugSet] of Object.entries(slugsByType)) {
        const tableInfo = TABLE_MAP[type];
        if (!tableInfo) continue;

        const slugList = Array.from(slugSet);
        const { data: rows, error: nameErr } = await supabase
          .from(tableInfo.table)
          .select(`slug, ${tableInfo.name_col}`)
          .in("slug", slugList)
          .limit(200);

        if (nameErr || !rows) continue;

        for (const row of rows) {
          const rowSlug = row.slug as string;
          const displayName = (row as Record<string, unknown>)[tableInfo.name_col] as string;
          if (displayName) nameMap.set(`${type}:${rowSlug}`, displayName);
        }
      }

      /* 4. Attach resolved names */
      for (const rel of built) {
        const key = `${rel.entity_type}:${rel.slug}`;
        const name = nameMap.get(key);
        if (name) rel.display_name = name;
      }

      if (!cancelled) {
        setRelations(built);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [entityType, slug]);

  return { relations, loading, error };
}