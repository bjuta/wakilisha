-- Registry Artist structural proximity verification.
-- Read-only. Safe to run after the migration is applied.

do $registry_artist_proximity_verify$
declare
  v_definition text;
  v_duplicate_count bigint;
  v_invalid_count bigint;
begin
  if to_regprocedure(
       'public.get_public_artist_structural_proximity(uuid)'
     ) is null
  then
    raise exception
      'FAIL: Structural Artist proximity RPC is missing';
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
      'FAIL: Structural proximity is not derived from canonical credit tables';
  end if;

  if position('registry_entity_relationships' in v_definition) > 0
     or position('registry_artist_relationships' in v_definition) > 0
  then
    raise exception
      'FAIL: Structural proximity depends on stored cultural relationship rows';
  end if;

  select count(*)
  into v_duplicate_count
  from (
    select
      source_artist.id,
      proximity.related_artist_id
    from public.registry_artists source_artist
    cross join lateral
      public.get_public_artist_structural_proximity(
        source_artist.id
      ) proximity
    where source_artist.status = 'active'
    group by
      source_artist.id,
      proximity.related_artist_id
    having count(*) > 1
  ) duplicate_pair;

  if v_duplicate_count <> 0 then
    raise exception
      'FAIL: Structural proximity returns duplicate Artist pairs';
  end if;

  select count(*)
  into v_invalid_count
  from public.registry_artists source_artist
  cross join lateral
    public.get_public_artist_structural_proximity(
      source_artist.id
    ) proximity
  where source_artist.status = 'active'
    and (
      proximity.related_artist_id = source_artist.id
      or (
        proximity.shared_track_count <= 0
        and proximity.shared_release_count <= 0
      )
      or proximity.proximity_score <= 0
      or not exists (
        select 1
        from public.registry_artists related_artist
        where related_artist.id = proximity.related_artist_id
          and related_artist.status = 'active'
      )
    );

  if v_invalid_count <> 0 then
    raise exception
      'FAIL: Structural proximity returned invalid public candidates';
  end if;
end;
$registry_artist_proximity_verify$;


with okello as (
  select artist.id
  from public.registry_artists artist
  where artist.slug = 'okello-max'
    and artist.status = 'active'
  limit 1
)
select jsonb_build_object(
  'verification', 'PASS',
  'okello_max_present',
    exists(select 1 from okello),
  'okello_max_structural_neighbors',
    coalesce(
      (
        select count(*)
        from okello
        cross join lateral
          public.get_public_artist_structural_proximity(
            okello.id
          )
      ),
      0
    ),
  'okello_max_neighbors',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'slug', proximity.related_artist_slug,
            'name', proximity.related_artist_name,
            'shared_tracks', proximity.shared_track_count,
            'shared_releases', proximity.shared_release_count,
            'features_them', proximity.features_them,
            'they_feature', proximity.they_feature,
            'score', proximity.proximity_score
          )
          order by
            proximity.proximity_score desc,
            proximity.related_artist_name
        )
        from okello
        cross join lateral
          public.get_public_artist_structural_proximity(
            okello.id
          ) proximity
      ),
      '[]'::jsonb
    ),
  'reviewed_relationship_authority_preserved',
    to_regprocedure(
      'public.get_public_artist_relationships(uuid)'
    ) is not null
) as registry_artist_structural_proximity_acceptance;
