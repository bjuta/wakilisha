-- Delete current Wanavokali Rhumba and Iyanii Mali Safi
-- records before clean provider reingestion.
--
-- Exact track rows: 4
-- Wanavokali Rhumba rows:
--   2
-- Iyanii Mali Safi rows:
--   2

begin;

select pg_advisory_xact_lock(
  hashtext(
    'wakilisha:delete-rhumba-mali-safi-for-reingest'
  )
);

create temporary table doomed_tracks (
  track_id uuid primary key,
  target_group text not null,
  expected_title text not null,
  expected_slug text not null
) on commit drop;

insert into doomed_tracks (
  track_id,
  target_group,
  expected_title,
  expected_slug
)
values
  ('e45947fb-16bd-4737-be6d-2b09a17f8646'::uuid, 'iyanii-mali-safi', 'Mali Safi', 'mali-safi'),
  ('5ba30d5f-bd7c-430e-8a5e-df8d868810a7'::uuid, 'iyanii-mali-safi', 'Mali Safi', 'mali-safi-2'),
  ('db073d99-9984-46e0-96ca-88d33778f854'::uuid, 'wanavokali-rhumba', 'Rhumba', 'rhumba'),
  ('a7a693a6-f42d-49cf-a60d-082e5b71c585'::uuid, 'wanavokali-rhumba', 'Rhumba', 'rhumba-2');

do $preconditions$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from doomed_tracks;

  if v_count <> 4 then
    raise exception
      'Expected 4 frozen tracks, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from doomed_tracks doomed
  join public.registry_tracks track
    on track.id = doomed.track_id
   and track.title = doomed.expected_title
   and track.slug = doomed.expected_slug;

  if v_count <> 4 then
    raise exception
      'Exact target-track state changed; matched %',
      v_count;
  end if;

  if (
    select count(*)
    from doomed_tracks
    where target_group = 'wanavokali-rhumba'
  ) <> 2 then
    raise exception
      'Wanavokali Rhumba boundary changed';
  end if;

  if (
    select count(*)
    from doomed_tracks
    where target_group = 'iyanii-mali-safi'
  ) <> 2 then
    raise exception
      'Iyanii Mali Safi boundary changed';
  end if;
end
$preconditions$;

delete from public.wk_slug_redirects
where entity_type = 'track'
  and (
    (
      scope_slug = 'wanavokali'
      and (
        old_slug ~ '^rhumba(-[0-9]+)?$'
        or new_slug ~ '^rhumba(-[0-9]+)?$'
        or old_path ~ '/rhumba(-[0-9]+)?(/lyrics/contribute)?$'
        or new_path ~ '/rhumba(-[0-9]+)?(/lyrics/contribute)?$'
      )
    )
    or
    (
      scope_slug = 'iyanii'
      and (
        old_slug ~ '^mali-safi(-[0-9]+)?$'
        or new_slug ~ '^mali-safi(-[0-9]+)?$'
        or old_path ~ '/mali-safi(-[0-9]+)?(/lyrics/contribute)?$'
        or new_path ~ '/mali-safi(-[0-9]+)?(/lyrics/contribute)?$'
      )
    )
  );

update public.wk_playlist_items item
set registry_track_id = null
where item.registry_track_id in (
  select track_id
  from doomed_tracks
);

delete from public.registry_release_tracks link
where link.track_id in (
  select track_id
  from doomed_tracks
);

delete from public.registry_track_artists link
where link.track_id in (
  select track_id
  from doomed_tracks
);

delete from public.registry_track_genres link
where link.track_id in (
  select track_id
  from doomed_tracks
);

delete from public.registry_track_provider_links link
where link.track_id in (
  select track_id
  from doomed_tracks
);

do $delete_tracks$
declare
  v_count integer;
begin
  with deleted as (
    delete from public.registry_tracks track
    using doomed_tracks doomed
    where track.id = doomed.track_id
      and track.title = doomed.expected_title
      and track.slug = doomed.expected_slug
    returning track.id
  )
  select count(*)
  into v_count
  from deleted;

  if v_count <> 4 then
    raise exception
      'Expected to delete 4 tracks, deleted %',
      v_count;
  end if;
end
$delete_tracks$;

do $postconditions$
begin
  if exists (
    select 1
    from doomed_tracks doomed
    join public.registry_tracks track
      on track.id = doomed.track_id
  ) then
    raise exception
      'A target track still exists';
  end if;

  if exists (
    select 1
    from doomed_tracks doomed
    join public.registry_entity_index idx
      on idx.entity_type = 'track'
     and idx.entity_id = doomed.track_id
  ) then
    raise exception
      'A target track remains in registry_entity_index';
  end if;

  if exists (
    select 1
    from doomed_tracks doomed
    join public.registry_release_tracks link
      on link.track_id = doomed.track_id
  ) then
    raise exception
      'A target release membership still exists';
  end if;

  if exists (
    select 1
    from doomed_tracks doomed
    join public.registry_track_artists link
      on link.track_id = doomed.track_id
  ) then
    raise exception
      'A target artist relationship still exists';
  end if;
end
$postconditions$;

commit;
