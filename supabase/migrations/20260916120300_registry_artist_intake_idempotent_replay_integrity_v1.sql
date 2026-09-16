-- MIZIZI Slice 2 Artist Intake Idempotent Replay Integrity V1
--
-- A successful deterministic Artist materialization must replay before fresh
-- collision discovery, otherwise the materialized Artist collides with itself.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-intake-idempotent-replay-integrity-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure('public.admin_create_registry_artist_intake_shell_v1(uuid)') is null
     or to_regprocedure('platform_private.execute_registry_materialization_v1(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_materialization_v1(uuid)') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
  then
    raise exception 'STOP: Artist Intake Authority V1 replay foundation is missing';
  end if;
end
$preflight$;

create or replace function public.admin_create_registry_artist_intake_shell_v1(
  p_staging_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_review jsonb;
  v_display_name text;
  v_normalized_name text;
  v_slug text;
  v_future_id uuid;
  v_collision jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_existing_grant platform_private.registry_execution_grants%rowtype;
  v_execution record;
  v_verification record;
  v_artist public.registry_artists%rowtype;
begin
  v_user_id:=platform_private.registry_artist_intake_current_admin_v1();
  v_review:=platform_private.registry_artist_intake_review_snapshot_v1(p_staging_id);

  if v_review->>'target_registry_artist_id' is not null
     or v_review->>'match_status'<>'no_match'
  then
    raise exception using errcode='42501', message='Reviewed Artist intake row is not eligible for shell creation.';
  end if;

  v_display_name:=btrim(regexp_replace(coalesce(v_review->>'source_artist_name',''),'[[:space:]]+',' ','g'));
  v_normalized_name:=platform_private.registry_identity_normalize_text_v1(v_display_name);
  v_slug:=platform_private.registry_artist_creation_slug_v1(v_display_name);

  if length(v_display_name)<2
     or nullif(v_normalized_name,'') is null
     or nullif(v_slug,'') is null
  then
    raise exception using errcode='22023', message='Valid Artist name is required.';
  end if;

  v_future_id:=platform_private.registry_artist_intake_deterministic_uuid_v1(p_staging_id);

  select execution_grant.*
  into v_existing_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_intake_admin'
    and execution_grant.operation_key='registry.artist.create'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key='artist-intake-create:'||p_staging_id::text;

  if found then
    if v_existing_grant.issued_by_user_id<>v_user_id
       or v_existing_grant.plan_payload->>'artist_id' is distinct from v_future_id::text
       or v_existing_grant.plan_payload->>'display_name' is distinct from v_display_name
       or v_existing_grant.plan_payload->>'normalized_name' is distinct from v_normalized_name
       or v_existing_grant.plan_payload->>'slug' is distinct from v_slug
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target
         where target.execution_grant_id=v_existing_grant.id
           and target.subject_type='artist'
           and target.subject_id=v_future_id
           and target.expected_state_fingerprint is null
       )<>1
    then
      raise exception using errcode='40001',
        message='Existing Artist intake grant is not bound to the current reviewed identity.';
    end if;

    select *
    into v_execution
    from platform_private.execute_registry_materialization_v1(
      'registry_artist_intake_admin',
      v_existing_grant.id
    );

    select *
    into v_verification
    from platform_private.verify_registry_materialization_v1(v_execution.operation_id);

    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id=v_future_id;

    if v_execution.operation_status<>'succeeded'
       or not v_execution.idempotent_replay
       or v_verification.verifier_status<>'passed'
       or not found
       or v_artist.status<>'draft'
    then
      raise exception using errcode='40001',
        message='Artist intake idempotent replay did not preserve the verified draft materialization.';
    end if;

    return jsonb_build_object(
      'created',false,
      'artist',jsonb_build_object(
        'artist_id',v_artist.id,
        'artist_slug',v_artist.slug,
        'artist_name',v_artist.display_name,
        'status',v_artist.status
      ),
      'operation_id',v_execution.operation_id,
      'verifier_status',v_verification.verifier_status,
      'idempotent_replay',true
    );
  end if;

  v_collision:=platform_private.registry_artist_creation_collision_state_v1(v_future_id,v_display_name);

  if v_collision<>'[]'::jsonb then
    raise exception using errcode='40001',
      message='Artist identity changed after review. Re-review and link the canonical Artist explicitly.';
  end if;

  v_evidence_id:=platform_private.record_registry_artist_intake_creation_evidence_v1(
    p_staging_id,
    v_future_id,
    v_display_name,
    v_normalized_name,
    v_slug
  );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist.create',
    'operation_version',1,
    'artist_id',v_future_id,
    'display_name',v_display_name,
    'normalized_name',v_normalized_name,
    'slug',v_slug,
    'collision_state_fingerprint',platform_private.registry_identity_creation_collision_fingerprint_v1(v_collision),
    'evidence_assertion_id',v_evidence.id,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_grant_id:=platform_private.issue_registry_artist_intake_create_grant_v1(
    p_staging_id,
    v_evidence.id,
    v_future_id,
    v_plan
  );

  select *
  into v_execution
  from platform_private.execute_registry_materialization_v1(
    'registry_artist_intake_admin',
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_materialization_v1(v_execution.operation_id);

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='40001', message='Artist intake shell independent verification failed.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_future_id;

  if not found or v_artist.status<>'draft' then
    raise exception using errcode='40001', message='Artist intake shell did not materialize as a draft.';
  end if;

  return jsonb_build_object(
    'created',not v_execution.idempotent_replay,
    'artist',jsonb_build_object(
      'artist_id',v_artist.id,
      'artist_slug',v_artist.slug,
      'artist_name',v_artist.display_name,
      'status',v_artist.status
    ),
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

revoke all on function public.admin_create_registry_artist_intake_shell_v1(uuid) from public;
grant execute on function public.admin_create_registry_artist_intake_shell_v1(uuid) to authenticated;

comment on function public.admin_create_registry_artist_intake_shell_v1(uuid) is
  'Materializes a reviewed no-match Artist as a verified draft. Existing exact intake grants replay before fresh collision discovery so deterministic retries cannot collide with their own prior result.';

commit;
