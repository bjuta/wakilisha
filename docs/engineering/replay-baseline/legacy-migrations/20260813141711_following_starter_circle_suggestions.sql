-- Following Experience M6
-- Starter Circle suggestion read authority.
--
-- Product contract:
--   * Following remains the canonical relationship writer.
--   * Starter Circle only suggests followable People and Artists.
--   * Suggestions must be capable of producing the existing Following feed.
--   * Anonymous readers may preview suggestions.
--   * Signed-in readers exclude targets they already follow.
--   * Signed-in readers never receive their own linked Person as a suggestion.
--   * Person and Artist pools remain separate. There is no fake global score.
--   * Artist suggestions are diversified by latest Release: at most one suggested
--     Artist represents the same latest Release in one response.
--   * The function returns public presentation facts, not internal account data.
--
-- Feed-yielding Person:
--   active public Person with at least one current-public Article or Playlist.
--
-- Feed-yielding Artist:
--   active Artist with public artwork and at least one active primary-credit
--   Release from the last 180 days.

begin;

do $starter_circle_m6_preflight$
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
       'editorial.people'
     ) is null
     or to_regclass(
       'editorial.person_identity_links'
     ) is null
     or to_regclass(
       'editorial.resources'
     ) is null
     or to_regclass(
       'editorial.resource_aliases'
     ) is null
     or to_regclass(
       'private.phase_0a_rpc_classification'
     ) is null
  then
    raise exception
      'STOP: Required Starter Circle source authority is missing';
  end if;

  if to_regprocedure(
       'editorial.list_current_public_person_work(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.resolve_person_presentation(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_set_follow_state(text,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.community_get_following_feed(integer,timestamp with time zone,text)'
     ) is null
  then
    raise exception
      'STOP: Existing Person, Follow, or Following-feed authority is incomplete';
  end if;

  if to_regprocedure(
       'public.community_get_follow_suggestions(integer,integer)'
     ) is not null
  then
    raise exception
      'STOP: Starter Circle suggestion authority already exists';
  end if;

  if exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_follow_suggestions(integer,integer)'
  ) then
    raise exception
      'STOP: Starter Circle RPC classification already exists';
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
      'STOP: Browser roles must not gain direct Follow-table read access';
  end if;
end;
$starter_circle_m6_preflight$;


create or replace function
  public.community_get_follow_suggestions(
    p_people_limit integer default 4,
    p_artist_limit integer default 12
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

  v_people_limit integer :=
    least(
      greatest(
        coalesce(
          p_people_limit,
          4
        ),
        0
      ),
      12
    );

  v_artist_limit integer :=
    least(
      greatest(
        coalesce(
          p_artist_limit,
          12
        ),
        0
      ),
      24
    );

  v_recent_cutoff timestamp with time zone :=
    now() - interval '180 days';

  v_release_cutoff date :=
    current_date - 180;

  v_people jsonb;
  v_artists jsonb;
begin
  with existing_follows as (
    select
      follow.target_type,
      follow.target_id
    from public.community_follows
      follow
    where v_user_id is not null
      and follow.user_id =
          v_user_id
      and follow.target_type in (
        'person',
        'artist'
      )
  ),

  self_people as (
    select distinct
      link.person_resource_id
    from editorial.person_identity_links
      link
    join editorial.people
      person
      on person.resource_id =
         link.person_resource_id
     and person.person_state =
         'active'
    where v_user_id is not null
      and link.user_id =
          v_user_id
      and link.link_state =
          'active'
  ),

  person_base as (
    select
      person.resource_id
        as target_id,
      alias.path
        as canonical_path,
      editorial.resolve_person_presentation(
        person.resource_id
      ) as presentation
    from editorial.people
      person
    join editorial.resources
      resource
      on resource.id =
         person.resource_id
     and resource.resource_kind =
         'person'
     and resource.visibility =
         'public'
     and resource.lifecycle_state =
         'active'
    join editorial.resource_aliases
      alias
      on alias.resource_id =
         person.resource_id
     and alias.is_canonical
     and alias.retired_at is null
    where person.person_state =
          'active'
      and alias.path like
          '/people/%'
      and not exists (
        select 1
        from self_people
          self_person
        where self_person.person_resource_id =
              person.resource_id
      )
      and not exists (
        select 1
        from existing_follows
          existing
        where existing.target_type =
              'person'
          and existing.target_id =
              person.resource_id::text
      )
  ),

  person_candidates as (
    select
      base.target_id,
      split_part(
        base.canonical_path,
        '/',
        3
      ) as target_slug,
      base.canonical_path,
      base.presentation
        ->> 'display_name'
        as display_name,
      nullif(
        btrim(
          coalesce(
            base.presentation
              ->> 'avatar_url',
            ''
          )
        ),
        ''
      ) as image_url,
      work_stats.work_count,
      work_stats.recent_item_count,
      work_stats.latest_item_at,
      work_stats.latest_item_kind,
      work_stats.latest_item_title
    from person_base
      base
    cross join lateral (
      select
        count(*)
          as work_count,
        count(*) filter (
          where work.published_at >=
                v_recent_cutoff
        ) as recent_item_count,
        max(
          work.published_at
        ) as latest_item_at,
        (
          array_agg(
            work.resource_kind
            order by
              work.published_at desc,
              work.resource_id desc
          )
        )[1] as latest_item_kind,
        (
          array_agg(
            work.title
            order by
              work.published_at desc,
              work.resource_id desc
          )
        )[1] as latest_item_title
      from editorial.list_current_public_person_work(
        base.target_id
      ) work
    ) work_stats
    where base.presentation is not null
      and nullif(
            btrim(
              coalesce(
                base.presentation
                  ->> 'display_name',
                ''
              )
            ),
            ''
          ) is not null
      and work_stats.work_count >
          0
  ),

  person_page as (
    select
      candidate.*
    from person_candidates
      candidate
    order by
      candidate.recent_item_count desc,
      candidate.latest_item_at desc nulls last,
      candidate.display_name,
      candidate.target_id
    limit v_people_limit
  )

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'target_type',
            'person',
          'target_id',
            page.target_id,
          'target_slug',
            page.target_slug,
          'canonical_path',
            page.canonical_path,
          'display_name',
            page.display_name,
          'image_url',
            page.image_url,
          'work_count',
            page.work_count,
          'recent_item_count',
            page.recent_item_count,
          'latest_item_at',
            page.latest_item_at,
          'latest_item_kind',
            page.latest_item_kind,
          'latest_item_title',
            page.latest_item_title
        )
        order by
          page.recent_item_count desc,
          page.latest_item_at desc nulls last,
          page.display_name,
          page.target_id
      ),
      '[]'::jsonb
    )
  into v_people
  from person_page
    page;


  with existing_follows as (
    select
      follow.target_type,
      follow.target_id
    from public.community_follows
      follow
    where v_user_id is not null
      and follow.user_id =
          v_user_id
      and follow.target_type =
          'artist'
  ),

  artist_candidates_unranked as (
    select
      artist.id
        as target_id,
      artist.slug
        as target_slug,
      '/artists/'
        || artist.slug
        as canonical_path,
      artist.display_name,
      artist.public_image_url
        as image_url,
      release_stats.release_count,
      release_stats.recent_release_count,
      release_stats.latest_release_id,
      release_stats.latest_release_date,
      release_stats.latest_release_title,
      latest_credit.latest_credit_order
    from public.registry_artists
      artist
    cross join lateral (
      select
        count(*)
          as release_count,
        count(*) filter (
          where release_row.release_date >=
                v_release_cutoff
        ) as recent_release_count,
        (
          array_agg(
            release_row.id
            order by
              release_row.release_date desc,
              release_row.id desc
          )
        )[1] as latest_release_id,
        max(
          release_row.release_date
        ) as latest_release_date,
        (
          array_agg(
            release_row.title
            order by
              release_row.release_date desc,
              release_row.id desc
          )
        )[1] as latest_release_title
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
    ) release_stats
    cross join lateral (
      select
        min(
          release_artist.credit_order
        ) as latest_credit_order
      from public.registry_release_artists
        release_artist
      where release_artist.release_id =
            release_stats.latest_release_id
        and release_artist.artist_id =
            artist.id
        and release_artist.status =
            'active'
        and release_artist.is_primary
    ) latest_credit
    where artist.status =
          'active'
      and nullif(
            btrim(
              coalesce(
                artist.slug,
                ''
              )
            ),
            ''
          ) is not null
      and nullif(
            btrim(
              coalesce(
                artist.display_name,
                ''
              )
            ),
            ''
          ) is not null
      and nullif(
            btrim(
              coalesce(
                artist.public_image_url,
                ''
              )
            ),
            ''
          ) is not null
      and release_stats.recent_release_count >
          0
      and release_stats.latest_release_id
          is not null
      and not exists (
        select 1
        from existing_follows
          existing
        where existing.target_type =
              'artist'
          and existing.target_id =
              artist.id::text
      )
  ),

  artist_candidates as (
    select
      candidate.*,
      row_number() over (
        partition by
          candidate.latest_release_id
        order by
          candidate.latest_credit_order
            asc nulls last,
          candidate.recent_release_count
            desc,
          candidate.release_count
            desc,
          candidate.display_name,
          candidate.target_id
      ) as latest_release_suggestion_rank
    from artist_candidates_unranked
      candidate
  ),

  artist_page as (
    select
      candidate.*
    from artist_candidates
      candidate
    where candidate.latest_release_suggestion_rank =
          1
    order by
      candidate.latest_release_date desc,
      candidate.recent_release_count desc,
      candidate.release_count desc,
      candidate.display_name,
      candidate.target_id
    limit v_artist_limit
  )

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'target_type',
            'artist',
          'target_id',
            page.target_id,
          'target_slug',
            page.target_slug,
          'canonical_path',
            page.canonical_path,
          'display_name',
            page.display_name,
          'image_url',
            page.image_url,
          'release_count',
            page.release_count,
          'recent_release_count',
            page.recent_release_count,
          'latest_release_date',
            page.latest_release_date,
          'latest_release_title',
            page.latest_release_title
        )
        order by
          page.latest_release_date desc,
          page.recent_release_count desc,
          page.release_count desc,
          page.display_name,
          page.target_id
      ),
      '[]'::jsonb
    )
  into v_artists
  from artist_page
    page;


  return jsonb_build_object(
    'mode',
      'starter_circle',
    'subject_types',
      jsonb_build_array(
        'person',
        'artist'
      ),
    'recent_window_days',
      180,
    'people',
      v_people,
    'artists',
      v_artists
  );
end;
$function$;


revoke all on function
  public.community_get_follow_suggestions(
    integer,
    integer
  )
from public;

grant execute on function
  public.community_get_follow_suggestions(
    integer,
    integer
  )
to
  anon,
  authenticated,
  service_role;


insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values (
  'community_get_follow_suggestions(integer,integer)',
  'public_read',
  'Public Starter Circle suggestions from feed-yielding People and Artists. Signed-in calls exclude the viewer''s existing follows and linked Person without exposing private Follow identities.'
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


do $starter_circle_m6_postflight$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.community_get_follow_suggestions(integer,integer)'
     ) is null
  then
    raise exception
      'FAIL: Starter Circle suggestion authority was not created';
  end if;

  if not has_function_privilege(
       'anon',
       'public.community_get_follow_suggestions(integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_follow_suggestions(integer,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Starter Circle execute privileges are incomplete';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_follow_suggestions(integer,integer)'
      and access_class =
          'public_read'
  ) then
    raise exception
      'FAIL: Starter Circle RPC classification is missing';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.community_get_follow_suggestions(integer,integer)'::regprocedure
    );

  if position(
       'auth.uid()'
       in v_definition
     ) = 0
     or position(
          'community_follows'
          in v_definition
        ) = 0
     or position(
          'person_identity_links'
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
          'latest_release_suggestion_rank'
          in v_definition
        ) = 0
     or position(
          '180 days'
          in v_definition
        ) = 0
  then
    raise exception
      'FAIL: Starter Circle source or self-exclusion contract is incomplete';
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
      'FAIL: Starter Circle changed direct Follow-table privacy';
  end if;
end;
$starter_circle_m6_postflight$;

commit;

