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
  const { data, error } = await supabase.rpc("get_public_artist_relationships", {
    p_artist_id: artistId,
  });

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
