import { supabase } from "@/lib/supabase";

export type ScopedRedirectEntityType = "track" | "release";

export type ScopedSlugRedirect = {
  newPath: string;
  redirectStatus: 301 | 308;
};

const routePrefixByEntityType = {
  track: "/tracks",
  release: "/releases",
} as const;

function cleanRouteSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function isPermanentRedirectStatus(value: number): value is 301 | 308 {
  return value === 301 || value === 308;
}

function isSafeTargetPath(
  entityType: ScopedRedirectEntityType,
  scopeSlug: string,
  newPath: string,
): boolean {
  const expectedPrefix =
    `${routePrefixByEntityType[entityType]}/${scopeSlug}/`;

  return (
    newPath.startsWith(expectedPrefix) &&
    !newPath.includes("?") &&
    !newPath.includes("#")
  );
}

export async function resolveScopedSlugRedirect(
  entityType: ScopedRedirectEntityType,
  scopeSlug: string,
  oldSlug: string,
): Promise<ScopedSlugRedirect | null> {
  const cleanScopeSlug = cleanRouteSegment(scopeSlug);
  const cleanOldSlug = cleanRouteSegment(oldSlug);

  if (!cleanScopeSlug || !cleanOldSlug) {
    return null;
  }

  const oldPath =
    `${routePrefixByEntityType[entityType]}/${cleanScopeSlug}/${cleanOldSlug}`;

  const { data, error } = await supabase
    .from("wk_slug_redirects")
    .select("new_path, redirect_status")
    .eq("entity_type", entityType)
    .eq("scope_slug", cleanScopeSlug)
    .eq("old_slug", cleanOldSlug)
    .eq("old_path", oldPath)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const newPath =
    typeof data.new_path === "string"
      ? data.new_path.trim()
      : "";

  const redirectStatus = Number(data.redirect_status);

  if (
    !newPath ||
    newPath === oldPath ||
    !isSafeTargetPath(entityType, cleanScopeSlug, newPath) ||
    !isPermanentRedirectStatus(redirectStatus)
  ) {
    return null;
  }

  return {
    newPath,
    redirectStatus,
  };
}
