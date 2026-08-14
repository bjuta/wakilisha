-- Phase 5B: exact Registry artist-credit parity for Top 50 Kenyan Songs Of 2025.
-- Production-applied migration version: 20260810000605.
-- Final human decisions: Dyana Cods, Liboi and Soundkraft are Featured.

do $repair$
declare
  v_playlist_id uuid;
  rec record;
  v_existing_id uuid;
  v_expected_role text;
  v_inserted int:=0;
  v_updated int:=0;
  v_unchanged int:=0;
begin
  select id into v_playlist_id from public.wk_playlists where slug='top-50-kenyan-songs-of-2025' and status='draft' and authority_revision=51 for update;
  if v_playlist_id is null then raise exception 'STOP: exact draft revision 51 required'; end if;

  insert into public.registry_canonical_write_events(registry_entity_type,registry_entity_id,source_suggestion_id,source_table,field_name,target_path,before_value,after_value,action,status,error_message,actor,created_at)
  select 'track',s.canonical_track_id::text,s.id::text,'registry_provider_track_suggestion_artists','credit_role','registry_provider_track_suggestion_artists.credit_role',jsonb_build_object('credit_id',c.id,'observed_name',c.observed_name,'credit_role',c.credit_role),jsonb_build_object('credit_id',c.id,'observed_name',c.observed_name,'credit_role','featured'),'record_review_decision','applied',null,'phase5b_top50_m229',now()
  from public.registry_provider_track_suggestion_artists c
  join public.registry_provider_track_suggestions s on s.id=c.suggestion_id
  join public.wk_playlist_items i on i.id=s.source_playlist_item_id
  where s.source_playlist_id=v_playlist_id and c.credit_role='unresolved' and ((i.position=2 and c.observed_name='Dyana Cods') or (i.position=32 and c.observed_name='Liboi') or (i.position=48 and c.observed_name='Soundkraft'));
  if not found then raise exception 'STOP: final role decision ledger rows missing'; end if;

  update public.registry_provider_track_suggestion_artists c
  set credit_role='featured'
  from public.registry_provider_track_suggestions s, public.wk_playlist_items i
  where s.id=c.suggestion_id and i.id=s.source_playlist_item_id and s.source_playlist_id=v_playlist_id and c.credit_role='unresolved' and ((i.position=2 and c.observed_name='Dyana Cods') or (i.position=32 and c.observed_name='Liboi') or (i.position=48 and c.observed_name='Soundkraft'));

  if exists(select 1 from public.registry_provider_track_suggestion_artists c join public.registry_provider_track_suggestions s on s.id=c.suggestion_id where s.source_playlist_id=v_playlist_id and c.credit_role not in ('primary','featured')) then raise exception 'STOP: unresolved roles remain'; end if;

  for rec in
    select s.id suggestion_id,s.canonical_track_id track_id,c.id credit_id,c.registry_artist_id artist_id,a.slug artist_slug,a.display_name artist_name,c.credit_order,c.credit_role,c.observed_name
    from public.registry_provider_track_suggestion_artists c
    join public.registry_provider_track_suggestions s on s.id=c.suggestion_id
    join public.registry_artists a on a.id=c.registry_artist_id and a.status='active'
    where s.source_playlist_id=v_playlist_id and s.status='canonicalized'
    order by s.created_at,s.id,c.credit_order,c.id
  loop
    v_expected_role:=case when rec.credit_role='featured' then 'featured_artist' else 'primary_artist' end;
    v_existing_id:=null;
    select ta.id into v_existing_id
    from public.registry_track_artists ta
    where ta.track_id=rec.track_id and (ta.artist_id=rec.artist_id or lower(coalesce(ta.artist_slug,''))=lower(rec.artist_slug))
    order by case when ta.status='active' then 0 when ta.status='needs_review' then 1 else 2 end,case when ta.artist_id=rec.artist_id then 0 else 1 end,ta.created_at,ta.id
    limit 1 for update;

    if v_existing_id is null then
      insert into public.registry_track_artists(track_id,artist_id,artist_slug,artist_name_text,role,is_primary,is_featured,credit_order,display_credit,source,confidence,status,metadata,created_at,updated_at)
      values(rec.track_id,rec.artist_id,rec.artist_slug,rec.artist_name,v_expected_role,rec.credit_role='primary',rec.credit_role='featured',rec.credit_order,rec.artist_name,'track_intake_review',100,'active',jsonb_build_object('source_suggestion_id',rec.suggestion_id::text,'source_credit_id',rec.credit_id::text,'observed_name',rec.observed_name,'sync_contract','phase5b_registry_artist_credit_parity_v1'),now(),now());
      v_inserted:=v_inserted+1;
    elsif exists(select 1 from public.registry_track_artists ta where ta.id=v_existing_id and ta.artist_id is not distinct from rec.artist_id and ta.artist_slug is not distinct from rec.artist_slug and ta.artist_name_text is not distinct from rec.artist_name and ta.role=v_expected_role and ta.is_primary=(rec.credit_role='primary') and ta.is_featured=(rec.credit_role='featured') and ta.credit_order=rec.credit_order and ta.display_credit is not distinct from rec.artist_name and ta.status='active') then
      v_unchanged:=v_unchanged+1;
    else
      update public.registry_track_artists ta set artist_id=rec.artist_id,artist_slug=rec.artist_slug,artist_name_text=rec.artist_name,role=v_expected_role,is_primary=(rec.credit_role='primary'),is_featured=(rec.credit_role='featured'),credit_order=rec.credit_order,display_credit=rec.artist_name,source='track_intake_review',confidence=100,status='active',metadata=coalesce(ta.metadata,'{}'::jsonb)||jsonb_build_object('source_suggestion_id',rec.suggestion_id::text,'source_credit_id',rec.credit_id::text,'observed_name',rec.observed_name,'sync_contract','phase5b_registry_artist_credit_parity_v1'),updated_at=now() where ta.id=v_existing_id;
      v_updated:=v_updated+1;
    end if;
  end loop;

  if v_inserted<>3 or v_updated<>30 or v_unchanged<>74 then raise exception 'STOP: parity counts %, %, %',v_inserted,v_updated,v_unchanged; end if;

  if (with reviewed as (select s.canonical_track_id track_id,c.registry_artist_id artist_id,c.credit_role,c.credit_order from public.registry_provider_track_suggestion_artists c join public.registry_provider_track_suggestions s on s.id=c.suggestion_id where s.source_playlist_id=v_playlist_id) select count(*) from reviewed rv join public.registry_track_artists ta on ta.track_id=rv.track_id and ta.artist_id=rv.artist_id and ta.status='active' where ((rv.credit_role='primary' and ta.role='primary_artist' and ta.is_primary and not ta.is_featured) or (rv.credit_role='featured' and ta.role='featured_artist' and not ta.is_primary and ta.is_featured)) and ta.credit_order=rv.credit_order)<>107 then raise exception 'STOP: 107 parity failed'; end if;

  if (select count(*) from public.wk_playlist_items i where i.playlist_id=v_playlist_id and i.lifecycle_state='active' and exists(select 1 from public.registry_track_artists ta join public.registry_artists a on a.id=ta.artist_id and a.status='active' where ta.track_id=i.registry_track_id and ta.status='active' and ta.is_primary))<>50 then raise exception 'STOP: not all tracks have primary artists'; end if;
end;$repair$;
