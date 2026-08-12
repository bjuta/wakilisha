import { supabase } from "@/lib/supabase";
import { getCanonicalChartPathFromSlugs } from "@/services/chartsPublic/chartRoutes";
import { getPublicPerson } from "@/services/people/personPublicService";

export const FOLLOW_TARGET_TYPES = [
  "person",
  "artist",
  "genre",
  "label",
  "chart_program",
] as const;

export type FollowTargetType =
  (typeof FOLLOW_TARGET_TYPES)[number];

export type CommunityFollowRow = {
  id: string;
  userId: string;
  targetType: FollowTargetType;
  targetId: string;
  targetSlug: string | null;
  createdAt: string;
};

export type FollowingPresentationItem = {
  followId: string;
  targetType: FollowTargetType;
  targetId: string;
  targetSlug: string | null;
  createdAt: string;
  title: string;
  imageUrl: string | null;
  canonicalPath: string;
};

type RegistryArtistRow = {
  id: string;
  slug: string;
  display_name: string | null;
  public_image_url: string | null;
};

type RegistryGenreRow = {
  id: string;
  slug: string;
  name: string | null;
};

type RegistryLabelRow = {
  id: string;
  slug: string;
  name: string | null;
};

type ChartProgramRow = {
  id: string;
  public_slug: string;
  public_label: string | null;
};

const FOLLOW_TARGET_TYPE_SET =
  new Set<string>(
    FOLLOW_TARGET_TYPES,
  );

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

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const clean = value.trim();

  return clean
    ? clean
    : null;
}

function isFollowTargetType(
  value: string,
): value is FollowTargetType {
  return FOLLOW_TARGET_TYPE_SET.has(
    value,
  );
}

function titleFromSlug(
  slug: string | null,
  fallback: string,
): string {
  if (!slug) {
    return fallback;
  }

  const title = slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );

  return title || fallback;
}

export function followingTargetLabel(
  type: FollowTargetType,
): string {
  const labels:
    Record<FollowTargetType, string> = {
      person: "Person",
      artist: "Artist",
      genre: "Genre",
      label: "Label",
      chart_program: "Chart",
    };

  return labels[type];
}

export function followingTargetIcon(
  type: FollowTargetType,
): string {
  const icons:
    Record<FollowTargetType, string> = {
      person: "ri-user-line",
      artist: "ri-mic-line",
      genre: "ri-price-tag-3-line",
      label: "ri-building-line",
      chart_program: "ri-bar-chart-line",
    };

  return icons[type];
}

export function followingFallbackPath(
  type: FollowTargetType,
  slug: string | null,
): string {
  if (!slug) {
    return "#";
  }

  switch (type) {
    case "person":
      return `/people/${slug}`;
    case "artist":
      return `/artists/${slug}`;
    case "genre":
      return `/genres/${slug}`;
    case "label":
      return `/labels/${slug}`;
    case "chart_program":
      return getCanonicalChartPathFromSlugs(
        slug,
      );
  }
}

export function mapCommunityFollowRows(
  value: unknown,
): CommunityFollowRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      const record =
        asRecord(item);

      if (!record) {
        return [];
      }

      const id =
        readString(
          record,
          "id",
        );
      const userId =
        readString(
          record,
          "user_id",
        );
      const targetType =
        readString(
          record,
          "target_type",
        );
      const targetId =
        readString(
          record,
          "target_id",
        );
      const createdAt =
        readString(
          record,
          "created_at",
        );

      if (
        !id ||
        !userId ||
        !targetType ||
        !isFollowTargetType(
          targetType,
        ) ||
        !targetId ||
        !createdAt
      ) {
        return [];
      }

      return [{
        id,
        userId,
        targetType,
        targetId,
        targetSlug:
          readString(
            record,
            "target_slug",
          ),
        createdAt,
      }];
    },
  );
}

async function loadArtists(
  ids: string[],
): Promise<Map<string, RegistryArtistRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } =
    await supabase
      .from("registry_artists")
      .select(
        "id, slug, display_name, public_image_url",
      )
      .in(
        "id",
        ids,
      )
      .eq(
        "status",
        "active",
      );

  if (error) {
    console.warn(
      "Could not enrich followed Artists:",
      error.message,
    );
    return new Map();
  }

  return new Map(
    (
      data as RegistryArtistRow[] | null
    )?.map(
      (artist) => [
        String(artist.id),
        artist,
      ],
    ) ?? [],
  );
}

async function loadGenres(
  ids: string[],
): Promise<Map<string, RegistryGenreRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } =
    await supabase
      .from("registry_genres")
      .select(
        "id, slug, name",
      )
      .in(
        "id",
        ids,
      )
      .eq(
        "status",
        "active",
      );

  if (error) {
    console.warn(
      "Could not enrich followed Genres:",
      error.message,
    );
    return new Map();
  }

  return new Map(
    (
      data as RegistryGenreRow[] | null
    )?.map(
      (genre) => [
        String(genre.id),
        genre,
      ],
    ) ?? [],
  );
}

async function loadLabels(
  ids: string[],
): Promise<Map<string, RegistryLabelRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } =
    await supabase
      .from("registry_labels")
      .select(
        "id, slug, name",
      )
      .in(
        "id",
        ids,
      )
      .eq(
        "status",
        "active",
      );

  if (error) {
    console.warn(
      "Could not enrich followed Labels:",
      error.message,
    );
    return new Map();
  }

  return new Map(
    (
      data as RegistryLabelRow[] | null
    )?.map(
      (label) => [
        String(label.id),
        label,
      ],
    ) ?? [],
  );
}

async function loadChartPrograms(
  ids: string[],
): Promise<Map<string, ChartProgramRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } =
    await supabase
      .from("wk_chart_programs_v2")
      .select(
        "id, public_slug, public_label",
      )
      .in(
        "id",
        ids,
      );

  if (error) {
    console.warn(
      "Could not enrich followed Charts:",
      error.message,
    );
    return new Map();
  }

  return new Map(
    (
      data as ChartProgramRow[] | null
    )?.map(
      (program) => [
        String(program.id),
        program,
      ],
    ) ?? [],
  );
}

async function loadPeople(
  rows: CommunityFollowRow[],
): Promise<
  Map<
    string,
    Awaited<
      ReturnType<
        typeof getPublicPerson
      >
    >
  >
> {
  const people =
    rows.filter(
      (row) =>
        row.targetType ===
        "person",
    );

  const resolved =
    await Promise.all(
      people.map(
        async (row) => {
          if (!row.targetSlug) {
            return [
              row.targetId,
              null,
            ] as const;
          }

          try {
            return [
              row.targetId,
              await getPublicPerson(
                row.targetSlug,
              ),
            ] as const;
          } catch (error) {
            console.warn(
              "Could not enrich followed Person:",
              error,
            );

            return [
              row.targetId,
              null,
            ] as const;
          }
        },
      ),
    );

  return new Map(resolved);
}

function uniqueIds(
  rows: CommunityFollowRow[],
  type: FollowTargetType,
): string[] {
  return [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.targetType ===
            type,
        )
        .map(
          (row) =>
            row.targetId,
        ),
    ),
  ];
}

export async function hydrateFollowingPresentation(
  rows: CommunityFollowRow[],
): Promise<FollowingPresentationItem[]> {
  const [
    people,
    artists,
    genres,
    labels,
    chartPrograms,
  ] =
    await Promise.all([
      loadPeople(rows),
      loadArtists(
        uniqueIds(
          rows,
          "artist",
        ),
      ),
      loadGenres(
        uniqueIds(
          rows,
          "genre",
        ),
      ),
      loadLabels(
        uniqueIds(
          rows,
          "label",
        ),
      ),
      loadChartPrograms(
        uniqueIds(
          rows,
          "chart_program",
        ),
      ),
    ]);

  return rows.map(
    (row) => {
      const typeLabel =
        followingTargetLabel(
          row.targetType,
        );

      const fallbackTitle =
        titleFromSlug(
          row.targetSlug,
          typeLabel,
        );

      const fallbackPath =
        followingFallbackPath(
          row.targetType,
          row.targetSlug,
        );

      if (
        row.targetType ===
        "person"
      ) {
        const person =
          people.get(
            row.targetId,
          );

        return {
          followId:
            row.id,
          targetType:
            row.targetType,
          targetId:
            row.targetId,
          targetSlug:
            row.targetSlug,
          createdAt:
            row.createdAt,
          title:
            person?.displayName ??
            fallbackTitle,
          imageUrl:
            person?.avatarUrl ??
            null,
          canonicalPath:
            person?.redirectTo ??
            person?.canonicalPath ??
            fallbackPath,
        };
      }

      if (
        row.targetType ===
        "artist"
      ) {
        const artist =
          artists.get(
            row.targetId,
          );

        return {
          followId:
            row.id,
          targetType:
            row.targetType,
          targetId:
            row.targetId,
          targetSlug:
            artist?.slug ??
            row.targetSlug,
          createdAt:
            row.createdAt,
          title:
            artist?.display_name ??
            fallbackTitle,
          imageUrl:
            artist?.public_image_url ??
            null,
          canonicalPath:
            artist?.slug
              ? `/artists/${artist.slug}`
              : fallbackPath,
        };
      }

      if (
        row.targetType ===
        "genre"
      ) {
        const genre =
          genres.get(
            row.targetId,
          );

        return {
          followId:
            row.id,
          targetType:
            row.targetType,
          targetId:
            row.targetId,
          targetSlug:
            genre?.slug ??
            row.targetSlug,
          createdAt:
            row.createdAt,
          title:
            genre?.name ??
            fallbackTitle,
          imageUrl:
            null,
          canonicalPath:
            genre?.slug
              ? `/genres/${genre.slug}`
              : fallbackPath,
        };
      }

      if (
        row.targetType ===
        "label"
      ) {
        const label =
          labels.get(
            row.targetId,
          );

        return {
          followId:
            row.id,
          targetType:
            row.targetType,
          targetId:
            row.targetId,
          targetSlug:
            label?.slug ??
            row.targetSlug,
          createdAt:
            row.createdAt,
          title:
            label?.name ??
            fallbackTitle,
          imageUrl:
            null,
          canonicalPath:
            label?.slug
              ? `/labels/${label.slug}`
              : fallbackPath,
        };
      }

      const program =
        chartPrograms.get(
          row.targetId,
        );

      return {
        followId:
          row.id,
        targetType:
          row.targetType,
        targetId:
          row.targetId,
        targetSlug:
          program?.public_slug ??
          row.targetSlug,
        createdAt:
          row.createdAt,
        title:
          program?.public_label ??
          fallbackTitle,
        imageUrl:
          null,
        canonicalPath:
          program?.public_slug
            ? getCanonicalChartPathFromSlugs(
                program.public_slug,
              )
            : fallbackPath,
      };
    },
  );
}
