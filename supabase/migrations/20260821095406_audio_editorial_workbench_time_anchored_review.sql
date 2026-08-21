-- Audio Editorial Workbench: time-anchored review and canonical Media context.
--
-- Review threads target one exact immutable submitted Audio publication
-- version. Anchors are validated against the frozen delivery variant's
-- duration. Current Sound workspace technical facts are read from canonical
-- Media; no duplicate Media authority is introduced.

begin;

do $preflight$
begin
  if to_regclass('audio.publications') is null
     or to_regclass('audio.publication_versions') is null
     or to_regclass('audio.publication_version_chapters') is null
     or to_regclass('editorial.audio_publication_resources') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.variant_selections') is null
     or to_regclass('media.file_objects') is null
  then
    raise exception
      'STOP: Audio Editorial Workbench prerequisites are incomplete';
  end if;

  if to_regprocedure(
       'editorial.current_user_can_participate_audio_review(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_edit_audio(uuid)'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
     or to_regprocedure(
       'audio.current_publication_master(uuid)'
     ) is null
  then
    raise exception
      'STOP: canonical Audio authority helpers are incomplete';
  end if;

  if to_regclass('audio.publication_review_threads') is not null
     or to_regclass('audio.publication_review_comments') is not null
     or to_regprocedure(
       'public.get_audio_editorial_workbench(uuid)'
     ) is not null
     or to_regprocedure(
       'public.get_audio_editorial_media_context(uuid)'
     ) is not null
  then
    raise exception
      'STOP: Audio Editorial Workbench authority already exists';
  end if;
end;
$preflight$;

create table audio.publication_review_threads (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references editorial.resources(id)
    on update cascade
    on delete cascade,
  publication_id uuid not null
    references audio.publications(id)
    on update cascade
    on delete cascade,
  target_version_id uuid not null
    references audio.publication_versions(id)
    on update cascade
    on delete restrict,
  anchor_kind text not null,
  anchor_start_seconds numeric(14,3) not null,
  anchor_end_seconds numeric(14,3),
  status text not null default 'open',
  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  resolved_by uuid
    references auth.users(id)
    on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_review_threads_anchor_kind_check
    check (anchor_kind in ('time_point', 'time_range')),
  constraint audio_review_threads_anchor_start_check
    check (anchor_start_seconds >= 0),
  constraint audio_review_threads_anchor_shape_check
    check (
      (
        anchor_kind = 'time_point'
        and anchor_end_seconds is null
      )
      or (
        anchor_kind = 'time_range'
        and anchor_end_seconds is not null
        and anchor_end_seconds > anchor_start_seconds
      )
    ),
  constraint audio_review_threads_status_check
    check (status in ('open', 'resolved')),
  constraint audio_review_threads_resolution_check
    check (
      (
        status = 'open'
        and resolved_at is null
        and resolved_by is null
      )
      or (
        status = 'resolved'
        and resolved_at is not null
      )
    )
);

create index audio_review_threads_publication_idx
  on audio.publication_review_threads (
    publication_id,
    target_version_id,
    status,
    anchor_start_seconds,
    created_at
  );

create index audio_review_threads_resource_idx
  on audio.publication_review_threads (
    resource_id,
    status,
    created_at desc
  );

create table audio.publication_review_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null
    references audio.publication_review_threads(id)
    on update cascade
    on delete cascade,
  body_html text not null,
  body_text text not null,
  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint audio_review_comments_body_text_not_blank
    check (btrim(body_text) <> ''),
  constraint audio_review_comments_body_html_not_blank
    check (btrim(body_html) <> ''),
  constraint audio_review_comments_body_text_size
    check (length(body_text) <= 10000),
  constraint audio_review_comments_body_html_size
    check (length(body_html) <= 50000)
);

create index audio_review_comments_thread_idx
  on audio.publication_review_comments (
    thread_id,
    created_at
  );

create or replace function audio.publication_version_review_media(
  p_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, audio, media
as $function$
declare
  v_version audio.publication_versions%rowtype;
  v_delivery_url text;
  v_waveform_url text;
  v_source_probe jsonb;
  v_duration numeric;
begin
  select version.*
  into v_version
  from audio.publication_versions version
  where version.id = p_version_id;

  if not found then
    raise exception 'Audio review target version does not exist';
  end if;

  if v_version.audio_delivery_variant_id is not null then
    select
      derived.delivery_url,
      derived.technical_metadata -> 'source_probe'
    into
      v_delivery_url,
      v_source_probe
    from media.variants variant
    join media.file_objects derived
      on derived.id = variant.derived_file_object_id
    where variant.id = v_version.audio_delivery_variant_id;
  end if;

  if v_version.master_media_revision_id is not null then
    select derived.delivery_url
    into v_waveform_url
    from media.variant_selections selection
    join media.variants variant
      on variant.id = selection.variant_id
    join media.file_objects derived
      on derived.id = variant.derived_file_object_id
    where selection.asset_revision_id =
        v_version.master_media_revision_id
      and selection.variant_role = 'waveform_data'
    limit 1;
  end if;

  v_duration := nullif(
    v_source_probe ->> 'duration_seconds',
    ''
  )::numeric;

  return jsonb_build_object(
    'delivery_url', v_delivery_url,
    'waveform_url', v_waveform_url,
    'duration_seconds', v_duration,
    'source_probe', coalesce(v_source_probe, '{}'::jsonb)
  );
end;
$function$;

revoke all on function
  audio.publication_version_review_media(uuid)
from public, anon, authenticated;

create or replace function audio.assert_publication_review_thread_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, audio, editorial
as $function$
declare
  v_version audio.publication_versions%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_media jsonb;
  v_duration numeric;
begin
  select version.*
  into v_version
  from audio.publication_versions version
  where version.id = new.target_version_id;

  if not found then
    raise exception 'Audio review target version does not exist';
  end if;

  if v_version.resource_id <> new.resource_id
     or v_version.publication_id <> new.publication_id
  then
    raise exception
      'Audio review target version must belong to the same publication Resource';
  end if;

  if v_version.version_kind <> 'submitted' then
    raise exception
      'Audio review threads must target an immutable submitted version';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = new.publication_id;

  if not found then
    raise exception 'Audio publication Resource binding does not exist';
  end if;

  if v_binding.resource_id <> new.resource_id then
    raise exception
      'Audio review Resource binding does not match the thread';
  end if;

  if v_binding.current_submitted_version_id
       is distinct from new.target_version_id
  then
    raise exception
      'New Audio review threads must target the exact current submitted version';
  end if;

  v_media :=
    audio.publication_version_review_media(
      new.target_version_id
    );

  v_duration := nullif(
    v_media ->> 'duration_seconds',
    ''
  )::numeric;

  if v_duration is null or v_duration <= 0 then
    raise exception
      'The submitted Audio version has no measurable master duration';
  end if;

  if new.anchor_start_seconds > v_duration then
    raise exception
      'Audio review anchor starts after the submitted master ends';
  end if;

  if new.anchor_end_seconds is not null
     and new.anchor_end_seconds > v_duration
  then
    raise exception
      'Audio review anchor ends after the submitted master ends';
  end if;

  return new;
end;
$function$;

revoke all on function
  audio.assert_publication_review_thread_integrity()
from public, anon, authenticated;

create trigger audio_review_threads_integrity
before insert or update of
  resource_id,
  publication_id,
  target_version_id,
  anchor_kind,
  anchor_start_seconds,
  anchor_end_seconds
on audio.publication_review_threads
for each row
execute function audio.assert_publication_review_thread_integrity();

create or replace function audio.touch_publication_review_thread()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger audio_review_threads_touch
before update
on audio.publication_review_threads
for each row
execute function audio.touch_publication_review_thread();

alter table audio.publication_review_threads
  enable row level security;

alter table audio.publication_review_comments
  enable row level security;

create policy "Audio review participants can read threads"
on audio.publication_review_threads
for select
to authenticated
using (
  editorial.current_user_can_participate_audio_review(
    resource_id
  )
);

create policy "Audio review participants can read comments"
on audio.publication_review_comments
for select
to authenticated
using (
  exists (
    select 1
    from audio.publication_review_threads thread
    where thread.id = publication_review_comments.thread_id
      and editorial.current_user_can_participate_audio_review(
        thread.resource_id
      )
  )
);

revoke all on table
  audio.publication_review_threads
from public, anon, authenticated;

revoke all on table
  audio.publication_review_comments
from public, anon, authenticated;

create or replace function public.get_audio_editorial_media_context(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, audio, media
as $function$
declare
  v_binding editorial.audio_publication_resources%rowtype;
  v_asset_id uuid;
  v_revision_id uuid;
  v_delivery_variant_id uuid;
  v_delivery_url text;
  v_preview_url text;
  v_waveform_url text;
  v_source_probe jsonb;
  v_duration numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception 'Audio publication Resource binding does not exist';
  end if;

  if not (
    coalesce(
      public.current_user_has_capability('view_audio'),
      false
    )
    or coalesce(
      editorial.current_user_can_edit_audio(v_binding.resource_id),
      false
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Audio access is required.';
  end if;

  select
    master.asset_id,
    master.asset_revision_id,
    master.audio_delivery_variant_id
  into
    v_asset_id,
    v_revision_id,
    v_delivery_variant_id
  from audio.current_publication_master(
    p_publication_id
  ) master;

  if v_asset_id is null or v_revision_id is null then
    return jsonb_build_object(
      'asset_id', null,
      'asset_revision_id', null,
      'audio_delivery_variant_id', null,
      'delivery_url', null,
      'preview_url', null,
      'waveform_url', null,
      'duration_seconds', null,
      'source_probe', '{}'::jsonb
    );
  end if;

  if v_delivery_variant_id is not null then
    select
      derived.delivery_url,
      derived.technical_metadata -> 'source_probe'
    into
      v_delivery_url,
      v_source_probe
    from media.variants variant
    join media.file_objects derived
      on derived.id = variant.derived_file_object_id
    where variant.id = v_delivery_variant_id;
  end if;

  select
    max(derived.delivery_url)
      filter (where selection.variant_role = 'audio_preview'),
    max(derived.delivery_url)
      filter (where selection.variant_role = 'waveform_data'),
    coalesce(
      v_source_probe,
      (
        max(derived.technical_metadata ->> 'source_probe')
          filter (where selection.variant_role = 'waveform_data')
      )::jsonb
    )
  into
    v_preview_url,
    v_waveform_url,
    v_source_probe
  from media.variant_selections selection
  join media.variants variant
    on variant.id = selection.variant_id
  join media.file_objects derived
    on derived.id = variant.derived_file_object_id
  where selection.asset_revision_id = v_revision_id
    and selection.variant_role in (
      'audio_preview',
      'waveform_data'
    );

  v_duration := nullif(
    v_source_probe ->> 'duration_seconds',
    ''
  )::numeric;

  return jsonb_build_object(
    'asset_id', v_asset_id,
    'asset_revision_id', v_revision_id,
    'audio_delivery_variant_id', v_delivery_variant_id,
    'delivery_url', v_delivery_url,
    'preview_url', v_preview_url,
    'waveform_url', v_waveform_url,
    'duration_seconds', v_duration,
    'source_probe', coalesce(v_source_probe, '{}'::jsonb)
  );
end;
$function$;

create or replace function public.get_audio_editorial_workbench(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
declare
  v_binding editorial.audio_publication_resources%rowtype;
  v_target audio.publication_versions%rowtype;
  v_media jsonb;
  v_threads jsonb;
  v_chapters jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception 'Audio publication Resource binding does not exist';
  end if;

  if not editorial.current_user_can_participate_audio_review(
    v_binding.resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  if v_binding.current_submitted_version_id is not null then
    select version.*
    into v_target
    from audio.publication_versions version
    where version.id =
      v_binding.current_submitted_version_id;

    v_media :=
      audio.publication_version_review_media(
        v_target.id
      );

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'chapter_number', chapter.chapter_number,
          'start_seconds', chapter.start_seconds,
          'title', chapter.title
        )
        order by chapter.chapter_number
      ),
      '[]'::jsonb
    )
    into v_chapters
    from audio.publication_version_chapters chapter
    where chapter.publication_version_id = v_target.id;
  else
    v_media := '{}'::jsonb;
    v_chapters := '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', thread.id,
        'resource_id', thread.resource_id,
        'publication_id', thread.publication_id,
        'target_version_id', thread.target_version_id,
        'anchor_kind', thread.anchor_kind,
        'anchor_start_seconds', thread.anchor_start_seconds,
        'anchor_end_seconds', thread.anchor_end_seconds,
        'status', thread.status,
        'created_by', thread.created_by,
        'created_by_label', coalesce(
          creator.display_name,
          thread.created_by::text,
          'system'
        ),
        'resolved_by', thread.resolved_by,
        'resolved_by_label', coalesce(
          resolver.display_name,
          thread.resolved_by::text
        ),
        'resolved_at', thread.resolved_at,
        'created_at', thread.created_at,
        'updated_at', thread.updated_at,
        'comments', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', comment.id,
                'thread_id', comment.thread_id,
                'body_html', comment.body_html,
                'body_text', comment.body_text,
                'created_by', comment.created_by,
                'created_by_label', coalesce(
                  comment_actor.display_name,
                  comment.created_by::text,
                  'system'
                ),
                'created_at', comment.created_at,
                'edited_at', comment.edited_at,
                'deleted_at', comment.deleted_at
              )
              order by comment.created_at
            )
            from audio.publication_review_comments comment
            left join public.user_profiles comment_actor
              on comment_actor.user_id = comment.created_by
            where comment.thread_id = thread.id
          ),
          '[]'::jsonb
        )
      )
      order by thread.anchor_start_seconds, thread.created_at
    ),
    '[]'::jsonb
  )
  into v_threads
  from audio.publication_review_threads thread
  left join public.user_profiles creator
    on creator.user_id = thread.created_by
  left join public.user_profiles resolver
    on resolver.user_id = thread.resolved_by
  where thread.publication_id = p_publication_id
    and (
      v_binding.current_submitted_version_id is null
      or thread.target_version_id =
        v_binding.current_submitted_version_id
    );

  return jsonb_build_object(
    'publication_id', p_publication_id,
    'resource_id', v_binding.resource_id,
    'current_submitted_version_id',
      v_binding.current_submitted_version_id,
    'can_participate_review',
      editorial.current_user_can_participate_audio_review(
        v_binding.resource_id
      ),
    'target_version',
      case
        when v_target.id is null then null
        else jsonb_build_object(
          'id', v_target.id,
          'version_number', v_target.version_number,
          'version_kind', v_target.version_kind,
          'content_fingerprint', v_target.content_fingerprint,
          'created_by', v_target.created_by,
          'created_at', v_target.created_at,
          'delivery_url', v_media ->> 'delivery_url',
          'waveform_url', v_media ->> 'waveform_url',
          'duration_seconds',
            nullif(v_media ->> 'duration_seconds', '')::numeric,
          'source_probe',
            coalesce(v_media -> 'source_probe', '{}'::jsonb),
          'chapters', coalesce(v_chapters, '[]'::jsonb)
        )
      end,
    'threads', v_threads
  );
end;
$function$;

create or replace function public.create_audio_time_review_thread(
  p_publication_id uuid,
  p_target_version_id uuid,
  p_anchor_kind text,
  p_anchor_start_seconds numeric,
  p_anchor_end_seconds numeric,
  p_body_html text,
  p_body_text text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
declare
  v_binding editorial.audio_publication_resources%rowtype;
  v_publication_status text;
  v_thread audio.publication_review_threads%rowtype;
  v_comment audio.publication_review_comments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception 'Audio publication Resource binding does not exist';
  end if;

  if not editorial.current_user_can_participate_audio_review(
    v_binding.resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  select publication.status
  into v_publication_status
  from audio.publications publication
  where publication.id = p_publication_id;

  if v_publication_status not in (
    'ready_for_review',
    'in_review',
    'changes_requested'
  ) then
    raise exception
      'Time-anchored feedback is only available during Audio Review';
  end if;

  if v_binding.current_submitted_version_id
       is distinct from p_target_version_id
  then
    raise exception
      'Audio review comments must target the exact current submitted version';
  end if;

  if p_anchor_kind not in ('time_point', 'time_range') then
    raise exception 'Choose a supported Audio time anchor';
  end if;

  if p_anchor_start_seconds is null
     or p_anchor_start_seconds < 0
  then
    raise exception 'Audio review anchor start is required';
  end if;

  if p_anchor_kind = 'time_point'
     and p_anchor_end_seconds is not null
  then
    raise exception 'Time-point comments cannot have an end time';
  end if;

  if p_anchor_kind = 'time_range'
     and (
       p_anchor_end_seconds is null
       or p_anchor_end_seconds <= p_anchor_start_seconds
     )
  then
    raise exception
      'Time-range comments require an end after the start';
  end if;

  if nullif(btrim(p_body_text), '') is null
     or nullif(btrim(p_body_html), '') is null
  then
    raise exception 'Review comment cannot be blank';
  end if;

  insert into audio.publication_review_threads (
    resource_id,
    publication_id,
    target_version_id,
    anchor_kind,
    anchor_start_seconds,
    anchor_end_seconds,
    created_by
  )
  values (
    v_binding.resource_id,
    p_publication_id,
    p_target_version_id,
    p_anchor_kind,
    p_anchor_start_seconds,
    p_anchor_end_seconds,
    auth.uid()
  )
  returning *
  into v_thread;

  insert into audio.publication_review_comments (
    thread_id,
    body_html,
    body_text,
    created_by
  )
  values (
    v_thread.id,
    p_body_html,
    p_body_text,
    auth.uid()
  )
  returning *
  into v_comment;

  return jsonb_build_object(
    'thread_id', v_thread.id,
    'comment_id', v_comment.id,
    'created_at', v_comment.created_at
  );
end;
$function$;

create or replace function public.add_audio_review_comment(
  p_thread_id uuid,
  p_body_html text,
  p_body_text text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
declare
  v_thread audio.publication_review_threads%rowtype;
  v_comment audio.publication_review_comments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select thread.*
  into v_thread
  from audio.publication_review_threads thread
  where thread.id = p_thread_id;

  if not found then
    raise exception 'Audio review thread does not exist';
  end if;

  if not editorial.current_user_can_participate_audio_review(
    v_thread.resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  if nullif(btrim(p_body_text), '') is null
     or nullif(btrim(p_body_html), '') is null
  then
    raise exception 'Review reply cannot be blank';
  end if;

  insert into audio.publication_review_comments (
    thread_id,
    body_html,
    body_text,
    created_by
  )
  values (
    v_thread.id,
    p_body_html,
    p_body_text,
    auth.uid()
  )
  returning *
  into v_comment;

  return jsonb_build_object(
    'comment_id', v_comment.id,
    'thread_id', v_thread.id,
    'created_at', v_comment.created_at
  );
end;
$function$;

create or replace function public.set_audio_review_thread_status(
  p_thread_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
declare
  v_thread audio.publication_review_threads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_status not in ('open', 'resolved') then
    raise exception 'Choose open or resolved';
  end if;

  select thread.*
  into v_thread
  from audio.publication_review_threads thread
  where thread.id = p_thread_id;

  if not found then
    raise exception 'Audio review thread does not exist';
  end if;

  if not editorial.current_user_can_participate_audio_review(
    v_thread.resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  update audio.publication_review_threads thread
  set
    status = p_status,
    resolved_by = case
      when p_status = 'resolved' then auth.uid()
      else null
    end,
    resolved_at = case
      when p_status = 'resolved' then now()
      else null
    end
  where thread.id = p_thread_id
  returning *
  into v_thread;

  return jsonb_build_object(
    'thread_id', v_thread.id,
    'status', v_thread.status,
    'resolved_at', v_thread.resolved_at
  );
end;
$function$;

revoke all on function
  public.get_audio_editorial_media_context(uuid)
from public, anon;
grant execute on function
  public.get_audio_editorial_media_context(uuid)
to authenticated, service_role;

revoke all on function
  public.get_audio_editorial_workbench(uuid)
from public, anon;
grant execute on function
  public.get_audio_editorial_workbench(uuid)
to authenticated, service_role;

revoke all on function
  public.create_audio_time_review_thread(
    uuid, uuid, text, numeric, numeric, text, text
  )
from public, anon;
grant execute on function
  public.create_audio_time_review_thread(
    uuid, uuid, text, numeric, numeric, text, text
  )
to authenticated, service_role;

revoke all on function
  public.add_audio_review_comment(uuid, text, text)
from public, anon;
grant execute on function
  public.add_audio_review_comment(uuid, text, text)
to authenticated, service_role;

revoke all on function
  public.set_audio_review_thread_status(uuid, text)
from public, anon;
grant execute on function
  public.set_audio_review_thread_status(uuid, text)
to authenticated, service_role;

commit;
