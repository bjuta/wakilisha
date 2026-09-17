begin;
set local transaction read only;

do $verify$
declare
  v_trigger_count integer;
begin
  if to_regprocedure(
    'public.reject_legacy_core_cultural_entity_mutation()'
  ) is null then
    raise exception 'Gate C replay cultural-entity guard is missing';
  end if;

  if to_regprocedure(
    'public.reject_legacy_core_relationship_mutation()'
  ) is null then
    raise exception 'Gate C replay relationship guard is missing';
  end if;

  if to_regprocedure(
    'public.reject_legacy_core_relationship_evidence_mutation()'
  ) is null then
    raise exception 'Gate C replay relationship-evidence guard is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.reject_legacy_core_cultural_entity_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reject_legacy_core_cultural_entity_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.reject_legacy_core_relationship_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reject_legacy_core_relationship_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.reject_legacy_core_relationship_evidence_mutation()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reject_legacy_core_relationship_evidence_mutation()',
    'EXECUTE'
  ) then
    raise exception 'Gate C replay guard function EXECUTE privilege drift';
  end if;

  select count(*)
  into v_trigger_count
  from pg_catalog.pg_trigger trigger_row
  join pg_catalog.pg_class relation
    on relation.oid = trigger_row.tgrelid
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = relation.relnamespace
  join pg_catalog.pg_proc function_row
    on function_row.oid = trigger_row.tgfoid
  where not trigger_row.tgisinternal
    and namespace_row.nspname = 'public'
    and (
      (
        relation.relname = 'cultural_entities'
        and trigger_row.tgname =
          'trg_reject_legacy_core_cultural_entity_mutation'
        and function_row.proname =
          'reject_legacy_core_cultural_entity_mutation'
      )
      or (
        relation.relname = 'entity_relationships'
        and trigger_row.tgname =
          'trg_reject_legacy_core_relationship_mutation'
        and function_row.proname =
          'reject_legacy_core_relationship_mutation'
      )
      or (
        relation.relname = 'relationship_evidence'
        and trigger_row.tgname =
          'trg_reject_legacy_core_relationship_evidence_mutation'
        and function_row.proname =
          'reject_legacy_core_relationship_evidence_mutation'
      )
    )
    and trigger_row.tgenabled <> 'D';

  if v_trigger_count <> 3 then
    raise exception
      'Gate C replay guard trigger cardinality drift: expected 3, found %',
      v_trigger_count;
  end if;

  if position(
    'Core music identity must use typed Registry authority'
    in pg_get_functiondef(
      'public.reject_legacy_core_cultural_entity_mutation()'::regprocedure
    )
  ) = 0 then
    raise exception 'Gate C cultural-entity guard definition drift';
  end if;

  if position(
    'Core music relationships must use typed Registry relationship authority'
    in pg_get_functiondef(
      'public.reject_legacy_core_relationship_mutation()'::regprocedure
    )
  ) = 0 then
    raise exception 'Gate C relationship guard definition drift';
  end if;

  if position(
    'Historical core music legacy relationship evidence is immutable'
    in pg_get_functiondef(
      'public.reject_legacy_core_relationship_evidence_mutation()'::regprocedure
    )
  ) = 0 then
    raise exception 'Gate C relationship-evidence guard definition drift';
  end if;

  raise notice 'MIZIZI_RELATIONSHIP_REPLAY_AUTHORITY_PASS';
end
$verify$;

rollback;
