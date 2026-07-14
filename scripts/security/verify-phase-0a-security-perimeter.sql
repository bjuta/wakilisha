with authenticated_commands as (
  select
    p.oid,
    p.oid::regprocedure::text as function_signature,
    p.proname,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and (
      p.proname like 'admin_%'
      or p.proname like 'accept_%'
      or p.proname like 'create_%'
      or p.proname like 'update_%'
      or p.proname like 'review_%'
      or p.proname like 'promote_%'
      or p.proname like 'merge_%'
      or p.proname like 'resolve_%'
      or p.proname like 'normalize_%'
      or p.proname like 'complete_%'
      or p.proname like 'institute_accept_%'
      or p.proname like 'institute_review_%'
      or p.proname in (
        'registry_upsert_track_provider_link',
        'community_create_profile',
        'community_create_context_anchor_comment',
        'community_create_track_moment_comment',
        'community_ensure_user_account',
        'community_mark_all_read',
        'community_mark_notification_read',
        'community_save_entity',
        'community_update_comment',
        'community_update_notification_prefs',
        'community_update_profile',
        'community_update_username'
      )
    )
), violations as (
  select function_signature, 'authenticated privileged command lacks actor or capability guard' as violation
  from authenticated_commands
  where not (
    definition ~* '(auth\.uid\s*\(|current_user_has_capability\s*\(|has_capability\s*\(|current_user_is_administrator\s*\(|is_current_user_administrator\s*\(|institute_can_(manage|review|read)\s*\(|user_role_assignments|role_capabilities|current_user\s*<>\s*''service_role''|current_user\s*=\s*''service_role'')'
  )

  union all

  select p.oid::regprocedure::text, 'unclassified anonymous SECURITY DEFINER function'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join private.phase_0a_rpc_classification c
    on c.function_signature = p.oid::regprocedure::text
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and c.function_signature is null

  union all

  select c.function_signature, 'classified non-public function retains anonymous execute'
  from private.phase_0a_rpc_classification c
  join pg_proc p on p.oid::regprocedure::text = c.function_signature
  where c.access_class not in ('public_read','public_bounded_write')
    and has_function_privilege('anon', p.oid, 'EXECUTE')

  union all

  select c.function_signature, 'internal trigger remains directly API executable'
  from private.phase_0a_rpc_classification c
  join pg_proc p on p.oid::regprocedure::text = c.function_signature
  where c.access_class = 'internal_trigger'
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )

  union all

  select policyname, 'anonymous storage insert policy remains'
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'INSERT'
    and 'anon' = any(roles)
)
select *
from violations
order by violation, function_signature;
