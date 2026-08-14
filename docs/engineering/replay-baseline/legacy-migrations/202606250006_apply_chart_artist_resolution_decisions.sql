alter table public.chart_artist_resolution_decisions
  add column if not exists applied_at timestamptz,
  add column if not exists apply_result_json jsonb;

create or replace function public.admin_apply_chart_artist_resolution_decision(
  p_decision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision record;
  v_entry record;
  v_primary_artist record;
  v_selected_count integer := 0;
  v_track_inserted integer := 0;
  v_track_existing integer := 0;
  v_result jsonb;
begin
  if not (
    coalesce(public.current_user_has_capability('manage_charts'), false)
    or coalesce(public.current_user_has_capability('manage_registry'), false)
    or coalesce(public.current_user_is_administrator(), false)
  ) then
    raise exception 'insufficient_privilege';
  end if;

  select *
  into v_decision
  from public.chart_artist_resolution_decisions
  where id = p_decision_id
  limit 1;

  if v_decision.id is null then
    raise exception 'decision_not_found';
  end if;

  select *
  into v_entry
  from public.wk_chart_entries_v2
  where id::text = v_decision.chart_entry_id
  limit 1;

  if v_entry.id is null then
    raise exception 'chart_entry_not_found';
  end if;

  if v_decision.decision_status = 'resolved' then
    return coalesce(v_decision.apply_result_json, jsonb_build_object(
      'decisionId', v_decision.id,
      'alreadyResolved', true
    ));
  end if;

  if v_decision.decision_type = 'accepted_as_group' then
    v_result := jsonb_build_object(
      'decisionId', v_decision.id,
      'chartEntryId', v_decision.chart_entry_id,
      'decisionType', v_decision.decision_type,
      'trackCreditsInserted', 0,
      'trackCreditsExisting', 0,
      'message', 'Accepted as group/collab. No registry credits were changed.'
    );

    update public.chart_artist_resolution_decisions
    set
      decision_status = 'resolved',
      applied_at = now(),
      apply_result_json = v_result,
      updated_at = now()
    where id = v_decision.id;

    return v_result;
  end if;

  if v_decision.decision_type not in ('split_plan', 'alias_plan') then
    raise exception 'decision_type_not_applyable';
  end if;

  if jsonb_typeof(coalesce(v_decision.selected_artists, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(v_decision.selected_artists) = 0 then
    raise exception 'selected_artists_required';
  end if;

  if v_entry.canonical_track_id is null or btrim(v_entry.canonical_track_id::text) = '' then
    raise exception 'canonical_track_required';
  end if;

  create temporary table if not exists pg_temp.chart_artist_resolution_selected_artists (
    artist_id uuid primary key,
    role text not null,
    credit_order integer not null,
    display_credit text
  ) on commit drop;

  truncate table pg_temp.chart_artist_resolution_selected_artists;

  insert into pg_temp.chart_artist_resolution_selected_artists (
    artist_id,
    role,
    credit_order,
    display_credit
  )
  select distinct on ((item.value->>'artist_id')::uuid)
    (item.value->>'artist_id')::uuid,
    coalesce(nullif(item.value->>'role', ''), case when item.ordinality = 1 then 'primary_artist' else 'featured_artist' end),
    coalesce(nullif(item.value->>'credit_order', '')::integer, item.ordinality::integer),
    nullif(item.value->>'display_name', '')
  from jsonb_array_elements(v_decision.selected_artists) with ordinality as item(value, ordinality)
  where nullif(item.value->>'artist_id', '') is not null
  order by (item.value->>'artist_id')::uuid, item.ordinality;

  select count(*)
  into v_selected_count
  from pg_temp.chart_artist_resolution_selected_artists;

  if v_selected_count = 0 then
    raise exception 'selected_artists_required';
  end if;

  if exists (
    select 1
    from pg_temp.chart_artist_resolution_selected_artists s
    left join public.registry_artists a
      on a.id = s.artist_id
     and a.status in ('active', 'draft', 'needs_review', 'archived')
    where a.id is null
  ) then
    raise exception 'selected_artist_not_found';
  end if;

  if exists (
    select 1
    from pg_temp.chart_artist_resolution_selected_artists s
    where s.role not in ('primary_artist', 'featured_artist', 'collaborator', 'producer', 'composer', 'remixer', 'group_member', 'unknown')
  ) then
    raise exception 'invalid_artist_role';
  end if;

  select a.id, a.slug, a.display_name
  into v_primary_artist
  from pg_temp.chart_artist_resolution_selected_artists s
  join public.registry_artists a on a.id = s.artist_id
  order by
    case when s.role = 'primary_artist' then 0 else 1 end,
    s.credit_order asc,
    a.display_name asc
  limit 1;

  select count(*)
  into v_track_existing
  from pg_temp.chart_artist_resolution_selected_artists s
  join public.registry_track_artists rta
    on rta.track_id = v_entry.canonical_track_id::uuid
   and rta.artist_id = s.artist_id
   and coalesce(rta.status, 'active') <> 'archived';

  with selected as (
    select
      s.artist_id,
      s.role,
      s.credit_order,
      s.display_credit,
      a.slug,
      a.display_name
    from pg_temp.chart_artist_resolution_selected_artists s
    join public.registry_artists a on a.id = s.artist_id
  ),
  inserted as (
    insert into public.registry_track_artists (
      track_id,
      artist_id,
      artist_slug,
      artist_name_text,
      role,
      is_primary,
      is_featured,
      credit_order,
      display_credit,
      source,
      confidence,
      status,
      metadata,
      created_at,
      updated_at
    )
    select
      v_entry.canonical_track_id::uuid,
      selected.artist_id,
      selected.slug,
      selected.display_name,
      selected.role,
      selected.role = 'primary_artist' or selected.credit_order = 1,
      selected.role = 'featured_artist' or selected.credit_order > 1,
      selected.credit_order,
      coalesce(selected.display_credit, selected.display_name),
      'chart_artist_resolution',
      100,
      'active',
      jsonb_build_object(
        'chart_artist_resolution_decision_id', v_decision.id::text,
        'chart_entry_id', v_decision.chart_entry_id,
        'edition_id', v_decision.edition_id,
        'raw_artist_name', v_decision.raw_artist_name,
        'decision_type', v_decision.decision_type,
        'applied_at', now()
      ),
      now(),
      now()
    from selected
    where not exists (
      select 1
      from public.registry_track_artists existing
      where existing.track_id = v_entry.canonical_track_id::uuid
        and existing.artist_id = selected.artist_id
        and coalesce(existing.status, 'active') <> 'archived'
    )
    returning id
  )
  select count(*)
  into v_track_inserted
  from inserted;

  update public.wk_chart_entries_v2
  set
    canonical_artist_id = v_primary_artist.id::text,
    artist_slug = coalesce(nullif(artist_slug, ''), v_primary_artist.slug),
    updated_at = now()
  where id = v_entry.id;

  v_result := jsonb_build_object(
    'decisionId', v_decision.id,
    'chartEntryId', v_decision.chart_entry_id,
    'trackId', v_entry.canonical_track_id,
    'primaryArtistId', v_primary_artist.id,
    'primaryArtistSlug', v_primary_artist.slug,
    'selectedArtistCount', v_selected_count,
    'trackCreditsInserted', v_track_inserted,
    'trackCreditsExisting', v_track_existing,
    'decisionType', v_decision.decision_type,
    'message', 'Resolution decision applied to registry track credits.'
  );

  update public.chart_artist_resolution_decisions
  set
    decision_status = 'resolved',
    applied_at = now(),
    apply_result_json = v_result,
    updated_at = now()
  where id = v_decision.id;

  return v_result;
end;
$$;

grant execute on function public.admin_apply_chart_artist_resolution_decision(uuid) to authenticated;
