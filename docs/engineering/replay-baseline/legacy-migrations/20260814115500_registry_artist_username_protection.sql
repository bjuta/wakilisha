-- WAKILISHA M1: protect the active Registry Artist namespace from account-handle squatting.
--
-- Contract:
-- - user/account identity and Registry Artist identity remain separate authorities;
-- - an account handle never claims or owns a Registry Artist;
-- - current account owners are never dispossessed if a future Artist collides;
-- - once an Artist-derived handle is free, it is protected for the Registry Artist namespace;
-- - ambiguous Artist-derived handles remain protected rather than becoming public squatting targets;
-- - the existing community_username_is_reserved(text) remains the single public reservation authority;
-- - M2 may later grant verified Artist representatives controlled exceptions without changing Registry ownership.

begin;

do $m1_artist_username_preflight$
declare
  v_active_artists integer;
  v_candidate_pairs integer;
  v_candidate_handles integer;
  v_ambiguous_handles integer;
  v_user_collisions integer;
  v_person_path_collisions integer;
  v_platform_overlaps integer;
  v_immediately_protectable integer;
  v_definition text;
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.community_reserved_usernames') is null
     or to_regclass('public.user_profile_username_history') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('editorial.resource_aliases') is null
  then
    raise exception
      'STOP: Required account, handle, Registry Artist, or Person-route authority is missing';
  end if;

  if to_regprocedure('public.community_normalize_username(text)') is null
     or to_regprocedure('public.community_username_is_valid(text)') is null
     or to_regprocedure('public.community_username_seed(text)') is null
     or to_regprocedure('public.community_username_is_reserved(text)') is null
     or to_regprocedure('public.community_generate_username(uuid,text,text)') is null
     or to_regprocedure('public.community_username_available(text)') is null
     or to_regprocedure('public.community_update_username(text)') is null
     or to_regprocedure('public.community_create_profile(uuid,text,text)') is null
  then
    raise exception
      'STOP: Required username function authority is missing';
  end if;

  if to_regclass('public.community_artist_username_reservations') is not null
     or to_regprocedure('editorial.username_is_registry_artist_reserved(text)') is not null
     or to_regprocedure('editorial.refresh_registry_artist_username_reservations()') is not null
     or to_regprocedure('editorial.guard_user_profile_reserved_username()') is not null
     or to_regprocedure('editorial.refresh_artist_username_reservations_trigger()') is not null
  then
    raise exception
      'STOP: Registry Artist username protection authority already exists';
  end if;

  if exists (
    select 1
    from pg_trigger trigger
    where trigger.tgname in (
      'user_profiles_reserved_username_guard',
      'registry_artists_username_reservation_refresh_insert_delete',
      'registry_artists_username_reservation_refresh_update',
      'user_profiles_username_reservation_refresh_insert_delete',
      'user_profiles_username_reservation_refresh_update'
    )
      and not trigger.tgisinternal
  ) then
    raise exception
      'STOP: Registry Artist username protection trigger already exists';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_username_is_reserved(text)'::regprocedure
    );

  if position(
       'community_reserved_usernames'
       in v_definition
     ) = 0
     or position(
       'username_is_registry_artist_reserved'
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: Existing reserved-handle authority changed after the M1 audit';
  end if;

  if position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_generate_username(uuid,text,text)'::regprocedure
       )
     ) = 0
     or position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_username_available(text)'::regprocedure
       )
     ) = 0
     or position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_update_username(text)'::regprocedure
       )
     ) = 0
     or position(
       'community_username_is_reserved'
       in pg_get_functiondef(
         'public.community_create_profile(uuid,text,text)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'STOP: One or more reviewed username writers no longer use the central reserved-handle authority';
  end if;

  with active_artists as (
    select
      artist.id,
      artist.slug,
      artist.display_name
    from public.registry_artists artist
    where artist.status = 'active'
  ),

  raw_candidates as (
    select
      artist.id as artist_id,
      candidate.source,
      candidate.priority,
      candidate.username
    from active_artists artist
    cross join lateral (
      values
        (
          'slug_exact'::text,
          1,
          case
            when public.community_username_is_valid(
              public.community_normalize_username(
                artist.slug
              )
            )
            then public.community_normalize_username(
              artist.slug
            )
            else null
          end
        ),
        (
          'slug_seed'::text,
          2,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.slug
              )
            )
            then public.community_username_seed(
              artist.slug
            )
            else null
          end
        ),
        (
          'name_seed'::text,
          3,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.display_name
              )
            )
            then public.community_username_seed(
              artist.display_name
            )
            else null
          end
        )
    ) candidate(
      source,
      priority,
      username
    )
    where candidate.username is not null
  ),

  candidate_pairs as (
    select distinct on (
      raw.artist_id,
      raw.username
    )
      raw.artist_id,
      raw.username,
      raw.source
    from raw_candidates raw
    order by
      raw.artist_id,
      raw.username,
      raw.priority
  ),

  candidate_owners as (
    select
      pair.username,
      count(distinct pair.artist_id)::integer
        as artist_count
    from candidate_pairs pair
    group by pair.username
  ),

  user_collisions as (
    select distinct pair.username
    from candidate_pairs pair
    join public.user_profiles profile
      on profile.username_normalized =
         pair.username
  ),

  person_path_collisions as (
    select distinct pair.username
    from candidate_pairs pair
    join editorial.resource_aliases alias
      on alias.path =
         '/people/' || pair.username
  ),

  platform_overlaps as (
    select distinct pair.username
    from candidate_pairs pair
    join public.community_reserved_usernames reserved
      on reserved.username =
         pair.username
  ),

  protectable as (
    select owner.username
    from candidate_owners owner
    where owner.artist_count = 1
      and not exists (
        select 1
        from user_collisions collision
        where collision.username =
              owner.username
      )
      and not exists (
        select 1
        from person_path_collisions collision
        where collision.username =
              owner.username
      )
      and not exists (
        select 1
        from platform_overlaps collision
        where collision.username =
              owner.username
      )
  )

  select
    (
      select count(*)::integer
      from active_artists
    ),
    (
      select count(*)::integer
      from candidate_pairs
    ),
    (
      select count(distinct pair.username)::integer
      from candidate_pairs pair
    ),
    (
      select count(*)::integer
      from candidate_owners owner
      where owner.artist_count > 1
    ),
    (
      select count(*)::integer
      from user_collisions
    ),
    (
      select count(*)::integer
      from person_path_collisions
    ),
    (
      select count(*)::integer
      from platform_overlaps
    ),
    (
      select count(*)::integer
      from protectable
    )
  into
    v_active_artists,
    v_candidate_pairs,
    v_candidate_handles,
    v_ambiguous_handles,
    v_user_collisions,
    v_person_path_collisions,
    v_platform_overlaps,
    v_immediately_protectable;

  if v_active_artists <> 632
     or v_candidate_pairs <> 649
     or v_candidate_handles <> 640
     or v_ambiguous_handles <> 8
     or v_user_collisions <> 0
     or v_person_path_collisions <> 0
     or v_platform_overlaps <> 1
     or v_immediately_protectable <> 632
  then
    raise exception
      'STOP: M1 namespace audit drifted: active %, pairs %, handles %, ambiguous %, user collisions %, Person collisions %, platform overlaps %, protectable %',
      v_active_artists,
      v_candidate_pairs,
      v_candidate_handles,
      v_ambiguous_handles,
      v_user_collisions,
      v_person_path_collisions,
      v_platform_overlaps,
      v_immediately_protectable;
  end if;
end;
$m1_artist_username_preflight$;


create table
  public.community_artist_username_reservations (
    username text not null,
    artist_id uuid not null
      references public.registry_artists(id)
      on delete cascade,
    source text not null
      check (
        source in (
          'slug_exact',
          'slug_seed',
          'name_seed'
        )
      ),
    created_at timestamptz not null
      default now(),
    updated_at timestamptz not null
      default now(),
    primary key (
      username,
      artist_id
    ),
    constraint
      community_artist_username_reservations_username_valid
      check (
        public.community_username_is_valid(
          username
        )
      )
  );

create index
  community_artist_username_reservations_artist_idx
on public.community_artist_username_reservations (
  artist_id,
  username
);

alter table
  public.community_artist_username_reservations
enable row level security;

revoke all on table
  public.community_artist_username_reservations
from public, anon, authenticated;

grant select on table
  public.community_artist_username_reservations
to service_role;


create or replace function
  editorial.username_is_registry_artist_reserved(
    p_username text
  )
returns boolean
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select exists (
    select 1
    from public.community_artist_username_reservations reservation
    join public.registry_artists artist
      on artist.id = reservation.artist_id
     and artist.status = 'active'
    where reservation.username =
          public.community_normalize_username(
            p_username
          )
  );
$function$;

revoke all on function
  editorial.username_is_registry_artist_reserved(text)
from public, anon, authenticated;

grant execute on function
  editorial.username_is_registry_artist_reserved(text)
to service_role;


create or replace function
  editorial.refresh_registry_artist_username_reservations()
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'pg_temp'
as $function$
declare
  v_mapping_count integer;
  v_handle_count integer;
  v_ambiguous_count integer;
  v_current_user_collision_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'community-artist-username-reservation',
      0
    )
  );

  drop table if exists
    pg_temp.wk_artist_username_candidate_refresh;

  create temporary table
    wk_artist_username_candidate_refresh (
      username text not null,
      artist_id uuid not null,
      source text not null,
      primary key (
        username,
        artist_id
      )
    )
  on commit drop;

  insert into
    wk_artist_username_candidate_refresh (
      username,
      artist_id,
      source
    )
  with raw_candidates as (
    select
      artist.id as artist_id,
      candidate.source,
      candidate.priority,
      candidate.username
    from public.registry_artists artist
    cross join lateral (
      values
        (
          'slug_exact'::text,
          1,
          case
            when public.community_username_is_valid(
              public.community_normalize_username(
                artist.slug
              )
            )
            then public.community_normalize_username(
              artist.slug
            )
            else null
          end
        ),
        (
          'slug_seed'::text,
          2,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.slug
              )
            )
            then public.community_username_seed(
              artist.slug
            )
            else null
          end
        ),
        (
          'name_seed'::text,
          3,
          case
            when public.community_username_is_valid(
              public.community_username_seed(
                artist.display_name
              )
            )
            then public.community_username_seed(
              artist.display_name
            )
            else null
          end
        )
    ) candidate(
      source,
      priority,
      username
    )
    where artist.status = 'active'
      and candidate.username is not null
  ),

  ranked as (
    select
      raw.artist_id,
      raw.username,
      raw.source,
      row_number() over (
        partition by
          raw.artist_id,
          raw.username
        order by
          raw.priority,
          raw.source
      ) as row_number
    from raw_candidates raw
  )

  select
    ranked.username,
    ranked.artist_id,
    ranked.source
  from ranked
  where ranked.row_number = 1
    and not exists (
      select 1
      from public.user_profiles profile
      where profile.username_normalized =
            ranked.username
    );

  delete from
    public.community_artist_username_reservations reservation
  where not exists (
    select 1
    from pg_temp.wk_artist_username_candidate_refresh candidate
    where candidate.username =
          reservation.username
      and candidate.artist_id =
          reservation.artist_id
  );

  insert into
    public.community_artist_username_reservations (
      username,
      artist_id,
      source
    )
  select
    candidate.username,
    candidate.artist_id,
    candidate.source
  from pg_temp.wk_artist_username_candidate_refresh candidate
  on conflict (
    username,
    artist_id
  ) do update
    set
      source = excluded.source,
      updated_at = case
        when public.community_artist_username_reservations.source
               is distinct from excluded.source
        then now()
        else public.community_artist_username_reservations.updated_at
      end;

  select
    count(*)::integer,
    count(distinct reservation.username)::integer
  into
    v_mapping_count,
    v_handle_count
  from public.community_artist_username_reservations reservation;

  select count(*)::integer
  into v_ambiguous_count
  from (
    select reservation.username
    from public.community_artist_username_reservations reservation
    group by reservation.username
    having count(distinct reservation.artist_id) > 1
  ) ambiguous;

  select count(*)::integer
  into v_current_user_collision_count
  from public.community_artist_username_reservations reservation
  join public.user_profiles profile
    on profile.username_normalized =
       reservation.username;

  return jsonb_build_object(
    'mapping_count',
      v_mapping_count,
    'protected_handle_count',
      v_handle_count,
    'ambiguous_handle_count',
      v_ambiguous_count,
    'current_user_collision_count',
      v_current_user_collision_count
  );
end;
$function$;

revoke all on function
  editorial.refresh_registry_artist_username_reservations()
from public, anon, authenticated;

grant execute on function
  editorial.refresh_registry_artist_username_reservations()
to service_role;


select
  editorial.refresh_registry_artist_username_reservations();


create or replace function
  public.community_username_is_reserved(
    p_username text
  )
returns boolean
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select
    exists (
      select 1
      from public.community_reserved_usernames reserved
      where reserved.username =
            public.community_normalize_username(
              p_username
            )
    )
    or editorial.username_is_registry_artist_reserved(
      p_username
    );
$function$;


create or replace function
  editorial.guard_user_profile_reserved_username()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
begin
  if new.username_normalized is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.username_normalized
         is not distinct from
         new.username_normalized
  then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'community-artist-username-reservation',
      0
    )
  );

  if public.community_username_is_reserved(
       new.username_normalized
     )
  then
    raise exception
      using
        errcode = '23505',
        message = format(
          'Handle %s is reserved.',
          new.username_normalized
        );
  end if;

  return new;
end;
$function$;

revoke all on function
  editorial.guard_user_profile_reserved_username()
from public, anon, authenticated, service_role;


create trigger
  user_profiles_reserved_username_guard
before insert or update
on public.user_profiles
for each row
execute function
  editorial.guard_user_profile_reserved_username();


create or replace function
  editorial.refresh_artist_username_reservations_trigger()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
begin
  perform
    editorial.refresh_registry_artist_username_reservations();

  return null;
end;
$function$;

revoke all on function
  editorial.refresh_artist_username_reservations_trigger()
from public, anon, authenticated, service_role;


create trigger
  registry_artists_username_reservation_refresh_insert_delete
after insert or delete
on public.registry_artists
for each statement
execute function
  editorial.refresh_artist_username_reservations_trigger();

create trigger
  registry_artists_username_reservation_refresh_update
after update of
  status,
  slug,
  display_name
on public.registry_artists
for each statement
execute function
  editorial.refresh_artist_username_reservations_trigger();

create trigger
  user_profiles_username_reservation_refresh_insert_delete
after insert or delete
on public.user_profiles
for each statement
execute function
  editorial.refresh_artist_username_reservations_trigger();

create trigger
  user_profiles_username_reservation_refresh_update
after update of
  username_normalized
on public.user_profiles
for each statement
execute function
  editorial.refresh_artist_username_reservations_trigger();


do $m1_artist_username_postflight$
declare
  v_mapping_count integer;
  v_handle_count integer;
  v_ambiguous_count integer;
  v_user_collision_count integer;
begin
  select count(*)::integer
  into v_mapping_count
  from public.community_artist_username_reservations;

  select count(distinct username)::integer
  into v_handle_count
  from public.community_artist_username_reservations;

  select count(*)::integer
  into v_ambiguous_count
  from (
    select username
    from public.community_artist_username_reservations
    group by username
    having count(distinct artist_id) > 1
  ) ambiguous;

  select count(*)::integer
  into v_user_collision_count
  from public.community_artist_username_reservations reservation
  join public.user_profiles profile
    on profile.username_normalized =
       reservation.username;

  if v_mapping_count <> 649
     or v_handle_count <> 640
     or v_ambiguous_count <> 8
     or v_user_collision_count <> 0
  then
    raise exception
      'STOP: M1 reservation postflight failed: mappings %, handles %, ambiguous %, user collisions %',
      v_mapping_count,
      v_handle_count,
      v_ambiguous_count,
      v_user_collision_count;
  end if;

  if not public.community_username_is_reserved(
       'dylan_s'
     )
  then
    raise exception
      'STOP: Known ambiguous Registry Artist handle is not protected';
  end if;

  if not public.community_username_is_reserved(
       'user'
     )
  then
    raise exception
      'STOP: Existing platform reservation authority was lost';
  end if;
end;
$m1_artist_username_postflight$;

commit;
