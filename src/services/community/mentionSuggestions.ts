import { supabase } from "@/lib/supabase";

export type PostMentionSuggestion = {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
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

function readString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export async function searchPostMentionSuggestions(
  query: string,
  limit = 8,
): Promise<PostMentionSuggestion[]> {
  const clean =
    query.trim().toLowerCase().replace(/^@/, "");

  if (!/^[a-z0-9_]{1,30}$/.test(clean)) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    "community_search_mention_suggestions",
    {
      p_query: clean,
      p_limit: Math.min(Math.max(limit, 1), 8),
    },
  );

  if (error) {
    throw new Error("We could not load people to mention.");
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((value) => {
    const record = asRecord(value);
    const handle = readString(record, "handle");
    const displayName = readString(record, "display_name");
    const personId = readString(record, "person_id");
    const canonicalPath = readString(record, "canonical_path");
    const avatarUrl = readString(record, "avatar_url");

    if (
      !handle ||
      !displayName ||
      !personId ||
      !canonicalPath?.startsWith("/people/")
    ) {
      return [];
    }

    return [{
      handle: handle.toLowerCase(),
      displayName,
      avatarUrl,
      personId,
      canonicalPath,
    }];
  });
}
