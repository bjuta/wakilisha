-- Registry Discography frozen-plan JSONB cardinality repair.
-- Do not change identity, ordering, grants, canonical data, or review authority.
-- Exact original-source fingerprint is required; the accepted hosted Preview
-- may already have this single repair as a temporary behavioral hot fix.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $wk_jsonb_cardinality$
declare
  v_target regprocedure := to_regprocedure(
    'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)');
  v_source text;
  v_definition text;
  v_old constant text := 'jsonb_object_length(v_track_reconciliations)';
  v_new constant text := '(select count(*) from jsonb_object_keys(v_track_reconciliations))';
begin
  if v_target is null then
    raise exception 'STOP: frozen plan function missing';
  end if;
  select prosrc,pg_get_functiondef(oid) into v_source,v_definition
  from pg_proc where oid=v_target;
  if md5(v_source)='034f82d7d4e257733bc2862c41a01084' then
    if (length(v_definition)-length(replace(v_definition,v_old,''))) / length(v_old)<>1 then
      raise exception 'STOP: invalid cardinality helper anchor drift';
    end if;
    execute replace(v_definition,v_old,v_new);
  elsif md5(v_source)='bd325b01ef4cbf8d0740e02b749b53db' then
    -- Exactly the independently accepted isolated Preview hot repair.
    null;
  else
    raise exception 'STOP: frozen plan function source drift';
  end if;
  select prosrc into v_source from pg_proc where oid=v_target;
  if md5(v_source)<>'bd325b01ef4cbf8d0740e02b749b53db'
     or position(v_old in v_source)>0
     or position(v_new in v_source)=0
  then
    raise exception 'STOP: frozen-plan cardinality postcondition failed';
  end if;
end
$wk_jsonb_cardinality$;
commit;
