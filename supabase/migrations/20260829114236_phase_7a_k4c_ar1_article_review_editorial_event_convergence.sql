-- Phase 7A K4C-AR1: Article review and editorial event convergence.
--
-- Move Article review-side lifecycle authority onto shared Resource event
-- ledgers while preserving the mature Article RPC/browser surface. The legacy
-- editorial.article_lifecycle_events table remains immutable compatibility
-- history. Article lifecycle position is already canonical on
-- editorial.resources.current_*_version_id and is not redesigned here.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k4c-ar1-article-review-editorial-event-convergence',
    0
  )
);

create temporary table phase_7a_k4c_ar1_baseline
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

do $phase_7a_k4c_ar1_preflight$
declare
  v_count bigint;
begin
  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regprocedure(
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'public.submit_article_for_review(uuid,bigint,text)'
     ) is null
     or to_regprocedure(
       'public.request_article_changes(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.approve_article_version(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.accept_article_suggestion(uuid,bigint,text)'
     ) is null
     or to_regprocedure(
       'public.list_article_lifecycle_events(uuid,integer)'
     ) is null
  then
    raise exception
      'STOP: Phase 7A K4C-AR1 requires accepted 61/A3 Resource and Article authority';
  end if;

  if to_regprocedure(
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'
     ) is not null
  then
    raise exception
      'STOP: K4C-AR1 legacy Article command bridge already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type in (
      'article.review.submit',
      'article.review.request_changes',
      'article.review.approve',
      'article.review.suggestion.accept'
    )
  ) then
    raise exception
      'STOP: K4C-AR1 Article review command types already exist';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
       )
     ) <> 'd84d503da70733c010a93025bca7cda7'
     or md5(
       pg_get_functiondef(
         'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'::regprocedure
       )
     ) <> '54b3f889a5b91bf399bb64b52b830134'
  then
    raise exception
      'STOP: K4C-AR1 shared Resource event helper authority drifted';
  end if;

  if md5(
       pg_get_functiondef(
         'public.submit_article_for_review(uuid,bigint,text)'::regprocedure
       )
     ) <> '26471eff401a949ec29288825a6b4fae'
     or md5(
       pg_get_functiondef(
         'public.request_article_changes(uuid,uuid,text)'::regprocedure
       )
     ) <> 'a90d3d8c3a131decab7902ba788b4a84'
     or md5(
       pg_get_functiondef(
         'public.approve_article_version(uuid,uuid,text)'::regprocedure
       )
     ) <> 'a5293f222abfee6f9ec3c3107d0a371b'
     or md5(
       pg_get_functiondef(
         'public.accept_article_suggestion(uuid,bigint,text)'::regprocedure
       )
     ) <> '4895ad69e2272d8d07126c20be216197'
     or md5(
       pg_get_functiondef(
         'public.list_article_lifecycle_events(uuid,integer)'::regprocedure
       )
     ) <> '223b2362b7acacd12b1f7bd33095e400'
  then
    raise exception
      'STOP: K4C-AR1 target Article function authority drifted';
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
      'STOP: K4C-AR1 deferred AR2 Article publication authority drifted';
  end if;

  if exists (
    select 1
    from editorial.article_resources binding
    join editorial.resources resource_row
      on resource_row.id = binding.resource_id
    where binding.resource_kind <> 'article'
  ) then
    raise exception
      'STOP: Article Resource binding kind drifted before K4C-AR1';
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

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events';

  if v_count <> 10 then
    raise exception
      'STOP: K4C-AR1 expected 10 Article typed lifecycle writers, found %',
      v_count;
  end if;
end;
$phase_7a_k4c_ar1_preflight$;


-- Catch up any typed Article lifecycle events written after K4A but before AR1.
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
    'article.review.submit',
    'article.review.submit.sync',
    'article.review.submit.accepted',
    'article.review.submit.succeeded',
    'article.review.submit.failed',
    'article.review.submit.retry_scheduled',
    true
  ),
  (
    'article.review.request_changes',
    'article.review.request_changes.sync',
    'article.review.request_changes.accepted',
    'article.review.request_changes.succeeded',
    'article.review.request_changes.failed',
    'article.review.request_changes.retry_scheduled',
    true
  ),
  (
    'article.review.approve',
    'article.review.approve.sync',
    'article.review.approve.accepted',
    'article.review.approve.succeeded',
    'article.review.approve.failed',
    'article.review.approve.retry_scheduled',
    true
  ),
  (
    'article.review.suggestion.accept',
    'article.review.suggestion.accept.sync',
    'article.review.suggestion.accept.accepted',
    'article.review.suggestion.accept.succeeded',
    'article.review.suggestion.accept.failed',
    'article.review.suggestion.accept.retry_scheduled',
    true
  );


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
    'article.review.suggestion.accept'
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


create or replace function public.submit_article_for_review(
  p_article_id uuid,
  p_expected_draft_version bigint,
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
  v_version_id uuid;
  v_version_number bigint;
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

  if v_article.draft_version <> p_expected_draft_version then
    raise exception
      'STALE_ARTICLE_VERSION: expected %, current %',
      p_expected_draft_version,
      v_article.draft_version;
  end if;

  v_prior_status := v_article.wp_status;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.review.submit',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'expected_draft_version', p_expected_draft_version,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  update public.wk_articles as article
  set
    wp_status = 'pending',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  select created.version_id, created.version_number
  into v_version_id, v_version_number
  from editorial.insert_article_lifecycle_version_from_article(
    v_resource,
    v_article,
    'submitted',
    'submitted'
  ) created;

  update editorial.resources
  set
    current_submitted_version_id = v_version_id,
    lifecycle_state = 'active',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_version_id,
    'submitted',
    v_prior_status,
    'pending',
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform editorial.append_resource_review_event(
    v_resource.id,
    v_version_id,
    null,
    'submitted',
    v_prior_status,
    'pending',
    p_note,
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
      'lifecycle_status', 'submitted',
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'submitted';
  return next;
end;
$function$;


create or replace function public.request_article_changes(
  p_article_id uuid,
  p_version_id uuid default null::uuid,
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
  v_target_version_id uuid;
  v_target_number bigint;
  v_prior_status text;
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(btrim(p_note), '') is null then
    raise exception 'Requested changes note is required';
  end if;

  if not editorial.current_user_can_review_article() then
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

  v_target_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_submitted_version_id,
      v_resource.current_working_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id
    and version.article_id = p_article_id;

  if not found then
    raise exception 'Article version not found';
  end if;

  v_prior_status := v_article.wp_status;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.review.request_changes',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'target_version_id', v_target_version_id,
      'note', nullif(btrim(p_note), '')
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
    'changes_requested',
    v_prior_status,
    'draft',
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform editorial.append_resource_review_event(
    v_resource.id,
    v_target_version_id,
    null,
    'changes_requested',
    v_prior_status,
    'draft',
    p_note,
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
      'version_number', v_target_number,
      'lifecycle_status', 'changes_requested',
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := v_target_number;
  lifecycle_status := 'changes_requested';
  return next;
end;
$function$;


create or replace function public.approve_article_version(
  p_article_id uuid,
  p_version_id uuid default null::uuid,
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
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_review_article() then
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
      v_resource.current_submitted_version_id,
      v_resource.current_working_version_id
    );

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.review.approve',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'source_version_id', v_source_version_id,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  select copied.version_id, copied.version_number
  into v_version_id, v_version_number
  from editorial.copy_article_lifecycle_version(
    v_source_version_id,
    'approved',
    'approved',
    'pending',
    null
  ) copied;

  update editorial.resources
  set
    current_approved_version_id = v_version_id,
    lifecycle_state = 'active',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_version_id,
    'approved',
    v_article.wp_status,
    'approved',
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform editorial.append_resource_review_event(
    v_resource.id,
    v_source_version_id,
    v_version_id,
    'approved',
    v_article.wp_status,
    'approved',
    p_note,
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
      'lifecycle_status', 'approved',
      'correlation_id', v_command.correlation_id
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'approved';
  return next;
end;
$function$;


create or replace function public.accept_article_suggestion(
  p_suggestion_id uuid,
  p_expected_draft_version bigint,
  p_note text default null::text
)
returns table(
  suggestion_id uuid,
  decision_status text,
  article_id uuid,
  article_slug text,
  draft_version bigint,
  applied_version_id uuid,
  applied_version_number bigint
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_suggestion editorial.article_suggestions%rowtype;
  v_thread editorial.article_review_threads%rowtype;
  v_resource editorial.resources%rowtype;
  v_article public.wk_articles%rowtype;
  v_target editorial.article_versions%rowtype;
  v_new_version_id uuid;
  v_new_version_number bigint;
  v_decided_at timestamptz := now();
  v_prior_status text;
  v_stale record;
  v_command record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_review_article() then
    raise exception 'Permission denied';
  end if;

  select suggestion.*
  into v_suggestion
  from editorial.article_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Article suggestion not found';
  end if;

  if v_suggestion.status <> 'open' then
    raise exception 'Only open suggestions can be accepted';
  end if;

  select thread.*
  into v_thread
  from editorial.article_review_threads thread
  where thread.id = v_suggestion.thread_id
  for update;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = v_thread.resource_id
  for update;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = v_thread.article_id
  for update;

  select version.*
  into v_target
  from editorial.article_versions version
  where version.id = v_thread.target_version_id;

  if not found then
    raise exception 'Suggestion target version not found';
  end if;

  if v_resource.current_submitted_version_id
       is distinct from v_thread.target_version_id
     or v_article.wp_status <> 'pending'
     or v_target.content_fingerprint
       <> v_suggestion.target_version_fingerprint
  then
    update editorial.article_suggestions
    set
      status = 'stale',
      decided_by = auth.uid(),
      decided_at = v_decided_at,
      decision_note =
        'Suggestion no longer targets the active submitted version'
    where id = p_suggestion_id;

    update editorial.article_review_threads
    set
      status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = v_decided_at
    where id = v_thread.id;

    insert into editorial.article_suggestion_events (
      suggestion_id,
      action,
      note
    )
    values (
      p_suggestion_id,
      'marked_stale',
      'Suggestion no longer targets the active submitted version'
    );

    suggestion_id := p_suggestion_id;
    decision_status := 'stale';
    article_id := v_article.id;
    article_slug := v_article.slug;
    draft_version := v_article.draft_version;
    applied_version_id := null;
    applied_version_number := null;
    return next;
    return;
  end if;

  v_prior_status := v_article.wp_status;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.review.suggestion.accept',
    v_resource.id,
    jsonb_build_object(
      'suggestion_id', p_suggestion_id,
      'article_id', v_article.id,
      'target_version_id', v_thread.target_version_id,
      'expected_draft_version', p_expected_draft_version,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  select
    persisted.version_id,
    persisted.version_number
  into
    v_new_version_id,
    v_new_version_number
  from editorial.apply_article_review_snapshot(
    v_article.id,
    v_resource.id,
    p_expected_draft_version,
    v_suggestion.proposed_content_html
  ) persisted;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = v_thread.article_id;

  update editorial.article_suggestions
  set
    status = 'accepted',
    decided_by = auth.uid(),
    decided_at = v_decided_at,
    decision_note = nullif(btrim(coalesce(p_note, '')), ''),
    applied_version_id = v_new_version_id
  where id = p_suggestion_id;

  update editorial.article_review_threads
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = v_decided_at
  where id = v_thread.id;

  insert into editorial.article_suggestion_events (
    suggestion_id,
    action,
    note,
    applied_version_id
  )
  values (
    p_suggestion_id,
    'accepted',
    nullif(btrim(coalesce(p_note, '')), ''),
    v_new_version_id
  );

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_thread.target_version_id,
    'changes_requested',
    v_prior_status,
    'draft',
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      'Accepted editorial suggestion'
    ),
    jsonb_build_object(
      'article_id', v_article.id,
      'suggestion_id', p_suggestion_id,
      'applied_version_id', v_new_version_id,
      'decision', 'accepted',
      'review_round_closed', true,
      'remaining_open_suggestions_marked_stale', true
    ),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform editorial.append_resource_review_event(
    v_resource.id,
    v_thread.target_version_id,
    null,
    'changes_requested',
    v_prior_status,
    'draft',
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      'Accepted editorial suggestion'
    ),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  -- Quality PR 2 deliberately accepts at most one suggestion from a submitted
  -- review round. Every suggestion stores a complete proposed document
  -- snapshot. Remaining suggestions cannot be silently rebased after the
  -- Article returns to draft.
  for v_stale in
    update editorial.article_suggestions suggestion
    set
      status = 'stale',
      decided_by = auth.uid(),
      decided_at = v_decided_at,
      decision_note =
        'Review round closed after another suggestion was accepted; resubmission is required before reconsideration'
    from editorial.article_review_threads competing_thread
    where competing_thread.id = suggestion.thread_id
      and competing_thread.target_version_id =
        v_thread.target_version_id
      and suggestion.id <> p_suggestion_id
      and suggestion.status = 'open'
    returning
      suggestion.id,
      suggestion.thread_id
  loop
    update editorial.article_review_threads
    set
      status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = v_decided_at
    where id = v_stale.thread_id;

    insert into editorial.article_suggestion_events (
      suggestion_id,
      action,
      note
    )
    values (
      v_stale.id,
      'marked_stale',
      'Review round closed after another suggestion was accepted; resubmission is required before reconsideration'
    );
  end loop;

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'suggestion_id', p_suggestion_id,
      'decision_status', 'accepted',
      'article_id', v_article.id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'applied_version_id', v_new_version_id,
      'applied_version_number', v_new_version_number,
      'correlation_id', v_command.correlation_id
    )
  );

  suggestion_id := p_suggestion_id;
  decision_status := 'accepted';
  article_id := v_article.id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  applied_version_id := v_new_version_id;
  applied_version_number := v_new_version_number;
  return next;
end;
$function$;


-- CREATE OR REPLACE on Supabase preview may reapply exposed-schema default
-- function privileges. Restore the accepted production RPC perimeter
-- explicitly after all five AR1 replacements.
revoke execute
on function public.submit_article_for_review(uuid,bigint,text)
from public, anon;

revoke execute
on function public.request_article_changes(uuid,uuid,text)
from public, anon;

revoke execute
on function public.approve_article_version(uuid,uuid,text)
from public, anon;

revoke execute
on function public.accept_article_suggestion(uuid,bigint,text)
from public, anon;

grant execute
on function public.submit_article_for_review(uuid,bigint,text)
to authenticated, service_role;

grant execute
on function public.request_article_changes(uuid,uuid,text)
to authenticated, service_role;

grant execute
on function public.approve_article_version(uuid,uuid,text)
to authenticated, service_role;

grant execute
on function public.accept_article_suggestion(uuid,bigint,text)
to authenticated, service_role;


create or replace function public.list_article_lifecycle_events(
  p_article_id uuid,
  p_limit integer default 50
)
returns table(
  id uuid,
  article_id uuid,
  version_id uuid,
  version_number bigint,
  action text,
  prior_status text,
  resulting_status text,
  note text,
  metadata jsonb,
  actor_id uuid,
  actor_label text,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_article_id is null then
    raise exception 'Article id is required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  if not exists (
    select 1
    from public.wk_articles article
    where article.id = p_article_id
  ) then
    raise exception 'Article not found';
  end if;

  return query
  select
    event.id::uuid,
    binding.article_id::uuid,
    event.version_id::uuid,
    version.version_number::bigint,
    event.action::text,
    event.prior_status::text,
    event.resulting_status::text,
    event.note::text,
    coalesce(event.metadata, '{}'::jsonb)::jsonb,
    event.actor_id::uuid,
    coalesce(actor.email, event.actor_id::text, 'system')::text as actor_label,
    event.created_at::timestamptz
  from editorial.article_resources binding
  join editorial.resource_lifecycle_events event
    on event.resource_id = binding.resource_id
  left join editorial.article_versions version
    on version.id = event.version_id
   and version.resource_id = binding.resource_id
   and version.article_id = binding.article_id
  left join auth.users actor
    on actor.id = event.actor_id
  where binding.article_id = p_article_id
  order by event.created_at desc, event.id desc
  limit v_limit;
end;
$function$;

revoke execute
on function public.list_article_lifecycle_events(uuid,integer)
from public, anon;

grant execute
on function public.list_article_lifecycle_events(uuid,integer)
to authenticated, service_role;


do $phase_7a_k4c_ar1_postflight$
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
    from phase_7a_k4c_ar1_baseline
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
    from phase_7a_k4c_ar1_baseline
  ) then
    raise exception
      'STOP: K4C-AR1 changed typed Article lifecycle compatibility history';
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
      'STOP: K4C-AR1 Article compatibility history is not fully mapped';
  end if;

  select
    count(*),
    array_agg(
      procedure_row.proname
      order by procedure_row.proname
    )
  into
    v_count,
    v_names
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
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
      'STOP: K4C-AR1 typed Article writer boundary is invalid: % / %',
      v_count,
      v_names;
  end if;

  foreach v_definition in array array[
    pg_get_functiondef(
      'public.submit_article_for_review(uuid,bigint,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.request_article_changes(uuid,uuid,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.approve_article_version(uuid,uuid,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.accept_article_suggestion(uuid,bigint,text)'::regprocedure
    )
  ]
  loop
    if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
       or position('editorial.append_resource_review_event' in v_definition) = 0
       or position('platform_private.begin_legacy_authenticated_article_command' in v_definition) = 0
       or position('platform_private.complete_resource_command' in v_definition) = 0
       or position('insert into editorial.article_lifecycle_events' in v_definition) <> 0
    then
      raise exception
        'STOP: K4C-AR1 Article review writer did not converge onto shared event authority';
    end if;
  end loop;

  select pg_get_functiondef(
    'public.list_article_lifecycle_events(uuid,integer)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.article_resources' in v_definition) = 0
     or position('editorial.article_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'STOP: K4C-AR1 Article lifecycle reader did not converge onto shared history';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = 'article.review.submit'
      and command_type.enabled
  ) or not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = 'article.review.request_changes'
      and command_type.enabled
  ) or not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = 'article.review.approve'
      and command_type.enabled
  ) or not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = 'article.review.suggestion.accept'
      and command_type.enabled
  ) then
    raise exception
      'STOP: K4C-AR1 Article review command types are incomplete';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array[
          'search_path=pg_catalog, auth, platform_private, extensions'
        ]::text[]
  ) then
    raise exception
      'STOP: K4C-AR1 legacy Article command bridge security metadata drifted';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: K4C-AR1 legacy Article command bridge execution perimeter is too broad';
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
      'STOP: K4C-AR1 modified deferred AR2 publication authority';
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
  ) or exists (
    select 1
    from (
      select
        resource_id,
        event_number,
        row_number() over (
          partition by resource_id
          order by event_number
        ) as expected_number
      from editorial.resource_review_events
    ) sequence_row
    where sequence_row.event_number <> sequence_row.expected_number
  ) then
    raise exception
      'STOP: K4C-AR1 shared Resource event sequence is not contiguous';
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
      'STOP: K4C-AR1 Playlist/Audio pointer compatibility debt regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-AR1 typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_ar1_postflight$;

commit;
