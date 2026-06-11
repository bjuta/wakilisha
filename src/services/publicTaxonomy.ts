import { supabase } from "@/lib/supabase";

export type PublicTaxonomyTerm = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  article_count: number;
};

export type PublicTaxonomyArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author: string | null;
  published_at: string | null;
  hero_image_url: string | null;
  categories: string[];
  tags: string[];
  total_count: number;
};

export async function fetchTaxonomyIndex(taxonomy: "category" | "post_tag"): Promise<PublicTaxonomyTerm[]> {
  const { data, error } = await supabase
    .rpc("public_get_taxonomy_index", { p_taxonomy: taxonomy });

  if (error) {
    console.warn(`Taxonomy index fetch failed (${taxonomy}): ${error.message}`);
    return [];
  }

  return (data || []) as PublicTaxonomyTerm[];
}

export async function fetchTaxonomyTerm(
  taxonomy: "category" | "post_tag",
  slug: string,
): Promise<PublicTaxonomyTerm | null> {
  const { data, error } = await supabase
    .rpc("public_get_taxonomy_term", { p_taxonomy: taxonomy, p_slug: slug });

  if (error) {
    console.warn(`Taxonomy term fetch failed (${taxonomy}/${slug}): ${error.message}`);
    return null;
  }

  const rows = (data || []) as PublicTaxonomyTerm[];
  return rows[0] || null;
}

export async function fetchArticlesByTerm(
  taxonomy: "category" | "post_tag",
  termName: string,
  page: number = 1,
  pageSize: number = 12,
): Promise<{ articles: PublicTaxonomyArticle[]; totalCount: number }> {
  const { data, error } = await supabase
    .rpc("public_get_articles_by_term", {
      p_taxonomy: taxonomy,
      p_term_name: termName,
      p_page: page,
      p_page_size: pageSize,
    });

  if (error) {
    console.warn(`Articles by term fetch failed (${taxonomy}/${termName}): ${error.message}`);
    return { articles: [], totalCount: 0 };
  }

  const rows = (data || []) as PublicTaxonomyArticle[];
  const totalCount = rows.length > 0 ? rows[0].total_count : 0;

  return { articles: rows, totalCount };
}