import { supabase } from "@/lib/supabase";

export type LivingMemoryEditorial = {
  entityType: "artist" | "release" | "track";
  entityId: string;
  entitySlug: string;
  editorialOpener: string;
  publicPrompt: string;
  editorialLabel: string;
  status: "published";
  updatedAt: string | null;
};

export async function getPublicLivingMemory(params: {
  entityType: "artist" | "release" | "track";
  entityId?: string | null;
  entitySlug?: string | null;
}): Promise<LivingMemoryEditorial | null> {
  const entityId = params.entityId?.trim() || null;
  const entitySlug = params.entitySlug?.trim() || null;

  if (!entityId && !entitySlug) return null;

  const { data, error } = await supabase.rpc("get_public_living_memory", {
    p_entity_type: params.entityType,
    p_entity_id: entityId,
    p_entity_slug: entitySlug,
  });

  if (error) {
    console.error("Could not load Living Memory editorial", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    entityType: row.entity_type,
    entityId: String(row.entity_id || ""),
    entitySlug: String(row.entity_slug || ""),
    editorialOpener: String(row.editorial_opener || ""),
    publicPrompt: String(row.public_prompt || ""),
    editorialLabel: String(row.editorial_label || ""),
    status: "published",
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}
