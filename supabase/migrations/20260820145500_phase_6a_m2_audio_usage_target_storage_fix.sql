-- Phase 6A M2 acceptance blocker:
-- allow the Audio-owned master command to persist its target kind without
-- broadening the generic Media attachment command.
--
-- The M2 command public.set_audio_publication_master() deliberately writes
-- media.usage_links.target_kind = 'audio_publication'. The pre-existing table
-- CHECK constraint still carried the older Phase 4 target vocabulary and
-- rejected that governed insert before the M2 command could complete.
--
-- This migration changes only the storage vocabulary. It does not add
-- audio_publication to media.validate_usage_target(), does not change
-- media.usage_role_matches_target(), and does not broaden
-- public.attach_media_usage().

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-6a-audio-authority',
    0
  )
);

do $phase_6a_m2_usage_target_preflight$
declare
  v_constraint text;
  v_audio_master_definition text;
  v_generic_target_definition text;
begin
  if to_regclass('media.usage_links') is null
     or to_regprocedure(
       'public.set_audio_publication_master(uuid,bigint,uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'
     ) is null
  then
    raise exception
      'STOP: required Phase 6A M2 or Phase 4 Media authority is missing';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
  into v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'media.usage_links'::regclass
    and constraint_row.conname = 'usage_links_target_kind_check';

  if v_constraint is null then
    raise exception
      'STOP: media.usage_links target-kind constraint is missing';
  end if;

  if position(
       '''audio_publication''::text'
       in v_constraint
     ) > 0
  then
    raise exception
      'STOP: audio_publication is already present in Media storage vocabulary';
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
      'STOP: Audio master command no longer targets audio_publication';
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
      'STOP: generic Media target validator already accepts Audio publication';
  end if;
end;
$phase_6a_m2_usage_target_preflight$;

alter table media.usage_links
  drop constraint usage_links_target_kind_check;

alter table media.usage_links
  add constraint usage_links_target_kind_check
  check (
    target_kind = any (
      array[
        'article'::text,
        'artist'::text,
        'author'::text,
        'release'::text,
        'track'::text,
        'chart_entry'::text,
        'guide'::text,
        'guide_page'::text,
        'highlight'::text,
        'source'::text,
        'playlist'::text,
        'audio_publication'::text
      ]
    )
  );

commit;
