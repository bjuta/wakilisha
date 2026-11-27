-- Founder-approved initial-owner recovery after an expired technical steward.
-- CLI 2.107.0 mint: run 45964778769. No account/role provisioning.
-- This is not a general transfer or recovery of a previously owned workspace.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('public.admin_mizizi_bootstrap_internal_owner_v1(text)') is null
 or to_regprocedure('public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text)') is not null
 or to_regclass('mizizi_private.workspace_memberships') is null
 then raise exception 'STOP_MIZIZI_INITIAL_OWNER_RECOVERY_PREIMAGE'; end if;
end $guard$;

create function public.admin_mizizi_recover_initial_owner_v1(
 p_expected_expired_membership_id uuid,p_expected_revision integer,p_reason text
) returns uuid
language plpgsql security definer set search_path=pg_catalog
as $recovery$
declare
 v_actor uuid:=auth.uid();
 v_session text:=auth.jwt()->>'session_id';
 v_ws uuid;
 v_old mizizi_private.workspace_memberships%rowtype;
 v_new uuid;
 v_now timestamptz;
begin
 -- A real current human session and pre-existing administrator role are
 -- required; neither the service role nor an executor can recover ownership.
 if coalesce(auth.role(),'')<>'authenticated' or v_actor is null
 or coalesce(auth.jwt()->>'is_anonymous','false')<>'false'
 or coalesce(v_session,'') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 then raise exception 'Initial owner recovery requires an administrator session' using errcode='42501';end if;
 if not exists(select 1 from auth.sessions s where s.id=v_session::uuid and s.user_id=v_actor
   and (s.not_after is null or s.not_after>clock_timestamp()))
 or not exists(select 1 from public.user_role_assignments a where a.user_id=v_actor
   and a.role_key in ('administrator','super_admin') and a.status='active'
   and (a.expires_at is null or a.expires_at>clock_timestamp()))
 or public.current_user_has_capability('manage_registry') is distinct from true
 or public.current_user_has_capability('manage_users') is distinct from true
 or public.current_user_has_capability('manage_charts') is distinct from true
 then raise exception 'Initial owner recovery requires current administrator authority' using errcode='42501';end if;
 if p_expected_expired_membership_id is null or p_expected_revision is null or p_expected_revision<1
 or p_reason is null or char_length(btrim(p_reason)) not between 12 and 1000
 then raise exception 'Exact expired membership revision and meaningful reason required' using errcode='22023';end if;

 -- Same workspace lock as the existing first-owner bootstrap. Serialize with
 -- private membership DML too; no existing active/future or prior owner can
 -- be displaced. The historical orphan is never updated or deleted.
 select id into strict v_ws from mizizi_private.workspaces
  where workspace_key='wakilisha-internal' and workspace_kind='internal'
    and owner_type='platform' and owner_ref='wakilisha' and status='active' for update;
 lock table mizizi_private.workspace_memberships in share row exclusive mode;
 v_now:=clock_timestamp();
 if (select count(*) from mizizi_private.workspace_memberships where workspace_id=v_ws)<>1
 then raise exception 'Initial owner recovery requires exactly one historical membership' using errcode='55000';end if;
 select * into v_old from mizizi_private.workspace_memberships where workspace_id=v_ws
  and id=p_expected_expired_membership_id and revision=p_expected_revision;
 if not found or v_old.user_id=v_actor or v_old.member_role<>'steward'
  or v_old.grant_source<>'operator_review' or v_old.revoked_at is not null
  or v_old.valid_until is null or v_old.valid_until>v_now
  or v_old.valid_from>=v_now
 then raise exception 'Initial owner recovery preimage no longer eligible' using errcode='55000';end if;
 -- Recheck authority after lock waits, before the only write.
 if not exists(select 1 from auth.sessions s where s.id=v_session::uuid and s.user_id=v_actor
   and (s.not_after is null or s.not_after>v_now))
 or not exists(select 1 from public.user_role_assignments a where a.user_id=v_actor
   and a.role_key in ('administrator','super_admin') and a.status='active'
   and (a.expires_at is null or a.expires_at>v_now))
 or public.current_user_has_capability('manage_registry') is distinct from true
 or public.current_user_has_capability('manage_users') is distinct from true
 or public.current_user_has_capability('manage_charts') is distinct from true
 then raise exception 'Initial owner recovery authority expired' using errcode='42501';end if;

 insert into mizizi_private.workspace_memberships(
  workspace_id,user_id,member_role,grant_source,granted_by,last_changed_by,change_reason
 ) values(v_ws,v_actor,'owner','operator_review',v_actor,v_actor,btrim(p_reason))
 returning id into strict v_new;
 return v_new;
end $recovery$;
revoke all on function public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text) to authenticated;
comment on function public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text) is
 'Recover inaugural internal ownership only from exactly one expired reviewed steward, as a current signed-in existing administrator. No platform privilege assignment, historical deletion or prior-owner replacement.';
do $acl$
begin
 if not has_function_privilege('authenticated','public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text)','EXECUTE')
 or has_function_privilege('anon','public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text)','EXECUTE')
 or has_function_privilege('service_role','public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text)','EXECUTE')
 or has_function_privilege('mizizi_executor','public.admin_mizizi_recover_initial_owner_v1(uuid,integer,text)','EXECUTE')
 then raise exception 'STOP_MIZIZI_INITIAL_OWNER_RECOVERY_ACL';end if;
end $acl$;
commit;
