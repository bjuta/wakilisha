-- Phase 8B.6 closure: governed Field Submission -> canonical Source promotion.
--
-- This bridge does not add a Field-owned review system or duplicate Media.
-- It requires an exact submitted Field revision, one adopted protected Field
-- original, and a later accountable Media governance review. It then reuses
-- canonical Source creation and exact-version review submission, while an
-- append-only provenance row preserves the exact Field, Media, governance,
-- Source, and command identities used for promotion.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase-8b6-field-source-promotion-closure',0));

do $preflight$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 113
     or (select max(version) from supabase_migrations.schema_migrations) <> '20260910103000' then
    raise exception 'STOP: Phase 8B.6 Field promotion requires exact 113 / 20260910103000 predecessor authority';
  end if;
  if to_regclass('editorial.field_submissions') is null
     or to_regclass('editorial.field_submission_media_intakes') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_governance_versions') is null
     or to_regclass('editorial.sources') is null
     or to_regclass('editorial.source_versions') is null
     or to_regclass('platform_private.command_types') is null
     or to_regprocedure('public.create_source(jsonb,jsonb,uuid)') is null
     or to_regprocedure('public.submit_source_version_for_review(uuid,uuid,bigint,text,uuid)') is null
     or to_regprocedure('public.review_source_version(uuid,uuid,text,text,text,uuid)') is null
     or to_regprocedure('public.get_field_submission_intake_v2(uuid)') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.read_authenticated_resource_command_result(uuid,boolean)') is null
     or to_regprocedure('platform_private.complete_resource_command(uuid,jsonb)') is null
     or to_regprocedure('platform_private.reject_resource_command(uuid,text,text,jsonb)') is null then
    raise exception 'STOP: accepted Field, Media, Source, or command authority is incomplete';
  end if;
  if to_regclass('editorial.field_submission_source_promotions') is not null
     or to_regprocedure('public.get_field_submission_promotion_state_v1(uuid)') is not null
     or to_regprocedure('public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid)') is not null
     or exists(select 1 from platform_private.command_types where command_type='field.submission.promote.source') then
    raise exception 'STOP: Phase 8B.6 Field promotion authority already exists';
  end if;
end
$preflight$;

create table editorial.field_submission_source_promotions (
  id uuid primary key default gen_random_uuid(),
  submission_resource_id uuid not null references editorial.field_submissions(resource_id) on update restrict on delete restrict,
  submission_revision bigint not null check (submission_revision >= 1),
  media_intake_id uuid not null references editorial.field_submission_media_intakes(id) on update restrict on delete restrict,
  media_usage_link_id uuid not null references media.usage_links(id) on update restrict on delete restrict,
  media_asset_id uuid not null references media.assets(id) on update restrict on delete restrict,
  media_asset_revision_id uuid not null references media.asset_revisions(id) on update restrict on delete restrict,
  media_governance_version_id uuid not null references media.asset_governance_versions(id) on update restrict on delete restrict,
  source_id uuid not null references editorial.sources(id) on update restrict on delete restrict,
  source_version_id uuid not null references editorial.source_versions(id) on update restrict on delete restrict,
  command_receipt_id uuid not null references platform_private.command_receipts(id) on update restrict on delete restrict,
  promoted_by_user_id uuid not null references auth.users(id) on update restrict on delete restrict,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  unique (submission_resource_id, media_intake_id),
  unique (source_id),
  unique (source_version_id),
  unique (command_receipt_id)
);

alter table editorial.field_submission_source_promotions enable row level security;
revoke all on table editorial.field_submission_source_promotions from public,anon,authenticated,service_role;

create function editorial.protect_field_submission_source_promotion_v1()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception 'Field Submission Source promotion provenance is append-only.';
end;
$function$;
revoke all on function editorial.protect_field_submission_source_promotion_v1() from public,anon,authenticated,service_role;

create trigger field_submission_source_promotions_immutable
before update or delete on editorial.field_submission_source_promotions
for each row execute function editorial.protect_field_submission_source_promotion_v1();

insert into platform_private.command_types(
  command_type,job_type,accepted_event_type,success_event_type,failure_event_type,retry_event_type
)
values (
  'field.submission.promote.source',
  'field.submission.promote.source.sync',
  'field.submission.promote.source.accepted',
  'field.submission.promote.source.succeeded',
  'field.submission.promote.source.failed',
  'field.submission.promote.source.retry_scheduled'
);

create function public.get_field_submission_promotion_state_v1(p_submission_resource_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','auth','public','editorial','media'
as $function$
declare
  v_field editorial.field_submissions%rowtype;
  v_can_restricted boolean;
  v_items jsonb;
begin
  if coalesce(auth.role(),'') <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability('view_field_intake') then
    raise exception using errcode='42501',message='Internal Field intake permission is required.';
  end if;

  select * into v_field
  from editorial.field_submissions
  where resource_id=p_submission_resource_id;
  if not found then
    raise exception using errcode='P0002',message='Field Submission not found.';
  end if;

  v_can_restricted:=public.current_user_has_capability('view_restricted_field_sources');
  if v_field.newsroom_identity_mode='restricted' and not v_can_restricted then
    raise exception using errcode='42501',message='Restricted Field source permission is required.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'media_intake_id',i.id,
    'slot_number',i.slot_number,
    'media_asset_id',u.asset_id,
    'media_asset_revision_id',u.asset_revision_id,
    'asset_title',a.title,
    'media_governance_version_id',g.id,
    'media_governance_version_number',g.version_number,
    'media_governance_public_safety_state',g.public_safety_state,
    'media_governance_reviewed',(
      g.version_number > 1
      and g.created_by is not null
      and exists(
        select 1 from media.events e
        where e.asset_id=a.id
          and e.governance_version_id=g.id
          and e.event_type='governance_version_created'
          and e.actor_id is not null
          and nullif(btrim(e.reason),'') is not null
      )
    ),
    'promotion_eligible',(
      v_field.submission_state='submitted'
      and g.version_number > 1
      and g.created_by is not null
      and g.rights_status='needs_clearance'
      and g.consent_status='unknown'
      and g.public_safety_state='internal'
      and g.source_protection_class in ('internal','restricted','confidential')
      and g.retention_state='retain'
      and p.source_id is null
    ),
    'source_id',p.source_id,
    'source_version_id',p.source_version_id,
    'promoted_at',p.created_at
  ) order by i.slot_number,i.id),'[]'::jsonb)
  into v_items
  from editorial.field_submission_media_intakes i
  join media.usage_links u
    on u.id=i.usage_link_id
   and u.target_authority='editorial'
   and u.target_kind='field_submission'
   and u.target_id=i.submission_resource_id
   and u.usage_role='field_original'
   and u.usage_state='active'
   and u.asset_revision_id is not null
  join media.assets a
    on a.id=u.asset_id
   and a.asset_purpose='field_original'
   and a.lifecycle_state='active'
   and a.current_revision_id=u.asset_revision_id
  join media.asset_governance_versions g
    on g.id=a.current_governance_version_id
   and g.asset_id=a.id
  left join editorial.field_submission_source_promotions p
    on p.submission_resource_id=i.submission_resource_id
   and p.media_intake_id=i.id
  where i.submission_resource_id=p_submission_resource_id
    and i.intake_state='adopted';

  return jsonb_build_object(
    'submission_resource_id',v_field.resource_id,
    'submission_reference',v_field.submission_reference,
    'submission_state',v_field.submission_state,
    'current_revision',v_field.current_revision,
    'can_promote_sources',public.current_user_has_capability('manage_sources'),
    'items',v_items
  );
end;
$function$;

create function public.promote_field_submission_to_source_v1(
  p_submission_resource_id uuid,
  p_expected_submission_revision bigint,
  p_media_intake_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  source_id uuid,
  source_version_id uuid,
  source_review_status text,
  media_asset_id uuid,
  media_asset_revision_id uuid,
  media_governance_version_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','auth','public','editorial','media','platform_private','extensions'
as $function$
declare
  v_actor uuid;
  v_field editorial.field_submissions%rowtype;
  v_corr uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
  v_request jsonb;
  v_begin record;
  v_read record;
  v_usage_link_id uuid;
  v_asset_id uuid;
  v_asset_revision_id uuid;
  v_governance_id uuid;
  v_governance_version bigint;
  v_asset_title text;
  v_source jsonb;
  v_source_id uuid;
  v_source_version_id uuid;
  v_result jsonb;
begin
  select actor_user_id into v_actor from platform_private.command_actor_context();
  if v_actor is null
     or not public.current_user_has_capability('view_field_intake')
     or not public.current_user_has_capability('manage_sources') then
    raise exception using errcode='42501',message='Field intake and Source management permissions are required.';
  end if;
  if p_submission_resource_id is null or p_media_intake_id is null
     or p_expected_submission_revision is null or p_expected_submission_revision < 1 then
    raise exception using errcode='22023',message='Field Submission, expected revision, and Media intake are required.';
  end if;

  select * into v_field
  from editorial.field_submissions
  where resource_id=p_submission_resource_id
  for update;
  if not found then raise exception using errcode='P0002',message='Field Submission not found.'; end if;
  if v_field.newsroom_identity_mode='restricted'
     and not public.current_user_has_capability('view_restricted_field_sources') then
    raise exception using errcode='42501',message='Restricted Field source permission is required.';
  end if;

  v_request:=jsonb_build_object(
    'submission_resource_id',p_submission_resource_id,
    'expected_submission_revision',p_expected_submission_revision,
    'media_intake_id',p_media_intake_id,
    'correlation_id',v_corr
  );
  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.promote.source',p_submission_resource_id,p_idempotency_key,v_request
  );
  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id;
    receipt_status:=v_read.receipt_status;
    submission_resource_id:=p_submission_resource_id;
    source_id:=nullif(v_read.result_payload->>'source_id','')::uuid;
    source_version_id:=nullif(v_read.result_payload->>'source_version_id','')::uuid;
    source_review_status:=v_read.result_payload->>'source_review_status';
    media_asset_id:=nullif(v_read.result_payload->>'media_asset_id','')::uuid;
    media_asset_revision_id:=nullif(v_read.result_payload->>'media_asset_revision_id','')::uuid;
    media_governance_version_id:=nullif(v_read.result_payload->>'media_governance_version_id','')::uuid;
    idempotent_replay:=true;
    return next; return;
  end if;

  if v_field.current_revision<>p_expected_submission_revision then
    perform platform_private.reject_resource_command(v_begin.command_receipt_id,'field_revision_changed','The Field Submission changed before promotion could be applied.',jsonb_build_object('current_revision',v_field.current_revision));
    command_receipt_id:=v_begin.command_receipt_id; receipt_status:='rejected'; submission_resource_id:=p_submission_resource_id; idempotent_replay:=false; return next; return;
  end if;
  if v_field.submission_state<>'submitted' then
    perform platform_private.reject_resource_command(v_begin.command_receipt_id,'field_promotion_not_submitted','Only a submitted Field Submission can be promoted.',jsonb_build_object('submission_state',v_field.submission_state));
    command_receipt_id:=v_begin.command_receipt_id; receipt_status:='rejected'; submission_resource_id:=p_submission_resource_id; idempotent_replay:=false; return next; return;
  end if;
  if exists(select 1 from editorial.field_submission_source_promotions p where p.submission_resource_id=p_submission_resource_id and p.media_intake_id=p_media_intake_id) then
    perform platform_private.reject_resource_command(v_begin.command_receipt_id,'field_media_already_promoted','This Field original has already been promoted to a canonical Source.',jsonb_build_object('media_intake_id',p_media_intake_id));
    command_receipt_id:=v_begin.command_receipt_id; receipt_status:='rejected'; submission_resource_id:=p_submission_resource_id; idempotent_replay:=false; return next; return;
  end if;

  select u.id,u.asset_id,u.asset_revision_id,a.current_governance_version_id,g.version_number,a.title
  into v_usage_link_id,v_asset_id,v_asset_revision_id,v_governance_id,v_governance_version,v_asset_title
  from editorial.field_submission_media_intakes i
  join media.usage_links u on u.id=i.usage_link_id
  join media.assets a on a.id=u.asset_id
  join media.asset_governance_versions g on g.id=a.current_governance_version_id and g.asset_id=a.id
  where i.id=p_media_intake_id
    and i.submission_resource_id=p_submission_resource_id
    and i.intake_state='adopted'
    and u.target_authority='editorial'
    and u.target_kind='field_submission'
    and u.target_id=p_submission_resource_id
    and u.usage_role='field_original'
    and u.usage_state='active'
    and u.asset_revision_id is not null
    and a.asset_purpose='field_original'
    and a.lifecycle_state='active'
    and a.current_revision_id=u.asset_revision_id
    and g.version_number>1
    and g.created_by is not null
    and g.rights_status='needs_clearance'
    and g.consent_status='unknown'
    and g.public_safety_state='internal'
    and g.source_protection_class in ('internal','restricted','confidential')
    and g.retention_state='retain'
    and exists(
      select 1 from media.events e
      where e.asset_id=a.id and e.governance_version_id=g.id
        and e.event_type='governance_version_created'
        and e.actor_id is not null and nullif(btrim(e.reason),'') is not null
    )
  for share of i,u,a,g;

  if not found then
    perform platform_private.reject_resource_command(v_begin.command_receipt_id,'field_media_governance_review_required','The exact adopted Field original requires a later accountable Media governance review before promotion.',jsonb_build_object('media_intake_id',p_media_intake_id));
    command_receipt_id:=v_begin.command_receipt_id; receipt_status:='rejected'; submission_resource_id:=p_submission_resource_id; idempotent_replay:=false; return next; return;
  end if;

  v_source:=public.create_source(
    jsonb_strip_nulls(jsonb_build_object(
      'source_type','video_recording',
      'title',coalesce(nullif(btrim(v_asset_title),''),v_field.submission_reference||' Field original'),
      'capture_date',case when v_field.content_captured_at is null then null else v_field.content_captured_at::date::text end,
      'place_text',case when v_field.location_mode='coarse_text' then v_field.location_description else null end,
      'rights_status','needs_clearance',
      'consent_status','unknown',
      'sensitivity',v_field.declared_sensitivity,
      'reliability_note','Promoted from governed Field Submission '||v_field.submission_reference
    )),
    '[]'::jsonb,
    v_corr
  );
  v_source_id:=(v_source->>'source_id')::uuid;
  v_source_version_id:=(v_source->>'source_version_id')::uuid;

  perform public.submit_source_version_for_review(
    v_source_id,v_source_version_id,1,
    'Promoted from governed Field Submission '||v_field.submission_reference,
    v_corr
  );

  insert into editorial.field_submission_source_promotions(
    submission_resource_id,submission_revision,media_intake_id,media_usage_link_id,
    media_asset_id,media_asset_revision_id,media_governance_version_id,
    source_id,source_version_id,command_receipt_id,promoted_by_user_id,correlation_id
  ) values (
    p_submission_resource_id,v_field.current_revision,p_media_intake_id,v_usage_link_id,
    v_asset_id,v_asset_revision_id,v_governance_id,
    v_source_id,v_source_version_id,v_begin.command_receipt_id,v_actor,v_corr
  );

  v_result:=jsonb_build_object(
    'submission_resource_id',p_submission_resource_id,
    'source_id',v_source_id,
    'source_version_id',v_source_version_id,
    'source_review_status','ready_for_review',
    'media_asset_id',v_asset_id,
    'media_asset_revision_id',v_asset_revision_id,
    'media_governance_version_id',v_governance_id,
    'correlation_id',v_corr
  );
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);

  command_receipt_id:=v_begin.command_receipt_id;
  receipt_status:='succeeded';
  submission_resource_id:=p_submission_resource_id;
  source_id:=v_source_id;
  source_version_id:=v_source_version_id;
  source_review_status:='ready_for_review';
  media_asset_id:=v_asset_id;
  media_asset_revision_id:=v_asset_revision_id;
  media_governance_version_id:=v_governance_id;
  idempotent_replay:=false;
  return next;
end;
$function$;

revoke all on function public.get_field_submission_promotion_state_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_field_submission_promotion_state_v1(uuid) to authenticated;
revoke all on function public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.promote_field_submission_to_source_v1(uuid,bigint,uuid,text,uuid) to authenticated;

commit;
