-- Following Experience M3
-- Person + Artist current-interest feed read authority.
--
-- Product contract:
-- Following is a current-interest relationship, not a notification ledger.
-- A newly followed subject should immediately have a useful consequence.
--
-- Mature M3 subjects:
--   person -> governed current-public Article / Playlist work
--   artist -> active Releases where the Artist has an active primary credit
--
-- Intentionally not feed subjects in M3:
--   Genre
--   Label
--   Chart Program
--
-- Genre and Label remain latent M1 capability types while their product meaning
-- is redesigned. Chart Program has coherent relationship semantics, but its
-- feed consequence is intentionally separated from this slice.
--
-- Freshness contract:
--   - up to three qualifying outputs per followed subject from the last 180 days
--   - if a subject has no qualifying output in that window, include only that
--     subject's single latest qualifying output
--   - output publication date does not need to be later than Follow creation
--
-- Feed contract:
--   - merge qualifying Person + Artist output chronologically
--   - deduplicate one output reached through multiple followed subjects
--   - preserve every matching Follow reason on the deduplicated item
--   - no recommendation ranking
--   - no global Community activity reuse
--   - no public Following identities
--
-- Privacy:
-- The RPC derives the viewer from auth.uid(). It has no user-id argument and
-- can return only that authenticated viewer's own Follow consequences.

begin;


do $following_person_artist_feed_m3_preflight$
declare
  v_definition text;
begin
  if to_regclass(
       'public.community_follows'
     ) is null
     or to_regclass(
       'public.registry_artists'
     ) is null
     or to_regclass(
       'public.registry_releases'
     ) is null
     or to_regclass(
       'public.registry_release_artists'
     ) is null
     or to_regclass(
       'private.phase_0a_rpc_classification'
     ) is null
  then
    raise exception
      'STOP: Required Person/Artist Following feed source authority is missing';
  end if;

  if to_regprocedure(
       'private.community_resolve_follow_target(text,text,text)'
     ) is null
     or to_regprocedure(
       'public.community_get_user_follows(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.list_current_public_person_work(uuid)'
     ) is null
  then
    raise exception
      'STOP: Follow M1 / Person current-public work authority is incomplete';
  end if;

  if to_regprocedure(
       'public.community_get_following_feed(integer,timestamp with time zone,text)'
     ) is not null
  then
    raise exception
      'STOP: Following feed read authority already exists';
  end if;

  if exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_following_feed(integer,timestamp with time zone,text)'
  ) then
    raise exception
      'STOP: Following feed RPC classification already exists';
  end if;

  if has_table_privilege(
       'anon',
       'public.community_follows',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'SELECT'
     )
  then
    raise exception
      'STOP: Browser role gained direct Follow-table read access before M3';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_get_user_follows(uuid)'::regprocedure
    );

  if position(
       'auth.uid()'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Existing self-only Follow reader no longer binds to auth.uid()';
  end if;
end;
$following_person_artist_feed_m3_preflight$;


create or replace function
  public.community_get_following_feed(
    p_limit integer default 30,
    p_before_published_at timestamp with time zone default null,
    p_before_item_key text default null
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
  v_user_id uuid :=
    auth.uid();

  v_limit integer :=
    least(
      greatest(
        coalesce(
          p_limit,
          30
        ),
        1
      ),
      50
    );

  v_recent_cutoff timestamp with time zone :=
    now() - interval '180 days';

  v_release_cutoff date :=
    current_date - 180;

  v_items jsonb;
begin
  if v_user_id is null then
    raise exception
      'authentication required';
  end if;

  with self_follows as (
    select
      follow.target_type,
      follow.target_id,
      follow.target_slug,
      follow.created_at
        as followed_at
    from public.community_follows
      follow
    where follow.user_id =
          v_user_id
      and follow.target_type in (
        'person',
        'artist'
      )
  ),

  person_candidates as (
    select
      work.resource_kind
        as item_type,
      work.resource_id::text
        as item_id,
      work.resource_kind
        || ':'
        || work.resource_id::text
        as item_key,
      work.canonical_path,
      work.title,
      work.summary,
      work.image_url,
      work.published_at,
      follow.target_type
        as reason_target_type,
      follow.target_id
        as reason_target_id,
      follow.target_slug
        as reason_target_slug,
      follow.followed_at
    from (
      select *
      from self_follows
      where target_type =
            'person'
    ) follow
    cross join lateral (
      with work as (
        select current_work.*
        from editorial.list_current_public_person_work(
          follow.target_id::uuid
        ) current_work
      ),
      ranked as (
        select
          work.*,
          row_number() over (
            order by
              work.published_at desc,
              work.resource_id desc
          ) as output_rank,
          count(*) filter (
            where work.published_at >=
                  v_recent_cutoff
          ) over () as recent_count
        from work
      )
      select
        ranked.*
      from ranked
      where (
        ranked.published_at >=
          v_recent_cutoff
        and ranked.output_rank <= 3
      )
      or (
        ranked.recent_count = 0
        and ranked.output_rank = 1
      )
    ) work
  ),

  artist_candidates as (
    select
      'release'::text
        as item_type,
      release_row.id::text
        as item_id,
      'release:'
        || release_row.id::text
        as item_key,
      '/releases/'
        || artist.slug
        || '/'
        || release_row.slug
        as canonical_path,
      release_row.title,
      release_row.description
        as summary,
      release_row.artwork_url
        as image_url,
      (
        release_row.release_date::timestamp
        at time zone 'UTC'
      ) as published_at,
      follow.target_type
        as reason_target_type,
      follow.target_id
        as reason_target_id,
      artist.slug
        as reason_target_slug,
      follow.followed_at
    from (
      select *
      from self_follows
      where target_type =
            'artist'
    ) follow
    join public.registry_artists
      artist
      on artist.id::text =
         follow.target_id
     and artist.status =
         'active'
    cross join lateral (
      with releases as (
        select
          release_row.*,
          row_number() over (
            order by
              release_row.release_date desc,
              release_row.id desc
          ) as output_rank,
          count(*) filter (
            where release_row.release_date >=
                  v_release_cutoff
          ) over () as recent_count
        from public.registry_releases
          release_row
        where release_row.status =
              'active'
          and release_row.release_date
              is not null
          and release_row.release_date <=
              current_date
          and nullif(
                btrim(
                  coalesce(
                    release_row.slug,
                    ''
                  )
                ),
                ''
              ) is not null
          and exists (
            select 1
            from public.registry_release_artists
              release_artist
            where release_artist.release_id =
                  release_row.id
              and release_artist.artist_id =
                  artist.id
              and release_artist.status =
                  'active'
              and release_artist.is_primary
          )
      )
      select
        releases.*
      from releases
      where (
        releases.release_date >=
          v_release_cutoff
        and releases.output_rank <= 3
      )
      or (
        releases.recent_count = 0
        and releases.output_rank = 1
      )
    ) release_row
  ),

  candidate_rows as (
    select *
    from person_candidates

    union all

    select *
    from artist_candidates
  ),

  distinct_reason_rows as (
    select distinct
      candidate.item_type,
      candidate.item_id,
      candidate.item_key,
      candidate.canonical_path,
      candidate.title,
      candidate.summary,
      candidate.image_url,
      candidate.published_at,
      candidate.reason_target_type,
      candidate.reason_target_id,
      candidate.reason_target_slug,
      candidate.followed_at
    from candidate_rows
      candidate
    where candidate.published_at
          is not null
      and nullif(
            btrim(
              coalesce(
                candidate.canonical_path,
                ''
              )
            ),
            ''
          ) is not null
      and nullif(
            btrim(
              coalesce(
                candidate.title,
                ''
              )
            ),
            ''
          ) is not null
  ),

  grouped_items as (
    select
      candidate.item_type,
      candidate.item_id,
      candidate.item_key,
      min(
        candidate.canonical_path
      ) as canonical_path,
      candidate.title,
      candidate.summary,
      candidate.image_url,
      candidate.published_at,
      jsonb_agg(
        jsonb_build_object(
          'target_type',
            candidate.reason_target_type,
          'target_id',
            candidate.reason_target_id,
          'target_slug',
            candidate.reason_target_slug,
          'followed_at',
            candidate.followed_at
        )
        order by
          candidate.reason_target_type,
          candidate.reason_target_slug,
          candidate.reason_target_id
      ) as matched_follows
    from distinct_reason_rows
      candidate
    group by
      candidate.item_type,
      candidate.item_id,
      candidate.item_key,
      candidate.title,
      candidate.summary,
      candidate.image_url,
      candidate.published_at
  ),

  page as (
    select
      item.*
    from grouped_items
      item
    where p_before_published_at
          is null
       or item.published_at <
          p_before_published_at
       or (
         p_before_item_key
           is not null
         and item.published_at =
             p_before_published_at
         and item.item_key <
             p_before_item_key
       )
    order by
      item.published_at desc,
      item.item_key desc
    limit v_limit
  )

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'item_type',
            page.item_type,
          'item_id',
            page.item_id,
          'item_key',
            page.item_key,
          'canonical_path',
            page.canonical_path,
          'title',
            page.title,
          'summary',
            page.summary,
          'image_url',
            page.image_url,
          'published_at',
            page.published_at,
          'matched_follows',
            page.matched_follows
        )
        order by
          page.published_at desc,
          page.item_key desc
      ),
      '[]'::jsonb
    )
  into v_items
  from page;

  return jsonb_build_object(
    'mode',
      'current_interest',
    'subject_types',
      jsonb_build_array(
        'person',
        'artist'
      ),
    'recent_window_days',
      180,
    'per_subject_recent_limit',
      3,
    'items',
      v_items
  );
end;
$function$;


revoke all on function
  public.community_get_following_feed(
    integer,
    timestamp with time zone,
    text
  )
from public;

revoke execute on function
  public.community_get_following_feed(
    integer,
    timestamp with time zone,
    text
  )
from anon;

grant execute on function
  public.community_get_following_feed(
    integer,
    timestamp with time zone,
    text
  )
to authenticated, service_role;


insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values (
  'community_get_following_feed(integer,timestamp with time zone,text)',
  'authenticated_read',
  'Self-only current-interest output from followed People and Artists. The reader returns recent governed public work or Releases without exposing Following identities publicly.'
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


do $following_person_artist_feed_m3_postflight$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.community_get_following_feed(integer,timestamp with time zone,text)'
     ) is null
  then
    raise exception
      'FAIL: Person/Artist Following feed read authority was not created';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_get_following_feed(integer,timestamp with time zone,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_following_feed(integer,timestamp with time zone,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Following feed execute privileges are incorrect';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_following_feed(integer,timestamp with time zone,text)'
      and access_class =
          'authenticated_read'
  ) then
    raise exception
      'FAIL: Following feed RPC classification is missing';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_get_following_feed(integer,timestamp with time zone,text)'::regprocedure
    );

  if position(
       'auth.uid()'
       in v_definition
     ) = 0
     or position(
          'list_current_public_person_work'
          in v_definition
        ) = 0
     or position(
          'registry_release_artists'
          in v_definition
        ) = 0
     or position(
          '180 days'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: Person/Artist current-interest feed source contract is incomplete';
  end if;

  if position(
       'registry_genres'
       in v_definition
     ) > 0
     or position(
          'registry_labels'
          in v_definition
        ) > 0
     or position(
          'wk_chart_'
          in v_definition
        ) > 0
  then
    raise exception
      'FAIL: M3 feed promoted an intentionally deferred subject type';
  end if;
end;
$following_person_artist_feed_m3_postflight$;


commit;
