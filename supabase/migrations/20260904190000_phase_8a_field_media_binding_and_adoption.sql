-- Phase 8A.2B: consolidated Field Media binding and adoption authority.
--
-- One database milestone: protected Field Media intake, upload-session authority,
-- exact canonical adoption, final submission/receipt, cancellation completion,
-- safe reads, and the service-only receiver-control hooks needed by Phase 8A.3.
--
-- This migration does not deploy Edge code, frontend code, public routes,
-- Resource Versions, Media processing, or a second upload/file/Media authority.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8a-2b-field-media-binding-and-adoption',
    0
  )
);

do $phase_8a_2b_preflight$
declare
  v_definition text;
begin
  if to_regclass('editorial.field_submissions') is null
     or to_regclass('editorial.field_submission_events') is null
     or to_regclass('media.upload_sessions') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.asset_governance_versions') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('media.usage_roles') is null
     or to_regclass('media.asset_purposes') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('public.user_role_assignments') is null
     or to_regclass('public.role_capabilities') is null
  then
    raise exception
      'STOP: Phase 8A.2B required Field, Media, or command authority is incomplete.';
  end if;

  if to_regprocedure(
       'public.create_field_submission_v1(jsonb,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.update_field_submission_declarations_v1(uuid,bigint,jsonb,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.cancel_field_submission_v1(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_my_field_submission_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_field_submission_intake_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.create_media_upload_session_v2(text,text,text,bigint,text,integer,uuid)'
     ) is null
     or to_regprocedure(
       'public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.verify_media_upload_session_v1(uuid,text,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.expire_media_upload_session_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.fail_media_upload_session_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'
     ) is null
     or to_regprocedure(
       'media.usage_role_matches_target(text,text,text)'
     ) is null
     or to_regprocedure(
       'media.enforce_usage_link_integrity()'
     ) is null
     or to_regprocedure(
       'editorial.field_submission_state_snapshot_v1(uuid)'
     ) is null
  then
    raise exception
      'STOP: Phase 8A.2B predecessor function authority is incomplete.';
  end if;

  if exists (
    select 1 from media.asset_purposes
    where asset_purpose = 'field_original'
  )
  or exists (
    select 1 from media.usage_roles
    where usage_role = 'field_original'
  )
  or to_regclass('editorial.field_submission_media_intakes') is not null
  or exists (
    select 1 from platform_private.command_types
    where command_type in (
      'field.submission.media.start',
      'field.submission.media.adopt',
      'field.submission.finalize'
    )
  )
  then
    raise exception
      'STOP: Phase 8A.2B authority already exists.';
  end if;

  if md5(pg_get_functiondef(
       'public.create_media_upload_session_v2(text,text,text,bigint,text,integer,uuid)'::regprocedure
     )) <> '2a8f50b8775563fa99f9348ccdb4e250'
     or md5(pg_get_functiondef(
       'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)'::regprocedure
     )) <> 'eb7ad07f8bed953a4da4e50f6776bb33'
     or md5(pg_get_functiondef(
       'public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid)'::regprocedure
     )) <> '75ac38d001edec77802d5e7525dd6daf'
     or md5(pg_get_functiondef(
       'public.cancel_media_upload_session_v1(uuid,text)'::regprocedure
     )) <> '8433654899bfa8cd6c2eddbff378a846'
     or md5(pg_get_functiondef(
       'public.verify_media_upload_session_v1(uuid,text,bigint,text,uuid)'::regprocedure
     )) <> 'e93620ff030b1102372291b880d9c010'
     or md5(pg_get_functiondef(
       'public.expire_media_upload_session_v1(uuid,text)'::regprocedure
     )) <> 'f9921bbc7097d126d51f5090d60c26d1'
     or md5(pg_get_functiondef(
       'public.fail_media_upload_session_v1(uuid,text)'::regprocedure
     )) <> 'b0520b2469e7894e1f3386f4b5a20d36'
  then
    raise exception
      'STOP: accepted Media upload/admin predecessor definitions drifted.';
  end if;

  if md5(pg_get_functiondef(
       'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
     )) <> 'a7fb7441def5de086a839e5bf6bae6b5'
     or md5(pg_get_functiondef(
       'media.usage_role_matches_target(text,text,text)'::regprocedure
     )) <> 'd30e0ad50c2d99aec9f05726137f52ec'
     or md5(pg_get_functiondef(
       'media.enforce_usage_link_integrity()'::regprocedure
     )) <> '1f64345ea16d94d9154c900a54c1dbcf'
  then
    raise exception
      'STOP: Media usage semantic predecessor definitions drifted.';
  end if;

  v_definition := pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  );

  if position('p_target_authority = ''video''' in v_definition) = 0
     or position('p_target_kind = ''video_publication''' in v_definition) = 0
     or position('editorial.current_user_can_edit_video' in v_definition) = 0
  then
    raise exception
      'STOP: Video Media target validation predecessor branches are missing.';
  end if;
end;
$phase_8a_2b_preflight$;

insert into media.asset_purposes (
  asset_purpose, label, description, enabled, sort_order
)
values (
  'field_original',
  'Field Original',
  'Protected immutable original received through Field Submission intake.',
  true,
  130
);

insert into media.usage_roles (
  usage_role, label, description, enabled, sort_order
)
values (
  'field_original',
  'Field Original',
  'Exact protected Media revision attached to a Field Submission intake slot.',
  true,
  71
);

alter table media.usage_links
  drop constraint usage_links_target_kind_check;

alter table media.usage_links
  add constraint usage_links_target_kind_check
  check (
    target_kind in (
      'article',
      'artist',
      'author',
      'release',
      'track',
      'chart_entry',
      'guide',
      'guide_page',
      'highlight',
      'source',
      'playlist',
      'audio_publication',
      'video_publication',
      'field_submission'
    )
  );

create or replace function editorial.user_has_field_capability_v1(
  p_actor_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select
    p_actor_id is not null
    and p_capability in (
      'submit_field_capture',
      'read_own_field_capture',
      'view_field_intake',
      'view_restricted_field_sources'
    )
    and exists (
      select 1
      from public.user_role_assignments assignment
      join public.role_capabilities capability
        on capability.role_key = assignment.role_key
      where assignment.user_id = p_actor_id
        and assignment.status = 'active'
        and (
          assignment.expires_at is null
          or assignment.expires_at > now()
        )
        and capability.capability_key = p_capability
    );
$function$;

revoke all
  on function editorial.user_has_field_capability_v1(uuid, text)
  from public, anon, authenticated, service_role;

do $extend_usage_role_matcher$
declare
  v_definition text;
  v_new text;
begin
  v_definition := pg_get_functiondef(
    'media.usage_role_matches_target(text,text,text)'::regprocedure
  );

  if md5(v_definition) <> 'd30e0ad50c2d99aec9f05726137f52ec' then
    raise exception
      'STOP: usage_role_matches_target changed after preflight.';
  end if;

  v_new := replace(
    v_definition,
    $anchor$    when 'other' then
      true$anchor$,
    $replacement$    when 'field_original' then
      p_target_authority = 'editorial'
      and p_target_kind = 'field_submission'
    when 'other' then
      not (
        p_target_authority = 'editorial'
        and p_target_kind = 'field_submission'
      )$replacement$
  );

  if v_new = v_definition or position('field_original' in v_new) = 0 then
    raise exception
      'STOP: usage-role matcher Field extension anchor was not found.';
  end if;

  execute v_new;
end;
$extend_usage_role_matcher$;

do $extend_usage_target_validator$
declare
  v_definition text;
  v_new text;
begin
  v_definition := pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  );

  if md5(v_definition) <> 'a7fb7441def5de086a839e5bf6bae6b5' then
    raise exception
      'STOP: validate_usage_target changed after preflight.';
  end if;

  v_new := replace(
    v_definition,
    'and p_target_kind in (''article'', ''playlist'')',
    'and p_target_kind in (''article'', ''playlist'', ''field_submission'')'
  );

  v_new := replace(
    v_new,
    $anchor$    when p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    then$anchor$,
    $replacement$    when p_target_authority = 'editorial'
      and p_target_kind = 'field_submission'
    then
      select
        to_jsonb(field_row)
        || jsonb_build_object(
          'lifecycle_state', resource_row.lifecycle_state,
          'visibility', resource_row.visibility
        )
      into v_target_snapshot
      from editorial.field_submissions field_row
      join editorial.resources resource_row
        on resource_row.id = field_row.resource_id
       and resource_row.resource_kind = field_row.resource_kind
      where field_row.resource_id = p_target_id;

    when p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    then$replacement$
  );

  v_new := replace(
    v_new,
    $anchor$  if p_require_attachable_target
    and not media.usage_target_snapshot_is_attachable(v_target_snapshot)$anchor$,
    $replacement$  if p_target_authority = 'editorial'
     and p_target_kind = 'field_submission'
     and coalesce(v_target_snapshot ->> 'submission_state', '')
       not in ('receiving', 'received')
  then
    raise exception 'Field Submission Media target no longer accepts intake';
  end if;

  if p_require_attachable_target
    and not media.usage_target_snapshot_is_attachable(v_target_snapshot)$replacement$
  );

  v_new := replace(
    v_new,
    $anchor$  if public.current_user_is_administrator() then
    return;
  end if;$anchor$,
    $replacement$  if p_target_authority = 'editorial'
     and p_target_kind = 'field_submission'
  then
    v_authorized :=
      editorial.user_has_field_capability_v1(
        p_actor_id,
        'submit_field_capture'
      )
      and exists (
        select 1
        from editorial.field_submissions field_row
        join editorial.resources resource_row
          on resource_row.id = field_row.resource_id
         and resource_row.resource_kind = field_row.resource_kind
        where field_row.resource_id = p_target_id
          and field_row.owner_user_id = p_actor_id
          and resource_row.owner_id = p_actor_id
          and resource_row.visibility = 'private'
      );

    if not coalesce(v_authorized, false) then
      raise exception 'Edit authority for the Field Media usage target is required';
    end if;

    return;
  end if;

  if public.current_user_is_administrator() then
    return;
  end if;$replacement$
  );

  if position('field_submission' in v_new) = 0
     or position('editorial.current_user_can_edit_video' in v_new) = 0
     or position('video_publication_version' in v_new) = 0
     or v_new = v_definition
  then
    raise exception
      'STOP: Media target validator Field extension was incomplete.';
  end if;

  execute v_new;
end;
$extend_usage_target_validator$;

do $extend_usage_integrity$
declare
  v_definition text;
  v_new text;
begin
  v_definition := pg_get_functiondef(
    'media.enforce_usage_link_integrity()'::regprocedure
  );

  if md5(v_definition) <> '1f64345ea16d94d9154c900a54c1dbcf' then
    raise exception
      'STOP: enforce_usage_link_integrity changed after preflight.';
  end if;

  v_new := replace(
    v_definition,
    $anchor$  if tg_op = 'UPDATE' then$anchor$,
    $replacement$  if new.target_authority = 'editorial'
     and new.target_kind = 'field_submission'
     and new.usage_role <> 'field_original'
  then
    raise exception
      'Field Submission Media targets accept field_original usage only.';
  end if;

  if new.usage_role = 'field_original' then
    if new.target_authority <> 'editorial'
       or new.target_kind <> 'field_submission'
       or new.resolution_mode <> 'exact_revision'
       or new.asset_revision_id is null
       or new.target_version_kind is not null
       or new.target_version_id is not null
       or coalesce(new.placement_data ->> 'slot_number', '') !~ '^[1-9][0-9]*$'
    then
      raise exception
        'Field original usage requires one exact unversioned Field Submission slot.';
    end if;

    if not exists (
      select 1
      from media.assets asset
      join media.asset_revisions revision
        on revision.id = new.asset_revision_id
       and revision.asset_id = asset.id
      join media.file_objects file_object
        on file_object.id = revision.original_file_object_id
      join media.asset_governance_versions governance
        on governance.id = asset.current_governance_version_id
       and governance.asset_id = asset.id
      where asset.id = new.asset_id
        and asset.asset_kind = 'video'
        and asset.asset_purpose = 'field_original'
        and asset.lifecycle_state = 'active'
        and asset.current_revision_id = revision.id
        and file_object.verification_state = 'verified'
        and governance.public_safety_state = 'internal'
        and governance.source_protection_class in (
          'internal', 'restricted', 'confidential'
        )
    ) then
      raise exception
        'Field original usage requires the protected verified current Media revision.';
    end if;
  end if;

  if tg_op = 'UPDATE' then$replacement$
  );

  if position('field_original' in v_new) = 0
     or position('video_master' in v_new) = 0
     or v_new = v_definition
  then
    raise exception
      'STOP: Media usage integrity Field extension was incomplete.';
  end if;

  execute v_new;
end;
$extend_usage_integrity$;


create or replace function media.protect_field_original_asset_v1()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if new.asset_purpose = 'field_original'
     and new.asset_kind <> 'video'
  then
    raise exception
      'Field original Media must remain video in the Phase 8A first proof.';
  end if;

  if tg_op = 'UPDATE'
     and new.asset_purpose is distinct from old.asset_purpose
     and (
       old.asset_purpose = 'field_original'
       or new.asset_purpose = 'field_original'
     )
  then
    raise exception
      'Field original Media purpose cannot be assigned or removed after asset creation.';
  end if;

  if tg_op = 'UPDATE'
     and old.asset_purpose = 'field_original'
     and (
       new.asset_kind is distinct from old.asset_kind
       or new.lifecycle_state <> 'active'
       or new.compatibility_folder_id is not null
       or (
         (
           new.current_revision_id is distinct from old.current_revision_id
           or new.current_governance_version_id
                is distinct from old.current_governance_version_id
         )
         and not (
           old.current_revision_id is null
           and old.current_governance_version_id is null
           and old.authority_revision = 1
           and new.current_revision_id is not null
           and new.current_governance_version_id is not null
           and new.authority_revision = 2
         )
       )
     )
  then
    raise exception
      'Field original Media canonical pointers, kind, active lifecycle, and private compatibility boundary are immutable after initial activation in Phase 8A.';
  end if;

  return new;
end;
$function$;

create trigger media_assets_field_original_protection
before insert or update
on media.assets
for each row
execute function media.protect_field_original_asset_v1();

create or replace function media.protect_field_original_usage_v1()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if old.usage_role = 'field_original' then
    raise exception
      'Field original Media usage is immutable until later governed Field withdrawal.';
  end if;

  return old;
end;
$function$;

create trigger media_usage_field_original_protection
before update or delete
on media.usage_links
for each row
execute function media.protect_field_original_usage_v1();

create or replace function media.protect_field_original_governance_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'media'
as $function$
begin
  if exists (
    select 1
    from media.assets asset
    where asset.id = new.asset_id
      and asset.asset_purpose = 'field_original'
  ) then
    if new.rights_status <> 'needs_clearance'
       or new.consent_status <> 'unknown'
       or new.public_safety_state <> 'internal'
       or new.source_protection_class not in (
         'internal', 'restricted', 'confidential'
       )
       or new.retention_state <> 'retain'
    then
      raise exception
        'Field original Media governance must remain protected until later governed review.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger media_governance_field_original_protection
before insert or update
on media.asset_governance_versions
for each row
execute function media.protect_field_original_governance_v1();

revoke all
  on function media.protect_field_original_asset_v1(),
     media.protect_field_original_usage_v1(),
     media.protect_field_original_governance_v1()
  from public, anon, authenticated, service_role;

create table editorial.field_submission_media_intakes (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_resource_id uuid not null,
  slot_number integer not null check (slot_number >= 1),
  attempt_number integer not null check (attempt_number >= 1),
  media_upload_session_id uuid not null unique,
  usage_link_id uuid unique,
  intake_state text not null default 'active'
    check (
      intake_state in (
        'active',
        'verified',
        'adopted',
        'cancelled',
        'expired',
        'superseded'
      )
    ),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  adopted_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  superseded_at timestamptz,
  correlation_id uuid not null,

  constraint field_submission_media_intakes_submission_attempt_key
    unique (
      submission_resource_id,
      slot_number,
      attempt_number
    ),

  constraint field_submission_media_intakes_submission_fkey
    foreign key (submission_resource_id)
    references editorial.field_submissions(resource_id)
    on update restrict
    on delete restrict,

  constraint field_submission_media_intakes_upload_session_fkey
    foreign key (media_upload_session_id)
    references media.upload_sessions(id)
    on update restrict
    on delete restrict,

  constraint field_submission_media_intakes_usage_link_fkey
    foreign key (usage_link_id)
    references media.usage_links(id)
    on update restrict
    on delete restrict,

  constraint field_submission_media_intakes_state_timestamps_check
    check (
      (
        intake_state = 'active'
        and usage_link_id is null
        and verified_at is null
        and adopted_at is null
        and cancelled_at is null
        and expired_at is null
        and superseded_at is null
      )
      or (
        intake_state = 'verified'
        and usage_link_id is null
        and verified_at is not null
        and adopted_at is null
        and cancelled_at is null
        and expired_at is null
        and superseded_at is null
      )
      or (
        intake_state = 'adopted'
        and usage_link_id is not null
        and verified_at is not null
        and adopted_at is not null
        and cancelled_at is null
        and expired_at is null
        and superseded_at is null
      )
      or (
        intake_state = 'cancelled'
        and usage_link_id is null
        and adopted_at is null
        and cancelled_at is not null
        and expired_at is null
        and superseded_at is null
      )
      or (
        intake_state = 'expired'
        and usage_link_id is null
        and adopted_at is null
        and cancelled_at is null
        and expired_at is not null
        and superseded_at is null
      )
      or (
        intake_state = 'superseded'
        and usage_link_id is null
        and adopted_at is null
        and cancelled_at is null
        and expired_at is null
        and superseded_at is not null
      )
    )
);

create unique index field_submission_media_intakes_one_inflight_slot_idx
  on editorial.field_submission_media_intakes (
    submission_resource_id,
    slot_number
  )
  where intake_state in ('active', 'verified');

create unique index field_submission_media_intakes_one_adopted_slot_idx
  on editorial.field_submission_media_intakes (
    submission_resource_id,
    slot_number
  )
  where intake_state = 'adopted';

create index field_submission_media_intakes_submission_updated_idx
  on editorial.field_submission_media_intakes (
    submission_resource_id,
    updated_at desc,
    id
  );

create index field_submission_media_intakes_upload_session_idx
  on editorial.field_submission_media_intakes (
    media_upload_session_id
  );

alter table editorial.field_submission_media_intakes enable row level security;

revoke all
  on editorial.field_submission_media_intakes
  from public, anon, authenticated, service_role;

alter table editorial.field_submission_events
  add constraint field_submission_events_media_intake_fkey
  foreign key (media_intake_id)
  references editorial.field_submission_media_intakes(id)
  on update restrict
  on delete restrict;

create unique index media_field_original_active_slot_key
  on media.usage_links (
    target_id,
    ((placement_data ->> 'slot_number')::integer)
  )
  where target_authority = 'editorial'
    and target_kind = 'field_submission'
    and usage_role = 'field_original'
    and usage_state = 'active';

create or replace function editorial.protect_field_media_intake_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'media'
as $function$
declare
  v_usage media.usage_links%rowtype;
  v_session media.upload_sessions%rowtype;
  v_revision media.asset_revisions%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.submission_resource_id is distinct from old.submission_resource_id
       or new.slot_number is distinct from old.slot_number
       or new.attempt_number is distinct from old.attempt_number
       or new.media_upload_session_id is distinct from old.media_upload_session_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.correlation_id is distinct from old.correlation_id
    then
      raise exception
        'Field Media intake identity and creation provenance are immutable.';
    end if;

    if new.updated_at < old.updated_at then
      raise exception
        'Field Media intake update timestamp is invalid.';
    end if;

    if old.intake_state in (
      'adopted', 'cancelled', 'expired', 'superseded'
    ) then
      raise exception
        'Terminal Field Media intake state is immutable.';
    end if;

    if not (
      (old.intake_state = 'active'
       and new.intake_state in (
         'verified', 'cancelled', 'expired', 'superseded'
       ))
      or
      (old.intake_state = 'verified'
       and new.intake_state = 'adopted')
    ) then
      raise exception
        'Unsupported Field Media intake transition from % to %.',
        old.intake_state,
        new.intake_state;
    end if;
  end if;

  if new.intake_state = 'adopted' then
    select usage.*
    into v_usage
    from media.usage_links usage
    where usage.id = new.usage_link_id;

    if not found
       or v_usage.target_authority <> 'editorial'
       or v_usage.target_kind <> 'field_submission'
       or v_usage.target_id <> new.submission_resource_id
       or v_usage.usage_role <> 'field_original'
       or v_usage.usage_state <> 'active'
       or v_usage.resolution_mode <> 'exact_revision'
       or v_usage.asset_revision_id is null
       or coalesce(
         (v_usage.placement_data ->> 'slot_number')::integer,
         0
       ) <> new.slot_number
    then
      raise exception
        'Adopted Field Media intake requires its exact canonical field_original usage.';
    end if;

    select session_row.*
    into v_session
    from media.upload_sessions session_row
    where session_row.id = new.media_upload_session_id;

    select revision.*
    into v_revision
    from media.asset_revisions revision
    where revision.id = v_usage.asset_revision_id;

    if v_session.id is null
       or v_session.state <> 'verified'
       or v_session.file_object_id is null
       or v_revision.id is null
       or v_revision.original_file_object_id <> v_session.file_object_id
    then
      raise exception
        'Adopted Field Media intake must resolve to its exact verified upload file.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger field_submission_media_intakes_protect_mutation
before insert or update
on editorial.field_submission_media_intakes
for each row
execute function editorial.protect_field_media_intake_v1();

revoke all
  on function editorial.protect_field_media_intake_v1()
  from public, anon, authenticated, service_role;

create or replace function editorial.assert_field_media_actor_v1(
  p_actor_id uuid,
  p_submission_resource_id uuid,
  p_media_intake_id uuid default null,
  p_required_capability text default 'submit_field_capture'
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'editorial', 'public', 'media'
as $function$
begin
  if p_actor_id is null
     or not editorial.user_has_field_capability_v1(
       p_actor_id,
       p_required_capability
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Field Submission permission is required.';
  end if;

  if not exists (
    select 1
    from editorial.field_submissions field
    join editorial.resources resource_row
      on resource_row.id = field.resource_id
     and resource_row.resource_kind = field.resource_kind
    where field.resource_id = p_submission_resource_id
      and field.owner_user_id = p_actor_id
      and resource_row.owner_id = p_actor_id
      and resource_row.visibility = 'private'
  )
  then
    raise exception
      using errcode = 'P0002',
            message = 'The Field Submission does not exist for this contributor.';
  end if;

  if p_media_intake_id is not null
     and not exists (
       select 1
       from editorial.field_submission_media_intakes intake
       join media.upload_sessions session_row
         on session_row.id = intake.media_upload_session_id
       where intake.id = p_media_intake_id
         and intake.submission_resource_id = p_submission_resource_id
         and intake.created_by = p_actor_id
         and session_row.actor_id = p_actor_id
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Field Media intake does not belong to this contributor and submission.';
  end if;
end;
$function$;

revoke all
  on function editorial.assert_field_media_actor_v1(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function media.create_field_video_upload_session_v1(
  p_actor_id uuid,
  p_submission_resource_id uuid,
  p_slot_number integer,
  p_attempt_number integer,
  p_idempotency_key text,
  p_original_filename text,
  p_mime_type text,
  p_expected_byte_size bigint,
  p_expected_sha256 text,
  p_ttl_seconds integer,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'public', 'media', 'extensions'
as $function$
declare
  v_session_id uuid := extensions.gen_random_uuid();
  v_filename text := btrim(coalesce(p_original_filename, ''));
  v_mime_type text := lower(btrim(coalesce(p_mime_type, '')));
  v_sha256 text := lower(btrim(coalesce(p_expected_sha256, '')));
  v_extension text;
  v_part_size integer := 8388608;
  v_total_parts integer;
  v_storage_path text;
  v_existing media.upload_sessions%rowtype;
begin
  perform editorial.assert_field_media_actor_v1(
    p_actor_id,
    p_submission_resource_id,
    null,
    'submit_field_capture'
  );

  if p_slot_number is null or p_slot_number < 1
     or p_attempt_number is null or p_attempt_number < 1
  then
    raise exception
      using errcode = '22023',
            message = 'Field Media slot and attempt must be positive integers.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023',
            message = 'Field Media upload idempotency key is invalid.';
  end if;

  if v_filename = '' or strpos(v_filename, '.') = 0 then
    raise exception
      using errcode = '22023',
            message = 'Video filename with extension is required.';
  end if;

  v_extension := lower(
    reverse(split_part(reverse(v_filename), '.', 1))
  );

  if v_mime_type not like 'video/%'
     or v_extension not in ('mp4', 'mov', 'm4v', 'webm', 'mkv')
  then
    raise exception
      using errcode = '22023',
            message = 'Phase 8A Field intake accepts supported video masters only.';
  end if;

  if p_expected_byte_size is null
     or p_expected_byte_size <= 0
     or p_expected_byte_size > 2147483648
  then
    raise exception
      using errcode = '22023',
            message = 'Field video must be larger than zero and no larger than 2 GiB.';
  end if;

  if v_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception
      using errcode = '22023',
            message = 'Expected Field video SHA-256 is invalid.';
  end if;

  if p_ttl_seconds not between 300 and 86400 then
    raise exception
      using errcode = '22023',
            message = 'Field upload-session TTL must be between 300 and 86400 seconds.';
  end if;

  select session_row.*
  into v_existing
  from media.upload_sessions session_row
  where session_row.actor_id = p_actor_id
    and session_row.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.original_filename is distinct from v_filename
       or v_existing.mime_type is distinct from v_mime_type
       or v_existing.expected_byte_size is distinct from p_expected_byte_size
       or v_existing.expected_sha256 is distinct from v_sha256
    then
      raise exception
        using errcode = '23505',
              message = 'Field upload idempotency key is already bound to different file metadata.';
    end if;

    return jsonb_build_object(
      'session_id', v_existing.id,
      'state', v_existing.state,
      'part_size_bytes', v_existing.part_size_bytes,
      'total_parts', v_existing.total_parts,
      'expires_at', v_existing.expires_at,
      'correlation_id', v_existing.correlation_id
    );
  end if;

  v_total_parts := greatest(
    1,
    ceil(
      p_expected_byte_size::numeric /
      v_part_size::numeric
    )::integer
  );

  v_storage_path :=
    'masters/video/' ||
    to_char(now(), 'YYYY/MM') ||
    '/' ||
    v_session_id::text ||
    '.' ||
    v_extension;

  insert into media.upload_sessions (
    id,
    actor_id,
    idempotency_key,
    state,
    storage_path,
    original_filename,
    file_extension,
    mime_type,
    expected_byte_size,
    expected_sha256,
    part_size_bytes,
    total_parts,
    expires_at,
    correlation_id
  )
  values (
    v_session_id,
    p_actor_id,
    p_idempotency_key,
    'created',
    v_storage_path,
    v_filename,
    v_extension,
    v_mime_type,
    p_expected_byte_size,
    v_sha256,
    v_part_size,
    v_total_parts,
    now() + make_interval(secs => p_ttl_seconds),
    p_correlation_id
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'state', 'created',
    'part_size_bytes', v_part_size,
    'total_parts', v_total_parts,
    'expires_at', now() + make_interval(secs => p_ttl_seconds),
    'correlation_id', p_correlation_id
  );
end;
$function$;

revoke all
  on function media.create_field_video_upload_session_v1(
    uuid, uuid, integer, integer, text, text, text,
    bigint, text, integer, uuid
  )
  from public, anon, authenticated, service_role;

create or replace function media.cancel_field_upload_session_v1(
  p_actor_id uuid,
  p_session_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'media'
as $function$
declare
  v_session media.upload_sessions%rowtype;
  v_reason text := coalesce(
    nullif(btrim(p_reason), ''),
    'Field Submission cancelled before Media adoption'
  );
begin
  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = p_session_id
    and session_row.actor_id = p_actor_id
  for update;

  if not found then
    raise exception
      'Field Media upload session does not exist for this contributor.';
  end if;

  if v_session.state = 'verified' then
    raise exception
      'Verified Field Media cannot be cancelled before governed adoption handling.';
  end if;

  if v_session.state in ('failed', 'cancelled', 'expired') then
    return jsonb_build_object(
      'session_id', v_session.id,
      'state', v_session.state
    );
  end if;

  update media.upload_sessions
  set
    state = 'cancelled',
    last_error = v_reason,
    cancelled_at = now(),
    updated_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'state', 'cancelled',
    'cancelled_at', now()
  );
end;
$function$;

revoke all
  on function media.cancel_field_upload_session_v1(uuid, uuid, text)
  from public, anon, authenticated, service_role;


create or replace function media.attach_protected_field_original_usage_v1(
  p_actor_id uuid,
  p_submission_resource_id uuid,
  p_slot_number integer,
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'media', 'extensions'
as $function$
declare
  v_existing media.usage_links%rowtype;
  v_usage_id uuid := extensions.gen_random_uuid();
begin
  perform editorial.assert_field_media_actor_v1(
    p_actor_id,
    p_submission_resource_id,
    null,
    'submit_field_capture'
  );

  if p_slot_number is null or p_slot_number < 1 then
    raise exception 'Field Media usage slot must be positive.';
  end if;

  perform media.validate_usage_target(
    p_actor_id,
    'editorial',
    'field_submission',
    p_submission_resource_id,
    null,
    null,
    true,
    true
  );

  if not exists (
    select 1
    from media.assets asset
    join media.asset_revisions revision
      on revision.id = p_asset_revision_id
     and revision.asset_id = asset.id
    join media.file_objects file_object
      on file_object.id = revision.original_file_object_id
    join media.asset_governance_versions governance
      on governance.id = asset.current_governance_version_id
     and governance.asset_id = asset.id
    where asset.id = p_asset_id
      and asset.asset_kind = 'video'
      and asset.asset_purpose = 'field_original'
      and asset.lifecycle_state = 'active'
      and asset.current_revision_id = revision.id
      and file_object.verification_state = 'verified'
      and governance.rights_status = 'needs_clearance'
      and governance.consent_status = 'unknown'
      and governance.public_safety_state = 'internal'
      and governance.source_protection_class in (
        'internal', 'restricted', 'confidential'
      )
  ) then
    raise exception
      'Protected Field original usage requires the exact verified current protected Media revision.';
  end if;

  select usage.*
  into v_existing
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'field_submission'
    and usage.target_id = p_submission_resource_id
    and usage.usage_role = 'field_original'
    and usage.usage_state = 'active'
    and (usage.placement_data ->> 'slot_number')::integer = p_slot_number
  for update;

  if found then
    if v_existing.asset_id = p_asset_id
       and v_existing.asset_revision_id = p_asset_revision_id
       and v_existing.resolution_mode = 'exact_revision'
    then
      return v_existing.id;
    end if;

    raise exception
      'A different protected Field original is already active for this submission slot.';
  end if;

  insert into media.usage_links (
    id,
    asset_id,
    asset_revision_id,
    resolution_mode,
    target_authority,
    target_kind,
    target_id,
    target_version_kind,
    target_version_id,
    usage_role,
    placement_data,
    display_order,
    usage_state,
    usage_revision,
    created_by
  )
  values (
    v_usage_id,
    p_asset_id,
    p_asset_revision_id,
    'exact_revision',
    'editorial',
    'field_submission',
    p_submission_resource_id,
    null,
    null,
    'field_original',
    jsonb_build_object('slot_number', p_slot_number),
    p_slot_number - 1,
    'active',
    1,
    p_actor_id
  );

  insert into media.events (
    asset_id,
    asset_revision_id,
    usage_link_id,
    event_type,
    actor_id,
    reason,
    resulting_state,
    correlation_id
  )
  values (
    p_asset_id,
    p_asset_revision_id,
    v_usage_id,
    'usage_attached',
    p_actor_id,
    'Attach protected Field original to Field Submission',
    jsonb_build_object(
      'target_authority', 'editorial',
      'target_kind', 'field_submission',
      'target_id', p_submission_resource_id,
      'usage_role', 'field_original',
      'slot_number', p_slot_number,
      'resolution_mode', 'exact_revision'
    ),
    p_correlation_id
  );

  return v_usage_id;
end;
$function$;

revoke all
  on function media.attach_protected_field_original_usage_v1(
    uuid, uuid, integer, uuid, uuid, uuid
  )
  from public, anon, authenticated, service_role;

create or replace function media.create_protected_field_original_v1(
  p_actor_id uuid,
  p_submission_resource_id uuid,
  p_slot_number integer,
  p_file_object_id uuid,
  p_title text,
  p_sensitivity text,
  p_source_protection_class text,
  p_embargo_request_mode text,
  p_requested_embargo_until timestamptz,
  p_correlation_id uuid
)
returns table(
  asset_id uuid,
  asset_revision_id uuid,
  governance_version_id uuid,
  usage_link_id uuid
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'media', 'extensions'
as $function$
declare
  v_asset_id uuid := extensions.gen_random_uuid();
  v_revision_id uuid := extensions.gen_random_uuid();
  v_governance_id uuid := extensions.gen_random_uuid();
  v_usage_id uuid;
  v_title text := coalesce(
    nullif(btrim(p_title), ''),
    'Field Submission video'
  );
  v_embargo_state text := case
    when p_embargo_request_mode = 'until_time'
      then 'active'
    else 'none'
  end;
begin
  perform editorial.assert_field_media_actor_v1(
    p_actor_id,
    p_submission_resource_id,
    null,
    'submit_field_capture'
  );

  if not exists (
    select 1
    from media.file_objects file_object
    where file_object.id = p_file_object_id
      and file_object.verification_state = 'verified'
      and file_object.storage_provider = 'lightsail_media'
      and file_object.mime_type like 'video/%'
      and file_object.storage_path like 'masters/video/%'
  ) then
    raise exception
      'Protected Field original requires one verified canonical video file object.';
  end if;

  if p_sensitivity not in ('none', 'low', 'moderate', 'high', 'extreme')
     or p_source_protection_class not in (
       'internal', 'restricted', 'confidential'
     )
     or (
       p_embargo_request_mode = 'until_time'
       and p_requested_embargo_until is null
     )
  then
    raise exception
      'Field declaration cannot be mapped to protected Media governance.';
  end if;

  insert into media.assets (
    id,
    asset_kind,
    asset_purpose,
    title,
    lifecycle_state,
    compatibility_folder_id,
    current_revision_id,
    current_governance_version_id,
    authority_revision,
    created_by,
    updated_by
  )
  values (
    v_asset_id,
    'video',
    'field_original',
    v_title,
    'active',
    null,
    null,
    null,
    1,
    p_actor_id,
    p_actor_id
  );

  insert into media.asset_governance_versions (
    id,
    asset_id,
    version_number,
    rights_status,
    rights_basis,
    rights_holder,
    licence_identifier,
    licence_terms,
    consent_status,
    consent_scope,
    sensitivity,
    embargo_state,
    embargo_until,
    source_protection_class,
    preservation_state,
    retention_state,
    public_safety_state,
    internal_reason,
    approved_by,
    created_by
  )
  values (
    v_governance_id,
    v_asset_id,
    1,
    'needs_clearance',
    null,
    null,
    null,
    null,
    'unknown',
    null,
    p_sensitivity,
    v_embargo_state,
    case
      when v_embargo_state = 'active'
        then p_requested_embargo_until
      else null
    end,
    p_source_protection_class,
    'preservation_candidate',
    'retain',
    'internal',
    'Protected Field original. Contributor declarations remain intake provenance and do not constitute institutional clearance.',
    null,
    p_actor_id
  );

  insert into media.asset_revisions (
    id,
    asset_id,
    revision_number,
    original_file_object_id,
    previous_revision_id,
    replacement_reason,
    created_by
  )
  values (
    v_revision_id,
    v_asset_id,
    1,
    p_file_object_id,
    null,
    'Adopt verified Field Submission original',
    p_actor_id
  );

  update media.assets as asset
  set
    current_revision_id = v_revision_id,
    current_governance_version_id = v_governance_id,
    authority_revision = 2,
    updated_by = p_actor_id,
    updated_at = now()
  where asset.id = v_asset_id;

  insert into media.events (
    asset_id, event_type, actor_id, reason, resulting_state, correlation_id
  )
  values (
    v_asset_id,
    'asset_created',
    p_actor_id,
    'Protected Field original Media asset created',
    jsonb_build_object(
      'asset_kind', 'video',
      'asset_purpose', 'field_original',
      'authority_revision', 1
    ),
    p_correlation_id
  );

  insert into media.events (
    asset_id, governance_version_id, event_type,
    actor_id, reason, resulting_state, correlation_id
  )
  values (
    v_asset_id,
    v_governance_id,
    'governance_version_created',
    p_actor_id,
    'Initial protected Field original governance created',
    jsonb_build_object(
      'version_number', 1,
      'rights_status', 'needs_clearance',
      'consent_status', 'unknown',
      'public_safety_state', 'internal',
      'source_protection_class', p_source_protection_class
    ),
    p_correlation_id
  );

  insert into media.events (
    asset_id, asset_revision_id, file_object_id,
    event_type, actor_id, reason, resulting_state, correlation_id
  )
  values (
    v_asset_id,
    v_revision_id,
    p_file_object_id,
    'asset_revision_created',
    p_actor_id,
    'Adopt verified Field Submission original',
    jsonb_build_object(
      'revision_number', 1,
      'file_object_id', p_file_object_id
    ),
    p_correlation_id
  );

  insert into media.events (
    asset_id, asset_revision_id, file_object_id,
    event_type, actor_id, reason, prior_state, resulting_state, correlation_id
  )
  values (
    v_asset_id,
    v_revision_id,
    p_file_object_id,
    'asset_revision_activated',
    p_actor_id,
    'Activate exact Field Submission original revision',
    jsonb_build_object(
      'current_revision_id', null,
      'authority_revision', 1
    ),
    jsonb_build_object(
      'current_revision_id', v_revision_id,
      'authority_revision', 2
    ),
    p_correlation_id
  );

  insert into media.events (
    asset_id, asset_revision_id, file_object_id,
    event_type, actor_id, reason, resulting_state, correlation_id
  )
  values (
    v_asset_id,
    v_revision_id,
    p_file_object_id,
    'resumable_master_adopted',
    p_actor_id,
    'Verified resumable Field master adopted as protected original',
    jsonb_build_object(
      'asset_kind', 'video',
      'asset_purpose', 'field_original',
      'revision_number', 1
    ),
    p_correlation_id
  );

  v_usage_id := media.attach_protected_field_original_usage_v1(
    p_actor_id,
    p_submission_resource_id,
    p_slot_number,
    v_asset_id,
    v_revision_id,
    p_correlation_id
  );

  asset_id := v_asset_id;
  asset_revision_id := v_revision_id;
  governance_version_id := v_governance_id;
  usage_link_id := v_usage_id;
  return next;
end;
$function$;

revoke all
  on function media.create_protected_field_original_v1(
    uuid, uuid, integer, uuid, text, text, text, text,
    timestamptz, uuid
  )
  from public, anon, authenticated, service_role;

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
    'field.submission.media.start',
    'field.submission.media.start.sync',
    'field.submission.media.start.accepted',
    'field.submission.media.start.succeeded',
    'field.submission.media.start.failed',
    'field.submission.media.start.retry_scheduled',
    true
  ),
  (
    'field.submission.media.adopt',
    'field.submission.media.adopt.sync',
    'field.submission.media.adopt.accepted',
    'field.submission.media.adopt.succeeded',
    'field.submission.media.adopt.failed',
    'field.submission.media.adopt.retry_scheduled',
    true
  ),
  (
    'field.submission.finalize',
    'field.submission.finalize.sync',
    'field.submission.finalize.accepted',
    'field.submission.finalize.succeeded',
    'field.submission.finalize.failed',
    'field.submission.finalize.retry_scheduled',
    true
  );

create or replace function public.create_field_media_upload_session_v1(
  p_submission_resource_id uuid,
  p_expected_current_revision bigint,
  p_slot_number integer,
  p_original_filename text,
  p_mime_type text,
  p_expected_byte_size bigint,
  p_expected_sha256 text,
  p_idempotency_key text,
  p_ttl_seconds integer default 86400,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  current_revision bigint,
  submission_state text,
  media_intake_id uuid,
  slot_number integer,
  attempt_number integer,
  media_upload_session_id uuid,
  media_upload_state text,
  part_size_bytes integer,
  total_parts integer,
  expires_at timestamptz,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media', 'platform_private', 'extensions'
as $function$
declare
  v_actor uuid;
  v_field editorial.field_submissions%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
  v_request jsonb;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_attempt integer;
  v_intake_id uuid;
  v_media_key text;
  v_session jsonb;
  v_existing_intake editorial.field_submission_media_intakes%rowtype;
  v_existing_session media.upload_sessions%rowtype;
begin
  select context.actor_user_id
  into v_actor
  from platform_private.command_actor_context() context;

  if not public.current_user_has_capability('submit_field_capture') then
    raise exception
      using errcode = '42501',
            message = 'Field Submission permission is required.';
  end if;

  if p_submission_resource_id is null
     or p_expected_current_revision is null
     or p_expected_current_revision < 1
     or p_slot_number is null
     or p_slot_number < 1
  then
    raise exception
      using errcode = '22023',
            message = 'Field Submission, revision, and positive Media slot are required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023',
            message = 'idempotency_key is invalid.';
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private'
  for update of field;

  if not found then
    raise exception
      using errcode = 'P0002',
            message = 'The Field Submission does not exist for this contributor.';
  end if;

  v_request := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'expected_current_revision', p_expected_current_revision,
    'slot_number', p_slot_number,
    'original_filename', btrim(coalesce(p_original_filename, '')),
    'mime_type', lower(btrim(coalesce(p_mime_type, ''))),
    'expected_byte_size', p_expected_byte_size,
    'expected_sha256', lower(btrim(coalesce(p_expected_sha256, ''))),
    'ttl_seconds', p_ttl_seconds,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.media.start',
    p_submission_resource_id,
    p_idempotency_key,
    v_request
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
    submission_resource_id := p_submission_resource_id;
    current_revision := nullif(v_read.result_payload ->> 'current_revision', '')::bigint;
    submission_state := v_read.result_payload ->> 'submission_state';
    media_intake_id := nullif(v_read.result_payload ->> 'media_intake_id', '')::uuid;
    slot_number := nullif(v_read.result_payload ->> 'slot_number', '')::integer;
    attempt_number := nullif(v_read.result_payload ->> 'attempt_number', '')::integer;
    media_upload_session_id := nullif(v_read.result_payload ->> 'media_upload_session_id', '')::uuid;
    media_upload_state := v_read.result_payload ->> 'media_upload_state';
    part_size_bytes := nullif(v_read.result_payload ->> 'part_size_bytes', '')::integer;
    total_parts := nullif(v_read.result_payload ->> 'total_parts', '')::integer;
    expires_at := nullif(v_read.result_payload ->> 'expires_at', '')::timestamptz;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_field.current_revision <> p_expected_current_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_revision_changed',
      'The Field Submission changed before Media intake could start.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_field.submission_state not in ('receiving', 'received') then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_media_start_not_allowed',
      'This Field Submission no longer accepts Media intake.',
      jsonb_build_object(
        'submission_state', v_field.submission_state,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  select intake.*
  into v_existing_intake
  from editorial.field_submission_media_intakes intake
  where intake.submission_resource_id = p_submission_resource_id
    and intake.slot_number = p_slot_number
    and intake.intake_state in ('active', 'verified')
  order by intake.attempt_number desc
  limit 1
  for update;

  if found then
    select session_row.*
    into v_existing_session
    from media.upload_sessions session_row
    where session_row.id = v_existing_intake.media_upload_session_id
    for update;

    if v_existing_intake.intake_state = 'active'
       and v_existing_session.state = 'created'
       and v_existing_session.expires_at <= now()
    then
      update media.upload_sessions
      set
        state = 'expired',
        last_error = 'Field upload session expired before verification',
        expired_at = now(),
        updated_at = now()
      where id = v_existing_session.id;

      update editorial.field_submission_media_intakes
      set
        intake_state = 'expired',
        expired_at = now(),
        updated_at = now()
      where id = v_existing_intake.id;

      insert into editorial.field_submission_events (
        submission_resource_id,
        event_type,
        actor_user_id,
        media_intake_id,
        reason,
        prior_state,
        resulting_state,
        correlation_id
      )
      values (
        p_submission_resource_id,
        'media_intake_expired',
        v_actor,
        v_existing_intake.id,
        'Field Media upload-session TTL expired',
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        v_correlation_id
      );

    elsif v_existing_intake.intake_state = 'active'
       and v_existing_session.state = 'expired'
    then
      update editorial.field_submission_media_intakes
      set
        intake_state = 'expired',
        expired_at = coalesce(v_existing_session.expired_at, now()),
        updated_at = now()
      where id = v_existing_intake.id;

      insert into editorial.field_submission_events (
        submission_resource_id,
        event_type,
        actor_user_id,
        media_intake_id,
        reason,
        prior_state,
        resulting_state,
        correlation_id
      )
      values (
        p_submission_resource_id,
        'media_intake_expired',
        v_actor,
        v_existing_intake.id,
        'Media authority reports Field intake attempt expired',
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        v_correlation_id
      );

    elsif v_existing_intake.intake_state = 'active'
       and v_existing_session.state in ('failed', 'cancelled')
    then
      update editorial.field_submission_media_intakes
      set
        intake_state = case
          when v_existing_session.state = 'cancelled'
            then 'cancelled'
          else 'superseded'
        end,
        cancelled_at = case
          when v_existing_session.state = 'cancelled'
            then coalesce(v_existing_session.cancelled_at, now())
          else null
        end,
        superseded_at = case
          when v_existing_session.state = 'failed'
            then now()
          else null
        end,
        updated_at = now()
      where id = v_existing_intake.id;

    elsif v_existing_session.state = 'verified'
    then
      if v_existing_intake.intake_state = 'active' then
        update editorial.field_submission_media_intakes
        set
          intake_state = 'verified',
          verified_at = coalesce(v_existing_session.verified_at, now()),
          updated_at = now()
        where id = v_existing_intake.id;

        insert into editorial.field_submission_events (
          submission_resource_id,
          event_type,
          actor_user_id,
          media_intake_id,
          prior_state,
          resulting_state,
          correlation_id
        )
        values (
          p_submission_resource_id,
          'media_verified',
          v_actor,
          v_existing_intake.id,
          editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
          editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
          v_correlation_id
        );
      end if;

      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'field_media_verified_attempt_requires_adoption',
        'The verified Field Media attempt must be adopted before another attempt starts.',
        jsonb_build_object(
          'media_intake_id', v_existing_intake.id,
          'media_upload_session_id', v_existing_intake.media_upload_session_id
        )
      );

      command_receipt_id := v_begin.command_receipt_id;
      receipt_status := 'rejected';
      submission_resource_id := p_submission_resource_id;
      current_revision := v_field.current_revision;
      submission_state := v_field.submission_state;
      media_intake_id := v_existing_intake.id;
      media_upload_session_id := v_existing_intake.media_upload_session_id;
      media_upload_state := 'verified';
      idempotent_replay := false;
      return next;
      return;

    else
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'field_media_attempt_already_active',
        'A Field Media intake attempt is already active for this slot.',
        jsonb_build_object(
          'media_intake_id', v_existing_intake.id,
          'media_upload_session_id', v_existing_intake.media_upload_session_id,
          'intake_state', v_existing_intake.intake_state,
          'media_upload_state', v_existing_session.state
        )
      );

      command_receipt_id := v_begin.command_receipt_id;
      receipt_status := 'rejected';
      submission_resource_id := p_submission_resource_id;
      current_revision := v_field.current_revision;
      submission_state := v_field.submission_state;
      media_intake_id := v_existing_intake.id;
      media_upload_session_id := v_existing_intake.media_upload_session_id;
      media_upload_state := v_existing_session.state;
      idempotent_replay := false;
      return next;
      return;
    end if;
  end if;

  if exists (
    select 1
    from editorial.field_submission_media_intakes intake
    where intake.submission_resource_id = p_submission_resource_id
      and intake.slot_number = p_slot_number
      and intake.intake_state = 'adopted'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_media_slot_already_adopted',
      'This Field Submission slot already has its canonical original.',
      jsonb_build_object('slot_number', p_slot_number)
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  select coalesce(max(intake.attempt_number), 0) + 1
  into v_attempt
  from editorial.field_submission_media_intakes intake
  where intake.submission_resource_id = p_submission_resource_id
    and intake.slot_number = p_slot_number;

  v_intake_id := extensions.gen_random_uuid();

  v_media_key :=
    'field:' ||
    substr(
      md5(
        p_submission_resource_id::text ||
        ':' ||
        p_slot_number::text ||
        ':' ||
        p_idempotency_key
      ),
      1,
      32
    );

  v_session := media.create_field_video_upload_session_v1(
    v_actor,
    p_submission_resource_id,
    p_slot_number,
    v_attempt,
    v_media_key,
    p_original_filename,
    p_mime_type,
    p_expected_byte_size,
    p_expected_sha256,
    p_ttl_seconds,
    v_correlation_id
  );

  insert into editorial.field_submission_media_intakes (
    id,
    submission_resource_id,
    slot_number,
    attempt_number,
    media_upload_session_id,
    usage_link_id,
    intake_state,
    created_by,
    correlation_id
  )
  values (
    v_intake_id,
    p_submission_resource_id,
    p_slot_number,
    v_attempt,
    (v_session ->> 'session_id')::uuid,
    null,
    'active',
    v_actor,
    v_correlation_id
  );

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    command_receipt_id,
    media_intake_id,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_submission_resource_id,
    'upload_session_attached',
    v_actor,
    v_begin.command_receipt_id,
    v_intake_id,
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    v_correlation_id
  );

  v_result := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'current_revision', v_field.current_revision,
    'submission_state', v_field.submission_state,
    'media_intake_id', v_intake_id,
    'slot_number', p_slot_number,
    'attempt_number', v_attempt,
    'media_upload_session_id', v_session ->> 'session_id',
    'media_upload_state', v_session ->> 'state',
    'part_size_bytes', v_session ->> 'part_size_bytes',
    'total_parts', v_session ->> 'total_parts',
    'expires_at', v_session ->> 'expires_at',
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  submission_resource_id := p_submission_resource_id;
  current_revision := v_field.current_revision;
  submission_state := v_field.submission_state;
  media_intake_id := v_intake_id;
  slot_number := p_slot_number;
  attempt_number := v_attempt;
  media_upload_session_id := (v_session ->> 'session_id')::uuid;
  media_upload_state := v_session ->> 'state';
  part_size_bytes := (v_session ->> 'part_size_bytes')::integer;
  total_parts := (v_session ->> 'total_parts')::integer;
  expires_at := (v_session ->> 'expires_at')::timestamptz;
  idempotent_replay := false;
  return next;
end;
$function$;


create or replace function public.get_field_media_receiver_session_v1(
  p_actor_id uuid,
  p_submission_resource_id uuid,
  p_media_intake_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media'
as $function$
declare
  v_intake editorial.field_submission_media_intakes%rowtype;
  v_session media.upload_sessions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using errcode = '42501',
            message = 'Service-role access is required.';
  end if;

  perform editorial.assert_field_media_actor_v1(
    p_actor_id,
    p_submission_resource_id,
    p_media_intake_id,
    'submit_field_capture'
  );

  select intake.*
  into v_intake
  from editorial.field_submission_media_intakes intake
  where intake.id = p_media_intake_id
    and intake.submission_resource_id = p_submission_resource_id;

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = v_intake.media_upload_session_id
    and session_row.actor_id = p_actor_id;

  if not found then
    raise exception 'Bound Field Media upload session does not exist.';
  end if;

  return jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'media_intake_id', v_intake.id,
    'slot_number', v_intake.slot_number,
    'attempt_number', v_intake.attempt_number,
    'intake_state', v_intake.intake_state,
    'session_id', v_session.id,
    'session_state', v_session.state,
    'storage_provider', v_session.storage_provider,
    'storage_namespace', v_session.storage_namespace,
    'storage_path', v_session.storage_path,
    'original_filename', v_session.original_filename,
    'mime_type', v_session.mime_type,
    'expected_byte_size', v_session.expected_byte_size,
    'expected_sha256', v_session.expected_sha256,
    'part_size_bytes', v_session.part_size_bytes,
    'total_parts', v_session.total_parts,
    'expires_at', v_session.expires_at,
    'correlation_id', v_session.correlation_id
  );
end;
$function$;

create or replace function public.record_field_media_upload_resume_v1(
  p_actor_id uuid,
  p_submission_resource_id uuid,
  p_media_intake_id uuid,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media', 'extensions'
as $function$
declare
  v_intake editorial.field_submission_media_intakes%rowtype;
  v_session media.upload_sessions%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using errcode = '42501',
            message = 'Service-role access is required.';
  end if;

  perform editorial.assert_field_media_actor_v1(
    p_actor_id,
    p_submission_resource_id,
    p_media_intake_id,
    'submit_field_capture'
  );

  select intake.*
  into v_intake
  from editorial.field_submission_media_intakes intake
  where intake.id = p_media_intake_id
  for update;

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = v_intake.media_upload_session_id
    and session_row.actor_id = p_actor_id;

  if v_intake.intake_state not in ('active', 'verified')
     or v_session.state not in ('created', 'verified')
  then
    raise exception
      'Only an active or verified Field Media intake may receive a fresh upload capability.';
  end if;

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    media_intake_id,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_submission_resource_id,
    'upload_resumed',
    p_actor_id,
    p_media_intake_id,
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    v_correlation_id
  );

  return jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'media_intake_id', p_media_intake_id,
    'media_upload_session_id', v_session.id,
    'intake_state', v_intake.intake_state,
    'media_upload_state', v_session.state,
    'correlation_id', v_correlation_id
  );
end;
$function$;

create or replace function public.sync_field_media_intake_v1(
  p_actor_id uuid,
  p_submission_resource_id uuid,
  p_media_intake_id uuid,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media', 'extensions'
as $function$
declare
  v_intake editorial.field_submission_media_intakes%rowtype;
  v_session media.upload_sessions%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
  v_new_state text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      using errcode = '42501',
            message = 'Service-role access is required.';
  end if;

  perform editorial.assert_field_media_actor_v1(
    p_actor_id,
    p_submission_resource_id,
    p_media_intake_id,
    'submit_field_capture'
  );

  select intake.*
  into v_intake
  from editorial.field_submission_media_intakes intake
  where intake.id = p_media_intake_id
  for update;

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = v_intake.media_upload_session_id
    and session_row.actor_id = p_actor_id
  for update;

  if v_intake.intake_state in (
    'adopted', 'cancelled', 'expired', 'superseded'
  ) then
    return jsonb_build_object(
      'submission_resource_id', p_submission_resource_id,
      'media_intake_id', v_intake.id,
      'intake_state', v_intake.intake_state,
      'media_upload_session_id', v_session.id,
      'media_upload_state', v_session.state,
      'correlation_id', v_correlation_id
    );
  end if;

  if v_session.state = 'created'
     and v_session.expires_at <= now()
  then
    update media.upload_sessions
    set
      state = 'expired',
      last_error = 'Field upload session expired before verification',
      expired_at = now(),
      updated_at = now()
    where id = v_session.id;

    v_session.state := 'expired';
    v_session.expired_at := now();
  end if;

  v_new_state := case v_session.state
    when 'verified' then 'verified'
    when 'expired' then 'expired'
    when 'cancelled' then 'cancelled'
    when 'failed' then 'superseded'
    else v_intake.intake_state
  end;

  if v_new_state is distinct from v_intake.intake_state then
    update editorial.field_submission_media_intakes
    set
      intake_state = v_new_state,
      verified_at = case
        when v_new_state = 'verified'
          then coalesce(v_session.verified_at, now())
        else verified_at
      end,
      expired_at = case
        when v_new_state = 'expired'
          then coalesce(v_session.expired_at, now())
        else expired_at
      end,
      cancelled_at = case
        when v_new_state = 'cancelled'
          then coalesce(v_session.cancelled_at, now())
        else cancelled_at
      end,
      superseded_at = case
        when v_new_state = 'superseded'
          then now()
        else superseded_at
      end,
      updated_at = now()
    where id = v_intake.id;

    if v_new_state = 'verified' then
      insert into editorial.field_submission_events (
        submission_resource_id,
        event_type,
        actor_user_id,
        media_intake_id,
        prior_state,
        resulting_state,
        correlation_id
      )
      values (
        p_submission_resource_id,
        'media_verified',
        p_actor_id,
        p_media_intake_id,
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        v_correlation_id
      );
    elsif v_new_state = 'expired' then
      insert into editorial.field_submission_events (
        submission_resource_id,
        event_type,
        actor_user_id,
        media_intake_id,
        reason,
        prior_state,
        resulting_state,
        correlation_id
      )
      values (
        p_submission_resource_id,
        'media_intake_expired',
        p_actor_id,
        p_media_intake_id,
        'Media upload session expired',
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
        v_correlation_id
      );
    end if;
  end if;

  select intake.*
  into v_intake
  from editorial.field_submission_media_intakes intake
  where intake.id = p_media_intake_id;

  return jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'media_intake_id', v_intake.id,
    'intake_state', v_intake.intake_state,
    'media_upload_session_id', v_session.id,
    'media_upload_state', v_session.state,
    'verified_at', v_intake.verified_at,
    'expired_at', v_intake.expired_at,
    'correlation_id', v_correlation_id
  );
end;
$function$;

create or replace function public.adopt_verified_field_media_upload_session_v1(
  p_submission_resource_id uuid,
  p_expected_current_revision bigint,
  p_media_intake_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  current_revision bigint,
  submission_state text,
  media_intake_id uuid,
  media_upload_session_id uuid,
  media_asset_id uuid,
  media_asset_revision_id uuid,
  media_file_object_id uuid,
  media_usage_link_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media', 'platform_private', 'extensions'
as $function$
declare
  v_actor uuid;
  v_field editorial.field_submissions%rowtype;
  v_intake editorial.field_submission_media_intakes%rowtype;
  v_session media.upload_sessions%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
  v_request jsonb;
  v_begin record;
  v_read record;
  v_media record;
  v_result jsonb;
  v_title text;
  v_prior jsonb;
begin
  select context.actor_user_id
  into v_actor
  from platform_private.command_actor_context() context;

  if not public.current_user_has_capability('submit_field_capture') then
    raise exception
      using errcode = '42501',
            message = 'Field Submission permission is required.';
  end if;

  if p_submission_resource_id is null
     or p_expected_current_revision is null
     or p_expected_current_revision < 1
     or p_media_intake_id is null
  then
    raise exception
      using errcode = '22023',
            message = 'Field Submission, expected revision, and Media intake are required.';
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private'
  for update of field;

  if not found then
    raise exception
      using errcode = 'P0002',
            message = 'The Field Submission does not exist for this contributor.';
  end if;

  perform editorial.assert_field_media_actor_v1(
    v_actor,
    p_submission_resource_id,
    p_media_intake_id,
    'submit_field_capture'
  );

  select intake.*
  into v_intake
  from editorial.field_submission_media_intakes intake
  where intake.id = p_media_intake_id
    and intake.submission_resource_id = p_submission_resource_id
  for update;

  select session_row.*
  into v_session
  from media.upload_sessions session_row
  where session_row.id = v_intake.media_upload_session_id
    and session_row.actor_id = v_actor
  for update;

  v_request := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'expected_current_revision', p_expected_current_revision,
    'media_intake_id', p_media_intake_id,
    'media_upload_session_id', v_session.id,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.media.adopt',
    p_submission_resource_id,
    p_idempotency_key,
    v_request
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
    submission_resource_id := p_submission_resource_id;
    current_revision := nullif(v_read.result_payload ->> 'current_revision', '')::bigint;
    submission_state := v_read.result_payload ->> 'submission_state';
    media_intake_id := nullif(v_read.result_payload ->> 'media_intake_id', '')::uuid;
    media_upload_session_id := nullif(v_read.result_payload ->> 'media_upload_session_id', '')::uuid;
    media_asset_id := nullif(v_read.result_payload ->> 'media_asset_id', '')::uuid;
    media_asset_revision_id := nullif(v_read.result_payload ->> 'media_asset_revision_id', '')::uuid;
    media_file_object_id := nullif(v_read.result_payload ->> 'media_file_object_id', '')::uuid;
    media_usage_link_id := nullif(v_read.result_payload ->> 'media_usage_link_id', '')::uuid;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_field.current_revision <> p_expected_current_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_revision_changed',
      'The Field Submission changed before Media adoption could be applied.',
      jsonb_build_object('current_revision', v_field.current_revision)
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    media_intake_id := p_media_intake_id;
    media_upload_session_id := v_session.id;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_field.submission_state not in ('receiving', 'received') then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_media_adoption_not_allowed',
      'This Field Submission no longer accepts Media adoption.',
      jsonb_build_object('submission_state', v_field.submission_state)
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    media_intake_id := p_media_intake_id;
    media_upload_session_id := v_session.id;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_intake.intake_state = 'adopted'
     or v_intake.usage_link_id is not null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_media_intake_already_adopted',
      'This Field Media intake is already adopted.',
      jsonb_build_object('media_intake_id', v_intake.id)
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    media_intake_id := p_media_intake_id;
    media_upload_session_id := v_session.id;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_session.state <> 'verified'
     or v_session.file_object_id is null
     or v_session.mime_type not like 'video/%'
     or v_session.storage_path not like 'masters/video/%'
     or not exists (
       select 1
       from media.file_objects file_object
       where file_object.id = v_session.file_object_id
         and file_object.verification_state = 'verified'
         and file_object.storage_provider = 'lightsail_media'
         and file_object.storage_path = v_session.storage_path
         and file_object.byte_size = v_session.verified_byte_size
         and file_object.sha256 = v_session.verified_sha256
     )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_media_not_verified',
      'The Field Media upload is not verified against its canonical file identity.',
      jsonb_build_object(
        'media_intake_id', v_intake.id,
        'media_upload_session_id', v_session.id,
        'media_upload_state', v_session.state
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    media_intake_id := p_media_intake_id;
    media_upload_session_id := v_session.id;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_intake.intake_state = 'active' then
    update editorial.field_submission_media_intakes
    set
      intake_state = 'verified',
      verified_at = coalesce(v_session.verified_at, now()),
      updated_at = now()
    where id = v_intake.id;

    insert into editorial.field_submission_events (
      submission_resource_id,
      event_type,
      actor_user_id,
      media_intake_id,
      prior_state,
      resulting_state,
      correlation_id
    )
    values (
      p_submission_resource_id,
      'media_verified',
      v_actor,
      v_intake.id,
      editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
      editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
      v_correlation_id
    );

    v_intake.intake_state := 'verified';
    v_intake.verified_at := coalesce(v_session.verified_at, now());
  end if;

  if v_intake.intake_state <> 'verified' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_media_intake_not_adoptable',
      'The Field Media intake is not eligible for canonical adoption.',
      jsonb_build_object('intake_state', v_intake.intake_state)
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    media_intake_id := p_media_intake_id;
    media_upload_session_id := v_session.id;
    idempotent_replay := false;
    return next;
    return;
  end if;

  v_title := coalesce(
    nullif(
      regexp_replace(
        v_session.original_filename,
        '\.[^.]+$',
        ''
      ),
      ''
    ),
    'Field Submission video'
  );

  select *
  into v_media
  from media.create_protected_field_original_v1(
    v_actor,
    p_submission_resource_id,
    v_intake.slot_number,
    v_session.file_object_id,
    v_title,
    v_field.declared_sensitivity,
    v_field.source_protection_request,
    v_field.embargo_request_mode,
    v_field.requested_embargo_until,
    v_correlation_id
  );

  update editorial.field_submission_media_intakes
  set
    usage_link_id = v_media.usage_link_id,
    intake_state = 'adopted',
    verified_at = coalesce(verified_at, v_session.verified_at, now()),
    adopted_at = now(),
    updated_at = now()
  where id = v_intake.id;

  v_prior := editorial.field_submission_state_snapshot_v1(
    p_submission_resource_id
  );

  if v_field.submission_state = 'receiving' then
    update editorial.field_submissions as field
    set
      submission_state = 'received',
      current_revision = field.current_revision + 1,
      received_at = now(),
      updated_by = v_actor,
      updated_at = now()
    where field.resource_id = p_submission_resource_id;
  end if;

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    command_receipt_id,
    media_intake_id,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_submission_resource_id,
    'media_attached',
    v_actor,
    v_begin.command_receipt_id,
    v_intake.id,
    v_prior,
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    v_correlation_id
  );

  if v_field.submission_state = 'receiving' then
    insert into editorial.field_submission_events (
      submission_resource_id,
      event_type,
      actor_user_id,
      command_receipt_id,
      media_intake_id,
      prior_state,
      resulting_state,
      correlation_id
    )
    values (
      p_submission_resource_id,
      'submission_received',
      v_actor,
      v_begin.command_receipt_id,
      v_intake.id,
      v_prior,
      editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
      v_correlation_id
    );
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  where field.resource_id = p_submission_resource_id;

  v_result := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'current_revision', v_field.current_revision,
    'submission_state', v_field.submission_state,
    'media_intake_id', v_intake.id,
    'media_upload_session_id', v_session.id,
    'media_asset_id', v_media.asset_id,
    'media_asset_revision_id', v_media.asset_revision_id,
    'media_file_object_id', v_session.file_object_id,
    'media_usage_link_id', v_media.usage_link_id,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  submission_resource_id := p_submission_resource_id;
  current_revision := v_field.current_revision;
  submission_state := v_field.submission_state;
  media_intake_id := v_intake.id;
  media_upload_session_id := v_session.id;
  media_asset_id := v_media.asset_id;
  media_asset_revision_id := v_media.asset_revision_id;
  media_file_object_id := v_session.file_object_id;
  media_usage_link_id := v_media.usage_link_id;
  idempotent_replay := false;
  return next;
end;
$function$;


create or replace function public.finalize_field_submission_v1(
  p_submission_resource_id uuid,
  p_expected_current_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  submission_reference text,
  current_revision bigint,
  submission_state text,
  submitted_at timestamptz,
  receipt_issued_at timestamptz,
  adopted_media_count bigint,
  receipt_message text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media', 'platform_private', 'extensions'
as $function$
declare
  v_actor uuid;
  v_field editorial.field_submissions%rowtype;
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
  v_request jsonb;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_prior jsonb;
  v_adopted_count bigint;
  v_required_adopted_count bigint;
begin
  select context.actor_user_id
  into v_actor
  from platform_private.command_actor_context() context;

  if not public.current_user_has_capability('submit_field_capture') then
    raise exception
      using errcode = '42501',
            message = 'Field Submission permission is required.';
  end if;

  if p_submission_resource_id is null
     or p_expected_current_revision is null
     or p_expected_current_revision < 1
  then
    raise exception
      using errcode = '22023',
            message = 'Field Submission and expected revision are required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023',
            message = 'idempotency_key is invalid.';
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private'
  for update of field;

  if not found then
    raise exception
      using errcode = 'P0002',
            message = 'The Field Submission does not exist for this contributor.';
  end if;

  v_request := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'expected_current_revision', p_expected_current_revision,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.finalize',
    p_submission_resource_id,
    p_idempotency_key,
    v_request
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
    submission_resource_id := p_submission_resource_id;
    submission_reference := v_read.result_payload ->> 'submission_reference';
    current_revision := nullif(v_read.result_payload ->> 'current_revision', '')::bigint;
    submission_state := v_read.result_payload ->> 'submission_state';
    submitted_at := nullif(v_read.result_payload ->> 'submitted_at', '')::timestamptz;
    receipt_issued_at := nullif(v_read.result_payload ->> 'receipt_issued_at', '')::timestamptz;
    adopted_media_count := nullif(v_read.result_payload ->> 'adopted_media_count', '')::bigint;
    receipt_message := v_read.result_payload ->> 'receipt_message';
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_field.current_revision <> p_expected_current_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_revision_changed',
      'The Field Submission changed before final submission.',
      jsonb_build_object('current_revision', v_field.current_revision)
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    submission_reference := v_field.submission_reference;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_field.submission_state <> 'received' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_finalize_not_received',
      'Field Submission must be received before final submission.',
      jsonb_build_object('submission_state', v_field.submission_state)
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    submission_reference := v_field.submission_reference;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  perform editorial.validate_field_declarations_v1(
    jsonb_build_object(
      'newsroom_identity_mode', v_field.newsroom_identity_mode,
      'public_attribution_preference', v_field.public_attribution_preference,
      'contact_preference', v_field.contact_preference,
      'rights_declaration', v_field.rights_declaration,
      'rights_declaration_detail', v_field.rights_declaration_detail,
      'consent_declaration', v_field.consent_declaration,
      'consent_declaration_detail', v_field.consent_declaration_detail,
      'declared_sensitivity', v_field.declared_sensitivity,
      'source_protection_request', v_field.source_protection_request,
      'embargo_request_mode', v_field.embargo_request_mode,
      'requested_embargo_until', v_field.requested_embargo_until,
      'location_mode', v_field.location_mode,
      'location_description', v_field.location_description,
      'content_captured_at', v_field.content_captured_at,
      'intake_notes', v_field.intake_notes
    ),
    true
  );

  if exists (
    select 1
    from editorial.field_submission_media_intakes intake
    where intake.submission_resource_id = p_submission_resource_id
      and intake.intake_state in ('active', 'verified')
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_media_intake_in_progress',
      'Complete or cancel all started Field Media attempts before final submission.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    submission_reference := v_field.submission_reference;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  select
    count(*) filter (where intake.slot_number = 1),
    count(*)
  into
    v_required_adopted_count,
    v_adopted_count
  from editorial.field_submission_media_intakes intake
  join media.usage_links usage
    on usage.id = intake.usage_link_id
  join media.assets asset
    on asset.id = usage.asset_id
  join media.asset_revisions revision
    on revision.id = usage.asset_revision_id
   and revision.asset_id = asset.id
  join media.file_objects file_object
    on file_object.id = revision.original_file_object_id
  where intake.submission_resource_id = p_submission_resource_id
    and intake.intake_state = 'adopted'
    and usage.target_authority = 'editorial'
    and usage.target_kind = 'field_submission'
    and usage.target_id = p_submission_resource_id
    and usage.usage_role = 'field_original'
    and usage.usage_state = 'active'
    and usage.resolution_mode = 'exact_revision'
    and asset.asset_purpose = 'field_original'
    and asset.asset_kind = 'video'
    and file_object.verification_state = 'verified';

  if v_required_adopted_count <> 1 then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_required_media_missing',
      'Field Submission requires one adopted verified original before final submission.',
      jsonb_build_object(
        'adopted_required_media_count', v_required_adopted_count,
        'adopted_media_count', v_adopted_count
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    submission_reference := v_field.submission_reference;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    adopted_media_count := v_adopted_count;
    idempotent_replay := false;
    return next;
    return;
  end if;

  v_prior := editorial.field_submission_state_snapshot_v1(
    p_submission_resource_id
  );

  update editorial.field_submissions as field
  set
    submission_state = 'submitted',
    current_revision = field.current_revision + 1,
    submitted_at = now(),
    receipt_issued_at = now(),
    updated_by = v_actor,
    updated_at = now()
  where field.resource_id = p_submission_resource_id;

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    command_receipt_id,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_submission_resource_id,
    'submission_finalized',
    v_actor,
    v_begin.command_receipt_id,
    v_prior,
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    v_correlation_id
  );

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    command_receipt_id,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_submission_resource_id,
    'receipt_issued',
    v_actor,
    v_begin.command_receipt_id,
    v_prior,
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    v_correlation_id
  );

  select field.*
  into v_field
  from editorial.field_submissions field
  where field.resource_id = p_submission_resource_id;

  v_result := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'submission_reference', v_field.submission_reference,
    'current_revision', v_field.current_revision,
    'submission_state', v_field.submission_state,
    'submitted_at', v_field.submitted_at,
    'receipt_issued_at', v_field.receipt_issued_at,
    'adopted_media_count', v_adopted_count,
    'receipt_message', 'We received your submission for review.',
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  submission_resource_id := p_submission_resource_id;
  submission_reference := v_field.submission_reference;
  current_revision := v_field.current_revision;
  submission_state := v_field.submission_state;
  submitted_at := v_field.submitted_at;
  receipt_issued_at := v_field.receipt_issued_at;
  adopted_media_count := v_adopted_count;
  receipt_message := 'We received your submission for review.';
  idempotent_replay := false;
  return next;
end;
$function$;

create or replace function public.cancel_field_submission_v1(
  p_submission_resource_id uuid,
  p_expected_current_revision bigint,
  p_idempotency_key text,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  current_revision bigint,
  submission_state text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media', 'platform_private', 'extensions'
as $function$
declare
  v_actor uuid;
  v_field editorial.field_submissions%rowtype;
  v_intake editorial.field_submission_media_intakes%rowtype;
  v_session media.upload_sessions%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_correlation_id uuid := coalesce(
    p_correlation_id,
    extensions.gen_random_uuid()
  );
  v_request jsonb;
  v_begin record;
  v_read record;
  v_prior jsonb;
  v_result jsonb;
  v_attempt record;
  v_blocking record;
begin
  select context.actor_user_id
  into v_actor
  from platform_private.command_actor_context() context;

  if not public.current_user_has_capability('submit_field_capture') then
    raise exception
      using errcode = '42501',
            message = 'Field Submission permission is required.';
  end if;

  if p_submission_resource_id is null
     or p_expected_current_revision is null
     or p_expected_current_revision < 1
  then
    raise exception
      using errcode = '22023',
            message = 'Field Submission and expected revision are required.';
  end if;

  if length(coalesce(v_reason, '')) > 4000 then
    raise exception
      using errcode = '22023',
            message = 'Field cancellation reason is too long.';
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private'
  for update of field;

  if not found then
    raise exception
      using errcode = 'P0002',
            message = 'The Field Submission does not exist for this contributor.';
  end if;

  v_request := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'expected_current_revision', p_expected_current_revision,
    'reason', v_reason,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.cancel',
    p_submission_resource_id,
    p_idempotency_key,
    v_request
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
    submission_resource_id := p_submission_resource_id;
    current_revision := nullif(v_read.result_payload ->> 'current_revision', '')::bigint;
    submission_state := v_read.result_payload ->> 'submission_state';
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_field.current_revision <> p_expected_current_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_revision_changed',
      'The Field Submission changed before cancellation could be applied.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_field.submission_state <> 'receiving' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_cancellation_not_allowed',
      'Cancellation is not available after canonical Media adoption or final submission.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id,
        'submission_state', v_field.submission_state,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  perform 1
  from editorial.field_submission_media_intakes intake
  join media.upload_sessions session_row
    on session_row.id = intake.media_upload_session_id
  where intake.submission_resource_id = p_submission_resource_id
    and intake.intake_state in ('active', 'verified', 'adopted')
  for update of intake, session_row;

  select
    intake.id as media_intake_id,
    intake.intake_state,
    session_row.state as media_upload_state
  into v_blocking
  from editorial.field_submission_media_intakes intake
  join media.upload_sessions session_row
    on session_row.id = intake.media_upload_session_id
  where intake.submission_resource_id = p_submission_resource_id
    and (
      intake.intake_state in ('verified', 'adopted')
      or session_row.state = 'verified'
      or intake.usage_link_id is not null
    )
  order by intake.slot_number, intake.attempt_number desc
  limit 1;

  if found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_cancellation_after_verified_media_not_allowed',
      'Verified or adopted Field Media cannot be deleted by contributor cancellation.',
      jsonb_build_object(
        'media_intake_id', v_blocking.media_intake_id,
        'intake_state', v_blocking.intake_state,
        'media_upload_state', v_blocking.media_upload_state
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  for v_attempt in
    select
      intake.id as media_intake_id,
      intake.intake_state,
      session_row.id as media_upload_session_id,
      session_row.state as media_upload_state,
      session_row.cancelled_at as media_cancelled_at,
      session_row.expired_at as media_expired_at
    from editorial.field_submission_media_intakes intake
    join media.upload_sessions session_row
      on session_row.id = intake.media_upload_session_id
    where intake.submission_resource_id = p_submission_resource_id
      and intake.intake_state = 'active'
    order by intake.slot_number, intake.attempt_number desc
  loop
    if v_attempt.media_upload_state = 'created' then
      perform media.cancel_field_upload_session_v1(
        v_actor,
        v_attempt.media_upload_session_id,
        coalesce(v_reason, 'Field Submission cancelled before Media adoption')
      );

      update editorial.field_submission_media_intakes
      set
        intake_state = 'cancelled',
        cancelled_at = now(),
        updated_at = now()
      where id = v_attempt.media_intake_id;

    elsif v_attempt.media_upload_state = 'cancelled' then
      update editorial.field_submission_media_intakes
      set
        intake_state = 'cancelled',
        cancelled_at = coalesce(v_attempt.media_cancelled_at, now()),
        updated_at = now()
      where id = v_attempt.media_intake_id;

    elsif v_attempt.media_upload_state = 'expired' then
      update editorial.field_submission_media_intakes
      set
        intake_state = 'expired',
        expired_at = coalesce(v_attempt.media_expired_at, now()),
        updated_at = now()
      where id = v_attempt.media_intake_id;

    elsif v_attempt.media_upload_state = 'failed' then
      update editorial.field_submission_media_intakes
      set
        intake_state = 'superseded',
        superseded_at = now(),
        updated_at = now()
      where id = v_attempt.media_intake_id;

    else
      raise exception
        'Unexpected Field Media upload state during cancellation: %',
        v_attempt.media_upload_state;
    end if;
  end loop;

  v_prior := editorial.field_submission_state_snapshot_v1(
    p_submission_resource_id
  );

  update editorial.field_submissions as field
  set
    submission_state = 'cancelled',
    current_revision = field.current_revision + 1,
    updated_by = v_actor,
    updated_at = now(),
    cancelled_at = now()
  where field.resource_id = p_submission_resource_id;

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    command_receipt_id,
    media_intake_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_submission_resource_id,
    'submission_cancelled',
    v_actor,
    v_begin.command_receipt_id,
    null,
    v_reason,
    v_prior,
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    v_correlation_id
  );

  select field.*
  into v_field
  from editorial.field_submissions field
  where field.resource_id = p_submission_resource_id;

  v_result := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'current_revision', v_field.current_revision,
    'submission_state', v_field.submission_state,
    'cancelled_at', v_field.cancelled_at,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  submission_resource_id := p_submission_resource_id;
  current_revision := v_field.current_revision;
  submission_state := v_field.submission_state;
  idempotent_replay := false;
  return next;
end;
$function$;

drop function public.get_my_field_submission_v1(uuid);

create function public.get_my_field_submission_v1(
  p_submission_resource_id uuid
)
returns table(
  submission_resource_id uuid,
  submission_reference text,
  submission_state text,
  current_revision bigint,
  newsroom_identity_mode text,
  public_attribution_preference text,
  contact_preference text,
  rights_declaration text,
  rights_declaration_detail text,
  consent_declaration text,
  consent_declaration_detail text,
  declared_sensitivity text,
  source_protection_request text,
  embargo_request_mode text,
  requested_embargo_until timestamptz,
  location_mode text,
  location_description text,
  content_captured_at timestamptz,
  intake_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  received_at timestamptz,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  receipt_issued_at timestamptz,
  media_intake_count bigint,
  adopted_media_count bigint,
  current_media_intake_id uuid,
  current_media_slot_number integer,
  current_media_attempt_number integer,
  current_media_intake_state text,
  current_media_upload_session_id uuid,
  current_media_upload_state text,
  current_media_file_label text,
  current_media_verified_at timestamptz,
  current_media_adopted_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media'
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     or v_actor is null
     or not public.current_user_has_capability('read_own_field_capture')
  then
    raise exception
      using errcode = '42501',
            message = 'Own Field Submission read permission is required.';
  end if;

  return query
  select
    field.resource_id,
    field.submission_reference,
    field.submission_state,
    field.current_revision,
    field.newsroom_identity_mode,
    field.public_attribution_preference,
    field.contact_preference,
    field.rights_declaration,
    field.rights_declaration_detail,
    field.consent_declaration,
    field.consent_declaration_detail,
    field.declared_sensitivity,
    field.source_protection_request,
    field.embargo_request_mode,
    field.requested_embargo_until,
    field.location_mode,
    field.location_description,
    field.content_captured_at,
    field.intake_notes,
    field.created_at,
    field.updated_at,
    field.received_at,
    field.submitted_at,
    field.cancelled_at,
    field.expired_at,
    field.receipt_issued_at,
    (
      select count(*)
      from editorial.field_submission_media_intakes intake
      where intake.submission_resource_id = field.resource_id
    ),
    (
      select count(*)
      from editorial.field_submission_media_intakes intake
      where intake.submission_resource_id = field.resource_id
        and intake.intake_state = 'adopted'
    ),
    current_intake.id,
    current_intake.slot_number,
    current_intake.attempt_number,
    current_intake.intake_state,
    current_intake.media_upload_session_id,
    current_session.state,
    current_session.original_filename,
    current_intake.verified_at,
    current_intake.adopted_at
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  left join lateral (
    select intake.*
    from editorial.field_submission_media_intakes intake
    where intake.submission_resource_id = field.resource_id
    order by
      case intake.intake_state
        when 'active' then 1
        when 'verified' then 2
        when 'adopted' then 3
        else 4
      end,
      intake.slot_number,
      intake.attempt_number desc
    limit 1
  ) current_intake on true
  left join media.upload_sessions current_session
    on current_session.id = current_intake.media_upload_session_id
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private';
end;
$function$;

drop function public.get_field_submission_intake_v1(uuid);

create function public.get_field_submission_intake_v1(
  p_submission_resource_id uuid
)
returns table(
  submission_resource_id uuid,
  submission_reference text,
  submission_state text,
  current_revision bigint,
  newsroom_identity_mode text,
  contributor_user_id uuid,
  contributor_identity_redacted boolean,
  public_attribution_preference text,
  contact_preference text,
  rights_declaration text,
  rights_declaration_detail text,
  consent_declaration text,
  consent_declaration_detail text,
  declared_sensitivity text,
  source_protection_request text,
  embargo_request_mode text,
  requested_embargo_until timestamptz,
  location_mode text,
  location_description text,
  content_captured_at timestamptz,
  intake_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  received_at timestamptz,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  media_intake_count bigint,
  adopted_media_count bigint,
  current_media_intake_id uuid,
  current_media_slot_number integer,
  current_media_attempt_number integer,
  current_media_intake_state text,
  current_media_upload_session_id uuid,
  current_media_upload_state text,
  current_media_usage_link_id uuid,
  current_media_asset_id uuid,
  current_media_asset_revision_id uuid,
  current_media_file_object_id uuid,
  current_media_verified_at timestamptz,
  current_media_adopted_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'media'
as $function$
declare
  v_can_resolve_restricted boolean;
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability('view_field_intake')
  then
    raise exception
      using errcode = '42501',
            message = 'Internal Field intake permission is required.';
  end if;

  v_can_resolve_restricted :=
    public.current_user_has_capability('view_restricted_field_sources');

  return query
  select
    field.resource_id,
    field.submission_reference,
    field.submission_state,
    field.current_revision,
    field.newsroom_identity_mode,
    case
      when field.newsroom_identity_mode = 'restricted'
       and not v_can_resolve_restricted
      then null::uuid
      else field.owner_user_id
    end,
    (
      field.newsroom_identity_mode = 'restricted'
      and not v_can_resolve_restricted
    ),
    field.public_attribution_preference,
    field.contact_preference,
    field.rights_declaration,
    field.rights_declaration_detail,
    field.consent_declaration,
    field.consent_declaration_detail,
    field.declared_sensitivity,
    field.source_protection_request,
    field.embargo_request_mode,
    field.requested_embargo_until,
    field.location_mode,
    field.location_description,
    field.content_captured_at,
    field.intake_notes,
    field.created_at,
    field.updated_at,
    field.received_at,
    field.submitted_at,
    field.cancelled_at,
    field.expired_at,
    (
      select count(*)
      from editorial.field_submission_media_intakes intake
      where intake.submission_resource_id = field.resource_id
    ),
    (
      select count(*)
      from editorial.field_submission_media_intakes intake
      where intake.submission_resource_id = field.resource_id
        and intake.intake_state = 'adopted'
    ),
    current_intake.id,
    current_intake.slot_number,
    current_intake.attempt_number,
    current_intake.intake_state,
    current_intake.media_upload_session_id,
    current_session.state,
    current_intake.usage_link_id,
    current_usage.asset_id,
    current_usage.asset_revision_id,
    current_revision.original_file_object_id,
    current_intake.verified_at,
    current_intake.adopted_at
  from editorial.field_submissions field
  left join lateral (
    select intake.*
    from editorial.field_submission_media_intakes intake
    where intake.submission_resource_id = field.resource_id
    order by
      case intake.intake_state
        when 'active' then 1
        when 'verified' then 2
        when 'adopted' then 3
        else 4
      end,
      intake.slot_number,
      intake.attempt_number desc
    limit 1
  ) current_intake on true
  left join media.upload_sessions current_session
    on current_session.id = current_intake.media_upload_session_id
  left join media.usage_links current_usage
    on current_usage.id = current_intake.usage_link_id
  left join media.asset_revisions current_revision
    on current_revision.id = current_usage.asset_revision_id
  where field.resource_id = p_submission_resource_id;
end;
$function$;

revoke execute
  on function public.create_field_media_upload_session_v1(
       uuid, bigint, integer, text, text, bigint, text, text, integer, uuid
     ),
     public.adopt_verified_field_media_upload_session_v1(
       uuid, bigint, uuid, text, uuid
     ),
     public.finalize_field_submission_v1(
       uuid, bigint, text, uuid
     ),
     public.cancel_field_submission_v1(
       uuid, bigint, text, text, uuid
     ),
     public.get_my_field_submission_v1(uuid),
     public.get_field_submission_intake_v1(uuid)
  from public, anon, service_role;

grant execute
  on function public.create_field_media_upload_session_v1(
       uuid, bigint, integer, text, text, bigint, text, text, integer, uuid
     ),
     public.adopt_verified_field_media_upload_session_v1(
       uuid, bigint, uuid, text, uuid
     ),
     public.finalize_field_submission_v1(
       uuid, bigint, text, uuid
     ),
     public.cancel_field_submission_v1(
       uuid, bigint, text, text, uuid
     ),
     public.get_my_field_submission_v1(uuid),
     public.get_field_submission_intake_v1(uuid)
  to authenticated;

revoke execute
  on function public.get_field_media_receiver_session_v1(uuid, uuid, uuid),
     public.record_field_media_upload_resume_v1(uuid, uuid, uuid, uuid),
     public.sync_field_media_intake_v1(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute
  on function public.get_field_media_receiver_session_v1(uuid, uuid, uuid),
     public.record_field_media_upload_resume_v1(uuid, uuid, uuid, uuid),
     public.sync_field_media_intake_v1(uuid, uuid, uuid, uuid)
  to service_role;

-- No public route, Resource Version, compatibility projection, or Media
-- processing submission is created by Phase 8A.2B.

commit;
