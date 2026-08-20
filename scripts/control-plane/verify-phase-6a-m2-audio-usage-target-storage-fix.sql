-- Permanent read-only verifier for the Phase 6A M2 Audio usage-target storage fix.

do $verify_phase_6a_m2_audio_usage_target_storage$
declare
  v_constraint text;
  v_audio_master_definition text;
  v_generic_attach_definition text;
  v_generic_target_definition text;
begin
  select pg_get_constraintdef(constraint_row.oid)
  into v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'media.usage_links'::regclass
    and constraint_row.conname = 'usage_links_target_kind_check';

  if v_constraint is null
     or position(
       '''audio_publication''::text'
       in v_constraint
     ) = 0
  then
    raise exception
      'STOP: Media storage vocabulary does not permit audio_publication';
  end if;

  v_audio_master_definition := pg_get_functiondef(
    'public.set_audio_publication_master(uuid,bigint,uuid,uuid,text,uuid)'::regprocedure
  );

  if position(
       '''audio_publication'''
       in v_audio_master_definition
     ) = 0
  then
    raise exception
      'STOP: Audio master command is not bound to audio_publication';
  end if;

  v_generic_target_definition := pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  );

  if position(
       '''audio_publication'''
       in v_generic_target_definition
     ) > 0
  then
    raise exception
      'STOP: generic Media target validation was broadened to Audio publication';
  end if;

  v_generic_attach_definition := pg_get_functiondef(
    'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)'::regprocedure
  );

  if position(
       'media.validate_usage_target('
       in v_generic_attach_definition
     ) = 0
  then
    raise exception
      'STOP: generic Media attachment no longer delegates target validation';
  end if;

  if exists (
    select 1
    from media.usage_links usage
    where usage.target_kind = 'audio_publication'
      and (
        usage.target_authority <> 'editorial'
        or usage.usage_role <> 'audio_master'
        or usage.resolution_mode <> 'exact_revision'
      )
  ) then
    raise exception
      'STOP: invalid Audio publication Media usage exists';
  end if;

  raise notice
    'PASS: Phase 6A M2 Audio usage-target storage fix is intact.';
end;
$verify_phase_6a_m2_audio_usage_target_storage$;
