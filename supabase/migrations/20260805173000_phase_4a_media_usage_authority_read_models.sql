begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

create temporary table phase_4a_m4_baseline
on commit drop
as
select
  (
    select md5(
      string_agg(
        to_jsonb(asset_row)::text,
        E'\n'
        order by asset_row.id::text
      )
    )
    from public.registry_media_assets asset_row
  ) as compatibility_asset_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            source_namespace.nspname,
            source_table.relname,
            constraint_row.conname,
            pg_get_constraintdef(
              constraint_row.oid,
              true
            )
          ),
          E'\n'
          order by
            source_namespace.nspname,
            source_table.relname,
            constraint_row.conname
        ),
        ''
      )
    )
    from pg_constraint constraint_row
    join pg_class source_table
      on source_table.oid = constraint_row.conrelid
    join pg_namespace source_namespace
      on source_namespace.oid = source_table.relnamespace
    join pg_class referenced_table
      on referenced_table.oid = constraint_row.confrelid
    join pg_namespace referenced_namespace
      on referenced_namespace.oid = referenced_table.relnamespace
    where constraint_row.contype = 'f'
      and source_namespace.nspname <> 'media'
      and referenced_namespace.nspname = 'public'
      and referenced_table.relname = 'registry_media_assets'
  ) as compatibility_fk_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            policy_row.schemaname,
            policy_row.tablename,
            policy_row.policyname,
            policy_row.permissive,
            array_to_string(policy_row.roles, ','),
            policy_row.cmd,
            coalesce(policy_row.qual, ''),
            coalesce(policy_row.with_check, '')
          ),
          E'\n'
          order by policy_row.policyname
        ),
        ''
      )
    )
    from pg_policies policy_row
    where policy_row.schemaname = 'public'
      and policy_row.tablename = 'registry_media_assets'
  ) as compatibility_policy_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            grant_row.grantee,
            grant_row.privilege_type,
            grant_row.is_grantable
          ),
          E'\n'
          order by
            grant_row.grantee,
            grant_row.privilege_type
        ),
        ''
      )
    )
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name = 'registry_media_assets'
  ) as compatibility_grant_fingerprint;

do $phase_4a_m4_preflight$
declare
  v_count bigint;
  v_text text;
begin
  if to_regnamespace('media') is null then
    raise exception 'STOP: media schema does not exist';
  end if;

  if (
    select count(*)
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname = 'public'
      and procedure_row.proname in (
        'create_media_asset',
        'register_media_file_object',
        'verify_media_file_object',
        'create_media_asset_revision',
        'register_media_variant',
        'activate_media_variant',
        'create_media_governance_version',
        'archive_media_asset',
        'restore_media_asset'
      )
      and procedure_row.prosecdef
  ) <> 9 then
    raise exception
      'STOP: Migration 3 command authority is incomplete';
  end if;

  if (select count(*) from media.assets) <> 1079
     or (
       select count(*)
       from media.asset_governance_versions
     ) <> 1079
     or (
       select count(*)
       from media.legacy_asset_links
     ) <> 1079
     or (select count(*) from media.events) <> 2158
  then
    raise exception
      'STOP: Migration 2 or Migration 3 Media baseline changed';
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
    + (select count(*) from media.usage_links)
  ) <> 0 then
    raise exception
      'STOP: Migration 4 requires zero file, revision, variant, selection, and usage rows';
  end if;

  select compatibility_asset_fingerprint
  into v_text
  from phase_4a_m4_baseline;

  if v_text <> 'f32e074f96b01549b5e597ad8b5f4324' then
    raise exception
      'STOP: Compatibility asset fingerprint changed: %',
      v_text;
  end if;

  select compatibility_fk_fingerprint
  into v_text
  from phase_4a_m4_baseline;

  if v_text <> '54274ae6a613d38c257c543ccf7050cc' then
    raise exception
      'STOP: Compatibility foreign-key fingerprint changed: %',
      v_text;
  end if;

  select count(*)
  into v_count
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid = constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid = source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid = constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid = referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  if v_count <> 14 then
    raise exception
      'STOP: Expected 14 external compatibility foreign keys, found %',
      v_count;
  end if;

  if (
    select count(*)
    from public.guide_pages
    where hero_image_id is not null
  ) <> 2
     or (
       select count(*)
       from public.registry_artists
       where public_image_id is not null
     ) <> 307
     or (
       select count(*)
       from public.registry_releases
       where artwork_image_id is not null
     ) <> 170
     or (
       select count(*)
       from public.registry_tracks
       where artwork_image_id is not null
     ) <> 306
     or (
       select count(*)
       from public.wk_articles
       where hero_image_id is not null
     ) <> 202
  then
    raise exception
      'STOP: Real Media placement counts changed after discovery';
  end if;

  if (
    select count(*)
    from public.registry_provenance_links
    where target_media_asset_id is not null
  ) <> 6332 then
    raise exception
      'STOP: Registry provenance count changed after discovery';
  end if;

  if exists (
    select 1
    from (
      select media_asset_id as asset_id
      from editorial.source_versions
      where media_asset_id is not null

      union all

      select media_asset_id
      from editorial.sources
      where media_asset_id is not null

      union all

      select artwork_image_id
      from public.chart_entries
      where artwork_image_id is not null

      union all

      select hero_image_id
      from public.guides
      where hero_image_id is not null

      union all

      select artwork_image_id
      from public.registry_artist_highlights
      where artwork_image_id is not null

      union all

      select avatar_image_id
      from public.registry_authors
      where avatar_image_id is not null

      union all

      select cover_image_id
      from public.registry_authors
      where cover_image_id is not null

      union all

      select artwork_image_id
      from public.wk_chart_entries_v2
      where artwork_image_id is not null
    ) unexpected_reference
  ) then
    raise exception
      'STOP: A previously empty compatibility relationship now contains Media references';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where (
      namespace.nspname = 'media'
      and procedure_row.proname in (
        'usage_role_requires_stability',
        'usage_role_matches_target',
        'usage_target_snapshot_is_attachable',
        'require_media_read_actor',
        'validate_usage_target'
      )
    )
       or (
         namespace.nspname = 'public'
         and procedure_row.proname in (
           'attach_media_usage',
           'detach_media_usage',
           'archive_media_usage',
           'list_media_assets_v2',
           'get_media_asset_v2',
           'resolve_media_asset_delivery'
         )
       )
  ) then
    raise exception
      'STOP: Migration 4 authority already exists';
  end if;
end;
$phase_4a_m4_preflight$;

create or replace function media.usage_role_requires_stability(
  p_usage_role text
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $function$
  select p_usage_role <> 'other';
$function$;

create or replace function media.usage_role_matches_target(
  p_usage_role text,
  p_target_authority text,
  p_target_kind text
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $function$
  select case p_usage_role
    when 'article_hero' then
      p_target_authority = 'editorial'
      and p_target_kind = 'article'
    when 'article_inline' then
      p_target_authority = 'editorial'
      and p_target_kind = 'article'
    when 'chart_artwork' then
      p_target_authority = 'charts'
      and p_target_kind = 'chart_entry'
    when 'artist_portrait' then
      p_target_authority = 'registry'
      and p_target_kind = 'artist'
    when 'author_avatar' then
      p_target_authority = 'registry'
      and p_target_kind = 'author'
    when 'author_cover' then
      p_target_authority = 'registry'
      and p_target_kind = 'author'
    when 'release_artwork' then
      p_target_authority = 'registry'
      and p_target_kind = 'release'
    when 'track_artwork' then
      p_target_authority = 'registry'
      and p_target_kind = 'track'
    when 'guide_hero' then
      p_target_authority = 'guides'
      and p_target_kind in ('guide', 'guide_page')
    when 'highlight_artwork' then
      p_target_authority = 'registry'
      and p_target_kind = 'highlight'
    when 'source_attachment' then
      p_target_authority = 'sources'
      and p_target_kind = 'source'
    when 'other' then
      true
    else
      false
  end;
$function$;

create or replace function media.usage_target_snapshot_is_attachable(
  p_target_snapshot jsonb
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $function$
  select
    p_target_snapshot is not null
    and jsonb_typeof(p_target_snapshot) = 'object'
    and nullif(
      btrim(
        coalesce(
          p_target_snapshot ->> 'archived_at',
          ''
        )
      ),
      ''
    ) is null
    and nullif(
      btrim(
        coalesce(
          p_target_snapshot ->> 'deleted_at',
          ''
        )
      ),
      ''
    ) is null
    and lower(
      coalesce(
        p_target_snapshot ->> 'status',
        ''
      )
    ) not in (
      'archived',
      'deleted',
      'trash',
      'withdrawn',
      'rejected',
      'unresolved',
      'superseded',
      'inactive',
      'disabled'
    )
    and lower(
      coalesce(
        p_target_snapshot ->> 'lifecycle_state',
        ''
      )
    ) not in (
      'archived',
      'deleted',
      'trash',
      'withdrawn',
      'rejected',
      'unresolved',
      'superseded',
      'inactive',
      'disabled'
    )
    and lower(
      coalesce(
        p_target_snapshot ->> 'wp_status',
        ''
      )
    ) <> 'trash'
    and lower(
      coalesce(
        p_target_snapshot ->> 'source_state',
        ''
      )
    ) not in (
      'archived',
      'deleted',
      'withdrawn',
      'rejected',
      'unresolved',
      'superseded',
      'inactive',
      'disabled'
    )
    and lower(
      coalesce(
        p_target_snapshot ->> 'resolution_state',
        ''
      )
    ) not in (
      'rejected',
      'unresolved',
      'superseded'
    )
    and lower(
      coalesce(
        p_target_snapshot ->> 'review_status',
        ''
      )
    ) not in (
      'rejected',
      'withdrawn',
      'unresolved'
    )
    and lower(
      coalesce(
        p_target_snapshot ->> 'is_active',
        'true'
      )
    ) <> 'false';
$function$;

create or replace function media.require_media_read_actor()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception
      'Authenticated Media read actor is required';
  end if;

  if not (
    public.current_user_has_capability(
      'view_media_records'
    )
    or public.current_user_has_capability(
      'manage_media_assets'
    )
    or public.current_user_has_capability(
      'manage_media_usage'
    )
    or public.current_user_has_capability(
      'review_media_governance'
    )
    or public.current_user_is_administrator()
  ) then
    raise exception
      'Media read authority is required';
  end if;

  return v_actor_id;
end;
$function$;

create or replace function media.validate_usage_target(
  p_actor_id uuid,
  p_target_authority text,
  p_target_kind text,
  p_target_id uuid,
  p_target_version_kind text default null,
  p_target_version_id uuid default null,
  p_require_edit_authority boolean default true,
  p_require_attachable_target boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_exists boolean := false;
  v_authorized boolean := false;
  v_version_kind text;
  v_target_snapshot jsonb;
begin
  if p_actor_id is null then
    raise exception
      'Media target validation requires an actor';
  end if;

  if p_target_id is null then
    raise exception
      'Media usage target identity is required';
  end if;

  if not (
    (p_target_authority = 'editorial'
      and p_target_kind = 'article')
    or
    (p_target_authority = 'registry'
      and p_target_kind in (
        'artist',
        'author',
        'release',
        'track',
        'highlight'
      ))
    or
    (p_target_authority = 'charts'
      and p_target_kind = 'chart_entry')
    or
    (p_target_authority = 'guides'
      and p_target_kind in (
        'guide',
        'guide_page'
      ))
    or
    (p_target_authority = 'sources'
      and p_target_kind = 'source')
  ) then
    raise exception
      'Unsupported Media usage target authority and kind';
  end if;

  case
    when p_target_authority = 'editorial'
     and p_target_kind = 'article'
    then
      select to_jsonb(article_row)
      into v_target_snapshot
      from public.wk_articles article_row
      where article_row.id = p_target_id;

    when p_target_authority = 'registry'
     and p_target_kind = 'artist'
    then
      select to_jsonb(artist_row)
      into v_target_snapshot
      from public.registry_artists artist_row
      where artist_row.id = p_target_id;

    when p_target_authority = 'registry'
     and p_target_kind = 'author'
    then
      select to_jsonb(author_row)
      into v_target_snapshot
      from public.registry_authors author_row
      where author_row.id = p_target_id;

    when p_target_authority = 'registry'
     and p_target_kind = 'release'
    then
      select to_jsonb(release_row)
      into v_target_snapshot
      from public.registry_releases release_row
      where release_row.id = p_target_id;

    when p_target_authority = 'registry'
     and p_target_kind = 'track'
    then
      select to_jsonb(track_row)
      into v_target_snapshot
      from public.registry_tracks track_row
      where track_row.id = p_target_id;

    when p_target_authority = 'registry'
     and p_target_kind = 'highlight'
    then
      select to_jsonb(highlight_row)
      into v_target_snapshot
      from public.registry_artist_highlights highlight_row
      where highlight_row.id = p_target_id;

    when p_target_authority = 'charts'
     and p_target_kind = 'chart_entry'
    then
      select to_jsonb(entry_row)
      into v_target_snapshot
      from public.chart_entries entry_row
      where entry_row.id = p_target_id;

    when p_target_authority = 'guides'
     and p_target_kind = 'guide'
    then
      select to_jsonb(guide_row)
      into v_target_snapshot
      from public.guides guide_row
      where guide_row.id = p_target_id;

    when p_target_authority = 'guides'
     and p_target_kind = 'guide_page'
    then
      select to_jsonb(page_row)
      into v_target_snapshot
      from public.guide_pages page_row
      where page_row.id = p_target_id;

    when p_target_authority = 'sources'
     and p_target_kind = 'source'
    then
      select to_jsonb(source_row)
      into v_target_snapshot
      from editorial.sources source_row
      where source_row.id = p_target_id;
  end case;

  v_exists := v_target_snapshot is not null;

  if not v_exists then
    raise exception
      'Media usage target does not exist';
  end if;

  if p_require_attachable_target
     and not media.usage_target_snapshot_is_attachable(
       v_target_snapshot
     )
  then
    raise exception
      'Media usage target is archived or unresolved';
  end if;

  if (
    p_target_version_kind is null
    and p_target_version_id is not null
  )
     or (
       p_target_version_kind is not null
       and p_target_version_id is null
     )
  then
    raise exception
      'Media target-version kind and identity must be supplied together';
  end if;

  if p_target_version_id is not null then
    if p_target_authority = 'editorial'
       and p_target_kind = 'article'
    then
      select version_row.version_kind
      into v_version_kind
      from editorial.article_versions version_row
      where version_row.id = p_target_version_id
        and version_row.article_id = p_target_id;

      if not found
         or v_version_kind is distinct from
           p_target_version_kind
      then
        raise exception
          'Media Article target version is invalid';
      end if;

    elsif p_target_authority = 'sources'
          and p_target_kind = 'source'
    then
      if p_target_version_kind <> 'source_version'
         or not exists (
           select 1
           from editorial.source_versions version_row
           where version_row.id = p_target_version_id
             and version_row.source_id = p_target_id
         )
      then
        raise exception
          'Media Source target version is invalid';
      end if;

    else
      raise exception
        'This Media usage target does not support version identity';
    end if;
  end if;

  if not p_require_edit_authority then
    return;
  end if;

  if public.current_user_is_administrator() then
    return;
  end if;

  case p_target_authority
    when 'editorial' then
      v_authorized :=
        public.current_user_has_capability(
          'edit_others_articles'
        )
        or public.current_user_has_capability(
          'publish_articles'
        )
        or (
          public.current_user_has_capability(
            'edit_own_articles'
          )
          and exists (
            select 1
            from editorial.article_resources binding
            join editorial.resources resource_row
              on resource_row.id = binding.resource_id
            where binding.article_id = p_target_id
              and resource_row.owner_id = p_actor_id
          )
        );

    when 'registry' then
      v_authorized :=
        public.current_user_has_capability(
          'manage_registry'
        );

    when 'charts' then
      v_authorized :=
        public.current_user_has_capability(
          'manage_charts'
        );

    when 'guides' then
      v_authorized :=
        public.current_user_has_capability(
          'edit_guides'
        );

    when 'sources' then
      v_authorized :=
        public.current_user_has_capability(
          'manage_sources'
        );
  end case;

  if not coalesce(v_authorized, false) then
    raise exception
      'Edit authority for the Media usage target is required';
  end if;
end;
$function$;

revoke all on function media.usage_role_requires_stability(text)
from public, anon, authenticated;

revoke all on function media.usage_role_matches_target(
  text,
  text,
  text
)
from public, anon, authenticated;

revoke all on function media.usage_target_snapshot_is_attachable(
  jsonb
)
from public, anon, authenticated;

revoke all on function media.require_media_read_actor()
from public, anon, authenticated;

revoke all on function media.validate_usage_target(
  uuid,
  text,
  text,
  uuid,
  text,
  uuid,
  boolean,
  boolean
)
from public, anon, authenticated;

grant execute on function media.usage_role_requires_stability(text)
to service_role;

grant execute on function media.usage_role_matches_target(
  text,
  text,
  text
)
to service_role;

grant execute on function media.usage_target_snapshot_is_attachable(
  jsonb
)
to service_role;

grant execute on function media.require_media_read_actor()
to service_role;

grant execute on function media.validate_usage_target(
  uuid,
  text,
  text,
  uuid,
  text,
  uuid,
  boolean,
  boolean
)
to service_role;

create or replace function public.attach_media_usage(
  p_asset_id uuid,
  p_resolution_mode text,
  p_target_authority text,
  p_target_kind text,
  p_target_id uuid,
  p_usage_role text,
  p_asset_revision_id uuid default null,
  p_target_version_kind text default null,
  p_target_version_id uuid default null,
  p_placement_data jsonb default '{}'::jsonb,
  p_display_order integer default 0,
  p_alt_text_snapshot text default null,
  p_caption_snapshot text default null,
  p_credit_snapshot text default null,
  p_correlation_id uuid default null
)
returns table (
  usage_link_id uuid,
  usage_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_usage_link_id uuid := gen_random_uuid();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
  v_lifecycle_state text;
  v_current_revision_id uuid;
  v_rights_status text;
  v_consent_status text;
  v_embargo_state text;
  v_embargo_until timestamptz;
  v_source_protection_class text;
  v_retention_state text;
  v_public_safety_state text;
begin
  v_actor_id :=
    media.require_command_actor('manage_media_usage');

  if not exists (
    select 1
    from media.usage_roles role_row
    where role_row.usage_role = p_usage_role
      and role_row.enabled
  ) then
    raise exception
      'Unknown or disabled Media usage role';
  end if;

  if not media.usage_role_matches_target(
       p_usage_role,
       p_target_authority,
       p_target_kind
     )
  then
    raise exception
      'Media usage role does not match the target authority and kind';
  end if;

  if p_placement_data is null
     or jsonb_typeof(p_placement_data) <> 'object'
  then
    raise exception
      'Media usage placement data must be an object';
  end if;

  if p_display_order < 0 then
    raise exception
      'Media usage display order cannot be negative';
  end if;

  perform media.validate_usage_target(
    v_actor_id,
    p_target_authority,
    p_target_kind,
    p_target_id,
    p_target_version_kind,
    p_target_version_id,
    true,
    true
  );

  select
    asset_row.lifecycle_state,
    asset_row.current_revision_id,
    governance_row.rights_status,
    governance_row.consent_status,
    governance_row.embargo_state,
    governance_row.embargo_until,
    governance_row.source_protection_class,
    governance_row.retention_state,
    governance_row.public_safety_state
  into
    v_lifecycle_state,
    v_current_revision_id,
    v_rights_status,
    v_consent_status,
    v_embargo_state,
    v_embargo_until,
    v_source_protection_class,
    v_retention_state,
    v_public_safety_state
  from media.assets asset_row
  join media.asset_governance_versions governance_row
    on governance_row.id =
      asset_row.current_governance_version_id
  where asset_row.id = p_asset_id
  for share of asset_row;

  if not found then
    raise exception
      'Media asset does not exist or has no current governance';
  end if;

  if v_lifecycle_state <> 'active' then
    raise exception
      'Only an active Media asset may receive a new usage';
  end if;

  if v_public_safety_state not in (
       'approved_public',
       'approved_redacted'
     )
     or v_rights_status not in (
       'owned',
       'licensed',
       'public_domain',
       'fair_use'
     )
     or v_consent_status not in (
       'granted',
       'not_required'
     )
     or v_source_protection_class not in (
       'public',
       'public_redacted'
     )
     or v_retention_state not in (
       'retain',
       'review_required'
     )
     or v_embargo_state = 'active'
     or (
       v_embargo_state = 'scheduled'
       and v_embargo_until is not null
       and v_embargo_until > now()
     )
  then
    raise exception
      'Current Media governance does not permit a new usage';
  end if;

  case p_resolution_mode
    when 'exact_revision' then
      if p_asset_revision_id is null then
        raise exception
          'Exact Media usage requires an asset revision';
      end if;

      if not exists (
        select 1
        from media.asset_revisions revision_row
        join media.file_objects file_row
          on file_row.id =
            revision_row.original_file_object_id
        where revision_row.id = p_asset_revision_id
          and revision_row.asset_id = p_asset_id
          and file_row.verification_state = 'verified'
      ) then
        raise exception
          'Exact Media usage requires a verified revision for the same asset';
      end if;

    when 'current_revision' then
      if p_asset_revision_id is not null then
        raise exception
          'Current-revision Media usage cannot bind an exact revision';
      end if;

      if media.usage_role_requires_stability(
           p_usage_role
         )
      then
        raise exception
          'Publication-stable Media usage cannot use current revision';
      end if;

      if v_current_revision_id is null
         or not exists (
           select 1
           from media.asset_revisions revision_row
           join media.file_objects file_row
             on file_row.id =
               revision_row.original_file_object_id
           where revision_row.id =
             v_current_revision_id
             and revision_row.asset_id = p_asset_id
             and file_row.verification_state = 'verified'
         )
      then
        raise exception
          'Current-revision Media usage requires one verified current revision';
      end if;

    when 'legacy_snapshot' then
      if p_asset_revision_id is not null then
        raise exception
          'Legacy-snapshot Media usage cannot bind an asset revision';
      end if;

      if not exists (
        select 1
        from media.legacy_asset_links link_row
        where link_row.asset_id = p_asset_id
          and nullif(
            btrim(link_row.legacy_snapshot ->> 'url'),
            ''
          ) is not null
      )
         or exists (
           select 1
           from media.asset_revisions revision_row
           where revision_row.asset_id = p_asset_id
         )
      then
        raise exception
          'Legacy-snapshot Media usage requires one immutable bridge and no canonical revision';
      end if;

    else
      raise exception
        'Unsupported Media usage resolution mode';
  end case;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.asset_id = p_asset_id
      and usage_row.target_authority =
        p_target_authority
      and usage_row.target_kind = p_target_kind
      and usage_row.target_id = p_target_id
      and coalesce(
        usage_row.target_version_kind,
        ''
      ) = coalesce(p_target_version_kind, '')
      and coalesce(
        usage_row.target_version_id,
        '00000000-0000-0000-0000-000000000000'::uuid
      ) = coalesce(
        p_target_version_id,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
      and usage_row.usage_role = p_usage_role
      and md5(usage_row.placement_data::text) =
        md5(p_placement_data::text)
      and usage_row.usage_state = 'active'
  ) then
    raise exception
      'Duplicate active Media usage';
  end if;

  insert into media.usage_links (
    id,
    asset_id,
    asset_revision_id,
    resolution_mode,
    target_authority,
    target_kind,
    target_id,
    target_version_kind,
    target_version_id,
    usage_role,
    placement_data,
    display_order,
    alt_text_snapshot,
    caption_snapshot,
    credit_snapshot,
    usage_state,
    usage_revision,
    created_by
  )
  values (
    v_usage_link_id,
    p_asset_id,
    p_asset_revision_id,
    p_resolution_mode,
    p_target_authority,
    p_target_kind,
    p_target_id,
    nullif(btrim(p_target_version_kind), ''),
    p_target_version_id,
    p_usage_role,
    p_placement_data,
    p_display_order,
    nullif(btrim(p_alt_text_snapshot), ''),
    nullif(btrim(p_caption_snapshot), ''),
    nullif(btrim(p_credit_snapshot), ''),
    'active',
    1,
    v_actor_id
  );

  insert into media.events (
    asset_id,
    asset_revision_id,
    usage_link_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    p_asset_revision_id,
    v_usage_link_id,
    'usage_attached',
    v_actor_id,
    'Governed Media usage attached',
    jsonb_build_object(
      'usage_revision', 1,
      'resolution_mode', p_resolution_mode,
      'target_authority', p_target_authority,
      'target_kind', p_target_kind,
      'target_id', p_target_id,
      'target_version_kind',
        nullif(btrim(p_target_version_kind), ''),
      'target_version_id', p_target_version_id,
      'usage_role', p_usage_role
    ),
    v_correlation_id
  );

  return query
  select
    v_usage_link_id,
    1::bigint,
    v_correlation_id;
end;
$function$;

create or replace function public.detach_media_usage(
  p_usage_link_id uuid,
  p_expected_usage_revision bigint,
  p_reason text,
  p_correlation_id uuid default null
)
returns table (
  usage_link_id uuid,
  usage_state text,
  usage_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_usage media.usage_links%rowtype;
  v_new_revision bigint;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('manage_media_usage');

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'Media usage detachment reason is required';
  end if;

  select usage_row.*
  into v_usage
  from media.usage_links usage_row
  where usage_row.id = p_usage_link_id
  for update;

  if not found then
    raise exception
      'Media usage does not exist';
  end if;

  if v_usage.usage_revision <>
     p_expected_usage_revision
  then
    raise exception
      'Stale Media usage revision';
  end if;

  perform media.validate_usage_target(
    v_actor_id,
    v_usage.target_authority,
    v_usage.target_kind,
    v_usage.target_id,
    v_usage.target_version_kind,
    v_usage.target_version_id,
    true,
    false
  );

  if v_usage.usage_state <> 'active' then
    raise exception
      'Only an active Media usage may be detached';
  end if;

  update media.usage_links as usage_row
  set
    usage_state = 'detached',
    usage_revision =
      usage_row.usage_revision + 1,
    state_reason = btrim(p_reason),
    state_changed_by = v_actor_id,
    state_changed_at = now(),
    updated_at = now()
  where usage_row.id = p_usage_link_id
  returning usage_row.usage_revision
  into v_new_revision;

  insert into media.events (
    asset_id,
    asset_revision_id,
    usage_link_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    v_usage.asset_id,
    v_usage.asset_revision_id,
    v_usage.id,
    'usage_detached',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'usage_state', v_usage.usage_state,
      'usage_revision', v_usage.usage_revision
    ),
    jsonb_build_object(
      'usage_state', 'detached',
      'usage_revision', v_new_revision
    ),
    v_correlation_id
  );

  return query
  select
    p_usage_link_id,
    'detached'::text,
    v_new_revision,
    v_correlation_id;
end;
$function$;

create or replace function public.archive_media_usage(
  p_usage_link_id uuid,
  p_expected_usage_revision bigint,
  p_reason text,
  p_correlation_id uuid default null
)
returns table (
  usage_link_id uuid,
  usage_state text,
  usage_revision bigint,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_actor_id uuid;
  v_usage media.usage_links%rowtype;
  v_new_revision bigint;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    gen_random_uuid()
  );
begin
  v_actor_id :=
    media.require_command_actor('manage_media_usage');

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'Media usage archive reason is required';
  end if;

  select usage_row.*
  into v_usage
  from media.usage_links usage_row
  where usage_row.id = p_usage_link_id
  for update;

  if not found then
    raise exception
      'Media usage does not exist';
  end if;

  if v_usage.usage_revision <>
     p_expected_usage_revision
  then
    raise exception
      'Stale Media usage revision';
  end if;

  perform media.validate_usage_target(
    v_actor_id,
    v_usage.target_authority,
    v_usage.target_kind,
    v_usage.target_id,
    v_usage.target_version_kind,
    v_usage.target_version_id,
    true,
    false
  );

  if v_usage.usage_state = 'archived' then
    raise exception
      'Media usage is already archived';
  end if;

  update media.usage_links as usage_row
  set
    usage_state = 'archived',
    usage_revision =
      usage_row.usage_revision + 1,
    state_reason = btrim(p_reason),
    state_changed_by = v_actor_id,
    state_changed_at = now(),
    updated_at = now()
  where usage_row.id = p_usage_link_id
  returning usage_row.usage_revision
  into v_new_revision;

  insert into media.events (
    asset_id,
    asset_revision_id,
    usage_link_id,
    event_type,
    actor_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    v_usage.asset_id,
    v_usage.asset_revision_id,
    v_usage.id,
    'usage_archived',
    v_actor_id,
    btrim(p_reason),
    jsonb_build_object(
      'usage_state', v_usage.usage_state,
      'usage_revision', v_usage.usage_revision
    ),
    jsonb_build_object(
      'usage_state', 'archived',
      'usage_revision', v_new_revision
    ),
    v_correlation_id
  );

  return query
  select
    p_usage_link_id,
    'archived'::text,
    v_new_revision,
    v_correlation_id;
end;
$function$;

create or replace function public.list_media_assets_v2(
  p_search text default null,
  p_asset_kind text default null,
  p_asset_purpose text default null,
  p_lifecycle_state text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  asset_id uuid,
  asset_kind text,
  asset_purpose text,
  title text,
  lifecycle_state text,
  authority_revision bigint,
  current_revision_id uuid,
  current_revision_number bigint,
  current_file_object_id uuid,
  current_file_verification_state text,
  current_mime_type text,
  governance_version_id uuid,
  rights_status text,
  consent_status text,
  sensitivity text,
  public_safety_state text,
  internal_reason text,
  legacy_asset_id uuid,
  active_usage_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_can_review boolean;
begin
  perform media.require_media_read_actor();

  if p_limit < 1 or p_limit > 200 then
    raise exception
      'Media list limit must be between 1 and 200';
  end if;

  if p_offset < 0 then
    raise exception
      'Media list offset cannot be negative';
  end if;

  v_can_review :=
    public.current_user_has_capability(
      'review_media_governance'
    )
    or public.current_user_is_administrator();

  return query
  select
    asset_row.id,
    asset_row.asset_kind,
    asset_row.asset_purpose,
    asset_row.title,
    asset_row.lifecycle_state,
    asset_row.authority_revision,
    asset_row.current_revision_id,
    revision_row.revision_number,
    file_row.id,
    file_row.verification_state,
    file_row.mime_type,
    governance_row.id,
    governance_row.rights_status,
    governance_row.consent_status,
    governance_row.sensitivity,
    governance_row.public_safety_state,
    case
      when v_can_review
        then governance_row.internal_reason
      else null
    end,
    bridge_row.legacy_asset_id,
    coalesce(usage_count.active_count, 0),
    asset_row.created_at,
    asset_row.updated_at
  from media.assets asset_row
  join media.asset_governance_versions governance_row
    on governance_row.id =
      asset_row.current_governance_version_id
  left join media.asset_revisions revision_row
    on revision_row.id =
      asset_row.current_revision_id
  left join media.file_objects file_row
    on file_row.id =
      revision_row.original_file_object_id
  left join media.legacy_asset_links bridge_row
    on bridge_row.asset_id = asset_row.id
  left join lateral (
    select count(*)::bigint as active_count
    from media.usage_links usage_row
    where usage_row.asset_id = asset_row.id
      and usage_row.usage_state = 'active'
  ) usage_count
    on true
  where (
      nullif(btrim(p_search), '') is null
      or asset_row.title ilike
        '%' || btrim(p_search) || '%'
    )
    and (
      p_asset_kind is null
      or asset_row.asset_kind = p_asset_kind
    )
    and (
      p_asset_purpose is null
      or asset_row.asset_purpose =
        p_asset_purpose
    )
    and (
      p_lifecycle_state is null
      or asset_row.lifecycle_state =
        p_lifecycle_state
    )
  order by
    asset_row.updated_at desc,
    asset_row.id
  limit p_limit
  offset p_offset;
end;
$function$;

create or replace function public.get_media_asset_v2(
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth
as $function$
declare
  v_can_review boolean;
  v_result jsonb;
begin
  perform media.require_media_read_actor();

  v_can_review :=
    public.current_user_has_capability(
      'review_media_governance'
    )
    or public.current_user_is_administrator();

  select jsonb_build_object(
    'asset',
    jsonb_build_object(
      'id', asset_row.id,
      'asset_kind', asset_row.asset_kind,
      'asset_purpose', asset_row.asset_purpose,
      'title', asset_row.title,
      'lifecycle_state', asset_row.lifecycle_state,
      'authority_revision',
        asset_row.authority_revision,
      'current_revision_id',
        asset_row.current_revision_id,
      'current_governance_version_id',
        asset_row.current_governance_version_id,
      'created_at', asset_row.created_at,
      'updated_at', asset_row.updated_at
    ),
    'revisions',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', revision_row.id,
            'revision_number',
              revision_row.revision_number,
            'previous_revision_id',
              revision_row.previous_revision_id,
            'replacement_reason',
              revision_row.replacement_reason,
            'created_by',
              revision_row.created_by,
            'created_at',
              revision_row.created_at,
            'file_object',
              jsonb_build_object(
                'id', file_row.id,
                'verification_state',
                  file_row.verification_state,
                'sha256', file_row.sha256,
                'byte_size', file_row.byte_size,
                'mime_type', file_row.mime_type,
                'delivery_url',
                  case
                    when file_row.verification_state =
                      'verified'
                      then file_row.delivery_url
                    else null
                  end,
                'technical_metadata',
                  file_row.technical_metadata
              )
          )
          order by revision_row.revision_number
        ),
        '[]'::jsonb
      )
      from media.asset_revisions revision_row
      join media.file_objects file_row
        on file_row.id =
          revision_row.original_file_object_id
      where revision_row.asset_id = asset_row.id
    ),
    'variants',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', variant_row.id,
            'asset_revision_id',
              variant_row.asset_revision_id,
            'variant_role',
              variant_row.variant_role,
            'source_file_object_id',
              variant_row.source_file_object_id,
            'derived_file_object_id',
              variant_row.derived_file_object_id,
            'transformation_spec',
              variant_row.transformation_spec,
            'technical_metadata',
              variant_row.technical_metadata,
            'generator_name',
              variant_row.generator_name,
            'generator_version',
              variant_row.generator_version,
            'created_at',
              variant_row.created_at,
            'selection_revision',
              selection_row.selection_revision,
            'is_selected',
              selection_row.variant_id =
                variant_row.id
          )
          order by
            variant_row.asset_revision_id,
            variant_row.variant_role,
            variant_row.created_at,
            variant_row.id
        ),
        '[]'::jsonb
      )
      from media.variants variant_row
      left join media.variant_selections selection_row
        on selection_row.asset_revision_id =
          variant_row.asset_revision_id
       and selection_row.variant_role =
          variant_row.variant_role
      where variant_row.asset_id = asset_row.id
    ),
    'usages',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', usage_row.id,
            'asset_revision_id',
              usage_row.asset_revision_id,
            'resolution_mode',
              usage_row.resolution_mode,
            'target_authority',
              usage_row.target_authority,
            'target_kind',
              usage_row.target_kind,
            'target_id',
              usage_row.target_id,
            'target_version_kind',
              usage_row.target_version_kind,
            'target_version_id',
              usage_row.target_version_id,
            'usage_role',
              usage_row.usage_role,
            'placement_data',
              usage_row.placement_data,
            'display_order',
              usage_row.display_order,
            'alt_text_snapshot',
              usage_row.alt_text_snapshot,
            'caption_snapshot',
              usage_row.caption_snapshot,
            'credit_snapshot',
              usage_row.credit_snapshot,
            'usage_state',
              usage_row.usage_state,
            'usage_revision',
              usage_row.usage_revision,
            'state_reason',
              usage_row.state_reason,
            'state_changed_at',
              usage_row.state_changed_at,
            'created_at',
              usage_row.created_at,
            'updated_at',
              usage_row.updated_at
          )
          order by
            usage_row.created_at,
            usage_row.id
        ),
        '[]'::jsonb
      )
      from media.usage_links usage_row
      where usage_row.asset_id = asset_row.id
    ),
    'governance_history',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', governance_history.id,
            'version_number',
              governance_history.version_number,
            'rights_status',
              governance_history.rights_status,
            'consent_status',
              governance_history.consent_status,
            'sensitivity',
              governance_history.sensitivity,
            'embargo_state',
              governance_history.embargo_state,
            'embargo_until',
              governance_history.embargo_until,
            'source_protection_class',
              governance_history.source_protection_class,
            'preservation_state',
              governance_history.preservation_state,
            'retention_state',
              governance_history.retention_state,
            'public_safety_state',
              governance_history.public_safety_state,
            'internal_reason',
              case
                when v_can_review
                  then governance_history.internal_reason
                else null
              end,
            'created_by',
              governance_history.created_by,
            'created_at',
              governance_history.created_at
          )
          order by governance_history.version_number
        ),
        '[]'::jsonb
      )
      from media.asset_governance_versions
        governance_history
      where governance_history.asset_id =
        asset_row.id
    ),
    'compatibility',
    (
      select jsonb_build_object(
        'legacy_asset_id',
          bridge_row.legacy_asset_id,
        'mapped', true,
        'snapshot_fingerprint',
          md5(bridge_row.legacy_snapshot::text),
        'created_at',
          bridge_row.created_at
      )
      from media.legacy_asset_links bridge_row
      where bridge_row.asset_id = asset_row.id
    ),
    'events',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', event_row.id,
            'event_type',
              event_row.event_type,
            'file_object_id',
              event_row.file_object_id,
            'asset_revision_id',
              event_row.asset_revision_id,
            'variant_id',
              event_row.variant_id,
            'usage_link_id',
              event_row.usage_link_id,
            'governance_version_id',
              event_row.governance_version_id,
            'actor_id',
              event_row.actor_id,
            'reason',
              event_row.reason,
            'correlation_id',
              event_row.correlation_id,
            'created_at',
              event_row.created_at
          )
          order by
            event_row.created_at,
            event_row.id
        ),
        '[]'::jsonb
      )
      from media.events event_row
      where event_row.asset_id = asset_row.id
    )
  )
  into v_result
  from media.assets asset_row
  where asset_row.id = p_asset_id;

  if v_result is null then
    raise exception
      'Media asset does not exist';
  end if;

  return v_result;
end;
$function$;

create or replace function public.resolve_media_asset_delivery(
  p_asset_id uuid,
  p_usage_link_id uuid default null,
  p_exact_asset_revision_id uuid default null,
  p_requested_variant_role text default null
)
returns table (
  logical_asset_id uuid,
  resolved_mode text,
  resolved_asset_revision_id uuid,
  resolved_file_object_id uuid,
  safe_delivery_url text,
  resolved_mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,
  approved_alt_text text,
  approved_caption text,
  approved_credit text
)
language plpgsql
security definer
set search_path = pg_catalog, public, media
as $function$
declare
  v_usage media.usage_links%rowtype;
  v_asset_lifecycle text;
  v_current_revision_id uuid;
  v_rights_status text;
  v_consent_status text;
  v_embargo_state text;
  v_embargo_until timestamptz;
  v_source_protection_class text;
  v_retention_state text;
  v_public_safety_state text;
  v_resolution_mode text;
  v_revision_id uuid;
  v_file_object_id uuid;
  v_delivery_url text;
  v_mime_type text;
  v_technical_metadata jsonb;
  v_legacy_snapshot jsonb;
  v_alt_text text;
  v_caption text;
  v_credit text;
  v_width integer;
  v_height integer;
  v_duration numeric;
begin
  if p_asset_id is null then
    raise exception
      'Media resolver requires a logical asset identity';
  end if;

  select
    asset_row.lifecycle_state,
    asset_row.current_revision_id,
    governance_row.rights_status,
    governance_row.consent_status,
    governance_row.embargo_state,
    governance_row.embargo_until,
    governance_row.source_protection_class,
    governance_row.retention_state,
    governance_row.public_safety_state
  into
    v_asset_lifecycle,
    v_current_revision_id,
    v_rights_status,
    v_consent_status,
    v_embargo_state,
    v_embargo_until,
    v_source_protection_class,
    v_retention_state,
    v_public_safety_state
  from media.assets asset_row
  join media.asset_governance_versions governance_row
    on governance_row.id =
      asset_row.current_governance_version_id
  where asset_row.id = p_asset_id;

  if not found then
    raise exception
      'Media resolver asset does not exist or lacks current governance';
  end if;

  if v_asset_lifecycle <> 'active'
     or v_public_safety_state not in (
       'approved_public',
       'approved_redacted'
     )
     or v_rights_status not in (
       'owned',
       'licensed',
       'public_domain',
       'fair_use'
     )
     or v_consent_status not in (
       'granted',
       'not_required'
     )
     or v_source_protection_class not in (
       'public',
       'public_redacted'
     )
     or v_retention_state not in (
       'retain',
       'review_required'
     )
     or v_embargo_state = 'active'
     or (
       v_embargo_state = 'scheduled'
       and v_embargo_until is not null
       and v_embargo_until > now()
     )
  then
    raise exception
      'Media delivery is blocked by current governance';
  end if;

  if p_usage_link_id is not null then
    select usage_row.*
    into v_usage
    from media.usage_links usage_row
    where usage_row.id = p_usage_link_id;

    if not found
       or v_usage.usage_state <> 'active'
    then
      raise exception
        'Active Media usage does not exist';
    end if;

    if v_usage.asset_id <> p_asset_id then
      raise exception
        'Media usage does not belong to the supplied asset';
    end if;

    if p_exact_asset_revision_id is not null
       and p_exact_asset_revision_id is distinct from
         v_usage.asset_revision_id
    then
      raise exception
        'Supplied Media revision does not match the usage';
    end if;

    v_resolution_mode := v_usage.resolution_mode;
    v_revision_id := v_usage.asset_revision_id;
    v_alt_text := v_usage.alt_text_snapshot;
    v_caption := v_usage.caption_snapshot;
    v_credit := v_usage.credit_snapshot;

    if v_resolution_mode = 'current_revision'
       and media.usage_role_requires_stability(
         v_usage.usage_role
       )
    then
      raise exception
        'Publication-stable Media usage cannot resolve through current revision';
    end if;

  elsif p_exact_asset_revision_id is not null then
    v_resolution_mode := 'exact_revision';
    v_revision_id := p_exact_asset_revision_id;

  else
    v_resolution_mode := 'current_revision';
    v_revision_id := v_current_revision_id;
  end if;

  if v_resolution_mode = 'legacy_snapshot' then
    if p_usage_link_id is null then
      raise exception
        'Legacy-snapshot delivery requires a usage link';
    end if;

    if p_requested_variant_role is not null then
      raise exception
        'Legacy-snapshot delivery cannot resolve a variant';
    end if;

    if v_revision_id is not null then
      raise exception
        'Legacy-snapshot usage cannot bind a revision';
    end if;

    select bridge_row.legacy_snapshot
    into v_legacy_snapshot
    from media.legacy_asset_links bridge_row
    where bridge_row.asset_id = p_asset_id;

    if not found
       or nullif(
         btrim(v_legacy_snapshot ->> 'url'),
         ''
       ) is null
    then
      raise exception
        'Legacy-snapshot delivery requires one immutable captured URL';
    end if;

    v_delivery_url :=
      btrim(v_legacy_snapshot ->> 'url');
    v_mime_type :=
      nullif(
        btrim(v_legacy_snapshot ->> 'mime_type'),
        ''
      );

    v_width :=
      case
        when coalesce(
          v_legacy_snapshot #>> '{metadata,width}',
          ''
        ) ~ '^[0-9]+$'
          then (
            v_legacy_snapshot #>>
              '{metadata,width}'
          )::integer
        else null
      end;

    v_height :=
      case
        when coalesce(
          v_legacy_snapshot #>> '{metadata,height}',
          ''
        ) ~ '^[0-9]+$'
          then (
            v_legacy_snapshot #>>
              '{metadata,height}'
          )::integer
        else null
      end;

    v_duration :=
      case
        when coalesce(
          v_legacy_snapshot #>> '{metadata,duration}',
          ''
        ) ~ '^[0-9]+([.][0-9]+)?$'
          then (
            v_legacy_snapshot #>>
              '{metadata,duration}'
          )::numeric
        else null
      end;

    return query
    select
      p_asset_id,
      v_resolution_mode,
      null::uuid,
      null::uuid,
      v_delivery_url,
      v_mime_type,
      v_width,
      v_height,
      v_duration,
      v_alt_text,
      v_caption,
      v_credit;

    return;
  end if;

  if v_revision_id is null then
    raise exception
      'Media delivery has no valid asset revision';
  end if;

  if not exists (
    select 1
    from media.asset_revisions revision_row
    where revision_row.id = v_revision_id
      and revision_row.asset_id = p_asset_id
  ) then
    raise exception
      'Media delivery revision does not belong to the asset';
  end if;

  if p_requested_variant_role is null then
    select revision_row.original_file_object_id
    into v_file_object_id
    from media.asset_revisions revision_row
    where revision_row.id = v_revision_id;
  else
    select variant_row.derived_file_object_id
    into v_file_object_id
    from media.variant_selections selection_row
    join media.variants variant_row
      on variant_row.id = selection_row.variant_id
    where selection_row.asset_revision_id =
      v_revision_id
      and selection_row.variant_role =
        p_requested_variant_role
      and variant_row.asset_revision_id =
        v_revision_id
      and variant_row.variant_role =
        p_requested_variant_role;

    if not found then
      raise exception
        'Requested Media variant has no governed selection';
    end if;
  end if;

  select
    file_row.delivery_url,
    file_row.mime_type,
    file_row.technical_metadata
  into
    v_delivery_url,
    v_mime_type,
    v_technical_metadata
  from media.file_objects file_row
  where file_row.id = v_file_object_id
    and file_row.verification_state = 'verified';

  if not found
     or nullif(btrim(v_delivery_url), '') is null
  then
    raise exception
      'Media delivery requires one verified file object with a safe URL';
  end if;

  v_width :=
    case
      when jsonb_typeof(
        v_technical_metadata -> 'width'
      ) = 'number'
        then (
          v_technical_metadata ->> 'width'
        )::numeric::integer
      else null
    end;

  v_height :=
    case
      when jsonb_typeof(
        v_technical_metadata -> 'height'
      ) = 'number'
        then (
          v_technical_metadata ->> 'height'
        )::numeric::integer
      else null
    end;

  v_duration :=
    case
      when jsonb_typeof(
        v_technical_metadata -> 'duration'
      ) = 'number'
        then (
          v_technical_metadata ->> 'duration'
        )::numeric
      else null
    end;

  return query
  select
    p_asset_id,
    v_resolution_mode,
    v_revision_id,
    v_file_object_id,
    v_delivery_url,
    v_mime_type,
    v_width,
    v_height,
    v_duration,
    v_alt_text,
    v_caption,
    v_credit;
end;
$function$;

revoke all on function public.attach_media_usage(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  uuid,
  text,
  uuid,
  jsonb,
  integer,
  text,
  text,
  text,
  uuid
)
from public, anon, authenticated;

revoke all on function public.detach_media_usage(
  uuid,
  bigint,
  text,
  uuid
)
from public, anon, authenticated;

revoke all on function public.archive_media_usage(
  uuid,
  bigint,
  text,
  uuid
)
from public, anon, authenticated;

revoke all on function public.list_media_assets_v2(
  text,
  text,
  text,
  text,
  integer,
  integer
)
from public, anon, authenticated;

revoke all on function public.get_media_asset_v2(uuid)
from public, anon, authenticated;

revoke all on function public.resolve_media_asset_delivery(
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute on function public.attach_media_usage(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  uuid,
  text,
  uuid,
  jsonb,
  integer,
  text,
  text,
  text,
  uuid
)
to authenticated, service_role;

grant execute on function public.detach_media_usage(
  uuid,
  bigint,
  text,
  uuid
)
to authenticated, service_role;

grant execute on function public.archive_media_usage(
  uuid,
  bigint,
  text,
  uuid
)
to authenticated, service_role;

grant execute on function public.list_media_assets_v2(
  text,
  text,
  text,
  text,
  integer,
  integer
)
to authenticated, service_role;

grant execute on function public.get_media_asset_v2(uuid)
to authenticated, service_role;

grant execute on function public.resolve_media_asset_delivery(
  uuid,
  uuid,
  uuid,
  text
)
to anon, authenticated, service_role;

create temporary table phase_4a_m4_source_usage
on commit drop
as
select
  'public'::text as source_schema,
  'guide_pages'::text as source_table,
  'hero_image_id'::text as source_column,
  'guides'::text as target_authority,
  'guide_page'::text as target_kind,
  page_row.id as target_id,
  'guide_hero'::text as usage_role,
  page_row.hero_image_id as asset_id,
  page_row.updated_at as created_at,
  media.usage_target_snapshot_is_attachable(
    to_jsonb(page_row)
  ) as target_is_attachable
from public.guide_pages page_row
where page_row.hero_image_id is not null

union all

select
  'public',
  'registry_artists',
  'public_image_id',
  'registry',
  'artist',
  artist_row.id,
  'artist_portrait',
  artist_row.public_image_id,
  artist_row.created_at,
  media.usage_target_snapshot_is_attachable(
    to_jsonb(artist_row)
  )
from public.registry_artists artist_row
where artist_row.public_image_id is not null

union all

select
  'public',
  'registry_releases',
  'artwork_image_id',
  'registry',
  'release',
  release_row.id,
  'release_artwork',
  release_row.artwork_image_id,
  release_row.created_at,
  media.usage_target_snapshot_is_attachable(
    to_jsonb(release_row)
  )
from public.registry_releases release_row
where release_row.artwork_image_id is not null

union all

select
  'public',
  'registry_tracks',
  'artwork_image_id',
  'registry',
  'track',
  track_row.id,
  'track_artwork',
  track_row.artwork_image_id,
  track_row.created_at,
  media.usage_target_snapshot_is_attachable(
    to_jsonb(track_row)
  )
from public.registry_tracks track_row
where track_row.artwork_image_id is not null

union all

select
  'public',
  'wk_articles',
  'hero_image_id',
  'editorial',
  'article',
  article_row.id,
  'article_hero',
  article_row.hero_image_id,
  article_row.created_at,
  media.usage_target_snapshot_is_attachable(
    to_jsonb(article_row)
  )
from public.wk_articles article_row
where article_row.hero_image_id is not null;

do $phase_4a_m4_source_usage_gate$
declare
  v_count bigint;
  v_source_usage record;
begin
  select count(*)
  into v_count
  from phase_4a_m4_source_usage;

  if v_count <> 987 then
    raise exception
      'STOP: Expected 987 real Media placements, found %',
      v_count;
  end if;

  if (
    select count(*)
    from phase_4a_m4_source_usage source_usage
    where source_usage.target_is_attachable
  ) <> 985
     or (
       select count(*)
       from phase_4a_m4_source_usage source_usage
       where not source_usage.target_is_attachable
     ) <> 2
  then
    raise exception
      'STOP: Expected 985 attachable and 2 archived-target Media placements';
  end if;

  if exists (
    select 1
    from phase_4a_m4_source_usage source_usage
    where not source_usage.target_is_attachable
      and (
        source_usage.source_table <> 'registry_artists'
        or source_usage.source_column <> 'public_image_id'
        or source_usage.target_authority <> 'registry'
        or source_usage.target_kind <> 'artist'
        or source_usage.usage_role <> 'artist_portrait'
        or (
          source_usage.target_id,
          source_usage.asset_id
        ) not in (
          (
            'd3c7ebee-4354-4df5-b3ee-91998719b7b4'::uuid,
            '7bff42c9-fe93-4568-a4cd-b683fae97418'::uuid
          ),
          (
            'dbc82131-40f6-4e45-8ae5-d08d7b86a0bc'::uuid,
            '8f37b111-60c4-4578-8274-5d73e0a337ca'::uuid
          )
        )
      )
  ) then
    raise exception
      'STOP: Archived-target Media placement identity changed after diagnosis';
  end if;

  if exists (
    select 1
    from phase_4a_m4_source_usage source_usage
    left join media.assets asset_row
      on asset_row.id = source_usage.asset_id
    left join media.legacy_asset_links bridge_row
      on bridge_row.asset_id = source_usage.asset_id
    where asset_row.id is null
       or bridge_row.asset_id is null
       or nullif(
         btrim(bridge_row.legacy_snapshot ->> 'url'),
         ''
       ) is null
  ) then
    raise exception
      'STOP: One or more real Media placements lack an immutable legacy URL snapshot';
  end if;

  if exists (
    select 1
    from phase_4a_m4_source_usage source_usage
    group by
      source_usage.source_schema,
      source_usage.source_table,
      source_usage.source_column,
      source_usage.target_id
    having count(*) <> 1
  ) then
    raise exception
      'STOP: Real Media placement identity is not unique';
  end if;

  for v_source_usage in
    select source_row.*
    from phase_4a_m4_source_usage source_row
    order by
      source_row.source_schema,
      source_row.source_table,
      source_row.target_id
  loop
    perform media.validate_usage_target(
      '00000000-0000-4000-8000-000000000001'::uuid,
      v_source_usage.target_authority,
      v_source_usage.target_kind,
      v_source_usage.target_id,
      null,
      null,
      false,
      v_source_usage.target_is_attachable
    );

    if not media.usage_role_matches_target(
         v_source_usage.usage_role,
         v_source_usage.target_authority,
         v_source_usage.target_kind
       )
    then
      raise exception
        'STOP: Real Media placement role does not match its typed target';
    end if;
  end loop;
end;
$phase_4a_m4_source_usage_gate$;

insert into media.usage_links (
  id,
  asset_id,
  asset_revision_id,
  resolution_mode,
  target_authority,
  target_kind,
  target_id,
  target_version_kind,
  target_version_id,
  usage_role,
  placement_data,
  display_order,
  alt_text_snapshot,
  caption_snapshot,
  credit_snapshot,
  usage_state,
  usage_revision,
  state_reason,
  state_changed_by,
  state_changed_at,
  created_by,
  created_at,
  updated_at
)
select
  md5(
    concat_ws(
      '|',
      'phase4a-m4-usage',
      source_usage.source_schema,
      source_usage.source_table,
      source_usage.source_column,
      source_usage.target_id::text
    )
  )::uuid,
  source_usage.asset_id,
  null,
  'legacy_snapshot',
  source_usage.target_authority,
  source_usage.target_kind,
  source_usage.target_id,
  null,
  null,
  source_usage.usage_role,
  jsonb_build_object(
    'backfill', 'phase_4a_m4',
    'compatibility_source_schema',
      source_usage.source_schema,
    'compatibility_source_table',
      source_usage.source_table,
    'compatibility_source_column',
      source_usage.source_column
  ),
  0,
  nullif(
    btrim(
      bridge_row.legacy_snapshot #>>
        '{metadata,alt_text}'
    ),
    ''
  ),
  nullif(
    btrim(
      bridge_row.legacy_snapshot #>>
        '{metadata,caption}'
    ),
    ''
  ),
  nullif(
    btrim(
      bridge_row.legacy_snapshot ->>
        'credit_text'
    ),
    ''
  ),
  case
    when source_usage.target_is_attachable
      then 'active'
    else 'archived'
  end,
  case
    when source_usage.target_is_attachable
      then 1
    else 2
  end,
  case
    when source_usage.target_is_attachable
      then null
    else
      'Compatibility target was already archived at Phase 4A Migration 4 backfill'
  end,
  case
    when source_usage.target_is_attachable
      then null
    else
      'f4a40000-0000-4000-8000-000000000004'::uuid
  end,
  case
    when source_usage.target_is_attachable
      then null
    else now()
  end,
  null,
  coalesce(source_usage.created_at, now()),
  case
    when source_usage.target_is_attachable
      then coalesce(source_usage.created_at, now())
    else now()
  end
from phase_4a_m4_source_usage source_usage
join media.legacy_asset_links bridge_row
  on bridge_row.asset_id = source_usage.asset_id
order by
  source_usage.source_schema,
  source_usage.source_table,
  source_usage.target_id;

insert into media.events (
  asset_id,
  usage_link_id,
  event_type,
  actor_id,
  reason,
  prior_state,
  resulting_state,
  correlation_id,
  created_at
)
select
  source_usage.asset_id,
  md5(
    concat_ws(
      '|',
      'phase4a-m4-usage',
      source_usage.source_schema,
      source_usage.source_table,
      source_usage.source_column,
      source_usage.target_id::text
    )
  )::uuid,
  'usage_attached',
  null,
  'Phase 4A Migration 4 compatibility placement backfill',
  null,
  jsonb_build_object(
    'usage_revision', 1,
    'resolution_mode', 'legacy_snapshot',
    'target_authority',
      source_usage.target_authority,
    'target_kind',
      source_usage.target_kind,
    'target_id',
      source_usage.target_id,
    'usage_role',
      source_usage.usage_role,
    'usage_state', 'active',
    'usage_revision', 1,
    'compatibility_source_schema',
      source_usage.source_schema,
    'compatibility_source_table',
      source_usage.source_table,
    'compatibility_source_column',
      source_usage.source_column
  ),
  md5(
    concat_ws(
      '|',
      'phase4a-m4-correlation',
      source_usage.source_schema,
      source_usage.source_table,
      source_usage.source_column,
      source_usage.target_id::text
    )
  )::uuid,
  coalesce(source_usage.created_at, now())
from phase_4a_m4_source_usage source_usage
order by
  source_usage.source_schema,
  source_usage.source_table,
  source_usage.target_id;

insert into media.events (
  asset_id,
  usage_link_id,
  event_type,
  actor_id,
  reason,
  prior_state,
  resulting_state,
  correlation_id,
  created_at
)
select
  source_usage.asset_id,
  md5(
    concat_ws(
      '|',
      'phase4a-m4-usage',
      source_usage.source_schema,
      source_usage.source_table,
      source_usage.source_column,
      source_usage.target_id::text
    )
  )::uuid,
  'usage_archived',
  'f4a40000-0000-4000-8000-000000000004'::uuid,
  'Compatibility target was already archived at Phase 4A Migration 4 backfill',
  jsonb_build_object(
    'usage_state', 'active',
    'usage_revision', 1,
    'historical_transition_time_known', false
  ),
  jsonb_build_object(
    'usage_state', 'archived',
    'usage_revision', 2,
    'backfill_observation', true
  ),
  md5(
    concat_ws(
      '|',
      'phase4a-m4-archived-correlation',
      source_usage.source_schema,
      source_usage.source_table,
      source_usage.source_column,
      source_usage.target_id::text
    )
  )::uuid,
  now()
from phase_4a_m4_source_usage source_usage
where not source_usage.target_is_attachable
order by
  source_usage.source_schema,
  source_usage.source_table,
  source_usage.target_id;

do $phase_4a_m4_backfill_acceptance$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from media.usage_links;

  if v_count <> 987 then
    raise exception
      'STOP: Expected 987 shadow usage links, found %',
      v_count;
  end if;

  if (
    select count(*)
    from media.usage_links usage_row
    where usage_row.usage_role = 'guide_hero'
  ) <> 2
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'artist_portrait'
     ) <> 307
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'release_artwork'
     ) <> 170
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'track_artwork'
     ) <> 306
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_role =
         'article_hero'
     ) <> 202
  then
    raise exception
      'STOP: Shadow usage role distribution is incorrect';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where not media.usage_role_matches_target(
      usage_row.usage_role,
      usage_row.target_authority,
      usage_row.target_kind
    )
  ) then
    raise exception
      'STOP: A shadow usage role does not match its typed target';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.resolution_mode <>
        'legacy_snapshot'
       or usage_row.asset_revision_id is not null
       or usage_row.usage_revision <>
         case
           when usage_row.usage_state = 'active'
             then 1
           when usage_row.usage_state = 'archived'
             then 2
           else -1
         end
       or usage_row.placement_data ->> 'backfill'
          <> 'phase_4a_m4'
  ) then
    raise exception
      'STOP: Shadow usage resolution or revision state is incorrect';
  end if;

  if (
    select count(*)
    from media.usage_links usage_row
    where usage_row.usage_state = 'active'
  ) <> 985
     or (
       select count(*)
       from media.usage_links usage_row
       where usage_row.usage_state = 'archived'
     ) <> 2
     or exists (
       select 1
       from media.usage_links usage_row
       where usage_row.usage_state = 'detached'
     )
  then
    raise exception
      'STOP: Expected 985 active and 2 archived shadow usages';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where (
      usage_row.usage_state = 'active'
      and (
        usage_row.state_reason is not null
        or usage_row.state_changed_by is not null
        or usage_row.state_changed_at is not null
      )
    )
       or (
         usage_row.usage_state = 'archived'
         and (
           usage_row.usage_revision <> 2
           or usage_row.state_reason <>
             'Compatibility target was already archived at Phase 4A Migration 4 backfill'
           or usage_row.state_changed_by is distinct from
             'f4a40000-0000-4000-8000-000000000004'::uuid
           or usage_row.state_changed_at is null
           or usage_row.updated_at is distinct from
             usage_row.state_changed_at
         )
       )
  ) then
    raise exception
      'STOP: Shadow usage lifecycle metadata is incorrect';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.usage_state = 'archived'
      and (
        usage_row.target_authority <> 'registry'
        or usage_row.target_kind <> 'artist'
        or usage_row.usage_role <> 'artist_portrait'
        or (
          usage_row.target_id,
          usage_row.asset_id
        ) not in (
          (
            'd3c7ebee-4354-4df5-b3ee-91998719b7b4'::uuid,
            '7bff42c9-fe93-4568-a4cd-b683fae97418'::uuid
          ),
          (
            'dbc82131-40f6-4e45-8ae5-d08d7b86a0bc'::uuid,
            '8f37b111-60c4-4578-8274-5d73e0a337ca'::uuid
          )
        )
      )
  ) then
    raise exception
      'STOP: Archived shadow usage identity changed after diagnosis';
  end if;

  if exists (
    select 1
    from phase_4a_m4_source_usage source_usage
    left join media.usage_links usage_row
      on usage_row.asset_id =
        source_usage.asset_id
     and usage_row.target_authority =
        source_usage.target_authority
     and usage_row.target_kind =
        source_usage.target_kind
     and usage_row.target_id =
        source_usage.target_id
     and usage_row.usage_role =
        source_usage.usage_role
     and usage_row.placement_data ->>
       'compatibility_source_schema' =
         source_usage.source_schema
     and usage_row.placement_data ->>
       'compatibility_source_table' =
         source_usage.source_table
     and usage_row.placement_data ->>
       'compatibility_source_column' =
         source_usage.source_column
     and usage_row.usage_state =
       case
         when source_usage.target_is_attachable
           then 'active'
         else 'archived'
       end
    where usage_row.id is null
  ) then
    raise exception
      'STOP: At least one compatibility placement lacks a shadow usage';
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    where usage_row.placement_data ->>
      'compatibility_source_table' =
        'registry_provenance_links'
  ) then
    raise exception
      'STOP: Registry provenance was incorrectly converted into Media usage';
  end if;

  if (
    select count(*)
    from media.events event_row
    where event_row.event_type =
      'usage_attached'
  ) <> 987 then
    raise exception
      'STOP: Expected 987 usage-attached events';
  end if;

  if (
    select count(*)
    from media.events event_row
    where event_row.event_type =
      'usage_archived'
  ) <> 2 then
    raise exception
      'STOP: Expected 2 usage-archived events';
  end if;

  if (select count(*) from media.events) <> 3147 then
    raise exception
      'STOP: Expected 3,147 total Media events after backfill';
  end if;
end;
$phase_4a_m4_backfill_acceptance$;

do $phase_4a_m4_contract_acceptance$
declare
  v_definition text;
  v_attach_definition text;
  v_target_definition text;
begin
  select pg_get_functiondef(
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'::regprocedure
  )
  into v_definition;

  select pg_get_functiondef(
    'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)'::regprocedure
  )
  into v_attach_definition;

  select pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  )
  into v_target_definition;

  if position(
       'media.legacy_asset_links'
       in v_definition
     ) = 0
     or position(
       'media.variant_selections'
       in v_definition
     ) = 0
     or position(
       'public.registry_media_assets'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: Public Media resolver violates the accepted authority boundary';
  end if;

  if position(
       'media.usage_role_matches_target'
       in v_attach_definition
     ) = 0
     or position(
       'Media usage role does not match the target authority and kind'
       in v_attach_definition
     ) = 0
     or position(
       'media.usage_target_snapshot_is_attachable'
       in v_target_definition
     ) = 0
     or position(
       'Media usage target is archived or unresolved'
       in v_target_definition
     ) = 0
     or position(
       'public.wk_chart_entries_v2'
       in v_target_definition
     ) > 0
  then
    raise exception
      'STOP: Typed target-role or target-lifecycle authority is missing';
  end if;

  if not has_function_privilege(
       'anon',
       'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.detach_media_usage(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.archive_media_usage(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Migration 4 function grants are incorrect';
  end if;
end;
$phase_4a_m4_contract_acceptance$;

savepoint phase_4a_m4_runtime_acceptance;

do $phase_4a_m4_actor_collision$
begin
  if exists (
    select 1
    from auth.users
    where id =
      'f4a40000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception
      'STOP: Reserved Phase 4A M4 verifier actor exists';
  end if;
end;
$phase_4a_m4_actor_collision$;

set local session_replication_role = replica;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'f4a40000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'phase4a-m4-verifier@local.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local session_replication_role = origin;

insert into public.user_role_assignments (
  id,
  user_id,
  role_key,
  status,
  assigned_by,
  notes
)
values (
  'f4a40000-0000-4000-8000-000000000002',
  'f4a40000-0000-4000-8000-000000000001',
  'administrator',
  'active',
  'f4a40000-0000-4000-8000-000000000001',
  'Transactional Phase 4A M4 verifier actor'
);

do $phase_4a_m4_runtime_acceptance$
declare
  v_actor constant uuid :=
    'f4a40000-0000-4000-8000-000000000001';
  v_target_id uuid;
  v_asset record;
  v_original record;
  v_revision record;
  v_governance record;
  v_derived record;
  v_variant record;
  v_selection record;
  v_usage_one record;
  v_usage_two record;
  v_lifecycle record;
  v_delivery record;
  v_asset_id uuid;
  v_original_id uuid;
  v_revision_id uuid;
  v_derived_id uuid;
  v_variant_id uuid;
  v_rejected boolean;
  v_event_count bigint;
  v_detail jsonb;
begin
  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    v_actor::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'sub',
      v_actor
    )::text,
    true
  );

  if auth.uid() is distinct from v_actor
     or not public.current_user_is_administrator()
  then
    raise exception
      'STOP: M4 verifier actor context failed';
  end if;

  select article_row.id
  into v_target_id
  from public.wk_articles article_row
  order by article_row.id
  limit 1;

  if v_target_id is null then
    raise exception
      'STOP: M4 verifier requires one Article target';
  end if;

  select *
  into v_asset
  from public.create_media_asset(
    'image',
    'article_inline',
    'Phase 4A M4 verifier asset',
    null,
    'f4a40000-0000-4000-8000-000000000101'
  );

  v_asset_id := v_asset.asset_id;

  select *
  into v_original
  from public.register_media_file_object(
    'lightsail_media',
    'phase4a-m4-verifier',
    'phase4a/m4/verifier/original.png',
    'https://media.invalid/phase4a/m4/original.png',
    'original.png',
    'image/png',
    3,
    '{"width":10,"height":20}'::jsonb,
    'f4a40000-0000-4000-8000-000000000102'
  );

  v_original_id := v_original.file_object_id;

  perform 1
  from public.verify_media_file_object(
    v_original_id,
    'verified',
    repeat('d', 64),
    3,
    'image/png',
    '{"width":10,"height":20}'::jsonb,
    null,
    'f4a40000-0000-4000-8000-000000000103'
  );

  select *
  into v_revision
  from public.create_media_asset_revision(
    v_asset_id,
    1,
    v_original_id,
    'Create Migration 4 verifier revision',
    'f4a40000-0000-4000-8000-000000000104'
  );

  v_revision_id := v_revision.asset_revision_id;

  select *
  into v_governance
  from public.create_media_governance_version(
    v_asset_id,
    2,
    jsonb_build_object(
      'rights_status', 'owned',
      'consent_status', 'not_required',
      'sensitivity', 'none',
      'embargo_state', 'none',
      'source_protection_class', 'public',
      'preservation_state', 'working_copy',
      'retention_state', 'retain',
      'public_safety_state', 'approved_public'
    ),
    'Approve Migration 4 verifier delivery',
    'f4a40000-0000-4000-8000-000000000105'
  );

  select *
  into v_derived
  from public.register_media_file_object(
    'lightsail_media',
    'phase4a-m4-verifier',
    'phase4a/m4/verifier/thumbnail.png',
    'https://media.invalid/phase4a/m4/thumbnail.png',
    'thumbnail.png',
    'image/png',
    2,
    '{"width":5,"height":10}'::jsonb,
    'f4a40000-0000-4000-8000-000000000106'
  );

  v_derived_id := v_derived.file_object_id;

  perform 1
  from public.verify_media_file_object(
    v_derived_id,
    'verified',
    repeat('e', 64),
    2,
    'image/png',
    '{"width":5,"height":10}'::jsonb,
    null,
    'f4a40000-0000-4000-8000-000000000107'
  );

  select *
  into v_variant
  from public.register_media_variant(
    v_asset_id,
    v_revision_id,
    v_original_id,
    v_derived_id,
    'thumbnail',
    '{"operation":"resize","width":5}'::jsonb,
    '{"width":5,"height":10}'::jsonb,
    'phase4a-m4-verifier',
    '1',
    'f4a40000-0000-4000-8000-000000000108'
  );

  v_variant_id := v_variant.variant_id;

  select *
  into v_selection
  from public.activate_media_variant(
    v_revision_id,
    'thumbnail',
    v_variant_id,
    0,
    'Activate Migration 4 verifier thumbnail',
    'f4a40000-0000-4000-8000-000000000109'
  );

  if v_selection.selection_revision <> 1 then
    raise exception
      'STOP: M4 verifier variant activation failed';
  end if;

  v_rejected := false;
  begin
    perform 1
    from public.attach_media_usage(
      v_asset_id,
      'exact_revision',
      'registry',
      'artist',
      'd3c7ebee-4354-4df5-b3ee-91998719b7b4'::uuid,
      'artist_portrait',
      v_revision_id,
      null,
      null,
      '{"acceptance":"archived-target"}'::jsonb,
      0,
      null,
      null,
      null,
      gen_random_uuid()
    );
  exception
    when others then
      v_rejected :=
        position(
          'media usage target is archived or unresolved'
          in lower(sqlerrm)
        ) > 0;
  end;

  if not v_rejected then
    raise exception
      'STOP: Archived Media usage target was accepted';
  end if;

  v_rejected := false;
  begin
    perform 1
    from public.attach_media_usage(
      v_asset_id,
      'exact_revision',
      'editorial',
      'article',
      v_target_id,
      'release_artwork',
      v_revision_id,
      null,
      null,
      '{"acceptance":"invalid-role"}'::jsonb,
      0,
      null,
      null,
      null,
      gen_random_uuid()
    );
  exception
    when others then
      v_rejected :=
        position(
          'media usage role does not match the target authority and kind'
          in lower(sqlerrm)
        ) > 0;
  end;

  if not v_rejected then
    raise exception
      'STOP: Mismatched Media usage role was accepted';
  end if;

  if media.usage_target_snapshot_is_attachable(
       '{"status":"archived"}'::jsonb
     )
     or media.usage_target_snapshot_is_attachable(
       '{"archived_at":"2026-08-05T00:00:00Z"}'::jsonb
     )
     or not media.usage_target_snapshot_is_attachable(
       '{"status":"active"}'::jsonb
     )
  then
    raise exception
      'STOP: Media target lifecycle classification failed';
  end if;

  select *
  into v_usage_one
  from public.attach_media_usage(
    v_asset_id,
    'exact_revision',
    'editorial',
    'article',
    v_target_id,
    'article_inline',
    v_revision_id,
    null,
    null,
    '{"acceptance":"original"}'::jsonb,
    0,
    'Verifier alt text',
    'Verifier caption',
    'Verifier credit',
    'f4a40000-0000-4000-8000-000000000110'
  );

  select *
  into v_delivery
  from public.resolve_media_asset_delivery(
    v_asset_id,
    v_usage_one.usage_link_id,
    null,
    null
  );

  if v_delivery.resolved_asset_revision_id
       is distinct from v_revision_id
     or v_delivery.resolved_file_object_id
       is distinct from v_original_id
     or v_delivery.safe_delivery_url <>
       'https://media.invalid/phase4a/m4/original.png'
     or v_delivery.width <> 10
     or v_delivery.height <> 20
     or v_delivery.approved_alt_text <>
       'Verifier alt text'
  then
    raise exception
      'STOP: M4 original delivery resolution failed';
  end if;

  select *
  into v_usage_two
  from public.attach_media_usage(
    v_asset_id,
    'exact_revision',
    'editorial',
    'article',
    v_target_id,
    'article_inline',
    v_revision_id,
    null,
    null,
    '{"acceptance":"variant"}'::jsonb,
    1,
    null,
    null,
    null,
    'f4a40000-0000-4000-8000-000000000111'
  );

  select *
  into v_delivery
  from public.resolve_media_asset_delivery(
    v_asset_id,
    v_usage_two.usage_link_id,
    v_revision_id,
    'thumbnail'
  );

  if v_delivery.resolved_file_object_id
       is distinct from v_derived_id
     or v_delivery.safe_delivery_url <>
       'https://media.invalid/phase4a/m4/thumbnail.png'
     or v_delivery.width <> 5
     or v_delivery.height <> 10
  then
    raise exception
      'STOP: M4 governed variant delivery resolution failed';
  end if;

  v_rejected := false;
  begin
    perform 1
    from public.attach_media_usage(
      v_asset_id,
      'exact_revision',
      'editorial',
      'article',
      v_target_id,
      'article_inline',
      v_revision_id,
      null,
      null,
      '{"acceptance":"variant"}'::jsonb,
      1,
      null,
      null,
      null,
      gen_random_uuid()
    );
  exception
    when others then
      v_rejected :=
        position(
          'duplicate active media usage'
          in lower(sqlerrm)
        ) > 0;
  end;

  if not v_rejected then
    raise exception
      'STOP: Duplicate active Media usage was accepted';
  end if;

  if not exists (
    select 1
    from public.list_media_assets_v2(
      'Phase 4A M4 verifier',
      null,
      null,
      null,
      10,
      0
    ) asset_list
    where asset_list.asset_id = v_asset_id
      and asset_list.active_usage_count = 2
  ) then
    raise exception
      'STOP: M4 list read model failed';
  end if;

  v_detail :=
    public.get_media_asset_v2(v_asset_id);

  if v_detail #>> '{asset,id}' <>
     v_asset_id::text
     or jsonb_array_length(
       v_detail -> 'usages'
     ) <> 2
  then
    raise exception
      'STOP: M4 detail read model failed';
  end if;

  select *
  into v_lifecycle
  from public.detach_media_usage(
    v_usage_one.usage_link_id,
    1,
    'Detach Migration 4 verifier usage',
    'f4a40000-0000-4000-8000-000000000112'
  );

  if v_lifecycle.usage_state <> 'detached'
     or v_lifecycle.usage_revision <> 2
  then
    raise exception
      'STOP: M4 usage detachment failed';
  end if;

  v_rejected := false;
  begin
    perform 1
    from public.detach_media_usage(
      v_usage_one.usage_link_id,
      1,
      'Stale Migration 4 verifier detachment',
      gen_random_uuid()
    );
  exception
    when others then
      v_rejected :=
        position(
          'stale media usage revision'
          in lower(sqlerrm)
        ) > 0;
  end;

  if not v_rejected then
    raise exception
      'STOP: Stale Media usage revision was accepted';
  end if;

  select *
  into v_lifecycle
  from public.archive_media_usage(
    v_usage_one.usage_link_id,
    2,
    'Archive detached Migration 4 verifier usage',
    'f4a40000-0000-4000-8000-000000000113'
  );

  if v_lifecycle.usage_state <> 'archived'
     or v_lifecycle.usage_revision <> 3
  then
    raise exception
      'STOP: M4 detached usage archive failed';
  end if;

  select *
  into v_lifecycle
  from public.archive_media_usage(
    v_usage_two.usage_link_id,
    1,
    'Archive active Migration 4 verifier usage',
    'f4a40000-0000-4000-8000-000000000114'
  );

  if v_lifecycle.usage_state <> 'archived'
     or v_lifecycle.usage_revision <> 2
  then
    raise exception
      'STOP: M4 active usage archive failed';
  end if;

  v_rejected := false;
  begin
    perform 1
    from public.resolve_media_asset_delivery(
      v_asset_id,
      v_usage_one.usage_link_id,
      null,
      null
    );
  exception
    when others then
      v_rejected :=
        position(
          'active media usage does not exist'
          in lower(sqlerrm)
        ) > 0;
  end;

  if not v_rejected then
    raise exception
      'STOP: Archived Media usage still resolved publicly';
  end if;

  select count(*)
  into v_event_count
  from media.events event_row
  where event_row.asset_id = v_asset_id
    and event_row.event_type in (
      'usage_attached',
      'usage_detached',
      'usage_archived'
    );

  if v_event_count <> 5 then
    raise exception
      'STOP: M4 usage lifecycle event set is incomplete';
  end if;
end;
$phase_4a_m4_runtime_acceptance$;

rollback to savepoint phase_4a_m4_runtime_acceptance;

do $phase_4a_m4_post_runtime_acceptance$
begin
  if (select count(*) from media.usage_links) <> 987 then
    raise exception
      'STOP: Transactional M4 acceptance rows persisted';
  end if;

  if (select count(*) from media.events) <> 3147 then
    raise exception
      'STOP: Transactional M4 acceptance events persisted';
  end if;

  if (
    (select count(*) from media.file_objects)
    + (select count(*) from media.asset_revisions)
    + (select count(*) from media.variants)
    + (select count(*) from media.variant_selections)
  ) <> 0 then
    raise exception
      'STOP: Transactional M4 file or revision rows persisted';
  end if;
end;
$phase_4a_m4_post_runtime_acceptance$;

do $phase_4a_m4_compatibility_acceptance$
declare
  v_asset_fingerprint text;
  v_fk_fingerprint text;
  v_policy_fingerprint text;
  v_grant_fingerprint text;
begin
  select md5(
    string_agg(
      to_jsonb(asset_row)::text,
      E'\n'
      order by asset_row.id::text
    )
  )
  into v_asset_fingerprint
  from public.registry_media_assets asset_row;

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname,
          pg_get_constraintdef(
            constraint_row.oid,
            true
          )
        ),
        E'\n'
        order by
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname
      ),
      ''
    )
  )
  into v_fk_fingerprint
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid = constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid = source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid = constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid = referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname = 'registry_media_assets';

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          policy_row.schemaname,
          policy_row.tablename,
          policy_row.policyname,
          policy_row.permissive,
          array_to_string(policy_row.roles, ','),
          policy_row.cmd,
          coalesce(policy_row.qual, ''),
          coalesce(policy_row.with_check, '')
        ),
        E'\n'
        order by policy_row.policyname
      ),
      ''
    )
  )
  into v_policy_fingerprint
  from pg_policies policy_row
  where policy_row.schemaname = 'public'
    and policy_row.tablename = 'registry_media_assets';

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          grant_row.grantee,
          grant_row.privilege_type,
          grant_row.is_grantable
        ),
        E'\n'
        order by
          grant_row.grantee,
          grant_row.privilege_type
      ),
      ''
    )
  )
  into v_grant_fingerprint
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name = 'registry_media_assets';

  if exists (
    select 1
    from phase_4a_m4_baseline baseline
    where baseline.compatibility_asset_fingerprint
        is distinct from v_asset_fingerprint
       or baseline.compatibility_fk_fingerprint
        is distinct from v_fk_fingerprint
       or baseline.compatibility_policy_fingerprint
        is distinct from v_policy_fingerprint
       or baseline.compatibility_grant_fingerprint
        is distinct from v_grant_fingerprint
  ) then
    raise exception
      'STOP: Migration 4 changed the compatibility runtime';
  end if;
end;
$phase_4a_m4_compatibility_acceptance$;

select jsonb_build_object(
  'verification', 'PASS',
  'migration_scope',
    'usage_authority_read_models',
  'shadow_usage_count',
    (select count(*) from media.usage_links),
  'active_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_state = 'active'
    ),
  'archived_usage_count',
    (
      select count(*)
      from media.usage_links usage_row
      where usage_row.usage_state = 'archived'
    ),
  'usage_attached_event_count',
    (
      select count(*)
      from media.events event_row
      where event_row.event_type =
        'usage_attached'
    ),
  'usage_archived_event_count',
    (
      select count(*)
      from media.events event_row
      where event_row.event_type =
        'usage_archived'
    ),
  'total_media_event_count',
    (select count(*) from media.events),
  'command_count', 12,
  'internal_read_count', 2,
  'public_resolver_count', 1,
  'typed_role_validator_count', 1,
  'target_lifecycle_validator_count', 1,
  'compatibility_asset_fingerprint',
    (
      select compatibility_asset_fingerprint
      from phase_4a_m4_baseline
    ),
  'compatibility_fk_fingerprint',
    (
      select compatibility_fk_fingerprint
      from phase_4a_m4_baseline
    )
) as phase_4a_m4_transactional_validation;

commit;
