import { supabase } from "@/lib/supabase";
import type { InquiryDraft } from "@/pages/admin/institute/inquiry-interface/types";

export type InstitutePlaylistDraftItem = {
  registry_track_id?: string;
  registry_release_id?: string;
  provider_key?: string;
  provider_track_id?: string;
  provider_url?: string;
  title?: string;
  artist_names?: string[];
  release_title?: string;
  artwork_url?: string;
  preview_url?: string;
  duration_ms?: number;
  isrc?: string;
  match_status?: "matched" | "external_only" | "missing_registry_track" | "needs_review" | "rejected" | "pending";
  match_confidence?: number;
  normalization_payload?: Record<string, unknown>;
  notes?: string;
};

export type InstitutePlaylistDraftLink = {
  playlistId: string;
  playlistSlug: string;
  workProductLinkId: string;
};

type PlaylistDraftRpcRow = {
  playlist_id: string;
  playlist_slug: string;
  work_product_link_id: string;
};

export async function createInstitutePlaylistDraft(
  inquiry: InquiryDraft,
  payload: {
    title: string;
    description: string;
    curatorLabel: string;
    items: InstitutePlaylistDraftItem[];
  },
): Promise<InstitutePlaylistDraftLink> {
  const { data, error } = await supabase.rpc("create_institute_playlist_draft", {
    p_inquiry_id: inquiry.id,
    p_title: payload.title,
    p_description: payload.description,
    p_curator_label: payload.curatorLabel,
    p_items: payload.items,
  });

  if (error) throw new Error(`Failed to create playlist draft: ${error.message}`);

  const row = Array.isArray(data) ? (data[0] as PlaylistDraftRpcRow | undefined) : undefined;
  if (!row?.playlist_id || !row?.playlist_slug || !row?.work_product_link_id) {
    throw new Error("Playlist draft was created but the RPC did not return the expected IDs.");
  }

  return {
    playlistId: row.playlist_id,
    playlistSlug: row.playlist_slug,
    workProductLinkId: row.work_product_link_id,
  };
}
