import { supabase } from "@/lib/supabase";

export type ScopedRedirectEntityType = "track" | "release";

export type ScopedSlugRedirect = {
  newPath: string;
  redirectStatus: 301 | 308;
};

export type ScopedSlugRedirectContext = {
  releaseSlug?: string;
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

function buildScopedRoutePrefix(
  entityType: ScopedRedirectEntityType,
  scopeSlug: string,
  context: ScopedSlugRedirectContext,
): string {
  const releaseSlug = cleanRouteSegment(context.releaseSlug || "");

  if (entityType === "track" && releaseSlug) {
    return `/releases/${scopeSlug}/${releaseSlug}/`;
  }

  return `${routePrefixByEntityType[entityType]}/${scopeSlug}/`;
}

function isSafeTargetPath(
  entityType: ScopedRedirectEntityType,
  scopeSlug: string,
  newPath: string,
  context: ScopedSlugRedirectContext,
): boolean {
  const expectedPrefixes = [
    buildScopedRoutePrefix(
      entityType,
      scopeSlug,
      context,
    ),
  ];

  if (
    entityType === "track" &&
    cleanRouteSegment(context.releaseSlug || "")
  ) {
    expectedPrefixes.push(
      `/tracks/${scopeSlug}/`,
    );
  }

  return (
    expectedPrefixes.some(
      (expectedPrefix) =>
        newPath.startsWith(expectedPrefix),
    ) &&
    !newPath.includes("?") &&
    !newPath.includes("#")
  );
}

export async function resolveScopedSlugRedirect(
  entityType: ScopedRedirectEntityType,
  scopeSlug: string,
  oldSlug: string,
  context: ScopedSlugRedirectContext = {},
): Promise<ScopedSlugRedirect | null> {
  const cleanScopeSlug = cleanRouteSegment(scopeSlug);
  const cleanOldSlug = cleanRouteSegment(oldSlug);
  const cleanReleaseSlug = cleanRouteSegment(context.releaseSlug || "");

  if (!cleanScopeSlug || !cleanOldSlug) {
    return null;
  }

  if (entityType === "track" && context.releaseSlug && !cleanReleaseSlug) {
    return null;
  }

  const cleanContext: ScopedSlugRedirectContext = {
    releaseSlug: cleanReleaseSlug || undefined,
  };

  const oldPath =
    `${buildScopedRoutePrefix(
      entityType,
      cleanScopeSlug,
      cleanContext,
    )}${cleanOldSlug}`;

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
    !isSafeTargetPath(
      entityType,
      cleanScopeSlug,
      newPath,
      cleanContext,
    ) ||
    !isPermanentRedirectStatus(redirectStatus)
  ) {
    return null;
  }

  return {
    newPath,
    redirectStatus,
  };
}
