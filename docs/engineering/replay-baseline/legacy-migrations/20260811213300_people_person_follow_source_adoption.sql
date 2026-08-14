-- People / Contributor Identity Migration C:
-- validated Person Follow authority plus reviewed one-source Person adoption.
--
-- Permanent rule:
-- Follow a person, not a role.
--
-- This migration:
-- 1. validates Person Follow targets against stable Person Resource identity;
-- 2. canonicalizes merged Person targets to the final Person survivor;
-- 3. adds viewer-only Person Follow state and public follower-count reads;
-- 4. adds commit-time one-source Person provisioning hooks;
-- 5. hydrates account Person identity through community_ensure_user_account;
-- 6. adopts the reviewed 10 account + 12 Registry Author + 0 external-contributor
--    production source population without cross-source auto-merge.
--
-- This migration does not:
-- - change Person reconciliation or merge authority;
-- - rewrite Shared Credits;
-- - expose follower identities;
-- - expose public Following lists;
-- - change frontend routes;
-- - add feed ranking;
-- - auto-merge identities by email, name, or metadata.

begin;

do $people_migration_c_preflight$
declare
  v_definition text;
  v_unlinked_accounts integer;
  v_unlinked_registry_authors integer;
  v_unlinked_external_contributors integer;
begin
  if to_regclass(
       'editorial.people'
     ) is null
     or to_regclass(
       'editorial.person_identity_links'
     ) is null
     or to_regclass(
       'public.community_follows'
     ) is null
  then
    raise exception
      'STOP: Migration A/B Person or Follow authority is missing';
  end if;

  if to_regprocedure(
       'editorial.ensure_person_for_user(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.ensure_person_for_registry_author(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.ensure_person_for_external_contributor(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_set_follow_state(text,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.community_follow_target(text,text,text)'
     ) is null
     or to_regprocedure(
       'public.community_get_user_follows(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_ensure_user_account(uuid)'
     ) is null
  then
    raise exception
      'STOP: Required Migration C predecessor function is missing';
  end if;

  if to_regprocedure(
       'editorial.resolve_person_follow_target(uuid)'
     ) is not null
     or to_regprocedure(
       'public.community_get_person_follow_state(uuid)'
     ) is not null
     or to_regprocedure(
       'public.get_public_person_social_summary(uuid)'
     ) is not null
  then
    raise exception
      'STOP: Migration C read/normalization authority already exists';
  end if;

  if (
    select count(*)
    from editorial.people
  ) <> 3
  then
    raise exception
      'STOP: Reviewed production Person population changed before Migration C';
  end if;

  if (
    select count(*)
    from editorial.person_identity_links
  ) <> 3
     or (
       select count(*)
       from editorial.person_identity_links
       where link_state = 'active'
     ) <> 3
  then
    raise exception
      'STOP: Reviewed production Person identity-link population changed before Migration C';
  end if;

  if (
    select count(*)
    from public.community_follows
  ) <> 3
     or (
       select count(*)
       from public.community_follows
       where target_type = 'article'
     ) <> 1
     or (
       select count(*)
       from public.community_follows
       where target_type = 'artist'
     ) <> 2
     or exists (
       select 1
       from public.community_follows
       where target_type = 'person'
     )
  then
    raise exception
      'STOP: Reviewed production Follow population changed before Migration C';
  end if;

  if has_table_privilege(
       'anon',
       'public.community_follows',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'public.community_follows',
       'INSERT'
     )
     or has_table_privilege(
       'anon',
       'public.community_follows',
       'UPDATE'
     )
     or has_table_privilege(
       'anon',
       'public.community_follows',
       'DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'DELETE'
     )
  then
    raise exception
      'STOP: Browser role gained direct Follow table CRUD before Migration C';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_set_follow_state(text,text,text,boolean)'::regprocedure
    );

  if md5(v_definition) <>
     'b67beb7b5aa874911bfe83469c2fca86'
  then
    raise exception
      'STOP: community_set_follow_state changed after Migration C audit';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_follow_target(text,text,text)'::regprocedure
    );

  if md5(v_definition) <>
     'bf16f0d7752a33828f39b00dd39aff2d'
  then
    raise exception
      'STOP: community_follow_target changed after Migration C audit';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_get_user_follows(uuid)'::regprocedure
    );

  if md5(v_definition) <>
     'cdbfca495b27c6b2b240c2958d68e381'
  then
    raise exception
      'STOP: private generic Follow reader changed after Migration C audit';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_ensure_user_account(uuid)'::regprocedure
    );

  if md5(v_definition) <>
     'f1453e49ee07720c0df556e330274d5e'
  then
    raise exception
      'STOP: community_ensure_user_account changed after Migration C audit';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.ensure_person_for_user(uuid)'::regprocedure
       )
     ) <>
     '10d6cd20eec1b5a42e38f64fbdef3a87'
     or md5(
       pg_get_functiondef(
         'editorial.ensure_person_for_registry_author(uuid)'::regprocedure
       )
     ) <>
     '373ddf7e46ddc165937bb710881578f9'
     or md5(
       pg_get_functiondef(
         'editorial.ensure_person_for_external_contributor(uuid)'::regprocedure
       )
     ) <>
     'fb5247fed7e7469e59128d5b5243b08c'
  then
    raise exception
      'STOP: one-source Person provisioning helper changed after Migration C audit';
  end if;

  select count(*)
  into v_unlinked_accounts
  from public.user_profiles profile
  left join editorial.person_identity_links link
    on link.user_id = profile.user_id
   and link.link_state = 'active'
  where link.id is null;

  select count(*)
  into v_unlinked_registry_authors
  from public.registry_authors author
  left join editorial.person_identity_links link
    on link.registry_author_id = author.id
   and link.link_state = 'active'
  where link.id is null;

  select count(*)
  into v_unlinked_external_contributors
  from editorial.external_contributors contributor
  left join editorial.person_identity_links link
    on link.external_contributor_id = contributor.id
   and link.link_state = 'active'
  where link.id is null;

  if v_unlinked_accounts <> 10
     or v_unlinked_registry_authors <> 12
     or v_unlinked_external_contributors <> 0
  then
    raise exception
      'STOP: Reviewed Migration C adoption population changed: accounts %, registry authors %, external contributors %',
      v_unlinked_accounts,
      v_unlinked_registry_authors,
      v_unlinked_external_contributors;
  end if;

  if exists (
    select 1
    from public.user_profiles profile
    left join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where link.id is null
      and (
        profile.status <> 'active'
        or profile.is_public is not true
        or nullif(
             btrim(
               coalesce(
                 profile.username_normalized,
                 profile.display_name,
                 ''
               )
             ),
             ''
           ) is null
      )
  ) then
    raise exception
      'STOP: Reviewed account adoption set is no longer active/public with a usable Person seed';
  end if;

  if exists (
    select 1
    from public.registry_authors author
    left join editorial.person_identity_links link
      on link.registry_author_id = author.id
     and link.link_state = 'active'
    where link.id is null
      and (
        nullif(
          btrim(
            coalesce(
              author.slug,
              ''
            )
          ),
          ''
        ) is null
        or nullif(
          btrim(
            coalesce(
              author.name,
              ''
            )
          ),
          ''
        ) is null
      )
  ) then
    raise exception
      'STOP: Reviewed Registry Author adoption set lost required slug/name authority';
  end if;
end;
$people_migration_c_preflight$;


create or replace function
  editorial.resolve_person_follow_target(
    p_person_resource_id uuid
  )
returns table(
  person_resource_id uuid,
  canonical_path text,
  followable boolean
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_person_id uuid :=
    p_person_resource_id;
  v_person editorial.people%rowtype;
  v_resource editorial.resources%rowtype;
  v_path text;
  v_seen uuid[] :=
    array[]::uuid[];
  v_depth integer := 0;
begin
  if v_person_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'Person target is required.';
  end if;

  loop
    v_depth :=
      v_depth + 1;

    if v_depth > 8 then
      raise exception
        using
          errcode = '22023',
          message =
            'Person merge chain exceeds the supported Follow safety depth.';
    end if;

    if v_person_id = any(v_seen) then
      raise exception
        using
          errcode = '22023',
          message =
            'Person merge cycle is not a valid Follow target.';
    end if;

    v_seen :=
      array_append(
        v_seen,
        v_person_id
      );

    select person.*
    into v_person
    from editorial.people person
    where person.resource_id =
          v_person_id;

    if not found then
      raise exception
        using
          errcode = 'P0002',
          message =
            'Person Follow target does not exist.';
    end if;

    exit when
      v_person.person_state <>
      'merged';

    if v_person.merged_into_person_resource_id
         is null
    then
      raise exception
        using
          errcode = '22023',
          message =
            'Merged Person Follow target has no survivor.';
    end if;

    v_person_id :=
      v_person.merged_into_person_resource_id;
  end loop;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id =
        v_person_id
    and resource.resource_kind =
        'person';

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message =
          'Person Resource binding does not exist.';
  end if;

  select alias.path
  into v_path
  from editorial.resource_aliases alias
  where alias.resource_id =
        v_person_id
    and alias.is_canonical
    and alias.retired_at is null
  order by
    alias.created_at,
    alias.path
  limit 1;

  person_resource_id :=
    v_person_id;
  canonical_path :=
    v_path;
  followable :=
    (
      v_person.person_state = 'active'
      and v_resource.visibility = 'public'
      and v_resource.lifecycle_state = 'active'
      and v_path ~ '^/people/[^/]+$'
    );

  return next;
end;
$function$;


revoke all on function
  editorial.resolve_person_follow_target(
    uuid
  )
from public;

revoke execute on function
  editorial.resolve_person_follow_target(
    uuid
  )
from anon, authenticated;

grant execute on function
  editorial.resolve_person_follow_target(
    uuid
  )
to service_role;


create or replace function
  editorial.provision_person_for_user_profile_insert()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
begin
  perform editorial.ensure_person_for_user(
    new.user_id
  );

  return null;
end;
$function$;


create or replace function
  editorial.provision_person_for_registry_author_insert()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
begin
  perform editorial.ensure_person_for_registry_author(
    new.id
  );

  return null;
end;
$function$;


create or replace function
  editorial.provision_person_for_external_contributor_insert()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
begin
  perform editorial.ensure_person_for_external_contributor(
    new.id
  );

  return null;
end;
$function$;


revoke all on function
  editorial.provision_person_for_user_profile_insert()
from public;

revoke all on function
  editorial.provision_person_for_registry_author_insert()
from public;

revoke all on function
  editorial.provision_person_for_external_contributor_insert()
from public;

revoke execute on function
  editorial.provision_person_for_user_profile_insert()
from anon, authenticated, service_role;

revoke execute on function
  editorial.provision_person_for_registry_author_insert()
from anon, authenticated, service_role;

revoke execute on function
  editorial.provision_person_for_external_contributor_insert()
from anon, authenticated, service_role;


create constraint trigger
  user_profiles_person_provisioning
after insert
on public.user_profiles
deferrable initially deferred
for each row
execute function
  editorial.provision_person_for_user_profile_insert();


create constraint trigger
  registry_authors_person_provisioning
after insert
on public.registry_authors
deferrable initially deferred
for each row
execute function
  editorial.provision_person_for_registry_author_insert();


create constraint trigger
  external_contributors_person_provisioning
after insert
on editorial.external_contributors
deferrable initially deferred
for each row
execute function
  editorial.provision_person_for_external_contributor_insert();


create or replace function
  public.community_ensure_user_account(
    p_user_id uuid
  )
returns void
language plpgsql
security definer
set search_path to
  'public',
  'auth'
as $function$
declare
  v_email text;
  v_display_name text;
  v_username text;
  v_cols text[];
  v_vals text[];
  v_updates text[];
begin
  if p_user_id is null then
    raise exception
      'user_id is required';
  end if;

  if auth.uid() is null then
    raise exception
      'authentication required';
  end if;

  if p_user_id <> auth.uid()
     and not public.current_user_is_administrator()
  then
    raise exception
      'not allowed';
  end if;

  select
    au.email,
    coalesce(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      split_part(
        coalesce(
          au.email,
          ''
        ),
        '@',
        1
      ),
      'WAKILISHA user'
    )
  into
    v_email,
    v_display_name
  from auth.users au
  where au.id =
        p_user_id;

  if not found then
    raise exception
      'auth user % not found',
      p_user_id;
  end if;

  v_username :=
    public.community_generate_username(
      p_user_id,
      v_email,
      v_display_name
    );

  insert into public.user_profiles (
    user_id,
    email,
    username,
    username_normalized,
    display_name,
    status,
    metadata,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_email,
    v_username,
    v_username,
    v_display_name,
    'active',
    jsonb_build_object(
      'created_by',
      'community_ensure_user_account'
    ),
    now(),
    now()
  )
  on conflict (user_id)
  do update
  set
    email =
      coalesce(
        excluded.email,
        public.user_profiles.email
      ),
    username =
      coalesce(
        public.user_profiles.username,
        excluded.username
      ),
    username_normalized =
      coalesce(
        public.user_profiles.username_normalized,
        excluded.username_normalized
      ),
    display_name =
      coalesce(
        public.user_profiles.display_name,
        excluded.display_name
      ),
    status =
      coalesce(
        public.user_profiles.status,
        'active'
      ),
    updated_at =
      now();

  perform editorial.ensure_person_for_user(
    p_user_id
  );

  -- Keep legacy community_profiles environments hydrated without making it the
  -- canonical identity table.
  if to_regclass(
       'public.community_profiles'
     ) is not null
  then
    v_cols :=
      array['user_id'];
    v_vals :=
      array['$1'];
    v_updates :=
      array[]::text[];

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name =
            'community_profiles'
        and column_name =
            'username'
    ) then
      v_cols :=
        array_append(
          v_cols,
          'username'
        );
      v_vals :=
        array_append(
          v_vals,
          '$2'
        );
      v_updates :=
        array_append(
          v_updates,
          'username = coalesce(public.community_profiles.username, excluded.username)'
        );
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name =
            'community_profiles'
        and column_name =
            'display_name'
    ) then
      v_cols :=
        array_append(
          v_cols,
          'display_name'
        );
      v_vals :=
        array_append(
          v_vals,
          '$3'
        );
      v_updates :=
        array_append(
          v_updates,
          'display_name = coalesce(public.community_profiles.display_name, excluded.display_name)'
        );
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name =
            'community_profiles'
        and column_name =
            'email'
    ) then
      v_cols :=
        array_append(
          v_cols,
          'email'
        );
      v_vals :=
        array_append(
          v_vals,
          '$4'
        );
      v_updates :=
        array_append(
          v_updates,
          'email = coalesce(excluded.email, public.community_profiles.email)'
        );
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name =
            'community_profiles'
        and column_name =
            'is_public'
    ) then
      v_cols :=
        array_append(
          v_cols,
          'is_public'
        );
      v_vals :=
        array_append(
          v_vals,
          'true'
        );
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name =
            'community_profiles'
        and column_name =
            'created_at'
    ) then
      v_cols :=
        array_append(
          v_cols,
          'created_at'
        );
      v_vals :=
        array_append(
          v_vals,
          'now()'
        );
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name =
            'community_profiles'
        and column_name =
            'updated_at'
    ) then
      v_cols :=
        array_append(
          v_cols,
          'updated_at'
        );
      v_vals :=
        array_append(
          v_vals,
          'now()'
        );
      v_updates :=
        array_append(
          v_updates,
          'updated_at = now()'
        );
    end if;

    execute format(
      'insert into public.community_profiles (%s) values (%s) on conflict (user_id) do update set %s',
      array_to_string(
        v_cols,
        ', '
      ),
      array_to_string(
        v_vals,
        ', '
      ),
      case
        when coalesce(
               array_length(
                 v_updates,
                 1
               ),
               0
             ) > 0
          then array_to_string(
            v_updates,
            ', '
          )
        else
          'user_id = excluded.user_id'
      end
    )
    using
      p_user_id,
      v_username,
      v_display_name,
      v_email;
  end if;
end;
$function$;


create or replace function
  public.community_set_follow_state(
    p_target_type text,
    p_target_id text,
    p_target_slug text,
    p_followed boolean
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_target_type text :=
    nullif(
      trim(
        coalesce(
          p_target_type,
          ''
        )
      ),
      ''
    );
  v_target_id text :=
    nullif(
      trim(
        coalesce(
          p_target_id,
          ''
        )
      ),
      ''
    );
  v_target_slug text :=
    nullif(
      trim(
        coalesce(
          p_target_slug,
          ''
        )
      ),
      ''
    );
  v_followed boolean :=
    coalesce(
      p_followed,
      false
    );
  v_requested_person_id uuid;
  v_person record;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_target_type is null
     or v_target_id is null
  then
    raise exception
      'Follow target is required'
      using errcode = '22023';
  end if;

  if v_target_type = 'person' then
    begin
      v_requested_person_id :=
        v_target_id::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Person Follow target must be a UUID'
          using errcode = '22023';
    end;

    select *
    into v_person
    from editorial.resolve_person_follow_target(
      v_requested_person_id
    );

    v_target_id :=
      v_person.person_resource_id::text;

    v_target_slug :=
      case
        when v_person.canonical_path
               ~ '^/people/[^/]+$'
          then split_part(
            v_person.canonical_path,
            '/',
            3
          )
        else null
      end;

    if v_followed
       and not v_person.followable
    then
      raise exception
        'Person is not publicly followable'
        using errcode = '22023';
    end if;

    if v_followed
       and exists (
         select 1
         from editorial.person_identity_links link
         where link.person_resource_id =
               v_person.person_resource_id
           and link.link_state = 'active'
           and link.user_id =
               v_user_id
       )
    then
      raise exception
        'A user cannot follow their own Person'
        using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|follow|'
      || v_target_type
      || '|'
      || v_target_id,
      0
    )
  );

  if v_followed then
    insert into public.community_follows (
      user_id,
      target_type,
      target_id,
      target_slug
    )
    values (
      v_user_id,
      v_target_type,
      v_target_id,
      v_target_slug
    )
    on conflict (
      user_id,
      target_type,
      target_id
    )
    do update
    set target_slug =
      excluded.target_slug;
  else
    delete from public.community_follows
    where user_id =
          v_user_id
      and target_type =
          v_target_type
      and target_id =
          v_target_id;
  end if;

  return jsonb_build_object(
    'followed',
      v_followed
  );
end;
$function$;


create or replace function
  public.community_follow_target(
    p_target_type text,
    p_target_id text,
    p_target_slug text default null
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_target_type text :=
    nullif(
      trim(
        coalesce(
          p_target_type,
          ''
        )
      ),
      ''
    );
  v_target_id text :=
    nullif(
      trim(
        coalesce(
          p_target_id,
          ''
        )
      ),
      ''
    );
  v_target_slug text :=
    p_target_slug;
  v_requested_person_id uuid;
  v_person record;
  v_current boolean;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_target_type is null
     or v_target_id is null
  then
    raise exception
      'Follow target is required'
      using errcode = '22023';
  end if;

  if v_target_type = 'person' then
    begin
      v_requested_person_id :=
        v_target_id::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Person Follow target must be a UUID'
          using errcode = '22023';
    end;

    select *
    into v_person
    from editorial.resolve_person_follow_target(
      v_requested_person_id
    );

    v_target_id :=
      v_person.person_resource_id::text;

    v_target_slug :=
      case
        when v_person.canonical_path
               ~ '^/people/[^/]+$'
          then split_part(
            v_person.canonical_path,
            '/',
            3
          )
        else null
      end;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|follow|'
      || v_target_type
      || '|'
      || v_target_id,
      0
    )
  );

  select exists (
    select 1
    from public.community_follows follow
    where follow.user_id =
          v_user_id
      and follow.target_type =
          v_target_type
      and follow.target_id =
          v_target_id
  )
  into v_current;

  return public.community_set_follow_state(
    v_target_type,
    v_target_id,
    v_target_slug,
    not v_current
  );
end;
$function$;


create or replace function
  public.community_get_person_follow_state(
    p_person_resource_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_person record;
  v_followed boolean;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  select *
  into v_person
  from editorial.resolve_person_follow_target(
    p_person_resource_id
  );

  if not v_person.followable then
    raise exception
      'Person is not publicly followable'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.community_follows follow
    where follow.user_id =
          v_user_id
      and follow.target_type =
          'person'
      and follow.target_id =
          v_person.person_resource_id::text
  )
  into v_followed;

  return jsonb_build_object(
    'person_id',
      v_person.person_resource_id,
    'followed',
      v_followed
  );
end;
$function$;


create or replace function
  public.get_public_person_social_summary(
    p_person_resource_id uuid
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
  v_person record;
  v_follower_count integer;
begin
  begin
    select *
    into v_person
    from editorial.resolve_person_follow_target(
      p_person_resource_id
    );
  exception
    when sqlstate 'P0002'
      or sqlstate '22023'
    then
      return null;
  end;

  if not v_person.followable then
    return null;
  end if;

  select count(*)::integer
  into v_follower_count
  from public.community_follows follow
  where follow.target_type =
        'person'
    and follow.target_id =
        v_person.person_resource_id::text;

  return jsonb_build_object(
    'person_id',
      v_person.person_resource_id,
    'follower_count',
      v_follower_count
  );
end;
$function$;


revoke all on function
  public.community_get_person_follow_state(
    uuid
  )
from public;

revoke execute on function
  public.community_get_person_follow_state(
    uuid
  )
from anon;

grant execute on function
  public.community_get_person_follow_state(
    uuid
  )
to authenticated, service_role;


revoke all on function
  public.get_public_person_social_summary(
    uuid
  )
from public;

grant execute on function
  public.get_public_person_social_summary(
    uuid
  )
to anon, authenticated, service_role;


revoke all on function
  public.community_set_follow_state(
    text,
    text,
    text,
    boolean
  )
from public;

revoke execute on function
  public.community_set_follow_state(
    text,
    text,
    text,
    boolean
  )
from anon;

grant execute on function
  public.community_set_follow_state(
    text,
    text,
    text,
    boolean
  )
to authenticated, service_role;


revoke all on function
  public.community_follow_target(
    text,
    text,
    text
  )
from public;

revoke execute on function
  public.community_follow_target(
    text,
    text,
    text
  )
from anon;

grant execute on function
  public.community_follow_target(
    text,
    text,
    text
  )
to authenticated, service_role;


insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values
  (
    'community_get_person_follow_state(uuid)',
    'authenticated_read',
    'Self-only viewer Follow state for one validated public Person Resource.'
  ),
  (
    'get_public_person_social_summary(uuid)',
    'public_read',
    'Public aggregate follower count for one validated public Person Resource; follower identities remain private.'
  )
on conflict (function_signature)
do update
set
  access_class =
    excluded.access_class,
  rationale =
    excluded.rationale,
  reviewed_at =
    now();


do $people_migration_c_backfill$
declare
  v_people_before integer;
  v_links_before integer;
  v_nonperson_follow_hash_before text;
  v_nonperson_follow_hash_after text;
  v_profile record;
  v_author record;
  v_contributor record;
begin
  select count(*)
  into v_people_before
  from editorial.people;

  select count(*)
  into v_links_before
  from editorial.person_identity_links;

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(follow_row)
        order by follow_row.id
      )::text,
      '[]'
    )
  )
  into v_nonperson_follow_hash_before
  from public.community_follows follow_row
  where follow_row.target_type <>
        'person';

  if v_people_before <> 3
     or v_links_before <> 3
  then
    raise exception
      'STOP: Migration C adoption no longer starts from 3 People / 3 identity links';
  end if;

  if (
    select count(*)
    from public.user_profiles profile
    left join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where link.id is null
  ) <> 10
  then
    raise exception
      'STOP: Migration C account adoption count changed before backfill';
  end if;

  if (
    select count(*)
    from public.registry_authors author
    left join editorial.person_identity_links link
      on link.registry_author_id = author.id
     and link.link_state = 'active'
    where link.id is null
  ) <> 12
  then
    raise exception
      'STOP: Migration C Registry Author adoption count changed before backfill';
  end if;

  if (
    select count(*)
    from editorial.external_contributors contributor
    left join editorial.person_identity_links link
      on link.external_contributor_id = contributor.id
     and link.link_state = 'active'
    where link.id is null
  ) <> 0
  then
    raise exception
      'STOP: Migration C external-contributor adoption count changed before backfill';
  end if;

  for v_profile in
    select profile.user_id
    from public.user_profiles profile
    left join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where link.id is null
    order by profile.user_id
  loop
    perform editorial.ensure_person_for_user(
      v_profile.user_id
    );
  end loop;

  for v_author in
    select author.id
    from public.registry_authors author
    left join editorial.person_identity_links link
      on link.registry_author_id = author.id
     and link.link_state = 'active'
    where link.id is null
    order by author.id
  loop
    perform editorial.ensure_person_for_registry_author(
      v_author.id
    );
  end loop;

  for v_contributor in
    select contributor.id
    from editorial.external_contributors contributor
    left join editorial.person_identity_links link
      on link.external_contributor_id = contributor.id
     and link.link_state = 'active'
    where link.id is null
    order by contributor.id
  loop
    perform editorial.ensure_person_for_external_contributor(
      v_contributor.id
    );
  end loop;

  if exists (
    select 1
    from public.user_profiles profile
    left join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where link.id is null
  )
     or exists (
       select 1
       from public.registry_authors author
       left join editorial.person_identity_links link
         on link.registry_author_id = author.id
        and link.link_state = 'active'
       where link.id is null
     )
     or exists (
       select 1
       from editorial.external_contributors contributor
       left join editorial.person_identity_links link
         on link.external_contributor_id = contributor.id
        and link.link_state = 'active'
       where link.id is null
     )
  then
    raise exception
      'STOP: Migration C did not complete exact-source Person adoption';
  end if;

  if (
    select count(*)
    from editorial.people
  ) <> 25
     or (
       select count(*)
       from editorial.person_identity_links
       where link_state = 'active'
     ) <> 25
  then
    raise exception
      'STOP: Migration C source adoption did not reconcile to 25 People / 25 active links';
  end if;

  if exists (
    select 1
    from public.community_follows
    where target_type = 'person'
  ) then
    raise exception
      'STOP: Migration C source adoption created Person Follow rows';
  end if;

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(follow_row)
        order by follow_row.id
      )::text,
      '[]'
    )
  )
  into v_nonperson_follow_hash_after
  from public.community_follows follow_row
  where follow_row.target_type <>
        'person';

  if v_nonperson_follow_hash_after <>
     v_nonperson_follow_hash_before
  then
    raise exception
      'STOP: Migration C changed existing non-Person Follow authority';
  end if;
end;
$people_migration_c_backfill$;

commit;

