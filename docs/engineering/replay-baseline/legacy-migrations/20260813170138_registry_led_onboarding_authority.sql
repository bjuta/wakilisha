-- Registry-Led Onboarding V1
--
-- Product contract:
--   * "Your people are here." is a product promise, not a database label.
--   * The opening field is Artist-first and admin-customizable.
--   * Admin editorial Artists are independent from Magazine Featured Artists.
--   * A short editorial field may be backfilled by governed M6 Artist suggestions.
--   * Admin may disable fallback and fully override the opening field.
--   * Artist choices themselves remain canonical community Follows.
--   * This migration does not create a second preference or Follow writer.
--   * Onboarding state records only completed or skipped.
--   * Users who already exist when this authority lands are grandfathered as skipped.
--   * Related expansion remains owned by existing Registry relationship authority.
--   * No public UI needs Registry implementation terminology.

begin;

do $registry_onboarding_preflight$
begin
  if to_regclass(
       'public.registry_artists'
     ) is null
     or to_regclass(
       'public.user_role_assignments'
     ) is null
     or to_regclass(
       'private.phase_0a_rpc_classification'
     ) is null
     or to_regclass(
       'auth.users'
     ) is null
  then
    raise exception
      'STOP: Required Registry onboarding authority is missing';
  end if;

  if to_regprocedure(
       'public.community_get_follow_suggestions(integer,integer)'
     ) is null
     or to_regprocedure(
       'public.community_set_follow_state(text,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null
     or to_regprocedure(
       'public.get_public_artist_relationships(uuid)'
     ) is null
  then
    raise exception
      'STOP: Existing Follow, suggestion, admin, or Registry relationship authority is incomplete';
  end if;

  if to_regclass(
       'private.registry_onboarding_config'
     ) is not null
     or to_regclass(
       'private.registry_onboarding_editorial_artists'
     ) is not null
     or to_regclass(
       'private.registry_onboarding_user_state'
     ) is not null
  then
    raise exception
      'STOP: Registry onboarding private authority already exists';
  end if;

  if to_regprocedure(
       'public.community_get_registry_onboarding_artists(integer)'
     ) is not null
     or to_regprocedure(
       'public.community_get_registry_onboarding_state()'
     ) is not null
     or to_regprocedure(
       'public.community_set_registry_onboarding_state(text)'
     ) is not null
     or to_regprocedure(
       'public.community_admin_get_registry_onboarding_artists()'
     ) is not null
     or to_regprocedure(
       'public.community_admin_set_registry_onboarding_artists(text[],boolean)'
     ) is not null
  then
    raise exception
      'STOP: Registry onboarding RPC authority already exists';
  end if;
end;
$registry_onboarding_preflight$;


create table
  private.registry_onboarding_config (
    config_key text
      primary key,
    fallback_enabled boolean
      not null
      default true,
    updated_by uuid
      references auth.users(id)
      on delete set null,
    created_at timestamp with time zone
      not null
      default now(),
    updated_at timestamp with time zone
      not null
      default now(),
    constraint registry_onboarding_config_singleton
      check (
        config_key = 'default'
      )
  );


insert into
  private.registry_onboarding_config (
    config_key,
    fallback_enabled
  )
values (
  'default',
  true
);


create table
  private.registry_onboarding_editorial_artists (
    artist_id uuid
      primary key
      references public.registry_artists(id)
      on delete cascade,
    display_order integer
      not null,
    created_by uuid
      references auth.users(id)
      on delete set null,
    created_at timestamp with time zone
      not null
      default now(),
    updated_at timestamp with time zone
      not null
      default now(),
    constraint registry_onboarding_editorial_order_range
      check (
        display_order >= 0
        and display_order < 24
      ),
    constraint registry_onboarding_editorial_order_unique
      unique (
        display_order
      )
  );


create table
  private.registry_onboarding_user_state (
    user_id uuid
      primary key
      references auth.users(id)
      on delete cascade,
    status text
      not null,
    completed_at timestamp with time zone,
    skipped_at timestamp with time zone,
    created_at timestamp with time zone
      not null
      default now(),
    updated_at timestamp with time zone
      not null
      default now(),
    constraint registry_onboarding_user_state_status
      check (
        status in (
          'completed',
          'skipped'
        )
      ),
    constraint registry_onboarding_user_state_timestamps
      check (
        (
          status = 'completed'
          and completed_at is not null
          and skipped_at is null
        )
        or (
          status = 'skipped'
          and skipped_at is not null
          and completed_at is null
        )
      )
  );


insert into
  private.registry_onboarding_user_state (
    user_id,
    status,
    completed_at,
    skipped_at,
    created_at,
    updated_at
  )
select
  existing_user.id,
  'skipped',
  null,
  now(),
  now(),
  now()
from auth.users
  existing_user;


revoke all on table
  private.registry_onboarding_config
from public;

revoke all on table
  private.registry_onboarding_editorial_artists
from public;

revoke all on table
  private.registry_onboarding_user_state
from public;


create or replace function
  public.community_get_registry_onboarding_artists(
    p_limit integer default 16
  )
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_limit integer :=
    least(
      greatest(
        coalesce(
          p_limit,
          16
        ),
        1
      ),
      24
    );

  v_fallback_enabled boolean :=
    true;

  v_fallback jsonb :=
    '[]'::jsonb;

  v_artists jsonb :=
    '[]'::jsonb;

  v_editorial_count integer :=
    0;

  v_fallback_used boolean :=
    false;
begin
  select
    config.fallback_enabled
  into
    v_fallback_enabled
  from private.registry_onboarding_config
    config
  where config.config_key =
        'default';

  v_fallback_enabled :=
    coalesce(
      v_fallback_enabled,
      true
    );

  select
    count(*)
  into
    v_editorial_count
  from private.registry_onboarding_editorial_artists
    editorial
  join public.registry_artists
    artist
    on artist.id =
       editorial.artist_id
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
        ) is not null;

  if v_fallback_enabled
     and v_editorial_count <
         v_limit
  then
    v_fallback :=
      coalesce(
        public.community_get_follow_suggestions(
          0,
          least(
            24,
            greatest(
              v_limit * 2,
              12
            )
          )
        ) -> 'artists',
        '[]'::jsonb
      );
  end if;

  with editorial_items as (
    select
      jsonb_build_object(
        'target_type',
          'artist',
        'target_id',
          artist.id,
        'target_slug',
          artist.slug,
        'canonical_path',
          '/artists/'
          || artist.slug,
        'display_name',
          artist.display_name,
        'image_url',
          artist.public_image_url,
        'source',
          'editorial'
      ) as item,
      0
        as source_order,
      editorial.display_order
        as item_order
    from private.registry_onboarding_editorial_artists
      editorial
    join public.registry_artists
      artist
      on artist.id =
         editorial.artist_id
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
    order by
      editorial.display_order
    limit v_limit
  ),

  fallback_items as (
    select
      fallback.item
        || jsonb_build_object(
             'source',
             'system_fallback'
           )
        as item,
      1
        as source_order,
      fallback.ordinality::integer
        as item_order
    from jsonb_array_elements(
      v_fallback
    ) with ordinality
      fallback(
        item,
        ordinality
      )
    where not exists (
      select 1
      from private.registry_onboarding_editorial_artists
        editorial
      join public.registry_artists
        artist
        on artist.id =
           editorial.artist_id
       and artist.status =
           'active'
      where artist.id::text =
            fallback.item
              ->> 'target_id'
    )
  ),

  combined as (
    select
      editorial.item,
      editorial.source_order,
      editorial.item_order
    from editorial_items
      editorial

    union all

    select
      fallback.item,
      fallback.source_order,
      fallback.item_order
    from fallback_items
      fallback
  ),

  page as (
    select
      combined.item,
      combined.source_order,
      combined.item_order
    from combined
    order by
      combined.source_order,
      combined.item_order
    limit v_limit
  )

  select
    coalesce(
      jsonb_agg(
        page.item
        order by
          page.source_order,
          page.item_order
      ),
      '[]'::jsonb
    ),
    coalesce(
      bool_or(
        page.source_order = 1
      ),
      false
    )
  into
    v_artists,
    v_fallback_used
  from page;

  return jsonb_build_object(
    'mode',
      'registry_onboarding',
    'artists',
      v_artists,
    'editorial_configured_count',
      v_editorial_count,
    'fallback_enabled',
      v_fallback_enabled,
    'fallback_used',
      v_fallback_used
  );
end;
$function$;


create or replace function
  public.community_admin_get_registry_onboarding_artists()
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_fallback_enabled boolean;
  v_artists jsonb;
begin
  if auth.uid() is null
     or not public.current_user_is_administrator()
  then
    raise exception
      'Administrator access required'
      using errcode = '42501';
  end if;

  select
    config.fallback_enabled
  into
    v_fallback_enabled
  from private.registry_onboarding_config
    config
  where config.config_key =
        'default';

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'artist_id',
            artist.id,
          'artist_slug',
            artist.slug,
          'artist_name',
            artist.display_name,
          'artist_image',
            artist.public_image_url,
          'artist_status',
            artist.status,
          'display_order',
            editorial.display_order
        )
        order by
          editorial.display_order
      ),
      '[]'::jsonb
    )
  into
    v_artists
  from private.registry_onboarding_editorial_artists
    editorial
  join public.registry_artists
    artist
    on artist.id =
       editorial.artist_id;

  return jsonb_build_object(
    'fallback_enabled',
      coalesce(
        v_fallback_enabled,
        true
      ),
    'artists',
      v_artists
  );
end;
$function$;


create or replace function
  public.community_admin_set_registry_onboarding_artists(
    p_artist_slugs text[],
    p_fallback_enabled boolean default true
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_artist_slugs text[] :=
    coalesce(
      p_artist_slugs,
      array[]::text[]
    );

  v_count integer :=
    cardinality(
      coalesce(
        p_artist_slugs,
        array[]::text[]
      )
    );

  v_resolved_count integer;
begin
  if auth.uid() is null
     or not public.current_user_is_administrator()
  then
    raise exception
      'Administrator access required'
      using errcode = '42501';
  end if;

  if v_count > 24
  then
    raise exception
      'Onboarding opening field supports at most 24 Artists'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(
      v_artist_slugs
    ) requested(
      slug
    )
    where nullif(
            btrim(
              requested.slug
            ),
            ''
          ) is null
  ) then
    raise exception
      'Artist slugs must be non-empty'
      using errcode = '22023';
  end if;

  if (
    select
      count(*)
    from unnest(
      v_artist_slugs
    ) requested(
      slug
    )
  ) <>
  (
    select
      count(
        distinct btrim(
          requested.slug
        )
      )
    from unnest(
      v_artist_slugs
    ) requested(
      slug
    )
  ) then
    raise exception
      'Onboarding opening field cannot contain duplicate Artists'
      using errcode = '22023';
  end if;

  select
    count(*)
  into
    v_resolved_count
  from public.registry_artists
    artist
  where artist.status =
        'active'
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
    and artist.slug = any (
      select
        btrim(
          requested.slug
        )
      from unnest(
        v_artist_slugs
      ) requested(
        slug
      )
    );

  if v_resolved_count <>
     v_count
  then
    raise exception
      'Every onboarding Artist must resolve to one active Registry Artist'
      using errcode = '22023';
  end if;

  delete from
    private.registry_onboarding_editorial_artists;

  insert into
    private.registry_onboarding_editorial_artists (
      artist_id,
      display_order,
      created_by
    )
  select
    artist.id,
    requested.ordinality::integer - 1,
    auth.uid()
  from unnest(
    v_artist_slugs
  ) with ordinality
    requested(
      slug,
      ordinality
    )
  join public.registry_artists
    artist
    on artist.slug =
       btrim(
         requested.slug
       )
   and artist.status =
       'active'
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
  order by
    requested.ordinality;

  insert into
    private.registry_onboarding_config (
      config_key,
      fallback_enabled,
      updated_by,
      created_at,
      updated_at
    )
  values (
    'default',
    coalesce(
      p_fallback_enabled,
      true
    ),
    auth.uid(),
    now(),
    now()
  )
  on conflict (
    config_key
  )
  do update
  set
    fallback_enabled =
      excluded.fallback_enabled,
    updated_by =
      excluded.updated_by,
    updated_at =
      now();

  return jsonb_build_object(
    'updated',
      true,
    'artist_count',
      v_count,
    'fallback_enabled',
      coalesce(
        p_fallback_enabled,
        true
      )
  );
end;
$function$;


create or replace function
  public.community_get_registry_onboarding_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_status text;
  v_completed_at timestamp with time zone;
  v_skipped_at timestamp with time zone;
begin
  if v_user_id is null
  then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  select
    state.status,
    state.completed_at,
    state.skipped_at
  into
    v_status,
    v_completed_at,
    v_skipped_at
  from private.registry_onboarding_user_state
    state
  where state.user_id =
        v_user_id;

  return jsonb_build_object(
    'status',
      coalesce(
        v_status,
        'not_started'
      ),
    'completed_at',
      v_completed_at,
    'skipped_at',
      v_skipped_at
  );
end;
$function$;


create or replace function
  public.community_set_registry_onboarding_state(
    p_status text
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_user_id uuid :=
    auth.uid();

  v_status text :=
    lower(
      btrim(
        coalesce(
          p_status,
          ''
        )
      )
    );

  v_completed_at timestamp with time zone;
  v_skipped_at timestamp with time zone;
begin
  if v_user_id is null
  then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_status not in (
       'completed',
       'skipped'
     )
  then
    raise exception
      'Onboarding state must be completed or skipped'
      using errcode = '22023';
  end if;

  v_completed_at :=
    case
      when v_status =
           'completed'
      then now()
      else null
    end;

  v_skipped_at :=
    case
      when v_status =
           'skipped'
      then now()
      else null
    end;

  insert into
    private.registry_onboarding_user_state (
      user_id,
      status,
      completed_at,
      skipped_at,
      created_at,
      updated_at
    )
  values (
    v_user_id,
    v_status,
    v_completed_at,
    v_skipped_at,
    now(),
    now()
  )
  on conflict (
    user_id
  )
  do update
  set
    status =
      excluded.status,
    completed_at =
      excluded.completed_at,
    skipped_at =
      excluded.skipped_at,
    updated_at =
      now();

  return jsonb_build_object(
    'status',
      v_status,
    'completed_at',
      v_completed_at,
    'skipped_at',
      v_skipped_at
  );
end;
$function$;


revoke all on function
  public.community_get_registry_onboarding_artists(
    integer
  )
from public;

revoke all on function
  public.community_admin_get_registry_onboarding_artists()
from public;

revoke all on function
  public.community_admin_set_registry_onboarding_artists(
    text[],
    boolean
  )
from public;

revoke all on function
  public.community_get_registry_onboarding_state()
from public;

revoke all on function
  public.community_set_registry_onboarding_state(
    text
  )
from public;


grant execute on function
  public.community_get_registry_onboarding_artists(
    integer
  )
to
  anon,
  authenticated,
  service_role;

grant execute on function
  public.community_admin_get_registry_onboarding_artists()
to
  authenticated;

grant execute on function
  public.community_admin_set_registry_onboarding_artists(
    text[],
    boolean
  )
to
  authenticated;

grant execute on function
  public.community_get_registry_onboarding_state()
to
  authenticated;

grant execute on function
  public.community_set_registry_onboarding_state(
    text
  )
to
  authenticated;


insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values
  (
    'community_get_registry_onboarding_artists(integer)',
    'public_read',
    'Public Registry-led onboarding opening Artist field. Admin editorial Artists are returned first; governed Starter Circle Artist suggestions may backfill unused slots.'
  ),
  (
    'community_admin_get_registry_onboarding_artists()',
    'authenticated_read',
    'Administrator-only read of the editorial onboarding Artist configuration and fallback mode.'
  ),
  (
    'community_admin_set_registry_onboarding_artists(text[],boolean)',
    'authenticated_command',
    'Administrator-only replacement of the ordered onboarding Artist opening field and its fallback mode.'
  ),
  (
    'community_get_registry_onboarding_state()',
    'authenticated_read',
    'Authenticated self-only read of whether Registry-led onboarding is not started, completed, or skipped.'
  ),
  (
    'community_set_registry_onboarding_state(text)',
    'authenticated_self_service',
    'Authenticated self-only completion or skip state. Artist choices remain canonical Follows and are not duplicated here.'
  )
on conflict (
  function_signature
)
do update
set
  access_class =
    excluded.access_class,
  rationale =
    excluded.rationale,
  reviewed_at =
    now();


do $registry_onboarding_postflight$
declare
  v_opening_definition text;
  v_admin_definition text;
  v_state_definition text;
begin
  if to_regprocedure(
       'public.community_get_registry_onboarding_artists(integer)'
     ) is null
     or to_regprocedure(
       'public.community_admin_get_registry_onboarding_artists()'
     ) is null
     or to_regprocedure(
       'public.community_admin_set_registry_onboarding_artists(text[],boolean)'
     ) is null
     or to_regprocedure(
       'public.community_get_registry_onboarding_state()'
     ) is null
     or to_regprocedure(
       'public.community_set_registry_onboarding_state(text)'
     ) is null
  then
    raise exception
      'FAIL: Registry onboarding RPC authority is incomplete';
  end if;

  if not has_function_privilege(
       'anon',
       'public.community_get_registry_onboarding_artists(integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_registry_onboarding_artists(integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_get_registry_onboarding_state()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_set_registry_onboarding_state(text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_admin_set_registry_onboarding_artists(text[],boolean)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Registry onboarding execute boundary is incorrect';
  end if;

  if has_table_privilege(
       'anon',
       'private.registry_onboarding_editorial_artists',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.registry_onboarding_editorial_artists',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'private.registry_onboarding_user_state',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.registry_onboarding_user_state',
       'SELECT'
     )
  then
    raise exception
      'FAIL: Browser roles gained direct private onboarding table access';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_get_registry_onboarding_artists(integer)'
      and access_class =
          'public_read'
  )
  or not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_admin_set_registry_onboarding_artists(text[],boolean)'
      and access_class =
          'authenticated_command'
  )
  or not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_set_registry_onboarding_state(text)'
      and access_class =
          'authenticated_self_service'
  )
  then
    raise exception
      'FAIL: Registry onboarding RPC classification is incomplete';
  end if;

  v_opening_definition :=
    pg_get_functiondef(
      'public.community_get_registry_onboarding_artists(integer)'::regprocedure
    );

  v_admin_definition :=
    pg_get_functiondef(
      'public.community_admin_set_registry_onboarding_artists(text[],boolean)'::regprocedure
    );

  v_state_definition :=
    pg_get_functiondef(
      'public.community_set_registry_onboarding_state(text)'::regprocedure
    );

  if position(
       'registry_onboarding_editorial_artists'
       in v_opening_definition
     ) = 0
     or position(
          'community_get_follow_suggestions'
          in v_opening_definition
        ) = 0
     or position(
          'current_user_is_administrator'
          in v_admin_definition
        ) = 0
     or position(
          'auth.uid()'
          in v_state_definition
        ) = 0
  then
    raise exception
      'FAIL: Registry onboarding source, admin, or self-state contract is incomplete';
  end if;

  if position(
       'community_follows'
       in v_admin_definition
     ) > 0
     or position(
          'community_follows'
          in v_state_definition
        ) > 0
  then
    raise exception
      'FAIL: Onboarding config/state authority must not create a parallel Follow writer';
  end if;

  if to_regprocedure(
       'public.community_set_follow_state(text,text,text,boolean)'
     ) is null
  then
    raise exception
      'FAIL: Canonical Follow writer is missing';
  end if;
end;
$registry_onboarding_postflight$;

commit;
