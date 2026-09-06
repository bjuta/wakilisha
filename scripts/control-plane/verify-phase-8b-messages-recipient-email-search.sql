-- Permanent verification for Phase 8B.3 recipient email discovery.
-- The runtime fixture is rollback-only and proves that an authenticated staff
-- sender can resolve another eligible staff Person by exact email without
-- widening the RPC result shape to expose email.

begin;

do $phase_8b_recipient_email_search_static$
declare
  v_definition text;
  v_result_names text[];
begin
  select pg_catalog.pg_get_functiondef(p.oid)
  into v_definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'search_message_recipients'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
        'p_query text, p_limit integer';

  if v_definition is null
     or position(
       'profile.email' in v_definition
     ) = 0
  then
    raise exception
      'STOP: recipient email discovery definition is missing';
  end if;

  select array_agg(args.name order by args.ordinality)
  into v_result_names
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  cross join lateral unnest(p.proargnames, p.proargmodes)
    with ordinality args(name, mode, ordinality)
  where n.nspname = 'public'
    and p.proname = 'search_message_recipients'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
        'p_query text, p_limit integer'
    and args.mode in ('o','t');

  if v_result_names is distinct from
     array[
       'person_resource_id',
       'handle',
       'display_name',
       'avatar_url',
       'sender_category'
     ]::text[]
  then
    raise exception
      'STOP: recipient discovery output shape drifted: %',
      v_result_names;
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.search_message_recipients(text,integer)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.search_message_recipients(text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: recipient discovery grants are invalid';
  end if;
end;
$phase_8b_recipient_email_search_static$;

set constraints all deferred;

do $phase_8b_recipient_email_search_fixture$
declare
  v_sender uuid := gen_random_uuid();
  v_recipient uuid := gen_random_uuid();
begin
  create temporary table phase_8b_recipient_email_search_fixture_ids(
    sender_id uuid not null,
    recipient_id uuid not null
  ) on commit drop;

  insert into phase_8b_recipient_email_search_fixture_ids
  values (v_sender, v_recipient);

  insert into auth.users (
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values
  (
    v_sender,
    'authenticated',
    'authenticated',
    'phase8b-email-search-sender@example.invalid',
    jsonb_build_object(
      'provider','email',
      'providers',jsonb_build_array('email')
    ),
    jsonb_build_object('name','Email Search Sender'),
    now(),
    now(),
    false,
    false
  ),
  (
    v_recipient,
    'authenticated',
    'authenticated',
    'phase8b-email-search-target@example.invalid',
    jsonb_build_object(
      'provider','email',
      'providers',jsonb_build_array('email')
    ),
    jsonb_build_object('name','Email Search Target'),
    now(),
    now(),
    false,
    false
  );

  insert into public.user_role_assignments(
    user_id,
    role_key,
    status,
    assigned_by,
    assigned_at,
    notes,
    created_at,
    updated_at
  )
  values
  (
    v_sender,
    'editor',
    'active',
    null,
    now(),
    'Rollback-only Phase 8B recipient email search sender.',
    now(),
    now()
  ),
  (
    v_recipient,
    'editor',
    'active',
    null,
    now(),
    'Rollback-only Phase 8B recipient email search target.',
    now(),
    now()
  );
end;
$phase_8b_recipient_email_search_fixture$;

set constraints all immediate;
set constraints all deferred;

select pg_catalog.set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(
      select sender_id::text
      from phase_8b_recipient_email_search_fixture_ids
    ),
    'role','authenticated'
  )::text,
  true
);

set local role authenticated;

do $phase_8b_recipient_email_search_runtime$
declare
  v_count integer;
  v_category text;
begin
  select
    count(*),
    max(result.sender_category)
  into
    v_count,
    v_category
  from public.search_message_recipients(
    'phase8b-email-search-target@example.invalid',
    8
  ) result;

  if v_count <> 1
     or v_category <> 'staff'
  then
    raise exception
      'STOP: exact email recipient discovery failed: count=%, category=%',
      v_count,
      v_category;
  end if;
end;
$phase_8b_recipient_email_search_runtime$;

select jsonb_build_object(
  'verification','PASS',
  'recipient_email_search','exact-email-resolves-eligible-staff',
  'result_shape','person-presentation-only',
  'fixture_persistence','rollback-only'
) as phase_8b_recipient_email_search_verification;

rollback;
