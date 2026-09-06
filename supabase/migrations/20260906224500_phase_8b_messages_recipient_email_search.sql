-- Phase 8B.3 recipient discovery correction.
--
-- Browser acceptance proved that an eligible staff recipient can be found by
-- canonical display name or handle, but not by the email address the sender
-- already knows. The existing RPC does not inspect profile.email.
--
-- This correction preserves the existing audience, block, recipient-policy,
-- Person identity, result-shape, grant, and privacy boundaries. Email becomes
-- an input-side discovery signal only. It is not returned by the RPC.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b-messages-recipient-email-search',
    0
  )
);

do $phase_8b_recipient_email_search_preflight$
declare
  v_definition text;
  v_owner text;
  v_security_definer boolean;
  v_config text[];
begin
  select
    pg_catalog.pg_get_functiondef(p.oid),
    pg_catalog.pg_get_userbyid(p.proowner),
    p.prosecdef,
    p.proconfig
  into
    v_definition,
    v_owner,
    v_security_definer,
    v_config
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'search_message_recipients'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
        'p_query text, p_limit integer';

  if v_definition is null then
    raise exception
      'STOP: search_message_recipients(text, integer) is missing';
  end if;

  if position(
       'profile.username_normalized' in v_definition
     ) = 0
     or position(
       'profile.display_name' in v_definition
     ) = 0
  then
    raise exception
      'STOP: recipient discovery baseline drifted';
  end if;

  if position(
       'lower(coalesce(profile.email' in v_definition
     ) <> 0
  then
    raise exception
      'STOP: recipient email discovery is already present';
  end if;

  if v_owner <> 'postgres'
     or not v_security_definer
     or v_config is distinct from
        array[
          'search_path=pg_catalog, auth, public, editorial, messaging'
        ]::text[]
  then
    raise exception
      'STOP: recipient discovery security posture drifted';
  end if;
end;
$phase_8b_recipient_email_search_preflight$;

create or replace function public.search_message_recipients(
  p_query text,
  p_limit integer default 8
)
returns table(
  person_resource_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  sender_category text
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'messaging'
as $function$
declare
  me record;
  q text;
  lim integer;
begin
  select * into me
  from messaging.current_human_identity();

  if not messaging.audience_allows_category(me.sender_category) then
    return;
  end if;

  q := lower(btrim(coalesce(p_query,'')));
  lim := least(greatest(coalesce(p_limit,8),1),12);

  if length(q) < 1 then
    return;
  end if;

  return query
  select
    link.person_resource_id,
    coalesce(
      nullif(presentation->>'username',''),
      profile.username_normalized
    ) as handle,
    coalesce(
      nullif(presentation->>'display_name',''),
      nullif(btrim(profile.display_name),''),
      profile.username_normalized,
      'WAKILISHA member'
    ) as display_name,
    coalesce(
      nullif(presentation->>'avatar_url',''),
      profile.avatar_url
    ) as avatar_url,
    messaging.user_sender_category(profile.user_id) as sender_category
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id=profile.user_id
   and link.link_state='active'
  join editorial.people person
    on person.resource_id=link.person_resource_id
   and person.person_state='active'
  cross join lateral editorial.resolve_person_presentation(
    link.person_resource_id
  ) presentation
  where profile.status='active'
    and profile.user_id<>me.user_id
    and messaging.audience_allows_category(
      messaging.user_sender_category(profile.user_id)
    )
    and not messaging.person_blocked_between(
      me.user_id,
      link.person_resource_id
    )
    and coalesce(
      (
        select policy.first_contact_disposition
        from messaging.user_sender_policies policy
        where policy.user_id=profile.user_id
          and policy.sender_category=me.sender_category
      ),
      messaging.default_first_contact_disposition(me.sender_category)
    )<>'reject'
    and (
      position(
        q in lower(coalesce(profile.username_normalized,''))
      ) > 0
      or position(
        q in lower(coalesce(profile.display_name,''))
      ) > 0
      or position(
        q in lower(coalesce(profile.email,''))
      ) > 0
    )
  order by
    case
      when lower(coalesce(profile.email,''))=q then 0
      when lower(coalesce(profile.username_normalized,''))=q then 1
      when lower(coalesce(profile.display_name,''))=q then 2
      when left(
        lower(coalesce(profile.username_normalized,'')),
        length(q)
      )=q then 3
      when left(
        lower(coalesce(profile.display_name,'')),
        length(q)
      )=q then 4
      when left(
        lower(coalesce(profile.email,'')),
        length(q)
      )=q then 5
      else 6
    end,
    lower(
      coalesce(
        nullif(btrim(profile.display_name),''),
        profile.username_normalized,
        ''
      )
    ),
    link.person_resource_id
  limit lim;
end
$function$;

do $phase_8b_recipient_email_search_postcheck$
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
      'STOP: recipient email discovery correction did not land';
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
      'STOP: recipient discovery result shape widened unexpectedly: %',
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
      'STOP: recipient discovery grants drifted';
  end if;
end;
$phase_8b_recipient_email_search_postcheck$;

commit;
