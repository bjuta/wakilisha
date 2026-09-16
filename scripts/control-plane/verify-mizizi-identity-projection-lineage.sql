\set ON_ERROR_STOP on

do $gate_d_verify$
declare
  v_expected bigint;
  v_actual bigint;
  v_resolution jsonb;
begin
  if to_regclass('public.registry_identity_lineage') is null then
    raise exception 'Gate D verifier: registry_identity_lineage missing';
  end if;

  if to_regclass('public.registry_identity_projection_lineage') is null then
    raise exception
      'Gate D verifier: registry_identity_projection_lineage missing';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.registry_identity_lineage'::regclass
      and relrowsecurity
  ) then
    raise exception 'Gate D verifier: identity lineage RLS disabled';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.registry_identity_projection_lineage'::regclass
      and relrowsecurity
  ) then
    raise exception 'Gate D verifier: projection lineage RLS disabled';
  end if;

  if has_table_privilege(
       'anon',
       'public.registry_identity_lineage',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_identity_lineage',
       'INSERT,UPDATE,DELETE'
     )
  then
    raise exception
      'Gate D verifier: client role can mutate identity lineage';
  end if;

  if has_table_privilege(
       'anon',
       'public.registry_identity_projection_lineage',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_identity_projection_lineage',
       'INSERT,UPDATE,DELETE'
     )
  then
    raise exception
      'Gate D verifier: client role can mutate projection lineage';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.registry_identity_lineage'::regclass
      and tgname = 'trg_registry_identity_lineage_append_only'
      and not tgisinternal
  ) then
    raise exception
      'Gate D verifier: identity append-only trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
      'public.registry_identity_projection_lineage'::regclass
      and tgname =
        'trg_registry_identity_projection_lineage_append_only'
      and not tgisinternal
  ) then
    raise exception
      'Gate D verifier: projection append-only trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
      'public.registry_artist_resolution_events'::regclass
      and tgname =
        'trg_capture_registry_artist_resolution_lineage_v1'
      and not tgisinternal
  ) then
    raise exception
      'Gate D verifier: Artist merge lineage trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
      'public.registry_track_resolution_events'::regclass
      and tgname =
        'trg_capture_registry_track_resolution_lineage_v1'
      and not tgisinternal
  ) then
    raise exception
      'Gate D verifier: Track supersession lineage trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.registry_audit_log'::regclass
      and tgname = 'trg_capture_registry_artist_split_lineage_v1'
      and not tgisinternal
  ) then
    raise exception
      'Gate D verifier: Artist split lineage trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.wk_chart_entries_v2'::regclass
      and tgname =
        'trg_capture_wk_chart_identity_projection_update_v1'
      and not tgisinternal
  ) then
    raise exception
      'Gate D verifier: chart identity projection trigger missing';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.record_registry_identity_lineage_v1(text,uuid,text,uuid[],timestamp with time zone,text,text,jsonb,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.record_registry_identity_lineage_v1(text,uuid,text,uuid[],timestamp with time zone,text,text,jsonb,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'Gate D verifier: private identity lineage recorder exposed';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.record_registry_identity_projection_v1(text,text,text,jsonb,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.record_registry_identity_projection_v1(text,text,text,jsonb,timestamp with time zone,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Gate D verifier: private projection recorder exposed';
  end if;

  select count(*)
  into v_expected
  from public.registry_artist_resolution_events
  where action = 'artist_merge'
    and status = 'success';

  select count(*)
  into v_actual
  from public.registry_identity_lineage
  where source_authority = 'registry_artist_resolution_events';

  if v_actual <> v_expected then
    raise exception
      'Gate D verifier: Artist merge lineage backfill mismatch';
  end if;

  if exists (
    select 1
    from public.registry_artist_resolution_events e
    where e.action = 'artist_merge'
      and e.status = 'success'
      and not exists (
        select 1
        from public.registry_identity_lineage l
        where l.source_authority = 'registry_artist_resolution_events'
          and l.source_record_id = e.id::text
          and l.entity_type = 'artist'
          and l.source_entity_id = e.source_artist_id
          and l.transition_type = 'merge'
          and cardinality(l.successor_entity_ids) = 1
          and l.successor_entity_ids[1] =
            coalesce(
              platform_private.registry_uuid_or_null_v1(
                e.result ->> 'canonicalArtistId'
              ),
              platform_private.registry_uuid_or_null_v1(
                e.replacement_artists #>> '{0,artist_id}'
              )
            )
      )
  ) then
    raise exception
      'Gate D verifier: Artist merge lineage provenance drift';
  end if;

  select coalesce(sum(cardinality(duplicate_track_ids)),0)
  into v_expected
  from public.registry_track_resolution_events
  where action = 'track_duplicate_repair'
    and status = 'success';

  select count(*)
  into v_actual
  from public.registry_identity_lineage
  where source_authority = 'registry_track_resolution_events';

  if v_actual <> v_expected then
    raise exception
      'Gate D verifier: Track supersession lineage backfill mismatch';
  end if;

  if exists (
    select 1
    from public.registry_track_resolution_events e
    cross join lateral unnest(e.duplicate_track_ids)
      as duplicate(source_id)
    where e.action = 'track_duplicate_repair'
      and e.status = 'success'
      and not exists (
        select 1
        from public.registry_identity_lineage l
        where l.source_authority = 'registry_track_resolution_events'
          and l.source_record_id =
            e.id::text || ':' || duplicate.source_id::text
          and l.entity_type = 'track'
          and l.source_entity_id = duplicate.source_id
          and l.transition_type = 'supersede'
          and l.successor_entity_ids =
            array[e.canonical_track_id]
      )
  ) then
    raise exception
      'Gate D verifier: Track supersession lineage provenance drift';
  end if;

  select count(*)
  into v_expected
  from public.registry_audit_log
  where action = 'artist_credit_decoupled'
    and entity_type = 'registry_artist'
    and entity_id is not null;

  select count(*)
  into v_actual
  from public.registry_identity_lineage
  where source_authority =
    'registry_audit_log:artist_credit_decoupled';

  if v_actual <> v_expected then
    raise exception
      'Gate D verifier: Artist split lineage backfill mismatch';
  end if;

  if exists (
    select 1
    from public.registry_audit_log a
    where a.action = 'artist_credit_decoupled'
      and a.entity_type = 'registry_artist'
      and a.entity_id is not null
      and not exists (
        select 1
        from public.registry_identity_lineage l
        where l.source_authority =
          'registry_audit_log:artist_credit_decoupled'
          and l.source_record_id = a.id::text
          and l.entity_type = 'artist'
          and l.source_entity_id = a.entity_id
          and l.transition_type = 'split'
          and l.successor_entity_ids = (
            select array_agg(x order by x)
            from (
              select distinct value::uuid as x
              from jsonb_array_elements_text(
                coalesce(
                  a.after_value -> 'replacement_artist_ids',
                  '[]'::jsonb
                )
              ) as value
            ) normalized
          )
      )
  ) then
    raise exception
      'Gate D verifier: Artist split lineage provenance drift';
  end if;

  if exists (
    select 1
    from public.registry_identity_lineage
    where source_authority = 'registry_artist_aliases'
  ) then
    raise exception
      'Gate D verifier: ordinary Artist aliases were promoted into lineage';
  end if;

  if exists (
    select 1
    from public.wk_chart_entries_v2 ce
    left join lateral (
      select status.projection_state,
             status.event_state,
             status.canonical_track_id,
             status.canonical_artist_id,
             status.canonical_release_id
      from public.registry_identity_projection_lineage_status_v1 status
      where status.projection_kind = 'wk_chart_entry_v2'
        and status.projection_key = ce.id
      order by status.projection_version desc
      limit 1
    ) latest on true
    where latest.projection_state is distinct from 'valid'
       or latest.event_state is distinct from 'valid'
       or latest.canonical_track_id is distinct from
          platform_private.registry_uuid_or_null_v1(
            ce.canonical_track_id
          )
       or latest.canonical_artist_id is distinct from
          platform_private.registry_uuid_or_null_v1(
            ce.canonical_artist_id
          )
       or latest.canonical_release_id is distinct from
          platform_private.registry_uuid_or_null_v1(
            ce.canonical_release_id
          )
  ) then
    raise exception
      'Gate D verifier: current chart identity projection is not sealed';
  end if;

  if exists (
    select 1
    from public.wk_chart_entries_v2
    where canonical_track_id =
      '5ba30d5f-bd7c-430e-8a5e-df8d868810a7'
  ) then
    v_resolution :=
      public.resolve_registry_identity_lineage_v1(
        'track',
        '5ba30d5f-bd7c-430e-8a5e-df8d868810a7'::uuid,
        16
      );

    if v_resolution ->> 'resolution_status' <> 'unresolved' then
      raise exception
        'Gate D verifier: unresolved Mali Safi identity was fabricated';
    end if;
  end if;

  if exists (
    select 1
    from public.registry_identity_projection_lineage
    where projection_kind = 'wk_chart_entry_v2'
      and historical_observation_ref = '{}'::jsonb
  ) then
    raise exception
      'Gate D verifier: chart projection missing historical observation reference';
  end if;
end
$gate_d_verify$;

select 'MIZIZI_IDENTITY_PROJECTION_LINEAGE_PASS'
  as verification_result;
