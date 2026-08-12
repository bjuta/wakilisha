import { supabase } from "@/lib/supabase";

export type PublicPersonRole = {
  role: string;
  label: string;
};

export type PublicPerson = {
  personId: string;
  canonicalPath: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  username: string | null;
  registryAuthorSlug: string | null;
  publicRoles: PublicPersonRole[];
  redirectTo: string | null;
};

export type PublicPersonWorkRole = {
  role: string;
  label: string;
  displayOrder: number;
  isPrimary: boolean;
};

export type PublicPersonWork = {
  resourceId: string;
  resourceKind: "article" | "playlist";
  canonicalPath: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string;
  roles: PublicPersonWorkRole[];
  isPrimary: boolean;
};

export type PublicPersonSocialSummary = {
  personId: string;
  followerCount: number;
  followingCount: number;
};

export type PersonFollowState = {
  personId: string;
  followed: boolean;
};

export type PublicPersonWorkCursor = {
  publishedAt: string;
  resourceId: string;
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
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === "string" &&
    value.trim().length > 0
    ? value
    : null;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean {
  return record[key] === true;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function mapPublicRoles(
  value: unknown,
): PublicPersonRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);

    if (!record) {
      return [];
    }

    const role = readString(
      record,
      "role",
    );

    if (!role) {
      return [];
    }

    return [{
      role,
      label:
        readString(
          record,
          "label",
        ) ?? role,
    }];
  });
}

function mapWorkRoles(
  value: unknown,
): PublicPersonWorkRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);

    if (!record) {
      return [];
    }

    const role = readString(
      record,
      "role",
    );

    if (!role) {
      return [];
    }

    return [{
      role,
      label:
        readString(
          record,
          "role_label",
        ) ??
        readString(
          record,
          "label",
        ) ??
        role,
      displayOrder:
        readNumber(
          record,
          "display_order",
        ),
      isPrimary:
        readBoolean(
          record,
          "is_primary",
        ),
    }];
  });
}

function mapPublicPerson(
  value: unknown,
): PublicPerson | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const personId = readString(
    record,
    "person_id",
  );

  const canonicalPath = readString(
    record,
    "canonical_path",
  );

  const displayName = readString(
    record,
    "display_name",
  );

  if (
    !personId ||
    !canonicalPath ||
    !displayName
  ) {
    return null;
  }

  return {
    personId,
    canonicalPath,
    displayName,
    bio:
      readString(
        record,
        "bio",
      ),
    avatarUrl:
      readString(
        record,
        "avatar_url",
      ),
    coverUrl:
      readString(
        record,
        "cover_url",
      ),
    location:
      readString(
        record,
        "location",
      ),
    username:
      readString(
        record,
        "username",
      ),
    registryAuthorSlug:
      readString(
        record,
        "registry_author_slug",
      ),
    publicRoles:
      mapPublicRoles(
        record.public_roles,
      ),
    redirectTo:
      readString(
        record,
        "redirect_to",
      ),
  };
}

export async function getPublicPerson(
  slug: string,
): Promise<PublicPerson | null> {
  const { data, error } =
    await supabase.rpc(
      "get_public_person",
      {
        p_slug: slug,
      },
    );

  if (error) {
    throw new Error(
      `Failed to load Person: ${error.message}`,
    );
  }

  return mapPublicPerson(data);
}

export async function listPublicPersonWork(
  personResourceId: string,
  options: {
    limit?: number;
    cursor?: PublicPersonWorkCursor | null;
  } = {},
): Promise<PublicPersonWork[]> {
  const limit =
    Math.min(
      Math.max(
        options.limit ?? 12,
        1,
      ),
      50,
    );

  const { data, error } =
    await supabase.rpc(
      "list_public_person_work",
      {
        p_person_resource_id:
          personResourceId,
        p_limit:
          limit,
        p_before_published_at:
          options.cursor?.publishedAt,
        p_before_resource_id:
          options.cursor?.resourceId,
      },
    );

  if (error) {
    throw new Error(
      `Failed to load Person work: ${error.message}`,
    );
  }

  return (data ?? []).flatMap(
    (row) => {
      const kind =
        row.resource_kind;

      if (
        kind !== "article" &&
        kind !== "playlist"
      ) {
        return [];
      }

      return [{
        resourceId:
          row.resource_id,
        resourceKind:
          kind,
        canonicalPath:
          row.canonical_path,
        title:
          row.title,
        summary:
          row.summary || null,
        imageUrl:
          row.image_url || null,
        publishedAt:
          row.published_at,
        roles:
          mapWorkRoles(
            row.roles,
          ),
        isPrimary:
          Boolean(
            row.is_primary,
          ),
      }];
    },
  );
}

export async function getPublicPersonSocialSummary(
  personResourceId: string,
): Promise<PublicPersonSocialSummary | null> {
  const { data, error } =
    await supabase.rpc(
      "get_public_person_social_summary",
      {
        p_person_resource_id:
          personResourceId,
      },
    );

  if (error) {
    throw new Error(
      `Failed to load Person social summary: ${error.message}`,
    );
  }

  const record = asRecord(data);

  if (!record) {
    return null;
  }

  const personId = readString(
    record,
    "person_id",
  );

  if (!personId) {
    return null;
  }

  return {
    personId,
    followerCount:
      readNumber(
        record,
        "follower_count",
      ),
    followingCount:
      readNumber(
        record,
        "following_count",
      ),
  };
}

export async function getPersonFollowState(
  personResourceId: string,
): Promise<PersonFollowState> {
  const { data, error } =
    await supabase.rpc(
      "community_get_person_follow_state",
      {
        p_person_resource_id:
          personResourceId,
      },
    );

  if (error) {
    throw new Error(
      `Failed to load Person Follow state: ${error.message}`,
    );
  }

  const record = asRecord(data);

  return {
    personId:
      record
        ? readString(
            record,
            "person_id",
          ) ??
          personResourceId
        : personResourceId,
    followed:
      record
        ? readBoolean(
            record,
            "followed",
          )
        : false,
  };
}
