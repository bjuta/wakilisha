-- Live verifier for guest Following signup handoff.

do $guest_follow_intent_verify$
declare
  v_create_definition text;
  v_claim_definition text;
  v_create_class text;
  v_claim_class text;
begin
  if to_regclass(
       'private.guest_follow_intents'
     ) is null
     or to_regprocedure(
          'public.community_create_guest_follow_intent(uuid[])'
        ) is null
     or to_regprocedure(
          'public.community_claim_guest_follow_intent(text)'
        ) is null
  then
    raise exception
      'Guest Follow intent authority is missing';
  end if;

  if not has_function_privilege(
       'anon',
       'public.community_create_guest_follow_intent(uuid[])',
       'EXECUTE'
     )
     or not has_function_privilege(
          'authenticated',
          'public.community_create_guest_follow_intent(uuid[])',
          'EXECUTE'
        )
     or has_function_privilege(
          'anon',
          'public.community_claim_guest_follow_intent(text)',
          'EXECUTE'
        )
     or not has_function_privilege(
          'authenticated',
          'public.community_claim_guest_follow_intent(text)',
          'EXECUTE'
        )
  then
    raise exception
      'Guest Follow intent grants are incorrect';
  end if;

  if not exists (
       select 1
       from pg_catalog.pg_class
       where oid = 'private.guest_follow_intents'::regclass
         and relrowsecurity
     )
  then
    raise exception
      'Guest Follow intent RLS is not enabled';
  end if;

  if has_table_privilege(
       'anon',
       'private.guest_follow_intents',
       'SELECT'
     )
     or has_table_privilege(
          'authenticated',
          'private.guest_follow_intents',
          'SELECT'
        )
  then
    raise exception
      'Guest Follow intent private rows leaked';
  end if;

  select access_class
  into v_create_class
  from private.phase_0a_rpc_classification
  where function_signature =
        'community_create_guest_follow_intent(uuid[])';

  select access_class
  into v_claim_class
  from private.phase_0a_rpc_classification
  where function_signature =
        'community_claim_guest_follow_intent(text)';

  if v_create_class <> 'public_bounded_write'
     or v_claim_class <> 'authenticated_self_service'
  then
    raise exception
      'Guest Follow intent RPC classification is incorrect';
  end if;

  select pg_get_functiondef(
    'public.community_create_guest_follow_intent(uuid[])'::regprocedure
  )
  into v_create_definition;

  select pg_get_functiondef(
    'public.community_claim_guest_follow_intent(text)'::regprocedure
  )
  into v_claim_definition;

  if position(
       'community_set_follow_state'
       in v_create_definition
     ) > 0
     or position(
          'community_set_follow_state'
          in v_claim_definition
        ) = 0
     or position(
          'community_set_registry_onboarding_state'
          in v_claim_definition
        ) = 0
     or position(
          'for update'
          in lower(v_claim_definition)
        ) = 0
  then
    raise exception
      'Guest Follow claim does not preserve canonical command authority';
  end if;
end;
$guest_follow_intent_verify$;

select jsonb_build_object(
  'guest_follow_intent_table',
    to_regclass('private.guest_follow_intents') is not null,
  'create_rpc',
    to_regprocedure(
      'public.community_create_guest_follow_intent(uuid[])'
    ) is not null,
  'claim_rpc',
    to_regprocedure(
      'public.community_claim_guest_follow_intent(text)'
    ) is not null,
  'anon_create',
    has_function_privilege(
      'anon',
      'public.community_create_guest_follow_intent(uuid[])',
      'EXECUTE'
    ),
  'anon_claim',
    has_function_privilege(
      'anon',
      'public.community_claim_guest_follow_intent(text)',
      'EXECUTE'
    )
) as guest_follow_intent_authority;
