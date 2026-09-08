-- Phase 8B.5 Candidate B: Messages enforcement, recovery, and severe Media authority.
--
-- Compounds Candidate A Safety Cases, canonical Message chronology, canonical
-- Person/Auth identity, canonical Media file identity, and the existing command,
-- job, lease, retry, dead-letter, and outbox substrate.
--
-- Candidate B adds exactly three peer state tables. It does not create another
-- Safety Case/event ledger, another Media store, another generic queue, global
-- account suspension, Candidate C Legal authority, or Message body mutation.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b5-candidate-b-enforcement-recovery-severe-media',
    0
  )
);

do $preflight$
begin
  if to_regclass('messaging.safety_cases') is null
     or to_regclass('messaging.safety_case_targets') is null
     or to_regclass('messaging.safety_case_events') is null
     or to_regclass('messaging.message_quarantine') is null
     or to_regclass('messaging.messages') is null
     or to_regclass('messaging.conversation_participants') is null
     or to_regclass('messaging.message_resource_references') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.variant_selections') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('platform_private.outbox_events') is null
  then
    raise exception
      'STOP: accepted Candidate A, Messages, Media, or command authority is incomplete';
  end if;

  if to_regprocedure('messaging.current_human_identity()') is null
     or to_regprocedure('messaging.current_messages_super_admin()') is null
     or to_regprocedure('messaging.command_correlation(uuid,text,text,uuid)') is null
     or to_regprocedure('messaging.message_contains_link(text)') is null
     or to_regprocedure('messaging.validate_resource_references(uuid,jsonb)') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.complete_resource_command(uuid,jsonb)') is null
     or to_regprocedure('platform_private.complete_job(uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.fail_job(uuid,text,text,boolean,integer)') is null
     or to_regprocedure('public.start_message_conversation(uuid,text,jsonb,text,uuid,timestamptz)') is null
     or to_regprocedure('public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)') is null
     or to_regprocedure('public.send_message(uuid,text,jsonb,text,uuid,timestamptz)') is null
     or to_regprocedure('public.get_my_message_access()') is null
     or to_regprocedure('public.resolve_message_safety_case_v1(uuid,text,text,text,uuid)') is null
  then
    raise exception
      'STOP: accepted Candidate A or Messages command authority is incomplete';
  end if;

  if to_regprocedure('public.resolve_media_asset_delivery(uuid,uuid,uuid,text)') is null
     or to_regprocedure('public.get_media_private_delivery_target_v1(uuid)') is null
     or to_regprocedure('audio.assert_publishable_version_media(uuid)') is null
     or to_regprocedure('public.get_public_audio_publication_m1(text)') is null
     or to_regprocedure('audio.publication_version_review_media(uuid)') is null
     or to_regprocedure('public.get_audio_editorial_media_context(uuid)') is null
     or to_regprocedure('public.get_media_asset_v2(uuid)') is null
     or to_regprocedure('public.read_media_assets_admin_v2(jsonb)') is null
     or to_regprocedure('video.assert_publishable_media_revision(uuid,uuid,text)') is null
     or to_regprocedure('public.get_public_video_caption_delivery_target(uuid,integer)') is null
     or to_regprocedure('public.get_public_video_transcript_delivery_target(uuid)') is null
     or to_regprocedure('platform_private.get_public_video_publication_phase_7b(text,text)') is null
     or to_regprocedure('public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)') is null
     or to_regprocedure('public.submit_media_processing_profile_v1(uuid,uuid,text,text,uuid)') is null
     or to_regprocedure('public.claim_media_processing_jobs_v1(text,integer,integer)') is null
     or to_regprocedure('public.complete_media_processing_job_v1(uuid,text,jsonb)') is null
     or to_regprocedure('public.fail_media_processing_job_v1(uuid,text,text,boolean,integer)') is null
     or to_regprocedure('public.recover_expired_media_processing_jobs_v1(integer,integer)') is null
  then
    raise exception
      'STOP: accepted Media processing or delivery authority is incomplete';
  end if;

  if to_regclass('messaging.safety_enforcements') is not null
     or to_regclass('messaging.safety_appeals') is not null
     or to_regclass('messaging.safety_media_containment') is not null
     or to_regprocedure('messaging.media_file_is_safety_contained(uuid)') is not null
     or to_regprocedure('public.set_messages_safety_enforcement_v1(uuid,uuid,text,boolean,timestamptz,boolean,text,text,integer,integer,integer,text,uuid)') is not null
  then
    raise exception
      'STOP: Candidate B authority already exists';
  end if;

  if not exists (
    select 1
    from public.role_capabilities
    where role_key='super_admin'
      and capability_key='manage_messages_control_center'
  ) then
    raise exception
      'STOP: Messages Super Admin capability authority is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='media'
      and tablename='file_objects'
      and indexname='file_objects_hash_size_idx'
      and indexdef ilike '%(sha256, byte_size)%'
  ) then
    raise exception
      'STOP: canonical Media hash/size index authority is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='media'
      and relation.relname='file_objects'
      and trigger_row.tgname='file_objects_immutable'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: canonical Media file immutability authority is missing';
  end if;
end;
$preflight$;

-- Implementation freeze: these accepted functions are replaced in place below.
-- Stop rather than patch an authority shape that changed after Candidate B design.
do $authority_freeze$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef(
    'public.get_my_message_access()'::regprocedure
  );
  if position('audience_allows_category' in v_definition)=0
     or position('field_submission_conversation_scope' in v_definition)=0
  then
    raise exception 'STOP: Messages access projection drifted after Candidate B design';
  end if;

  v_definition:=pg_get_functiondef(
    'public.start_message_conversation(uuid,text,jsonb,text,uuid,timestamptz)'::regprocedure
  );
  if position('begin_authenticated_resource_command' in v_definition)=0
     or position('validate_resource_references' in v_definition)=0
     or position('messages-direct-pair:' in v_definition)=0
  then
    raise exception 'STOP: generic Messages start authority drifted after Candidate B design';
  end if;

  v_definition:=pg_get_functiondef(
    'public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)'::regprocedure
  );
  if position('field.submission.message.start' in v_definition)=0
     or position('messages-direct-pair:' in v_definition)=0
  then
    raise exception 'STOP: Field Messages start authority drifted after Candidate B design';
  end if;

  v_definition:=pg_get_functiondef(
    'public.send_message(uuid,text,jsonb,text,uuid,timestamptz)'::regprocedure
  );
  if position('begin_authenticated_resource_command' in v_definition)=0
     or position('validate_resource_references' in v_definition)=0
     or position('field_submission_conversation_scope' in v_definition)=0
  then
    raise exception 'STOP: Messages send authority drifted after Candidate B design';
  end if;

  v_definition:=pg_get_functiondef(
    'public.resolve_message_safety_case_v1(uuid,text,text,text,uuid)'::regprocedure
  );
  if position('message_quarantine' in v_definition)=0
     or position('messages.safety.resolve' in v_definition)=0
  then
    raise exception 'STOP: Candidate A Safety resolution authority drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'::regprocedure
  );
  if position('legacy_snapshot' in v_definition)=0
     or position('variant_selections' in v_definition)=0
  then
    raise exception 'STOP: canonical Media delivery authority drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'audio.assert_publishable_version_media(uuid)'::regprocedure
  );
  if position('audio_delivery' in v_definition)=0
     or position('transcript_media_asset_id' in v_definition)=0
  then
    raise exception 'STOP: Audio publishability authority drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'audio.publication_version_review_media(uuid)'::regprocedure
  );
  if position('audio_delivery_variant_id' in v_definition)=0
     or position('waveform_data' in v_definition)=0
  then
    raise exception 'STOP: Audio review Media projection drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.get_audio_editorial_media_context(uuid)'::regprocedure
  );
  if position('current_publication_master' in v_definition)=0
     or position('audio_preview' in v_definition)=0
     or position('waveform_data' in v_definition)=0
  then
    raise exception 'STOP: Audio editorial Media projection drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'video.assert_publishable_publication_version(uuid)'::regprocedure
  );
  if position('assert_publishable_media_revision' in v_definition)=0
     or position('video_master' in v_definition)=0
  then
    raise exception 'STOP: Video publishability authority drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'platform_private.get_public_video_publication_phase_7b(text,text)'::regprocedure
  );
  if position('assert_publishable_publication_version' in v_definition)=0
     or position('video_hls_master' in v_definition)=0
  then
    raise exception 'STOP: public Video payload authority drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.get_media_asset_v2(uuid)'::regprocedure
  );
  if position('delivery_url' in v_definition)=0
     or position('media.file_objects' in v_definition)=0
  then
    raise exception 'STOP: Media asset detail projection drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.read_media_assets_admin_v2(jsonb)'::regprocedure
  );
  if position('selected_derivatives' in v_definition)=0
     or position('primary_delivery_url' in v_definition)=0
  then
    raise exception 'STOP: Media admin projection drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.list_public_playlists(integer,timestamptz,uuid)'::regprocedure
  );
  if position('playlist_publication_snapshots' in v_definition)=0
     or position('cover_url' in v_definition)=0
  then
    raise exception 'STOP: public Playlist list projection drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.get_public_playlist(text)'::regprocedure
  );
  if position('snapshot.payload' in v_definition)=0 then
    raise exception 'STOP: public Playlist snapshot projection drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.get_playlist_current_cover(uuid)'::regprocedure
  );
  if position('cover_image_url' in v_definition)=0
     or position('playlist_cover' in v_definition)=0
  then
    raise exception 'STOP: current Playlist cover projection drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.get_playlist_cover_source(uuid,uuid)'::regprocedure
  );
  if position('v_file.delivery_url' in v_definition)=0
     or position('current_revision_id' in v_definition)=0
  then
    raise exception 'STOP: Playlist cover source projection drifted';
  end if;
end;
$authority_freeze$;

-- Candidate A vocabulary extensions.
alter table messaging.safety_cases
  drop constraint safety_cases_current_disposition_check,
  add constraint safety_cases_current_disposition_check
    check (
      current_disposition in (
        'pending',
        'no_action',
        'quarantine',
        'enforced'
      )
    );

alter table messaging.safety_cases
  drop constraint safety_cases_resolution_shape_check,
  add constraint safety_cases_resolution_shape_check
    check (
      (
        status <> 'resolved'
        and resolved_by_user_id is null
        and resolved_at is null
        and current_disposition in ('pending','quarantine')
      )
      or
      (
        status='resolved'
        and resolved_by_user_id is not null
        and resolved_at is not null
        and current_disposition in ('no_action','quarantine','enforced')
      )
    );

alter table messaging.safety_case_events
  drop constraint safety_case_events_event_kind_check,
  add constraint safety_case_events_event_kind_check
    check (
      event_kind in (
        'opened',
        'signal_added',
        'review_started',
        'quarantined',
        'released',
        'resolved',
        'evidence_viewed',
        'assessment_updated',
        'enforcement_applied',
        'enforcement_released',
        'enforcement_superseded',
        'enforcement_expired',
        'enforcement_reversed',
        'appeal_submitted',
        'appeal_review_started',
        'appeal_resolved',
        'media_contained',
        'media_containment_released'
      )
    );

insert into platform_private.command_types(
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type
)
values
(
  'messages.safety.assessment.update',
  'messages.safety.assessment.update.sync',
  'messages.safety.assessment.update.accepted',
  'messages.safety.assessment.update.succeeded',
  'messages.safety.assessment.update.failed',
  'messages.safety.assessment.update.retry_scheduled'
),
(
  'messages.safety.enforcement.update',
  'messages.safety.enforcement.update.sync',
  'messages.safety.enforcement.update.accepted',
  'messages.safety.enforcement.update.succeeded',
  'messages.safety.enforcement.update.failed',
  'messages.safety.enforcement.update.retry_scheduled'
),
(
  'messages.safety.appeal.submit',
  'messages.safety.appeal.submit.sync',
  'messages.safety.appeal.submit.accepted',
  'messages.safety.appeal.submit.succeeded',
  'messages.safety.appeal.submit.failed',
  'messages.safety.appeal.submit.retry_scheduled'
),
(
  'messages.safety.appeal.review.start',
  'messages.safety.appeal.review.start.sync',
  'messages.safety.appeal.review.start.accepted',
  'messages.safety.appeal.review.start.succeeded',
  'messages.safety.appeal.review.start.failed',
  'messages.safety.appeal.review.start.retry_scheduled'
),
(
  'messages.safety.appeal.resolve',
  'messages.safety.appeal.resolve.sync',
  'messages.safety.appeal.resolve.accepted',
  'messages.safety.appeal.resolve.succeeded',
  'messages.safety.appeal.resolve.failed',
  'messages.safety.appeal.resolve.retry_scheduled'
),
(
  'messages.safety.media.containment.update',
  'messages.safety.media.containment.update.sync',
  'messages.safety.media.containment.update.accepted',
  'messages.safety.media.containment.update.succeeded',
  'messages.safety.media.containment.update.failed',
  'messages.safety.media.containment.update.retry_scheduled'
),
(
  'messages.safety.media.scan',
  'messages.safety.media.scan',
  'messages.safety.media.scan.accepted',
  'messages.safety.media.scan.succeeded',
  'messages.safety.media.scan.failed',
  'messages.safety.media.scan.retry_scheduled'
);

create table messaging.safety_enforcements (
  id uuid primary key default gen_random_uuid(),
  safety_case_id uuid not null
    references messaging.safety_cases(id)
    on update restrict
    on delete restrict,
  source_message_id uuid not null
    references messaging.messages(id)
    on update restrict
    on delete restrict,
  subject_user_id uuid not null
    references auth.users(id)
    on update restrict
    on delete restrict,
  subject_person_resource_id uuid not null
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  enforcement_kind text not null
    check (
      enforcement_kind in (
        'warning',
        'send_cooldown',
        'send_rate_limit',
        'links_restricted',
        'media_restricted',
        'conversation_start_restricted',
        'messaging_suspended',
        'messaging_removed'
      )
    ),
  status text not null default 'active'
    check (
      status in (
        'active',
        'released',
        'expired',
        'reversed',
        'superseded'
      )
    ),
  applied_at timestamptz not null default now(),
  applied_by_user_id uuid not null
    references auth.users(id)
    on update restrict
    on delete restrict,
  effective_until timestamptz,
  appeal_allowed boolean not null default false,
  public_reason text not null
    check (
      nullif(btrim(public_reason),'') is not null
      and octet_length(public_reason) <= 500
    ),
  internal_reason text not null
    check (
      nullif(btrim(internal_reason),'') is not null
      and octet_length(internal_reason) <= 2000
    ),
  cooldown_seconds integer,
  rate_limit_count integer,
  rate_limit_window_seconds integer,
  ended_at timestamptz,
  ended_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  end_reason text
    check (
      end_reason is null
      or (
        nullif(btrim(end_reason),'') is not null
        and octet_length(end_reason) <= 2000
      )
    ),
  superseded_by_enforcement_id uuid,
  command_receipt_id uuid not null
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,
  revision bigint not null default 1
    check (revision >= 1),
  constraint safety_enforcements_parameter_shape_check
    check (
      (
        enforcement_kind in (
          'warning',
          'links_restricted',
          'media_restricted',
          'conversation_start_restricted',
          'messaging_suspended',
          'messaging_removed'
        )
        and cooldown_seconds is null
        and rate_limit_count is null
        and rate_limit_window_seconds is null
      )
      or
      (
        enforcement_kind='send_cooldown'
        and cooldown_seconds between 5 and 86400
        and rate_limit_count is null
        and rate_limit_window_seconds is null
      )
      or
      (
        enforcement_kind='send_rate_limit'
        and rate_limit_count between 1 and 100
        and rate_limit_window_seconds between 60 and 86400
        and cooldown_seconds is null
      )
    ),
  constraint safety_enforcements_temporal_check
    check (
      (effective_until is null or effective_until > applied_at)
      and (
        enforcement_kind <> 'messaging_removed'
        or effective_until is null
      )
    ),
  constraint safety_enforcements_status_shape_check
    check (
      (
        status='active'
        and ended_at is null
        and ended_by_user_id is null
        and end_reason is null
        and superseded_by_enforcement_id is null
      )
      or
      (
        status in ('released','reversed')
        and ended_at is not null
        and ended_by_user_id is not null
        and end_reason is not null
        and superseded_by_enforcement_id is null
      )
      or
      (
        status='expired'
        and ended_at is not null
        and ended_at >= applied_at
        and superseded_by_enforcement_id is null
      )
      or
      (
        status='superseded'
        and ended_at is not null
        and ended_by_user_id is not null
        and end_reason is not null
        and superseded_by_enforcement_id is not null
      )
    )
);

alter table messaging.safety_enforcements
  add constraint safety_enforcements_superseded_by_fkey
  foreign key (superseded_by_enforcement_id)
  references messaging.safety_enforcements(id)
  on update restrict
  on delete restrict
  deferrable initially deferred;

create unique index safety_enforcements_active_case_subject_kind_key
  on messaging.safety_enforcements(
    safety_case_id,
    subject_user_id,
    enforcement_kind
  )
  where status='active';

create index safety_enforcements_subject_effective_idx
  on messaging.safety_enforcements(
    subject_user_id,
    subject_person_resource_id,
    status,
    effective_until,
    applied_at desc
  );

create index safety_enforcements_case_idx
  on messaging.safety_enforcements(
    safety_case_id,
    applied_at desc,
    id desc
  );

create index safety_enforcements_source_message_idx
  on messaging.safety_enforcements(
    source_message_id,
    applied_at desc,
    id desc
  );


-- Cover every Candidate B foreign-key direction so referenced identity/receipt
-- maintenance never degrades into a sequential scan as Safety history grows.
create index safety_enforcements_applied_by_user_idx
  on messaging.safety_enforcements(applied_by_user_id);

create index safety_enforcements_command_receipt_idx
  on messaging.safety_enforcements(command_receipt_id);

create index safety_enforcements_ended_by_user_idx
  on messaging.safety_enforcements(ended_by_user_id);

create index safety_enforcements_subject_person_idx
  on messaging.safety_enforcements(subject_person_resource_id);

create index safety_enforcements_superseded_by_idx
  on messaging.safety_enforcements(superseded_by_enforcement_id);

create table messaging.safety_appeals (
  id uuid primary key default gen_random_uuid(),
  enforcement_id uuid not null unique
    references messaging.safety_enforcements(id)
    on update restrict
    on delete restrict,
  safety_case_id uuid not null
    references messaging.safety_cases(id)
    on update restrict
    on delete restrict,
  appellant_user_id uuid not null
    references auth.users(id)
    on update restrict
    on delete restrict,
  appellant_person_resource_id uuid not null
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  status text not null default 'open'
    check (status in ('open','under_review','resolved')),
  appeal_reason text not null
    check (
      nullif(btrim(appeal_reason),'') is not null
      and octet_length(appeal_reason) <= 4000
    ),
  submitted_at timestamptz not null default now(),
  review_started_at timestamptz,
  reviewed_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  resolution text
    check (
      resolution is null
      or resolution in ('upheld','modified','reversed')
    ),
  resolution_public_note text
    check (
      resolution_public_note is null
      or (
        nullif(btrim(resolution_public_note),'') is not null
        and octet_length(resolution_public_note) <= 1000
      )
    ),
  resolution_internal_note text
    check (
      resolution_internal_note is null
      or (
        nullif(btrim(resolution_internal_note),'') is not null
        and octet_length(resolution_internal_note) <= 4000
      )
    ),
  resolved_at timestamptz,
  resolved_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  submit_command_receipt_id uuid not null
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,
  review_command_receipt_id uuid
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,
  resolution_command_receipt_id uuid
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,
  revision bigint not null default 1
    check (revision >= 1),
  constraint safety_appeals_shape_check
    check (
      (
        status='open'
        and review_started_at is null
        and reviewed_by_user_id is null
        and resolution is null
        and resolution_public_note is null
        and resolution_internal_note is null
        and resolved_at is null
        and resolved_by_user_id is null
        and review_command_receipt_id is null
        and resolution_command_receipt_id is null
      )
      or
      (
        status='under_review'
        and review_started_at is not null
        and reviewed_by_user_id is not null
        and resolution is null
        and resolution_public_note is null
        and resolution_internal_note is null
        and resolved_at is null
        and resolved_by_user_id is null
        and review_command_receipt_id is not null
        and resolution_command_receipt_id is null
      )
      or
      (
        status='resolved'
        and review_started_at is not null
        and reviewed_by_user_id is not null
        and resolution is not null
        and resolution_public_note is not null
        and resolution_internal_note is not null
        and resolved_at is not null
        and resolved_by_user_id is not null
        and review_command_receipt_id is not null
        and resolution_command_receipt_id is not null
      )
    )
);

create index safety_appeals_case_status_idx
  on messaging.safety_appeals(
    safety_case_id,
    status,
    submitted_at desc,
    id desc
  );

create index safety_appeals_appellant_idx
  on messaging.safety_appeals(
    appellant_user_id,
    appellant_person_resource_id,
    submitted_at desc
  );


create index safety_appeals_appellant_person_idx
  on messaging.safety_appeals(appellant_person_resource_id);

create index safety_appeals_resolution_command_receipt_idx
  on messaging.safety_appeals(resolution_command_receipt_id);

create index safety_appeals_resolved_by_user_idx
  on messaging.safety_appeals(resolved_by_user_id);

create index safety_appeals_review_command_receipt_idx
  on messaging.safety_appeals(review_command_receipt_id);

create index safety_appeals_reviewed_by_user_idx
  on messaging.safety_appeals(reviewed_by_user_id);

create index safety_appeals_submit_command_receipt_idx
  on messaging.safety_appeals(submit_command_receipt_id);

create table messaging.safety_media_containment (
  id uuid primary key default gen_random_uuid(),
  media_file_object_id uuid not null
    references media.file_objects(id)
    on update restrict
    on delete restrict,
  safety_case_id uuid not null
    references messaging.safety_cases(id)
    on update restrict
    on delete restrict,
  status text not null default 'active'
    check (status in ('active','released')),
  policy_category text not null
    check (
      octet_length(policy_category) between 2 and 64
      and policy_category ~ '^[a-z][a-z0-9_]{1,63}$'
    ),
  placed_at timestamptz not null default now(),
  placed_by_user_id uuid not null
    references auth.users(id)
    on update restrict
    on delete restrict,
  released_at timestamptz,
  released_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  release_note text
    check (
      release_note is null
      or (
        nullif(btrim(release_note),'') is not null
        and octet_length(release_note) <= 2000
      )
    ),
  command_receipt_id uuid not null
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,
  constraint safety_media_containment_shape_check
    check (
      (
        status='active'
        and released_at is null
        and released_by_user_id is null
        and release_note is null
      )
      or
      (
        status='released'
        and released_at is not null
        and released_by_user_id is not null
        and release_note is not null
      )
    )
);

create unique index safety_media_containment_active_file_key
  on messaging.safety_media_containment(media_file_object_id)
  where status='active';

create index safety_media_containment_case_idx
  on messaging.safety_media_containment(
    safety_case_id,
    status,
    placed_at desc,
    id desc
  );


create index safety_media_containment_command_receipt_idx
  on messaging.safety_media_containment(command_receipt_id);

create index safety_media_containment_placed_by_user_idx
  on messaging.safety_media_containment(placed_by_user_id);

create index safety_media_containment_released_by_user_idx
  on messaging.safety_media_containment(released_by_user_id);

create index messages_sender_chronology_idx
  on messaging.messages(
    sender_participant_id,
    accepted_at desc,
    id desc
  );

alter table messaging.safety_enforcements enable row level security;
alter table messaging.safety_appeals enable row level security;
alter table messaging.safety_media_containment enable row level security;

revoke all on table messaging.safety_enforcements
  from public, anon, authenticated, service_role;
revoke all on table messaging.safety_appeals
  from public, anon, authenticated, service_role;
revoke all on table messaging.safety_media_containment
  from public, anon, authenticated, service_role;

create or replace function messaging.prevent_candidate_b_history_delete_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Candidate B Safety history is append/recovery governed and cannot be deleted.';
end;
$function$;

create trigger safety_enforcements_no_delete
before delete on messaging.safety_enforcements
for each row execute function messaging.prevent_candidate_b_history_delete_v1();

create trigger safety_appeals_no_delete
before delete on messaging.safety_appeals
for each row execute function messaging.prevent_candidate_b_history_delete_v1();

create trigger safety_media_containment_no_delete
before delete on messaging.safety_media_containment
for each row execute function messaging.prevent_candidate_b_history_delete_v1();

revoke all on function messaging.prevent_candidate_b_history_delete_v1()
  from public, anon, authenticated, service_role;

create or replace function messaging.safety_severity_allows_enforcement_v1(
  p_severity text,
  p_enforcement_kind text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select case p_severity
    when 'low' then
      p_enforcement_kind in (
        'warning',
        'send_cooldown',
        'send_rate_limit'
      )
    when 'medium' then
      p_enforcement_kind in (
        'warning',
        'send_cooldown',
        'send_rate_limit',
        'links_restricted',
        'media_restricted',
        'conversation_start_restricted'
      )
    when 'high' then
      p_enforcement_kind in (
        'warning',
        'send_cooldown',
        'send_rate_limit',
        'links_restricted',
        'media_restricted',
        'conversation_start_restricted',
        'messaging_suspended'
      )
    when 'severe' then
      p_enforcement_kind in (
        'warning',
        'send_cooldown',
        'send_rate_limit',
        'links_restricted',
        'media_restricted',
        'conversation_start_restricted',
        'messaging_suspended',
        'messaging_removed'
      )
    else false
  end
$function$;

create or replace function messaging.safety_enforcement_parameters_valid_v1(
  p_enforcement_kind text,
  p_effective_until timestamptz,
  p_cooldown_seconds integer,
  p_rate_limit_count integer,
  p_rate_limit_window_seconds integer
)
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  select
    p_enforcement_kind in (
      'warning',
      'send_cooldown',
      'send_rate_limit',
      'links_restricted',
      'media_restricted',
      'conversation_start_restricted',
      'messaging_suspended',
      'messaging_removed'
    )
    and (
      p_effective_until is null
      or p_effective_until > now()
    )
    and (
      p_enforcement_kind <> 'messaging_removed'
      or p_effective_until is null
    )
    and (
      (
        p_enforcement_kind in (
          'warning',
          'links_restricted',
          'media_restricted',
          'conversation_start_restricted',
          'messaging_suspended',
          'messaging_removed'
        )
        and p_cooldown_seconds is null
        and p_rate_limit_count is null
        and p_rate_limit_window_seconds is null
      )
      or
      (
        p_enforcement_kind='send_cooldown'
        and p_cooldown_seconds between 5 and 86400
        and p_rate_limit_count is null
        and p_rate_limit_window_seconds is null
      )
      or
      (
        p_enforcement_kind='send_rate_limit'
        and p_rate_limit_count between 1 and 100
        and p_rate_limit_window_seconds between 60 and 86400
        and p_cooldown_seconds is null
      )
    )
$function$;

create or replace function messaging.safety_subject_for_case_message_v1(
  p_case_id uuid,
  p_message_id uuid
)
returns table(
  subject_user_id uuid,
  subject_person_resource_id uuid
)
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, editorial, messaging
as $function$
begin
  if p_case_id is null or p_message_id is null then
    raise exception
      using errcode='22023',
      message='Safety Case and Message are required.';
  end if;

  return query
  select
    sender.user_id,
    sender.person_resource_id
  from messaging.safety_case_targets target
  join messaging.messages message_row
    on message_row.id=target.message_id
  join messaging.conversation_participants sender
    on sender.id=message_row.sender_participant_id
  where target.safety_case_id=p_case_id
    and target.message_id=p_message_id
    and sender.actor_kind='human'
    and sender.user_id is not null
    and sender.person_resource_id is not null
    and exists (
      select 1
      from editorial.person_identity_links identity_link
      where identity_link.user_id=sender.user_id
        and identity_link.person_resource_id=sender.person_resource_id
        and identity_link.link_state='active'
    );

  if not found then
    raise exception
      using errcode='42501',
      message='The Safety Case does not target a canonical human Message sender.';
  end if;
end;
$function$;

create or replace function messaging.lock_sender_safety_subject_v1(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if p_user_id is null then
    raise exception
      using errcode='22023',
      message='Safety subject user is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'messages-safety-subject:' || p_user_id::text,
      0
    )
  );
end;
$function$;

revoke all on function messaging.safety_severity_allows_enforcement_v1(text,text)
  from public, anon, authenticated, service_role;
revoke all on function messaging.safety_enforcement_parameters_valid_v1(text,timestamptz,integer,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function messaging.safety_subject_for_case_message_v1(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function messaging.lock_sender_safety_subject_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function messaging.safety_enforcement_is_effective_v1(
  p_status text,
  p_effective_until timestamptz
)
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  select
    p_status='active'
    and (
      p_effective_until is null
      or p_effective_until > now()
    )
$function$;

create or replace function messaging.append_human_safety_event_v1(
  p_case_id uuid,
  p_event_kind text,
  p_actor_user_id uuid,
  p_actor_person_resource_id uuid,
  p_command_receipt_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, messaging
as $function$
declare
  v_event_id uuid;
begin
  if p_case_id is null
     or p_actor_user_id is null
     or p_actor_person_resource_id is null
     or p_metadata is null
     or jsonb_typeof(p_metadata)<>'object'
     or octet_length(p_metadata::text)>12000
  then
    raise exception
      using errcode='22023',
      message='Safety event input is invalid.';
  end if;

  insert into messaging.safety_case_events(
    safety_case_id,
    event_kind,
    actor_kind,
    actor_user_id,
    actor_person_resource_id,
    command_receipt_id,
    occurred_at,
    metadata
  )
  values(
    p_case_id,
    p_event_kind,
    'human',
    p_actor_user_id,
    p_actor_person_resource_id,
    p_command_receipt_id,
    now(),
    p_metadata
  )
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

create or replace function messaging.message_safety_state_for_subject_v1(
  p_user_id uuid,
  p_person_resource_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, messaging
as $function$
declare
  v_hard_denial boolean:=false;
  v_start_denial boolean:=false;
  v_links_allowed boolean:=true;
  v_media_allowed boolean:=true;
  v_rate_blocked boolean:=false;
  v_next_send_at timestamptz;
  v_candidate timestamptz;
  v_enforcement messaging.safety_enforcements%rowtype;
  v_payload jsonb;
begin
  if p_user_id is null
     or p_person_resource_id is null
     or not exists (
       select 1
       from editorial.person_identity_links identity_link
       join editorial.people person
         on person.resource_id=identity_link.person_resource_id
        and person.person_state='active'
       join public.user_profiles profile
         on profile.user_id=identity_link.user_id
        and profile.status='active'
       where identity_link.user_id=p_user_id
         and identity_link.person_resource_id=p_person_resource_id
         and identity_link.link_state='active'
     )
  then
    raise exception
      using errcode='42501',
      message='An active canonical Person identity is required.';
  end if;

  for v_enforcement in
    select enforcement.*
    from messaging.safety_enforcements enforcement
    where enforcement.subject_user_id=p_user_id
      and enforcement.subject_person_resource_id=p_person_resource_id
      and messaging.safety_enforcement_is_effective_v1(
        enforcement.status,
        enforcement.effective_until
      )
    order by enforcement.applied_at,enforcement.id
  loop
    if v_enforcement.enforcement_kind in (
      'messaging_suspended',
      'messaging_removed'
    ) then
      v_hard_denial:=true;
    elsif v_enforcement.enforcement_kind='conversation_start_restricted' then
      v_start_denial:=true;
    elsif v_enforcement.enforcement_kind='links_restricted' then
      v_links_allowed:=false;
    elsif v_enforcement.enforcement_kind='media_restricted' then
      v_media_allowed:=false;
    elsif v_enforcement.enforcement_kind='send_cooldown' then
      select max(message_row.accepted_at)
             + make_interval(secs=>v_enforcement.cooldown_seconds)
      into v_candidate
      from messaging.messages message_row
      join messaging.conversation_participants sender
        on sender.id=message_row.sender_participant_id
      where sender.actor_kind='human'
        and sender.user_id=p_user_id
        and sender.person_resource_id=p_person_resource_id;

      if v_candidate is not null
         and v_candidate>now()
         and (v_next_send_at is null or v_candidate>v_next_send_at)
      then
        v_next_send_at:=v_candidate;
      end if;
    elsif v_enforcement.enforcement_kind='send_rate_limit' then
      select message_row.accepted_at
             + make_interval(secs=>v_enforcement.rate_limit_window_seconds)
      into v_candidate
      from messaging.messages message_row
      join messaging.conversation_participants sender
        on sender.id=message_row.sender_participant_id
      where sender.actor_kind='human'
        and sender.user_id=p_user_id
        and sender.person_resource_id=p_person_resource_id
        and message_row.accepted_at>
          now()-make_interval(secs=>v_enforcement.rate_limit_window_seconds)
      order by message_row.accepted_at desc,message_row.id desc
      offset greatest(v_enforcement.rate_limit_count-1,0)
      limit 1;

      if v_candidate is not null and v_candidate>now() then
        v_rate_blocked:=true;
        if v_next_send_at is null or v_candidate>v_next_send_at then
          v_next_send_at:=v_candidate;
        end if;
      end if;
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'enforcement_id',enforcement.id,
        'enforcement_kind',enforcement.enforcement_kind,
        'applied_at',enforcement.applied_at,
        'effective_until',enforcement.effective_until,
        'is_effective',messaging.safety_enforcement_is_effective_v1(
          enforcement.status,
          enforcement.effective_until
        ),
        'appeal_allowed',enforcement.appeal_allowed,
        'public_reason',enforcement.public_reason,
        'appeal',case
          when appeal.id is null then null
          else jsonb_build_object(
            'appeal_id',appeal.id,
            'status',appeal.status,
            'submitted_at',appeal.submitted_at,
            'review_started_at',appeal.review_started_at,
            'resolution',appeal.resolution,
            'resolution_public_note',appeal.resolution_public_note,
            'resolved_at',appeal.resolved_at
          )
        end
      )
      order by enforcement.applied_at desc,enforcement.id desc
    ),
    '[]'::jsonb
  )
  into v_payload
  from messaging.safety_enforcements enforcement
  left join messaging.safety_appeals appeal
    on appeal.enforcement_id=enforcement.id
  where enforcement.subject_user_id=p_user_id
    and enforcement.subject_person_resource_id=p_person_resource_id
    and (
      messaging.safety_enforcement_is_effective_v1(
        enforcement.status,
        enforcement.effective_until
      )
      or appeal.id is not null
    );

  return jsonb_build_object(
    'enforcements',v_payload,
    'can_start',not v_hard_denial and not v_start_denial
      and not v_rate_blocked
      and (v_next_send_at is null or v_next_send_at<=now()),
    'can_send',not v_hard_denial and not v_rate_blocked
      and (v_next_send_at is null or v_next_send_at<=now()),
    'links_allowed',v_links_allowed,
    'media_allowed',v_media_allowed,
    'next_send_at',v_next_send_at,
    'has_safety_state',jsonb_array_length(v_payload)>0
  );
end;
$function$;

create or replace function messaging.assert_sender_safety_allows_v1(
  p_user_id uuid,
  p_person_resource_id uuid,
  p_operation text,
  p_body text,
  p_resource_references jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, messaging
as $function$
declare
  v_enforcement messaging.safety_enforcements%rowtype;
  v_last_accepted_at timestamptz;
  v_rate_count bigint;
  v_has_media_reference boolean:=false;
begin
  if p_operation not in ('conversation_start','message_send') then
    raise exception
      using errcode='22023',
      message='Messages Safety operation is invalid.';
  end if;

  if p_user_id is null
     or p_person_resource_id is null
     or not exists (
       select 1
       from editorial.person_identity_links identity_link
       join editorial.people person
         on person.resource_id=identity_link.person_resource_id
        and person.person_state='active'
       join public.user_profiles profile
         on profile.user_id=identity_link.user_id
        and profile.status='active'
       where identity_link.user_id=p_user_id
         and identity_link.person_resource_id=p_person_resource_id
         and identity_link.link_state='active'
     )
  then
    raise exception
      using errcode='42501',
      message='An active canonical Person identity is required.';
  end if;

  perform messaging.lock_sender_safety_subject_v1(p_user_id);

  if p_resource_references is not null
     and jsonb_typeof(p_resource_references)='array'
  then
    select exists(
      select 1
      from jsonb_array_elements(p_resource_references) reference_item
      join editorial.resources resource
        on resource.id=nullif(reference_item->>'resource_id','')::uuid
      where resource.resource_kind='media_asset'
    )
    into v_has_media_reference;
  end if;

  for v_enforcement in
    select enforcement.*
    from messaging.safety_enforcements enforcement
    where enforcement.subject_user_id=p_user_id
      and enforcement.subject_person_resource_id=p_person_resource_id
      and messaging.safety_enforcement_is_effective_v1(
        enforcement.status,
        enforcement.effective_until
      )
    order by enforcement.applied_at,enforcement.id
  loop
    if v_enforcement.enforcement_kind in (
      'messaging_suspended',
      'messaging_removed'
    ) then
      raise exception
        using errcode='42501',
        message='Messages sending is currently unavailable for this account.';
    end if;

    if p_operation='conversation_start'
       and v_enforcement.enforcement_kind='conversation_start_restricted'
    then
      raise exception
        using errcode='42501',
        message='Starting new Messages conversations is currently unavailable.';
    end if;

    if v_enforcement.enforcement_kind='links_restricted'
       and messaging.message_contains_link(p_body)
    then
      raise exception
        using errcode='42501',
        message='Links cannot currently be sent from this account.';
    end if;

    if v_enforcement.enforcement_kind='media_restricted'
       and v_has_media_reference
    then
      raise exception
        using errcode='42501',
        message='Media cannot currently be shared from this account.';
    end if;

    if v_enforcement.enforcement_kind='send_cooldown' then
      select max(message_row.accepted_at)
      into v_last_accepted_at
      from messaging.messages message_row
      join messaging.conversation_participants sender
        on sender.id=message_row.sender_participant_id
      where sender.actor_kind='human'
        and sender.user_id=p_user_id
        and sender.person_resource_id=p_person_resource_id;

      if v_last_accepted_at is not null
         and v_last_accepted_at
             + make_interval(secs=>v_enforcement.cooldown_seconds)>now()
      then
        raise exception
          using errcode='42501',
          message='Please wait before sending another Message.';
      end if;
    end if;

    if v_enforcement.enforcement_kind='send_rate_limit' then
      select count(*)
      into v_rate_count
      from messaging.messages message_row
      join messaging.conversation_participants sender
        on sender.id=message_row.sender_participant_id
      where sender.actor_kind='human'
        and sender.user_id=p_user_id
        and sender.person_resource_id=p_person_resource_id
        and message_row.accepted_at>
          now()-make_interval(secs=>v_enforcement.rate_limit_window_seconds);

      if v_rate_count>=v_enforcement.rate_limit_count then
        raise exception
          using errcode='42501',
          message='The current Messages sending limit has been reached.';
      end if;
    end if;
  end loop;
end;
$function$;

create or replace function messaging.media_file_is_safety_contained(
  p_media_file_object_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, media, messaging
as $function$
  select coalesce((
    select exists(
      select 1
      from messaging.safety_media_containment containment
      join media.file_objects contained_file
        on contained_file.id=containment.media_file_object_id
      where containment.status='active'
        and contained_file.verification_state='verified'
        and contained_file.sha256=requested_file.sha256
        and contained_file.byte_size=requested_file.byte_size
    )
    from media.file_objects requested_file
    where requested_file.id=p_media_file_object_id
      and requested_file.verification_state='verified'
      and requested_file.sha256 ~ '^[0-9a-f]{64}$'
      and requested_file.byte_size is not null
      and requested_file.byte_size>0
  ),false)
$function$;

create or replace function messaging.lock_media_safety_identity_v1(
  p_media_file_object_id uuid
)
returns table(
  sha256 text,
  byte_size bigint
)
language plpgsql
security definer
set search_path = pg_catalog, media
as $function$
declare
  v_sha256 text;
  v_byte_size bigint;
begin
  select file_object.sha256,file_object.byte_size
  into v_sha256,v_byte_size
  from media.file_objects file_object
  where file_object.id=p_media_file_object_id
    and file_object.verification_state='verified';

  if not found
     or v_sha256 is null
     or v_sha256 !~ '^[0-9a-f]{64}$'
     or v_byte_size is null
     or v_byte_size<1
  then
    raise exception
      using errcode='55000',
      message='Safety containment requires one verified canonical Media identity.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'messages-safety-media:' || v_sha256 || ':' || v_byte_size::text,
      0
    )
  );

  return query select v_sha256,v_byte_size;
end;
$function$;

revoke all on function messaging.safety_enforcement_is_effective_v1(text,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function messaging.append_human_safety_event_v1(uuid,text,uuid,uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function messaging.message_safety_state_for_subject_v1(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function messaging.assert_sender_safety_allows_v1(uuid,uuid,text,text,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function messaging.media_file_is_safety_contained(uuid)
  from public, anon, authenticated, service_role;
revoke all on function messaging.lock_media_safety_identity_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.update_messages_safety_assessment_v1(
  p_case_id uuid,
  p_policy_category text,
  p_severity text,
  p_confidence numeric,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  v_admin record;
  v_case messaging.safety_cases%rowtype;
  v_policy_category text:=lower(btrim(coalesce(p_policy_category,'')));
  v_severity text:=lower(btrim(coalesce(p_severity,'')));
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  v_correlation uuid;
  v_begin record;
  v_event_id uuid;
  v_result jsonb;
begin
  select * into v_admin from messaging.current_messages_super_admin();

  if p_case_id is null
     or v_policy_category !~ '^[a-z][a-z0-9_]{1,63}$'
     or octet_length(v_policy_category)>64
     or v_severity not in ('low','medium','high','severe')
     or (p_confidence is not null and (p_confidence<0 or p_confidence>1))
     or v_reason is null
     or octet_length(v_reason)>2000
  then
    raise exception
      using errcode='22023',
      message='Safety assessment input is invalid.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_admin.user_id,
    'messages.safety.assessment.update',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.assessment.update',
    v_admin.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'policy_category',v_policy_category,
      'severity',v_severity,
      'confidence',p_confidence,
      'reason',v_reason,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_case
  from messaging.safety_cases
  where id=p_case_id
  for update;

  if not found then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  if v_case.status<>'under_review' then
    raise exception
      using errcode='55000',
      message='Safety assessment requires a case under review.';
  end if;

  update messaging.safety_cases
  set policy_category=v_policy_category,
      severity=v_severity,
      confidence=p_confidence,
      updated_at=now()
  where id=p_case_id
  returning * into v_case;

  v_event_id:=messaging.append_human_safety_event_v1(
    p_case_id,
    'assessment_updated',
    v_admin.user_id,
    v_admin.person_resource_id,
    v_begin.command_receipt_id,
    jsonb_build_object(
      'policy_category',v_policy_category,
      'severity',v_severity,
      'confidence',p_confidence,
      'reason',v_reason
    )
  );

  v_result:=jsonb_build_object(
    'safety_case_id',v_case.id,
    'status',v_case.status,
    'policy_category',v_case.policy_category,
    'severity',v_case.severity,
    'confidence',v_case.confidence,
    'event_id',v_event_id,
    'changed',true,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end;
$function$;

create or replace function public.set_messages_safety_enforcement_v1(
  p_case_id uuid,
  p_message_id uuid,
  p_enforcement_kind text,
  p_active boolean,
  p_effective_until timestamptz,
  p_appeal_allowed boolean,
  p_public_reason text,
  p_internal_reason text,
  p_cooldown_seconds integer,
  p_rate_limit_count integer,
  p_rate_limit_window_seconds integer,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  v_admin record;
  v_case messaging.safety_cases%rowtype;
  v_subject record;
  v_kind text:=lower(btrim(coalesce(p_enforcement_kind,'')));
  v_public_reason text:=nullif(btrim(coalesce(p_public_reason,'')),'');
  v_internal_reason text:=nullif(btrim(coalesce(p_internal_reason,'')),'');
  v_correlation uuid;
  v_begin record;
  v_existing messaging.safety_enforcements%rowtype;
  v_new messaging.safety_enforcements%rowtype;
  v_new_id uuid;
  v_event_id uuid;
  v_changed boolean:=false;
  v_result jsonb;
begin
  select * into v_admin from messaging.current_messages_super_admin();

  if p_case_id is null
     or p_message_id is null
     or p_active is null
     or p_appeal_allowed is null
     or v_public_reason is null
     or octet_length(v_public_reason)>500
     or v_internal_reason is null
     or octet_length(v_internal_reason)>2000
     or v_kind not in (
       'warning','send_cooldown','send_rate_limit','links_restricted',
       'media_restricted','conversation_start_restricted',
       'messaging_suspended','messaging_removed'
     )
  then
    raise exception
      using errcode='22023',
      message='Messages Safety enforcement input is invalid.';
  end if;

  if p_active and not messaging.safety_enforcement_parameters_valid_v1(
    v_kind,
    p_effective_until,
    p_cooldown_seconds,
    p_rate_limit_count,
    p_rate_limit_window_seconds
  ) then
    raise exception
      using errcode='22023',
      message='Messages Safety enforcement parameters are invalid.';
  end if;

  if not p_active and (
    p_effective_until is not null
    or p_cooldown_seconds is not null
    or p_rate_limit_count is not null
    or p_rate_limit_window_seconds is not null
  ) then
    raise exception
      using errcode='22023',
      message='Release does not accept active enforcement parameters.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_admin.user_id,
    'messages.safety.enforcement.update',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.enforcement.update',
    v_admin.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'message_id',p_message_id,
      'enforcement_kind',v_kind,
      'active',p_active,
      'effective_until',p_effective_until,
      'appeal_allowed',p_appeal_allowed,
      'public_reason',v_public_reason,
      'internal_reason',v_internal_reason,
      'cooldown_seconds',p_cooldown_seconds,
      'rate_limit_count',p_rate_limit_count,
      'rate_limit_window_seconds',p_rate_limit_window_seconds,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_case
  from messaging.safety_cases
  where id=p_case_id
  for update;

  if not found then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  if p_active and v_case.status<>'under_review' then
    raise exception
      using errcode='55000',
      message='New enforcement requires a Safety Case under review.';
  end if;

  if p_active and not messaging.safety_severity_allows_enforcement_v1(
    v_case.severity,
    v_kind
  ) then
    raise exception
      using errcode='42501',
      message='This enforcement is not permitted by the reviewed severity.';
  end if;

  select * into v_subject
  from messaging.safety_subject_for_case_message_v1(
    p_case_id,
    p_message_id
  );

  perform messaging.lock_sender_safety_subject_v1(v_subject.subject_user_id);

  update messaging.safety_enforcements enforcement
  set status='expired',
      ended_at=enforcement.effective_until,
      end_reason='Restriction term elapsed.',
      revision=enforcement.revision+1
  where enforcement.safety_case_id=p_case_id
    and enforcement.subject_user_id=v_subject.subject_user_id
    and enforcement.subject_person_resource_id=v_subject.subject_person_resource_id
    and enforcement.enforcement_kind=v_kind
    and enforcement.status='active'
    and enforcement.effective_until is not null
    and enforcement.effective_until<=now();

  if found then
    perform messaging.append_human_safety_event_v1(
      p_case_id,
      'enforcement_expired',
      v_admin.user_id,
      v_admin.person_resource_id,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'message_id',p_message_id,
        'enforcement_kind',v_kind
      )
    );
  end if;

  select * into v_existing
  from messaging.safety_enforcements enforcement
  where enforcement.safety_case_id=p_case_id
    and enforcement.subject_user_id=v_subject.subject_user_id
    and enforcement.subject_person_resource_id=v_subject.subject_person_resource_id
    and enforcement.enforcement_kind=v_kind
    and enforcement.status='active'
  for update;

  if p_active then
    if v_existing.id is not null
       and v_existing.source_message_id=p_message_id
       and v_existing.effective_until is not distinct from p_effective_until
       and v_existing.appeal_allowed=p_appeal_allowed
       and v_existing.public_reason=v_public_reason
       and v_existing.internal_reason=v_internal_reason
       and v_existing.cooldown_seconds is not distinct from p_cooldown_seconds
       and v_existing.rate_limit_count is not distinct from p_rate_limit_count
       and v_existing.rate_limit_window_seconds is not distinct from p_rate_limit_window_seconds
    then
      v_new:=v_existing;
    else
      v_new_id:=gen_random_uuid();

      if v_existing.id is not null then
        update messaging.safety_enforcements
        set status='superseded',
            ended_at=now(),
            ended_by_user_id=v_admin.user_id,
            end_reason='Replaced by a newer governed enforcement decision.',
            superseded_by_enforcement_id=v_new_id,
            revision=revision+1
        where id=v_existing.id;

        perform messaging.append_human_safety_event_v1(
          p_case_id,
          'enforcement_superseded',
          v_admin.user_id,
          v_admin.person_resource_id,
          v_begin.command_receipt_id,
          jsonb_build_object(
            'enforcement_id',v_existing.id,
            'replacement_enforcement_id',v_new_id,
            'enforcement_kind',v_kind,
            'message_id',p_message_id
          )
        );
      end if;

      insert into messaging.safety_enforcements(
        id,
        safety_case_id,
        source_message_id,
        subject_user_id,
        subject_person_resource_id,
        enforcement_kind,
        status,
        applied_at,
        applied_by_user_id,
        effective_until,
        appeal_allowed,
        public_reason,
        internal_reason,
        cooldown_seconds,
        rate_limit_count,
        rate_limit_window_seconds,
        command_receipt_id
      )
      values(
        v_new_id,
        p_case_id,
        p_message_id,
        v_subject.subject_user_id,
        v_subject.subject_person_resource_id,
        v_kind,
        'active',
        now(),
        v_admin.user_id,
        p_effective_until,
        p_appeal_allowed,
        v_public_reason,
        v_internal_reason,
        p_cooldown_seconds,
        p_rate_limit_count,
        p_rate_limit_window_seconds,
        v_begin.command_receipt_id
      )
      returning * into v_new;

      v_event_id:=messaging.append_human_safety_event_v1(
        p_case_id,
        'enforcement_applied',
        v_admin.user_id,
        v_admin.person_resource_id,
        v_begin.command_receipt_id,
        jsonb_build_object(
          'enforcement_id',v_new.id,
          'message_id',p_message_id,
          'enforcement_kind',v_kind,
          'effective_until',p_effective_until,
          'appeal_allowed',p_appeal_allowed
        )
      );
      v_changed:=true;
    end if;
  else
    if v_existing.id is not null then
      update messaging.safety_enforcements
      set status='released',
          ended_at=now(),
          ended_by_user_id=v_admin.user_id,
          end_reason=v_internal_reason,
          revision=revision+1
      where id=v_existing.id
      returning * into v_new;

      v_event_id:=messaging.append_human_safety_event_v1(
        p_case_id,
        'enforcement_released',
        v_admin.user_id,
        v_admin.person_resource_id,
        v_begin.command_receipt_id,
        jsonb_build_object(
          'enforcement_id',v_new.id,
          'message_id',p_message_id,
          'enforcement_kind',v_kind,
          'public_reason',v_public_reason
        )
      );
      v_changed:=true;
    else
      v_new:=null;
    end if;
  end if;

  v_result:=jsonb_build_object(
    'safety_case_id',p_case_id,
    'message_id',p_message_id,
    'enforcement_id',v_new.id,
    'enforcement_kind',v_kind,
    'status',v_new.status,
    'effective_until',v_new.effective_until,
    'appeal_allowed',v_new.appeal_allowed,
    'changed',v_changed,
    'event_id',v_event_id,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end;
$function$;

create or replace function public.get_my_message_safety_state_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, messaging
as $function$
declare
  v_me record;
begin
  select * into v_me from messaging.current_human_identity();
  return messaging.message_safety_state_for_subject_v1(
    v_me.user_id,
    v_me.person_resource_id
  );
end;
$function$;

create or replace function messaging.enforcement_modification_is_narrower_v1(
  p_old_kind text,
  p_old_effective_until timestamptz,
  p_old_appeal_allowed boolean,
  p_old_cooldown_seconds integer,
  p_old_rate_limit_count integer,
  p_old_rate_limit_window_seconds integer,
  p_new_kind text,
  p_new_effective_until timestamptz,
  p_new_appeal_allowed boolean,
  p_new_cooldown_seconds integer,
  p_new_rate_limit_count integer,
  p_new_rate_limit_window_seconds integer
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, messaging
as $function$
declare
  v_kind_allowed boolean:=false;
  v_term_narrower boolean:=false;
begin
  if not messaging.safety_enforcement_parameters_valid_v1(
    p_new_kind,
    p_new_effective_until,
    p_new_cooldown_seconds,
    p_new_rate_limit_count,
    p_new_rate_limit_window_seconds
  ) then
    return false;
  end if;

  if coalesce(p_old_appeal_allowed,false)
     and not coalesce(p_new_appeal_allowed,false)
  then
    return false;
  end if;

  v_term_narrower:=
    p_old_effective_until is null
    or (
      p_new_effective_until is not null
      and p_new_effective_until<=p_old_effective_until
    );

  if not v_term_narrower then
    return false;
  end if;

  if p_old_kind=p_new_kind then
    if p_old_kind='send_cooldown' then
      return
        p_new_cooldown_seconds<=p_old_cooldown_seconds
        and (
          p_new_cooldown_seconds<p_old_cooldown_seconds
          or p_old_effective_until is distinct from p_new_effective_until
        );
    elsif p_old_kind='send_rate_limit' then
      return
        p_new_rate_limit_count>=p_old_rate_limit_count
        and p_new_rate_limit_window_seconds<=p_old_rate_limit_window_seconds
        and (
          p_new_rate_limit_count>p_old_rate_limit_count
          or p_new_rate_limit_window_seconds<p_old_rate_limit_window_seconds
          or p_old_effective_until is distinct from p_new_effective_until
        );
    else
      return p_old_effective_until is distinct from p_new_effective_until;
    end if;
  end if;

  v_kind_allowed:=case p_old_kind
    when 'messaging_removed' then p_new_kind in (
      'messaging_suspended',
      'conversation_start_restricted',
      'send_rate_limit',
      'send_cooldown',
      'warning'
    )
    when 'messaging_suspended' then p_new_kind in (
      'conversation_start_restricted',
      'send_rate_limit',
      'send_cooldown',
      'warning'
    )
    when 'conversation_start_restricted' then p_new_kind in (
      'send_rate_limit',
      'send_cooldown',
      'warning'
    )
    when 'links_restricted' then p_new_kind='warning'
    when 'media_restricted' then p_new_kind='warning'
    when 'send_rate_limit' then p_new_kind in ('send_cooldown','warning')
    when 'send_cooldown' then p_new_kind='warning'
    else false
  end;

  return v_kind_allowed;
end;
$function$;

revoke all on function messaging.enforcement_modification_is_narrower_v1(
  text,timestamptz,boolean,integer,integer,integer,
  text,timestamptz,boolean,integer,integer,integer
) from public, anon, authenticated, service_role;

create or replace function public.submit_messages_safety_appeal_v1(
  p_enforcement_id uuid,
  p_appeal_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  v_me record;
  v_enforcement messaging.safety_enforcements%rowtype;
  v_reason text:=nullif(btrim(coalesce(p_appeal_reason,'')),'');
  v_correlation uuid;
  v_begin record;
  v_appeal messaging.safety_appeals%rowtype;
  v_event_id uuid;
  v_result jsonb;
begin
  select * into v_me from messaging.current_human_identity();

  if p_enforcement_id is null
     or v_reason is null
     or octet_length(v_reason)>4000
  then
    raise exception
      using errcode='22023',
      message='Appeal input is invalid.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_me.user_id,
    'messages.safety.appeal.submit',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.appeal.submit',
    v_me.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'enforcement_id',p_enforcement_id,
      'appeal_reason',v_reason,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_enforcement
  from messaging.safety_enforcements
  where id=p_enforcement_id
  for update;

  if not found then
    raise exception 'Messages enforcement was not found.' using errcode='P0002';
  end if;

  if v_enforcement.subject_user_id<>v_me.user_id
     or v_enforcement.subject_person_resource_id<>v_me.person_resource_id
  then
    raise exception
      using errcode='42501',
      message='Only the subject of this Messages action may appeal it.';
  end if;

  if not v_enforcement.appeal_allowed
     or not messaging.safety_enforcement_is_effective_v1(
       v_enforcement.status,
       v_enforcement.effective_until
     )
  then
    raise exception
      using errcode='55000',
      message='This Messages action is not currently eligible for appeal.';
  end if;

  if exists(
    select 1
    from messaging.safety_appeals appeal
    where appeal.enforcement_id=p_enforcement_id
  ) then
    raise exception
      using errcode='23505',
      message='An appeal already exists for this Messages action.';
  end if;

  insert into messaging.safety_appeals(
    enforcement_id,
    safety_case_id,
    appellant_user_id,
    appellant_person_resource_id,
    status,
    appeal_reason,
    submitted_at,
    submit_command_receipt_id
  )
  values(
    v_enforcement.id,
    v_enforcement.safety_case_id,
    v_me.user_id,
    v_me.person_resource_id,
    'open',
    v_reason,
    now(),
    v_begin.command_receipt_id
  )
  returning * into v_appeal;

  v_event_id:=messaging.append_human_safety_event_v1(
    v_enforcement.safety_case_id,
    'appeal_submitted',
    v_me.user_id,
    v_me.person_resource_id,
    v_begin.command_receipt_id,
    jsonb_build_object(
      'appeal_id',v_appeal.id,
      'enforcement_id',v_enforcement.id
    )
  );

  v_result:=jsonb_build_object(
    'appeal_id',v_appeal.id,
    'enforcement_id',v_enforcement.id,
    'status',v_appeal.status,
    'submitted_at',v_appeal.submitted_at,
    'event_id',v_event_id,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end;
$function$;

create or replace function public.list_messages_safety_appeals_v1(
  p_status text default null,
  p_before_submitted_at timestamptz default null,
  p_before_appeal_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, messaging
as $function$
declare
  v_admin record;
  v_status text:=nullif(lower(btrim(coalesce(p_status,''))),'');
  v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  select * into v_admin from messaging.current_messages_super_admin();

  if v_status is not null
     and v_status not in ('open','under_review','resolved')
  then
    raise exception
      using errcode='22023',
      message='Appeal status filter is invalid.';
  end if;

  return coalesce((
    select jsonb_agg(item order by submitted_at desc,appeal_id desc)
    from (
      select
        appeal.id as appeal_id,
        appeal.submitted_at,
        jsonb_build_object(
          'appeal_id',appeal.id,
          'enforcement_id',appeal.enforcement_id,
          'safety_case_id',appeal.safety_case_id,
          'status',appeal.status,
          'enforcement_kind',enforcement.enforcement_kind,
          'submitted_at',appeal.submitted_at,
          'review_started_at',appeal.review_started_at,
          'resolved_at',appeal.resolved_at,
          'resolution',appeal.resolution
        ) as item
      from messaging.safety_appeals appeal
      join messaging.safety_enforcements enforcement
        on enforcement.id=appeal.enforcement_id
      where (v_status is null or appeal.status=v_status)
        and (
          p_before_submitted_at is null
          or (appeal.submitted_at,appeal.id)<(
            p_before_submitted_at,
            coalesce(
              p_before_appeal_id,
              'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
            )
          )
        )
      order by appeal.submitted_at desc,appeal.id desc
      limit v_limit
    ) page
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.start_messages_safety_appeal_review_v1(
  p_appeal_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  v_admin record;
  v_appeal messaging.safety_appeals%rowtype;
  v_correlation uuid;
  v_begin record;
  v_event_id uuid;
  v_result jsonb;
begin
  select * into v_admin from messaging.current_messages_super_admin();

  if p_appeal_id is null then
    raise exception using errcode='22023',message='Appeal is required.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_admin.user_id,
    'messages.safety.appeal.review.start',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.appeal.review.start',
    v_admin.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'appeal_id',p_appeal_id,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_appeal
  from messaging.safety_appeals
  where id=p_appeal_id
  for update;

  if not found then
    raise exception 'Appeal was not found.' using errcode='P0002';
  end if;

  if v_appeal.status='resolved' then
    raise exception
      using errcode='55000',
      message='A resolved appeal cannot restart review.';
  end if;

  if v_appeal.status='open' then
    update messaging.safety_appeals
    set status='under_review',
        review_started_at=now(),
        reviewed_by_user_id=v_admin.user_id,
        review_command_receipt_id=v_begin.command_receipt_id,
        revision=revision+1
    where id=p_appeal_id
    returning * into v_appeal;

    v_event_id:=messaging.append_human_safety_event_v1(
      v_appeal.safety_case_id,
      'appeal_review_started',
      v_admin.user_id,
      v_admin.person_resource_id,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'appeal_id',v_appeal.id,
        'enforcement_id',v_appeal.enforcement_id
      )
    );
  end if;

  v_result:=jsonb_build_object(
    'appeal_id',v_appeal.id,
    'status',v_appeal.status,
    'review_started_at',v_appeal.review_started_at,
    'changed',v_event_id is not null,
    'event_id',v_event_id,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end;
$function$;

create or replace function public.resolve_messages_safety_appeal_v1(
  p_appeal_id uuid,
  p_resolution text,
  p_resolution_public_note text,
  p_resolution_internal_note text,
  p_modified_enforcement_kind text,
  p_modified_effective_until timestamptz,
  p_modified_appeal_allowed boolean,
  p_modified_cooldown_seconds integer,
  p_modified_rate_limit_count integer,
  p_modified_rate_limit_window_seconds integer,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  v_admin record;
  v_appeal messaging.safety_appeals%rowtype;
  v_enforcement messaging.safety_enforcements%rowtype;
  v_replacement messaging.safety_enforcements%rowtype;
  v_resolution text:=lower(btrim(coalesce(p_resolution,'')));
  v_public_note text:=nullif(btrim(coalesce(p_resolution_public_note,'')),'');
  v_internal_note text:=nullif(btrim(coalesce(p_resolution_internal_note,'')),'');
  v_modified_kind text:=nullif(lower(btrim(coalesce(p_modified_enforcement_kind,''))),'');
  v_correlation uuid;
  v_begin record;
  v_replacement_id uuid;
  v_event_id uuid;
  v_result jsonb;
begin
  select * into v_admin from messaging.current_messages_super_admin();

  if p_appeal_id is null
     or v_resolution not in ('upheld','modified','reversed')
     or v_public_note is null
     or octet_length(v_public_note)>1000
     or v_internal_note is null
     or octet_length(v_internal_note)>4000
  then
    raise exception
      using errcode='22023',
      message='Appeal resolution input is invalid.';
  end if;

  if v_resolution in ('upheld','reversed') and (
    v_modified_kind is not null
    or p_modified_effective_until is not null
    or p_modified_appeal_allowed is not null
    or p_modified_cooldown_seconds is not null
    or p_modified_rate_limit_count is not null
    or p_modified_rate_limit_window_seconds is not null
  ) then
    raise exception
      using errcode='22023',
      message='This appeal resolution does not accept modified enforcement values.';
  end if;

  if v_resolution='modified' and (
    v_modified_kind is null
    or p_modified_appeal_allowed is null
  ) then
    raise exception
      using errcode='22023',
      message='Modified appeal resolution requires a complete replacement enforcement shape.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_admin.user_id,
    'messages.safety.appeal.resolve',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.appeal.resolve',
    v_admin.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'appeal_id',p_appeal_id,
      'resolution',v_resolution,
      'resolution_public_note',v_public_note,
      'resolution_internal_note',v_internal_note,
      'modified_enforcement_kind',v_modified_kind,
      'modified_effective_until',p_modified_effective_until,
      'modified_appeal_allowed',p_modified_appeal_allowed,
      'modified_cooldown_seconds',p_modified_cooldown_seconds,
      'modified_rate_limit_count',p_modified_rate_limit_count,
      'modified_rate_limit_window_seconds',p_modified_rate_limit_window_seconds,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_appeal
  from messaging.safety_appeals
  where id=p_appeal_id
  for update;

  if not found then
    raise exception 'Appeal was not found.' using errcode='P0002';
  end if;

  if v_appeal.status<>'under_review' then
    raise exception
      using errcode='55000',
      message='Appeal resolution requires an appeal under review.';
  end if;

  select * into v_enforcement
  from messaging.safety_enforcements
  where id=v_appeal.enforcement_id
  for update;

  if not found then
    raise exception 'Appeal enforcement was not found.' using errcode='P0002';
  end if;

  perform messaging.lock_sender_safety_subject_v1(v_enforcement.subject_user_id);

  if v_resolution='modified' then
    if not messaging.safety_enforcement_is_effective_v1(
      v_enforcement.status,
      v_enforcement.effective_until
    ) then
      raise exception
        using errcode='55000',
        message='An elapsed or ended enforcement cannot be reintroduced through appeal modification.';
    end if;

    if not messaging.enforcement_modification_is_narrower_v1(
      v_enforcement.enforcement_kind,
      v_enforcement.effective_until,
      v_enforcement.appeal_allowed,
      v_enforcement.cooldown_seconds,
      v_enforcement.rate_limit_count,
      v_enforcement.rate_limit_window_seconds,
      v_modified_kind,
      p_modified_effective_until,
      p_modified_appeal_allowed,
      p_modified_cooldown_seconds,
      p_modified_rate_limit_count,
      p_modified_rate_limit_window_seconds
    ) then
      raise exception
        using errcode='22023',
        message='Appeal modification must strictly narrow the effective Messages restriction.';
    end if;

    if v_enforcement.enforcement_kind=v_modified_kind
       and v_enforcement.effective_until is not distinct from p_modified_effective_until
       and v_enforcement.appeal_allowed=p_modified_appeal_allowed
       and v_enforcement.cooldown_seconds is not distinct from p_modified_cooldown_seconds
       and v_enforcement.rate_limit_count is not distinct from p_modified_rate_limit_count
       and v_enforcement.rate_limit_window_seconds is not distinct from p_modified_rate_limit_window_seconds
    then
      raise exception
        using errcode='22023',
        message='Appeal modification must change and narrow the restriction.';
    end if;

    v_replacement_id:=gen_random_uuid();

    update messaging.safety_enforcements
    set status='superseded',
        ended_at=now(),
        ended_by_user_id=v_admin.user_id,
        end_reason=v_internal_note,
        superseded_by_enforcement_id=v_replacement_id,
        revision=revision+1
    where id=v_enforcement.id;

    insert into messaging.safety_enforcements(
      id,
      safety_case_id,
      source_message_id,
      subject_user_id,
      subject_person_resource_id,
      enforcement_kind,
      status,
      applied_at,
      applied_by_user_id,
      effective_until,
      appeal_allowed,
      public_reason,
      internal_reason,
      cooldown_seconds,
      rate_limit_count,
      rate_limit_window_seconds,
      command_receipt_id
    )
    values(
      v_replacement_id,
      v_enforcement.safety_case_id,
      v_enforcement.source_message_id,
      v_enforcement.subject_user_id,
      v_enforcement.subject_person_resource_id,
      v_modified_kind,
      'active',
      now(),
      v_admin.user_id,
      p_modified_effective_until,
      p_modified_appeal_allowed,
      v_public_note,
      v_internal_note,
      p_modified_cooldown_seconds,
      p_modified_rate_limit_count,
      p_modified_rate_limit_window_seconds,
      v_begin.command_receipt_id
    )
    returning * into v_replacement;

    perform messaging.append_human_safety_event_v1(
      v_enforcement.safety_case_id,
      'enforcement_superseded',
      v_admin.user_id,
      v_admin.person_resource_id,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'enforcement_id',v_enforcement.id,
        'replacement_enforcement_id',v_replacement.id,
        'appeal_id',v_appeal.id
      )
    );

    perform messaging.append_human_safety_event_v1(
      v_enforcement.safety_case_id,
      'enforcement_applied',
      v_admin.user_id,
      v_admin.person_resource_id,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'enforcement_id',v_replacement.id,
        'source_enforcement_id',v_enforcement.id,
        'appeal_id',v_appeal.id,
        'enforcement_kind',v_replacement.enforcement_kind,
        'effective_until',v_replacement.effective_until,
        'appeal_allowed',v_replacement.appeal_allowed
      )
    );
  elsif v_resolution='reversed' then
    if v_enforcement.status='active' then
      update messaging.safety_enforcements
      set status='reversed',
          ended_at=now(),
          ended_by_user_id=v_admin.user_id,
          end_reason=v_internal_note,
          revision=revision+1
      where id=v_enforcement.id
      returning * into v_enforcement;

      perform messaging.append_human_safety_event_v1(
        v_enforcement.safety_case_id,
        'enforcement_reversed',
        v_admin.user_id,
        v_admin.person_resource_id,
        v_begin.command_receipt_id,
        jsonb_build_object(
          'enforcement_id',v_enforcement.id,
          'appeal_id',v_appeal.id
        )
      );
    end if;
  end if;

  update messaging.safety_appeals
  set status='resolved',
      resolution=v_resolution,
      resolution_public_note=v_public_note,
      resolution_internal_note=v_internal_note,
      resolved_at=now(),
      resolved_by_user_id=v_admin.user_id,
      resolution_command_receipt_id=v_begin.command_receipt_id,
      revision=revision+1
  where id=v_appeal.id
  returning * into v_appeal;

  v_event_id:=messaging.append_human_safety_event_v1(
    v_appeal.safety_case_id,
    'appeal_resolved',
    v_admin.user_id,
    v_admin.person_resource_id,
    v_begin.command_receipt_id,
    jsonb_build_object(
      'appeal_id',v_appeal.id,
      'enforcement_id',v_appeal.enforcement_id,
      'resolution',v_resolution,
      'replacement_enforcement_id',v_replacement.id
    )
  );

  v_result:=jsonb_build_object(
    'appeal_id',v_appeal.id,
    'enforcement_id',v_appeal.enforcement_id,
    'status',v_appeal.status,
    'resolution',v_appeal.resolution,
    'resolved_at',v_appeal.resolved_at,
    'replacement_enforcement_id',v_replacement.id,
    'event_id',v_event_id,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end;
$function$;

create or replace function messaging.cancel_media_processing_job_for_safety_v1(
  p_job_id uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_error text:=nullif(btrim(coalesce(p_error,'')),'');
begin
  if p_job_id is null
     or v_error is null
     or octet_length(v_error)>2000
  then
    raise exception
      using errcode='22023',
      message='Media processing cancellation input is invalid.';
  end if;

  select * into v_job
  from platform_private.jobs
  where id=p_job_id
  for update;

  if not found
     or v_job.command_type<>'media.process_revision'
     or v_job.job_type<>'media.process_revision'
  then
    return false;
  end if;

  if v_job.status not in ('queued','retry_wait','running') then
    return false;
  end if;

  update platform_private.jobs
  set status='cancelled',
      locked_by=null,
      locked_at=null,
      lease_expires_at=null,
      finished_at=now(),
      last_error=v_error
  where id=v_job.id;

  update platform_private.command_receipts
  set status='failed',
      error_code='safety_contained',
      error_message=v_error,
      completed_at=now()
  where id=v_job.command_receipt_id
    and status='accepted';

  insert into platform_private.outbox_events(
    event_key,
    command_receipt_id,
    job_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' || v_job.command_receipt_id::text || ':failed',
    v_job.command_receipt_id,
    v_job.id,
    v_job.command_type,
    v_job.resource_id,
    command_type.failure_event_type,
    jsonb_build_object(
      'command_receipt_id',v_job.command_receipt_id,
      'job_id',v_job.id,
      'resource_id',v_job.resource_id,
      'error_code','safety_contained',
      'error',v_error,
      'failed_at',now()
    )
  from platform_private.command_types command_type
  where command_type.command_type=v_job.command_type
  on conflict (event_key) do nothing;

  return true;
end;
$function$;

revoke all on function messaging.cancel_media_processing_job_for_safety_v1(uuid,text)
  from public, anon, authenticated, service_role;

create or replace function public.set_messages_safety_media_containment_v1(
  p_case_id uuid,
  p_media_file_object_id uuid,
  p_contained boolean,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, media, platform_private
as $function$
declare
  v_admin record;
  v_case messaging.safety_cases%rowtype;
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  v_correlation uuid;
  v_begin record;
  v_identity record;
  v_file media.file_objects%rowtype;
  v_matched_count integer:=0;
  v_target_added_count integer:=0;
  v_containment_changed_count integer:=0;
  v_cancelled_job_count integer:=0;
  v_event_id uuid;
  v_result jsonb;
  v_job record;
begin
  select * into v_admin from messaging.current_messages_super_admin();

  if p_case_id is null
     or p_media_file_object_id is null
     or p_contained is null
     or v_reason is null
     or octet_length(v_reason)>2000
  then
    raise exception
      using errcode='22023',
      message='Media Safety containment input is invalid.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_admin.user_id,
    'messages.safety.media.containment.update',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.media.containment.update',
    v_admin.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'media_file_object_id',p_media_file_object_id,
      'contained',p_contained,
      'reason',v_reason,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_case
  from messaging.safety_cases
  where id=p_case_id
  for update;

  if not found then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  if p_contained and (
    v_case.status<>'under_review'
    or v_case.severity<>'severe'
  ) then
    raise exception
      using errcode='55000',
      message='New Media containment requires a severe Safety Case under review.';
  end if;

  if not exists(
    select 1
    from messaging.safety_case_targets target
    where target.safety_case_id=p_case_id
      and target.media_file_object_id=p_media_file_object_id
  ) then
    raise exception
      using errcode='42501',
      message='The Safety Case does not target this canonical Media file.';
  end if;

  select * into v_identity
  from messaging.lock_media_safety_identity_v1(p_media_file_object_id);

  select count(*) into v_matched_count
  from media.file_objects file_object
  where file_object.verification_state='verified'
    and file_object.sha256=v_identity.sha256
    and file_object.byte_size=v_identity.byte_size;

  if p_contained then
    with inserted as (
      insert into messaging.safety_case_targets(
        safety_case_id,
        media_file_object_id,
        linked_at
      )
      select
        p_case_id,
        file_object.id,
        now()
      from media.file_objects file_object
      where file_object.verification_state='verified'
        and file_object.sha256=v_identity.sha256
        and file_object.byte_size=v_identity.byte_size
      on conflict (safety_case_id,media_file_object_id) do nothing
      returning 1
    )
    select count(*) into v_target_added_count from inserted;

    with inserted as (
      insert into messaging.safety_media_containment(
        media_file_object_id,
        safety_case_id,
        status,
        policy_category,
        placed_at,
        placed_by_user_id,
        command_receipt_id
      )
      select
        file_object.id,
        p_case_id,
        'active',
        v_case.policy_category,
        now(),
        v_admin.user_id,
        v_begin.command_receipt_id
      from media.file_objects file_object
      where file_object.verification_state='verified'
        and file_object.sha256=v_identity.sha256
        and file_object.byte_size=v_identity.byte_size
        and not exists(
          select 1
          from messaging.safety_media_containment containment
          where containment.media_file_object_id=file_object.id
            and containment.status='active'
        )
      on conflict do nothing
      returning 1
    )
    select count(*) into v_containment_changed_count from inserted;

    for v_job in
      select job.id
      from platform_private.jobs job
      join media.file_objects source_file
        on source_file.id=nullif(job.input_payload->>'source_file_object_id','')::uuid
      where job.command_type='media.process_revision'
        and job.job_type='media.process_revision'
        and job.status in ('queued','retry_wait')
        and source_file.verification_state='verified'
        and source_file.sha256=v_identity.sha256
        and source_file.byte_size=v_identity.byte_size
      for update of job skip locked
    loop
      if messaging.cancel_media_processing_job_for_safety_v1(
        v_job.id,
        'Media processing cancelled because the canonical source is under Safety containment.'
      ) then
        v_cancelled_job_count:=v_cancelled_job_count+1;
      end if;
    end loop;

    v_event_id:=messaging.append_human_safety_event_v1(
      p_case_id,
      'media_contained',
      v_admin.user_id,
      v_admin.person_resource_id,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'seed_media_file_object_id',p_media_file_object_id,
        'matched_file_count',v_matched_count,
        'target_added_count',v_target_added_count,
        'containment_added_count',v_containment_changed_count,
        'cancelled_processing_job_count',v_cancelled_job_count
      )
    );
  else
    with released as (
      update messaging.safety_media_containment containment
      set status='released',
          released_at=now(),
          released_by_user_id=v_admin.user_id,
          release_note=v_reason
      from media.file_objects file_object
      where containment.media_file_object_id=file_object.id
        and containment.safety_case_id=p_case_id
        and containment.status='active'
        and file_object.verification_state='verified'
        and file_object.sha256=v_identity.sha256
        and file_object.byte_size=v_identity.byte_size
      returning 1
    )
    select count(*) into v_containment_changed_count from released;

    v_event_id:=messaging.append_human_safety_event_v1(
      p_case_id,
      'media_containment_released',
      v_admin.user_id,
      v_admin.person_resource_id,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'seed_media_file_object_id',p_media_file_object_id,
        'matched_file_count',v_matched_count,
        'released_containment_count',v_containment_changed_count
      )
    );
  end if;

  v_result:=jsonb_build_object(
    'safety_case_id',p_case_id,
    'media_file_object_id',p_media_file_object_id,
    'contained',p_contained,
    'matched_file_count',v_matched_count,
    'target_added_count',v_target_added_count,
    'containment_changed_count',v_containment_changed_count,
    'cancelled_processing_job_count',v_cancelled_job_count,
    'event_id',v_event_id,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end;
$function$;

create or replace function public.submit_messages_safety_media_scan_v1(
  p_case_id uuid,
  p_media_file_object_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, media, platform_private
as $function$
declare
  v_admin record;
  v_case messaging.safety_cases%rowtype;
  v_file media.file_objects%rowtype;
  v_correlation uuid;
  v_begin record;
  v_job_id uuid;
  v_result jsonb;
begin
  select * into v_admin from messaging.current_messages_super_admin();

  if p_case_id is null or p_media_file_object_id is null then
    raise exception
      using errcode='22023',
      message='Safety Case and Media file are required.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_admin.user_id,
    'messages.safety.media.scan',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.media.scan',
    v_admin.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'media_file_object_id',p_media_file_object_id,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_case
  from messaging.safety_cases
  where id=p_case_id
  for share;

  if not found or v_case.status<>'under_review' then
    raise exception
      using errcode='55000',
      message='Media Safety scan requires a Safety Case under review.';
  end if;

  if not exists(
    select 1
    from messaging.safety_case_targets target
    where target.safety_case_id=p_case_id
      and target.media_file_object_id=p_media_file_object_id
  ) then
    raise exception
      using errcode='42501',
      message='The Safety Case does not target this canonical Media file.';
  end if;

  select * into v_file
  from media.file_objects
  where id=p_media_file_object_id
    and verification_state='verified';

  if not found then
    raise exception
      using errcode='55000',
      message='Media Safety scan requires a verified canonical Media file.';
  end if;

  insert into platform_private.jobs(
    command_receipt_id,
    resource_id,
    command_type,
    job_key,
    job_type,
    max_attempts,
    input_payload
  )
  values(
    v_begin.command_receipt_id,
    v_admin.person_resource_id,
    'messages.safety.media.scan',
    'primary',
    'messages.safety.media.scan',
    4,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'media_file_object_id',p_media_file_object_id,
      'correlation_id',v_correlation
    )
  )
  returning id into v_job_id;

  v_result:=jsonb_build_object(
    'command_receipt_id',v_begin.command_receipt_id,
    'job_id',v_job_id,
    'safety_case_id',p_case_id,
    'media_file_object_id',p_media_file_object_id,
    'receipt_status','accepted',
    'correlation_id',v_correlation
  );

  update platform_private.command_receipts
  set result_payload=v_result
  where id=v_begin.command_receipt_id
    and status='accepted';

  return v_result;
end;
$function$;

create or replace function public.claim_messages_safety_media_scan_jobs_v1(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 900
)
returns table(
  job_id uuid,
  command_receipt_id uuid,
  safety_case_id uuid,
  media_file_object_id uuid,
  attempt_count integer,
  max_attempts integer,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private
as $function$
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  if p_worker_id is null
     or p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     or p_limit not between 1 and 10
     or p_lease_seconds not between 60 and 3600
  then
    raise exception using errcode='22023',message='Safety scan claim input is invalid.';
  end if;

  return query
  with candidates as (
    select job.id
    from platform_private.jobs job
    where job.command_type='messages.safety.media.scan'
      and job.job_type='messages.safety.media.scan'
      and job.status in ('queued','retry_wait')
      and job.available_at<=now()
      and job.attempt_count<job.max_attempts
      and job.locked_by is null
    order by job.priority,job.available_at,job.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update platform_private.jobs job
    set status='running',
        attempt_count=job.attempt_count+1,
        locked_by=p_worker_id,
        locked_at=now(),
        lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
        started_at=coalesce(job.started_at,now())
    from candidates
    where job.id=candidates.id
    returning job.*
  )
  select
    claimed.id,
    claimed.command_receipt_id,
    nullif(claimed.input_payload->>'safety_case_id','')::uuid,
    nullif(claimed.input_payload->>'media_file_object_id','')::uuid,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.lease_expires_at
  from claimed;
end;
$function$;

create or replace function public.get_messages_safety_media_scan_target_v1(
  p_job_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, messaging, media, platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_case_id uuid;
  v_file_id uuid;
  v_file media.file_objects%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  select * into v_job
  from platform_private.jobs
  where id=p_job_id;

  if not found
     or v_job.command_type<>'messages.safety.media.scan'
     or v_job.job_type<>'messages.safety.media.scan'
     or v_job.status<>'running'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.lease_expires_at is null
     or v_job.lease_expires_at<=now()
  then
    raise exception
      using errcode='55000',
      message='The Safety scan job is not actively leased to this worker.';
  end if;

  v_case_id:=nullif(v_job.input_payload->>'safety_case_id','')::uuid;
  v_file_id:=nullif(v_job.input_payload->>'media_file_object_id','')::uuid;

  if not exists(
    select 1
    from messaging.safety_case_targets target
    where target.safety_case_id=v_case_id
      and target.media_file_object_id=v_file_id
  ) then
    raise exception
      using errcode='55000',
      message='The Safety scan target no longer matches its case authority.';
  end if;

  select * into v_file
  from media.file_objects
  where id=v_file_id
    and verification_state='verified';

  if not found then
    raise exception
      using errcode='55000',
      message='The Safety scan target is not a verified canonical Media file.';
  end if;

  return jsonb_build_object(
    'job_id',v_job.id,
    'safety_case_id',v_case_id,
    'media_file_object_id',v_file.id,
    'storage_provider',v_file.storage_provider,
    'storage_namespace',v_file.storage_namespace,
    'storage_path',v_file.storage_path,
    'mime_type',v_file.mime_type,
    'byte_size',v_file.byte_size,
    'sha256',v_file.sha256,
    'verification_state',v_file.verification_state,
    'lease_expires_at',v_job.lease_expires_at
  );
end;
$function$;

create or replace function public.complete_messages_safety_media_scan_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, messaging, media, platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_case_id uuid;
  v_file_id uuid;
  v_provider_key text;
  v_provider_version text;
  v_label text;
  v_confidence numeric;
  v_provider_reference text;
  v_scanned_at timestamptz;
  v_sanitized jsonb;
  v_event_id uuid;
  v_completed record;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  if p_result is null
     or jsonb_typeof(p_result)<>'object'
     or octet_length(p_result::text)>12000
     or (p_result - array[
       'provider_key','provider_version','classification_label',
       'confidence','provider_reference','scanned_at'
     ])<>'{}'::jsonb
  then
    raise exception using errcode='22023',message='Safety scan result shape is invalid.';
  end if;

  v_provider_key:=nullif(btrim(p_result->>'provider_key'),'');
  v_provider_version:=nullif(btrim(p_result->>'provider_version'),'');
  v_label:=nullif(btrim(p_result->>'classification_label'),'');
  v_provider_reference:=nullif(btrim(p_result->>'provider_reference'),'');

  begin
    v_confidence:=(p_result->>'confidence')::numeric;
    v_scanned_at:=(p_result->>'scanned_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',message='Safety scan result values are invalid.';
  end;

  if v_provider_key is null
     or v_provider_key !~ '^[a-z][a-z0-9_.:-]{1,99}$'
     or v_provider_version is null
     or octet_length(v_provider_version)>200
     or v_label is null
     or octet_length(v_label)>200
     or v_confidence<0
     or v_confidence>1
     or (v_provider_reference is not null and octet_length(v_provider_reference)>500)
     or v_scanned_at is null
     or v_scanned_at>now()+interval '5 minutes'
  then
    raise exception using errcode='22023',message='Safety scan result values are invalid.';
  end if;

  select * into v_job
  from platform_private.jobs
  where id=p_job_id
  for update;

  if not found
     or v_job.command_type<>'messages.safety.media.scan'
     or v_job.job_type<>'messages.safety.media.scan'
     or v_job.status<>'running'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.lease_expires_at is null
     or v_job.lease_expires_at<=now()
  then
    raise exception
      using errcode='55000',
      message='The Safety scan job is not actively leased to this worker.';
  end if;

  v_case_id:=nullif(v_job.input_payload->>'safety_case_id','')::uuid;
  v_file_id:=nullif(v_job.input_payload->>'media_file_object_id','')::uuid;

  if not exists(
    select 1
    from messaging.safety_case_targets target
    where target.safety_case_id=v_case_id
      and target.media_file_object_id=v_file_id
  ) then
    raise exception
      using errcode='55000',
      message='The Safety scan target no longer matches its case authority.';
  end if;

  v_sanitized:=jsonb_build_object(
    'provider_key',v_provider_key,
    'provider_version',v_provider_version,
    'classification_label',v_label,
    'confidence',v_confidence,
    'provider_reference',v_provider_reference,
    'scanned_at',v_scanned_at
  );

  insert into messaging.safety_case_events(
    safety_case_id,
    event_kind,
    actor_kind,
    actor_key,
    command_receipt_id,
    occurred_at,
    metadata
  )
  values(
    v_case_id,
    'signal_added',
    'automation',
    'messages.safety.media.scan',
    v_job.command_receipt_id,
    now(),
    jsonb_build_object(
      'media_file_object_id',v_file_id,
      'provider_key',v_provider_key,
      'provider_version',v_provider_version,
      'classification_label',v_label,
      'confidence',v_confidence,
      'provider_reference',v_provider_reference,
      'scanned_at',v_scanned_at
    )
  )
  returning id into v_event_id;

  select * into v_completed
  from platform_private.complete_job(
    p_job_id,
    p_worker_id,
    v_sanitized
  );

  return jsonb_build_object(
    'job_id',p_job_id,
    'safety_case_id',v_case_id,
    'media_file_object_id',v_file_id,
    'signal_event_id',v_event_id,
    'success_event_id',v_completed.success_event_id,
    'job_status','succeeded'
  );
end;
$function$;

create or replace function public.fail_messages_safety_media_scan_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_failed record;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  select * into v_job
  from platform_private.jobs
  where id=p_job_id;

  if not found
     or v_job.command_type<>'messages.safety.media.scan'
     or v_job.job_type<>'messages.safety.media.scan'
  then
    raise exception using errcode='42501',message='Requested job is not a Messages Safety Media scan.';
  end if;

  select * into v_failed
  from platform_private.fail_job(
    p_job_id,
    p_worker_id,
    p_error,
    p_retryable,
    p_retry_delay_seconds
  );

  return jsonb_build_object(
    'job_id',p_job_id,
    'job_status',v_failed.job_status,
    'command_receipt_status',v_failed.command_receipt_status,
    'outbox_event_id',v_failed.outbox_event_id
  );
end;
$function$;

create or replace function public.recover_expired_messages_safety_media_scan_jobs_v1(
  p_limit integer default 10,
  p_retry_delay_seconds integer default 30
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_event_type text;
  v_count integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  if p_limit not between 1 and 100
     or p_retry_delay_seconds not between 1 and 3600
  then
    raise exception using errcode='22023',message='Safety scan recovery input is invalid.';
  end if;

  for v_job in
    select job.*
    from platform_private.jobs job
    where job.command_type='messages.safety.media.scan'
      and job.job_type='messages.safety.media.scan'
      and job.status='running'
      and job.lease_expires_at is not null
      and job.lease_expires_at<=now()
    order by job.lease_expires_at,job.created_at
    for update skip locked
    limit p_limit
  loop
    if v_job.attempt_count>=v_job.max_attempts then
      update platform_private.jobs
      set status='dead_letter',
          locked_by=null,
          locked_at=null,
          lease_expires_at=null,
          finished_at=now(),
          last_error='Messages Safety Media scan lease expired after the final allowed attempt.'
      where id=v_job.id;

      update platform_private.command_receipts
      set status='failed',
          error_code='job_failed',
          error_message='Messages Safety Media scan lease expired after the final allowed attempt.',
          completed_at=now()
      where id=v_job.command_receipt_id
        and status='accepted';

      select failure_event_type into v_event_type
      from platform_private.command_types
      where command_type=v_job.command_type;

      insert into platform_private.outbox_events(
        event_key,command_receipt_id,job_id,command_type,
        aggregate_id,event_type,payload
      )
      values(
        'command:'||v_job.command_receipt_id::text||':failed',
        v_job.command_receipt_id,v_job.id,v_job.command_type,
        v_job.resource_id,v_event_type,
        jsonb_build_object(
          'command_receipt_id',v_job.command_receipt_id,
          'job_id',v_job.id,
          'resource_id',v_job.resource_id,
          'error','Messages Safety Media scan lease expired after the final allowed attempt.',
          'failed_at',now()
        )
      )
      on conflict (event_key) do nothing;
    else
      update platform_private.jobs
      set status='retry_wait',
          available_at=now()+make_interval(secs=>p_retry_delay_seconds),
          locked_by=null,
          locked_at=null,
          lease_expires_at=null,
          last_error='Messages Safety Media scan worker lease expired before completion.'
      where id=v_job.id;

      select retry_event_type into v_event_type
      from platform_private.command_types
      where command_type=v_job.command_type;

      insert into platform_private.outbox_events(
        event_key,command_receipt_id,job_id,command_type,
        aggregate_id,event_type,payload
      )
      values(
        'job:'||v_job.id::text||':retry:'||v_job.attempt_count::text,
        v_job.command_receipt_id,v_job.id,v_job.command_type,
        v_job.resource_id,v_event_type,
        jsonb_build_object(
          'command_receipt_id',v_job.command_receipt_id,
          'job_id',v_job.id,
          'resource_id',v_job.resource_id,
          'attempt_count',v_job.attempt_count,
          'error','Messages Safety Media scan worker lease expired before completion.',
          'available_at',now()+make_interval(secs=>p_retry_delay_seconds)
        )
      )
      on conflict (event_key) do nothing;
    end if;

    v_count:=v_count+1;
  end loop;

  return v_count;
end;
$function$;

create or replace function public.get_my_message_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, messaging
as $function$
declare
  me record;
  audience_can_start boolean;
  has_conversations boolean;
  has_field_scope boolean;
  safety_state jsonb;
  safety_can_start boolean;
  safety_can_send boolean;
begin
  select * into me from messaging.current_human_identity();
  audience_can_start:=messaging.audience_allows_category(me.sender_category);

  select exists(
    select 1
    from messaging.conversation_participants participant
    where participant.user_id=me.user_id
      and participant.person_resource_id=me.person_resource_id
      and participant.membership_status='active'
  ) into has_conversations;

  select exists(
    select 1
    from messaging.conversation_participants participant
    where participant.user_id=me.user_id
      and participant.person_resource_id=me.person_resource_id
      and participant.membership_status='active'
      and messaging.field_submission_conversation_scope(
        participant.conversation_id,
        me.person_resource_id
      )
  ) into has_field_scope;

  safety_state:=messaging.message_safety_state_for_subject_v1(
    me.user_id,
    me.person_resource_id
  );
  safety_can_start:=coalesce((safety_state->>'can_start')::boolean,true);
  safety_can_send:=coalesce((safety_state->>'can_send')::boolean,true);

  return jsonb_build_object(
    'audience_mode',(select audience_mode from messaging.runtime_policy where singleton),
    'sender_category',me.sender_category,
    'can_start',audience_can_start and safety_can_start,
    'can_send',(audience_can_start or has_field_scope) and safety_can_send,
    'has_conversations',has_conversations,
    'visible',audience_can_start
      or has_conversations
      or coalesce((safety_state->>'has_safety_state')::boolean,false),
    'links_allowed',coalesce((safety_state->>'links_allowed')::boolean,true),
    'media_allowed',coalesce((safety_state->>'media_allowed')::boolean,true),
    'send_limited_until',safety_state->'next_send_at',
    'has_safety_state',coalesce((safety_state->>'has_safety_state')::boolean,false)
  );
end;
$function$;

create or replace function public.start_message_conversation(
  p_recipient_person_resource_id uuid,
  p_body text,
  p_resource_references jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_client_created_at timestamptz default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  conversation_id uuid,
  message_id uuid,
  mailbox_folder text,
  first_contact_state text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  me record;
  ru uuid;
  rc text;
  body text;
  corr uuid;
  req jsonb;
  b record;
  res jsonb;
  conv uuid;
  sp uuid;
  rp uuid;
  msg uuid;
  disp text;
  fcs text;
  folder text;
  approved boolean;
begin
  select * into me from messaging.current_human_identity();

  if p_recipient_person_resource_id is null
     or p_recipient_person_resource_id=me.person_resource_id
  then
    raise exception using errcode='22023',message='A different recipient Person is required.';
  end if;

  body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then
    raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.';
  end if;

  corr:=messaging.command_correlation(
    me.user_id,
    'messages.conversation.start',
    p_idempotency_key,
    p_correlation_id
  );
  req:=jsonb_build_object(
    'recipient_person_resource_id',p_recipient_person_resource_id,
    'body',body,
    'resource_references',coalesce(p_resource_references,'[]'::jsonb),
    'client_created_at',p_client_created_at,
    'correlation_id',corr
  );

  select * into b
  from platform_private.begin_authenticated_resource_command(
    'messages.conversation.start',
    me.person_resource_id,
    p_idempotency_key,
    req
  );

  if b.idempotent_replay then
    res:=b.result_payload;
    command_receipt_id:=b.command_receipt_id;
    receipt_status:=b.receipt_status;
    conversation_id:=nullif(res->>'conversation_id','')::uuid;
    message_id:=nullif(res->>'message_id','')::uuid;
    mailbox_folder:=res->>'mailbox_folder';
    first_contact_state:=res->>'first_contact_state';
    idempotent_replay:=true;
    return next;
    return;
  end if;

  perform messaging.validate_resource_references(me.user_id,p_resource_references);
  perform messaging.assert_sender_safety_allows_v1(
    me.user_id,
    me.person_resource_id,
    'conversation_start',
    body,
    p_resource_references
  );

  ru:=messaging.active_user_for_person(p_recipient_person_resource_id);
  if ru is null then
    raise exception using errcode='P0002',message='The recipient is not available for Messages.';
  end if;

  rc:=messaging.user_sender_category(ru);
  if not messaging.audience_allows_category(me.sender_category)
     or not messaging.audience_allows_category(rc)
  then
    raise exception using errcode='42501',message='Messages is not enabled for this audience.';
  end if;

  if messaging.person_blocked_between(me.user_id,p_recipient_person_resource_id) then
    raise exception using errcode='42501',message='This conversation cannot be started.';
  end if;

  if not messaging.recipient_content_allows(
    ru,me.sender_category,body,p_resource_references
  ) then
    raise exception using errcode='42501',message='The recipient does not allow this Message content.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'messages-direct-pair:'
      ||least(me.person_resource_id::text,p_recipient_person_resource_id::text)
      ||':'
      ||greatest(me.person_resource_id::text,p_recipient_person_resource_id::text),
      0
    )
  );

  select c.id into conv
  from messaging.conversations c
  where c.conversation_kind='direct'
    and c.status='active'
    and (
      select count(*)
      from messaging.conversation_participants x
      where x.conversation_id=c.id
        and x.actor_kind='human'
        and x.membership_status='active'
    )=2
    and exists(
      select 1
      from messaging.conversation_participants x
      where x.conversation_id=c.id
        and x.person_resource_id=me.person_resource_id
        and x.membership_status='active'
    )
    and exists(
      select 1
      from messaging.conversation_participants x
      where x.conversation_id=c.id
        and x.person_resource_id=p_recipient_person_resource_id
        and x.membership_status='active'
    )
  order by c.created_at desc
  limit 1;

  if conv is not null then
    select cp.id into sp
    from messaging.conversation_participants cp
    where cp.conversation_id=conv
      and cp.person_resource_id=me.person_resource_id
      and cp.membership_status='active';

    select cp.id,cp.mailbox_folder,cp.first_contact_state
    into rp,folder,fcs
    from messaging.conversation_participants cp
    where cp.conversation_id=conv
      and cp.person_resource_id=p_recipient_person_resource_id
      and cp.membership_status='active'
    for update;

    if fcs='declined' then
      raise exception using errcode='42501',message='The recipient declined this Message request.';
    end if;
  else
    select exists(
      select 1
      from messaging.sender_approvals a
      where a.recipient_person_resource_id=p_recipient_person_resource_id
        and a.sender_actor_kind='human'
        and a.sender_person_resource_id=me.person_resource_id
        and a.status='active'
    ) into approved;

    select coalesce(
      (
        select first_contact_disposition
        from messaging.user_sender_policies
        where user_id=ru
          and sender_category=me.sender_category
      ),
      messaging.default_first_contact_disposition(me.sender_category)
    ) into disp;

    if disp='reject' then
      raise exception using errcode='42501',message='The recipient is not accepting new Messages from this sender category.';
    end if;

    if approved or disp='inbox' then
      folder:='inbox';
      fcs:='accepted';
    else
      folder:='requests';
      fcs:='pending';
    end if;

    insert into messaging.conversations(
      security_classification,status,created_at,last_activity_at,correlation_id
    )
    values('standard','active',now(),now(),corr)
    returning id into conv;

    insert into messaging.conversation_participants(
      conversation_id,actor_kind,person_resource_id,user_id,
      membership_status,mailbox_folder,first_contact_state
    )
    values(
      conv,'human',me.person_resource_id,me.user_id,
      'active','inbox','not_applicable'
    )
    returning id into sp;

    insert into messaging.conversation_participants(
      conversation_id,actor_kind,person_resource_id,user_id,
      membership_status,mailbox_folder,first_contact_state
    )
    values(
      conv,'human',p_recipient_person_resource_id,ru,
      'active',folder,fcs
    )
    returning id into rp;

    update messaging.conversations
    set created_by_participant_id=sp
    where id=conv;
  end if;

  insert into messaging.messages(
    conversation_id,sender_participant_id,message_kind,body,
    accepted_at,client_created_at,correlation_id,command_receipt_id
  )
  values(conv,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id)
  returning id into msg;

  perform messaging.insert_resource_references(msg,p_resource_references);

  insert into messaging.message_receipts(
    message_id,participant_id,conversation_id,delivery_state,delivered_at
  )
  values(msg,rp,conv,'delivered',now());

  update messaging.conversations set last_activity_at=now() where id=conv;

  perform platform_private.complete_resource_command(
    b.command_receipt_id,
    jsonb_build_object(
      'conversation_id',conv,
      'message_id',msg,
      'mailbox_folder',folder,
      'first_contact_state',fcs,
      'correlation_id',corr
    )
  );

  command_receipt_id:=b.command_receipt_id;
  receipt_status:='succeeded';
  conversation_id:=conv;
  message_id:=msg;
  mailbox_folder:=folder;
  first_contact_state:=fcs;
  idempotent_replay:=false;
  return next;
end;
$function$;

create or replace function public.start_field_submission_message_v1(
  p_submission_resource_id uuid,
  p_expected_submission_revision bigint,
  p_body text,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_client_created_at timestamptz default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  conversation_id uuid,
  message_id uuid,
  mailbox_folder text,
  first_contact_state text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private, extensions
as $function$
declare
  me record;
  f editorial.field_submissions%rowtype;
  recipient_user uuid;
  recipient_person uuid;
  identity_count integer;
  body text;
  corr uuid;
  req jsonb;
  b record;
  res jsonb;
  conv uuid;
  sp uuid;
  rp uuid;
  msg uuid;
  disp text;
  folder text;
  fcs text;
  approved boolean;
  refs jsonb;
begin
  select * into me from messaging.current_human_identity();

  if not public.current_user_has_capability('view_field_intake') then
    raise exception using errcode='42501',message='Internal Field intake permission is required.';
  end if;

  select * into f
  from editorial.field_submissions
  where resource_id=p_submission_resource_id
  for update;

  if not found then
    raise exception using errcode='P0002',message='Field Submission not found.';
  end if;

  if f.newsroom_identity_mode='restricted'
     and not public.current_user_has_capability('view_restricted_field_sources')
  then
    raise exception using errcode='42501',message='Restricted Field source permission is required.';
  end if;

  if f.current_revision<>p_expected_submission_revision then
    raise exception using errcode='40001',message='The Field Submission changed before contact could be started.';
  end if;

  if f.submission_state not in ('received','submitted')
     or f.follow_up_permission<>'allowed'
     or f.preferred_contact_channel<>'messages'
  then
    raise exception using errcode='42501',message='This Field Submission does not permit Messages follow-up.';
  end if;

  select
    count(*),
    (array_agg(l.user_id order by l.user_id))[1],
    (array_agg(l.person_resource_id order by l.person_resource_id))[1]
  into identity_count,recipient_user,recipient_person
  from editorial.person_identity_links l
  join editorial.people p
    on p.resource_id=l.person_resource_id
   and p.person_state='active'
  join public.user_profiles u
    on u.user_id=l.user_id
   and u.status='active'
  where l.user_id=f.owner_user_id
    and l.link_state='active';

  if identity_count<>1
     or recipient_user is null
     or recipient_person is null
  then
    raise exception using errcode='42501',message='The contributor does not have one active canonical Messages identity.';
  end if;

  body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then
    raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.';
  end if;

  refs:=jsonb_build_array(
    jsonb_build_object(
      'resource_id',p_submission_resource_id,
      'resource_version_id',null,
      'presentation_kind','resource'
    )
  );

  if messaging.person_blocked_between(me.user_id,recipient_person) then
    raise exception using errcode='42501',message='This conversation cannot be started.';
  end if;

  if not messaging.recipient_content_allows(
    recipient_user,me.sender_category,body,refs
  ) then
    raise exception using errcode='42501',message='The recipient does not allow this Message content.';
  end if;

  corr:=messaging.command_correlation(
    me.user_id,
    'field.submission.message.start',
    p_idempotency_key,
    p_correlation_id
  );
  req:=jsonb_build_object(
    'submission_resource_id',p_submission_resource_id,
    'expected_submission_revision',p_expected_submission_revision,
    'body',body,
    'resource_references',refs,
    'client_created_at',p_client_created_at,
    'correlation_id',corr
  );

  select * into b
  from platform_private.begin_authenticated_resource_command(
    'field.submission.message.start',
    p_submission_resource_id,
    p_idempotency_key,
    req
  );

  if b.idempotent_replay then
    res:=b.result_payload;
    command_receipt_id:=b.command_receipt_id;
    receipt_status:=b.receipt_status;
    conversation_id:=nullif(res->>'conversation_id','')::uuid;
    message_id:=nullif(res->>'message_id','')::uuid;
    mailbox_folder:=res->>'mailbox_folder';
    first_contact_state:=res->>'first_contact_state';
    idempotent_replay:=true;
    return next;
    return;
  end if;

  perform messaging.assert_sender_safety_allows_v1(
    me.user_id,
    me.person_resource_id,
    'conversation_start',
    body,
    refs
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'messages-direct-pair:'
      ||least(me.person_resource_id::text,recipient_person::text)
      ||':'
      ||greatest(me.person_resource_id::text,recipient_person::text),
      0
    )
  );

  select c.id into conv
  from messaging.conversations c
  where c.conversation_kind='direct'
    and c.status='active'
    and (
      select count(*)
      from messaging.conversation_participants x
      where x.conversation_id=c.id
        and x.actor_kind='human'
        and x.membership_status='active'
    )=2
    and exists(
      select 1
      from messaging.conversation_participants x
      where x.conversation_id=c.id
        and x.person_resource_id=me.person_resource_id
        and x.membership_status='active'
    )
    and exists(
      select 1
      from messaging.conversation_participants x
      where x.conversation_id=c.id
        and x.person_resource_id=recipient_person
        and x.membership_status='active'
    )
  order by c.created_at desc
  limit 1;

  if conv is not null then
    select id into sp
    from messaging.conversation_participants
    where conversation_id=conv
      and person_resource_id=me.person_resource_id
      and membership_status='active';

    select id,mailbox_folder,first_contact_state
    into rp,folder,fcs
    from messaging.conversation_participants
    where conversation_id=conv
      and person_resource_id=recipient_person
      and membership_status='active'
    for update;

    if fcs='declined' then
      raise exception using errcode='42501',message='The recipient declined this Message request.';
    end if;
  else
    select exists(
      select 1
      from messaging.sender_approvals a
      where a.recipient_person_resource_id=recipient_person
        and a.sender_actor_kind='human'
        and a.sender_person_resource_id=me.person_resource_id
        and a.status='active'
    ) into approved;

    select coalesce(
      (
        select first_contact_disposition
        from messaging.user_sender_policies
        where user_id=recipient_user
          and sender_category=me.sender_category
      ),
      messaging.default_first_contact_disposition(me.sender_category)
    ) into disp;

    if disp='reject' then
      raise exception using errcode='42501',message='The recipient is not accepting new Messages from this sender category.';
    end if;

    if approved or disp='inbox' then
      folder:='inbox';
      fcs:='accepted';
    else
      folder:='requests';
      fcs:='pending';
    end if;

    insert into messaging.conversations(
      security_classification,status,created_at,last_activity_at,correlation_id
    )
    values('standard','active',now(),now(),corr)
    returning id into conv;

    insert into messaging.conversation_participants(
      conversation_id,actor_kind,person_resource_id,user_id,
      membership_status,mailbox_folder,first_contact_state
    )
    values(
      conv,'human',me.person_resource_id,me.user_id,
      'active','inbox','not_applicable'
    )
    returning id into sp;

    insert into messaging.conversation_participants(
      conversation_id,actor_kind,person_resource_id,user_id,
      membership_status,mailbox_folder,first_contact_state
    )
    values(
      conv,'human',recipient_person,recipient_user,
      'active',folder,fcs
    )
    returning id into rp;

    update messaging.conversations
    set created_by_participant_id=sp
    where id=conv;
  end if;

  insert into messaging.messages(
    conversation_id,sender_participant_id,message_kind,body,
    accepted_at,client_created_at,correlation_id,command_receipt_id
  )
  values(conv,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id)
  returning id into msg;

  perform messaging.insert_resource_references(msg,refs);

  insert into messaging.message_receipts(
    message_id,participant_id,conversation_id,delivery_state,delivered_at
  )
  values(msg,rp,conv,'delivered',now());

  update messaging.conversations set last_activity_at=now() where id=conv;

  perform platform_private.complete_resource_command(
    b.command_receipt_id,
    jsonb_build_object(
      'conversation_id',conv,
      'message_id',msg,
      'mailbox_folder',folder,
      'first_contact_state',fcs,
      'submission_resource_id',p_submission_resource_id,
      'correlation_id',corr
    )
  );

  command_receipt_id:=b.command_receipt_id;
  receipt_status:='succeeded';
  conversation_id:=conv;
  message_id:=msg;
  mailbox_folder:=folder;
  first_contact_state:=fcs;
  idempotent_replay:=false;
  return next;
end;
$function$;

create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text,
  p_resource_references jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_client_created_at timestamptz default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  conversation_id uuid,
  message_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  me record;
  sp uuid;
  body text;
  corr uuid;
  req jsonb;
  b record;
  msg uuid;
  o record;
  field_scope boolean;
begin
  select * into me from messaging.current_human_identity();
  body:=nullif(btrim(coalesce(p_body,'')),'');

  if body is null or octet_length(body)>10000 then
    raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.';
  end if;

  corr:=messaging.command_correlation(
    me.user_id,
    'messages.message.send',
    p_idempotency_key,
    p_correlation_id
  );
  req:=jsonb_build_object(
    'conversation_id',p_conversation_id,
    'body',body,
    'resource_references',coalesce(p_resource_references,'[]'::jsonb),
    'client_created_at',p_client_created_at,
    'correlation_id',corr
  );

  select * into b
  from platform_private.begin_authenticated_resource_command(
    'messages.message.send',
    me.person_resource_id,
    p_idempotency_key,
    req
  );

  if b.idempotent_replay then
    command_receipt_id:=b.command_receipt_id;
    receipt_status:=b.receipt_status;
    conversation_id:=nullif(b.result_payload->>'conversation_id','')::uuid;
    message_id:=nullif(b.result_payload->>'message_id','')::uuid;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  perform messaging.validate_resource_references(me.user_id,p_resource_references);
  perform messaging.assert_sender_safety_allows_v1(
    me.user_id,
    me.person_resource_id,
    'message_send',
    body,
    p_resource_references
  );

  select cp.id into sp
  from messaging.conversation_participants cp
  join messaging.conversations c on c.id=cp.conversation_id
  where cp.conversation_id=p_conversation_id
    and cp.person_resource_id=me.person_resource_id
    and cp.user_id=me.user_id
    and cp.membership_status='active'
    and c.status='active'
  for update;

  if sp is null then
    raise exception using errcode='42501',message='Active conversation membership is required.';
  end if;

  if exists(
    select 1
    from messaging.conversation_participants sy
    left join platform_private.system_actor_message_policies p
      on p.actor_key=sy.actor_key
    where sy.conversation_id=p_conversation_id
      and sy.id<>sp
      and sy.membership_status='active'
      and sy.actor_kind in ('system','automation')
      and coalesce(p.allow_human_reply,false)=false
  ) then
    raise exception using errcode='42501',message='Replies are not enabled for this System Actor.';
  end if;

  field_scope:=messaging.field_submission_conversation_scope(
    p_conversation_id,
    me.person_resource_id
  );

  for o in
    select cp.*
    from messaging.conversation_participants cp
    where cp.conversation_id=p_conversation_id
      and cp.id<>sp
      and cp.membership_status='active'
      and cp.actor_kind='human'
  loop
    if (
      (not field_scope)
      and (
        not messaging.audience_allows_category(me.sender_category)
        or not messaging.audience_allows_category(
          messaging.user_sender_category(o.user_id)
        )
      )
    )
    or messaging.person_blocked_between(me.user_id,o.person_resource_id)
    or o.first_contact_state='declined'
    or not messaging.recipient_content_allows(
      o.user_id,me.sender_category,body,p_resource_references
    ) then
      raise exception using errcode='42501',message='This Message cannot be delivered.';
    end if;
  end loop;

  insert into messaging.messages(
    conversation_id,sender_participant_id,message_kind,body,
    accepted_at,client_created_at,correlation_id,command_receipt_id
  )
  values(
    p_conversation_id,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id
  )
  returning id into msg;

  perform messaging.insert_resource_references(msg,p_resource_references);

  insert into messaging.message_receipts(
    message_id,participant_id,conversation_id,delivery_state,delivered_at
  )
  select msg,cp.id,p_conversation_id,'delivered',now()
  from messaging.conversation_participants cp
  where cp.conversation_id=p_conversation_id
    and cp.id<>sp
    and cp.membership_status='active';

  update messaging.conversations
  set last_activity_at=now()
  where id=p_conversation_id;

  perform platform_private.complete_resource_command(
    b.command_receipt_id,
    jsonb_build_object(
      'conversation_id',p_conversation_id,
      'message_id',msg,
      'correlation_id',corr
    )
  );

  command_receipt_id:=b.command_receipt_id;
  receipt_status:='succeeded';
  conversation_id:=p_conversation_id;
  message_id:=msg;
  idempotent_replay:=false;
  return next;
end;
$function$;

create or replace function public.resolve_message_safety_case_v1(
  p_case_id uuid,
  p_disposition text,
  p_resolution_note text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, messaging, platform_private
as $function$
declare
  admin_identity record;
  safety_case messaging.safety_cases%rowtype;
  disposition text:=lower(btrim(coalesce(p_disposition,'')));
  resolution_note_value text:=nullif(btrim(coalesce(p_resolution_note,'')),'');
  correlation uuid;
  begin_row record;
  active_quarantine_count bigint;
  effective_enforcement_count bigint;
  event_id uuid;
  result jsonb;
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  if p_case_id is null
     or disposition not in ('no_action','quarantine','enforced')
     or resolution_note_value is null
     or octet_length(resolution_note_value)>4000
  then
    raise exception 'Safety Case resolution input is invalid.' using errcode='22023';
  end if;

  correlation:=messaging.command_correlation(
    admin_identity.user_id,
    'messages.safety.resolve',
    p_idempotency_key,
    p_correlation_id
  );

  select * into begin_row
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.resolve',
    admin_identity.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'disposition',disposition,
      'resolution_note',resolution_note_value,
      'correlation_id',correlation
    )
  );

  if begin_row.idempotent_replay then
    return begin_row.result_payload;
  end if;

  select * into safety_case
  from messaging.safety_cases
  where id=p_case_id
  for update;

  if safety_case.id is null then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  if safety_case.status='resolved' then
    if safety_case.current_disposition<>disposition then
      raise exception
        'Safety Case is already resolved with another disposition.'
        using errcode='40001';
    end if;

    result:=jsonb_build_object(
      'safety_case_id',safety_case.id,
      'status',safety_case.status,
      'disposition',safety_case.current_disposition,
      'resolved_at',safety_case.resolved_at,
      'changed',false,
      'correlation_id',correlation
    );
    perform platform_private.complete_resource_command(
      begin_row.command_receipt_id,
      result
    );
    return result;
  end if;

  select count(*) into active_quarantine_count
  from messaging.message_quarantine quarantine
  where quarantine.safety_case_id=p_case_id
    and quarantine.status='active';

  select count(*) into effective_enforcement_count
  from messaging.safety_enforcements enforcement
  where enforcement.safety_case_id=p_case_id
    and messaging.safety_enforcement_is_effective_v1(
      enforcement.status,
      enforcement.effective_until
    );

  if disposition='no_action' and active_quarantine_count<>0 then
    raise exception
      'Release active quarantine before resolving with no action.'
      using errcode='22023';
  end if;

  if disposition='quarantine' and active_quarantine_count=0 then
    raise exception
      'An active quarantine is required for the quarantine disposition.'
      using errcode='22023';
  end if;

  if disposition='enforced' and effective_enforcement_count=0 then
    raise exception
      'An effective Messages enforcement is required for the enforced disposition.'
      using errcode='22023';
  end if;

  update messaging.safety_cases
  set status='resolved',
      current_disposition=disposition,
      resolved_by_user_id=admin_identity.user_id,
      resolved_at=now(),
      resolution_note=resolution_note_value,
      updated_at=now(),
      reviewed_by_user_id=coalesce(reviewed_by_user_id,admin_identity.user_id),
      review_started_at=coalesce(review_started_at,now())
  where id=p_case_id
  returning * into safety_case;

  insert into messaging.safety_case_events(
    safety_case_id,event_kind,actor_kind,actor_user_id,
    actor_person_resource_id,command_receipt_id,occurred_at,metadata
  )
  values(
    p_case_id,'resolved','human',admin_identity.user_id,
    admin_identity.person_resource_id,begin_row.command_receipt_id,now(),
    jsonb_build_object(
      'disposition',disposition,
      'resolution_note',resolution_note_value,
      'active_quarantine_count',active_quarantine_count,
      'effective_enforcement_count',effective_enforcement_count
    )
  )
  returning id into event_id;

  result:=jsonb_build_object(
    'safety_case_id',safety_case.id,
    'status',safety_case.status,
    'disposition',safety_case.current_disposition,
    'resolved_at',safety_case.resolved_at,
    'changed',true,
    'event_id',event_id,
    'correlation_id',correlation
  );

  perform platform_private.complete_resource_command(
    begin_row.command_receipt_id,
    result
  );

  return result;
end;
$function$;

create or replace function public.list_messages_safety_cases_v1(
  p_status text default null,
  p_before_updated_at timestamptz default null,
  p_before_case_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, messaging
as $function$
declare
  admin_identity record;
  status_filter text:=nullif(lower(btrim(coalesce(p_status,''))), '');
  limit_value integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  if status_filter is not null
     and status_filter not in ('open','under_review','resolved')
  then
    raise exception 'Safety Case status filter is invalid.' using errcode='22023';
  end if;

  return coalesce((
    select jsonb_agg(row_json order by updated_at desc,case_id desc)
    from (
      select
        safety_case.id as case_id,
        safety_case.updated_at,
        jsonb_build_object(
          'case_id',safety_case.id,
          'status',safety_case.status,
          'policy_category',safety_case.policy_category,
          'severity',safety_case.severity,
          'current_disposition',safety_case.current_disposition,
          'source_kind',safety_case.source_kind,
          'created_at',safety_case.created_at,
          'updated_at',safety_case.updated_at,
          'message_target_count',(
            select count(*) from messaging.safety_case_targets target
            where target.safety_case_id=safety_case.id
              and target.message_id is not null
          ),
          'media_target_count',(
            select count(*) from messaging.safety_case_targets target
            where target.safety_case_id=safety_case.id
              and target.media_file_object_id is not null
          ),
          'active_quarantine_count',(
            select count(*) from messaging.message_quarantine quarantine
            where quarantine.safety_case_id=safety_case.id
              and quarantine.status='active'
          ),
          'active_enforcement_count',(
            select count(*) from messaging.safety_enforcements enforcement
            where enforcement.safety_case_id=safety_case.id
              and messaging.safety_enforcement_is_effective_v1(
                enforcement.status,enforcement.effective_until
              )
          ),
          'open_appeal_count',(
            select count(*) from messaging.safety_appeals appeal
            where appeal.safety_case_id=safety_case.id
              and appeal.status<>'resolved'
          ),
          'active_media_containment_count',(
            select count(*) from messaging.safety_media_containment containment
            where containment.safety_case_id=safety_case.id
              and containment.status='active'
          )
        ) as row_json
      from messaging.safety_cases safety_case
      where (status_filter is null or safety_case.status=status_filter)
        and (
          p_before_updated_at is null
          or (safety_case.updated_at,safety_case.id)<(
            p_before_updated_at,
            coalesce(p_before_case_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
          )
        )
      order by safety_case.updated_at desc,safety_case.id desc
      limit limit_value
    ) page
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.get_messages_safety_case_v1(
  p_case_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, messaging
as $function$
declare
  admin_identity record;
  safety_case messaging.safety_cases%rowtype;
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  select * into safety_case
  from messaging.safety_cases
  where id=p_case_id;

  if safety_case.id is null then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'case',jsonb_build_object(
      'case_id',safety_case.id,
      'status',safety_case.status,
      'policy_category',safety_case.policy_category,
      'severity',safety_case.severity,
      'confidence',safety_case.confidence,
      'current_disposition',safety_case.current_disposition,
      'source_kind',safety_case.source_kind,
      'created_by_user_id',safety_case.created_by_user_id,
      'created_at',safety_case.created_at,
      'updated_at',safety_case.updated_at,
      'reviewed_by_user_id',safety_case.reviewed_by_user_id,
      'review_started_at',safety_case.review_started_at,
      'resolved_by_user_id',safety_case.resolved_by_user_id,
      'resolved_at',safety_case.resolved_at,
      'resolution_note',safety_case.resolution_note
    ),
    'targets',coalesce((
      select jsonb_agg(target_json order by linked_at,target_id)
      from (
        select target.linked_at,target.id as target_id,
          case when target.message_id is not null then
            jsonb_build_object(
              'target_id',target.id,
              'target_type','message',
              'message_id',target.message_id,
              'conversation_id',message.conversation_id,
              'accepted_at',message.accepted_at,
              'sender',messaging.participant_identity_json(
                sender.actor_kind,sender.person_resource_id,sender.actor_key
              ),
              'linked_at',target.linked_at
            )
          else
            jsonb_build_object(
              'target_id',target.id,
              'target_type','media_file',
              'media_file_object_id',target.media_file_object_id,
              'linked_at',target.linked_at
            )
          end as target_json
        from messaging.safety_case_targets target
        left join messaging.messages message on message.id=target.message_id
        left join messaging.conversation_participants sender
          on sender.id=message.sender_participant_id
        where target.safety_case_id=safety_case.id
      ) targets
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'event_id',event.id,
          'event_kind',event.event_kind,
          'actor_kind',event.actor_kind,
          'actor_user_id',event.actor_user_id,
          'actor_person_resource_id',event.actor_person_resource_id,
          'actor_key',event.actor_key,
          'occurred_at',event.occurred_at,
          'metadata',event.metadata
        ) order by event.occurred_at,event.id
      )
      from messaging.safety_case_events event
      where event.safety_case_id=safety_case.id
    ),'[]'::jsonb),
    'quarantine',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'quarantine_id',quarantine.id,
          'message_id',quarantine.message_id,
          'status',quarantine.status,
          'policy_category',quarantine.policy_category,
          'placed_at',quarantine.placed_at,
          'released_at',quarantine.released_at,
          'release_note',quarantine.release_note
        ) order by quarantine.placed_at,quarantine.id
      )
      from messaging.message_quarantine quarantine
      where quarantine.safety_case_id=safety_case.id
    ),'[]'::jsonb),
    'enforcements',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'enforcement_id',enforcement.id,
          'source_message_id',enforcement.source_message_id,
          'subject_user_id',enforcement.subject_user_id,
          'subject_person_resource_id',enforcement.subject_person_resource_id,
          'enforcement_kind',enforcement.enforcement_kind,
          'status',enforcement.status,
          'applied_at',enforcement.applied_at,
          'applied_by_user_id',enforcement.applied_by_user_id,
          'effective_until',enforcement.effective_until,
          'appeal_allowed',enforcement.appeal_allowed,
          'public_reason',enforcement.public_reason,
          'internal_reason',enforcement.internal_reason,
          'cooldown_seconds',enforcement.cooldown_seconds,
          'rate_limit_count',enforcement.rate_limit_count,
          'rate_limit_window_seconds',enforcement.rate_limit_window_seconds,
          'ended_at',enforcement.ended_at,
          'ended_by_user_id',enforcement.ended_by_user_id,
          'end_reason',enforcement.end_reason,
          'superseded_by_enforcement_id',enforcement.superseded_by_enforcement_id,
          'revision',enforcement.revision
        ) order by enforcement.applied_at,enforcement.id
      )
      from messaging.safety_enforcements enforcement
      where enforcement.safety_case_id=safety_case.id
    ),'[]'::jsonb),
    'appeals',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'appeal_id',appeal.id,
          'enforcement_id',appeal.enforcement_id,
          'status',appeal.status,
          'appeal_reason',appeal.appeal_reason,
          'submitted_at',appeal.submitted_at,
          'review_started_at',appeal.review_started_at,
          'reviewed_by_user_id',appeal.reviewed_by_user_id,
          'resolution',appeal.resolution,
          'resolution_public_note',appeal.resolution_public_note,
          'resolution_internal_note',appeal.resolution_internal_note,
          'resolved_at',appeal.resolved_at,
          'resolved_by_user_id',appeal.resolved_by_user_id,
          'revision',appeal.revision
        ) order by appeal.submitted_at,appeal.id
      )
      from messaging.safety_appeals appeal
      where appeal.safety_case_id=safety_case.id
    ),'[]'::jsonb),
    'media_containment',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'containment_id',containment.id,
          'media_file_object_id',containment.media_file_object_id,
          'status',containment.status,
          'policy_category',containment.policy_category,
          'placed_at',containment.placed_at,
          'placed_by_user_id',containment.placed_by_user_id,
          'released_at',containment.released_at,
          'released_by_user_id',containment.released_by_user_id,
          'release_note',containment.release_note
        ) order by containment.placed_at,containment.id
      )
      from messaging.safety_media_containment containment
      where containment.safety_case_id=safety_case.id
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function messaging.guard_media_processing_job_insert_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, messaging
as $function$
declare
  v_source_file_object_id uuid;
  v_identity record;
begin
  if new.command_type='media.process_revision'
     and new.job_type='media.process_revision'
  then
    begin
      v_source_file_object_id:=nullif(
        new.input_payload->>'source_file_object_id',''
      )::uuid;
    exception when others then
      raise exception
        using errcode='22023',
        message='Media processing job source identity is invalid.';
    end;

    if v_source_file_object_id is null then
      raise exception
        using errcode='22023',
        message='Media processing job requires a canonical source file identity.';
    end if;

    select * into v_identity
    from messaging.lock_media_safety_identity_v1(v_source_file_object_id);

    if messaging.media_file_is_safety_contained(v_source_file_object_id) then
      raise exception
        using errcode='55000',
        message='Media processing is unavailable for a Safety-contained source.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger jobs_media_safety_guard
before insert on platform_private.jobs
for each row execute function messaging.guard_media_processing_job_insert_v1();

create or replace function messaging.guard_media_variant_source_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, messaging
as $function$
declare
  v_identity record;
begin
  if new.source_file_object_id is not null then
    select * into v_identity
    from messaging.lock_media_safety_identity_v1(new.source_file_object_id);

    if messaging.media_file_is_safety_contained(new.source_file_object_id) then
      raise exception
        using errcode='55000',
        message='A Safety-contained Media source cannot register a new derivative.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger variants_media_safety_guard
before insert on media.variants
for each row execute function messaging.guard_media_variant_source_v1();

create or replace function messaging.guard_media_variant_selection_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, media, messaging
as $function$
declare
  v_source_file_object_id uuid;
  v_identity record;
begin
  select variant.source_file_object_id
  into v_source_file_object_id
  from media.variants variant
  where variant.id=new.variant_id;

  if v_source_file_object_id is not null then
    select * into v_identity
    from messaging.lock_media_safety_identity_v1(v_source_file_object_id);

    if messaging.media_file_is_safety_contained(v_source_file_object_id) then
      raise exception
        using errcode='55000',
        message='A Safety-contained Media source cannot activate a derivative.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger variant_selections_media_safety_guard
before insert or update on media.variant_selections
for each row execute function messaging.guard_media_variant_selection_v1();

revoke all on function messaging.guard_media_processing_job_insert_v1()
  from public, anon, authenticated, service_role;
revoke all on function messaging.guard_media_variant_source_v1()
  from public, anon, authenticated, service_role;
revoke all on function messaging.guard_media_variant_selection_v1()
  from public, anon, authenticated, service_role;

create or replace function public.claim_media_processing_jobs_v1(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 3600
)
returns table(
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
set search_path = pg_catalog, auth, platform_private, messaging
as $function$
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  if p_worker_id is null
     or p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
  then
    raise exception using errcode='22023',message='worker_id is invalid.';
  end if;

  if p_limit not between 1 and 10 then
    raise exception using errcode='22023',message='limit must be between 1 and 10.';
  end if;

  if p_lease_seconds not between 60 and 3600 then
    raise exception using errcode='22023',message='lease_seconds must be between 60 and 3600.';
  end if;

  return query
  with candidates as (
    select job.id
    from platform_private.jobs job
    where job.command_type='media.process_revision'
      and job.job_type='media.process_revision'
      and job.status in ('queued','retry_wait')
      and job.available_at<=now()
      and job.attempt_count<job.max_attempts
      and job.locked_by is null
      and not messaging.media_file_is_safety_contained(
        nullif(job.input_payload->>'source_file_object_id','')::uuid
      )
    order by job.priority,job.available_at,job.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update platform_private.jobs job
    set status='running',
        attempt_count=job.attempt_count+1,
        locked_by=p_worker_id,
        locked_at=now(),
        lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
        started_at=coalesce(job.started_at,now())
    from candidates
    where job.id=candidates.id
    returning job.*
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
end;
$function$;

create or replace function public.complete_media_processing_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private, messaging
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_source_file_object_id uuid;
  v_identity record;
  v_receipt_id uuid;
  v_event_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  select * into v_job
  from platform_private.jobs
  where id=p_job_id;

  if not found
     or v_job.command_type<>'media.process_revision'
     or v_job.job_type<>'media.process_revision'
  then
    raise exception 'Requested job is not a Media processing job.';
  end if;

  v_source_file_object_id:=nullif(
    v_job.input_payload->>'source_file_object_id',''
  )::uuid;
  select * into v_identity
  from messaging.lock_media_safety_identity_v1(v_source_file_object_id);

  if messaging.media_file_is_safety_contained(v_source_file_object_id) then
    raise exception
      using errcode='55000',
      message='A Safety-contained Media source cannot complete processing successfully.';
  end if;

  select command_receipt_id,success_event_id
  into v_receipt_id,v_event_id
  from platform_private.complete_job(
    p_job_id,
    p_worker_id,
    coalesce(p_result,'{}'::jsonb)
  );

  return jsonb_build_object(
    'job_id',p_job_id,
    'command_receipt_id',v_receipt_id,
    'success_event_id',v_event_id,
    'job_status','succeeded'
  );
end;
$function$;

create or replace function public.fail_media_processing_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private, messaging
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_source_file_object_id uuid;
  v_identity record;
  v_job_status text;
  v_receipt_status text;
  v_event_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  select * into v_job
  from platform_private.jobs
  where id=p_job_id
  for update;

  if not found
     or v_job.command_type<>'media.process_revision'
     or v_job.job_type<>'media.process_revision'
  then
    raise exception 'Requested job is not a Media processing job.';
  end if;

  if v_job.status<>'running'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.lease_expires_at is null
     or v_job.lease_expires_at<=now()
  then
    raise exception
      using errcode='55000',
      message='The Media processing job is not actively leased to this worker.';
  end if;

  v_source_file_object_id:=nullif(
    v_job.input_payload->>'source_file_object_id',''
  )::uuid;
  select * into v_identity
  from messaging.lock_media_safety_identity_v1(v_source_file_object_id);

  if messaging.media_file_is_safety_contained(v_source_file_object_id) then
    perform messaging.cancel_media_processing_job_for_safety_v1(
      p_job_id,
      'Media processing terminated because the canonical source is under Safety containment.'
    );

    return jsonb_build_object(
      'job_id',p_job_id,
      'job_status','cancelled',
      'command_receipt_status','failed',
      'outbox_event_id',null
    );
  end if;

  select job_status,command_receipt_status,outbox_event_id
  into v_job_status,v_receipt_status,v_event_id
  from platform_private.fail_job(
    p_job_id,
    p_worker_id,
    p_error,
    p_retryable,
    p_retry_delay_seconds
  );

  return jsonb_build_object(
    'job_id',p_job_id,
    'job_status',v_job_status,
    'command_receipt_status',v_receipt_status,
    'outbox_event_id',v_event_id
  );
end;
$function$;

create or replace function public.recover_expired_media_processing_jobs_v1(
  p_limit integer default 10,
  p_retry_delay_seconds integer default 30
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private, messaging
as $function$
declare
  v_job platform_private.jobs%rowtype;
  v_source_file_object_id uuid;
  v_identity record;
  v_event_type text;
  v_count integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception using errcode='42501',message='Service-role access is required.';
  end if;

  if p_limit not between 1 and 100 then
    raise exception using errcode='22023',message='limit must be between 1 and 100.';
  end if;

  if p_retry_delay_seconds not between 1 and 3600 then
    raise exception using errcode='22023',message='retry delay must be between 1 and 3600 seconds.';
  end if;

  for v_job in
    select job.*
    from platform_private.jobs job
    where job.command_type='media.process_revision'
      and job.job_type='media.process_revision'
      and job.status='running'
      and job.lease_expires_at is not null
      and job.lease_expires_at<=now()
    order by job.lease_expires_at,job.created_at
    for update skip locked
    limit p_limit
  loop
    v_source_file_object_id:=nullif(
      v_job.input_payload->>'source_file_object_id',''
    )::uuid;
    select * into v_identity
    from messaging.lock_media_safety_identity_v1(v_source_file_object_id);

    if messaging.media_file_is_safety_contained(v_source_file_object_id) then
      perform messaging.cancel_media_processing_job_for_safety_v1(
        v_job.id,
        'Media processing cancelled after lease expiry because the canonical source is under Safety containment.'
      );
      v_count:=v_count+1;
      continue;
    end if;

    if v_job.attempt_count>=v_job.max_attempts then
      update platform_private.jobs
      set status='dead_letter',
          locked_by=null,
          locked_at=null,
          lease_expires_at=null,
          finished_at=now(),
          last_error='Media processing worker lease expired after the final allowed attempt.'
      where id=v_job.id;

      update platform_private.command_receipts
      set status='failed',
          error_code='job_failed',
          error_message='Media processing worker lease expired after the final allowed attempt.',
          completed_at=now()
      where id=v_job.command_receipt_id;

      select command_types.failure_event_type
      into v_event_type
      from platform_private.command_types command_types
      where command_types.command_type=v_job.command_type;

      insert into platform_private.outbox_events(
        event_key,command_receipt_id,job_id,command_type,
        aggregate_id,event_type,payload
      )
      values(
        'command:'||v_job.command_receipt_id::text||':failed',
        v_job.command_receipt_id,v_job.id,v_job.command_type,
        v_job.resource_id,v_event_type,
        jsonb_build_object(
          'command_receipt_id',v_job.command_receipt_id,
          'job_id',v_job.id,
          'resource_id',v_job.resource_id,
          'error','Media processing worker lease expired after the final allowed attempt.',
          'failed_at',now()
        )
      )
      on conflict (event_key) do nothing;
    else
      update platform_private.jobs
      set status='retry_wait',
          available_at=now()+make_interval(secs=>p_retry_delay_seconds),
          locked_by=null,
          locked_at=null,
          lease_expires_at=null,
          last_error='Media processing worker lease expired before completion.'
      where id=v_job.id;

      select command_types.retry_event_type
      into v_event_type
      from platform_private.command_types command_types
      where command_types.command_type=v_job.command_type;

      insert into platform_private.outbox_events(
        event_key,command_receipt_id,job_id,command_type,
        aggregate_id,event_type,payload
      )
      values(
        'job:'||v_job.id::text||':retry:'||v_job.attempt_count::text,
        v_job.command_receipt_id,v_job.id,v_job.command_type,
        v_job.resource_id,v_event_type,
        jsonb_build_object(
          'command_receipt_id',v_job.command_receipt_id,
          'job_id',v_job.id,
          'resource_id',v_job.resource_id,
          'attempt_count',v_job.attempt_count,
          'error','Media processing worker lease expired before completion.',
          'available_at',now()+make_interval(secs=>p_retry_delay_seconds)
        )
      )
      on conflict (event_key) do nothing;
    end if;

    v_count:=v_count+1;
  end loop;

  return v_count;
end;
$function$;

create or replace function messaging.assert_media_file_not_safety_contained_v1(
  p_media_file_object_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, messaging
as $function$
begin
  if p_media_file_object_id is not null
     and messaging.media_file_is_safety_contained(p_media_file_object_id)
  then
    raise exception
      using errcode='55000',
      message='Media delivery is blocked by current Safety containment.';
  end if;
end;
$function$;

revoke all on function messaging.assert_media_file_not_safety_contained_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_media_private_delivery_target_v1(
  p_file_object_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, media, messaging
as $function$
declare
  v_file media.file_objects%rowtype;
begin
  if coalesce(auth.role(),'')<>'authenticated'
     or auth.uid() is null
  then
    raise exception
      using errcode='42501',
      message='Authenticated Media actor is required.';
  end if;

  if not (
    public.current_user_has_capability('manage_media_assets')
    or public.current_user_is_administrator()
  ) then
    raise exception
      using errcode='42501',
      message='manage_media_assets capability is required.';
  end if;

  if p_file_object_id is null then
    raise exception using errcode='22023',message='file_object_id is required.';
  end if;

  select * into v_file
  from media.file_objects
  where id=p_file_object_id;

  if not found then
    raise exception using errcode='P0002',message='Media file object does not exist.';
  end if;

  if v_file.verification_state<>'verified'
     or v_file.storage_provider<>'lightsail_media'
     or v_file.storage_path is null
     or v_file.storage_path !~
       '^(masters/(audio|video)/|derived-objects/|private-files/(transcripts|captions)/)'
  then
    raise exception
      using errcode='55000',
      message='Only verified protected Lightsail Media files may use private delivery.';
  end if;

  if not (
    exists(
      select 1 from media.asset_revisions revision
      where revision.original_file_object_id=v_file.id
    )
    or exists(
      select 1 from media.variants variant
      where variant.derived_file_object_id=v_file.id
    )
  ) then
    raise exception
      using errcode='55000',
      message='Private delivery requires a canonical Media revision or variant binding.';
  end if;

  perform messaging.assert_media_file_not_safety_contained_v1(v_file.id);

  return jsonb_build_object(
    'file_object_id',v_file.id,
    'storage_path',v_file.storage_path,
    'original_filename',v_file.original_filename,
    'mime_type',v_file.mime_type,
    'byte_size',v_file.byte_size,
    'sha256',v_file.sha256,
    'verification_state',v_file.verification_state
  );
end;
$function$;

create or replace function public.resolve_media_asset_delivery(
  p_asset_id uuid,
  p_usage_link_id uuid default null,
  p_exact_asset_revision_id uuid default null,
  p_requested_variant_role text default null
)
returns table(
  logical_asset_id uuid,
  resolved_mode text,
  resolved_asset_revision_id uuid,
  resolved_file_object_id uuid,
  safe_delivery_url text,
  resolved_mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,
  approved_alt_text text,
  approved_caption text,
  approved_credit text
)
language plpgsql
security definer
set search_path = pg_catalog, public, media, messaging
as $function$
declare
  v_usage media.usage_links%rowtype;
  v_asset_lifecycle text;
  v_current_revision_id uuid;
  v_governance_version_number bigint;
  v_rights_status text;
  v_consent_status text;
  v_sensitivity text;
  v_embargo_state text;
  v_embargo_until timestamptz;
  v_source_protection_class text;
  v_preservation_state text;
  v_retention_state text;
  v_public_safety_state text;
  v_internal_reason text;
  v_resolution_mode text;
  v_revision_id uuid;
  v_file_object_id uuid;
  v_delivery_url text;
  v_mime_type text;
  v_technical_metadata jsonb;
  v_legacy_snapshot jsonb;
  v_compatibility_status text;
  v_compatibility_url text;
  v_alt_text text;
  v_caption text;
  v_credit text;
  v_width integer;
  v_height integer;
  v_duration numeric;
  v_is_approved_public boolean;
  v_is_legacy_compatibility boolean;
begin
  if p_asset_id is null then
    raise exception 'Media resolver requires a logical asset identity';
  end if;

  select
    asset_row.lifecycle_state,
    asset_row.current_revision_id,
    governance_row.version_number,
    governance_row.rights_status,
    governance_row.consent_status,
    governance_row.sensitivity,
    governance_row.embargo_state,
    governance_row.embargo_until,
    governance_row.source_protection_class,
    governance_row.preservation_state,
    governance_row.retention_state,
    governance_row.public_safety_state,
    governance_row.internal_reason
  into
    v_asset_lifecycle,
    v_current_revision_id,
    v_governance_version_number,
    v_rights_status,
    v_consent_status,
    v_sensitivity,
    v_embargo_state,
    v_embargo_until,
    v_source_protection_class,
    v_preservation_state,
    v_retention_state,
    v_public_safety_state,
    v_internal_reason
  from media.assets asset_row
  join media.asset_governance_versions governance_row
    on governance_row.id=asset_row.current_governance_version_id
  where asset_row.id=p_asset_id;

  if not found then
    raise exception 'Media resolver asset does not exist or lacks current governance';
  end if;

  if p_usage_link_id is not null then
    select usage_row.* into v_usage
    from media.usage_links usage_row
    where usage_row.id=p_usage_link_id;

    if not found or v_usage.usage_state<>'active' then
      raise exception 'Active Media usage does not exist';
    end if;

    if v_usage.asset_id<>p_asset_id then
      raise exception 'Media usage does not belong to the supplied asset';
    end if;

    if p_exact_asset_revision_id is not null
       and p_exact_asset_revision_id is distinct from v_usage.asset_revision_id
    then
      raise exception 'Supplied Media revision does not match the usage';
    end if;

    v_resolution_mode:=v_usage.resolution_mode;
    v_revision_id:=v_usage.asset_revision_id;
    v_alt_text:=v_usage.alt_text_snapshot;
    v_caption:=v_usage.caption_snapshot;
    v_credit:=v_usage.credit_snapshot;

    if v_resolution_mode='current_revision'
       and media.usage_role_requires_stability(v_usage.usage_role)
    then
      raise exception 'Publication-stable Media usage cannot resolve through current revision';
    end if;
  elsif p_exact_asset_revision_id is not null then
    v_resolution_mode:='exact_revision';
    v_revision_id:=p_exact_asset_revision_id;
  else
    v_resolution_mode:='current_revision';
    v_revision_id:=v_current_revision_id;
  end if;

  v_is_approved_public:=coalesce(
    v_asset_lifecycle='active'
    and v_public_safety_state in ('approved_public','approved_redacted')
    and v_rights_status in ('owned','licensed','public_domain','fair_use')
    and v_consent_status in ('granted','not_required')
    and v_source_protection_class in ('public','public_redacted')
    and v_retention_state in ('retain','review_required')
    and v_embargo_state<>'active'
    and not (
      v_embargo_state='scheduled'
      and v_embargo_until is not null
      and v_embargo_until>now()
    ),
    false
  );

  v_is_legacy_compatibility:=coalesce(
    v_asset_lifecycle='active'
    and v_governance_version_number=1
    and v_rights_status='unknown'
    and v_consent_status='unknown'
    and v_sensitivity='none'
    and v_embargo_state='none'
    and v_embargo_until is null
    and v_source_protection_class='internal'
    and v_preservation_state='unassessed'
    and v_retention_state='retain'
    and v_public_safety_state='internal'
    and v_internal_reason=
      'Initial governance copied without inference from registry_media_assets',
    false
  );

  if v_resolution_mode='legacy_snapshot' then
    if p_usage_link_id is null then
      raise exception 'Legacy-snapshot delivery requires a usage link';
    end if;
    if p_requested_variant_role is not null then
      raise exception 'Legacy-snapshot delivery cannot resolve a variant';
    end if;
    if v_revision_id is not null then
      raise exception 'Legacy-snapshot usage cannot bind a revision';
    end if;

    select bridge_row.legacy_snapshot,compatibility_row.status,compatibility_row.url
    into v_legacy_snapshot,v_compatibility_status,v_compatibility_url
    from media.legacy_asset_links bridge_row
    join public.registry_media_assets compatibility_row
      on compatibility_row.id=bridge_row.legacy_asset_id
    where bridge_row.asset_id=p_asset_id
      and bridge_row.legacy_asset_id=p_asset_id;

    if not found
       or nullif(btrim(v_legacy_snapshot->>'url'),'') is null
    then
      raise exception 'Legacy-snapshot delivery requires one immutable captured URL';
    end if;

    if v_compatibility_status<>'active' then
      raise exception 'Legacy Media compatibility row is not active';
    end if;

    if btrim(v_compatibility_url) is distinct from btrim(v_legacy_snapshot->>'url') then
      raise exception 'Legacy Media compatibility URL changed after capture';
    end if;

    if not (v_is_approved_public or v_is_legacy_compatibility) then
      raise exception 'Media delivery is blocked by current governance';
    end if;

    v_delivery_url:=btrim(v_legacy_snapshot->>'url');
    v_mime_type:=nullif(btrim(v_legacy_snapshot->>'mime_type'),'');
    v_width:=case
      when coalesce(v_legacy_snapshot#>>'{metadata,width}','') ~ '^[0-9]+$'
        then (v_legacy_snapshot#>>'{metadata,width}')::integer
      else null end;
    v_height:=case
      when coalesce(v_legacy_snapshot#>>'{metadata,height}','') ~ '^[0-9]+$'
        then (v_legacy_snapshot#>>'{metadata,height}')::integer
      else null end;
    v_duration:=case
      when coalesce(v_legacy_snapshot#>>'{metadata,duration}','') ~ '^[0-9]+([.][0-9]+)?$'
        then (v_legacy_snapshot#>>'{metadata,duration}')::numeric
      else null end;

    return query select
      p_asset_id,v_resolution_mode,null::uuid,null::uuid,
      v_delivery_url,v_mime_type,v_width,v_height,v_duration,
      v_alt_text,v_caption,v_credit;
    return;
  end if;

  if not v_is_approved_public then
    raise exception 'Media delivery is blocked by current governance';
  end if;

  if v_revision_id is null then
    raise exception 'Media delivery has no valid asset revision';
  end if;

  if not exists(
    select 1 from media.asset_revisions revision_row
    where revision_row.id=v_revision_id
      and revision_row.asset_id=p_asset_id
  ) then
    raise exception 'Media delivery revision does not belong to the asset';
  end if;

  if p_requested_variant_role is null then
    select revision_row.original_file_object_id
    into v_file_object_id
    from media.asset_revisions revision_row
    where revision_row.id=v_revision_id;
  else
    select variant_row.derived_file_object_id
    into v_file_object_id
    from media.variant_selections selection_row
    join media.variants variant_row on variant_row.id=selection_row.variant_id
    where selection_row.asset_revision_id=v_revision_id
      and selection_row.variant_role=p_requested_variant_role
      and variant_row.asset_revision_id=v_revision_id
      and variant_row.variant_role=p_requested_variant_role;

    if not found then
      raise exception 'Requested Media variant has no governed selection';
    end if;
  end if;

  perform messaging.assert_media_file_not_safety_contained_v1(v_file_object_id);

  select file_row.delivery_url,file_row.mime_type,file_row.technical_metadata
  into v_delivery_url,v_mime_type,v_technical_metadata
  from media.file_objects file_row
  where file_row.id=v_file_object_id
    and file_row.verification_state='verified';

  if not found or nullif(btrim(v_delivery_url),'') is null then
    raise exception 'Media delivery requires one verified file object with a safe URL';
  end if;

  v_width:=case
    when jsonb_typeof(v_technical_metadata->'width')='number'
      then (v_technical_metadata->>'width')::numeric::integer
    else null end;
  v_height:=case
    when jsonb_typeof(v_technical_metadata->'height')='number'
      then (v_technical_metadata->>'height')::numeric::integer
    else null end;
  v_duration:=case
    when jsonb_typeof(v_technical_metadata->'duration')='number'
      then (v_technical_metadata->>'duration')::numeric
    else null end;

  return query select
    p_asset_id,v_resolution_mode,v_revision_id,v_file_object_id,
    v_delivery_url,v_mime_type,v_width,v_height,v_duration,
    v_alt_text,v_caption,v_credit;
end;
$function$;

create or replace function audio.assert_publishable_version_media(
  p_version_id uuid
)
returns table(
  asset_id uuid,
  asset_revision_id uuid,
  delivery_variant_id uuid,
  delivery_url text,
  mime_type text,
  byte_size bigint,
  sha256 text,
  duration_seconds numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, audio, media, messaging
as $function$
declare
  v_version audio.publication_versions%rowtype;
begin
  select version.* into v_version
  from audio.publication_versions version
  where version.id=p_version_id;

  if not found
     or v_version.master_media_asset_id is null
     or v_version.master_media_revision_id is null
     or v_version.audio_delivery_variant_id is null
  then
    raise exception
      'Audio publication requires an exact master and full-length delivery before publication.';
  end if;

  return query
  select
    asset.id,
    revision.id,
    variant.id,
    file_object.delivery_url,
    file_object.mime_type,
    file_object.byte_size,
    file_object.sha256,
    nullif(
      file_object.technical_metadata#>>'{source_probe,duration_seconds}',
      ''
    )::numeric
  from media.assets asset
  join media.asset_revisions revision
    on revision.id=v_version.master_media_revision_id
   and revision.asset_id=asset.id
  join media.variants variant
    on variant.id=v_version.audio_delivery_variant_id
   and variant.asset_id=asset.id
   and variant.asset_revision_id=revision.id
   and variant.variant_role='audio_delivery'
  join media.file_objects file_object
    on file_object.id=variant.derived_file_object_id
  join media.asset_governance_versions governance
    on governance.id=asset.current_governance_version_id
   and governance.asset_id=asset.id
  where asset.id=v_version.master_media_asset_id
    and asset.asset_kind='audio'
    and asset.lifecycle_state='active'
    and file_object.verification_state='verified'
    and file_object.mime_type='audio/mpeg'
    and file_object.byte_size>0
    and file_object.sha256 ~ '^[0-9a-f]{64}$'
    and file_object.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
    and not messaging.media_file_is_safety_contained(file_object.id)
    and governance.public_safety_state in ('approved_public','approved_redacted')
    and governance.consent_status in ('granted','not_required')
    and governance.rights_status<>'restricted'
    and governance.embargo_state in ('none','released');

  if not found then
    raise exception
      'Audio publication Media is not approved for public delivery.';
  end if;

  if exists(
    select 1
    from (
      select file_object.id
      from media.variants variant
      join media.file_objects file_object
        on file_object.id=variant.derived_file_object_id
      where variant.asset_id=v_version.master_media_asset_id
        and variant.asset_revision_id=v_version.master_media_revision_id
        and variant.variant_role='waveform_data'
        and file_object.verification_state='verified'
        and file_object.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
      order by variant.created_at desc
      limit 1
    ) waveform
    where messaging.media_file_is_safety_contained(waveform.id)
  ) then
    raise exception
      'Audio publication waveform Media is blocked by current Safety containment.';
  end if;

  if v_version.transcript_media_asset_id is not null then
    if not exists(
      select 1
      from media.assets transcript_asset
      join media.asset_revisions transcript_revision
        on transcript_revision.id=v_version.transcript_media_revision_id
       and transcript_revision.asset_id=transcript_asset.id
      join media.file_objects transcript_file
        on transcript_file.id=transcript_revision.original_file_object_id
      join media.asset_governance_versions transcript_governance
        on transcript_governance.id=transcript_asset.current_governance_version_id
       and transcript_governance.asset_id=transcript_asset.id
      where transcript_asset.id=v_version.transcript_media_asset_id
        and transcript_asset.asset_kind='transcript'
        and transcript_asset.lifecycle_state='active'
        and transcript_file.verification_state='verified'
        and not messaging.media_file_is_safety_contained(transcript_file.id)
        and transcript_governance.public_safety_state in ('approved_public','approved_redacted')
        and transcript_governance.consent_status in ('granted','not_required')
        and transcript_governance.rights_status<>'restricted'
        and transcript_governance.embargo_state in ('none','released')
    ) then
      raise exception
        'Audio publication Transcript Media is not approved for public delivery.';
    end if;
  end if;
end;
$function$;

create or replace function video.assert_publishable_media_revision(
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_expected_asset_kind text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, media, messaging
as $function$
declare
  v_asset_kind text;
  v_asset_state text;
  v_revision_asset_id uuid;
  v_file_object_id uuid;
  v_verification_state text;
  v_rights_status text;
  v_consent_status text;
  v_embargo_state text;
  v_embargo_until timestamptz;
  v_source_protection_class text;
  v_retention_state text;
  v_public_safety_state text;
begin
  select
    asset.asset_kind,
    asset.lifecycle_state,
    governance.rights_status,
    governance.consent_status,
    governance.embargo_state,
    governance.embargo_until,
    governance.source_protection_class,
    governance.retention_state,
    governance.public_safety_state
  into
    v_asset_kind,
    v_asset_state,
    v_rights_status,
    v_consent_status,
    v_embargo_state,
    v_embargo_until,
    v_source_protection_class,
    v_retention_state,
    v_public_safety_state
  from media.assets asset
  join media.asset_governance_versions governance
    on governance.id=asset.current_governance_version_id
   and governance.asset_id=asset.id
  where asset.id=p_asset_id;

  select
    revision.asset_id,
    revision.original_file_object_id,
    file_row.verification_state
  into
    v_revision_asset_id,
    v_file_object_id,
    v_verification_state
  from media.asset_revisions revision
  join media.file_objects file_row
    on file_row.id=revision.original_file_object_id
  where revision.id=p_asset_revision_id;

  if v_asset_kind is distinct from p_expected_asset_kind
     or v_asset_state<>'active'
     or v_revision_asset_id is distinct from p_asset_id
     or v_verification_state<>'verified'
     or messaging.media_file_is_safety_contained(v_file_object_id)
     or v_public_safety_state not in ('approved_public','approved_redacted')
     or v_rights_status not in ('owned','licensed','public_domain','fair_use')
     or v_consent_status not in ('granted','not_required')
     or v_source_protection_class not in ('public','public_redacted')
     or v_retention_state not in ('retain','review_required')
     or v_embargo_state='active'
     or (
       v_embargo_state='scheduled'
       and v_embargo_until is not null
       and v_embargo_until>now()
     )
  then
    raise exception
      'Current Media governance or Safety containment does not permit this Video version Media revision.';
  end if;
end;
$function$;

create or replace function video.assert_publishable_publication_version(
  p_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, video, media, messaging
as $function$
declare
  v_version video.publication_versions%rowtype;
  v_source video.sources%rowtype;
  v_master_count bigint;
  v_candidate_file_id uuid;
begin
  select version_row.* into v_version
  from video.publication_versions version_row
  where version_row.id=p_version_id;

  if not found then
    raise exception 'Video publication version does not exist.';
  end if;

  select source.* into v_source
  from video.sources source
  where source.id=v_version.source_id;

  if not found then
    raise exception 'Video publication version source does not exist.';
  end if;

  if v_source.source_kind='native_media' then
    perform video.assert_publishable_media_revision(
      v_source.media_asset_id,
      v_source.media_asset_revision_id,
      'video'
    );

    select count(*) into v_master_count
    from media.usage_links usage
    where usage.target_authority='video'
      and usage.target_kind='video_publication'
      and usage.target_id=v_version.publication_id
      and usage.target_version_kind='video_publication_version'
      and usage.target_version_id=v_version.id
      and usage.usage_role='video_master'
      and usage.usage_state='active'
      and usage.resolution_mode='exact_revision'
      and usage.asset_id=v_source.media_asset_id
      and usage.asset_revision_id=v_source.media_asset_revision_id;

    if v_master_count<>1 then
      raise exception
        'Publishable native Video version requires one exact version-bound video_master usage.';
    end if;

    select file_row.id into v_candidate_file_id
    from media.variants variant_row
    join media.file_objects file_row
      on file_row.id=variant_row.derived_file_object_id
     and file_row.verification_state='verified'
     and file_row.mime_type='video/mp4'
     and file_row.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
    where variant_row.asset_id=v_source.media_asset_id
      and variant_row.asset_revision_id=v_source.media_asset_revision_id
      and variant_row.variant_role='video_transcode'
    order by variant_row.created_at desc
    limit 1;

    if v_candidate_file_id is not null then
      perform messaging.assert_media_file_not_safety_contained_v1(v_candidate_file_id);
    end if;

    if exists(
      select 1
      from media.variant_selections selection_row
      join media.variants variant_row
        on variant_row.id=selection_row.variant_id
       and variant_row.asset_revision_id=selection_row.asset_revision_id
       and variant_row.variant_role=selection_row.variant_role
      join media.file_objects file_row
        on file_row.id=variant_row.derived_file_object_id
      where selection_row.asset_revision_id=v_source.media_asset_revision_id
        and selection_row.variant_role in (
          'video_hls_master',
          'video_hls_360p_playlist',
          'video_hls_360p_media',
          'video_hls_720p_playlist',
          'video_hls_720p_media'
        )
        and file_row.verification_state='verified'
        and messaging.media_file_is_safety_contained(file_row.id)
    ) then
      raise exception
        'Video adaptive delivery is blocked by current Safety containment.';
    end if;

    if not exists(
      select 1
      from media.usage_links usage
      where usage.target_authority='video'
        and usage.target_kind='video_publication'
        and usage.target_id=v_version.publication_id
        and usage.target_version_kind='video_publication_version'
        and usage.target_version_id=v_version.id
        and usage.usage_role='video_poster'
        and usage.usage_state='active'
    ) then
      select file_row.id into v_candidate_file_id
      from media.variants variant_row
      join media.file_objects file_row
        on file_row.id=variant_row.derived_file_object_id
       and file_row.verification_state='verified'
       and file_row.mime_type like 'image/%'
       and file_row.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
      where variant_row.asset_id=v_source.media_asset_id
        and variant_row.asset_revision_id=v_source.media_asset_revision_id
        and variant_row.variant_role='poster_frame'
      order by variant_row.created_at desc
      limit 1;

      if v_candidate_file_id is not null then
        perform messaging.assert_media_file_not_safety_contained_v1(v_candidate_file_id);
      end if;
    end if;
  else
    if not exists(
      select 1
      from video.source_providers provider
      where provider.provider_key=v_source.provider_key
        and provider.enabled
    ) then
      raise exception
        'Video provider is disabled or unavailable for publication.';
    end if;

    if exists(
      select 1
      from media.usage_links usage
      where usage.target_authority='video'
        and usage.target_kind='video_publication'
        and usage.target_id=v_version.publication_id
        and usage.target_version_kind='video_publication_version'
        and usage.target_version_id=v_version.id
        and usage.usage_role='video_master'
        and usage.usage_state='active'
    ) then
      raise exception
        'Provider-backed Video version cannot carry native video_master usage.';
    end if;
  end if;

  if exists(
    select 1
    from media.usage_links usage
    join media.assets asset on asset.id=usage.asset_id
    where usage.target_authority='video'
      and usage.target_kind='video_publication'
      and usage.target_id=v_version.publication_id
      and usage.target_version_kind='video_publication_version'
      and usage.target_version_id=v_version.id
      and usage.usage_state='active'
      and (
        usage.resolution_mode<>'exact_revision'
        or usage.asset_revision_id is null
        or (usage.usage_role='video_poster' and asset.asset_kind<>'image')
        or (usage.usage_role='video_caption' and asset.asset_kind<>'caption')
        or (usage.usage_role='video_transcript' and asset.asset_kind<>'transcript')
        or (usage.usage_role='video_master' and asset.asset_kind<>'video')
      )
  ) then
    raise exception
      'Video version Media usage is not publishable exact-revision authority.';
  end if;

  perform video.assert_publishable_media_revision(
    usage.asset_id,
    usage.asset_revision_id,
    asset.asset_kind
  )
  from media.usage_links usage
  join media.assets asset on asset.id=usage.asset_id
  where usage.target_authority='video'
    and usage.target_kind='video_publication'
    and usage.target_id=v_version.publication_id
    and usage.target_version_kind='video_publication_version'
    and usage.target_version_id=v_version.id
    and usage.usage_state='active';
end;
$function$;

create or replace function public.get_public_video_caption_delivery_target(
  p_publication_version_id uuid,
  p_track_number integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, video, media, messaging
as $function$
declare
  v_version video.publication_versions%rowtype;
  v_file media.file_objects%rowtype;
  v_track video.publication_version_caption_tracks%rowtype;
begin
  if p_publication_version_id is null
     or p_track_number is null
     or p_track_number<1
  then
    return null;
  end if;

  select version_row.* into v_version
  from video.publication_versions version_row
  join editorial.video_publication_resources binding_row
    on binding_row.publication_id=version_row.publication_id
   and binding_row.resource_id=version_row.resource_id
  join editorial.resources resource_row
    on resource_row.id=binding_row.resource_id
   and resource_row.resource_kind=binding_row.resource_kind
   and resource_row.lifecycle_state='published'
   and resource_row.visibility='public'
   and resource_row.current_published_version_id=version_row.id
  where version_row.id=p_publication_version_id
    and version_row.version_kind='published';

  if not found then return null; end if;

  begin
    perform video.assert_publishable_publication_version(v_version.id);
  exception when others then
    return null;
  end;

  select track_row.* into v_track
  from video.publication_version_caption_tracks track_row
  where track_row.publication_version_id=v_version.id
    and track_row.track_number=p_track_number;

  if not found then return null; end if;

  if not exists(
    select 1
    from media.usage_links usage_row
    where usage_row.target_authority='video'
      and usage_row.target_kind='video_publication'
      and usage_row.target_id=v_version.publication_id
      and usage_row.target_version_kind='video_publication_version'
      and usage_row.target_version_id=v_version.id
      and usage_row.usage_role='video_caption'
      and usage_row.usage_state='active'
      and usage_row.resolution_mode='exact_revision'
      and usage_row.asset_id=v_track.media_asset_id
      and usage_row.asset_revision_id=v_track.media_asset_revision_id
  ) then
    return null;
  end if;

  select file_row.* into v_file
  from media.asset_revisions revision_row
  join media.file_objects file_row
    on file_row.id=revision_row.original_file_object_id
  where revision_row.id=v_track.media_asset_revision_id
    and revision_row.asset_id=v_track.media_asset_id
    and file_row.verification_state='verified'
    and file_row.storage_provider='lightsail_media'
    and file_row.storage_path ~ '^private-files/captions/.+[.]vtt$'
    and file_row.mime_type='text/vtt';

  if not found
     or messaging.media_file_is_safety_contained(v_file.id)
  then
    return null;
  end if;

  return jsonb_build_object(
    'publication_version_id',v_version.id,
    'track_number',v_track.track_number,
    'language_tag',v_track.language_tag,
    'track_kind',v_track.track_kind,
    'label',v_track.label,
    'is_default',v_track.is_default,
    'file_object_id',v_file.id,
    'storage_path',v_file.storage_path,
    'mime_type',v_file.mime_type,
    'byte_size',v_file.byte_size,
    'sha256',v_file.sha256
  );
end;
$function$;

create or replace function public.get_public_video_transcript_delivery_target(
  p_publication_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, video, media, messaging
as $function$
declare
  v_version video.publication_versions%rowtype;
  v_usage media.usage_links%rowtype;
  v_file media.file_objects%rowtype;
begin
  if p_publication_version_id is null then return null; end if;

  select version_row.* into v_version
  from video.publication_versions version_row
  join editorial.video_publication_resources binding_row
    on binding_row.publication_id=version_row.publication_id
   and binding_row.resource_id=version_row.resource_id
  join editorial.resources resource_row
    on resource_row.id=binding_row.resource_id
   and resource_row.resource_kind=binding_row.resource_kind
   and resource_row.lifecycle_state='published'
   and resource_row.visibility='public'
   and resource_row.current_published_version_id=version_row.id
  where version_row.id=p_publication_version_id
    and version_row.version_kind='published';

  if not found then return null; end if;

  begin
    perform video.assert_publishable_publication_version(v_version.id);
  exception when others then
    return null;
  end;

  select usage_row.* into v_usage
  from media.usage_links usage_row
  join media.assets asset_row
    on asset_row.id=usage_row.asset_id
   and asset_row.asset_kind='transcript'
   and asset_row.lifecycle_state='active'
  where usage_row.target_authority='video'
    and usage_row.target_kind='video_publication'
    and usage_row.target_id=v_version.publication_id
    and usage_row.target_version_kind='video_publication_version'
    and usage_row.target_version_id=v_version.id
    and usage_row.usage_role='video_transcript'
    and usage_row.usage_state='active'
    and usage_row.resolution_mode='exact_revision'
  order by usage_row.display_order,usage_row.created_at
  limit 1;

  if not found then return null; end if;

  select file_row.* into v_file
  from media.asset_revisions revision_row
  join media.file_objects file_row
    on file_row.id=revision_row.original_file_object_id
  where revision_row.id=v_usage.asset_revision_id
    and revision_row.asset_id=v_usage.asset_id
    and file_row.verification_state='verified'
    and file_row.storage_provider='lightsail_media'
    and file_row.storage_path ~ '^private-files/transcripts/.+[.]txt$'
    and file_row.mime_type='text/plain';

  if not found
     or messaging.media_file_is_safety_contained(v_file.id)
  then
    return null;
  end if;

  return jsonb_build_object(
    'publication_version_id',v_version.id,
    'asset_id',v_usage.asset_id,
    'asset_revision_id',v_usage.asset_revision_id,
    'file_object_id',v_file.id,
    'storage_path',v_file.storage_path,
    'mime_type',v_file.mime_type,
    'byte_size',v_file.byte_size,
    'sha256',v_file.sha256
  );
end;
$function$;

create or replace function editorial.playlist_publication_payload_safety_v1(
  p_version_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, media, messaging
as $function$
declare
  v_version editorial.playlist_versions%rowtype;
  v_delivery record;
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
  select version_row.* into v_version
  from editorial.playlist_versions version_row
  where version_row.id=p_version_id;

  if not found or v_version.cover_asset_id is null then
    return v_payload;
  end if;

  begin
    select * into v_delivery
    from public.resolve_media_asset_delivery(
      v_version.cover_asset_id,
      null,
      v_version.cover_asset_revision_id,
      null
    );

    if v_delivery.safe_delivery_url is null then
      return jsonb_set(v_payload,'{cover,url}','null'::jsonb,true);
    end if;

    return jsonb_set(
      v_payload,
      '{cover,url}',
      to_jsonb(v_delivery.safe_delivery_url),
      true
    );
  exception when others then
    return jsonb_set(v_payload,'{cover,url}','null'::jsonb,true);
  end;
end;
$function$;

revoke all on function editorial.playlist_publication_payload_safety_v1(uuid,jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.list_public_playlists(
  p_limit integer default 24,
  p_before_published_at timestamptz default null,
  p_before_snapshot_id uuid default null
)
returns table(
  snapshot_id uuid,
  playlist_id uuid,
  resource_id uuid,
  version_id uuid,
  slug text,
  title text,
  description text,
  curator_label text,
  cover_url text,
  cover_alt_text text,
  item_count integer,
  published_at timestamptz,
  first_published_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, editorial
as $function$
  select
    snapshot.id,
    snapshot.playlist_id,
    snapshot.resource_id,
    snapshot.version_id,
    snapshot.slug,
    snapshot.title,
    snapshot.description,
    snapshot.curator_label,
    editorial.playlist_publication_payload_safety_v1(
      snapshot.version_id,
      snapshot.payload
    ) #>> '{cover,url}',
    snapshot.cover_alt_text,
    snapshot.item_count,
    snapshot.published_at,
    snapshot.first_published_at
  from editorial.playlist_publication_snapshots snapshot
  join editorial.playlist_resources binding
    on binding.resource_id=snapshot.resource_id
   and binding.playlist_id=snapshot.playlist_id
  join editorial.resources resource
    on resource.id=binding.resource_id
   and resource.current_published_version_id=snapshot.version_id
  where (
    p_before_published_at is null
    or (snapshot.published_at,snapshot.id)<(
      p_before_published_at,
      coalesce(
        p_before_snapshot_id,
        'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
      )
    )
  )
  order by snapshot.published_at desc,snapshot.id desc
  limit least(greatest(coalesce(p_limit,24),1),50)
$function$;

create or replace function public.get_public_playlist(
  p_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  with active_snapshot as (
    select snapshot.*
    from editorial.playlist_publication_snapshots snapshot
    join editorial.playlist_resources binding
      on binding.resource_id=snapshot.resource_id
     and binding.playlist_id=snapshot.playlist_id
    join editorial.resources resource
      on resource.id=binding.resource_id
     and resource.current_published_version_id=snapshot.version_id
    where snapshot.slug=p_slug
    order by snapshot.published_at desc
    limit 1
  )
  select
    editorial.playlist_publication_payload_safety_v1(
      snapshot.version_id,
      snapshot.payload
    )
    || jsonb_build_object(
      'credits',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'resource_id',attachment.resource_id,
            'resource_kind',attachment.resource_kind,
            'display_order',attachment.display_order,
            'is_primary',attachment.is_primary,
            'credit_id',credit.id,
            'role',credit.credit_role,
            'role_label',credit.role_label_snapshot,
            'display_name',credit.display_name_snapshot,
            'note',credit.credit_note,
            'author_slug',credit.registry_author_slug_snapshot,
            'username',credit.user_username_snapshot
          )
          order by attachment.resource_kind,attachment.resource_id,attachment.display_order
        )
        from editorial.resource_credits attachment
        join editorial.credits credit on credit.id=attachment.credit_id
        join editorial.credit_governance governance on governance.credit_id=credit.id
        left join editorial.external_contributors contributor
          on contributor.id=credit.external_contributor_id
        where attachment.target_version_type='playlist_version'
          and attachment.target_version_id=snapshot.version_id
          and attachment.public_safe
          and governance.public_safe
          and governance.credit_state='active'
          and (
            credit.external_contributor_id is null
            or (
              contributor.contributor_state='active'
              and contributor.public_safe
              and contributor.consent_status in ('granted','not_required')
            )
          )
      ),'[]'::jsonb),
      'citations',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'resource_id',attachment.resource_id,
            'resource_kind',attachment.resource_kind,
            'display_order',attachment.display_order,
            'purpose',attachment.citation_purpose,
            'anchor_type',attachment.target_anchor_type,
            'anchor',attachment.target_anchor_data,
            'citation_id',citation.id,
            'public_label',citation.public_label,
            'locator_type',citation.locator_type,
            'locator',citation.locator_data,
            'source',jsonb_build_object(
              'source_id',source.id,
              'source_version_id',source_version.id,
              'type',source_version.source_type,
              'title',source_version.title,
              'creator',source_version.creator_display,
              'publisher',source_version.publisher_display,
              'url',case
                when source.exposure_class='public' then source_version.source_url
                else null
              end,
              'publication_date',source_version.publication_date,
              'credit_line',source_version.credit_line
            )
          )
          order by attachment.resource_kind,attachment.resource_id,attachment.display_order
        )
        from editorial.resource_citations attachment
        join editorial.citations citation on citation.id=attachment.citation_id
        join editorial.source_versions source_version
          on source_version.id=citation.source_version_id
        join editorial.sources source on source.id=citation.source_id
        where attachment.target_version_type='playlist_version'
          and attachment.target_version_id=snapshot.version_id
          and attachment.public_safe
          and citation.public_safe
          and citation.citation_state='active'
          and source.source_state='active'
          and source.withdrawn_at is null
          and source.exposure_class in ('public','public_redacted')
          and source.current_approved_version_id=citation.source_version_id
      ),'[]'::jsonb),
      'corrections',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',note.id,
            'resource_id',note.affected_resource_id,
            'resource_kind',note.affected_resource_kind,
            'note',note.note_text,
            'published_at',note.published_at
          ) order by note.published_at
        )
        from editorial.correction_public_notes note
        where (
          note.affected_resource_id=snapshot.resource_id
          or note.affected_resource_id in (
            select nullif(track->>'playlist_item_resource_id','')::uuid
            from jsonb_array_elements(snapshot.payload->'tracks') track
          )
        )
        and not exists(
          select 1
          from editorial.correction_public_notes newer
          where newer.supersedes_note_id=note.id
        )
      ),'[]'::jsonb)
    )
  from active_snapshot snapshot
$function$;

create or replace function public.get_playlist_current_cover(
  p_playlist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, media
as $function$
declare
  v_binding editorial.playlist_resources%rowtype;
  v_usage media.usage_links%rowtype;
  v_delivery record;
  v_url text;
begin
  select * into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id=p_playlist_id;

  if not found then
    raise exception using errcode='P0002',message='Playlist was not found.';
  end if;

  if not coalesce(
    editorial.current_user_can_view_playlist(v_binding.resource_id),
    false
  ) then
    raise exception using errcode='42501',message='You do not have permission to view this Playlist.';
  end if;

  select usage.* into v_usage
  from media.usage_links usage
  where usage.target_authority='editorial'
    and usage.target_kind='playlist'
    and usage.target_id=p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role='playlist_cover'
    and usage.usage_state='active';

  if not found then
    return jsonb_build_object(
      'playlist_id',p_playlist_id,
      'resource_id',v_binding.resource_id,
      'cover',null
    );
  end if;

  begin
    select * into v_delivery
    from public.resolve_media_asset_delivery(
      v_usage.asset_id,
      v_usage.id,
      null,
      null
    );
    v_url:=v_delivery.safe_delivery_url;
  exception when others then
    v_url:=null;
  end;

  return jsonb_build_object(
    'playlist_id',p_playlist_id,
    'resource_id',v_binding.resource_id,
    'cover',jsonb_build_object(
      'usage_link_id',v_usage.id,
      'usage_revision',v_usage.usage_revision,
      'asset_id',v_usage.asset_id,
      'asset_revision_id',v_usage.asset_revision_id,
      'resolution_mode',v_usage.resolution_mode,
      'url',v_url,
      'placement_data',v_usage.placement_data,
      'alt_text',v_usage.alt_text_snapshot,
      'caption',v_usage.caption_snapshot,
      'credit',v_usage.credit_snapshot
    )
  );
end;
$function$;

create or replace function public.get_playlist_cover_source(
  p_playlist_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, media, messaging
as $function$
declare
  v_asset media.assets%rowtype;
  v_file media.file_objects%rowtype;
  v_compatibility public.registry_media_assets%rowtype;
begin
  if not public.current_user_can_edit_playlist_id(p_playlist_id) then
    raise exception using errcode='42501',message='Playlist edit permission is required.';
  end if;

  select asset.* into v_asset
  from media.assets asset
  where asset.id=p_asset_id
    and asset.lifecycle_state='active';

  if not found or v_asset.current_revision_id is null then
    raise exception 'Selected Media image is unavailable.';
  end if;

  select file_object.* into v_file
  from media.asset_revisions revision
  join media.file_objects file_object
    on file_object.id=revision.original_file_object_id
  where revision.id=v_asset.current_revision_id
    and revision.asset_id=p_asset_id
    and file_object.verification_state='verified'
    and lower(coalesce(file_object.mime_type,'')) like 'image/%';

  if not found
     or nullif(btrim(v_file.delivery_url),'') is null
     or messaging.media_file_is_safety_contained(v_file.id)
  then
    raise exception 'Selected Media item does not have a reachable safe verified image.';
  end if;

  select compatibility.* into v_compatibility
  from public.registry_media_assets compatibility
  where compatibility.id=p_asset_id;

  return jsonb_build_object(
    'asset_id',p_asset_id,
    'asset_revision_id',v_asset.current_revision_id,
    'url',v_file.delivery_url,
    'mime_type',v_file.mime_type,
    'title',coalesce(v_compatibility.title,'Playlist cover source')
  );
end;
$function$;

-- Browser/editorial Media projections are delivery-capable and must not expose
-- exact files while canonical Safety containment is effective.
create or replace function audio.publication_version_review_media(
  p_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, audio, media, messaging
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
  where version.id=p_version_id;

  if not found then
    raise exception 'Audio review target version does not exist';
  end if;

  if v_version.audio_delivery_variant_id is not null then
    select
      case
        when messaging.media_file_is_safety_contained(derived.id)
          then null
        else derived.delivery_url
      end,
      derived.technical_metadata->'source_probe'
    into v_delivery_url,v_source_probe
    from media.variants variant
    join media.file_objects derived
      on derived.id=variant.derived_file_object_id
    where variant.id=v_version.audio_delivery_variant_id;
  end if;

  if v_version.master_media_revision_id is not null then
    select
      case
        when messaging.media_file_is_safety_contained(derived.id)
          then null
        else derived.delivery_url
      end
    into v_waveform_url
    from media.variant_selections selection
    join media.variants variant
      on variant.id=selection.variant_id
    join media.file_objects derived
      on derived.id=variant.derived_file_object_id
    where selection.asset_revision_id=v_version.master_media_revision_id
      and selection.variant_role='waveform_data'
    limit 1;
  end if;

  v_duration:=nullif(v_source_probe->>'duration_seconds','')::numeric;

  return jsonb_build_object(
    'delivery_url',v_delivery_url,
    'waveform_url',v_waveform_url,
    'duration_seconds',v_duration,
    'source_probe',coalesce(v_source_probe,'{}'::jsonb)
  );
end;
$function$;

create or replace function public.get_audio_editorial_media_context(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, audio, media, messaging
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
  where binding.publication_id=p_publication_id;

  if not found then
    raise exception 'Audio publication Resource binding does not exist';
  end if;

  if not (
    coalesce(public.current_user_has_capability('view_audio'),false)
    or coalesce(editorial.current_user_can_edit_audio(v_binding.resource_id),false)
  ) then
    raise exception using
      errcode='42501',
      message='Audio access is required.';
  end if;

  select
    master.asset_id,
    master.asset_revision_id,
    master.audio_delivery_variant_id
  into v_asset_id,v_revision_id,v_delivery_variant_id
  from audio.current_publication_master(p_publication_id) master;

  if v_asset_id is null or v_revision_id is null then
    return jsonb_build_object(
      'asset_id',null,
      'asset_revision_id',null,
      'audio_delivery_variant_id',null,
      'delivery_url',null,
      'preview_url',null,
      'waveform_url',null,
      'duration_seconds',null,
      'source_probe','{}'::jsonb
    );
  end if;

  if v_delivery_variant_id is not null then
    select
      case
        when messaging.media_file_is_safety_contained(derived.id)
          then null
        else derived.delivery_url
      end,
      derived.technical_metadata->'source_probe'
    into v_delivery_url,v_source_probe
    from media.variants variant
    join media.file_objects derived
      on derived.id=variant.derived_file_object_id
    where variant.id=v_delivery_variant_id;
  end if;

  select
    max(
      case
        when selection.variant_role='audio_preview'
         and not messaging.media_file_is_safety_contained(derived.id)
          then derived.delivery_url
        else null
      end
    ),
    max(
      case
        when selection.variant_role='waveform_data'
         and not messaging.media_file_is_safety_contained(derived.id)
          then derived.delivery_url
        else null
      end
    ),
    coalesce(
      v_source_probe,
      (
        max(derived.technical_metadata->>'source_probe')
          filter (where selection.variant_role='waveform_data')
      )::jsonb
    )
  into v_preview_url,v_waveform_url,v_source_probe
  from media.variant_selections selection
  join media.variants variant
    on variant.id=selection.variant_id
  join media.file_objects derived
    on derived.id=variant.derived_file_object_id
  where selection.asset_revision_id=v_revision_id
    and selection.variant_role in ('audio_preview','waveform_data');

  v_duration:=nullif(v_source_probe->>'duration_seconds','')::numeric;

  return jsonb_build_object(
    'asset_id',v_asset_id,
    'asset_revision_id',v_revision_id,
    'audio_delivery_variant_id',v_delivery_variant_id,
    'delivery_url',v_delivery_url,
    'preview_url',v_preview_url,
    'waveform_url',v_waveform_url,
    'duration_seconds',v_duration,
    'source_probe',coalesce(v_source_probe,'{}'::jsonb)
  );
end;
$function$;

create or replace function public.get_media_asset_v2(
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth, messaging
as $function$
declare
  v_can_review boolean;
  v_result jsonb;
begin
  perform media.require_media_read_actor();

  v_can_review:=
    public.current_user_has_capability('review_media_governance')
    or public.current_user_is_administrator();

  select jsonb_build_object(
    'asset',
    jsonb_build_object(
      'id',asset_row.id,
      'asset_kind',asset_row.asset_kind,
      'asset_purpose',asset_row.asset_purpose,
      'title',asset_row.title,
      'lifecycle_state',asset_row.lifecycle_state,
      'authority_revision',asset_row.authority_revision,
      'current_revision_id',asset_row.current_revision_id,
      'current_governance_version_id',asset_row.current_governance_version_id,
      'created_at',asset_row.created_at,
      'updated_at',asset_row.updated_at
    ),
    'revisions',(
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',revision_row.id,
            'revision_number',revision_row.revision_number,
            'previous_revision_id',revision_row.previous_revision_id,
            'replacement_reason',revision_row.replacement_reason,
            'created_by',revision_row.created_by,
            'created_at',revision_row.created_at,
            'file_object',jsonb_build_object(
              'id',file_row.id,
              'verification_state',file_row.verification_state,
              'sha256',file_row.sha256,
              'byte_size',file_row.byte_size,
              'mime_type',file_row.mime_type,
              'delivery_url',case
                when file_row.verification_state='verified'
                 and not messaging.media_file_is_safety_contained(file_row.id)
                  then file_row.delivery_url
                else null
              end,
              'technical_metadata',file_row.technical_metadata
            )
          )
          order by revision_row.revision_number
        ),
        '[]'::jsonb
      )
      from media.asset_revisions revision_row
      join media.file_objects file_row
        on file_row.id=revision_row.original_file_object_id
      where revision_row.asset_id=asset_row.id
    ),
    'variants',(
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',variant_row.id,
            'asset_revision_id',variant_row.asset_revision_id,
            'variant_role',variant_row.variant_role,
            'source_file_object_id',variant_row.source_file_object_id,
            'derived_file_object_id',variant_row.derived_file_object_id,
            'transformation_spec',variant_row.transformation_spec,
            'technical_metadata',variant_row.technical_metadata,
            'generator_name',variant_row.generator_name,
            'generator_version',variant_row.generator_version,
            'created_at',variant_row.created_at,
            'selection_revision',selection_row.selection_revision,
            'is_selected',selection_row.variant_id=variant_row.id
          )
          order by
            variant_row.asset_revision_id,
            variant_row.variant_role,
            variant_row.created_at,
            variant_row.id
        ),
        '[]'::jsonb
      )
      from media.variants variant_row
      left join media.variant_selections selection_row
        on selection_row.asset_revision_id=variant_row.asset_revision_id
       and selection_row.variant_role=variant_row.variant_role
      where variant_row.asset_id=asset_row.id
    ),
    'usages',(
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',usage_row.id,
            'asset_revision_id',usage_row.asset_revision_id,
            'resolution_mode',usage_row.resolution_mode,
            'target_authority',usage_row.target_authority,
            'target_kind',usage_row.target_kind,
            'target_id',usage_row.target_id,
            'target_version_kind',usage_row.target_version_kind,
            'target_version_id',usage_row.target_version_id,
            'usage_role',usage_row.usage_role,
            'placement_data',usage_row.placement_data,
            'display_order',usage_row.display_order,
            'alt_text_snapshot',usage_row.alt_text_snapshot,
            'caption_snapshot',usage_row.caption_snapshot,
            'credit_snapshot',usage_row.credit_snapshot,
            'usage_state',usage_row.usage_state,
            'usage_revision',usage_row.usage_revision,
            'state_reason',usage_row.state_reason,
            'state_changed_at',usage_row.state_changed_at,
            'created_at',usage_row.created_at,
            'updated_at',usage_row.updated_at
          )
          order by usage_row.created_at,usage_row.id
        ),
        '[]'::jsonb
      )
      from media.usage_links usage_row
      where usage_row.asset_id=asset_row.id
    ),
    'governance_history',(
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',governance_history.id,
            'version_number',governance_history.version_number,
            'rights_status',governance_history.rights_status,
            'consent_status',governance_history.consent_status,
            'sensitivity',governance_history.sensitivity,
            'embargo_state',governance_history.embargo_state,
            'embargo_until',governance_history.embargo_until,
            'source_protection_class',governance_history.source_protection_class,
            'preservation_state',governance_history.preservation_state,
            'retention_state',governance_history.retention_state,
            'public_safety_state',governance_history.public_safety_state,
            'internal_reason',case
              when v_can_review then governance_history.internal_reason
              else null
            end,
            'created_by',governance_history.created_by,
            'created_at',governance_history.created_at
          )
          order by governance_history.version_number
        ),
        '[]'::jsonb
      )
      from media.asset_governance_versions governance_history
      where governance_history.asset_id=asset_row.id
    ),
    'compatibility',(
      select jsonb_build_object(
        'legacy_asset_id',bridge_row.legacy_asset_id,
        'mapped',true,
        'snapshot_fingerprint',md5(bridge_row.legacy_snapshot::text),
        'created_at',bridge_row.created_at
      )
      from media.legacy_asset_links bridge_row
      where bridge_row.asset_id=asset_row.id
    ),
    'events',(
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',event_row.id,
            'event_type',event_row.event_type,
            'file_object_id',event_row.file_object_id,
            'asset_revision_id',event_row.asset_revision_id,
            'variant_id',event_row.variant_id,
            'usage_link_id',event_row.usage_link_id,
            'governance_version_id',event_row.governance_version_id,
            'actor_id',event_row.actor_id,
            'reason',event_row.reason,
            'correlation_id',event_row.correlation_id,
            'created_at',event_row.created_at
          )
          order by event_row.created_at,event_row.id
        ),
        '[]'::jsonb
      )
      from media.events event_row
      where event_row.asset_id=asset_row.id
    )
  )
  into v_result
  from media.assets asset_row
  where asset_row.id=p_asset_id;

  if v_result is null then
    raise exception 'Media asset does not exist';
  end if;

  return v_result;
end;
$function$;

create or replace function public.read_media_assets_admin_v2(
  p_query jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, media, auth, messaging, platform_private
as $function$
declare
  v_base jsonb;
  v_items jsonb;
begin
  perform media.require_media_read_actor();

  v_base:=media.read_media_assets_admin_phase4a_v2(p_query);

  select coalesce(
    jsonb_agg(enriched.item order by enriched.ordinality),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      source.ordinality,
      source.item
      || jsonb_build_object(
        'url',case
          when revision.original_file_object_id is not null
           and messaging.media_file_is_safety_contained(
             revision.original_file_object_id
           )
            then null
          else source.item->>'url'
        end,
        'current_file_object_id',revision.original_file_object_id,
        'upload_session_id',upload_session.id,
        'upload_session_state',upload_session.state,
        'processing_job_id',processing_job.id,
        'processing_job_status',processing_job.status,
        'processing_attempt_count',processing_job.attempt_count,
        'processing_max_attempts',processing_job.max_attempts,
        'processing_last_error',processing_job.last_error,
        'processing_profile_version',processing_job.input_payload->>'profile_version',
        'selected_derivatives',coalesce(derivative_selection.items,'{}'::jsonb),
        'primary_delivery_url',case
          when coalesce(source.item->>'file_kind',source.item->>'media_kind')='audio'
            then derivative_selection.items->'audio_preview'->>'url'
          when coalesce(source.item->>'file_kind',source.item->>'media_kind')='video'
            then derivative_selection.items->'video_transcode'->>'url'
          when revision.original_file_object_id is not null
           and messaging.media_file_is_safety_contained(
             revision.original_file_object_id
           )
            then null
          else source.item->>'url'
        end,
        'delivery_ready',case
          when coalesce(source.item->>'file_kind',source.item->>'media_kind')='audio'
            then coalesce(derivative_selection.items,'{}'::jsonb)?'audio_preview'
             and coalesce(derivative_selection.items,'{}'::jsonb)?'waveform_data'
          when coalesce(source.item->>'file_kind',source.item->>'media_kind')='video'
            then coalesce(derivative_selection.items,'{}'::jsonb)?'video_transcode'
             and coalesce(derivative_selection.items,'{}'::jsonb)?'poster_frame'
             and coalesce(derivative_selection.items,'{}'::jsonb)?'thumbnail'
          when revision.original_file_object_id is not null
           and messaging.media_file_is_safety_contained(
             revision.original_file_object_id
           )
            then false
          else nullif(source.item->>'url','') is not null
        end
      ) as item
    from jsonb_array_elements(coalesce(v_base->'items','[]'::jsonb))
      with ordinality as source(item,ordinality)
    left join media.assets asset
      on asset.id=nullif(source.item->>'canonical_asset_id','')::uuid
    left join media.asset_revisions revision
      on revision.id=asset.current_revision_id
    left join lateral (
      select session_row.*
      from media.upload_sessions session_row
      where session_row.file_object_id=revision.original_file_object_id
      order by session_row.created_at desc
      limit 1
    ) upload_session on true
    left join lateral (
      select job_row.*
      from platform_private.jobs job_row
      where job_row.command_type='media.process_revision'
        and job_row.resource_id=asset.id
        and job_row.input_payload->>'asset_revision_id'=asset.current_revision_id::text
      order by job_row.created_at desc
      limit 1
    ) processing_job on true
    left join lateral (
      select coalesce(
        jsonb_object_agg(
          selection.variant_role,
          jsonb_build_object(
            'variant_id',variant.id,
            'file_object_id',file_object.id,
            'url',file_object.delivery_url,
            'mime_type',file_object.mime_type,
            'byte_size',file_object.byte_size,
            'variant_role',selection.variant_role,
            'selection_revision',selection.selection_revision,
            'generator_name',variant.generator_name,
            'generator_version',variant.generator_version,
            'technical_metadata',variant.technical_metadata
          )
        ),
        '{}'::jsonb
      ) as items
      from media.variant_selections selection
      join media.variants variant
        on variant.id=selection.variant_id
      join media.file_objects file_object
        on file_object.id=variant.derived_file_object_id
      where selection.asset_revision_id=asset.current_revision_id
        and file_object.verification_state='verified'
        and file_object.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
        and not messaging.media_file_is_safety_contained(file_object.id)
    ) derivative_selection on true
  ) enriched;

  return jsonb_set(v_base,'{items}',v_items,true);
end;
$function$;


-- Candidate B public and worker execution authority.
revoke all on function public.update_messages_safety_assessment_v1(
  uuid,text,text,numeric,text,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.set_messages_safety_enforcement_v1(
  uuid,uuid,text,boolean,timestamptz,boolean,text,text,
  integer,integer,integer,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.get_my_message_safety_state_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.submit_messages_safety_appeal_v1(
  uuid,text,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.list_messages_safety_appeals_v1(
  text,timestamptz,uuid,integer
) from public, anon, authenticated, service_role;
revoke all on function public.start_messages_safety_appeal_review_v1(
  uuid,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.resolve_messages_safety_appeal_v1(
  uuid,text,text,text,text,timestamptz,boolean,
  integer,integer,integer,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.set_messages_safety_media_containment_v1(
  uuid,uuid,boolean,text,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.submit_messages_safety_media_scan_v1(
  uuid,uuid,text,uuid
) from public, anon, authenticated, service_role;
revoke all on function public.claim_messages_safety_media_scan_jobs_v1(
  text,integer,integer
) from public, anon, authenticated, service_role;
revoke all on function public.get_messages_safety_media_scan_target_v1(
  uuid,text
) from public, anon, authenticated, service_role;
revoke all on function public.complete_messages_safety_media_scan_job_v1(
  uuid,text,jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.fail_messages_safety_media_scan_job_v1(
  uuid,text,text,boolean,integer
) from public, anon, authenticated, service_role;
revoke all on function public.recover_expired_messages_safety_media_scan_jobs_v1(
  integer,integer
) from public, anon, authenticated, service_role;

grant execute on function public.update_messages_safety_assessment_v1(
  uuid,text,text,numeric,text,text,uuid
) to authenticated;
grant execute on function public.set_messages_safety_enforcement_v1(
  uuid,uuid,text,boolean,timestamptz,boolean,text,text,
  integer,integer,integer,text,uuid
) to authenticated;
grant execute on function public.get_my_message_safety_state_v1()
  to authenticated;
grant execute on function public.submit_messages_safety_appeal_v1(
  uuid,text,text,uuid
) to authenticated;
grant execute on function public.list_messages_safety_appeals_v1(
  text,timestamptz,uuid,integer
) to authenticated;
grant execute on function public.start_messages_safety_appeal_review_v1(
  uuid,text,uuid
) to authenticated;
grant execute on function public.resolve_messages_safety_appeal_v1(
  uuid,text,text,text,text,timestamptz,boolean,
  integer,integer,integer,text,uuid
) to authenticated;
grant execute on function public.set_messages_safety_media_containment_v1(
  uuid,uuid,boolean,text,text,uuid
) to authenticated;
grant execute on function public.submit_messages_safety_media_scan_v1(
  uuid,uuid,text,uuid
) to authenticated;

grant execute on function public.claim_messages_safety_media_scan_jobs_v1(
  text,integer,integer
) to service_role;
grant execute on function public.get_messages_safety_media_scan_target_v1(
  uuid,text
) to service_role;
grant execute on function public.complete_messages_safety_media_scan_job_v1(
  uuid,text,jsonb
) to service_role;
grant execute on function public.fail_messages_safety_media_scan_job_v1(
  uuid,text,text,boolean,integer
) to service_role;
grant execute on function public.recover_expired_messages_safety_media_scan_jobs_v1(
  integer,integer
) to service_role;

-- Replaced runtime functions retain their accepted pre-Candidate-B ACLs under
-- CREATE OR REPLACE. Assert the critical role boundary before committing.
do $postflight$
declare
  v_candidate_b_table_count integer;
  v_candidate_b_command_count integer;
begin
  select count(*) into v_candidate_b_table_count
  from information_schema.tables
  where table_schema='messaging'
    and table_name in (
      'safety_enforcements',
      'safety_appeals',
      'safety_media_containment'
    );

  if v_candidate_b_table_count<>3 then
    raise exception
      'STOP: Candidate B must own exactly three new peer tables';
  end if;

  select count(*) into v_candidate_b_command_count
  from platform_private.command_types
  where enabled
    and command_type in (
      'messages.safety.assessment.update',
      'messages.safety.enforcement.update',
      'messages.safety.appeal.submit',
      'messages.safety.appeal.review.start',
      'messages.safety.appeal.resolve',
      'messages.safety.media.containment.update',
      'messages.safety.media.scan'
    );

  if v_candidate_b_command_count<>7 then
    raise exception
      'STOP: Candidate B command vocabulary is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_my_message_safety_state_v1()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.update_messages_safety_assessment_v1(uuid,text,text,numeric,text,text,uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.claim_messages_safety_media_scan_jobs_v1(text,integer,integer)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Candidate B RPC execution authority is broader than designed';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.get_my_message_safety_state_v1()'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.claim_messages_safety_media_scan_jobs_v1(text,integer,integer)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Candidate B RPC execution authority is incomplete';
  end if;

  if not exists(
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='media'
      and relation.relname='variants'
      and trigger_row.tgname='variants_media_safety_guard'
      and not trigger_row.tgisinternal
  )
  or not exists(
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='media'
      and relation.relname='variant_selections'
      and trigger_row.tgname='variant_selections_media_safety_guard'
      and not trigger_row.tgisinternal
  )
  or not exists(
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='platform_private'
      and relation.relname='jobs'
      and trigger_row.tgname='jobs_media_safety_guard'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: normal Media processing containment guards are incomplete';
  end if;
end;
$postflight$;

commit;
