import { supabase } from "@/lib/supabase";

export type PublicRegistryAuthorPersonResolution = {
  registryAuthorSlug: string;
  personId: string;
  canonicalPath: string;
};

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function text(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];

  return typeof value === "string" &&
    value.trim().length > 0
    ? value
    : null;
}

export async function resolvePublicRegistryAuthorPerson(
  slug: string,
): Promise<PublicRegistryAuthorPersonResolution | null> {
  const normalized = slug.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase.rpc(
    "resolve_public_registry_author_person",
    {
      p_slug: normalized,
    },
  );

  if (error) {
    throw new Error(
      `Failed to resolve legacy Author route: ${error.message}`,
    );
  }

  const row = asRecord(data);

  if (!row) {
    return null;
  }

  const registryAuthorSlug =
    text(row, "registry_author_slug");
  const personId =
    text(row, "person_id");
  const canonicalPath =
    text(row, "canonical_path");

  if (
    !registryAuthorSlug ||
    !personId ||
    !canonicalPath
  ) {
    return null;
  }

  return {
    registryAuthorSlug,
    personId,
    canonicalPath,
  };
}
