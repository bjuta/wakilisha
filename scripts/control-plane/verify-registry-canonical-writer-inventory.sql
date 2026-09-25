-- GENERATED FILE. DO NOT EDIT BY HAND.
-- Authority: scripts/control-plane/registry-privileged-writer-manifest.json
-- Generator: scripts/control-plane/generate-registry-canonical-writer-verifier.mjs
--
-- Discovers browser/API-callable public Registry mutation authority from the
-- live catalog, including direct canonical DML, private typed executor bridges,
-- and public wrappers that delegate to another discovered mutator.

do $verify$
declare
  v_unclassified text[];
  v_anonymous text[];
begin
  with recursive
  public_api as (
    select
      p.oid,
      p.proname,
      format('public.%s', p.oid::regprocedure::text) as signature,
      lower(pg_get_functiondef(p.oid)) as definition,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  direct_mutators as (
    select *
    from public_api
    where definition ~
      '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres))'
  ),
  private_executor_bridges as (
    select *
    from public_api
    where definition ~
      '(platform_private[.](execute_registry_[a-z0-9_]+|ensure_registry_[a-z0-9_]+)|mizizi_private[.]execute_[a-z0-9_]+)'
  ),
  dynamic_registry_candidates as (
    select *
    from public_api
    where definition ~ '(^|[^a-z0-9_])execute[[:space:]]'
      and definition ~
        'registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres)'
  ),
  mutation_graph(signature, proname, definition, anon_execute, authenticated_execute) as (
    select signature, proname, definition, anon_execute, authenticated_execute
    from direct_mutators
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from private_executor_bridges
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from dynamic_registry_candidates
    union
    select
      caller.signature,
      caller.proname,
      caller.definition,
      caller.anon_execute,
      caller.authenticated_execute
    from public_api caller
    join mutation_graph target
      on caller.signature <> target.signature
     and caller.definition ~ (
       '(^|[^a-z0-9_])'
       || target.proname
       || '[[:space:]]*[(]'
     )
  ),
  live_mutators as (
    select distinct
      signature,
      anon_execute,
      authenticated_execute
    from mutation_graph
  ),
  classified(signature) as (
    values
      ('public.accept_registry_missing_artist_intake(uuid,text)'),
      ('public.admin_activate_registry_track_intake_v1(uuid)'),
      ('public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)'),
      ('public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)'),
      ('public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)'),
      ('public.admin_admit_registry_track_provider_link_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)'),
      ('public.admin_apply_artist_decouple_decision(uuid)'),
      ('public.admin_apply_chart_artist_resolution_decision(uuid)'),
      ('public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)'),
      ('public.admin_archive_registry_music_entity_v1(text,uuid,timestamp with time zone)'),
      ('public.admin_create_registry_artist_for_decouple(text,text,text,text)'),
      ('public.admin_create_registry_artist_intake_shell_v1(uuid)'),
      ('public.admin_create_registry_discography_artist_shell_v1(uuid,text)'),
      ('public.admin_create_registry_track_intake_identity_v1(uuid,text)'),
      ('public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)'),
      ('public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamp with time zone)'),
      ('public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)'),
      ('public.admin_patch_registry_artist_profile_v1(uuid,jsonb,timestamp with time zone)'),
      ('public.admin_patch_registry_genre_profile_v1(uuid,jsonb,timestamp with time zone)'),
      ('public.admin_patch_registry_label_profile_v1(uuid,jsonb,timestamp with time zone)'),
      ('public.admin_patch_registry_release_detail_v1(uuid,text,text,text,date,text,uuid,text,text,text,timestamp with time zone)'),
      ('public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamp with time zone)'),
      ('public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamp with time zone)'),
      ('public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)'),
      ('public.admin_resolve_chart_artist_alias(text,uuid,text,boolean)'),
      ('public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)'),
      ('public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)'),
      ('public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)'),
      ('public.chart_admit_track_provider_link_v1(uuid)'),
      ('public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)'),
      ('public.chart_materialize_candidate_registry_v1(uuid,uuid)'),
      ('public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)'),
      ('public.community_admin_resolve_artist_claim_existing(uuid,uuid,text,boolean,boolean,boolean,boolean)'),
      ('public.complete_registry_relationship_review(uuid,text,text,text,text,text,text,text,text,text,text,boolean)'),
      ('public.create_registry_entity_relationship(text,uuid,text,uuid,text,text,text,date,date,uuid,text,text,jsonb)'),
      ('public.merge_registry_relationship_duplicate(uuid,uuid,text)'),
      ('public.normalize_registry_relationship_vocabulary(uuid,text,text,text)'),
      ('public.registry_upsert_track_provider_link(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)'),
      ('public.resolve_registry_relationship_endpoint(uuid,text,text,uuid,text)'),
      ('public.resolve_registry_relationship_endpoint_from_alias(uuid,text,text)'),
      ('public.review_registry_relationship(uuid,text,boolean,text)')
  )
  select array_agg(live.signature order by live.signature)
  into v_unclassified
  from live_mutators live
  left join classified accepted
    on accepted.signature = live.signature
  where accepted.signature is null;

  if coalesce(cardinality(v_unclassified), 0) > 0 then
    raise exception
      'STOP: unclassified live canonical Registry writer(s): %',
      array_to_string(v_unclassified, ', ');
  end if;

  with recursive
  public_api as (
    select
      p.oid,
      p.proname,
      format('public.%s', p.oid::regprocedure::text) as signature,
      lower(pg_get_functiondef(p.oid)) as definition,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  direct_mutators as (
    select *
    from public_api
    where definition ~
      '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres))'
  ),
  private_executor_bridges as (
    select *
    from public_api
    where definition ~
      '(platform_private[.](execute_registry_[a-z0-9_]+|ensure_registry_[a-z0-9_]+)|mizizi_private[.]execute_[a-z0-9_]+)'
  ),
  dynamic_registry_candidates as (
    select *
    from public_api
    where definition ~ '(^|[^a-z0-9_])execute[[:space:]]'
      and definition ~
        'registry_(artists|tracks|releases|track_artists|release_artists|release_tracks|artist_aliases|entity_relationships|relationship_evidence|track_provider_links|labels|genres)'
  ),
  mutation_graph(signature, proname, definition, anon_execute, authenticated_execute) as (
    select signature, proname, definition, anon_execute, authenticated_execute
    from direct_mutators
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from private_executor_bridges
    union
    select signature, proname, definition, anon_execute, authenticated_execute
    from dynamic_registry_candidates
    union
    select
      caller.signature,
      caller.proname,
      caller.definition,
      caller.anon_execute,
      caller.authenticated_execute
    from public_api caller
    join mutation_graph target
      on caller.signature <> target.signature
     and caller.definition ~ (
       '(^|[^a-z0-9_])'
       || target.proname
       || '[[:space:]]*[(]'
     )
  )
  select array_agg(signature order by signature)
  into v_anonymous
  from (
    select distinct signature
    from mutation_graph
    where anon_execute
  ) anonymous_mutators;

  if coalesce(cardinality(v_anonymous), 0) > 0 then
    raise exception
      'STOP: anonymous canonical Registry writer(s) remain executable: %',
      array_to_string(v_anonymous, ', ');
  end if;
end
$verify$;


do $verify_closed_table_roads$
declare
  v_table text;
  v_role text;
  v_privilege text;
begin
  foreach v_table in array array[
    'public.registry_artist_aliases',
    'public.registry_track_provider_links',
    'public.registry_relationship_evidence'
  ]
  loop
    foreach v_role in array array[
      'anon',
      'authenticated',
      'service_role'
    ]
    loop
      foreach v_privilege in array array[
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      ]
      loop
        if has_table_privilege(v_role,v_table,v_privilege) then
          raise exception
            'STOP: stale direct Registry table privilege remains: role=% table=% privilege=%',
            v_role,v_table,v_privilege;
        end if;
      end loop;
    end loop;
  end loop;
end
$verify_closed_table_roads$;

select
  'REGISTRY_CANONICAL_WRITER_INVENTORY_PASS'::text as status;
