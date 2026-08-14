import { supabase } from "@/lib/supabase";
import { buildUtmUrl } from "@/services/attribution";

export type ArtistLaunchTargetType =
  | "artist"
  | "release"
  | "track"
  | "artist_update";

export type ArtistLaunchTarget = {
  type: ArtistLaunchTargetType;
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  path: string;
  publishedAt: string | null;
};

export type ArtistLaunchContentMetric = {
  type: ArtistLaunchTargetType;
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  path: string;
  views: number;
  plays: number;
  completedPlays: number;
  shares: number;
};

export type ArtistLaunchCampaignMetric = {
  campaign: string;
  source: string;
  views: number;
  visitors: number;
};

export type ArtistLaunchAnalytics = {
  artist: {
    id: string;
    slug: string;
    name: string;
  };
  rangeDays: 7 | 30 | 90;
  since: string;
  generatedAt: string;
  summary: {
    views: number;
    profileViews: number;
    musicViews: number;
    updateViews: number;
    plays: number;
    completedPlays: number;
    shares: number;
    visitors: number;
    followers: number;
    newFollowers: number;
  };
  launchTargets: ArtistLaunchTarget[];
  topContent: ArtistLaunchContentMetric[];
  launchCampaigns: ArtistLaunchCampaignMetric[];
};

type JsonRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown,
): JsonRecord | null {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonRecord;
}

function readString(
  record: JsonRecord | null,
  key: string,
): string | null {
  const value =
    record?.[key];

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const clean =
    value.trim();

  return clean || null;
}

function readNumber(
  record: JsonRecord | null,
  key: string,
): number {
  const value =
    record?.[key];

  const parsed =
    typeof value === "number"
      ? value
      : Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function mapTarget(
  value: unknown,
): ArtistLaunchTarget | null {
  const row =
    asRecord(value);

  const type =
    readString(row, "type");
  const id =
    readString(row, "id");
  const slug =
    readString(row, "slug");
  const title =
    readString(row, "title");
  const path =
    readString(row, "path");

  if (
    !row
    || !id
    || !slug
    || !title
    || !path
    || ![
      "artist",
      "release",
      "track",
      "artist_update",
    ].includes(type ?? "")
  ) {
    return null;
  }

  return {
    type:
      type as ArtistLaunchTargetType,
    id,
    slug,
    title,
    imageUrl:
      readString(
        row,
        "image_url",
      ),
    path,
    publishedAt:
      readString(
        row,
        "published_at",
      ),
  };
}

function mapContentMetric(
  value: unknown,
): ArtistLaunchContentMetric | null {
  const target =
    mapTarget(value);
  const row =
    asRecord(value);

  if (
    !target
    || !row
  ) {
    return null;
  }

  return {
    ...target,
    views:
      readNumber(
        row,
        "views",
      ),
    plays:
      readNumber(
        row,
        "plays",
      ),
    completedPlays:
      readNumber(
        row,
        "completed_plays",
      ),
    shares:
      readNumber(
        row,
        "shares",
      ),
  };
}

function mapCampaign(
  value: unknown,
): ArtistLaunchCampaignMetric | null {
  const row =
    asRecord(value);
  const campaign =
    readString(
      row,
      "campaign",
    );
  const source =
    readString(
      row,
      "source",
    );

  if (
    !row
    || !campaign
    || !source
  ) {
    return null;
  }

  return {
    campaign,
    source,
    views:
      readNumber(
        row,
        "views",
      ),
    visitors:
      readNumber(
        row,
        "visitors",
      ),
  };
}

function normalizeLaunchKey(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .slice(
      0,
      80,
    );
}

export function buildArtistLaunchLink(
  input: {
    target: ArtistLaunchTarget;
    source: string;
    campaign: string;
  },
): string {
  const source =
    normalizeLaunchKey(
      input.source,
    );

  const campaign =
    normalizeLaunchKey(
      input.campaign,
    );

  if (
    !source
    || !campaign
  ) {
    return "";
  }

  return buildUtmUrl(
    `https://wakilisha.africa${input.target.path}`,
    {
      source,
      medium:
        "artist_launch",
      campaign,
      content:
        input.target.type,
    },
  );
}

export async function getArtistLaunchAnalytics(
  artistId: string,
  days: 7 | 30 | 90 = 30,
): Promise<ArtistLaunchAnalytics> {
  const invoke =
    supabase.rpc as unknown as (
      functionName: string,
      parameters?: Record<string, unknown>,
    ) => Promise<{
      data: unknown;
      error:
        | {
            message?: string;
          }
        | null;
    }>;

  const {
    data,
    error,
  } =
    await invoke(
      "community_get_artist_launch_analytics",
      {
        p_artist_id:
          artistId,
        p_days:
          days,
      },
    );

  if (error) {
    throw new Error(
      error.message
      || "Artist performance could not be loaded.",
    );
  }

  const envelope =
    asRecord(data);
  const artist =
    asRecord(
      envelope?.artist,
    );
  const summary =
    asRecord(
      envelope?.summary,
    );

  const artistIdValue =
    readString(
      artist,
      "id",
    );
  const artistSlug =
    readString(
      artist,
      "slug",
    );
  const artistName =
    readString(
      artist,
      "name",
    );
  const since =
    readString(
      envelope,
      "since",
    );
  const generatedAt =
    readString(
      envelope,
      "generated_at",
    );

  const rangeDays =
    readNumber(
      envelope,
      "range_days",
    );

  if (
    !envelope
    || !artistIdValue
    || !artistSlug
    || !artistName
    || !since
    || !generatedAt
    || ![
      7,
      30,
      90,
    ].includes(rangeDays)
  ) {
    throw new Error(
      "Artist performance returned an invalid response.",
    );
  }

  const launchTargets =
    Array.isArray(
      envelope.launch_targets,
    )
      ? envelope.launch_targets.flatMap(
          (value) => {
            const target =
              mapTarget(value);

            return target
              ? [target]
              : [];
          },
        )
      : [];

  const topContent =
    Array.isArray(
      envelope.top_content,
    )
      ? envelope.top_content.flatMap(
          (value) => {
            const item =
              mapContentMetric(value);

            return item
              ? [item]
              : [];
          },
        )
      : [];

  const launchCampaigns =
    Array.isArray(
      envelope.launch_campaigns,
    )
      ? envelope.launch_campaigns.flatMap(
          (value) => {
            const item =
              mapCampaign(value);

            return item
              ? [item]
              : [];
          },
        )
      : [];

  return {
    artist: {
      id:
        artistIdValue,
      slug:
        artistSlug,
      name:
        artistName,
    },
    rangeDays:
      rangeDays as 7 | 30 | 90,
    since,
    generatedAt,
    summary: {
      views:
        readNumber(
          summary,
          "views",
        ),
      profileViews:
        readNumber(
          summary,
          "profile_views",
        ),
      musicViews:
        readNumber(
          summary,
          "music_views",
        ),
      updateViews:
        readNumber(
          summary,
          "update_views",
        ),
      plays:
        readNumber(
          summary,
          "plays",
        ),
      completedPlays:
        readNumber(
          summary,
          "completed_plays",
        ),
      shares:
        readNumber(
          summary,
          "shares",
        ),
      visitors:
        readNumber(
          summary,
          "visitors",
        ),
      followers:
        readNumber(
          summary,
          "followers",
        ),
      newFollowers:
        readNumber(
          summary,
          "new_followers",
        ),
    },
    launchTargets,
    topContent,
    launchCampaigns,
  };
}
