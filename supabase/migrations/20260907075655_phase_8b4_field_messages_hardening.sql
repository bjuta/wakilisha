begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

create or replace function messaging.field_submission_conversation_scope(p_conversation_id uuid,p_person_resource_id uuid)
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
      and (select count(*) from messaging.conversation_participants active_cp where active_cp.conversation_id=p_conversation_id and active_cp.membership_status='active')=2
      and (select count(*) from messaging.conversation_participants human_cp where human_cp.conversation_id=p_conversation_id and human_cp.membership_status='active' and human_cp.actor_kind='human')=2
      and exists(select 1 from messaging.conversation_participants me where me.conversation_id=p_conversation_id and me.person_resource_id=p_person_resource_id and me.actor_kind='human' and me.membership_status='active')
      and exists(select 1 from messaging.conversation_participants owner_cp where owner_cp.conversation_id=p_conversation_id and owner_cp.person_resource_id=owner_link.person_resource_id and owner_cp.actor_kind='human' and owner_cp.membership_status='active')
  )
$function$;
revoke all on function messaging.field_submission_conversation_scope(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.create_field_submission_v2(p_declarations jsonb,p_idempotency_key text,p_correlation_id uuid default null)
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
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception using errcode='22023',message='idempotency_key is invalid.'; end if;
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

commit;
