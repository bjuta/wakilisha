-- WAKILISHA — selective provider discovery V1.
-- Preserve the current reviewed-admission planner as an immutable predecessor,
-- then wrap it so selective provider snapshots can only grow (never shrink)
-- the Artist's cumulative Apple Music album identity ledger.

begin;
set local statement_timeout='120s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'discography-selective-provider-discovery-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'
     ) is null
  then
    raise exception
      'STOP: live reviewed Discography planner is missing';
  end if;

  if to_regprocedure(
       'platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)'
     ) is not null
  then
    raise exception
      'STOP: selective provider planner predecessor already exists';
  end if;
end
$preflight$;

alter function
  platform_private.registry_discography_build_frozen_plan_v1(
    uuid,uuid,uuid,jsonb
  )
rename to registry_discography_build_frozen_plan_pre_selective_v1;

create function
platform_private.registry_discography_build_frozen_plan_v1(
  p_artist_id uuid,
  p_evidence_assertion_id uuid,
  p_snapshot_id uuid,
  p_reviewed_selections jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_plan jsonb;
  v_operations jsonb:='[]'::jsonb;
  v_operation jsonb;
  v_existing_album_ids jsonb;
  v_new_album_ids jsonb;
  v_union_album_ids jsonb;
begin
  select coalesce(
    artist.metadata->'apple_music_album_ids',
    '[]'::jsonb
  )
  into v_existing_album_ids
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Artist is missing.';
  end if;

  if jsonb_typeof(v_existing_album_ids)<>'array' then
    raise exception using errcode='22023',
      message='Artist Apple Music album identity ledger is not an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_existing_album_ids) existing_id
    where nullif(btrim(existing_id),'') is null
       or existing_id !~ '^[0-9]+$'
  ) then
    raise exception using errcode='22023',
      message='Artist Apple Music album identity ledger contains an invalid provider id.';
  end if;

  v_plan:=
    platform_private.registry_discography_build_frozen_plan_pre_selective_v1(
      p_artist_id,
      p_evidence_assertion_id,
      p_snapshot_id,
      p_reviewed_selections
    );

  for v_operation in
    select value
    from jsonb_array_elements(coalesce(v_plan->'operations','[]'::jsonb))
    with ordinality as operation(value,ordinality)
    order by ordinality
  loop
    if v_operation->>'operation_key'=
       'registry.artist.discography_summary.admit'
    then
      v_new_album_ids:=coalesce(
        v_operation#>'{payload,apple_music_album_ids}',
        '[]'::jsonb
      );

      if jsonb_typeof(v_new_album_ids)<>'array' then
        raise exception using errcode='22023',
          message='Reviewed Artist Discography summary album ids are not an array.';
      end if;

      if exists (
        select 1
        from jsonb_array_elements_text(v_new_album_ids) new_id
        where nullif(btrim(new_id),'') is null
           or new_id !~ '^[0-9]+$'
      ) then
        raise exception using errcode='22023',
          message='Reviewed Artist Discography summary contains an invalid provider id.';
      end if;

      select coalesce(
        jsonb_agg(to_jsonb(album_id) order by album_id),
        '[]'::jsonb
      )
      into v_union_album_ids
      from (
        select distinct album_id
        from (
          select value as album_id
          from jsonb_array_elements_text(v_existing_album_ids)
          union all
          select value as album_id
          from jsonb_array_elements_text(v_new_album_ids)
        ) ids
      ) deduped;

      v_operation:=jsonb_set(
        v_operation,
        '{payload,apple_music_album_ids}',
        v_union_album_ids,
        true
      );
    end if;

    v_operations:=v_operations||jsonb_build_array(v_operation);
  end loop;

  return jsonb_set(
    v_plan,
    '{operations}',
    v_operations,
    true
  );
end
$$;

revoke all on function
  platform_private.registry_discography_build_frozen_plan_pre_selective_v1(
    uuid,uuid,uuid,jsonb
  )
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.registry_discography_build_frozen_plan_v1(
    uuid,uuid,uuid,jsonb
  )
from public,anon,authenticated,service_role;

do $postcondition$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if position(
       'registry_discography_build_frozen_plan_pre_selective_v1'
       in v_definition
     )=0
     or position('v_existing_album_ids' in v_definition)=0
     or position('v_union_album_ids' in v_definition)=0
     or position('apple_music_album_ids' in v_definition)=0
  then
    raise exception
      'Selective provider Discography planner wrapper did not converge.';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'Selective provider Discography planner leaked execution authority.';
  end if;
end
$postcondition$;

commit;
