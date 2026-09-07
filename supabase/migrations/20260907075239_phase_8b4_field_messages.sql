-- Phase 8B.4 Candidate B: governed Field contributor <-> newsroom Messages.
--
-- Keeps Field Submission as intake/contact authority and Messages as the only
-- conversation/message authority. Global Messages audience remains internal.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase-8b4-field-messages',0));

do $preflight$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 104
     or (select max(version) from supabase_migrations.schema_migrations) <> '20260907061830' then
    raise exception 'STOP: Candidate B requires exact 104 / 20260907061830 predecessor authority';
  end if;
  if to_regclass('editorial.field_submissions') is null
     or to_regclass('messaging.conversations') is null
     or to_regclass('messaging.message_resource_references') is null
     or to_regprocedure('public.send_message(uuid,text,jsonb,text,uuid,timestamptz)') is null
     or to_regprocedure('public.get_my_message_access()') is null
     or to_regprocedure('messaging.current_human_identity()') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null then
    raise exception 'STOP: accepted Field or Messages authority is incomplete';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='editorial' and table_name='field_submissions' and column_name='follow_up_permission')
     or to_regprocedure('public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)') is not null
     or exists(select 1 from platform_private.command_types where command_type='field.submission.message.start') then
    raise exception 'STOP: Candidate B authority already exists';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Field contact-policy convergence.
-- ---------------------------------------------------------------------------

alter table editorial.field_submissions
  add column follow_up_permission text,
  add column preferred_contact_channel text,
  add column contact_point_id uuid;

-- This is a one-time schema backfill, not a product mutation. Existing
-- terminal Field submissions are intentionally immutable through the normal
-- Phase 8A mutation path, so suspend only that guard for this deterministic
-- compatibility backfill inside the migration transaction.
alter table editorial.field_submissions
  disable trigger field_submissions_protect_mutation;

update editorial.field_submissions
set follow_up_permission = case contact_preference
  when 'no_follow_up' then 'not_allowed'
  else 'allowed'
end,
preferred_contact_channel = null,
contact_point_id = null;

alter table editorial.field_submissions
  enable trigger field_submissions_protect_mutation;

alter table editorial.field_submissions
  alter column follow_up_permission set not null,
  add constraint field_submissions_follow_up_permission_check
    check (follow_up_permission in ('allowed','not_allowed')),
  add constraint field_submissions_preferred_contact_channel_check
    check (preferred_contact_channel is null or preferred_contact_channel in ('messages','email','phone')),
  add constraint field_submissions_contact_policy_shape_check
    check (
      (follow_up_permission='not_allowed' and preferred_contact_channel is null and contact_point_id is null)
      or follow_up_permission='allowed'
    );

create or replace function editorial.sync_field_contact_policy_compat()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if tg_op='INSERT' then
    if new.follow_up_permission is null then
      new.follow_up_permission := case when new.contact_preference='no_follow_up' then 'not_allowed' else 'allowed' end;
    end if;
    if new.follow_up_permission='not_allowed' then
      new.preferred_contact_channel := null;
      new.contact_point_id := null;
      new.contact_preference := 'no_follow_up';
    else
      new.contact_preference := 'account_contact';
    end if;
    return new;
  end if;

  if new.contact_preference is distinct from old.contact_preference
     and new.follow_up_permission is not distinct from old.follow_up_permission
     and new.preferred_contact_channel is not distinct from old.preferred_contact_channel
     and new.contact_point_id is not distinct from old.contact_point_id then
    new.follow_up_permission := case when new.contact_preference='no_follow_up' then 'not_allowed' else 'allowed' end;
    new.preferred_contact_channel := null;
    new.contact_point_id := null;
  elsif new.follow_up_permission is distinct from old.follow_up_permission
        or new.preferred_contact_channel is distinct from old.preferred_contact_channel
        or new.contact_point_id is distinct from old.contact_point_id then
    if new.follow_up_permission='not_allowed' then
      new.preferred_contact_channel := null;
      new.contact_point_id := null;
      new.contact_preference := 'no_follow_up';
    else
      new.contact_preference := 'account_contact';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function editorial.sync_field_contact_policy_compat() from public,anon,authenticated,service_role;
create trigger field_submissions_00_sync_contact_policy
before insert or update on editorial.field_submissions
for each row execute function editorial.sync_field_contact_policy_compat();

create or replace function editorial.protect_field_submission_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog','editorial'
as $function$
declare
  v_state_changed boolean;
  v_declarations_changed boolean;
begin
  if new.resource_id is distinct from old.resource_id
     or new.resource_kind is distinct from old.resource_kind
     or new.submission_reference is distinct from old.submission_reference
     or new.owner_user_id is distinct from old.owner_user_id
     or new.submitter_mode is distinct from old.submitter_mode
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.correlation_id is distinct from old.correlation_id then
    raise exception 'Field Submission identity and creation provenance are immutable.';
  end if;
  if old.submission_state in ('submitted','cancelled','expired') then
    raise exception 'Terminal Field Submission state is immutable in Phase 8A.';
  end if;
  if new.current_revision <> old.current_revision + 1 then
    raise exception 'Field Submission revision must advance exactly once per mutation.';
  end if;
  if new.updated_by is null or new.updated_at < old.updated_at then
    raise exception 'Field Submission update provenance is invalid.';
  end if;

  v_state_changed := new.submission_state is distinct from old.submission_state;
  v_declarations_changed :=
       new.newsroom_identity_mode is distinct from old.newsroom_identity_mode
    or new.public_attribution_preference is distinct from old.public_attribution_preference
    or new.contact_preference is distinct from old.contact_preference
    or new.follow_up_permission is distinct from old.follow_up_permission
    or new.preferred_contact_channel is distinct from old.preferred_contact_channel
    or new.contact_point_id is distinct from old.contact_point_id
    or new.rights_declaration is distinct from old.rights_declaration
    or new.rights_declaration_detail is distinct from old.rights_declaration_detail
    or new.consent_declaration is distinct from old.consent_declaration
    or new.consent_declaration_detail is distinct from old.consent_declaration_detail
    or new.declared_sensitivity is distinct from old.declared_sensitivity
    or new.source_protection_request is distinct from old.source_protection_request
    or new.embargo_request_mode is distinct from old.embargo_request_mode
    or new.requested_embargo_until is distinct from old.requested_embargo_until
    or new.location_mode is distinct from old.location_mode
    or new.location_description is distinct from old.location_description
    or new.content_captured_at is distinct from old.content_captured_at
    or new.intake_notes is distinct from old.intake_notes;

  if v_state_changed then
    if not ((old.submission_state='receiving' and new.submission_state in ('received','cancelled','expired'))
      or (old.submission_state='received' and new.submission_state in ('submitted','cancelled','expired'))) then
      raise exception 'Unsupported Field Submission lifecycle transition from % to %.',old.submission_state,new.submission_state;
    end if;
    if v_declarations_changed then raise exception 'Field lifecycle transitions cannot rewrite contributor declarations.'; end if;
  else
    if new.received_at is distinct from old.received_at
       or new.submitted_at is distinct from old.submitted_at
       or new.cancelled_at is distinct from old.cancelled_at
       or new.expired_at is distinct from old.expired_at
       or new.receipt_issued_at is distinct from old.receipt_issued_at then
      raise exception 'Field lifecycle timestamps change only with a lifecycle transition.';
    end if;
    if not v_declarations_changed then raise exception 'Field Submission update must change declarations or lifecycle state.'; end if;
  end if;
  return new;
end;
$function$;
revoke all on function editorial.protect_field_submission_mutation() from public,anon,authenticated,service_role;

create or replace function editorial.field_submission_state_snapshot_v1(p_submission_resource_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','editorial'
as $function$
  select jsonb_build_object(
    'submission_resource_id',field.resource_id,
    'submission_reference',field.submission_reference,
    'current_revision',field.current_revision,
    'submission_state',field.submission_state,
    'newsroom_identity_mode',field.newsroom_identity_mode,
    'public_attribution_preference',field.public_attribution_preference,
    'contact_preference',field.contact_preference,
    'follow_up_permission',field.follow_up_permission,
    'preferred_contact_channel',field.preferred_contact_channel,
    'contact_point_id',field.contact_point_id,
    'rights_declaration',field.rights_declaration,
    'rights_declaration_detail',field.rights_declaration_detail,
    'consent_declaration',field.consent_declaration,
    'consent_declaration_detail',field.consent_declaration_detail,
    'declared_sensitivity',field.declared_sensitivity,
    'source_protection_request',field.source_protection_request,
    'embargo_request_mode',field.embargo_request_mode,
    'requested_embargo_until',field.requested_embargo_until,
    'location_mode',field.location_mode,
    'location_description',field.location_description,
    'content_captured_at',field.content_captured_at,
    'intake_notes',field.intake_notes,
    'created_at',field.created_at,'updated_at',field.updated_at,
    'received_at',field.received_at,'submitted_at',field.submitted_at,
    'cancelled_at',field.cancelled_at,'expired_at',field.expired_at,
    'receipt_issued_at',field.receipt_issued_at)
  from editorial.field_submissions field where field.resource_id=p_submission_resource_id;
$function$;
revoke all on function editorial.field_submission_state_snapshot_v1(uuid) from public,anon,authenticated,service_role;

create or replace function editorial.validate_field_declarations_v2(p_declarations jsonb,p_require_core boolean default true)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v jsonb:=coalesce(p_declarations,'{}'::jsonb);
  rights text; consent text; identity_mode text; attribution text; legacy_contact text;
  permission text; channel text; point_id uuid; sensitivity text; source_mode text; embargo text;
  embargo_until timestamptz; location_mode text; location_text text; captured_at timestamptz;
  rights_detail text; consent_detail text; notes text;
begin
  if jsonb_typeof(v)<>'object' or octet_length(v::text)>32768
     or v-array['newsroom_identity_mode','public_attribution_preference','contact_preference','follow_up_permission','preferred_contact_channel','contact_point_id','rights_declaration','rights_declaration_detail','consent_declaration','consent_declaration_detail','declared_sensitivity','source_protection_request','embargo_request_mode','requested_embargo_until','location_mode','location_description','content_captured_at','intake_notes'] <> '{}'::jsonb then
    raise exception using errcode='22023',message='Field declaration payload is invalid.';
  end if;
  identity_mode:=coalesce(nullif(v->>'newsroom_identity_mode',''),'standard');
  attribution:=coalesce(nullif(v->>'public_attribution_preference',''),'do_not_name');
  legacy_contact:=nullif(v->>'contact_preference','');
  permission:=nullif(v->>'follow_up_permission','');
  channel:=nullif(v->>'preferred_contact_channel','');
  if nullif(v->>'contact_point_id','') is not null then point_id:=(v->>'contact_point_id')::uuid; end if;
  if permission is null then permission:=case when legacy_contact='no_follow_up' then 'not_allowed' else 'allowed' end; end if;
  if permission='not_allowed' then channel:=null; point_id:=null; legacy_contact:='no_follow_up'; else legacy_contact:='account_contact'; end if;
  rights:=nullif(v->>'rights_declaration',''); rights_detail:=nullif(btrim(v->>'rights_declaration_detail'),'');
  consent:=nullif(v->>'consent_declaration',''); consent_detail:=nullif(btrim(v->>'consent_declaration_detail'),'');
  sensitivity:=coalesce(nullif(v->>'declared_sensitivity',''),'none');
  source_mode:=coalesce(nullif(v->>'source_protection_request',''),'internal');
  embargo:=coalesce(nullif(v->>'embargo_request_mode',''),'none');
  location_mode:=coalesce(nullif(v->>'location_mode',''),'not_collected');
  location_text:=nullif(btrim(v->>'location_description'),''); notes:=nullif(btrim(v->>'intake_notes'),'');
  if nullif(v->>'requested_embargo_until','') is not null then embargo_until:=(v->>'requested_embargo_until')::timestamptz; end if;
  if nullif(v->>'content_captured_at','') is not null then captured_at:=(v->>'content_captured_at')::timestamptz; end if;
  if p_require_core and (rights is null or consent is null) then raise exception using errcode='22023',message='Rights and consent declarations are required.'; end if;
  if identity_mode not in ('standard','restricted') or attribution not in ('may_name','do_not_name')
     or permission not in ('allowed','not_allowed') or (channel is not null and channel not in ('messages','email','phone'))
     or (permission='not_allowed' and (channel is not null or point_id is not null))
     or (rights is not null and rights not in ('owns_or_controls','authorized_by_rights_holder','uncertain','other'))
     or (consent is not null and consent not in ('granted','not_required','uncertain','not_obtained'))
     or sensitivity not in ('none','low','moderate','high','extreme')
     or source_mode not in ('internal','restricted','confidential')
     or embargo not in ('none','until_review','until_time')
     or location_mode not in ('not_collected','coarse_text') then
    raise exception using errcode='22023',message='One or more Field declaration values are invalid.';
  end if;
  if (embargo='until_time' and embargo_until is null) or (embargo<>'until_time' and embargo_until is not null) then raise exception using errcode='22023',message='Field embargo request shape is invalid.'; end if;
  if (location_mode='not_collected' and location_text is not null) or (location_mode='coarse_text' and location_text is null) then raise exception using errcode='22023',message='Field coarse location shape is invalid.'; end if;
  if length(coalesce(rights_detail,''))>4000 or length(coalesce(consent_detail,''))>4000 or length(coalesce(location_text,''))>1000 or length(coalesce(notes,''))>10000 then raise exception using errcode='22023',message='One or more Field declaration details are too long.'; end if;
  return jsonb_build_object('newsroom_identity_mode',identity_mode,'public_attribution_preference',attribution,'contact_preference',legacy_contact,'follow_up_permission',permission,'preferred_contact_channel',channel,'contact_point_id',point_id,'rights_declaration',rights,'rights_declaration_detail',rights_detail,'consent_declaration',consent,'consent_declaration_detail',consent_detail,'declared_sensitivity',sensitivity,'source_protection_request',source_mode,'embargo_request_mode',embargo,'requested_embargo_until',embargo_until,'location_mode',location_mode,'location_description',location_text,'content_captured_at',captured_at,'intake_notes',notes);
end;
$function$;
revoke all on function editorial.validate_field_declarations_v2(jsonb,boolean) from public,anon,authenticated,service_role;

-- Atomic new-contract create path. Legacy v1 remains available unchanged.
create function public.create_field_submission_v2(p_declarations jsonb,p_idempotency_key text,p_correlation_id uuid default null)
returns table(command_receipt_id uuid,receipt_status text,submission_resource_id uuid,submission_reference text,current_revision bigint,submission_state text,created_at timestamptz,idempotent_replay boolean)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','extensions'
as $function$
declare
  actor uuid; principal text; corr uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid()); d jsonb; req jsonb;
  existing platform_private.command_receipts%rowtype; expected_fp text; resource_id uuid; reference text; b record; rd record; result jsonb; created timestamptz;
begin
  select actor_user_id,principal_key into actor,principal from platform_private.command_actor_context();
  if not public.current_user_has_capability('submit_field_capture') then raise exception using errcode='42501',message='Field Submission permission is required.'; end if;
  d:=editorial.validate_field_declarations_v2(p_declarations,true);
  req:=jsonb_build_object('declarations',d,'correlation_id',corr);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(principal||':field.submission.create:'||p_idempotency_key,0));
  select * into existing from platform_private.command_receipts where principal_key=principal and command_type='field.submission.create' and idempotency_key=p_idempotency_key for update;
  if found then
    expected_fp:=platform_private.command_request_fingerprint('field.submission.create',existing.resource_id,req);
    if existing.request_fingerprint<>expected_fp then raise exception using errcode='23505',message='The idempotency key was already used for a different Field Submission create request.'; end if;
    select * into rd from platform_private.read_authenticated_resource_command_result(existing.id,true);
    command_receipt_id:=rd.command_receipt_id; receipt_status:=rd.receipt_status; submission_resource_id:=rd.resource_id;
    submission_reference:=rd.result_payload->>'submission_reference'; current_revision:=nullif(rd.result_payload->>'current_revision','')::bigint;
    submission_state:=rd.result_payload->>'submission_state'; created_at:=nullif(rd.result_payload->>'created_at','')::timestamptz; idempotent_replay:=true; return next; return;
  end if;
  resource_id:=extensions.gen_random_uuid(); reference:='FS-'||to_char(now(),'YYYYMMDD')||'-'||upper(encode(extensions.gen_random_bytes(5),'hex'));
  insert into editorial.resources(id,resource_kind,owner_id,visibility,lifecycle_state,created_by) values(resource_id,'field_submission',actor,'private','active',actor);
  insert into editorial.field_submissions(resource_id,resource_kind,submission_reference,owner_user_id,submitter_mode,current_revision,submission_state,newsroom_identity_mode,public_attribution_preference,contact_preference,follow_up_permission,preferred_contact_channel,contact_point_id,rights_declaration,rights_declaration_detail,consent_declaration,consent_declaration_detail,declared_sensitivity,source_protection_request,embargo_request_mode,requested_embargo_until,location_mode,location_description,content_captured_at,intake_notes,created_by,updated_by,correlation_id)
  values(resource_id,'field_submission',reference,actor,'authenticated',1,'receiving',d->>'newsroom_identity_mode',d->>'public_attribution_preference',d->>'contact_preference',d->>'follow_up_permission',nullif(d->>'preferred_contact_channel',''),nullif(d->>'contact_point_id','')::uuid,d->>'rights_declaration',d->>'rights_declaration_detail',d->>'consent_declaration',d->>'consent_declaration_detail',d->>'declared_sensitivity',d->>'source_protection_request',d->>'embargo_request_mode',nullif(d->>'requested_embargo_until','')::timestamptz,d->>'location_mode',d->>'location_description',nullif(d->>'content_captured_at','')::timestamptz,d->>'intake_notes',actor,actor,corr)
  returning editorial.field_submissions.created_at into created;
  select * into b from platform_private.begin_authenticated_resource_command('field.submission.create',resource_id,p_idempotency_key,req);
  if b.idempotent_replay then raise exception 'Unexpected Field create replay after serialized preflight.'; end if;
  insert into editorial.field_submission_events(submission_resource_id,event_type,actor_user_id,command_receipt_id,prior_state,resulting_state,correlation_id)
  values(resource_id,'submission_created',actor,b.command_receipt_id,null,editorial.field_submission_state_snapshot_v1(resource_id),corr);
  result:=jsonb_build_object('submission_resource_id',resource_id,'submission_reference',reference,'current_revision',1,'submission_state','receiving','created_at',created,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,result);
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; submission_resource_id:=resource_id; submission_reference:=reference; current_revision:=1; submission_state:='receiving'; created_at:=created; idempotent_replay:=false; return next;
end;
$function$;

insert into platform_private.command_types(command_type,job_type,accepted_event_type,success_event_type,failure_event_type,retry_event_type)
values
('field.submission.contact_policy.update','field.submission.contact_policy.update.sync','field.submission.contact_policy.update.accepted','field.submission.contact_policy.update.succeeded','field.submission.contact_policy.update.failed','field.submission.contact_policy.update.retry_scheduled'),
('field.submission.message.start','field.submission.message.start.sync','field.submission.message.start.accepted','field.submission.message.start.succeeded','field.submission.message.start.failed','field.submission.message.start.retry_scheduled');

create function public.update_field_submission_contact_policy_v1(p_submission_resource_id uuid,p_expected_current_revision bigint,p_follow_up_permission text,p_preferred_contact_channel text,p_idempotency_key text,p_correlation_id uuid default null)
returns table(command_receipt_id uuid,receipt_status text,submission_resource_id uuid,current_revision bigint,follow_up_permission text,preferred_contact_channel text,idempotent_replay boolean)
language plpgsql security definer
set search_path to 'pg_catalog','public','auth','editorial','platform_private','extensions'
as $function$
declare actor uuid; f editorial.field_submissions%rowtype; permission text:=lower(btrim(coalesce(p_follow_up_permission,''))); channel text:=nullif(lower(btrim(coalesce(p_preferred_contact_channel,''))),''); corr uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid()); req jsonb; b record; rd record; prior jsonb; result jsonb;
begin
  select actor_user_id into actor from platform_private.command_actor_context();
  if not public.current_user_has_capability('submit_field_capture') then raise exception using errcode='42501',message='Field Submission permission is required.'; end if;
  if permission not in ('allowed','not_allowed') or (channel is not null and channel not in ('messages','email','phone')) or (permission='not_allowed' and channel is not null) then raise exception using errcode='22023',message='Field contact policy is invalid.'; end if;
  select field.* into f from editorial.field_submissions field join editorial.resources r on r.id=field.resource_id and r.resource_kind=field.resource_kind where field.resource_id=p_submission_resource_id and field.owner_user_id=actor and r.owner_id=actor and r.visibility='private' for update of field;
  if not found then raise exception using errcode='P0002',message='The Field Submission does not exist for this contributor.'; end if;
  if f.submission_state not in ('receiving','received') then raise exception using errcode='42501',message='This Field Submission no longer accepts contact changes.'; end if;
  if f.current_revision<>p_expected_current_revision then raise exception using errcode='40001',message='The Field Submission changed before this contact update could be applied.'; end if;
  req:=jsonb_build_object('submission_resource_id',p_submission_resource_id,'expected_current_revision',p_expected_current_revision,'follow_up_permission',permission,'preferred_contact_channel',channel,'correlation_id',corr);
  select * into b from platform_private.begin_authenticated_resource_command('field.submission.contact_policy.update',p_submission_resource_id,p_idempotency_key,req);
  if b.idempotent_replay then select * into rd from platform_private.read_authenticated_resource_command_result(b.command_receipt_id,true); command_receipt_id:=rd.command_receipt_id; receipt_status:=rd.receipt_status; submission_resource_id:=p_submission_resource_id; current_revision:=nullif(rd.result_payload->>'current_revision','')::bigint; follow_up_permission:=rd.result_payload->>'follow_up_permission'; preferred_contact_channel:=rd.result_payload->>'preferred_contact_channel'; idempotent_replay:=true; return next; return; end if;
  prior:=editorial.field_submission_state_snapshot_v1(p_submission_resource_id);
  update editorial.field_submissions field set follow_up_permission=permission,preferred_contact_channel=channel,contact_point_id=null,current_revision=field.current_revision+1,updated_by=actor,updated_at=now() where resource_id=p_submission_resource_id;
  insert into editorial.field_submission_events(submission_resource_id,event_type,actor_user_id,command_receipt_id,prior_state,resulting_state,correlation_id) values(p_submission_resource_id,'declaration_updated',actor,b.command_receipt_id,prior,editorial.field_submission_state_snapshot_v1(p_submission_resource_id),corr);
  select * into f from editorial.field_submissions where resource_id=p_submission_resource_id;
  result:=jsonb_build_object('submission_resource_id',p_submission_resource_id,'current_revision',f.current_revision,'follow_up_permission',f.follow_up_permission,'preferred_contact_channel',f.preferred_contact_channel,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,result);
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; submission_resource_id:=p_submission_resource_id; current_revision:=f.current_revision; follow_up_permission:=f.follow_up_permission; preferred_contact_channel:=f.preferred_contact_channel; idempotent_replay:=false; return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Safe Field newsroom reads and Resource-reference permission.
-- ---------------------------------------------------------------------------

create function editorial.user_has_capability_v1(p_user_id uuid,p_capability text)
returns boolean language sql stable security definer
set search_path to 'pg_catalog','public'
as $function$
  select exists(select 1 from public.user_role_assignments a join public.role_capabilities rc on rc.role_key=a.role_key where a.user_id=p_user_id and a.status='active' and (a.expires_at is null or a.expires_at>now()) and rc.capability_key=p_capability)
$function$;
revoke all on function editorial.user_has_capability_v1(uuid,text) from public,anon,authenticated,service_role;

create or replace function messaging.can_user_reference_resource(p_user_id uuid,p_resource_id uuid,p_resource_version_id uuid)
returns boolean language sql stable security definer
set search_path to 'pg_catalog','editorial'
as $function$
  select exists(
    select 1 from editorial.resources r
    where r.id=p_resource_id and r.lifecycle_state<>'archived'
      and (
        r.visibility='public' or r.owner_id=p_user_id or r.created_by=p_user_id
        or (r.resource_kind='field_submission' and editorial.user_has_capability_v1(p_user_id,'view_field_intake'))
      )
      and (p_resource_version_id is null or exists(select 1 from editorial.resource_versions v where v.resource_id=r.id and v.id=p_resource_version_id))
  )
$function$;
revoke all on function messaging.can_user_reference_resource(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.list_field_submission_intakes_v1(p_limit integer default 50)
returns table(submission_resource_id uuid,submission_reference text,submission_state text,current_revision bigint,newsroom_identity_mode text,contributor_identity_redacted boolean,follow_up_permission text,preferred_contact_channel text,can_message_contributor boolean,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer
set search_path to 'pg_catalog','auth','public','editorial','messaging'
as $function$
declare can_restricted boolean; lim integer:=least(greatest(coalesce(p_limit,50),1),100);
begin
  if coalesce(auth.role(),'')<>'authenticated' or auth.uid() is null or not public.current_user_has_capability('view_field_intake') then raise exception using errcode='42501',message='Internal Field intake permission is required.'; end if;
  can_restricted:=public.current_user_has_capability('view_restricted_field_sources');
  return query
  select f.resource_id,f.submission_reference,f.submission_state,f.current_revision,f.newsroom_identity_mode,(f.newsroom_identity_mode='restricted' and not can_restricted),f.follow_up_permission,f.preferred_contact_channel,
    (f.submission_state in ('received','submitted') and f.follow_up_permission='allowed' and f.preferred_contact_channel='messages' and (f.newsroom_identity_mode<>'restricted' or can_restricted)
      and 1=(select count(*) from editorial.person_identity_links l join editorial.people p on p.resource_id=l.person_resource_id and p.person_state='active' join public.user_profiles u on u.user_id=l.user_id and u.status='active' where l.user_id=f.owner_user_id and l.link_state='active')),
    f.created_at,f.updated_at
  from editorial.field_submissions f order by f.created_at desc,f.resource_id desc limit lim;
end;
$function$;

create function public.get_field_submission_intake_v2(p_submission_resource_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'pg_catalog','auth','public','editorial'
as $function$
declare f editorial.field_submissions%rowtype; can_restricted boolean; identity_redacted boolean; active_links integer; person_id uuid;
begin
  if coalesce(auth.role(),'')<>'authenticated' or auth.uid() is null or not public.current_user_has_capability('view_field_intake') then raise exception using errcode='42501',message='Internal Field intake permission is required.'; end if;
  can_restricted:=public.current_user_has_capability('view_restricted_field_sources');
  select * into f from editorial.field_submissions where resource_id=p_submission_resource_id;
  if not found then raise exception using errcode='P0002',message='Field Submission not found.'; end if;
  identity_redacted:=f.newsroom_identity_mode='restricted' and not can_restricted;
  select count(*),min(l.person_resource_id) into active_links,person_id from editorial.person_identity_links l join editorial.people p on p.resource_id=l.person_resource_id and p.person_state='active' join public.user_profiles u on u.user_id=l.user_id and u.status='active' where l.user_id=f.owner_user_id and l.link_state='active';
  return jsonb_build_object('submission_resource_id',f.resource_id,'submission_reference',f.submission_reference,'submission_state',f.submission_state,'current_revision',f.current_revision,'newsroom_identity_mode',f.newsroom_identity_mode,'contributor_identity_redacted',identity_redacted,'contributor_person_resource_id',case when identity_redacted then null else person_id end,'public_attribution_preference',f.public_attribution_preference,'follow_up_permission',f.follow_up_permission,'preferred_contact_channel',f.preferred_contact_channel,'declared_sensitivity',f.declared_sensitivity,'source_protection_request',f.source_protection_request,'embargo_request_mode',f.embargo_request_mode,'requested_embargo_until',f.requested_embargo_until,'location_mode',f.location_mode,'location_description',f.location_description,'content_captured_at',f.content_captured_at,'intake_notes',f.intake_notes,'created_at',f.created_at,'updated_at',f.updated_at,'received_at',f.received_at,'submitted_at',f.submitted_at,'can_message_contributor',(f.submission_state in ('received','submitted') and f.follow_up_permission='allowed' and f.preferred_contact_channel='messages' and not identity_redacted and active_links=1));
end;
$function$;

-- ---------------------------------------------------------------------------
-- Workflow-scoped Messages eligibility.
-- ---------------------------------------------------------------------------

create function messaging.field_submission_conversation_scope(p_conversation_id uuid,p_person_resource_id uuid)
returns boolean language sql stable security definer
set search_path to 'pg_catalog','editorial','messaging','platform_private'
as $function$
  select exists(
    select 1
    from messaging.messages m
    join platform_private.command_receipts cr on cr.id=m.command_receipt_id and cr.command_type='field.submission.message.start' and cr.status='succeeded'
    join editorial.field_submissions f on f.resource_id=cr.resource_id
    join messaging.message_resource_references ref on ref.message_id=m.id and ref.resource_id=f.resource_id and ref.resource_version_id is null and ref.presentation_kind='resource'
    join editorial.person_identity_links owner_link on owner_link.user_id=f.owner_user_id and owner_link.link_state='active'
    where m.conversation_id=p_conversation_id
      and exists(select 1 from messaging.conversation_participants me where me.conversation_id=p_conversation_id and me.person_resource_id=p_person_resource_id and me.actor_kind='human' and me.membership_status='active')
      and exists(select 1 from messaging.conversation_participants owner_cp where owner_cp.conversation_id=p_conversation_id and owner_cp.person_resource_id=owner_link.person_resource_id and owner_cp.actor_kind='human' and owner_cp.membership_status='active')
  )
$function$;
revoke all on function messaging.field_submission_conversation_scope(uuid,uuid) from public,anon,authenticated,service_role;

create function public.start_field_submission_message_v1(p_submission_resource_id uuid,p_expected_submission_revision bigint,p_body text,p_idempotency_key text,p_correlation_id uuid default null,p_client_created_at timestamptz default null)
returns table(command_receipt_id uuid,receipt_status text,conversation_id uuid,message_id uuid,mailbox_folder text,first_contact_state text,idempotent_replay boolean)
language plpgsql security definer
set search_path to 'pg_catalog','auth','public','editorial','messaging','platform_private','extensions'
as $function$
declare me record; f editorial.field_submissions%rowtype; recipient_user uuid; recipient_person uuid; identity_count integer; body text; corr uuid; req jsonb; b record; res jsonb; conv uuid; sp uuid; rp uuid; msg uuid; disp text; folder text; fcs text; approved boolean; refs jsonb;
begin
  select * into me from messaging.current_human_identity();
  if not public.current_user_has_capability('view_field_intake') then raise exception using errcode='42501',message='Internal Field intake permission is required.'; end if;
  select * into f from editorial.field_submissions where resource_id=p_submission_resource_id for update;
  if not found then raise exception using errcode='P0002',message='Field Submission not found.'; end if;
  if f.newsroom_identity_mode='restricted' and not public.current_user_has_capability('view_restricted_field_sources') then raise exception using errcode='42501',message='Restricted Field source permission is required.'; end if;
  if f.current_revision<>p_expected_submission_revision then raise exception using errcode='40001',message='The Field Submission changed before contact could be started.'; end if;
  if f.submission_state not in ('received','submitted') or f.follow_up_permission<>'allowed' or f.preferred_contact_channel<>'messages' then raise exception using errcode='42501',message='This Field Submission does not permit Messages follow-up.'; end if;
  select count(*),min(l.user_id),min(l.person_resource_id) into identity_count,recipient_user,recipient_person from editorial.person_identity_links l join editorial.people p on p.resource_id=l.person_resource_id and p.person_state='active' join public.user_profiles u on u.user_id=l.user_id and u.status='active' where l.user_id=f.owner_user_id and l.link_state='active';
  if identity_count<>1 or recipient_user is null or recipient_person is null then raise exception using errcode='42501',message='The contributor does not have one active canonical Messages identity.'; end if;
  body:=nullif(btrim(coalesce(p_body,'')),''); if body is null or octet_length(body)>10000 then raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.'; end if;
  refs:=jsonb_build_array(jsonb_build_object('resource_id',p_submission_resource_id,'resource_version_id',null,'presentation_kind','resource'));
  if messaging.person_blocked_between(me.user_id,recipient_person) then raise exception using errcode='42501',message='This conversation cannot be started.'; end if;
  if not messaging.recipient_content_allows(recipient_user,me.sender_category,body,refs) then raise exception using errcode='42501',message='The recipient does not allow this Message content.'; end if;
  corr:=messaging.command_correlation(me.user_id,'field.submission.message.start',p_idempotency_key,p_correlation_id);
  req:=jsonb_build_object('submission_resource_id',p_submission_resource_id,'expected_submission_revision',p_expected_submission_revision,'body',body,'resource_references',refs,'client_created_at',p_client_created_at,'correlation_id',corr);
  select * into b from platform_private.begin_authenticated_resource_command('field.submission.message.start',p_submission_resource_id,p_idempotency_key,req);
  if b.idempotent_replay then res:=b.result_payload; command_receipt_id:=b.command_receipt_id; receipt_status:=b.receipt_status; conversation_id:=nullif(res->>'conversation_id','')::uuid; message_id:=nullif(res->>'message_id','')::uuid; mailbox_folder:=res->>'mailbox_folder'; first_contact_state:=res->>'first_contact_state'; idempotent_replay:=true; return next; return; end if;
  perform pg_advisory_xact_lock(hashtextextended('messages-direct-pair:'||least(me.person_resource_id::text,recipient_person::text)||':'||greatest(me.person_resource_id::text,recipient_person::text),0));
  select c.id into conv from messaging.conversations c where c.conversation_kind='direct' and c.status='active' and (select count(*) from messaging.conversation_participants x where x.conversation_id=c.id and x.actor_kind='human' and x.membership_status='active')=2 and exists(select 1 from messaging.conversation_participants x where x.conversation_id=c.id and x.person_resource_id=me.person_resource_id and x.membership_status='active') and exists(select 1 from messaging.conversation_participants x where x.conversation_id=c.id and x.person_resource_id=recipient_person and x.membership_status='active') order by c.created_at desc limit 1;
  if conv is not null then
    select id into sp from messaging.conversation_participants where conversation_id=conv and person_resource_id=me.person_resource_id and membership_status='active';
    select id,mailbox_folder,first_contact_state into rp,folder,fcs from messaging.conversation_participants where conversation_id=conv and person_resource_id=recipient_person and membership_status='active' for update;
    if fcs='declined' then raise exception using errcode='42501',message='The recipient declined this Message request.'; end if;
  else
    select exists(select 1 from messaging.sender_approvals a where a.recipient_person_resource_id=recipient_person and a.sender_actor_kind='human' and a.sender_person_resource_id=me.person_resource_id and a.status='active') into approved;
    select coalesce((select first_contact_disposition from messaging.user_sender_policies where user_id=recipient_user and sender_category=me.sender_category),messaging.default_first_contact_disposition(me.sender_category)) into disp;
    if disp='reject' then raise exception using errcode='42501',message='The recipient is not accepting new Messages from this sender category.'; end if;
    if approved or disp='inbox' then folder:='inbox'; fcs:='accepted'; else folder:='requests'; fcs:='pending'; end if;
    insert into messaging.conversations(security_classification,status,created_at,last_activity_at,correlation_id) values('standard','active',now(),now(),corr) returning id into conv;
    insert into messaging.conversation_participants(conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state) values(conv,'human',me.person_resource_id,me.user_id,'active','inbox','not_applicable') returning id into sp;
    insert into messaging.conversation_participants(conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state) values(conv,'human',recipient_person,recipient_user,'active',folder,fcs) returning id into rp;
    update messaging.conversations set created_by_participant_id=sp where id=conv;
  end if;
  insert into messaging.messages(conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id,command_receipt_id) values(conv,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id) returning id into msg;
  perform messaging.insert_resource_references(msg,refs);
  insert into messaging.message_receipts(message_id,participant_id,conversation_id,delivery_state,delivered_at) values(msg,rp,conv,'delivered',now());
  update messaging.conversations set last_activity_at=now() where id=conv;
  perform platform_private.complete_resource_command(b.command_receipt_id,jsonb_build_object('conversation_id',conv,'message_id',msg,'mailbox_folder',folder,'first_contact_state',fcs,'submission_resource_id',p_submission_resource_id,'correlation_id',corr));
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; conversation_id:=conv; message_id:=msg; mailbox_folder:=folder; first_contact_state:=fcs; idempotent_replay:=false; return next;
end;
$function$;

-- Preserve Candidate A System Actor reply guard while adding the Field scope.
create or replace function public.send_message(p_conversation_id uuid,p_body text,p_resource_references jsonb,p_idempotency_key text,p_correlation_id uuid default null,p_client_created_at timestamptz default null)
returns table(command_receipt_id uuid,receipt_status text,conversation_id uuid,message_id uuid,idempotent_replay boolean)
language plpgsql security definer
set search_path to 'pg_catalog','auth','public','editorial','messaging','platform_private'
as $function$
declare me record; sp uuid; body text; corr uuid; req jsonb; b record; msg uuid; o record; field_scope boolean;
begin
  select * into me from messaging.current_human_identity(); body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.'; end if;
  corr:=messaging.command_correlation(me.user_id,'messages.message.send',p_idempotency_key,p_correlation_id);
  req:=jsonb_build_object('conversation_id',p_conversation_id,'body',body,'resource_references',coalesce(p_resource_references,'[]'::jsonb),'client_created_at',p_client_created_at,'correlation_id',corr);
  select * into b from platform_private.begin_authenticated_resource_command('messages.message.send',me.person_resource_id,p_idempotency_key,req);
  if b.idempotent_replay then command_receipt_id:=b.command_receipt_id; receipt_status:=b.receipt_status; conversation_id:=nullif(b.result_payload->>'conversation_id','')::uuid; message_id:=nullif(b.result_payload->>'message_id','')::uuid; idempotent_replay:=true; return next; return; end if;
  perform messaging.validate_resource_references(me.user_id,p_resource_references);
  select cp.id into sp from messaging.conversation_participants cp join messaging.conversations c on c.id=cp.conversation_id where cp.conversation_id=p_conversation_id and cp.person_resource_id=me.person_resource_id and cp.user_id=me.user_id and cp.membership_status='active' and c.status='active' for update;
  if sp is null then raise exception using errcode='42501',message='Active conversation membership is required.'; end if;
  if exists(select 1 from messaging.conversation_participants sy left join platform_private.system_actor_message_policies p on p.actor_key=sy.actor_key where sy.conversation_id=p_conversation_id and sy.id<>sp and sy.membership_status='active' and sy.actor_kind in('system','automation') and coalesce(p.allow_human_reply,false)=false) then raise exception using errcode='42501',message='Replies are not enabled for this System Actor.'; end if;
  field_scope:=messaging.field_submission_conversation_scope(p_conversation_id,me.person_resource_id);
  for o in select cp.* from messaging.conversation_participants cp where cp.conversation_id=p_conversation_id and cp.id<>sp and cp.membership_status='active' and cp.actor_kind='human' loop
    if ((not field_scope) and (not messaging.audience_allows_category(me.sender_category) or not messaging.audience_allows_category(messaging.user_sender_category(o.user_id))))
       or messaging.person_blocked_between(me.user_id,o.person_resource_id) or o.first_contact_state='declined'
       or not messaging.recipient_content_allows(o.user_id,me.sender_category,body,p_resource_references) then raise exception using errcode='42501',message='This Message cannot be delivered.'; end if;
  end loop;
  insert into messaging.messages(conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id,command_receipt_id) values(p_conversation_id,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id) returning id into msg;
  perform messaging.insert_resource_references(msg,p_resource_references);
  insert into messaging.message_receipts(message_id,participant_id,conversation_id,delivery_state,delivered_at) select msg,cp.id,p_conversation_id,'delivered',now() from messaging.conversation_participants cp where cp.conversation_id=p_conversation_id and cp.id<>sp and cp.membership_status='active';
  update messaging.conversations set last_activity_at=now() where id=p_conversation_id;
  perform platform_private.complete_resource_command(b.command_receipt_id,jsonb_build_object('conversation_id',p_conversation_id,'message_id',msg,'correlation_id',corr));
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; conversation_id:=p_conversation_id; message_id:=msg; idempotent_replay:=false; return next;
end;
$function$;

create or replace function public.get_my_message_access()
returns jsonb language plpgsql stable security definer
set search_path to 'pg_catalog','auth','public','editorial','messaging'
as $function$
declare me record; can_start boolean; has_conversations boolean; has_field_scope boolean;
begin
  select * into me from messaging.current_human_identity();
  can_start:=messaging.audience_allows_category(me.sender_category);
  select exists(select 1 from messaging.conversation_participants participant where participant.user_id=me.user_id and participant.person_resource_id=me.person_resource_id and participant.membership_status='active') into has_conversations;
  select exists(select 1 from messaging.conversation_participants participant where participant.user_id=me.user_id and participant.person_resource_id=me.person_resource_id and participant.membership_status='active' and messaging.field_submission_conversation_scope(participant.conversation_id,me.person_resource_id)) into has_field_scope;
  return jsonb_build_object('audience_mode',(select audience_mode from messaging.runtime_policy where singleton),'sender_category',me.sender_category,'can_start',can_start,'can_send',can_start or has_field_scope,'has_conversations',has_conversations,'visible',can_start or has_conversations);
end;
$function$;

-- Browser privilege boundary.
revoke execute on function public.create_field_submission_v2(jsonb,text,uuid),public.update_field_submission_contact_policy_v1(uuid,bigint,text,text,text,uuid),public.list_field_submission_intakes_v1(integer),public.get_field_submission_intake_v2(uuid),public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz) from public,anon,service_role;
grant execute on function public.create_field_submission_v2(jsonb,text,uuid),public.update_field_submission_contact_policy_v1(uuid,bigint,text,text,text,uuid),public.list_field_submission_intakes_v1(integer),public.get_field_submission_intake_v2(uuid),public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz) to authenticated;
revoke execute on function public.send_message(uuid,text,jsonb,text,uuid,timestamptz),public.get_my_message_access() from public,anon,service_role;
grant execute on function public.send_message(uuid,text,jsonb,text,uuid,timestamptz),public.get_my_message_access() to authenticated;

comment on function public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz) is 'Field-authorized newsroom bridge into canonical Messages. Does not widen global Messages audience.';
comment on function messaging.field_submission_conversation_scope(uuid,uuid) is 'Durable Field workflow scope proven by successful command receipt plus exact Field Submission Message Resource reference.';

commit;
