export const PUBLIC_SEARCH_ENTITY_TYPES = [
  "artist",
  "track",
  "release",
  "genre",
  "label",
] as const;

export type PublicSearchEntityType =
  typeof PUBLIC_SEARCH_ENTITY_TYPES[number];

export type PublicSearchResult = {
  type: PublicSearchEntityType;
  id: string;
  slug: string;
  parentSlug: string | null;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  payload: Record<string, unknown>;
  updatedAt: string;
};

export type PublicSearchResponse = {
  version: "v1";
  query: string;
  types: PublicSearchEntityType[];
  results: PublicSearchResult[];
  page: {
    limit: number;
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export type PublicSearchRequest = {
  query: string;
  types: PublicSearchEntityType[];
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
};

const PUBLIC_SEARCH_PATH =
  "/api/public/v1/search";

function boundedLimit(
  value: number | undefined,
): number {
  if (
    !Number.isFinite(value)
  ) {
    return 20;
  }

  return Math.max(
    1,
    Math.min(
      Math.trunc(
        value
        ?? 20,
      ),
      50,
    ),
  );
}

export async function searchPublicRegistry(
  request: PublicSearchRequest,
): Promise<PublicSearchResponse> {
  const query =
    request.query
      .trim()
      .slice(
        0,
        128,
      );

  if (!query) {
    return {
      version: "v1",
      query: "",
      types:
        request.types,
      results: [],
      page: {
        limit:
          boundedLimit(
            request.limit,
          ),
        total: 0,
        hasMore: false,
        nextCursor: null,
      },
    };
  }

  const params =
    new URLSearchParams({
      q:
        query,
      types:
        request.types.join(
          ",",
        ),
      limit:
        String(
          boundedLimit(
            request.limit,
          ),
        ),
    });

  if (request.cursor) {
    params.set(
      "cursor",
      request.cursor,
    );
  }

  const response =
    await fetch(
      `${PUBLIC_SEARCH_PATH}?${params.toString()}`,
      {
        method:
          "GET",
        headers: {
          Accept:
            "application/json",
        },
        credentials:
          "omit",
        signal:
          request.signal,
      },
    );

  if (!response.ok) {
    throw new Error(
      `Public Search failed (${response.status})`,
    );
  }

  const payload: PublicSearchResponse =
    await response.json();

  if (
    payload.version
      !== "v1"
    || !Array.isArray(
      payload.results,
    )
    || !payload.page
  ) {
    throw new Error(
      "Public Search returned an invalid response.",
    );
  }

  return payload;
}
