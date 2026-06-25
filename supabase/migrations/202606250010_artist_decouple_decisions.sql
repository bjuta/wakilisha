create extension if not exists pgcrypto;

create table if not exists public.registry_artist_decouple_decisions (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_type text not null check (source_type in ('charts', 'registry', 'provider_intake', 'artist_intake', 'manual')),
  source_table text,
  source_id text,
  source_label text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  source_artist_id uuid references public.registry_artists(id) on delete set null,
  raw_credit_text text,
  parsed_tokens jsonb not null default '[]'::jsonb,
  selected_artists jsonb not null default '[]'::jsonb,
  chart_primary_artist_id uuid references public.registry_artists(id) on delete set null,
  decision_type text not null default 'split_combined_artist' check (
    decision_type in ('split_combined_artist', 'split_raw_credit', 'block_alias', 'needs_follow_up', 'not_a_decouple')
  ),
  decision_status text not null default 'draft' check (
    decision_status in ('draft', 'ready', 'applied', 'blocked', 'failed', 'superseded')
  ),
  note text,
  actor_id uuid default auth.uid(),
  applied_at timestamptz,
  apply_result_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registry_artist_decouple_decisions_source_type_idx
  on public.registry_artist_decouple_decisions (source_type, decision_status, updated_at desc);

create index if not exists registry_artist_decouple_decisions_source_artist_idx
  on public.registry_artist_decouple_decisions (source_artist_id, updated_at desc);

create index if not exists registry_artist_decouple_decisions_status_idx
  on public.registry_artist_decouple_decisions (decision_status, updated_at desc);

alter table public.registry_artist_decouple_decisions enable row level security;

drop policy if exists registry_artist_decouple_decisions_admin_select
  on public.registry_artist_decouple_decisions;

create policy registry_artist_decouple_decisions_admin_select
  on public.registry_artist_decouple_decisions
  for select
  to authenticated
  using (public.current_user_has_capability('manage_registry'));

drop policy if exists registry_artist_decouple_decisions_admin_insert
  on public.registry_artist_decouple_decisions;

create policy registry_artist_decouple_decisions_admin_insert
  on public.registry_artist_decouple_decisions
  for insert
  to authenticated
  with check (public.current_user_has_capability('manage_registry'));

drop policy if exists registry_artist_decouple_decisions_admin_update
  on public.registry_artist_decouple_decisions;

create policy registry_artist_decouple_decisions_admin_update
  on public.registry_artist_decouple_decisions
  for update
  to authenticated
  using (public.current_user_has_capability('manage_registry'))
  with check (public.current_user_has_capability('manage_registry'));

grant select, insert, update on public.registry_artist_decouple_decisions to authenticated;

create or replace function public.admin_get_artist_decouple_decisions(
  p_source_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_items jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'source_key', d.source_key,
        'source_type', d.source_type,
        'source_table', d.source_table,
        'source_id', d.source_id,
        'source_label', d.source_label,
        'source_snapshot', d.source_snapshot,
        'source_artist_id', d.source_artist_id,
        'raw_credit_text', d.raw_credit_text,
        'parsed_tokens', d.parsed_tokens,
        'selected_artists', d.selected_artists,
        'chart_primary_artist_id', d.chart_primary_artist_id,
        'decision_type', d.decision_type,
        'decision_status', d.decision_status,
        'note', d.note,
        'actor_id', d.actor_id,
        'applied_at', d.applied_at,
        'apply_result_json', d.apply_result_json,
        'created_at', d.created_at,
        'updated_at', d.updated_at
      )
      order by d.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.registry_artist_decouple_decisions d
  where p_source_type is null
     or d.source_type = p_source_type;

  return v_items;
end;
$$;

create or replace function public.admin_upsert_artist_decouple_decision(
  p_source_type text,
  p_source_table text default null,
  p_source_id text default null,
  p_source_label text default null,
  p_source_artist_id uuid default null,
  p_raw_credit_text text default null,
  p_source_snapshot jsonb default '{}'::jsonb,
  p_parsed_tokens jsonb default '[]'::jsonb,
  p_selected_artists jsonb default '[]'::jsonb,
  p_chart_primary_artist_id uuid default null,
  p_decision_type text default 'split_combined_artist',
  p_decision_status text default 'draft',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_type text;
  v_decision_type text;
  v_decision_status text;
  v_source_key text;
  v_source_label text;
  v_decision record;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  v_source_type := nullif(trim(coalesce(p_source_type, '')), '');
  if v_source_type not in ('charts', 'registry', 'provider_intake', 'artist_intake', 'manual') then
    raise exception 'invalid_source_type';
  end if;

  v_decision_type := coalesce(nullif(trim(p_decision_type), ''), 'split_combined_artist');
  if v_decision_type not in ('split_combined_artist', 'split_raw_credit', 'block_alias', 'needs_follow_up', 'not_a_decouple') then
    raise exception 'invalid_decision_type';
  end if;

  v_decision_status := coalesce(nullif(trim(p_decision_status), ''), 'draft');
  if v_decision_status not in ('draft', 'ready', 'applied', 'blocked', 'failed', 'superseded') then
    raise exception 'invalid_decision_status';
  end if;

  if jsonb_typeof(coalesce(p_parsed_tokens, '[]'::jsonb)) <> 'array' then
    raise exception 'parsed_tokens_must_be_array';
  end if;

  if jsonb_typeof(coalesce(p_selected_artists, '[]'::jsonb)) <> 'array' then
    raise exception 'selected_artists_must_be_array';
  end if;

  v_source_label := nullif(trim(coalesce(p_source_label, p_raw_credit_text, '')), '');
  if v_source_label is null then
    raise exception 'source_label_required';
  end if;

  v_source_key := v_source_type || ':' || coalesce(
    nullif(trim(p_source_id), ''),
    p_source_artist_id::text,
    public.wk_slugify_text(v_source_label)
  );

  insert into public.registry_artist_decouple_decisions (
    source_key,
    source_type,
    source_table,
    source_id,
    source_label,
    source_snapshot,
    source_artist_id,
    raw_credit_text,
    parsed_tokens,
    selected_artists,
    chart_primary_artist_id,
    decision_type,
    decision_status,
    note,
    actor_id,
    updated_at
  )
  values (
    v_source_key,
    v_source_type,
    nullif(trim(coalesce(p_source_table, '')), ''),
    nullif(trim(coalesce(p_source_id, '')), ''),
    v_source_label,
    coalesce(p_source_snapshot, '{}'::jsonb),
    p_source_artist_id,
    nullif(trim(coalesce(p_raw_credit_text, '')), ''),
    coalesce(p_parsed_tokens, '[]'::jsonb),
    coalesce(p_selected_artists, '[]'::jsonb),
    p_chart_primary_artist_id,
    v_decision_type,
    v_decision_status,
    nullif(p_note, ''),
    auth.uid(),
    now()
  )
  on conflict (source_key) do update
  set
    source_table = excluded.source_table,
    source_id = excluded.source_id,
    source_label = excluded.source_label,
    source_snapshot = excluded.source_snapshot,
    source_artist_id = excluded.source_artist_id,
    raw_credit_text = excluded.raw_credit_text,
    parsed_tokens = excluded.parsed_tokens,
    selected_artists = excluded.selected_artists,
    chart_primary_artist_id = excluded.chart_primary_artist_id,
    decision_type = excluded.decision_type,
    decision_status = excluded.decision_status,
    note = excluded.note,
    actor_id = auth.uid(),
    updated_at = now()
  returning *
  into v_decision;

  return jsonb_build_object(
    'id', v_decision.id,
    'source_key', v_decision.source_key,
    'source_type', v_decision.source_type,
    'source_label', v_decision.source_label,
    'source_artist_id', v_decision.source_artist_id,
    'decision_type', v_decision.decision_type,
    'decision_status', v_decision.decision_status,
    'note', v_decision.note,
    'created_at', v_decision.created_at,
    'updated_at', v_decision.updated_at
  );
end;
$$;

grant execute on function public.admin_get_artist_decouple_decisions(text) to authenticated;
grant execute on function public.admin_upsert_artist_decouple_decision(text, text, text, text, uuid, text, jsonb, jsonb, jsonb, uuid, text, text, text) to authenticated;
