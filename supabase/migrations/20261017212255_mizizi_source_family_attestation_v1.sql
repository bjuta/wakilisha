-- MIZIZI QV3: human source-attestation journal on existing Registry and Editorial sources.
-- Supabase CLI v2.107.0 minted exact path in GitHub Actions #39070682622.
-- No new source library, Registry writer, ACH grader, public source exposure or sample data.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $preflight$
begin
 if current_user<>'postgres'
  or to_regclass('mizizi_private.case_question_versions') is null
  or to_regclass('platform_private.registry_evidence_assertions') is null
  or to_regclass('editorial.sources') is null
  or to_regclass('editorial.source_versions') is null
  or to_regclass('editorial.source_registry_links') is null
  or to_regprocedure('public.admin_mizizi_freeze_case_question_v1(uuid,integer,uuid,integer,text,jsonb,text)') is null
  or to_regprocedure('mizizi_private.assert_registry_admission_not_held_v1(text,integer)') is null
 then raise exception 'STOP_MZ_QV3_ACCEPTED_SOURCE_OR_QUESTION_AUTHORITY_MISSING';end if;
 if to_regclass('mizizi_private.question_source_attestation_events') is not null
  or to_regprocedure('public.admin_mizizi_attest_question_source_v1(uuid,integer,uuid,integer,uuid,uuid,uuid,uuid,text,text,text,text,text,text)') is not null
 then raise exception 'STOP_MZ_QV3_AUTHORITY_ALREADY_PRESENT';end if;
 if has_schema_privilege('authenticated','mizizi_private','USAGE')
  or has_schema_privilege('service_role','mizizi_private','USAGE')
 then raise exception 'STOP_MZ_QV3_PRIVATE_SCHEMA_EXPOSED';end if;
end;
$preflight$;

-- A reviewer records a human assertion about correspondence and source-family
-- origin. The underlying source, version, review, rights, consent and Registry
-- assertion remain independently owned by their existing authorities.
create table mizizi_private.question_source_attestation_events (
 id uuid primary key,
 workspace_id uuid not null,
 case_id uuid not null,
 case_revision integer not null check(case_revision>=1),
 question_id uuid not null,
 question_revision integer not null check(question_revision>=1),
 question_fingerprint text not null check(question_fingerprint ~ '^[a-f0-9]{64}$'),
 registry_assertion_id uuid not null references
  platform_private.registry_evidence_assertions(id) on update restrict on delete restrict,
 registry_assertion_fingerprint text not null
  check(registry_assertion_fingerprint ~ '^[a-f0-9]{64}$'),
 editorial_source_id uuid not null references editorial.sources(id)
  on update restrict on delete restrict,
 editorial_source_version_id uuid not null references editorial.source_versions(id)
  on update restrict on delete restrict,
 editorial_source_fingerprint text not null,
 source_family_key text not null check(
  char_length(source_family_key) between 8 and 140
  and source_family_key ~ '^[a-z0-9][a-z0-9._:/-]*$'),
 source_correlation_reason text not null check(
  char_length(btrim(source_correlation_reason)) between 30 and 1000
  and source_correlation_reason=btrim(source_correlation_reason)),
 independence_reason text not null check(
  char_length(btrim(independence_reason)) between 30 and 1000
  and independence_reason=btrim(independence_reason)),
 decision text not null check(decision in ('attested','revoked')),
 review_revision integer not null check(review_revision between 1 and 30),
 reviewer_user_id uuid not null references auth.users(id)
  on update restrict on delete restrict,
 review_reason text not null check(
  char_length(btrim(review_reason)) between 12 and 1000
  and review_reason=btrim(review_reason)),
 receipt_fingerprint text not null default repeat('0',64)
  check(receipt_fingerprint ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 constraint mz_qv3_frozen_question foreign key (
  workspace_id,case_id,question_id,question_revision)
  references mizizi_private.case_question_versions(
   workspace_id,case_id,question_id,question_revision)
  on update restrict on delete restrict,
 constraint mz_qv3_revision_unique unique (
  workspace_id,case_id,question_id,question_revision,
  registry_assertion_id,review_revision)
);
create index mz_qv3_question_attestations on
 mizizi_private.question_source_attestation_events(
  workspace_id,case_id,question_id,question_revision,
  registry_assertion_id,review_revision desc);
alter table mizizi_private.question_source_attestation_events enable row level security;
alter table mizizi_private.question_source_attestation_events force row level security;
revoke all on mizizi_private.question_source_attestation_events
 from public,anon,authenticated,service_role,mizizi_executor;
comment on table mizizi_private.question_source_attestation_events is
 'Human-reviewed source and family correspondence, append-only with revocation. Not an ACH grade, independent scientific proof, rights decision, Registry mutation or publication authority.';

create function mizizi_private.seal_question_source_attestation_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $seal$
begin
 new.recorded_at:=clock_timestamp();
 new.receipt_fingerprint:=encode(extensions.digest(
  concat_ws('|','mizizi-source-attestation-v1',
   new.id::text,new.workspace_id::text,new.case_id::text,
   new.case_revision::text,new.question_id::text,new.question_revision::text,
   new.question_fingerprint,new.registry_assertion_id::text,
   new.registry_assertion_fingerprint,new.editorial_source_id::text,
   new.editorial_source_version_id::text,new.editorial_source_fingerprint,
   new.source_family_key,new.source_correlation_reason,
   new.independence_reason,new.decision,new.review_revision::text,
   new.reviewer_user_id::text,new.review_reason),'sha256'),'hex');
 return new;
end;
$seal$;
create trigger mz_qv3_seal before insert on
 mizizi_private.question_source_attestation_events for each row
 execute function mizizi_private.seal_question_source_attestation_v1();
create trigger mz_qv3_immutable before update or delete on
 mizizi_private.question_source_attestation_events for each row
 execute function mizizi_private.block_case_question_change_v1();
revoke all on function mizizi_private.seal_question_source_attestation_v1()
 from public,anon,authenticated,service_role,mizizi_executor;

-- One atomic, signed-in reviewer command. A source-family key is a human
-- attestation, NOT automatically computed independence or proof of lawful reuse.
create function public.admin_mizizi_attest_question_source_v1(
 p_case_id uuid,
 p_expected_case_revision integer,
 p_question_id uuid,
 p_question_revision integer,
 p_attestation_id uuid,
 p_registry_assertion_id uuid,
 p_editorial_source_version_id uuid,
 p_expected_registry_fingerprint text,
 p_expected_source_fingerprint text,
 p_source_family_key text,
 p_source_correlation_reason text,
 p_independence_reason text,
 p_decision text,
 p_review_reason text
)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $attest$
declare
 v_actor uuid;
 v_case mizizi_private.cases%rowtype;
 v_question mizizi_private.case_question_versions%rowtype;
 v_registry platform_private.registry_evidence_assertions%rowtype;
 v_source editorial.sources%rowtype;
 v_version editorial.source_versions%rowtype;
 v_prior mizizi_private.question_source_attestation_events%rowtype;
 v_receipt mizizi_private.question_source_attestation_events%rowtype;
 v_existing mizizi_private.question_source_attestation_events%rowtype;
 v_next integer;
begin
 v_actor:=mizizi_private.assert_headquarters_operator_v1('reviewer');
 if p_case_id is null or p_question_id is null or p_attestation_id is null
  or p_registry_assertion_id is null or p_editorial_source_version_id is null
  or p_expected_case_revision is null or p_expected_case_revision<1
  or p_question_revision is null or p_question_revision<1
  or p_expected_registry_fingerprint !~ '^[a-f0-9]{64}$'
  or p_expected_source_fingerprint is null
  or char_length(p_expected_source_fingerprint) not between 8 and 256
  or p_source_family_key is null
  or p_source_family_key !~ '^[a-z0-9][a-z0-9._:/-]{7,139}$'
  or p_source_correlation_reason is null
  or char_length(btrim(p_source_correlation_reason)) not between 30 and 1000
  or p_source_correlation_reason<>btrim(p_source_correlation_reason)
  or p_independence_reason is null
  or char_length(btrim(p_independence_reason)) not between 30 and 1000
  or p_independence_reason<>btrim(p_independence_reason)
  or p_decision not in ('attested','revoked')
  or p_review_reason is null
  or char_length(btrim(p_review_reason)) not between 12 and 1000
  or p_review_reason<>btrim(p_review_reason)
  or (p_source_correlation_reason||p_independence_reason||p_review_reason)
     ~ '[[:cntrl:]]'
 then raise exception 'Invalid source attestation request' using errcode='22023';end if;

 perform mizizi_private.assert_registry_admission_not_held_v1(
  'mizizi.source_attestation_v1',1);
 select * into v_case from mizizi_private.cases where id=p_case_id for update;
 if not found then raise exception 'Question case not found'
  using errcode='42501';end if;
 if v_case.revision<>p_expected_case_revision or
  v_case.case_state not in ('open','in_progress')
 then raise exception 'Source attestation case revision stale or terminal'
  using errcode='PT409';end if;
 if v_case.subject_type not in ('artist','track','release')
  or not exists(select 1 from mizizi_private.workspaces w
    where w.id=v_case.workspace_id and w.workspace_key='wakilisha-internal'
     and w.workspace_kind='internal' and w.status='active')
 then raise exception 'Source attestation scope unauthorized'
  using errcode='42501';end if;

 select * into v_question from mizizi_private.case_question_versions q
 where q.workspace_id=v_case.workspace_id and q.case_id=v_case.id
  and q.question_id=p_question_id
 order by q.question_revision desc limit 1;
 if not found or v_question.question_revision<>p_question_revision
  or v_question.expected_case_revision<>v_case.revision
 then raise exception 'Frozen question revision stale'
  using errcode='PT409';end if;
 if v_question.frozen_by_user_id=v_actor then
  raise exception 'Question author cannot attest their own source'
   using errcode='42501';end if;

 select * into v_prior from mizizi_private.question_source_attestation_events e
 where e.workspace_id=v_case.workspace_id and e.case_id=v_case.id
  and e.question_id=p_question_id and e.question_revision=p_question_revision
  and e.registry_assertion_id=p_registry_assertion_id
 order by e.review_revision desc limit 1;
 v_next:=coalesce(v_prior.review_revision,0)+1;

 -- Replay is scoped to this exact reviewer and input, not merely to an ID.
 select * into v_existing from mizizi_private.question_source_attestation_events
 where id=p_attestation_id;
 if found then
  if v_existing.workspace_id=v_case.workspace_id
   and v_existing.case_id=v_case.id and v_existing.question_id=p_question_id
   and v_existing.question_revision=p_question_revision
   and v_existing.registry_assertion_id=p_registry_assertion_id
   and v_existing.editorial_source_version_id=p_editorial_source_version_id
   and v_existing.registry_assertion_fingerprint=p_expected_registry_fingerprint
   and v_existing.editorial_source_fingerprint=p_expected_source_fingerprint
   and v_existing.source_family_key=p_source_family_key
   and v_existing.source_correlation_reason=p_source_correlation_reason
   and v_existing.independence_reason=p_independence_reason
   and v_existing.decision=p_decision
   and v_existing.review_reason=p_review_reason
   and v_existing.reviewer_user_id=v_actor
  then return jsonb_build_object(
   'outcome','replayed','receiptId',v_existing.id,
   'receiptFingerprint',v_existing.receipt_fingerprint,
   'reviewRevision',v_existing.review_revision);end if;
  raise exception 'Attestation replay payload conflict' using errcode='PT409';
 end if;
 if v_next>30 then raise exception 'Source attestation history bound exceeded'
  using errcode='54000';end if;
 if p_decision='revoked' and
  (v_prior.id is null or v_prior.decision<>'attested')
 then raise exception 'No active attestation to revoke' using errcode='PT409';
 end if;
 if p_decision='attested' and v_prior.id is not null
  and v_prior.decision='attested'
 then raise exception 'Existing attestation must be revoked first'
  using errcode='PT409';end if;

 select * into v_registry from platform_private.registry_evidence_assertions a
 where a.id=p_registry_assertion_id
  and a.subject_type=v_case.subject_type and a.subject_id=v_case.subject_id
  and a.assertion_fingerprint=p_expected_registry_fingerprint;
 if not found then raise exception 'Registry assertion does not match case'
  using errcode='42501';end if;

 if p_decision='attested' then
  select sv.* into v_version from editorial.source_versions sv
   where sv.id=p_editorial_source_version_id
    and sv.content_fingerprint=p_expected_source_fingerprint;
  if not found then raise exception 'Editorial source version mismatch'
   using errcode='42501';end if;
  select * into v_source from editorial.sources s
   where s.id=v_version.source_id
    and s.current_approved_version_id=v_version.id
    and s.review_status='approved' and s.source_state='active'
    and s.reviewed_by is not null
    and s.rights_status in ('owned','licensed','public_domain')
    and s.consent_status in ('granted','not_required')
    and s.rights_status=v_version.rights_status
    and s.consent_status=v_version.consent_status
    and s.sensitivity not in ('high','extreme');
  if not found then raise exception 'Approved source rights and consent absent'
   using errcode='42501';end if;
  if v_source.created_by=v_actor or v_source.reviewed_by=v_actor then
   raise exception 'Source custodian or source reviewer cannot self-attest'
    using errcode='42501';end if;
  if not exists(select 1 from editorial.source_registry_links l
    where l.source_id=v_source.id and l.source_version_id=v_version.id
     and l.registry_entity_type=v_case.subject_type
     and l.registry_entity_id=v_case.subject_id
     and l.relationship_role='subject')
  then raise exception 'Editorial source and case subject link absent'
   using errcode='42501';end if;
  if v_registry.source_use_basis not in
    ('first_party','documented_consent','documented_contract','open_license')
    or nullif(btrim(v_registry.source_use_detail),'') is null
    or nullif(btrim(v_registry.lineage_key),'') is null
    or nullif(btrim(v_registry.source_ref),'') is null
  then raise exception 'Registry source use or lineage not documented'
   using errcode='42501';end if;
  if exists(select 1 from mizizi_private.question_source_attestation_events e
    where e.workspace_id=v_case.workspace_id and e.case_id=v_case.id
     and e.question_id=p_question_id and e.question_revision=p_question_revision
     and e.editorial_source_id=v_source.id
     and e.registry_assertion_id<>p_registry_assertion_id
     and e.decision='attested'
     and not exists(select 1 from
       mizizi_private.question_source_attestation_events later
       where later.workspace_id=e.workspace_id and later.case_id=e.case_id
        and later.question_id=e.question_id
        and later.question_revision=e.question_revision
        and later.registry_assertion_id=e.registry_assertion_id
        and later.review_revision>e.review_revision))
  then raise exception 'Source already attested under different assertion'
   using errcode='PT409';end if;
 else
  -- Withdrawal must remain possible after editorial consent is revoked.
  if v_prior.editorial_source_version_id<>p_editorial_source_version_id
    or v_prior.registry_assertion_fingerprint<>p_expected_registry_fingerprint
    or v_prior.editorial_source_fingerprint<>p_expected_source_fingerprint
    or v_prior.source_family_key<>p_source_family_key
    or v_prior.source_correlation_reason<>p_source_correlation_reason
    or v_prior.independence_reason<>p_independence_reason
  then raise exception 'Revocation must target exact previous evidence'
   using errcode='PT409';end if;
  v_source.id:=v_prior.editorial_source_id;
 end if;

 insert into mizizi_private.question_source_attestation_events(
  id,workspace_id,case_id,case_revision,question_id,question_revision,
  question_fingerprint,registry_assertion_id,registry_assertion_fingerprint,
  editorial_source_id,editorial_source_version_id,editorial_source_fingerprint,
  source_family_key,source_correlation_reason,independence_reason,
  decision,review_revision,reviewer_user_id,review_reason)
 values(p_attestation_id,v_case.workspace_id,v_case.id,v_case.revision,
  p_question_id,p_question_revision,v_question.question_fingerprint,
  p_registry_assertion_id,p_expected_registry_fingerprint,
  v_source.id,p_editorial_source_version_id,p_expected_source_fingerprint,
  p_source_family_key,p_source_correlation_reason,p_independence_reason,
  p_decision,v_next,v_actor,p_review_reason)
 returning * into v_receipt;
 return jsonb_build_object(
  'outcome',p_decision,'receiptId',v_receipt.id,
  'receiptFingerprint',v_receipt.receipt_fingerprint,
  'reviewRevision',v_receipt.review_revision);
end;
$attest$;
revoke all on function
 public.admin_mizizi_attest_question_source_v1(
  uuid,integer,uuid,integer,uuid,uuid,uuid,text,text,text,text,text,text,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function
 public.admin_mizizi_attest_question_source_v1(
  uuid,integer,uuid,integer,uuid,uuid,uuid,text,text,text,text,text,text,text)
 to authenticated;

-- Minimal metadata only. Consent records, excerpts, raw content and family
-- independence judgments never leave this private read projection.
create function public.admin_mizizi_question_source_attestations_v1(
 p_case_id uuid,p_expected_case_revision integer,
 p_question_id uuid,p_question_revision integer
)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $read$
declare
 v_case mizizi_private.cases%rowtype;
 v_question mizizi_private.case_question_versions%rowtype;
 v_rows jsonb;
begin
 perform mizizi_private.assert_headquarters_operator_v1('reader');
 select * into v_case from mizizi_private.cases
 where id=p_case_id and revision=p_expected_case_revision
  and case_state in ('open','in_progress');
 if not found or not exists(select 1 from mizizi_private.workspaces w
  where w.id=v_case.workspace_id and w.workspace_key='wakilisha-internal'
   and w.workspace_kind='internal' and w.status='active')
 then raise exception 'Source attestation read denied or stale'
  using errcode='42501';end if;
 select * into v_question from mizizi_private.case_question_versions q
 where q.workspace_id=v_case.workspace_id and q.case_id=v_case.id
  and q.question_id=p_question_id order by q.question_revision desc limit 1;
 if not found or v_question.question_revision<>p_question_revision
  or v_question.expected_case_revision<>v_case.revision
 then raise exception 'Source attestation question stale'
  using errcode='PT409';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'attestationId',e.id,'assertionId',e.registry_assertion_id,
  'sourceVersionId',e.editorial_source_version_id,
  'sourceFamilyKey',e.source_family_key,'reviewRevision',e.review_revision,
  'decision',case when e.decision='attested' and s.id is not null
   then 'human_reviewed' else 'unavailable_or_revoked' end,
  'receiptFingerprint',e.receipt_fingerprint
 ) order by e.registry_assertion_id),'[]'::jsonb) into v_rows
 from (
  select distinct on (a.registry_assertion_id) a.*
  from mizizi_private.question_source_attestation_events a
  where a.workspace_id=v_case.workspace_id and a.case_id=v_case.id
   and a.question_id=p_question_id and a.question_revision=p_question_revision
  order by a.registry_assertion_id,a.review_revision desc
 ) e
 left join editorial.sources s on s.id=e.editorial_source_id
  and s.current_approved_version_id=e.editorial_source_version_id
  and s.review_status='approved' and s.source_state='active'
  and s.rights_status in ('owned','licensed','public_domain')
  and s.consent_status in ('granted','not_required')
  and s.sensitivity not in ('high','extreme');
 return jsonb_build_object('contract','mizizi.source_attestation_read.v1',
  'kind',case when jsonb_array_length(v_rows)=0 then 'not_recorded'
   else 'requires_review' end,
  'caseId',v_case.id,'caseRevision',v_case.revision,
  'questionId',p_question_id,'questionRevision',p_question_revision,
  'rows',v_rows,'independentlyVerifiedFamilies',0,
  'achAssessmentsAllowed',0);
end;
$read$;
revoke all on function public.admin_mizizi_question_source_attestations_v1(uuid,integer,uuid,integer)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_question_source_attestations_v1(uuid,integer,uuid,integer)
 to authenticated;
commit;
