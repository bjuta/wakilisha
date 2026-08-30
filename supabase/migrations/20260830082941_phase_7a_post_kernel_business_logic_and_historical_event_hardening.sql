begin;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

-- Post-kernel closure repair.
-- This migration does not change Resource/kernel authority.
-- It repairs two pre-existing business-logic defects and freezes retired typed
-- event stores as inaccessible historical evidence.

do $phase_7a_post_kernel_preflight$
declare
  v_security record;
begin
  if md5(pg_get_functiondef(
       'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)'::regprocedure
     )) <> '5f84c8ace1bacd2ca3586adbbc7e4a1b'
  then
    raise exception 'STOP: Audio working-snapshot authority drifted before repair';
  end if;

  if md5(pg_get_functiondef(
       'public.submit_article_for_review(uuid,bigint,text)'::regprocedure
     )) <> '539bf98f189212294b8e1ce65d97e00e'
  then
    raise exception 'STOP: Article review-submit authority drifted before repair';
  end if;

  if to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
  then
    raise exception 'STOP: final Resource kernel authority is incomplete';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='editorial'
      and table_name in ('playlist_resources','audio_publication_resources','video_publication_resources')
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception 'STOP: typed lifecycle pointer compatibility has regressed';
  end if;
end;
$phase_7a_post_kernel_preflight$;

CREATE OR REPLACE FUNCTION public.snapshot_audio_publication_working_version(p_publication_id uuid, p_expected_authority_revision bigint, p_idempotency_key text, p_correlation_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(command_receipt_id uuid, receipt_status text, publication_id uuid, resource_id uuid, resource_kind text, authority_revision bigint, version_id uuid, version_number bigint, result_payload jsonb, idempotent_replay boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private', 'audio', 'extensions'
AS $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_pair record;
  v_current audio.publication_versions%rowtype;
  v_snapshot record;
  v_fingerprint text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_reused boolean := false;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Not authenticated.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Audio publication does not exist.';
  end if;

  select binding as binding_row, resource as resource_row
  into v_pair
  from editorial.audio_publication_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.publication_id =
        p_publication_id
  for update of binding, resource;

  v_binding := v_pair.binding_row;
  v_resource := v_pair.resource_row;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist.';
  end if;

  if not editorial.current_user_can_edit_audio(
    v_binding.resource_id
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio edit permission is required.';
  end if;

  v_fingerprint :=
    audio.publication_content_fingerprint(
      p_publication_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.version.snapshot_working',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'content_fingerprint',
        v_fingerprint,
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    publication_id := p_publication_id;
    resource_id :=
      v_read.resource_id;
    resource_kind :=
      v_binding.resource_kind;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
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
      'The Audio publication changed before the working snapshot could be created.',
      jsonb_build_object(
        'publication_id',
          p_publication_id,
        'authority_revision',
          v_publication.authority_revision
      )
    );
  else
    if v_resource.current_working_version_id
         is not null
    then
      select version.*
      into v_current
      from audio.publication_versions version
      where version.id =
        v_resource.current_working_version_id;

      if found
         and v_current.version_kind =
               'working'
         and v_current.content_fingerprint =
               v_fingerprint
         and v_current.source_authority_revision =
               v_publication.authority_revision
      then
        v_snapshot.version_id :=
          v_current.id;
        v_snapshot.version_number :=
          v_current.version_number;
        v_snapshot.content_fingerprint :=
          v_current.content_fingerprint;
        v_reused := true;
      end if;
    end if;

    if not v_reused then
      select *
      into v_snapshot
      from audio.insert_current_publication_snapshot(
        p_publication_id,
        v_publication.authority_revision,
        'working',
        auth.uid()
      );

      update editorial.resources resource_update
      set current_working_version_id =
            v_snapshot.version_id
      where resource_update.id =
            v_binding.resource_id;
    end if;

    v_result := jsonb_build_object(
      'publication_id',
        p_publication_id,
      'resource_id',
        v_binding.resource_id,
      'resource_kind',
        v_binding.resource_kind,
      'authority_revision',
        v_publication.authority_revision,
      'version_id',
        v_snapshot.version_id,
      'version_number',
        v_snapshot.version_number,
      'content_fingerprint',
        v_snapshot.content_fingerprint,
      'reused_existing_snapshot',
        v_reused,
      'correlation_id',
        v_correlation_id
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

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  publication_id := p_publication_id;
  resource_id :=
    v_read.resource_id;
  resource_kind :=
    v_binding.resource_kind;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_article_for_review(p_article_id uuid, p_expected_draft_version bigint, p_note text DEFAULT NULL::text)
 RETURNS TABLE(article_id uuid, article_slug text, draft_version bigint, version_id uuid, version_number bigint, lifecycle_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'editorial'
AS $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_working_version editorial.article_versions%rowtype;
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

  if v_resource.current_working_version_id is not null then
    select version.*
    into v_working_version
    from editorial.article_versions version
    where version.id = v_resource.current_working_version_id
      and version.resource_id = v_resource.id
      and version.article_id = p_article_id;
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

  if v_working_version.id is not null
     and v_working_version.version_kind = 'correction'
     and v_working_version.source_draft_version = p_expected_draft_version
     and v_working_version.content_fingerprint =
       editorial.article_snapshot_fingerprint(
         v_article.title,
         v_article.slug,
         v_article.excerpt,
         v_article.content_html,
         v_article.author,
         v_article.hero_image_id,
         v_article.hero_image_url,
         v_article.seo,
         v_prior_status,
         v_article.published_at,
         v_article.categories,
         v_article.tags
       )
  then
    select created.version_id, created.version_number
    into v_version_id, v_version_number
    from editorial.copy_article_lifecycle_version(
      v_working_version.id,
      'submitted',
      'submitted',
      'pending',
      v_article.published_at
    ) created;
  else
    select created.version_id, created.version_number
    into v_version_id, v_version_number
    from editorial.insert_article_lifecycle_version_from_article(
      v_resource,
      v_article,
      'submitted',
      'submitted'
    ) created;
  end if;

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
$function$
;

create or replace function platform_private.reject_frozen_historical_event_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    using
      errcode = '55000',
      message = 'Historical typed event tables are frozen evidence. Use shared Resource event authority.';
end;
$function$;

revoke all privileges
on function platform_private.reject_frozen_historical_event_mutation()
from public, anon, authenticated, service_role;

drop policy if exists playlist_review_events_participant_read
on editorial.playlist_review_events;

revoke all privileges on table editorial.article_lifecycle_events
from public, anon, authenticated, service_role;
revoke all privileges on table editorial.playlist_lifecycle_events
from public, anon, authenticated, service_role;
revoke all privileges on table editorial.playlist_review_events
from public, anon, authenticated, service_role;
revoke all privileges on table audio.publication_lifecycle_events
from public, anon, authenticated, service_role;
revoke all privileges on table audio.publication_review_events
from public, anon, authenticated, service_role;

drop trigger if exists article_lifecycle_events_historical_freeze
on editorial.article_lifecycle_events;
create trigger article_lifecycle_events_historical_freeze
before insert or update or delete on editorial.article_lifecycle_events
for each statement
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists playlist_lifecycle_events_historical_freeze
on editorial.playlist_lifecycle_events;
create trigger playlist_lifecycle_events_historical_freeze
before insert or update or delete on editorial.playlist_lifecycle_events
for each statement
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists playlist_review_events_historical_freeze
on editorial.playlist_review_events;
create trigger playlist_review_events_historical_freeze
before insert or update or delete on editorial.playlist_review_events
for each statement
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists audio_publication_lifecycle_events_historical_freeze
on audio.publication_lifecycle_events;
create trigger audio_publication_lifecycle_events_historical_freeze
before insert or update or delete on audio.publication_lifecycle_events
for each statement
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists audio_publication_review_events_historical_freeze
on audio.publication_review_events;
create trigger audio_publication_review_events_historical_freeze
before insert or update or delete on audio.publication_review_events
for each statement
execute function platform_private.reject_frozen_historical_event_mutation();

do $phase_7a_post_kernel_postflight$
declare
  v_definition text;
  v_count bigint;
begin
  v_definition := pg_get_functiondef(
    'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)'::regprocedure
  );
  if position('v_current.source_authority_revision' in v_definition)=0
     or position('v_publication.authority_revision' in v_definition)=0
  then
    raise exception 'STOP: Audio snapshot reuse revision guard is absent';
  end if;

  v_definition := pg_get_functiondef(
    'public.submit_article_for_review(uuid,bigint,text)'::regprocedure
  );
  if position('v_working_version.version_kind = ''correction''' in v_definition)=0
     or position('editorial.copy_article_lifecycle_version' in v_definition)=0
  then
    raise exception 'STOP: correction review-submit fingerprint preservation is absent';
  end if;

  select count(*) into v_count
  from pg_trigger trigger_row
  where not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'article_lifecycle_events_historical_freeze',
      'playlist_lifecycle_events_historical_freeze',
      'playlist_review_events_historical_freeze',
      'audio_publication_lifecycle_events_historical_freeze',
      'audio_publication_review_events_historical_freeze'
    );
  if v_count <> 5 then
    raise exception 'STOP: expected five historical freeze triggers, found %', v_count;
  end if;

  if exists (
    select 1
    from pg_policies
    where (schemaname,tablename) in (
      ('editorial','article_lifecycle_events'),
      ('editorial','playlist_lifecycle_events'),
      ('editorial','playlist_review_events'),
      ('audio','publication_lifecycle_events'),
      ('audio','publication_review_events')
    )
  ) then
    raise exception 'STOP: retained historical event table still has an application policy';
  end if;

  if has_table_privilege('anon','editorial.article_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','editorial.article_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','editorial.article_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','editorial.playlist_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','editorial.playlist_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','editorial.playlist_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','editorial.playlist_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','editorial.playlist_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','editorial.playlist_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','audio.publication_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','audio.publication_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','audio.publication_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','audio.publication_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','audio.publication_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','audio.publication_review_events','SELECT,INSERT,UPDATE,DELETE')
  then
    raise exception 'STOP: retained historical event table exposes application-role privileges';
  end if;
end;
$phase_7a_post_kernel_postflight$;

commit;
