import { supabase } from "@/lib/supabase";

export interface PublicArtistRelationship {
  relationshipId: string;
  direction: "incoming" | "outgoing";
  relatedEntityId: string;
  relatedEntityType: "artist" | "track";
  relatedEntityName: string;
  relatedEntitySlug: string;
  relatedEntityImageUrl: string | null;
  relatedEntityUrl: string | null;
  relationshipType: string;
  relationshipRole: string | null;
  plainReason: string;
  evidenceCount: number;
}

interface PublicArtistRelationshipRow {
  relationship_id: string;
  direction: "incoming" | "outgoing";
  related_entity_id: string;
  related_entity_type: "artist" | "track";
  related_entity_name: string;
  related_entity_slug: string;
  related_entity_image_url: string | null;
  related_entity_url: string | null;
  relationship_type: string;
  relationship_role: string | null;
  plain_reason: string;
  evidence_count: number;
}

export async function getPublicArtistRelationships(artistId: string): Promise<PublicArtistRelationship[]> {
  const { data, error } = await supabase
    .from("registry_public_artist_relationships")
    .select("relationship_id,direction,related_entity_id,related_entity_type,related_entity_name,related_entity_slug,related_entity_image_url,related_entity_url,relationship_type,relationship_role,plain_reason,evidence_count")
    .eq("artist_id", artistId)
    .order("reviewed_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as PublicArtistRelationshipRow[]).map((row) => ({
    relationshipId: row.relationship_id,
    direction: row.direction,
    relatedEntityId: row.related_entity_id,
    relatedEntityType: row.related_entity_type,
    relatedEntityName: row.related_entity_name,
    relatedEntitySlug: row.related_entity_slug,
    relatedEntityImageUrl: row.related_entity_image_url,
    relatedEntityUrl: row.related_entity_url,
    relationshipType: row.relationship_type,
    relationshipRole: row.relationship_role,
    plainReason: row.plain_reason,
    evidenceCount: row.evidence_count,
  }));
}
