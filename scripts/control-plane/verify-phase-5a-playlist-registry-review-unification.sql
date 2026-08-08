do $verify_phase_5a_m216$
declare
  v_definition text;
  v_media_constraint text;
begin
  select pg_get_constraintdef(c.oid)
  into v_media_constraint
  from pg_constraint c
  where c.conrelid = 'public.registry_media_assets'::regclass
    and c.conname = 'registry_media_assets_asset_purpose_check';

  if position('playlist_cover' in coalesce(v_media_constraint, '')) = 0 then
    raise exception
      'FAIL: legacy Media compatibility still rejects playlist_cover';
  end if;

  if to_regprocedure(
       'editorial.ensure_playlist_registry_intake_item(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_reject_registry_track_intake(uuid,text)'
     ) is null
  then
    raise exception
      'FAIL: one or more M216 Playlist/Registry authorities are missing';
  end if;

  if exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.status = 'needs_review'
      and suggestion.canonical_track_id is null
      and suggestion.source_playlist_item_id is null
  ) then
    raise exception
      'FAIL: pending Registry intake still exists outside Playlist item authority';
  end if;

  if exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    join public.wk_playlist_items item
      on item.id = suggestion.source_playlist_item_id
    where suggestion.status = 'needs_review'
      and suggestion.canonical_track_id is null
      and suggestion.canonicalized_track_id is null
      and (
        item.lifecycle_state <> 'active'
        or item.match_status <> 'needs_review'
        or item.registry_track_id is not null
        or item.position is null
      )
  ) then
    raise exception
      'FAIL: a pending Registry-review Playlist item is not structurally editable';
  end if;

  if exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    join public.wk_playlist_items item
      on item.id = suggestion.source_playlist_item_id
    where suggestion.status = 'needs_review'
      and suggestion.playlist_note is distinct from item.notes
  ) then
    raise exception
      'FAIL: pending Registry-review note is not carried into Playlist item authority';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: retired special pending-track editor commands remain authenticated';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.save_playlist_item_note(uuid,uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.reorder_playlist_items_with_intake_slots(uuid,bigint,uuid[],text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: unified Playlist note or reorder authority is unavailable to authenticated editors';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_get_registry_track_intake_enrichment(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_record_registry_track_intake_provider_evidence(uuid,text,text,text,jsonb,jsonb,numeric)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_save_registry_track_intake_enrichment(uuid,jsonb,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_reject_registry_track_intake(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Track Intake review or enrichment surface is not reachable by authenticated Registry reviewers';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Legacy un-enriched Track Intake resolver remains directly authenticated';
  end if;

  select pg_get_functiondef(
    'editorial.materialize_canonicalized_playlist_registry_intake()'::regprocedure
  )
  into v_definition;

  if position('new.source_playlist_item_id is not null' in v_definition) = 0
     or position('match_status = ' in v_definition) = 0
     or position('matched' in v_definition) = 0
  then
    raise exception
      'FAIL: Registry canonicalization does not update the existing Playlist item in place';
  end if;


if to_regprocedure(
     'public.admin_get_registry_track_intake_enrichment(uuid)'
   ) is null
   or to_regprocedure(
     'public.admin_record_registry_track_intake_provider_evidence(uuid,text,text,text,jsonb,jsonb,numeric)'
   ) is null
   or to_regprocedure(
     'public.admin_save_registry_track_intake_enrichment(uuid,jsonb,text)'
   ) is null
   or to_regprocedure(
     'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
   ) is null
then
  raise exception
    'FAIL: Track Intake enrichment authority is incomplete';
end if;

if exists (
  select 1
  from public.registry_provider_track_suggestions suggestion
  where suggestion.status = 'needs_review'
    and not exists (
      select 1
      from public.provider_field_observations observation
      where observation.provider_item_id =
        suggestion.id::text
        and observation.entity_type = 'track'
    )
) then
  raise exception
    'FAIL: a live Track Intake item has no provider evidence observations';
end if;

if has_function_privilege(
     'authenticated',
     'public.admin_resolve_registry_track_intake(uuid,uuid,text)',
     'EXECUTE'
   )
then
  raise exception
    'FAIL: un-enriched Track Intake resolution remains directly authenticated';
end if;

if not has_function_privilege(
     'authenticated',
     'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)',
     'EXECUTE'
   )
then
  raise exception
    'FAIL: enriched Track Intake resolution is not available to Registry reviewers';
end if;


select pg_get_functiondef(
  'editorial.guard_new_playlist_item_registry_identity()'::regprocedure
) into v_definition;

if position('registry_intake_suggestion_id' in v_definition) = 0
   or position('suggestion.source_playlist_id = new.playlist_id' in v_definition) = 0
   or position('suggestion.reserved_position = new.position' in v_definition) = 0
then
  raise exception
    'FAIL: M216 pending Registry identity exception is missing or too broad';
end if;

if exists (
  select 1
  from public.provider_field_observations observation
  where observation.entity_type not in ('release', 'track', 'artist')
) then
  raise exception 'FAIL: provider observations escaped the shared Registry entity taxonomy';
end if;

if exists (
  select 1
  from public.provider_entity_links link
  where link.registry_entity_type not in ('release', 'track', 'artist')
) then
  raise exception 'FAIL: provider links escaped the shared Registry entity taxonomy';
end if;

if exists (
  select 1
  from public.registry_enrichment_suggestions suggestion
  where suggestion.registry_entity_type not in ('release', 'track', 'artist')
) then
  raise exception 'FAIL: enrichment suggestions escaped the shared Registry entity taxonomy';
end if;

  select pg_get_functiondef(
    'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'::regprocedure
  )
  into v_definition;

  if position(
       'v_suggestion.canonical_track_id'
       in v_definition
     ) = 0
     or position(
       'p_registry_track_id'
       in v_definition
     ) = 0
     or position(
       'Enrichment review cannot silently remap it to another track.'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Enrichment review can remap an already matched canonical track';
  end if;

  raise notice
    'PASS: M216 unifies Playlist editing, Track Intake review and provider enrichment, enriched canonical resolution, and playlist_cover Media compatibility.';
end;
$verify_phase_5a_m216$;
