import { createRegistryPool, hasTable } from "./phase1-db";

const writeMode = process.argv.includes("--write");

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const sampleLimit = Math.max(1, Math.min(Number(argValue("sample", "10")) || 10, 50));

const multiArtistPattern = "(,| & | and | feat\\.?| ft\\.?| featuring | with | x )";

async function assertRequiredTables(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  const required = [
    "registry_artists",
    "registry_releases",
    "registry_tracks",
    "registry_review_items",
    "registry_audit_log",
  ];

  for (const table of required) {
    if (!(await hasTable(pool, `public.${table}`))) {
      throw new Error(`Required table missing: public.${table}. Run npm run registry:phase2:review-schema first.`);
    }
  }
}

async function printQuery(pool: ReturnType<typeof createRegistryPool>, label: string, sql: string, values: unknown[] = []): Promise<void> {
  console.log(`\n${label}`);
  console.log("-".repeat(80));
  const result = await pool.query(sql, values);
  console.table(result.rows);
}

async function dryRun(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  await printQuery(pool, "Review item candidates by type", `
    with release_base as (
      select
        rr.id,
        rr.slug,
        rr.title,
        coalesce(
          nullif(rr.metadata->>'primary_artist_name', ''),
          nullif(rr.metadata->>'primaryArtistName', ''),
          nullif(rr.metadata->>'artist_name', ''),
          nullif(rr.metadata->>'artistName', ''),
          nullif(rr.metadata->>'artist_display', ''),
          nullif(rr.metadata->>'artistDisplay', ''),
          nullif(rr.metadata->>'artists', ''),
          ''
        ) as artist_text,
        coalesce(
          nullif(rr.metadata->>'artist_slug', ''),
          nullif(rr.metadata->>'primary_artist_slug', ''),
          nullif(rr.metadata->>'artistSlug', ''),
          nullif(rr.metadata->>'primaryArtistSlug', ''),
          ''
        ) as artist_slug
      from public.registry_releases rr
      where coalesce(rr.status, 'active') not in ('archived', 'deleted', 'trash')
    ),
    release_candidates as (
      select
        case
          when artist_slug = '' and artist_text = '' then 'release_artist_missing_metadata'
          when artist_slug = '' and lower(artist_text) ~ $1 then 'release_artist_ambiguous_metadata'
          when artist_slug = '' and artist_text <> '' and not exists (
            select 1 from public.registry_artists ra
            where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
              and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(artist_text)
          ) then 'release_artist_unmatched_single_metadata'
          when artist_slug <> '' and not exists (
            select 1 from public.registry_artists ra
            where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
              and (ra.slug = artist_slug or ra.slug = regexp_replace(lower(artist_slug), '[^a-z0-9]+', '-', 'g'))
          ) then 'release_artist_unmatched_slug_metadata'
          else null
        end as review_type
      from release_base
    ),
    track_base as (
      select
        rt.id,
        rt.slug,
        rt.title,
        coalesce(
          nullif(rt.metadata->>'primary_artist_name', ''),
          nullif(rt.metadata->>'primaryArtistName', ''),
          nullif(rt.metadata->>'artist_name', ''),
          nullif(rt.metadata->>'artistName', ''),
          nullif(rt.metadata->>'artist_display', ''),
          nullif(rt.metadata->>'artistDisplay', ''),
          nullif(rt.metadata->>'artists', ''),
          ''
        ) as artist_text,
        coalesce(
          nullif(rt.metadata->>'artist_slug', ''),
          nullif(rt.metadata->>'primary_artist_slug', ''),
          nullif(rt.metadata->>'artistSlug', ''),
          nullif(rt.metadata->>'primaryArtistSlug', ''),
          ''
        ) as artist_slug
      from public.registry_tracks rt
      where coalesce(rt.status, 'active') not in ('archived', 'deleted', 'trash')
    ),
    track_candidates as (
      select
        case
          when artist_slug = '' and artist_text = '' then 'track_artist_missing_metadata'
          when artist_slug = '' and lower(artist_text) ~ $1 then 'track_artist_ambiguous_metadata'
          when artist_slug = '' and artist_text <> '' and not exists (
            select 1 from public.registry_artists ra
            where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
              and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(artist_text)
          ) then 'track_artist_unmatched_single_metadata'
          when artist_slug <> '' and not exists (
            select 1 from public.registry_artists ra
            where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
              and (ra.slug = artist_slug or ra.slug = regexp_replace(lower(artist_slug), '[^a-z0-9]+', '-', 'g'))
          ) then 'track_artist_unmatched_slug_metadata'
          else null
        end as review_type
      from track_base
    ),
    combined as (
      select review_type from release_candidates where review_type is not null
      union all
      select review_type from track_candidates where review_type is not null
    )
    select review_type, count(*)::int as candidates
    from combined
    group by review_type
    order by candidates desc, review_type asc
  `, [multiArtistPattern]);

  await printQuery(pool, "Existing review queue status", `
    select status, review_type, count(*)::int as count
    from public.registry_review_items
    group by status, review_type
    order by count desc, review_type asc
  `);

  await printQuery(pool, "Sample release review candidates", `
    with release_base as (
      select
        rr.id,
        rr.slug,
        rr.title,
        coalesce(
          nullif(rr.metadata->>'primary_artist_name', ''),
          nullif(rr.metadata->>'primaryArtistName', ''),
          nullif(rr.metadata->>'artist_name', ''),
          nullif(rr.metadata->>'artistName', ''),
          nullif(rr.metadata->>'artist_display', ''),
          nullif(rr.metadata->>'artistDisplay', ''),
          nullif(rr.metadata->>'artists', ''),
          ''
        ) as artist_text,
        coalesce(
          nullif(rr.metadata->>'artist_slug', ''),
          nullif(rr.metadata->>'primary_artist_slug', ''),
          nullif(rr.metadata->>'artistSlug', ''),
          nullif(rr.metadata->>'primaryArtistSlug', ''),
          ''
        ) as artist_slug
      from public.registry_releases rr
      where coalesce(rr.status, 'active') not in ('archived', 'deleted', 'trash')
    )
    select
      title,
      artist_text,
      artist_slug,
      case
        when artist_slug = '' and artist_text = '' then 'release_artist_missing_metadata'
        when artist_slug = '' and lower(artist_text) ~ $1 then 'release_artist_ambiguous_metadata'
        when artist_slug = '' and artist_text <> '' then 'release_artist_unmatched_single_metadata'
        when artist_slug <> '' then 'release_artist_unmatched_slug_metadata'
      end as likely_review_type
    from release_base rb
    where (
      artist_slug = '' and artist_text = ''
    ) or (
      artist_slug = '' and lower(artist_text) ~ $1
    ) or (
      artist_slug = '' and artist_text <> '' and not exists (
        select 1 from public.registry_artists ra
        where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
          and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(rb.artist_text)
      )
    ) or (
      artist_slug <> '' and not exists (
        select 1 from public.registry_artists ra
        where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
          and (ra.slug = rb.artist_slug or ra.slug = regexp_replace(lower(rb.artist_slug), '[^a-z0-9]+', '-', 'g'))
      )
    )
    order by title asc
    limit $2
  `, [multiArtistPattern, sampleLimit]);

  await printQuery(pool, "Sample track review candidates", `
    with track_base as (
      select
        rt.id,
        rt.slug,
        rt.title,
        coalesce(
          nullif(rt.metadata->>'primary_artist_name', ''),
          nullif(rt.metadata->>'primaryArtistName', ''),
          nullif(rt.metadata->>'artist_name', ''),
          nullif(rt.metadata->>'artistName', ''),
          nullif(rt.metadata->>'artist_display', ''),
          nullif(rt.metadata->>'artistDisplay', ''),
          nullif(rt.metadata->>'artists', ''),
          ''
        ) as artist_text,
        coalesce(
          nullif(rt.metadata->>'artist_slug', ''),
          nullif(rt.metadata->>'primary_artist_slug', ''),
          nullif(rt.metadata->>'artistSlug', ''),
          nullif(rt.metadata->>'primaryArtistSlug', ''),
          ''
        ) as artist_slug
      from public.registry_tracks rt
      where coalesce(rt.status, 'active') not in ('archived', 'deleted', 'trash')
    )
    select
      title,
      artist_text,
      artist_slug,
      case
        when artist_slug = '' and artist_text = '' then 'track_artist_missing_metadata'
        when artist_slug = '' and lower(artist_text) ~ $1 then 'track_artist_ambiguous_metadata'
        when artist_slug = '' and artist_text <> '' then 'track_artist_unmatched_single_metadata'
        when artist_slug <> '' then 'track_artist_unmatched_slug_metadata'
      end as likely_review_type
    from track_base tb
    where (
      artist_slug = '' and artist_text = ''
    ) or (
      artist_slug = '' and lower(artist_text) ~ $1
    ) or (
      artist_slug = '' and artist_text <> '' and not exists (
        select 1 from public.registry_artists ra
        where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
          and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(tb.artist_text)
      )
    ) or (
      artist_slug <> '' and not exists (
        select 1 from public.registry_artists ra
        where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
          and (ra.slug = tb.artist_slug or ra.slug = regexp_replace(lower(tb.artist_slug), '[^a-z0-9]+', '-', 'g'))
      )
    )
    order by title asc
    limit $2
  `, [multiArtistPattern, sampleLimit]);
}

async function writeReviewItems(pool: ReturnType<typeof createRegistryPool>): Promise<void> {
  await pool.query("begin");

  await printQuery(pool, "Insert release review items", `
    with release_base as (
      select
        rr.id,
        rr.slug,
        rr.title,
        rr.metadata,
        coalesce(
          nullif(rr.metadata->>'primary_artist_name', ''),
          nullif(rr.metadata->>'primaryArtistName', ''),
          nullif(rr.metadata->>'artist_name', ''),
          nullif(rr.metadata->>'artistName', ''),
          nullif(rr.metadata->>'artist_display', ''),
          nullif(rr.metadata->>'artistDisplay', ''),
          nullif(rr.metadata->>'artists', ''),
          ''
        ) as artist_text,
        coalesce(
          nullif(rr.metadata->>'artist_slug', ''),
          nullif(rr.metadata->>'primary_artist_slug', ''),
          nullif(rr.metadata->>'artistSlug', ''),
          nullif(rr.metadata->>'primaryArtistSlug', ''),
          ''
        ) as artist_slug
      from public.registry_releases rr
      where coalesce(rr.status, 'active') not in ('archived', 'deleted', 'trash')
    ),
    candidates as (
      select
        'phase2:release_artist:' || id::text || ':' ||
          case
            when artist_slug = '' and artist_text = '' then 'missing_metadata'
            when artist_slug = '' and lower(artist_text) ~ $1 then 'ambiguous_metadata'
            when artist_slug = '' and artist_text <> '' and not exists (
              select 1 from public.registry_artists ra
              where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
                and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(artist_text)
            ) then 'unmatched_single_metadata'
            when artist_slug <> '' and not exists (
              select 1 from public.registry_artists ra
              where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
                and (ra.slug = artist_slug or ra.slug = regexp_replace(lower(artist_slug), '[^a-z0-9]+', '-', 'g'))
            ) then 'unmatched_slug_metadata'
          end as review_key,
        id as entity_id,
        case
          when artist_slug = '' and artist_text = '' then 'release_artist_missing_metadata'
          when artist_slug = '' and lower(artist_text) ~ $1 then 'release_artist_ambiguous_metadata'
          when artist_slug = '' and artist_text <> '' then 'release_artist_unmatched_single_metadata'
          when artist_slug <> '' then 'release_artist_unmatched_slug_metadata'
        end as review_type,
        case
          when artist_slug = '' and artist_text = '' then 'high'
          when artist_slug = '' and lower(artist_text) ~ $1 then 'high'
          else 'normal'
        end as priority,
        title,
        slug,
        artist_text,
        artist_slug,
        metadata
      from release_base rb
      where (
        artist_slug = '' and artist_text = ''
      ) or (
        artist_slug = '' and lower(artist_text) ~ $1
      ) or (
        artist_slug = '' and artist_text <> '' and not exists (
          select 1 from public.registry_artists ra
          where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
            and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(rb.artist_text)
        )
      ) or (
        artist_slug <> '' and not exists (
          select 1 from public.registry_artists ra
          where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
            and (ra.slug = rb.artist_slug or ra.slug = regexp_replace(lower(rb.artist_slug), '[^a-z0-9]+', '-', 'g'))
        )
      )
    ),
    inserted as (
      insert into public.registry_review_items (
        review_key,
        entity_type,
        entity_id,
        review_type,
        priority,
        status,
        title,
        summary,
        source_table,
        source_id,
        source_payload,
        candidate_payload,
        updated_at
      )
      select
        review_key,
        'release',
        entity_id,
        review_type,
        priority,
        'open',
        'Review release artist credit: ' || coalesce(title, slug, entity_id::text),
        'Release artist relationship could not be safely canonicalized during Phase 1.',
        'registry_releases',
        entity_id::text,
        jsonb_build_object('title', title, 'slug', slug, 'metadata', metadata),
        jsonb_build_object('artistText', artist_text, 'artistSlug', artist_slug, 'reviewType', review_type),
        now()
      from candidates
      where review_key is not null and review_type is not null
      on conflict (review_key) do nothing
      returning 1
    )
    select count(*)::int as inserted from inserted
  `, [multiArtistPattern]);

  await printQuery(pool, "Insert track review items", `
    with track_base as (
      select
        rt.id,
        rt.slug,
        rt.title,
        rt.metadata,
        coalesce(
          nullif(rt.metadata->>'primary_artist_name', ''),
          nullif(rt.metadata->>'primaryArtistName', ''),
          nullif(rt.metadata->>'artist_name', ''),
          nullif(rt.metadata->>'artistName', ''),
          nullif(rt.metadata->>'artist_display', ''),
          nullif(rt.metadata->>'artistDisplay', ''),
          nullif(rt.metadata->>'artists', ''),
          ''
        ) as artist_text,
        coalesce(
          nullif(rt.metadata->>'artist_slug', ''),
          nullif(rt.metadata->>'primary_artist_slug', ''),
          nullif(rt.metadata->>'artistSlug', ''),
          nullif(rt.metadata->>'primaryArtistSlug', ''),
          ''
        ) as artist_slug
      from public.registry_tracks rt
      where coalesce(rt.status, 'active') not in ('archived', 'deleted', 'trash')
    ),
    candidates as (
      select
        'phase2:track_artist:' || id::text || ':' ||
          case
            when artist_slug = '' and artist_text = '' then 'missing_metadata'
            when artist_slug = '' and lower(artist_text) ~ $1 then 'ambiguous_metadata'
            when artist_slug = '' and artist_text <> '' and not exists (
              select 1 from public.registry_artists ra
              where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
                and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(artist_text)
            ) then 'unmatched_single_metadata'
            when artist_slug <> '' and not exists (
              select 1 from public.registry_artists ra
              where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
                and (ra.slug = artist_slug or ra.slug = regexp_replace(lower(artist_slug), '[^a-z0-9]+', '-', 'g'))
            ) then 'unmatched_slug_metadata'
          end as review_key,
        id as entity_id,
        case
          when artist_slug = '' and artist_text = '' then 'track_artist_missing_metadata'
          when artist_slug = '' and lower(artist_text) ~ $1 then 'track_artist_ambiguous_metadata'
          when artist_slug = '' and artist_text <> '' then 'track_artist_unmatched_single_metadata'
          when artist_slug <> '' then 'track_artist_unmatched_slug_metadata'
        end as review_type,
        case
          when artist_slug = '' and artist_text = '' then 'high'
          when artist_slug = '' and lower(artist_text) ~ $1 then 'high'
          else 'normal'
        end as priority,
        title,
        slug,
        artist_text,
        artist_slug,
        metadata
      from track_base tb
      where (
        artist_slug = '' and artist_text = ''
      ) or (
        artist_slug = '' and lower(artist_text) ~ $1
      ) or (
        artist_slug = '' and artist_text <> '' and not exists (
          select 1 from public.registry_artists ra
          where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
            and lower(coalesce(ra.display_name, ra.normalized_name, ra.slug)) = lower(tb.artist_text)
        )
      ) or (
        artist_slug <> '' and not exists (
          select 1 from public.registry_artists ra
          where coalesce(ra.status, 'active') not in ('archived', 'deleted', 'trash')
            and (ra.slug = tb.artist_slug or ra.slug = regexp_replace(lower(tb.artist_slug), '[^a-z0-9]+', '-', 'g'))
        )
      )
    ),
    inserted as (
      insert into public.registry_review_items (
        review_key,
        entity_type,
        entity_id,
        review_type,
        priority,
        status,
        title,
        summary,
        source_table,
        source_id,
        source_payload,
        candidate_payload,
        updated_at
      )
      select
        review_key,
        'track',
        entity_id,
        review_type,
        priority,
        'open',
        'Review track artist credit: ' || coalesce(title, slug, entity_id::text),
        'Track artist relationship could not be safely canonicalized during Phase 1.',
        'registry_tracks',
        entity_id::text,
        jsonb_build_object('title', title, 'slug', slug, 'metadata', metadata),
        jsonb_build_object('artistText', artist_text, 'artistSlug', artist_slug, 'reviewType', review_type),
        now()
      from candidates
      where review_key is not null and review_type is not null
      on conflict (review_key) do nothing
      returning 1
    )
    select count(*)::int as inserted from inserted
  `, [multiArtistPattern]);

  await printQuery(pool, "Write Phase 2 review queue audit log", `
    insert into public.registry_audit_log (actor_label, action, entity_type, metadata)
    values (
      'system',
      'phase2_review_items_populated',
      'registry_review_items',
      jsonb_build_object(
        'destructiveChanges', false,
        'publicRenderingChanged', false,
        'publicApiChanged', false,
        'canonicalEntitiesChanged', false,
        'source', 'phase2_populate_review_items'
      )
    )
    returning id, action, created_at
  `);

  await pool.query("commit");
}

async function main() {
  const pool = createRegistryPool();

  try {
    await pool.query("select 1");
    await assertRequiredTables(pool);

    console.log("\nWAKILISHA Phase 2 Review Queue Population");
    console.log("=".repeat(80));
    console.log(writeMode ? "Mode: WRITE. Review items will be inserted idempotently." : "Mode: DRY RUN. No data will be written.");
    console.log(`Sample limit: ${sampleLimit}`);
    console.log("");

    await dryRun(pool);

    if (!writeMode) {
      console.log("\nDry run complete. No writes performed.");
      console.log("To populate review items, rerun with: npm run registry:phase2:populate-review -- --write");
      return;
    }

    await writeReviewItems(pool);

    console.log("\nWrite complete. Phase 2 review items were inserted idempotently.");
    console.log("No public rendering, public API, or canonical entity data was changed.");
  } catch (error) {
    await pool.query("rollback").catch(() => undefined);
    console.error("[phase2-populate-review-items] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
