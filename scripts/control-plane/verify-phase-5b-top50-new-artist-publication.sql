-- Phase 5B M226 verifier.

do $verify$
declare
  v_playlist_id uuid;
  v_manifest jsonb := $manifest$[{"observed_name":"Jakk Quill","canonical_slug":"jakk-quill","canonical_display_name":"Jakk Quill","expected_state":"draft"},{"observed_name":"Fresh Like Uhh","canonical_slug":"fresh-like-uhh","canonical_display_name":"Fresh Like UHH","expected_state":"draft"},{"observed_name":"Abbas K뫿","canonical_slug":"abbas-kubaff","canonical_display_name":"Abbas Kubaff","expected_state":"draft"},{"observed_name":"ONENESS","canonical_slug":"oneness","canonical_display_name":"ONENESS","expected_state":"missing"},{"observed_name":"Su Dough Boss","canonical_slug":"su-dough-boss","canonical_display_name":"Su Dough Boss","expected_state":"missing"},{"observed_name":"Kanzu","canonical_slug":"kanzu","canonical_display_name":"Kanzu","expected_state":"missing"},{"observed_name":"BenaiA","canonical_slug":"benaia","canonical_display_name":"BenaiA","expected_state":"missing"},{"observed_name":"OVR2","canonical_slug":"ovr2","canonical_display_name":"OVR2","expected_state":"missing"},{"observed_name":"Vigel Brian","canonical_slug":"vigel-brian","canonical_display_name":"Vigel Brian","expected_state":"missing"},{"observed_name":"Fushi The Sage","canonical_slug":"fushi-the-sage","canonical_display_name":"Fushi The Sage","expected_state":"missing"},{"observed_name":"X.O.","canonical_slug":"x-o","canonical_display_name":"X.O","expected_state":"active"},{"observed_name":"Fadhilee Itulya","canonical_slug":"fadhilee-itulya","canonical_display_name":"Fadhilee Itulya","expected_state":"missing"},{"observed_name":"El Chi","canonical_slug":"el-chi","canonical_display_name":"El Chi","expected_state":"missing"},{"observed_name":"Shappaman","canonical_slug":"shappaman","canonical_display_name":"Shappaman","expected_state":"missing"},{"observed_name":"KXOBIE","canonical_slug":"kxobie","canonical_display_name":"KXOBIE","expected_state":"missing"},{"observed_name":"Perusi","canonical_slug":"perusi","canonical_display_name":"Perusi","expected_state":"missing"},{"observed_name":"44 Dugg","canonical_slug":"44-dugg","canonical_display_name":"44 Dugg","expected_state":"draft"},{"observed_name":"Cordoban","canonical_slug":"cordoban","canonical_display_name":"Cordoban","expected_state":"missing"},{"observed_name":"Iborian","canonical_slug":"iborian","canonical_display_name":"Iborian","expected_state":"missing"},{"observed_name":"Jemedari","canonical_slug":"jemedari","canonical_display_name":"Jemedari","expected_state":"missing"}]$manifest$::jsonb;
  v_active integer; v_public integer; v_rebound integer; v_new integer;
begin
  select id into v_playlist_id from public.wk_playlists where slug='top-50-kenyan-songs-of-2025';
  if v_playlist_id is null then raise exception 'FAIL: Target Playlist missing.'; end if;

  select count(*)::int into v_active
  from jsonb_array_elements(v_manifest) m(entry)
  join public.registry_artists a on lower(a.slug)=lower(m.entry->>'canonical_slug') and a.status='active';
  if v_active <> 20 then raise exception 'FAIL: Expected 20 active reviewed artists, found %.',v_active; end if;

  select count(*)::int into v_public
  from jsonb_array_elements(v_manifest) m(entry)
  join lateral public.registry_resolve_artist_slug_for_public(m.entry->>'canonical_slug') r on lower(r.canonical_slug)=lower(m.entry->>'canonical_slug');
  if v_public <> 20 then raise exception 'FAIL: Expected 20 publicly resolvable artists, found %.',v_public; end if;

  select count(*)::int into v_rebound
  from public.registry_provider_track_suggestion_artists c
  join public.registry_provider_track_suggestions s on s.id=c.suggestion_id
  join public.registry_artists a on a.id=c.registry_artist_id and a.status='active'
  where s.source_playlist_id=v_playlist_id and c.resolution_mode='existing_artist'
    and exists(select 1 from jsonb_array_elements(v_manifest) m(entry) where lower(btrim(m.entry->>'observed_name'))=lower(btrim(c.observed_name)) and lower(a.slug)=lower(m.entry->>'canonical_slug'));
  if v_rebound <> 21 then raise exception 'FAIL: Expected 21 rebound credits, found %.',v_rebound; end if;

  select count(*)::int into v_new
  from public.registry_provider_track_suggestion_artists c
  join public.registry_provider_track_suggestions s on s.id=c.suggestion_id
  where s.source_playlist_id=v_playlist_id and c.resolution_mode='new_artist';
  if v_new <> 0 then raise exception 'FAIL: % new-artist credits remain.',v_new; end if;
end;
$verify$;

select jsonb_build_object(
  'verification','PASS',
  'active_reviewed_artists',20,
  'rebound_track_intake_credits',21,
  'created_active_artists',(select count(*) from public.registry_artists where metadata->'phase5b_top50_artist_publication'->>'action'='created_active'),
  'activated_draft_artists',(select count(*) from public.registry_artists where metadata->'phase5b_top50_artist_publication'->>'action'='activated_draft'),
  'reused_active_artists',(select count(*) from public.registry_artists where metadata->'phase5b_top50_artist_publication'->>'action'='reused_active')
) as phase_5b_top50_artist_publication_acceptance;

