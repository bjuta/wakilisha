function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function defaultPublicContentBase(supabaseUrl: string): string {
  return supabaseUrl
    ? `${trimTrailingSlash(supabaseUrl)}/functions/v1/public-content-read`
    : "/api/v1";
}

export function resolvePublicContentApiBase(
  supabaseUrl: string,
  configuredApiBase: string | undefined,
): string {
  const fallback = defaultPublicContentBase(supabaseUrl);
  const configured = configuredApiBase?.trim() ?? "";
  if (!configured) return fallback;

  try {
    const configuredUrl = new URL(configured);
    const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
    const configuredPath = configuredUrl.pathname.replace(/\/+$/, "");
    const isSupabasePublicContent =
      configuredUrl.hostname.endsWith(".supabase.co")
      && configuredPath.endsWith("/functions/v1/public-content-read");

    if (
      isSupabasePublicContent
      && supabaseOrigin
      && configuredUrl.origin !== supabaseOrigin
    ) {
      return fallback;
    }
  } catch {
    // Relative and custom API bases keep their existing behavior.
  }

  return configured;
}
