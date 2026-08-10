do $verify_m231$
declare
  v_constraint text;
  v_playlist_id uuid;
  v_suggestion_id uuid;
  v_track_id uuid;
begin
  select pg_get_constraintdef(constraint_row.oid)
  into v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid =
          'public.provider_entity_links'::regclass
    and constraint_row.conname =
          'provider_entity_links_match_status_check';

  if v_constraint is null
     or position('superseded' in v_constraint) = 0
  then
    raise exception
      'FAIL: provider link vocabulary does not include superseded.';
  end if;

  if to_regprocedure(
       'public.admin_select_registry_track_intake_provider_evidence(uuid,text,text,text)'
     ) is null
  then
    raise exception
      'FAIL: explicit Track Intake provider-selection command is missing.';
  end if;

  if to_regprocedure(
       'public.guard_registry_track_intake_provider_selection()'
     ) is null
  then
    raise exception
      'FAIL: Track Intake provider-selection guard is missing.';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'public.provider_entity_links'::regclass
      and trigger_row.tgname =
            'provider_entity_links_track_intake_selection_guard'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'FAIL: provider-selection guard trigger is missing.';
  end if;

  if has_function_privilege(
    'anon',
    'public.admin_select_registry_track_intake_provider_evidence(uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'FAIL: anon can select Track Intake provider identity.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.admin_select_registry_track_intake_provider_evidence(uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'FAIL: authenticated Registry editors lost provider-selection command authority.';
  end if;

  if position(
       quote_literal('candidate')
       in pg_get_functiondef(
         'public.admin_record_registry_track_intake_provider_evidence(uuid,text,text,text,jsonb,jsonb,numeric)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: provider inspection does not stage candidate identity.';
  end if;

  if position(
       'not (p_fields ? suggestion.field_name)'
       in pg_get_functiondef(
         'public.admin_save_registry_track_intake_enrichment(uuid,jsonb,text)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: accepted enrichment is not replacement authority.';
  end if;

  if position(
       $needle$link.match_status = 'confirmed'$needle$
       in pg_get_functiondef(
         'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: canonicalization does not copy only confirmed provider selections.';
  end if;

  if exists (
    select 1
    from public.provider_entity_links link
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id::text = link.registry_entity_id
    where link.registry_entity_type = 'track'
      and link.match_status = 'confirmed'
    group by suggestion.id, link.provider
    having count(*) > 1
  ) then
    raise exception
      'FAIL: a Track Intake provider still has multiple confirmed identities.';
  end if;

  select id
  into v_playlist_id
  from public.wk_playlists
  where slug = 'top-50-kenyan-songs-of-2025';

  if v_playlist_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.wk_playlists
    where id = v_playlist_id
      and status = 'published'
      and authority_revision = 54
  ) then
    raise exception
      'FAIL: Top 50 publication lifecycle changed during provider repair.';
  end if;

  select
    suggestion.id,
    suggestion.canonicalized_track_id
  into
    v_suggestion_id,
    v_track_id
  from public.registry_provider_track_suggestions suggestion
  join public.wk_playlist_items item
    on item.id = suggestion.source_playlist_item_id
  where suggestion.source_playlist_id = v_playlist_id
    and item.position = 22
  limit 1;

  if not exists (
    select 1
    from public.provider_entity_links
    where registry_entity_type = 'track'
      and registry_entity_id = v_suggestion_id::text
      and provider = 'apple_music'
      and provider_entity_id = '1784531965'
      and match_status = 'confirmed'
  )
  or not exists (
    select 1
    from public.provider_entity_links
    where registry_entity_type = 'track'
      and registry_entity_id = v_track_id::text
      and provider = 'apple_music'
      and provider_entity_id = '1784531965'
      and match_status = 'confirmed'
  ) then
    raise exception
      'FAIL: correct Tuma Madoo Apple identity is not confirmed.';
  end if;

  if not exists (
    select 1
    from public.provider_entity_links
    where registry_entity_type = 'track'
      and registry_entity_id = v_suggestion_id::text
      and provider = 'apple_music'
      and provider_entity_id = '1850093111'
      and match_status = 'superseded'
  )
  or not exists (
    select 1
    from public.provider_entity_links
    where registry_entity_type = 'track'
      and registry_entity_id = v_track_id::text
      and provider = 'apple_music'
      and provider_entity_id = '1850093111'
      and match_status = 'superseded'
  ) then
    raise exception
      'FAIL: accidental Tuma Madoo remix identity was not superseded.';
  end if;

  if not exists (
    select 1
    from public.wk_playlist_items
    where playlist_id = v_playlist_id
      and position = 22
      and provider_key = 'apple_music'
      and provider_track_id = '1784531965'
      and isrc = 'QZZ7U2402374'
      and duration_ms = 203060
  ) then
    raise exception
      'FAIL: published Tuma Madoo item no longer points at the corrected original song.';
  end if;
end;
$verify_m231$;

select jsonb_build_object(
  'verification','PASS',
  'provider_inspection_is_evidence_only',true,
  'explicit_provider_selection',true,
  'provider_supersession_history',true,
  'accepted_enrichment_replacement',true,
  'canonicalization_confirmed_only',true,
  'tuma_madoo_correct_provider','1784531965',
  'tuma_madoo_accidental_provider_status','superseded'
) as phase_5b_track_intake_provider_selection_acceptance;
