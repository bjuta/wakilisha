import { supabase } from "@/lib/supabase";

export type PublicOrganizationType = {
  type: string;
  label: string;
  isPrimary: boolean;
  displayOrder: number;
};

export type PublicOrganization = {
  organizationId: string;
  canonicalPath: string;
  displayName: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  primaryType: string | null;
  organizationTypes: PublicOrganizationType[];
};

export type PublicOrganizationWork = {
  resourceId: string;
  resourceKind: string;
  canonicalPath: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string;
  creditRole: string;
  roleLabel: string;
  isPrimary: boolean;
  byline: string | null;
};

export type PublicOrganizationWorkCursor = {
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
    ? value.trim()
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
  const value = Number(record[key]);

  return Number.isFinite(value)
    ? value
    : 0;
}

function mapOrganizationTypes(
  value: unknown,
): PublicOrganizationType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);

    if (!record) {
      return [];
    }

    const type = readString(
      record,
      "type",
    );
    const label = readString(
      record,
      "label",
    );

    if (!type || !label) {
      return [];
    }

    return [{
      type,
      label,
      isPrimary:
        readBoolean(
          record,
          "is_primary",
        ),
      displayOrder:
        readNumber(
          record,
          "display_order",
        ),
    }];
  });
}

function mapPublicOrganization(
  value: unknown,
): PublicOrganization | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const organizationId = readString(
    record,
    "organization_id",
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
    !organizationId ||
    !canonicalPath ||
    !displayName
  ) {
    return null;
  }

  return {
    organizationId,
    canonicalPath,
    displayName,
    description:
      readString(
        record,
        "description",
      ),
    logoUrl:
      readString(
        record,
        "logo_url",
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
    websiteUrl:
      readString(
        record,
        "website_url",
      ),
    primaryType:
      readString(
        record,
        "primary_type",
      ),
    organizationTypes:
      mapOrganizationTypes(
        record.organization_types,
      ),
  };
}

function mapPublicOrganizationWork(
  value: unknown,
): PublicOrganizationWork | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const resourceId = readString(
    record,
    "resource_id",
  );
  const resourceKind = readString(
    record,
    "resource_kind",
  );
  const canonicalPath = readString(
    record,
    "canonical_path",
  );
  const title = readString(
    record,
    "title",
  );
  const publishedAt = readString(
    record,
    "published_at",
  );
  const creditRole = readString(
    record,
    "credit_role",
  );
  const roleLabel = readString(
    record,
    "role_label",
  );

  if (
    !resourceId ||
    !resourceKind ||
    !canonicalPath ||
    !title ||
    !publishedAt ||
    !creditRole ||
    !roleLabel
  ) {
    return null;
  }

  return {
    resourceId,
    resourceKind,
    canonicalPath,
    title,
    summary:
      readString(
        record,
        "summary",
      ),
    imageUrl:
      readString(
        record,
        "image_url",
      ),
    publishedAt,
    creditRole,
    roleLabel,
    isPrimary:
      readBoolean(
        record,
        "is_primary",
      ),
    byline:
      readString(
        record,
        "byline",
      ),
  };
}

export async function getPublicOrganization(
  slug: string,
): Promise<PublicOrganization | null> {
  const { data, error } =
    await supabase.rpc(
      "get_public_organization",
      {
        p_slug: slug,
      },
    );

  if (error) {
    throw new Error(
      `Failed to load Organization: ${error.message}`,
    );
  }

  return mapPublicOrganization(data);
}

export async function listPublicOrganizationWork(
  organizationResourceId: string,
  options: {
    limit?: number;
    cursor?: PublicOrganizationWorkCursor | null;
  } = {},
): Promise<PublicOrganizationWork[]> {
  const limit =
    Math.min(
      Math.max(
        options.limit ?? 24,
        1,
      ),
      100,
    );

  const { data, error } =
    await supabase.rpc(
      "list_public_organization_work",
      {
        p_organization_resource_id:
          organizationResourceId,
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
      `Failed to load Organization work: ${error.message}`,
    );
  }

  return (data ?? []).flatMap(
    (row) => {
      const work =
        mapPublicOrganizationWork(
          row,
        );

      return work
        ? [work]
        : [];
    },
  );
}

export async function listAllPublicOrganizationWork(
  organizationResourceId: string,
): Promise<PublicOrganizationWork[]> {
  const all: PublicOrganizationWork[] = [];
  const seen = new Set<string>();
  let cursor:
    PublicOrganizationWorkCursor
    | null = null;

  for (
    let page = 0;
    page < 10;
    page += 1
  ) {
    const batch =
      await listPublicOrganizationWork(
        organizationResourceId,
        {
          limit: 100,
          cursor,
        },
      );

    for (const item of batch) {
      if (seen.has(item.resourceId)) {
        continue;
      }

      seen.add(item.resourceId);
      all.push(item);
    }

    if (batch.length < 100) {
      break;
    }

    const last =
      batch[batch.length - 1];

    cursor = {
      publishedAt:
        last.publishedAt,
      resourceId:
        last.resourceId,
    };
  }

  return all;
}
