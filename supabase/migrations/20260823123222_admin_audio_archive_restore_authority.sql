begin;

select pg_advisory_xact_lock(hashtextextended('wakilisha:player-editorial-convergence', 0));

do $preflight$
begin
  if to_regclass('audio.publication_lifecycle_events') is not null then
    raise exception 'audio.publication_lifecycle_events already exists';
  end if;

  if to_regprocedure(
    'public.archive_audio_publication(uuid,bigint,text,text,uuid)'
  ) is not null then
    raise exception 'public.archive_audio_publication already exists';
  end if;

  if to_regprocedure(
    'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)'
  ) is not null then
    raise exception 'public.restore_audio_publication_from_archive already exists';
  end if;
end;
$preflight$;

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
  (
    'audio.publication.archive',
    'audio.publication.archive.sync',
    'audio.publication.archive.accepted',
    'audio.publication.archive.succeeded',
    'audio.publication.archive.failed',
    'audio.publication.archive.retry_scheduled',
    true
  ),
  (
    'audio.publication.restore',
    'audio.publication.restore.sync',
    'audio.publication.restore.accepted',
    'audio.publication.restore.succeeded',
    'audio.publication.restore.failed',
    'audio.publication.restore.retry_scheduled',
    true
  )
on conflict (command_type)
do update
set
  job_type = excluded.job_type,
  accepted_event_type = excluded.accepted_event_type,
  success_event_type = excluded.success_event_type,
  failure_event_type = excluded.failure_event_type,
  retry_event_type = excluded.retry_event_type,
  enabled = excluded.enabled;

create table audio.publication_lifecycle_events (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_id uuid not null,
  publication_id uuid not null,
  event_number bigint not null,
  version_id uuid references audio.publication_versions(id) on delete restrict,
  action text not null,
  prior_status text,
  resulting_status text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  command_receipt_id uuid not null unique
    references platform_private.command_receipts(id)
    on delete restrict,
  created_at timestamptz not null default now(),

  constraint audio_publication_lifecycle_binding_fkey
    foreign key (resource_id, publication_id)
    references editorial.audio_publication_resources(resource_id, publication_id)
    on update cascade
    on delete restrict,

  constraint audio_publication_lifecycle_event_number_check
    check (event_number >= 1),

  constraint audio_publication_lifecycle_action_check
    check (action in ('archived', 'restored')),

  constraint audio_publication_lifecycle_result_check
    check (
      (action = 'archived' and resulting_status = 'archived')
      or
      (action = 'restored' and resulting_status = 'draft')
    ),

  constraint audio_publication_lifecycle_resource_number_key
    unique (resource_id, event_number)
);

create index audio_publication_lifecycle_publication_created_idx
  on audio.publication_lifecycle_events(
    publication_id,
    created_at desc,
    id
  );

alter table audio.publication_lifecycle_events enable row level security;
revoke all on table audio.publication_lifecycle_events from public, anon, authenticated;

create or replace function audio.protect_publication_lifecycle_event()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception 'Audio publication lifecycle events are append-only';
end;
$function$;

create trigger audio_publication_lifecycle_events_append_only
before update or delete
on audio.publication_lifecycle_events
for each row
execute function audio.protect_publication_lifecycle_event();

revoke all
on function audio.protect_publication_lifecycle_event()
from public, anon, authenticated;

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
set search_path to 'pg_catalog', 'audio'
as $function$
declare
  v_existing_id uuid;
  v_event_number bigint;
  v_event_id uuid;
begin
  select event.id
  into v_existing_id
  from audio.publication_lifecycle_events event
  where event.command_receipt_id = p_command_receipt_id
    and event.action = p_action;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select coalesce(max(event.event_number), 0) + 1
  into v_event_number
  from audio.publication_lifecycle_events event
  where event.resource_id = p_resource_id;

  insert into audio.publication_lifecycle_events (
    resource_id,
    publication_id,
    event_number,
    version_id,
    action,
    prior_status,
    resulting_status,
    note,
    metadata,
    actor_id,
    command_receipt_id
  )
  values (
    p_resource_id,
    p_publication_id,
    v_event_number,
    p_version_id,
    p_action,
    p_prior_status,
    p_resulting_status,
    nullif(btrim(p_note), ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_actor_id,
    p_command_receipt_id
  )
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

revoke all
on function audio.append_publication_lifecycle_event(
  uuid, uuid, uuid, text, text, text, text, uuid, uuid, jsonb
)
from public, anon, authenticated;

create or replace function public.archive_audio_publication(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table (
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
  v_target audio.publication_versions%rowtype;
  v_prior_status text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('delete_audio'), false)
  ) then
    raise exception 'Audio archive permission is required';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication does not exist';
  end if;

  v_prior_status := v_publication.status;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id
  for update;

  if not found then
    raise exception 'Audio publication Resource binding does not exist';
  end if;

  select version.*
  into v_target
  from audio.publication_versions version
  where version.id = coalesce(
    v_binding.current_working_version_id,
    v_binding.current_submitted_version_id,
    v_binding.current_approved_version_id,
    v_binding.current_published_version_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.archive',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision', p_expected_authority_revision,
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
    version_id := nullif(v_read.result_payload ->> 'version_id', '')::uuid;
    version_number := nullif(v_read.result_payload ->> 'version_number', '')::bigint;
    lifecycle_status := v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before it could be archived.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision', v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );
  elsif v_publication.status = 'archived' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_already_archived',
      'This Audio publication is already archived.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'lifecycle_status', v_publication.status
      )
    );
  else
    update editorial.audio_publication_resources binding
    set current_published_version_id = null
    where binding.publication_id = p_publication_id;

    update editorial.resources resource
    set
      lifecycle_state = 'archived',
      visibility = 'private',
      updated_at = now()
    where resource.id = v_binding.resource_id;

    update audio.publications publication
    set
      status = 'archived',
      authority_revision = publication.authority_revision + 1,
      updated_by = v_actor,
      updated_at = now()
    where publication.id = p_publication_id
    returning publication.* into v_publication;

    perform audio.append_publication_lifecycle_event(
      v_binding.resource_id,
      p_publication_id,
      v_target.id,
      'archived',
      v_prior_status,
      'archived',
      p_note,
      v_actor,
      v_begin.command_receipt_id,
      jsonb_build_object('correlation_id', v_correlation_id)
    );

    v_result := jsonb_build_object(
      'publication_id', p_publication_id,
      'resource_id', v_binding.resource_id,
      'authority_revision', v_publication.authority_revision,
      'version_id', v_target.id,
      'version_number', v_target.version_number,
      'lifecycle_status', 'archived',
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
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
  version_id := nullif(v_read.result_payload ->> 'version_id', '')::uuid;
  version_number := nullif(v_read.result_payload ->> 'version_number', '')::bigint;
  lifecycle_status := v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.archive_audio_publication(uuid, bigint, text, text, uuid)
from public, anon, authenticated;
grant execute
on function public.archive_audio_publication(uuid, bigint, text, text, uuid)
to authenticated;

create or replace function public.restore_audio_publication_from_archive(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_note text default null,
  p_correlation_id uuid default null
)
returns table (
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
  v_target audio.publication_versions%rowtype;
  v_begin record;
  v_read record;
  v_result jsonb;
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
    raise exception 'Audio publication Resource binding does not exist';
  end if;

  if not editorial.current_user_can_edit_audio(v_binding.resource_id) then
    raise exception 'Audio edit permission is required';
  end if;

  select version.*
  into v_target
  from audio.publication_versions version
  where version.id = coalesce(
    v_binding.current_working_version_id,
    v_binding.current_submitted_version_id,
    v_binding.current_approved_version_id,
    v_binding.current_published_version_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.restore',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision', p_expected_authority_revision,
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
    version_id := nullif(v_read.result_payload ->> 'version_id', '')::uuid;
    version_number := nullif(v_read.result_payload ->> 'version_number', '')::bigint;
    lifecycle_status := v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before it could be restored.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision', v_publication.authority_revision,
        'lifecycle_status', v_publication.status
      )
    );
  elsif v_publication.status <> 'archived' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_not_archived',
      'Only an archived Audio publication can be restored.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'lifecycle_status', v_publication.status
      )
    );
  else
    update editorial.resources resource
    set
      lifecycle_state = 'draft',
      visibility = 'internal',
      updated_at = now()
    where resource.id = v_binding.resource_id;

    update audio.publications publication
    set
      status = 'draft',
      authority_revision = publication.authority_revision + 1,
      updated_by = v_actor,
      updated_at = now()
    where publication.id = p_publication_id
    returning publication.* into v_publication;

    perform audio.append_publication_lifecycle_event(
      v_binding.resource_id,
      p_publication_id,
      v_target.id,
      'restored',
      'archived',
      'draft',
      p_note,
      v_actor,
      v_begin.command_receipt_id,
      jsonb_build_object('correlation_id', v_correlation_id)
    );

    v_result := jsonb_build_object(
      'publication_id', p_publication_id,
      'resource_id', v_binding.resource_id,
      'authority_revision', v_publication.authority_revision,
      'version_id', v_target.id,
      'version_number', v_target.version_number,
      'lifecycle_status', 'draft',
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
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
  version_id := nullif(v_read.result_payload ->> 'version_id', '')::uuid;
  version_number := nullif(v_read.result_payload ->> 'version_number', '')::bigint;
  lifecycle_status := v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.restore_audio_publication_from_archive(uuid, bigint, text, text, uuid)
from public, anon, authenticated;
grant execute
on function public.restore_audio_publication_from_archive(uuid, bigint, text, text, uuid)
to authenticated;

create or replace function public.get_admin_audio_publication_workspace(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial', 'audio', 'media'
as $function$
declare
  v_actor uuid := auth.uid();
  v_binding editorial.audio_publication_resources%rowtype;
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
      'working', v_binding.current_working_version_id,
      'submitted', v_binding.current_submitted_version_id,
      'approved', v_binding.current_approved_version_id,
      'published', v_binding.current_published_version_id
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
      from audio.publication_review_events e
      where e.publication_id = p_publication_id
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
      from audio.publication_lifecycle_events e
      where e.publication_id = p_publication_id
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
            and a.target_version_id = v_binding.current_working_version_id
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
            and a.target_version_id = v_binding.current_working_version_id
        ), '[]'::jsonb)
      )
      from (select 1) seed
      left join editorial.audio_publication_version_trust_revisions r
        on r.publication_version_id = v_binding.current_working_version_id
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

revoke all
on function public.get_admin_audio_publication_workspace(uuid)
from public, anon;
grant execute
on function public.get_admin_audio_publication_workspace(uuid)
to authenticated;

commit;
