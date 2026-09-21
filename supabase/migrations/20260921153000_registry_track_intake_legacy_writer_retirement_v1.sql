-- MIZIZI Slice 3 Track Intake legacy canonical-writer retirement.
--
-- Caller cutover and consolidated real-JWT acceptance proved the governed
-- Track Intake command chain. Retire the four superseded direct canonical
-- mutation roads so they cannot remain as alternate authority.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-legacy-writer-retirement-v1',
    0
  )
);

do $preflight$
declare
  v_dependents text[];
begin
  if to_regprocedure(
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_activate_registry_track_intake_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: governed Track Intake replacement authority is incomplete';
  end if;

  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.sync_registry_track_intake_artist_credits(uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: expected Track Intake legacy writer set is already incomplete; audit before retirement';
  end if;

  with funcs as (
    select
      p.oid,
      format('%I.%s',n.nspname,p.oid::regprocedure::text) as signature,
      lower(pg_get_functiondef(p.oid)) as definition
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f'
      and n.nspname in ('public','editorial','platform_private')
      and p.oid not in (
        'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'::regprocedure::oid,
        'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'::regprocedure::oid,
        'public.admin_resolve_registry_track_intake(uuid,uuid,text)'::regprocedure::oid,
        'public.sync_registry_track_intake_artist_credits(uuid,uuid)'::regprocedure::oid
      )
  )
  select array_agg(signature order by signature)
  into v_dependents
  from funcs
  where position(
          'admin_create_registry_track_from_intake_enriched'
          in definition
        )>0
     or position(
          'admin_resolve_registry_track_intake_enriched'
          in definition
        )>0
     or position(
          'admin_resolve_registry_track_intake('
          in definition
        )>0
     or position(
          'sync_registry_track_intake_artist_credits'
          in definition
        )>0;

  if coalesce(cardinality(v_dependents),0)>0 then
    raise exception
      'STOP: live routine(s) still depend on retired Track Intake writer roads: %',
      array_to_string(v_dependents,', ');
  end if;
end
$preflight$;

-- Drop callers before their historical helpers. RESTRICT is intentional.
drop function public.admin_create_registry_track_from_intake_enriched(
  uuid,text,text
);

drop function public.admin_resolve_registry_track_intake_enriched(
  uuid,uuid,text,boolean
);

drop function public.admin_resolve_registry_track_intake(
  uuid,uuid,text
);

drop function public.sync_registry_track_intake_artist_credits(
  uuid,uuid
);

do $postflight$
begin
  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is not null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.sync_registry_track_intake_artist_credits(uuid,uuid)'
     ) is not null
  then
    raise exception
      'STOP: Track Intake legacy writer retirement is incomplete';
  end if;

  if to_regprocedure(
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_activate_registry_track_intake_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: governed Track Intake replacement authority was disturbed by retirement';
  end if;
end
$postflight$;

commit;
