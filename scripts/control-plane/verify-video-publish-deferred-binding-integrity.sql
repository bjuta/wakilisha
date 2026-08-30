begin;
set local transaction read only;

do $verify$
declare
  v_security_definer boolean;
  v_owner text;
  v_definition text;
begin
  select
    p.prosecdef,
    pg_get_userbyid(p.proowner),
    pg_get_functiondef(p.oid)
  into
    v_security_definer,
    v_owner,
    v_definition
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='editorial'
    and p.proname='assert_resource_binding_integrity'
    and pg_get_function_identity_arguments(p.oid)='';

  if not coalesce(v_security_definer,false) then
    raise exception
      'VIDEO_PUBLISH_BINDING_INTEGRITY_FAIL: binding trigger is not SECURITY DEFINER';
  end if;

  if v_owner <> 'postgres' then
    raise exception
      'VIDEO_PUBLISH_BINDING_INTEGRITY_FAIL: binding trigger owner drifted';
  end if;

  if position('video_publication_resources' in v_definition)=0
     or position('audio_publication_resources' in v_definition)=0
     or position('playlist_resources' in v_definition)=0
  then
    raise exception
      'VIDEO_PUBLISH_BINDING_INTEGRITY_FAIL: cross-resource binding checks are incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.assert_resource_binding_integrity()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.assert_resource_binding_integrity()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.assert_resource_binding_integrity()',
       'EXECUTE'
     )
  then
    raise exception
      'VIDEO_PUBLISH_BINDING_INTEGRITY_FAIL: internal trigger helper EXECUTE leaked';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='editorial'
      and c.relname='resources'
      and t.tgname='resources_binding_integrity'
      and t.tgdeferrable
      and t.tginitdeferred
      and not t.tgisinternal
  ) then
    raise exception
      'VIDEO_PUBLISH_BINDING_INTEGRITY_FAIL: deferred Resource binding trigger contract drifted';
  end if;
end;
$verify$;

select
  'VIDEO_PUBLISH_DEFERRED_BINDING_INTEGRITY_PASS' as verification_result;

rollback;
