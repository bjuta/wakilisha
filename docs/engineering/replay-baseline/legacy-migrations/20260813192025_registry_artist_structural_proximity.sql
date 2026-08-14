begin;

do $registry_artist_proximity_preflight$
begin
  if to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_release_artists') is null
  then
    raise exception
      'Required Registry structural authority is missing';
  end if;

  if to_regclass('private.phase_0a_rpc_classification') is null then
    raise exception
      'RPC classification authority is missing';
  end if;

  if to_regprocedure('public.get_public_artist_relationships(uuid)') is null then
    raise exception
      'Reviewed public Artist relationship authority is missing';
  end if;
end;
$registry_artist_proximity_preflight$;


create or replace function
  public.get_public_artist_structural_proximity(
    p_artist_id uuid
  )
returns table (
  related_artist_id uuid,
  related_artist_slug text,
  related_artist_name text,
  related_artist_image_url text,
  shared_track_count integer,
  shared_release_count integer,
  features_them integer,
  they_feature integer,
  shared_titles text[],
  proximity_score integer
)
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public'
as $function$
with target as (
  select
    artist.id,
    artist.slug
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status = 'active'
),

target_track_credits as (
  select
    credit.track_id,
    bool_or(coalesce(credit.is_primary, false)) as is_primary,
    bool_or(
      coalesce(credit.is_featured, false)
      or lower(coalesce(credit.role, '')) in (
        'featured',
        'featured_artist',
        'feature'
      )
    ) as is_featured
  from public.registry_track_artists credit
  join target target_artist
    on (
      credit.artist_id = target_artist.id
      or (
        credit.artist_id is null
        and lower(coalesce(credit.artist_slug, '')) =
            lower(target_artist.slug)
      )
    )
  join public.registry_tracks track
    on track.id = credit.track_id
   and track.status = 'active'
  where credit.status = 'active'
  group by credit.track_id
),

track_pairs as (
  select
    related_artist.id as related_artist_id,
    target_credit.track_id,
    bool_or(
      target_credit.is_primary
      and (
        coalesce(peer_credit.is_featured, false)
        or lower(coalesce(peer_credit.role, '')) in (
          'featured',
          'featured_artist',
          'feature'
        )
      )
    ) as features_them_on_track,
    bool_or(
      target_credit.is_featured
      and coalesce(peer_credit.is_primary, false)
    ) as they_feature_on_track
  from target_track_credits target_credit
  join public.registry_track_artists peer_credit
    on peer_credit.track_id = target_credit.track_id
   and peer_credit.status = 'active'
  join public.registry_artists related_artist
    on related_artist.status = 'active'
   and (
     (
       peer_credit.artist_id is not null
       and related_artist.id = peer_credit.artist_id
     )
     or (
       peer_credit.artist_id is null
       and lower(coalesce(peer_credit.artist_slug, '')) =
           lower(related_artist.slug)
     )
   )
  where related_artist.id <> p_artist_id
  group by
    related_artist.id,
    target_credit.track_id
),

track_aggregate as (
  select
    pair.related_artist_id,
    count(*)::integer as shared_track_count,
    count(*) filter (
      where pair.features_them_on_track
    )::integer as features_them,
    count(*) filter (
      where pair.they_feature_on_track
    )::integer as they_feature,
    coalesce(
      array_agg(
        distinct track.title
        order by track.title
      ) filter (
        where nullif(btrim(coalesce(track.title, '')), '') is not null
      ),
      array[]::text[]
    ) as shared_titles
  from track_pairs pair
  join public.registry_tracks track
    on track.id = pair.track_id
  group by pair.related_artist_id
),

target_release_credits as (
  select distinct
    credit.release_id
  from public.registry_release_artists credit
  join target target_artist
    on (
      credit.artist_id = target_artist.id
      or (
        credit.artist_id is null
        and lower(coalesce(credit.artist_slug, '')) =
            lower(target_artist.slug)
      )
    )
  join public.registry_releases release
    on release.id = credit.release_id
   and release.status = 'active'
  where credit.status = 'active'
),

release_pairs as (
  select distinct
    related_artist.id as related_artist_id,
    target_credit.release_id
  from target_release_credits target_credit
  join public.registry_release_artists peer_credit
    on peer_credit.release_id = target_credit.release_id
   and peer_credit.status = 'active'
  join public.registry_artists related_artist
    on related_artist.status = 'active'
   and (
     (
       peer_credit.artist_id is not null
       and related_artist.id = peer_credit.artist_id
     )
     or (
       peer_credit.artist_id is null
       and lower(coalesce(peer_credit.artist_slug, '')) =
           lower(related_artist.slug)
     )
   )
  where related_artist.id <> p_artist_id
),

release_aggregate as (
  select
    pair.related_artist_id,
    count(*)::integer as shared_release_count
  from release_pairs pair
  group by pair.related_artist_id
),

candidate as (
  select
    coalesce(
      track.related_artist_id,
      release.related_artist_id
    ) as related_artist_id,
    coalesce(track.shared_track_count, 0) as shared_track_count,
    coalesce(release.shared_release_count, 0) as shared_release_count,
    coalesce(track.features_them, 0) as features_them,
    coalesce(track.they_feature, 0) as they_feature,
    coalesce(track.shared_titles, array[]::text[]) as shared_titles
  from track_aggregate track
  full join release_aggregate release
    on release.related_artist_id = track.related_artist_id
)

select
  artist.id as related_artist_id,
  artist.slug as related_artist_slug,
  artist.display_name as related_artist_name,
  artist.public_image_url as related_artist_image_url,
  candidate.shared_track_count,
  candidate.shared_release_count,
  candidate.features_them,
  candidate.they_feature,
  candidate.shared_titles,
  (
    candidate.shared_track_count * 100
    + candidate.shared_release_count * 20
    + candidate.features_them * 10
    + candidate.they_feature * 10
  )::integer as proximity_score
from candidate candidate
join public.registry_artists artist
  on artist.id = candidate.related_artist_id
 and artist.status = 'active'
where candidate.shared_track_count > 0
   or candidate.shared_release_count > 0
order by
  proximity_score desc,
  candidate.shared_track_count desc,
  candidate.shared_release_count desc,
  artist.display_name,
  artist.id;
$function$;


revoke all on function
  public.get_public_artist_structural_proximity(uuid)
from public;


grant execute on function
  public.get_public_artist_structural_proximity(uuid)
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
  'get_public_artist_structural_proximity(uuid)',
  'public_read',
  'Public derived Artist proximity from active canonical Registry track and release credits. This is a structural discovery projection and does not create or replace reviewed cultural relationships.'
)
on conflict (function_signature)
do update
set
  access_class = excluded.access_class,
  rationale = excluded.rationale,
  reviewed_at = now();


do $registry_artist_proximity_postflight$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.get_public_artist_structural_proximity(uuid)'
     ) is null
  then
    raise exception
      'Structural Artist proximity RPC was not created';
  end if;

  select
    pg_get_functiondef(
      'public.get_public_artist_structural_proximity(uuid)'::regprocedure
    )
  into v_definition;

  if position('registry_track_artists' in v_definition) = 0
     or position('registry_release_artists' in v_definition) = 0
  then
    raise exception
      'Structural Artist proximity does not use both canonical credit authorities';
  end if;

  if position('registry_entity_relationships' in v_definition) > 0
     or position('registry_artist_relationships' in v_definition) > 0
  then
    raise exception
      'Structural Artist proximity incorrectly depends on stored cultural relationship rows';
  end if;

  if not has_function_privilege(
           'anon',
           'public.get_public_artist_structural_proximity(uuid)',
           'execute'
         )
     or not has_function_privilege(
              'authenticated',
              'public.get_public_artist_structural_proximity(uuid)',
              'execute'
            )
     or not has_function_privilege(
              'service_role',
              'public.get_public_artist_structural_proximity(uuid)',
              'execute'
            )
  then
    raise exception
      'Structural Artist proximity execute grants are incomplete';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification classification
    where classification.function_signature =
          'get_public_artist_structural_proximity(uuid)'
      and classification.access_class = 'public_read'
  )
  then
    raise exception
      'Structural Artist proximity RPC classification is missing';
  end if;
end;
$registry_artist_proximity_postflight$;


commit;
