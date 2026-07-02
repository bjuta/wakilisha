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
