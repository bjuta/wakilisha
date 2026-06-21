import { supabase } from "@/lib/supabase";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const API_BASE = `${supabaseUrl}/functions/v1/admin-featured-artists`;

export interface FeaturedArtist {
  id: string;
  artist_slug: string;
  artist_name: string;
  artist_image: string | null;
  artist_genres: string[];
  artist_country: string | null;
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

export async function fetchFeaturedArtists(): Promise<FeaturedArtist[]> {
  // Public read — no auth required
  try {
    const res = await fetch(API_BASE);
    const json = await res.json();

    if (!res.ok || json.error) {
      console.warn("Failed to fetch featured artists:", json.error ?? "Unknown error");
      return [];
    }

    return (json.artists ?? []) as FeaturedArtist[];
  } catch (err) {
    console.warn("Failed to fetch featured artists:", err instanceof Error ? err.message : "Network error");
    return [];
  }
}

export async function addFeaturedArtist(artistSlug: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn("Failed to add featured artist: not authenticated");
    return false;
  }

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers,
      body: JSON.stringify({ artist_slug: artistSlug }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.warn("Failed to add featured artist:", json.error ?? "Unknown error");
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Failed to add featured artist:", err instanceof Error ? err.message : "Network error");
    return false;
  }
}

export async function removeFeaturedArtist(id: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn("Failed to remove featured artist: not authenticated");
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      console.warn("Failed to remove featured artist:", json.error ?? "Unknown error");
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Failed to remove featured artist:", err instanceof Error ? err.message : "Network error");
    return false;
  }
}

export async function reorderFeaturedArtists(orderedIds: string[]): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn("Failed to reorder featured artists: not authenticated");
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
      console.warn("Failed to reorder featured artists:", json.error ?? "Unknown error");
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Failed to reorder featured artists:", err instanceof Error ? err.message : "Network error");
    return false;
  }
}

export async function moveFeaturedArtist(id: string, direction: "up" | "down", currentList: FeaturedArtist[]): Promise<boolean> {
  const idx = currentList.findIndex((a) => a.id === id);
  if (idx === -1) return false;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= currentList.length) return false;

  const newList = [...currentList];
  const temp = newList[idx];
  newList[idx] = newList[swapIdx];
  newList[swapIdx] = temp;

  return reorderFeaturedArtists(newList.map((a) => a.id));
}