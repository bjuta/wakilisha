import { supabase } from "@/lib/supabase";

export type InstituteReviewPacketStatus =
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved_for_promotion"
  | "accepted_for_internal_memory"
  | "rejected"
  | "withdrawn";

export type InstituteReviewPacketSnapshot = {
  reviewPacketVersion?: number;
  packetKind?: string;
  capturedAt?: string;
  editorialInstruction?: string;
  inquiry?: {
    id?: string;
    code?: string;
    rawQuestion?: string;
    workingQuestion?: string;
    status?: string;
    anchor?: { label?: string; type?: string; slug?: string } | null;
    setup?: Record<string, unknown>;
  };
  workProduct?: {
    linkId?: string;
    productType?: string;
    formatLabel?: string;
    productId?: string;
    productSlug?: string;
    status?: string;
  };
  articleDraft?: {
    id?: string;
    slug?: string;
    title?: string;
    excerpt?: string;
    contentHtml?: string;
    author?: string;
    categories?: string[];
    tags?: string[];
    seo?: Record<string, unknown>;
    wpStatus?: string | null;
  };
  governance?: {
    contributorCanPublish?: boolean;
    editorMustReviewBeforePublication?: boolean;
    publicReleaseAllowedFromInstitute?: boolean;
  };
};

export type InstituteWorkProductLiveStatus =
  | "draft"
  | "in_progress"
  | "submitted_for_review"
  | "approved"
  | "rejected"
  | "published"
  | "archived";

export type InstituteReviewPacket = {
  id: string;
  inquiryId: string;
  packetVersion: number;
  status: InstituteReviewPacketStatus;
  submittedBy: string | null;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  editorDecision: string | null;
  editorNotes: string | null;
  contributorNote: string | null;
  snapshot: InstituteReviewPacketSnapshot;
  liveWorkProductStatus?: InstituteWorkProductLiveStatus | null;
  liveWorkProductUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkProductLinkRow = {
  id: string;
  status: InstituteWorkProductLiveStatus;
  updated_at: string | null;
};

type ReviewPacketRow = {
  id: string;
  inquiry_id: string;
  packet_version: number;
  status: InstituteReviewPacketStatus;
  submitted_by: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  editor_decision: string | null;
  editor_notes: string | null;
  contributor_note: string | null;
  snapshot_json: InstituteReviewPacketSnapshot;
  created_at: string;
  updated_at: string;
};

function mapReviewPacket(row: ReviewPacketRow, linksById = new Map<string, WorkProductLinkRow>()): InstituteReviewPacket {
  const linkId = row.snapshot_json?.workProduct?.linkId;
  const liveLink = linkId ? linksById.get(linkId) : null;

  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    packetVersion: row.packet_version,
    status: row.status,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    editorDecision: row.editor_decision,
    editorNotes: row.editor_notes,
    contributorNote: row.contributor_note,
    snapshot: row.snapshot_json ?? {},
    liveWorkProductStatus: liveLink?.status ?? null,
    liveWorkProductUpdatedAt: liveLink?.updated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchInstituteReviewPackets(): Promise<InstituteReviewPacket[]> {
  const { data, error } = await supabase
    .from("institute_review_packets")
    .select(`
      id,
      inquiry_id,
      packet_version,
      status,
      submitted_by,
      submitted_at,
      reviewed_by,
      reviewed_at,
      editor_decision,
      editor_notes,
      contributor_note,
      snapshot_json,
      created_at,
      updated_at
    `)
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const rows = (data ?? []) as ReviewPacketRow[];
  const linkIds = Array.from(
    new Set(
      rows
        .map((row) => row.snapshot_json?.workProduct?.linkId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let linksById = new Map<string, WorkProductLinkRow>();

  if (linkIds.length) {
    const { data: links, error: linksError } = await supabase
      .from("institute_work_product_links")
      .select("id, status, updated_at")
      .in("id", linkIds);

    if (linksError) throw linksError;
    linksById = new Map((links ?? []).map((link) => [link.id, link as WorkProductLinkRow]));
  }

  return rows.map((row) => mapReviewPacket(row, linksById));
}

function workProductStatusForReviewStatus(status: InstituteReviewPacketStatus) {
  if (status === "changes_requested") return "in_progress";
  if (status === "approved_for_promotion") return "approved";
  if (status === "accepted_for_internal_memory") return "archived";
  if (status === "rejected") return "rejected";
  return "submitted_for_review";
}

export async function updateInstituteReviewPacketDecision(
  packet: InstituteReviewPacket,
  status: InstituteReviewPacketStatus,
  editorNotes: string,
): Promise<InstituteReviewPacket> {
  const { data, error } = await supabase
    .from("institute_review_packets")
    .update({
      status,
      editor_decision: status,
      editor_notes: editorNotes,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", packet.id)
    .select(`
      id,
      inquiry_id,
      packet_version,
      status,
      submitted_by,
      submitted_at,
      reviewed_by,
      reviewed_at,
      editor_decision,
      editor_notes,
      contributor_note,
      snapshot_json,
      created_at,
      updated_at
    `)
    .single();

  if (error) throw error;

  const linkId = packet.snapshot?.workProduct?.linkId;
  if (linkId) {
    await supabase
      .from("institute_work_product_links")
      .update({
        status: workProductStatusForReviewStatus(status),
        metadata: {
          source: "institute_review_desk",
          review_packet_id: packet.id,
          review_status: status,
          reviewed_at: new Date().toISOString(),
        },
      })
      .eq("id", linkId);
  }

  return mapReviewPacket(data as ReviewPacketRow);
}
