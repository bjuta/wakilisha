begin;

do $migration_guard$
begin
  if to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null then
    raise exception
      'STOP: public.current_user_has_capability(text) does not exist';
  end if;

  if to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null then
    raise exception
      'STOP: public.current_user_is_administrator() does not exist';
  end if;

  if to_regclass('editorial.sources') is null
     or to_regclass('editorial.source_versions') is null
     or to_regclass('editorial.source_registry_links') is null
     or to_regclass('editorial.source_review_events') is null then
    raise exception
      'STOP: Phase 3A Source foundation is incomplete';
  end if;
end;
$migration_guard$;

alter table editorial.credits
  add column if not exists registry_author_slug_snapshot text,
  add column if not exists user_username_snapshot text;

alter table editorial.credits
  drop constraint if exists credits_registry_author_slug_snapshot_check;

alter table editorial.credits
  add constraint credits_registry_author_slug_snapshot_check
  check (
    (
      registry_author_id is null
      and registry_author_slug_snapshot is null
    )
    or
    (
      registry_author_id is not null
      and nullif(
        btrim(registry_author_slug_snapshot),
        ''
      ) is not null
    )
  );

alter table editorial.credits
  drop constraint if exists credits_user_username_snapshot_check;

alter table editorial.credits
  add constraint credits_user_username_snapshot_check
  check (
    user_id is not null
    or user_username_snapshot is null
  );

comment on column
  editorial.credits.registry_author_slug_snapshot
is
  'Immutable Registry-author slug captured when the Credit is created.';

comment on column
  editorial.credits.user_username_snapshot
is
  'Immutable authenticated-user username captured when available at Credit creation.';

create or replace function editorial.normalize_source_metadata(
  p_metadata jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_metadata jsonb;
begin
  if p_metadata is null
     or jsonb_typeof(p_metadata) <> 'object' then
    raise exception
      'Source metadata must be a JSON object';
  end if;

  if nullif(btrim(p_metadata ->> 'source_type'), '') is null then
    raise exception
      'Source metadata requires source_type';
  end if;

  if nullif(btrim(p_metadata ->> 'title'), '') is null then
    raise exception
      'Source metadata requires title';
  end if;

  v_metadata := jsonb_build_object(
    'source_type',
      btrim(p_metadata ->> 'source_type'),
    'title',
      btrim(p_metadata ->> 'title'),
    'creator_display',
      nullif(btrim(p_metadata ->> 'creator_display'), ''),
    'publisher_display',
      nullif(btrim(p_metadata ->> 'publisher_display'), ''),
    'source_url',
      nullif(btrim(p_metadata ->> 'source_url'), ''),
    'media_asset_id',
      nullif(btrim(p_metadata ->> 'media_asset_id'), ''),
    'archive_identifier',
      nullif(btrim(p_metadata ->> 'archive_identifier'), ''),
    'publication_date',
      nullif(btrim(p_metadata ->> 'publication_date'), ''),
    'capture_date',
      nullif(btrim(p_metadata ->> 'capture_date'), ''),
    'retrieval_date',
      nullif(btrim(p_metadata ->> 'retrieval_date'), ''),
    'language_code',
      nullif(lower(btrim(p_metadata ->> 'language_code')), ''),
    'country_code',
      nullif(upper(btrim(p_metadata ->> 'country_code')), ''),
    'place_text',
      nullif(btrim(p_metadata ->> 'place_text'), ''),
    'rights_status',
      coalesce(
        nullif(btrim(p_metadata ->> 'rights_status'), ''),
        'unknown'
      ),
    'consent_status',
      coalesce(
        nullif(btrim(p_metadata ->> 'consent_status'), ''),
        'unknown'
      ),
    'sensitivity',
      coalesce(
        nullif(btrim(p_metadata ->> 'sensitivity'), ''),
        'none'
      ),
    'reliability_note',
      nullif(btrim(p_metadata ->> 'reliability_note'), ''),
    'credit_line',
      nullif(btrim(p_metadata ->> 'credit_line'), ''),
    'internal_notes',
      nullif(btrim(p_metadata ->> 'internal_notes'), '')
  );

  return jsonb_strip_nulls(v_metadata);
end;
$function$;

revoke all
on function editorial.normalize_source_metadata(jsonb)
from public, anon, authenticated;

grant execute
on function editorial.normalize_source_metadata(jsonb)
to service_role;

create or replace function editorial.normalize_source_registry_links(
  p_registry_links jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_normalized jsonb;
begin
  if p_registry_links is null then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_registry_links) <> 'array' then
    raise exception
      'Source Registry links must be a JSON array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_registry_links) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or nullif(
            btrim(item.value ->> 'registry_entity_type'),
            ''
          ) is null
       or nullif(
            btrim(item.value ->> 'registry_entity_id'),
            ''
          ) is null
  ) then
    raise exception
      'Every Source Registry link requires registry_entity_type and registry_entity_id';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_registry_links) as link(
      registry_entity_type text,
      registry_entity_id text,
      relationship_role text
    )
    where link.registry_entity_type not in (
      'artist',
      'author',
      'genre',
      'label',
      'release',
      'track'
    )
       or coalesce(
            nullif(btrim(link.relationship_role), ''),
            'context'
          ) not in (
            'subject',
            'creator',
            'publisher',
            'custodian',
            'mentioned',
            'context'
          )
       or link.registry_entity_id !~
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) then
    raise exception
      'Source Registry link contains an invalid entity type, UUID, or relationship role';
  end if;

  if exists (
    select 1
    from (
      select
        link.registry_entity_type,
        link.registry_entity_id,
        coalesce(
          nullif(btrim(link.relationship_role), ''),
          'context'
        ) as relationship_role,
        count(*) as duplicate_count
      from jsonb_to_recordset(p_registry_links) as link(
        registry_entity_type text,
        registry_entity_id text,
        relationship_role text
      )
      group by
        link.registry_entity_type,
        link.registry_entity_id,
        coalesce(
          nullif(btrim(link.relationship_role), ''),
          'context'
        )
      having count(*) > 1
    ) duplicates
  ) then
    raise exception
      'Source Registry links contain duplicate identities';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_entity_type',
          link.registry_entity_type,
        'registry_entity_id',
          lower(link.registry_entity_id),
        'relationship_role',
          coalesce(
            nullif(btrim(link.relationship_role), ''),
            'context'
          )
      )
      order by
        link.registry_entity_type,
        lower(link.registry_entity_id),
        coalesce(
          nullif(btrim(link.relationship_role), ''),
          'context'
        )
    ),
    '[]'::jsonb
  )
  into v_normalized
  from jsonb_to_recordset(p_registry_links) as link(
    registry_entity_type text,
    registry_entity_id text,
    relationship_role text
  );

  return v_normalized;
end;
$function$;

revoke all
on function editorial.normalize_source_registry_links(jsonb)
from public, anon, authenticated;

grant execute
on function editorial.normalize_source_registry_links(jsonb)
to service_role;

create or replace function editorial.source_content_fingerprint(
  p_metadata jsonb,
  p_registry_links jsonb
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select md5(
    (
      jsonb_build_object(
        'metadata',
          editorial.normalize_source_metadata(p_metadata),
        'registry_links',
          editorial.normalize_source_registry_links(
            p_registry_links
          )
      )
    )::text
  );
$function$;

revoke all
on function editorial.source_content_fingerprint(jsonb, jsonb)
from public, anon, authenticated;

grant execute
on function editorial.source_content_fingerprint(jsonb, jsonb)
to service_role;

create or replace function editorial.assert_source_command_actor(
  p_capability text
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if auth.role() = 'service_role' then
    return v_actor_id;
  end if;

  if v_actor_id is null then
    raise exception
      'Authentication is required';
  end if;

  if not (
    coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(p_capability),
      false
    )
  ) then
    raise exception
      'You do not have the required Source capability: %',
      p_capability;
  end if;

  return v_actor_id;
end;
$function$;

revoke all
on function editorial.assert_source_command_actor(text)
from public, anon, authenticated;

grant execute
on function editorial.assert_source_command_actor(text)
to service_role;

create or replace function editorial.insert_source_registry_links(
  p_source_id uuid,
  p_source_version_id uuid,
  p_registry_links jsonb,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_links jsonb;
begin
  v_links :=
    editorial.normalize_source_registry_links(p_registry_links);

  insert into editorial.source_registry_links (
    source_id,
    source_version_id,
    registry_entity_type,
    registry_entity_id,
    relationship_role,
    created_by
  )
  select
    p_source_id,
    p_source_version_id,
    link.registry_entity_type,
    link.registry_entity_id::uuid,
    link.relationship_role,
    p_actor_id
  from jsonb_to_recordset(v_links) as link(
    registry_entity_type text,
    registry_entity_id text,
    relationship_role text
  );
end;
$function$;

revoke all
on function editorial.insert_source_registry_links(
  uuid,
  uuid,
  jsonb,
  uuid
)
from public, anon, authenticated;

grant execute
on function editorial.insert_source_registry_links(
  uuid,
  uuid,
  jsonb,
  uuid
)
to service_role;

create or replace function public.create_source(
  p_metadata jsonb,
  p_registry_links jsonb default '[]'::jsonb,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_metadata jsonb;
  v_registry_links jsonb;
  v_fingerprint text;
  v_source_id uuid;
  v_source_version_id uuid;
begin
  v_actor_id :=
    editorial.assert_source_command_actor('manage_sources');

  v_metadata :=
    editorial.normalize_source_metadata(p_metadata);

  v_registry_links :=
    editorial.normalize_source_registry_links(p_registry_links);

  if not exists (
    select 1
    from editorial.source_types source_type
    where source_type.source_type =
            v_metadata ->> 'source_type'
      and source_type.enabled
  ) then
    raise exception
      'Choose an enabled Source type';
  end if;

  if v_metadata ? 'media_asset_id'
     and not exists (
       select 1
       from public.registry_media_assets media_asset
       where media_asset.id =
         (v_metadata ->> 'media_asset_id')::uuid
     ) then
    raise exception
      'Source Media asset was not found';
  end if;

  v_fingerprint :=
    editorial.source_content_fingerprint(
      v_metadata,
      v_registry_links
    );

  insert into editorial.sources (
    source_type,
    title,
    creator_display,
    publisher_display,
    source_url,
    media_asset_id,
    archive_identifier,
    publication_date,
    capture_date,
    retrieval_date,
    language_code,
    country_code,
    place_text,
    rights_status,
    consent_status,
    sensitivity,
    reliability_note,
    credit_line,
    internal_notes,
    review_status,
    exposure_class,
    source_state,
    working_revision,
    created_by,
    updated_by
  )
  values (
    v_metadata ->> 'source_type',
    v_metadata ->> 'title',
    v_metadata ->> 'creator_display',
    v_metadata ->> 'publisher_display',
    v_metadata ->> 'source_url',
    (v_metadata ->> 'media_asset_id')::uuid,
    v_metadata ->> 'archive_identifier',
    (v_metadata ->> 'publication_date')::date,
    (v_metadata ->> 'capture_date')::date,
    (v_metadata ->> 'retrieval_date')::date,
    v_metadata ->> 'language_code',
    v_metadata ->> 'country_code',
    v_metadata ->> 'place_text',
    coalesce(
      v_metadata ->> 'rights_status',
      'unknown'
    ),
    coalesce(
      v_metadata ->> 'consent_status',
      'unknown'
    ),
    coalesce(
      v_metadata ->> 'sensitivity',
      'none'
    ),
    v_metadata ->> 'reliability_note',
    v_metadata ->> 'credit_line',
    v_metadata ->> 'internal_notes',
    'draft',
    'internal',
    'active',
    1,
    v_actor_id,
    v_actor_id
  )
  returning id
  into v_source_id;

  insert into editorial.source_versions (
    source_id,
    version_number,
    source_type,
    title,
    creator_display,
    publisher_display,
    source_url,
    media_asset_id,
    archive_identifier,
    publication_date,
    capture_date,
    retrieval_date,
    language_code,
    country_code,
    place_text,
    rights_status,
    consent_status,
    sensitivity,
    reliability_note,
    credit_line,
    internal_notes,
    created_by,
    content_fingerprint
  )
  values (
    v_source_id,
    1,
    v_metadata ->> 'source_type',
    v_metadata ->> 'title',
    v_metadata ->> 'creator_display',
    v_metadata ->> 'publisher_display',
    v_metadata ->> 'source_url',
    (v_metadata ->> 'media_asset_id')::uuid,
    v_metadata ->> 'archive_identifier',
    (v_metadata ->> 'publication_date')::date,
    (v_metadata ->> 'capture_date')::date,
    (v_metadata ->> 'retrieval_date')::date,
    v_metadata ->> 'language_code',
    v_metadata ->> 'country_code',
    v_metadata ->> 'place_text',
    coalesce(
      v_metadata ->> 'rights_status',
      'unknown'
    ),
    coalesce(
      v_metadata ->> 'consent_status',
      'unknown'
    ),
    coalesce(
      v_metadata ->> 'sensitivity',
      'none'
    ),
    v_metadata ->> 'reliability_note',
    v_metadata ->> 'credit_line',
    v_metadata ->> 'internal_notes',
    v_actor_id,
    v_fingerprint
  )
  returning id
  into v_source_version_id;

  perform editorial.insert_source_registry_links(
    v_source_id,
    v_source_version_id,
    v_registry_links,
    v_actor_id
  );

  update editorial.sources
  set
    current_working_version_id = v_source_version_id,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_source_id;

  insert into editorial.source_review_events (
    source_id,
    source_version_id,
    actor_id,
    action,
    prior_review_status,
    resulting_review_status,
    prior_exposure_class,
    resulting_exposure_class,
    prior_source_state,
    resulting_source_state,
    correlation_id
  )
  values (
    v_source_id,
    v_source_version_id,
    v_actor_id,
    'created',
    null,
    'draft',
    null,
    'internal',
    null,
    'active',
    p_correlation_id
  );

  return jsonb_build_object(
    'source_id',
      v_source_id,
    'source_version_id',
      v_source_version_id,
    'working_revision',
      1,
    'created',
      true
  );
end;
$function$;

create or replace function public.save_source_version(
  p_source_id uuid,
  p_expected_working_revision bigint,
  p_metadata jsonb,
  p_registry_links jsonb default '[]'::jsonb,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_source editorial.sources%rowtype;
  v_metadata jsonb;
  v_registry_links jsonb;
  v_fingerprint text;
  v_current_fingerprint text;
  v_next_version_number bigint;
  v_source_version_id uuid;
  v_resulting_review_status text;
  v_has_prior_review boolean;
begin
  v_actor_id :=
    editorial.assert_source_command_actor('manage_sources');

  select *
  into v_source
  from editorial.sources source
  where source.id = p_source_id
  for update;

  if not found then
    raise exception
      'Source was not found';
  end if;

  if v_source.working_revision <>
       p_expected_working_revision then
    raise exception
      'Source working revision conflict. Expected %, found %',
      p_expected_working_revision,
      v_source.working_revision;
  end if;

  if v_source.source_state = 'withdrawn' then
    raise exception
      'Restore the withdrawn Source before editing it';
  end if;

  if v_source.source_state = 'archived' then
    raise exception
      'Archived Sources cannot be edited';
  end if;

  v_metadata :=
    editorial.normalize_source_metadata(p_metadata);

  v_registry_links :=
    editorial.normalize_source_registry_links(p_registry_links);

  if not exists (
    select 1
    from editorial.source_types source_type
    where source_type.source_type =
            v_metadata ->> 'source_type'
      and source_type.enabled
  ) then
    raise exception
      'Choose an enabled Source type';
  end if;

  if v_metadata ? 'media_asset_id'
     and not exists (
       select 1
       from public.registry_media_assets media_asset
       where media_asset.id =
         (v_metadata ->> 'media_asset_id')::uuid
     ) then
    raise exception
      'Source Media asset was not found';
  end if;

  v_fingerprint :=
    editorial.source_content_fingerprint(
      v_metadata,
      v_registry_links
    );

  select source_version.content_fingerprint
  into v_current_fingerprint
  from editorial.source_versions source_version
  where source_version.id =
    v_source.current_working_version_id;

  if v_current_fingerprint = v_fingerprint then
    return jsonb_build_object(
      'source_id',
        v_source.id,
      'source_version_id',
        v_source.current_working_version_id,
      'working_revision',
        v_source.working_revision,
      'created',
        false
    );
  end if;

  select coalesce(max(source_version.version_number), 0) + 1
  into v_next_version_number
  from editorial.source_versions source_version
  where source_version.source_id = v_source.id;

  insert into editorial.source_versions (
    source_id,
    version_number,
    source_type,
    title,
    creator_display,
    publisher_display,
    source_url,
    media_asset_id,
    archive_identifier,
    publication_date,
    capture_date,
    retrieval_date,
    language_code,
    country_code,
    place_text,
    rights_status,
    consent_status,
    sensitivity,
    reliability_note,
    credit_line,
    internal_notes,
    created_by,
    content_fingerprint
  )
  values (
    v_source.id,
    v_next_version_number,
    v_metadata ->> 'source_type',
    v_metadata ->> 'title',
    v_metadata ->> 'creator_display',
    v_metadata ->> 'publisher_display',
    v_metadata ->> 'source_url',
    (v_metadata ->> 'media_asset_id')::uuid,
    v_metadata ->> 'archive_identifier',
    (v_metadata ->> 'publication_date')::date,
    (v_metadata ->> 'capture_date')::date,
    (v_metadata ->> 'retrieval_date')::date,
    v_metadata ->> 'language_code',
    v_metadata ->> 'country_code',
    v_metadata ->> 'place_text',
    coalesce(
      v_metadata ->> 'rights_status',
      'unknown'
    ),
    coalesce(
      v_metadata ->> 'consent_status',
      'unknown'
    ),
    coalesce(
      v_metadata ->> 'sensitivity',
      'none'
    ),
    v_metadata ->> 'reliability_note',
    v_metadata ->> 'credit_line',
    v_metadata ->> 'internal_notes',
    v_actor_id,
    v_fingerprint
  )
  returning id
  into v_source_version_id;

  perform editorial.insert_source_registry_links(
    v_source.id,
    v_source_version_id,
    v_registry_links,
    v_actor_id
  );

  select exists (
    select 1
    from editorial.source_review_events event
    where event.source_id = v_source.id
      and event.action in (
        'review_started',
        'changes_requested',
        'approved',
        'rejected'
      )
  )
  into v_has_prior_review;

  v_resulting_review_status :=
    case
      when v_has_prior_review then 'changes_requested'
      else 'draft'
    end;

  update editorial.sources
  set
    source_type = v_metadata ->> 'source_type',
    title = v_metadata ->> 'title',
    creator_display = v_metadata ->> 'creator_display',
    publisher_display = v_metadata ->> 'publisher_display',
    source_url = v_metadata ->> 'source_url',
    media_asset_id =
      (v_metadata ->> 'media_asset_id')::uuid,
    archive_identifier =
      v_metadata ->> 'archive_identifier',
    publication_date =
      (v_metadata ->> 'publication_date')::date,
    capture_date =
      (v_metadata ->> 'capture_date')::date,
    retrieval_date =
      (v_metadata ->> 'retrieval_date')::date,
    language_code =
      v_metadata ->> 'language_code',
    country_code =
      v_metadata ->> 'country_code',
    place_text =
      v_metadata ->> 'place_text',
    rights_status =
      coalesce(
        v_metadata ->> 'rights_status',
        'unknown'
      ),
    consent_status =
      coalesce(
        v_metadata ->> 'consent_status',
        'unknown'
      ),
    sensitivity =
      coalesce(
        v_metadata ->> 'sensitivity',
        'none'
      ),
    reliability_note =
      v_metadata ->> 'reliability_note',
    credit_line =
      v_metadata ->> 'credit_line',
    internal_notes =
      v_metadata ->> 'internal_notes',
    review_status = v_resulting_review_status,
    exposure_class = 'internal',
    current_working_version_id = v_source_version_id,
    current_submitted_version_id = null,
    current_approved_version_id = null,
    reviewed_by = null,
    reviewed_at = null,
    working_revision = v_source.working_revision + 1,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_source.id;

  insert into editorial.source_review_events (
    source_id,
    source_version_id,
    actor_id,
    action,
    reason,
    prior_review_status,
    resulting_review_status,
    prior_exposure_class,
    resulting_exposure_class,
    prior_source_state,
    resulting_source_state,
    correlation_id
  )
  values (
    v_source.id,
    v_source_version_id,
    v_actor_id,
    'version_saved',
    nullif(btrim(p_reason), ''),
    v_source.review_status,
    v_resulting_review_status,
    v_source.exposure_class,
    'internal',
    v_source.source_state,
    v_source.source_state,
    p_correlation_id
  );

  return jsonb_build_object(
    'source_id',
      v_source.id,
    'source_version_id',
      v_source_version_id,
    'working_revision',
      v_source.working_revision + 1,
    'created',
      true
  );
end;
$function$;

create or replace function public.submit_source_version_for_review(
  p_source_id uuid,
  p_source_version_id uuid,
  p_expected_working_revision bigint,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_source editorial.sources%rowtype;
begin
  v_actor_id :=
    editorial.assert_source_command_actor('manage_sources');

  select *
  into v_source
  from editorial.sources source
  where source.id = p_source_id
  for update;

  if not found then
    raise exception
      'Source was not found';
  end if;

  if v_source.working_revision <>
       p_expected_working_revision then
    raise exception
      'Source working revision conflict. Expected %, found %',
      p_expected_working_revision,
      v_source.working_revision;
  end if;

  if v_source.source_state <> 'active' then
    raise exception
      'Only active Sources can be submitted';
  end if;

  if v_source.current_working_version_id
       is distinct from p_source_version_id then
    raise exception
      'Only the current working Source version can be submitted';
  end if;

  if not exists (
    select 1
    from editorial.source_versions source_version
    where source_version.id = p_source_version_id
      and source_version.source_id = p_source_id
  ) then
    raise exception
      'Source version does not belong to the Source';
  end if;

  update editorial.sources
  set
    current_submitted_version_id = p_source_version_id,
    review_status = 'ready_for_review',
    exposure_class = 'internal',
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_source_id;

  insert into editorial.source_review_events (
    source_id,
    source_version_id,
    actor_id,
    action,
    reason,
    prior_review_status,
    resulting_review_status,
    prior_exposure_class,
    resulting_exposure_class,
    prior_source_state,
    resulting_source_state,
    correlation_id
  )
  values (
    p_source_id,
    p_source_version_id,
    v_actor_id,
    'review_started',
    nullif(btrim(p_reason), ''),
    v_source.review_status,
    'ready_for_review',
    v_source.exposure_class,
    'internal',
    v_source.source_state,
    v_source.source_state,
    p_correlation_id
  );

  return jsonb_build_object(
    'source_id',
      p_source_id,
    'source_version_id',
      p_source_version_id,
    'working_revision',
      v_source.working_revision,
    'review_status',
      'ready_for_review'
  );
end;
$function$;

create or replace function public.review_source_version(
  p_source_id uuid,
  p_source_version_id uuid,
  p_decision text,
  p_reason text default null,
  p_exposure_class text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_source editorial.sources%rowtype;
  v_resulting_status text;
  v_resulting_exposure text;
  v_action text;
begin
  v_actor_id :=
    editorial.assert_source_command_actor('review_sources');

  if p_decision not in (
    'start_review',
    'request_changes',
    'approve',
    'reject'
  ) then
    raise exception
      'Choose a supported Source review decision';
  end if;

  if p_decision in (
       'request_changes',
       'reject'
     )
     and nullif(btrim(p_reason), '') is null then
    raise exception
      'A review reason is required';
  end if;

  select *
  into v_source
  from editorial.sources source
  where source.id = p_source_id
  for update;

  if not found then
    raise exception
      'Source was not found';
  end if;

  if v_source.source_state <> 'active' then
    raise exception
      'Only active Sources can be reviewed';
  end if;

  if v_source.current_submitted_version_id
       is distinct from p_source_version_id then
    raise exception
      'Review must target the exact submitted Source version';
  end if;

  if not exists (
    select 1
    from editorial.source_versions source_version
    where source_version.id = p_source_version_id
      and source_version.source_id = p_source_id
  ) then
    raise exception
      'Source version does not belong to the Source';
  end if;

  if p_decision = 'start_review' then
    if v_source.review_status <> 'ready_for_review' then
      raise exception
        'Only a ready Source can enter review';
    end if;

    v_resulting_status := 'in_review';
    v_resulting_exposure := 'internal';
    v_action := 'review_started';

    update editorial.sources
    set
      review_status = v_resulting_status,
      exposure_class = v_resulting_exposure,
      updated_by = v_actor_id,
      updated_at = now()
    where id = p_source_id;

  elsif p_decision = 'request_changes' then
    if v_source.review_status not in (
      'ready_for_review',
      'in_review'
    ) then
      raise exception
        'Source is not currently reviewable';
    end if;

    v_resulting_status := 'changes_requested';
    v_resulting_exposure := 'internal';
    v_action := 'changes_requested';

    update editorial.sources
    set
      review_status = v_resulting_status,
      exposure_class = v_resulting_exposure,
      current_submitted_version_id = null,
      current_approved_version_id = null,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_by = v_actor_id,
      updated_at = now()
    where id = p_source_id;

  elsif p_decision = 'approve' then
    if v_source.review_status not in (
      'ready_for_review',
      'in_review'
    ) then
      raise exception
        'Source is not currently reviewable';
    end if;

    if p_exposure_class not in (
      'public',
      'public_redacted',
      'internal'
    ) then
      raise exception
        'Approval requires public, public_redacted, or internal exposure';
    end if;

    v_resulting_status := 'approved';
    v_resulting_exposure := p_exposure_class;
    v_action := 'approved';

    update editorial.sources
    set
      review_status = v_resulting_status,
      exposure_class = v_resulting_exposure,
      current_approved_version_id = p_source_version_id,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_by = v_actor_id,
      updated_at = now()
    where id = p_source_id;

  else
    if v_source.review_status not in (
      'ready_for_review',
      'in_review'
    ) then
      raise exception
        'Source is not currently reviewable';
    end if;

    v_resulting_status := 'rejected';
    v_resulting_exposure := 'internal';
    v_action := 'rejected';

    update editorial.sources
    set
      review_status = v_resulting_status,
      exposure_class = v_resulting_exposure,
      current_approved_version_id = null,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_by = v_actor_id,
      updated_at = now()
    where id = p_source_id;
  end if;

  insert into editorial.source_review_events (
    source_id,
    source_version_id,
    actor_id,
    action,
    reason,
    prior_review_status,
    resulting_review_status,
    prior_exposure_class,
    resulting_exposure_class,
    prior_source_state,
    resulting_source_state,
    correlation_id
  )
  values (
    p_source_id,
    p_source_version_id,
    v_actor_id,
    v_action,
    nullif(btrim(p_reason), ''),
    v_source.review_status,
    v_resulting_status,
    v_source.exposure_class,
    v_resulting_exposure,
    v_source.source_state,
    v_source.source_state,
    p_correlation_id
  );

  return jsonb_build_object(
    'source_id',
      p_source_id,
    'source_version_id',
      p_source_version_id,
    'decision',
      p_decision,
    'review_status',
      v_resulting_status,
    'exposure_class',
      v_resulting_exposure,
    'working_revision',
      v_source.working_revision
  );
end;
$function$;

create or replace function public.withdraw_source(
  p_source_id uuid,
  p_reason text,
  p_withdrawal_public_mode text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_source editorial.sources%rowtype;
  v_public_mode text;
begin
  v_actor_id :=
    editorial.assert_source_command_actor('withdraw_sources');

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'A Source withdrawal reason is required';
  end if;

  v_public_mode :=
    coalesce(
      nullif(btrim(p_withdrawal_public_mode), ''),
      'hide_public_reference'
    );

  if v_public_mode not in (
    'retain_public_reference',
    'redact_public_reference',
    'hide_public_reference'
  ) then
    raise exception
      'Choose a supported withdrawal public mode';
  end if;

  select *
  into v_source
  from editorial.sources source
  where source.id = p_source_id
  for update;

  if not found then
    raise exception
      'Source was not found';
  end if;

  if v_source.source_state = 'withdrawn' then
    raise exception
      'Source is already withdrawn';
  end if;

  if v_source.source_state = 'archived' then
    raise exception
      'Archived Sources cannot be withdrawn';
  end if;

  update editorial.sources
  set
    source_state = 'withdrawn',
    withdrawn_by = v_actor_id,
    withdrawn_at = now(),
    withdrawal_reason = btrim(p_reason),
    withdrawal_public_mode = v_public_mode,
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_source_id;

  insert into editorial.source_review_events (
    source_id,
    source_version_id,
    actor_id,
    action,
    reason,
    prior_review_status,
    resulting_review_status,
    prior_exposure_class,
    resulting_exposure_class,
    prior_source_state,
    resulting_source_state,
    correlation_id
  )
  values (
    p_source_id,
    v_source.current_working_version_id,
    v_actor_id,
    'withdrawn',
    btrim(p_reason),
    v_source.review_status,
    v_source.review_status,
    v_source.exposure_class,
    v_source.exposure_class,
    v_source.source_state,
    'withdrawn',
    p_correlation_id
  );

  return jsonb_build_object(
    'source_id',
      p_source_id,
    'source_state',
      'withdrawn',
    'withdrawal_public_mode',
      v_public_mode
  );
end;
$function$;

create or replace function public.restore_source(
  p_source_id uuid,
  p_reason text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_source editorial.sources%rowtype;
begin
  v_actor_id :=
    editorial.assert_source_command_actor('withdraw_sources');

  if nullif(btrim(p_reason), '') is null then
    raise exception
      'A Source restoration reason is required';
  end if;

  select *
  into v_source
  from editorial.sources source
  where source.id = p_source_id
  for update;

  if not found then
    raise exception
      'Source was not found';
  end if;

  if v_source.source_state <> 'withdrawn' then
    raise exception
      'Only a withdrawn Source can be restored';
  end if;

  update editorial.sources
  set
    source_state = 'active',
    review_status = 'changes_requested',
    exposure_class = 'internal',
    current_submitted_version_id = null,
    current_approved_version_id = null,
    reviewed_by = null,
    reviewed_at = null,
    withdrawn_by = null,
    withdrawn_at = null,
    withdrawal_reason = null,
    withdrawal_public_mode = 'hide_public_reference',
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_source_id;

  insert into editorial.source_review_events (
    source_id,
    source_version_id,
    actor_id,
    action,
    reason,
    prior_review_status,
    resulting_review_status,
    prior_exposure_class,
    resulting_exposure_class,
    prior_source_state,
    resulting_source_state,
    correlation_id
  )
  values (
    p_source_id,
    v_source.current_working_version_id,
    v_actor_id,
    'restored',
    btrim(p_reason),
    v_source.review_status,
    'changes_requested',
    v_source.exposure_class,
    'internal',
    v_source.source_state,
    'active',
    p_correlation_id
  );

  return jsonb_build_object(
    'source_id',
      p_source_id,
    'source_state',
      'active',
    'review_status',
      'changes_requested',
    'exposure_class',
      'internal',
    'working_revision',
      v_source.working_revision
  );
end;
$function$;

revoke all
on function public.create_source(jsonb, jsonb, uuid)
from public, anon;

revoke all
on function public.save_source_version(
  uuid,
  bigint,
  jsonb,
  jsonb,
  text,
  uuid
)
from public, anon;

revoke all
on function public.submit_source_version_for_review(
  uuid,
  uuid,
  bigint,
  text,
  uuid
)
from public, anon;

revoke all
on function public.review_source_version(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid
)
from public, anon;

revoke all
on function public.withdraw_source(
  uuid,
  text,
  text,
  uuid
)
from public, anon;

revoke all
on function public.restore_source(
  uuid,
  text,
  uuid
)
from public, anon;

grant execute
on function public.create_source(jsonb, jsonb, uuid)
to authenticated, service_role;

grant execute
on function public.save_source_version(
  uuid,
  bigint,
  jsonb,
  jsonb,
  text,
  uuid
)
to authenticated, service_role;

grant execute
on function public.submit_source_version_for_review(
  uuid,
  uuid,
  bigint,
  text,
  uuid
)
to authenticated, service_role;

grant execute
on function public.review_source_version(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid
)
to authenticated, service_role;

grant execute
on function public.withdraw_source(
  uuid,
  text,
  text,
  uuid
)
to authenticated, service_role;

grant execute
on function public.restore_source(
  uuid,
  text,
  uuid
)
to authenticated, service_role;

comment on function public.create_source(jsonb, jsonb, uuid)
is 'Creates one governed Source and immutable Source version 1.';

comment on function public.save_source_version(
  uuid,
  bigint,
  jsonb,
  jsonb,
  text,
  uuid
)
is 'Creates a new immutable Source version only when Source content materially changes.';

comment on function public.submit_source_version_for_review(
  uuid,
  uuid,
  bigint,
  text,
  uuid
)
is 'Submits the exact current working Source version for review.';

comment on function public.review_source_version(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid
)
is 'Applies a governed review decision to the exact submitted Source version.';

comment on function public.withdraw_source(
  uuid,
  text,
  text,
  uuid
)
is 'Withdraws a Source without deleting historical Source identity.';

comment on function public.restore_source(
  uuid,
  text,
  uuid
)
is 'Restores a withdrawn Source to an internal changes-requested state.';

create or replace function editorial.assert_citation_command_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if auth.role() = 'service_role' then
    return v_actor_id;
  end if;

  if v_actor_id is null then
    raise exception
      'Authentication is required';
  end if;

  if not (
    coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'manage_citations'
      ),
      false
    )
  ) then
    raise exception
      'You do not have Citation management authority';
  end if;

  return v_actor_id;
end;
$function$;

revoke all
on function editorial.assert_citation_command_actor()
from public, anon, authenticated;

grant execute
on function editorial.assert_citation_command_actor()
to service_role;

create or replace function public.create_citation(
  p_source_id uuid,
  p_source_version_id uuid,
  p_locator_type text,
  p_locator_data jsonb,
  p_quotation text default null,
  p_editor_note text default null,
  p_public_label text default null,
  p_public_safe boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_source editorial.sources%rowtype;
  v_citation_id uuid;
  v_public_safe boolean;
begin
  v_actor_id :=
    editorial.assert_citation_command_actor();

  v_public_safe := coalesce(p_public_safe, false);

  select *
  into v_source
  from editorial.sources source
  where source.id = p_source_id;

  if not found then
    raise exception
      'Source was not found';
  end if;

  if not exists (
    select 1
    from editorial.source_versions source_version
    where source_version.id = p_source_version_id
      and source_version.source_id = p_source_id
  ) then
    raise exception
      'Source version does not belong to the Source';
  end if;

  if not exists (
    select 1
    from editorial.citation_locator_types locator_type
    where locator_type.locator_type = p_locator_type
      and locator_type.enabled
  ) then
    raise exception
      'Choose an enabled Citation locator type';
  end if;

  perform editorial.validate_citation_locator(
    p_locator_type,
    p_locator_data
  );

  if v_public_safe then
    if v_source.source_state <> 'active' then
      raise exception
        'A withdrawn or archived Source cannot create a public-safe Citation';
    end if;

    if v_source.review_status <> 'approved'
       or v_source.current_approved_version_id
            is distinct from p_source_version_id then
      raise exception
        'A public-safe Citation requires the exact approved Source version';
    end if;

    if v_source.exposure_class not in (
      'public',
      'public_redacted'
    ) then
      raise exception
        'A public-safe Citation requires a publicly eligible Source';
    end if;
  end if;

  insert into editorial.citations (
    source_id,
    source_version_id,
    locator_type,
    locator_data,
    quotation,
    editor_note,
    public_label,
    public_safe,
    citation_state,
    created_by
  )
  values (
    p_source_id,
    p_source_version_id,
    p_locator_type,
    p_locator_data,
    nullif(btrim(p_quotation), ''),
    nullif(btrim(p_editor_note), ''),
    nullif(btrim(p_public_label), ''),
    v_public_safe,
    'active',
    v_actor_id
  )
  returning id
  into v_citation_id;

  return jsonb_build_object(
    'citation_id',
      v_citation_id,
    'source_id',
      p_source_id,
    'source_version_id',
      p_source_version_id,
    'public_safe',
      v_public_safe,
    'citation_state',
      'active'
  );
end;
$function$;

create or replace function public.attach_article_version_citation(
  p_article_version_id uuid,
  p_citation_id uuid,
  p_citation_purpose text,
  p_target_anchor_type text,
  p_target_anchor_data jsonb,
  p_display_order integer,
  p_public_safe boolean,
  p_expected_citation_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_article_version editorial.article_versions%rowtype;
  v_resource editorial.resources%rowtype;
  v_citation editorial.citations%rowtype;
  v_source editorial.sources%rowtype;
  v_revision editorial.article_version_trust_revisions%rowtype;
  v_attachment_id uuid;
  v_public_safe boolean;
begin
  v_actor_id :=
    editorial.assert_citation_command_actor();

  if p_display_order is null
     or p_display_order < 0 then
    raise exception
      'Citation display order must be zero or greater';
  end if;

  if p_expected_citation_revision is null
     or p_expected_citation_revision < 1 then
    raise exception
      'Expected Citation revision must be one or greater';
  end if;

  if p_citation_purpose not in (
    'supports',
    'challenges',
    'contextualizes',
    'quotes',
    'documents',
    'methodology',
    'other'
  ) then
    raise exception
      'Choose a supported Citation purpose';
  end if;

  perform editorial.validate_citation_target_anchor(
    p_target_anchor_type,
    p_target_anchor_data
  );

  select *
  into v_article_version
  from editorial.article_versions article_version
  where article_version.id = p_article_version_id;

  if not found then
    raise exception
      'Article version was not found';
  end if;

  select *
  into v_resource
  from editorial.resources resource
  where resource.id = v_article_version.resource_id
    and resource.resource_kind = 'article';

  if not found then
    raise exception
      'Article resource was not found';
  end if;

  if auth.role() <> 'service_role'
     and not editorial.current_user_can_edit_article(
       v_resource.id
     ) then
    raise exception
      'You do not have authority to edit this Article';
  end if;

  insert into editorial.article_version_trust_revisions (
    article_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    p_article_version_id,
    1,
    1,
    v_actor_id,
    now()
  )
  on conflict (article_version_id) do nothing;

  select *
  into v_revision
  from editorial.article_version_trust_revisions revision
  where revision.article_version_id =
    p_article_version_id
  for update;

  if v_revision.citation_revision <>
       p_expected_citation_revision then
    raise exception
      'Citation revision conflict. Expected %, found %',
      p_expected_citation_revision,
      v_revision.citation_revision;
  end if;

  select *
  into v_citation
  from editorial.citations citation
  where citation.id = p_citation_id;

  if not found then
    raise exception
      'Citation was not found';
  end if;

  if v_citation.citation_state <> 'active' then
    raise exception
      'Only active Citations can be attached';
  end if;

  v_public_safe := coalesce(p_public_safe, false);

  if v_public_safe then
    if not v_citation.public_safe then
      raise exception
        'This Citation is not approved for public use';
    end if;

    select *
    into v_source
    from editorial.sources source
    where source.id = v_citation.source_id;

    if not found
       or v_source.source_state <> 'active'
       or v_source.review_status <> 'approved'
       or v_source.current_approved_version_id
            is distinct from
            v_citation.source_version_id
       or v_source.exposure_class not in (
            'public',
            'public_redacted'
          ) then
      raise exception
        'Citation Source is not currently eligible for public attachment';
    end if;
  end if;

  if exists (
    select 1
    from editorial.resource_citations attachment
    where attachment.target_version_id =
            p_article_version_id
      and attachment.citation_id = p_citation_id
  ) then
    raise exception
      'Citation is already attached to this Article version';
  end if;

  if exists (
    select 1
    from editorial.resource_citations attachment
    where attachment.target_version_id =
            p_article_version_id
      and attachment.display_order = p_display_order
  ) then
    raise exception
      'Citation display order is already in use';
  end if;

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  values (
    v_resource.id,
    'article',
    'article_version',
    p_article_version_id,
    p_citation_id,
    p_citation_purpose,
    p_target_anchor_type,
    p_target_anchor_data,
    p_display_order,
    v_public_safe,
    v_actor_id
  )
  returning id
  into v_attachment_id;

  update editorial.article_version_trust_revisions
  set
    citation_revision =
      v_revision.citation_revision + 1,
    updated_by = v_actor_id,
    updated_at = now()
  where article_version_id = p_article_version_id;

  return jsonb_build_object(
    'attachment_id',
      v_attachment_id,
    'article_version_id',
      p_article_version_id,
    'citation_revision',
      v_revision.citation_revision + 1
  );
end;
$function$;

create or replace function public.replace_article_version_citations(
  p_article_version_id uuid,
  p_attachments jsonb,
  p_expected_citation_revision bigint,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_article_version editorial.article_versions%rowtype;
  v_resource editorial.resources%rowtype;
  v_revision editorial.article_version_trust_revisions%rowtype;
  v_requested_count integer;
  v_resulting_revision bigint;
  v_attachments jsonb;
begin
  v_actor_id :=
    editorial.assert_citation_command_actor();

  if p_attachments is null
     or jsonb_typeof(p_attachments) <> 'array' then
    raise exception
      'Citation attachments must be a JSON array';
  end if;

  if p_expected_citation_revision is null
     or p_expected_citation_revision < 1 then
    raise exception
      'Expected Citation revision must be one or greater';
  end if;

  select *
  into v_article_version
  from editorial.article_versions article_version
  where article_version.id = p_article_version_id;

  if not found then
    raise exception
      'Article version was not found';
  end if;

  select *
  into v_resource
  from editorial.resources resource
  where resource.id = v_article_version.resource_id
    and resource.resource_kind = 'article';

  if not found then
    raise exception
      'Article resource was not found';
  end if;

  if auth.role() <> 'service_role'
     and not editorial.current_user_can_edit_article(
       v_resource.id
     ) then
    raise exception
      'You do not have authority to edit this Article';
  end if;

  insert into editorial.article_version_trust_revisions (
    article_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    p_article_version_id,
    1,
    1,
    v_actor_id,
    now()
  )
  on conflict (article_version_id) do nothing;

  select *
  into v_revision
  from editorial.article_version_trust_revisions revision
  where revision.article_version_id =
    p_article_version_id
  for update;

  if v_revision.citation_revision <>
       p_expected_citation_revision then
    raise exception
      'Citation revision conflict. Expected %, found %',
      p_expected_citation_revision,
      v_revision.citation_revision;
  end if;

  v_requested_count := jsonb_array_length(p_attachments);

  if exists (
    select 1
    from jsonb_array_elements(p_attachments) item(value)
    where jsonb_typeof(item.value) <> 'object'
       or not item.value ? 'citation_id'
       or not item.value ? 'citation_purpose'
       or not item.value ? 'target_anchor_type'
       or not item.value ? 'target_anchor_data'
       or not item.value ? 'display_order'
       or not item.value ? 'public_safe'
       or jsonb_typeof(
            item.value -> 'target_anchor_data'
          ) <> 'object'
       or jsonb_typeof(
            item.value -> 'public_safe'
          ) <> 'boolean'
       or jsonb_typeof(
            item.value -> 'display_order'
          ) <> 'number'
  ) then
    raise exception
      'Every Citation attachment requires a complete valid object';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      citation_id uuid,
      citation_purpose text,
      target_anchor_type text,
      target_anchor_data jsonb,
      display_order integer,
      public_safe boolean
    )
    where requested.citation_id is null
       or requested.citation_purpose is null
       or requested.target_anchor_type is null
       or requested.target_anchor_data is null
       or requested.display_order is null
       or requested.public_safe is null
       or requested.display_order < 0
       or requested.citation_purpose not in (
            'supports',
            'challenges',
            'contextualizes',
            'quotes',
            'documents',
            'methodology',
            'other'
          )
  ) then
    raise exception
      'Citation attachment contains an invalid required value';
  end if;

  if exists (
    select 1
    from (
      select
        requested.citation_id,
        count(*) as duplicate_count
      from jsonb_to_recordset(p_attachments) as requested(
        citation_id uuid,
        citation_purpose text,
        target_anchor_type text,
        target_anchor_data jsonb,
        display_order integer,
        public_safe boolean
      )
      group by requested.citation_id
      having count(*) > 1
    ) duplicate_citations
  ) then
    raise exception
      'Citation attachments contain duplicate Citation identities';
  end if;

  if exists (
    select 1
    from (
      select
        requested.display_order,
        count(*) as duplicate_count
      from jsonb_to_recordset(p_attachments) as requested(
        citation_id uuid,
        citation_purpose text,
        target_anchor_type text,
        target_anchor_data jsonb,
        display_order integer,
        public_safe boolean
      )
      group by requested.display_order
      having count(*) > 1
    ) duplicate_orders
  ) then
    raise exception
      'Citation attachments contain duplicate display orders';
  end if;

  if v_requested_count > 0
     and (
       (
         select min(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           citation_id uuid,
           citation_purpose text,
           target_anchor_type text,
           target_anchor_data jsonb,
           display_order integer,
           public_safe boolean
         )
       ) <> 0
       or
       (
         select max(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           citation_id uuid,
           citation_purpose text,
           target_anchor_type text,
           target_anchor_data jsonb,
           display_order integer,
           public_safe boolean
         )
       ) <> v_requested_count - 1
     ) then
    raise exception
      'Citation display order must be zero-based and contiguous';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      citation_id uuid,
      citation_purpose text,
      target_anchor_type text,
      target_anchor_data jsonb,
      display_order integer,
      public_safe boolean
    )
    where not exists (
      select 1
      from editorial.citations citation
      where citation.id = requested.citation_id
        and citation.citation_state = 'active'
    )
  ) then
    raise exception
      'Every attached Citation must exist and be active';
  end if;

  perform editorial.validate_citation_target_anchor(
    requested.target_anchor_type,
    requested.target_anchor_data
  )
  from jsonb_to_recordset(p_attachments) as requested(
    citation_id uuid,
    citation_purpose text,
    target_anchor_type text,
    target_anchor_data jsonb,
    display_order integer,
    public_safe boolean
  );

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      citation_id uuid,
      citation_purpose text,
      target_anchor_type text,
      target_anchor_data jsonb,
      display_order integer,
      public_safe boolean
    )
    join editorial.citations citation
      on citation.id = requested.citation_id
    join editorial.sources source
      on source.id = citation.source_id
    where requested.public_safe
      and (
        not citation.public_safe
        or source.source_state <> 'active'
        or source.review_status <> 'approved'
        or source.current_approved_version_id
             is distinct from
             citation.source_version_id
        or source.exposure_class not in (
             'public',
             'public_redacted'
           )
      )
  ) then
    raise exception
      'A requested public Citation attachment is not publicly eligible';
  end if;

  delete from editorial.resource_citations attachment
  where attachment.target_version_id =
    p_article_version_id;

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  select
    v_resource.id,
    'article',
    'article_version',
    p_article_version_id,
    requested.citation_id,
    requested.citation_purpose,
    requested.target_anchor_type,
    requested.target_anchor_data,
    requested.display_order,
    requested.public_safe,
    v_actor_id
  from jsonb_to_recordset(p_attachments) as requested(
    citation_id uuid,
    citation_purpose text,
    target_anchor_type text,
    target_anchor_data jsonb,
    display_order integer,
    public_safe boolean
  )
  order by requested.display_order;

  v_resulting_revision :=
    v_revision.citation_revision + 1;

  update editorial.article_version_trust_revisions
  set
    citation_revision = v_resulting_revision,
    updated_by = v_actor_id,
    updated_at = now()
  where article_version_id = p_article_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attachment_id',
          attachment.id,
        'citation_id',
          attachment.citation_id,
        'citation_purpose',
          attachment.citation_purpose,
        'target_anchor_type',
          attachment.target_anchor_type,
        'target_anchor_data',
          attachment.target_anchor_data,
        'display_order',
          attachment.display_order,
        'public_safe',
          attachment.public_safe
      )
      order by attachment.display_order
    ),
    '[]'::jsonb
  )
  into v_attachments
  from editorial.resource_citations attachment
  where attachment.target_version_id =
    p_article_version_id;

  return jsonb_build_object(
    'article_version_id',
      p_article_version_id,
    'citation_revision',
      v_resulting_revision,
    'correlation_id',
      p_correlation_id,
    'attachments',
      v_attachments
  );
end;
$function$;

revoke all
on function public.create_citation(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  text,
  boolean
)
from public, anon;

revoke all
on function public.attach_article_version_citation(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  integer,
  boolean,
  bigint
)
from public, anon;

revoke all
on function public.replace_article_version_citations(
  uuid,
  jsonb,
  bigint,
  uuid
)
from public, anon;

grant execute
on function public.create_citation(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  text,
  boolean
)
to authenticated, service_role;

grant execute
on function public.attach_article_version_citation(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  integer,
  boolean,
  bigint
)
to authenticated, service_role;

grant execute
on function public.replace_article_version_citations(
  uuid,
  jsonb,
  bigint,
  uuid
)
to authenticated, service_role;

comment on function public.create_citation(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  text,
  boolean
)
is 'Creates one immutable Citation against one exact Source version.';

comment on function public.attach_article_version_citation(
  uuid,
  uuid,
  text,
  text,
  jsonb,
  integer,
  boolean,
  bigint
)
is 'Attaches one Citation to one immutable Article version with revision control.';

comment on function public.replace_article_version_citations(
  uuid,
  jsonb,
  bigint,
  uuid
)
is 'Atomically replaces the complete ordered Citation set for one Article version.';

create or replace function editorial.assert_credit_command_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if auth.role() = 'service_role' then
    return v_actor_id;
  end if;

  if v_actor_id is null then
    raise exception
      'Authentication is required';
  end if;

  if not (
    coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'manage_credits'
      ),
      false
    )
  ) then
    raise exception
      'You do not have Credit management authority';
  end if;

  return v_actor_id;
end;
$function$;

revoke all
on function editorial.assert_credit_command_actor()
from public, anon, authenticated;

grant execute
on function editorial.assert_credit_command_actor()
to service_role;

create or replace function public.create_external_contributor(
  p_display_name text,
  p_public_role text default null,
  p_public_url text default null,
  p_location_text text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_consent_status text default 'unknown',
  p_public_safe boolean default false,
  p_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_contributor_id uuid;
  v_consent_status text;
  v_public_safe boolean;
begin
  v_actor_id :=
    editorial.assert_credit_command_actor();

  if nullif(btrim(p_display_name), '') is null then
    raise exception
      'External contributor display name is required';
  end if;

  v_consent_status :=
    coalesce(
      nullif(btrim(p_consent_status), ''),
      'unknown'
    );

  if v_consent_status not in (
    'unknown',
    'not_required',
    'requested',
    'granted',
    'limited',
    'declined',
    'withdrawn'
  ) then
    raise exception
      'Choose a supported contributor consent status';
  end if;

  v_public_safe := coalesce(p_public_safe, false);

  if v_public_safe
     and v_consent_status not in (
       'granted',
       'not_required'
     ) then
    raise exception
      'Public-safe contributors require granted or not-required consent';
  end if;

  insert into editorial.external_contributors (
    display_name,
    public_role,
    public_url,
    location_text,
    contact_email,
    contact_phone,
    consent_status,
    public_safe,
    contributor_state,
    internal_notes,
    created_by,
    updated_by
  )
  values (
    btrim(p_display_name),
    nullif(btrim(p_public_role), ''),
    nullif(btrim(p_public_url), ''),
    nullif(btrim(p_location_text), ''),
    nullif(btrim(p_contact_email), ''),
    nullif(btrim(p_contact_phone), ''),
    v_consent_status,
    v_public_safe,
    'active',
    nullif(btrim(p_internal_notes), ''),
    v_actor_id,
    v_actor_id
  )
  returning id
  into v_contributor_id;

  return jsonb_build_object(
    'external_contributor_id',
      v_contributor_id,
    'contributor_state',
      'active',
    'consent_status',
      v_consent_status,
    'public_safe',
      v_public_safe
  );
end;
$function$;

create or replace function public.update_external_contributor(
  p_external_contributor_id uuid,
  p_display_name text,
  p_public_role text default null,
  p_public_url text default null,
  p_location_text text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_consent_status text default 'unknown',
  p_public_safe boolean default false,
  p_contributor_state text default 'active',
  p_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_existing editorial.external_contributors%rowtype;
  v_consent_status text;
  v_contributor_state text;
  v_public_safe boolean;
begin
  v_actor_id :=
    editorial.assert_credit_command_actor();

  if nullif(btrim(p_display_name), '') is null then
    raise exception
      'External contributor display name is required';
  end if;

  v_consent_status :=
    coalesce(
      nullif(btrim(p_consent_status), ''),
      'unknown'
    );

  if v_consent_status not in (
    'unknown',
    'not_required',
    'requested',
    'granted',
    'limited',
    'declined',
    'withdrawn'
  ) then
    raise exception
      'Choose a supported contributor consent status';
  end if;

  v_contributor_state :=
    coalesce(
      nullif(btrim(p_contributor_state), ''),
      'active'
    );

  if v_contributor_state not in (
    'active',
    'withdrawn',
    'archived'
  ) then
    raise exception
      'Choose a supported contributor state';
  end if;

  v_public_safe := coalesce(p_public_safe, false);

  if v_public_safe
     and (
       v_contributor_state <> 'active'
       or v_consent_status not in (
            'granted',
            'not_required'
          )
     ) then
    raise exception
      'Public-safe contributors must be active with granted or not-required consent';
  end if;

  select *
  into v_existing
  from editorial.external_contributors contributor
  where contributor.id = p_external_contributor_id
  for update;

  if not found then
    raise exception
      'External contributor was not found';
  end if;

  update editorial.external_contributors
  set
    display_name = btrim(p_display_name),
    public_role = nullif(btrim(p_public_role), ''),
    public_url = nullif(btrim(p_public_url), ''),
    location_text = nullif(btrim(p_location_text), ''),
    contact_email = nullif(btrim(p_contact_email), ''),
    contact_phone = nullif(btrim(p_contact_phone), ''),
    consent_status = v_consent_status,
    public_safe = v_public_safe,
    contributor_state = v_contributor_state,
    internal_notes = nullif(btrim(p_internal_notes), ''),
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_external_contributor_id;

  return jsonb_build_object(
    'external_contributor_id',
      p_external_contributor_id,
    'contributor_state',
      v_contributor_state,
    'consent_status',
      v_consent_status,
    'public_safe',
      v_public_safe
  );
end;
$function$;

create or replace function public.create_credit(
  p_credit_role text,
  p_user_id uuid default null,
  p_registry_author_id uuid default null,
  p_external_contributor_id uuid default null,
  p_role_label_override text default null,
  p_credit_note text default null,
  p_public_safe boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_display_name text;
  v_registry_author_slug text;
  v_user_username text;
  v_external_contributor editorial.external_contributors%rowtype;
  v_credit_id uuid;
  v_public_safe boolean;
begin
  v_actor_id :=
    editorial.assert_credit_command_actor();

  if num_nonnulls(
       p_user_id,
       p_registry_author_id,
       p_external_contributor_id
     ) <> 1 then
    raise exception
      'Choose exactly one credited-party identity';
  end if;

  if not exists (
    select 1
    from editorial.credit_roles credit_role
    where credit_role.credit_role = p_credit_role
      and credit_role.enabled
  ) then
    raise exception
      'Choose an enabled Credit role';
  end if;

  v_public_safe := coalesce(p_public_safe, false);

  if p_user_id is not null then
    select
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(profile.username), '')
    into
      v_display_name,
      v_user_username
    from public.user_profiles profile
    where profile.user_id = p_user_id
      and profile.status = 'active';

    if not found or v_display_name is null then
      raise exception
        'Active authenticated-user profile with a display name was not found';
    end if;

  elsif p_registry_author_id is not null then
    select
      nullif(btrim(author_record.name), ''),
      nullif(btrim(author_record.slug), '')
    into
      v_display_name,
      v_registry_author_slug
    from public.registry_authors author_record
    where author_record.id = p_registry_author_id;

    if not found
       or v_display_name is null
       or v_registry_author_slug is null then
      raise exception
        'Registry author was not found or is incomplete';
    end if;

  else
    select *
    into v_external_contributor
    from editorial.external_contributors contributor
    where contributor.id = p_external_contributor_id;

    if not found then
      raise exception
        'External contributor was not found';
    end if;

    if v_external_contributor.contributor_state <> 'active' then
      raise exception
        'Only active external contributors can receive new Credits';
    end if;

    v_display_name :=
      nullif(
        btrim(v_external_contributor.display_name),
        ''
      );

    if v_display_name is null then
      raise exception
        'External contributor display name is missing';
    end if;

    if v_public_safe
       and (
         not v_external_contributor.public_safe
         or v_external_contributor.consent_status
              not in (
                'granted',
                'not_required'
              )
       ) then
      raise exception
        'Public-safe external-contributor Credits require active public-safe consent';
    end if;
  end if;

  insert into editorial.credits (
    credit_role,
    user_id,
    registry_author_id,
    external_contributor_id,
    display_name_snapshot,
    role_label_snapshot,
    registry_author_slug_snapshot,
    user_username_snapshot,
    credit_note,
    created_by
  )
  values (
    p_credit_role,
    p_user_id,
    p_registry_author_id,
    p_external_contributor_id,
    v_display_name,
    nullif(btrim(p_role_label_override), ''),
    v_registry_author_slug,
    v_user_username,
    nullif(btrim(p_credit_note), ''),
    v_actor_id
  )
  returning id
  into v_credit_id;

  insert into editorial.credit_governance (
    credit_id,
    public_safe,
    credit_state,
    governance_revision,
    reason,
    updated_by,
    updated_at
  )
  values (
    v_credit_id,
    v_public_safe,
    'active',
    1,
    null,
    v_actor_id,
    now()
  );

  return jsonb_build_object(
    'credit_id',
      v_credit_id,
    'governance_revision',
      1,
    'credit_state',
      'active',
    'public_safe',
      v_public_safe,
    'display_name_snapshot',
      v_display_name,
    'registry_author_slug_snapshot',
      v_registry_author_slug,
    'user_username_snapshot',
      v_user_username
  );
end;
$function$;

create or replace function public.set_credit_governance(
  p_credit_id uuid,
  p_credit_state text,
  p_public_safe boolean,
  p_expected_governance_revision bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_credit editorial.credits%rowtype;
  v_governance editorial.credit_governance%rowtype;
  v_external_contributor editorial.external_contributors%rowtype;
  v_public_safe boolean;
begin
  v_actor_id :=
    editorial.assert_credit_command_actor();

  if p_credit_state not in (
    'active',
    'withdrawn',
    'archived'
  ) then
    raise exception
      'Choose a supported Credit state';
  end if;

  if p_expected_governance_revision is null
     or p_expected_governance_revision < 1 then
    raise exception
      'Expected governance revision must be one or greater';
  end if;

  if p_credit_state in (
       'withdrawn',
       'archived'
     )
     and nullif(btrim(p_reason), '') is null then
    raise exception
      'A reason is required for Credit withdrawal or archival';
  end if;

  v_public_safe := coalesce(p_public_safe, false);

  if v_public_safe
     and p_credit_state <> 'active' then
    raise exception
      'Only active Credits can be public-safe';
  end if;

  select *
  into v_credit
  from editorial.credits credit
  where credit.id = p_credit_id;

  if not found then
    raise exception
      'Credit was not found';
  end if;

  select *
  into v_governance
  from editorial.credit_governance governance
  where governance.credit_id = p_credit_id
  for update;

  if not found then
    raise exception
      'Credit governance was not found';
  end if;

  if v_governance.governance_revision <>
       p_expected_governance_revision then
    raise exception
      'Credit governance revision conflict. Expected %, found %',
      p_expected_governance_revision,
      v_governance.governance_revision;
  end if;

  if v_public_safe
     and v_credit.external_contributor_id is not null then
    select *
    into v_external_contributor
    from editorial.external_contributors contributor
    where contributor.id =
      v_credit.external_contributor_id;

    if not found
       or v_external_contributor.contributor_state <> 'active'
       or not v_external_contributor.public_safe
       or v_external_contributor.consent_status
            not in (
              'granted',
              'not_required'
            ) then
      raise exception
        'Public-safe external-contributor Credits require active public-safe consent';
    end if;
  end if;

  update editorial.credit_governance
  set
    public_safe = v_public_safe,
    credit_state = p_credit_state,
    governance_revision =
      v_governance.governance_revision + 1,
    reason =
      case
        when p_credit_state = 'active'
          then nullif(btrim(p_reason), '')
        else btrim(p_reason)
      end,
    updated_by = v_actor_id,
    updated_at = now()
  where credit_id = p_credit_id;

  return jsonb_build_object(
    'credit_id',
      p_credit_id,
    'credit_state',
      p_credit_state,
    'public_safe',
      v_public_safe,
    'governance_revision',
      v_governance.governance_revision + 1
  );
end;
$function$;

revoke all
on function public.create_external_contributor(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
)
from public, anon;

revoke all
on function public.update_external_contributor(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text
)
from public, anon;

revoke all
on function public.create_credit(
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  boolean
)
from public, anon;

revoke all
on function public.set_credit_governance(
  uuid,
  text,
  boolean,
  bigint,
  text
)
from public, anon;

grant execute
on function public.create_external_contributor(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
)
to authenticated, service_role;

grant execute
on function public.update_external_contributor(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text
)
to authenticated, service_role;

grant execute
on function public.create_credit(
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  boolean
)
to authenticated, service_role;

grant execute
on function public.set_credit_governance(
  uuid,
  text,
  boolean,
  bigint,
  text
)
to authenticated, service_role;

comment on function public.create_external_contributor(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
)
is 'Creates one stable external-contributor identity.';

comment on function public.update_external_contributor(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text
)
is 'Updates one external-contributor profile without rewriting historical Credits.';

comment on function public.create_credit(
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  boolean
)
is 'Creates one immutable Credit and governance revision 1.';

comment on function public.set_credit_governance(
  uuid,
  text,
  boolean,
  bigint,
  text
)
is 'Updates Credit lifecycle and public-safety governance with revision control.';

create or replace function public.attach_article_version_credit(
  p_article_version_id uuid,
  p_credit_id uuid,
  p_display_order integer,
  p_is_primary boolean,
  p_public_safe boolean,
  p_expected_credit_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_article_version editorial.article_versions%rowtype;
  v_resource editorial.resources%rowtype;
  v_credit editorial.credits%rowtype;
  v_governance editorial.credit_governance%rowtype;
  v_revision editorial.article_version_trust_revisions%rowtype;
  v_external_contributor editorial.external_contributors%rowtype;
  v_existing_count integer;
  v_attachment_id uuid;
  v_public_safe boolean;
begin
  v_actor_id :=
    editorial.assert_credit_command_actor();

  if p_display_order is null
     or p_display_order < 0 then
    raise exception
      'Credit display order must be zero or greater';
  end if;

  if p_expected_credit_revision is null
     or p_expected_credit_revision < 1 then
    raise exception
      'Expected Credit revision must be one or greater';
  end if;

  select *
  into v_article_version
  from editorial.article_versions article_version
  where article_version.id = p_article_version_id;

  if not found then
    raise exception
      'Article version was not found';
  end if;

  select *
  into v_resource
  from editorial.resources resource
  where resource.id = v_article_version.resource_id
    and resource.resource_kind = 'article';

  if not found then
    raise exception
      'Article resource was not found';
  end if;

  if auth.role() <> 'service_role'
     and not editorial.current_user_can_edit_article(
       v_resource.id
     ) then
    raise exception
      'You do not have authority to edit this Article';
  end if;

  insert into editorial.article_version_trust_revisions (
    article_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    p_article_version_id,
    1,
    1,
    v_actor_id,
    now()
  )
  on conflict (article_version_id) do nothing;

  select *
  into v_revision
  from editorial.article_version_trust_revisions revision
  where revision.article_version_id =
    p_article_version_id
  for update;

  if v_revision.credit_revision <>
       p_expected_credit_revision then
    raise exception
      'Credit revision conflict. Expected %, found %',
      p_expected_credit_revision,
      v_revision.credit_revision;
  end if;

  select *
  into v_credit
  from editorial.credits credit
  where credit.id = p_credit_id;

  if not found then
    raise exception
      'Credit was not found';
  end if;

  select *
  into v_governance
  from editorial.credit_governance governance
  where governance.credit_id = p_credit_id;

  if not found then
    raise exception
      'Credit governance was not found';
  end if;

  if v_governance.credit_state <> 'active' then
    raise exception
      'Only active Credits can be attached';
  end if;

  v_public_safe := coalesce(p_public_safe, false);

  if v_public_safe then
    if not v_governance.public_safe then
      raise exception
        'This Credit is not approved for public use';
    end if;

    if v_credit.external_contributor_id is not null then
      select *
      into v_external_contributor
      from editorial.external_contributors contributor
      where contributor.id =
        v_credit.external_contributor_id;

      if not found
         or v_external_contributor.contributor_state <> 'active'
         or not v_external_contributor.public_safe
         or v_external_contributor.consent_status
              not in (
                'granted',
                'not_required'
              ) then
        raise exception
          'External-contributor Credit is not currently eligible for public attachment';
      end if;
    end if;
  end if;

  if exists (
    select 1
    from editorial.resource_credits attachment
    where attachment.target_version_id =
            p_article_version_id
      and attachment.credit_id = p_credit_id
  ) then
    raise exception
      'Credit is already attached to this Article version';
  end if;

  select count(*)
  into v_existing_count
  from editorial.resource_credits attachment
  where attachment.target_version_id =
    p_article_version_id;

  if p_display_order <> v_existing_count then
    raise exception
      'Single Credit attachment must append at display order %',
      v_existing_count;
  end if;

  if coalesce(p_is_primary, false)
     and v_credit.credit_role = 'author'
     and exists (
       select 1
       from editorial.resource_credits attachment
       join editorial.credits existing_credit
         on existing_credit.id = attachment.credit_id
       where attachment.target_version_id =
               p_article_version_id
         and attachment.is_primary
         and existing_credit.credit_role = 'author'
     ) then
    raise exception
      'An Article version can have at most one primary author Credit';
  end if;

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  values (
    v_resource.id,
    'article',
    'article_version',
    p_article_version_id,
    p_credit_id,
    p_display_order,
    coalesce(p_is_primary, false),
    v_public_safe,
    v_actor_id
  )
  returning id
  into v_attachment_id;

  update editorial.article_version_trust_revisions
  set
    credit_revision =
      v_revision.credit_revision + 1,
    updated_by = v_actor_id,
    updated_at = now()
  where article_version_id = p_article_version_id;

  return jsonb_build_object(
    'attachment_id',
      v_attachment_id,
    'article_version_id',
      p_article_version_id,
    'credit_revision',
      v_revision.credit_revision + 1
  );
end;
$function$;

create or replace function public.replace_article_version_credits(
  p_article_version_id uuid,
  p_attachments jsonb,
  p_expected_credit_revision bigint,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_actor_id uuid;
  v_article_version editorial.article_versions%rowtype;
  v_resource editorial.resources%rowtype;
  v_revision editorial.article_version_trust_revisions%rowtype;
  v_requested_count integer;
  v_resulting_revision bigint;
  v_attachments jsonb;
begin
  v_actor_id :=
    editorial.assert_credit_command_actor();

  if p_attachments is null
     or jsonb_typeof(p_attachments) <> 'array' then
    raise exception
      'Credit attachments must be a JSON array';
  end if;

  if p_expected_credit_revision is null
     or p_expected_credit_revision < 1 then
    raise exception
      'Expected Credit revision must be one or greater';
  end if;

  select *
  into v_article_version
  from editorial.article_versions article_version
  where article_version.id = p_article_version_id;

  if not found then
    raise exception
      'Article version was not found';
  end if;

  select *
  into v_resource
  from editorial.resources resource
  where resource.id = v_article_version.resource_id
    and resource.resource_kind = 'article';

  if not found then
    raise exception
      'Article resource was not found';
  end if;

  if auth.role() <> 'service_role'
     and not editorial.current_user_can_edit_article(
       v_resource.id
     ) then
    raise exception
      'You do not have authority to edit this Article';
  end if;

  insert into editorial.article_version_trust_revisions (
    article_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    p_article_version_id,
    1,
    1,
    v_actor_id,
    now()
  )
  on conflict (article_version_id) do nothing;

  select *
  into v_revision
  from editorial.article_version_trust_revisions revision
  where revision.article_version_id =
    p_article_version_id
  for update;

  if v_revision.credit_revision <>
       p_expected_credit_revision then
    raise exception
      'Credit revision conflict. Expected %, found %',
      p_expected_credit_revision,
      v_revision.credit_revision;
  end if;

  v_requested_count := jsonb_array_length(p_attachments);

  if exists (
    select 1
    from jsonb_array_elements(p_attachments) item(value)
    where jsonb_typeof(item.value) <> 'object'
       or not item.value ? 'credit_id'
       or not item.value ? 'display_order'
       or not item.value ? 'is_primary'
       or not item.value ? 'public_safe'
       or jsonb_typeof(
            item.value -> 'display_order'
          ) <> 'number'
       or jsonb_typeof(
            item.value -> 'is_primary'
          ) <> 'boolean'
       or jsonb_typeof(
            item.value -> 'public_safe'
          ) <> 'boolean'
  ) then
    raise exception
      'Every Credit attachment requires a complete valid object';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      credit_id uuid,
      display_order integer,
      is_primary boolean,
      public_safe boolean
    )
    where requested.credit_id is null
       or requested.display_order is null
       or requested.is_primary is null
       or requested.public_safe is null
       or requested.display_order < 0
  ) then
    raise exception
      'Credit attachment contains an invalid required value';
  end if;

  if exists (
    select 1
    from (
      select
        requested.credit_id,
        count(*) as duplicate_count
      from jsonb_to_recordset(p_attachments) as requested(
        credit_id uuid,
        display_order integer,
        is_primary boolean,
        public_safe boolean
      )
      group by requested.credit_id
      having count(*) > 1
    ) duplicate_credits
  ) then
    raise exception
      'Credit attachments contain duplicate Credit identities';
  end if;

  if exists (
    select 1
    from (
      select
        requested.display_order,
        count(*) as duplicate_count
      from jsonb_to_recordset(p_attachments) as requested(
        credit_id uuid,
        display_order integer,
        is_primary boolean,
        public_safe boolean
      )
      group by requested.display_order
      having count(*) > 1
    ) duplicate_orders
  ) then
    raise exception
      'Credit attachments contain duplicate display orders';
  end if;

  if v_requested_count > 0
     and (
       (
         select min(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           credit_id uuid,
           display_order integer,
           is_primary boolean,
           public_safe boolean
         )
       ) <> 0
       or
       (
         select max(requested.display_order)
         from jsonb_to_recordset(p_attachments) as requested(
           credit_id uuid,
           display_order integer,
           is_primary boolean,
           public_safe boolean
         )
       ) <> v_requested_count - 1
     ) then
    raise exception
      'Credit display order must be zero-based and contiguous';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      credit_id uuid,
      display_order integer,
      is_primary boolean,
      public_safe boolean
    )
    where not exists (
      select 1
      from editorial.credits credit
      join editorial.credit_governance governance
        on governance.credit_id = credit.id
      where credit.id = requested.credit_id
        and governance.credit_state = 'active'
    )
  ) then
    raise exception
      'Every attached Credit must exist and be active';
  end if;

  if (
    select count(*)
    from jsonb_to_recordset(p_attachments) as requested(
      credit_id uuid,
      display_order integer,
      is_primary boolean,
      public_safe boolean
    )
    join editorial.credits credit
      on credit.id = requested.credit_id
    where requested.is_primary
      and credit.credit_role = 'author'
  ) > 1 then
    raise exception
      'An Article version can have at most one primary author Credit';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attachments) as requested(
      credit_id uuid,
      display_order integer,
      is_primary boolean,
      public_safe boolean
    )
    join editorial.credits credit
      on credit.id = requested.credit_id
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    left join editorial.external_contributors contributor
      on contributor.id =
        credit.external_contributor_id
    where requested.public_safe
      and (
        governance.credit_state <> 'active'
        or not governance.public_safe
        or (
          credit.external_contributor_id is not null
          and (
            contributor.id is null
            or contributor.contributor_state <> 'active'
            or not contributor.public_safe
            or contributor.consent_status not in (
              'granted',
              'not_required'
            )
          )
        )
      )
  ) then
    raise exception
      'A requested public Credit attachment is not publicly eligible';
  end if;

  delete from editorial.resource_credits attachment
  where attachment.target_version_id =
    p_article_version_id;

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  select
    v_resource.id,
    'article',
    'article_version',
    p_article_version_id,
    requested.credit_id,
    requested.display_order,
    requested.is_primary,
    requested.public_safe,
    v_actor_id
  from jsonb_to_recordset(p_attachments) as requested(
    credit_id uuid,
    display_order integer,
    is_primary boolean,
    public_safe boolean
  )
  order by requested.display_order;

  v_resulting_revision :=
    v_revision.credit_revision + 1;

  update editorial.article_version_trust_revisions
  set
    credit_revision = v_resulting_revision,
    updated_by = v_actor_id,
    updated_at = now()
  where article_version_id = p_article_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attachment_id',
          attachment.id,
        'credit_id',
          attachment.credit_id,
        'display_order',
          attachment.display_order,
        'is_primary',
          attachment.is_primary,
        'public_safe',
          attachment.public_safe
      )
      order by attachment.display_order
    ),
    '[]'::jsonb
  )
  into v_attachments
  from editorial.resource_credits attachment
  where attachment.target_version_id =
    p_article_version_id;

  return jsonb_build_object(
    'article_version_id',
      p_article_version_id,
    'credit_revision',
      v_resulting_revision,
    'correlation_id',
      p_correlation_id,
    'attachments',
      v_attachments
  );
end;
$function$;

revoke all
on function public.attach_article_version_credit(
  uuid,
  uuid,
  integer,
  boolean,
  boolean,
  bigint
)
from public, anon;

revoke all
on function public.replace_article_version_credits(
  uuid,
  jsonb,
  bigint,
  uuid
)
from public, anon;

grant execute
on function public.attach_article_version_credit(
  uuid,
  uuid,
  integer,
  boolean,
  boolean,
  bigint
)
to authenticated, service_role;

grant execute
on function public.replace_article_version_credits(
  uuid,
  jsonb,
  bigint,
  uuid
)
to authenticated, service_role;

comment on function public.attach_article_version_credit(
  uuid,
  uuid,
  integer,
  boolean,
  boolean,
  bigint
)
is 'Appends one Credit to one immutable Article version with revision control.';

comment on function public.replace_article_version_credits(
  uuid,
  jsonb,
  bigint,
  uuid
)
is 'Atomically replaces the complete ordered Credit set for one Article version.';

commit;
