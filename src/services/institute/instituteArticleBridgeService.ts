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

export type InstituteArticleReviewSubmission = {
  packetId: string;
  packetVersion: number;
  submittedAt: string;
};

export async function submitInstituteArticleDraftForReview(
  inquiry: InquiryDraft,
  link: InstituteArticleDraftLink,
  article: InstituteArticleReviewPayload,
): Promise<InstituteArticleReviewSubmission> {
  const { data: latestRows, error: latestError } = await supabase
    .from("institute_review_packets")
    .select("packet_version")
    .eq("inquiry_id", inquiry.id)
    .order("packet_version", { ascending: false })
    .limit(1);

  if (latestError) throw latestError;

  const latestVersion = Array.isArray(latestRows) && latestRows.length
    ? Number(latestRows[0].packet_version) || 0
    : 0;

  const snapshot = {
    reviewPacketVersion: 1,
    packetKind: "linked_article_draft_review",
    capturedAt: new Date().toISOString(),
    editorialInstruction: "Contributor submitted a linked Institute article draft for editorial review. This is not a publishing action.",
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
      contributor_note: `Linked article draft submitted for review: ${article.articleSlug}`,
      snapshot_json: snapshot,
    })
    .select("id, packet_version, submitted_at")
    .single();

  if (error) throw error;

  await supabase
    .from("institute_work_product_links")
    .update({
      status: "submitted_for_review",
      metadata: {
        source: "institute_article_review_submission",
        inquiry_code: inquiry.code,
        article_slug: article.articleSlug,
        submitted_at: data.submitted_at,
        review_packet_id: data.id,
      },
    })
    .eq("id", link.id);

  return {
    packetId: data.id,
    packetVersion: data.packet_version,
    submittedAt: data.submitted_at,
  };
}
