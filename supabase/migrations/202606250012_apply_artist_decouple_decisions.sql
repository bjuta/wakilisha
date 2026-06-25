create or replace function public.admin_apply_artist_decouple_decision(
  p_decision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision record;
  v_selected_count integer := 0;
  v_result jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  if p_decision_id is null then
    raise exception 'decision_id_required';
  end if;

  select *
  into v_decision
  from public.registry_artist_decouple_decisions
  where id = p_decision_id
  for update;

  if v_decision.id is null then
    raise exception 'decouple_decision_not_found';
  end if;

  if v_decision.decision_status = 'applied' then
    return coalesce(v_decision.apply_result_json, '{}'::jsonb);
  end if;

  if v_decision.decision_status <> 'ready' then
    raise exception 'decouple_decision_not_ready';
  end if;

  if v_decision.decision_type not in ('split_combined_artist', 'split_raw_credit') then
    raise exception 'decouple_decision_type_not_applyable';
  end if;

  if v_decision.source_artist_id is null then
    raise exception 'source_artist_required';
  end if;

  if jsonb_typeof(coalesce(v_decision.selected_artists, '[]'::jsonb)) <> 'array' then
    raise exception 'selected_artists_must_be_array';
  end if;

  select count(*)
  into v_selected_count
  from jsonb_array_elements(coalesce(v_decision.selected_artists, '[]'::jsonb)) item(value)
  where nullif(item.value ->> 'artist_id', '') is not null;

  if v_selected_count < 2 then
    raise exception 'at_least_two_selected_artists_required';
  end if;

  v_result := public.admin_decouple_registry_artist(
    v_decision.source_artist_id,
    v_decision.selected_artists,
    v_decision.note,
    true,
    v_decision.chart_primary_artist_id
  );

  update public.registry_artist_decouple_decisions
  set
    decision_status = 'applied',
    applied_at = now(),
    apply_result_json = v_result,
    updated_at = now()
  where id = v_decision.id;

  return v_result;
end;
$$;

grant execute on function public.admin_apply_artist_decouple_decision(uuid) to authenticated;
