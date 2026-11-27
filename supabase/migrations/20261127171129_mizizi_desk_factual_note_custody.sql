-- Issue #1441; CLI 2.107.0 mint #46039817121.
-- Original human research notes, not excerpts, source licences or canonical facts.
-- No seed rows, historical receipt rewrite, source acquisition grant or job dispatch.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres'
 or to_regclass('mizizi_private.desk_factual_notes_v1') is not null
 or to_regclass('mizizi_private.desk_factual_note_reviews_v1') is not null
 or to_regprocedure('mizizi_private.assert_chart_candidate_research_actor_v1(uuid,uuid)') is null
 or to_regprocedure('mizizi_private.assert_chart_candidate_current_v1(uuid,uuid,text)') is null
 or to_regprocedure('mizizi_private.guard_desk_resource_event_v1()') is null
 then raise exception 'STOP_MIZIZI_FACTUAL_NOTE_PREIMAGE';end if;
end $guard$;
create table mizizi_private.desk_factual_notes_v1(
 note_id uuid primary key,case_id uuid not null references mizizi_private.cases(id),
 workspace_id uuid not null references mizizi_private.workspaces(id),
 expected_revision integer not null check(expected_revision>0),
 membership_sha256 text not null check(membership_sha256 ~ '^[a-f0-9]{64}$'),
 observation_sha256 text not null check(observation_sha256 ~ '^[a-f0-9]{64}$'),
 author_id uuid not null,observed_at timestamptz not null,
 field_key text not null check(field_key in ('subject_version','release_date','performer','composition_credits','recording_production','label_distribution')),
 note_kind text not null check(note_kind in ('direct_observation','attributed_claim','inference')),
 consultation_method text not null check(consultation_method in ('manual_public_consultation','manual_first_party_consultation')),
 source_locator text not null check(length(source_locator) between 12 and 1000),
 note_text text not null check(length(note_text) between 8 and 1200 and btrim(note_text)=note_text and note_text !~ '[[:cntrl:]]'),
 note_sha256 text not null check(note_sha256 ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(case_id,note_sha256),
 check(observed_at<=recorded_at)
);
create table mizizi_private.desk_factual_note_reviews_v1(
 note_id uuid not null references mizizi_private.desk_factual_notes_v1(note_id),
 revision integer not null check(revision>0),reviewer_id uuid not null,
 note_sha256 text not null check(note_sha256 ~ '^[a-f0-9]{64}$'),
 decision text not null check(decision in ('admitted','revoked')),
 model_processing_allowed boolean not null default false,
 review_ref text not null check(length(review_ref) between 8 and 500 and btrim(review_ref)=review_ref and review_ref !~ '[[:cntrl:]]'),
 valid_until timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 primary key(note_id,revision),
 check(valid_until>recorded_at),
 check(decision='admitted' or not model_processing_allowed)
);
alter table mizizi_private.desk_factual_notes_v1 enable row level security;
alter table mizizi_private.desk_factual_notes_v1 force row level security;
alter table mizizi_private.desk_factual_note_reviews_v1 enable row level security;
alter table mizizi_private.desk_factual_note_reviews_v1 force row level security;
revoke all on mizizi_private.desk_factual_notes_v1,mizizi_private.desk_factual_note_reviews_v1 from public,anon,authenticated,service_role,mizizi_executor;
create trigger mz_desk_factual_note_immutable before update or delete on mizizi_private.desk_factual_notes_v1
 for each row execute function mizizi_private.guard_desk_resource_event_v1();
create trigger mz_desk_factual_review_immutable before update or delete on mizizi_private.desk_factual_note_reviews_v1
 for each row execute function mizizi_private.guard_desk_resource_event_v1();

-- Authorship and review are separate authenticated actions. A note's source
-- locator is a reference only; it does not authorize a network request.
create function public.admin_mizizi_submit_factual_note_v1(
 p_note_id uuid,p_case_id uuid,p_expected_revision integer,p_field_key text,
 p_note_kind text,p_consultation_method text,p_source_locator text,p_note_text text,
 p_observed_at timestamptz,p_acknowledgement text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare actor uuid;c mizizi_private.cases%rowtype;s mizizi_private.chart_candidate_subjects_v1;
 n mizizi_private.desk_factual_notes_v1;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if p_note_id is null or p_case_id is null or p_expected_revision is null or p_expected_revision<1
 or coalesce(p_field_key,'') not in ('subject_version','release_date','performer','composition_credits','recording_production','label_distribution')
 or coalesce(p_note_kind,'') not in ('direct_observation','attributed_claim','inference')
 or coalesce(p_consultation_method,'') not in ('manual_public_consultation','manual_first_party_consultation')
 or p_source_locator is null or length(p_source_locator) not between 12 and 1000
 or p_source_locator !~ '^https://[a-z0-9.-]+/[A-Za-z0-9_./~%-]+$'
 or mizizi_private.desk_custody_url_host_v1(p_source_locator) is null
 or p_source_locator ~ '/[.]{1,2}(/|$)' or p_source_locator ~* '%(2e|2f|5c|25|00)'
 or p_note_text is null or length(p_note_text) not between 8 and 1200 or btrim(p_note_text)<>p_note_text or p_note_text ~ '[[:cntrl:]]'
 or p_observed_at is null or not isfinite(p_observed_at) or p_observed_at>clock_timestamp()
 or p_acknowledgement is distinct from 'I personally consulted this source by a permitted method and wrote an original factual note, not copied source content.'
 then raise exception 'Invalid original factual note' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select * into c from mizizi_private.cases where id=p_case_id for update;
 if not found then raise exception 'Case unavailable' using errcode='42501';end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(c.workspace_id,actor);
 if c.revision<>p_expected_revision or c.case_state<>'in_progress' or c.current_stage<>'research'
 then raise exception 'Current research case revision required' using errcode='PT409';end if;
 perform mizizi_private.assert_chart_candidate_current_v1(c.id,c.workspace_id,null);
 select * into strict s from mizizi_private.chart_candidate_subjects_v1 where case_id=c.id and workspace_id=c.workspace_id;
 n.note_id:=p_note_id;n.case_id:=c.id;n.workspace_id:=c.workspace_id;n.expected_revision:=c.revision;
 n.membership_sha256:=s.membership_sha256;n.observation_sha256:=s.observation_sha256;
 n.author_id:=actor;n.observed_at:=p_observed_at;n.field_key:=p_field_key;n.note_kind:=p_note_kind;
 n.consultation_method:=p_consultation_method;n.source_locator:=p_source_locator;n.note_text:=p_note_text;
 -- Server-derived semantic digest, including actor and exact subject binding.
 n.note_sha256:=encode(sha256(convert_to(jsonb_build_array(n.case_id,n.workspace_id,n.expected_revision,
  n.membership_sha256,n.observation_sha256,n.author_id,to_char(n.observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  n.field_key,n.note_kind,n.consultation_method,n.source_locator,n.note_text)::text,'UTF8')),'hex');
 n.recorded_at:=clock_timestamp();
 insert into mizizi_private.desk_factual_notes_v1 select (n).* on conflict do nothing;
 if not exists(select 1 from mizizi_private.desk_factual_notes_v1 x where x.note_id=n.note_id
 and (to_jsonb(x)-'recorded_at')=(to_jsonb(n)-'recorded_at'))
 then raise exception 'Conflicting factual note' using errcode='23505';end if;
 return jsonb_build_object('contract','mizizi.factual_note_submission.v1','noteId',n.note_id,'caseId',n.case_id,
  'workspaceId',n.workspace_id,'expectedRevision',n.expected_revision,'noteSha256',n.note_sha256,'authorId',actor,
  'membershipSha256',n.membership_sha256,'observationSha256',n.observation_sha256,'verified',false,'jobsDispatched',0);
end $f$;

create function public.admin_mizizi_review_factual_note_v1(
 p_note_id uuid,p_note_sha256 text,p_expected_review_revision integer,p_decision text,
 p_model_processing_allowed boolean,p_review_ref text,p_valid_until timestamptz,p_acknowledgement text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare actor uuid;n mizizi_private.desk_factual_notes_v1;c mizizi_private.cases%rowtype;
 prev mizizi_private.desk_factual_note_reviews_v1;d mizizi_private.desk_factual_note_reviews_v1;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if p_note_id is null or coalesce(p_note_sha256,'') !~ '^[a-f0-9]{64}$'
 or p_expected_review_revision is null or p_expected_review_revision<0
 or coalesce(p_decision,'') not in ('admitted','revoked') or p_model_processing_allowed is null
 or (p_decision='revoked' and p_model_processing_allowed)
 or p_review_ref is null or length(p_review_ref) not between 8 and 500 or btrim(p_review_ref)<>p_review_ref or p_review_ref ~ '[[:cntrl:]]'
 or p_valid_until is null or not isfinite(p_valid_until) or p_valid_until<=clock_timestamp() or p_valid_until>clock_timestamp()+interval '24 hours'
 or p_acknowledgement is distinct from (case when p_decision='admitted'
 then 'I independently reviewed this exact original note, consultation method, provenance and permitted use; this is not factual verification.'
 else 'I revoke this exact factual note admission.' end )
 then raise exception 'Invalid factual note review' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select * into n from mizizi_private.desk_factual_notes_v1 where note_id=p_note_id;
 if not found or n.note_sha256<>p_note_sha256 then raise exception 'Note unavailable' using errcode='42501';end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,actor);
 select * into prev from mizizi_private.desk_factual_note_reviews_v1 where note_id=n.note_id order by revision desc limit 1;
 if coalesce(prev.revision,0)<>p_expected_review_revision then raise exception 'Factual note review revision conflict' using errcode='PT409';end if;
 if p_decision='admitted' then
  if actor=n.author_id then raise exception 'Independent note reviewer required' using errcode='42501';end if;
  perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,n.author_id);
  select * into c from mizizi_private.cases where id=n.case_id and workspace_id=n.workspace_id for update;
  if not found or c.revision<>n.expected_revision or c.case_state<>'in_progress' or c.current_stage<>'research'
  then raise exception 'Stale note case' using errcode='PT409';end if;
  perform mizizi_private.assert_chart_candidate_current_v1(n.case_id,n.workspace_id,null);
 elsif prev.revision is null or prev.decision<>'admitted' then
  raise exception 'No admitted note to revoke' using errcode='55000';
 end if;
 d.note_id:=n.note_id;d.revision:=p_expected_review_revision+1;d.reviewer_id:=actor;d.note_sha256:=n.note_sha256;
 d.decision:=p_decision;d.model_processing_allowed:=p_model_processing_allowed;d.review_ref:=p_review_ref;
 d.valid_until:=p_valid_until;d.recorded_at:=clock_timestamp();
 insert into mizizi_private.desk_factual_note_reviews_v1 select (d).*;
 return jsonb_build_object('contract','mizizi.factual_note_review.v1','noteId',n.note_id,'noteSha256',n.note_sha256,
  'reviewRevision',d.revision,'decision',d.decision,'reviewerId',actor,'modelProcessingAllowed',d.model_processing_allowed,
  'verified',false,'jobsDispatched',0);
end $f$;

-- Steward-only read for the independent notebook review. No source content
-- transmission to a model, lease admission or evidence verification here.
create function public.admin_mizizi_read_factual_note_v1(p_note_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare actor uuid;n mizizi_private.desk_factual_notes_v1;d mizizi_private.desk_factual_note_reviews_v1;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 select * into n from mizizi_private.desk_factual_notes_v1 where note_id=p_note_id;
 if not found then return null;end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,actor);
 select * into d from mizizi_private.desk_factual_note_reviews_v1 where note_id=n.note_id order by revision desc limit 1;
 return jsonb_build_object('contract','mizizi.factual_note_private_read.v1','note',to_jsonb(n),
  'latestReview',case when d.revision is null then null else to_jsonb(d) end,'verified',false);
end $f$;
revoke all on function public.admin_mizizi_submit_factual_note_v1(uuid,uuid,integer,text,text,text,text,text,timestamptz,text),
 public.admin_mizizi_review_factual_note_v1(uuid,text,integer,text,boolean,text,timestamptz,text),
 public.admin_mizizi_read_factual_note_v1(uuid) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_submit_factual_note_v1(uuid,uuid,integer,text,text,text,text,text,timestamptz,text),
 public.admin_mizizi_review_factual_note_v1(uuid,text,integer,text,boolean,text,timestamptz,text),
 public.admin_mizizi_read_factual_note_v1(uuid) to authenticated;
do $acl$
declare f text;role_name text;t text;
begin
 foreach f in array array['public.admin_mizizi_submit_factual_note_v1(uuid,uuid,integer,text,text,text,text,text,timestamptz,text)',
 'public.admin_mizizi_review_factual_note_v1(uuid,text,integer,text,boolean,text,timestamptz,text)',
 'public.admin_mizizi_read_factual_note_v1(uuid)'] loop
  if not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'STOP_NOTE_AUTHENTICATED_ACL';end if;
  foreach role_name in array array['anon','service_role','mizizi_executor'] loop
   if has_function_privilege(role_name,f,'EXECUTE') then raise exception 'STOP_NOTE_FUNCTION_ACL';end if;
  end loop;
 end loop;
 foreach t in array array['mizizi_private.desk_factual_notes_v1','mizizi_private.desk_factual_note_reviews_v1'] loop
  foreach role_name in array array['anon','authenticated','service_role','mizizi_executor'] loop
   if has_table_privilege(role_name,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'STOP_NOTE_TABLE_ACL';end if;
  end loop;
 end loop;
end $acl$;
-- Narrow worker readback. This is a note representation, not a native source
-- receipt, tool authorization, exact-envelope disclosure or factual verdict.
-- No private notes without explicit model-use eligibility enter this path.
create function public.mizizi_read_desk_factual_notes_v1(p_scope jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;n mizizi_private.desk_factual_notes_v1;d mizizi_private.desk_factual_note_reviews_v1;
 items jsonb:='[]'::jsonb;body text;expiry timestamptz;
begin
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 for n in select x.* from mizizi_private.desk_factual_notes_v1 x
  where x.case_id=(c->>'caseId')::uuid and x.workspace_id=(c->>'workspaceId')::uuid
   and x.expected_revision=(c->>'expectedRevision')::integer
   and x.membership_sha256=c->>'membershipSha256' and x.observation_sha256=c->>'observationSha256'
  order by x.note_id
 loop
  select * into d from mizizi_private.desk_factual_note_reviews_v1 r where r.note_id=n.note_id order by r.revision desc limit 1;
  if not found or d.decision<>'admitted' or not d.model_processing_allowed or d.valid_until<=clock_timestamp()
   or d.note_sha256<>n.note_sha256 or d.reviewer_id=n.author_id then continue;end if;
  -- An expired or revoked actor invalidates this note rather than becoming
  -- permission to transmit it. Fail closed on any unexpected exception.
  begin
   perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,n.author_id);
   perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,d.reviewer_id);
  exception when insufficient_privilege then continue;end;
  if jsonb_array_length(items)>=12 then raise exception 'Factual note readback bound exceeded' using errcode='55000';end if;
  expiry:=least(d.valid_until,(c->>'leaseExpiresAt')::timestamptz);
  if expiry<=clock_timestamp() then return null;end if;
  items:=items||jsonb_build_array(jsonb_build_object(
   'noteId',n.note_id,'noteSha256',n.note_sha256,'reviewRevision',d.revision,
   'caseId',n.case_id,'workspaceId',n.workspace_id,'expectedRevision',n.expected_revision,
   'membershipSha256',n.membership_sha256,'observationSha256',n.observation_sha256,
   'authorId',n.author_id,'reviewerId',d.reviewer_id,'fieldKey',n.field_key,'noteKind',n.note_kind,
   'consultationMethod',n.consultation_method,'sourceLocator',n.source_locator,'noteText',n.note_text,
   'noteTextSha256',encode(sha256(convert_to(n.note_text,'UTF8')),'hex'),
   'locatorSha256',encode(sha256(convert_to(n.source_locator,'UTF8')),'hex'),
   'observedAt',n.observed_at,'reviewRef',d.review_ref,'validUntil',expiry,
   'representation','original_factual_note','verified',false,'modelUseEligible',true));
 end loop;
 if (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then return null;end if;
 body:=jsonb_build_object('contract','mizizi.desk_factual_note_readback.v1',
  'scope',p_scope,'membershipSha256',c->>'membershipSha256','observationSha256',c->>'observationSha256',
  'notes',items)::text;
 return jsonb_build_object('bodyText',body,'bodySha256',encode(sha256(convert_to(body,'UTF8')),'hex'));
end $f$;
revoke all on function public.mizizi_read_desk_factual_notes_v1(jsonb) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_factual_notes_v1(jsonb) to service_role;
do $note_read_acl$ begin
 if not has_function_privilege('service_role','public.mizizi_read_desk_factual_notes_v1(jsonb)','execute')
 or has_function_privilege('anon','public.mizizi_read_desk_factual_notes_v1(jsonb)','execute')
 or has_function_privilege('authenticated','public.mizizi_read_desk_factual_notes_v1(jsonb)','execute')
 or has_function_privilege('mizizi_executor','public.mizizi_read_desk_factual_notes_v1(jsonb)','execute')
 then raise exception 'STOP_NOTE_WORKER_READ_ACL';end if;
end $note_read_acl$;

-- Re-read reviewed note context through the same exact service lease. Journal
-- stores references only. A note UUID is never admitted as an excerpt/source.
create function mizizi_private.desk_factual_note_references_current_v1(c jsonb,b jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare packet jsonb;notes jsonb;ref jsonb;ids uuid[]:=array[]::uuid[];nid uuid;
begin
 if jsonb_typeof(b->'factualNoteReferences') is distinct from 'array' or
 jsonb_array_length(b->'factualNoteReferences') not between 1 and 12 or b ? 'deskBatchReceipt' then return false;end if;
 packet:=public.mizizi_read_desk_factual_notes_v1(jsonb_build_object('jobId',c->'jobId','caseId',c->'caseId',
 'workspaceId',c->'workspaceId','expectedRevision',c->'expectedRevision','workerId',c->'workerId','leaseExpiresAt',c->'leaseExpiresAt'));
 if packet is null then return false;end if;
 notes:=(packet->>'bodyText')::jsonb->'notes';
 for ref in select value from jsonb_array_elements(b->'factualNoteReferences') loop
  if jsonb_typeof(ref) is distinct from 'object' or (select count(*) from jsonb_object_keys(ref))<>3
   or coalesce(ref->>'noteId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
   or coalesce(ref->>'noteSha256','') !~ '^[a-f0-9]{64} or jsonb_typeof(ref->'reviewRevision') is distinct from 'number'
   or coalesce(ref->>'reviewRevision','') !~ '^[1-9][0-9]{0,8} then return false;end if;
  nid:=(ref->>'noteId')::uuid;
  if nid=any(ids) or not exists(select 1 from jsonb_array_elements(notes) n where n->>'noteId'=ref->>'noteId'
   and n->>'noteSha256'=ref->>'noteSha256' and n->'reviewRevision'=ref->'reviewRevision') then return false;end if;
  -- Notes are context, not evidence citations, and cannot be treated as such.
  if exists(select 1 from jsonb_array_elements(b->'findings') f where f->'sourceIds' @> jsonb_build_array(nid::text))
   or exists(select 1 from jsonb_array_elements(b->'sourceReceipts') s where s->>'sourceId'=nid::text)
   then return false;end if;
  ids:=array_append(ids,nid);
 end loop;
 return true;
end $f$;
revoke all on function mizizi_private.desk_factual_note_references_current_v1(jsonb,jsonb) from public,anon,authenticated,service_role,mizizi_executor;
-- Preserve all existing model/custody/reopening/finance checks; only add
-- independent note context readback and expiry. Exact deployed preimages.
CREATE OR REPLACE FUNCTION public.mizizi_authorize_desk_model_operation_v1(p_scope jsonb, p_operation text, p_binding_text text, p_binding_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;b jsonb;t jsonb;i jsonb;op text;item jsonb;rid uuid;sid uuid;
 p mizizi_private.desk_model_authority_versions_v1;
 r mizizi_private.desk_tool_receipts_v1;l mizizi_private.desk_reference_leads_v1;
 receipt_ids uuid[]:=array[]::uuid[];source_ids uuid[]:=array[]::uuid[];seen_sources uuid[]:=array[]::uuid[];
 expiry timestamptz;receipt_expiry timestamptz;o mizizi_private.desk_operational_policy_versions_v1;
 note_packet jsonb;note_body jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if coalesce(p_operation,'') not in ('model_disclose','tool_execute')
 or p_binding_text is null or octet_length(p_binding_text) not between 1 and 16384
 or p_binding_sha256 is null or p_binding_sha256<>encode(sha256(convert_to(p_binding_text,'UTF8')),'hex')
 then raise exception 'Invalid desk model binding' using errcode='22023';end if;
 b:=p_binding_text::jsonb;
 if jsonb_typeof(b) is distinct from 'object' or b->'scope' is distinct from p_scope then return null;end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 select * into p from mizizi_private.desk_model_authority_versions_v1
 where workspace_id=(c->>'workspaceId')::uuid and case_id=(c->>'caseId')::uuid
 and operation=p_operation and binding_sha256=p_binding_sha256
 order by revision desc limit 1;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if (p.revision is null and o.revision is null) or (p.revision is not null and not p.enabled) then return null;end if;
 if o.revision is not null and not mizizi_private.desk_operational_policy_live_v1(o,c) then return null;end if;
 expiry:=least(p.valid_until,o.valid_until,(c->>'leaseExpiresAt')::timestamptz);
 if expiry<=clock_timestamp() then return null;end if;
 if p_operation='model_disclose' then
  if (select count(*) from jsonb_object_keys(b))<>(case when b ? 'factualNoteReadbackSha256' then 12 else 11 end)
   or not(b ?& array['scope','questionSha256','model','round','requestSha256','bodySha256','credentialSha256','requestBytes','maxOutputTokens','sourceIds','toolReceipts'])
   or coalesce(b->>'questionSha256','') !~ '^[0-9a-f]{64}
   or coalesce(b->>'requestSha256','') !~ '^[0-9a-f]{64}
   or coalesce(b->>'bodySha256','') !~ '^[0-9a-f]{64}
   or coalesce(b->>'credentialSha256','') !~ '^[0-9a-f]{64}
   or coalesce(b->>'model','') !~ '^[A-Za-z0-9._:-]{3,100}
   or jsonb_typeof(b->'round') is distinct from 'number' or coalesce(b->>'round','') !~ '^[1-5]
   or jsonb_typeof(b->'requestBytes') is distinct from 'number' or coalesce(b->>'requestBytes','') !~ '^[1-9][0-9]{0,6}
   or b->'maxOutputTokens' is distinct from '2500'::jsonb
   or jsonb_typeof(b->'sourceIds') is distinct from 'array'
   or jsonb_typeof(b->'toolReceipts') is distinct from 'array' then return null;end if;
  if (b->>'requestBytes')::integer>3200000 or jsonb_array_length(b->'sourceIds')>12
   or jsonb_array_length(b->'toolReceipts')<>(b->>'round')::integer-1 then return null;end if;
  if o.revision is not null and (not(b->>'model'=any(o.model_ids)) or b->>'credentialSha256' is distinct from o.credential_sha256
   or not mizizi_private.desk_research_question_allowed_v1(o,c,b->>'questionSha256') or (b->>'round')::integer>o.max_rounds
   or (b->>'requestBytes')::integer>o.max_request_bytes) then return null;end if;
  if b ? 'factualNoteReadbackSha256' then
   if coalesce(b->>'factualNoteReadbackSha256','') !~ '^[a-f0-9]{64}
   if jsonb_typeof(item) is distinct from 'object' then return null;end if;
   if (select count(*) from jsonb_object_keys(item))<>3
    or coalesce(item->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
    or coalesce(item->>'callSha256','') !~ '^[0-9a-f]{64}
    or coalesce(item->>'resultSha256','') !~ '^[0-9a-f]{64} then return null;end if;
   rid:=(item->>'receiptId')::uuid;
   if rid=any(receipt_ids) then return null;end if;
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=rid;
   if not found or r.call_sha256 is distinct from item->>'callSha256'
    or r.result_sha256 is distinct from item->>'resultSha256'
    or r.job_id::text is distinct from p_scope->>'jobId'
    or r.worker_id is distinct from p_scope->>'workerId'
    or r.lease_expires_at is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
    or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
   receipt_ids:=array_append(receipt_ids,rid);
   if r.source_id is not null then source_ids:=array_append(source_ids,r.source_id);end if;
  end loop;
  for item in select value from jsonb_array_elements(b->'sourceIds') loop
   if jsonb_typeof(item) is distinct from 'string' or coalesce(item#>>'{}','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12} then return null;end if;
   sid:=(item#>>'{}')::uuid;
   if sid=any(seen_sources) or not(sid=any(source_ids)) then return null;end if;
   seen_sources:=array_append(seen_sources,sid);
  end loop;
  if cardinality(seen_sources)<>cardinality(source_ids) then return null;end if;
 else
  t:=b->'call';i:=t->'input';op:=t->>'name';
  if (select count(*) from jsonb_object_keys(b))<>2 or jsonb_typeof(t) is distinct from 'object'
   or jsonb_typeof(i) is distinct from 'object' then return null;end if;
  if (select count(*) from jsonb_object_keys(t))<>2
   or coalesce(op,'') not in ('search_web','search_news','read_page','read_document','render_page','inspect_visual','browse_page','recall_evidence') then return null;end if;
  if (o.revision is not null and not(op=any(o.tool_names))) or (op='browse_page' and o.revision is null) then return null;end if;
  if op='recall_evidence' then
   if o.revision is null or not o.adaptive_followups_allowed or i is distinct from jsonb_build_object('query','case evidence') then return null;end if;
  elsif op in ('search_web','search_news') then
   if (select count(*) from jsonb_object_keys(i))<>1 or jsonb_typeof(i->'query') is distinct from 'string'
    or length(btrim(i->>'query')) not between 3 and 300 then return null;end if;
   if o.revision is not null and not mizizi_private.desk_public_research_query_allowed_v1(c,i->>'query') then return null;end if;
  else
   if coalesce(i->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12} then return null;end if;
   select * into l from mizizi_private.desk_reference_leads_v1 where id=(i->>'lead_id')::uuid;
   if not found then return null;end if;
   if (op='read_page' and l.kind<>'reference') or (op='render_page' and l.kind<>'render')
    or (op='read_document' and l.kind<>'document') or (op='inspect_visual' and l.kind not in ('document','visual'))
    or (op='browse_page' and l.kind not in ('reference','browser_action')) then return null;end if;
   if op='browse_page' then
    if (select count(*) from jsonb_object_keys(i))<>2 or jsonb_typeof(i->'query') is distinct from 'string'
     or (l.kind='reference' and i->>'query'<>'')
     or (i->>'query'<>'' and not mizizi_private.desk_public_research_query_allowed_v1(c,i->>'query')) then return null;end if;
   elsif op='read_document' then
    if (select count(*) from jsonb_object_keys(i))<>3
     or jsonb_typeof(i->'page_start') is distinct from 'number' or jsonb_typeof(i->'page_end') is distinct from 'number'
     or coalesce(i->>'page_start','') !~ '^[1-9][0-9]{0,4} or coalesce(i->>'page_end','') !~ '^[1-9][0-9]{0,4} then return null;end if;
    if (i->>'page_end')::integer>10000 or (i->>'page_end')::integer-(i->>'page_start')::integer not between 0 and 9 then return null;end if;
   elsif op='inspect_visual' then
    if (select count(*) from jsonb_object_keys(i))<>2 or jsonb_typeof(i->'page') is distinct from 'number'
     or coalesce(i->>'page','') !~ '^[1-9][0-9]{0,4} then return null;end if;
    if (i->>'page')::integer>10000 then return null;end if;
   elsif (select count(*) from jsonb_object_keys(i))<>1 then return null;end if;
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
   if not found or r.job_id::text is distinct from p_scope->>'jobId'
    or r.worker_id is distinct from p_scope->>'workerId'
    or r.lease_expires_at is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
    or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
   if l.kind='browser_action' or (l.kind='visual' and r.provenance->'detail' ? 'localBrowser') then
    if not (r.provenance->'detail' ? 'localBrowser') or o.revision is null
     or not exists(select 1 from jsonb_array_elements(r.provenance->'detail'->'actionBindings') v
      where v->>'id'=l.id::text and
       ((op='browse_page' and ((v->>'action'='search' and i->>'query'<>'') or
          (v->>'action' in ('expand','follow','scroll_down') and i->>'query'='')))
        or (op='inspect_visual' and v->>'action'='visual' and i->>'page'='1')))
    then return null;end if;
   end if;
   receipt_ids:=array_append(receipt_ids,r.id);
  end if;
 end if;
 -- Clamp to every referenced custody ancestor's permission expiry.
 foreach rid in array receipt_ids loop
  with recursive chain as (
   select id,parent_receipt_id,workspace_id,host,policy_revision,1 as depth
   from mizizi_private.desk_tool_receipts_v1 where id=rid
   union all select d.id,d.parent_receipt_id,d.workspace_id,d.host,d.policy_revision,chain.depth+1
   from chain join mizizi_private.desk_tool_receipts_v1 d on d.id=chain.parent_receipt_id
   where chain.depth<200
  )
  select min(cp.valid_until) into receipt_expiry from chain
  join mizizi_private.desk_custody_policy_versions_v1 cp on cp.workspace_id=chain.workspace_id
   and cp.host=chain.host and cp.revision=chain.policy_revision;
  if receipt_expiry is null then return null;end if;
  expiry:=least(expiry,receipt_expiry);
  select * into r from mizizi_private.desk_tool_receipts_v1 where id=rid;
  if r.provenance ? 'sharedNative' or (r.provenance ? 'sameCaseRecall' and r.source_id is not null) then
   expiry:=least(expiry,(r.result_text::jsonb->'sources'->0->'source'->>'expiresAt')::timestamptz);
  elsif r.provenance ? 'sharedNativeSearch' then
   expiry:=least(expiry,(r.provenance->'sharedNativeSearch'->>'validUntil')::timestamptz);
  end if;
 end loop;
 if expiry<=clock_timestamp() then return null;end if;
 if o.revision is not null and p_operation='tool_execute' then
  insert into mizizi_private.desk_operational_call_proofs_v1(job_id,case_id,workspace_id,worker_id,lease_expires_at,
   call_sha256,operation,binding_sha256,standing_revision,exact_revision,valid_until)
  values((p_scope->>'jobId')::uuid,(c->>'caseId')::uuid,(c->>'workspaceId')::uuid,p_scope->>'workerId',
   (p_scope->>'leaseExpiresAt')::timestamptz,p_binding_sha256,p_operation,p_binding_sha256,o.revision,p.revision,expiry)
  on conflict do nothing;
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(p_scope->>'jobId')::uuid
   and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz and q.operation=p_operation
   and q.binding_sha256=p_binding_sha256 and q.standing_revision=o.revision and q.exact_revision is not distinct from p.revision
   and q.valid_until>clock_timestamp()) then return null;end if;
 end if;
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,
  'policyRef','desk-model:'||p_binding_sha256||':'||coalesce(p.revision,0)::text||
   case when o.revision is null then '' else ':standing:'||o.revision::text end,'validUntil',expiry,'allowed',true);
end $function$
 or o.revision is null then return null;end if;
   note_packet:=public.mizizi_read_desk_factual_notes_v1(p_scope);
   if note_packet is null or note_packet->>'bodySha256' is distinct from b->>'factualNoteReadbackSha256' then return null;end if;
   note_body:=(note_packet->>'bodyText')::jsonb;
   if jsonb_array_length(note_body->'notes')<1 then return null;end if;
   select min((v->>'validUntil')::timestamptz) into receipt_expiry from jsonb_array_elements(note_body->'notes') v;
   if receipt_expiry is null then return null;end if;
   expiry:=least(expiry,receipt_expiry);
  end if;
  for item in select value from jsonb_array_elements(b->'toolReceipts') loop
   if jsonb_typeof(item) is distinct from 'object' then return null;end if;
   if (select count(*) from jsonb_object_keys(item))<>3
    or coalesce(item->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
    or coalesce(item->>'callSha256','') !~ '^[0-9a-f]{64}
    or coalesce(item->>'resultSha256','') !~ '^[0-9a-f]{64} then return null;end if;
   rid:=(item->>'receiptId')::uuid;
   if rid=any(receipt_ids) then return null;end if;
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=rid;
   if not found or r.call_sha256 is distinct from item->>'callSha256'
    or r.result_sha256 is distinct from item->>'resultSha256'
    or r.job_id::text is distinct from p_scope->>'jobId'
    or r.worker_id is distinct from p_scope->>'workerId'
    or r.lease_expires_at is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
    or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
   receipt_ids:=array_append(receipt_ids,rid);
   if r.source_id is not null then source_ids:=array_append(source_ids,r.source_id);end if;
  end loop;
  for item in select value from jsonb_array_elements(b->'sourceIds') loop
   if jsonb_typeof(item) is distinct from 'string' or coalesce(item#>>'{}','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12} then return null;end if;
   sid:=(item#>>'{}')::uuid;
   if sid=any(seen_sources) or not(sid=any(source_ids)) then return null;end if;
   seen_sources:=array_append(seen_sources,sid);
  end loop;
  if cardinality(seen_sources)<>cardinality(source_ids) then return null;end if;
 else
  t:=b->'call';i:=t->'input';op:=t->>'name';
  if (select count(*) from jsonb_object_keys(b))<>2 or jsonb_typeof(t) is distinct from 'object'
   or jsonb_typeof(i) is distinct from 'object' then return null;end if;
  if (select count(*) from jsonb_object_keys(t))<>2
   or coalesce(op,'') not in ('search_web','search_news','read_page','read_document','render_page','inspect_visual','browse_page','recall_evidence') then return null;end if;
  if (o.revision is not null and not(op=any(o.tool_names))) or (op='browse_page' and o.revision is null) then return null;end if;
  if op='recall_evidence' then
   if o.revision is null or not o.adaptive_followups_allowed or i is distinct from jsonb_build_object('query','case evidence') then return null;end if;
  elsif op in ('search_web','search_news') then
   if (select count(*) from jsonb_object_keys(i))<>1 or jsonb_typeof(i->'query') is distinct from 'string'
    or length(btrim(i->>'query')) not between 3 and 300 then return null;end if;
   if o.revision is not null and not mizizi_private.desk_public_research_query_allowed_v1(c,i->>'query') then return null;end if;
  else
   if coalesce(i->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12} then return null;end if;
   select * into l from mizizi_private.desk_reference_leads_v1 where id=(i->>'lead_id')::uuid;
   if not found then return null;end if;
   if (op='read_page' and l.kind<>'reference') or (op='render_page' and l.kind<>'render')
    or (op='read_document' and l.kind<>'document') or (op='inspect_visual' and l.kind not in ('document','visual'))
    or (op='browse_page' and l.kind not in ('reference','browser_action')) then return null;end if;
   if op='browse_page' then
    if (select count(*) from jsonb_object_keys(i))<>2 or jsonb_typeof(i->'query') is distinct from 'string'
     or (l.kind='reference' and i->>'query'<>'')
     or (i->>'query'<>'' and not mizizi_private.desk_public_research_query_allowed_v1(c,i->>'query')) then return null;end if;
   elsif op='read_document' then
    if (select count(*) from jsonb_object_keys(i))<>3
     or jsonb_typeof(i->'page_start') is distinct from 'number' or jsonb_typeof(i->'page_end') is distinct from 'number'
     or coalesce(i->>'page_start','') !~ '^[1-9][0-9]{0,4} or coalesce(i->>'page_end','') !~ '^[1-9][0-9]{0,4} then return null;end if;
    if (i->>'page_end')::integer>10000 or (i->>'page_end')::integer-(i->>'page_start')::integer not between 0 and 9 then return null;end if;
   elsif op='inspect_visual' then
    if (select count(*) from jsonb_object_keys(i))<>2 or jsonb_typeof(i->'page') is distinct from 'number'
     or coalesce(i->>'page','') !~ '^[1-9][0-9]{0,4} then return null;end if;
    if (i->>'page')::integer>10000 then return null;end if;
   elsif (select count(*) from jsonb_object_keys(i))<>1 then return null;end if;
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
   if not found or r.job_id::text is distinct from p_scope->>'jobId'
    or r.worker_id is distinct from p_scope->>'workerId'
    or r.lease_expires_at is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
    or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
   if l.kind='browser_action' or (l.kind='visual' and r.provenance->'detail' ? 'localBrowser') then
    if not (r.provenance->'detail' ? 'localBrowser') or o.revision is null
     or not exists(select 1 from jsonb_array_elements(r.provenance->'detail'->'actionBindings') v
      where v->>'id'=l.id::text and
       ((op='browse_page' and ((v->>'action'='search' and i->>'query'<>'') or
          (v->>'action' in ('expand','follow','scroll_down') and i->>'query'='')))
        or (op='inspect_visual' and v->>'action'='visual' and i->>'page'='1')))
    then return null;end if;
   end if;
   receipt_ids:=array_append(receipt_ids,r.id);
  end if;
 end if;
 -- Clamp to every referenced custody ancestor's permission expiry.
 foreach rid in array receipt_ids loop
  with recursive chain as (
   select id,parent_receipt_id,workspace_id,host,policy_revision,1 as depth
   from mizizi_private.desk_tool_receipts_v1 where id=rid
   union all select d.id,d.parent_receipt_id,d.workspace_id,d.host,d.policy_revision,chain.depth+1
   from chain join mizizi_private.desk_tool_receipts_v1 d on d.id=chain.parent_receipt_id
   where chain.depth<200
  )
  select min(cp.valid_until) into receipt_expiry from chain
  join mizizi_private.desk_custody_policy_versions_v1 cp on cp.workspace_id=chain.workspace_id
   and cp.host=chain.host and cp.revision=chain.policy_revision;
  if receipt_expiry is null then return null;end if;
  expiry:=least(expiry,receipt_expiry);
  select * into r from mizizi_private.desk_tool_receipts_v1 where id=rid;
  if r.provenance ? 'sharedNative' or (r.provenance ? 'sameCaseRecall' and r.source_id is not null) then
   expiry:=least(expiry,(r.result_text::jsonb->'sources'->0->'source'->>'expiresAt')::timestamptz);
  elsif r.provenance ? 'sharedNativeSearch' then
   expiry:=least(expiry,(r.provenance->'sharedNativeSearch'->>'validUntil')::timestamptz);
  end if;
 end loop;
 if expiry<=clock_timestamp() then return null;end if;
 if o.revision is not null and p_operation='tool_execute' then
  insert into mizizi_private.desk_operational_call_proofs_v1(job_id,case_id,workspace_id,worker_id,lease_expires_at,
   call_sha256,operation,binding_sha256,standing_revision,exact_revision,valid_until)
  values((p_scope->>'jobId')::uuid,(c->>'caseId')::uuid,(c->>'workspaceId')::uuid,p_scope->>'workerId',
   (p_scope->>'leaseExpiresAt')::timestamptz,p_binding_sha256,p_operation,p_binding_sha256,o.revision,p.revision,expiry)
  on conflict do nothing;
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(p_scope->>'jobId')::uuid
   and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz and q.operation=p_operation
   and q.binding_sha256=p_binding_sha256 and q.standing_revision=o.revision and q.exact_revision is not distinct from p.revision
   and q.valid_until>clock_timestamp()) then return null;end if;
 end if;
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,
  'policyRef','desk-model:'||p_binding_sha256||':'||coalesce(p.revision,0)::text||
   case when o.revision is null then '' else ':standing:'||o.revision::text end,'validUntil',expiry,'allowed',true);
end $function$;
CREATE OR REPLACE FUNCTION mizizi_private.assert_desk_journal_current_v1(p_job_id uuid, p_worker_id text, p_case_id uuid, p_pending jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;b jsonb;ref jsonb;r mizizi_private.desk_tool_receipts_v1;
 s jsonb;a jsonb;seen uuid[];sid uuid;o mizizi_private.desk_operational_policy_versions_v1;deps uuid[];dep_sources uuid[];batch_bound boolean;
begin
 -- Same lock order as the existing custody RPCs: policy lock, then exact
 -- job/case locks. Public chart RPCs take the policy lock before row locks.
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
 if c is null or c->>'caseId' is distinct from p_case_id::text then
  raise exception 'Desk journal scope denied' using errcode='42501';end if;
 if p_pending is not null and not mizizi_private.desk_reopening_pending_pass_v1(p_job_id,p_case_id,p_pending) then
  raise exception 'Desk reopening event journal binding denied' using errcode='42501';end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if o.revision is not null and not mizizi_private.desk_operational_policy_live_v1(o,c) then
  raise exception 'Desk operational policy revoked or expired' using errcode='42501';end if;
 for b in
  select p.body_text::jsonb from mizizi_private.research_passes p
   where p.case_id=p_case_id
  union all select p_pending where p_pending is not null
 loop
  if b->>'caseId' is distinct from c->>'caseId'
   or b->>'workspaceId' is distinct from c->>'workspaceId'
   or jsonb_typeof(b->'sourceReceipts') is distinct from 'array'
   or jsonb_array_length(b->'sourceReceipts')>30 then
   raise exception 'Desk journal source shape denied' using errcode='42501';end if;
  if b ? 'factualNoteReferences' and not coalesce(mizizi_private.desk_factual_note_references_current_v1(c||jsonb_build_object('workerId',p_worker_id),b),false) then
   raise exception 'Desk original factual note context denied' using errcode='42501';end if;
  batch_bound:=false;
  if b ? 'deskBatchReceipt' then
   batch_bound:=mizizi_private.desk_retained_batch_journal_current_v1(c,b);
   if not batch_bound then raise exception 'Desk batch journal binding denied' using errcode='42501';end if;
  end if;
  seen:=array[]::uuid[];
  for ref in select value from jsonb_array_elements(b->'sourceReceipts')
  loop
   if jsonb_typeof(ref) is distinct from 'object'
    or coalesce(ref->>'sourceId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
    or ref->'modelDisclosed' is distinct from 'true'::jsonb then
    raise exception 'Desk journal source denied' using errcode='42501';end if;
   sid:=(ref->>'sourceId')::uuid;
   if sid=any(seen) then raise exception 'Desk journal duplicate source denied' using errcode='42501';end if;
   seen:=array_append(seen,sid);
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=sid and source_id=sid;
   if not found or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then
    raise exception 'Desk journal custody denied' using errcode='42501';end if;
   s:=null;
   select value into s from jsonb_array_elements(r.result_text::jsonb->'sources')
    where value->'source'->>'sourceId'=sid::text;
   a:=s->'source';
   if s is null or a->>'caseId' is distinct from c->>'caseId'
    or a->>'workspaceId' is distinct from c->>'workspaceId'
    or ref->'originKey' is distinct from a->'originKey'
    or ref->'lineageKey' is distinct from a->'lineageKey'
    or ref->'payloadFingerprint' is distinct from a->'fingerprint'
    or ref->'useBasis' is distinct from a->'useBasis'
    or ref->'authorityRef' is distinct from a->'authorityRef'
    or ref->'observedAt' is distinct from a->'observedAt'
    or ref->'citation' is distinct from s->'citation'
    or ref->'excerpt' is distinct from s->'excerpt'
    or a->'privateResearchAllowed' is distinct from 'true'::jsonb
    or a->'externalModelProcessingAllowed' is distinct from 'true'::jsonb
    or a->'privateEvidenceRetentionAllowed' is distinct from 'true'::jsonb
    or a->'revokedAt' is distinct from 'null'::jsonb
    or coalesce((a->>'expiresAt')::timestamptz<=clock_timestamp(),true) then
    raise exception 'Desk journal source projection denied' using errcode='42501';end if;
  end loop;
  if o.revision is not null or b ? 'deskToolReceipts' then
   if jsonb_typeof(b->'deskToolReceipts') is distinct from 'array' or jsonb_array_length(b->'deskToolReceipts')>4 then
    raise exception 'Desk journal dependency shape denied' using errcode='42501';end if;
   deps:=array[]::uuid[];dep_sources:=array[]::uuid[];
   for ref in select value from jsonb_array_elements(b->'deskToolReceipts') loop
    if jsonb_typeof(ref) is distinct from 'object' or coalesce(ref->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
     then raise exception 'Desk journal dependency denied' using errcode='42501';end if;
    sid:=(ref->>'receiptId')::uuid;
    if sid=any(deps) then raise exception 'Duplicate desk dependency' using errcode='42501';end if;
    select * into r from mizizi_private.desk_tool_receipts_v1 where id=sid;
    if not found or r.call_sha256 is distinct from ref->>'callSha256' or r.result_sha256 is distinct from ref->>'resultSha256'
     or not mizizi_private.desk_custody_receipt_current_v1(r,c) then
     raise exception 'Desk journal dependency custody denied' using errcode='42501';end if;
    if o.revision is not null and p_pending is not null and b=p_pending and not batch_bound and
     (r.job_id is distinct from p_job_id or r.worker_id is distinct from p_worker_id
      or r.lease_expires_at is distinct from (c->>'leaseExpiresAt')::timestamptz) then
     raise exception 'Desk journal pending dependency lease denied' using errcode='42501';end if;
    if r.provenance->'detail' ? 'localBrowser' and not exists(
     select 1 from mizizi_private.desk_resource_events_v1 e
     where e.reservation_id=(r.provenance->'detail'->'localBrowser'->>'reservationId')::uuid
      and e.state='close_acknowledged' and e.detail->>'sessionId'=r.provenance->'detail'->'localBrowser'->>'sessionId')
    then raise exception 'Desk local browser cleanup unconfirmed' using errcode='42501';end if;
    deps:=array_append(deps,sid);
    if r.source_id is not null then dep_sources:=array_append(dep_sources,r.source_id);end if;
   end loop;
   if not(seen @> dep_sources and dep_sources @> seen) then
    raise exception 'Desk journal dependency source set denied' using errcode='42501';end if;
   if o.revision is not null and p_pending is not null and b=p_pending and exists(
    select 1 from mizizi_private.desk_tool_receipts_v1 q where q.job_id=p_job_id
     and q.lease_expires_at=(c->>'leaseExpiresAt')::timestamptz and not(q.id=any(deps))) then
    raise exception 'Desk journal missing lease dependency' using errcode='42501';end if;
  end if;
 end loop;
 if (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then
  raise exception 'Desk journal lease expired' using errcode='55000';end if;
end $function$;

commit;
