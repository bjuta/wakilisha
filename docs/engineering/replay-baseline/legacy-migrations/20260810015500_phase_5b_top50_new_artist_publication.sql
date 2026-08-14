-- Phase 5B Migration 226: publish reviewed new artists for the first real Playlist.

begin;

do $m226$
declare
  v_playlist_id uuid;
  v_manifest jsonb := $manifest$[{"observed_name":"Jakk Quill","canonical_slug":"jakk-quill","canonical_display_name":"Jakk Quill","expected_state":"draft"},{"observed_name":"Fresh Like Uhh","canonical_slug":"fresh-like-uhh","canonical_display_name":"Fresh Like UHH","expected_state":"draft"},{"observed_name":"Abbas K뫿","canonical_slug":"abbas-kubaff","canonical_display_name":"Abbas Kubaff","expected_state":"draft"},{"observed_name":"ONENESS","canonical_slug":"oneness","canonical_display_name":"ONENESS","expected_state":"missing"},{"observed_name":"Su Dough Boss","canonical_slug":"su-dough-boss","canonical_display_name":"Su Dough Boss","expected_state":"missing"},{"observed_name":"Kanzu","canonical_slug":"kanzu","canonical_display_name":"Kanzu","expected_state":"missing"},{"observed_name":"BenaiA","canonical_slug":"benaia","canonical_display_name":"BenaiA","expected_state":"missing"},{"observed_name":"OVR2","canonical_slug":"ovr2","canonical_display_name":"OVR2","expected_state":"missing"},{"observed_name":"Vigel Brian","canonical_slug":"vigel-brian","canonical_display_name":"Vigel Brian","expected_state":"missing"},{"observed_name":"Fushi The Sage","canonical_slug":"fushi-the-sage","canonical_display_name":"Fushi The Sage","expected_state":"missing"},{"observed_name":"X.O.","canonical_slug":"x-o","canonical_display_name":"X.O","expected_state":"active"},{"observed_name":"Fadhilee Itulya","canonical_slug":"fadhilee-itulya","canonical_display_name":"Fadhilee Itulya","expected_state":"missing"},{"observed_name":"El Chi","canonical_slug":"el-chi","canonical_display_name":"El Chi","expected_state":"missing"},{"observed_name":"Shappaman","canonical_slug":"shappaman","canonical_display_name":"Shappaman","expected_state":"missing"},{"observed_name":"KXOBIE","canonical_slug":"kxobie","canonical_display_name":"KXOBIE","expected_state":"missing"},{"observed_name":"Perusi","canonical_slug":"perusi","canonical_display_name":"Perusi","expected_state":"missing"},{"observed_name":"44 Dugg","canonical_slug":"44-dugg","canonical_display_name":"44 Dugg","expected_state":"draft"},{"observed_name":"Cordoban","canonical_slug":"cordoban","canonical_display_name":"Cordoban","expected_state":"missing"},{"observed_name":"Iborian","canonical_slug":"iborian","canonical_display_name":"Iborian","expected_state":"missing"},{"observed_name":"Jemedari","canonical_slug":"jemedari","canonical_display_name":"Jemedari","expected_state":"missing"}]$manifest$::jsonb;
  v_entry jsonb;
  v_artist public.registry_artists%rowtype;
  v_existing_count integer;
  v_draft_count integer;
  v_active_count integer;
  v_missing_count integer;
  v_new_credit_count integer;
  v_new_credit_names integer;
  v_rebound_count integer;
  v_created_count integer := 0;
  v_activated_count integer := 0;
  v_reused_count integer := 0;
  v_remaining_unresolved integer;
  v_action text;
begin
  select id into v_playlist_id
  from public.wk_playlists
  where slug='top-50-kenyan-songs-of-2025'
  for update;

  if v_playlist_id is null then raise exception 'STOP: Target Playlist missing.'; end if;
  if jsonb_array_length(v_manifest) <> 20 then raise exception 'STOP: Expected 20 unique artist identities.'; end if;

  select count(*)::int, count(distinct lower(btrim(c.observed_name)))::int
  into v_new_credit_count, v_new_credit_names
  from public.registry_provider_track_suggestion_artists c
  join public.registry_provider_track_suggestions s on s.id=c.suggestion_id
  where s.source_playlist_id=v_playlist_id and s.status='needs_review' and c.resolution_mode='new_artist';

  if v_new_credit_count <> 21 or v_new_credit_names <> 20 then
    raise exception 'STOP: Expected 21 new-artist credits across 20 names, found % / %.', v_new_credit_count, v_new_credit_names;
  end if;

  if exists (
    select 1
    from public.registry_provider_track_suggestion_artists c
    join public.registry_provider_track_suggestions s on s.id=c.suggestion_id
    where s.source_playlist_id=v_playlist_id and s.status='needs_review' and c.resolution_mode='new_artist'
      and not exists (
        select 1 from jsonb_array_elements(v_manifest) m(entry)
        where lower(btrim(m.entry->>'observed_name'))=lower(btrim(c.observed_name))
      )
  ) then raise exception 'STOP: Publication manifest does not cover every reviewed new-artist credit.'; end if;

  if exists (
    select lower(a.slug)
    from public.registry_artists a
    join jsonb_array_elements(v_manifest) m(entry) on lower(a.slug)=lower(m.entry->>'canonical_slug')
    where a.status <> 'archived'
    group by lower(a.slug) having count(*) > 1
  ) then raise exception 'STOP: Duplicate non-archived canonical artist slug detected.'; end if;

  select count(*)::int,
         count(*) filter(where a.status='draft')::int,
         count(*) filter(where a.status='active')::int
  into v_existing_count, v_draft_count, v_active_count
  from public.registry_artists a
  join jsonb_array_elements(v_manifest) m(entry) on lower(a.slug)=lower(m.entry->>'canonical_slug')
  where a.status <> 'archived';

  v_missing_count := 20 - v_existing_count;
  if v_existing_count <> 5 or v_draft_count <> 4 or v_active_count <> 1 or v_missing_count <> 15 then
    raise exception 'STOP: Publication baseline drifted. existing %, draft %, active %, missing %.', v_existing_count, v_draft_count, v_active_count, v_missing_count;
  end if;

  for v_entry in
    select m.entry
    from jsonb_array_elements(v_manifest) as m(entry)
    order by m.entry->>'canonical_slug'
  loop
    select * into v_artist
    from public.registry_artists
    where lower(slug)=lower(v_entry->>'canonical_slug') and status <> 'archived'
    limit 1 for update;

    if found then
      if v_entry->>'expected_state'='missing' then raise exception 'STOP: % unexpectedly already exists.', v_entry->>'observed_name'; end if;
      if v_entry->>'expected_state'='draft' and v_artist.status <> 'draft' then raise exception 'STOP: % expected draft but is %.', v_artist.display_name, v_artist.status; end if;
      if v_entry->>'expected_state'='active' and v_artist.status <> 'active' then raise exception 'STOP: % expected active but is %.', v_artist.display_name, v_artist.status; end if;
      if v_artist.status='draft' then v_action:='activated_draft'; v_activated_count:=v_activated_count+1; else v_action:='reused_active'; v_reused_count:=v_reused_count+1; end if;
      update public.registry_artists
      set status='active',
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('phase5b_top50_artist_publication',jsonb_build_object('playlist_slug','top-50-kenyan-songs-of-2025','observed_name',v_entry->>'observed_name','action',v_action,'published_at',now())),
          updated_at=now()
      where id=v_artist.id;
    else
      if v_entry->>'expected_state' <> 'missing' then raise exception 'STOP: Expected existing artist % missing.', v_entry->>'canonical_display_name'; end if;
      insert into public.registry_artists(slug,display_name,normalized_name,sort_name,artist_type,status,metadata)
      values(v_entry->>'canonical_slug',v_entry->>'canonical_display_name',lower(regexp_replace(btrim(v_entry->>'canonical_display_name'),'\s+',' ','g')),v_entry->>'canonical_display_name','unknown','active',
        jsonb_build_object('phase5b_top50_artist_publication',jsonb_build_object('playlist_slug','top-50-kenyan-songs-of-2025','observed_name',v_entry->>'observed_name','action','created_active','published_at',now())))
      returning * into v_artist;
      v_created_count:=v_created_count+1;
    end if;
  end loop;

  with mapping as (
    select
      m.entry->>'observed_name' as observed_name,
      m.entry->>'canonical_slug' as canonical_slug
    from jsonb_array_elements(v_manifest) as m(entry)
  ), resolved as (
    select m.observed_name,a.id artist_id
    from mapping m join public.registry_artists a on lower(a.slug)=lower(m.canonical_slug) and a.status='active'
  ), updated as (
    update public.registry_provider_track_suggestion_artists c
    set resolution_mode='existing_artist', registry_artist_id=r.artist_id
    from public.registry_provider_track_suggestions s, resolved r
    where s.id=c.suggestion_id and s.source_playlist_id=v_playlist_id and s.status='needs_review' and c.resolution_mode='new_artist'
      and lower(btrim(c.observed_name))=lower(btrim(r.observed_name))
    returning c.id
  ) select count(*)::int into v_rebound_count from updated;

  if v_rebound_count <> 21 then raise exception 'STOP: Expected 21 rebound credits, got %.', v_rebound_count; end if;
  if exists(select 1 from public.registry_provider_track_suggestion_artists c join public.registry_provider_track_suggestions s on s.id=c.suggestion_id where s.source_playlist_id=v_playlist_id and c.resolution_mode='new_artist') then raise exception 'STOP: New-artist credits remain.'; end if;
  if (select count(*) from jsonb_array_elements(v_manifest) m(entry) join public.registry_artists a on lower(a.slug)=lower(m.entry->>'canonical_slug') and a.status='active') <> 20 then raise exception 'STOP: Not all 20 canonical artists are active.'; end if;
  if v_created_count <> 15 or v_activated_count <> 4 or v_reused_count <> 1 then raise exception 'STOP: Publication action counts drifted: created %, activated %, reused %.',v_created_count,v_activated_count,v_reused_count; end if;

  select count(*)::int into v_remaining_unresolved
  from public.registry_provider_track_suggestion_artists c
  join public.registry_provider_track_suggestions s on s.id=c.suggestion_id
  where s.source_playlist_id=v_playlist_id and c.resolution_mode='unresolved';
  if v_remaining_unresolved <> 3 then raise exception 'STOP: Expected three separately unresolved credits to remain untouched, found %.',v_remaining_unresolved; end if;
end;
$m226$;

commit;

