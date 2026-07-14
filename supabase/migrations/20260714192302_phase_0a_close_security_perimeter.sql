begin;

create schema if not exists private;

create table if not exists private.phase_0a_rpc_classification (
  function_signature text primary key,
  access_class text not null check (access_class in ('public_read','public_bounded_write','authenticated_command','service_command','internal_trigger')),
  rationale text not null,
  reviewed_at timestamptz not null default now()
);

truncate table private.phase_0a_rpc_classification;

drop policy if exists "article-media anon insert" on storage.objects;
drop policy if exists "cms-media anon insert" on storage.objects;

do $$
declare
  target regprocedure;
begin
  foreach target in array array[
    'public.chart_apply_candidate_rule_gate_biu()'::regprocedure,
    'public.chart_write_candidate_rule_exclusion_aiu()'::regprocedure,
    'public.community_activity_on_follow()'::regprocedure,
    'public.community_activity_on_reaction()'::regprocedure,
    'public.community_activity_on_save()'::regprocedure,
    'public.community_activity_on_vote()'::regprocedure,
    'public.handle_new_auth_user_profile()'::regprocedure,
    'public.rls_auto_enable()'::regprocedure,
    'public.wk_chart_editions_publish_integrity_guard()'::regprocedure,
    'public.wk_chart_entries_apply_artist_alias()'::regprocedure
  ]
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      target
    );

    insert into private.phase_0a_rpc_classification (
      function_signature,
      access_class,
      rationale
    ) values (
      target::text,
      'internal_trigger',
      'Invoked only by a table or event trigger; direct API execution is forbidden.'
    );
  end loop;
end
$$;

do $$
declare
  fn record;
  classification text;
  rationale text;
begin
  for fn in
    select
      p.oid,
      p.oid::regprocedure::text as signature,
      p.proname,
      p.prorettype::regtype::text as return_type
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    classification := null;
    rationale := null;

    if fn.proname like 'public_get_%'
       or fn.proname like 'get_public_%'
       or fn.proname like 'registry_%_for_public'
       or fn.proname in (
         'registry_resolve_artist_slug_for_public',
         'get_release_artists_for_anon',
         'get_release_artists_for_anon_v2',
         'get_release_tracks_by_ids',
         'get_releases_by_ids',
         'get_releases_by_ids_v2',
         'get_tracks_by_ids',
         'get_taxonomy_article_counts',
         'get_taxonomy_terms',
         'community_get_comment_replies',
         'community_get_context_anchor_comments',
         'community_get_context_anchor_summary',
         'community_get_digest',
         'community_get_entity_contributions',
         'community_get_most_discussed',
         'community_get_profile_by_username',
         'community_get_profiles_batch',
         'community_get_thread_by_entity',
         'community_get_thread_comments',
         'community_get_track_moment_comments',
         'community_get_track_moment_summary',
         'community_get_user_comments',
         'community_get_user_replies',
         'community_get_user_stats',
         'community_username_available',
         'community_username_is_reserved',
         'find_similar_artists',
         'get_chart_programs',
         'rpc_get_chart_programs'
       )
    then
      classification := 'public_read';
      rationale := 'Reviewed public read model used by the public application.';
    elsif fn.proname in (
      'increment_share_count',
      'track_analytics_event'
    )
    then
      classification := 'public_bounded_write';
      rationale := 'Reviewed bounded public telemetry contract with no editorial authority.';
    end if;

    if classification is null then
      execute format(
        'revoke execute on function %s from public, anon',
        fn.oid::regprocedure
      );

      classification := 'authenticated_command';
      rationale := 'Anonymous execution removed; authenticated execution remains subject to the function authorization contract.';
    end if;

    insert into private.phase_0a_rpc_classification (
      function_signature,
      access_class,
      rationale
    ) values (
      fn.signature,
      classification,
      rationale
    )
    on conflict (function_signature) do update
      set access_class = excluded.access_class,
          rationale = excluded.rationale,
          reviewed_at = now();
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
