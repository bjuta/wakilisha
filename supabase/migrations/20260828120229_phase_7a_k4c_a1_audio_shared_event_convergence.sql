-- Phase 7A K4C-A1: Audio shared-event convergence.
--
-- Retire Audio typed review/lifecycle tables as new-write authority while
-- retaining them as immutable historical compatibility stores. Audio keeps
-- its domain-specific publication status, Media gates, feed identity, and
-- time-anchored review discussion. Canonical lifecycle pointers/history move
-- to shared Resource authority.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k4c-a1-audio-shared-event-convergence',
    0
  )
);

create temporary table phase_7a_k4c_a1_baseline
on commit drop
as
select
  (select count(*) from audio.publication_review_events)
    as audio_review_count,
  (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from audio.publication_review_events e
  ) as audio_review_fingerprint,
  (select count(*) from audio.publication_lifecycle_events)
    as audio_lifecycle_count,
  (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from audio.publication_lifecycle_events e
  ) as audio_lifecycle_fingerprint;

do $phase_7a_k4c_a1_preflight$
declare
  v_count bigint;
begin
  if to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
     or to_regprocedure(
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_admin_audio_publication_workspace(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_audio_editorial_workbench(uuid)'
     ) is null
     or to_regprocedure(
       'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)'
     ) is null
     or to_regprocedure(
       'audio.assert_publication_review_thread_integrity()'
     ) is null
     or to_regprocedure(
       'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'
     ) is null
  then
    raise exception
      'STOP: Phase 7A K4C-A1 requires accepted K4A/P1/P3 and Audio authority';
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name = 'playlist_resources'
      and column_row.column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: Playlist P3 pointer retirement is not intact before Audio A1';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array['search_path=pg_catalog, editorial, platform_private']::text[]
  ) or not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array['search_path=pg_catalog, editorial, platform_private']::text[]
  ) then
    raise exception
      'STOP: shared Resource event append helper hardening drifted before A1';
  end if;

  if has_function_privilege(
       'public',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: shared Resource event append helper ACL is open before A1';
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: % Audio lifecycle pointer mirror(s) diverge before K4C-A1',
      v_count;
  end if;

  if exists (
    select 1
    from audio.publication_lifecycle_events source
    left join editorial.resources resource_row
      on resource_row.id = source.resource_id
    left join editorial.resource_versions version_row
      on version_row.id = source.version_id
     and version_row.resource_id = source.resource_id
    where resource_row.id is null
       or (source.version_id is not null and version_row.id is null)
  ) then
    raise exception
      'STOP: Audio lifecycle compatibility history has invalid Resource identity';
  end if;

  if exists (
    select 1
    from audio.publication_review_events source
    left join editorial.resources resource_row
      on resource_row.id = source.resource_id
    left join editorial.resource_versions target
      on target.id = source.target_version_id
     and target.resource_id = source.resource_id
    left join editorial.resource_versions result
      on result.id = source.result_version_id
     and result.resource_id = source.resource_id
    where resource_row.id is null
       or target.id is null
       or (source.result_version_id is not null and result.id is null)
  ) then
    raise exception
      'STOP: Audio review compatibility history has invalid Resource Version identity';
  end if;

  if exists (
    select 1
    from audio.publication_lifecycle_events source
    join editorial.resource_lifecycle_events shared
      on shared.id = source.id
    where not (
      shared.legacy_source_authority = 'audio_publication_lifecycle'
      and shared.legacy_source_event_id = source.id
    )
  ) or exists (
    select 1
    from audio.publication_review_events source
    join editorial.resource_review_events shared
      on shared.id = source.id
    where not (
      shared.legacy_source_authority = 'audio_publication_review'
      and shared.legacy_source_event_id = source.id
    )
  ) then
    raise exception
      'STOP: Audio compatibility event UUID collides with unrelated shared history';
  end if;

  if exists (
    select 1
    from (
      select
        source.id,
        source.resource_id,
        source.actor_id,
        source.command_receipt_id
      from audio.publication_lifecycle_events source
      where not exists (
        select 1
        from editorial.resource_lifecycle_events shared
        where shared.legacy_source_authority = 'audio_publication_lifecycle'
          and shared.legacy_source_event_id = source.id
      )
      union all
      select
        source.id,
        source.resource_id,
        source.actor_id,
        source.command_receipt_id
      from audio.publication_review_events source
      where not exists (
        select 1
        from editorial.resource_review_events shared
        where shared.legacy_source_authority = 'audio_publication_review'
          and shared.legacy_source_event_id = source.id
      )
    ) source
    left join platform_private.command_receipts receipt
      on receipt.id = source.command_receipt_id
     and receipt.resource_id = source.resource_id
     and receipt.actor_user_id is not distinct from source.actor_id
    where receipt.id is null
  ) then
    raise exception
      'STOP: Audio compatibility catch-up command receipt identity is invalid';
  end if;

  if exists (
    select 1
    from audio.publication_lifecycle_events source
    left join editorial.resource_lifecycle_actions action_row
      on action_row.action = source.action
     and action_row.enabled
    where action_row.action is null
  ) or exists (
    select 1
    from audio.publication_review_events source
    left join editorial.resource_review_actions action_row
      on action_row.action = source.action
     and action_row.enabled
    where action_row.action is null
  ) then
    raise exception
      'STOP: Audio compatibility history contains an action outside shared vocabulary';
  end if;
end;
$phase_7a_k4c_a1_preflight$;

-- Catch up any typed Audio events written after the K4A backfill.
with missing as (
  select
    source.*,
    coalesce(
      (
        select max(shared.event_number)
        from editorial.resource_lifecycle_events shared
        where shared.resource_id = source.resource_id
      ),
      0
    ) as base_event_number,
    row_number() over (
      partition by source.resource_id
      order by source.event_number, source.created_at, source.id
    ) as catchup_offset
  from audio.publication_lifecycle_events source
  where not exists (
    select 1
    from editorial.resource_lifecycle_events shared
    where shared.legacy_source_authority = 'audio_publication_lifecycle'
      and shared.legacy_source_event_id = source.id
  )
)
insert into editorial.resource_lifecycle_events (
  id,
  resource_id,
  event_number,
  action,
  version_id,
  prior_status,
  resulting_status,
  note,
  metadata,
  actor_id,
  command_receipt_id,
  correlation_id,
  legacy_source_authority,
  legacy_source_event_id,
  created_at
)
select
  missing.id,
  missing.resource_id,
  missing.base_event_number + missing.catchup_offset,
  missing.action,
  missing.version_id,
  missing.prior_status,
  missing.resulting_status,
  missing.note,
  missing.metadata,
  missing.actor_id,
  missing.command_receipt_id,
  null::uuid,
  'audio_publication_lifecycle',
  missing.id,
  missing.created_at
from missing
order by missing.resource_id, missing.catchup_offset;

with missing as (
  select
    source.*,
    coalesce(
      (
        select max(shared.event_number)
        from editorial.resource_review_events shared
        where shared.resource_id = source.resource_id
      ),
      0
    ) as base_event_number,
    row_number() over (
      partition by source.resource_id
      order by source.event_number, source.created_at, source.id
    ) as catchup_offset
  from audio.publication_review_events source
  where not exists (
    select 1
    from editorial.resource_review_events shared
    where shared.legacy_source_authority = 'audio_publication_review'
      and shared.legacy_source_event_id = source.id
  )
)
insert into editorial.resource_review_events (
  id,
  resource_id,
  event_number,
  target_version_id,
  result_version_id,
  action,
  prior_status,
  resulting_status,
  reason,
  actor_id,
  command_receipt_id,
  correlation_id,
  legacy_source_authority,
  legacy_source_event_id,
  created_at
)
select
  missing.id,
  missing.resource_id,
  missing.base_event_number + missing.catchup_offset,
  missing.target_version_id,
  missing.result_version_id,
  missing.action,
  missing.prior_status,
  missing.resulting_status,
  missing.reason,
  missing.actor_id,
  missing.command_receipt_id,
  missing.correlation_id,
  'audio_publication_review',
  missing.id,
  missing.created_at
from missing
order by missing.resource_id, missing.catchup_offset;

set constraints all immediate;
set constraints all deferred;

-- ---------------------------------------------------------------------------
-- Preserve the Audio lifecycle helper signature as a one-way shared adapter.
-- ---------------------------------------------------------------------------

create or replace function audio.append_publication_lifecycle_event(
  p_resource_id uuid,
  p_publication_id uuid,
  p_version_id uuid,
  p_action text,
  p_prior_status text,
  p_resulting_status text,
  p_note text,
  p_actor_id uuid,
  p_command_receipt_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'audio'
as $function$
declare
  v_binding editorial.audio_publication_resources%rowtype;
  v_receipt platform_private.command_receipts%rowtype;
  v_correlation_id uuid;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found
     or v_binding.resource_id is distinct from p_resource_id
  then
    raise exception
      'Audio lifecycle event Resource/publication binding is invalid';
  end if;

  if p_version_id is not null
     and not exists (
       select 1
       from editorial.resource_versions version_row
       where version_row.resource_id = p_resource_id
         and version_row.id = p_version_id
     )
  then
    raise exception
      'Audio lifecycle event version is not a Resource Version for this publication';
  end if;

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.id = p_command_receipt_id;

  if not found
     or v_receipt.resource_id is distinct from p_resource_id
     or v_receipt.actor_user_id is distinct from p_actor_id
  then
    raise exception
      'Audio lifecycle event command receipt identity is invalid';
  end if;

  begin
    v_correlation_id := nullif(
      v_metadata ->> 'correlation_id',
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      raise exception
        'Audio lifecycle event correlation identity is invalid';
  end;

  if v_correlation_id is null then
    begin
      v_correlation_id := nullif(
        v_receipt.request_payload ->> 'correlation_id',
        ''
      )::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Audio lifecycle command request correlation identity is invalid';
    end;
  end if;

  if v_correlation_id is null then
    begin
      v_correlation_id := nullif(
        v_receipt.result_payload ->> 'correlation_id',
        ''
      )::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Audio lifecycle command result correlation identity is invalid';
    end;
  end if;

  if v_correlation_id is null then
    raise exception
      'Audio lifecycle event requires canonical correlation identity';
  end if;

  v_metadata :=
    v_metadata || jsonb_build_object(
      'publication_id', p_publication_id
    );

  return editorial.append_resource_lifecycle_event(
    p_resource_id,
    p_version_id,
    p_action,
    p_prior_status,
    p_resulting_status,
    p_note,
    v_metadata,
    p_actor_id,
    p_command_receipt_id,
    v_correlation_id
  );
end;
$function$;

revoke execute
on function audio.append_publication_lifecycle_event(
  uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb
)
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Review thread integrity uses canonical Resource submitted position.
-- ---------------------------------------------------------------------------

create or replace function audio.assert_publication_review_thread_integrity()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'audio',
  'editorial'
as $function$
declare
  v_version audio.publication_versions%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
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

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id;

  if not found then
    raise exception 'Audio publication Resource does not exist';
  end if;

  if v_resource.current_submitted_version_id
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

revoke execute
on function audio.assert_publication_review_thread_integrity()
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Time-anchored review creation targets canonical submitted position.
-- ---------------------------------------------------------------------------

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
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'audio'
as $function$
declare
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
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

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id;

  if not found then
    raise exception 'Audio publication Resource does not exist';
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

  if v_resource.current_submitted_version_id
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

-- ---------------------------------------------------------------------------
-- Editorial workbench keeps its JSON shape but consumes canonical submitted.
-- ---------------------------------------------------------------------------

create or replace function public.get_audio_editorial_workbench(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'audio'
as $function$
declare
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
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

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id;

  if not found then
    raise exception 'Audio publication Resource does not exist';
  end if;

  if not editorial.current_user_can_participate_audio_review(
    v_binding.resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  if v_resource.current_submitted_version_id is not null then
    select version.*
    into v_target
    from audio.publication_versions version
    where version.id =
      v_resource.current_submitted_version_id;

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
      v_resource.current_submitted_version_id is null
      or thread.target_version_id =
        v_resource.current_submitted_version_id
    );

  return jsonb_build_object(
    'publication_id', p_publication_id,
    'resource_id', v_binding.resource_id,
    'current_submitted_version_id',
      v_resource.current_submitted_version_id,
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

-- ---------------------------------------------------------------------------
-- Admin workspace history + pointers now come from shared Resource authority.
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_audio_publication_workspace(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial',
  'audio',
  'media'
as $function$
declare
  v_actor uuid := auth.uid();
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_binding
  from editorial.audio_publication_resources
  where publication_id = p_publication_id;

  if not found then
    raise exception 'Audio publication Resource binding does not exist.';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id;

  if not found then
    raise exception 'Audio publication Resource does not exist.';
  end if;

  if not (
    public.current_user_has_capability('view_audio')
    or editorial.current_user_can_edit_audio(v_binding.resource_id)
  ) then
    raise exception using errcode = '42501', message = 'Audio access is required.';
  end if;

  return jsonb_build_object(
    'publication', (
      select jsonb_build_object(
        'id', p.id,
        'publication_kind', p.publication_kind,
        'show_id', p.show_id,
        'season_id', p.season_id,
        'episode_number', p.episode_number,
        'title', p.title,
        'slug', p.slug,
        'summary', p.summary,
        'status', p.status,
        'authority_revision', p.authority_revision,
        'metadata', p.metadata,
        'created_at', p.created_at,
        'updated_at', p.updated_at
      )
      from audio.publications p
      where p.id = p_publication_id
    ),
    'resource_id', v_binding.resource_id,
    'versions', jsonb_build_object(
      'working', v_resource.current_working_version_id,
      'submitted', v_resource.current_submitted_version_id,
      'approved', v_resource.current_approved_version_id,
      'published', v_resource.current_published_version_id
    ),
    'master', (
      select jsonb_build_object(
        'usage_link_id', m.usage_link_id,
        'asset_id', m.asset_id,
        'asset_revision_id', m.asset_revision_id,
        'audio_delivery_variant_id', m.audio_delivery_variant_id
      )
      from audio.current_publication_master(p_publication_id) m
    ),
    'transcript', (
      select jsonb_build_object(
        'usage_link_id', t.usage_link_id,
        'asset_id', t.asset_id,
        'asset_revision_id', t.asset_revision_id
      )
      from audio.current_publication_transcript(p_publication_id) t
    ),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'chapter_number', c.chapter_number,
        'start_seconds', c.start_seconds,
        'title', c.title,
        'chapter_url', c.chapter_url,
        'image_url', c.image_url
      ) order by c.chapter_number)
      from audio.publication_chapters c
      where c.publication_id = p_publication_id
    ), '[]'::jsonb),
    'review_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'event_number', e.event_number,
        'action', e.action,
        'target_version_id', e.target_version_id,
        'result_version_id', e.result_version_id,
        'prior_status', e.prior_status,
        'resulting_status', e.resulting_status,
        'reason', e.reason,
        'actor_id', e.actor_id,
        'created_at', e.created_at
      ) order by e.event_number)
      from editorial.resource_review_events e
      where e.resource_id = v_binding.resource_id
    ), '[]'::jsonb),
    'lifecycle_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'event_number', e.event_number,
        'version_id', e.version_id,
        'action', e.action,
        'prior_status', e.prior_status,
        'resulting_status', e.resulting_status,
        'note', e.note,
        'actor_id', e.actor_id,
        'created_at', e.created_at
      ) order by e.event_number)
      from editorial.resource_lifecycle_events e
      where e.resource_id = v_binding.resource_id
    ), '[]'::jsonb),
    'trust', (
      select jsonb_build_object(
        'citation_revision', coalesce(r.citation_revision, 1),
        'credit_revision', coalesce(r.credit_revision, 1),
        'citations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id', a.id,
            'citation_id', a.citation_id,
            'citation_purpose', a.citation_purpose,
            'target_anchor_type', a.target_anchor_type,
            'target_anchor_data', a.target_anchor_data,
            'display_order', a.display_order,
            'public_safe', a.public_safe,
            'public_label', c.public_label,
            'quotation', c.quotation,
            'citation_state', c.citation_state
          ) order by a.display_order, a.id)
          from editorial.resource_citations a
          join editorial.citations c on c.id = a.citation_id
          where a.resource_id = v_binding.resource_id
            and a.target_version_type = 'audio_publication_version'
            and a.target_version_id = v_resource.current_working_version_id
        ), '[]'::jsonb),
        'credits', coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id', a.id,
            'credit_id', a.credit_id,
            'display_order', a.display_order,
            'is_primary', a.is_primary,
            'public_safe', a.public_safe,
            'credit_role', c.credit_role,
            'display_name', c.display_name_snapshot,
            'role_label', c.role_label_snapshot
          ) order by a.display_order, a.id)
          from editorial.resource_credits a
          join editorial.credits c on c.id = a.credit_id
          where a.resource_id = v_binding.resource_id
            and a.target_version_type = 'audio_publication_version'
            and a.target_version_id = v_resource.current_working_version_id
        ), '[]'::jsonb)
      )
      from (select 1) seed
      left join editorial.audio_publication_version_trust_revisions r
        on r.publication_version_id = v_resource.current_working_version_id
    ),
    'feed_identity', (
      select jsonb_build_object(
        'guid', f.guid,
        'enclosure_url', f.enclosure_url
      )
      from audio.publication_feed_identities f
      where f.publication_id = p_publication_id
    ),
    'can_edit', editorial.current_user_can_edit_audio(v_binding.resource_id),
    'can_manage_review', public.current_user_has_capability('manage_review_queue'),
    'can_publish', editorial.current_user_can_publish_audio(v_binding.resource_id),
    'can_archive', (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('delete_audio'), false)
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Submit exact current Audio identity into canonical shared history.
-- ---------------------------------------------------------------------------

create or replace function public.submit_audio_publication_for_review(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private',
  'audio',
  'media',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_snapshot record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_prior_status text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if not found then
    raise exception 'Audio publication Resource does not exist';
  end if;

  if not editorial.current_user_can_edit_audio(
    v_binding.resource_id
  ) then
    raise exception
      'Audio edit permission is required';
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.review.submit',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before it could be submitted.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  elsif v_publication.status not in (
    'draft',
    'changes_requested'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_not_submittable',
      'Only a draft or changes-requested Audio publication can be submitted.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  else
    perform 1
    from media.assets asset
    where asset.id = (
      select master.asset_id
      from audio.current_publication_master(
        p_publication_id
      ) master
      limit 1
    )
    for share;

    perform 1
    from media.variant_selections selection
    where selection.asset_revision_id = (
      select master.asset_revision_id
      from audio.current_publication_master(
        p_publication_id
      ) master
      limit 1
    )
      and selection.variant_role = 'audio_delivery'
    for share;

    if not exists (
      select 1
      from audio.current_publication_master(
        p_publication_id
      ) master
      join media.assets asset
        on asset.id = master.asset_id
      join media.asset_revisions revision
        on revision.id = master.asset_revision_id
       and revision.asset_id = asset.id
      join media.variants variant
        on variant.id = master.audio_delivery_variant_id
       and variant.asset_id = asset.id
       and variant.asset_revision_id = revision.id
       and variant.variant_role = 'audio_delivery'
      join media.file_objects file_object
        on file_object.id = variant.derived_file_object_id
      join media.asset_governance_versions governance
        on governance.id = asset.current_governance_version_id
       and governance.asset_id = asset.id
      where asset.asset_kind = 'audio'
        and asset.lifecycle_state = 'active'
        and file_object.verification_state = 'verified'
        and file_object.mime_type = 'audio/mpeg'
        and file_object.byte_size > 0
        and file_object.sha256 ~ '^[0-9a-f]{64}$'
        and file_object.delivery_url like
              'https://media.wakilisha.africa/derivatives/%'
        and governance.public_safety_state in (
              'approved_public',
              'approved_redacted'
            )
        and governance.consent_status in (
              'granted',
              'not_required'
            )
        and governance.rights_status <> 'restricted'
        and governance.embargo_state in (
              'none',
              'released'
            )
    ) then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'audio_publication_media_not_publishable',
        'Approve the exact Audio master and full-length delivery for public use before Review.',
        jsonb_build_object(
          'publication_id', p_publication_id,
          'authority_revision',
            v_publication.authority_revision,
          'lifecycle_status', v_publication.status
        )
      );
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      v_prior_status := v_publication.status;

      select *
      into v_snapshot
      from audio.insert_current_publication_snapshot(
        p_publication_id,
        v_publication.authority_revision,
        'submitted',
        v_actor
      );

      update editorial.resources resource_update
      set
        current_submitted_version_id = v_snapshot.version_id,
        current_approved_version_id = null,
        updated_at = now()
      where resource_update.id = v_binding.resource_id;

      update audio.publications publication
      set
        status = 'ready_for_review',
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      perform editorial.append_resource_lifecycle_event(
        v_binding.resource_id,
        v_snapshot.version_id,
        'submitted',
        v_prior_status,
        'ready_for_review',
        p_note,
        jsonb_build_object(
          'publication_id', p_publication_id
        ),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      perform editorial.append_resource_review_event(
        v_binding.resource_id,
        v_snapshot.version_id,
        null,
        'submitted',
        v_prior_status,
        'ready_for_review',
        p_note,
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision',
          v_publication.authority_revision,
        'version_id', v_snapshot.version_id,
        'version_number', v_snapshot.version_number,
        'content_fingerprint',
          v_snapshot.content_fingerprint,
        'lifecycle_status', 'ready_for_review',
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Review exact canonical submitted Audio version into shared history.
-- ---------------------------------------------------------------------------

create or replace function public.review_audio_publication(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_submitted_version_id uuid,
  p_decision text,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_submitted audio.publication_versions%rowtype;
  v_approved record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_prior_status text;
  v_prior_lifecycle_status text;
  v_result_status text;
  v_action text;
  v_result_version_id uuid;
  v_result_version_number bigint;
  v_current_fingerprint text;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'manage_review_queue'
      ),
      false
    )
  ) then
    raise exception
      'Review queue management permission is required';
  end if;

  if p_decision not in (
    'start_review',
    'request_changes',
    'approve'
  ) then
    raise exception
      'Choose a supported Audio review decision';
  end if;

  if p_decision = 'request_changes'
     and nullif(btrim(p_note), '') is null
  then
    raise exception
      'Requested changes require a review note';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if not found then
    raise exception 'Audio publication Resource does not exist';
  end if;

  select submitted.*
  into v_submitted
  from audio.publication_versions submitted
  where submitted.id = p_submitted_version_id
    and submitted.resource_id = v_binding.resource_id
    and submitted.publication_id = p_publication_id
    and submitted.version_kind = 'submitted';

  perform 1
  from media.assets asset
  where asset.id = (
    select master.asset_id
    from audio.current_publication_master(
      p_publication_id
    ) master
    limit 1
  )
  for share;

  perform 1
  from media.variant_selections selection
  where selection.asset_revision_id = (
    select master.asset_revision_id
    from audio.current_publication_master(
      p_publication_id
    ) master
    limit 1
  )
    and selection.variant_role = 'audio_delivery'
  for share;

  v_current_fingerprint :=
    audio.publication_content_fingerprint(
      p_publication_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.review.decide',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'submitted_version_id', p_submitted_version_id,
      'decision', p_decision,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before the Review decision could be applied.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  elsif v_resource.current_submitted_version_id
          is distinct from p_submitted_version_id
        or v_submitted.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_submitted_version_changed',
      'Review must target the exact current submitted Audio version.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'current_submitted_version_id',
          v_resource.current_submitted_version_id
      )
    );

  elsif v_submitted.content_fingerprint
          is distinct from v_current_fingerprint
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_submitted_version_stale',
      'The Audio publication changed after submission and must be submitted again.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'submitted_content_fingerprint',
          v_submitted.content_fingerprint,
        'current_content_fingerprint',
          v_current_fingerprint
      )
    );

  else
    v_prior_status := v_publication.status;

    select event_row.resulting_status
    into v_prior_lifecycle_status
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id = v_binding.resource_id
    order by event_row.event_number desc
    limit 1;

    if p_decision = 'start_review' then
      if v_publication.status <> 'ready_for_review' then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_invalid_review_transition',
          'Only ready Audio can enter Review.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'lifecycle_status', v_publication.status
          )
        );
      else
        v_result_status := 'in_review';
        v_action := 'review_started';
        v_result_version_id := v_submitted.id;
        v_result_version_number := v_submitted.version_number;
      end if;

    elsif p_decision = 'request_changes' then
      if v_publication.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_invalid_review_transition',
          'The Audio publication is not currently reviewable.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'lifecycle_status', v_publication.status
          )
        );
      else
        v_result_status := 'changes_requested';
        v_action := 'changes_requested';
        v_result_version_id := v_submitted.id;
        v_result_version_number := v_submitted.version_number;
      end if;

    else
      if v_publication.status not in (
        'ready_for_review',
        'in_review'
      ) then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_invalid_review_transition',
          'The Audio publication is not currently reviewable.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'lifecycle_status', v_publication.status
          )
        );
      else
        select *
        into v_approved
        from audio.copy_publication_version_snapshot(
          v_submitted.id,
          'approved',
          'approved',
          v_actor
        );

        v_result_status := 'approved';
        v_action := 'approved';
        v_result_version_id := v_approved.version_id;
        v_result_version_number := v_approved.version_number;
      end if;
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      if p_decision = 'approve' then
        update editorial.resources resource_update
        set
          current_approved_version_id = v_result_version_id,
          updated_at = now()
        where resource_update.id = v_binding.resource_id;
      elsif p_decision = 'request_changes' then
        update editorial.resources resource_update
        set
          current_approved_version_id = null,
          updated_at = now()
        where resource_update.id = v_binding.resource_id;
      end if;

      update audio.publications publication
      set
        status = v_result_status,
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      perform editorial.append_resource_review_event(
        v_binding.resource_id,
        v_submitted.id,
        case
          when p_decision = 'approve'
            then v_result_version_id
          else null
        end,
        v_action,
        v_prior_status,
        v_result_status,
        p_note,
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      if p_decision in (
        'request_changes',
        'approve'
      ) then
        perform editorial.append_resource_lifecycle_event(
          v_binding.resource_id,
          case
            when p_decision = 'approve'
              then v_result_version_id
            else v_submitted.id
          end,
          v_action,
          coalesce(
            v_prior_lifecycle_status,
            v_prior_status
          ),
          v_result_status,
          p_note,
          jsonb_build_object(
            'publication_id', p_publication_id,
            'submitted_version_id', v_submitted.id
          ),
          v_actor,
          v_begin.command_receipt_id,
          v_correlation_id
        );
      end if;

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision',
          v_publication.authority_revision,
        'submitted_version_id', v_submitted.id,
        'version_id', v_result_version_id,
        'version_number', v_result_version_number,
        'lifecycle_status', v_result_status,
        'decision', p_decision,
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Publish exact canonical approved Audio version and shared lifecycle history.
-- ---------------------------------------------------------------------------

create or replace function public.publish_audio_publication_version(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_approved_version_id uuid,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  publication_snapshot_id uuid,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private',
  'audio',
  'media',
  'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_approved audio.publication_versions%rowtype;
  v_published record;
  v_media record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_feed audio.publication_feed_identities%rowtype;
  v_snapshot_id uuid;
  v_published_at timestamptz := now();
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
  for update;

  if not found then
    raise exception 'Audio publication Resource does not exist';
  end if;

  if not editorial.current_user_can_publish_audio(
    v_binding.resource_id
  ) then
    raise exception
      'Audio publication permission is required';
  end if;

  select approved.*
  into v_approved
  from audio.publication_versions approved
  where approved.id = p_approved_version_id
    and approved.resource_id = v_binding.resource_id
    and approved.publication_id = p_publication_id
    and approved.version_kind = 'approved';

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.publish',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'approved_version_id', p_approved_version_id,
      'note', nullif(btrim(p_note), ''),
      'correlation_id', v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id := v_read.resource_id;
    authority_revision := nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
    version_id := nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
    version_number := nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
    publication_snapshot_id := nullif(
      v_read.result_payload ->> 'publication_snapshot_id',
      ''
    )::uuid;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before it could be published.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );

  elsif v_publication.status <> 'approved'
        or v_resource.current_approved_version_id
             is distinct from p_approved_version_id
        or v_approved.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_not_publishable',
      'Only the exact current approved Audio version can be published.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'lifecycle_status', v_publication.status,
        'current_approved_version_id',
          v_resource.current_approved_version_id
      )
    );

  else
    perform 1
    from media.assets asset
    where asset.id = v_approved.master_media_asset_id
    for share;

    begin
      select *
      into strict v_media
      from audio.assert_publishable_version_media(
        v_approved.id
      );
    exception
      when raise_exception then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'audio_publication_media_not_publishable',
          'The approved Audio Media is no longer cleared for public delivery.',
          jsonb_build_object(
            'publication_id', p_publication_id,
            'approved_version_id', v_approved.id
          )
        );
    end;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id = v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      insert into audio.publication_feed_identities (
        publication_id,
        resource_id,
        guid,
        enclosure_url,
        created_by
      )
      values (
        p_publication_id,
        v_binding.resource_id,
        'urn:uuid:' || p_publication_id::text,
        'https://wakilisha.africa/audio/enclosures/'
          || p_publication_id::text
          || '.mp3',
        v_actor
      )
      on conflict on constraint publication_feed_identities_pkey
      do nothing;

      select feed.*
      into v_feed
      from audio.publication_feed_identities feed
      where feed.publication_id = p_publication_id;

      if v_feed.resource_id is distinct from v_binding.resource_id
         or v_feed.guid is distinct from
              'urn:uuid:' || p_publication_id::text
         or v_feed.enclosure_url is distinct from
              'https://wakilisha.africa/audio/enclosures/'
              || p_publication_id::text
              || '.mp3'
      then
        raise exception
          'Audio feed identity drifted from stable publication identity';
      end if;

      select *
      into v_published
      from audio.copy_publication_version_snapshot(
        v_approved.id,
        'published',
        'published',
        v_actor
      );

      update editorial.resources resource_update
      set
        current_published_version_id = v_published.version_id,
        lifecycle_state = 'published',
        visibility = 'public',
        updated_at = now()
      where resource_update.id = v_binding.resource_id;

      update audio.publications publication
      set
        status = 'published',
        authority_revision = publication.authority_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where publication.id = p_publication_id
      returning publication.*
      into v_publication;

      v_snapshot_id := extensions.gen_random_uuid();

      insert into audio.publication_snapshots (
        id,
        resource_id,
        publication_id,
        published_version_id,
        guid,
        enclosure_url,
        enclosure_variant_id,
        enclosure_source_url,
        enclosure_mime_type,
        enclosure_byte_size,
        enclosure_sha256,
        enclosure_duration_seconds,
        published_at,
        command_receipt_id,
        created_by
      )
      values (
        v_snapshot_id,
        v_binding.resource_id,
        p_publication_id,
        v_published.version_id,
        v_feed.guid,
        v_feed.enclosure_url,
        v_media.delivery_variant_id,
        v_media.delivery_url,
        v_media.mime_type,
        v_media.byte_size,
        v_media.sha256,
        v_media.duration_seconds,
        v_published_at,
        v_begin.command_receipt_id,
        v_actor
      );

      perform editorial.append_resource_lifecycle_event(
        v_binding.resource_id,
        v_published.version_id,
        'published',
        'approved',
        'published',
        p_note,
        jsonb_build_object(
          'publication_id', p_publication_id,
          'approved_version_id', v_approved.id,
          'prior_published_version_id',
            v_resource.current_published_version_id,
          'publication_snapshot_id', v_snapshot_id
        ),
        v_actor,
        v_begin.command_receipt_id,
        v_correlation_id
      );

      v_result := jsonb_build_object(
        'publication_id', p_publication_id,
        'resource_id', v_binding.resource_id,
        'authority_revision',
          v_publication.authority_revision,
        'approved_version_id', v_approved.id,
        'version_id', v_published.version_id,
        'version_number', v_published.version_number,
        'publication_snapshot_id', v_snapshot_id,
        'guid', v_feed.guid,
        'enclosure_url', v_feed.enclosure_url,
        'enclosure_source_url', v_media.delivery_url,
        'published_at', v_published_at,
        'lifecycle_status', 'published',
        'correlation_id', v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id := v_read.resource_id;
  authority_revision := nullif(
    v_read.result_payload ->> 'authority_revision',
    ''
  )::bigint;
  version_id := nullif(
    v_read.result_payload ->> 'version_id',
    ''
  )::uuid;
  version_number := nullif(
    v_read.result_payload ->> 'version_number',
    ''
  )::bigint;
  publication_snapshot_id := nullif(
    v_read.result_payload ->> 'publication_snapshot_id',
    ''
  )::uuid;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Preserve accepted browser RPC execution perimeter explicitly after replace.
-- ---------------------------------------------------------------------------

revoke execute
on function public.submit_audio_publication_for_review(
       uuid,bigint,text,text,uuid
     ),
     public.review_audio_publication(
       uuid,bigint,uuid,text,text,text,uuid
     ),
     public.publish_audio_publication_version(
       uuid,bigint,uuid,text,text,uuid
     ),
     public.get_admin_audio_publication_workspace(uuid),
     public.get_audio_editorial_workbench(uuid),
     public.create_audio_time_review_thread(
       uuid,uuid,text,numeric,numeric,text,text
     )
from public, anon;

grant execute
on function public.submit_audio_publication_for_review(
       uuid,bigint,text,text,uuid
     ),
     public.review_audio_publication(
       uuid,bigint,uuid,text,text,text,uuid
     ),
     public.publish_audio_publication_version(
       uuid,bigint,uuid,text,text,uuid
     ),
     public.get_admin_audio_publication_workspace(uuid),
     public.get_audio_editorial_workbench(uuid),
     public.create_audio_time_review_thread(
       uuid,uuid,text,numeric,numeric,text,text
     )
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Migration-local structural and compatibility proof.
-- ---------------------------------------------------------------------------

do $phase_7a_k4c_a1_verify$
declare
  v_baseline phase_7a_k4c_a1_baseline%rowtype;
  v_count bigint;
  v_definition text;
begin
  select *
  into v_baseline
  from phase_7a_k4c_a1_baseline;

  if (select count(*) from audio.publication_review_events)
       <> v_baseline.audio_review_count
     or (
       select md5(
         coalesce(
           string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
           ''
         )
       )
       from audio.publication_review_events e
     ) is distinct from v_baseline.audio_review_fingerprint
     or (select count(*) from audio.publication_lifecycle_events)
          <> v_baseline.audio_lifecycle_count
     or (
       select md5(
         coalesce(
           string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
           ''
         )
       )
       from audio.publication_lifecycle_events e
     ) is distinct from v_baseline.audio_lifecycle_fingerprint
  then
    raise exception
      'STOP: K4C-A1 mutated typed Audio event history';
  end if;

  if exists (
    select 1
    from audio.publication_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'audio_publication_lifecycle'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.version_id is not distinct from source.version_id
     and shared.action = source.action
     and shared.prior_status is not distinct from source.prior_status
     and shared.resulting_status is not distinct from source.resulting_status
     and shared.note is not distinct from source.note
     and shared.metadata = source.metadata
     and shared.actor_id is not distinct from source.actor_id
     and shared.command_receipt_id = source.command_receipt_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'STOP: Audio lifecycle compatibility history is not fully represented';
  end if;

  if exists (
    select 1
    from audio.publication_review_events source
    left join editorial.resource_review_events shared
      on shared.legacy_source_authority = 'audio_publication_review'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.target_version_id = source.target_version_id
     and shared.result_version_id is not distinct from source.result_version_id
     and shared.action = source.action
     and shared.prior_status = source.prior_status
     and shared.resulting_status = source.resulting_status
     and shared.reason is not distinct from source.reason
     and shared.actor_id is not distinct from source.actor_id
     and shared.command_receipt_id = source.command_receipt_id
     and shared.correlation_id = source.correlation_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'STOP: Audio review compatibility history is not fully represented';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events';

  if v_count <> 0 then
    raise exception
      'STOP: % live function(s) still write Audio typed event authority',
      v_count;
  end if;

  select pg_get_functiondef(
    'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('update editorial.resources' in v_definition) = 0
     or position('current_submitted_version_id = v_snapshot.version_id' in v_definition) = 0
     or position('insert into audio.publication_review_events' in v_definition) <> 0
     or position('audio.current_publication_master' in v_definition) = 0
     or position('audio_publication_media_not_publishable' in v_definition) = 0
  then
    raise exception
      'STOP: Audio submit is not shared-event/Resource-pointer authority';
  end if;

  select pg_get_functiondef(
    'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_review_event' in v_definition) = 0
     or position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('update editorial.resources' in v_definition) = 0
     or position('insert into audio.publication_review_events' in v_definition) <> 0
     or position('if p_decision in (' in v_definition) = 0
     or position('audio_submitted_version_stale' in v_definition) = 0
  then
    raise exception
      'STOP: Audio review is not exact-submitted shared authority';
  end if;

  select pg_get_functiondef(
    'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('v_resource.current_approved_version_id' in v_definition) = 0
     or position('current_published_version_id = v_published.version_id' in v_definition) = 0
     or position('audio.assert_publishable_version_media' in v_definition) = 0
     or position('urn:uuid:' in v_definition) = 0
     or position('https://wakilisha.africa/audio/enclosures/' in v_definition) = 0
  then
    raise exception
      'STOP: Audio publish is not exact-approved shared lifecycle authority';
  end if;

  select pg_get_functiondef(
    'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('platform_private.command_receipts' in v_definition) = 0
     or position('insert into audio.publication_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'STOP: Audio lifecycle adapter still owns typed history';
  end if;

  select pg_get_functiondef(
    'public.get_admin_audio_publication_workspace(uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_review_events' in v_definition) = 0
     or position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('v_resource.current_working_version_id' in v_definition) = 0
     or position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_resource.current_approved_version_id' in v_definition) = 0
     or position('v_resource.current_published_version_id' in v_definition) = 0
     or position('audio.publication_review_events' in v_definition) <> 0
     or position('audio.publication_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'STOP: Audio admin workspace is not canonical Resource history';
  end if;

  select pg_get_functiondef(
    'public.get_audio_editorial_workbench(uuid)'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_binding.current_submitted_version_id' in v_definition) <> 0
     or position('audio.publication_version_review_media' in v_definition) = 0
     or position('audio.publication_review_threads' in v_definition) = 0
     or position('audio.publication_review_comments' in v_definition) = 0
  then
    raise exception
      'STOP: Audio editorial workbench lost canonical submitted/timed-review contract';
  end if;

  select pg_get_functiondef(
    'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_binding.current_submitted_version_id' in v_definition) <> 0
     or position('audio.publication_review_threads' in v_definition) = 0
     or position('audio.publication_review_comments' in v_definition) = 0
  then
    raise exception
      'STOP: Audio timed-review creation does not target canonical submitted identity';
  end if;

  select pg_get_functiondef(
    'audio.assert_publication_review_thread_integrity()'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_binding.current_submitted_version_id' in v_definition) <> 0
     or position('publication_version_review_media' in v_definition) = 0
  then
    raise exception
      'STOP: Audio timed-review integrity guard does not use canonical submitted identity';
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: % Audio Resource pointer mirror divergence(s) exist after A1',
      v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name = 'playlist_resources'
      and column_row.column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: A1 regressed Playlist P3 pointer retirement';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: A1 renewed typed Video event authority';
  end if;

  if has_table_privilege('anon', 'audio.publication_review_events', 'INSERT')
     or has_table_privilege('anon', 'audio.publication_review_events', 'UPDATE')
     or has_table_privilege('anon', 'audio.publication_review_events', 'DELETE')
     or has_table_privilege('authenticated', 'audio.publication_review_events', 'INSERT')
     or has_table_privilege('authenticated', 'audio.publication_review_events', 'UPDATE')
     or has_table_privilege('authenticated', 'audio.publication_review_events', 'DELETE')
     or has_table_privilege('service_role', 'audio.publication_review_events', 'INSERT')
     or has_table_privilege('service_role', 'audio.publication_review_events', 'UPDATE')
     or has_table_privilege('service_role', 'audio.publication_review_events', 'DELETE')
     or has_table_privilege('anon', 'audio.publication_lifecycle_events', 'INSERT')
     or has_table_privilege('anon', 'audio.publication_lifecycle_events', 'UPDATE')
     or has_table_privilege('anon', 'audio.publication_lifecycle_events', 'DELETE')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'INSERT')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'UPDATE')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'DELETE')
     or has_table_privilege('service_role', 'audio.publication_lifecycle_events', 'INSERT')
     or has_table_privilege('service_role', 'audio.publication_lifecycle_events', 'UPDATE')
     or has_table_privilege('service_role', 'audio.publication_lifecycle_events', 'DELETE')
  then
    raise exception
      'STOP: A1 broadened typed Audio event-table mutation authority';
  end if;
end;
$phase_7a_k4c_a1_verify$;

commit;
