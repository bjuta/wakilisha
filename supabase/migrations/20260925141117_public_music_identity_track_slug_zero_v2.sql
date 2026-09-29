-- Public Music Identity Track-slug zero convergence V2.
--
-- No business rows are mutated by this migration.
-- The existing V1 executor is preserved for historical replay.
-- V2 changes only registry.track_slug.canonicalize current-pointer semantics:
-- Community ownership is Registry Track UUID based and public Track URLs use
-- /tracks/{primaryArtistSlug}/{cleanTrackSlug}.
--
-- Production apply is a separate reviewed trigger gate.

create function mizizi_private.execute_stewardship_operation_v2(
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean,
  result_payload jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_event_id uuid;
  v_rows integer;
  v_track_plan record;
  v_release_taxonomy_plan record;
  v_release_slug_plan record;
  v_chart_plan record;
  v_track_id uuid;
  v_release_id uuid;
  v_old_slug text;
  v_new_slug text;
  v_primary_artist_slug text;
  v_paths jsonb := '[]'::jsonb;
  v_path jsonb;
  v_release_path record;
  v_thread record;
  v_matched_path jsonb;
  v_chart_rows integer := 0;
  v_save_rows integer := 0;
  v_save_url_rows integer := 0;
  v_thread_rows integer := 0;
  v_interest_rows integer := 0;
  v_activity_rows integer := 0;
  v_contribution_rows integer := 0;
  v_notification_rows integer := 0;
  v_opportunity_rows integer := 0;
  v_old_path text;
  v_new_path text;
  v_result jsonb;
begin
  perform mizizi_private.assert_executor_v1();

  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'mizizi',
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay
     and v_operation.status='succeeded'
  then
    operation_id := v_operation.id;
    operation_status := v_operation.status;
    verifier_status := v_operation.verifier_status;
    idempotent_replay := true;
    result_payload := v_operation.result_payload;
    return next;
    return;
  end if;

  if v_operation.status<>'authorized' then
    raise exception using errcode='42501',
      message='Stewardship operation is not in an executable state.';
  end if;

  select grant_row.*
  into v_grant
  from platform_private.registry_execution_grants grant_row
  where grant_row.id=p_execution_grant_id;

  if not found
     or v_grant.actor_key<>'mizizi'
     or v_grant.operation_version<>1
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
       'mizizi-cultural-data-steward-1.2.0'
     or v_grant.operation_key not in (
       'registry.track_slug.canonicalize',
       'registry.release_taxonomy.repair',
       'registry.release_slug.canonicalize',
       'registry.chart_track_slug.synchronize'
     )
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Stage B MIZIZI stewardship grant.';
  end if;

  v_plan := v_grant.plan_payload;

  update platform_private.registry_mutation_operations
  set
    status='executing',
    started_at=coalesce(started_at,now()),
    updated_at=now()
  where id=v_operation.id;

  if v_grant.operation_key='registry.track_slug.canonicalize' then
    if (
      v_plan - array[
        'operation_key','operation_version','target_ref','track_id',
        'current_slug','proposed_slug','primary_artist_slug',
        'expected_state_fingerprint','rule_id','rule_version',
        'policy_ruleset_version'
      ]::text[]
    )<>'{}'::jsonb
    then
      raise exception using errcode='42501',
        message='Track slug plan contains fields outside V1.';
    end if;

    begin
      v_track_id := (v_plan->>'track_id')::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Track slug plan contains malformed typed values.';
    end;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:track-scope:' ||
        coalesce(v_plan->>'primary_artist_slug',''),
        0
      )
    );

    select *
    into v_track_plan
    from mizizi_private.track_slug_plan_v1(v_track_id);

    if v_plan->>'operation_key'<>'registry.track_slug.canonicalize'
       or (v_plan->>'operation_version')::integer<>1
       or v_plan->>'rule_id'<>'track_slug_identity_noise'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'policy_ruleset_version'<>
          'mizizi-cultural-data-steward-1.2.0'
       or v_plan->>'current_slug'
          is distinct from v_track_plan.current_slug
       or v_plan->>'proposed_slug'
          is distinct from v_track_plan.proposed_slug
       or v_plan->>'expected_state_fingerprint'
          is distinct from v_track_plan.expected_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Track slug execution plan drifted from current deterministic policy.';
    end if;

    v_old_slug := v_track_plan.current_slug;
    v_new_slug := v_track_plan.proposed_slug;
    v_primary_artist_slug :=
      coalesce(v_track_plan.primary_artist_slug,'');

    if nullif(v_primary_artist_slug,'') is null then
      raise exception using errcode='55000',
        message='Track slug V2 requires explicit primary Artist scope.';
    end if;

    v_old_path :=
      '/tracks/' ||
      v_primary_artist_slug ||
      '/' ||
      v_old_slug;

    v_new_path :=
      '/tracks/' ||
      v_primary_artist_slug ||
      '/' ||
      v_new_slug;

    v_paths := jsonb_build_array(
      jsonb_build_object(
        'scope_slug',v_primary_artist_slug,
        'old_path',v_old_path,
        'new_path',v_new_path
      )
    );

    update public.registry_tracks
    set
      slug=v_new_slug,
      updated_at=now()
    where id=v_track_id
      and status='active'
      and slug=v_old_slug;

    get diagnostics v_rows=row_count;

    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Track slug V2 compare-and-set lost its one-row boundary.';
    end if;

    update public.wk_chart_entries_v2
    set
      track_slug=v_new_slug,
      updated_at=now()
    where canonical_track_id=v_track_id::text
      and track_slug is distinct from v_new_slug;

    get diagnostics v_chart_rows=row_count;

    update public.community_saves
    set entity_slug=v_new_slug
    where entity_type='track'
      and entity_id=v_track_id::text
      and entity_slug is distinct from v_new_slug;

    get diagnostics v_save_rows=row_count;

    update public.community_saves
    set entity_url=
      'https://wakilisha.africa' || v_new_path
    where entity_type='track'
      and entity_id=v_track_id::text
      and entity_url is not null
      and entity_url is distinct from
        'https://wakilisha.africa' || v_new_path;

    get diagnostics v_save_url_rows=row_count;

    update public.community_threads
    set
      entity_id=v_track_id::text,
      entity_slug=v_new_slug,
      entity_url=
        'https://wakilisha.africa' || v_new_path,
      updated_at=now()
    where entity_type='track'
      and entity_id=v_track_id::text
      and (
        entity_slug is distinct from v_new_slug
        or entity_url is distinct from
          'https://wakilisha.africa' || v_new_path
      );

    get diagnostics v_thread_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      actor
    )
    values (
      'track',
      v_track_id::text,
      v_grant.idempotency_key,
      'mizizi_private.track_slug_plan_v1',
      'slug',
      'public.registry_tracks.slug',
      jsonb_build_object('value',v_old_slug),
      jsonb_build_object(
        'value',v_new_slug,
        'policy_ruleset_version',
          'mizizi-cultural-data-steward-1.2.0',
        'public_identity_version',
          'artist_scoped_track_v2',
        'downstream_impact',
          jsonb_build_object(
            'chart_entries_updated',v_chart_rows,
            'community_saves_updated',v_save_rows,
            'community_save_urls_updated',v_save_url_rows,
            'community_threads_updated',v_thread_rows
          )
      ),
      'canonicalize_track_slug',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'track_id',v_track_id,
      'old_slug',v_old_slug,
      'new_slug',v_new_slug,
      'old_path',v_old_path,
      'new_path',v_new_path,
      'chart_entries_updated',v_chart_rows,
      'community_saves_updated',v_save_rows,
      'community_save_urls_updated',v_save_url_rows,
      'community_threads_updated',v_thread_rows,
      'paths',v_paths,
      'canonical_write_event_id',v_event_id
    );

  elsif v_grant.operation_key='registry.release_taxonomy.repair' then
    begin
      v_release_id := (v_plan->>'release_id')::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Release taxonomy plan contains malformed typed values.';
    end;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:release-taxonomy:' || v_release_id::text,
        0
      )
    );

    select *
    into v_release_taxonomy_plan
    from mizizi_private.release_taxonomy_plan_v1(v_release_id);

    if v_plan->>'rule_id'<>'release_taxonomy_drift'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'current_release_type'
          is distinct from
          coalesce(v_release_taxonomy_plan.current_release_type,'')
       or v_plan->>'proposed_release_type'
          is distinct from
          v_release_taxonomy_plan.proposed_release_type
       or (v_plan->>'active_track_count')::integer
          is distinct from
          v_release_taxonomy_plan.active_track_count
       or v_plan->>'expected_state_fingerprint'
          is distinct from
          v_release_taxonomy_plan.expected_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Release taxonomy execution plan drifted from current deterministic policy.';
    end if;

    update public.registry_releases
    set
      release_type=v_release_taxonomy_plan.proposed_release_type,
      updated_at=now()
    where id=v_release_id
      and status='active'
      and coalesce(btrim(release_type),'')=
          coalesce(v_release_taxonomy_plan.current_release_type,'');

    get diagnostics v_rows=row_count;
    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Release taxonomy compare-and-set lost its one-row boundary.';
    end if;

    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      actor
    )
    values (
      'release',
      v_release_id::text,
      v_grant.idempotency_key,
      'mizizi_private.release_taxonomy_plan_v1',
      'release_type',
      'public.registry_releases.release_type',
      jsonb_build_object(
        'value',
        v_release_taxonomy_plan.current_release_type
      ),
      jsonb_build_object(
        'value',
        v_release_taxonomy_plan.proposed_release_type,
        'resolvable_active_track_count',
        v_release_taxonomy_plan.active_track_count,
        'policy_ruleset_version',
        'mizizi-cultural-data-steward-1.2.0'
      ),
      'repair_release_taxonomy',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'release_id',v_release_id,
      'old_release_type',
        v_release_taxonomy_plan.current_release_type,
      'new_release_type',
        v_release_taxonomy_plan.proposed_release_type,
      'resolvable_active_track_count',
        v_release_taxonomy_plan.active_track_count,
      'canonical_write_event_id',v_event_id
    );

  elsif v_grant.operation_key='registry.release_slug.canonicalize' then
    begin
      v_release_id := (v_plan->>'release_id')::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Release slug plan contains malformed typed values.';
    end;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:release-slug:' ||
        coalesce(v_plan->>'artist_id',''),
        0
      )
    );

    select *
    into v_release_slug_plan
    from mizizi_private.release_slug_plan_v1(v_release_id);

    if v_plan->>'rule_id'<>'release_slug_provider_packaging'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'current_slug'
          is distinct from v_release_slug_plan.current_slug
       or v_plan->>'proposed_slug'
          is distinct from v_release_slug_plan.proposed_slug
       or v_plan->>'artist_id'
          is distinct from v_release_slug_plan.artist_id::text
       or v_plan->>'artist_slug'
          is distinct from v_release_slug_plan.artist_slug
       or v_plan->>'expected_state_fingerprint'
          is distinct from v_release_slug_plan.expected_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Release slug execution plan drifted from current deterministic policy.';
    end if;

    v_old_slug := v_release_slug_plan.current_slug;
    v_new_slug := v_release_slug_plan.proposed_slug;
    v_old_path :=
      '/releases/' ||
      v_release_slug_plan.artist_slug ||
      '/' ||
      v_old_slug;
    v_new_path :=
      '/releases/' ||
      v_release_slug_plan.artist_slug ||
      '/' ||
      v_new_slug;

    update public.registry_releases
    set
      slug=v_new_slug,
      updated_at=now()
    where id=v_release_id
      and status='active'
      and slug=v_old_slug;
    get diagnostics v_rows=row_count;

    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Release slug compare-and-set lost its one-row boundary.';
    end if;

    update public.community_saves
    set
      entity_slug=v_new_slug,
      entity_url='https://wakilisha.africa' || v_new_path
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_save_rows=row_count;

    update public.community_threads
    set
      entity_id=v_release_id::text,
      entity_slug=v_new_slug,
      entity_url='https://wakilisha.africa' || v_new_path,
      updated_at=now()
    where entity_type='release'
      and (
        entity_id=v_release_id::text
        or (
          entity_slug=v_old_slug
          and entity_url is not null
          and position(v_old_path in entity_url)>0
        )
        or (
          entity_slug=v_old_slug
          and entity_id=v_old_slug
          and entity_url is not null
          and position('/releases/' in entity_url)>0
          and not exists (
            select 1
            from public.registry_releases other
            where other.status='active'
              and other.id<>v_release_id
              and other.slug=v_old_slug
          )
        )
      );
    get diagnostics v_thread_rows=row_count;

    update public.audience_interests
    set
      entity_slug=v_new_slug,
      updated_at=now()
    where entity_type='release'
      and entity_id=v_release_id;
    get diagnostics v_interest_rows=row_count;

    update public.community_activity
    set entity_slug=v_new_slug
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_activity_rows=row_count;

    update public.community_contributions
    set
      entity_slug=v_new_slug,
      updated_at=now()
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_contribution_rows=row_count;

    update public.community_notifications
    set entity_slug=v_new_slug
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_notification_rows=row_count;

    update public.signal_os_content_opportunities
    set
      entity_slug=v_new_slug,
      page_path=v_new_path,
      updated_at=now()
    where entity_type='release'
      and entity_slug=v_old_slug
      and (
        (
          page_path is not null
          and position(v_old_path in page_path)>0
        )
        or not exists (
          select 1
          from public.registry_releases other
          where other.status='active'
            and other.id<>v_release_id
            and other.slug=v_old_slug
        )
      );
    get diagnostics v_opportunity_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      actor
    )
    values (
      'release',
      v_release_id::text,
      v_grant.idempotency_key,
      'mizizi_private.release_slug_plan_v1',
      'slug',
      'public.registry_releases.slug',
      jsonb_build_object('value',v_old_slug),
      jsonb_build_object(
        'value',v_new_slug,
        'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0',
        'downstream_impact',jsonb_build_object(
          'community_saves_updated',v_save_rows,
          'community_threads_updated',v_thread_rows,
          'audience_interests_updated',v_interest_rows,
          'community_activity_updated',v_activity_rows,
          'community_contributions_updated',v_contribution_rows,
          'community_notifications_updated',v_notification_rows,
          'signal_opportunities_updated',v_opportunity_rows
        )
      ),
      'canonicalize_release_slug',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'release_id',v_release_id,
      'old_slug',v_old_slug,
      'new_slug',v_new_slug,
      'old_path',v_old_path,
      'new_path',v_new_path,
      'community_saves_updated',v_save_rows,
      'community_threads_updated',v_thread_rows,
      'audience_interests_updated',v_interest_rows,
      'community_activity_updated',v_activity_rows,
      'community_contributions_updated',v_contribution_rows,
      'community_notifications_updated',v_notification_rows,
      'signal_opportunities_updated',v_opportunity_rows,
      'canonical_write_event_id',v_event_id
    );

  else
    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:chart-track-slug:' ||
        coalesce(v_plan->>'chart_entry_id',''),
        0
      )
    );

    select *
    into v_chart_plan
    from mizizi_private.chart_track_slug_plan_v1(
      v_plan->>'chart_entry_id'
    );

    if v_plan->>'rule_id'<>'chart_track_slug_drift'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'current_track_slug'
          is distinct from v_chart_plan.current_track_slug
       or v_plan->>'canonical_track_slug'
          is distinct from v_chart_plan.canonical_track_slug
       or v_plan->>'canonical_track_id'
          is distinct from v_chart_plan.canonical_track_id::text
       or v_plan->>'expected_state_fingerprint'
          is distinct from v_chart_plan.expected_track_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Chart Track-slug execution plan drifted from current deterministic policy.';
    end if;

    update public.wk_chart_entries_v2
    set
      track_slug=v_chart_plan.canonical_track_slug,
      updated_at=now()
    where id=v_chart_plan.chart_entry_id
      and track_slug=v_chart_plan.current_track_slug
      and canonical_track_id=
        v_chart_plan.canonical_track_id::text;
    get diagnostics v_rows=row_count;

    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Chart Track-slug compare-and-set lost its one-row boundary.';
    end if;

    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      actor
    )
    values (
      'chart_entry',
      v_chart_plan.chart_entry_id,
      v_grant.idempotency_key,
      'mizizi_private.chart_track_slug_plan_v1',
      'track_slug',
      'public.wk_chart_entries_v2.track_slug',
      jsonb_build_object(
        'value',v_chart_plan.current_track_slug
      ),
      jsonb_build_object(
        'value',v_chart_plan.canonical_track_slug,
        'canonical_track_id',v_chart_plan.canonical_track_id,
        'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0'
      ),
      'synchronize_chart_track_slug',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'chart_entry_id',v_chart_plan.chart_entry_id,
      'canonical_track_id',v_chart_plan.canonical_track_id,
      'old_track_slug',v_chart_plan.current_track_slug,
      'new_track_slug',v_chart_plan.canonical_track_slug,
      'canonical_write_event_id',v_event_id
    );
  end if;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values (
    v_operation.id,
    v_event_id
  );

  update platform_private.registry_mutation_operations
  set
    affected_rows=1,
    status='succeeded',
    verifier_status='pending',
    result_payload=v_result,
    completed_at=now(),
    updated_at=now()
  where id=v_operation.id;

  operation_id := v_operation.id;
  operation_status := 'succeeded';
  verifier_status := 'pending';
  idempotent_replay := v_begin.idempotent_replay;
  result_payload := v_result;
  return next;
end
$$;

create function mizizi_private.verify_stewardship_operation_v2(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  platform_private,
  mizizi_private
as $$
declare
  v_operation
    platform_private.registry_mutation_operations%rowtype;
  v_grant
    platform_private.registry_execution_grants%rowtype;
  v_event
    public.registry_canonical_write_events%rowtype;
  v_plan jsonb;
  v_track_id uuid;
  v_link_count integer;
  v_failure text;
  v_expected_path text;
  v_expected_url text;
begin
  perform mizizi_private.assert_executor_v1();

  if p_operation_id is null then
    raise exception using errcode='22023',
      message='Operation id is required.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'mizizi'
     or v_operation.operation_version<>1
     or v_operation.operation_key<>
        'registry.track_slug.canonicalize'
  then
    raise exception using errcode='P0002',
      message='Track-slug V2 stewardship operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<>1
  then
    v_failure:='operation_not_succeeded_exactly_once';
  end if;

  select grant_row.*
  into v_grant
  from platform_private.registry_execution_grants grant_row
  where grant_row.id=v_operation.execution_grant_id;

  if v_failure is null and not found then
    v_failure:='execution_grant_missing';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;

    begin
      v_track_id:=(v_plan->>'track_id')::uuid;
    exception when others then
      v_failure:='track_plan_malformed';
    end;
  end if;

  if v_failure is null
     and (
       nullif(v_plan->>'primary_artist_slug','') is null
       or nullif(v_plan->>'proposed_slug','') is null
     )
  then
    v_failure:='track_public_identity_scope_missing';
  end if;

  if v_failure is null then
    v_expected_path:=
      '/tracks/' ||
      (v_plan->>'primary_artist_slug') ||
      '/' ||
      (v_plan->>'proposed_slug');

    v_expected_url:=
      'https://wakilisha.africa' ||
      v_expected_path;
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_track_id
         and track.status='active'
         and track.slug=v_plan->>'proposed_slug'
     )
  then
    v_failure:='canonical_track_slug_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.wk_chart_entries_v2 entry
       where entry.canonical_track_id=v_track_id::text
         and entry.track_slug is distinct from
             v_plan->>'proposed_slug'
     )
  then
    v_failure:='chart_projection_track_slug_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.community_saves save
       where save.entity_type='track'
         and save.entity_id=v_track_id::text
         and (
           save.entity_slug is distinct from
             v_plan->>'proposed_slug'
           or (
             save.entity_url is not null
             and save.entity_url is distinct from
                 v_expected_url
           )
         )
     )
  then
    v_failure:='community_save_track_pointer_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.community_threads thread_row
       where thread_row.entity_type='track'
         and thread_row.entity_id=v_track_id::text
         and (
           thread_row.entity_slug is distinct from
             v_plan->>'proposed_slug'
           or thread_row.entity_url is distinct from
              v_expected_url
         )
     )
  then
    v_failure:='community_thread_track_pointer_mismatch';
  end if;

  if v_failure is null
     and (
       v_operation.result_payload->>'track_id'
         is distinct from v_track_id::text
       or v_operation.result_payload->>'new_slug'
         is distinct from v_plan->>'proposed_slug'
       or v_operation.result_payload->>'new_path'
         is distinct from v_expected_path
       or jsonb_array_length(
            coalesce(
              v_operation.result_payload->'paths',
              '[]'::jsonb
            )
          )<>1
       or v_operation.result_payload->'paths'->0->>'new_path'
         is distinct from v_expected_path
       or position(
            '/releases/'
            in coalesce(
              v_operation.result_payload->'paths'->0->>'new_path',
              ''
            )
          )>0
     )
  then
    v_failure:='track_v2_result_payload_mismatch';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_link_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    if v_link_count<>1 then
      v_failure:='canonical_write_event_link_count_mismatch';
    end if;
  end if;

  if v_failure is null then
    select event.*
    into v_event
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
    limit 1;

    if not found
       or v_event.registry_entity_type<>'track'
       or v_event.registry_entity_id<>v_track_id::text
       or v_event.source_table<>
          'mizizi_private.track_slug_plan_v1'
       or v_event.field_name<>'slug'
       or v_event.target_path<>
          'public.registry_tracks.slug'
       or v_event.action<>'canonicalize_track_slug'
       or v_event.status<>'succeeded'
       or v_event.actor<>'system:mizizi'
       or v_event.after_value->>'value'
          is distinct from v_plan->>'proposed_slug'
       or v_event.after_value->>'public_identity_version'
          is distinct from 'artist_scoped_track_v2'
       or coalesce(
            (
              v_event.after_value
                #>>'{downstream_impact,community_threads_updated}'
            )::integer,
            -1
          )<>
          coalesce(
            (
              v_operation.result_payload
                ->>'community_threads_updated'
            )::integer,
            -1
          )
    then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status='passed',
      result_payload=
        result_payload ||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status','passed',
            'verified_at',now(),
            'verifier','track_slug_v2'
          )
        ),
      updated_at=now()
    where id=v_operation.id;

    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set
    verifier_status='failed',
    error_code='mizizi_track_slug_v2_verification_failed',
    error_message=v_failure,
    result_payload=
      result_payload ||
      jsonb_build_object(
        'verification',
        jsonb_build_object(
          'status','failed',
          'failure',v_failure,
          'verified_at',now(),
          'verifier','track_slug_v2'
        )
      ),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;


-- Public Music Identity Track-slug zero convergence.
--
-- V2 changes only Track-slug execution semantics. Other Stage B operations
-- retain the exact V1 implementation copied above.
--
-- The governed Production apply remains separately reviewed and triggered.

do $preflight$
begin
  if to_regprocedure(
       'mizizi_private.execute_stewardship_operation_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.verify_stewardship_operation_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.track_slug_plan_v1(uuid)'
     ) is null
  then
    raise exception
      'STOP: accepted V1 Track-slug stewardship authority is missing.';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.track_slug.canonicalize'
      and operation_version=1
      and capability_key='canonicalize_registry_track_slug'
      and enabled=false
      and max_targets=1
      and max_rows_ceiling=1
      and max_grant_ttl_seconds=300
      and requires_verifier
      and requires_existing_target
  ) then
    raise exception
      'STOP: Track-slug operation authority is not exact or is enabled.';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
  ) then
    raise exception
      'STOP: MIZIZI authority is not zero at rest.';
  end if;

  if (
    select count(*)
    from public.registry_review_items review
    join public.registry_tracks track
      on track.id::text=review.source_id
     and track.status='active'
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_payload->>'ruleId'=
          'track_slug_identity_noise'
      and (
        review.source_payload->'evidence'->>'collision'
          like
          'candidate_slug_collides_with_current_community_thread:%'
        or
        review.source_payload->'evidence'->>'collision'
          like
          'current_community_thread_ownership_ambiguous:%'
      )
  )<>34
  then
    raise exception
      'STOP: Track-slug zero candidate count drifted from 34.';
  end if;
end
$preflight$;


create function
  mizizi_private.finalize_track_slug_zero_convergence_v1(
    p_capability_grant_id uuid
  )
returns table (
  resolved_reviews integer,
  decision_rows integer,
  standing_grant_status text
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  platform_private,
  mizizi_private
as $$
declare
  v_standing
    platform_private.system_actor_capability_grants%rowtype;
  v_resolved integer:=0;
  v_decisions integer:=0;
  v_applied integer:=0;
begin
  perform mizizi_private.assert_executor_v1();

  if p_capability_grant_id is null then
    raise exception using errcode='22023',
      message='Capability grant id is required.';
  end if;

  select standing.*
  into v_standing
  from platform_private.system_actor_capability_grants standing
  where standing.id=p_capability_grant_id
  for update;

  if not found
     or v_standing.actor_key<>'mizizi'
     or
       v_standing.capability_key<>
       'canonicalize_registry_track_slug'
     or v_standing.status<>'active'
  then
    raise exception using errcode='42501',
      message=
        'Active human Track-slug capability grant is required.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants exact_grant
    join platform_private.registry_mutation_operations operation
      on operation.execution_grant_id=exact_grant.id
    where exact_grant.system_actor_capability_grant_id=
          p_capability_grant_id
      and (
        operation.status in (
          'authorized',
          'executing',
          'compensating'
        )
        or (
          operation.status='succeeded'
          and operation.verifier_status<>'passed'
        )
      )
  ) then
    raise exception using errcode='55000',
      message=
        'Unsafe Track-slug operation residue remains.';
  end if;

  select count(distinct review.id)::integer
  into v_applied
  from public.registry_review_items review
  join public.registry_tracks track
    on track.id::text=review.source_id
   and track.status='active'
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_identity_noise'
    and (
      review.source_payload->'evidence'->>'collision'
        like
        'candidate_slug_collides_with_current_community_thread:%'
      or
      review.source_payload->'evidence'->>'collision'
        like
        'current_community_thread_ownership_ambiguous:%'
    )
    and track.slug=
        review.candidate_payload->>'proposedValue'
    and exists (
      select 1
      from platform_private.registry_execution_grants exact_grant
      join platform_private.registry_execution_grant_targets target
        on target.execution_grant_id=exact_grant.id
      join platform_private.registry_mutation_operations operation
        on operation.execution_grant_id=exact_grant.id
      where
        exact_grant.system_actor_capability_grant_id=
          p_capability_grant_id
        and
          exact_grant.operation_key=
          'registry.track_slug.canonicalize'
        and exact_grant.operation_version=1
        and target.subject_type='track'
        and target.subject_id=review.source_id::uuid
        and operation.status='succeeded'
        and operation.verifier_status='passed'
    );

  if v_applied<>34 then
    raise exception using errcode='55000',
      message=
        'Expected exactly 34 verified Track-slug zero operations.';
  end if;

  insert into public.registry_canonicalization_decisions (
    review_item_id,
    decision_type,
    entity_type,
    entity_id,
    before_payload,
    after_payload,
    decision_notes,
    decided_by,
    status,
    metadata
  )
  select
    review.id,
    'auto_resolved_stale_community_slug_blocker',
    'track',
    review.source_id::uuid,
    jsonb_build_object(
      'reviewKey',review.review_key,
      'sourcePayload',review.source_payload,
      'candidatePayload',review.candidate_payload
    ),
    jsonb_build_object(
      'resolution',
        'governed_track_slug_zero_convergence',
      'finalSlug',track.slug,
      'candidateFingerprint',
        '1f178ed3aff1ac2ba998eefec42ac1f8abdb62ed4e70a93471715552399f5669',
      'capabilityGrantId',
        p_capability_grant_id
    ),
    'Resolved after UUID-backed Community identity made the historical slug blocker obsolete and the governed Track mutation verified.',
    v_standing.granted_by_user_id,
    'recorded',
    jsonb_build_object(
      'programmeIssue',1068,
      'programmeKey',
        'public_music_identity_track_slug_zero',
      'publicRenderingChanged',true,
      'canonicalEntitiesChanged',true
    )
  from public.registry_review_items review
  join public.registry_tracks track
    on track.id::text=review.source_id
   and track.status='active'
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_identity_noise'
    and (
      review.source_payload->'evidence'->>'collision'
        like
        'candidate_slug_collides_with_current_community_thread:%'
      or
      review.source_payload->'evidence'->>'collision'
        like
        'current_community_thread_ownership_ambiguous:%'
    )
    and track.slug=
        review.candidate_payload->>'proposedValue';

  get diagnostics v_decisions=row_count;

  update public.registry_review_items review
  set
    status='resolved',
    resolution_payload=
      jsonb_build_object(
        'decisionType',
          'auto_resolved_stale_community_slug_blocker',
        'resolution',
          'governed_track_slug_zero_convergence',
        'programmeKey',
          'public_music_identity_track_slug_zero',
        'candidateFingerprint',
          '1f178ed3aff1ac2ba998eefec42ac1f8abdb62ed4e70a93471715552399f5669',
        'capabilityGrantId',
          p_capability_grant_id
      ),
    resolved_at=now(),
    updated_at=now()
  from public.registry_tracks track
  where track.id::text=review.source_id
    and track.status='active'
    and review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_identity_noise'
    and (
      review.source_payload->'evidence'->>'collision'
        like
        'candidate_slug_collides_with_current_community_thread:%'
      or
      review.source_payload->'evidence'->>'collision'
        like
        'current_community_thread_ownership_ambiguous:%'
    )
    and track.slug=
        review.candidate_payload->>'proposedValue';

  get diagnostics v_resolved=row_count;

  if v_resolved<>34 or v_decisions<>34 then
    raise exception using errcode='55000',
      message=
        'Track-slug zero review finalization was not exactly 34/34.';
  end if;

  update platform_private.registry_execution_grants
  set
    status='expired',
    updated_at=now()
  where
    system_actor_capability_grant_id=
      p_capability_grant_id
    and actor_key='mizizi'
    and status='active'
    and consumed_at is null;

  update platform_private.registry_operation_types
  set
    enabled=false,
    updated_at=now()
  where
    operation_key='registry.track_slug.canonicalize'
    and operation_version=1;

  update platform_private.system_actor_capability_grants
  set
    status='expired',
    updated_at=now()
  where id=p_capability_grant_id
    and status='active';

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
  )
  or exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.registry_operation_types
    where
      operation_key='registry.track_slug.canonicalize'
      and operation_version=1
      and enabled
  )
  then
    raise exception using errcode='55000',
      message=
        'Track-slug authority did not return to zero at rest.';
  end if;

  resolved_reviews:=v_resolved;
  decision_rows:=v_decisions;
  standing_grant_status:='expired';

  return next;
end
$$;


revoke all on function
  mizizi_private.execute_stewardship_operation_v2(uuid),
  mizizi_private.verify_stewardship_operation_v2(uuid),
  mizizi_private.finalize_track_slug_zero_convergence_v1(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.execute_stewardship_operation_v2(uuid),
  mizizi_private.verify_stewardship_operation_v2(uuid),
  mizizi_private.finalize_track_slug_zero_convergence_v1(uuid)
to mizizi_executor;


do $postflight$
begin
  if to_regprocedure(
       'mizizi_private.execute_stewardship_operation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.verify_stewardship_operation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.finalize_track_slug_zero_convergence_v1(uuid)'
     ) is null
  then
    raise exception
      'STOP: Track-slug zero V2 authority was not installed.';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
  )
  or exists (
    select 1
    from platform_private.registry_operation_types
    where
      operation_key='registry.track_slug.canonicalize'
      and operation_version=1
      and enabled
  )
  then
    raise exception
      'STOP: migration changed MIZIZI authority at rest.';
  end if;

  if has_function_privilege(
       'authenticated',
       'mizizi_private.execute_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.execute_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.verify_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.verify_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: V2 executor escaped the executor-only boundary.';
  end if;
end
$postflight$;
