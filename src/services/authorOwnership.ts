import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/hooks/useAuthUser";
import type { AuthorRow } from "@/services/authorProfiles";

export interface AuthorOwnership {
  isOwner: boolean;
  authorRow: AuthorRow | null;
  matchMethod: "email" | "none";
}

/**
 * Check if the currently logged-in user owns the author profile with the given slug.
 * Matches by email first, with future support for explicit auth_user_id linking.
 */
export async function checkAuthorOwnership(
  authUser: AuthUser,
  authorSlug: string
): Promise<AuthorOwnership> {
  if (!authUser.id || !authUser.email) {
    return { isOwner: false, authorRow: null, matchMethod: "none" };
  }

  const normalizedEmail = authUser.email.toLowerCase().trim();

  // Fetch the author by slug to compare email
  const { data, error } = await supabase
    .from("registry_authors")
    .select("id, slug, name, email, bio, avatar_url, cover_url, role, location, social_links, joined_date")
    .eq("slug", authorSlug)
    .maybeSingle();

  if (error || !data) {
    return { isOwner: false, authorRow: null, matchMethod: "none" };
  }

  const authorRow = data as unknown as AuthorRow;

  // Match by email
  if (authorRow.email && authorRow.email.toLowerCase().trim() === normalizedEmail) {
    return { isOwner: true, authorRow, matchMethod: "email" };
  }

  return { isOwner: false, authorRow: null, matchMethod: "none" };
}

/**
 * Simple synchronous check — useful as a fallback when async check is pending.
 * Only returns true if authUser has an email and the candidate email matches.
 */
export function isAuthorOwnerByEmail(
  authUser: AuthUser,
  authorEmail: string | null | undefined
): boolean {
  if (!authUser.id || !authUser.email || !authorEmail) return false;
  return authUser.email.toLowerCase().trim() === authorEmail.toLowerCase().trim();
}