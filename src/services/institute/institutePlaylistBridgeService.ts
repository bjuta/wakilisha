import { supabase } from "@/lib/supabase";
import type { InquiryDraft } from "@/pages/admin/institute/inquiry-interface/types";

export type InstitutePlaylistDraftItem = {
  id?: string;
  position?: number;
  registry_track_id?: string | null;
  registry_release_id?: string | null;
  provider_key?: string | null;
  provider_track_id?: string | null;
  provider_url?: string | null;
  title?: string | null;
  artist_names?: string[];
  release_title?: string | null;
  artwork_url?: string | null;
  preview_url?: string | null;
  duration_ms?: number | null;
  isrc?: string | null;
  match_status?: "matched" | "external_only" | "missing_registry_track" | "needs_review" | "rejected" | "pending";
  match_confidence?: number | null;
  normalization_payload?: Record<string, unknown>;
  notes?: string | null;
};

export type InstitutePlaylistDraftLink = {
  playlistId: string;
  playlistSlug: string;
  workProductLinkId: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InstitutePlaylistDraft = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  curatorLabel: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: InstitutePlaylistDraftItem[];
};

type WorkProductLinkRow = {
  id: string;
  product_id: string;
  product_slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type PlaylistDraftRpcRow = {
  playlist_id: string;
  playlist_slug: string;
  work_product_link_id: string;
};

type PlaylistRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  curator_label: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type PlaylistItemRow = {
  id: string;
  position: number;
  registry_track_id: string | null;
  registry_release_id: string | null;
  provider_key: string | null;
  provider_track_id: string | null;
  provider_url: string | null;
  title: string | null;
  artist_names: string[] | null;
  release_title: string | null;
  artwork_url: string | null;
  preview_url: string | null;
  duration_ms: number | null;
  isrc: string | null;
  match_status: InstitutePlaylistDraftItem["match_status"];
  match_confidence: number | null;
  normalization_payload: Record<string, unknown> | null;
  notes: string | null;
};

function mapLink(row: WorkProductLinkRow): InstitutePlaylistDraftLink {
  return {
    playlistId: row.product_id,
    playlistSlug: row.product_slug,
    workProductLinkId: row.id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: PlaylistItemRow): InstitutePlaylistDraftItem {
  return {
    id: row.id,
    position: row.position,
    registry_track_id: row.registry_track_id,
    registry_release_id: row.registry_release_id,
    provider_key: row.provider_key,
    provider_track_id: row.provider_track_id,
    provider_url: row.provider_url,
    title: row.title,
    artist_names: row.artist_names ?? [],
    release_title: row.release_title,
    artwork_url: row.artwork_url,
    preview_url: row.preview_url,
    duration_ms: row.duration_ms,
    isrc: row.isrc,
    match_status: row.match_status,
    match_confidence: row.match_confidence,
    normalization_payload: row.normalization_payload ?? {},
    notes: row.notes,
  };
}

export async function fetchInstitutePlaylistDraftLink(inquiryId: string): Promise<InstitutePlaylistDraftLink | null> {
  const { data, error } = await supabase
    .from("institute_work_product_links")
    .select("id, product_id, product_slug, status, created_at, updated_at")
    .eq("inquiry_id", inquiryId)
    .eq("product_type", "playlist")
    .eq("format_label", "Playlist")
    .maybeSingle();

  if (error) throw error;
  return data ? mapLink(data as WorkProductLinkRow) : null;
}

export async function fetchInstitutePlaylistDraft(playlistId: string): Promise<InstitutePlaylistDraft | null> {
  const { data: playlist, error: playlistError } = await supabase
    .from("wk_playlists")
    .select("id, title, slug, description, curator_label, status, created_at, updated_at")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) return null;

  const { data: items, error: itemsError } = await supabase
    .from("wk_playlist_items")
    .select(`
      id,
      position,
      registry_track_id,
      registry_release_id,
      provider_key,
      provider_track_id,
      provider_url,
      title,
      artist_names,
      release_title,
      artwork_url,
      preview_url,
      duration_ms,
      isrc,
      match_status,
      match_confidence,
      normalization_payload,
      notes
    `)
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (itemsError) throw itemsError;

  const row = playlist as PlaylistRow;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    curatorLabel: row.curator_label,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: ((items ?? []) as PlaylistItemRow[]).map(mapItem),
  };
}

export async function updateInstitutePlaylistItem(
  itemId: string,
  payload: {
    title: string;
    artistNames: string[];
    providerUrl: string;
    notes: string;
  },
): Promise<InstitutePlaylistDraftItem> {
  const title = payload.title.trim();
  if (title.length < 1) {
    throw new Error("Track title is required.");
  }

  const artistNames = payload.artistNames
    .map((artist) => artist.trim())
    .filter(Boolean);

  if (artistNames.length < 1) {
    throw new Error("At least one artist name is required.");
  }

  const { data, error } = await supabase
    .from("wk_playlist_items")
    .update({
      title,
      artist_names: artistNames,
      provider_url: payload.providerUrl.trim() || null,
      notes: payload.notes.trim() || null,
    })
    .eq("id", itemId)
    .select(`
      id,
      position,
      registry_track_id,
      registry_release_id,
      provider_key,
      provider_track_id,
      provider_url,
      title,
      artist_names,
      release_title,
      artwork_url,
      preview_url,
      duration_ms,
      isrc,
      match_status,
      match_confidence,
      normalization_payload,
      notes
    `)
    .single();

  if (error) throw new Error(`Failed to update playlist item: ${error.message}`);

  return mapItem(data as PlaylistItemRow);
}

export async function addInstitutePlaylistItem(
  playlistId: string,
  payload: {
    title: string;
    artistNames: string[];
    providerKey: string;
    providerTrackId: string;
    providerUrl: string;
    notes: string;
  },
): Promise<InstitutePlaylistDraftItem> {
  const title = payload.title.trim();
  if (title.length < 1) throw new Error("Track title is required.");

  const artistNames = payload.artistNames
    .map((artist) => artist.trim())
    .filter(Boolean);

  if (artistNames.length < 1) throw new Error("At least one artist name is required.");

  const { data: latestItem, error: latestError } = await supabase
    .from("wk_playlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(`Failed to read playlist position: ${latestError.message}`);

  const nextPosition = ((latestItem?.position as number | undefined) ?? 0) + 1;
  const providerKey = payload.providerKey.trim().toLowerCase();

  const { data, error } = await supabase
    .from("wk_playlist_items")
    .insert({
      playlist_id: playlistId,
      position: nextPosition,
      title,
      artist_names: artistNames,
      provider_key: providerKey || null,
      provider_track_id: payload.providerTrackId.trim() || null,
      provider_url: payload.providerUrl.trim() || null,
      match_status: providerKey || payload.providerTrackId.trim() || payload.providerUrl.trim() ? "external_only" : "pending",
      notes: payload.notes.trim() || null,
    })
    .select(`
      id,
      position,
      registry_track_id,
      registry_release_id,
      provider_key,
      provider_track_id,
      provider_url,
      title,
      artist_names,
      release_title,
      artwork_url,
      preview_url,
      duration_ms,
      isrc,
      match_status,
      match_confidence,
      normalization_payload,
      notes
    `)
    .single();

  if (error) throw new Error(`Failed to add playlist item: ${error.message}`);

  return mapItem(data as PlaylistItemRow);
}

export async function deleteInstitutePlaylistItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("wk_playlist_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(`Failed to delete playlist item: ${error.message}`);
}

export async function moveInstitutePlaylistItem(
  playlistId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<InstitutePlaylistDraft> {
  const playlist = await fetchInstitutePlaylistDraft(playlistId);
  if (!playlist) throw new Error("Playlist draft could not be loaded.");

  const items = [...playlist.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const currentIndex = items.findIndex((item) => item.id === itemId);

  if (currentIndex < 0) throw new Error("Playlist item could not be found.");

  const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= items.length) return playlist;

  const current = items[currentIndex];
  const swap = items[swapIndex];

  if (!current.id || !swap.id || !current.position || !swap.position) {
    throw new Error("Playlist item positions are incomplete.");
  }

  const temporaryPosition = Math.max(...items.map((item) => item.position ?? 0), 0) + 1000;

  const { error: tempError } = await supabase
    .from("wk_playlist_items")
    .update({ position: temporaryPosition })
    .eq("id", current.id);

  if (tempError) throw new Error(`Failed to prepare playlist reorder: ${tempError.message}`);

  const { error: swapError } = await supabase
    .from("wk_playlist_items")
    .update({ position: current.position })
    .eq("id", swap.id);

  if (swapError) throw new Error(`Failed to reorder playlist item: ${swapError.message}`);

  const { error: finalError } = await supabase
    .from("wk_playlist_items")
    .update({ position: swap.position })
    .eq("id", current.id);

  if (finalError) throw new Error(`Failed to finish playlist reorder: ${finalError.message}`);

  const updated = await fetchInstitutePlaylistDraft(playlistId);
  if (!updated) throw new Error("Playlist was reordered but could not be reloaded.");

  return updated;
}

export async function submitInstitutePlaylistDraftForReview(playlistId: string): Promise<InstitutePlaylistDraft> {
  const { error } = await supabase
    .from("wk_playlists")
    .update({ status: "submitted_for_review" })
    .eq("id", playlistId);

  if (error) throw new Error(`Failed to submit playlist draft for review: ${error.message}`);

  const playlist = await fetchInstitutePlaylistDraft(playlistId);
  if (!playlist) throw new Error("Playlist draft was submitted but could not be reloaded.");

  return playlist;
}

export async function updateInstitutePlaylistDraftMetadata(
  playlistId: string,
  payload: {
    title: string;
    description: string;
    curatorLabel: string;
  },
): Promise<InstitutePlaylistDraft> {
  const title = payload.title.trim();
  if (title.length < 3) {
    throw new Error("Playlist title must be at least 3 characters.");
  }

  const { error } = await supabase
    .from("wk_playlists")
    .update({
      title,
      description: payload.description.trim(),
      curator_label: payload.curatorLabel.trim() || "WAKILISHA",
    })
    .eq("id", playlistId);

  if (error) throw new Error(`Failed to update playlist draft: ${error.message}`);

  const playlist = await fetchInstitutePlaylistDraft(playlistId);
  if (!playlist) throw new Error("Playlist draft was updated but could not be reloaded.");

  return playlist;
}

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
