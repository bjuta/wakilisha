begin;

do $preflight$
begin
  if to_regclass('public.community_threads') is null then
    raise exception 'STOP: public.community_threads is missing';
  end if;

  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null then
    raise exception 'STOP: Registry Track authority is missing';
  end if;

  if to_regclass('public.wk_slug_redirects') is null then
    raise exception 'STOP: public.wk_slug_redirects is missing';
  end if;
end;
$preflight$;

-- Track discussion identity is the canonical Registry Track UUID.
-- Slug remains presentation/compatibility data and may legitimately repeat
-- under different Artist route scopes.
alter table public.community_threads
  drop constraint if exists community_threads_entity_type_entity_slug_key;

create unique index if not exists community_threads_non_track_entity_slug_key
on public.community_threads (entity_type, entity_slug)
where entity_type <> 'track'
  and entity_slug is not null;

-- Backfill only legacy Track threads that resolve deterministically to one
-- active Registry Track. A target claimed by more than one legacy thread is
-- deliberately left unchanged rather than choosing an arbitrary winner.
with track_threads as (
  select
    thread.id,
    thread.entity_id,
    thread.entity_slug,
    thread.entity_url,
    regexp_replace(
      regexp_replace(
        coalesce(thread.entity_url, ''),
        '^https?://(www\.)?wakilisha\.africa',
        '',
        'i'
      ),
      '/+$',
      ''
    ) as entity_path
  from public.community_threads thread
  where thread.entity_type = 'track'
),
parsed as (
  select
    thread.*,
    (regexp_match(
      thread.entity_path,
      '^/tracks/([^/?#]+)/([^/?#]+)$'
    ))[1] as artist_slug,
    (regexp_match(
      thread.entity_path,
      '^/tracks/([^/?#]+)/([^/?#]+)$'
    ))[2] as route_track_slug
  from track_threads thread
),
primary_route_match as (
  select
    parsed.id,
    min(track.id::text)::uuid as track_id,
    count(distinct track.id)::integer as match_count
  from parsed
  left join public.registry_track_artists credit
    on credit.artist_slug = parsed.artist_slug
   and credit.status = 'active'
   and credit.is_primary is true
  left join public.registry_tracks track
    on track.id = credit.track_id
   and track.status = 'active'
   and track.slug = parsed.route_track_slug
  group by parsed.id
),
redirect_route_match as (
  select
    parsed.id,
    min(track.id::text)::uuid as track_id,
    count(distinct track.id)::integer as match_count
  from parsed
  left join public.wk_slug_redirects redirect
    on regexp_replace(
         regexp_replace(
           coalesce(redirect.old_path, ''),
           '^https?://(www\.)?wakilisha\.africa',
           '',
           'i'
         ),
         '/+$',
         ''
       ) = parsed.entity_path
  left join lateral regexp_match(
    regexp_replace(
      regexp_replace(
        coalesce(redirect.new_path, ''),
        '^https?://(www\.)?wakilisha\.africa',
        '',
        'i'
      ),
      '/+$',
      ''
    ),
    '^/tracks/([^/?#]+)/([^/?#]+)$'
  ) target on true
  left join public.registry_track_artists credit
    on credit.artist_slug = target[1]
   and credit.status = 'active'
   and credit.is_primary is true
  left join public.registry_tracks track
    on track.id = credit.track_id
   and track.status = 'active'
   and track.slug = target[2]
  group by parsed.id
),
artist_credit_match as (
  select
    parsed.id,
    min(track.id::text)::uuid as track_id,
    count(distinct track.id)::integer as match_count
  from parsed
  left join public.registry_track_artists credit
    on credit.artist_slug = parsed.artist_slug
   and credit.status = 'active'
  left join public.registry_tracks track
    on track.id = credit.track_id
   and track.status = 'active'
   and track.slug = coalesce(
     parsed.route_track_slug,
     parsed.entity_slug
   )
  group by parsed.id
),
global_unique_slug_match as (
  select
    parsed.id,
    min(track.id::text)::uuid as track_id,
    count(distinct track.id)::integer as match_count
  from parsed
  left join public.registry_tracks track
    on track.status = 'active'
   and track.slug = parsed.entity_slug
  group by parsed.id
),
resolved as (
  select
    parsed.id as thread_id,
    case
      when primary_match.match_count = 1
        then primary_match.track_id
      when redirect_match.match_count = 1
        then redirect_match.track_id
      when credit_match.match_count = 1
        then credit_match.track_id
      when global_match.match_count = 1
        then global_match.track_id
      else null
    end as track_id
  from parsed
  join primary_route_match primary_match
    on primary_match.id = parsed.id
  join redirect_route_match redirect_match
    on redirect_match.id = parsed.id
  join artist_credit_match credit_match
    on credit_match.id = parsed.id
  join global_unique_slug_match global_match
    on global_match.id = parsed.id
),
unique_targets as (
  select resolved.track_id
  from resolved
  where resolved.track_id is not null
  group by resolved.track_id
  having count(*) = 1
),
safe_resolution as (
  select
    resolved.thread_id,
    resolved.track_id
  from resolved
  join unique_targets
    on unique_targets.track_id = resolved.track_id
  where not exists (
    select 1
    from public.community_threads claimed
    where claimed.entity_type = 'track'
      and claimed.entity_id = resolved.track_id::text
      and claimed.id <> resolved.thread_id
  )
)
update public.community_threads thread
set
  entity_id = safe.track_id::text,
  updated_at = now()
from safe_resolution safe
where thread.id = safe.thread_id
  and thread.entity_type = 'track'
  and thread.entity_id is distinct from safe.track_id::text;

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

revoke all
on function public.community_get_thread_by_entity(text, text, text)
from public;

grant execute
on function public.community_get_thread_by_entity(text, text, text)
to anon, authenticated, service_role;

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
     and v_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
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

  -- Compatibility path for non-Track entities and legacy Track callers that
  -- do not yet carry a canonical Registry Track ID.
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
on function public.community_get_or_create_thread(text, text, text, text, text)
from public, anon;

grant execute
on function public.community_get_or_create_thread(text, text, text, text, text)
to authenticated, service_role;

comment on index public.community_threads_non_track_entity_slug_key is
  'Non-Track community entities retain slug uniqueness. Track discussions use Registry Track ID authority so the same presentation slug can exist under different Artist routes.';

comment on function public.community_get_thread_by_entity(text, text, text) is
  'Reads Track discussions by canonical Registry Track ID when available; legacy slug lookup remains compatibility-only for callers without canonical Track identity.';

comment on function public.community_get_or_create_thread(text, text, text, text, text) is
  'Creates Track discussions by canonical Registry Track ID when the supplied Artist-scoped public route proves the same active Registry Track. Exact legacy route rows are bound in place instead of duplicated.';

commit;

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

  -- Compatibility path for non-Track entities and legacy Track callers that
  -- do not yet carry a canonical Registry Track ID.
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
on function public.community_get_or_create_thread(text, text, text, text, text)
from public, anon;

grant execute
on function public.community_get_or_create_thread(text, text, text, text, text)
to authenticated, service_role;

comment on index public.community_threads_non_track_entity_slug_key is
  'Non-Track community entities retain slug uniqueness. Track discussions use Registry Track ID authority so the same presentation slug can exist under different Artist routes.';

comment on function public.community_get_thread_by_entity(text, text, text) is
  'Reads Track discussions by canonical Registry Track ID when available; legacy slug lookup remains compatibility-only for callers without canonical Track identity.';

comment on function public.community_get_or_create_thread(text, text, text, text, text) is
  'Creates Track discussions by canonical Registry Track ID when the supplied Artist-scoped public route proves the same active Registry Track. Exact legacy route rows are bound in place instead of duplicated.';

commit;
