import { supabase } from "@/lib/supabase";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const API_BASE = `${supabaseUrl}/functions/v1/admin-featured-guides`;

export interface FeaturedGuide {
  id: string;
  guide_slug: string;
  guide_title: string;
  guide_subtitle: string | null;
  guide_excerpt: string | null;
  guide_hero_url: string | null;
  guide_format: string | null;
  guide_color_var: string | null;
  guide_icon: string | null;
  guide_framing: string | null;
  guide_published_at: string | null;
  display_order: number;
  created_at: string;
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchFeaturedGuides(): Promise<FeaturedGuide[]> {
  try {
    const res = await fetch(API_BASE);
    const json = await res.json();

    if (!res.ok || json.error) {
      console.warn("Failed to fetch featured guides:", json.error ?? "Unknown error");
      return [];
    }

    return (json.guides ?? []) as FeaturedGuide[];
  } catch (err) {
    console.warn("Failed to fetch featured guides:", err instanceof Error ? err.message : "Network error");
    return [];
  }
}

export async function addFeaturedGuide(guideSlug: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn("Failed to add featured guide: not authenticated");
    return false;
  }

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers,
      body: JSON.stringify({ guide_slug: guideSlug }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.warn("Failed to add featured guide:", json.error ?? "Unknown error");
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Failed to add featured guide:", err instanceof Error ? err.message : "Network error");
    return false;
  }
}

export async function removeFeaturedGuide(id: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn("Failed to remove featured guide: not authenticated");
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.warn("Failed to remove featured guide:", json.error ?? "Unknown error");
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Failed to remove featured guide:", err instanceof Error ? err.message : "Network error");
    return false;
  }
}

export async function reorderFeaturedGuides(orderedIds: string[]): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn("Failed to reorder featured guides: not authenticated");
    return false;
  }

  try {
    const res = await fetch(API_BASE, {
      method: "PUT",
      headers,
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.warn("Failed to reorder featured guides:", json.error ?? "Unknown error");
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Failed to reorder featured guides:", err instanceof Error ? err.message : "Network error");
    return false;
  }
}

export async function moveFeaturedGuide(id: string, direction: "up" | "down", currentList: FeaturedGuide[]): Promise<boolean> {
  const idx = currentList.findIndex((g) => g.id === id);
  if (idx === -1) return false;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= currentList.length) return false;

  const newList = [...currentList];
  const temp = newList[idx];
  newList[idx] = newList[swapIdx];
  newList[swapIdx] = temp;

  return reorderFeaturedGuides(newList.map((g) => g.id));
}