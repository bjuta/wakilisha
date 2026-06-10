import type { PgPool } from "../enrichment-review-runtime-api";
import type { ProviderSearchResult, RegistryMatchCandidate } from "./types";

export async function findRegistryMatchCandidates(
  pool: PgPool,
  result: ProviderSearchResult,
): Promise<{
  artists: RegistryMatchCandidate[];
  releases: RegistryMatchCandidate[];
  tracks: RegistryMatchCandidate[];
}> {
  const candidates: {
    artists: RegistryMatchCandidate[];
    releases: RegistryMatchCandidate[];
    tracks: RegistryMatchCandidate[];
  } = { artists: [], releases: [], tracks: [] };

  if (result.providerEntityType === "release") {
    // Search by exact provider link
    const providerLinkResult = await pool.query(
      `
        select registry_entity_id::text as "registryEntityId", provider_entity_id
        from public.provider_entity_links
        where provider = $1
          and provider_entity_id = $2
          and registry_entity_type = 'release'
        limit 1
      `,
      [result.provider, result.providerEntityId],
    );

    if (providerLinkResult.rows[0]) {
      candidates.releases.push({
        registryEntityId: String(providerLinkResult.rows[0].registryEntityId),
        entityType: "release",
        title: result.title,
        matchReason: "Exact provider link exists",
        matchScore: 1.0,
      });
    }

    // Search by UPC
    const upcField = result.summaryFields.find((f) => f.key === "upc");
    if (upcField?.value) {
      const upcResult = await pool.query(
        `
          select id::text as "registryEntityId", title
          from public.registry_releases
          where upc = $1
          limit 1
        `,
        [String(upcField.value)],
      );

      if (upcResult.rows[0]) {
        candidates.releases.push({
          registryEntityId: String(upcResult.rows[0].registryEntityId),
          entityType: "release",
          title: String(upcResult.rows[0].title ?? result.title),
          matchReason: "Same UPC found",
          matchScore: 0.95,
        });
      }
    }

    // Search by title + artist (loose match)
    if (result.artistDisplayName) {
      const titleResult = await pool.query(
        `
          select id::text as "registryEntityId", title
          from public.registry_releases
          where (
            lower(title) = lower($1)
            or lower(title) similar to lower($2)
          )
          and (
            lower(artist_display_name) = lower($3)
            or lower(artist_display_name) similar to lower($4)
          )
          limit 3
        `,
        [
          result.title,
          `%${result.title.toLowerCase()}%`,
          result.artistDisplayName,
          `%${result.artistDisplayName.toLowerCase()}%`,
        ],
      );

      for (const row of titleResult.rows) {
        const id = String(row.registryEntityId);
        if (!candidates.releases.some((c) => c.registryEntityId === id)) {
          candidates.releases.push({
            registryEntityId: id,
            entityType: "release",
            title: String(row.title ?? result.title),
            matchReason: "Same title + artist found",
            matchScore: 0.85,
          });
        }
      }
    }
  }

  if (result.providerEntityType === "track") {
    const isrcField = result.summaryFields.find((f) => f.key === "isrc");
    if (isrcField?.value) {
      const isrcResult = await pool.query(
        `
          select id::text as "registryEntityId", title
          from public.registry_tracks
          where isrc = $1
          limit 1
        `,
        [String(isrcField.value)],
      );

      if (isrcResult.rows[0]) {
        candidates.tracks.push({
          registryEntityId: String(isrcResult.rows[0].registryEntityId),
          entityType: "track",
          title: String(isrcResult.rows[0].title ?? result.title),
          matchReason: "Same ISRC found",
          matchScore: 0.98,
        });
      }
    }
  }

  if (result.providerEntityType === "artist" || result.artistDisplayName) {
    const artistName = result.providerEntityType === "artist" ? result.title : result.artistDisplayName;
    if (artistName) {
      const artistResult = await pool.query(
        `
          select id::text as "registryEntityId", name as title
          from public.registry_artists
          where lower(name) = lower($1)
          limit 3
        `,
        [artistName],
      );

      for (const row of artistResult.rows) {
        candidates.artists.push({
          registryEntityId: String(row.registryEntityId),
          entityType: "artist",
          title: String(row.title ?? artistName),
          matchReason: "Same artist name found",
          matchScore: 0.9,
        });
      }
    }
  }

  return candidates;
}

export async function findExistingShellMatches(
  pool: PgPool,
  provider: string,
  providerEntityId: string,
): Promise<Array<{
  shellKey: string;
  registryEntityId: string;
  status: string;
  title: string;
  providerEntityId: string;
}>> {
  const result = await pool.query(
    `
      select
        pel.registry_entity_id::text as "registryEntityId",
        pel.provider_entity_id as "providerEntityId",
        coalesce(
          (select distinct on (registry_entity_id) status
           from public.registry_release_shell_lifecycle_events
           where registry_entity_id::text = pel.registry_entity_id::text
           order by registry_entity_id, created_at desc),
          'open'
        ) as "status",
        coalesce(
          (select title from public.registry_releases where id::text = pel.registry_entity_id::text limit 1),
          (select max(suggested_value) from public.registry_enrichment_suggestions
           where registry_entity_id::text = pel.registry_entity_id::text and field_name = 'title'),
          pel.registry_entity_id::text
        ) as "title"
      from public.provider_entity_links pel
      where pel.provider = $1
        and pel.provider_entity_id = $2
        and pel.registry_entity_type = 'release'
      limit 5
    `,
    [provider, providerEntityId],
  );

  return result.rows.map((row) => ({
    shellKey: `runtime:${provider}:${String(row.providerEntityId)}`,
    registryEntityId: String(row.registryEntityId),
    status: String(row.status),
    title: String(row.title),
    providerEntityId: String(row.providerEntityId),
  }));
}