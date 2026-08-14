begin;

create schema if not exists platform_private;

comment on schema platform_private is
  'Private orchestration authority for durable commands, jobs, and transactional events.';

revoke all on schema platform_private
  from public, anon, authenticated;

grant usage on schema platform_private
  to service_role;

alter default privileges for role postgres
  in schema platform_private
  revoke all on tables
  from public, anon, authenticated, service_role;

alter default privileges for role postgres
  in schema platform_private
  revoke execute on functions
  from public, anon, authenticated, service_role;

create table platform_private.command_types (
  command_type text primary key,
  job_type text not null unique,
  accepted_event_type text not null unique,
  success_event_type text not null unique,
  failure_event_type text not null unique,
  retry_event_type text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),

  constraint command_types_command_type_format_check
    check (
      command_type ~ '^[a-z][a-z0-9_.]*$'
    ),

  constraint command_types_job_type_format_check
    check (
      job_type ~ '^[a-z][a-z0-9_.]*$'
    ),

  constraint command_types_accepted_event_type_format_check
    check (
      accepted_event_type ~ '^[a-z][a-z0-9_.]*$'
    ),

  constraint command_types_success_event_type_format_check
    check (
      success_event_type ~ '^[a-z][a-z0-9_.]*$'
    ),

  constraint command_types_failure_event_type_format_check
    check (
      failure_event_type ~ '^[a-z][a-z0-9_.]*$'
    ),

  constraint command_types_retry_event_type_format_check
    check (
      retry_event_type ~ '^[a-z][a-z0-9_.]*$'
    ),

  constraint command_types_command_job_key
    unique (
      command_type,
      job_type
    )
);

comment on table platform_private.command_types is
  'Controlled registry of commands and the durable work and events they create.';

create table platform_private.command_receipts (
  id uuid primary key default gen_random_uuid(),
  command_type text not null,
  resource_id uuid not null,
  principal_key text not null,
  actor_user_id uuid,
  idempotency_key text not null,
  request_fingerprint text not null,
  request_payload jsonb not null,
  status text not null default 'accepted',
  result_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  accepted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint command_receipts_command_type_fkey
    foreign key (command_type)
    references platform_private.command_types(command_type)
    on update restrict
    on delete restrict,

  constraint command_receipts_resource_id_fkey
    foreign key (resource_id)
    references editorial.resources(id)
    on update restrict
    on delete restrict,

  constraint command_receipts_actor_user_id_fkey
    foreign key (actor_user_id)
    references auth.users(id)
    on delete set null,

  constraint command_receipts_status_check
    check (
      status in (
        'accepted',
        'succeeded',
        'failed',
        'rejected'
      )
    ),

  constraint command_receipts_principal_key_check
    check (
      principal_key = 'service:service_role'
      or principal_key ~
        '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),

  constraint command_receipts_idempotency_key_check
    check (
      idempotency_key ~
        '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    ),

  constraint command_receipts_request_fingerprint_check
    check (
      request_fingerprint ~ '^[0-9a-f]{64}$'
    ),

  constraint command_receipts_request_payload_check
    check (
      jsonb_typeof(request_payload) = 'object'
      and octet_length(request_payload::text) <= 32768
    ),

  constraint command_receipts_result_payload_check
    check (
      jsonb_typeof(result_payload) = 'object'
      and octet_length(result_payload::text) <= 32768
    ),

  constraint command_receipts_completion_check
    check (
      (
        status = 'accepted'
        and completed_at is null
      )
      or (
        status in (
          'succeeded',
          'failed',
          'rejected'
        )
        and completed_at is not null
      )
    ),

  constraint command_receipts_principal_idempotency_key
    unique (
      principal_key,
      command_type,
      idempotency_key
    ),

  constraint command_receipts_id_resource_command_key
    unique (
      id,
      resource_id,
      command_type
    )
);

comment on table platform_private.command_receipts is
  'Durable idempotent receipts for accepted WAKILISHA platform commands.';

create table platform_private.jobs (
  id uuid primary key default gen_random_uuid(),
  command_receipt_id uuid not null,
  resource_id uuid not null,
  command_type text not null,
  job_key text not null,
  job_type text not null,
  status text not null default 'queued',
  priority smallint not null default 100,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  locked_by text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_receipt_resource_command_fkey
    foreign key (
      command_receipt_id,
      resource_id,
      command_type
    )
    references platform_private.command_receipts(
      id,
      resource_id,
      command_type
    )
    on update restrict
    on delete cascade,

  constraint jobs_command_job_type_fkey
    foreign key (
      command_type,
      job_type
    )
    references platform_private.command_types(
      command_type,
      job_type
    )
    on update restrict
    on delete restrict,

  constraint jobs_status_check
    check (
      status in (
        'queued',
        'running',
        'retry_wait',
        'succeeded',
        'dead_letter',
        'cancelled'
      )
    ),

  constraint jobs_job_key_check
    check (
      job_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    ),

  constraint jobs_attempt_count_check
    check (
      attempt_count >= 0
      and max_attempts between 1 and 25
      and attempt_count <= max_attempts
    ),

  constraint jobs_priority_check
    check (
      priority between 1 and 1000
    ),

  constraint jobs_worker_identity_check
    check (
      locked_by is null
      or locked_by ~
        '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
    ),

  constraint jobs_input_payload_check
    check (
      jsonb_typeof(input_payload) = 'object'
      and octet_length(input_payload::text) <= 65536
    ),

  constraint jobs_result_payload_check
    check (
      jsonb_typeof(result_payload) = 'object'
      and octet_length(result_payload::text) <= 65536
    ),

  constraint jobs_lease_check
    check (
      (
        locked_by is null
        and locked_at is null
        and lease_expires_at is null
      )
      or (
        locked_by is not null
        and locked_at is not null
        and lease_expires_at is not null
        and lease_expires_at > locked_at
      )
    ),

  constraint jobs_terminal_time_check
    check (
      (
        status in (
          'succeeded',
          'dead_letter',
          'cancelled'
        )
        and finished_at is not null
      )
      or (
        status in (
          'queued',
          'running',
          'retry_wait'
        )
        and finished_at is null
      )
    ),

  constraint jobs_receipt_job_key
    unique (
      command_receipt_id,
      job_key
    ),

  constraint jobs_id_receipt_resource_command_key
    unique (
      id,
      command_receipt_id,
      resource_id,
      command_type
    )
);

comment on table platform_private.jobs is
  'Durable leased background work created from accepted platform commands.';

create table platform_private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  command_receipt_id uuid not null,
  job_id uuid,
  command_type text not null,
  aggregate_type text not null default 'resource',
  aggregate_id uuid not null,
  event_type text not null,
  event_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  max_attempts integer not null default 10,
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outbox_events_receipt_resource_command_fkey
    foreign key (
      command_receipt_id,
      aggregate_id,
      command_type
    )
    references platform_private.command_receipts(
      id,
      resource_id,
      command_type
    )
    on update restrict
    on delete cascade,

  constraint outbox_events_job_receipt_resource_command_fkey
    foreign key (
      job_id,
      command_receipt_id,
      aggregate_id,
      command_type
    )
    references platform_private.jobs(
      id,
      command_receipt_id,
      resource_id,
      command_type
    )
    on update restrict
    on delete cascade,

  constraint outbox_events_event_key_check
    check (
      event_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$'
    ),

  constraint outbox_events_aggregate_type_check
    check (
      aggregate_type = 'resource'
    ),

  constraint outbox_events_event_type_check
    check (
      event_type ~ '^[a-z][a-z0-9_.]*$'
    ),

  constraint outbox_events_event_version_check
    check (
      event_version between 1 and 100
    ),

  constraint outbox_events_status_check
    check (
      status in (
        'pending',
        'claimed',
        'retry_wait',
        'published',
        'dead_letter'
      )
    ),

  constraint outbox_events_attempt_count_check
    check (
      attempt_count >= 0
      and max_attempts between 1 and 50
      and attempt_count <= max_attempts
    ),

  constraint outbox_events_payload_check
    check (
      jsonb_typeof(payload) = 'object'
      and octet_length(payload::text) <= 65536
    ),

  constraint outbox_events_headers_check
    check (
      jsonb_typeof(headers) = 'object'
      and octet_length(headers::text) <= 16384
    ),

  constraint outbox_events_claim_identity_check
    check (
      claimed_by is null
      or claimed_by ~
        '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
    ),

  constraint outbox_events_lease_check
    check (
      (
        claimed_by is null
        and claimed_at is null
        and lease_expires_at is null
      )
      or (
        claimed_by is not null
        and claimed_at is not null
        and lease_expires_at is not null
        and lease_expires_at > claimed_at
      )
    ),

  constraint outbox_events_publication_check
    check (
      (
        status = 'published'
        and published_at is not null
      )
      or (
        status <> 'published'
        and published_at is null
      )
    )
);

comment on table platform_private.outbox_events is
  'Transactional events created atomically with command and job state changes.';

create index command_receipts_resource_created_at_idx
  on platform_private.command_receipts(
    resource_id,
    created_at desc
  );

create index command_receipts_status_created_at_idx
  on platform_private.command_receipts(
    status,
    created_at
  );

create index jobs_claim_idx
  on platform_private.jobs(
    status,
    available_at,
    priority,
    created_at
  );

create index jobs_resource_created_at_idx
  on platform_private.jobs(
    resource_id,
    created_at desc
  );

create index outbox_events_claim_idx
  on platform_private.outbox_events(
    status,
    available_at,
    created_at
  );

create index outbox_events_receipt_created_at_idx
  on platform_private.outbox_events(
    command_receipt_id,
    created_at
  );

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type
)
values (
  'resource.reconcile_identity',
  'resource.identity_reconciliation',
  'resource.command.accepted',
  'resource.command.succeeded',
  'resource.command.failed',
  'resource.command.retry_scheduled'
);

create or replace function platform_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

revoke execute
  on function platform_private.touch_updated_at()
  from public, anon, authenticated, service_role;

create trigger command_receipts_touch_updated_at
before update
on platform_private.command_receipts
for each row
execute function platform_private.touch_updated_at();

create trigger jobs_touch_updated_at
before update
on platform_private.jobs
for each row
execute function platform_private.touch_updated_at();

create trigger outbox_events_touch_updated_at
before update
on platform_private.outbox_events
for each row
execute function platform_private.touch_updated_at();

create or replace function platform_private.prevent_command_receipt_retarget()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
    or new.command_type is distinct from old.command_type
    or new.resource_id is distinct from old.resource_id
    or new.principal_key is distinct from old.principal_key
    or new.actor_user_id is distinct from old.actor_user_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.request_fingerprint is distinct from old.request_fingerprint
    or new.request_payload is distinct from old.request_payload
    or new.accepted_at is distinct from old.accepted_at
    or new.created_at is distinct from old.created_at
  then
    raise exception
      'Command receipt identity and accepted request are immutable.';
  end if;

  return new;
end
$function$;

revoke execute
  on function platform_private.prevent_command_receipt_retarget()
  from public, anon, authenticated, service_role;

create trigger command_receipts_prevent_retarget
before update
on platform_private.command_receipts
for each row
execute function platform_private.prevent_command_receipt_retarget();

create or replace function platform_private.prevent_job_retarget()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
    or new.command_receipt_id is distinct from old.command_receipt_id
    or new.resource_id is distinct from old.resource_id
    or new.command_type is distinct from old.command_type
    or new.job_key is distinct from old.job_key
    or new.job_type is distinct from old.job_type
    or new.input_payload is distinct from old.input_payload
    or new.created_at is distinct from old.created_at
  then
    raise exception
      'Job identity and accepted input are immutable.';
  end if;

  return new;
end
$function$;

revoke execute
  on function platform_private.prevent_job_retarget()
  from public, anon, authenticated, service_role;

create trigger jobs_prevent_retarget
before update
on platform_private.jobs
for each row
execute function platform_private.prevent_job_retarget();

create or replace function platform_private.prevent_outbox_event_retarget()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
    or new.event_key is distinct from old.event_key
    or new.command_receipt_id is distinct from old.command_receipt_id
    or new.job_id is distinct from old.job_id
    or new.command_type is distinct from old.command_type
    or new.aggregate_type is distinct from old.aggregate_type
    or new.aggregate_id is distinct from old.aggregate_id
    or new.event_type is distinct from old.event_type
    or new.event_version is distinct from old.event_version
    or new.payload is distinct from old.payload
    or new.headers is distinct from old.headers
    or new.created_at is distinct from old.created_at
  then
    raise exception
      'Outbox event identity and event body are immutable.';
  end if;

  return new;
end
$function$;

revoke execute
  on function platform_private.prevent_outbox_event_retarget()
  from public, anon, authenticated, service_role;

create trigger outbox_events_prevent_retarget
before update
on platform_private.outbox_events
for each row
execute function platform_private.prevent_outbox_event_retarget();

create or replace function platform_private.assert_outbox_event_type()
returns trigger
language plpgsql
set search_path = pg_catalog, platform_private
as $function$
declare
  allowed boolean;
begin
  select new.event_type in (
    command_types.accepted_event_type,
    command_types.success_event_type,
    command_types.failure_event_type,
    command_types.retry_event_type
  )
  into allowed
  from platform_private.command_types
  where command_types.command_type = new.command_type
    and command_types.enabled;

  if coalesce(allowed, false) is not true then
    raise exception
      'Unsupported event type % for command type %.',
      new.event_type,
      new.command_type;
  end if;

  return new;
end
$function$;

revoke execute
  on function platform_private.assert_outbox_event_type()
  from public, anon, authenticated, service_role;

create trigger outbox_events_assert_event_type
before insert or update of event_type, command_type
on platform_private.outbox_events
for each row
execute function platform_private.assert_outbox_event_type();

create or replace function public.submit_resource_reconciliation_command(
  p_resource_id uuid,
  p_idempotency_key text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  command_receipt_id uuid,
  job_id uuid,
  accepted_event_id uuid,
  receipt_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_command_type constant text :=
    'resource.reconcile_identity';
  v_actor_user_id uuid;
  v_auth_role text;
  v_principal_key text;
  v_resource_kind text;
  v_reason text;
  v_metadata jsonb;
  v_request_payload jsonb;
  v_request_fingerprint text;
  v_receipt_id uuid;
  v_existing_fingerprint text;
  v_receipt_status text;
  v_job_id uuid;
  v_event_id uuid;
  v_created boolean;
  v_authorized boolean := false;
begin
  if p_resource_id is null then
    raise exception
      using
        errcode = '22023',
        message = 'resource_id is required.';
  end if;

  if p_idempotency_key is null
    or p_idempotency_key !~
      '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message =
          'idempotency_key must contain 8 to 128 permitted characters.';
  end if;

  v_metadata := coalesce(
    p_metadata,
    '{}'::jsonb
  );

  if jsonb_typeof(v_metadata) <> 'object'
    or octet_length(v_metadata::text) > 16384
  then
    raise exception
      using
        errcode = '22023',
        message =
          'metadata must be a JSON object no larger than 16 KB.';
  end if;

  v_reason := nullif(
    btrim(p_reason),
    ''
  );

  if length(coalesce(v_reason, '')) > 1000 then
    raise exception
      using
        errcode = '22023',
        message = 'reason must not exceed 1000 characters.';
  end if;

  v_auth_role := coalesce(
    auth.role(),
    ''
  );

  v_actor_user_id := auth.uid();

  if v_auth_role = 'service_role' then
    v_principal_key := 'service:service_role';
  elsif v_auth_role = 'authenticated'
    and v_actor_user_id is not null
  then
    v_principal_key :=
      'user:' || v_actor_user_id::text;
  else
    raise exception
      using
        errcode = '42501',
        message =
          'Authentication is required to submit a resource command.';
  end if;

  select resources.resource_kind
  into v_resource_kind
  from editorial.resources
  where resources.id = p_resource_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The requested resource does not exist.';
  end if;

  if v_auth_role = 'service_role' then
    v_authorized := true;
  else
    v_authorized :=
      public.current_user_is_administrator();

    if not v_authorized then
      case v_resource_kind
        when 'article' then
          v_authorized :=
            public.current_user_has_capability(
              'edit_others_articles'
            );

        when 'playlist' then
          v_authorized :=
            public.current_user_has_capability(
              'institute_write'
            )
            or public.current_user_has_capability(
              'institute_admin'
            );

        when 'registry_artist' then
          v_authorized :=
            public.current_user_has_capability(
              'manage_registry'
            );

        else
          v_authorized := false;
      end case;
    end if;
  end if;

  if not v_authorized then
    raise exception
      using
        errcode = '42501',
        message =
          'The caller cannot submit this command for the resource kind.';
  end if;

  v_request_payload := jsonb_build_object(
    'resource_id',
    p_resource_id,
    'reason',
    v_reason,
    'metadata',
    v_metadata
  );

  v_request_fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'command_type',
          v_command_type,
          'resource_id',
          p_resource_id,
          'reason',
          v_reason,
          'metadata',
          v_metadata
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
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
    v_command_type,
    p_resource_id,
    v_principal_key,
    v_actor_user_id,
    p_idempotency_key,
    v_request_fingerprint,
    v_request_payload
  )
  on conflict (
    principal_key,
    command_type,
    idempotency_key
  )
  do nothing
  returning
    id,
    status
  into
    v_receipt_id,
    v_receipt_status;

  v_created := found;

  if not v_created then
    select
      command_receipts.id,
      command_receipts.request_fingerprint,
      command_receipts.status
    into
      v_receipt_id,
      v_existing_fingerprint,
      v_receipt_status
    from platform_private.command_receipts
    where command_receipts.principal_key =
        v_principal_key
      and command_receipts.command_type =
        v_command_type
      and command_receipts.idempotency_key =
        p_idempotency_key
    for update;

    if not found then
      raise exception
        'The idempotency record disappeared during command submission.';
    end if;

    if v_existing_fingerprint <>
      v_request_fingerprint
    then
      raise exception
        using
          errcode = '23505',
          message =
            'The idempotency key was already used for a different request.';
    end if;

    select jobs.id
    into v_job_id
    from platform_private.jobs
    where jobs.command_receipt_id =
        v_receipt_id
      and jobs.job_key = 'primary';

    select outbox_events.id
    into v_event_id
    from platform_private.outbox_events
    where outbox_events.event_key =
      'command:' ||
      v_receipt_id::text ||
      ':accepted';

    if v_job_id is null
      or v_event_id is null
    then
      raise exception
        'The accepted command is missing its durable job or outbox event.';
    end if;

    return query
    select
      v_receipt_id,
      v_job_id,
      v_event_id,
      v_receipt_status,
      true;

    return;
  end if;

  insert into platform_private.jobs (
    command_receipt_id,
    resource_id,
    command_type,
    job_key,
    job_type,
    input_payload
  )
  select
    v_receipt_id,
    p_resource_id,
    command_types.command_type,
    'primary',
    command_types.job_type,
    v_request_payload
  from platform_private.command_types
  where command_types.command_type =
      v_command_type
    and command_types.enabled
  returning id
  into v_job_id;

  if v_job_id is null then
    raise exception
      'The controlled command type is missing or disabled.';
  end if;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    job_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' ||
      v_receipt_id::text ||
      ':accepted',
    v_receipt_id,
    v_job_id,
    command_types.command_type,
    p_resource_id,
    command_types.accepted_event_type,
    jsonb_build_object(
      'command_receipt_id',
      v_receipt_id,
      'job_id',
      v_job_id,
      'command_type',
      command_types.command_type,
      'resource_id',
      p_resource_id,
      'principal_key',
      v_principal_key,
      'accepted_at',
      now()
    )
  from platform_private.command_types
  where command_types.command_type =
      v_command_type
  returning id
  into v_event_id;

  return query
  select
    v_receipt_id,
    v_job_id,
    v_event_id,
    'accepted'::text,
    false;
end
$function$;

revoke execute
  on function public.submit_resource_reconciliation_command(
    uuid,
    text,
    text,
    jsonb
  )
  from public, anon;

grant execute
  on function public.submit_resource_reconciliation_command(
    uuid,
    text,
    text,
    jsonb
  )
  to authenticated, service_role;

create or replace function platform_private.claim_jobs(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 300
)
returns table (
  job_id uuid,
  command_receipt_id uuid,
  resource_id uuid,
  command_type text,
  job_type text,
  attempt_count integer,
  max_attempts integer,
  input_payload jsonb,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
begin
  if coalesce(auth.role(), '') <>
    'service_role'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_worker_id is null
    or p_worker_id !~
      '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'worker_id is invalid.';
  end if;

  if p_limit not between 1 and 100 then
    raise exception
      using
        errcode = '22023',
        message = 'limit must be between 1 and 100.';
  end if;

  if p_lease_seconds not between 30 and 3600 then
    raise exception
      using
        errcode = '22023',
        message =
          'lease_seconds must be between 30 and 3600.';
  end if;

  return query
  with candidates as (
    select jobs.id
    from platform_private.jobs
    where jobs.status in (
        'queued',
        'retry_wait'
      )
      and jobs.available_at <= now()
      and jobs.attempt_count <
        jobs.max_attempts
      and jobs.locked_by is null
    order by
      jobs.priority,
      jobs.available_at,
      jobs.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update platform_private.jobs
    set
      status = 'running',
      attempt_count =
        platform_private.jobs.attempt_count + 1,
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at =
        now() +
        make_interval(
          secs => p_lease_seconds
        ),
      started_at = coalesce(
        platform_private.jobs.started_at,
        now()
      )
    from candidates
    where platform_private.jobs.id =
      candidates.id
    returning platform_private.jobs.*
  )
  select
    claimed.id,
    claimed.command_receipt_id,
    claimed.resource_id,
    claimed.command_type,
    claimed.job_type,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.input_payload,
    claimed.lease_expires_at
  from claimed;
end
$function$;

revoke execute
  on function platform_private.claim_jobs(
    text,
    integer,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function platform_private.claim_jobs(
    text,
    integer,
    integer
  )
  to service_role;

create or replace function platform_private.complete_job(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns table (
  command_receipt_id uuid,
  success_event_id uuid
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_event_id uuid;
  v_event_type text;
begin
  if coalesce(auth.role(), '') <>
    'service_role'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_result is null
    or jsonb_typeof(p_result) <> 'object'
    or octet_length(p_result::text) > 65536
  then
    raise exception
      using
        errcode = '22023',
        message =
          'result must be a JSON object no larger than 64 KB.';
  end if;

  select jobs.*
  into v_job
  from platform_private.jobs
  where jobs.id = p_job_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The requested job does not exist.';
  end if;

  if v_job.status <> 'running'
    or v_job.locked_by is distinct from
      p_worker_id
    or v_job.lease_expires_at is null
    or v_job.lease_expires_at <= now()
  then
    raise exception
      using
        errcode = '55000',
        message =
          'The job is not actively leased to this worker.';
  end if;

  update platform_private.jobs
  set
    status = 'succeeded',
    result_payload = p_result,
    locked_by = null,
    locked_at = null,
    lease_expires_at = null,
    finished_at = now(),
    last_error = null
  where id = v_job.id;

  update platform_private.command_receipts
  set
    status = 'succeeded',
    result_payload = p_result,
    error_code = null,
    error_message = null,
    completed_at = now()
  where id = v_job.command_receipt_id;

  select command_types.success_event_type
  into v_event_type
  from platform_private.command_types
  where command_types.command_type =
    v_job.command_type;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    job_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  values (
    'command:' ||
      v_job.command_receipt_id::text ||
      ':succeeded',
    v_job.command_receipt_id,
    v_job.id,
    v_job.command_type,
    v_job.resource_id,
    v_event_type,
    jsonb_build_object(
      'command_receipt_id',
      v_job.command_receipt_id,
      'job_id',
      v_job.id,
      'resource_id',
      v_job.resource_id,
      'result',
      p_result,
      'completed_at',
      now()
    )
  )
  returning id
  into v_event_id;

  return query
  select
    v_job.command_receipt_id,
    v_event_id;
end
$function$;

revoke execute
  on function platform_private.complete_job(
    uuid,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function platform_private.complete_job(
    uuid,
    text,
    jsonb
  )
  to service_role;

create or replace function platform_private.fail_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
returns table (
  job_status text,
  command_receipt_status text,
  outbox_event_id uuid
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_terminal boolean;
  v_event_id uuid;
  v_event_type text;
  v_receipt_status text;
begin
  if coalesce(auth.role(), '') <>
    'service_role'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if nullif(btrim(p_error), '') is null then
    raise exception
      using
        errcode = '22023',
        message = 'error is required.';
  end if;

  if p_retry_delay_seconds not between
    1 and 86400
  then
    raise exception
      using
        errcode = '22023',
        message =
          'retry_delay_seconds must be between 1 and 86400.';
  end if;

  select jobs.*
  into v_job
  from platform_private.jobs
  where jobs.id = p_job_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The requested job does not exist.';
  end if;

  if v_job.status <> 'running'
    or v_job.locked_by is distinct from
      p_worker_id
    or v_job.lease_expires_at is null
    or v_job.lease_expires_at <= now()
  then
    raise exception
      using
        errcode = '55000',
        message =
          'The job is not actively leased to this worker.';
  end if;

  v_terminal :=
    not p_retryable
    or v_job.attempt_count >=
      v_job.max_attempts;

  if v_terminal then
    update platform_private.jobs
    set
      status = 'dead_letter',
      locked_by = null,
      locked_at = null,
      lease_expires_at = null,
      finished_at = now(),
      last_error = p_error
    where id = v_job.id;

    update platform_private.command_receipts
    set
      status = 'failed',
      error_code = 'job_failed',
      error_message = p_error,
      completed_at = now()
    where id = v_job.command_receipt_id;

    v_receipt_status := 'failed';

    select command_types.failure_event_type
    into v_event_type
    from platform_private.command_types
    where command_types.command_type =
      v_job.command_type;

    insert into platform_private.outbox_events (
      event_key,
      command_receipt_id,
      job_id,
      command_type,
      aggregate_id,
      event_type,
      payload
    )
    values (
      'command:' ||
        v_job.command_receipt_id::text ||
        ':failed',
      v_job.command_receipt_id,
      v_job.id,
      v_job.command_type,
      v_job.resource_id,
      v_event_type,
      jsonb_build_object(
        'command_receipt_id',
        v_job.command_receipt_id,
        'job_id',
        v_job.id,
        'resource_id',
        v_job.resource_id,
        'error',
        p_error,
        'failed_at',
        now()
      )
    )
    returning id
    into v_event_id;

    return query
    select
      'dead_letter'::text,
      v_receipt_status,
      v_event_id;

    return;
  end if;

  update platform_private.jobs
  set
    status = 'retry_wait',
    available_at =
      now() +
      make_interval(
        secs => p_retry_delay_seconds
      ),
    locked_by = null,
    locked_at = null,
    lease_expires_at = null,
    last_error = p_error
  where id = v_job.id;

  v_receipt_status := 'accepted';

  select command_types.retry_event_type
  into v_event_type
  from platform_private.command_types
  where command_types.command_type =
    v_job.command_type;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    job_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  values (
    'job:' ||
      v_job.id::text ||
      ':retry:' ||
      v_job.attempt_count::text,
    v_job.command_receipt_id,
    v_job.id,
    v_job.command_type,
    v_job.resource_id,
    v_event_type,
    jsonb_build_object(
      'command_receipt_id',
      v_job.command_receipt_id,
      'job_id',
      v_job.id,
      'resource_id',
      v_job.resource_id,
      'attempt_count',
      v_job.attempt_count,
      'error',
      p_error,
      'available_at',
      now() +
      make_interval(
        secs => p_retry_delay_seconds
      )
    )
  )
  returning id
  into v_event_id;

  return query
  select
    'retry_wait'::text,
    v_receipt_status,
    v_event_id;
end
$function$;

revoke execute
  on function platform_private.fail_job(
    uuid,
    text,
    text,
    boolean,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function platform_private.fail_job(
    uuid,
    text,
    text,
    boolean,
    integer
  )
  to service_role;

create or replace function platform_private.claim_outbox_events(
  p_dispatcher_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns table (
  event_id uuid,
  event_key text,
  event_type text,
  aggregate_type text,
  aggregate_id uuid,
  event_version integer,
  payload jsonb,
  headers jsonb,
  attempt_count integer,
  max_attempts integer,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
begin
  if coalesce(auth.role(), '') <>
    'service_role'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_dispatcher_id is null
    or p_dispatcher_id !~
      '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'dispatcher_id is invalid.';
  end if;

  if p_limit not between 1 and 100 then
    raise exception
      using
        errcode = '22023',
        message = 'limit must be between 1 and 100.';
  end if;

  if p_lease_seconds not between 30 and 3600 then
    raise exception
      using
        errcode = '22023',
        message =
          'lease_seconds must be between 30 and 3600.';
  end if;

  return query
  with candidates as (
    select outbox_events.id
    from platform_private.outbox_events
    where outbox_events.status in (
        'pending',
        'retry_wait'
      )
      and outbox_events.available_at <= now()
      and outbox_events.attempt_count <
        outbox_events.max_attempts
      and outbox_events.claimed_by is null
    order by
      outbox_events.available_at,
      outbox_events.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update platform_private.outbox_events
    set
      status = 'claimed',
      attempt_count =
        platform_private.outbox_events.attempt_count + 1,
      claimed_by = p_dispatcher_id,
      claimed_at = now(),
      lease_expires_at =
        now() +
        make_interval(
          secs => p_lease_seconds
        )
    from candidates
    where platform_private.outbox_events.id =
      candidates.id
    returning platform_private.outbox_events.*
  )
  select
    claimed.id,
    claimed.event_key,
    claimed.event_type,
    claimed.aggregate_type,
    claimed.aggregate_id,
    claimed.event_version,
    claimed.payload,
    claimed.headers,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.lease_expires_at
  from claimed;
end
$function$;

revoke execute
  on function platform_private.claim_outbox_events(
    text,
    integer,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function platform_private.claim_outbox_events(
    text,
    integer,
    integer
  )
  to service_role;

create or replace function platform_private.mark_outbox_published(
  p_event_id uuid,
  p_dispatcher_id text
)
returns uuid
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_event platform_private.outbox_events%rowtype;
begin
  if coalesce(auth.role(), '') <>
    'service_role'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  select outbox_events.*
  into v_event
  from platform_private.outbox_events
  where outbox_events.id = p_event_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The requested outbox event does not exist.';
  end if;

  if v_event.status <> 'claimed'
    or v_event.claimed_by is distinct from
      p_dispatcher_id
    or v_event.lease_expires_at is null
    or v_event.lease_expires_at <= now()
  then
    raise exception
      using
        errcode = '55000',
        message =
          'The event is not actively leased to this dispatcher.';
  end if;

  update platform_private.outbox_events
  set
    status = 'published',
    claimed_by = null,
    claimed_at = null,
    lease_expires_at = null,
    published_at = now(),
    last_error = null
  where id = v_event.id;

  return v_event.id;
end
$function$;

revoke execute
  on function platform_private.mark_outbox_published(
    uuid,
    text
  )
  from public, anon, authenticated;

grant execute
  on function platform_private.mark_outbox_published(
    uuid,
    text
  )
  to service_role;

create or replace function platform_private.fail_outbox_event(
  p_event_id uuid,
  p_dispatcher_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
returns text
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_event platform_private.outbox_events%rowtype;
  v_terminal boolean;
begin
  if coalesce(auth.role(), '') <>
    'service_role'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if nullif(btrim(p_error), '') is null then
    raise exception
      using
        errcode = '22023',
        message = 'error is required.';
  end if;

  if p_retry_delay_seconds not between
    1 and 86400
  then
    raise exception
      using
        errcode = '22023',
        message =
          'retry_delay_seconds must be between 1 and 86400.';
  end if;

  select outbox_events.*
  into v_event
  from platform_private.outbox_events
  where outbox_events.id = p_event_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The requested outbox event does not exist.';
  end if;

  if v_event.status <> 'claimed'
    or v_event.claimed_by is distinct from
      p_dispatcher_id
    or v_event.lease_expires_at is null
    or v_event.lease_expires_at <= now()
  then
    raise exception
      using
        errcode = '55000',
        message =
          'The event is not actively leased to this dispatcher.';
  end if;

  v_terminal :=
    not p_retryable
    or v_event.attempt_count >=
      v_event.max_attempts;

  if v_terminal then
    update platform_private.outbox_events
    set
      status = 'dead_letter',
      claimed_by = null,
      claimed_at = null,
      lease_expires_at = null,
      last_error = p_error
    where id = v_event.id;

    return 'dead_letter';
  end if;

  update platform_private.outbox_events
  set
    status = 'retry_wait',
    available_at =
      now() +
      make_interval(
        secs => p_retry_delay_seconds
      ),
    claimed_by = null,
    claimed_at = null,
    lease_expires_at = null,
    last_error = p_error
  where id = v_event.id;

  return 'retry_wait';
end
$function$;

revoke execute
  on function platform_private.fail_outbox_event(
    uuid,
    text,
    text,
    boolean,
    integer
  )
  from public, anon, authenticated;

grant execute
  on function platform_private.fail_outbox_event(
    uuid,
    text,
    text,
    boolean,
    integer
  )
  to service_role;

alter table platform_private.command_types
  enable row level security;

alter table platform_private.command_receipts
  enable row level security;

alter table platform_private.jobs
  enable row level security;

alter table platform_private.outbox_events
  enable row level security;

revoke all
  on platform_private.command_types,
     platform_private.command_receipts,
     platform_private.jobs,
     platform_private.outbox_events
  from public, anon, authenticated, service_role;

commit;
