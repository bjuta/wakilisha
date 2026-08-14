begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4a_admin_read_preflight$
declare
  v_count bigint;
  v_text text;
begin
  if to_regprocedure(
    'media.require_media_read_actor()'
  ) is null then
    raise exception
      'STOP: Media read authority is missing';
  end if;

  if to_regprocedure(
    'public.read_media_assets_admin_v2(jsonb)'
  ) is not null then
    raise exception
      'STOP: Administrative Media read adapter already exists';
  end if;

  if (select count(*) from media.assets) <> 1079
     or (
       select count(*)
       from media.legacy_asset_links
     ) <> 1079
     or (
       select count(*)
       from media.usage_links
     ) <> 987
     or (
       select count(*)
       from public.registry_media_assets
     ) <> 1079
  then
    raise exception
      'STOP: Accepted Media authority counts changed';
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
  ) <> 0 then
    raise exception
      'STOP: Immutable file or variant proof appeared before this migration';
  end if;

  select count(*)
  into v_count
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name = 'registry_media_assets';

  if v_count <> 25 then
    raise exception
      'STOP: Expected 25 compatibility grants, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'registry_media_assets';

  if v_count <> 5 then
    raise exception
      'STOP: Expected 5 compatibility policies, found %',
      v_count;
  end if;

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          source_schema.nspname,
          source_table.relname,
          constraint_row.conname,
          pg_get_constraintdef(
            constraint_row.oid,
            true
          )
        ),
        E'\n'
        order by
          source_schema.nspname,
          source_table.relname,
          constraint_row.conname
      ),
      ''
    )
  )
  into v_text
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid = constraint_row.conrelid
  join pg_namespace source_schema
    on source_schema.oid = source_table.relnamespace
  join pg_class target_table
    on target_table.oid = constraint_row.confrelid
  join pg_namespace target_schema
    on target_schema.oid = target_table.relnamespace
  where constraint_row.contype = 'f'
    and source_schema.nspname <> 'media'
    and target_schema.nspname = 'public'
    and target_table.relname = 'registry_media_assets';

  if v_text <> '54274ae6a613d38c257c543ccf7050cc' then
    raise exception
      'STOP: External compatibility foreign-key perimeter changed: %',
      v_text;
  end if;
end;
$phase_4a_admin_read_preflight$;

create or replace function public.read_media_assets_admin_v2(
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_query jsonb := coalesce(
    p_query,
    '{}'::jsonb
  );
  v_limit integer;
  v_offset integer;
  v_order_by text;
  v_ascending boolean;
  v_include_references boolean;
  v_result jsonb;
begin
  perform media.require_media_read_actor();

  if jsonb_typeof(v_query) <> 'object' then
    raise exception
      'Administrative Media query must be a JSON object';
  end if;

  if v_query ? 'asset_ids'
     and jsonb_typeof(v_query -> 'asset_ids') <> 'array'
  then
    raise exception
      'Administrative Media asset_ids must be an array';
  end if;

  if v_query ? 'urls'
     and jsonb_typeof(v_query -> 'urls') <> 'array'
  then
    raise exception
      'Administrative Media urls must be an array';
  end if;

  if v_query ? 'source_keys'
     and jsonb_typeof(v_query -> 'source_keys') <> 'array'
  then
    raise exception
      'Administrative Media source_keys must be an array';
  end if;

  v_limit := coalesce(
    nullif(v_query ->> 'limit', '')::integer,
    50
  );
  v_offset := coalesce(
    nullif(v_query ->> 'offset', '')::integer,
    0
  );
  v_order_by := coalesce(
    nullif(btrim(v_query ->> 'order_by'), ''),
    'created_at'
  );
  v_ascending := coalesce(
    nullif(v_query ->> 'ascending', '')::boolean,
    false
  );
  v_include_references := coalesce(
    nullif(
      v_query ->> 'include_references',
      ''
    )::boolean,
    false
  );

  if v_limit < 1 or v_limit > 200 then
    raise exception
      'Administrative Media limit must be between 1 and 200';
  end if;

  if v_offset < 0 then
    raise exception
      'Administrative Media offset cannot be negative';
  end if;

  if v_order_by not in (
    'created_at',
    'updated_at',
    'title',
    'content_date'
  ) then
    raise exception
      'Unsupported administrative Media order';
  end if;

  with asset_ids as (
    select value::uuid as asset_id
    from jsonb_array_elements_text(
      coalesce(
        v_query -> 'asset_ids',
        '[]'::jsonb
      )
    )
  ),
  urls as (
    select value as asset_url
    from jsonb_array_elements_text(
      coalesce(
        v_query -> 'urls',
        '[]'::jsonb
      )
    )
  ),
  source_keys as (
    select value as source_key
    from jsonb_array_elements_text(
      coalesce(
        v_query -> 'source_keys',
        '[]'::jsonb
      )
    )
  ),
  filtered as (
    select
      compatibility.id,
      compatibility.slug,
      compatibility.title,
      compatibility.url,
      compatibility.mime_type,
      compatibility.media_kind,
      compatibility.status,
      compatibility.source_kind,
      compatibility.source_entity,
      compatibility.source_record_id,
      compatibility.source_staging_record_id,
      compatibility.storage_bucket,
      compatibility.storage_path,
      compatibility.folder_id,
      compatibility.file_kind,
      compatibility.asset_purpose,
      compatibility.display_filename,
      compatibility.original_filename,
      compatibility.file_extension,
      compatibility.file_size_bytes,
      compatibility.content_date,
      compatibility.rights_status,
      compatibility.credit_text,
      compatibility.country_code,
      compatibility.language_code,
      compatibility.tags,
      compatibility.internal_notes,
      compatibility.metadata,
      compatibility.created_at,
      compatibility.updated_at,
      bridge.asset_id as canonical_asset_id,
      asset.lifecycle_state as canonical_lifecycle_state,
      asset.authority_revision,
      asset.current_revision_id,
      asset.current_governance_version_id,
      governance.consent_status,
      governance.sensitivity,
      governance.public_safety_state,
      coalesce(
        usage_count.active_usage_count,
        0
      ) as active_usage_count
    from public.registry_media_assets compatibility
    left join media.legacy_asset_links bridge
      on bridge.legacy_asset_id = compatibility.id
    left join media.assets asset
      on asset.id = bridge.asset_id
    left join media.asset_governance_versions governance
      on governance.id =
        asset.current_governance_version_id
    left join lateral (
      select count(*)::bigint as active_usage_count
      from media.usage_links usage
      where usage.asset_id = bridge.asset_id
        and usage.usage_state = 'active'
    ) usage_count
      on true
    where (
      not (v_query ? 'asset_ids')
      or compatibility.id in (
        select asset_id
        from asset_ids
      )
    )
    and (
      not (v_query ? 'urls')
      or compatibility.url in (
        select asset_url
        from urls
      )
    )
    and (
      not (v_query ? 'source_keys')
      or compatibility.source_entity in (
        select source_key
        from source_keys
      )
      or compatibility.source_record_id::text in (
        select source_key
        from source_keys
      )
    )
    and (
      nullif(
        btrim(v_query ->> 'search'),
        ''
      ) is null
      or compatibility.title ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.slug ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.url ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.source_record_id::text ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.display_filename ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.original_filename ilike
        '%' || btrim(v_query ->> 'search') || '%'
      or compatibility.file_extension ilike
        '%' || btrim(v_query ->> 'search') || '%'
    )
    and (
      nullif(
        btrim(v_query ->> 'media_kind'),
        ''
      ) is null
      or compatibility.media_kind =
        v_query ->> 'media_kind'
    )
    and (
      nullif(
        btrim(v_query ->> 'file_kind'),
        ''
      ) is null
      or compatibility.file_kind =
        v_query ->> 'file_kind'
    )
    and (
      nullif(
        btrim(v_query ->> 'asset_purpose'),
        ''
      ) is null
      or compatibility.asset_purpose =
        v_query ->> 'asset_purpose'
    )
    and (
      nullif(
        btrim(v_query ->> 'folder_id'),
        ''
      ) is null
      or case
        when v_query ->> 'folder_id' = 'none'
          then compatibility.folder_id is null
        when v_query ->> 'folder_id' ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          then compatibility.folder_id =
            (v_query ->> 'folder_id')::uuid
        else false
      end
    )
    and (
      nullif(
        btrim(v_query ->> 'rights_status'),
        ''
      ) is null
      or compatibility.rights_status =
        v_query ->> 'rights_status'
    )
    and (
      nullif(
        btrim(v_query ->> 'source_kind'),
        ''
      ) is null
      or compatibility.source_kind =
        v_query ->> 'source_kind'
    )
    and (
      nullif(
        btrim(v_query ->> 'status'),
        ''
      ) is null
      or compatibility.status =
        v_query ->> 'status'
    )
    and (
      not coalesce(
        nullif(
          v_query ->> 'missing_alt_only',
          ''
        )::boolean,
        false
      )
      or nullif(
        btrim(
          compatibility.metadata ->> 'alt_text'
        ),
        ''
      ) is null
    )
    and (
      nullif(
        v_query ->> 'uploaded_from',
        ''
      ) is null
      or compatibility.created_at >=
        (v_query ->> 'uploaded_from')::timestamptz
    )
    and (
      nullif(
        v_query ->> 'uploaded_to',
        ''
      ) is null
      or compatibility.created_at <=
        (v_query ->> 'uploaded_to')::timestamptz
    )
    and (
      nullif(
        v_query ->> 'content_from',
        ''
      ) is null
      or compatibility.content_date >=
        (v_query ->> 'content_from')::date
    )
    and (
      nullif(
        v_query ->> 'content_to',
        ''
      ) is null
      or compatibility.content_date <=
        (v_query ->> 'content_to')::date
    )
  ),
  ordered as (
    select
      filtered.*,
      row_number() over (
        order by
          case
            when v_order_by = 'created_at'
             and v_ascending
              then filtered.created_at
          end asc nulls last,
          case
            when v_order_by = 'created_at'
             and not v_ascending
              then filtered.created_at
          end desc nulls last,
          case
            when v_order_by = 'updated_at'
             and v_ascending
              then filtered.updated_at
          end asc nulls last,
          case
            when v_order_by = 'updated_at'
             and not v_ascending
              then filtered.updated_at
          end desc nulls last,
          case
            when v_order_by = 'title'
             and v_ascending
              then lower(
                coalesce(filtered.title, '')
              )
          end asc nulls last,
          case
            when v_order_by = 'title'
             and not v_ascending
              then lower(
                coalesce(filtered.title, '')
              )
          end desc nulls last,
          case
            when v_order_by = 'content_date'
             and v_ascending
              then filtered.content_date
          end asc nulls last,
          case
            when v_order_by = 'content_date'
             and not v_ascending
              then filtered.content_date
          end desc nulls last,
          filtered.id
      ) as page_order
    from filtered
  ),
  paged as (
    select *
    from ordered
    order by page_order
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page_row.id,
          'slug', page_row.slug,
          'title', page_row.title,
          'url', page_row.url,
          'mime_type', page_row.mime_type,
          'media_kind', page_row.media_kind,
          'status', page_row.status,
          'source_kind', page_row.source_kind,
          'source_entity', page_row.source_entity,
          'source_record_id',
            page_row.source_record_id,
          'source_staging_record_id',
            page_row.source_staging_record_id,
          'storage_bucket',
            page_row.storage_bucket,
          'storage_path', page_row.storage_path,
          'folder_id', page_row.folder_id,
          'file_kind', page_row.file_kind,
          'asset_purpose',
            page_row.asset_purpose,
          'display_filename',
            page_row.display_filename,
          'original_filename',
            page_row.original_filename,
          'file_extension',
            page_row.file_extension,
          'file_size_bytes',
            page_row.file_size_bytes,
          'content_date', page_row.content_date,
          'rights_status',
            page_row.rights_status,
          'credit_text', page_row.credit_text,
          'country_code', page_row.country_code,
          'language_code',
            page_row.language_code,
          'tags', page_row.tags,
          'internal_notes',
            page_row.internal_notes,
          'metadata', page_row.metadata,
          'created_at', page_row.created_at,
          'updated_at', page_row.updated_at,
          'canonical_asset_id',
            page_row.canonical_asset_id,
          'canonical_lifecycle_state',
            page_row.canonical_lifecycle_state,
          'authority_revision',
            page_row.authority_revision,
          'current_revision_id',
            page_row.current_revision_id,
          'current_governance_version_id',
            page_row.current_governance_version_id,
          'consent_status',
            page_row.consent_status,
          'sensitivity', page_row.sensitivity,
          'public_safety_state',
            page_row.public_safety_state,
          'active_usage_count',
            page_row.active_usage_count,
          'references',
            case
              when v_include_references
                then (
                  select coalesce(
                    jsonb_agg(
                      jsonb_build_object(
                        'table',
                          reference_row.table_name,
                        'column',
                          reference_row.column_name,
                        'entity_id',
                          reference_row.entity_id,
                        'label',
                          reference_row.label
                      )
                      order by
                        reference_row.table_name,
                        reference_row.entity_id
                    ),
                    '[]'::jsonb
                  )
                  from (
                    select
                      'wk_articles'::text as table_name,
                      'hero_image_id'::text as column_name,
                      article_row.id::text as entity_id,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(article_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        article_row.id::text
                      ) as label
                    from public.wk_articles article_row
                    where article_row.hero_image_id =
                      page_row.id

                    union all

                    select
                      'registry_artists',
                      'public_image_id',
                      artist_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(artist_row)
                              ->> 'display_name'
                          ),
                          ''
                        ),
                        artist_row.id::text
                      )
                    from public.registry_artists artist_row
                    where artist_row.public_image_id =
                      page_row.id

                    union all

                    select
                      'registry_releases',
                      'artwork_image_id',
                      release_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(release_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        release_row.id::text
                      )
                    from public.registry_releases release_row
                    where release_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'registry_tracks',
                      'artwork_image_id',
                      track_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(track_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        track_row.id::text
                      )
                    from public.registry_tracks track_row
                    where track_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'registry_authors',
                      'cover_image_id',
                      author_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(author_row)
                              ->> 'name'
                          ),
                          ''
                        ),
                        author_row.id::text
                      )
                    from public.registry_authors author_row
                    where author_row.cover_image_id =
                      page_row.id

                    union all

                    select
                      'registry_authors',
                      'avatar_image_id',
                      author_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(author_row)
                              ->> 'name'
                          ),
                          ''
                        ),
                        author_row.id::text
                      )
                    from public.registry_authors author_row
                    where author_row.avatar_image_id =
                      page_row.id

                    union all

                    select
                      'guide_pages',
                      'hero_image_id',
                      guide_page_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(guide_page_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        guide_page_row.id::text
                      )
                    from public.guide_pages guide_page_row
                    where guide_page_row.hero_image_id =
                      page_row.id

                    union all

                    select
                      'guides',
                      'hero_image_id',
                      guide_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(guide_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        guide_row.id::text
                      )
                    from public.guides guide_row
                    where guide_row.hero_image_id =
                      page_row.id

                    union all

                    select
                      'registry_artist_highlights',
                      'artwork_image_id',
                      highlight_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(highlight_row)
                              ->> 'title'
                          ),
                          ''
                        ),
                        highlight_row.id::text
                      )
                    from public.registry_artist_highlights
                      highlight_row
                    where highlight_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'chart_entries',
                      'artwork_image_id',
                      chart_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(chart_row)
                              ->> 'track_title'
                          ),
                          ''
                        ),
                        chart_row.id::text
                      )
                    from public.chart_entries chart_row
                    where chart_row.artwork_image_id =
                      page_row.id

                    union all

                    select
                      'wk_chart_entries_v2',
                      'artwork_image_id',
                      chart_v2_row.id::text,
                      coalesce(
                        nullif(
                          btrim(
                            to_jsonb(chart_v2_row)
                              ->> 'track_title'
                          ),
                          ''
                        ),
                        chart_v2_row.id::text
                      )
                    from public.wk_chart_entries_v2
                      chart_v2_row
                    where chart_v2_row.artwork_image_id =
                      page_row.id
                  ) reference_row
                )
              else '[]'::jsonb
            end
        )
        order by page_row.page_order
      ),
      '[]'::jsonb
    ),
    'total',
      (select count(*) from filtered)
  )
  into v_result
  from paged page_row;

  return coalesce(
    v_result,
    jsonb_build_object(
      'items',
      '[]'::jsonb,
      'total',
      0
    )
  );
end;
$function$;

revoke all on function
  public.read_media_assets_admin_v2(jsonb)
from public;

revoke all on function
  public.read_media_assets_admin_v2(jsonb)
from anon;

grant execute on function
  public.read_media_assets_admin_v2(jsonb)
to authenticated;

grant execute on function
  public.read_media_assets_admin_v2(jsonb)
to service_role;

comment on function
  public.read_media_assets_admin_v2(jsonb)
is
  'Authenticated Phase 4A administrative Media read adapter. '
  'Centralizes compatibility-era read fields behind Media read authority '
  'while exposing canonical identity and usage context.';

do $phase_4a_admin_read_postflight$
begin
  if to_regprocedure(
    'public.read_media_assets_admin_v2(jsonb)'
  ) is null then
    raise exception
      'STOP: Administrative Media read adapter was not created';
  end if;

  if has_function_privilege(
    'anon',
    'public.read_media_assets_admin_v2(jsonb)',
    'execute'
  ) then
    raise exception
      'STOP: Anonymous execution was granted';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.read_media_assets_admin_v2(jsonb)',
    'execute'
  ) then
    raise exception
      'STOP: Authenticated execution is missing';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.read_media_assets_admin_v2(jsonb)',
    'execute'
  ) then
    raise exception
      'STOP: Service-role execution is missing';
  end if;
end;
$phase_4a_admin_read_postflight$;

commit;
