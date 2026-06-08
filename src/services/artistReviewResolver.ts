import { supabase } from "@/lib/supabase";

export type ArtistReviewDecision =
  | "approve_create"
  | "approve_match"
  | "mark_duplicate"
  | "split_collaboration"
  | "defer"
  | "reject";

export type ArtistReviewRow = {
  id: string;
  staging_record_id: string;
  source_record_id: string | null;
  source_slug: string | null;
  source_title: string | null;
  proposed_slug: string | null;
  source_status: string | null;
  source_post_type: string | null;
  wp_guid: string | null;
  candidate_count: number | null;
  mapping_candidate_ids: string[] | null;
  warnings: string[] | null;
  errors: string[] | null;
  raw_record: Record<string, unknown> | null;
  mapped_record: Record<string, unknown> | null;
  decision: ArtistReviewDecision | null;
  target_artist_id: string | null;
  target_artist_slug: string | null;
  decision_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RegistryArtistCandidate = {
  id: string;
  slug: string | null;
  display_name: string | null;
  normalized_name: string | null;
  status: string | null;
  public_image_url: string | null;
};



export type ArtistSplitRelationshipPreviewRow = {
  preview_id: string;
  staging_record_id: string;
  composite_source_title: string | null;
  source_record_id: string | null;
  composite_slug: string | null;
  artist_a_id: string | null;
  artist_a_slug: string | null;
  artist_a_name: string | null;
  artist_b_id: string | null;
  artist_b_slug: string | null;
  artist_b_name: string | null;
  relationship_type: string | null;
  source_kind: string | null;
  readiness: string | null;
};

export type ArtistSplitPromotionPreviewRow = {
  id: string;
  staging_record_id: string;
  composite_source_title: string | null;
  source_record_id: string | null;
  composite_slug: string | null;
  member_order: number | null;
  display_name: string | null;
  proposed_slug: string | null;
  action: "create" | "match" | "defer" | null;
  target_artist_id: string | null;
  target_artist_slug: string | null;
  existing_artist_id: string | null;
  existing_artist_slug: string | null;
  existing_display_name: string | null;
  existing_status: string | null;
  promotion_readiness: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SplitMemberDraft = {
  member_order: number;
  display_name: string;
  proposed_slug: string;
  action: "create" | "match" | "defer";
  target_artist_id?: string | null;
  target_artist_slug?: string | null;
  notes?: string | null;
};

export async function loadArtistReviewQueue(filter: "all" | "undecided" | "decided" | "composite" = "undecided") {
  let query = supabase
    .from("artist_review_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter === "undecided") query = query.is("decision", null);
  if (filter === "decided") query = query.not("decision", "is", null);

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as ArtistReviewRow[];

  if (filter === "composite") {
    rows = rows.filter((row) => splitArtistTitle(row.source_title || "").length > 1);
  }

  return rows;
}

export async function searchRegistryArtists(term: string) {
  const q = term.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("registry_artists")
    .select("id, slug, display_name, normalized_name, status, public_image_url")
    .or(`display_name.ilike.%${q}%,slug.ilike.%${q}%,normalized_name.ilike.%${q.toLowerCase()}%`)
    .order("display_name", { ascending: true })
    .limit(10);

  if (error) throw error;
  return (data ?? []) as RegistryArtistCandidate[];
}

export async function saveArtistReviewDecision(input: {
  staging_record_id: string;
  decision: ArtistReviewDecision;
  target_artist_id?: string | null;
  target_artist_slug?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("artist_review_decisions")
    .upsert(
      {
        staging_record_id: input.staging_record_id,
        decision: input.decision,
        target_artist_id: input.target_artist_id ?? null,
        target_artist_slug: input.target_artist_slug ?? null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staging_record_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadArtistSplitRelationshipPreview() {
  const { data, error } = await supabase
    .from("artist_split_relationship_preview")
    .select("*")
    .order("composite_source_title", { ascending: true })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as ArtistSplitRelationshipPreviewRow[];
}

export async function loadArtistSplitPromotionPreview() {
  const { data, error } = await supabase
    .from("artist_split_promotion_preview")
    .select("*")
    .order("created_at", { ascending: false })
    .order("member_order", { ascending: true })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as ArtistSplitPromotionPreviewRow[];
}

export async function updateSplitMemberAction(input: {
  id: string;
  action: "create" | "match" | "defer";
  target_artist_id?: string | null;
  target_artist_slug?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("artist_review_split_members")
    .update({
      action: input.action,
      target_artist_id: input.target_artist_id ?? null,
      target_artist_slug: input.target_artist_slug ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function linkExistingSplitMember(row: ArtistSplitPromotionPreviewRow) {
  if (!row.existing_artist_id || !row.existing_artist_slug) {
    throw new Error("No existing artist match is available for this member.");
  }

  return updateSplitMemberAction({
    id: row.id,
    action: "match",
    target_artist_id: row.existing_artist_id,
    target_artist_slug: row.existing_artist_slug,
    notes: row.notes,
  });
}

export function slugifyArtistName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitArtistTitle(title: string): SplitMemberDraft[] {
  const clean = title.trim();
  if (!clean) return [];

  const normalized = clean
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+/gi, ",")
    .replace(/\s+x\s+/gi, ",")
    .replace(/\s+&\s+/g, ",")
    .replace(/\s+and\s+/gi, ",");

  return normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((display_name, index) => ({
      member_order: index + 1,
      display_name,
      proposed_slug: slugifyArtistName(display_name),
      action: "create" as const,
    }));
}

export async function saveArtistCollaborationSplit(input: {
  staging_record_id: string;
  members: SplitMemberDraft[];
  notes?: string | null;
}) {
  if (input.members.length < 2) {
    throw new Error("A collaboration split needs at least two members.");
  }

  const { error: deleteError } = await supabase
    .from("artist_review_split_members")
    .delete()
    .eq("staging_record_id", input.staging_record_id);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("artist_review_split_members")
    .insert(
      input.members.map((member) => ({
        staging_record_id: input.staging_record_id,
        member_order: member.member_order,
        display_name: member.display_name,
        proposed_slug: member.proposed_slug,
        action: member.action,
        target_artist_id: member.target_artist_id ?? null,
        target_artist_slug: member.target_artist_slug ?? null,
        notes: member.notes ?? null,
      })),
    );

  if (insertError) throw insertError;

  return saveArtistReviewDecision({
    staging_record_id: input.staging_record_id,
    decision: "split_collaboration",
    target_artist_slug: input.members.map((member) => member.proposed_slug).join("+"),
    notes: input.notes || "Split composite artist into individual collaboration members.",
  });
}


export async function promoteArtistSplitRelationship(staging_record_id: string) {
  const { data, error } = await supabase.rpc("promote_artist_split_relationship", {
    p_staging_record_id: staging_record_id,
  });

  if (error) throw error;
  return data as {
    ok: boolean;
    staging_record_id: string;
    inserted_relationships: number;
  };
}
