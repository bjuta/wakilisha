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

export type InstitutePlaylistReviewStatus =
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved_for_promotion"
  | "accepted_for_internal_memory"
  | "rejected"
  | "withdrawn";

export type InstitutePlaylistReviewState = {
  packetId: string;
  packetVersion: number;
  status: InstitutePlaylistReviewStatus;
  submittedAt: string;
  reviewedAt: string | null;
  editorDecision: string | null;
  editorNotes: string | null;
  contributorNote: string | null;
};

export type InstitutePlaylistReviewSubmission = InstitutePlaylistReviewState & {
  alreadySubmitted?: boolean;
};

type ReviewPacketForPlaylistRow = {
  id: string;
  packet_version: number;
  status: InstitutePlaylistReviewStatus;
  submitted_at: string;
  reviewed_at: string | null;
  editor_decision: string | null;
  editor_notes: string | null;
  contributor_note: string | null;
  snapshot_json: {
    workProduct?: {
      linkId?: string;
      productSlug?: string;
    };
  } | null;
};

function mapPlaylistReviewState(row: ReviewPacketForPlaylistRow): InstitutePlaylistReviewState {
  return {
    packetId: row.id,
    packetVersion: row.packet_version,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    editorDecision: row.editor_decision,
    editorNotes: row.editor_notes,
    contributorNote: row.contributor_note,
  };
}

function playlistReviewPacketMatchesLink(row: ReviewPacketForPlaylistRow, link: InstitutePlaylistDraftLink) {
  const workProduct = row.snapshot_json?.workProduct;
  return workProduct?.linkId === link.workProductLinkId || workProduct?.productSlug === link.playlistSlug;
}

async function fetchLatestPlaylistReviewRowsForInquiry(inquiryId: string): Promise<ReviewPacketForPlaylistRow[]> {
  const { data, error } = await supabase
    .from("institute_review_packets")
    .select(`
      id,
      packet_version,
      status,
      submitted_at,
      reviewed_at,
      editor_decision,
      editor_notes,
      contributor_note,
      snapshot_json
    `)
    .eq("inquiry_id", inquiryId)
    .order("packet_version", { ascending: false })
    .limit(25);

  if (error) throw error;
  return (data ?? []) as ReviewPacketForPlaylistRow[];
}

export async function fetchInstitutePlaylistReviewState(
  inquiry: InquiryDraft,
  link: InstitutePlaylistDraftLink,
): Promise<InstitutePlaylistReviewState | null> {
  const rows = await fetchLatestPlaylistReviewRowsForInquiry(inquiry.id);
  const latestForLink = rows.find((row) => playlistReviewPacketMatchesLink(row, link));
  return latestForLink ? mapPlaylistReviewState(latestForLink) : null;
}

export async function fetchInstitutePlaylistReviewHistory(
  inquiry: InquiryDraft,
  link: InstitutePlaylistDraftLink,
): Promise<InstitutePlaylistReviewState[]> {
  const rows = await fetchLatestPlaylistReviewRowsForInquiry(inquiry.id);

  return rows
    .filter((row) => playlistReviewPacketMatchesLink(row, link))
    .map(mapPlaylistReviewState)
    .sort((first, second) => first.packetVersion - second.packetVersion);
}

export async function submitInstitutePlaylistDraftForReview(
  inquiry: InquiryDraft,
  link: InstitutePlaylistDraftLink,
  playlist: InstitutePlaylistDraft,
): Promise<InstitutePlaylistReviewSubmission> {
  if (playlist.status === "published" || link.status === "published") {
    throw new Error("This linked playlist has already been published. Start a new Inquiry for major follow-up work.");
  }

  const rows = await fetchLatestPlaylistReviewRowsForInquiry(inquiry.id);
  const latestVersion = rows.length ? Number(rows[0].packet_version) || 0 : 0;
  const latestForLink = rows.find((row) => playlistReviewPacketMatchesLink(row, link));

  if (latestForLink) {
    if (latestForLink.status === "submitted" || latestForLink.status === "under_review") {
      return {
        ...mapPlaylistReviewState(latestForLink),
        alreadySubmitted: true,
      };
    }

    if (latestForLink.status === "approved_for_promotion" || latestForLink.status === "accepted_for_internal_memory") {
      throw new Error("This playlist has already been accepted by review. Editors control the next step.");
    }

    if (latestForLink.status === "rejected") {
      throw new Error("This review packet was rejected. Start a new Inquiry if the playlist needs to be rebuilt.");
    }
  }

  const snapshot = {
    reviewPacketVersion: 1,
    packetKind: latestForLink?.status === "changes_requested" ? "linked_playlist_draft_resubmission" : "linked_playlist_draft_review",
    capturedAt: new Date().toISOString(),
    editorialInstruction:
      latestForLink?.status === "changes_requested"
        ? "Contributor resubmitted a linked Institute playlist draft after editor-requested changes. This is not a publishing action."
        : "Contributor submitted a linked Institute playlist draft for editorial review. This is not a publishing action.",
    inquiry: {
      id: inquiry.id,
      code: inquiry.code,
      rawQuestion: inquiry.rawQuestion,
      workingQuestion: inquiry.workingQuestion,
      status: inquiry.status,
      anchor: inquiry.anchor,
      setup: inquiry.setup,
    },
    workProduct: {
      linkId: link.workProductLinkId,
      productType: "playlist",
      formatLabel: "Playlist",
      productId: playlist.id,
      productSlug: playlist.slug,
      status: "submitted_for_review",
      previousReviewStatus: latestForLink?.status ?? null,
      previousReviewPacketId: latestForLink?.id ?? null,
    },
    playlistDraft: {
      id: playlist.id,
      slug: playlist.slug,
      title: playlist.title,
      description: playlist.description,
      curatorLabel: playlist.curatorLabel,
      status: playlist.status,
      itemCount: playlist.items.length,
      items: playlist.items.map((item) => ({
        id: item.id,
        position: item.position,
        registryTrackId: item.registry_track_id,
        registryReleaseId: item.registry_release_id,
        providerKey: item.provider_key,
        providerTrackId: item.provider_track_id,
        providerUrl: item.provider_url,
        title: item.title,
        artistNames: item.artist_names ?? [],
        releaseTitle: item.release_title,
        artworkUrl: item.artwork_url,
        previewUrl: item.preview_url,
        durationMs: item.duration_ms,
        isrc: item.isrc,
        matchStatus: item.match_status,
        matchConfidence: item.match_confidence,
        normalizationPayload: item.normalization_payload ?? {},
        notes: item.notes,
      })),
    },
    governance: {
      contributorCanPublish: false,
      editorMustReviewBeforePublication: true,
      publicReleaseAllowedFromInstitute: false,
    },
  };

  const { data, error } = await supabase
    .from("institute_review_packets")
    .insert({
      inquiry_id: inquiry.id,
      packet_version: latestVersion + 1,
      status: "submitted",
      contributor_note:
        latestForLink?.status === "changes_requested"
          ? `Linked playlist draft resubmitted after requested changes: ${playlist.slug}`
          : `Linked playlist draft submitted for review: ${playlist.slug}`,
      snapshot_json: snapshot,
    })
    .select("id, packet_version, status, submitted_at, reviewed_at, editor_decision, editor_notes, contributor_note")
    .single();

  if (error) throw error;

  await supabase
    .from("wk_playlists")
    .update({ status: "submitted_for_review" })
    .eq("id", playlist.id);

  await supabase
    .from("institute_work_product_links")
    .update({
      status: "submitted_for_review",
      metadata: {
        source: latestForLink?.status === "changes_requested" ? "institute_playlist_review_resubmission" : "institute_playlist_review_submission",
        inquiry_code: inquiry.code,
        playlist_slug: playlist.slug,
        submitted_at: data.submitted_at,
        review_packet_id: data.id,
        previous_review_packet_id: latestForLink?.id ?? null,
      },
    })
    .eq("id", link.workProductLinkId);

  return {
    packetId: data.id,
    packetVersion: data.packet_version,
    status: data.status,
    submittedAt: data.submitted_at,
    reviewedAt: data.reviewed_at,
    editorDecision: data.editor_decision,
    editorNotes: data.editor_notes,
    contributorNote: data.contributor_note,
  };
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
