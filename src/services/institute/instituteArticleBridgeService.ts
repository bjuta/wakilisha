import { supabase } from "@/lib/supabase";
import { createArticleDraftForAdmin } from "@/services/articles/articleAdminService";
import type { InquiryDraft } from "@/pages/admin/institute/inquiry-interface/types";

export type InstituteArticleDraftLink = {
  id: string;
  inquiryId: string;
  articleId: string;
  articleSlug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type WorkProductLinkRow = {
  id: string;
  inquiry_id: string;
  product_id: string;
  product_slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapLink(row: WorkProductLinkRow): InstituteArticleDraftLink {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    articleId: row.product_id,
    articleSlug: row.product_slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchInstituteArticleDraftLink(inquiryId: string): Promise<InstituteArticleDraftLink | null> {
  const { data, error } = await supabase
    .from("institute_work_product_links")
    .select("id, inquiry_id, product_id, product_slug, status, created_at, updated_at")
    .eq("inquiry_id", inquiryId)
    .eq("product_type", "article")
    .eq("format_label", "Article")
    .maybeSingle();

  if (error) throw error;
  return data ? mapLink(data as WorkProductLinkRow) : null;
}

export async function createOrFetchInstituteArticleDraftLink(inquiry: InquiryDraft): Promise<InstituteArticleDraftLink> {
  const existing = await fetchInstituteArticleDraftLink(inquiry.id);
  if (existing) return existing;

  const title = inquiry.workingQuestion || inquiry.rawQuestion || `${inquiry.code} article draft`;
  const anchorLabel = inquiry.anchor?.label ? ` · ${inquiry.anchor.label}` : "";
  const slugBase = `institute-${inquiry.code.toLowerCase()}-${slugify(title).slice(0, 48)}`;

  const article = await createArticleDraftForAdmin({
    title,
    excerpt: `Institute article draft for ${inquiry.code}${anchorLabel}.`,
    contentHtml: "",
    author: "WAKILISHA Contributor",
    slugBase,
    seo: {
      title,
      description: `Private Institute article draft for ${inquiry.code}.`,
    },
    metadata: {
      institute_inquiry_id: inquiry.id,
      institute_inquiry_code: inquiry.code,
      institute_anchor: inquiry.anchor,
    },
  });

  const { data, error } = await supabase
    .from("institute_work_product_links")
    .insert({
      inquiry_id: inquiry.id,
      product_type: "article",
      format_label: "Article",
      product_id: article.id,
      product_slug: article.slug,
      status: "draft",
      metadata: {
        source: "institute_article_bridge",
        inquiry_code: inquiry.code,
        article_title: article.title,
      },
    })
    .select("id, inquiry_id, product_id, product_slug, status, created_at, updated_at")
    .single();

  if (error) {
    const retry = await fetchInstituteArticleDraftLink(inquiry.id);
    if (retry) return retry;
    throw error;
  }

  return mapLink(data as WorkProductLinkRow);
}

export type InstituteArticleReviewPayload = {
  articleId: string;
  articleSlug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  author: string;
  categories: string[];
  tags: string[];
  seo: Record<string, unknown>;
  wpStatus: string | null;
};

export type InstituteLinkedArticleReviewStatus =
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved_for_promotion"
  | "accepted_for_internal_memory"
  | "rejected"
  | "withdrawn";

export type InstituteLinkedArticleReviewState = {
  packetId: string;
  packetVersion: number;
  status: InstituteLinkedArticleReviewStatus;
  submittedAt: string;
  reviewedAt: string | null;
  editorDecision: string | null;
  editorNotes: string | null;
  contributorNote: string | null;
};

export type InstituteArticleReviewSubmission = InstituteLinkedArticleReviewState & {
  alreadySubmitted?: boolean;
};

type ReviewPacketForStateRow = {
  id: string;
  packet_version: number;
  status: InstituteLinkedArticleReviewStatus;
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

function mapReviewState(row: ReviewPacketForStateRow): InstituteLinkedArticleReviewState {
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

function reviewPacketMatchesLink(row: ReviewPacketForStateRow, link: InstituteArticleDraftLink) {
  const workProduct = row.snapshot_json?.workProduct;
  return workProduct?.linkId === link.id || workProduct?.productSlug === link.articleSlug;
}

async function fetchLatestReviewRowsForInquiry(inquiryId: string): Promise<ReviewPacketForStateRow[]> {
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
  return (data ?? []) as ReviewPacketForStateRow[];
}

export async function fetchInstituteArticleReviewState(
  inquiry: InquiryDraft,
  link: InstituteArticleDraftLink,
): Promise<InstituteLinkedArticleReviewState | null> {
  const rows = await fetchLatestReviewRowsForInquiry(inquiry.id);
  const latestForLink = rows.find((row) => reviewPacketMatchesLink(row, link));
  return latestForLink ? mapReviewState(latestForLink) : null;
}

export async function fetchInstituteArticleReviewHistory(
  inquiry: InquiryDraft,
  link: InstituteArticleDraftLink,
): Promise<InstituteLinkedArticleReviewState[]> {
  const rows = await fetchLatestReviewRowsForInquiry(inquiry.id);

  return rows
    .filter((row) => reviewPacketMatchesLink(row, link))
    .map(mapReviewState)
    .sort((first, second) => first.packetVersion - second.packetVersion);
}

export async function submitInstituteArticleDraftForReview(
  inquiry: InquiryDraft,
  link: InstituteArticleDraftLink,
  article: InstituteArticleReviewPayload,
): Promise<InstituteArticleReviewSubmission> {
  if (link.status === "published") {
    throw new Error("This linked article has already been published. Start a new Inquiry for major follow-up work.");
  }

  const rows = await fetchLatestReviewRowsForInquiry(inquiry.id);
  const latestVersion = rows.length ? Number(rows[0].packet_version) || 0 : 0;
  const latestForLink = rows.find((row) => reviewPacketMatchesLink(row, link));

  if (latestForLink) {
    if (latestForLink.status === "submitted" || latestForLink.status === "under_review") {
      return {
        ...mapReviewState(latestForLink),
        alreadySubmitted: true,
      };
    }

    if (latestForLink.status === "approved_for_promotion" || latestForLink.status === "accepted_for_internal_memory") {
      throw new Error("This work has already been accepted by review. Editors control the next step.");
    }

    if (latestForLink.status === "rejected") {
      throw new Error("This review packet was rejected. Start a new Inquiry if the work needs to be rebuilt.");
    }
  }

  const snapshot = {
    reviewPacketVersion: 1,
    packetKind: latestForLink?.status === "changes_requested" ? "linked_article_draft_resubmission" : "linked_article_draft_review",
    capturedAt: new Date().toISOString(),
    editorialInstruction:
      latestForLink?.status === "changes_requested"
        ? "Contributor resubmitted a linked Institute article draft after editor-requested changes. This is not a publishing action."
        : "Contributor submitted a linked Institute article draft for editorial review. This is not a publishing action.",
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
      linkId: link.id,
      productType: "article",
      formatLabel: "Article",
      productId: link.articleId,
      productSlug: link.articleSlug,
      status: "submitted_for_review",
      previousReviewStatus: latestForLink?.status ?? null,
      previousReviewPacketId: latestForLink?.id ?? null,
    },
    articleDraft: {
      id: article.articleId,
      slug: article.articleSlug,
      title: article.title,
      excerpt: article.excerpt,
      contentHtml: article.contentHtml,
      author: article.author,
      categories: article.categories,
      tags: article.tags,
      seo: article.seo,
      wpStatus: article.wpStatus,
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
          ? `Linked article draft resubmitted after requested changes: ${article.articleSlug}`
          : `Linked article draft submitted for review: ${article.articleSlug}`,
      snapshot_json: snapshot,
    })
    .select("id, packet_version, status, submitted_at, reviewed_at, editor_decision, editor_notes, contributor_note")
    .single();

  if (error) throw error;

  await supabase
    .from("institute_work_product_links")
    .update({
      status: "submitted_for_review",
      metadata: {
        source: latestForLink?.status === "changes_requested" ? "institute_article_review_resubmission" : "institute_article_review_submission",
        inquiry_code: inquiry.code,
        article_slug: article.articleSlug,
        submitted_at: data.submitted_at,
        review_packet_id: data.id,
        previous_review_packet_id: latestForLink?.id ?? null,
      },
    })
    .eq("id", link.id);

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
