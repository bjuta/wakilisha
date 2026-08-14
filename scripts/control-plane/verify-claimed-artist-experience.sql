-- Verify WAKILISHA M3 claimed Artist experience authority.

do $verify_m3_claimed_artist_experience$
declare
  v_constraint text;
  v_save_definition text;
  v_team_definition text;
  v_correction_definition text;
begin
  if to_regclass('public.artist_profile_presentations') is null then
    raise exception 'M3_VERIFY: artist_profile_presentations is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'artist_profile_presentations'
      and c.relrowsecurity = true
  ) then
    raise exception 'M3_VERIFY: artist_profile_presentations RLS is not enabled';
  end if;

  if has_table_privilege('anon', 'public.artist_profile_presentations', 'select')
     or has_table_privilege('anon', 'public.artist_profile_presentations', 'insert')
     or has_table_privilege('authenticated', 'public.artist_profile_presentations', 'select')
     or has_table_privilege('authenticated', 'public.artist_profile_presentations', 'insert')
     or has_table_privilege('authenticated', 'public.artist_profile_presentations', 'update')
     or has_table_privilege('authenticated', 'public.artist_profile_presentations', 'delete')
  then
    raise exception 'M3_VERIFY: direct public presentation table privilege leaked';
  end if;

  if to_regprocedure('public.community_get_artist_public_presentation(uuid)') is null
     or to_regprocedure('public.community_save_artist_profile_presentation(uuid,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.community_get_artist_team(uuid)') is null
     or to_regprocedure('public.community_submit_artist_registry_correction(uuid,text,text,text)') is null
  then
    raise exception 'M3_VERIFY: one or more M3 public functions are missing';
  end if;

  if not has_function_privilege('anon', 'public.community_get_artist_public_presentation(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.community_get_artist_public_presentation(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.community_save_artist_profile_presentation(uuid,text,text,text,text,text,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.community_get_artist_team(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.community_submit_artist_registry_correction(uuid,text,text,text)', 'execute')
  then
    raise exception 'M3_VERIFY: required M3 function grants are missing';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid = 'public.artist_representation_events'::regclass
    and conname = 'artist_representation_events_event_type_check';

  if v_constraint is null
     or position('profile_presentation_updated' in v_constraint) = 0
  then
    raise exception 'M3_VERIFY: M2 event ledger was not extended for profile presentation updates';
  end if;

  select pg_get_functiondef('public.community_save_artist_profile_presentation(uuid,text,text,text,text,text,jsonb)'::regprocedure)
  into v_save_definition;

  select pg_get_functiondef('public.community_get_artist_team(uuid)'::regprocedure)
  into v_team_definition;

  select pg_get_functiondef('public.community_submit_artist_registry_correction(uuid,text,text,text)'::regprocedure)
  into v_correction_definition;

  if position('artist_representations' in v_save_definition) = 0
     or position('can_manage_profile' in v_save_definition) = 0
  then
    raise exception 'M3_VERIFY: profile presentation writes are not bound to representation permission';
  end if;

  if position('can_manage_team' in v_team_definition) = 0
     or position('insufficient_artist_team_privilege' in v_team_definition) = 0
  then
    raise exception 'M3_VERIFY: team reader is not bound to team-management permission';
  end if;

  if position('community_create_contribution' in v_correction_definition) = 0 then
    raise exception 'M3_VERIFY: Registry corrections do not reuse community contribution authority';
  end if;

  if v_save_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
     or v_correction_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
  then
    raise exception 'M3_VERIFY: claimed Artist command can write canonical Registry Artist rows';
  end if;
end;
$verify_m3_claimed_artist_experience$;

select jsonb_build_object(
  'verification', 'PASS',
  'presentation_table', to_regclass('public.artist_profile_presentations')::text,
  'public_reader', to_regprocedure('public.community_get_artist_public_presentation(uuid)')::text,
  'profile_writer', to_regprocedure('public.community_save_artist_profile_presentation(uuid,text,text,text,text,text,jsonb)')::text,
  'team_reader', to_regprocedure('public.community_get_artist_team(uuid)')::text,
  'registry_correction', to_regprocedure('public.community_submit_artist_registry_correction(uuid,text,text,text)')::text
) as m3_claimed_artist_experience;
