do $verify$
declare
  v_savara_release_id uuid :=
    'd751a31a-b884-413b-81db-6b58dfab9d4b';

  v_nyashinski_release_id uuid;
  v_count integer;
begin
  select id
  into v_nyashinski_release_id
  from public.registry_releases
  where metadata ->> 'apple_music_album_id' =
    '1832011670'
  order by created_at asc
  limit 1;

  if v_nyashinski_release_id is null then
    raise exception
      'Nyashinski Balance release was not created.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_artists
  where release_id = v_savara_release_id
    and artist_slug = 'savara'
    and is_primary
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Savara release identity is incorrect.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_artists
  where release_id =
      v_nyashinski_release_id
    and artist_slug = 'nyashinski'
    and is_primary
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Nyashinski release identity is incorrect.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where release_id = v_savara_release_id
    and track_id =
      'f8aeedc3-4318-4f97-ac0c-636eaa5815a6'
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Savara Balance track is not correctly attached.';
  end if;

  select count(*)
  into v_count
  from public.registry_release_tracks
  where release_id =
      v_nyashinski_release_id
    and track_id =
      'b25018a7-2820-40f0-a959-02db0898f59d'
    and status = 'active';

  if v_count <> 1 then
    raise exception
      'Nyashinski Balance track is not correctly attached.';
  end if;

  if exists (
    select 1
    from public.registry_release_tracks rt
    join public.registry_tracks t
      on t.id = rt.track_id
    where rt.release_id in (
      v_savara_release_id,
      v_nyashinski_release_id
    )
      and rt.status = 'active'
    group by
      rt.release_id,
      lower(trim(t.slug))
    having count(*) > 1
  ) then
    raise exception
      'A release-scoped track slug remains ambiguous.';
  end if;
end
$verify$;

select
  r.id,
  r.slug,
  r.title,
  r.release_date,
  r.metadata ->> 'apple_music_album_id'
    as apple_music_album_id,
  ra.artist_slug,
  rt.track_id,
  t.slug as track_slug,
  t.isrc
from public.registry_releases r
join public.registry_release_artists ra
  on ra.release_id = r.id
  and ra.is_primary
  and ra.status = 'active'
join public.registry_release_tracks rt
  on rt.release_id = r.id
  and rt.status = 'active'
join public.registry_tracks t
  on t.id = rt.track_id
where r.metadata ->> 'apple_music_album_id'
  in (
    '1594997038',
    '1832011670'
  )
order by
  r.release_date,
  ra.artist_slug;
