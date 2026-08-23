begin;

select pg_advisory_xact_lock(hashtextextended('wakilisha:track-lyrics-authority', 0));

do $preflight$
begin
  if to_regclass('editorial.track_lyrics_versions') is not null
     or to_regclass('editorial.track_lyrics_documents') is not null then
    raise exception 'Track Lyrics authority already exists';
  end if;
end;
$preflight$;

create table editorial.track_lyrics_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  track_id uuid not null references public.registry_tracks(id) on update cascade on delete restrict,
  version_number bigint not null,
  language_code text not null default 'und',
  timing_mode text not null default 'plain',
  lines jsonb not null,
  plain_text text not null,
  source_kind text not null default 'editorial',
  rights_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint track_lyrics_versions_number_check check (version_number >= 1),
  constraint track_lyrics_versions_language_check check (btrim(language_code) <> ''),
  constraint track_lyrics_versions_timing_check check (timing_mode in ('plain', 'line')),
  constraint track_lyrics_versions_lines_check check (jsonb_typeof(lines) = 'array'),
  constraint track_lyrics_versions_source_check check (source_kind in ('editorial', 'contributor', 'licensed')),
  constraint track_lyrics_versions_track_number_key unique (track_id, version_number),
  constraint track_lyrics_versions_id_track_key unique (id, track_id)
);

create table editorial.track_lyrics_documents (
  track_id uuid primary key references public.registry_tracks(id) on update cascade on delete restrict,
  authority_revision bigint not null default 1,
  current_working_version_id uuid,
  current_published_version_id uuid,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint track_lyrics_documents_revision_check check (authority_revision >= 1),
  constraint track_lyrics_documents_working_fkey
    foreign key (current_working_version_id, track_id)
    references editorial.track_lyrics_versions(id, track_id)
    on update cascade on delete restrict,
  constraint track_lyrics_documents_published_fkey
    foreign key (current_published_version_id, track_id)
    references editorial.track_lyrics_versions(id, track_id)
    on update cascade on delete restrict
);

create index track_lyrics_versions_track_created_idx
  on editorial.track_lyrics_versions(track_id, created_at desc, id);

alter table editorial.track_lyrics_versions enable row level security;
alter table editorial.track_lyrics_documents enable row level security;
revoke all on table editorial.track_lyrics_versions from public, anon, authenticated;
revoke all on table editorial.track_lyrics_documents from public, anon, authenticated;

create or replace function editorial.protect_track_lyrics_version()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception 'Track Lyrics versions are immutable';
end;
$function$;

create trigger track_lyrics_versions_immutable
before update or delete
on editorial.track_lyrics_versions
for each row execute function editorial.protect_track_lyrics_version();

revoke all on function editorial.protect_track_lyrics_version() from public, anon, authenticated;

create or replace function public.get_admin_track_lyrics_workspace(
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
  v_document editorial.track_lyrics_documents%rowtype;
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

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = p_track_id;

  return jsonb_build_object(
    'track_id', p_track_id,
    'authority_revision', coalesce(v_document.authority_revision, 1),
    'current_working_version_id', v_document.current_working_version_id,
    'current_published_version_id', v_document.current_published_version_id,
    'working', (
      select jsonb_build_object(
        'id', version.id,
        'version_number', version.version_number,
        'language_code', version.language_code,
        'timing_mode', version.timing_mode,
        'lines', version.lines,
        'plain_text', version.plain_text,
        'source_kind', version.source_kind,
        'rights_note', version.rights_note,
        'created_at', version.created_at
      )
      from editorial.track_lyrics_versions version
      where version.id = v_document.current_working_version_id
    ),
    'published', (
      select jsonb_build_object(
        'id', version.id,
        'version_number', version.version_number,
        'language_code', version.language_code,
        'timing_mode', version.timing_mode,
        'lines', version.lines,
        'plain_text', version.plain_text,
        'source_kind', version.source_kind,
        'rights_note', version.rights_note,
        'created_at', version.created_at
      )
      from editorial.track_lyrics_versions version
      where version.id = v_document.current_published_version_id
    ),
    'can_edit', (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('save_content'), false)
    ),
    'can_publish', (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('manage_review_queue'), false)
    )
  );
end;
$function$;

revoke all on function public.get_admin_track_lyrics_workspace(uuid) from public, anon;
grant execute on function public.get_admin_track_lyrics_workspace(uuid) to authenticated;

create or replace function public.save_track_lyrics_draft(
  p_track_id uuid,
  p_expected_authority_revision bigint,
  p_language_code text,
  p_timing_mode text,
  p_lines jsonb,
  p_source_kind text default 'editorial',
  p_rights_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial', 'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_document editorial.track_lyrics_documents%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_plain_text text;
  v_line jsonb;
  v_start numeric;
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

  if not exists (
    select 1 from public.registry_tracks track
    where track.id = p_track_id and track.status = 'active'
  ) then
    raise exception 'Active Registry Track does not exist';
  end if;

  if p_expected_authority_revision is null or p_expected_authority_revision < 1 then
    raise exception 'Expected Lyrics authority revision is required';
  end if;

  if btrim(coalesce(p_language_code, '')) = '' then
    raise exception 'Lyrics language code is required';
  end if;

  if p_timing_mode not in ('plain', 'line') then
    raise exception 'Lyrics timing mode must be plain or line';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Lyrics lines must be a non-empty array';
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

  insert into editorial.track_lyrics_documents (
    track_id,
    authority_revision,
    updated_by
  )
  values (
    p_track_id,
    1,
    v_actor
  )
  on conflict (track_id) do nothing;

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = p_track_id
  for update;

  if v_document.authority_revision <> p_expected_authority_revision then
    raise exception 'Lyrics changed somewhere else. Reload and try again.';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into v_version_number
  from editorial.track_lyrics_versions version
  where version.track_id = p_track_id;

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
    p_track_id,
    v_version_number,
    lower(btrim(p_language_code)),
    p_timing_mode,
    p_lines,
    v_plain_text,
    coalesce(nullif(btrim(p_source_kind), ''), 'editorial'),
    nullif(btrim(p_rights_note), ''),
    v_actor
  )
  returning id into v_version_id;

  update editorial.track_lyrics_documents document
  set
    current_working_version_id = v_version_id,
    authority_revision = document.authority_revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where document.track_id = p_track_id
  returning document.* into v_document;

  return jsonb_build_object(
    'track_id', p_track_id,
    'version_id', v_version_id,
    'version_number', v_version_number,
    'authority_revision', v_document.authority_revision
  );
end;
$function$;

revoke all on function public.save_track_lyrics_draft(uuid, bigint, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.save_track_lyrics_draft(uuid, bigint, text, text, jsonb, text, text) to authenticated;

create or replace function public.publish_track_lyrics_version(
  p_track_id uuid,
  p_version_id uuid,
  p_expected_authority_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_document editorial.track_lyrics_documents%rowtype;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
  ) then
    raise exception 'Lyrics publish permission is required';
  end if;

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = p_track_id
  for update;

  if not found then
    raise exception 'Lyrics document does not exist';
  end if;

  if v_document.authority_revision <> p_expected_authority_revision then
    raise exception 'Lyrics changed somewhere else. Reload and try again.';
  end if;

  if not exists (
    select 1
    from editorial.track_lyrics_versions version
    where version.id = p_version_id
      and version.track_id = p_track_id
  ) then
    raise exception 'Lyrics version does not belong to this Track';
  end if;

  update editorial.track_lyrics_documents document
  set
    current_published_version_id = p_version_id,
    authority_revision = document.authority_revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where document.track_id = p_track_id
  returning document.* into v_document;

  return jsonb_build_object(
    'track_id', p_track_id,
    'version_id', p_version_id,
    'authority_revision', v_document.authority_revision,
    'published', true
  );
end;
$function$;

revoke all on function public.publish_track_lyrics_version(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.publish_track_lyrics_version(uuid, uuid, bigint) to authenticated;

create or replace function public.get_public_track_lyrics(
  p_track_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select case
    when version.id is null then null
    else jsonb_build_object(
      'track_id', document.track_id,
      'version_id', version.id,
      'version_number', version.version_number,
      'language_code', version.language_code,
      'timing_mode', version.timing_mode,
      'lines', version.lines,
      'plain_text', version.plain_text,
      'source_kind', version.source_kind
    )
  end
  from editorial.track_lyrics_documents document
  left join editorial.track_lyrics_versions version
    on version.id = document.current_published_version_id
   and version.track_id = document.track_id
  where document.track_id = p_track_id;
$function$;

revoke all on function public.get_public_track_lyrics(uuid) from public;
grant execute on function public.get_public_track_lyrics(uuid) to anon, authenticated;

commit;
