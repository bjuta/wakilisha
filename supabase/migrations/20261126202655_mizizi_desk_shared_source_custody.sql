-- Issue #1441. CLI 2.107.0 mint #45891086310 job 140153643089.
-- Shared candidate attribution over existing admitted native text. No copied
-- source bytes, second source ledger, model permission or canonical grant.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres'
 or to_regprocedure('mizizi_private.desk_custody_receipt_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb)') is null
 or to_regclass('mizizi_private.desk_shared_attribution_versions_v1') is not null
 then raise exception 'STOP_MIZIZI_SHARED_CUSTODY_PREIMAGE';end if;
end $guard$;

-- The independently authorized receiving case and its exact field/span are
-- separate from acquisition. The source receipt remains the only payload.
-- Owner/independently qualified importer issues these versioned links;
-- service workers cannot create, modify or revoke their own grants.
create table mizizi_private.desk_shared_attribution_versions_v1(
 workspace_id uuid not null,
 target_case_id uuid not null,
 source_receipt_id uuid not null references mizizi_private.desk_tool_receipts_v1(id),
 field_key text not null check(field_key in ('recording_title','artist_credit','isrc','release_title','release_date','label','duration')),
 revision integer not null check(revision>=1),
 enabled boolean not null default false,
 expected_revision integer not null check(expected_revision>=1),
 target_operational_revision integer not null check(target_operational_revision>=1),
 membership_sha256 text not null check(membership_sha256 ~ '^[a-f0-9]{64}$'),
 observation_sha256 text not null check(observation_sha256 ~ '^[a-f0-9]{64}$'),
 source_result_sha256 text not null check(source_result_sha256 ~ '^[a-f0-9]{64}$'),
 span_start integer not null check(span_start between 1 and 4000),
 span_length integer not null check(span_length between 1 and 1000 and span_start+span_length<=4001),
 span_sha256 text not null check(span_sha256 ~ '^[a-f0-9]{64}$'),
 authority_ref text not null check(length(btrim(authority_ref)) between 8 and 500),
 valid_until timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,target_case_id,source_receipt_id,field_key,revision),
 foreign key(workspace_id,target_case_id)
 references mizizi_private.chart_candidate_subjects_v1(workspace_id,case_id),
 foreign key(workspace_id,target_case_id,target_operational_revision)
 references mizizi_private.desk_operational_policy_versions_v1(workspace_id,case_id,revision)
);
alter table mizizi_private.desk_shared_attribution_versions_v1 enable row level security;
alter table mizizi_private.desk_shared_attribution_versions_v1 force row level security;
revoke all on mizizi_private.desk_shared_attribution_versions_v1 from public,anon,authenticated,service_role,mizizi_executor;

-- Evaluate an already admitted historical source under its original exact
-- subject and current policy. A receiving lease is not an originating lease.
-- Source acquisition is historical; no expired lease is revived. This first
-- reuse path intentionally excludes browser/document derivatives.
create function mizizi_private.desk_shared_native_source_v1(r mizizi_private.desk_tool_receipts_v1)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $source$
declare s mizizi_private.chart_candidate_subjects_v1; c jsonb; item jsonb;a jsonb;
begin
 if r.id is null or r.source_id is distinct from r.id or r.operation<>'read_page'
 or r.operational_revision is null or r.provenance->>'locator' not in ('plain_text','article_text')
 or r.provenance->>'contentType' not in ('text/plain','text/html','application/xhtml+xml')
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex')
 then return null;end if;
 select * into s from mizizi_private.chart_candidate_subjects_v1
 where case_id=r.case_id and workspace_id=r.workspace_id;
 if not found or s.membership_sha256<>r.membership_sha256 or s.observation_sha256<>r.observation_sha256 then return null;end if;
 c:=jsonb_build_object('caseId',r.case_id,'workspaceId',r.workspace_id,'expectedRevision',r.expected_revision,
  'membershipSha256',s.membership_sha256,'observationSha256',s.observation_sha256,'leaseExpiresAt',r.lease_expires_at);
 if not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
 if jsonb_typeof(r.result_text::jsonb->'sources') is distinct from 'array'
 or jsonb_array_length(r.result_text::jsonb->'sources')<>1 then return null;end if;
 item:=r.result_text::jsonb->'sources'->0;a:=item->'source';
 if a->>'sourceId' is distinct from r.id::text or a->>'caseId' is distinct from r.case_id::text
 or a->>'workspaceId' is distinct from r.workspace_id::text
 or a->>'fingerprint' is distinct from r.provenance->>'sourceSha256'
 or a->'privateResearchAllowed' is distinct from 'true'::jsonb
 or a->'privateEvidenceRetentionAllowed' is distinct from 'true'::jsonb
 or a->'revokedAt' is distinct from 'null'::jsonb
 or coalesce((a->>'expiresAt')::timestamptz<=clock_timestamp(),true)
 or jsonb_typeof(item->'excerpt') is distinct from 'string'
 or length(item->>'excerpt') not between 1 and 4000
 then return null;end if;
 return item;
end $source$;

create function mizizi_private.guard_desk_shared_attribution_v1()
returns trigger language plpgsql set search_path=pg_catalog as $guard$
declare last_revision integer;r mizizi_private.desk_tool_receipts_v1;
 s mizizi_private.chart_candidate_subjects_v1;o mizizi_private.desk_operational_policy_versions_v1;
 c jsonb; item jsonb; quote_text text;
begin
 if tg_op<>'INSERT' then raise exception 'Shared attribution history immutable' using errcode='55000';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select max(revision) into last_revision from mizizi_private.desk_shared_attribution_versions_v1
 where workspace_id=new.workspace_id and target_case_id=new.target_case_id
 and source_receipt_id=new.source_receipt_id and field_key=new.field_key;
 if new.revision<>coalesce(last_revision,0)+1 then raise exception 'Shared attribution revision conflict' using errcode='PT409';end if;
 select * into r from mizizi_private.desk_tool_receipts_v1 where id=new.source_receipt_id;
 if not found or r.workspace_id<>new.workspace_id or r.case_id=new.target_case_id
 or r.result_sha256<>new.source_result_sha256 then
  raise exception 'Shared attribution source mismatch' using errcode='23514';end if;
 -- Revocation is always possible even after expiry or source-policy change.
 if new.enabled then
  select * into s from mizizi_private.chart_candidate_subjects_v1
   where workspace_id=new.workspace_id and case_id=new.target_case_id;
  if not found or s.membership_sha256<>new.membership_sha256 or s.observation_sha256<>new.observation_sha256
   or not exists(select 1 from mizizi_private.cases k where k.workspace_id=new.workspace_id and k.id=new.target_case_id
    and k.revision=new.expected_revision and k.current_stage='research' and k.case_state='in_progress')
   then raise exception 'Shared attribution target mismatch' using errcode='23514';end if;
  c:=jsonb_build_object('workspaceId',new.workspace_id,'caseId',new.target_case_id,'expectedRevision',new.expected_revision,
   'membershipSha256',new.membership_sha256,'observationSha256',new.observation_sha256);
  o:=mizizi_private.current_desk_operational_policy_v1(c);
  item:=mizizi_private.desk_shared_native_source_v1(r);
  quote_text:=substring(item->>'excerpt' from new.span_start for new.span_length);
  if item is null or not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false)
   or o.revision is distinct from new.target_operational_revision
   or not mizizi_private.desk_operational_url_allowed_v1(o,r.host,r.provenance->>'finalUrl','native_text',r.policy_revision)
   or new.valid_until<=clock_timestamp() or new.valid_until>o.valid_until
   or new.valid_until>(item->'source'->>'expiresAt')::timestamptz
   or length(quote_text) is distinct from new.span_length
   or encode(sha256(convert_to(quote_text,'UTF8')),'hex') is distinct from new.span_sha256
   then raise exception 'Shared attribution source, span or policy denied' using errcode='23514';end if;
 end if;
 new.recorded_at:=clock_timestamp();return new;
end $guard$;
create trigger mz_desk_shared_attribution_guard before insert or update or delete on
 mizizi_private.desk_shared_attribution_versions_v1 for each row execute function mizizi_private.guard_desk_shared_attribution_v1();
create trigger mz_desk_shared_attribution_no_truncate before truncate on
 mizizi_private.desk_shared_attribution_versions_v1 for each statement execute function mizizi_private.guard_desk_shared_attribution_v1();

-- Service-only candidate read. No new tool receipt or model/journal entry:
-- existing exact-case receipt checks continue to reject foreign sources.
create function public.mizizi_read_desk_shared_attribution_v1(p_scope jsonb,p_source_receipt_id uuid,p_field_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $read$
declare c jsonb;g mizizi_private.desk_shared_attribution_versions_v1;r mizizi_private.desk_tool_receipts_v1;
 o mizizi_private.desk_operational_policy_versions_v1;item jsonb;a jsonb;quote_text text;
begin
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null or p_source_receipt_id is null or p_field_key is null then return null;end if;
 select * into g from mizizi_private.desk_shared_attribution_versions_v1
 where workspace_id=(c->>'workspaceId')::uuid and target_case_id=(c->>'caseId')::uuid
 and source_receipt_id=p_source_receipt_id and field_key=p_field_key order by revision desc limit 1;
 if not found or not g.enabled or g.valid_until<=clock_timestamp()
 or g.expected_revision::text is distinct from c->>'expectedRevision'
 or g.membership_sha256 is distinct from c->>'membershipSha256'
 or g.observation_sha256 is distinct from c->>'observationSha256' then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false)
 or o.revision is distinct from g.target_operational_revision then return null;end if;
 select * into r from mizizi_private.desk_tool_receipts_v1 where id=g.source_receipt_id;
 if not found or r.workspace_id<>g.workspace_id or r.case_id=g.target_case_id
 or r.result_sha256<>g.source_result_sha256
 or not mizizi_private.desk_operational_url_allowed_v1(o,r.host,r.provenance->>'finalUrl','native_text',r.policy_revision)
 then return null;end if;
 item:=mizizi_private.desk_shared_native_source_v1(r);
 if item is null then return null;end if;
 quote_text:=substring(item->>'excerpt' from g.span_start for g.span_length);
 if length(quote_text) is distinct from g.span_length
 or encode(sha256(convert_to(quote_text,'UTF8')),'hex') is distinct from g.span_sha256
 or g.valid_until<=clock_timestamp() or (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp()
 then return null;end if;
 a:=item->'source';
 return jsonb_build_object('contract','mizizi.desk_shared_attribution.v1','candidateOnly',true,'identityVerified',false,
  'modelDisclosureAuthorized',false,'canonicalWriteAuthorized',false,'targetCaseId',g.target_case_id,
  'workspaceId',g.workspace_id,'expectedRevision',g.expected_revision,'membershipSha256',g.membership_sha256,
  'observationSha256',g.observation_sha256,'fieldKey',g.field_key,'attributionRevision',g.revision,
  'authorityRef',g.authority_ref,'sourceReceiptId',r.id,'sourceCaseId',r.case_id,
  'sourceResultSha256',r.result_sha256,'sourceFingerprint',a->>'fingerprint','originKey',a->>'originKey',
  'lineageKey',a->>'lineageKey','sourceAuthorityRef',a->>'authorityRef','useBasis',a->>'useBasis',
  'citation',item->>'citation','observedAt',a->>'observedAt','spanStart',g.span_start,'spanLength',g.span_length,
  'spanSha256',g.span_sha256,'excerpt',quote_text,'grantExpiresAt',g.valid_until,
  'leaseExpiresAt',c->'leaseExpiresAt','revalidateEveryUse',true);
end $read$;

revoke all on function mizizi_private.desk_shared_native_source_v1(mizizi_private.desk_tool_receipts_v1),
 mizizi_private.guard_desk_shared_attribution_v1(),public.mizizi_read_desk_shared_attribution_v1(jsonb,uuid,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_shared_attribution_v1(jsonb,uuid,text) to service_role;
do $acl$ begin
 if has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','SELECT')
 or has_function_privilege('authenticated','public.mizizi_read_desk_shared_attribution_v1(jsonb,uuid,text)','EXECUTE')
 then raise exception 'STOP_MIZIZI_SHARED_CUSTODY_ACL';end if;
end $acl$;
comment on table mizizi_private.desk_shared_attribution_versions_v1 is 'Owner-reviewed, versioned field pointers to existing private native source receipts; candidate evidence only.';
commit;
