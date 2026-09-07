begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

create or replace function public.get_field_submission_intake_v2(p_submission_resource_id uuid)
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
  select count(*),(array_agg(l.person_resource_id order by l.person_resource_id))[1]
  into active_links,person_id
  from editorial.person_identity_links l
  join editorial.people p on p.resource_id=l.person_resource_id and p.person_state='active'
  join public.user_profiles u on u.user_id=l.user_id and u.status='active'
  where l.user_id=f.owner_user_id and l.link_state='active';
  return jsonb_build_object('submission_resource_id',f.resource_id,'submission_reference',f.submission_reference,'submission_state',f.submission_state,'current_revision',f.current_revision,'newsroom_identity_mode',f.newsroom_identity_mode,'contributor_identity_redacted',identity_redacted,'contributor_person_resource_id',case when identity_redacted then null else person_id end,'public_attribution_preference',f.public_attribution_preference,'follow_up_permission',f.follow_up_permission,'preferred_contact_channel',f.preferred_contact_channel,'declared_sensitivity',f.declared_sensitivity,'source_protection_request',f.source_protection_request,'embargo_request_mode',f.embargo_request_mode,'requested_embargo_until',f.requested_embargo_until,'location_mode',f.location_mode,'location_description',f.location_description,'content_captured_at',f.content_captured_at,'intake_notes',f.intake_notes,'created_at',f.created_at,'updated_at',f.updated_at,'received_at',f.received_at,'submitted_at',f.submitted_at,'can_message_contributor',(f.submission_state in ('received','submitted') and f.follow_up_permission='allowed' and f.preferred_contact_channel='messages' and not identity_redacted and active_links=1));
end;
$function$;

create or replace function public.start_field_submission_message_v1(p_submission_resource_id uuid,p_expected_submission_revision bigint,p_body text,p_idempotency_key text,p_correlation_id uuid default null,p_client_created_at timestamptz default null)
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
  select count(*),(array_agg(l.user_id order by l.user_id))[1],(array_agg(l.person_resource_id order by l.person_resource_id))[1]
  into identity_count,recipient_user,recipient_person
  from editorial.person_identity_links l
  join editorial.people p on p.resource_id=l.person_resource_id and p.person_state='active'
  join public.user_profiles u on u.user_id=l.user_id and u.status='active'
  where l.user_id=f.owner_user_id and l.link_state='active';
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

commit;
