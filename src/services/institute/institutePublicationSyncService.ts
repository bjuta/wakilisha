import { supabase } from "@/lib/supabase";

type LinkedWorkProductRow = {
  id: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

export type InstituteArticlePublicationSyncInput = {
  articleId: string;
  articleSlug: string;
  wpStatus: string | null;
  publishedAt: string | null;
};

export async function syncInstituteArticlePublicationState(input: InstituteArticlePublicationSyncInput) {
  const { data: links, error: linksError } = await supabase
    .from("institute_work_product_links")
    .select("id, status, metadata")
    .eq("product_type", "article")
    .eq("product_id", input.articleId);

  if (linksError) throw linksError;
  if (!links?.length) return { updated: 0 };

  const now = new Date().toISOString();
  let updated = 0;

  for (const link of links as LinkedWorkProductRow[]) {
    const previousMetadata =
      link.metadata && typeof link.metadata === "object" && !Array.isArray(link.metadata)
        ? link.metadata
        : {};

    const isPublished = input.wpStatus === "publish";
    const nextStatus = isPublished ? "published" : link.status === "published" ? "approved" : link.status;

    if (nextStatus === link.status && !isPublished) continue;

    const nextMetadata = {
      ...previousMetadata,
      publication_sync: {
        source: "article_editor",
        article_id: input.articleId,
        article_slug: input.articleSlug,
        wp_status: input.wpStatus,
        published_at: input.publishedAt,
        synced_at: now,
      },
    };

    const { error } = await supabase
      .from("institute_work_product_links")
      .update({
        status: nextStatus,
        metadata: nextMetadata,
      })
      .eq("id", link.id);

    if (error) throw error;
    updated += 1;
  }

  return { updated };
}
