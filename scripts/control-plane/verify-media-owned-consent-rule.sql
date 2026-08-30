begin;
set local transaction read only;

do $verify$
declare
  v_def text;
  v_legacy_current bigint;
begin
  if to_regprocedure('media.apply_owned_consent_rule()') is null then
    raise exception 'MEDIA_OWNED_CONSENT_RULE_FAIL: trigger function missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_proc p on p.oid=t.tgfoid
    join pg_namespace pn on pn.oid=p.pronamespace
    where n.nspname='media'
      and c.relname='asset_governance_versions'
      and t.tgname='trg_media_owned_consent_rule'
      and not t.tgisinternal
      and pn.nspname='media'
      and p.proname='apply_owned_consent_rule'
  ) then
    raise exception 'MEDIA_OWNED_CONSENT_RULE_FAIL: trigger missing';
  end if;

  v_def := pg_get_functiondef('media.apply_owned_consent_rule()'::regprocedure);

  if position('new.rights_status = ''owned''' in v_def)=0
     or position('new.consent_status := ''granted''' in v_def)=0
  then
    raise exception 'MEDIA_OWNED_CONSENT_RULE_FAIL: owned -> granted conditional missing';
  end if;

  if has_function_privilege(
       'authenticated',
       'media.apply_owned_consent_rule()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'media.apply_owned_consent_rule()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'media.apply_owned_consent_rule()',
       'EXECUTE'
     )
  then
    raise exception 'MEDIA_OWNED_CONSENT_RULE_FAIL: trigger helper EXECUTE leaked';
  end if;

  select count(*)
  into v_legacy_current
  from media.assets a
  join media.asset_governance_versions g
    on g.id=a.current_governance_version_id
  where g.rights_status='owned'
    and g.consent_status<>'granted';

  if v_legacy_current < 0 then
    raise exception 'MEDIA_OWNED_CONSENT_RULE_FAIL: impossible legacy count';
  end if;
end;
$verify$;

select
  'MEDIA_OWNED_CONSENT_RULE_PASS' as verification_result;

rollback;
