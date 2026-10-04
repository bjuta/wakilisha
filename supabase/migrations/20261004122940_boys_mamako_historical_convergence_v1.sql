-- WAKILISHA — Boys Mamako historical provider convergence V1.
-- Repairs only the already-active Apple Music release whose canonical state
-- predates provider Artist-role/type convergence.
--
-- This migration is replay-safe:
-- - clean databases with no historical Release are a no-op;
-- - databases containing the Release must match the exact reviewed provider
--   identity before mutation;
-- - already-converged rows are accepted idempotently.
--
-- Exact track durations remain untouched because authoritative provider
-- millisecond values have not yet been re-observed.

begin;
set local statement_timeout='120s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'boys-mamako-historical-convergence-v1',
    0
  )
);

do $preflight$
declare
  v_release public.registry_releases%rowtype;
  v_track_count integer;
  v_credit_count integer;
  v_bad_roles integer;
begin
  select r.*
  into v_release
  from public.registry_releases r
  where r.id='0eb24444-eec5-4f2d-8afa-64945c728599'::uuid;

  if not found then
    return;
  end if;

  if v_release.title is distinct from
       'Boys Mamako Alikukanya (feat. Iphoolish) - Single'
     or v_release.slug is distinct from
       'boys-mamako-alikukanya-feat-iphoolish'
     or v_release.status is distinct from 'active'
     or v_release.upc is distinct from '823375256885'
     or v_release.metadata->>'apple_music_album_id' is distinct from '6783357507'
     or v_release.release_type not in ('ep','single')
  then
    raise exception
      'Boys Mamako Release authority drifted before historical convergence.';
  end if;

  select count(*)::integer
  into v_track_count
  from public.registry_release_tracks rt
  join public.registry_tracks t
    on t.id=rt.track_id
   and t.status='active'
  where rt.release_id=v_release.id
    and rt.status='active'
    and (
      (
        t.id='cfdd9175-1869-4767-af83-c5c55454119d'::uuid
        and t.title='Boys Mamako Alikukanya (Vocals) [feat. Iphoolish]'
        and t.isrc='USA2P2641179'
        and t.metadata->>'apple_music_track_id'='6783357510'
      )
      or
      (
        t.id='6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
        and t.title='Boys Mamako Alikukanya (Beat) [feat. Iphoolish]'
        and t.isrc='USA2P2641180'
        and t.metadata->>'apple_music_track_id'='6783357511'
      )
    );

  if v_track_count<>2 then
    raise exception
      'Boys Mamako Track authority drifted before historical convergence.';
  end if;

  select count(*)::integer
  into v_credit_count
  from public.registry_track_artists ta
  where ta.track_id in (
      'cfdd9175-1869-4767-af83-c5c55454119d'::uuid,
      '6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
    )
    and ta.artist_id in (
      '66899dc1-c968-4963-9002-9e11a6723dec'::uuid,
      '5c465840-5e43-48f1-b15a-b23847238f1f'::uuid,
      '138fa127-9c8b-46c8-b469-06f5f4880e2f'::uuid,
      'fb5a17ed-d1d5-44d2-8585-4bed02859689'::uuid
    )
    and ta.status='active';

  if v_credit_count<>8 then
    raise exception
      'Boys Mamako Track-credit authority drifted before historical convergence.';
  end if;

  select count(*)::integer
  into v_bad_roles
  from public.registry_track_artists ta
  where ta.track_id in (
      'cfdd9175-1869-4767-af83-c5c55454119d'::uuid,
      '6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
    )
    and ta.status='active'
    and (
      (
        ta.artist_id='66899dc1-c968-4963-9002-9e11a6723dec'::uuid
        and (
          ta.role<>'primary_artist'
          or not ta.is_primary
          or ta.is_featured
        )
      )
      or
      (
        ta.artist_id='fb5a17ed-d1d5-44d2-8585-4bed02859689'::uuid
        and (
          ta.role<>'featured_artist'
          or ta.is_primary
          or not ta.is_featured
        )
      )
      or
      (
        ta.artist_id in (
          '5c465840-5e43-48f1-b15a-b23847238f1f'::uuid,
          '138fa127-9c8b-46c8-b469-06f5f4880e2f'::uuid
        )
        and not (
          (
            ta.role='featured_artist'
            and not ta.is_primary
            and ta.is_featured
          )
          or
          (
            ta.role='primary_artist'
            and ta.is_primary
            and not ta.is_featured
          )
        )
      )
    );

  if v_bad_roles<>0 then
    raise exception
      'Boys Mamako Track-credit roles contain an unsupported state.';
  end if;
end
$preflight$;

update public.registry_releases
set
  release_type='single',
  updated_at=now()
where id='0eb24444-eec5-4f2d-8afa-64945c728599'::uuid
  and release_type='ep';

update public.registry_track_artists
set
  role='primary_artist',
  is_primary=true,
  is_featured=false,
  credit_order=case
    when artist_id='5c465840-5e43-48f1-b15a-b23847238f1f'::uuid then 2
    when artist_id='138fa127-9c8b-46c8-b469-06f5f4880e2f'::uuid then 3
    else credit_order
  end,
  metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
    'historical_convergence',
    'boys_mamako_historical_convergence_v1'
  ),
  updated_at=now()
where track_id in (
    'cfdd9175-1869-4767-af83-c5c55454119d'::uuid,
    '6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
  )
  and artist_id in (
    '5c465840-5e43-48f1-b15a-b23847238f1f'::uuid,
    '138fa127-9c8b-46c8-b469-06f5f4880e2f'::uuid
  )
  and status='active'
  and (
    role<>'primary_artist'
    or not is_primary
    or is_featured
    or credit_order not in (2,3)
  );

do $integrity$
declare
  v_release_exists boolean;
begin
  select exists (
    select 1
    from public.registry_releases
    where id='0eb24444-eec5-4f2d-8afa-64945c728599'::uuid
  )
  into v_release_exists;

  if not v_release_exists then
    return;
  end if;

  if not exists (
    select 1
    from public.registry_releases r
    where r.id='0eb24444-eec5-4f2d-8afa-64945c728599'::uuid
      and r.release_type='single'
      and r.status='active'
      and r.metadata->>'apple_music_album_id'='6783357507'
  ) then
    raise exception
      'Boys Mamako Release did not converge to Single authority.';
  end if;

  if (
    select count(*)
    from public.registry_track_artists ta
    where ta.track_id in (
        'cfdd9175-1869-4767-af83-c5c55454119d'::uuid,
        '6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
      )
      and ta.artist_id in (
        '5c465840-5e43-48f1-b15a-b23847238f1f'::uuid,
        '138fa127-9c8b-46c8-b469-06f5f4880e2f'::uuid
      )
      and ta.status='active'
      and ta.role='primary_artist'
      and ta.is_primary
      and not ta.is_featured
  )<>4 then
    raise exception
      'Boys Mamako co-primary Track credits did not converge.';
  end if;

  if (
    select count(*)
    from public.registry_track_artists ta
    where ta.track_id in (
        'cfdd9175-1869-4767-af83-c5c55454119d'::uuid,
        '6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
      )
      and ta.artist_id='fb5a17ed-d1d5-44d2-8585-4bed02859689'::uuid
      and ta.status='active'
      and ta.role='featured_artist'
      and not ta.is_primary
      and ta.is_featured
  )<>2 then
    raise exception
      'Boys Mamako Iphoolish featured authority drifted.';
  end if;
end
$integrity$;

commit;
