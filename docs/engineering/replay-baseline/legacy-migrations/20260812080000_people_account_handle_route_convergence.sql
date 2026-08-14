-- People / Contributor Identity: account handle ↔ Person route convergence.
--
-- Permanent contract:
-- - Person Resource UUID remains immutable human identity.
-- - For an account-linked Person with username X, /u/X and /people/X represent
--   the same linked Person.
-- - Username availability must respect permanent /people/ route ownership.
-- - Username changes move only the Person's canonical route alias; the Person
--   Resource UUID never changes.
-- - Prior Person routes remain permanently owned by the same Person and resolve
--   to the current canonical Person route.
-- - Account-backed profiles are hydrated with a valid username before Person
--   provisioning completes.

begin;

do $people_account_handle_preflight$
declare
  v_definition text;
  v_account_profiles integer;
  v_account_links integer;
  v_aligned integer;
  v_missing_username integer;
  v_conflicts integer;
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.user_profile_username_history') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('editorial.resource_aliases') is null
  then
    raise exception
      'STOP: Required account, Person, or Resource alias authority is missing';
  end if;

  if to_regprocedure('public.community_generate_username(uuid,text,text)') is null
     or to_regprocedure('public.community_username_available(text)') is null
     or to_regprocedure('public.community_update_username(text)') is null
     or to_regprocedure('public.community_create_profile(uuid,text,text)') is null
     or to_regprocedure('public.get_public_person(text)') is null
     or to_regprocedure('editorial.ensure_person_for_user(uuid)') is null
     or to_regprocedure('editorial.resolve_person_follow_target(uuid)') is null
     or to_regprocedure('editorial.provision_person_for_user_profile_insert()') is null
  then
    raise exception
      'STOP: Required handle or Person function is missing';
  end if;

  if to_regprocedure('editorial.sync_account_person_handle(uuid)') is not null
     or to_regprocedure('editorial.sync_person_handle_from_user_profile()') is not null
     or exists (
       select 1
       from pg_trigger trigger
       where trigger.tgrelid = 'public.user_profiles'::regclass
         and trigger.tgname = 'user_profiles_person_handle_sync'
         and not trigger.tgisinternal
     )
  then
    raise exception
      'STOP: Account ↔ Person handle synchronization authority already exists';
  end if;

  if md5(pg_get_functiondef(
       'public.community_generate_username(uuid,text,text)'::regprocedure
     )) <> '5a5f90a8a3dbbc6b02271f7d0e462244'
     or md5(pg_get_functiondef(
       'public.community_username_available(text)'::regprocedure
     )) <> '3e485378a5c16600c700d660f16793a0'
     or md5(pg_get_functiondef(
       'public.community_update_username(text)'::regprocedure
     )) <> 'c89ae7dca296fc5d19c6e19155dd9288'
     or md5(pg_get_functiondef(
       'public.community_create_profile(uuid,text,text)'::regprocedure
     )) <> 'ce8c106fa25f869d315a3ae79b29f5bc'
     or md5(pg_get_functiondef(
       'public.get_public_person(text)'::regprocedure
     )) <> '2d1795dc3145ebe9059614f40a91da02'
  then
    raise exception
      'STOP: Reviewed live handle/Person function authority changed after the alignment audit';
  end if;

  v_definition := pg_get_functiondef(
    'editorial.provision_person_for_user_profile_insert()'::regprocedure
  );

  if position('ensure_person_for_user' in v_definition) = 0
     or position('sync_account_person_handle' in v_definition) > 0
  then
    raise exception
      'STOP: Account Person provisioning trigger changed after the alignment audit';
  end if;

  select count(*)
  into v_account_profiles
  from public.user_profiles;

  select count(*)
  into v_account_links
  from editorial.person_identity_links
  where link_state = 'active'
    and user_id is not null;

  select count(*)
  into v_aligned
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  join editorial.resource_aliases alias
    on alias.resource_id = link.person_resource_id
   and alias.is_canonical
   and alias.retired_at is null
  where profile.username_normalized is not null
    and alias.path = '/people/' || profile.username_normalized;

  select count(*)
  into v_missing_username
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  where profile.username_normalized is null;

  select count(*)
  into v_conflicts
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  join editorial.resource_aliases alias
    on alias.path = '/people/' || profile.username_normalized
   and alias.resource_id <> link.person_resource_id
  where profile.username_normalized is not null;

  if v_account_profiles <> 11
     or v_account_links <> 11
     or v_aligned <> 5
     or v_missing_username <> 6
     or v_conflicts <> 0
  then
    raise exception
      'STOP: Reviewed production handle population changed: profiles %, account links %, aligned %, missing username %, conflicts %',
      v_account_profiles,
      v_account_links,
      v_aligned,
      v_missing_username,
      v_conflicts;
  end if;
end;
$people_account_handle_preflight$;


create or replace function
  public.community_generate_username(
    p_user_id uuid,
    p_email text,
    p_display_name text default null
  )
returns text
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_base text;
  v_candidate text;
  v_suffix text;
  v_attempt integer := 0;
  v_person_resource_id uuid;
begin
  select link.person_resource_id
  into v_person_resource_id
  from editorial.person_identity_links link
  where link.user_id = p_user_id
    and link.link_state = 'active'
  limit 1;

  if v_person_resource_id is not null then
    select resolved.person_resource_id
    into v_person_resource_id
    from editorial.resolve_person_follow_target(
      v_person_resource_id
    ) resolved;
  end if;

  v_base := public.community_username_seed(
    coalesce(
      nullif(p_display_name, ''),
      nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
      'user'
    )
  );

  v_candidate := v_base;

  if public.community_username_is_reserved(v_candidate)
     or exists (
       select 1
       from public.user_profiles profile
       where profile.username_normalized = v_candidate
         and profile.user_id <> p_user_id
     )
     or exists (
       select 1
       from editorial.resource_aliases alias
       where alias.path = '/people/' || v_candidate
         and (
           v_person_resource_id is null
           or alias.resource_id <> v_person_resource_id
         )
     )
  then
    v_suffix := '_' || left(
      replace(
        coalesce(p_user_id::text, gen_random_uuid()::text),
        '-',
        ''
      ),
      8
    );

    v_candidate :=
      left(v_base, 30 - length(v_suffix))
      || v_suffix;
  end if;

  while public.community_username_is_reserved(v_candidate)
     or exists (
       select 1
       from public.user_profiles profile
       where profile.username_normalized = v_candidate
         and profile.user_id <> p_user_id
     )
     or exists (
       select 1
       from editorial.resource_aliases alias
       where alias.path = '/people/' || v_candidate
         and (
           v_person_resource_id is null
           or alias.resource_id <> v_person_resource_id
         )
     )
  loop
    v_attempt := v_attempt + 1;

    v_suffix := '_' || left(
      replace(
        coalesce(p_user_id::text, gen_random_uuid()::text),
        '-',
        ''
      ),
      6
    ) || v_attempt::text;

    v_candidate :=
      left(v_base, 30 - length(v_suffix))
      || v_suffix;

    if v_attempt > 99 then
      raise exception
        'could not generate unique username for user %',
        p_user_id;
    end if;
  end loop;

  return v_candidate;
end;
$function$;


create or replace function
  editorial.sync_account_person_handle(
    p_user_id uuid
  )
returns text
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_username text;
  v_person_resource_id uuid;
  v_resolved_person_resource_id uuid;
  v_desired_path text;
  v_desired_alias_id uuid;
  v_desired_alias_resource_id uuid;
  v_current_alias_id uuid;
  v_current_path text;
  v_actor_id uuid := auth.uid();
begin
  if p_user_id is null then
    raise exception
      'Account user id is required for Person handle synchronization.';
  end if;

  select profile.username_normalized
  into v_username
  from public.user_profiles profile
  where profile.user_id = p_user_id;

  if not found then
    raise exception
      'Account profile % does not exist.',
      p_user_id;
  end if;

  if v_username is null
     or not public.community_username_is_valid(v_username)
  then
    raise exception
      'Account profile % does not have a valid normalized username.',
      p_user_id;
  end if;

  select link.person_resource_id
  into v_person_resource_id
  from editorial.person_identity_links link
  where link.user_id = p_user_id
    and link.link_state = 'active'
  limit 1;

  if not found then
    return null;
  end if;

  select resolved.person_resource_id
  into v_resolved_person_resource_id
  from editorial.resolve_person_follow_target(
    v_person_resource_id
  ) resolved;

  if v_resolved_person_resource_id is null then
    raise exception
      'Linked Person % could not resolve to a stable Person survivor.',
      v_person_resource_id;
  end if;

  v_person_resource_id :=
    v_resolved_person_resource_id;

  v_desired_path :=
    '/people/' || v_username;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'person-handle-user|' || p_user_id::text,
      0
    )
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'person-path|' || v_username,
      0
    )
  );

  select
    alias.id,
    alias.resource_id
  into
    v_desired_alias_id,
    v_desired_alias_resource_id
  from editorial.resource_aliases alias
  where alias.path = v_desired_path
  for update;

  if found
     and v_desired_alias_resource_id <>
         v_person_resource_id
  then
    raise exception
      using
        errcode = '23505',
        message = format(
          'Handle %s is permanently reserved by another Person route.',
          v_username
        );
  end if;

  select
    alias.id,
    alias.path
  into
    v_current_alias_id,
    v_current_path
  from editorial.resource_aliases alias
  where alias.resource_id = v_person_resource_id
    and alias.is_canonical
    and alias.retired_at is null
  order by alias.created_at, alias.id
  limit 1
  for update;

  if not found then
    raise exception
      'Linked Person % has no active canonical route.',
      v_person_resource_id;
  end if;

  if v_current_path = v_desired_path then
    return v_desired_path;
  end if;

  if v_desired_alias_id is null then
    insert into editorial.resource_aliases (
      resource_id,
      path,
      is_canonical,
      redirect_status,
      created_by
    )
    values (
      v_person_resource_id,
      v_desired_path,
      false,
      308,
      v_actor_id
    )
    returning id
    into v_desired_alias_id;
  end if;

  update editorial.resource_aliases alias
  set
    is_canonical = false,
    redirect_status = 308,
    retired_at = now(),
    replacement_alias_id = v_desired_alias_id
  where alias.id = v_current_alias_id;

  update editorial.resource_aliases alias
  set
    is_canonical = true,
    redirect_status = 308,
    retired_at = null,
    replacement_alias_id = null
  where alias.id = v_desired_alias_id
    and alias.resource_id = v_person_resource_id;

  if not found then
    raise exception
      'Could not promote % as the canonical route for Person %.',
      v_desired_path,
      v_person_resource_id;
  end if;

  update editorial.people person
  set
    updated_by = coalesce(v_actor_id, person.updated_by),
    updated_at = now()
  where person.resource_id = v_person_resource_id;

  return v_desired_path;
end;
$function$;

revoke all on function
  editorial.sync_account_person_handle(uuid)
from public;

revoke execute on function
  editorial.sync_account_person_handle(uuid)
from anon, authenticated;

grant execute on function
  editorial.sync_account_person_handle(uuid)
to service_role;


create or replace function
  editorial.sync_person_handle_from_user_profile()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
begin
  if new.username_normalized is null then
    return new;
  end if;

  perform editorial.sync_account_person_handle(
    new.user_id
  );

  return new;
end;
$function$;

revoke all on function
  editorial.sync_person_handle_from_user_profile()
from public;

revoke execute on function
  editorial.sync_person_handle_from_user_profile()
from anon, authenticated, service_role;

create trigger
  user_profiles_person_handle_sync
after update of username_normalized
on public.user_profiles
for each row
when (
  old.username_normalized
    is distinct from new.username_normalized
  and new.username_normalized is not null
)
execute function
  editorial.sync_person_handle_from_user_profile();


create or replace function
  editorial.provision_person_for_user_profile_insert()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_username text;
  v_email text;
  v_display_name text;
begin
  select
    profile.username_normalized,
    profile.email,
    profile.display_name
  into
    v_username,
    v_email,
    v_display_name
  from public.user_profiles profile
  where profile.user_id = new.user_id;

  if not found then
    return null;
  end if;

  if v_username is null then
    v_username :=
      public.community_generate_username(
        new.user_id,
        v_email,
        v_display_name
      );

    update public.user_profiles profile
    set
      username = v_username,
      username_normalized = v_username,
      username_updated_at =
        coalesce(
          profile.username_updated_at,
          now()
        ),
      updated_at = now()
    where profile.user_id = new.user_id;
  end if;

  perform editorial.ensure_person_for_user(
    new.user_id
  );

  perform editorial.sync_account_person_handle(
    new.user_id
  );

  return null;
end;
$function$;

revoke all on function
  editorial.provision_person_for_user_profile_insert()
from public;

revoke execute on function
  editorial.provision_person_for_user_profile_insert()
from anon, authenticated, service_role;


create or replace function
  public.community_username_available(
    p_username text
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_username text;
  v_existing_user_id uuid;
  v_current_user_id uuid := auth.uid();
  v_current_person_resource_id uuid;
  v_path_holder_resource_id uuid;
begin
  v_username :=
    public.community_normalize_username(
      p_username
    );

  if v_username is null
     or not public.community_username_is_valid(
       v_username
     )
  then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'invalid_format',
      'message', 'Use 3-30 lowercase letters, numbers, and underscores. Start and end with a letter or number.'
    );
  end if;

  if public.community_username_is_reserved(
       v_username
     )
  then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'reserved',
      'message', 'That handle is reserved.'
    );
  end if;

  select profile.user_id
  into v_existing_user_id
  from public.user_profiles profile
  where profile.username_normalized =
        v_username;

  if found
     and v_existing_user_id = v_current_user_id
  then
    return jsonb_build_object(
      'available', true,
      'normalized', v_username,
      'reason', 'current',
      'message', 'This is your current handle.'
    );
  end if;

  if found then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'taken',
      'message', 'That handle is already taken.'
    );
  end if;

  if v_current_user_id is not null then
    select link.person_resource_id
    into v_current_person_resource_id
    from editorial.person_identity_links link
    where link.user_id = v_current_user_id
      and link.link_state = 'active'
    limit 1;

    if v_current_person_resource_id is not null then
      select resolved.person_resource_id
      into v_current_person_resource_id
      from editorial.resolve_person_follow_target(
        v_current_person_resource_id
      ) resolved;
    end if;
  end if;

  select alias.resource_id
  into v_path_holder_resource_id
  from editorial.resource_aliases alias
  where alias.path =
        '/people/' || v_username;

  if found
     and (
       v_current_person_resource_id is null
       or v_path_holder_resource_id <>
          v_current_person_resource_id
     )
  then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'person_path_reserved',
      'message', 'That handle is permanently reserved by another Person route.'
    );
  end if;

  if exists (
    select 1
    from public.user_profile_username_history history
    where history.old_username_normalized =
          v_username
      and history.user_id <>
          coalesce(
            v_current_user_id,
            '00000000-0000-0000-0000-000000000000'::uuid
          )
      and history.created_at >
          now() - interval '30 days'
  )
  then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'recently_released',
      'message', 'That handle was recently released and is temporarily protected.'
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'normalized', v_username,
    'reason', 'available',
    'message', 'Handle available.'
  );
end;
$function$;


create or replace function
  public.community_update_username(
    p_username text
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_user_id uuid;
  v_username text;
  v_profile public.user_profiles%rowtype;
  v_old_username text;
  v_old_username_normalized text;
  v_is_admin boolean;
  v_person_resource_id uuid;
  v_path_holder_resource_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'authentication required';
  end if;

  perform public.community_ensure_user_account(
    v_user_id
  );

  v_username :=
    public.community_normalize_username(
      p_username
    );

  if v_username is null
     or not public.community_username_is_valid(
       v_username
     )
  then
    raise exception
      'invalid handle: use 3-30 lowercase letters, numbers, and underscores; start and end with a letter or number';
  end if;

  if public.community_username_is_reserved(
       v_username
     )
  then
    raise exception
      'handle % is reserved',
      v_username;
  end if;

  v_is_admin :=
    public.current_user_is_administrator();

  select profile.*
  into v_profile
  from public.user_profiles profile
  where profile.user_id = v_user_id
  for update;

  if not found then
    raise exception
      'profile % not found',
      v_user_id;
  end if;

  if v_profile.username_normalized =
     v_username
  then
    return jsonb_build_object(
      'changed', false,
      'profile',
        public.community_profile_json(
          v_profile
        )
    );
  end if;

  if not v_is_admin
     and coalesce(
       v_profile.username_change_count,
       0
     ) > 0
     and v_profile.username_updated_at is not null
     and v_profile.username_updated_at >
         now() - interval '14 days'
  then
    raise exception
      'handle can only be changed once every 14 days';
  end if;

  if exists (
    select 1
    from public.user_profiles profile
    where profile.username_normalized =
          v_username
      and profile.user_id <> v_user_id
  )
  then
    raise exception
      'handle % is already taken',
      v_username;
  end if;

  if exists (
    select 1
    from public.user_profile_username_history history
    where history.old_username_normalized =
          v_username
      and history.user_id <> v_user_id
      and history.created_at >
          now() - interval '30 days'
  )
  then
    raise exception
      'handle % was recently released and is temporarily protected',
      v_username;
  end if;

  select link.person_resource_id
  into v_person_resource_id
  from editorial.person_identity_links link
  where link.user_id = v_user_id
    and link.link_state = 'active'
  limit 1;

  if v_person_resource_id is not null then
    select resolved.person_resource_id
    into v_person_resource_id
    from editorial.resolve_person_follow_target(
      v_person_resource_id
    ) resolved;
  end if;

  select alias.resource_id
  into v_path_holder_resource_id
  from editorial.resource_aliases alias
  where alias.path =
        '/people/' || v_username;

  if found
     and (
       v_person_resource_id is null
       or v_path_holder_resource_id <>
          v_person_resource_id
     )
  then
    raise exception
      'handle % is permanently reserved by another Person route',
      v_username;
  end if;

  v_old_username :=
    v_profile.username;
  v_old_username_normalized :=
    v_profile.username_normalized;

  update public.user_profiles profile
  set
    username = v_username,
    username_normalized = v_username,
    username_updated_at = now(),
    username_change_count =
      coalesce(
        profile.username_change_count,
        0
      ) + 1,
    updated_at = now()
  where profile.user_id = v_user_id
  returning profile.*
  into v_profile;

  insert into public.user_profile_username_history (
    user_id,
    old_username,
    old_username_normalized,
    new_username,
    new_username_normalized,
    changed_by,
    change_reason
  )
  values (
    v_user_id,
    v_old_username,
    v_old_username_normalized,
    v_profile.username,
    v_profile.username_normalized,
    v_user_id,
    'user_update'
  );

  return jsonb_build_object(
    'changed', true,
    'profile',
      public.community_profile_json(
        v_profile
      )
  );
end;
$function$;


create or replace function
  public.community_create_profile(
    p_user_id uuid,
    p_username text,
    p_display_name text default null
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_actor uuid;
  v_username text;
  v_profile public.user_profiles%rowtype;
  v_person_resource_id uuid;
  v_path_holder_resource_id uuid;
begin
  v_actor := auth.uid();

  if v_actor is null then
    raise exception
      'authentication required';
  end if;

  if p_user_id <> v_actor
     and not public.current_user_is_administrator()
  then
    raise exception
      'not allowed';
  end if;

  perform public.community_ensure_user_account(
    p_user_id
  );

  v_username :=
    public.community_normalize_username(
      p_username
    );

  if v_username is null
     or not public.community_username_is_valid(
       v_username
     )
  then
    raise exception
      'invalid handle: use 3-30 lowercase letters, numbers, and underscores; start and end with a letter or number';
  end if;

  if public.community_username_is_reserved(
       v_username
     )
  then
    raise exception
      'handle % is reserved',
      v_username;
  end if;

  if exists (
    select 1
    from public.user_profiles profile
    where profile.username_normalized =
          v_username
      and profile.user_id <> p_user_id
  )
  then
    raise exception
      'handle % is already taken',
      v_username;
  end if;

  select link.person_resource_id
  into v_person_resource_id
  from editorial.person_identity_links link
  where link.user_id = p_user_id
    and link.link_state = 'active'
  limit 1;

  if v_person_resource_id is not null then
    select resolved.person_resource_id
    into v_person_resource_id
    from editorial.resolve_person_follow_target(
      v_person_resource_id
    ) resolved;
  end if;

  select alias.resource_id
  into v_path_holder_resource_id
  from editorial.resource_aliases alias
  where alias.path =
        '/people/' || v_username;

  if found
     and (
       v_person_resource_id is null
       or v_path_holder_resource_id <>
          v_person_resource_id
     )
  then
    raise exception
      'handle % is permanently reserved by another Person route',
      v_username;
  end if;

  update public.user_profiles profile
  set
    username = v_username,
    username_normalized = v_username,
    display_name =
      coalesce(
        nullif(p_display_name, ''),
        profile.display_name
      ),
    username_updated_at =
      coalesce(
        profile.username_updated_at,
        now()
      ),
    updated_at = now()
  where profile.user_id = p_user_id
  returning profile.*
  into v_profile;

  return public.community_profile_json(
    v_profile
  );
end;
$function$;


create or replace function
  public.get_public_person(
    p_slug text
  )
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_input text;
  v_path text;
  v_requested_person_id uuid;
  v_person_id uuid;
  v_person editorial.people%rowtype;
  v_resource editorial.resources%rowtype;
  v_presentation jsonb;
  v_canonical_path text;
  v_depth integer := 0;
begin
  v_input := lower(
    btrim(
      coalesce(
        p_slug,
        ''
      )
    )
  );

  if v_input = '' then
    return null;
  end if;

  if v_input like '/people/%' then
    v_path := regexp_replace(
      v_input,
      '/+$',
      ''
    );
  else
    v_input := trim(
      both '/'
      from v_input
    );

    if v_input = '' then
      return null;
    end if;

    v_path :=
      '/people/' || v_input;
  end if;

  select alias.resource_id
  into v_requested_person_id
  from editorial.resource_aliases alias
  join editorial.resources resource
    on resource.id = alias.resource_id
   and resource.resource_kind = 'person'
  where alias.path = v_path
  order by
    alias.is_canonical desc,
    (alias.retired_at is null) desc,
    alias.created_at
  limit 1;

  if not found then
    return null;
  end if;

  v_person_id :=
    v_requested_person_id;

  loop
    v_depth := v_depth + 1;

    if v_depth > 8 then
      return null;
    end if;

    select person.*
    into v_person
    from editorial.people person
    where person.resource_id =
          v_person_id;

    if not found then
      return null;
    end if;

    exit when
      v_person.person_state <>
      'merged';

    if v_person.merged_into_person_resource_id
         is null
    then
      return null;
    end if;

    v_person_id :=
      v_person.merged_into_person_resource_id;
  end loop;

  if v_person.person_state <> 'active' then
    return null;
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = v_person_id
    and resource.resource_kind = 'person';

  if not found
     or v_resource.visibility <> 'public'
     or v_resource.lifecycle_state <> 'active'
  then
    return null;
  end if;

  v_presentation :=
    editorial.resolve_person_presentation(
      v_person_id
    );

  if v_presentation is null then
    return null;
  end if;

  select alias.path
  into v_canonical_path
  from editorial.resource_aliases alias
  where alias.resource_id = v_person_id
    and alias.is_canonical
    and alias.retired_at is null;

  if v_canonical_path is null then
    return null;
  end if;

  return jsonb_strip_nulls(
    jsonb_build_object(
      'person_id',
        v_person_id,
      'canonical_path',
        v_canonical_path,
      'display_name',
        v_presentation ->> 'display_name',
      'bio',
        v_presentation ->> 'bio',
      'avatar_url',
        v_presentation ->> 'avatar_url',
      'cover_url',
        v_presentation ->> 'cover_url',
      'location',
        v_presentation ->> 'location',
      'username',
        v_presentation ->> 'username',
      'registry_author_slug',
        v_presentation
          ->> 'registry_author_slug',
      'redirect_to',
        case
          when v_requested_person_id
                 is distinct from v_person_id
            or v_path
                 is distinct from v_canonical_path
            then v_canonical_path
          else null
        end
    )
  );
end;
$function$;

revoke all
on function public.get_public_person(text)
from public, anon, authenticated;

grant execute
on function public.get_public_person(text)
to anon, authenticated, service_role;


-- Backfill the six reviewed account profiles that currently have no username.
-- The UPDATE trigger synchronizes their Person canonical aliases in the same
-- transaction. Existing aligned accounts remain untouched.
do $people_account_handle_backfill$
declare
  v_profile record;
  v_username text;
begin
  for v_profile in
    select
      profile.user_id,
      profile.email,
      profile.display_name
    from public.user_profiles profile
    join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where profile.username_normalized is null
    order by profile.created_at nulls last, profile.user_id
  loop
    v_username :=
      public.community_generate_username(
        v_profile.user_id,
        v_profile.email,
        v_profile.display_name
      );

    update public.user_profiles profile
    set
      username = v_username,
      username_normalized = v_username,
      username_updated_at =
        coalesce(
          profile.username_updated_at,
          now()
        ),
      updated_at = now()
    where profile.user_id = v_profile.user_id
      and profile.username_normalized is null;

    if not found then
      raise exception
        'STOP: Account % changed during username backfill',
        v_profile.user_id;
    end if;
  end loop;
end;
$people_account_handle_backfill$;


-- Durable postcondition: every account-linked Person has one valid username and
-- an exact /people/:username canonical alias owned by the same Person UUID.
do $people_account_handle_postcondition$
declare
  v_profiles integer;
  v_links integer;
  v_mismatches integer;
  v_conflicts integer;
begin
  select count(*)
  into v_profiles
  from public.user_profiles;

  select count(*)
  into v_links
  from editorial.person_identity_links
  where link_state = 'active'
    and user_id is not null;

  select count(*)
  into v_mismatches
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  left join editorial.resource_aliases alias
    on alias.resource_id = link.person_resource_id
   and alias.is_canonical
   and alias.retired_at is null
  where profile.username_normalized is null
     or not public.community_username_is_valid(
       profile.username_normalized
     )
     or alias.path is distinct from
        '/people/' || profile.username_normalized;

  select count(*)
  into v_conflicts
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  join editorial.resource_aliases alias
    on alias.path =
       '/people/' || profile.username_normalized
   and alias.resource_id <> link.person_resource_id;

  if v_profiles <> 11
     or v_links <> 11
     or v_mismatches <> 0
     or v_conflicts <> 0
  then
    raise exception
      'STOP: Account ↔ Person handle postcondition failed: profiles %, links %, mismatches %, conflicts %',
      v_profiles,
      v_links,
      v_mismatches,
      v_conflicts;
  end if;

  if exists (
    select 1
    from public.user_profiles profile
    join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where public.get_public_person(
            profile.username_normalized
          ) ->> 'person_id'
          is distinct from
          link.person_resource_id::text
      and profile.is_public
      and profile.status = 'active'
  )
  then
    raise exception
      'STOP: A public /people/:username route does not resolve to its linked Person UUID';
  end if;
end;
$people_account_handle_postcondition$;

commit;
