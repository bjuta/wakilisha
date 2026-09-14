begin;

-- Phase 9A.3 Release community identity convergence.
-- Release slugs are Artist-scoped presentation identity. Community thread
-- ownership is the canonical Registry Release UUID.

do $preflight$
begin
  if to_regclass('public.community_threads') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_release_artists') is null then
    raise exception 'STOP: Release community identity dependencies are missing';
  end if;

  if to_regprocedure(
       'public.community_get_thread_by_entity(text,text,text)'
     ) is null
     or to_regprocedure(
       'public.community_get_or_create_thread(text,text,text,text,text)'
     ) is null then
    raise exception 'STOP: Community thread RPC authority is missing';
  end if;
end;
$preflight$;

-- Track and Release slugs are scoped identities and may repeat across routes.
drop index if exists public.community_threads_non_track_entity_slug_key;

create unique index if not exists
  community_threads_non_track_release_entity_slug_key
on public.community_threads (entity_type, entity_slug)
where entity_type not in ('track', 'release')
  and entity_slug is not null;

create temp table wk_release_thread_identity_plan
on commit drop
as
with release_threads as (
  select
    thread.id as thread_id,
    thread.entity_id,
    thread.entity_slug,
    thread.entity_url,
    substring(
      regexp_replace(
        split_part(
          coalesce(thread.entity_url, ''),
          '?',
          1
        ),
        '/+$',
        ''
      )
      from '(/releases/[^/?#]+/[^/?#]+)$'
    ) as route_path
  from public.community_threads thread
  where thread.entity_type = 'release'
),
route_candidates as (
  select distinct
    thread.thread_id,
    release.id as release_id,
    credit.artist_slug
  from release_threads thread
  join public.registry_release_artists credit
    on credit.status = 'active'
   and credit.is_primary is true
  join public.registry_releases release
    on release.id = credit.release_id
   and release.status = 'active'
  where thread.route_path =
    '/releases/' ||
    credit.artist_slug ||
    '/' ||
    release.slug
),
route_unique as (
  select
    candidate.thread_id,
    min(candidate.release_id::text)::uuid as release_id,
    min(candidate.artist_slug) as artist_slug
  from route_candidates candidate
  group by candidate.thread_id
  having count(distinct candidate.release_id) = 1
),
unresolved as (
  select thread.*
  from release_threads thread
  left join route_unique resolved
    on resolved.thread_id = thread.thread_id
  where resolved.thread_id is null
),
slug_candidates as (
  select
    thread.thread_id,
    release.id as release_id
  from unresolved thread
  join public.registry_releases release
    on release.status = 'active'
   and release.slug = coalesce(
     nullif(thread.entity_slug, ''),
     nullif(thread.entity_id, '')
   )
),
slug_unique as (
  select
    candidate.thread_id,
    min(candidate.release_id::text)::uuid as release_id
  from slug_candidates candidate
  group by candidate.thread_id
  having count(distinct candidate.release_id) = 1
),
chosen as (
  select
    resolved.thread_id,
    resolved.release_id,
    resolved.artist_slug,
    'route'::text as resolution_kind
  from route_unique resolved

  union all

  select
    resolved.thread_id,
    resolved.release_id,
    null::text as artist_slug,
    'globally_unique_slug'::text as resolution_kind
  from slug_unique resolved
),
canonical as (
  select
    chosen.thread_id,
    chosen.release_id,
    release.slug as release_slug,
    coalesce(
      chosen.artist_slug,
      primary_artist.artist_slug
    ) as artist_slug,
    chosen.resolution_kind
  from chosen
  join public.registry_releases release
    on release.id = chosen.release_id
   and release.status = 'active'
  left join lateral (
    select credit.artist_slug
    from public.registry_release_artists credit
    where credit.release_id = chosen.release_id
      and credit.status = 'active'
      and credit.is_primary is true
      and nullif(btrim(credit.artist_slug), '') is not null
    order by
      credit.credit_order nulls last,
      credit.created_at,
      credit.id
    limit 1
  ) primary_artist on true
)
select
  canonical.thread_id,
  canonical.release_id,
  canonical.release_slug,
  canonical.artist_slug,
  canonical.resolution_kind,
  'https://wakilisha.africa/releases/' ||
    canonical.artist_slug ||
    '/' ||
    canonical.release_slug as canonical_url
from canonical;

do $resolution_gate$
declare
  v_threads bigint;
  v_plan bigint;
  v_duplicates bigint;
begin
  select count(*)
  into v_threads
  from public.community_threads
  where entity_type = 'release';

  select count(*)
  into v_plan
  from wk_release_thread_identity_plan;

  if v_plan <> v_threads then
    raise exception
      'STOP: Release thread identity plan resolved % of % rows',
      v_plan,
      v_threads;
  end if;

  if exists (
    select 1
    from wk_release_thread_identity_plan
    where release_id is null
       or release_slug is null
       or artist_slug is null
       or canonical_url is null
  ) then
    raise exception 'STOP: Release thread identity plan is incomplete';
  end if;

  select count(*)
  into v_duplicates
  from (
    select release_id
    from wk_release_thread_identity_plan
    group by release_id
    having count(*) > 1
  ) duplicate_owner;

  if v_duplicates <> 0 then
    raise exception
      'STOP: Multiple community threads resolve to the same Release UUID: %',
      v_duplicates;
  end if;
end;
$resolution_gate$;

update public.community_threads thread
set
  entity_id = plan.release_id::text,
  entity_slug = plan.release_slug,
  entity_url = plan.canonical_url,
  updated_at = now()
from wk_release_thread_identity_plan plan
where thread.id = plan.thread_id
  and thread.entity_type = 'release';

do $backfill_gate$
declare
  v_bad bigint;
begin
  select count(*)
  into v_bad
  from public.community_threads thread
  left join public.registry_releases release
    on release.id::text = thread.entity_id
   and release.status = 'active'
  where thread.entity_type = 'release'
    and release.id is null;

  if v_bad <> 0 then
    raise exception
      'STOP: Release threads without canonical Registry UUID after backfill: %',
      v_bad;
  end if;
end;
$backfill_gate$;

create or replace function public.community_get_thread_by_entity(
  p_entity_type text,
  p_entity_id text default null,
  p_entity_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_entity_type text :=
    nullif(trim(coalesce(p_entity_type, '')), '');
  v_entity_id text :=
    nullif(trim(coalesce(p_entity_id, '')), '');
  v_entity_slug text :=
    nullif(trim(coalesce(p_entity_slug, '')), '');
  v_track_id uuid;
  v_release_id uuid;
  v_release_match_count integer := 0;
  v_thread public.community_threads%rowtype;
begin
  if v_entity_type is null then
    return null;
  end if;

  if lower(v_entity_type) = 'track'
     and v_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select track.id
    into v_track_id
    from public.registry_tracks track
    where track.id = v_entity_id::uuid
      and track.status = 'active'
      and (
        v_entity_slug is null
        or track.slug = v_entity_slug
      )
    limit 1;

    if v_track_id is not null then
      select *
      into v_thread
      from public.community_threads thread
      where thread.entity_type = 'track'
        and thread.entity_id = v_track_id::text
      order by thread.created_at, thread.id
      limit 1;

      if found then
        return to_jsonb(v_thread);
      end if;

      -- Do not guess a legacy slug owner here. get-or-create has the full
      -- Artist-scoped URL and can bind an exact legacy route safely.
      return null;
    end if;
  end if;

  if lower(v_entity_type) = 'release' then
    if v_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select release.id
      into v_release_id
      from public.registry_releases release
      where release.id = v_entity_id::uuid
        and release.status = 'active'
        and (
          v_entity_slug is null
          or release.slug = v_entity_slug
        )
      limit 1;

      if v_release_id is null then
        return null;
      end if;
    else
      select
        min(release.id::text)::uuid,
        count(distinct release.id)::integer
      into
        v_release_id,
        v_release_match_count
      from public.registry_releases release
      where release.status = 'active'
        and release.slug = coalesce(
          v_entity_slug,
          v_entity_id
        );

      if v_release_match_count <> 1
         or v_release_id is null then
        -- A Release slug can repeat under different Artist route scopes.
        -- get-or-create has the full URL and owns exact route resolution.
        return null;
      end if;
    end if;

    select *
    into v_thread
    from public.community_threads thread
    where thread.entity_type = 'release'
      and thread.entity_id = v_release_id::text
    order by thread.created_at, thread.id
    limit 1;

    return case
      when v_thread.id is null then null
      else to_jsonb(v_thread)
    end;
  end if;

  select *
  into v_thread
  from public.community_threads thread
  where thread.entity_type = v_entity_type
    and (
      v_entity_id is null
      or thread.entity_id = v_entity_id
    )
    and (
      v_entity_slug is null
      or thread.entity_slug = v_entity_slug
    )
  order by thread.created_at, thread.id
  limit 1;

  return case
    when v_thread.id is null then null
    else to_jsonb(v_thread)
  end;
end;
$function$;


create or replace function public.community_get_or_create_thread(
  p_entity_type text,
  p_entity_id text default null,
  p_entity_slug text default null,
  p_entity_url text default null,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_thread public.community_threads%rowtype;
  v_created boolean := false;
  v_entity_type text :=
    nullif(trim(coalesce(p_entity_type, '')), '');
  v_entity_id text :=
    nullif(trim(coalesce(p_entity_id, '')), '');
  v_entity_slug text :=
    nullif(trim(coalesce(p_entity_slug, '')), '');
  v_entity_url text :=
    nullif(trim(coalesce(p_entity_url, '')), '');
  v_entity_path text;
  v_title text :=
    nullif(trim(coalesce(p_title, '')), '');
  v_lock_key text;
  v_canonical_track_id uuid;
  v_canonical_release_id uuid;
  v_canonical_release_slug text;
  v_canonical_release_artist_slug text;
  v_release_match_count integer := 0;
  v_release_path text;
  v_legacy_thread_id uuid;
  v_legacy_count integer := 0;
begin
  if current_user <> 'service_role'
     and auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if v_entity_type is null then
    raise exception 'Entity type is required'
      using errcode = '22023';
  end if;

  if v_entity_id is null
     and v_entity_slug is null
     and v_entity_url is null then
    raise exception 'Entity id, slug, or URL is required'
      using errcode = '22023';
  end if;

  v_entity_path :=
    regexp_replace(
      regexp_replace(
        split_part(coalesce(v_entity_url, ''), '?', 1),
        '^https?://(www\.)?wakilisha\.africa',
        '',
        'i'
      ),
      '/+$',
      ''
    );

  v_release_path :=
    substring(
      regexp_replace(
        split_part(
          coalesce(v_entity_url, ''),
          '?',
          1
        ),
        '/+$',
        ''
      )
      from '(/releases/[^/?#]+/[^/?#]+)$'
    );

  if lower(v_entity_type) = 'track'
     and v_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select track.id
    into v_canonical_track_id
    from public.registry_tracks track
    where track.id = v_entity_id::uuid
      and track.status = 'active'
      and (
        v_entity_slug is null
        or track.slug = v_entity_slug
      )
      and (
        v_entity_path = ''
        or exists (
          select 1
          from public.registry_track_artists credit
          where credit.track_id = track.id
            and credit.status = 'active'
            and credit.is_primary is true
            and nullif(
              btrim(credit.artist_slug),
              ''
            ) is not null
            and v_entity_path =
              '/tracks/' ||
              credit.artist_slug ||
              '/' ||
              track.slug
        )
      )
    limit 1;
  end if;

  if lower(v_entity_type) = 'track'
     and v_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and v_canonical_track_id is null
  then
    raise exception
      'Canonical Registry Track identity does not match the supplied Track route'
      using errcode = '22023';
  end if;

  if v_canonical_track_id is not null then
    v_lock_key :=
      'track:' ||
      v_canonical_track_id::text;

    perform pg_advisory_xact_lock(
      hashtextextended(
        v_lock_key,
        20260901
      )
    );

    select *
    into v_thread
    from public.community_threads thread
    where thread.entity_type = 'track'
      and thread.entity_id =
        v_canonical_track_id::text
    order by thread.created_at, thread.id
    limit 1;

    if found then
      return jsonb_build_object(
        'thread',
        to_jsonb(v_thread),
        'created',
        false
      );
    end if;

    if v_entity_path <> '' then
      select
        count(*)::integer,
        min(thread.id::text)::uuid
      into
        v_legacy_count,
        v_legacy_thread_id
      from public.community_threads thread
      where thread.entity_type = 'track'
        and regexp_replace(
          regexp_replace(
            split_part(
              coalesce(thread.entity_url, ''),
              '?',
              1
            ),
            '^https?://(www\.)?wakilisha\.africa',
            '',
            'i'
          ),
          '/+$',
          ''
        ) = v_entity_path
        and not exists (
          select 1
          from public.registry_tracks claimed_track
          where claimed_track.id::text =
            thread.entity_id
            and claimed_track.id <>
              v_canonical_track_id
        );
    end if;

    if v_legacy_count = 1
       and v_legacy_thread_id is not null then
      update public.community_threads thread
      set
        entity_id =
          v_canonical_track_id::text,
        updated_at = now()
      where thread.id = v_legacy_thread_id
        and thread.entity_type = 'track'
      returning *
      into v_thread;

      if found then
        return jsonb_build_object(
          'thread',
          to_jsonb(v_thread),
          'created',
          false
        );
      end if;
    end if;

    begin
      insert into public.community_threads (
        entity_type,
        entity_id,
        entity_slug,
        entity_url,
        title,
        status
      )
      values (
        'track',
        v_canonical_track_id::text,
        v_entity_slug,
        v_entity_url,
        coalesce(
          v_title,
          v_entity_slug,
          v_canonical_track_id::text,
          'track'
        ),
        'open'
      )
      returning *
      into v_thread;

      v_created := true;
    exception
      when unique_violation then
        select *
        into v_thread
        from public.community_threads thread
        where thread.entity_type = 'track'
          and thread.entity_id =
            v_canonical_track_id::text
        order by thread.created_at, thread.id
        limit 1;

        v_created := false;
    end;

    if v_thread.id is null then
      raise exception 'Could not resolve canonical Track community thread'
        using errcode = 'P0002';
    end if;

    return jsonb_build_object(
      'thread',
      to_jsonb(v_thread),
      'created',
      v_created
    );
  end if;

  if lower(v_entity_type) = 'release' then
    v_release_match_count := 0;
    v_canonical_release_id := null;

    if v_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select release.id
      into v_canonical_release_id
      from public.registry_releases release
      where release.id = v_entity_id::uuid
        and release.status = 'active'
        and (
          v_entity_slug is null
          or release.slug = v_entity_slug
        )
        and (
          v_release_path is null
          or exists (
            select 1
            from public.registry_release_artists credit
            where credit.release_id = release.id
              and credit.status = 'active'
              and credit.is_primary is true
              and v_release_path =
                '/releases/' ||
                credit.artist_slug ||
                '/' ||
                release.slug
          )
        )
      limit 1;

      if v_canonical_release_id is null then
        raise exception
          'Canonical Registry Release identity does not match the supplied Release route'
          using errcode = '22023';
      end if;
    else
      if v_release_path is not null then
        select
          min(release.id::text)::uuid,
          count(distinct release.id)::integer
        into
          v_canonical_release_id,
          v_release_match_count
        from public.registry_releases release
        join public.registry_release_artists credit
          on credit.release_id = release.id
         and credit.status = 'active'
         and credit.is_primary is true
        where release.status = 'active'
          and v_release_path =
            '/releases/' ||
            credit.artist_slug ||
            '/' ||
            release.slug
          and (
            v_entity_slug is null
            or release.slug = v_entity_slug
          );
      end if;

      if v_release_match_count <> 1
         or v_canonical_release_id is null then
        select
          min(release.id::text)::uuid,
          count(distinct release.id)::integer
        into
          v_canonical_release_id,
          v_release_match_count
        from public.registry_releases release
        where release.status = 'active'
          and release.slug = coalesce(
            v_entity_slug,
            v_entity_id
          );
      end if;

      if v_release_match_count <> 1
         or v_canonical_release_id is null then
        raise exception
          'Could not resolve canonical Registry Release identity'
          using errcode = '22023';
      end if;
    end if;

    select
      release.slug,
      primary_artist.artist_slug
    into
      v_canonical_release_slug,
      v_canonical_release_artist_slug
    from public.registry_releases release
    join lateral (
      select credit.artist_slug
      from public.registry_release_artists credit
      where credit.release_id = release.id
        and credit.status = 'active'
        and credit.is_primary is true
        and nullif(btrim(credit.artist_slug), '') is not null
      order by
        credit.credit_order nulls last,
        credit.created_at,
        credit.id
      limit 1
    ) primary_artist on true
    where release.id = v_canonical_release_id
      and release.status = 'active';

    if v_canonical_release_slug is null
       or v_canonical_release_artist_slug is null then
      raise exception
        'Canonical Registry Release route authority is incomplete'
        using errcode = '22023';
    end if;

    v_lock_key :=
      'release:' ||
      v_canonical_release_id::text;

    perform pg_advisory_xact_lock(
      hashtextextended(
        v_lock_key,
        20260914
      )
    );

    select *
    into v_thread
    from public.community_threads thread
    where thread.entity_type = 'release'
      and thread.entity_id =
        v_canonical_release_id::text
    order by thread.created_at, thread.id
    limit 1;

    if found then
      update public.community_threads thread
      set
        entity_slug = v_canonical_release_slug,
        entity_url =
          'https://wakilisha.africa/releases/' ||
          v_canonical_release_artist_slug ||
          '/' ||
          v_canonical_release_slug,
        title = coalesce(v_title, thread.title),
        updated_at = now()
      where thread.id = v_thread.id
      returning *
      into v_thread;

      return jsonb_build_object(
        'thread',
        to_jsonb(v_thread),
        'created',
        false
      );
    end if;

    v_legacy_count := 0;
    v_legacy_thread_id := null;

    if v_release_path is not null then
      select
        count(*)::integer,
        min(thread.id::text)::uuid
      into
        v_legacy_count,
        v_legacy_thread_id
      from public.community_threads thread
      where thread.entity_type = 'release'
        and substring(
          regexp_replace(
            split_part(
              coalesce(thread.entity_url, ''),
              '?',
              1
            ),
            '/+$',
            ''
          )
          from '(/releases/[^/?#]+/[^/?#]+)$'
        ) = v_release_path
        and not exists (
          select 1
          from public.registry_releases claimed_release
          where claimed_release.id::text = thread.entity_id
            and claimed_release.id <>
              v_canonical_release_id
        );
    end if;

    if v_legacy_count = 0
       and v_release_match_count = 1 then
      select
        count(*)::integer,
        min(thread.id::text)::uuid
      into
        v_legacy_count,
        v_legacy_thread_id
      from public.community_threads thread
      where thread.entity_type = 'release'
        and thread.entity_slug =
          v_canonical_release_slug
        and not exists (
          select 1
          from public.registry_releases claimed_release
          where claimed_release.id::text = thread.entity_id
            and claimed_release.id <>
              v_canonical_release_id
        );
    end if;

    if v_legacy_count = 1
       and v_legacy_thread_id is not null then
      update public.community_threads thread
      set
        entity_id =
          v_canonical_release_id::text,
        entity_slug =
          v_canonical_release_slug,
        entity_url =
          'https://wakilisha.africa/releases/' ||
          v_canonical_release_artist_slug ||
          '/' ||
          v_canonical_release_slug,
        title = coalesce(v_title, thread.title),
        updated_at = now()
      where thread.id = v_legacy_thread_id
        and thread.entity_type = 'release'
      returning *
      into v_thread;

      if found then
        return jsonb_build_object(
          'thread',
          to_jsonb(v_thread),
          'created',
          false
        );
      end if;
    end if;

    begin
      insert into public.community_threads (
        entity_type,
        entity_id,
        entity_slug,
        entity_url,
        title,
        status
      )
      values (
        'release',
        v_canonical_release_id::text,
        v_canonical_release_slug,
        'https://wakilisha.africa/releases/' ||
          v_canonical_release_artist_slug ||
          '/' ||
          v_canonical_release_slug,
        coalesce(
          v_title,
          v_canonical_release_slug,
          v_canonical_release_id::text,
          'release'
        ),
        'open'
      )
      returning *
      into v_thread;

      v_created := true;
    exception
      when unique_violation then
        select *
        into v_thread
        from public.community_threads thread
        where thread.entity_type = 'release'
          and thread.entity_id =
            v_canonical_release_id::text
        order by thread.created_at, thread.id
        limit 1;

        v_created := false;
    end;

    if v_thread.id is null then
      raise exception
        'Could not resolve canonical Release community thread'
        using errcode = 'P0002';
    end if;

    return jsonb_build_object(
      'thread',
      to_jsonb(v_thread),
      'created',
      v_created
    );
  end if;

  -- Compatibility path for entities without canonical Registry identity.
  v_lock_key :=
    lower(v_entity_type) ||
    ':' ||
    coalesce(v_entity_id, '') ||
    ':' ||
    coalesce(v_entity_slug, '') ||
    ':' ||
    coalesce(v_entity_url, '');

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_lock_key,
      20260624
    )
  );

  select *
  into v_thread
  from public.community_threads thread
  where thread.entity_type = v_entity_type
    and (
      (v_entity_id is not null
       and thread.entity_id = v_entity_id)
      or (v_entity_slug is not null
          and thread.entity_slug = v_entity_slug)
      or (v_entity_url is not null
          and thread.entity_url = v_entity_url)
    )
  order by thread.created_at, thread.id
  limit 1;

  if not found then
    begin
      insert into public.community_threads (
        entity_type,
        entity_id,
        entity_slug,
        entity_url,
        title,
        status
      )
      values (
        v_entity_type,
        v_entity_id,
        v_entity_slug,
        v_entity_url,
        coalesce(
          v_title,
          v_entity_slug,
          v_entity_id,
          v_entity_type
        ),
        'open'
      )
      returning *
      into v_thread;

      v_created := true;
    exception
      when unique_violation then
        select *
        into v_thread
        from public.community_threads thread
        where thread.entity_type = v_entity_type
          and (
            (v_entity_id is not null
             and thread.entity_id = v_entity_id)
            or (v_entity_slug is not null
                and thread.entity_slug = v_entity_slug)
            or (v_entity_url is not null
                and thread.entity_url = v_entity_url)
          )
        order by thread.created_at, thread.id
        limit 1;

        v_created := false;
    end;
  end if;

  if v_thread.id is null then
    raise exception 'Could not resolve community thread'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'thread',
    to_jsonb(v_thread),
    'created',
    v_created
  );
end;
$function$;


revoke all
on function public.community_get_thread_by_entity(text, text, text)
from public;

grant execute
on function public.community_get_thread_by_entity(text, text, text)
to anon, authenticated, service_role;

revoke all
on function public.community_get_or_create_thread(text, text, text, text, text)
from public, anon;

grant execute
on function public.community_get_or_create_thread(text, text, text, text, text)
to authenticated, service_role;

comment on index public.community_threads_non_track_release_entity_slug_key is
  'Entities other than Tracks and Releases retain global slug uniqueness. Track and Release discussion ownership uses canonical Registry UUID identity because public slugs are route-scoped.';

comment on function public.community_get_thread_by_entity(text, text, text) is
  'Reads Track and Release discussions by canonical Registry UUID when available. Release slug-only compatibility resolves only globally unique active slugs; Artist-scoped ambiguity is delegated to the URL-aware get-or-create command.';

comment on function public.community_get_or_create_thread(text, text, text, text, text) is
  'Creates Track and Release discussions by canonical Registry UUID. Artist-scoped public routes prove Release ownership, and exact legacy route rows are bound in place rather than duplicated.';

commit;
