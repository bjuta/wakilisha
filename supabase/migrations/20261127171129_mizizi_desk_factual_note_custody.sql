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
commit;
