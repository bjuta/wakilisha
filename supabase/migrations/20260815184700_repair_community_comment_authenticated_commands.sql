-- WAKILISHA M8A comment command grant repair.
--
-- The RPC classification ledger already marks both functions below as
-- authenticated_command, but their live EXECUTE ACLs drifted away from that
-- contract. Restore only the intended authenticated command authority.
--
-- This migration does not alter comment storage, thread visibility, RLS,
-- function bodies, or public read authority.

begin;

do $comment_command_grant_preflight$
begin
  if to_regprocedure(
    'public.community_create_comment(uuid,uuid,text,text,text,text)'
  ) is null then
    raise exception
      'community_create_comment authority is missing';
  end if;

  if to_regprocedure(
    'public.community_soft_delete_comment(uuid)'
  ) is null then
    raise exception
      'community_soft_delete_comment authority is missing';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
      'community_create_comment(uuid,uuid,text,text,text,text)'
      and access_class = 'authenticated_command'
  ) then
    raise exception
      'community_create_comment is not classified authenticated_command';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
      'community_soft_delete_comment(uuid)'
      and access_class = 'authenticated_command'
  ) then
    raise exception
      'community_soft_delete_comment is not classified authenticated_command';
  end if;
end;
$comment_command_grant_preflight$;

revoke all
on function public.community_create_comment(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.community_create_comment(
  uuid,
  uuid,
  text,
  text,
  text,
  text
)
to authenticated, service_role;

revoke all
on function public.community_soft_delete_comment(uuid)
from public, anon;

grant execute
on function public.community_soft_delete_comment(uuid)
to authenticated, service_role;

do $comment_command_grant_postcondition$
begin
  if not has_function_privilege(
    'authenticated',
    'public.community_create_comment(uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated still cannot execute community_create_comment';
  end if;

  if has_function_privilege(
    'anon',
    'public.community_create_comment(uuid,uuid,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'anon unexpectedly gained community_create_comment';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_soft_delete_comment(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated still cannot execute community_soft_delete_comment';
  end if;

  if has_function_privilege(
    'anon',
    'public.community_soft_delete_comment(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'anon unexpectedly gained community_soft_delete_comment';
  end if;
end;
$comment_command_grant_postcondition$;

commit;
