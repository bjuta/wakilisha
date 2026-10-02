-- Creator cohort / #1118
-- Compose verified self-Artist claims with the governed Person↔Registry Artist
-- persona authority introduced by Music Provenance Slice 1.
--
-- No name-based Person↔Artist inference occurs here. The only accepted chain is:
-- reviewed self-Artist claim -> claimant's active canonical Person
-- -> accepted Registry Artist -> exact evidence -> existing persona-link authority.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'creator-claim-person-artist-composition-v1',
    0
  )
);

do $preflight$
begin
  if not exists (
       select 1
       from supabase_migrations.schema_migrations
       where version='20261002035715'
     )
     or (
       select count(*)::integer
       from supabase_migrations.schema_migrations
     ) <> 196
     or to_regclass('public.artist_claim_requests') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('editorial.person_registry_artist_links') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regprocedure(
          'public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)'
        ) is null
     or to_regprocedure(
          'public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)'
        ) is null
  then
    raise exception
      'STOP: creator claim persona composition requires accepted claim, Person, evidence and Music Provenance Slice 1 authority.';
  end if;

  if to_regprocedure(
       'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)'
     ) is not null
     or exists (
       select 1
       from pg_trigger
       where tgname='artist_claim_verified_persona_composition_v1'
         and not tgisinternal
     )
  then
    raise exception
      'STOP: creator claim persona composition authority already exists; audit before reapplying.';
  end if;
end
$preflight$;

create function platform_private.compose_verified_artist_claim_persona_v1(
  p_claim_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,platform_private,auth,extensions
as $function$
declare
  v_actor uuid:=auth.uid();
  v_reason text:=btrim(coalesce(p_reason,''));
  v_claim public.artist_claim_requests%rowtype;
  v_person_id uuid;
  v_person_link_count integer;
  v_person editorial.people%rowtype;
  v_claim_payload jsonb;
  v_source_ref text;
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_link_result jsonb;
begin
  if v_actor is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
     or not coalesce(
       public.current_user_has_capability('manage_people_identity'),
       false
     )
  then
    raise exception using errcode='42501',
      message='manage_registry and manage_people_identity are required.';
  end if;

  if p_claim_id is null
     or char_length(v_reason)<3
     or octet_length(v_reason)>4000
  then
    raise exception using errcode='22023',
      message='Verified Artist claim and review reason are required.';
  end if;

  select claim.*
  into v_claim
  from public.artist_claim_requests claim
  where claim.id=p_claim_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Artist claim does not exist.';
  end if;

  if v_claim.status<>'verified'
     or v_claim.artist_id is null
     or v_claim.claimant_user_id is null
  then
    raise exception using errcode='23514',
      message='Artist claim must already be verified against one Registry Artist.';
  end if;

  if v_claim.claimant_role<>'artist' then
    raise exception using errcode='23514',
      message='Only a verified self-Artist claim can establish Person-to-Artist persona identity.';
  end if;

  select count(*)::integer
  into v_person_link_count
  from editorial.person_identity_links link
  where link.user_id=v_claim.claimant_user_id
    and link.link_state='active';

  if v_person_link_count<>1 then
    raise exception using errcode='23514',
      message='Verified Artist claimant must resolve to exactly one active canonical Person.';
  end if;

  select link.person_resource_id
  into v_person_id
  from editorial.person_identity_links link
  where link.user_id=v_claim.claimant_user_id
    and link.link_state='active'
  order by link.created_at desc,link.id
  limit 1;

  select person.*
  into v_person
  from editorial.people person
  where person.resource_id=v_person_id
  for update;

  if not found or v_person.person_state<>'active' then
    raise exception using errcode='23514',
      message='Verified Artist claimant Person is missing or inactive.';
  end if;

  v_claim_payload:=jsonb_build_object(
    'person_resource_id',v_person_id::text,
    'registry_artist_id',v_claim.artist_id::text
  );

  v_source_ref:='artist-claim:'||v_claim.id::text||':person-artist-link';

  v_source_payload_fingerprint:=encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'claim_id',v_claim.id,
          'claimant_user_id',v_claim.claimant_user_id,
          'claim_kind',v_claim.claim_kind,
          'claimant_role',v_claim.claimant_role,
          'artist_id',v_claim.artist_id,
          'status',v_claim.status,
          'decided_at',v_claim.decided_at,
          'decided_by',v_claim.decided_by,
          'decision_reason',v_claim.decision_reason
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  v_assertion_fingerprint:=encode(
    extensions.digest(
      pg_catalog.convert_to(
        jsonb_build_object(
          'claim_key','registry.person_artist.link',
          'subject_type','artist',
          'subject_id',v_claim.artist_id,
          'claim_payload',v_claim_payload,
          'source_ref',v_source_ref
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint,
    originator_ref,
    upstream_source_ref,
    lineage_key,
    verification_method,
    source_use_basis,
    source_use_detail
  )
  values (
    'artist',
    v_claim.artist_id,
    'registry.person_artist.link',
    v_claim_payload,
    'USER_CONTENT',
    'artist_claim_review',
    v_source_ref,
    v_source_payload_fingerprint,
    coalesce(v_claim.decided_at,now()),
    'user:'||v_actor::text,
    v_assertion_fingerprint,
    'user:'||v_claim.claimant_user_id::text,
    'artist-claim:'||v_claim.id::text,
    'artist-claim-persona:'||v_claim.id::text,
    'human_reviewed_artist_claim',
    'identity_link_review',
    v_reason
  )
  on conflict (assertion_fingerprint) do nothing;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.assertion_fingerprint=v_assertion_fingerprint;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>v_claim.artist_id
     or v_evidence.claim_key<>'registry.person_artist.link'
     or v_evidence.claim_payload<>v_claim_payload
     or v_evidence.source_ref<>v_source_ref
  then
    raise exception using errcode='42501',
      message='Artist claim persona evidence did not converge exactly.';
  end if;

  v_evidence_id:=v_evidence.id;

  v_link_result:=public.admin_link_person_registry_artist_v1(
    v_person_id,
    v_person.identity_revision,
    v_claim.artist_id,
    v_evidence_id,
    v_reason
  );

  return jsonb_build_object(
    'claim_id',v_claim.id,
    'person_resource_id',v_person_id,
    'registry_artist_id',v_claim.artist_id,
    'evidence_assertion_id',v_evidence_id,
    'persona_link',v_link_result
  );
end
$function$;

revoke all on function
  platform_private.compose_verified_artist_claim_persona_v1(uuid,text)
from public,anon,authenticated,service_role;

create function public.admin_finalize_verified_artist_claim_persona_v1(
  p_claim_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,platform_private
as $function$
begin
  return platform_private.compose_verified_artist_claim_persona_v1(
    p_claim_id,
    p_reason
  );
end
$function$;

revoke all on function
  public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)
from public,anon,service_role;

grant execute on function
  public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)
to authenticated;

create function platform_private.compose_verified_artist_claim_persona_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $function$
begin
  if old.status is distinct from new.status
     and new.status='verified'
     and new.artist_id is not null
     and new.claimant_user_id is not null
     and new.claimant_role='artist'
     and coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
     and coalesce(
       public.current_user_has_capability('manage_people_identity'),
       false
     )
  then
    perform platform_private.compose_verified_artist_claim_persona_v1(
      new.id,
      coalesce(
        nullif(btrim(new.decision_reason),''),
        'Verified Artist claim persona composition.'
      )
    );
  end if;

  return new;
end
$function$;

revoke all on function
  platform_private.compose_verified_artist_claim_persona_trigger_v1()
from public,anon,authenticated,service_role;

create trigger artist_claim_verified_persona_composition_v1
after update of status,artist_id
on public.artist_claim_requests
for each row
execute function
  platform_private.compose_verified_artist_claim_persona_trigger_v1();

do $postcheck$
declare
  v_private_definition text;
  v_wrapper_definition text;
begin
  if not exists (
       select 1
       from pg_trigger
       where tgname='artist_claim_verified_persona_composition_v1'
         and tgrelid='public.artist_claim_requests'::regclass
         and tgenabled='O'
         and not tgisinternal
     )
  then
    raise exception
      'STOP: verified Artist claim persona composition trigger is missing.';
  end if;

  select pg_get_functiondef(
    'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)'::regprocedure
  )
  into v_private_definition;

  if position('manage_registry' in v_private_definition)=0
     or position('manage_people_identity' in v_private_definition)=0
     or position('registry.person_artist.link' in v_private_definition)=0
     or position('admin_link_person_registry_artist_v1' in v_private_definition)=0
     or position(
       'claimant_role<>''artist''' in
       replace(v_private_definition,' ','')
     )=0
  then
    raise exception
      'STOP: claim persona composition lost required identity authority.';
  end if;

  select pg_get_functiondef(
    'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)'::regprocedure
  )
  into v_wrapper_definition;

  if position(
       'compose_verified_artist_claim_persona_v1' in
       v_wrapper_definition
     )=0
  then
    raise exception
      'STOP: public claim persona finalizer is not bound to private authority.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: claim persona composition execution privileges drifted.';
  end if;
end
$postcheck$;

commit;
