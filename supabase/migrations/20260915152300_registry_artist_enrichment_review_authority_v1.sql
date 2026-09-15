-- MIZIZI Slice 2 Artist Enrichment Reviewed Evidence Authority V1
--
-- Separates proposal acquisition from canonical admission. Preview may persist
-- immutable typed evidence but cannot mutate canonical Registry Artist state.
-- Apply consumes the exact evidence UUID reviewed by the same manage_registry
-- principal; provider data is never re-fetched between review and admission.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-enrichment-reviewed-evidence-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.record_registry_artist_enrichment_user_evidence(uuid,text,jsonb,text,text,text,timestamp with time zone)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_artist_enrichment_user_execution_grant(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_artist_enrichment_admission(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_artist_enrichment_admission(uuid)'
     ) is null
  then
    raise exception
      'STOP: Artist Enrichment V1 foundation/integrity authority is missing';
  end if;

  if to_regprocedure(
       'public.admin_prepare_registry_artist_provider_profile_evidence(uuid,text,text,bigint,integer,text[],text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_prepare_registry_artist_public_image_evidence(uuid,text,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)'
     ) is not null
  then
    raise exception
      'STOP: Artist Enrichment reviewed-evidence authority already exists';
  end if;
end
$preflight$;

create function public.admin_prepare_registry_artist_provider_profile_evidence(
  p_artist_id uuid,
  p_spotify_id text default null,
  p_apple_music_id text default null,
  p_spotify_followers bigint default null,
  p_spotify_popularity integer default null,
  p_enriched_genres text[] default null,
  p_source_kind text default 'spotify_apple_music',
  p_source_ref text default null,
  p_source_payload_fingerprint text default null,
  p_observed_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_payload jsonb := '{}'::jsonb;
begin
  if auth.uid() is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_spotify_id is not null then
    v_payload := v_payload || jsonb_build_object('spotify_id', btrim(p_spotify_id));
  end if;
  if p_apple_music_id is not null then
    v_payload := v_payload || jsonb_build_object('apple_music_id', btrim(p_apple_music_id));
  end if;
  if p_spotify_followers is not null then
    v_payload := v_payload || jsonb_build_object('spotify_followers', p_spotify_followers);
  end if;
  if p_spotify_popularity is not null then
    v_payload := v_payload || jsonb_build_object('spotify_popularity', p_spotify_popularity);
  end if;
  if p_enriched_genres is not null then
    v_payload := v_payload || jsonb_build_object(
      'enriched_genres',
      to_jsonb(array(
        select distinct btrim(genre)
        from unnest(p_enriched_genres) genre
        where nullif(btrim(genre), '') is not null
        order by btrim(genre)
      ))
    );
  end if;

  return platform_private.record_registry_artist_enrichment_user_evidence(
    p_artist_id,
    'registry.artist.provider_profile',
    v_payload,
    p_source_kind,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  );
end
$$;

create function public.admin_prepare_registry_artist_public_image_evidence(
  p_artist_id uuid,
  p_public_image_url text,
  p_image_source_provider text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz default now()
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select platform_private.record_registry_artist_enrichment_user_evidence(
    p_artist_id,
    'registry.artist.public_image',
    jsonb_build_object(
      'public_image_url', p_public_image_url,
      'image_source_provider', p_image_source_provider
    ),
    p_image_source_provider,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  )
$$;

create function public.admin_prepare_registry_artist_bio_evidence(
  p_artist_id uuid,
  p_bio text,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz default now()
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select platform_private.record_registry_artist_enrichment_user_evidence(
    p_artist_id,
    'registry.artist.bio',
    jsonb_build_object('bio', p_bio),
    p_source_kind,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  )
$$;

create function public.admin_prepare_registry_artist_type_evidence(
  p_artist_id uuid,
  p_artist_type text,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz default now()
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
  select platform_private.record_registry_artist_enrichment_user_evidence(
    p_artist_id,
    'registry.artist.type',
    jsonb_build_object('artist_type', p_artist_type),
    p_source_kind,
    p_source_ref,
    p_source_payload_fingerprint,
    p_observed_at
  )
$$;

create function public.admin_execute_registry_artist_enrichment_evidence_admission(
  p_evidence_assertion_id uuid
)
returns table (
  evidence_assertion_id uuid,
  execution_grant_id uuid,
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_grant record;
  v_execution record;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id = p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.claim_key not in (
       'registry.artist.provider_profile',
       'registry.artist.public_image',
       'registry.artist.bio',
       'registry.artist.type'
     )
     or v_evidence.recorded_by_principal_key <> 'user:' || v_user_id::text
     or not platform_private.registry_artist_enrichment_claim_is_valid(
       v_evidence.claim_key,
       v_evidence.claim_payload,
       v_evidence.source_kind
     )
  then
    raise exception
      using errcode='42501',
            message='Reviewed Artist-enrichment evidence is missing, belongs to another principal, or violates V1.';
  end if;

  if v_evidence.observed_at < now() - interval '30 days'
     or v_evidence.observed_at > now() + interval '5 minutes'
  then
    raise exception
      using errcode='42501',
            message='Reviewed Artist-enrichment evidence is outside the V1 freshness window.';
  end if;

  select *
  into v_grant
  from platform_private.issue_registry_artist_enrichment_user_execution_grant(
    v_evidence.id
  );

  select *
  into v_execution
  from platform_private.execute_registry_artist_enrichment_admission(
    v_grant.execution_grant_id
  );

  if not v_execution.idempotent_replay then
    insert into public.registry_audit_log (
      actor_id,
      actor_label,
      action,
      entity_type,
      entity_id,
      after_value,
      metadata
    ) values (
      v_user_id,
      'registry_admin',
      'execute_reviewed_registry_artist_enrichment_admission',
      'registry_artist',
      v_evidence.subject_id,
      v_evidence.claim_payload,
      jsonb_build_object(
        'claim_key', v_evidence.claim_key,
        'evidence_assertion_id', v_evidence.id,
        'execution_grant_id', v_grant.execution_grant_id,
        'operation_id', v_execution.operation_id,
        'source_kind', v_evidence.source_kind
      )
    );
  end if;

  evidence_assertion_id := v_evidence.id;
  execution_grant_id := v_grant.execution_grant_id;
  operation_id := v_execution.operation_id;
  operation_status := v_execution.operation_status;
  verifier_status := v_execution.verifier_status;
  idempotent_replay := v_execution.idempotent_replay;
  return next;
end
$$;

-- Raw-value execute wrappers were useful while composing V1, but once reviewed
-- evidence exists they are no longer a product authority surface. Keep the
-- definitions for migration compatibility while denying ordinary roles.
revoke execute on function
  public.admin_execute_registry_artist_provider_profile_admission(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz),
  public.admin_execute_registry_artist_public_image_admission(uuid,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_bio_admission(uuid,text,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_type_admission(uuid,text,text,text,text,text,timestamptz)
from authenticated;

revoke all on function
  public.admin_prepare_registry_artist_provider_profile_evidence(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz),
  public.admin_prepare_registry_artist_public_image_evidence(uuid,text,text,text,text,timestamptz),
  public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,timestamptz),
  public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)
from public, anon, service_role;

grant execute on function
  public.admin_prepare_registry_artist_provider_profile_evidence(uuid,text,text,bigint,integer,text[],text,text,text,timestamptz),
  public.admin_prepare_registry_artist_public_image_evidence(uuid,text,text,text,text,timestamptz),
  public.admin_prepare_registry_artist_bio_evidence(uuid,text,text,text,text,text,timestamptz),
  public.admin_prepare_registry_artist_type_evidence(uuid,text,text,text,text,text,timestamptz),
  public.admin_execute_registry_artist_enrichment_evidence_admission(uuid)
to authenticated;

commit;
