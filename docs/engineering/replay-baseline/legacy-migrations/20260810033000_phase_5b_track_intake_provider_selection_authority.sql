-- Phase 5B M231: Track Intake provider-selection authority.
--
-- Provider inspection is evidence, not an editorial identity decision.
-- One provider may have many historical candidates for one intake suggestion,
-- but only one current confirmed choice for that provider. Replacing the choice
-- supersedes the previous decision without deleting its evidence.
--
-- This migration also corrects the one known production case where a four-second
-- accidental Apple Music choice for Tuma Madoo was copied as equally confirmed.

begin;

do $m231_preflight$
declare
  v_constraint text;
begin
  if to_regclass('public.provider_entity_links') is null
     or to_regclass('public.registry_provider_track_suggestions') is null
     or to_regclass('public.registry_enrichment_suggestions') is null
     or to_regclass('public.registry_canonical_write_events') is null
  then
    raise exception
      'STOP: M231 provider-selection authority dependencies are missing.';
  end if;

  if to_regprocedure(
       'public.admin_record_registry_track_intake_provider_evidence(uuid,text,text,text,jsonb,jsonb,numeric)'
     ) is null
     or to_regprocedure(
       'public.admin_save_registry_track_intake_enrichment(uuid,jsonb,text)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is null
  then
    raise exception
      'STOP: M231 Track Intake enrichment authority is missing.';
  end if;

  if to_regprocedure(
       'public.admin_select_registry_track_intake_provider_evidence(uuid,text,text,text)'
     ) is not null
  then
    raise exception
      'STOP: M231 provider-selection command already exists.';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
  into v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid =
          'public.provider_entity_links'::regclass
    and constraint_row.conname =
          'provider_entity_links_match_status_check';

  if v_constraint is null
     or position('candidate' in v_constraint) = 0
     or position('confirmed' in v_constraint) = 0
     or position('rejected' in v_constraint) = 0
  then
    raise exception
      'STOP: provider_entity_links match-status contract drifted.';
  end if;
end;
$m231_preflight$;

alter table public.provider_entity_links
  drop constraint provider_entity_links_match_status_check;

alter table public.provider_entity_links
  add constraint provider_entity_links_match_status_check
  check (
    match_status = any (
      array[
        'candidate'::text,
        'confirmed'::text,
        'rejected'::text,
        'superseded'::text
      ]
    )
  );

create or replace function public.admin_record_registry_track_intake_provider_evidence(
  p_suggestion_id uuid,
  p_provider text,
  p_provider_entity_id text,
  p_provider_url text,
  p_fields jsonb,
  p_raw_payload jsonb default '{}'::jsonb,
  p_confidence numeric default 0.9000
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_confidence numeric := greatest(
    0,
    least(coalesce(p_confidence, 0.9000), 1)
  );
  v_field record;
  v_field_value text;
  v_count integer := 0;
  v_allowed constant text[] := array[
    'title',
    'artist_names',
    'release_title',
    'isrc',
    'duration_ms',
    'track_artwork_url',
    'release_artwork_url',
    'preview_url',
    'release_date',
    'release_date_precision',
    'label_name',
    'imprint_name',
    'genre',
    'track_number',
    'disc_number',
    'explicit',
    'provider_url',
    'upc',
    'copyright_text'
  ];
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if not exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
  ) then
    raise exception
      using errcode = 'P0002',
        message = 'Track Intake item does not exist.';
  end if;

  if not exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
      and suggestion.status = 'needs_review'
  ) then
    raise exception
      'Only Track Intake items awaiting review can add provider evidence.';
  end if;

  if v_provider = ''
     or nullif(btrim(p_provider_entity_id), '') is null
  then
    raise exception
      'Provider and provider entity ID are required.';
  end if;

  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception
      'Provider enrichment fields must be a JSON object.';
  end if;

  if not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = p_suggestion_id::text
      and link.provider = v_provider
      and link.provider_entity_id = btrim(p_provider_entity_id)
  ) then
    insert into public.provider_entity_links (
      registry_entity_type,
      registry_entity_id,
      provider,
      provider_entity_id,
      provider_url,
      match_status,
      confidence_score,
      created_at,
      updated_at
    )
    values (
      'track',
      p_suggestion_id::text,
      v_provider,
      btrim(p_provider_entity_id),
      nullif(btrim(p_provider_url), ''),
      'candidate',
      v_confidence,
      now(),
      now()
    );
  end if;

  for v_field in
    select entry.key, entry.value
    from jsonb_each(p_fields) entry
  loop
    if not (v_field.key = any(v_allowed)) then
      raise exception
        'Unsupported Track Intake enrichment field: %',
        v_field.key;
    end if;

    if v_field.value = 'null'::jsonb then
      continue;
    end if;

    v_field_value :=
      case jsonb_typeof(v_field.value)
        when 'string' then v_field.value #>> '{}'
        else v_field.value::text
      end;

    if nullif(btrim(v_field_value), '') is null then
      continue;
    end if;

    insert into public.provider_field_observations (
      provider_item_id,
      entity_type,
      field_name,
      field_value,
      provider,
      confidence_score,
      source_path,
      raw_payload,
      created_at
    )
    values (
      p_suggestion_id::text,
      'track',
      v_field.key,
      v_field_value,
      v_provider,
      v_confidence,
      'track_intake.provider_inspect',
      coalesce(p_raw_payload, '{}'::jsonb),
      now()
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'provider', v_provider,
    'provider_entity_id', btrim(p_provider_entity_id),
    'observation_count', v_count
  );
end;
$function$;

create or replace function public.admin_save_registry_track_intake_enrichment(
  p_suggestion_id uuid,
  p_fields jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public'
as $function$
declare
  v_field record;
  v_value text;
  v_count integer := 0;
  v_allowed constant text[] := array[
    'title',
    'isrc',
    'duration_ms',
    'track_artwork_url',
    'preview_url',
    'release_title',
    'release_artwork_url',
    'release_date',
    'release_date_precision',
    'label_name',
    'imprint_name',
    'genre',
    'track_number',
    'disc_number',
    'explicit',
    'upc',
    'copyright_text'
  ];
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if not exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
      and suggestion.status = 'needs_review'
  ) then
    raise exception
      'Only Track Intake items awaiting review can be enriched.';
  end if;

  if p_fields is null
     or jsonb_typeof(p_fields) <> 'object'
  then
    raise exception
      'Accepted enrichment fields must be a JSON object.';
  end if;

  delete from public.registry_enrichment_suggestions suggestion
  where suggestion.registry_entity_type = 'track'
    and suggestion.registry_entity_id = p_suggestion_id::text
    and suggestion.decision_status in ('draft', 'approved')
    and suggestion.field_name = any(v_allowed)
    and not (p_fields ? suggestion.field_name);

  for v_field in
    select entry.key, entry.value
    from jsonb_each(p_fields) entry
  loop
    if not (v_field.key = any(v_allowed)) then
      raise exception
        'Unsupported accepted Track Intake field: %',
        v_field.key;
    end if;

    if v_field.value = 'null'::jsonb then
      delete from public.registry_enrichment_suggestions suggestion
      where suggestion.registry_entity_type = 'track'
        and suggestion.registry_entity_id =
          p_suggestion_id::text
        and suggestion.field_name = v_field.key
        and suggestion.decision_status in (
          'draft',
          'approved'
        );

      continue;
    end if;

    v_value :=
      case jsonb_typeof(v_field.value)
        when 'string'
          then v_field.value #>> '{}'
        else v_field.value::text
      end;

    if nullif(btrim(v_value), '') is null then
      continue;
    end if;

    delete from public.registry_enrichment_suggestions suggestion
    where suggestion.registry_entity_type = 'track'
      and suggestion.registry_entity_id =
        p_suggestion_id::text
      and suggestion.field_name = v_field.key
      and suggestion.decision_status in (
        'draft',
        'approved'
      );

    insert into public.registry_enrichment_suggestions (
      registry_entity_type,
      registry_entity_id,
      field_name,
      current_value,
      suggested_value,
      provider_item_id,
      confidence_score,
      decision_status,
      decision_reason,
      created_at,
      updated_at
    )
    values (
      'track',
      p_suggestion_id::text,
      v_field.key,
      null,
      v_value,
      p_suggestion_id::text,
      1.0000,
      'approved',
      nullif(btrim(p_reason), ''),
      now(),
      now()
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'suggestion_id',
      p_suggestion_id,
    'accepted_field_count',
      v_count
  );
end;
$function$;


comment on function public.admin_record_registry_track_intake_provider_evidence(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  numeric
)
is
  'Stages provider inspection as evidence. New provider identities are candidates until an editor explicitly selects one.';

create or replace function public.admin_select_registry_track_intake_provider_evidence(
  p_suggestion_id uuid,
  p_provider text,
  p_provider_entity_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_target public.provider_entity_links%rowtype;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_provider_entity_id text :=
    nullif(btrim(p_provider_entity_id), '');
  v_before_confirmed jsonb := '[]'::jsonb;
  v_after_target jsonb;
  v_superseded integer := 0;
  v_already_selected boolean := false;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if v_provider = ''
     or v_provider_entity_id is null
  then
    raise exception
      'Provider and provider entity ID are required.';
  end if;

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Track Intake item does not exist.';
  end if;

  if v_suggestion.status <> 'needs_review' then
    raise exception
      'Only Track Intake items awaiting review can select provider identity.';
  end if;

  select link.*
  into v_target
  from public.provider_entity_links link
  where link.registry_entity_type = 'track'
    and link.registry_entity_id = p_suggestion_id::text
    and link.provider = v_provider
    and link.provider_entity_id = v_provider_entity_id
  for update;

  if not found then
    raise exception
      'Inspect this provider result before selecting it.';
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(link)
      order by link.created_at, link.id
    ),
    '[]'::jsonb
  )
  into v_before_confirmed
  from public.provider_entity_links link
  where link.registry_entity_type = 'track'
    and link.registry_entity_id = p_suggestion_id::text
    and link.provider = v_provider
    and link.match_status = 'confirmed';

  select (
    v_target.match_status = 'confirmed'
    and not exists (
      select 1
      from public.provider_entity_links other
      where other.registry_entity_type = 'track'
        and other.registry_entity_id = p_suggestion_id::text
        and other.provider = v_provider
        and other.match_status = 'confirmed'
        and other.id <> v_target.id
    )
  )
  into v_already_selected;

  if v_already_selected then
    return jsonb_build_object(
      'suggestion_id', p_suggestion_id,
      'provider', v_provider,
      'provider_entity_id', v_provider_entity_id,
      'match_status', 'confirmed',
      'superseded_count', 0,
      'changed', false
    );
  end if;

  update public.provider_entity_links link
  set
    match_status = 'superseded',
    updated_at = now()
  where link.registry_entity_type = 'track'
    and link.registry_entity_id = p_suggestion_id::text
    and link.provider = v_provider
    and link.match_status = 'confirmed'
    and link.id <> v_target.id;

  get diagnostics v_superseded = row_count;

  update public.provider_entity_links link
  set
    match_status = 'confirmed',
    updated_at = now()
  where link.id = v_target.id
  returning to_jsonb(link)
  into v_after_target;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    error_message,
    actor,
    created_at
  )
  values (
    'track',
    p_suggestion_id::text,
    p_suggestion_id::text,
    'provider_entity_links',
    'provider_identity',
    'registry_provider_track_suggestions.provider_selection',
    jsonb_build_object(
      'confirmed_provider_links',
      v_before_confirmed
    ),
    jsonb_build_object(
      'selected_provider_link',
      v_after_target,
      'superseded_count',
      v_superseded,
      'reason',
      nullif(btrim(p_reason), '')
    ),
    'select_provider_identity',
    'applied',
    null,
    auth.uid()::text,
    now()
  );

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'provider', v_provider,
    'provider_entity_id', v_provider_entity_id,
    'match_status', 'confirmed',
    'superseded_count', v_superseded,
    'changed', true
  );
end;
$function$;

revoke all
on function public.admin_select_registry_track_intake_provider_evidence(
  uuid,
  text,
  text,
  text
)
from public, anon, service_role;

grant execute
on function public.admin_select_registry_track_intake_provider_evidence(
  uuid,
  text,
  text,
  text
)
to authenticated;

comment on function public.admin_select_registry_track_intake_provider_evidence(
  uuid,
  text,
  text,
  text
)
is
  'Selects one current provider identity for a Track Intake suggestion and supersedes any prior confirmed choice for the same provider without deleting evidence.';

create or replace function public.admin_resolve_registry_track_intake_enriched(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_review_note text default null,
  p_allow_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_release public.registry_releases%rowtype;
  v_fields jsonb := '{}'::jsonb;
  v_result jsonb;
  v_label_id uuid;
  v_label_name text;
  v_before jsonb;
  v_after jsonb;
begin
  if auth.uid() is null then
    raise exception
      using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Track Intake item does not exist.';
  end if;

  if v_suggestion.status <> 'needs_review' then
    raise exception
      'Only Track Intake items awaiting review can be resolved.';
  end if;

  if v_suggestion.canonical_track_id is not null
     and v_suggestion.canonical_track_id <> p_registry_track_id
  then
    raise exception
      'This Track Intake item already has canonical Registry identity. Enrichment review cannot silently remap it to another track.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id = p_registry_track_id
    and track.status = 'active'
  for update;

  if not found then
    raise exception
      'Selected Music Registry track is unavailable.';
  end if;

  select coalesce(
    jsonb_object_agg(
      suggestion.field_name,
      suggestion.suggested_value
    ),
    '{}'::jsonb
  )
  into v_fields
  from public.registry_enrichment_suggestions suggestion
  where suggestion.registry_entity_type = 'track'
    and suggestion.registry_entity_id =
      p_suggestion_id::text
    and suggestion.decision_status = 'approved';

  if not p_allow_overwrite then
    if v_fields ? 'isrc'
       and v_track.isrc is not null
       and v_track.isrc is distinct from
         nullif(btrim(v_fields ->> 'isrc'), '')
    then
      raise exception
        'Accepted ISRC conflicts with the canonical track. Review the conflict before replacing it.';
    end if;

    if v_fields ? 'duration_ms'
       and v_track.duration_ms is not null
       and v_track.duration_ms is distinct from
         nullif(v_fields ->> 'duration_ms', '')::integer
    then
      raise exception
        'Accepted duration conflicts with the canonical track. Review the conflict before replacing it.';
    end if;

    if v_fields ? 'track_artwork_url'
       and v_track.artwork_url is not null
       and v_track.artwork_url is distinct from
         nullif(btrim(v_fields ->> 'track_artwork_url'), '')
    then
      raise exception
        'Accepted artwork conflicts with the canonical track. Review the conflict before replacing it.';
    end if;
  end if;

  v_before := jsonb_build_object(
    'track',
      jsonb_build_object(
        'isrc', v_track.isrc,
        'duration_ms', v_track.duration_ms,
        'artwork_url', v_track.artwork_url,
        'preview_url', v_track.preview_url,
        'track_number', v_track.track_number,
        'disc_number', v_track.disc_number,
        'explicit', v_track.explicit,
        'metadata', v_track.metadata
      )
  );

  update public.registry_tracks track
  set
    isrc =
      case
        when v_fields ? 'isrc'
        then nullif(btrim(v_fields ->> 'isrc'), '')
        else track.isrc
      end,
    duration_ms =
      case
        when v_fields ? 'duration_ms'
        then nullif(v_fields ->> 'duration_ms', '')::integer
        else track.duration_ms
      end,
    artwork_url =
      case
        when v_fields ? 'track_artwork_url'
        then nullif(
          btrim(v_fields ->> 'track_artwork_url'),
          ''
        )
        else track.artwork_url
      end,
    preview_url =
      case
        when v_fields ? 'preview_url'
        then nullif(btrim(v_fields ->> 'preview_url'), '')
        else track.preview_url
      end,
    track_number =
      case
        when v_fields ? 'track_number'
        then nullif(v_fields ->> 'track_number', '')::integer
        else track.track_number
      end,
    disc_number =
      case
        when v_fields ? 'disc_number'
        then nullif(v_fields ->> 'disc_number', '')::integer
        else track.disc_number
      end,
    explicit =
      case
        when v_fields ? 'explicit'
        then nullif(v_fields ->> 'explicit', '')::boolean
        else track.explicit
      end,
    metadata =
      coalesce(track.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(
        jsonb_build_object(
          'provider_genre',
            nullif(btrim(v_fields ->> 'genre'), ''),
          'track_intake_enriched_at',
            now()
        )
      ),
    updated_at = now()
  where track.id = p_registry_track_id
  returning track.*
  into v_track;

  if v_track.release_id is not null then
    select release.*
    into v_release
    from public.registry_releases release
    where release.id = v_track.release_id
    for update;

    if found then
      if not p_allow_overwrite then
        if v_fields ? 'release_date'
           and v_release.release_date is not null
           and v_release.release_date is distinct from
             (v_fields ->> 'release_date')::date
        then
          raise exception
            'Accepted release date conflicts with the canonical release. Review the conflict before replacing it.';
        end if;

        if v_fields ? 'release_title'
           and nullif(btrim(v_release.title), '') is not null
           and v_release.title is distinct from
             nullif(btrim(v_fields ->> 'release_title'), '')
        then
          raise exception
            'Accepted release title conflicts with the canonical release. Review the conflict before replacing it.';
        end if;
      end if;

      v_label_name :=
        nullif(btrim(v_fields ->> 'label_name'), '');

      if v_label_name is not null
         and v_release.label_id is null
      then
        select label.id
        into v_label_id
        from public.registry_labels label
        where label.status in ('active', 'draft')
          and (
            lower(btrim(label.name)) =
              lower(v_label_name)
            or lower(btrim(label.normalized_name)) =
              lower(v_label_name)
          )
        order by
          case when label.status = 'active' then 0 else 1 end,
          label.created_at
        limit 1;
      end if;

      update public.registry_releases release
      set
        title =
          case
            when v_fields ? 'release_title'
            then nullif(
              btrim(v_fields ->> 'release_title'),
              ''
            )
            else release.title
          end,
        normalized_title =
          case
            when v_fields ? 'release_title'
            then trim(
              regexp_replace(
                lower(
                  nullif(
                    btrim(v_fields ->> 'release_title'),
                    ''
                  )
                ),
                '[^[:alnum:]]+',
                ' ',
                'g'
              )
            )
            else release.normalized_title
          end,
        release_date =
          case
            when v_fields ? 'release_date'
            then (v_fields ->> 'release_date')::date
            else release.release_date
          end,
        release_date_precision =
          case
            when v_fields ? 'release_date_precision'
            then nullif(
              btrim(v_fields ->> 'release_date_precision'),
              ''
            )
            else release.release_date_precision
          end,
        artwork_url =
          case
            when v_fields ? 'release_artwork_url'
            then nullif(
              btrim(v_fields ->> 'release_artwork_url'),
              ''
            )
            else release.artwork_url
          end,
        upc =
          case
            when v_fields ? 'upc'
            then nullif(btrim(v_fields ->> 'upc'), '')
            else release.upc
          end,
        label_id =
          coalesce(v_label_id, release.label_id),
        metadata =
          coalesce(release.metadata, '{}'::jsonb)
          || jsonb_strip_nulls(
            jsonb_build_object(
              'label_name_observation',
                case
                  when v_label_name is not null
                       and v_label_id is null
                  then v_label_name
                  else null
                end,
              'imprint_name',
                nullif(
                  btrim(v_fields ->> 'imprint_name'),
                  ''
                ),
              'copyright_text',
                nullif(
                  btrim(v_fields ->> 'copyright_text'),
                  ''
                ),
              'provider_genre',
                nullif(btrim(v_fields ->> 'genre'), ''),
              'track_intake_enriched_at',
                now()
            )
          ),
        updated_at = now()
      where release.id = v_track.release_id;
    end if;
  end if;

  select public.admin_resolve_registry_track_intake(
    p_suggestion_id,
    p_registry_track_id,
    p_review_note
  )
  into v_result;

  insert into public.provider_entity_links (
    registry_entity_type,
    registry_entity_id,
    provider,
    provider_entity_id,
    provider_url,
    match_status,
    confidence_score,
    created_at,
    updated_at
  )
  select
    'track',
    p_registry_track_id::text,
    link.provider,
    link.provider_entity_id,
    link.provider_url,
    'confirmed',
    link.confidence_score,
    now(),
    now()
  from public.provider_entity_links link
  where link.registry_entity_type = 'track'
    and link.registry_entity_id =
      p_suggestion_id::text
    and link.match_status = 'confirmed'
    and not exists (
      select 1
      from public.provider_entity_links canonical_link
      where canonical_link.registry_entity_type = 'track'
        and canonical_link.registry_entity_id =
          p_registry_track_id::text
        and canonical_link.provider = link.provider
        and canonical_link.provider_entity_id =
          link.provider_entity_id
    );

  select jsonb_build_object(
    'track',
      jsonb_build_object(
        'isrc', track.isrc,
        'duration_ms', track.duration_ms,
        'artwork_url', track.artwork_url,
        'preview_url', track.preview_url,
        'track_number', track.track_number,
        'disc_number', track.disc_number,
        'explicit', track.explicit,
        'metadata', track.metadata
      )
  )
  into v_after
  from public.registry_tracks track
  where track.id = p_registry_track_id;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    error_message,
    actor,
    created_at
  )
  values (
    'track',
    p_registry_track_id::text,
    p_suggestion_id::text,
    'registry_provider_track_suggestions',
    'track_intake_enrichment',
    'registry_tracks',
    v_before,
    v_after,
    'apply_enrichment',
    'applied',
    null,
    auth.uid()::text,
    now()
  );

  return coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object(
      'enrichment_applied', v_fields,
      'label_linked', v_label_id is not null
    );
end;
$function$;


do $m231_tuma_madoo_correction$
declare
  v_playlist_id uuid;
  v_suggestion_id uuid;
  v_track_id uuid;
  v_suggestion_updates integer;
  v_track_updates integer;
begin
  select playlist.id
  into v_playlist_id
  from public.wk_playlists playlist
  where playlist.slug = 'top-50-kenyan-songs-of-2025';

  if v_playlist_id is null then
    raise notice
      'M231 data correction skipped: Top 50 production Playlist is absent.';
    return;
  end if;

  select
    suggestion.id,
    suggestion.canonicalized_track_id
  into
    v_suggestion_id,
    v_track_id
  from public.registry_provider_track_suggestions suggestion
  join public.wk_playlist_items item
    on item.id = suggestion.source_playlist_item_id
  where suggestion.source_playlist_id = v_playlist_id
    and item.position = 22
    and item.title = 'Tuma Madoo (black tax)'
  limit 1;

  if v_suggestion_id is null
     or v_track_id is null
  then
    raise exception
      'STOP: M231 could not locate canonical Tuma Madoo intake authority.';
  end if;

  if not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = v_suggestion_id::text
      and link.provider = 'apple_music'
      and link.provider_entity_id = '1784531965'
      and link.match_status = 'confirmed'
  )
  or not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = v_track_id::text
      and link.provider = 'apple_music'
      and link.provider_entity_id = '1784531965'
      and link.match_status = 'confirmed'
  ) then
    raise exception
      'STOP: Correct Tuma Madoo Apple Music identity is not confirmed.';
  end if;

  update public.provider_entity_links link
  set
    match_status = 'superseded',
    updated_at = now()
  where link.registry_entity_type = 'track'
    and link.registry_entity_id = v_suggestion_id::text
    and link.provider = 'apple_music'
    and link.provider_entity_id = '1850093111'
    and link.match_status = 'confirmed';

  get diagnostics v_suggestion_updates = row_count;

  update public.provider_entity_links link
  set
    match_status = 'superseded',
    updated_at = now()
  where link.registry_entity_type = 'track'
    and link.registry_entity_id = v_track_id::text
    and link.provider = 'apple_music'
    and link.provider_entity_id = '1850093111'
    and link.match_status = 'confirmed';

  get diagnostics v_track_updates = row_count;

  if v_suggestion_updates <> 1
     or v_track_updates <> 1
  then
    raise exception
      'STOP: Expected exactly one Tuma Madoo accidental provider link at intake and canonical scope. suggestion %, track %.',
      v_suggestion_updates,
      v_track_updates;
  end if;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    error_message,
    actor,
    created_at
  )
  values
    (
      'track',
      v_suggestion_id::text,
      v_suggestion_id::text,
      'provider_entity_links',
      'provider_identity',
      'registry_provider_track_suggestions.provider_selection',
      jsonb_build_object(
        'provider', 'apple_music',
        'provider_entity_id', '1850093111',
        'match_status', 'confirmed'
      ),
      jsonb_build_object(
        'provider', 'apple_music',
        'provider_entity_id', '1850093111',
        'match_status', 'superseded',
        'superseded_by', '1784531965'
      ),
      'correct_provider_identity',
      'applied',
      null,
      'phase5b_m231_tuma_provider_correction',
      now()
    ),
    (
      'track',
      v_track_id::text,
      v_suggestion_id::text,
      'provider_entity_links',
      'provider_identity',
      'registry_tracks.provider_identity',
      jsonb_build_object(
        'provider', 'apple_music',
        'provider_entity_id', '1850093111',
        'match_status', 'confirmed'
      ),
      jsonb_build_object(
        'provider', 'apple_music',
        'provider_entity_id', '1850093111',
        'match_status', 'superseded',
        'superseded_by', '1784531965'
      ),
      'correct_provider_identity',
      'applied',
      null,
      'phase5b_m231_tuma_provider_correction',
      now()
    );

  if not exists (
    select 1
    from public.registry_enrichment_suggestions accepted
    where accepted.registry_entity_type = 'track'
      and accepted.registry_entity_id = v_suggestion_id::text
      and accepted.field_name = 'isrc'
      and accepted.suggested_value = 'QZZ7U2402374'
      and accepted.decision_status = 'approved'
  )
  or not exists (
    select 1
    from public.registry_enrichment_suggestions accepted
    where accepted.registry_entity_type = 'track'
      and accepted.registry_entity_id = v_suggestion_id::text
      and accepted.field_name = 'duration_ms'
      and accepted.suggested_value = '203060'
      and accepted.decision_status = 'approved'
  ) then
    raise exception
      'STOP: Tuma Madoo accepted enrichment is not the corrected original song.';
  end if;
end;
$m231_tuma_madoo_correction$;

create or replace function public.guard_registry_track_intake_provider_selection()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.registry_entity_type = 'track'
     and new.match_status = 'confirmed'
     and exists (
       select 1
       from public.registry_provider_track_suggestions suggestion
       where suggestion.id::text = new.registry_entity_id
     )
     and exists (
       select 1
       from public.provider_entity_links other
       where other.registry_entity_type = 'track'
         and other.registry_entity_id = new.registry_entity_id
         and other.provider = new.provider
         and other.match_status = 'confirmed'
         and other.id <> new.id
     )
  then
    raise exception
      using
        errcode = '23505',
        message =
          'Track Intake allows only one confirmed provider identity per provider. Select the replacement through provider review.';
  end if;

  return new;
end;
$function$;

revoke all
on function public.guard_registry_track_intake_provider_selection()
from public, anon, authenticated, service_role;

drop trigger if exists
  provider_entity_links_track_intake_selection_guard
on public.provider_entity_links;

create trigger provider_entity_links_track_intake_selection_guard
before insert or update of
  registry_entity_type,
  registry_entity_id,
  provider,
  match_status
on public.provider_entity_links
for each row
execute function public.guard_registry_track_intake_provider_selection();

do $m231_acceptance$
declare
  v_playlist_id uuid;
  v_suggestion_id uuid;
  v_track_id uuid;
begin
  if exists (
    select 1
    from public.provider_entity_links link
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id::text = link.registry_entity_id
    where link.registry_entity_type = 'track'
      and link.match_status = 'confirmed'
    group by suggestion.id, link.provider
    having count(*) > 1
  ) then
    raise exception
      'STOP: More than one confirmed provider identity remains for one Track Intake provider.';
  end if;

  if position(
       quote_literal('candidate')
       in pg_get_functiondef(
         'public.admin_record_registry_track_intake_provider_evidence(uuid,text,text,text,jsonb,jsonb,numeric)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'STOP: Provider inspection still does not stage candidate identity.';
  end if;

  if position(
       $needle$link.match_status = 'confirmed'$needle$
       in pg_get_functiondef(
         'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'STOP: Canonicalization does not filter provider identities to confirmed selections.';
  end if;

  select playlist.id
  into v_playlist_id
  from public.wk_playlists playlist
  where playlist.slug = 'top-50-kenyan-songs-of-2025';

  if v_playlist_id is null then
    return;
  end if;

  select
    suggestion.id,
    suggestion.canonicalized_track_id
  into
    v_suggestion_id,
    v_track_id
  from public.registry_provider_track_suggestions suggestion
  join public.wk_playlist_items item
    on item.id = suggestion.source_playlist_item_id
  where suggestion.source_playlist_id = v_playlist_id
    and item.position = 22
  limit 1;

  if not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = v_suggestion_id::text
      and link.provider = 'apple_music'
      and link.provider_entity_id = '1850093111'
      and link.match_status = 'superseded'
  )
  or not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = v_track_id::text
      and link.provider = 'apple_music'
      and link.provider_entity_id = '1850093111'
      and link.match_status = 'superseded'
  )
  or not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = v_suggestion_id::text
      and link.provider = 'apple_music'
      and link.provider_entity_id = '1784531965'
      and link.match_status = 'confirmed'
  )
  or not exists (
    select 1
    from public.provider_entity_links link
    where link.registry_entity_type = 'track'
      and link.registry_entity_id = v_track_id::text
      and link.provider = 'apple_music'
      and link.provider_entity_id = '1784531965'
      and link.match_status = 'confirmed'
  ) then
    raise exception
      'STOP: Tuma Madoo provider supersession state is incorrect.';
  end if;
end;
$m231_acceptance$;

commit;
