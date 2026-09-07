begin;
create or replace function messaging.field_submission_conversation_scope(p_conversation_id uuid,p_person_resource_id uuid)
returns boolean language sql stable security definer
set search_path to 'pg_catalog','editorial','messaging','platform_private'
as $function$
  select exists(
    select 1
    from messaging.messages m
    join platform_private.command_receipts cr on cr.id=m.command_receipt_id and cr.command_type='field.submission.message.start' and cr.status='succeeded'
    join editorial.field_submissions f on f.resource_id=cr.resource_id and f.follow_up_permission='allowed' and f.preferred_contact_channel='messages'
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
commit;
