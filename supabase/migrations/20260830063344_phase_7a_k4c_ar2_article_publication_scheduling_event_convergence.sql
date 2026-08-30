-- Phase 7A K4C-AR2: Article publication and scheduling event convergence.
--
-- Move the six remaining Article publication/scheduling lifecycle writers from
-- editorial.article_lifecycle_events onto canonical shared Resource lifecycle
-- authority. Preserve the mature Article RPC surface, public publication
-- snapshots, schedule authority, Resource pointers, and legacy WordPress-style
-- status semantics.
--
-- The only bounded behavior repair is the pre-existing scheduler typo:
-- editorial.article_versions exposes version_kind, not kind.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k4c-ar2-article-publication-scheduling-event-convergence',
    0
  )
);

create temporary table phase_7a_k4c_ar2_baseline
on commit drop
as
select
  (select count(*) from editorial.article_lifecycle_events)
    as article_lifecycle_count,
  (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.article_lifecycle_events e
  ) as article_lifecycle_fingerprint;

do $phase_7a_k4c_ar2_preflight$
declare
  v_count bigint;
  v_names text[];
  v_definition text;
begin
  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.article_scheduled_publications') is null
     or to_regclass('public.wk_article_publication_snapshots') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regprocedure(
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.publish_article_snapshot(uuid,timestamp with time zone,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.command_request_fingerprint(text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'
     ) is null
     or to_regprocedure(
       'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'
     ) is null
     or to_regprocedure(
       'public.publish_due_article_publications(integer)'
     ) is null
     or to_regprocedure(
       'public.unpublish_article(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.archive_article(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.restore_article_from_archive(uuid,text)'
     ) is null
  then
    raise exception
      'STOP: Phase 7A K4C-AR2 requires accepted 62/AR1 Article publication authority';
  end if;

  if to_regprocedure(
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)'
     ) is not null
  then
    raise exception
      'STOP: K4C-AR2 legacy service Article command bridge already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type in (
      'article.publication.publish',
      'article.publication.schedule',
      'article.publication.publish_scheduled',
      'article.publication.unpublish',
      'article.publication.archive',
      'article.publication.restore'
    )
  ) then
    raise exception
      'STOP: K4C-AR2 Article publication command types already exist';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
       )
     ) <> 'd84d503da70733c010a93025bca7cda7'
     or md5(
       pg_get_functiondef(
         'editorial.publish_article_snapshot(uuid,timestamp with time zone,boolean)'::regprocedure
       )
     ) <> '790c6a5667abd56406ed6fe8eb174997'
     or md5(
       pg_get_functiondef(
         'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'::regprocedure
       )
     ) <> 'a882fafda982eadd23e95f6992f8b4e0'
     or md5(
       pg_get_functiondef(
         'platform_private.command_request_fingerprint(text,uuid,jsonb)'::regprocedure
       )
     ) <> 'e1272546e08c930febbbd694e968b8ca'
  then
    raise exception
      'STOP: K4C-AR2 shared publication/command primitive authority drifted';
  end if;

  if md5(
       pg_get_functiondef(
         'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'd3c2a715d0596e4033e7e319c0b3d4f4'
     or md5(
       pg_get_functiondef(
         'public.publish_due_article_publications(integer)'::regprocedure
       )
     ) <> '09b9ecbbec742481f6146fdaa250b435'
     or md5(
       pg_get_functiondef(
         'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> '105d47e009ec279e3a7e5a362662a31d'
     or md5(
       pg_get_functiondef(
         'public.unpublish_article(uuid,text)'::regprocedure
       )
     ) <> '8f52aca8823b4d23ec995526745176dc'
     or md5(
       pg_get_functiondef(
         'public.archive_article(uuid,text)'::regprocedure
       )
     ) <> 'bc19cc8ba0945d118d743eb709b80d2d'
     or md5(
       pg_get_functiondef(
         'public.restore_article_from_archive(uuid,text)'::regprocedure
       )
     ) <> 'd4239c78dd5cbb2f7da7823b7cf60873'
  then
    raise exception
      'STOP: K4C-AR2 target Article publication function authority drifted';
  end if;

  select pg_get_functiondef(
    'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
  )
  into v_definition;

  if position('version.kind = ''approved''' in v_definition) = 0
     or position('version.version_kind = ''approved''' in v_definition) <> 0
  then
    raise exception
      'STOP: K4C-AR2 expected the bounded pre-existing scheduler version.kind defect';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.correction_article_publication_proof(uuid)'::regprocedure
       )
     ) <> '3bdd9467a857da7a8f6373a50e237295'
     or md5(
       pg_get_functiondef(
         'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
       )
     ) <> 'f89b6060e68ae2e1154f689a741dc831'
  then
    raise exception
      'STOP: K4C-AR2 deferred AR3 Article reader authority drifted';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.article_resources binding
      on binding.resource_id = source.resource_id
     and binding.article_id = source.article_id
    left join editorial.resources resource_row
      on resource_row.id = source.resource_id
     and resource_row.resource_kind = 'article'
    left join editorial.resource_versions version_row
      on version_row.id = source.version_id
     and version_row.resource_id = source.resource_id
    where binding.resource_id is null
       or resource_row.id is null
       or (source.version_id is not null and version_row.id is null)
  ) then
    raise exception
      'STOP: Article lifecycle compatibility history has invalid Resource identity';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    join editorial.resource_lifecycle_events shared
      on shared.id = source.id
    where not (
      shared.legacy_source_authority = 'article_lifecycle'
      and shared.legacy_source_event_id = source.id
    )
  ) then
    raise exception
      'STOP: Article lifecycle compatibility UUID collides with unrelated shared history';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_actions action_row
      on action_row.action = source.action
     and action_row.enabled
    where action_row.action is null
  ) then
    raise exception
      'STOP: Article lifecycle compatibility history contains an action outside shared vocabulary';
  end if;

  select
    count(*),
    array_agg(procedure_row.proname order by procedure_row.proname)
  into
    v_count,
    v_names
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events';

  if v_count <> 6
     or v_names is distinct from array[
       'archive_article',
       'publish_article_version',
       'publish_due_article_publications',
       'restore_article_from_archive',
       'schedule_article_publication',
       'unpublish_article'
     ]::text[]
  then
    raise exception
      'STOP: K4C-AR2 expected exactly six deferred typed Article writers, found % / %',
      v_count,
      v_names;
  end if;
end;
$phase_7a_k4c_ar2_preflight$;


-- Catch up any typed Article lifecycle history written after AR1 production
-- promotion but before AR2 apply. Source rows remain immutable compatibility
-- history.
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
      order by source.created_at, source.id
    ) as catchup_offset
  from editorial.article_lifecycle_events source
  where not exists (
    select 1
    from editorial.resource_lifecycle_events shared
    where shared.legacy_source_authority = 'article_lifecycle'
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
  coalesce(missing.metadata, '{}'::jsonb),
  missing.actor_id,
  null::uuid,
  null::uuid,
  'article_lifecycle',
  missing.id,
  missing.created_at
from missing
order by missing.resource_id, missing.catchup_offset;

set constraints all immediate;
set constraints all deferred;


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
    'article.publication.publish',
    'article.publication.publish.sync',
    'article.publication.publish.accepted',
    'article.publication.publish.succeeded',
    'article.publication.publish.failed',
    'article.publication.publish.retry_scheduled',
    true
  ),
  (
    'article.publication.schedule',
    'article.publication.schedule.sync',
    'article.publication.schedule.accepted',
    'article.publication.schedule.succeeded',
    'article.publication.schedule.failed',
    'article.publication.schedule.retry_scheduled',
    true
  ),
  (
    'article.publication.publish_scheduled',
    'article.publication.publish_scheduled.sync',
    'article.publication.publish_scheduled.accepted',
    'article.publication.publish_scheduled.succeeded',
    'article.publication.publish_scheduled.failed',
    'article.publication.publish_scheduled.retry_scheduled',
    true
  ),
  (
    'article.publication.unpublish',
    'article.publication.unpublish.sync',
    'article.publication.unpublish.accepted',
    'article.publication.unpublish.succeeded',
    'article.publication.unpublish.failed',
    'article.publication.unpublish.retry_scheduled',
    true
  ),
  (
    'article.publication.archive',
    'article.publication.archive.sync',
    'article.publication.archive.accepted',
    'article.publication.archive.succeeded',
    'article.publication.archive.failed',
    'article.publication.archive.retry_scheduled',
    true
  ),
  (
    'article.publication.restore',
    'article.publication.restore.sync',
    'article.publication.restore.accepted',
    'article.publication.restore.succeeded',
    'article.publication.restore.failed',
    'article.publication.restore.retry_scheduled',
    true
  );


-- Extend the accepted AR1 authenticated legacy bridge rather than creating a
-- second browser/editor command primitive.
create or replace function
  platform_private.begin_legacy_authenticated_article_command(
    p_command_type text,
    p_resource_id uuid,
    p_request_payload jsonb
  )
returns table (
  command_receipt_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'platform_private',
  'extensions'
as $function$
declare
  v_begin record;
  v_correlation_id uuid := extensions.gen_random_uuid();
  v_idempotency_key text :=
    'legacy-article:' || replace(v_correlation_id::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_command_type not in (
    'article.review.submit',
    'article.review.request_changes',
    'article.review.approve',
    'article.review.suggestion.accept',
    'article.publication.publish',
    'article.publication.schedule',
    'article.publication.publish_scheduled',
    'article.publication.unpublish',
    'article.publication.archive',
    'article.publication.restore'
  ) then
    raise exception
      'Legacy Article command bridge does not permit command type %',
      p_command_type;
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    p_command_type,
    p_resource_id,
    v_idempotency_key,
    coalesce(p_request_payload, '{}'::jsonb)
      || jsonb_build_object(
           'correlation_id',
           v_correlation_id,
           'legacy_rpc_bridge',
           true
         )
  );

  if v_begin.idempotent_replay
     or v_begin.receipt_status <> 'accepted'
  then
    raise exception
      'Legacy Article command bridge created an invalid command receipt';
  end if;

  command_receipt_id := v_begin.command_receipt_id;
  correlation_id := v_correlation_id;
  return next;
end;
$function$;

revoke execute
on function platform_private.begin_legacy_authenticated_article_command(
  text,uuid,jsonb
)
from public, anon, authenticated, service_role;


-- Scheduled execution needs one command receipt per due Article while
-- preserving a service principal with nullable actor identity.
create function platform_private.begin_legacy_service_article_command(
  p_command_type text,
  p_resource_id uuid,
  p_schedule_id uuid,
  p_request_payload jsonb
)
returns table (
  command_receipt_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'platform_private',
  'extensions'
as $function$
declare
  v_correlation_id uuid := extensions.gen_random_uuid();
  v_idempotency_key text;
  v_payload jsonb;
  v_fingerprint text;
  v_receipt platform_private.command_receipts%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required';
  end if;

  if p_command_type <> 'article.publication.publish_scheduled' then
    raise exception
      'Legacy service Article command bridge does not permit command type %',
      p_command_type;
  end if;

  if p_resource_id is null or p_schedule_id is null then
    raise exception 'Resource and schedule identity are required';
  end if;

  if not exists (
    select 1
    from editorial.resources resource_row
    where resource_row.id = p_resource_id
  ) then
    raise exception 'The command resource does not exist';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = p_command_type
      and command_type.enabled
  ) then
    raise exception 'The command type is missing or disabled';
  end if;

  v_idempotency_key :=
    'legacy-scheduled-article:' ||
    replace(p_schedule_id::text, '-', '');

  v_payload :=
    coalesce(p_request_payload, '{}'::jsonb)
    || jsonb_build_object(
         'correlation_id',
         v_correlation_id,
         'legacy_rpc_bridge',
         true,
         'scheduled_publication_id',
         p_schedule_id
       );

  if jsonb_typeof(v_payload) <> 'object'
     or octet_length(v_payload::text) > 32768
  then
    raise exception
      'Scheduled Article command payload must be a JSON object no larger than 32 KB';
  end if;

  v_fingerprint :=
    platform_private.command_request_fingerprint(
      p_command_type,
      p_resource_id,
      v_payload
    );

  insert into platform_private.command_receipts (
    command_type,
    resource_id,
    principal_key,
    actor_user_id,
    idempotency_key,
    request_fingerprint,
    request_payload
  )
  values (
    p_command_type,
    p_resource_id,
    'service:service_role',
    null,
    v_idempotency_key,
    v_fingerprint,
    v_payload
  )
  on conflict (
    principal_key,
    command_type,
    idempotency_key
  )
  do nothing
  returning *
  into v_receipt;

  if not found then
    select receipt.*
    into v_receipt
    from platform_private.command_receipts receipt
    where receipt.principal_key = 'service:service_role'
      and receipt.command_type = p_command_type
      and receipt.idempotency_key = v_idempotency_key
    for update;

    if not found then
      raise exception 'The scheduled Article command receipt disappeared';
    end if;

    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception
        'The scheduled Article command identity disagrees with existing receipt';
    end if;

    raise exception
      'The scheduled Article publication already has a command receipt';
  end if;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' || v_receipt.id::text || ':accepted',
    v_receipt.id,
    command_type.command_type,
    p_resource_id,
    command_type.accepted_event_type,
    jsonb_build_object(
      'command_receipt_id', v_receipt.id,
      'command_type', p_command_type,
      'resource_id', p_resource_id,
      'principal_key', 'service:service_role',
      'correlation_id', v_correlation_id,
      'scheduled_publication_id', p_schedule_id,
      'accepted_at', now()
    )
  from platform_private.command_types command_type
  where command_type.command_type = p_command_type;

  command_receipt_id := v_receipt.id;
  correlation_id := v_correlation_id;
  return next;
end;
$function$;

revoke execute
on function platform_private.begin_legacy_service_article_command(
  text,uuid,uuid,jsonb
)
from public, anon, authenticated, service_role;


create or replace function public.publish_article_version(
  p_article_id uuid,
  p_version_id uuid default null::uuid,
  p_published_at timestamp with time zone default now(),
  p_note text default null::text
)
returns table(
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_source_version_id uuid;
  v_version_id uuid;
  v_version_number bigint;
  v_prior_status text;
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_source_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_approved_version_id
    );

  if v_source_version_id is null then
    raise exception 'Article must be approved before publication';
  end if;

  if v_resource.current_approved_version_id is null
     or v_source_version_id <> v_resource.current_approved_version_id
  then
    raise exception 'Only the approved article version can be published';
  end if;

  perform 1
  from editorial.article_versions version
  where version.id = v_source_version_id
    and version.article_id = p_article_id
    and version.version_kind = 'approved';

  if not found then
    raise exception 'Only an approved article version can be published';
  end if;

  v_prior_status := v_article.wp_status;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.publication.publish',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'source_version_id', v_source_version_id,
      'published_at', p_published_at,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  select copied.version_id, copied.version_number
  into v_version_id, v_version_number
  from editorial.copy_article_lifecycle_version(
    v_source_version_id,
    'published',
    'published',
    'publish',
    p_published_at
  ) copied;

  perform editorial.publish_article_snapshot(
    v_version_id,
    p_published_at,
    true
  );

  update public.wk_articles as article
  set
    wp_status = 'publish',
    published_at = p_published_at,
    updated_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    current_published_version_id = v_version_id,
    lifecycle_state = 'published',
    visibility = 'public',
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_version_id,
    'published',
    v_prior_status,
    'publish',
    p_note,
    jsonb_build_object(
      'article_id', p_article_id,
      'source_version_id', v_source_version_id,
      'publication_mode', 'direct',
      'published_at', p_published_at
    ),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_version_id,
      'version_number', v_version_number,
      'lifecycle_status', 'published',
      'published_at', p_published_at,
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'published';
  return next;
end;
$function$;


create or replace function public.schedule_article_publication(
  p_article_id uuid,
  p_version_id uuid default null::uuid,
  p_publish_at timestamp with time zone default null::timestamp with time zone,
  p_note text default null::text
)
returns table(
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_publish_at timestamptz;
  v_source_version_id uuid;
  v_version_id uuid;
  v_version_number bigint;
  v_prior_status text;
  v_schedule_id uuid;
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  v_publish_at := coalesce(p_publish_at, now());

  if v_publish_at <= now() then
    raise exception 'Scheduled publish time must be in the future';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_source_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_approved_version_id
    );

  if v_source_version_id is null then
    raise exception 'Article must be approved before scheduling';
  end if;

  if v_resource.current_approved_version_id is null
     or v_source_version_id <> v_resource.current_approved_version_id
  then
    raise exception 'Only the approved article version can be scheduled';
  end if;

  perform 1
  from editorial.article_versions version
  where version.id = v_source_version_id
    and version.article_id = p_article_id
    and version.version_kind = 'approved';

  if not found then
    raise exception 'Only an approved article version can be scheduled';
  end if;

  v_prior_status := v_article.wp_status;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.publication.schedule',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'source_version_id', v_source_version_id,
      'publish_at', v_publish_at,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  select copied.version_id, copied.version_number
  into v_version_id, v_version_number
  from editorial.copy_article_lifecycle_version(
    v_source_version_id,
    'scheduled',
    'scheduled',
    'future',
    v_publish_at
  ) copied;

  insert into editorial.article_scheduled_publications (
    resource_id,
    article_id,
    version_id,
    run_after,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_version_id,
    v_publish_at,
    p_note
  )
  returning id
  into v_schedule_id;

  update public.wk_articles as article
  set
    wp_status = 'future',
    published_at = v_publish_at,
    updated_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    current_approved_version_id = v_source_version_id,
    lifecycle_state = 'active',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_version_id,
    'scheduled',
    v_prior_status,
    'future',
    p_note,
    jsonb_build_object(
      'article_id', p_article_id,
      'source_version_id', v_source_version_id,
      'publishAt', v_publish_at,
      'scheduledPublicationId', v_schedule_id
    ),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_version_id,
      'version_number', v_version_number,
      'lifecycle_status', 'scheduled',
      'scheduled_publication_id', v_schedule_id,
      'publish_at', v_publish_at,
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'scheduled';
  return next;
end;
$function$;


create or replace function public.publish_due_article_publications(
  p_limit integer default 25
)
returns table(
  article_id uuid,
  article_slug text,
  schedule_id uuid,
  version_id uuid,
  published_at timestamp with time zone,
  status text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  due_schedule editorial.article_scheduled_publications%rowtype;
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_limit integer;
  v_command record;
  v_actor_id uuid;
begin
  if auth.role() <> 'service_role'
     and not editorial.current_user_can_publish_article()
  then
    raise exception 'Permission denied';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 25), 1), 100);

  for due_schedule in
    select scheduled.*
    from editorial.article_scheduled_publications scheduled
    where scheduled.status = 'scheduled'
      and scheduled.run_after <= now()
    order by scheduled.run_after asc
    limit v_limit
    for update skip locked
  loop
    select article.*
    into v_article
    from public.wk_articles article
    where article.id = due_schedule.article_id
    for update;

    if not found then
      update editorial.article_scheduled_publications
      set
        status = 'failed',
        updated_at = now()
      where id = due_schedule.id;

      continue;
    end if;

    select resource.*
    into v_resource
    from editorial.resources resource
    where resource.id = due_schedule.resource_id
    for update;

    if not found then
      update editorial.article_scheduled_publications
      set
        status = 'failed',
        updated_at = now()
      where id = due_schedule.id;

      continue;
    end if;

    if coalesce(auth.role(), '') = 'service_role' then
      select *
      into v_command
      from platform_private.begin_legacy_service_article_command(
        'article.publication.publish_scheduled',
        due_schedule.resource_id,
        due_schedule.id,
        jsonb_build_object(
          'article_id', due_schedule.article_id,
          'scheduled_version_id', due_schedule.version_id,
          'scheduled_for', due_schedule.run_after,
          'note', nullif(btrim(coalesce(due_schedule.note, '')), '')
        )
      );

      v_actor_id := null;
    else
      select *
      into v_command
      from platform_private.begin_legacy_authenticated_article_command(
        'article.publication.publish_scheduled',
        due_schedule.resource_id,
        jsonb_build_object(
          'article_id', due_schedule.article_id,
          'scheduled_publication_id', due_schedule.id,
          'scheduled_version_id', due_schedule.version_id,
          'scheduled_for', due_schedule.run_after,
          'note', nullif(btrim(coalesce(due_schedule.note, '')), '')
        )
      );

      v_actor_id := auth.uid();
    end if;

    select copied.version_id, copied.version_number
    into v_version_id, v_version_number
    from editorial.copy_article_lifecycle_version(
      due_schedule.version_id,
      'published',
      'published',
      'publish',
      due_schedule.run_after
    ) copied;

    perform editorial.publish_article_snapshot(
      v_version_id,
      due_schedule.run_after,
      true
    );

    update public.wk_articles as article
    set
      wp_status = 'publish',
      published_at = due_schedule.run_after,
      updated_at = now()
    where article.id = due_schedule.article_id
    returning article.*
    into v_article;

    update editorial.resources
    set
      current_published_version_id = v_version_id,
      lifecycle_state = 'published',
      visibility = 'public',
      updated_at = now()
    where id = due_schedule.resource_id;

    update editorial.article_scheduled_publications
    set
      status = 'published',
      updated_at = now()
    where id = due_schedule.id;

    perform editorial.append_resource_lifecycle_event(
      due_schedule.resource_id,
      v_version_id,
      'published',
      'future',
      'publish',
      due_schedule.note,
      jsonb_build_object(
        'article_id', due_schedule.article_id,
        'publication_mode', 'scheduled',
        'scheduledPublicationId', due_schedule.id,
        'scheduledFor', due_schedule.run_after,
        'scheduledVersionId', due_schedule.version_id
      ),
      v_actor_id,
      v_command.command_receipt_id,
      v_command.correlation_id
    );

    perform platform_private.complete_resource_command(
      v_command.command_receipt_id,
      jsonb_build_object(
        'article_id', due_schedule.article_id,
        'article_slug', v_article.slug,
        'schedule_id', due_schedule.id,
        'version_id', v_version_id,
        'version_number', v_version_number,
        'published_at', due_schedule.run_after,
        'status', 'published',
        'correlation_id', v_command.correlation_id
      )
    );

    article_id := due_schedule.article_id;
    article_slug := v_article.slug;
    schedule_id := due_schedule.id;
    version_id := v_version_id;
    published_at := due_schedule.run_after;
    status := 'published';
    return next;
  end loop;
end;
$function$;


create or replace function public.unpublish_article(
  p_article_id uuid,
  p_note text default null::text
)
returns table(
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_prior_status text;
  v_target_version_id uuid;
  v_target_number bigint;
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_prior_status := v_article.wp_status;
  v_target_version_id :=
    coalesce(
      v_resource.current_published_version_id,
      v_resource.current_working_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.publication.unpublish',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'target_version_id', v_target_version_id,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  update public.wk_article_publication_snapshots snapshot
  set
    is_active = false,
    updated_at = now()
  where snapshot.article_id = p_article_id
    and snapshot.is_active = true;

  update public.wk_articles as article
  set
    wp_status = 'draft',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    lifecycle_state = 'draft',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_target_version_id,
    'unpublished',
    v_prior_status,
    'draft',
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_target_version_id,
      'version_number', coalesce(v_target_number, 0),
      'lifecycle_status', 'unpublished',
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := coalesce(v_target_number, 0);
  lifecycle_status := 'unpublished';
  return next;
end;
$function$;


create or replace function public.archive_article(
  p_article_id uuid,
  p_note text default null::text
)
returns table(
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_prior_status text;
  v_target_version_id uuid;
  v_target_number bigint;
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_prior_status := v_article.wp_status;
  v_target_version_id :=
    coalesce(
      v_resource.current_published_version_id,
      v_resource.current_working_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.publication.archive',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'target_version_id', v_target_version_id,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  update public.wk_articles as article
  set
    wp_status = 'trash',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update public.wk_article_publication_snapshots snapshot
  set
    is_active = false,
    updated_at = now()
  where snapshot.article_id = p_article_id
    and snapshot.is_active = true;

  update editorial.resources
  set
    lifecycle_state = 'archived',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_target_version_id,
    'archived',
    v_prior_status,
    'trash',
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_target_version_id,
      'version_number', coalesce(v_target_number, 0),
      'lifecycle_status', 'archived',
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := coalesce(v_target_number, 0);
  lifecycle_status := 'archived';
  return next;
end;
$function$;


create or replace function public.restore_article_from_archive(
  p_article_id uuid,
  p_note text default null::text
)
returns table(
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_prior_status text;
  v_target_version_id uuid;
  v_target_number bigint;
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(v_resource.id) then
    raise exception 'Permission denied';
  end if;

  v_prior_status := v_article.wp_status;
  v_target_version_id :=
    coalesce(
      v_resource.current_working_version_id,
      v_resource.current_published_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.publication.restore',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'target_version_id', v_target_version_id,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  update public.wk_articles as article
  set
    wp_status = 'draft',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    lifecycle_state = 'draft',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_target_version_id,
    'restored',
    v_prior_status,
    'draft',
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_target_version_id,
      'version_number', coalesce(v_target_number, 0),
      'lifecycle_status', 'restored',
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := coalesce(v_target_number, 0);
  lifecycle_status := 'restored';
  return next;
end;
$function$;


-- CREATE OR REPLACE on exposed-schema functions may widen default EXECUTE on
-- preview branches. Restore the accepted production RPC perimeter explicitly.
revoke execute
on function public.publish_article_version(
  uuid,uuid,timestamp with time zone,text
)
from public, anon;

revoke execute
on function public.schedule_article_publication(
  uuid,uuid,timestamp with time zone,text
)
from public, anon;

revoke execute
on function public.publish_due_article_publications(integer)
from public, anon;

revoke execute
on function public.unpublish_article(uuid,text)
from public, anon;

revoke execute
on function public.archive_article(uuid,text)
from public, anon;

revoke execute
on function public.restore_article_from_archive(uuid,text)
from public, anon;

grant execute
on function public.publish_article_version(
  uuid,uuid,timestamp with time zone,text
)
to authenticated, service_role;

grant execute
on function public.schedule_article_publication(
  uuid,uuid,timestamp with time zone,text
)
to authenticated, service_role;

grant execute
on function public.publish_due_article_publications(integer)
to authenticated, service_role;

grant execute
on function public.unpublish_article(uuid,text)
to authenticated, service_role;

grant execute
on function public.archive_article(uuid,text)
to authenticated, service_role;

grant execute
on function public.restore_article_from_archive(uuid,text)
to authenticated, service_role;


do $phase_7a_k4c_ar2_postflight$
declare
  v_count bigint;
  v_names text[];
  v_definition text;
begin
  if (
    select count(*)
    from editorial.article_lifecycle_events
  ) <> (
    select article_lifecycle_count
    from phase_7a_k4c_ar2_baseline
  ) or (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.article_lifecycle_events e
  ) is distinct from (
    select article_lifecycle_fingerprint
    from phase_7a_k4c_ar2_baseline
  ) then
    raise exception
      'STOP: K4C-AR2 changed typed Article lifecycle compatibility history';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'article_lifecycle'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.version_id is not distinct from source.version_id
     and shared.action = source.action
     and shared.prior_status is not distinct from source.prior_status
     and shared.resulting_status is not distinct from source.resulting_status
     and shared.note is not distinct from source.note
     and shared.metadata = coalesce(source.metadata, '{}'::jsonb)
     and shared.actor_id is not distinct from source.actor_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'STOP: K4C-AR2 Article compatibility history is not fully mapped';
  end if;

  select
    count(*),
    array_agg(procedure_row.proname order by procedure_row.proname)
  into
    v_count,
    v_names
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events';

  if v_count <> 0 then
    raise exception
      'STOP: K4C-AR2 left typed Article lifecycle writers: % / %',
      v_count,
      v_names;
  end if;

  foreach v_definition in array array[
    pg_get_functiondef(
      'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.publish_due_article_publications(integer)'::regprocedure
    ),
    pg_get_functiondef(
      'public.unpublish_article(uuid,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.archive_article(uuid,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.restore_article_from_archive(uuid,text)'::regprocedure
    )
  ]
  loop
    if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
       or position('platform_private.complete_resource_command' in v_definition) = 0
       or position('insert into editorial.article_lifecycle_events' in v_definition) <> 0
    then
      raise exception
        'STOP: K4C-AR2 publication writer did not converge onto shared lifecycle authority';
    end if;
  end loop;

  select pg_get_functiondef(
    'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
  )
  into v_definition;

  if position('version.version_kind = ''approved''' in v_definition) = 0
     or position('version.kind = ''approved''' in v_definition) <> 0
  then
    raise exception
      'STOP: K4C-AR2 bounded scheduler version_kind repair is absent or regressed';
  end if;

  select pg_get_functiondef(
    'public.publish_due_article_publications(integer)'::regprocedure
  )
  into v_definition;

  if position('platform_private.begin_legacy_service_article_command' in v_definition) = 0
     or position('article.publication.publish_scheduled' in v_definition) = 0
     or position('scheduledPublicationId' in v_definition) = 0
  then
    raise exception
      'STOP: K4C-AR2 scheduled publication command identity is incomplete';
  end if;

  select count(*)
  into v_count
  from platform_private.command_types command_type
  where command_type.command_type in (
    'article.publication.publish',
    'article.publication.schedule',
    'article.publication.publish_scheduled',
    'article.publication.unpublish',
    'article.publication.archive',
    'article.publication.restore'
  )
    and command_type.enabled;

  if v_count <> 6 then
    raise exception
      'STOP: K4C-AR2 expected six enabled Article publication command types, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array[
          'search_path=pg_catalog, auth, platform_private, extensions'
        ]::text[]
  ) then
    raise exception
      'STOP: K4C-AR2 legacy service Article command bridge security metadata drifted';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: K4C-AR2 legacy service Article command bridge execution perimeter is too broad';
  end if;

  if has_function_privilege(
       'anon',
       'public.publish_article_version(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.publish_due_article_publications(integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.unpublish_article(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.archive_article(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.restore_article_from_archive(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: K4C-AR2 widened Article publication RPC execution to anon';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.publish_article_version(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.publish_due_article_publications(integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.unpublish_article(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.archive_article(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.restore_article_from_archive(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: K4C-AR2 removed accepted authenticated Article publication RPC access';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.publish_article_snapshot(uuid,timestamp with time zone,boolean)'::regprocedure
       )
     ) <> '790c6a5667abd56406ed6fe8eb174997'
     or md5(
       pg_get_functiondef(
         'editorial.correction_article_publication_proof(uuid)'::regprocedure
       )
     ) <> '3bdd9467a857da7a8f6373a50e237295'
     or md5(
       pg_get_functiondef(
         'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
       )
     ) <> 'f89b6060e68ae2e1154f689a741dc831'
  then
    raise exception
      'STOP: K4C-AR2 modified publication snapshot or deferred AR3 reader authority';
  end if;

  select
    count(*),
    array_agg(
      namespace_row.nspname || '.' || procedure_row.proname
      order by namespace_row.nspname, procedure_row.proname
    )
  into
    v_count,
    v_names
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid) ~ 'editorial[.]article_lifecycle_events'
    and not (
      pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events'
    );

  if v_count <> 2
     or v_names is distinct from array[
       'editorial.correction_article_publication_proof',
       'editorial.derive_publishing_editorial_state'
     ]::text[]
  then
    raise exception
      'STOP: K4C-AR2 deferred AR3 reader boundary is invalid: % / %',
      v_count,
      v_names;
  end if;

  if exists (
    select 1
    from (
      select
        resource_id,
        event_number,
        row_number() over (
          partition by resource_id
          order by event_number
        ) as expected_number
      from editorial.resource_lifecycle_events
    ) sequence_row
    where sequence_row.event_number <> sequence_row.expected_number
  ) then
    raise exception
      'STOP: K4C-AR2 shared Resource lifecycle event sequence is not contiguous';
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name in (
        'playlist_resources',
        'audio_publication_resources'
      )
      and column_row.column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: K4C-AR2 Playlist/Audio pointer compatibility debt regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-AR2 typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_ar2_postflight$;

commit;
