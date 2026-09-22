-- MIZIZI Release slug resume integrity.
--
-- The first governed #1013 Release-slug apply accepted 731 of 737 frozen
-- candidates, then correctly failed closed with six stale rows. The stale rows
-- are the second members of six same-Artist/base collision pairs. The first
-- member in each pair had already moved from provider-packaged identity to its
-- frozen release-date fallback, which made the dynamic planner forget that the
-- remaining sibling still belongs to the same collision family.
--
-- This forward repair makes date-fallback planning monotonic only when current
-- Registry state is backed by an accepted MIZIZI canonical-write event from
-- this exact planner. It does not treat arbitrary date-looking slugs as
-- authority and it creates no new mutation capability.

begin;

do $preflight$
begin
  if to_regprocedure(
       'mizizi_private.release_slug_plan_v1(uuid)'
     ) is null
  then
    raise exception
      'STOP: Release slug planner dependency is missing';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260922143000'
      and name='mizizi_url_identity_authority_window_close_v1'
  ) then
    raise exception
      'STOP: URL-identity authority-window close migration is required';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  ) then
    raise exception
      'STOP: Release slug resume integrity requires zero active MIZIZI standing authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
      and revoked_at is null
  ) then
    raise exception
      'STOP: Release slug resume integrity requires zero active MIZIZI exact authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.release_slug.canonicalize'
      and operation_version=1
      and enabled
  ) then
    raise exception
      'STOP: Release slug operation must be disabled before planner replacement';
  end if;
end
$preflight$;

create or replace function mizizi_private.release_slug_plan_v1(
  p_release_id uuid
)
returns table (
  release_id uuid,
  artist_id uuid,
  artist_slug text,
  current_slug text,
  base_slug text,
  proposed_slug text,
  uses_date_fallback boolean,
  expected_state_fingerprint text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_release public.registry_releases%rowtype;
  v_artist_id uuid;
  v_artist_slug text;
  v_packaging_type text;
  v_base_slug text;
  v_candidate_count integer;
  v_existing_clean_conflict boolean;
  v_prior_mizizi_date_fallback boolean;
  v_planned_slug text;
  v_uses_date_fallback boolean;
begin
  perform mizizi_private.assert_executor_v1();

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=p_release_id
    and release.status='active';

  if not found then
    raise exception using errcode='P0002',
      message='Active Registry Release not found.';
  end if;

  v_packaging_type :=
    lower(
      coalesce(
        substring(
          v_release.slug
          from '-(single|ep|album)$'
        ),
        ''
      )
    );

  if v_packaging_type=''
     or not (
       mizizi_private.normalize_identity_text_v1(v_release.title)
       ~* (
         '[[:space:]]+-[[:space:]]+' ||
         v_packaging_type ||
         '$'
       )
     )
  then
    raise exception using errcode='42501',
      message='Release is not an eligible provider-packaging slug target.';
  end if;

  v_base_slug :=
    regexp_replace(
      v_release.slug,
      '-(single|ep|album)$',
      '',
      'i'
    );

  select credit.artist_id,credit.artist_slug
  into v_artist_id,v_artist_slug
  from public.registry_release_artists credit
  where credit.release_id=v_release.id
    and credit.status='active'
    and credit.is_primary is true
    and credit.artist_id is not null
    and nullif(btrim(credit.artist_slug),'') is not null
  order by
    credit.credit_order nulls last,
    credit.created_at,
    credit.id
  limit 1;

  if v_artist_id is null
     or nullif(v_artist_slug,'') is null
     or nullif(v_base_slug,'') is null
  then
    raise exception using errcode='42501',
      message='Release slug plan is missing exact primary-Artist scope.';
  end if;

  select count(*)::integer
  into v_candidate_count
  from public.registry_releases candidate
  join public.registry_release_artists candidate_credit
    on candidate_credit.release_id=candidate.id
   and candidate_credit.status='active'
   and candidate_credit.is_primary is true
  where candidate.status='active'
    and candidate_credit.artist_id=v_artist_id
    and regexp_replace(
      candidate.slug,
      '-(single|ep|album)$',
      '',
      'i'
    )=v_base_slug
    and (
      (
        candidate.slug ~* '-single$'
        and candidate.title ~*
          '[[:space:]]+-[[:space:]]+single$'
      )
      or (
        candidate.slug ~* '-ep$'
        and candidate.title ~*
          '[[:space:]]+-[[:space:]]+ep$'
      )
      or (
        candidate.slug ~* '-album$'
        and candidate.title ~*
          '[[:space:]]+-[[:space:]]+album$'
      )
    );

  select exists (
    select 1
    from public.registry_releases other
    join public.registry_release_artists other_credit
      on other_credit.release_id=other.id
     and other_credit.status='active'
     and other_credit.is_primary is true
    where other.status='active'
      and other.id<>v_release.id
      and other_credit.artist_id=v_artist_id
      and other.slug=v_base_slug
  )
  into v_existing_clean_conflict;

  select exists (
    select 1
    from public.registry_releases other
    join public.registry_release_artists other_credit
      on other_credit.release_id=other.id
     and other_credit.status='active'
     and other_credit.is_primary is true
    join public.registry_canonical_write_events event
      on event.registry_entity_type='release'
     and event.registry_entity_id=other.id::text
     and event.field_name='slug'
     and event.target_path='public.registry_releases.slug'
     and event.action='canonicalize_release_slug'
     and event.status='succeeded'
     and event.actor='system:mizizi'
     and event.source_table='mizizi_private.release_slug_plan_v1'
     and regexp_replace(
           coalesce(event.before_value->>'value',''),
           '-(single|ep|album)$',
           '',
           'i'
         )=v_base_slug
     and event.after_value->>'value'=other.slug
    where other.status='active'
      and other.id<>v_release.id
      and other_credit.artist_id=v_artist_id
      and other.release_date is not null
      and other.slug=
        v_base_slug ||
        '-' ||
        to_char(other.release_date,'YYYY-MM-DD')
  )
  into v_prior_mizizi_date_fallback;

  v_uses_date_fallback :=
    v_candidate_count>1
    or v_existing_clean_conflict
    or v_prior_mizizi_date_fallback;

  if not v_uses_date_fallback then
    v_planned_slug := v_base_slug;
  elsif v_release.release_date is not null then
    v_planned_slug :=
      v_base_slug ||
      '-' ||
      to_char(v_release.release_date,'YYYY-MM-DD');
  else
    raise exception using errcode='40001',
      message='Release slug collision requires a Release date fallback.';
  end if;

  if exists (
    select 1
    from public.registry_releases other
    join public.registry_release_artists other_credit
      on other_credit.release_id=other.id
     and other_credit.status='active'
     and other_credit.is_primary is true
    where other.status='active'
      and other.id<>v_release.id
      and other_credit.artist_id=v_artist_id
      and other.slug=v_planned_slug
  ) then
    raise exception using errcode='40001',
      message='Release slug plan collides with a current Release slug.';
  end if;

  if v_uses_date_fallback
     and exists (
       select 1
       from public.registry_releases other
       join public.registry_release_artists other_credit
         on other_credit.release_id=other.id
        and other_credit.status='active'
        and other_credit.is_primary is true
       where other.status='active'
         and other.id<>v_release.id
         and other_credit.artist_id=v_artist_id
         and other.release_date=v_release.release_date
         and regexp_replace(
           other.slug,
           '-(single|ep|album)$',
           '',
           'i'
         )=v_base_slug
         and (
           (
             other.slug ~* '-single$'
             and other.title ~*
               '[[:space:]]+-[[:space:]]+single$'
           )
           or (
             other.slug ~* '-ep$'
             and other.title ~*
               '[[:space:]]+-[[:space:]]+ep$'
           )
           or (
             other.slug ~* '-album$'
             and other.title ~*
               '[[:space:]]+-[[:space:]]+album$'
           )
         )
     )
  then
    raise exception using errcode='40001',
      message='Release slug date fallback is not unique inside the Artist scope.';
  end if;

  release_id := v_release.id;
  artist_id := v_artist_id;
  artist_slug := v_artist_slug;
  current_slug := v_release.slug;
  base_slug := v_base_slug;
  proposed_slug := v_planned_slug;
  uses_date_fallback := v_uses_date_fallback;
  expected_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'release',
      v_release.id
    );
  return next;
end
$$;

revoke all on function
  mizizi_private.release_slug_plan_v1(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.release_slug_plan_v1(uuid)
to mizizi_executor;

do $postflight$
declare
  v_def text;
begin
  select pg_get_functiondef(
    'mizizi_private.release_slug_plan_v1(uuid)'::regprocedure
  )
  into v_def;

  if position(
       'registry_canonical_write_events'
       in v_def
     )=0
     or position(
       'canonicalize_release_slug'
       in v_def
     )=0
     or position(
       'system:mizizi'
       in v_def
     )=0
     or position(
       'mizizi_private.release_slug_plan_v1'
       in v_def
     )=0
     or position(
       'v_prior_mizizi_date_fallback'
       in v_def
     )=0
  then
    raise exception
      'STOP: Release slug planner does not preserve accepted MIZIZI date-fallback provenance';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Release slug planner privileges drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  )
  or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
      and revoked_at is null
  )
  or exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.release_slug.canonicalize'
      and operation_version=1
      and enabled
  ) then
    raise exception
      'STOP: Release slug resume integrity changed zero-at-rest authority';
  end if;
end
$postflight$;

commit;
