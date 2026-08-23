begin;

select pg_advisory_xact_lock(hashtextextended('wakilisha:track-lyrics-contribution-authority', 0));

do $preflight$
begin
  if to_regclass('editorial.track_lyrics_contributions') is not null then
    raise exception 'Track Lyrics contribution authority already exists';
  end if;

  if to_regclass('editorial.track_lyrics_versions') is null
     or to_regclass('editorial.track_lyrics_documents') is null then
    raise exception 'Track Lyrics publication authority is required first';
  end if;
end;
$preflight$;

create table editorial.track_lyrics_contributions (
  id uuid primary key default extensions.gen_random_uuid(),
  track_id uuid not null references public.registry_tracks(id) on update cascade on delete restrict,
  contributor_id uuid references auth.users(id) on delete set null,
  language_code text not null default 'und',
  timing_mode text not null default 'plain',
  lines jsonb not null,
  plain_text text not null,
  source_description text,
  status text not null default 'submitted',
  accepted_version_id uuid references editorial.track_lyrics_versions(id) on update cascade on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint track_lyrics_contributions_language_check check (btrim(language_code) <> ''),
  constraint track_lyrics_contributions_timing_check check (timing_mode in ('plain', 'line')),
  constraint track_lyrics_contributions_lines_check check (jsonb_typeof(lines) = 'array'),
  constraint track_lyrics_contributions_plain_text_check check (btrim(plain_text) <> ''),
  constraint track_lyrics_contributions_status_check check (status in ('submitted', 'promoted', 'rejected')),
  constraint track_lyrics_contributions_review_state_check check (
    (status = 'submitted' and reviewed_at is null and reviewed_by is null and accepted_version_id is null)
    or (status = 'promoted' and reviewed_at is not null and reviewed_by is not null and accepted_version_id is not null)
    or (status = 'rejected' and reviewed_at is not null and reviewed_by is not null and accepted_version_id is null)
  )
);

create index track_lyrics_contributions_track_status_created_idx
  on editorial.track_lyrics_contributions(track_id, status, created_at desc, id);

alter table editorial.track_lyrics_contributions enable row level security;
revoke all on table editorial.track_lyrics_contributions from public, anon, authenticated;

create or replace function public.submit_track_lyrics_contribution(
  p_track_id uuid,
  p_language_code text,
  p_timing_mode text,
  p_lines jsonb,
  p_source_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial', 'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_contribution_id uuid;
  v_created_at timestamptz;
  v_plain_text text;
  v_line jsonb;
  v_start numeric;
begin
  if v_actor is null then
    raise exception 'Sign in to contribute Lyrics';
  end if;

  if not exists (
    select 1
    from public.registry_tracks track
    where track.id = p_track_id
      and track.status = 'active'
  ) then
    raise exception 'Active Registry Track does not exist';
  end if;

  if btrim(coalesce(p_language_code, '')) = '' then
    raise exception 'Lyrics language code is required';
  end if;

  if p_timing_mode not in ('plain', 'line') then
    raise exception 'Lyrics timing mode must be plain or line';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one Lyrics line';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object'
       or btrim(coalesce(v_line ->> 'text', '')) = '' then
      raise exception 'Every Lyrics line requires text';
    end if;

    if p_timing_mode = 'line' then
      begin
        v_start := (v_line ->> 'start_seconds')::numeric;
      exception when others then
        raise exception 'Timed Lyrics lines require numeric start_seconds';
      end;

      if v_start < 0 then
        raise exception 'Lyrics start_seconds cannot be negative';
      end if;
    end if;
  end loop;

  select string_agg(btrim(value ->> 'text'), E'\n' order by ordinality)
  into v_plain_text
  from jsonb_array_elements(p_lines) with ordinality as line(value, ordinality);

  insert into editorial.track_lyrics_contributions (
    track_id,
    contributor_id,
    language_code,
    timing_mode,
    lines,
    plain_text,
    source_description
  )
  values (
    p_track_id,
    v_actor,
    lower(btrim(p_language_code)),
    p_timing_mode,
    p_lines,
    v_plain_text,
    nullif(btrim(coalesce(p_source_description, '')), '')
  )
  returning id, created_at
  into v_contribution_id, v_created_at;

  return jsonb_build_object(
    'contribution_id', v_contribution_id,
    'track_id', p_track_id,
    'status', 'submitted',
    'created_at', v_created_at
  );
end;
$function$;

revoke all on function public.submit_track_lyrics_contribution(uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_track_lyrics_contribution(uuid, text, text, jsonb, text) to authenticated;

create or replace function public.get_admin_track_lyrics_contributions(
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('save_content'), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
  ) then
    raise exception 'Content permission is required';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', contribution.id,
        'track_id', contribution.track_id,
        'contributor_id', contribution.contributor_id,
        'language_code', contribution.language_code,
        'timing_mode', contribution.timing_mode,
        'lines', contribution.lines,
        'plain_text', contribution.plain_text,
        'source_description', contribution.source_description,
        'status', contribution.status,
        'accepted_version_id', contribution.accepted_version_id,
        'reviewed_by', contribution.reviewed_by,
        'reviewed_at', contribution.reviewed_at,
        'review_note', contribution.review_note,
        'created_at', contribution.created_at
      )
      order by contribution.created_at desc, contribution.id desc
    )
    from (
      select row.*
      from editorial.track_lyrics_contributions row
      where row.track_id = p_track_id
      order by row.created_at desc, row.id desc
      limit 50
    ) contribution
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_admin_track_lyrics_contributions(uuid) from public, anon, authenticated;
grant execute on function public.get_admin_track_lyrics_contributions(uuid) to authenticated;

create or replace function public.promote_track_lyrics_contribution_to_draft(
  p_contribution_id uuid,
  p_expected_authority_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial', 'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_contribution editorial.track_lyrics_contributions%rowtype;
  v_document editorial.track_lyrics_documents%rowtype;
  v_version_id uuid;
  v_version_number bigint;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('save_content'), false)
  ) then
    raise exception 'Content edit permission is required';
  end if;

  if p_expected_authority_revision is null or p_expected_authority_revision < 1 then
    raise exception 'Expected Lyrics authority revision is required';
  end if;

  select contribution.*
  into v_contribution
  from editorial.track_lyrics_contributions contribution
  where contribution.id = p_contribution_id
  for update;

  if not found then
    raise exception 'Lyrics contribution does not exist';
  end if;

  if v_contribution.status <> 'submitted' then
    raise exception 'Lyrics contribution has already been reviewed';
  end if;

  insert into editorial.track_lyrics_documents (
    track_id,
    authority_revision,
    updated_by
  )
  values (
    v_contribution.track_id,
    1,
    v_actor
  )
  on conflict (track_id) do nothing;

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = v_contribution.track_id
  for update;

  if v_document.authority_revision <> p_expected_authority_revision then
    raise exception 'Lyrics changed somewhere else. Reload and try again.';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into v_version_number
  from editorial.track_lyrics_versions version
  where version.track_id = v_contribution.track_id;

  insert into editorial.track_lyrics_versions (
    track_id,
    version_number,
    language_code,
    timing_mode,
    lines,
    plain_text,
    source_kind,
    rights_note,
    created_by
  )
  values (
    v_contribution.track_id,
    v_version_number,
    v_contribution.language_code,
    v_contribution.timing_mode,
    v_contribution.lines,
    v_contribution.plain_text,
    'contributor',
    v_contribution.source_description,
    v_contribution.contributor_id
  )
  returning id into v_version_id;

  update editorial.track_lyrics_documents document
  set
    current_working_version_id = v_version_id,
    authority_revision = document.authority_revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where document.track_id = v_contribution.track_id
  returning document.* into v_document;

  update editorial.track_lyrics_contributions contribution
  set
    status = 'promoted',
    accepted_version_id = v_version_id,
    reviewed_by = v_actor,
    reviewed_at = now()
  where contribution.id = v_contribution.id;

  return jsonb_build_object(
    'contribution_id', v_contribution.id,
    'track_id', v_contribution.track_id,
    'version_id', v_version_id,
    'version_number', v_version_number,
    'authority_revision', v_document.authority_revision,
    'status', 'promoted'
  );
end;
$function$;

revoke all on function public.promote_track_lyrics_contribution_to_draft(uuid, bigint) from public, anon, authenticated;
grant execute on function public.promote_track_lyrics_contribution_to_draft(uuid, bigint) to authenticated;

create or replace function public.reject_track_lyrics_contribution(
  p_contribution_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_track_id uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
  ) then
    raise exception 'Review permission is required';
  end if;

  update editorial.track_lyrics_contributions contribution
  set
    status = 'rejected',
    reviewed_by = v_actor,
    reviewed_at = now(),
    review_note = nullif(btrim(coalesce(p_review_note, '')), '')
  where contribution.id = p_contribution_id
    and contribution.status = 'submitted'
  returning contribution.track_id into v_track_id;

  if v_track_id is null then
    raise exception 'Lyrics contribution does not exist or has already been reviewed';
  end if;

  return jsonb_build_object(
    'contribution_id', p_contribution_id,
    'track_id', v_track_id,
    'status', 'rejected'
  );
end;
$function$;

revoke all on function public.reject_track_lyrics_contribution(uuid, text) from public, anon, authenticated;
grant execute on function public.reject_track_lyrics_contribution(uuid, text) to authenticated;

commit;
