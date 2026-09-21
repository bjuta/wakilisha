-- PR15 production verification.

select count(*) as total_relationships,
       count(*) filter (where relationship_status = 'archived') as archived_relationships,
       count(*) filter (where public_safe) as public_safe_relationships
from public.registry_entity_relationships;

select intake_state, count(*) as row_count
from public.registry_missing_artist_intake_queue
group by intake_state
order by intake_state;

select endpoint_work_state, count(*) as row_count
from public.registry_relationship_endpoint_work_queue
group by endpoint_work_state
order by endpoint_work_state;

select
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'accept_registry_missing_artist_intake';

select count(*) as automatically_created_artists
from public.registry_artists
where metadata->>'created_from' = 'missing_artist_intake';

select count(*) as automatically_merged_submissions
from public.contributor_submissions
where review_status = 'merged'
  and source_note ~ '^missing_artist_slug:';

do $verify_missing_artist_intake_authority$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.accept_registry_missing_artist_intake(uuid,text)'
     ) is null
     or not has_function_privilege(
       'authenticated',
       'public.accept_registry_missing_artist_intake(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.accept_registry_missing_artist_intake(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.accept_registry_missing_artist_intake(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Missing Artist Intake caller privilege boundary drifted';
  end if;

  select pg_get_functiondef(
    'public.accept_registry_missing_artist_intake(uuid,text)'::regprocedure
  )
  into v_definition;

  if position(
       'execute_registry_reviewed_artist_identity_materialization_v1'
       in v_definition
     ) = 0
     or position(
          'execute_registry_artist_alias_state_v1'
          in v_definition
        ) = 0
     or position(
          'resolve_registry_relationship_endpoint'
          in v_definition
        ) = 0
     or v_definition ~*
        'insert[[:space:]]+into[[:space:]]+public\.registry_artists'
     or v_definition ~*
        'insert[[:space:]]+into[[:space:]]+public\.registry_artist_aliases'
     or position('manual_intake' in v_definition) > 0
     or v_definition ~* '\\bset[[:space:]]+entity_id[[:space:]]*=[[:space:]]*v_artist_id\\b'
  then
    raise exception
      'FAIL: Missing Artist Intake bypasses accepted Artist creation, alias, or relationship authority';
  end if;

  raise notice
    'REGISTRY_MISSING_ARTIST_INTAKE_AUTHORITY_PASS';
end
$verify_missing_artist_intake_authority$;
