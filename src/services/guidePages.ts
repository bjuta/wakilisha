import { supabase } from "@/lib/supabase";
import type { GuidePageRecord, GuideSection } from "@/pages/guides/detail/sectionTypes";

/**
 * Fetch a single guide page by slug from the guide_pages table.
 */
export async function fetchGuidePage(slug: string): Promise<GuidePageRecord | null> {
  const { data, error } = await supabase
    .from("guide_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("Error fetching guide page:", error);
    return null;
  }

  if (!data) return null;

  return mapGuideRow(data);
}

/**
 * Fetch all published guide pages (for the listing page).
 */
export async function fetchPublishedGuides(): Promise<GuidePageRecord[]> {
  const { data, error } = await supabase
    .from("guide_pages")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Error fetching published guides:", error);
    return [];
  }

  return (data || []).map(mapGuideRow);
}

/**
 * Update a guide page's sections (admin use).
 */
export async function updateGuideSections(slug: string, sections: GuideSection[]): Promise<boolean> {
  const { error } = await supabase
    .from("guide_pages")
    .update({ sections, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) {
    console.error("Error updating guide sections:", error);
    return false;
  }
  return true;
}

// ─── Admin functions ───

/**
 * Fetch a guide page for admin editing — ignores status filter.
 */
export async function fetchGuideForAdmin(slug: string): Promise<GuidePageRecord | null> {
  const { data, error } = await supabase
    .from("guide_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Error fetching guide for admin:", error);
    return null;
  }

  if (!data) return null;

  return mapGuideRow(data);
}

/**
 * Update any fields on a guide page record.
 */
export async function updateGuidePage(slug: string, updates: Partial<Pick<GuidePageRecord, "title" | "subtitle" | "excerpt" | "sections" | "guide_format" | "color_var" | "icon" | "framing" | "hero_url">>): Promise<boolean> {
  const { error } = await supabase
    .from("guide_pages")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) {
    console.error("Error updating guide page:", error);
    return false;
  }
  return true;
}

/**
 * Publish a guide — sets status = 'published' and published_at.
 */
export async function publishGuide(slug: string): Promise<boolean> {
  const { error } = await supabase
    .from("guide_pages")
    .update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) {
    console.error("Error publishing guide:", error);
    return false;
  }
  return true;
}

/**
 * Unpublish a guide — sets status = 'draft'.
 */
export async function unpublishGuide(slug: string): Promise<boolean> {
  const { error } = await supabase
    .from("guide_pages")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) {
    console.error("Error unpublishing guide:", error);
    return false;
  }
  return true;
}

// ─── Row mapper ───

function mapGuideRow(d: any): GuidePageRecord {
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    subtitle: d.subtitle,
    excerpt: d.excerpt,
    guide_format: d.guide_format,
    color_var: d.color_var,
    icon: d.icon,
    framing: d.framing,
    hero_url: d.hero_url,
    sections: (d.sections || []) as GuideSection[],
    status: d.status,
    published_at: d.published_at,
    updated_at: d.updated_at,
  };
}